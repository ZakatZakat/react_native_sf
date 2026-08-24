"""Авто-ретрай битых постеров (медиа, упавшее на FLOOD_PREMIUM_WAIT при скачивании).

Как устроено медиа: фронт просит `…/media/{cid}_{mid}.jpg` → media-nginx отдаёт
из кэша, а на промахе проксирует к поллеру и сохраняет 200 (ошибки не кэширует).
Значит «починить постер» = заставить ПОЛЛЕР до-скачать файл; nginx отдаст его на
следующем запросе сам. Локальное зеркало не нужно.

Скрипт: берёт approved-события со свежим .jpg-постером, HEAD-ит его через nginx;
для 404 (ни в кэше, ни у поллера) зовёт поллер `/refetch-media`. Идемпотентно:
поллер пропускает уже скачанные файлы. channel_id в item НЕ шлём: с ним поллер
идёт `PeerChannel(channel_id)` на свежем in-memory клиенте (пустой entity-кэш) и
падает «input entity not found» — чинил ноль; без него резолвит по хэндлу
(get_entity), Telethon кэширует entity в вызове, повторы канала бесплатны.

Запуск: `python -m app.backfill_media_retry --apply [--days 3]`. Также крутится
в scheduler'е каждые 30 мин (CuratorScheduler._run_media_retry).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import Channel, EventCurated, EventStatus, PostRaw
from app.services.tg_client import TelegramServiceClient

logger = logging.getLogger(__name__)

MEDIA_BASE = "http://media"  # media-nginx на общей docker-сети (traefik-public)
_FN = re.compile(r"/media/(\d+)_(\d+)\.(?:jpe?g|png)$", re.IGNORECASE)


def _first_jpg(media_urls: Any) -> str | None:
    if not media_urls:
        return None
    for u in media_urls:
        if isinstance(u, str) and re.search(r"\.jpe?g$", u, re.IGNORECASE):
            return u
    return None


async def retry_broken_posters(
    session_factory: async_sessionmaker[AsyncSession],
    tg_client: TelegramServiceClient,
    *,
    days: int = 3,
    apply: bool = True,
    limit: int = 400,
) -> dict[str, Any]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    async with session_scope(session_factory) as s:
        rows = (await s.execute(
            select(EventCurated.id, Channel.handle, PostRaw.message_id, PostRaw.media_urls)
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .join(Channel, Channel.id == PostRaw.channel_id)
            .where(EventCurated.status == EventStatus.approved)
            .where(PostRaw.fetched_at > cutoff)
            .order_by(PostRaw.fetched_at.desc())
            .limit(limit)
        )).all()

    cands: list[tuple[str, int, str]] = []  # (handle, message_id, media_url)
    for _eid, handle, mid, murls in rows:
        u = _first_jpg(murls)
        if u and handle:
            cands.append((handle, int(mid), u))

    # Детект битых: HEAD через nginx. 404/ошибка → постера нет ни в кэше, ни у поллера.
    broken: list[tuple[str, int, str]] = []
    sem = asyncio.Semaphore(10)
    async with httpx.AsyncClient(timeout=20) as http:
        async def check(item: tuple[str, int, str]) -> None:
            async with sem:
                try:
                    r = await http.head(f"{MEDIA_BASE}{item[2]}")
                    ok = r.status_code == 200
                except Exception:
                    ok = False
                if not ok:
                    broken.append(item)
        await asyncio.gather(*(check(i) for i in cands))

    # refetch-элементы. channel_id НЕ шлём намеренно: с ним поллер идёт через
    # PeerChannel(channel_id), но refetch поднимает свежий in-memory клиент с пустым
    # entity-кэшем → «Could not find the input entity» на КАЖДОМ (чинил ноль). Без
    # channel_id поллер резолвит канал по хэндлу (get_entity), а Telethon кэширует
    # entity в рамках вызова → повторы того же канала бесплатны. Сортируем по каналу,
    # чтобы его items шли подряд (один ResolveUsername на канал, без флуда).
    items: list[dict[str, Any]] = []
    for handle, mid, u in broken:
        if not _FN.search(u):
            continue
        items.append({"channel": handle, "message_id": mid})
    items.sort(key=lambda it: it["channel"])

    result: dict[str, Any] = {"scanned": len(cands), "broken": len(broken), "repaired": 0, "failed": 0}
    if apply and items:
        for i in range(0, len(items), 40):
            batch = items[i:i + 40]
            try:
                res = await tg_client.refetch_media(batch)
                result["repaired"] += len(res.get("repaired", []))
                result["failed"] += len(res.get("failed", []))
            except Exception as e:  # noqa: BLE001 — один битый батч не должен ронять весь проход
                result.setdefault("errors", []).append(str(e)[:140])
    return result


async def _main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="реально дёргать refetch (иначе только счёт)")
    ap.add_argument("--days", type=int, default=3)
    args = ap.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)
    tg = TelegramServiceClient(settings.telegram_service_url, token=settings.telegram_service_token or None)
    res = await retry_broken_posters(sf, tg, days=args.days, apply=args.apply)
    await engine.dispose()
    print(res)


if __name__ == "__main__":
    asyncio.run(_main())
