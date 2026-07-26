"""One-off: recover `event_time_end` on multi-day events (exhibitions, festivals)
whose post states a date range but the old enricher kept only the opening date.

Root cause (fixed in `enricher._build_range_end`): a range like «19.07 — 01.09»,
«с 30 мая по 27 сентября» or «до 1 сентября» was parsed only for its START, so
`event_time_end` stayed NULL. Once the opening day passed, the feed's
`event_time >= now OR event_time_end >= now` gate — and any «past event» sweep —
read the still-running show as finished and dropped it (prod: Studio 54, id=3258,
bulk-closed 2026-07-25 though it runs to 01.09).

Two passes, both re-running the *fixed* detector/enricher over the stored post
(the corrected pipeline is the single source of truth):

  1. LIVE events (approved / manual_review / pending) with a start but no end →
     fill event_time_end when a range end is now derivable.
  2. REJECTED events whose reject_reason marks a *past/date* sweep (not a content
     rejection like non_event / out_of_moscow) → if a derived end is still in the
     future, set the end AND restore the event (events_curated + moderation_queue
     back to approved). A row with no derivable future end is left rejected.

Dry-run by default — pass --apply to write.

    docker exec <curator> python -m app.backfill_end_dates            # preview
    docker exec <curator> python -m app.backfill_end_dates --apply    # write
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime

from sqlalchemy import or_, select, update

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventStatus, ModerationQueue, PostRaw
from app.pipeline.detector import detect_event
from app.pipeline.enricher import enrich_event

LIVE_STATUSES = (EventStatus.approved, EventStatus.manual_review, EventStatus.pending)

# reject_reason substrings that mark a date/past sweep (safe to reconsider), as
# opposed to a content rejection (non_event, out_of_moscow, digest — leave those).
REVIVABLE_REASON_SQL = ("%bulk close%", "%past event%", "%past%triage%", "%triage%past%")


def _base_of(pub, fet, cre) -> datetime:
    return pub or fet or cre


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="записать (по умолчанию dry-run)")
    ap.add_argument("--limit", type=int, default=None, help="ограничить число строк (debug)")
    args = ap.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    now = datetime.utcnow()
    filled = 0          # live events that gained an end date
    revived = 0         # wrongly-closed ongoing shows restored
    scanned_live = scanned_rej = 0
    end_updates: list[tuple[int, datetime]] = []      # (id, event_time_end)
    revive: list[tuple[int, datetime]] = []           # (id, event_time_end) + status flip

    async with session_scope(sf) as s:
        # ── Pass 1: live events missing an end date ──
        stmt = (
            select(
                EventCurated.id, EventCurated.event_time, PostRaw.text,
                PostRaw.published_at, PostRaw.fetched_at, EventCurated.created_at,
            )
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .where(EventCurated.status.in_(LIVE_STATUSES))
            .where(EventCurated.event_time_end.is_(None))
            .order_by(EventCurated.id)
        )
        if args.limit:
            stmt = stmt.limit(args.limit)
        for eid, et, text, pub, fet, cre in (await s.execute(stmt)).all():
            scanned_live += 1
            enr = enrich_event(text or "", detect_event(text or "").hits, published_at=_base_of(pub, fet, cre))
            end = enr.event_time_end
            if end is None or (et is not None and end <= et):
                continue
            end_updates.append((eid, end))
            filled += 1
            if filled <= 40:
                one = " ".join((text or "").split())[:50]
                tag = "FUT" if end >= now else "past"
                print(f"  fill id={eid:<6} end={end:%Y-%m-%d} [{tag}] | {one}")

        # ── Pass 2: rejected-as-past events that are actually still running ──
        reason_clause = or_(*[ModerationQueue.reject_reason.ilike(p) for p in REVIVABLE_REASON_SQL])
        stmt = (
            select(
                EventCurated.id, EventCurated.event_time, PostRaw.text,
                PostRaw.published_at, PostRaw.fetched_at, EventCurated.created_at,
                ModerationQueue.reject_reason,
            )
            .join(PostRaw, PostRaw.id == EventCurated.post_id)
            .join(ModerationQueue, ModerationQueue.event_id == EventCurated.id)
            .where(EventCurated.status == EventStatus.rejected)
            .where(reason_clause)
            .order_by(EventCurated.id)
        )
        if args.limit:
            stmt = stmt.limit(args.limit)
        for eid, et, text, pub, fet, cre, reason in (await s.execute(stmt)).all():
            scanned_rej += 1
            enr = enrich_event(text or "", detect_event(text or "").hits, published_at=_base_of(pub, fet, cre))
            end = enr.event_time_end
            # Restore only if the show provably still runs (derived end in future).
            if end is None or end < now or (et is not None and end <= et):
                continue
            revive.append((eid, end))
            revived += 1
            if revived <= 40:
                one = " ".join((text or "").split())[:50]
                print(f"  revive id={eid:<6} end={end:%Y-%m-%d} was='{(reason or '')[:24]}' | {one}")

        if args.apply:
            for eid, end in end_updates:
                await s.execute(
                    update(EventCurated).where(EventCurated.id == eid).values(event_time_end=end)
                )
            for eid, end in revive:
                await s.execute(
                    update(EventCurated)
                    .where(EventCurated.id == eid)
                    .values(event_time_end=end, status=EventStatus.approved)
                )
                await s.execute(
                    update(ModerationQueue)
                    .where(ModerationQueue.event_id == eid)
                    .values(status=EventStatus.approved, reject_reason=None, reviewed_at=now)
                )

    await engine.dispose()
    mode = "APPLIED" if args.apply else "DRY-RUN (no writes)"
    print(
        f"\n[{mode}] pass1 live: scanned={scanned_live} filled_end={filled} | "
        f"pass2 rejected-as-past: scanned={scanned_rej} revived={revived}"
    )
    if not args.apply and (filled or revived):
        print("Re-run with --apply to write.")


if __name__ == "__main__":
    asyncio.run(main())
