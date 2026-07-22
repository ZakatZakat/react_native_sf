"""User-side repositories: interests, feedback, personalized feed."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Sequence

from sqlalchemy import String, delete, distinct, func, or_, select
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


_LEAD_JUNK = re.compile(r"^[\W_]+", re.UNICODE)  # ведущие эмодзи/символы/пробелы


def derive_title(text: str | None) -> str:
    """Fallback-заголовок из текста, когда кураторского нет: первая строка с реальным
    словом, очищенная от ведущих эмодзи/символов. Ловит частый случай, когда 1-я
    строка декоративная («🇮🇷 х 🗣»), а название — на следующей."""
    if not text:
        return "Событие"
    for raw in text.split("\n")[:4]:
        line = _LEAD_JUNK.sub("", raw).strip()
        if re.search(r"[^\W\d_]{3,}", line):  # есть слово из ≥3 букв
            return line[:200]
    return (text.split("\n", 1)[0][:200]).strip() or "Событие"


def build_feed_item(
    ev: EventCurated, post: PostRaw,
    tags: list[str], tag_labels: list[str], channel_handle: str = "",
) -> dict:
    """Single source of truth for the feed-item payload the frontend consumes
    (feed cards, the map, and the «выбор недели» screen). Keep every producer
    (`list_feed`, week pick) going through this so the shapes never drift."""
    return {
        "id": str(ev.id),
        "channel": channel_handle,
        "channel_id": post.channel_id,
        "message_id": post.message_id,
        "title": (ev.title.strip() if ev.title and ev.title.strip() else derive_title(post.text)),
        "description": post.text,
        "media_urls": post.media_urls or [],
        "media_hash": post.media_hash,  # de-dupe key: identical poster across cross-posts
        "event_time": ev.event_time.isoformat() if ev.event_time else None,
        "event_time_end": ev.event_time_end.isoformat() if ev.event_time_end else None,
        "location": ev.location_text,
        "price": ev.price_text,
        "tags": tags,
        "tag_labels": tag_labels,
        "filter_score": ev.filter_score,
        "created_at": ev.created_at.isoformat(),
        # Resolved coordinates (if geocoded) — [lat, lng] for the map.
        "geo": (
            [ev.location_meta["lat"], ev.location_meta["lng"]]
            if isinstance(ev.location_meta, dict) and ev.location_meta.get("lat") is not None
            else None
        ),
        # Gazetteer venue key (e.g. "ges2", "garage") for the place card.
        "venue": (
            ev.location_meta.get("venue")
            if isinstance(ev.location_meta, dict) else None
        ),
    }


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
        # Base events query — upcoming (and undated) events. Past-dated events
        # are dropped so the feed/map shows what's still ahead. Geocoded events
        # come FIRST (then by soonest event_time): the map plots only events
        # with coordinates, and most upcoming events lack them (no auto-geocode
        # yet), so without this the recency-flood of un-geocoded aggregator
        # posts buries the few geocoded ones out of the fetch window and the map
        # renders empty. Geo-first keeps placeable events in the window.
        now = datetime.utcnow()
        ev_q = (
            select(EventCurated, PostRaw)
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .where(EventCurated.status == EventStatus.approved)
            .where(or_(EventCurated.event_time >= now, EventCurated.event_time.is_(None)))
            # Moscow-only feed: drop events tagged as another city. region is set
            # by the city-detection pass (coords for geocoded, poster-vision for
            # the rest); unset/unknown defaults to moscow so nothing is lost.
            .where(func.coalesce(EventCurated.location_meta.op("->>")("region"), "moscow").notin_(["spb", "other"]))
            # Usable poster required: an event with no image, or video-only media,
            # renders as a blank card — keep it out of the feed/map entirely.
            .where(func.cast(PostRaw.media_urls, String).ilike("%.jpg%"))
            # Cross-post dedup: одна карточка на событие (app.ranking выставляет
            # is_primary). До первого пересчёта is_primary=true у всех → фильтр
            # ничего не режет (безопасно).
            .where(EventCurated.is_primary.is_(True))
            # Ранжирование: «самое интересное вверх» (app.ranking.rank_score).
            # Неотранжированные (новые/до пересчёта) → нейтральный 0.5: садятся в
            # середину (видны, не хоронятся вниз). До первого пересчёта все = 0.5 →
            # тай → прежний порядок: гео-первыми, затем ближайшие по времени.
            .order_by(
                func.coalesce(EventCurated.rank_score, 0.5).desc(),
                EventCurated.location_meta.isnot(None).desc(),
                EventCurated.event_time.asc().nulls_last(),
            )
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
        tag_labels_by_event: dict[int, list[str]] = {eid: [] for eid in ev_ids}
        if ev_ids:
            tag_rows = (
                await self.s.execute(
                    select(EventTag.event_id, Tag.key, Tag.label)
                    .join(Tag, Tag.id == EventTag.tag_id)
                    .where(EventTag.event_id.in_(ev_ids))
                    .order_by(EventTag.confidence.desc())
                )
            ).all()
            for eid, key, label in tag_rows:
                tags_by_event[eid].append(key)
                tag_labels_by_event[eid].append(label)

        # Build feed payload (matches what frontend expects: EventCard-like)
        feed: list[dict] = [
            build_feed_item(
                ev, post,
                tags_by_event.get(ev.id, []),
                tag_labels_by_event.get(ev.id, []),
            )
            for ev, post in rows
        ]

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
