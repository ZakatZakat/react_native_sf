from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import Settings
from app.telegram_client import TelegramService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = Settings()
media_root = settings.media_root
media_root.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Telegram Channel Service")
service = TelegramService(settings=settings)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/channel-avatar")
@app.head("/channel-avatar")
async def channel_avatar(
    channel: str = Query(..., min_length=1),
) -> RedirectResponse:
    """Redirect to /media/channel_avatar_xxx.jpg or 404."""
    url_path = await service.fetch_channel_avatar(channel)
    if not url_path:
        raise HTTPException(status_code=404, detail="Channel avatar not available")
    return RedirectResponse(url=url_path, status_code=302)


class ChannelsInfoRequest(BaseModel):
    channels: list[str]


@app.post("/channels-info")
async def channels_info(body: ChannelsInfoRequest) -> list[dict[str, str | None]]:
    """Return avatar path and subs for each channel."""
    return await service.fetch_channels_info(body.channels)


class IngestRequest(BaseModel):
    channel_ids: list[str]
    per_channel_limit: int = 5
    pause_between_channels: float = 1.0
    pause_between_messages: float = 0.0
    collect_media: bool = True
    event_keywords: list[str] | None = None


@app.post("/ingest")
async def ingest(body: IngestRequest) -> dict:
    """Fetch recent messages from channels; return event payloads (no DB write). Optionally filter by event_keywords."""
    return await service.ingest(
        channel_ids=body.channel_ids,
        per_channel_limit=body.per_channel_limit,
        pause_between_channels=body.pause_between_channels,
        pause_between_messages=body.pause_between_messages,
        collect_media=body.collect_media,
        event_keywords=body.event_keywords,
    )


DEFAULT_EVENT_KEYWORDS = [
    "ивент", "встреча", "март", "апр", "мая", "июн", "июл", "сент", "октяб", "нояб", "дек",
    "swap", "маркет", "фестиваль", "концерт", "мастер-класс", "дата", "воскресенье", "суббот",
    "вечеринк", "выставк", "ярмарк", "фэр", "pop-up", "popup", "вход", "бесплатно", "регистрация",
    "лекция", "воркшоп", "workshop", "fair", "market", "event",
]


class EventPostsRequest(BaseModel):
    channel_ids: list[str]
    per_channel_limit: int = 20
    pause_between_channels: float = 1.0
    collect_media: bool = False
    event_keywords: list[str] | None = None


@app.post("/event-posts")
async def event_posts(body: EventPostsRequest) -> dict:
    """Search/collect event-like posts: fetch from channels, filter by event keywords, return only those."""
    keywords = body.event_keywords if body.event_keywords is not None else DEFAULT_EVENT_KEYWORDS
    return await service.ingest(
        channel_ids=body.channel_ids,
        per_channel_limit=body.per_channel_limit,
        pause_between_channels=body.pause_between_channels,
        pause_between_messages=0.0,
        collect_media=body.collect_media,
        event_keywords=keywords,
    )


class FetchChannelRequest(BaseModel):
    source_channel: str
    limit: int = 100
    return_posts: bool = True
    extract_channel_links: bool = True
    collect_media: bool = False


@app.post("/fetch-channel")
async def fetch_channel(body: FetchChannelRequest) -> dict:
    """Fetch messages from one channel; return channels list and/or posts."""
    return await service.fetch_from_channel(
        source_channel=body.source_channel,
        limit=body.limit,
        return_posts=body.return_posts,
        extract_channel_links=body.extract_channel_links,
        collect_media=body.collect_media,
    )


app.mount("/media", StaticFiles(directory=str(media_root), html=False), name="media")
