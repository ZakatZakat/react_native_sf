from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.config import Settings
from app.ingest.telegram import TelegramIngestor
from app.repositories.events import EventsRepository
from app.schemas import ClientErrorReport

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


@router.post("/telegram-fetch-recent")
async def telegram_fetch_recent(
    request: Request,
    per_channel_limit: int = Query(5, ge=1, le=50),
    pause_between_channels_seconds: float = Query(1.0, ge=0.0, le=10.0),
    pause_between_messages_seconds: float = Query(0.0, ge=0.0, le=2.0),
    login_mode: str | None = Query(default=None, description="Override: bot | user"),
) -> dict[str, object]:
    settings = Settings()
    if login_mode in {"bot", "user"}:
        settings.telegram_login_mode = login_mode
    repo = _get_events_repo(request)
    ingestor = TelegramIngestor(settings=settings, repo=repo)
    try:
        result = await ingestor.fetch_recent(
            per_channel_limit=per_channel_limit,
            pause_between_channels_seconds=pause_between_channels_seconds,
            pause_between_messages_seconds=pause_between_messages_seconds,
        )
    except Exception as e:
        logger.exception("telegram_fetch_recent failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {
        "status": "ok",
        "result": result,
    }


@router.delete("/telegram-events")
async def telegram_delete_events(request: Request) -> dict[str, int | str]:
    repo = _get_events_repo(request)
    deleted = await repo.delete_all()
    return {"status": "ok", "deleted": deleted}


REP_DES_ART_CHANNEL = "rep_des_art"
ECO_CHANNELS = [
    "beindvz", "constructor_brand", "dmsk_bag", "exclusive_art_upcycling",
    "hodveshey", "kip_n_flip", "melme", "mvpeople", "skrvshch", "swop_market_msk",
    "syyyyyyyr", "tutryadom", "yergaworkshop", "zelenyy_syr",
]


@router.get("/eco-channels")
async def eco_channels(request: Request) -> list[dict[str, str | None]]:
    """Return avatar paths and subs for eco card channels (warms avatar cache)."""
    repo = _get_events_repo(request)
    settings = Settings()
    ingestor = TelegramIngestor(settings=settings, repo=repo)
    return await ingestor.fetch_channels_info(ECO_CHANNELS)


@router.post("/fetch-rep-des-art")
async def fetch_rep_des_art(
    request: Request,
    limit: int = Query(100, ge=1, le=500),
    ingest: bool = Query(True, description="Ingest posts into events DB"),
) -> dict[str, object]:
    """Fetch posts from @rep_des_art, extract advertised channel links, optionally ingest to DB."""
    repo = _get_events_repo(request)
    settings = Settings()
    ingestor = TelegramIngestor(settings=settings, repo=repo)
    result = await ingestor.fetch_from_channel(
        source_channel=REP_DES_ART_CHANNEL,
        limit=limit,
        ingest_to_db=ingest,
    )
    return {"status": "ok", "result": result}


@router.get("/channel-avatar")
async def channel_avatar(
    request: Request,
    channel: str = Query(..., min_length=1, description="Channel username with or without @"),
) -> RedirectResponse:
    """Redirect to cached channel profile image in /media/ or 404 if not available."""
    settings = Settings()
    repo = _get_events_repo(request)
    ingestor = TelegramIngestor(settings=settings, repo=repo)
    url_path = await ingestor.fetch_channel_avatar(channel)
    if not url_path:
        logger.debug("Channel avatar not available: channel=%s", channel)
        raise HTTPException(status_code=404, detail="Channel avatar not available")
    return RedirectResponse(url=url_path, status_code=302)



