"""Оценки событий экспертами (звёзды + короткий коммент).

- `GET /me/expert` — статус/прогресс эксперта текущего юзера (для UI).
- `POST /me/rating` — поставить/обновить/снять оценку. Гейт: только эксперт
  (или владелец). Коммент проходит анти-политический фильтр.
- `GET /events/{id}/ratings` — публичная сводка: средняя, число, отзывы,
  плюс `mine` для авторизованного.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.auth import current_user_id, optional_current_user_id
from app.db import session_scope
from app.models import EventRating
from app.pipeline.detector import looks_political
from app.services.experts import expert_stats, is_expert

router = APIRouter(tags=["ratings"])


def _sf(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


def _engine(request: Request):
    return getattr(request.app.state, "analytics_engine", None)


def _is_owner(request: Request, uid: int) -> bool:
    return uid in request.app.state.settings.admin_user_ids


@router.get("/me/expert")
async def my_expert_status(
    request: Request,
    user_id: int = Depends(current_user_id),
) -> dict:
    settings = request.app.state.settings
    return await expert_stats(_engine(request), user_id, settings, is_owner=_is_owner(request, user_id))


class RatingBody(BaseModel):
    event_id: int
    stars: int            # 1..5 = оценка; 0 = без оценки (коммент-заметка, либо снять если и коммент пуст)
    comment: Optional[str] = None
    author: Optional[str] = None  # отображаемое имя (из initData), опц.


async def _summary(s: AsyncSession, event_id: int, uid: int | None) -> dict:
    rows = (await s.execute(
        select(EventRating).where(EventRating.event_id == event_id, EventRating.hidden.is_(False))
    )).scalars().all()
    # Звёзды опциональны: коммент без оценки хранится как stars=0. Среднее и
    # счётчик — только по строкам со звёздами, но комменты-без-звёзд всё равно
    # попадают в reviews.
    rated = [r for r in rows if r.stars >= 1]
    count = len(rated)
    avg = round(sum(r.stars for r in rated) / count, 1) if count else None
    reviews = [
        {"stars": r.stars, "comment": r.comment,
         "author": r.author_name or "Эксперт", "when": r.created_at.isoformat()}
        for r in rows if (r.comment or "").strip()
    ]
    reviews.sort(key=lambda x: x["when"], reverse=True)
    mine = None
    if uid is not None:
        m = next((r for r in rows if r.tg_id == uid), None)
        if m:
            mine = {"stars": m.stars, "comment": m.comment}
    return {"avg": avg, "count": count, "reviews": reviews, "mine": mine}


@router.post("/me/rating")
async def set_rating(
    body: RatingBody,
    request: Request,
    user_id: int = Depends(current_user_id),
) -> dict:
    settings = request.app.state.settings
    owner = _is_owner(request, user_id)
    if not await is_expert(_engine(request), user_id, settings, is_owner=owner):
        raise HTTPException(403, "not an expert yet")

    comment = (body.comment or "").strip()[:140] or None
    if comment and looks_political(comment):
        raise HTTPException(400, "comment rejected")
    author = (body.author or "").strip()[:80] or None

    sf = _sf(request)
    async with session_scope(sf) as s:
        # Ни звёзд, ни коммента → снять запись целиком.
        if body.stars <= 0 and not comment:
            await s.execute(delete(EventRating).where(
                EventRating.tg_id == user_id, EventRating.event_id == body.event_id))
            return await _summary(s, body.event_id, user_id)

        if not (0 <= body.stars <= 5):
            raise HTTPException(400, "stars must be 0..5")
        stars_val = body.stars  # 0 = коммент-заметка без оценки

        stmt = pg_insert(EventRating).values(
            tg_id=user_id, event_id=body.event_id, stars=stars_val,
            comment=comment, author_name=author, hidden=False,
        ).on_conflict_do_update(
            constraint="uq_rating_user_event",
            set_={"stars": stars_val, "comment": comment, "author_name": author, "hidden": False},
        )
        await s.execute(stmt)
        return await _summary(s, body.event_id, user_id)


@router.get("/events/{event_id}/ratings")
async def event_ratings(
    event_id: int,
    request: Request,
    user_id: Optional[int] = Depends(optional_current_user_id),
) -> dict:
    async with session_scope(_sf(request)) as s:
        return await _summary(s, event_id, user_id)
