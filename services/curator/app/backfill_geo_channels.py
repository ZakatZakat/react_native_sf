"""Re-geocode events from specific venue-channels via the gazetteer, OVERWRITING
existing location_meta.

The live pipeline geocodes via the gazetteer only (enricher), but older events
carry metro/street coords from a one-off agent/API geocoder with NO venue key —
so their card shows the raw location ("м. Смоленская") instead of the venue.
Once a channel is mapped to its home venue (handle added to the gazetteer), this
re-applies the gazetteer to those events. Only overwrites when the gazetteer
returns a real venue match; idempotent.

    docker exec <curator> python -m app.backfill_geo_channels @teatrtruda_10 @random_culture
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import Channel, EventCurated, PostRaw
from app.pipeline import gazetteer


async def main(handles: list[str]) -> None:
    wanted = {(h if h.startswith("@") else "@" + h).lower() for h in handles}
    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = updated = 0
    by_venue: dict[str, int] = {}
    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(EventCurated, PostRaw.text, Channel.handle)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .join(Channel, Channel.id == PostRaw.channel_id)
                .where(Channel.handle.in_(list(wanted)))
            )
        ).all()

        for ev, text, handle in rows:
            scanned += 1
            geo = gazetteer.geocode(
                text=text, location_text=ev.location_text, channel_handle=handle
            )
            if geo and geo.get("venue"):
                ev.location_meta = geo  # overwrite stale metro/API coords
                updated += 1
                by_venue[geo["venue"]] = by_venue.get(geo["venue"], 0) + 1

    await engine.dispose()
    print(f"channels={sorted(wanted)} scanned={scanned} updated={updated} by_venue={by_venue}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("usage: python -m app.backfill_geo_channels @handle1 @handle2 ...")
        raise SystemExit(1)
    asyncio.run(main(args))
