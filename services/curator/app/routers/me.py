"""User-side API: /me/interests, /me/feed, /me/feedback. Auth via TG init_data."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.auth import current_user_id, optional_current_user_id
from app.db import session_scope
from app.models import FeedbackAction
from app.repositories.me import (
    PersonalizedFeedRepository,
    UserFeedbackRepository,
    UserInterestsRepository,
)
from app.repositories.week import WeekPickRepository

router = APIRouter(prefix="/me", tags=["me"])


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


# ── Interests ──────────────────────────────────────────────────────
class InterestsBody(BaseModel):
    tag_keys: list[str]


@router.get("/interests")
async def get_interests(
    user_id: int = Depends(current_user_id),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[str]:
    async with session_scope(sf) as s:
        return await UserInterestsRepository(s).list_keys(user_id)


@router.put("/interests")
async def put_interests(
    body: InterestsBody,
    user_id: int = Depends(current_user_id),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[str]:
    async with session_scope(sf) as s:
        return await UserInterestsRepository(s).replace(user_id, body.tag_keys)


# ── Feed ───────────────────────────────────────────────────────────
@router.get("/feed")
async def get_feed(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tags: Optional[str] = Query(None, description="Comma-separated tag keys to filter"),
    user_id: Optional[int] = Depends(optional_current_user_id),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    """Personalized feed.

    - Without auth: anonymous, returns approved events possibly filtered by ?tags=
    - With auth: also excludes events user previously hid; if no ?tags but user has
      interests in DB, those are used as default filter.
    """
    explicit_tags = [t.strip() for t in (tags or "").split(",") if t.strip()] or None
    async with session_scope(sf) as s:
        if explicit_tags is None and user_id is not None:
            # Auto-filter by user's saved interests
            user_tags = await UserInterestsRepository(s).list_keys(user_id)
            if user_tags:
                explicit_tags = user_tags
        return await PersonalizedFeedRepository(s).list_feed(
            user_id=user_id, limit=limit, offset=offset, tag_keys=explicit_tags,
        )


# ── Week digest hero — editorial «выбор недели» ────────────────────
@router.get("/week")
async def get_week_pick(
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict | None:
    """The manually chosen hero event for the Week screen, or null when the
    editor hasn't picked one (the app then falls back to its auto top event)."""
    async with session_scope(sf) as s:
        return await WeekPickRepository(s).current_pick()


# ── Feedback ───────────────────────────────────────────────────────
class FeedbackBody(BaseModel):
    action: str  # like|hide|save|dismiss


@router.post("/feedback/{event_id}")
async def post_feedback(
    event_id: int,
    body: FeedbackBody,
    user_id: int = Depends(current_user_id),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    try:
        action = FeedbackAction(body.action)
    except ValueError:
        raise HTTPException(400, f"unknown action: {body.action}")
    async with session_scope(sf) as s:
        await UserFeedbackRepository(s).add(user_id, event_id, action)
    return {"status": "ok", "event_id": event_id, "action": action.value}
