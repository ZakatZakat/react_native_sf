"""Tag taxonomy CRUD + reclassify all + Claude (llm) classification write-back."""

from __future__ import annotations

from typing import Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
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
    """Re-run keyword classifier across every event_curated. Drops existing
    keyword-sourced event_tags first (llm/manual tags are left untouched).

    Events that already carry llm (Claude) tags are SKIPPED entirely — llm is
    authoritative, we don't want keyword tags mixed back into a Claude-owned
    event. Insert is on_conflict_do_nothing so a keyword tag_id that collides
    with an existing llm/manual row can never abort the batch."""
    from sqlalchemy import select, delete, distinct
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models import ClassifierSource, EventCurated, EventTag, PostRaw, Tag
    from app.pipeline.classifier import KeywordClassifier

    sf: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    classifier = KeywordClassifier()

    async with session_scope(sf) as s:
        tags = list((await s.execute(select(Tag))).scalars().all())
        # Events owned by Claude (have ≥1 llm tag) — leave them alone.
        llm_events = {
            r[0] for r in (await s.execute(
                select(distinct(EventTag.event_id)).where(EventTag.source == ClassifierSource.llm)
            )).all()
        }
        # Wipe existing keyword classifications
        await s.execute(delete(EventTag).where(EventTag.source == ClassifierSource.keyword))
        # Re-classify
        rows = (await s.execute(select(EventCurated.id, PostRaw.text).join(PostRaw, PostRaw.id == EventCurated.post_id))).all()
        n_events = 0
        n_skipped = 0
        n_assignments = 0
        for ev_id, text in rows:
            if ev_id in llm_events:
                n_skipped += 1
                continue
            assignments = classifier.classify(text or "", tags)
            n_events += 1
            for a in assignments:
                stmt = pg_insert(EventTag).values(
                    event_id=ev_id, tag_id=a.tag_id, confidence=a.confidence,
                    source=ClassifierSource.keyword,
                ).on_conflict_do_nothing(index_elements=["event_id", "tag_id"])
                await s.execute(stmt)
                n_assignments += 1

    return {
        "events_processed": n_events, "assignments_created": n_assignments,
        "tags_used": len(tags), "events_skipped_llm_owned": n_skipped,
    }


# ── Claude (llm) classification write-back ─────────────────────────────
# Turnkey replacement for the raw-psql write step: Claude classifies event
# texts in-session (semantic judgment, not substring), then POSTs its decisions
# here. Rows are written with source='llm' so /tags/reclassify never clobbers
# them. Internal-only (curator is not host-published), same as /reclassify —
# no auth guard, matching the rest of this router.
class LlmTagItem(BaseModel):
    key: str
    confidence: float = 1.0


class LlmAssignment(BaseModel):
    event_id: int
    # each tag is either {"key","confidence"} or a bare "key" string (conf=1.0)
    tags: list[Union[LlmTagItem, str]] = Field(default_factory=list)


class ClassifyLlmBody(BaseModel):
    assignments: list[LlmAssignment]
    # "all": drop every existing tag on the event (Claude owns it — default)
    # "llm": drop only prior llm tags, keep keyword
    # "none": add on top, delete nothing
    replace: Literal["all", "llm", "none"] = "all"


@router.post("/classify-llm")
async def classify_llm(
    body: ClassifyLlmBody,
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    from sqlalchemy import select, delete
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models import ClassifierSource, EventCurated, EventTag, Tag

    # Normalise (key, confidence) pairs per event; collect the full key set.
    per_event: dict[int, list[tuple[str, float]]] = {}
    all_keys: set[str] = set()
    for a in body.assignments:
        pairs: list[tuple[str, float]] = []
        for t in a.tags:
            if isinstance(t, str):
                key, conf = t, 1.0
            else:
                key, conf = t.key, t.confidence
            pairs.append((key, max(0.0, min(1.0, conf))))
            all_keys.add(key)
        per_event[a.event_id] = pairs

    async with session_scope(sf) as s:
        # Resolve keys → ids in one query; unknowns are reported, not fatal.
        key_to_id = {
            k: i for i, k in (
                await s.execute(select(Tag.id, Tag.key).where(Tag.key.in_(all_keys)))
            ).all()
        }
        unknown_keys = sorted(all_keys - set(key_to_id))

        # Which requested events actually exist?
        existing = {
            r[0] for r in (
                await s.execute(select(EventCurated.id).where(EventCurated.id.in_(per_event.keys())))
            ).all()
        }
        missing_events = sorted(set(per_event) - existing)

        events_written = 0
        tags_written = 0
        for ev_id, pairs in per_event.items():
            if ev_id not in existing:
                continue
            if body.replace == "all":
                await s.execute(delete(EventTag).where(EventTag.event_id == ev_id))
            elif body.replace == "llm":
                await s.execute(delete(EventTag).where(
                    EventTag.event_id == ev_id, EventTag.source == ClassifierSource.llm,
                ))
            wrote_any = False
            for key, conf in pairs:
                tid = key_to_id.get(key)
                if tid is None:
                    continue
                stmt = pg_insert(EventTag).values(
                    event_id=ev_id, tag_id=tid, confidence=conf, source=ClassifierSource.llm,
                ).on_conflict_do_nothing(index_elements=["event_id", "tag_id"])
                res = await s.execute(stmt)
                tags_written += res.rowcount or 0
                wrote_any = True
            if wrote_any:
                events_written += 1

    return {
        "events": events_written, "tags_written": tags_written,
        "unknown_keys": unknown_keys, "missing_events": missing_events,
    }
