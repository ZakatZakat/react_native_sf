from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.sessions import StringSession
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.types import Message, MessageEntityTextUrl, MessageEntityMention

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

    async def _ingest_message(
        self, client: TelegramClient, channel: str, message: Message, *, collect_media: bool = True
    ) -> int:
        if not message.message and not message.media:
            return 0
        media_urls = await self._collect_media(client, message) if collect_media else []
        published_at = (
            message.date.replace(tzinfo=None) if getattr(message.date, "tzinfo", None) else message.date
        )
        text = message.message or ""
        payload = EventIngestRequest(
            channel=channel,
            message_id=message.id,
            text=text,
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

    async def fetch_channel_avatar(self, channel_username: str) -> str | None:
        """Resolve channel by username, download profile photo to media_root; return /media/... or None."""
        raw = (channel_username or "").strip().lstrip("@")
        sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", raw)[:64] or "unknown"
        if not sanitized or sanitized == "unknown":
            return None
        self.media_root.mkdir(parents=True, exist_ok=True)
        cache_name = f"channel_avatar_{sanitized}.jpg"
        cache_path = self.media_root / cache_name
        if cache_path.exists():
            return f"/media/{cache_name}"
        client = self.create_client()
        if self.settings.telegram_login_mode == "bot":
            if not self.settings.telegram_bot_token:
                return None
            await client.start(bot_token=self.settings.telegram_bot_token)
        else:
            if not self.settings.telegram_session_string:
                return None
            await client.start()
        try:
            async with client:
                entity = await client.get_entity(raw)
                path = await client.download_profile_photo(entity, file=str(cache_path))
                if path and Path(path).exists():
                    return f"/media/{Path(path).name}"
                return None
        except Exception as e:  # noqa: BLE001
            logger.debug("Channel avatar fetch failed for %s: %s", channel_username, e)
            if cache_path.exists():
                cache_path.unlink()
            return None

    @staticmethod
    def _format_subs(count: int | None) -> str:
        if count is None or count < 0:
            return "—"
        if count < 1000:
            return str(count)
        if count < 1_000_000:
            return f"{count / 1000:.1f}K".replace(".0K", "K")
        return f"{count / 1_000_000:.1f}M".replace(".0M", "M")

    async def fetch_channels_info(self, usernames: list[str]) -> list[dict[str, str | None]]:
        """Fetch avatar (cached to media) and subs for each channel. Returns list of { name, subs, avatar }."""
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
        result: list[dict[str, str | None]] = []
        async with client:
            for raw_username in usernames:
                name = (raw_username.strip().lstrip("@") or "").lower()
                if not name:
                    result.append({"name": f"@{raw_username}", "subs": "—", "avatar": None})
                    continue
                display_name = f"@{name}"
                avatar_path: str | None = None
                subs_count: int | None = None
                try:
                    entity = await client.get_entity(name)
                    sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", name)[:64]
                    cache_name = f"channel_avatar_{sanitized}.jpg"
                    cache_path = self.media_root / cache_name
                    path = await client.download_profile_photo(entity, file=str(cache_path))
                    if path and Path(path).exists():
                        avatar_path = f"/media/{cache_name}"
                    full = await client(GetFullChannelRequest(await client.get_input_entity(entity)))
                    subs_count = getattr(full.full_chat, "participants_count", None)
                except Exception as e:  # noqa: BLE001
                    logger.debug("Channel info failed for %s: %s", display_name, e)
                result.append({
                    "name": display_name,
                    "subs": self._format_subs(subs_count),
                    "avatar": avatar_path,
                })
                await asyncio.sleep(0.3)
        return result

    _LINK_T_ME = re.compile(r"https?://(?:www\.)?t\.me/([a-zA-Z0-9_]{5,32})(?:/|$|\?)", re.IGNORECASE)
    _LINK_TME_BARE = re.compile(r"t\.me/([a-zA-Z0-9_]{5,32})(?:/|$|\s)", re.IGNORECASE)
    _MENTION = re.compile(r"@([a-zA-Z0-9_]{5,32})\b")

    def _extract_channel_links_from_message(self, message: Message) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        text = message.message or ""
        for m in self._LINK_T_ME.finditer(text):
            u = m.group(1).lower()
            if u not in seen and u != "joinchat":
                seen.add(u)
                out.append(f"@{u}")
        for m in self._LINK_TME_BARE.finditer(text + " "):
            u = m.group(1).lower()
            if u not in seen and u != "joinchat":
                seen.add(u)
                out.append(f"@{u}")
        for m in self._MENTION.finditer(text):
            u = m.group(1).lower()
            if u not in seen:
                seen.add(u)
                out.append(f"@{u}")
        if message.entities:
            for ent in message.entities:
                if isinstance(ent, MessageEntityTextUrl):
                    url = (getattr(ent, "url", None) or "").strip()
                    if "t.me/" in url and "joinchat" not in url.lower():
                        for m in re.compile(r"t\.me/([a-zA-Z0-9_]{5,32})(?:/|$|\?)", re.I).finditer(url):
                            u = m.group(1).lower()
                            if u not in seen:
                                seen.add(u)
                                out.append(f"@{u}")
                elif isinstance(ent, MessageEntityMention):
                    o, l = getattr(ent, "offset", 0), getattr(ent, "length", 0)
                    if l > 0 and o + l <= len(text):
                        mention = text[o : o + l].lstrip("@")
                        if 5 <= len(mention) <= 32 and mention.lower() not in seen:
                            seen.add(mention.lower())
                            out.append(f"@{mention.lower()}")
        return out

    async def fetch_from_channel(
        self,
        source_channel: str,
        limit: int = 100,
        ingest_to_db: bool = True,
    ) -> dict[str, object]:
        """Fetch messages from one channel, extract advertised TG channel links, optionally ingest posts to DB."""
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
        all_channels: set[str] = set()
        ingested = 0
        messages_meta: list[dict[str, object]] = []
        async with client:
            try:
                async for message in client.iter_messages(entity=source_channel, limit=limit):
                    if not isinstance(message, Message):
                        continue
                    links = self._extract_channel_links_from_message(message)
                    for link in links:
                        all_channels.add(link)
                    if ingest_to_db and message.message:
                        await self._ingest_message(client, source_channel, message, collect_media=False)
                        ingested += 1
                    messages_meta.append({
                        "id": message.id,
                        "date": str(message.date) if message.date else None,
                        "channels_found": links,
                        "has_text": bool(message.message),
                        "has_media": bool(message.media),
                    })
            except FloodWaitError as e:
                wait_for = max(0, int(getattr(e, "seconds", 0)))
                logger.warning("FloodWait %ss on %s", wait_for, source_channel)
                if wait_for > 0:
                    await asyncio.sleep(wait_for)
                raise
        return {
            "source_channel": source_channel,
            "messages_seen": len(messages_meta),
            "ingested": ingested,
            "channels": sorted(all_channels),
            "messages": messages_meta,
        }

