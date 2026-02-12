"""Telethon client wrapper: avatars, channel info, ingest, fetch from channel. No DB dependency."""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.sessions import StringSession
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.types import Message, MessageEntityTextUrl, MessageEntityMention

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class TelegramService:
    settings: Settings

    @property
    def media_root(self) -> Path:
        root = self.settings.media_root
        if isinstance(root, str):
            return Path(root)
        return root

    def _create_client(self) -> TelegramClient:
        session: StringSession | str = "tg_session"
        if self.settings.telegram_login_mode != "bot" and self.settings.telegram_session_string:
            session = StringSession(self.settings.telegram_session_string)
        return TelegramClient(
            session=session,
            api_id=self.settings.telegram_api_id,
            api_hash=self.settings.telegram_api_hash,
        )

    async def _start_client(self, client: TelegramClient) -> None:
        if self.settings.telegram_login_mode == "bot":
            if not self.settings.telegram_bot_token:
                raise ValueError("TELEGRAM_BOT_TOKEN required in bot mode")
            await client.start(bot_token=self.settings.telegram_bot_token)
        else:
            if not self.settings.telegram_session_string:
                raise ValueError("TELEGRAM_SESSION_STRING required in user mode")
            await client.start()

    async def fetch_channel_avatar(self, channel_username: str) -> str | None:
        raw = (channel_username or "").strip().lstrip("@")
        sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", raw)[:64] or "unknown"
        if not sanitized or sanitized == "unknown":
            return None
        self.media_root.mkdir(parents=True, exist_ok=True)
        cache_name = f"channel_avatar_{sanitized}.jpg"
        cache_path = self.media_root / cache_name
        if cache_path.exists():
            return f"/media/{cache_name}"
        client = self._create_client()
        await self._start_client(client)
        try:
            async with client:
                entity = await client.get_entity(raw)
                path = await client.download_profile_photo(entity, file=str(cache_path))
                if path and Path(path).exists():
                    return f"/media/{Path(path).name}"
                return None
        except Exception as e:
            logger.debug("Channel avatar failed %s: %s", channel_username, e)
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
        self.media_root.mkdir(parents=True, exist_ok=True)
        client = self._create_client()
        await self._start_client(client)
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
                except Exception as e:
                    logger.debug("Channel info failed %s: %s", display_name, e)
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

    def _extract_channel_links(self, message: Message) -> list[str]:
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

    async def _collect_media(self, client: TelegramClient, message: Message) -> list[str]:
        if not message.media:
            return []
        urls: list[str] = []
        suffix = ".jpg"
        try:
            fname = getattr(message.file, "name", None) if hasattr(message, "file") else None
            if fname:
                suffix = Path(fname).suffix
        except Exception:
            pass
        filename = f"{message.peer_id.channel_id if getattr(message.peer_id, 'channel_id', None) else 'ch'}_{message.id}{suffix}"
        dest = self.media_root / filename
        path = await client.download_media(message, file=str(dest))
        if path:
            urls.append(f"/media/{Path(path).name}")
        return urls

    def _message_to_payload(self, channel: str, message: Message, media_urls: list[str]) -> dict[str, Any]:
        published_at = (
            message.date.replace(tzinfo=None) if getattr(message.date, "tzinfo", None) else message.date
        )
        return {
            "channel": channel,
            "message_id": message.id,
            "text": message.message or "",
            "media_urls": media_urls,
            "published_at": published_at.isoformat() if published_at else None,
        }

    async def ingest(
        self,
        channel_ids: list[str],
        per_channel_limit: int = 5,
        pause_between_channels: float = 1.0,
        pause_between_messages: float = 0.0,
        collect_media: bool = True,
        event_keywords: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fetch recent messages from channels; return list of event payloads (no DB). Optionally filter by event_keywords."""
        self.media_root.mkdir(parents=True, exist_ok=True)
        client = self._create_client()
        await self._start_client(client)
        events: list[dict[str, Any]] = []
        ok: list[str] = []
        failed: dict[str, str] = {}
        async with client:
            for channel in channel_ids:
                try:
                    async for message in client.iter_messages(entity=channel, limit=per_channel_limit):
                        if not isinstance(message, Message):
                            continue
                        if not message.message and not message.media:
                            continue
                        media_urls = await self._collect_media(client, message) if collect_media else []
                        events.append(self._message_to_payload(channel, message, media_urls))
                        if pause_between_messages > 0:
                            await asyncio.sleep(pause_between_messages)
                    ok.append(channel)
                except FloodWaitError as e:
                    wait = max(0, int(getattr(e, "seconds", 0)))
                    logger.warning("FloodWait %ss on %s", wait, channel)
                    failed[channel] = f"FloodWait({wait}s)"
                except Exception as e:
                    logger.exception("Ingest failed channel=%s", channel)
                    failed[channel] = str(e)[:500]
                if pause_between_channels > 0:
                    await asyncio.sleep(pause_between_channels)
        if event_keywords:
            events = [e for e in events if any(kw.lower() in (e.get("text") or "").lower() for kw in event_keywords)]
        return {
            "channels_ok": ok,
            "channels_failed": failed,
            "events": events,
        }

    async def fetch_from_channel(
        self,
        source_channel: str,
        limit: int = 100,
        return_posts: bool = True,
        extract_channel_links: bool = True,
        collect_media: bool = False,
    ) -> dict[str, Any]:
        """Fetch messages from one channel; return channels list and/or post payloads."""
        self.media_root.mkdir(parents=True, exist_ok=True)
        client = self._create_client()
        await self._start_client(client)
        all_channels: set[str] = set()
        posts: list[dict[str, Any]] = []
        async with client:
            try:
                async for message in client.iter_messages(entity=source_channel, limit=limit):
                    if not isinstance(message, Message):
                        continue
                    if extract_channel_links:
                        for link in self._extract_channel_links(message):
                            all_channels.add(link)
                    if return_posts and message.message:
                        media_urls = await self._collect_media(client, message) if collect_media else []
                        posts.append(self._message_to_payload(source_channel, message, media_urls))
            except FloodWaitError as e:
                wait = max(0, int(getattr(e, "seconds", 0)))
                logger.warning("FloodWait %ss on %s", wait, source_channel)
                raise
        return {
            "source_channel": source_channel,
            "channels": sorted(all_channels) if extract_channel_links else [],
            "posts": posts,
        }
