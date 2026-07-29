"""Telethon client wrapper: avatars, channel info, ingest, fetch from channel. No DB dependency."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.sessions import SQLiteSession, StringSession
from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.types import Message, MessageEntityTextUrl, MessageEntityMention, PeerChannel

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class TelegramService:
    settings: Settings
    # Один долгоживущий клиент на весь процесс (см. _get_client). Раньше ingest
    # создавал новый клиент на КАЖДЫЙ запрос → Telethon заново резолвил каждый
    # канал через ResolveUsername → аккаунт ловил хронический FloodWait на весь
    # аккаунт (сотни в час). Переиспользуя один клиент, мы сохраняем его
    # in-memory entity-кэш (id+access_hash) между запросами: после первого
    # прогрева повторные обращения идут в getHistory без ResolveUsername.
    _client: TelegramClient | None = field(default=None, init=False, repr=False, compare=False)
    _client_lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False, repr=False, compare=False)
    # handle без «@» в нижнем регистре → time.monotonic(), до которого канал на
    # cooldown после FloodWait: не долбим залоченный канал каждый цикл.
    _flood_until: dict[str, float] = field(default_factory=dict, init=False, repr=False, compare=False)
    # Токен-бакет на ResolveUsername: времена последних резолвов (monotonic).
    # Не даём прогреву холодного кэша делать бёрст резолвов → нет нового флуда.
    _resolve_times: deque = field(default_factory=deque, init=False, repr=False, compare=False)
    _resolve_lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False, repr=False, compare=False)
    # time.monotonic(), до которого НЕ делаем НИ ОДНОГО резолва: FloodWait на
    # ResolveUsername — аккаунт-wide, поэтому per-channel cooldown его не лечит
    # (следующий холодный канал флудит сразу и продлевает общий лимит). Глобальный
    # кулдаун даёт лимиту сброситься, потом кэш прогревается по чуть-чуть.
    _resolve_blocked_until: float = field(default=0.0, init=False, repr=False, compare=False)

    @property
    def media_root(self) -> Path:
        root = self.settings.media_root
        if isinstance(root, str):
            return Path(root)
        return root

    def _build_client(self, session) -> TelegramClient:
        return TelegramClient(
            session=session,
            api_id=self.settings.telegram_api_id,
            api_hash=self.settings.telegram_api_hash,
        )

    def _string_session(self) -> StringSession | str:
        if self.settings.telegram_login_mode != "bot" and self.settings.telegram_session_string:
            return StringSession(self.settings.telegram_session_string)
        return "tg_session"

    def _create_client(self) -> TelegramClient:
        # Короткоживущие клиенты (аватары / refetch media) — всегда in-memory
        # StringSession: не конкурируют с долгоживущим клиентом за файл сессии
        # (SQLite database lock).
        return self._build_client(self._string_session())

    def _persistent_session(self) -> SQLiteSession | None:
        """SQLite-сессия на диске (volume) — её entity-кэш (username→id+access_hash)
        переживает рестарты контейнера, поэтому после рестарта НЕ нужно заново
        резолвить весь список каналов (→ аккаунт-wide FloodWait). Бутстрапим один
        раз из TELEGRAM_SESSION_STRING. Любая проблема → None (вызывающий
        откатится на StringSession — прежнее поведение, без даунтайма)."""
        path = (self.settings.session_path or "").strip()
        if not path or self.settings.telegram_login_mode == "bot" or not self.settings.telegram_session_string:
            return None
        try:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            fs = SQLiteSession(path)
            if fs.auth_key is None:
                ss = StringSession(self.settings.telegram_session_string)
                fs.set_dc(ss.dc_id, ss.server_address, ss.port)
                fs.auth_key = ss.auth_key
                fs.save()
                logger.info("bootstrapped persistent SQLite session at %s", path)
            return fs
        except Exception as e:  # noqa: BLE001 — персист опционален, не должен ронять поллер
            logger.warning("persistent session unavailable (%s) — using in-memory string session", e)
            return None

    async def _connect_shared(self) -> TelegramClient:
        """Поднять общий клиент на персистентной SQLite-сессии; при любой проблеме
        с авторизацией — откат на прежнюю StringSession (без даунтайма)."""
        persistent = self._persistent_session()
        if persistent is not None:
            client = self._build_client(persistent)
            try:
                await client.connect()
                if await client.is_user_authorized():
                    logger.info("Telegram client started (persistent SQLite session)")
                    return client
                raise RuntimeError("persistent session not authorized")
            except Exception as e:  # noqa: BLE001
                logger.warning("persistent session start failed (%s) — falling back to string session", e)
                try:
                    await client.disconnect()
                except Exception:
                    pass
        client = self._create_client()
        await self._start_client(client)
        logger.info("Telegram client started (in-memory string session)")
        return client

    async def _get_client(self) -> TelegramClient:
        """Вернуть общий долгоживущий клиент, создав/подключив его при первом
        вызове. Клиент не выбрасывается после запроса → его entity-кэш переживает
        между вызовами; с персистентной сессией — ещё и между рестартами."""
        client = self._client
        if client is not None and client.is_connected():
            return client
        async with self._client_lock:
            if self._client is not None and self._client.is_connected():
                return self._client
            self._client = await self._connect_shared()
            return self._client

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
                    sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", name)[:64]
                    cache_name = f"channel_avatar_{sanitized}.jpg"
                    cache_path = self.media_root / cache_name
                    if cache_path.exists():
                        avatar_path = f"/media/{cache_name}"
                    entity = await client.get_entity(name)
                    if not avatar_path:
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
        suffix = ".jpg"
        try:
            fname = getattr(message.file, "name", None) if hasattr(message, "file") else None
            if fname:
                suffix = Path(fname).suffix
        except Exception:
            pass
        channel_id = getattr(message.peer_id, "channel_id", None) or 0
        filename = f"{channel_id}_{message.id}{suffix}"
        dest = self.media_root / filename
        # Treat an EMPTY file as "not cached". Telethon creates the destination
        # up-front and streams into it, so a download that dies midway (FloodWait,
        # timeout, media gone) leaves 0 bytes behind — and a bare exists() check
        # would then serve that empty file forever and never retry.
        if dest.exists() and dest.stat().st_size > 0:
            return [f"/media/{filename}"]
        try:
            path = await client.download_media(message, file=str(dest))
        except Exception as e:
            logger.warning("Media download failed %s: %s", filename, e)
            path = None
        # Скачивание не удалось (обычно FLOOD_PREMIUM_WAIT на не-premium аккаунте).
        # Чистим 0-байтный огрызок, НО возвращаем ожидаемый URL постера — чтобы
        # событие его не потеряло: файл дотянет авто-ретрай (curator
        # backfill_media_retry по (channel_id,message_id) из имени файла). Битую
        # картинку фронт прячет по onError до догрузки.
        if not path or not dest.exists() or dest.stat().st_size == 0:
            try:
                if dest.exists():
                    dest.unlink()
            except OSError:
                pass
            return [f"/media/{filename}"]
        return [f"/media/{Path(path).name}"]

    async def refetch_media(self, items: list[dict[str, Any]], pause: float = 0.4) -> dict[str, Any]:
        """Re-download media for specific (channel, message_id) pairs.

        Repairs posters that were left as 0-byte files by a download that died
        midway: those are invisible to the app (served as 200 with an empty
        body) and the poll loop never revisits old messages, so they need an
        explicit nudge. Safe to re-run — `_collect_media` skips anything that is
        already on disk with a non-zero size."""
        self.media_root.mkdir(parents=True, exist_ok=True)
        client = self._create_client()
        await self._start_client(client)
        repaired: list[dict[str, Any]] = []
        failed: list[dict[str, Any]] = []
        async with client:
            for it in items:
                channel = str(it.get("channel", "")).strip().lstrip("@")
                try:
                    mid = int(it.get("message_id"))
                except (TypeError, ValueError):
                    failed.append({**it, "reason": "bad message_id"})
                    continue
                try:
                    # Prefer the raw channel_id (it's already in the media filename):
                    # PeerChannel resolves from the session's entity cache, while
                    # get_entity(username) hits ResolveUsername — the method Telegram
                    # flood-limits hardest (we ate a 4h wait doing it per item).
                    raw_cid = it.get("channel_id")
                    entity: Any
                    if raw_cid:
                        entity = PeerChannel(int(raw_cid))
                    else:
                        entity = await client.get_entity(channel)
                    msg = await client.get_messages(entity, ids=mid)
                    if isinstance(msg, list):
                        msg = msg[0] if msg else None
                    if msg is None or not getattr(msg, "media", None):
                        failed.append({"channel": channel, "message_id": mid, "reason": "message or media gone"})
                        continue
                    urls = await self._collect_media(client, msg)
                    if urls:
                        repaired.append({"channel": channel, "message_id": mid, "media": urls[0]})
                    else:
                        failed.append({"channel": channel, "message_id": mid, "reason": "download failed"})
                except FloodWaitError as e:
                    failed.append({"channel": channel, "message_id": mid, "reason": f"flood wait {e.seconds}s"})
                    await asyncio.sleep(min(e.seconds, 30))
                except Exception as e:
                    failed.append({"channel": channel, "message_id": mid, "reason": str(e)[:140]})
                await asyncio.sleep(pause)
        return {"requested": len(items), "repaired": repaired, "failed": failed}

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

    def _needs_resolve(self, client: TelegramClient, key: str) -> bool:
        """True, если канала ещё НЕТ в entity-кэше сессии → его чтение вызовет
        ResolveUsername (флуд-опасно). Ошибку трактуем как «нужен резолв» (безопасно
        — тогда его прикроет рейт-лимит)."""
        try:
            client.session.get_input_entity(key)
            return False
        except Exception:
            return True

    async def _resolve_budget_ok(self) -> bool:
        """Токен-бакет: не больше resolve_max_per_window резолвов за окно."""
        now = time.monotonic()
        win = max(1, self.settings.resolve_window_sec)
        mx = max(1, self.settings.resolve_max_per_window)
        async with self._resolve_lock:
            while self._resolve_times and now - self._resolve_times[0] > win:
                self._resolve_times.popleft()
            if len(self._resolve_times) >= mx:
                return False
            self._resolve_times.append(now)
            return True

    async def ingest(
        self,
        channel_ids: list[str],
        per_channel_limit: int = 5,
        pause_between_channels: float = 1.0,
        pause_between_messages: float = 0.0,
        collect_media: bool = True,
        event_keywords: list[str] | None = None,
        min_id: int | None = None,
    ) -> dict[str, Any]:
        """Fetch recent messages from channels; return list of event payloads (no DB). Optionally filter by event_keywords.
        min_id → «догон»: вернуть всё новее этого id (до per_channel_limit), а не только последние N."""
        self.media_root.mkdir(parents=True, exist_ok=True)
        client = await self._get_client()
        events: list[dict[str, Any]] = []
        ok: list[str] = []
        failed: dict[str, str] = {}
        for channel in channel_ids:
            key = channel.strip().lower().lstrip("@")
            remaining = self._flood_until.get(key, 0.0) - time.monotonic()
            if remaining > 0:
                # Канал ещё на cooldown после недавнего FloodWait — не трогаем,
                # чтобы не продлевать лимит. Отдаём наверх как failed (видно в
                # channels_failed), пост подтянется следующим циклом.
                failed[channel] = f"FloodCooldown({int(remaining)}s)"
                continue
            # Канал не в entity-кэше → его чтение форсит ResolveUsername (флуд-опасно).
            needs = self._needs_resolve(client, key)
            if needs:
                # Аккаунт-wide кулдаун: недавний резолв словил FloodWait → НЕ трогаем
                # резолвы вообще, пока лимит не сбросится (иначе каждый холодный канал
                # заново его продлевает — вечная петля резолв→флуд→кэш пуст).
                g = int(self._resolve_blocked_until - time.monotonic())
                if g > 0:
                    failed[channel] = f"ResolveGlobalCooldown({g}s)"
                    continue
                # Сверх бюджета — пропускаем (подтянется следующим циклом): прогрев
                # холодного кэша размазан во времени. Закэшированные идут свободно.
                if not await self._resolve_budget_ok():
                    failed[channel] = "ResolveThrottled (прогрев кэша)"
                    continue
            try:
                # min_id=0 → отдаём Telethon как None (иначе он это как «с самого начала»)
                async for message in client.iter_messages(
                    entity=channel, limit=per_channel_limit, min_id=(min_id or 0)
                ):
                    if not isinstance(message, Message):
                        continue
                    if not message.message and not message.media:
                        continue
                    media_urls = await self._collect_media(client, message) if collect_media else []
                    events.append(self._message_to_payload(channel, message, media_urls))
                    if pause_between_messages > 0:
                        await asyncio.sleep(pause_between_messages)
                ok.append(channel)
                self._flood_until.pop(key, None)
            except FloodWaitError as e:
                wait = max(0, int(getattr(e, "seconds", 0)))
                self._flood_until[key] = time.monotonic() + wait
                if needs:
                    # Флуд на ResolveUsername (канал не был в кэше) — аккаунт-wide.
                    # Блокируем ВСЕ резолвы на это же время, чтобы лимит сбросился.
                    self._resolve_blocked_until = time.monotonic() + wait
                    logger.warning("ResolveUsername FloodWait %ss on %s → глобальный кулдаун резолвов %ss", wait, channel, wait)
                else:
                    logger.warning("FloodWait %ss on %s (cooling down)", wait, channel)
                failed[channel] = f"FloodWait({wait}s)"
            except ValueError as e:
                logger.warning("Channel not found or invalid: %s — %s", channel, e)
                failed[channel] = str(e)[:500]
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
