"""HTTP client for the dumb services/telegram fetcher."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class RawMessage:
    channel: str
    message_id: int
    text: str
    media_urls: list[str]
    published_at: datetime | None


class TelegramServiceClient:
    def __init__(
        self,
        base_url: str,
        timeout: float = 600.0,
        token: str | None = None,
        media_dir: str | None = None,
    ) -> None:
        self._base = base_url.rstrip("/")
        self._timeout = timeout
        # Bearer token for when the poller runs on a separate, internet-exposed
        # box (TELEGRAM_SERVICE_TOKEN). None → no header (local docker network).
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}
        # Local dir where we mirror media right after fetching, so the poller
        # never has to retain it. None → don't pull (legacy in-network setup
        # where the telegram service serves /media itself).
        self._media_dir = Path(media_dir) if media_dir else None
        if self._media_dir:
            self._media_dir.mkdir(parents=True, exist_ok=True)

    async def _pull_media(self, client: httpx.AsyncClient, media_urls: list[str]) -> None:
        """Download each media file from the poller into the local media dir.
        Best-effort: a failed file is skipped, never breaks ingest."""
        if not self._media_dir:
            return
        for rel in media_urls:
            if not rel.startswith("/media/"):
                continue
            name = os.path.basename(rel)
            dest = self._media_dir / name
            if dest.exists():
                continue
            try:
                r = await client.get(f"{self._base}{rel}", timeout=60)
                if r.status_code == 200 and r.content:
                    tmp = dest.with_suffix(dest.suffix + ".part")
                    tmp.write_bytes(r.content)
                    tmp.replace(dest)
            except Exception:
                logger.warning("media pull failed for %s", rel, exc_info=False)

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
            # Mirror media to the shared server immediately, so the poller can
            # drop it right after (keeps the poller secrets-only).
            if self._media_dir and collect_media:
                all_media = [u for ev in (data.get("events") or []) for u in (ev.get("media_urls") or [])]
                await self._pull_media(client, all_media)

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
