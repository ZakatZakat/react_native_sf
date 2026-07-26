"""One-off / repeatable: reject already-stored political «запрещёнка».

Новый фильтр (app.pipeline.detector.looks_political) отсекает политические /
антиправительственные посты на ingest'е. Этот бэкофилл прогоняет тот же детектор
по УЖЕ сохранённым живым событиям (approved / manual_review / pending) и переводит
совпадения в rejected — чтобы «запрещёнка», просочившаяся до появления фильтра,
ушла из ленты.

Правит: events_curated.status → rejected, дописывает 'political' в filter_reasons,
и, если есть строка в moderation_queue, помечает её rejected.

Dry-run по умолчанию — пиши --apply, чтобы применить.

    docker exec <curator> python -m app.backfill_reject_political            # preview
    docker exec <curator> python -m app.backfill_reject_political --apply    # write
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime

from sqlalchemy import select

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventStatus, ModerationQueue, PostRaw
from app.pipeline.detector import looks_political

LIVE_STATUSES = (EventStatus.approved, EventStatus.manual_review, EventStatus.pending)
REJECT_REASON = "backfill: political content re-detected"


def _snip(text: str | None) -> str:
    one_line = " ".join((text or "").split())
    return (one_line[:80] + "…") if len(one_line) > 80 else one_line


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry-run)")
    args = parser.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    scanned = 0
    to_reject: list[int] = []
    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(EventCurated.id, EventCurated.status, PostRaw.text)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .where(EventCurated.status.in_(LIVE_STATUSES))
                .order_by(EventCurated.id)
            )
        ).all()

        for eid, status, text in rows:
            scanned += 1
            if not looks_political(text or ""):
                continue
            to_reject.append(eid)
            print(f"  id={eid:<7} REJECT status={status.value} — {_snip(text)}")

        if args.apply and to_reject:
            now = datetime.utcnow()
            for eid in to_reject:
                ev = await s.get(EventCurated, eid)
                if ev is None:
                    continue
                ev.status = EventStatus.rejected
                reasons = list(ev.filter_reasons or [])
                if "political" not in reasons:
                    reasons.append("political")
                ev.filter_reasons = reasons
                mq = await s.get(ModerationQueue, eid)
                if mq is not None:
                    mq.status = EventStatus.rejected
                    mq.reviewed_at = now
                    mq.reject_reason = REJECT_REASON
            await s.flush()

    await engine.dispose()
    mode = "APPLIED" if args.apply else "DRY-RUN (no writes)"
    print(f"\n[{mode}] scanned={scanned} political_rejected={len(to_reject)}")
    if not args.apply and to_reject:
        print("Re-run with --apply to write these changes.")


if __name__ == "__main__":
    asyncio.run(main())
