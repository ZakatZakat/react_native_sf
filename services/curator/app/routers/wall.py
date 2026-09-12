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

import httpx
from fastapi import APIRouter, Query

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


async def _refresh() -> list[dict]:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        chunks = await asyncio.gather(*[_fetch_channel(client, c) for c in WALL_CHANNELS])
    items = [p for chunk in chunks for p in chunk]
    items.sort(key=lambda p: p.get("date") or "", reverse=True)
    return items


@router.get("")
async def wall(limit: int = Query(140, ge=1, le=400)) -> dict:
    now = time.time()
    if not _CACHE["items"] or now - _CACHE["ts"] > _TTL:
        async with _LOCK:
            if not _CACHE["items"] or time.time() - _CACHE["ts"] > _TTL:
                fresh = await _refresh()
                if fresh:  # не затираем кэш пустым (сетевой сбой)
                    _CACHE["items"] = fresh
                    _CACHE["ts"] = time.time()
    return {"items": _CACHE["items"][:limit], "count": len(_CACHE["items"])}
