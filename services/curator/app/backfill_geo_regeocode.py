"""Re-apply the gazetteer to already-geocoded events — and CLEAR the pins it no longer makes.

Why this exists (the other two backfills can't do it):
  · backfill_geo.py         — only fills location_meta IS NULL, never revises.
  · backfill_geo_channels.py — only overwrites when a venue matches, never clears.

When a too-generic alias is removed from the gazetteer (e.g. «Москва», which had
pinned 121 unrelated events onto Концертный зал «Москва»), the bad rows stay in the
DB forever: the pipeline only geocodes on ingest. This sweep re-runs geocode() over
every gazetteer-derived event and writes back whatever it now returns — including
None, which clears the stale pin.

Scope guard: touches ONLY rows this gazetteer produced, i.e. location_meta.source in
GAZETTEER_SOURCES. Do NOT gate on the presence of a "venue" key — the older
agent geocoder sets one too (source="agent-geocode"/"agent-channel"/"agent", 576 rows
in prod). Re-running geocode() over those would clear pins the gazetteer cannot
reproduce and silently destroy data.

Idempotent. Dry-run by default; --apply writes.

    docker exec <curator> python -m app.backfill_geo_regeocode          # dry-run
    docker exec <curator> python -m app.backfill_geo_regeocode --apply
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import Channel, EventCurated, PostRaw
from app.pipeline import gazetteer

# Only these were written by gazetteer.geocode(), so only these can be safely
# recomputed from it. Everything else (agent*) came from a one-off geocoder whose
# output we cannot regenerate — clearing it would be data loss, not a fix.
GAZETTEER_SOURCES = frozenset({"gazetteer", "gazetteer-channel"})


async def main(apply: bool) -> None:
    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = kept = moved = cleared = 0
    cleared_by: dict[str, int] = {}
    moved_by: dict[str, int] = {}

    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(EventCurated, PostRaw.text, Channel.handle)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .join(Channel, Channel.id == PostRaw.channel_id)
                .where(EventCurated.location_meta.isnot(None))
            )
        ).all()

        for ev, text, handle in rows:
            old = ev.location_meta or {}
            if old.get("source") not in GAZETTEER_SOURCES:
                continue  # legacy agent geo (it also carries a venue key) — never touch
            old_venue = old.get("venue")
            if not old_venue:
                continue
            scanned += 1
            geo = gazetteer.geocode(
                text=text, location_text=ev.location_text, channel_handle=handle
            )
            new_venue = (geo or {}).get("venue")
            if new_venue == old_venue:
                kept += 1
                continue
            if new_venue:
                moved += 1
                moved_by[f"{old_venue}->{new_venue}"] = moved_by.get(f"{old_venue}->{new_venue}", 0) + 1
            else:
                cleared += 1
                cleared_by[old_venue] = cleared_by.get(old_venue, 0) + 1
            if apply:
                ev.location_meta = geo  # None clears the stale pin

        if not apply:
            # never persist a dry-run
            s.expunge_all()

    await engine.dispose()
    mode = "APPLIED" if apply else "DRY-RUN"
    print(f"[regeocode {mode}] scanned={scanned} kept={kept} moved={moved} cleared={cleared}")
    if cleared_by:
        print("  снято пинов по площадкам:")
        for k, n in sorted(cleared_by.items(), key=lambda x: -x[1]):
            print(f"    {n:4d}  {k}")
    if moved_by:
        print("  переехали:")
        for k, n in sorted(moved_by.items(), key=lambda x: -x[1]):
            print(f"    {n:4d}  {k}")


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv[1:]))
