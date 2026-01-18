from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.sessions import StringSession
from telethon.tl.types import Message

from app.config import Settings
from app.repositories.events import EventsRepository
from app.schemas import EventIngestRequest

logger = logging.getLogger(__name__)


@dataclass
class TelegramIngestor:
    settings: Settings
    repo: EventsRepository
    media_root: Path = Path(__file__).resolve().parents[2] / "media"

    def create_client(self) -> TelegramClient:
        session: StringSession | str = "tg_session"
        if self.settings.telegram_login_mode != "bot" and self.settings.telegram_session_string:
            session = StringSession(self.settings.telegram_session_string)
        return TelegramClient(
            session=session,
            api_id=self.settings.telegram_api_id,
            api_hash=self.settings.telegram_api_hash,
        )

    async def fetch_recent(
        self,
        per_channel_limit: int = 5,
        pause_between_channels_seconds: float = 1.0,
        pause_between_messages_seconds: float = 0.0,
    ) -> dict[str, object]:
        self.media_root.mkdir(parents=True, exist_ok=True)
        client = self.create_client()
        if self.settings.telegram_login_mode == "bot":
            if not self.settings.telegram_bot_token:
                raise ValueError("TELEGRAM_BOT_TOKEN is required in bot login mode")
            await client.start(bot_token=self.settings.telegram_bot_token)
        else:
            if not self.settings.telegram_session_string:
                raise ValueError("TELEGRAM_SESSION_STRING is required in user login mode")
            await client.start()
        ingested: int = 0
        downloaded_media: int = 0
        ok_channels: list[str] = []
        failed_channels: dict[str, str] = {}
        async with client:
            for channel in self.settings.telegram_channel_ids:
                channel_ingested = 0
                try:
                    async for message in client.iter_messages(entity=channel, limit=per_channel_limit):
                        if not isinstance(message, Message):
                            continue
                        media_count = await self._ingest_message(client, channel, message)
                        ingested += 1
                        channel_ingested += 1
                        downloaded_media += media_count
                        if pause_between_messages_seconds > 0:
                            await asyncio.sleep(pause_between_messages_seconds)
                    ok_channels.append(channel)
                except FloodWaitError as e:
                    wait_for = max(0, int(getattr(e, "seconds", 0)))
                    logger.warning("FloodWait for %ss on %s", wait_for, channel)
                    if wait_for > 0:
                        await asyncio.sleep(wait_for)
                    failed_channels[channel] = f"FloodWait({wait_for}s)"
                except Exception as e:  # noqa: BLE001
                    logger.exception("Failed channel=%s after ingested=%s", channel, channel_ingested)
                    failed_channels[channel] = str(e)[:500]
                finally:
                    if pause_between_channels_seconds > 0:
                        await asyncio.sleep(pause_between_channels_seconds)

        return {
            "channels_total": len(self.settings.telegram_channel_ids),
            "channels_ok": ok_channels,
            "channels_failed": failed_channels,
            "ingested_messages": ingested,
            "downloaded_media": downloaded_media,
            "per_channel_limit": per_channel_limit,
        }

    async def _ingest_message(self, client: TelegramClient, channel: str, message: Message) -> int:
        if not message.message:
            return 0
        media_urls = await self._collect_media(client, message)
        published_at = (
            message.date.replace(tzinfo=None) if getattr(message.date, "tzinfo", None) else message.date
        )
        payload = EventIngestRequest(
            channel=channel,
            message_id=message.id,
            text=message.message,
            media_urls=media_urls,
            published_at=published_at,
        )
        card = await self.repo.upsert(payload)
        logger.info("Ingested %s %s", channel, card.id)
        return len(media_urls)

    async def _collect_media(self, client: TelegramClient, message: Message) -> list[str]:
        if not message.media:
            return []
        urls: list[str] = []
        suffix = ""
        try:
            fname = getattr(message.file, "name", None) if hasattr(message, "file") else None
            if fname:
                suffix = Path(fname).suffix
        except Exception:
            suffix = ""
        if not suffix:
            suffix = ".jpg"
        filename = f"{message.peer_id.channel_id if getattr(message.peer_id, 'channel_id', None) else 'ch'}_{message.id}{suffix}"
        dest = self.media_root / filename
        path = await client.download_media(message, file=str(dest))
        if path:
            urls.append(f"/media/{Path(path).name}")
        return urls

