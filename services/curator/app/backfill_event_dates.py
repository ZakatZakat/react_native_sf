"""One-off: repair `event_time` on events whose date was mis-parsed before the
date-normalization fix — the far-future ghosts that clutter manual_review and
hide real (past) events from reports.

Two mis-parse signatures are targeted:
  • a two-digit year read as 21YY («15.05.26» → 2126-…);
  • a yearless date rolled a full year forward instead of resolving to the
    nearest sensible year («28 июня» in July → next year).

For each candidate the original post text + published_at are re-run through the
*fixed* detector/enricher, and event_time / event_time_end are rewritten only
when the freshly-derived value differs. Re-deriving (rather than doing date
arithmetic on the stored value) means the corrected pipeline is the single
source of truth, so a genuine far-future event with an explicit year re-derives
to itself and is left alone.

Dry-run by default — pass --apply to write.

    docker exec <curator> python -m app.backfill_event_dates            # preview
    docker exec <curator> python -m app.backfill_event_dates --apply    # write
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select, update

from app.config import Settings
from app.db import create_engine, create_session_maker, session_scope
from app.models import EventCurated, EventStatus, PostRaw
from app.pipeline.detector import detect_event
from app.pipeline.enricher import enrich_event

# Statuses worth repairing (rejected events surface nowhere, so skip them).
LIVE_STATUSES = (EventStatus.approved, EventStatus.manual_review, EventStatus.pending)
# SQL pre-filter: only obviously-suspect rows — those landing >250 days after
# their OWN post (the roll-forward signature, caught at any absolute year) or in
# the 2100s (two-digit-year misparse). Re-derivation is still authoritative — this
# only limits how many rows we load.
SUSPECT_AFTER_DAYS = 250
FAR_YEAR = datetime(2100, 1, 1)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry-run)")
    parser.add_argument(
        "--null-unparseable",
        action="store_true",
        help="also clear event_time when the fixed pipeline no longer yields a date "
        "(default: leave such rows untouched and only report them)",
    )
    parser.add_argument("--limit", type=int, default=None, help="cap rows scanned (debug)")
    args = parser.parse_args()

    settings = Settings()
    engine = create_engine(settings.postgres_dsn)
    sf = create_session_maker(engine)

    # Post time (published_at, else fetch/creation) — the roll-forward signature
    # is measured against when the post was written, not "now".
    base_col = func.coalesce(PostRaw.published_at, PostRaw.fetched_at, EventCurated.created_at)

    scanned = fixed = unparseable = unchanged = 0
    async with session_scope(sf) as s:
        stmt = (
            select(
                EventCurated.id,
                EventCurated.event_time,
                EventCurated.event_time_end,
                PostRaw.text,
                PostRaw.published_at,
                PostRaw.fetched_at,
                EventCurated.created_at,
            )
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
        if args.limit:
            stmt = stmt.limit(args.limit)
        rows = (await s.execute(stmt)).all()

        updates: list[tuple[int, datetime | None, datetime | None]] = []
        for eid, old_dt, old_end, text, published_at, fetched_at, created_at in rows:
            scanned += 1
            # Base = original post time, so the nearest-year resolution keys off
            # when the post was written, NOT today. Fall back to fetch/creation
            # time when published_at is missing.
            base = published_at or fetched_at or created_at
            det = detect_event(text or "")
            enr = enrich_event(text or "", det.hits, published_at=base)
            new_dt, new_end = enr.event_time, enr.event_time_end

            if new_dt is None and not args.null_unparseable:
                unparseable += 1
                print(f"  id={eid:<7} UNPARSEABLE (kept {_fmt(old_dt)}) — {_snip(text)}")
                continue

            if new_dt == old_dt and new_end == old_end:
                unchanged += 1
                continue

            fixed += 1
            updates.append((eid, new_dt, new_end))
            print(
                f"  id={eid:<7} {_fmt(old_dt)} → {_fmt(new_dt)}"
                f"{'' if old_end == new_end else f'  (end {_fmt(old_end)} → {_fmt(new_end)})'}"
                f"   base={_fmt(base)}  — {_snip(text)}"
            )

        if args.apply and updates:
            for eid, new_dt, new_end in updates:
                await s.execute(
                    update(EventCurated)
                    .where(EventCurated.id == eid)
                    .values(event_time=new_dt, event_time_end=new_end)
                )

    await engine.dispose()
    mode = "APPLIED" if args.apply else "DRY-RUN (no writes)"
    print(
        f"\n[{mode}] scanned={scanned} fixed={fixed} "
        f"unchanged={unchanged} unparseable={unparseable}"
    )
    if not args.apply and fixed:
        print("Re-run with --apply to write these changes.")


def _fmt(dt: datetime | None) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else "—"


def _snip(text: str | None) -> str:
    one_line = " ".join((text or "").split())
    return (one_line[:60] + "…") if len(one_line) > 60 else one_line


if __name__ == "__main__":
    asyncio.run(main())
