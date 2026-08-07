"""Заполнить posts_raw.media_phash (dHash постера) из MEDIA_LOCAL_DIR.

Инкрементально (media_phash IS NULL) по постам, стоящим за approved-событиями
ленты (предстоящие/идущие) — как deploy/hash_media.sh, но в Python и по dHash.
Режим --report печатает найденные near-dup кластеры (тот же день, Hamming ≤ порог)
БЕЗ записи — для ревью порога перед включением PHASH_DEDUP_ENABLED.

    python -m app.backfill_phash --apply             # заполнить NULL по ленте
    python -m app.backfill_phash --apply --all       # по всем постам с .jpg
    python -m app.backfill_phash --report [--ham N]  # отчёт по дублям (read-only)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime

from sqlalchemy import String, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.imagehash import dhash, hamming
from app.models import EventCurated, EventStatus, PostRaw

logger = logging.getLogger(__name__)


def _first_media_file(media_urls) -> str | None:
    """Имя файла первого медиа: '/media/123_45.jpg' → '123_45.jpg'."""
    if not media_urls or not isinstance(media_urls, list):
        return None
    first = media_urls[0]
    if not isinstance(first, str) or not first:
        return None
    return first.rsplit("/", 1)[-1] or None


def _feed_filter(q):
    now = datetime.utcnow()
    return (
        q.join(EventCurated, EventCurated.post_id == PostRaw.id)
        .where(EventCurated.status == EventStatus.approved)
        .where(or_(EventCurated.event_time >= now, EventCurated.event_time_end >= now))
    )


async def refresh_phashes(
    session: AsyncSession, media_dir: str, *, only_feed: bool = True, limit: int = 5000
) -> dict:
    """Посчитать dHash для постов с media_phash IS NULL и записать. Идемпотентно."""
    q = select(PostRaw.id, PostRaw.media_urls).select_from(PostRaw)
    if only_feed:
        q = _feed_filter(q)
    q = q.where(func.cast(PostRaw.media_urls, String).ilike("%.jpg%")).where(PostRaw.media_phash.is_(None))
    rows = (await session.execute(q)).all()

    hashed = missing = errors = 0
    for pid, media_urls in rows[:limit]:
        fname = _first_media_file(media_urls)
        if not fname:
            continue
        path = os.path.join(media_dir, fname)
        try:
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                missing += 1
                continue
            h = dhash(path)
        except Exception as e:  # noqa: BLE001 — битый файл не должен ронять прогон
            errors += 1
            logger.debug("phash failed for %s: %s", fname, e)
            continue
        await session.execute(update(PostRaw).where(PostRaw.id == pid).values(media_phash=h))
        hashed += 1
    return {"candidates": len(rows), "hashed": hashed, "missing_file": missing, "errors": errors}


async def report(session: AsyncSession, max_ham: int) -> None:
    """Печать near-dup пар: те же дни, у которых постеры визуально идентичны
    (Hamming ≤ max_ham) — но события пока в РАЗНЫХ dup_group_id. Read-only."""
    now = datetime.utcnow()
    q = (
        select(
            EventCurated.id, EventCurated.title, EventCurated.event_time,
            EventCurated.dup_group_id, PostRaw.media_phash, PostRaw.media_urls, PostRaw.text,
        )
        .join(PostRaw, PostRaw.id == EventCurated.post_id)
        .where(EventCurated.status == EventStatus.approved)
        .where(or_(EventCurated.event_time >= now, EventCurated.event_time_end >= now))
        .where(PostRaw.media_phash.isnot(None))
    )
    by_day: dict[str, list] = {}
    for eid, title, et, gid, ph, mu, txt in (await session.execute(q)).all():
        day = et.strftime("%d.%m") if et else "?"
        label = (title or (txt or "").replace("\n", " "))[:58]
        by_day.setdefault(day, []).append((eid, gid, ph, _first_media_file(mu), label))

    pairs = would_merge = 0
    for day, items in sorted(by_day.items()):
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if len(a[2]) != len(b[2]):
                    continue
                d = hamming(a[2], b[2])
                if d <= max_ham:
                    pairs += 1
                    same = a[1] is not None and a[1] == b[1]
                    if not same:
                        would_merge += 1
                    tag = "УЖЕ-в-группе" if same else ">>> СОЛЬЁТСЯ"
                    print(f"[{day}] Ham={d:<2} {tag}")
                    print(f"    #{a[0]} grp={a[1]} {a[3]}  ::  {a[4]}")
                    print(f"    #{b[0]} grp={b[1]} {b[3]}  ::  {b[4]}")
    print(f"\nПар Ham≤{max_ham}: {pairs} | из них НОВЫХ склеек (сейчас в разных группах): {would_merge}")


async def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="посчитать и записать phash по NULL")
    ap.add_argument("--all", action="store_true", help="по всем постам с .jpg, не только по ленте")
    ap.add_argument("--report", action="store_true", help="отчёт near-dup (read-only)")
    ap.add_argument("--ham", type=int, default=None, help="порог Хэмминга для отчёта")
    args = ap.parse_args()

    s0 = Settings()
    if not s0.media_local_dir:
        print("MEDIA_LOCAL_DIR не задан — curator не видит медиа, хэшировать нечего")
        return
    engine = create_engine(s0.postgres_dsn)
    sf = create_session_maker(engine)
    try:
        if args.report:
            async with session_scope(sf) as s:
                await report(s, args.ham if args.ham is not None else s0.phash_max_hamming)
        elif args.apply:
            async with session_scope(sf) as s:
                res = await refresh_phashes(s, s0.media_local_dir, only_feed=not args.all)
            print("phash refresh:", json.dumps(res, ensure_ascii=False))
        else:
            print("укажи --apply (записать) или --report (посмотреть дубли)")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())
