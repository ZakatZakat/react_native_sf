"""FastAPI auth dependencies based on Telegram WebApp init_data."""

from __future__ import annotations

import hmac
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
    # init_data подписан токеном бота, который обслуживает мини-апп
    # (@citysignalllbot → CS_BOT_TOKEN); берём объединённый bot_token, а не
    # голый telegram_bot_token (на проде он пуст → был 500 на всех POST).
    if not settings.bot_token:
        raise HTTPException(500, "bot token not configured on server")
    user = verify_init_data(raw, settings.bot_token)
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


async def require_owner(
    request: Request,
    init_data: str | None = Header(default=None, alias="X-Tg-Init-Data"),
    init_data_q: str | None = Query(default=None, alias="initData"),
    key: str | None = Query(default=None, alias="k"),
    key_h: str | None = Header(default=None, alias="X-Insights-Key"),
) -> int:
    """Строгий гейт приватной аналитики — «только владелец».

    В отличие от require_admin здесь СОЗНАТЕЛЬНО нет ?as_user-обхода: в проде
    AUTH_DEV_MODE=true, и as_user (= id владельца) угадывается тривиально, поэтому
    для «секретной» страницы он не годится. Доступ дают ровно два пути:
      1) валидный Telegram initData, чей user.id ∈ ADMIN_USER_IDS (владелец) —
         работает внутри мини-аппа;
      2) секретный токен ?k=… (или X-Insights-Key), равный ANALYTICS_SECRET —
         для открытия из обычного браузера по закладке. Токен только на сервере.
    """
    settings: Settings = request.app.state.settings

    # 2) Секретный токен (константное сравнение). Пустой секрет не открывает.
    supplied = key or key_h
    secret = settings.insights_secret
    if secret and supplied and hmac.compare_digest(supplied, secret):
        return next(iter(settings.admin_user_ids), 0)

    # 1) Telegram-owner по подписанному initData (as_user не принимается).
    raw = init_data or init_data_q
    if not raw:
        raise HTTPException(401, "owner auth required")
    if not settings.bot_token:
        raise HTTPException(500, "bot token not configured on server")
    user = verify_init_data(raw, settings.bot_token)
    if not user or not user.get("id"):
        raise HTTPException(401, "invalid init_data")
    uid = int(user["id"])
    owners = settings.admin_user_ids
    if not owners or uid not in owners:
        raise HTTPException(403, "owner only")
    return uid


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
