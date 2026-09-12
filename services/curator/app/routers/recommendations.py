"""Раздел «Рекомендации» — ивенты, вытащенные из редакторских дайджестов
@napervom («Первый ночной»). Дайджесты — статьи на Teletype («Выставки/Тусовки
недели»); из каждой достаём ОТДЕЛЬНЫЕ ивенты (название, площадка, дата, описание,
обложка) и складываем в таблицу recommendations как «выбор редакции».

- GET  /recommendations            — публичная лента этих ивентов (для раздела).
- POST /recommendations/ingest     — залив вытащенных ивентов (require_admin);
  геокодит площадку через gazetteer (best-effort) и дедупит по (digest_url,title).

Извлечение из статей делает не бэкенд (нет LLM), а внешний прогон (агент/воркфлоу),
который POST-ит сюда — как модерация/заголовки.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth import require_admin
from app.db import session_scope
from app.models import RecommendationEvent
from app.pipeline import gazetteer

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


# ── GET: лента ивентов-рекомендаций ──────────────────────────────────
@router.get("")
async def list_recommendations(
    limit: int = Query(60, ge=1, le=200),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(RecommendationEvent)
                # свежие дайджесты сверху, внутри — по времени события
                .order_by(
                    RecommendationEvent.published_at.desc().nullslast(),
                    RecommendationEvent.event_time.asc().nullslast(),
                    RecommendationEvent.id.asc(),
                )
                .limit(limit)
            )
        ).scalars().all()
    items = [{
        "id": str(r.id),
        "title": r.title,
        "venue": r.venue,
        "address": r.address,
        "venue_key": r.venue_key,
        "geo": [r.lat, r.lng] if (r.lat is not None and r.lng is not None) else None,
        "date_text": r.date_text,
        "event_time": r.event_time.isoformat() if r.event_time else None,
        "description": r.description,
        "cover": r.cover_url,
        "category": r.category,
        "matched_event_id": r.matched_event_id,
        "digest_title": r.digest_title,
        "digest_url": r.digest_url,
        "source": r.source_channel,
    } for r in rows]
    return {"items": items, "count": len(items)}


# ── POST: залив вытащенных из статьи ивентов ─────────────────────────
class RecoItem(BaseModel):
    digest_url: str
    digest_title: Optional[str] = None
    title: str
    venue: Optional[str] = None
    address: Optional[str] = None
    date_text: Optional[str] = None
    event_time: Optional[str] = None      # ISO
    description: Optional[str] = None
    cover_url: Optional[str] = None
    category: Optional[str] = None
    published_at: Optional[str] = None     # ISO (дата поста-дайджеста)
    source_channel: str = "@napervom"


class RecoIngestBody(BaseModel):
    items: list[RecoItem]


def _dt(iso: Optional[str]) -> Optional[datetime]:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


# ── POST: проставить обложки (постеры) существующим ивентам по id ─────
# Постеры тянутся из статей-дайджестов Teletype (по одному <figure> на ивент)
# и заливаются сюда батчем — как заголовки/модерация.
class CoverItem(BaseModel):
    id: int
    cover_url: str


class CoverBody(BaseModel):
    items: list[CoverItem]


@router.post("/covers")
async def set_covers(
    body: CoverBody,
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    updated = 0
    async with session_scope(sf) as s:
        for it in body.items:
            res = await s.execute(
                update(RecommendationEvent)
                .where(RecommendationEvent.id == it.id)
                .values(cover_url=it.cover_url)
            )
            updated += res.rowcount or 0
    return {"updated": updated, "received": len(body.items)}


# ── POST: привязать пики к событиям ленты (events_curated) ───────────
# «Выбор редакции» подсвечивает СУЩЕСТВУЮЩЕЕ событие ленты (его постер/карточку),
# а не дубль-карточку из статьи. Матчинг делает внешний прогон (семантика + verify).
class MatchItem(BaseModel):
    id: int
    matched_event_id: Optional[str] = None   # null → снять привязку


class MatchBody(BaseModel):
    items: list[MatchItem]


@router.post("/matches")
async def set_matches(
    body: MatchBody,
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    updated = 0
    async with session_scope(sf) as s:
        for it in body.items:
            res = await s.execute(
                update(RecommendationEvent)
                .where(RecommendationEvent.id == it.id)
                .values(matched_event_id=(it.matched_event_id or None))
            )
            updated += res.rowcount or 0
    return {"updated": updated, "received": len(body.items)}


@router.post("/ingest")
async def ingest_recommendations(
    body: RecoIngestBody,
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    inserted = 0
    async with session_scope(sf) as s:
        for it in body.items:
            geo = gazetteer.geocode(
                text=f"{it.title} {it.description or ''}",
                location_text=it.venue or it.address,
                channel_handle=None,
            )
            values = {
                "source_channel": it.source_channel,
                "digest_url": it.digest_url,
                "digest_title": it.digest_title,
                "title": it.title.strip()[:300],
                "venue": (it.venue or None),
                "address": (it.address or None),
                "venue_key": geo.get("venue") if geo else None,
                "lat": geo.get("lat") if geo else None,
                "lng": geo.get("lng") if geo else None,
                "date_text": it.date_text,
                "event_time": _dt(it.event_time),
                "description": it.description,
                "cover_url": it.cover_url,
                "category": it.category,
                "published_at": _dt(it.published_at),
            }
            stmt = (
                pg_insert(RecommendationEvent)
                .values(**values)
                .on_conflict_do_nothing(constraint="uq_reco_digest_title")
            )
            res = await s.execute(stmt)
            inserted += res.rowcount or 0
    return {"inserted": inserted, "received": len(body.items)}
