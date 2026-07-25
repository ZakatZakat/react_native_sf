"""One-off: recover event_time on events left undated (event_time и event_time_end
оба NULL) из-за того, что dateparser читал голый «DD.MM» как ВРЕМЯ (23:07), а
«DD.MM HH:MM» вообще не парсил. Фикс — `enricher._numeric_ddmm_to_words` («23.07»
→ «23 июля»). Здесь переразбираем уже лежащие в БД недатированные посты через
исправленный detector/enricher и проставляем event_time / event_time_end, когда
дата теперь извлекается.

После этого прошедшие события уходят из ленты по её гейту `event_time >= now`, а
будущие — корректно появляются.

Dry-run по умолчанию — пиши через --apply.

    docker exec <curator> python -m app.backfill_null_dates            # preview
    docker exec <curator> python -m app.backfill_null_dates --apply    # write
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime

from sqlalchemy import select, update

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventStatus, PostRaw
from app.pipeline.detector import detect_event
from app.pipeline.enricher import enrich_event

# Статусы, которые где-то показываются (rejected не трогаем).
LIVE_STATUSES = (EventStatus.approved, EventStatus.manual_review, EventStatus.pending)


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="записать (по умолчанию dry-run)")
    ap.add_argument("--limit", type=int, default=None, help="ограничить число строк (debug)")
    args = ap.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = derived = future = past = 0
    updates: list[tuple[int, datetime | None, datetime | None]] = []
    async with session_scope(sf) as s:
        stmt = (
            select(
                EventCurated.id, PostRaw.text,
                PostRaw.published_at, PostRaw.fetched_at, EventCurated.created_at,
            )
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .where(EventCurated.status.in_(LIVE_STATUSES))
            .where(EventCurated.event_time.is_(None))
            .where(EventCurated.event_time_end.is_(None))
            .order_by(EventCurated.id)
        )
        if args.limit:
            stmt = stmt.limit(args.limit)
        rows = (await s.execute(stmt)).all()
        now = datetime.utcnow()
        for eid, text, pub, fet, cre in rows:
            scanned += 1
            # База = время поста: разрешение «ближайшего года» ключуется от даты
            # публикации, не от «сейчас».
            base = pub or fet or cre
            det = detect_event(text or "")
            enr = enrich_event(text or "", det.hits, published_at=base)
            if enr.event_time is None:
                continue
            derived += 1
            is_future = enr.event_time >= now
            future += int(is_future)
            past += int(not is_future)
            updates.append((eid, enr.event_time, enr.event_time_end))
            if derived <= 30:
                one = " ".join((text or "").split())[:50]
                print(
                    f"  id={eid:<6} [{'FUT' if is_future else 'past'}] "
                    f"{enr.event_time:%Y-%m-%d %H:%M}  base={base:%m-%d}  | {one}"
                )

        if args.apply and updates:
            for eid, dt, end in updates:
                await s.execute(
                    update(EventCurated).where(EventCurated.id == eid).values(event_time=dt, event_time_end=end)
                )

    await engine.dispose()
    mode = "APPLIED" if args.apply else "DRY-RUN (no writes)"
    print(
        f"\n[{mode}] scanned={scanned} derived={derived} "
        f"(future={future} past={past}) still_null={scanned - derived}"
    )
    if not args.apply and derived:
        print("Re-run with --apply to write these dates.")


if __name__ == "__main__":
    asyncio.run(main())
