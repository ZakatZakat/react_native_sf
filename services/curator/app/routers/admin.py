"""Admin endpoints — moderation queue, taxonomy management, stats."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.auth import require_admin
from app.db import session_scope
from app.models import Channel, EventCurated, EventStatus, FeedbackNote, PostRaw
from app.repositories.landing import LandingPickRepository
from app.repositories.ui_variants import UiVariantRepository
from app.repositories.posts import ModerationRepository
from app.repositories.week import WeekPickRepository

router = APIRouter(prefix="/admin", tags=["admin"])


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


# ── Moderation queue ───────────────────────────────────────────────
@router.get("/moderation")
async def list_pending(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    async with session_scope(sf) as s:
        rows = await ModerationRepository(s).list_pending(limit=limit, offset=offset)
        out: list[dict] = []
        for ev, post, channel in rows:
            out.append({
                "event_id": ev.id,
                "channel": channel.handle,
                "message_id": post.message_id,
                "text": post.text,
                "media_urls": post.media_urls or [],
                "event_time": ev.event_time.isoformat() if ev.event_time else None,
                "location": ev.location_text,
                "price": ev.price_text,
                "filter_score": ev.filter_score,
                "filter_reasons": ev.filter_reasons,
                "created_at": ev.created_at.isoformat(),
            })
        return out


# ── Browse curated events by status (admin posts panel) ────────────
@router.get("/events")
async def list_events(
    status: str = Query("all"),
    when: str = Query("all"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    status_filter: EventStatus | None = None
    if status and status != "all":
        try:
            status_filter = EventStatus(status)
        except ValueError:
            raise HTTPException(400, f"unknown status '{status}'")
    if when not in ("all", "upcoming", "past"):
        raise HTTPException(400, f"unknown when '{when}'")
    async with session_scope(sf) as s:
        rows = await ModerationRepository(s).list_events(status=status_filter, when=when, limit=limit, offset=offset)
        # Tag labels for these events, in one query.
        from app.models import Tag, EventTag
        ids = [ev.id for ev, _, _ in rows]
        tags_by_event: dict[int, list[str]] = {}
        if ids:
            tag_rows = (await s.execute(
                select(EventTag.event_id, Tag.label)
                .join(Tag, Tag.id == EventTag.tag_id)
                .where(EventTag.event_id.in_(ids))
            )).all()
            for eid, label in tag_rows:
                tags_by_event.setdefault(eid, []).append(label)
        out: list[dict] = []
        for ev, post, channel in rows:
            out.append({
                "event_id": ev.id,
                "status": ev.status.value,
                "channel": channel.handle,
                "message_id": post.message_id,
                "text": post.text,
                "media_urls": post.media_urls or [],
                "tags": tags_by_event.get(ev.id, []),
                "event_time": ev.event_time.isoformat() if ev.event_time else None,
                "location": ev.location_text,
                "price": ev.price_text,
                "filter_score": ev.filter_score,
                "created_at": ev.created_at.isoformat(),
            })
        return out



class RejectBody(BaseModel):
    reason: Optional[str] = None


@router.post("/moderation/{event_id}/approve")
async def approve_event(
    event_id: int,
    admin_id: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    async with session_scope(sf) as s:
        try:
            await ModerationRepository(s).approve(event_id, reviewed_by=admin_id)
        except ValueError as e:
            raise HTTPException(404, str(e))
    # Trigger push fanout outside of the transaction
    from app.services.push import get_push_service
    import asyncio
    if (svc := get_push_service()) is not None:
        asyncio.create_task(svc.fanout_for_event(event_id))
    return {"status": "approved", "event_id": event_id}


@router.post("/moderation/{event_id}/reject")
async def reject_event(
    event_id: int,
    body: RejectBody,
    admin_id: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    async with session_scope(sf) as s:
        try:
            await ModerationRepository(s).reject(event_id, reviewed_by=admin_id, reason=body.reason)
        except ValueError as e:
            raise HTTPException(404, str(e))
    return {"status": "rejected", "event_id": event_id, "reason": body.reason}


# ── Пожелания / фидбэк пользователей ───────────────────────────────
@router.get("/feedback-notes")
async def feedback_notes(
    user_id: int | None = Query(None, description="filter to one Telegram id"),
    limit: int = Query(100, ge=1, le=500),
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    """Newest-first free-text feedback. Pass ?user_id= to see one user's notes."""
    async with session_scope(sf) as s:
        q = select(FeedbackNote).order_by(FeedbackNote.created_at.desc()).limit(limit)
        if user_id is not None:
            q = q.where(FeedbackNote.user_id == user_id)
        rows = (await s.execute(q)).scalars().all()
        return [
            {
                "id": r.id,
                "user_id": r.user_id,
                "user_name": r.user_name,
                "text": r.text,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]


# ── Stats ──────────────────────────────────────────────────────────
@router.get("/stats")
async def stats(
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    async with session_scope(sf) as s:
        total_channels = (await s.execute(select(func.count()).select_from(Channel))).scalar_one()
        enabled = (await s.execute(select(func.count()).select_from(Channel).where(Channel.poll_enabled.is_(True)))).scalar_one()
        total_posts = (await s.execute(select(func.count()).select_from(PostRaw))).scalar_one()
        by_status = dict((await s.execute(
            select(EventCurated.status, func.count()).group_by(EventCurated.status)
        )).all())
        by_status = {k.value: v for k, v in by_status.items()}
        # Category breakdown — approved events per tag label, desc.
        from app.models import Tag, EventTag
        by_cat_rows = (await s.execute(
            select(Tag.label, func.count())
            .select_from(EventTag)
            .join(Tag, Tag.id == EventTag.tag_id)
            .join(EventCurated, EventCurated.id == EventTag.event_id)
            .where(EventCurated.status == EventStatus.approved)
            .group_by(Tag.label)
            .order_by(func.count().desc())
        )).all()
        by_cat = [{"label": label, "n": n} for label, n in by_cat_rows]

        # Temporal split — approved events by event_time vs now.
        from datetime import datetime
        from sqlalchemy import or_
        now = datetime.utcnow()
        appr = EventCurated.status == EventStatus.approved
        upcoming = (await s.execute(
            select(func.count()).select_from(EventCurated).where(appr, EventCurated.event_time >= now)
        )).scalar_one()
        past = (await s.execute(
            select(func.count()).select_from(EventCurated).where(appr, EventCurated.event_time < now)
        )).scalar_one()
        undated = (await s.execute(
            select(func.count()).select_from(EventCurated).where(appr, EventCurated.event_time.is_(None))
        )).scalar_one()
        # Still actionable in review — manual/pending events that haven't passed.
        review_upcoming = (await s.execute(
            select(func.count()).select_from(EventCurated).where(
                EventCurated.status.in_([EventStatus.manual_review, EventStatus.pending]),
                or_(EventCurated.event_time.is_(None), EventCurated.event_time >= now),
            )
        )).scalar_one()
        # Location coverage — approved events that carry a non-empty
        # location hint. NOTE: this is a text hint only; the pipeline does
        # not geocode to lat/lng yet, so "confident map placement" is a
        # separate (not-yet-built) step. `geocoded` stays 0 until then.
        appr_total = (await s.execute(select(func.count()).select_from(EventCurated).where(appr))).scalar_one()
        with_location = (await s.execute(
            select(func.count()).select_from(EventCurated).where(
                appr, EventCurated.location_text.isnot(None), func.length(func.trim(EventCurated.location_text)) > 0
            )
        )).scalar_one()
        geocoded = (await s.execute(
            select(func.count()).select_from(EventCurated).where(
                appr, EventCurated.location_meta.isnot(None), EventCurated.location_meta["lat"].isnot(None)
            )
        )).scalar_one()
    return {
        "channels": {"total": total_channels, "enabled": enabled},
        "posts_raw": total_posts,
        "events_by_status": by_status,
        "events_by_category": by_cat,
        "events_time": {"upcoming": upcoming, "past": past, "undated": undated, "review_upcoming": review_upcoming},
        "geo": {"approved_total": appr_total, "with_location": with_location, "geocoded": geocoded},
    }


# ── «Выбор недели» — editorial hero pick for the Week digest ────────
class WeekPickBody(BaseModel):
    event_id: int


@router.get("/week/candidates")
async def week_candidates(
    limit: int = Query(40, ge=1, le=120),
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    """Shortlist of upcoming events (with a poster) ranked by filter_score."""
    async with session_scope(sf) as s:
        return await WeekPickRepository(s).list_candidates(limit)


@router.get("/week/current")
async def week_current(
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict | None:
    async with session_scope(sf) as s:
        return await WeekPickRepository(s).current_pick()


@router.post("/week/pick")
async def week_pick(
    body: WeekPickBody,
    admin_id: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict | None:
    async with session_scope(sf) as s:
        pick = await WeekPickRepository(s).set_pick(body.event_id, admin_id)
    if pick is None:
        raise HTTPException(404, "event not found / not eligible for week pick")
    return pick


@router.delete("/week/pick")
async def week_unpick(
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    async with session_scope(sf) as s:
        await WeekPickRepository(s).clear_pick()
    return {"status": "ok"}


# ── Landing posters — up to 4 manually chosen event posters ────────
class LandingPickBody(BaseModel):
    slot: int
    event_id: int


@router.get("/landing/candidates")
async def landing_candidates(
    limit: int = Query(40, ge=1, le=120),
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    """Same shortlist as the week picker — upcoming events that HAVE a poster."""
    async with session_scope(sf) as s:
        return await LandingPickRepository(s).list_candidates(limit)


@router.get("/landing/current")
async def landing_current(
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    async with session_scope(sf) as s:
        return await LandingPickRepository(s).current_picks()


@router.post("/landing/pick")
async def landing_pick(
    body: LandingPickBody,
    admin_id: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    async with session_scope(sf) as s:
        return await LandingPickRepository(s).set_pick(body.slot, body.event_id, admin_id)


@router.delete("/landing/pick")
async def landing_unpick(
    slot: int | None = Query(None, ge=0, le=3),
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    """Clear one slot (?slot=N) or all slots (no param)."""
    async with session_scope(sf) as s:
        await LandingPickRepository(s).clear_pick(slot)
    return {"status": "ok"}


class UiVariantBody(BaseModel):
    key: str
    variant: str


@router.get("/ui")
async def ui_variants(
    _admin: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    async with session_scope(sf) as s:
        return await UiVariantRepository(s).all()


@router.post("/ui")
async def ui_variant_set(
    body: UiVariantBody,
    admin_id: int = Depends(require_admin),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    """Pin one component to a variant. variant="auto" restores its default.
    The variant id is NOT validated here on purpose — the set of layouts lives in
    the frontend, and a stale/unknown id degrades to the component's default."""
    async with session_scope(sf) as s:
        return await UiVariantRepository(s).set(body.key.strip(), body.variant.strip(), admin_id)
