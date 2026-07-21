"""Extract structured fields (event_time, location, price) from a post."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import dateparser

from app.pipeline import gazetteer
from app.pipeline.detector import DetectionHits


PRICE_FREE: re.Pattern[str] = re.compile(
    r"(?:вход\s+)?(?:свободн[ыйаяое]+|бесплатн[ыйаяое]+|free)", re.IGNORECASE
)
PRICE_RUB: re.Pattern[str] = re.compile(
    r"(\d[\d\s]{0,7})\s*(?:р\.|руб\.?|₽)", re.IGNORECASE
)


@dataclass
class EnrichmentResult:
    event_time: Optional[datetime]
    event_time_end: Optional[datetime]
    location_text: Optional[str]
    location_meta: Optional[dict]
    price_text: Optional[str]
    price_kopecks: Optional[int]


def _parse_dt(snippet: str, base: datetime | None = None) -> datetime | None:
    """Parse a snippet near `base` date (defaults to now). Direction = future preferred."""
    settings = {
        "PREFER_DATES_FROM": "future",
        "DATE_ORDER": "DMY",
        "RELATIVE_BASE": base or datetime.utcnow(),
    }
    return dateparser.parse(snippet, languages=["ru"], settings=settings)


def _build_dt(date_snippet: str | None, time_snippet: str | None, base: datetime | None) -> datetime | None:
    if not date_snippet and not time_snippet:
        return None
    composed = " ".join(s for s in (date_snippet, time_snippet) if s)
    return _parse_dt(composed, base=base)


def _correct_year_rollover(dt: datetime | None, base: datetime) -> datetime | None:
    """Undo dateparser's year-rollover for bare (yearless) dates.

    `_parse_dt` uses PREFER_DATES_FROM='future', so a yearless date that already
    passed («4 июня» parsed in July) is rolled to NEXT year — the stale event then
    reads as ~a year away and never expires from the feed's `event_time >= now`
    gate. A real event is essentially never announced ~a year ahead with a
    yearless date, so if the parse lands >300 days after the post, treat it as
    that rollover and pull it back a year: the true (past) date then fails the
    feed gate and drops out, instead of masquerading as next year."""
    if dt is None:
        return None
    # Absurdly far future (>~2 years) = a stray number misparsed as a year
    # («2123» from "33 удовольствия"), not a real date → drop it entirely.
    if (dt - base).days > 730:
        return None
    if (dt - base).days > 300:
        try:
            return dt.replace(year=dt.year - 1)
        except ValueError:
            return dt  # Feb 29 → no such day previous year; leave as parsed
    return dt


def enrich_event(
    text: str,
    hits: DetectionHits,
    published_at: datetime | None = None,
    channel_handle: str | None = None,
) -> EnrichmentResult:
    # ── Datetime ──
    date_snippet = hits.date[0] if hits.date else (hits.relative_day[0] if hits.relative_day else None)
    time_snippet = None
    end_time_snippet = None

    if hits.time_range and hits.time:
        # First two times are start/end
        time_snippet = hits.time[0]
        if len(hits.time) >= 2:
            end_time_snippet = hits.time[1]
    elif hits.time:
        time_snippet = hits.time[0]

    event_time = _build_dt(date_snippet, time_snippet, base=published_at)
    event_time_end = (
        _build_dt(date_snippet, end_time_snippet, base=published_at)
        if end_time_snippet else None
    )
    # Undo bare-date year-rollover (see _correct_year_rollover) so stale past
    # dates don't resurface as next-year events.
    base_dt = published_at or datetime.utcnow()
    event_time = _correct_year_rollover(event_time, base_dt)
    event_time_end = _correct_year_rollover(event_time_end, base_dt)

    # ── Location ──
    location_text: str | None = None
    if hits.venues:
        # Prefer specific (metro/street) over institution; first hit usually best
        location_text = hits.venues[0][:255]

    # ── Geo (building-precise, gazetteer — issue #2) ──
    # Venue named in the post wins; else the source channel's own building.
    location_meta = gazetteer.geocode(
        text=text, location_text=location_text, channel_handle=channel_handle
    )

    # ── Price ──
    price_text: str | None = None
    price_kopecks: int | None = None
    if PRICE_FREE.search(text):
        price_text = "вход свободный"
        price_kopecks = 0
    else:
        m = PRICE_RUB.search(text)
        if m:
            try:
                amount = int(re.sub(r"\s", "", m.group(1)))
                price_kopecks = amount * 100
                price_text = f"{amount} ₽"
            except Exception:
                pass

    return EnrichmentResult(
        event_time=event_time,
        event_time_end=event_time_end,
        location_text=location_text,
        location_meta=location_meta,
        price_text=price_text,
        price_kopecks=price_kopecks,
    )
