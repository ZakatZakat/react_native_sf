"""Раздел «Рекомендации» — редакторские дайджесты из @napervom («Первый ночной»).

Дайджесты «Первого ночного» — это статьи на Teletype (кастомный домен
blog.myidem.moscow): «Выставки недели», «Тусовки недели» и т.п. В самом
ТГ-канале — короткий тизер + link-preview на статью.

Здесь server-side тянем публичную веб-ленту канала (t.me/s/napervom), берём
посты, у которых превью ведёт на Teletype, и отдаём их как ленту дайджестов
(заголовок + тизер + обложка + ссылка на полную статью). Кэш в памяти (15 мин),
чтобы не дёргать t.me на каждый запрос. Публичный эндпоинт — контент публичный.
"""

from __future__ import annotations

import html as _html
import re
import time

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/recommendations", tags=["recommendations"])

SOURCE_CHANNEL = "napervom"
DIGEST_HOSTS = ("blog.myidem.moscow", "teletype.in", "telegra.ph")
CACHE_TTL = 900  # сек
_cache: dict = {"ts": 0.0, "items": []}

_UA = "Mozilla/5.0 (compatible; CitySignal/1.0)"


def _strip(s: str) -> str:
    """HTML → текст: <br> в перенос, срезать теги, раскодировать сущности."""
    s = re.sub(r"<br\s*/?>", "\n", s or "")
    s = re.sub(r"<[^>]+>", "", s)
    return _html.unescape(s).strip()


def _find(chunk: str, pattern: str) -> str:
    m = re.search(pattern, chunk, re.S)
    return _strip(m.group(1)) if m else ""


def _parse(html_text: str) -> list[dict]:
    """Разобрать t.me/s HTML в дайджесты (посты с teletype-превью)."""
    items: list[dict] = []
    # разбиваем на блоки сообщений
    chunks = re.split(r'(?=<div class="tgme_widget_message[ "])', html_text)
    for chunk in chunks:
        mid_m = re.search(r'data-post="[^"]*?/(\d+)"', chunk)
        lp_m = re.search(r'<a class="tgme_widget_message_link_preview"\s+href="([^"]+)"', chunk)
        if not mid_m or not lp_m:
            continue
        url = _html.unescape(lp_m.group(1))
        if not any(host in url for host in DIGEST_HOSTS):
            continue
        mid = int(mid_m.group(1))
        title = _find(chunk, r'link_preview_title[^>]*>(.*?)</div>')
        desc = _find(chunk, r'link_preview_description[^>]*>(.*?)</div>')
        cover_m = re.search(r"link_preview_image[^\"]*\"[^>]*background-image:\s*url\('([^']+)'\)", chunk)
        cover = _html.unescape(cover_m.group(1)) if cover_m else None
        teaser = _find(chunk, r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>\s*(?:<a class="tgme_widget_message_link_preview"|<div class="tgme_widget_message_footer)')
        date = _find(chunk, r'<time[^>]*datetime="([^"]+)"')
        items.append({
            "id": str(mid),
            "message_id": mid,
            "title": title or "Дайджест",
            "teaser": teaser,
            "cover": cover,
            "digest_url": url,
            "published_at": date or None,
            "tg_url": f"https://t.me/{SOURCE_CHANNEL}/{mid}",
        })
    # новые сверху
    items.sort(key=lambda x: x["message_id"], reverse=True)
    return items


async def _fetch_source() -> list[dict]:
    now = time.time()
    if _cache["items"] and now - _cache["ts"] < CACHE_TTL:
        return _cache["items"]
    try:
        async with httpx.AsyncClient(timeout=20, headers={"User-Agent": _UA}) as c:
            r = await c.get(f"https://t.me/s/{SOURCE_CHANNEL}")
            r.raise_for_status()
            items = _parse(r.text)
        if items:  # не затираем кэш пустотой при временном сбое парсинга
            _cache["items"], _cache["ts"] = items, now
        return items or _cache["items"]
    except Exception:  # noqa: BLE001 — раздел не должен падать из-за внешнего фетча
        return _cache["items"]


@router.get("")
async def list_recommendations(limit: int = Query(20, ge=1, le=50)) -> dict:
    items = await _fetch_source()
    return {"source": f"@{SOURCE_CHANNEL}", "items": items[:limit], "count": min(len(items), limit)}
