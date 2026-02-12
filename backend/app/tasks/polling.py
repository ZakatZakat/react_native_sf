from __future__ import annotations

import asyncio
import logging
from typing import Protocol

from app.repositories.events import EventsRepository
from app.telegram_client import TelegramServiceClient, event_payload_to_ingest_request

logger = logging.getLogger(__name__)


class TelegramFetchProtocol(Protocol):
    async def fetch_recent(
        self,
        per_channel_limit: int = 5,
        pause_between_channels_seconds: float = 1.0,
        pause_between_messages_seconds: float = 0.05,
    ) -> None: ...


class TelegramServiceFetcher:
    def __init__(
        self,
        client: TelegramServiceClient,
        repo: EventsRepository,
        channel_ids: list[str],
    ) -> None:
        self._client = client
        self._repo = repo
        self._channel_ids = channel_ids

    async def fetch_recent(
        self,
        per_channel_limit: int = 5,
        pause_between_channels_seconds: float = 1.0,
        pause_between_messages_seconds: float = 0.05,
    ) -> None:
        data = await self._client.ingest(
            channel_ids=self._channel_ids,
            per_channel_limit=per_channel_limit,
            pause_between_channels=pause_between_channels_seconds,
            pause_between_messages=pause_between_messages_seconds,
        )
        for ev in data.get("events") or []:
            await self._repo.upsert(event_payload_to_ingest_request(ev))


class TelegramPollingService:
    def __init__(self, fetcher: TelegramFetchProtocol, interval_seconds: int) -> None:
        self._fetcher = fetcher
        self._interval = interval_seconds
        self._stopped = asyncio.Event()

    async def run(self) -> None:
        while not self._stopped.is_set():
            try:
                await self._fetcher.fetch_recent(
                    per_channel_limit=5,
                    pause_between_channels_seconds=max(0.5, float(self._interval) / 10.0),
                    pause_between_messages_seconds=0.05,
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception("Polling iteration failed: %s", exc)
            try:
                await asyncio.wait_for(self._stopped.wait(), timeout=self._interval)
            except asyncio.TimeoutError:
                continue

    def stop(self) -> None:
        self._stopped.set()

