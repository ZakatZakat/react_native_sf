"""Tag + EventTag repositories."""

from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ClassifierSource, EventTag, Tag


class TagsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def list_all(self) -> Sequence[Tag]:
        stmt = select(Tag).order_by(Tag.sort_order, Tag.id)
        result = await self.s.execute(stmt)
        return result.scalars().all()

    async def get_by_key(self, key: str) -> Tag | None:
        stmt = select(Tag).where(Tag.key == key)
        result = await self.s.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self, *, key: str, label: str, symbol: str | None = None,
        keywords: list[str] | None = None, sort_order: int = 0, parent_id: int | None = None,
    ) -> Tag:
        stmt = pg_insert(Tag).values(
            key=key, label=label, symbol=symbol,
            keywords=keywords or [], sort_order=sort_order, parent_id=parent_id,
        ).on_conflict_do_update(
            index_elements=["key"],
            set_={
                "label": label, "symbol": symbol,
                "keywords": keywords or [], "sort_order": sort_order, "parent_id": parent_id,
            },
        ).returning(Tag)
        result = await self.s.execute(stmt)
        return result.scalar_one()

    async def upsert_many(self, items: list[dict]) -> int:
        n = 0
        for it in items:
            await self.upsert(
                key=it["key"], label=it["label"],
                symbol=it.get("symbol"),
                keywords=it.get("keywords") or [],
                sort_order=it.get("sort_order", 0),
            )
            n += 1
        return n


class EventTagsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.s = session

    async def attach(
        self, event_id: int, tag_id: int, *,
        confidence: float = 1.0, source: ClassifierSource = ClassifierSource.keyword,
    ) -> None:
        et = EventTag(event_id=event_id, tag_id=tag_id, confidence=confidence, source=source)
        self.s.add(et)
        try:
            await self.s.flush()
        except IntegrityError:
            await self.s.rollback()  # already attached

    async def attach_many(
        self, event_id: int, tag_ids_with_conf: list[tuple[int, float]],
        source: ClassifierSource = ClassifierSource.keyword,
    ) -> int:
        if not tag_ids_with_conf:
            return 0
        rows = [
            {"event_id": event_id, "tag_id": tid, "confidence": conf, "source": source}
            for tid, conf in tag_ids_with_conf
        ]
        stmt = pg_insert(EventTag).values(rows).on_conflict_do_nothing(
            index_elements=["event_id", "tag_id"]
        )
        result = await self.s.execute(stmt)
        return result.rowcount or 0

    async def by_event(self, event_id: int) -> list[tuple[Tag, EventTag]]:
        stmt = (
            select(Tag, EventTag)
            .join(EventTag, EventTag.tag_id == Tag.id)
            .where(EventTag.event_id == event_id)
        )
        result = await self.s.execute(stmt)
        return list(result.all())

    async def clear_by_event(self, event_id: int) -> None:
        from sqlalchemy import delete
        await self.s.execute(delete(EventTag).where(EventTag.event_id == event_id))
