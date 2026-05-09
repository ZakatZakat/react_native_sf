"""Web Push subscription management for the user."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.auth import current_user_id
from app.db import session_scope
from app.repositories.push import PushSubscriptionsRepository
from app.services.push import get_push_service

router = APIRouter(prefix="/me/push", tags=["push"])


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    return request.app.state.session_factory


@router.get("/vapid")
def get_vapid_public(request: Request) -> dict:
    """Frontend needs this to subscribe in the browser."""
    return {"public_key": request.app.state.settings.vapid_public_key}


class SubscribeBody(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}


@router.post("/subscribe")
async def subscribe(
    body: SubscribeBody,
    user_id: int = Depends(current_user_id),
    user_agent: str | None = Header(default=None, alias="User-Agent"),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    p256 = body.keys.get("p256dh")
    auth = body.keys.get("auth")
    if not p256 or not auth:
        raise HTTPException(400, "missing keys.p256dh or keys.auth")
    async with session_scope(sf) as s:
        sub = await PushSubscriptionsRepository(s).upsert(
            user_id=user_id, endpoint=body.endpoint,
            p256dh=p256, auth=auth, user_agent=user_agent,
        )
        return {"id": sub.id, "endpoint": sub.endpoint}


@router.delete("/subscribe/{sub_id}")
async def unsubscribe(
    sub_id: int,
    user_id: int = Depends(current_user_id),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> dict:
    async with session_scope(sf) as s:
        ok = await PushSubscriptionsRepository(s).delete_by_id(sub_id, user_id)
        if not ok:
            raise HTTPException(404, "subscription not found")
    return {"status": "unsubscribed"}


@router.get("/list")
async def list_my_subscriptions(
    user_id: int = Depends(current_user_id),
    sf: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
) -> list[dict]:
    async with session_scope(sf) as s:
        rows = await PushSubscriptionsRepository(s).list_for_user(user_id)
        return [
            {
                "id": r.id,
                "endpoint": r.endpoint[:80] + "...",
                "user_agent": r.user_agent,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]


@router.post("/test")
async def send_test_push(user_id: int = Depends(current_user_id)) -> dict:
    """Send a test push to all my devices, ignoring throttle."""
    svc = get_push_service()
    if not svc:
        raise HTTPException(503, "push service not initialized")
    # Just send manually, bypass interest matching
    from app.services.push import PushSubscription
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from app.repositories.push import PushSubscriptionsRepository

    async with session_scope(svc.sf) as s:
        subs = await PushSubscriptionsRepository(s).list_for_user(user_id)
    sent = failed = 0
    payload = {"title": "Тестовое уведомление", "body": "Если ты это видишь — push работает 🎉", "url": "/"}
    for sub in subs:
        ok, _ = await svc.send_to_subscription(sub, payload, event_id=0)
        if ok:
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "subscriptions": len(subs)}
