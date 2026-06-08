"""HTTP client for the dumb services/telegram fetcher."""

from __future__ import annotations

from datetime import datetime
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class RawMessage:
    channel: str
    message_id: int
    text: str
    media_urls: list[str]
    published_at: datetime | None


class TelegramServiceClient:
    def __init__(self, base_url: str, timeout: float = 600.0, token: str | None = None) -> None:
        self._base = base_url.rstrip("/")
        self._timeout = timeout
        # Bearer token for when the poller runs on a separate, internet-exposed
        # box (TELEGRAM_SERVICE_TOKEN). None → no header (local docker network).
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}

    async def fetch(self, handle: str, limit: int = 20, collect_media: bool = True) -> list[RawMessage]:
        """Pull last `limit` messages from a single channel via /ingest."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                f"{self._base}/ingest",
                headers=self._headers,
                json={
                    "channel_ids": [handle],
                    "per_channel_limit": limit,
                    "pause_between_channels": 0.5,
                    "pause_between_messages": 0.05,
                    "collect_media": collect_media,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        events: list[dict[str, Any]] = data.get("events", []) or []
        out: list[RawMessage] = []
        for ev in events:
            published_at = ev.get("published_at")
            dt: datetime | None = None
            if published_at:
                try:
                    dt = datetime.fromisoformat(published_at)
                    if dt.tzinfo is not None:
                        dt = dt.replace(tzinfo=None)
                except Exception:
                    dt = None
            out.append(
                RawMessage(
                    channel=ev.get("channel", handle),
                    message_id=int(ev.get("message_id") or 0),
                    text=ev.get("text", "") or "",
                    media_urls=list(ev.get("media_urls") or []),
                    published_at=dt,
                )
            )
        return out
