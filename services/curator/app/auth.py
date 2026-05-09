"""FastAPI auth dependencies based on Telegram WebApp init_data."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, Request

from app.config import Settings
from app.services.tg_auth import verify_init_data


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


async def current_user_id(
    request: Request,
    init_data: str | None = Header(default=None, alias="X-Tg-Init-Data"),
    init_data_q: str | None = Query(default=None, alias="initData"),
    as_user: int | None = Query(default=None, alias="as_user"),  # dev override
) -> int:
    settings: Settings = request.app.state.settings

    # Dev mode: ?as_user=12345
    if settings.auth_dev_mode and as_user is not None:
        return int(as_user)

    raw = init_data or init_data_q
    if not raw:
        raise HTTPException(401, "missing init_data")
    if not settings.telegram_bot_token:
        raise HTTPException(500, "TELEGRAM_BOT_TOKEN not configured on server")
    user = verify_init_data(raw, settings.telegram_bot_token)
    if not user:
        raise HTTPException(401, "invalid init_data")
    uid = user.get("id")
    if not uid:
        raise HTTPException(401, "init_data has no user.id")
    return int(uid)


async def require_admin(
    request: Request,
    user_id: int = Depends(current_user_id),
) -> int:
    settings: Settings = request.app.state.settings
    admins = settings.admin_user_ids
    if not admins:
        # If no admin list configured, allow ANY authenticated user (dev convenience)
        if settings.auth_dev_mode:
            return user_id
        raise HTTPException(403, "no admins configured")
    if user_id not in admins:
        raise HTTPException(403, "admin only")
    return user_id


async def optional_current_user_id(
    request: Request,
    init_data: str | None = Header(default=None, alias="X-Tg-Init-Data"),
    init_data_q: str | None = Query(default=None, alias="initData"),
    as_user: int | None = Query(default=None, alias="as_user"),
) -> Optional[int]:
    try:
        return await current_user_id(request, init_data=init_data, init_data_q=init_data_q, as_user=as_user)
    except HTTPException:
        return None
