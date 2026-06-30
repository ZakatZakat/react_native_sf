"""User-side repositories: interests, feedback, personalized feed."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

from sqlalchemy import delete, distinct, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    EventCurated,
    EventStatus,
    EventTag,
    FeedbackAction,
    PostRaw,
    Tag,
    UserFeedback,
    UserInterest,
)


class UserInterestsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def list_keys(self, user_id: int) -> list[str]:
        stmt = select(UserInterest.tag_key).where(UserInterest.user_id == user_id)
        result = await self.s.execute(stmt)
        return [r[0] for r in result.all()]

    async def replace(self, user_id: int, tag_keys: list[str]) -> list[str]:
        # Wipe existing
        await self.s.execute(delete(UserInterest).where(UserInterest.user_id == user_id))
        # Validate keys against tags table — silently drop unknowns
        if tag_keys:
            stmt = select(Tag.key).where(Tag.key.in_(tag_keys))
            valid = {r[0] for r in (await self.s.execute(stmt)).all()}
            rows = [{"user_id": user_id, "tag_key": k} for k in tag_keys if k in valid]
            if rows:
                await self.s.execute(pg_insert(UserInterest).values(rows).on_conflict_do_nothing())
            return sorted(valid & set(tag_keys))
        return []


class UserFeedbackRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def add(self, user_id: int, event_id: int, action: FeedbackAction) -> None:
        self.s.add(UserFeedback(user_id=user_id, event_id=event_id, action=action))
        await self.s.flush()

    async def hidden_event_ids(self, user_id: int) -> set[int]:
        stmt = select(distinct(UserFeedback.event_id)).where(
            UserFeedback.user_id == user_id,
            UserFeedback.action == FeedbackAction.hide,
        )
        return {r[0] for r in (await self.s.execute(stmt)).all()}


class PersonalizedFeedRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def list_feed(
        self, *, user_id: int | None, limit: int = 50, offset: int = 0,
        tag_keys: list[str] | None = None,
    ) -> list[dict]:
        """Return approved events with their tags + raw post content.

        - If `user_id` provided, exclude events the user previously hid.
        - If `tag_keys` provided, restrict to events that have ANY of these tags.
        - If neither user_id nor tag_keys → all approved events, recency order.
        """
        # Base events query — upcoming (and undated) events, soonest first.
        # Past-dated events are dropped so the feed/map shows what's still ahead;
        # ordering by event_time (NULLs last) keeps the recency-flood of freshly
        # ingested posts from burying geocoded upcoming events on the map.
        now = datetime.utcnow()
        ev_q = (
            select(EventCurated, PostRaw)
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .where(EventCurated.status == EventStatus.approved)
            .where(or_(EventCurated.event_time >= now, EventCurated.event_time.is_(None)))
            .order_by(EventCurated.event_time.asc().nulls_last())
        )

        # Filter by tags
        if tag_keys:
            tag_subq = (
                select(EventTag.event_id)
                .join(Tag, Tag.id == EventTag.tag_id)
                .where(Tag.key.in_(tag_keys))
                .distinct()
                .subquery()
            )
            ev_q = ev_q.where(EventCurated.id.in_(select(tag_subq.c.event_id)))

        # Hide previously hidden
        if user_id:
            hidden = await UserFeedbackRepository(self.s).hidden_event_ids(user_id)
            if hidden:
                ev_q = ev_q.where(~EventCurated.id.in_(hidden))

        ev_q = ev_q.limit(limit).offset(offset)
        rows = (await self.s.execute(ev_q)).all()

        # Bulk-fetch tags for these events
        ev_ids = [ev.id for ev, _ in rows]
        tags_by_event: dict[int, list[str]] = {eid: [] for eid in ev_ids}
        if ev_ids:
            tag_rows = (
                await self.s.execute(
                    select(EventTag.event_id, Tag.key)
                    .join(Tag, Tag.id == EventTag.tag_id)
                    .where(EventTag.event_id.in_(ev_ids))
                    .order_by(EventTag.confidence.desc())
                )
            ).all()
            for eid, key in tag_rows:
                tags_by_event[eid].append(key)

        # Build feed payload (matches what frontend expects: EventCard-like)
        feed: list[dict] = []
        for ev, post in rows:
            feed.append({
                "id": str(ev.id),
                "channel": "",  # filled below from channel join
                "channel_id": post.channel_id,
                "message_id": post.message_id,
                "title": (post.text.split("\n", 1)[0][:200]) if post.text else "Событие",
                "description": post.text,
                "media_urls": post.media_urls or [],
                "event_time": ev.event_time.isoformat() if ev.event_time else None,
                "event_time_end": ev.event_time_end.isoformat() if ev.event_time_end else None,
                "location": ev.location_text,
                "price": ev.price_text,
                "tags": tags_by_event.get(ev.id, []),
                "filter_score": ev.filter_score,
                "created_at": ev.created_at.isoformat(),
                # Resolved coordinates (if geocoded) — [lat, lng] for the map.
                "geo": (
                    [ev.location_meta["lat"], ev.location_meta["lng"]]
                    if isinstance(ev.location_meta, dict) and ev.location_meta.get("lat") is not None
                    else None
                ),
            })

        # Resolve channel handles in a single query
        if feed:
            from app.models import Channel
            ch_ids = {item["channel_id"] for item in feed}
            ch_map = {
                cid: handle for cid, handle in (
                    await self.s.execute(select(Channel.id, Channel.handle).where(Channel.id.in_(ch_ids)))
                ).all()
            }
            for item in feed:
                item["channel"] = ch_map.get(item["channel_id"], "")

        return feed
