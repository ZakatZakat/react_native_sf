from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.config import Settings
from app.repositories.events import EventsRepository
from app.schemas import ClientErrorReport
from app.telegram_client import TelegramServiceClient, event_payload_to_ingest_request

router = APIRouter(prefix="/debug", tags=["debug"])
logger = logging.getLogger(__name__)


@router.get("/telegram-creds")
def telegram_creds() -> dict[str, object]:
    settings = Settings()

    def mask_secret(value: str | None, keep: int = 4) -> str | None:
        if not value:
            return None
        if len(value) <= keep:
            return "*" * len(value)
        return f"{'*' * (len(value) - keep)}{value[-keep:]}"

    return {
        "login_mode": settings.telegram_login_mode,
        "channel_ids": settings.telegram_channel_ids or [],
        "api_id": settings.telegram_api_id,
        "api_hash_masked": mask_secret(settings.telegram_api_hash),
        "bot_token_masked": mask_secret(settings.telegram_bot_token),
    }


@router.post("/client-error")
def client_error(payload: ClientErrorReport) -> dict[str, str]:
    logger.error(
        "client_error tag=%s message=%s url=%s ua=%s stack=%s",
        payload.tag,
        payload.message,
        payload.url,
        payload.user_agent,
        (payload.stack or "")[:2000],
    )
    return {"status": "ok"}


def _get_events_repo(request: Request) -> EventsRepository:
    return request.app.state.events_repo  # type: ignore[attr-defined]


def _get_telegram_client(request: Request) -> TelegramServiceClient:
    return request.app.state.telegram_client  # type: ignore[attr-defined]


@router.post("/telegram-fetch-recent")
async def telegram_fetch_recent(
    request: Request,
    per_channel_limit: int = Query(5, ge=1, le=50),
    pause_between_channels_seconds: float = Query(1.0, ge=0.0, le=10.0),
    pause_between_messages_seconds: float = Query(0.0, ge=0.0, le=2.0),
) -> dict[str, object]:
    settings = Settings()
    channel_ids = settings.telegram_channel_ids or []
    if not channel_ids:
        raise HTTPException(status_code=400, detail="telegram_channel_ids not configured")
    repo = _get_events_repo(request)
    client = _get_telegram_client(request)
    try:
        data = await client.ingest(
            channel_ids=channel_ids,
            per_channel_limit=per_channel_limit,
            pause_between_channels=pause_between_channels_seconds,
            pause_between_messages=pause_between_messages_seconds,
        )
    except httpx.HTTPError as e:
        logger.exception("telegram-fetch-recent: microservice error")
        raise HTTPException(status_code=502, detail="Telegram service unavailable") from e
    events = data.get("events") or []
    for ev in events:
        await repo.upsert(event_payload_to_ingest_request(ev))
    return {
        "status": "ok",
        "channels_ok": data.get("channels_ok", 0),
        "channels_failed": data.get("channels_failed", 0),
        "events_ingested": len(events),
    }


@router.post("/telegram-fetch-event-posts")
async def telegram_fetch_event_posts(
    request: Request,
    per_channel_limit: int = Query(15, ge=1, le=50),
    pause_between_channels_seconds: float = Query(1.0, ge=0.0, le=10.0),
    event_only: bool = Query(True, description="If true, use microservice event-posts (keyword filter). If false, ingest all."),
) -> dict[str, object]:
    """Fetch posts from telegram (event search in microservice if event_only), upsert to DB; show in Ивенты block."""
    channel_ids = [f"@{c}" for c in ECO_CHANNELS]
    repo = _get_events_repo(request)
    client = _get_telegram_client(request)
    try:
        if event_only:
            data = await client.fetch_event_posts(
                channel_ids=channel_ids,
                per_channel_limit=per_channel_limit,
                pause_between_channels=pause_between_channels_seconds,
            )
        else:
            data = await client.ingest(
                channel_ids=channel_ids,
                per_channel_limit=per_channel_limit,
                pause_between_channels=pause_between_channels_seconds,
                pause_between_messages=0.0,
                collect_media=False,
                event_keywords=None,
            )
    except httpx.HTTPError as e:
        logger.exception("telegram-fetch-event-posts: microservice error")
        raise HTTPException(status_code=502, detail="Telegram service unavailable") from e
    events = data.get("events") or []
    for ev in events:
        await repo.upsert(event_payload_to_ingest_request(ev))
    return {
        "status": "ok",
        "channels_ok": len(data.get("channels_ok") or []),
        "channels_failed": len(data.get("channels_failed") or {}),
        "events_ingested": len(events),
    }


@router.delete("/telegram-events")
async def telegram_delete_events(request: Request) -> dict[str, int | str]:
    repo = _get_events_repo(request)
    deleted = await repo.delete_all()
    return {"status": "ok", "deleted": deleted}


DEFAULT_EVENT_KEYWORDS = [
    "ивент", "встреча", "март", "апр", "мая", "июн", "июл", "сент", "октяб", "нояб", "дек",
    "swap", "маркет", "фестиваль", "концерт", "мастер-класс", "дата", "воскресенье", "суббот",
    "вечеринк", "выставк", "ярмарк", "фэр", "pop-up", "popup", "вход", "бесплатно", "регистрация",
    "лекция", "воркшоп", "workshop", "fair", "market", "event",
]

REP_DES_ART_CHANNEL = "rep_des_art"
ECO_CHANNELS = [
    "beindvz", "constructor_brand", "dmsk_bag", "exclusive_art_upcycling",
    "hodveshey", "kip_n_flip", "melme", "mvpeople", "skrvshch", "swop_market_msk",
    "syyyyyyyr", "tutryadom", "yergaworkshop", "zelenyy_syr",
]


@router.get("/telegram-event-posts-preview")
async def telegram_event_posts_preview(
    request: Request,
    per_channel_limit: int = Query(5, ge=1, le=20),
    event_only: bool = Query(True, description="Use keyword filter (microservice /event-posts)."),
) -> dict[str, object]:
    """Call microservice event-posts (or ingest) without writing to DB. Check if fetch + filter works."""
    channel_ids = [f"@{c}" for c in ECO_CHANNELS]
    client = _get_telegram_client(request)
    try:
        if event_only:
            data = await client.fetch_event_posts(
                channel_ids=channel_ids,
                per_channel_limit=per_channel_limit,
                pause_between_channels=1.0,
            )
        else:
            data = await client.ingest(
                channel_ids=channel_ids,
                per_channel_limit=per_channel_limit,
                pause_between_channels=1.0,
                pause_between_messages=0.0,
                collect_media=False,
                event_keywords=None,
            )
    except httpx.HTTPError as e:
        logger.exception("telegram-event-posts-preview: microservice error")
        raise HTTPException(status_code=502, detail=f"Telegram service unavailable: {e!s}") from e
    events = data.get("events") or []
    sample = [
        {
            "channel": e.get("channel"),
            "title": (e.get("text") or "")[:80],
            "message_id": e.get("message_id"),
        }
        for e in events[:5]
    ]
    return {
        "status": "ok",
        "events_count": len(events),
        "channels_ok": data.get("channels_ok", []),
        "channels_failed": data.get("channels_failed", {}),
        "sample": sample,
    }


@router.get("/eco-channels")
async def eco_channels(request: Request) -> list[dict[str, str | None]]:
    """Return avatar URLs and subs for eco card channels (warms avatar cache)."""
    client = _get_telegram_client(request)
    settings = Settings()
    base = _media_base(settings)
    try:
        rows = await client.channels_info(ECO_CHANNELS)
    except httpx.HTTPError as e:
        logger.exception("eco-channels: microservice error")
        raise HTTPException(status_code=502, detail="Telegram service unavailable") from e
    out: list[dict[str, str | None]] = []
    for r in rows:
        avatar = r.get("avatar")
        if avatar and isinstance(avatar, str) and not avatar.startswith("http"):
            avatar = f"{base}{avatar}" if avatar.startswith("/") else f"{base}/{avatar}"
        out.append({"name": r.get("name"), "subs": r.get("subs"), "avatar": avatar})
    return out


@router.post("/fetch-rep-des-art")
async def fetch_rep_des_art(
    request: Request,
    limit: int = Query(100, ge=1, le=500),
    ingest: bool = Query(True, description="Ingest posts into events DB"),
) -> dict[str, object]:
    """Fetch posts from @rep_des_art, extract advertised channel links, optionally ingest to DB."""
    repo = _get_events_repo(request)
    client = _get_telegram_client(request)
    try:
        data = await client.fetch_channel(
            source_channel=REP_DES_ART_CHANNEL,
            limit=limit,
            return_posts=True,
            extract_channel_links=True,
        )
    except httpx.HTTPError as e:
        logger.exception("fetch-rep-des-art: microservice error")
        raise HTTPException(status_code=502, detail="Telegram service unavailable") from e
    posts = data.get("posts") or []
    ingested = 0
    if ingest:
        for p in posts:
            await repo.upsert(event_payload_to_ingest_request(p))
            ingested += 1
    return {
        "status": "ok",
        "channels": data.get("channels", []),
        "posts_count": len(posts),
        "ingested": ingested,
    }


def _media_base(settings: Settings) -> str:
    return (settings.telegram_media_public_url or settings.telegram_service_url).rstrip("/")


@router.get("/channel-avatar")
async def channel_avatar(
    request: Request,
    channel: str = Query(..., min_length=1, description="Channel username with or without @"),
) -> RedirectResponse:
    """Redirect to telegram service media URL for channel avatar or 404 if not available."""
    settings = Settings()
    client = _get_telegram_client(request)
    try:
        path = await client.get_channel_avatar_path(channel)
    except httpx.HTTPError as e:
        logger.exception("channel-avatar: microservice error")
        raise HTTPException(status_code=502, detail="Telegram service unavailable") from e
    if not path:
        raise HTTPException(status_code=404, detail="Channel avatar not available")
    return RedirectResponse(url=f"{_media_base(settings)}{path}", status_code=302)



