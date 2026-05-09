"""Extract structured fields (event_time, location, price) from a post."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import dateparser

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


def enrich_event(text: str, hits: DetectionHits, published_at: datetime | None = None) -> EnrichmentResult:
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

    # ── Location ──
    location_text: str | None = None
    if hits.venues:
        # Prefer specific (metro/street) over institution; first hit usually best
        location_text = hits.venues[0][:255]

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
        price_text=price_text,
        price_kopecks=price_kopecks,
    )
