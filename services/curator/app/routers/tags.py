"""Tag taxonomy CRUD + reclassify all."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.db import session_scope
from app.repositories.tags import TagsRepository

router = APIRouter(prefix="/tags", tags=["tags"])


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    key: str
    label: str
    symbol: Optional[str] = None
    keywords: list[str]
    sort_order: int


class TagUpsert(BaseModel):
    key: str
    label: str
    symbol: Optional[str] = None
    keywords: list[str] = []
    sort_order: int = 0


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


@router.get("", response_model=list[TagOut])
async def list_tags(sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory)) -> list[TagOut]:
    async with session_scope(sf) as s:
        rows = await TagsRepository(s).list_all()
        return [TagOut.model_validate(r) for r in rows]


@router.post("", response_model=TagOut, status_code=201)
async def upsert_tag(
    payload: TagUpsert,
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> TagOut:
    async with session_scope(sf) as s:
        row = await TagsRepository(s).upsert(
            key=payload.key, label=payload.label, symbol=payload.symbol,
            keywords=payload.keywords, sort_order=payload.sort_order,
        )
        return TagOut.model_validate(row)


@router.get("/{key}", response_model=TagOut)
async def get_tag(key: str, sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory)) -> TagOut:
    async with session_scope(sf) as s:
        row = await TagsRepository(s).get_by_key(key)
        if not row:
            raise HTTPException(404, f"tag {key} not found")
        return TagOut.model_validate(row)


@router.post("/reclassify")
async def reclassify_all(request: Request) -> dict:
    """Re-run keyword classifier across every event_curated. Drops existing event_tags first."""
    from sqlalchemy import select, delete
    from app.models import EventCurated, EventTag, PostRaw, Tag
    from app.pipeline.classifier import KeywordClassifier

    sf: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    classifier = KeywordClassifier()

    async with session_scope(sf) as s:
        tags = list((await s.execute(select(Tag))).scalars().all())
        # Wipe existing keyword classifications
        await s.execute(delete(EventTag).where(EventTag.source == "keyword"))
        # Re-classify
        rows = (await s.execute(select(EventCurated.id, PostRaw.text).join(PostRaw, PostRaw.id == EventCurated.post_id))).all()
        n_events = 0
        n_assignments = 0
        for ev_id, text in rows:
            assignments = classifier.classify(text or "", tags)
            n_events += 1
            for a in assignments:
                s.add(EventTag(event_id=ev_id, tag_id=a.tag_id, confidence=a.confidence))
                n_assignments += 1
        await s.flush()

    return {"events_processed": n_events, "assignments_created": n_assignments, "tags_used": len(tags)}
