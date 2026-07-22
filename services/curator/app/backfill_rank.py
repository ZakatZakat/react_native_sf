"""One-off / periodic: залить таксономию каналов (ctype + authority→weight) и
пересчитать дедуп-группы + rank_score для всей ленты.

    docker exec <curator> python -m app.backfill_rank            # dry-run
    docker exec <curator> python -m app.backfill_rank --apply    # запись
    docker exec <curator> python -m app.backfill_rank --apply --skip-taxonomy

Таксономия каналов лежит в app/data/channel_taxonomy.json (handle → {ctype,
authority}). authority (1..3) кладём в Channel.weight (мёртвое поле оживляем),
ctype — в новую колонку Channel.ctype. Ранг считает app.ranking.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from sqlalchemy import select, update

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import Channel
from app.ranking import recompute_feed_ranks

_TAXONOMY = Path(__file__).parent / "data" / "channel_taxonomy.json"


def _load_taxonomy() -> dict[str, dict]:
    return json.loads(_TAXONOMY.read_text(encoding="utf-8"))


async def _seed_taxonomy(session, tax: dict[str, dict], *, apply: bool) -> tuple[int, int]:
    """Проставить ctype + weight каналам по хэндлу. Возвращает (matched, missing)."""
    channels = (await session.execute(select(Channel))).scalars().all()
    by_handle = {(c.handle or "").lstrip("@").lower(): c for c in channels}
    matched = 0
    for handle, meta in tax.items():
        c = by_handle.get(handle.lstrip("@").lower())
        if not c:
            continue
        matched += 1
        if apply:
            await session.execute(
                update(Channel)
                .where(Channel.id == c.id)
                .values(ctype=meta["ctype"], weight=float(meta["authority"]))
            )
    return matched, len(tax) - matched


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="записать (иначе dry-run)")
    ap.add_argument("--skip-taxonomy", action="store_true", help="не трогать ctype/weight каналов")
    args = ap.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    session_factory = create_session_maker(engine)

    async with session_scope(session_factory) as s:
        if not args.skip_taxonomy:
            tax = _load_taxonomy()
            matched, missing = await _seed_taxonomy(s, tax, apply=args.apply)
            print(f"таксономия: {matched} каналов размечено, {missing} из файла не нашлось в БД")
        res = await recompute_feed_ranks(s, apply=args.apply)
        print(
            f"ранг: {res.rows} фид-строк → {res.groups} событий "
            f"(дедуп −{res.collapsed}); одобрено @animalswithhands: {res.endorsed}; "
            f"обновлений: {len(res.updates)}"
        )
        # топ-15 по скору (из посчитанного)
        top = sorted(
            {(gid, sc) for (_id, gid, _p, _x, sc) in res.updates},
            key=lambda t: -t[1],
        )[:15]
        print("топ-15 групп по rank_score:", ", ".join(f"{gid}:{sc:+.2f}" for gid, sc in top))

    await engine.dispose()
    mode = "APPLIED" if args.apply else "DRY-RUN (no writes)"
    print(f"[{mode}]")


if __name__ == "__main__":
    asyncio.run(main())
