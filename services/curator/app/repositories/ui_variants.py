"""Editorial UI variants — which layout variant of a component to render.

Some components ship several layouts (the Week digest has four «Сплит» designs;
the landing poster strip has its own set). Until now the choice lived in code or
was random per open, so an editor could not pin one. This is the store behind the
admin switcher: one row per component key, value = variant id, absent/"auto" =
the component's own default (which may still be random).

Deliberately generic (key → variant): registering a new switchable component is a
frontend-only change, no migration.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UiVariant

AUTO = "auto"


class UiVariantRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def all(self) -> dict[str, str]:
        """{key: variant} for every pinned component. Keys with no row are absent —
        the frontend treats that as AUTO."""
        rows = (await self.s.execute(select(UiVariant.key, UiVariant.variant))).all()
        return {k: v for k, v in rows}

    async def set(self, key: str, variant: str, admin_id: int | None) -> dict[str, str]:
        """Pin `key` to `variant`. Upsert so repeated saves don't pile up rows."""
        stmt = pg_insert(UiVariant).values(key=key, variant=variant, chosen_by=admin_id)
        stmt = stmt.on_conflict_do_update(
            index_elements=[UiVariant.key],
            set_={"variant": variant, "chosen_by": admin_id, "updated_at": datetime.utcnow()},
        )
        await self.s.execute(stmt)
        await self.s.flush()
        return await self.all()
