"""Web Push sending + fanout when an event becomes approved.

Throttle: max 1 push per user per hour, 5 per day.
Uses pywebpush (which uses py_vapid + http_ece) to encrypt + send.
"""

from __future__ import annotations

import asyncio
import json
import logging
from base64 import urlsafe_b64decode
from datetime import datetime, timedelta
from typing import Any

from pywebpush import webpush, WebPushException
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.config import Settings
from app.db import session_scope
from app.models import (
    Channel,
    EventCurated,
    EventTag,
    PostRaw,
    PushStatus,
    PushSubscription,
    Tag,
    UserInterest,
)
from app.repositories.push import PushLogRepository, PushSubscriptionsRepository

logger = logging.getLogger(__name__)


THROTTLE_PER_HOUR = 1
THROTTLE_PER_DAY = 5


def _b64_to_pem_private_key(b64: str) -> str:
    """Convert raw 32-byte base64-url private key to PEM (pywebpush expects PEM or raw bytes)."""
    # pywebpush actually accepts raw base64-url string of the 32-byte private scalar
    # (it does the PEM conversion internally). So we pass through.
    return b64


class PushService:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession], settings: Settings) -> None:
        self.sf = session_factory
        self.settings = settings

    def _vapid_claims(self, audience: str) -> dict[str, Any]:
        return {"sub": self.settings.vapid_subject, "aud": audience}

    def _send(self, sub: PushSubscription, payload: dict) -> None:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=self.settings.vapid_private_key,
            vapid_claims={"sub": self.settings.vapid_subject},
            ttl=3600,
        )

    async def send_to_subscription(
        self, sub: PushSubscription, payload: dict, event_id: int,
    ) -> tuple[bool, str | None]:
        try:
            # webpush is sync; offload to executor
            await asyncio.get_event_loop().run_in_executor(None, self._send, sub, payload)
            return True, None
        except WebPushException as e:
            return False, f"{e.response.status_code if e.response else '?'}: {e!s}"[:480]
        except Exception as e:  # noqa: BLE001
            return False, f"unexpected: {e!s}"[:480]

    async def fanout_for_event(self, event_id: int) -> dict:
        """Find users whose interests overlap with the event's tags, send them push.

        Returns counts: matched_users, sent, throttled, failed, no_subs.
        """
        async with session_scope(self.sf) as s:
            # Load event + its tags + post + channel for the payload
            row = (await s.execute(
                select(EventCurated, PostRaw, Channel)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .join(Channel, Channel.id == PostRaw.channel_id)
                .where(EventCurated.id == event_id)
            )).first()
            if not row:
                logger.info("fanout: event %d not found", event_id)
                return {"matched_users": 0, "sent": 0, "throttled": 0, "failed": 0, "no_subs": 0}
            ev, post, channel = row

            tag_keys = [
                k for (k,) in (await s.execute(
                    select(Tag.key).join(EventTag, EventTag.tag_id == Tag.id)
                    .where(EventTag.event_id == event_id)
                )).all()
            ]
            if not tag_keys:
                logger.info("fanout: event %d has no tags, skipping", event_id)
                return {"matched_users": 0, "sent": 0, "throttled": 0, "failed": 0, "no_subs": 0}

            # Users with at least one matching interest
            user_ids = [
                uid for (uid,) in (await s.execute(
                    select(distinct(UserInterest.user_id))
                    .where(UserInterest.tag_key.in_(tag_keys))
                )).all()
            ]
            if not user_ids:
                return {"matched_users": 0, "sent": 0, "throttled": 0, "failed": 0, "no_subs": 0}

            # Throttle filter
            log_repo = PushLogRepository(s)
            now = datetime.utcnow()
            cutoff_hour = now - timedelta(hours=1)
            cutoff_day = now - timedelta(days=1)

            ok_user_ids: list[int] = []
            throttled = 0
            for uid in user_ids:
                hourly = await log_repo.count_recent(uid, cutoff_hour)
                daily = await log_repo.count_recent(uid, cutoff_day)
                if hourly >= THROTTLE_PER_HOUR or daily >= THROTTLE_PER_DAY:
                    throttled += 1
                    continue
                ok_user_ids.append(uid)

            subs = await PushSubscriptionsRepository(s).list_for_users(ok_user_ids)
            users_with_subs = {sub.user_id for sub in subs}
            no_subs = len(ok_user_ids) - len(users_with_subs)

            # Build payload
            title_line = (post.text.split("\n", 1)[0] or "Новое событие")[:80]
            payload = {
                "title": title_line,
                "body": (post.text or "")[:160],
                "url": f"/pipe-feed-swipe?focus={ev.id}",
                "channel": channel.handle,
                "tags": tag_keys,
            }

            sent = failed = 0
            for sub in subs:
                ok, err = await self.send_to_subscription(sub, payload, ev.id)
                if ok:
                    await log_repo.log(user_id=sub.user_id, event_id=ev.id, status=PushStatus.sent)
                    sent += 1
                else:
                    await log_repo.log(user_id=sub.user_id, event_id=ev.id, status=PushStatus.failed, error=err)
                    failed += 1

        result = {
            "matched_users": len(user_ids),
            "sent": sent, "throttled": throttled, "failed": failed, "no_subs": no_subs,
        }
        logger.info("fanout for event %d: %s", event_id, result)
        return result


_push_service: PushService | None = None


def get_push_service() -> PushService | None:
    return _push_service


def set_push_service(svc: PushService) -> None:
    global _push_service
    _push_service = svc
