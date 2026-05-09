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
    return {
        "channels": {"total": total_channels, "enabled": enabled},
        "posts_raw": total_posts,
        "events_by_status": by_status,
    }
