"""Refresh stored event coords to the CURRENT gazetteer coords for the venue an
event is already pinned to.

Why this exists (the other three geo backfills can't do it):
  · backfill_geo.py          — only fills location_meta IS NULL, never revises.
  · backfill_geo_channels.py — re-geocodes BY CHANNEL HANDLE, so it misses
    per-event alias matches coming from aggregator/other channels.
  · backfill_geo_regeocode.py — re-runs geocode() but treats an unchanged venue
    key as "kept", so a corrected COORDINATE on the same key is never written.

When a venue's coordinates are fixed in the gazetteer (e.g. ЦТИ «Фабрика»,
перенесённая с ошибочной точки у Красносельской на Переведеновский 18), every
event already pinned to that venue keeps its stale lat/lng — the pipeline
геокодит только на инжесте. Этот проход выставляет lat/lng каждого события,
порождённого газеттиром, в ТЕКУЩИЕ координаты его же площадки, матчась по venue,
на который событие УЖЕ запинено (без повторного матча алиасов/handle — значит не
может перекинуть событие на другую площадку).

Scope guard: трогает ТОЛЬКО строки, сделанные этим газеттиром (source in
GAZETTEER_SOURCES) и несущие venue-ключ, который в газеттире всё ещё есть.
Идемпотентно. Dry-run по умолчанию; --apply пишет.

    docker exec <curator> python -m app.backfill_geo_recoord            # dry-run
    docker exec <curator> python -m app.backfill_geo_recoord --apply
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated
from app.pipeline import gazetteer

# Only these were written by gazetteer.geocode(), so only these carry a venue key
# whose coords we can safely refresh from the gazetteer. Legacy agent geo
# (source="agent*") we never touch.
GAZETTEER_SOURCES = frozenset({"gazetteer", "gazetteer-channel"})


async def main(apply: bool) -> None:
    coords = {v.key: (v.lat, v.lng) for v in gazetteer.VENUES}
    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = kept = moved = 0
    moved_by: dict[str, int] = {}
    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(EventCurated).where(EventCurated.location_meta.isnot(None))
            )
        ).scalars().all()

        for ev in rows:
            lm = ev.location_meta or {}
            if lm.get("source") not in GAZETTEER_SOURCES:
                continue
            key = lm.get("venue")
            if not key or key not in coords:
                continue
            scanned += 1
            lat, lng = coords[key]
            if abs(lm.get("lat", 0.0) - lat) < 1e-6 and abs(lm.get("lng", 0.0) - lng) < 1e-6:
                kept += 1
                continue
            moved += 1
            moved_by[key] = moved_by.get(key, 0) + 1
            if apply:
                new_lm = dict(lm)
                new_lm["lat"], new_lm["lng"] = lat, lng
                ev.location_meta = new_lm

        if not apply:
            s.expunge_all()  # never persist a dry-run

    await engine.dispose()
    mode = "APPLIED" if apply else "DRY-RUN"
    print(f"[recoord {mode}] scanned={scanned} kept={kept} moved={moved}")
    if moved_by:
        print("  переставлены на текущую точку площадки:")
        for k, n in sorted(moved_by.items(), key=lambda x: -x[1]):
            print(f"    {n:4d}  {k}")


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv[1:]))
