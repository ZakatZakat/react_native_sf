"""One-off: reject already-approved digest/roundup posts (issue: aggregator
"week ahead" posts were auto-approving and showing as one bogus event). Re-runs
looks_like_digest over stored posts and flips digests to rejected.

    docker exec <curator> python -m app.backfill_digest
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select, update

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventStatus, PostRaw
from app.pipeline.detector import looks_like_digest


async def main() -> None:
    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = rejected = 0
    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(EventCurated.id, PostRaw.text)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .where(EventCurated.status == EventStatus.approved)
            )
        ).all()
        digest_ids = []
        for eid, text in rows:
            scanned += 1
            if text and looks_like_digest(text):
                digest_ids.append(eid)
        if digest_ids:
            await s.execute(
                update(EventCurated)
                .where(EventCurated.id.in_(digest_ids))
                .values(status=EventStatus.rejected)
            )
            rejected = len(digest_ids)

    await engine.dispose()
    print(f"scanned={scanned} rejected_digests={rejected}")


if __name__ == "__main__":
    asyncio.run(main())
