"""VK API-клиент — тянет посты со стены публичной группы через `wall.get` и отдаёт
те же `RawMessage`, что и telegram-клиент, чтобы пайплайн (dedup → detect → enrich →
moderation) не знал об источнике. Медиа НЕ качаем локально — отдаём прямые URL VK-CDN
(фронт использует http(s)-URL как есть через resolveMedia).

Каналы VK помечаются handle'ом `vk:<domain-или-owner_id>` (см. processor). Домен —
короткое имя (`moskvaccc`), либо `club<id>` / `-<id>` для групп без короткого имени.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

import httpx

from app.services.tg_client import RawMessage, TelegramFetchError

logger = logging.getLogger(__name__)

VK_API = "https://api.vk.com/method/wall.get"
VK_V = "5.199"


def _photo_url(photo: dict) -> str | None:
    sizes = photo.get("sizes") or []
    if not sizes:
        return None
    best = max(sizes, key=lambda s: (s.get("width", 0) or 0) * (s.get("height", 0) or 0))
    return best.get("url")


def _extract(post: dict) -> tuple[str, list[str]]:
    """Текст + фото-URL из поста; если своего нет — из репоста (copy_history)."""
    text = (post.get("text") or "").strip()
    media: list[str] = []
    for att in (post.get("attachments") or []):
        if att.get("type") == "photo":
            u = _photo_url(att.get("photo") or {})
            if u:
                media.append(u)
    if (not text or not media) and post.get("copy_history"):
        rt, rm = _extract(post["copy_history"][0])
        text = text or rt
        media = media or rm
    return text, media


class VKServiceClient:
    def __init__(self, token: str, timeout: float = 30.0) -> None:
        self._token = token
        self._timeout = timeout

    async def fetch(self, domain: str, *, limit: int = 20, min_id: int | None = None) -> list[RawMessage]:
        """Свежие посts стены. VK отдаёт новейшие сверху; фильтруем id > min_id (догон),
        закреплённый старый пост при этом отсекается по id. `domain` — короткое имя,
        `club<id>`/`-<id>` → owner_id."""
        if not self._token:
            raise TelegramFetchError("VK: сервисный токен не сконфигурирован (VK_SERVICE_TOKEN)")
        params: dict = {"count": max(limit, 10), "access_token": self._token, "v": VK_V, "extended": 0}
        if re.fullmatch(r"-?\d+", domain):
            params["owner_id"] = int(domain)
        elif re.fullmatch(r"club(\d+)", domain):
            params["owner_id"] = -int(domain[4:])
        else:
            params["domain"] = domain
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as c:
                r = await c.get(VK_API, params=params)
            data = r.json()
        except Exception as e:  # noqa: BLE001
            raise TelegramFetchError(f"VK http: {e!s}")
        if "error" in data:
            err = data["error"] or {}
            raise TelegramFetchError(f"VK {err.get('error_code')}: {err.get('error_msg')}")
        items = ((data.get("response") or {}).get("items")) or []
        out: list[RawMessage] = []
        for it in items:
            mid = int(it.get("id") or 0)
            if not mid or (min_id is not None and mid <= min_id):
                continue
            text, media = _extract(it)
            if not text and not media:
                continue
            ts = it.get("date")
            pub = datetime.utcfromtimestamp(ts) if ts else None
            out.append(RawMessage(channel=domain, message_id=mid, text=text, media_urls=media, published_at=pub))
        return out
