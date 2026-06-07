"""Admin endpoints — moderation queue, taxonomy management, stats."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.auth import require_admin
from app.db import session_scope
from app.models import Channel, EventCurated, EventStatus, PostRaw
from app.repositories.posts import ModerationRepository

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
    async with session_scope(sf) as s:
        rows = await ModerationRepository(s).list_events(status=status_filter, limit=limit, offset=offset)
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
    return {
        "channels": {"total": total_channels, "enabled": enabled},
        "posts_raw": total_posts,
        "events_by_status": by_status,
        "events_by_category": by_cat,
    }
