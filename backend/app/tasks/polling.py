from __future__ import annotations

import asyncio
import logging

from telethon.errors import AccessTokenInvalidError

from app.ingest.telegram import TelegramIngestor

logger = logging.getLogger(__name__)


class TelegramPollingService:
    def __init__(self, ingestor: TelegramIngestor, interval_seconds: int) -> None:
        self._ingestor = ingestor
        self._interval = interval_seconds
        self._stopped = asyncio.Event()

    async def run(self) -> None:
        while not self._stopped.is_set():
            try:
                await self._ingestor.fetch_recent(
                    per_channel_limit=5,
                    pause_between_channels_seconds=max(0.5, float(self._interval) / 10.0),
                    pause_between_messages_seconds=0.05,
                )
            except AccessTokenInvalidError:
                logger.error("Polling stopped: invalid bot token")
                break
            except ValueError as exc:
                logger.error("Polling stopped: %s", exc)
                break
            except Exception as exc:  # noqa: BLE001
                logger.exception("Polling iteration failed: %s", exc)
            try:
                await asyncio.wait_for(self._stopped.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue

    def stop(self) -> None:
        self._stopped.set()

