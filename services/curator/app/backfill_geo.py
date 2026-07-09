"""One-off backfill: geocode existing events via the venue gazetteer (issue #2).

Проставляет location_meta всем событиям без гео, у которых текст поста или
канал матчится по газеттиру. Идемпотентно (трогает только location_meta IS
NULL). Запуск внутри контейнера куратора:

    docker exec <curator-container> python -m app.backfill_geo
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import Channel, EventCurated, PostRaw
from app.pipeline import gazetteer


async def main() -> None:
    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = matched = 0
    by_source: dict[str, int] = {}
    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(EventCurated, PostRaw.text, Channel.handle)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .join(Channel, Channel.id == PostRaw.channel_id)
                .where(EventCurated.location_meta.is_(None))
            )
        ).all()

        for ev, text, handle in rows:
            scanned += 1
            geo = gazetteer.geocode(
                text=text, location_text=ev.location_text, channel_handle=handle
            )
            if geo:
                ev.location_meta = geo
                matched += 1
                by_source[geo["source"]] = by_source.get(geo["source"], 0) + 1

    await engine.dispose()
    print(f"scanned={scanned} matched={matched} by_source={by_source}")


if __name__ == "__main__":
    asyncio.run(main())
