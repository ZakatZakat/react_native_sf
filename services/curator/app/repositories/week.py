"""Editorial «выбор недели» — the manual hero pick + candidate shortlist for
the Week digest screen. Reuses `build_feed_item` so picks/candidates carry the
exact same payload shape as the regular feed."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Channel, EventCurated, EventStatus, EventTag, PostRaw, Tag, WeekPick
from app.repositories.me import build_feed_item


def week_start(d: date | None = None) -> date:
    """Monday of the ISO week containing `d` (defaults to today, UTC)."""
    d = d or datetime.utcnow().date()
    return d - timedelta(days=d.weekday())


class WeekPickRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def _tags_for(self, event_ids: list[int]) -> tuple[dict[int, list[str]], dict[int, list[str]]]:
        keys: dict[int, list[str]] = {eid: [] for eid in event_ids}
        labels: dict[int, list[str]] = {eid: [] for eid in event_ids}
        if event_ids:
            rows = (
                await self.s.execute(
                    select(EventTag.event_id, Tag.key, Tag.label)
                    .join(Tag, Tag.id == EventTag.tag_id)
                    .where(EventTag.event_id.in_(event_ids))
                    .order_by(EventTag.confidence.desc())
                )
            ).all()
            for eid, key, label in rows:
                keys[eid].append(key)
                labels[eid].append(label)
        return keys, labels

    async def _channels_for(self, channel_ids: set[int]) -> dict[int, str]:
        if not channel_ids:
            return {}
        rows = (await self.s.execute(select(Channel.id, Channel.handle).where(Channel.id.in_(channel_ids)))).all()
        return {cid: handle for cid, handle in rows}

    async def _items(self, rows: list[tuple[EventCurated, PostRaw]]) -> list[dict]:
        ev_ids = [ev.id for ev, _ in rows]
        keys, labels = await self._tags_for(ev_ids)
        ch = await self._channels_for({post.channel_id for _, post in rows})
        return [
            build_feed_item(ev, post, keys.get(ev.id, []), labels.get(ev.id, []), ch.get(post.channel_id, ""))
            for ev, post in rows
        ]

    async def current_pick(self) -> dict | None:
        """The active week pick as a feed item, or None (→ app auto-fallback).

        Newest pick wins; a pick self-expires once its event has ended (guards
        against a stale carry-over lingering if the editor forgets to re-pick)."""
        now = datetime.utcnow()
        q = (
            select(EventCurated, PostRaw)
            .join(WeekPick, WeekPick.event_id == EventCurated.id)
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .where(EventCurated.status == EventStatus.approved)
            .where(or_(EventCurated.event_time >= now - timedelta(days=1), EventCurated.event_time.is_(None)))
            .order_by(WeekPick.week_start.desc(), WeekPick.created_at.desc())
            .limit(1)
        )
        row = (await self.s.execute(q)).first()
        if row is None:
            return None
        items = await self._items([(row[0], row[1])])
        return items[0] if items else None

    async def set_pick(self, event_id: int, admin_id: int | None) -> dict | None:
        """Upsert this week's pick (one active pick per ISO week)."""
        ws = week_start()
        stmt = pg_insert(WeekPick).values(event_id=event_id, week_start=ws, chosen_by=admin_id)
        stmt = stmt.on_conflict_do_update(
            index_elements=[WeekPick.week_start],
            set_={"event_id": event_id, "chosen_by": admin_id, "created_at": datetime.utcnow()},
        )
        await self.s.execute(stmt)
        await self.s.flush()
        return await self.current_pick()

    async def clear_pick(self) -> None:
        await self.s.execute(delete(WeekPick).where(WeekPick.week_start == week_start()))

    async def list_candidates(self, limit: int = 40) -> list[dict]:
        """Upcoming approved Moscow events that HAVE a poster, ranked by
        filter_score (quality signal) then soonest — the editor's shortlist."""
        now = datetime.utcnow()
        q = (
            select(EventCurated, PostRaw)
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .where(EventCurated.status == EventStatus.approved)
            .where(or_(EventCurated.event_time >= now, EventCurated.event_time.is_(None)))
            .order_by(EventCurated.filter_score.desc(), EventCurated.event_time.asc().nulls_last())
            .limit(limit * 4)
        )
        rows = (await self.s.execute(q)).all()
        # Keep only events with a usable poster (image suitability is the point),
        # filtered in Python to avoid JSON-array SQL portability quirks.
        with_poster = [(ev, post) for ev, post in rows if post.media_urls][:limit]
        return await self._items(with_poster)
