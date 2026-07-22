"""One-off: reject stale far-future "ghost" events that the *fixed* detector no
longer recognizes as events at all.

Before the date-normalization fix (and before the digest/out-of-Moscow/non-event
guards existed), the pipeline admitted digests, out-of-town reposts and
application calls as events and rolled their yearless dates a full year forward.
The date backfill (app.backfill_event_dates) re-derived a correct date for
everything that is still a real event; whatever is left with a far-future date is,
by definition, something the current detector rejects. Those rows sit in
manual_review forever as far-future ghosts.

This re-runs detect_event over exactly those far-future rows and, for any the
current detector scores below the review threshold (digest / out_of_moscow /
non_event / no date), flips the event — and its moderation_queue row — to
rejected, mirroring ModerationRepository.reject.

A genuine far-future event with an explicit year still scores as an event and is
left untouched.

Dry-run by default — pass --apply to write.

    docker exec <curator> python -m app.backfill_reject_nonevents            # preview
    docker exec <curator> python -m app.backfill_reject_nonevents --apply    # write
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventStatus, ModerationQueue, PostRaw
from app.pipeline.detector import (
    detect_event,
    looks_like_digest,
    looks_like_non_event,
    looks_out_of_moscow,
)

LIVE_STATUSES = (EventStatus.approved, EventStatus.manual_review, EventStatus.pending)
# Same far-future signature as the date backfill: a real listing is never this far
# after its own post, so anything left here is a legacy mis-parse.
SUSPECT_AFTER_DAYS = 300
FAR_YEAR = datetime(2100, 1, 1)
REJECT_REASON = "backfill: non-event re-detected (%s)"


def _why(text: str) -> str:
    if looks_like_digest(text):
        return "digest"
    if looks_out_of_moscow(text):
        return "out_of_moscow"
    if looks_like_non_event(text):
        return "non_event"
    return "no_date"


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry-run)")
    args = parser.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    base_col = func.coalesce(PostRaw.published_at, PostRaw.fetched_at, EventCurated.created_at)

    scanned = rejected = kept_event = 0
    async with session_scope(sf) as s:
        rows = (
            await s.execute(
                select(EventCurated.id, EventCurated.status, PostRaw.text)
                .join(PostRaw, PostRaw.id == EventCurated.post_id)
                .where(EventCurated.status.in_(LIVE_STATUSES))
                .where(EventCurated.event_time.is_not(None))
                .where(
                    or_(
                        EventCurated.event_time >= FAR_YEAR,
                        EventCurated.event_time > base_col + timedelta(days=SUSPECT_AFTER_DAYS),
                    )
                )
                .order_by(EventCurated.id)
            )
        ).all()

        to_reject: list[tuple[int, str]] = []
        for eid, status, text in rows:
            scanned += 1
            det = detect_event(text or "")
            if det.is_event_review:
                # Still a real event under the fixed rules → leave it alone.
                kept_event += 1
                print(f"  id={eid:<7} KEEP (still scores as event: {det.reasons})")
                continue
            why = _why(text or "")
            to_reject.append((eid, why))
            print(f"  id={eid:<7} REJECT [{why}] status={status.value} — {_snip(text)}")

        if args.apply and to_reject:
            now = datetime.utcnow()
            for eid, why in to_reject:
                ev = await s.get(EventCurated, eid)
                if ev is None:
                    continue
                ev.status = EventStatus.rejected
                mq = await s.get(ModerationQueue, eid)
                if mq is not None:
                    mq.status = EventStatus.rejected
                    mq.reviewed_at = now
                    mq.reject_reason = REJECT_REASON % why
            await s.flush()
        rejected = len(to_reject)

    await engine.dispose()
    mode = "APPLIED" if args.apply else "DRY-RUN (no writes)"
    print(f"\n[{mode}] scanned={scanned} rejected={rejected} kept_as_event={kept_event}")
    if not args.apply and rejected:
        print("Re-run with --apply to write these changes.")


def _snip(text: str | None) -> str:
    one_line = " ".join((text or "").split())
    return (one_line[:60] + "…") if len(one_line) > 60 else one_line


if __name__ == "__main__":
    asyncio.run(main())
