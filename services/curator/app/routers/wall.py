"""Раздел «Голоса» — живая лента постов из авторских культур-каналов Москвы
(рецензии, вайбы, находки). В отличие от event-пайплайна, здесь показываем посты
как есть — в формате Pinterest/Insta-стены.

Источник — публичный веб-превью Telegram (t.me/s/<канал>): парсим последние посты
(текст + фото + ссылка + дата), мержим по каналам, сортируем по свежести. Кэш в
памяти (TTL), чтобы не дёргать t.me на каждый запрос. Каналы — подмножество наших
кураторских community-blog каналов (channel_taxonomy). Каналы с закрытым веб-превью
(напр. @animalswithhands, content-protected) через t.me/s недоступны — их тут нет.
"""

from __future__ import annotations

import asyncio
import html as _html
import re
import time
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Query, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db import session_scope
from app.models import Channel, PostRaw

router = APIRouter(prefix="/wall", tags=["wall"])

# Кураторская выборка авторских каналов (арт/культура/кино/вайб) с живыми постами
# и хорошей визуалкой. Легко расширяется — просто добавить хэндл.
WALL_CHANNELS: list[str] = [
    "sartirmsk",          # авторские рецензии на выставки
    "vmuzey",             # музеи, коллекции
    "ica_moscow",         # современное искусство
    "workinart",          # арт-сцена
    "live_1artchannel",   # арт
    "dada_1978",          # арт/культура
    "aganiokart",         # арт-заметки
    "admarginem",         # культура, книги
    "go_kitsch",          # культура/стиль
    "kinoclub_verticals", # кино
    "besplatnoekino",     # бесплатное кино
    "hecplace",           # места/пространства
]

# Каналы БЕЗ публичного веб-превью t.me/s (content-protected / preview off), но
# которые мы поллим сами — их посты берём из своей БД (posts_raw + /media).
# @animalswithhands («Филиал КЛЮРСИ», арт-события) — как раз такой.
POLLER_CHANNELS: list[str] = [
    "animalswithhands",
]

_IMG_RE = re.compile(r"\.(?:jpe?g|png|webp|gif)(?:\?|$)", re.I)

_TTL = 900.0  # 15 минут
_CACHE: dict = {"ts": 0.0, "items": []}
_LOCK = asyncio.Lock()

_RE_WRAP = re.compile(r'<div class="tgme_widget_message_wrap')
_RE_POST = re.compile(r'data-post="([^"]+)"')
_RE_IMG = re.compile(r"background-image:url\('(https://cdn[^']+)'\)")
_RE_TIME = re.compile(r'datetime="([^"]+)"')
_RE_TEXT = re.compile(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', re.S)
_RE_TITLE = re.compile(r'<div class="tgme_channel_info_header_title[^"]*"[^>]*>\s*<span[^>]*>(.*?)</span>', re.S)


def _clean_text(fragment: str) -> str:
    t = re.sub(r"<br/?>", "\n", fragment)
    t = re.sub(r"</p>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    return _html.unescape(t).strip()


def _parse(channel: str, raw: str) -> list[dict]:
    tm = _RE_TITLE.search(raw)
    channel_title = _clean_text(tm.group(1)) if tm else channel
    posts: list[dict] = []
    for block in _RE_WRAP.split(raw)[1:]:
        mp = _RE_POST.search(block)
        if not mp:
            continue
        imgs = _RE_IMG.findall(block)
        mt = _RE_TEXT.search(block)
        text = _clean_text(mt.group(1)) if mt else ""
        if not imgs and not text:
            continue  # пустышки/сервисные не берём
        md = _RE_TIME.search(block)
        posts.append({
            "channel": channel,
            "channel_title": channel_title,
            "post": mp.group(1),
            "url": f"https://t.me/{mp.group(1)}",
            "date": md.group(1) if md else None,
            "images": imgs[:6],
            "text": text[:800],
        })
    return posts


async def _fetch_channel(client: httpx.AsyncClient, channel: str) -> list[dict]:
    try:
        r = await client.get(
            f"https://t.me/s/{channel}",
            timeout=12.0,
            headers={"User-Agent": "Mozilla/5.0 (compatible; CitySignalWall/1.0)"},
        )
        if r.status_code != 200:
            return []
        return _parse(channel, r.text)
    except Exception:
        return []


async def _poller_posts(sf: async_sessionmaker[AsyncSession], handles: list[str], per_channel: int = 14) -> list[dict]:
    """Посты каналов без t.me/s — из нашего posts_raw (+ /media)."""
    out: list[dict] = []
    # «живая» стена — только свежие посты; иначе всплывает старьё от каналов,
    # которые мы давно перестали поллить (напр. @animalswithhands, off с 08.2026).
    cutoff = datetime.utcnow() - timedelta(days=21)
    async with session_scope(sf) as s:
        for handle in handles:
            ch = (await s.execute(
                select(Channel).where(Channel.handle.in_([handle, f"@{handle}"]))
            )).scalars().first()
            if not ch:
                continue
            rows = (await s.execute(
                select(PostRaw)
                .where(PostRaw.channel_id == ch.id)
                .where(PostRaw.published_at.is_not(None))
                .where(PostRaw.published_at >= cutoff)
                .order_by(desc(PostRaw.published_at), desc(PostRaw.message_id))
                .limit(per_channel)
            )).scalars().all()
            title = ch.title or handle
            for r in rows:
                imgs = [u for u in (r.media_urls or []) if isinstance(u, str) and _IMG_RE.search(u)]
                text = (r.text or "").strip()
                if not imgs and not text:
                    continue
                out.append({
                    "channel": handle,
                    "channel_title": title,
                    "post": f"{handle}/{r.message_id}",
                    "url": f"https://t.me/{handle}/{r.message_id}",
                    "date": r.published_at.isoformat() if r.published_at else None,
                    "images": imgs[:6],
                    "text": text[:800],
                })
    return out


async def _refresh(sf: async_sessionmaker[AsyncSession] | None) -> list[dict]:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        chunks = await asyncio.gather(*[_fetch_channel(client, c) for c in WALL_CHANNELS])
    items = [p for chunk in chunks for p in chunk]
    if sf is not None and POLLER_CHANNELS:
        try:
            items += await _poller_posts(sf, POLLER_CHANNELS)
        except Exception:
            pass  # БД-источник best-effort, не роняем стену
    items.sort(key=lambda p: p.get("date") or "", reverse=True)
    return items


@router.get("")
async def wall(request: Request, limit: int = Query(140, ge=1, le=400)) -> dict:
    now = time.time()
    if not _CACHE["items"] or now - _CACHE["ts"] > _TTL:
        async with _LOCK:
            if not _CACHE["items"] or time.time() - _CACHE["ts"] > _TTL:
                sf = getattr(request.app.state, "session_factory", None)
                fresh = await _refresh(sf)
                if fresh:  # не затираем кэш пустым (сетевой сбой)
                    _CACHE["items"] = fresh
                    _CACHE["ts"] = time.time()
    return {"items": _CACHE["items"][:limit], "count": len(_CACHE["items"])}
