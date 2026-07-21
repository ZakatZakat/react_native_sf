"""Editorial landing posters — up to 4 manually chosen events whose posters
fill the landing thumbnail strip. Reuses WeekPickRepository for the candidate
shortlist + item shaping; adds per-slot CRUD on the landing_picks table."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import EventCurated, LandingPick, PostRaw
from app.repositories.week import WeekPickRepository

MAX_SLOTS = 4


class LandingPickRepository(WeekPickRepository):
    """Inherits `_items` / `_tags_for` / `_channels_for` / `list_candidates`
    from WeekPickRepository (the candidate query is identical)."""

    async def current_picks(self) -> list[dict]:
        """The chosen events ordered by slot (0..3). Skips picks whose event
        was deleted (FK cascade already removes those rows) AND picks whose
        event has already passed — the media cleanup sweeps a past event's
        poster, so it would render as a broken «?» card on the landing strip."""
        now = datetime.utcnow()
        rows = (
            await self.s.execute(
                select(EventCurated, PostRaw, LandingPick.slot)
                .join(LandingPick, LandingPick.event_id == EventCurated.id)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .where(or_(EventCurated.event_time >= now, EventCurated.event_time.is_(None)))
                .order_by(LandingPick.slot.asc())
            )
        ).all()
        return await self._items([(ev, post) for ev, post, _slot in rows])

    async def set_pick(self, slot: int, event_id: int, admin_id: int | None) -> list[dict]:  # type: ignore[override]
        """Upsert one slot (0..3)."""
        slot = max(0, min(MAX_SLOTS - 1, int(slot)))
        stmt = pg_insert(LandingPick).values(slot=slot, event_id=event_id, chosen_by=admin_id)
        stmt = stmt.on_conflict_do_update(
            index_elements=[LandingPick.slot],
            set_={"event_id": event_id, "chosen_by": admin_id, "created_at": datetime.utcnow()},
        )
        await self.s.execute(stmt)
        await self.s.flush()
        return await self.current_picks()

    async def clear_pick(self, slot: int | None = None) -> None:  # type: ignore[override]
        """Clear one slot, or all slots when slot is None."""
        if slot is None:
            await self.s.execute(delete(LandingPick))
        else:
            await self.s.execute(delete(LandingPick).where(LandingPick.slot == int(slot)))
