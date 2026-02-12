"""HTTP client for the Telegram microservice."""

from __future__ import annotations

from datetime import datetime

import httpx

from app.schemas import EventIngestRequest


class TelegramServiceClient:
    def __init__(self, base_url: str, timeout: float = 60.0) -> None:
        self._base = base_url.rstrip("/")
        self._timeout = timeout

    async def get_channel_avatar_path(self, channel: str) -> str | None:
        """Returns path (e.g. /media/...) for redirect, or None if 404."""
        async with httpx.AsyncClient(follow_redirects=False, timeout=self._timeout) as client:
            r = await client.get(f"{self._base}/channel-avatar", params={"channel": channel})
            if r.status_code == 302 and "location" in r.headers:
                loc = r.headers["location"]
                if loc.startswith("http"):
                    from urllib.parse import urlparse
                    return urlparse(loc).path or loc
                return loc if loc.startswith("/") else f"/{loc}"
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return None

    async def channels_info(self, channels: list[str]) -> list[dict[str, str | None]]:
        """POST /channels-info. Returns [{ name, subs, avatar }, ...]."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.post(f"{self._base}/channels-info", json={"channels": channels})
            r.raise_for_status()
            return r.json()

    async def ingest(
        self,
        channel_ids: list[str],
        per_channel_limit: int = 5,
        pause_between_channels: float = 1.0,
        pause_between_messages: float = 0.0,
        collect_media: bool = True,
        event_keywords: list[str] | None = None,
    ) -> dict:
        """POST /ingest. Returns { channels_ok, channels_failed, events }."""
        payload: dict = {
            "channel_ids": channel_ids,
            "per_channel_limit": per_channel_limit,
            "pause_between_channels": pause_between_channels,
            "pause_between_messages": pause_between_messages,
            "collect_media": collect_media,
        }
        if event_keywords is not None:
            payload["event_keywords"] = event_keywords
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.post(f"{self._base}/ingest", json=payload)
            r.raise_for_status()
            return r.json()

    async def fetch_event_posts(
        self,
        channel_ids: list[str],
        per_channel_limit: int = 20,
        pause_between_channels: float = 1.0,
        event_keywords: list[str] | None = None,
        collect_media: bool = False,
    ) -> dict:
        """POST /event-posts. Returns { channels_ok, channels_failed, events } (event-like posts only)."""
        payload: dict = {
            "channel_ids": channel_ids,
            "per_channel_limit": per_channel_limit,
            "pause_between_channels": pause_between_channels,
            "collect_media": collect_media,
        }
        if event_keywords is not None:
            payload["event_keywords"] = event_keywords
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.post(f"{self._base}/event-posts", json=payload)
            r.raise_for_status()
            return r.json()

    async def fetch_channel(
        self,
        source_channel: str,
        limit: int = 100,
        return_posts: bool = True,
        extract_channel_links: bool = True,
        collect_media: bool = False,
    ) -> dict:
        """POST /fetch-channel. Returns { channels, posts }."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            r = await client.post(
                f"{self._base}/fetch-channel",
                json={
                    "source_channel": source_channel,
                    "limit": limit,
                    "return_posts": return_posts,
                    "extract_channel_links": extract_channel_links,
                    "collect_media": collect_media,
                },
            )
            r.raise_for_status()
            return r.json()


def event_payload_to_ingest_request(payload: dict) -> EventIngestRequest:
    """Map telegram service event dict to EventIngestRequest."""
    published_at = payload.get("published_at")
    if isinstance(published_at, str):
        try:
            published_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except ValueError:
            published_at = None
    return EventIngestRequest(
        channel=payload["channel"],
        message_id=payload["message_id"],
        text=payload.get("text", ""),
        media_urls=payload.get("media_urls") or [],
        published_at=published_at,
    )
