"""Extract structured fields (event_time, location, price) from a post."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import dateparser

from app.pipeline import gazetteer
from app.pipeline.detector import RU_MONTHS, DetectionHits


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


# ── Year normalization for absolute dates ──────────────────────────
# A 20YY (four-digit) year written anywhere in the snippet is trusted as-is.
_YEAR_RE: re.Pattern[str] = re.compile(r"\b20\d{2}\b")
# A numeric date's two-digit year: «15.05.26» / «16.7.26» (day.month.YY). The
# negative lookahead keeps a four-digit year («15.05.2026») from matching.
_DDMMYY_RE: re.Pattern[str] = re.compile(r"(\b\d{1,2}[./]\d{1,2}[./])(\d{2})(?!\d)")
_FAR_FUTURE_DAYS = 730


def _expand_two_digit_year(snippet: str | None) -> str | None:
    """Rewrite a numeric date's two-digit year to 20YY.

    dateparser reads «15.05.26» as the year 2126 (it prefixes the *current*
    century's «21»), not 2026. Every event here is in the 2000s, so expand
    «26» → «2026» before parsing."""
    if not snippet:
        return snippet
    return _DDMMYY_RE.sub(lambda m: f"{m.group(1)}20{m.group(2)}", snippet)


# Числовой месяц → русское слово (родит. падеж) для нормализации голого «DD.MM».
_MONTHS_GEN: tuple[str, ...] = (
    "", "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
)
# Голый «DD.MM» без года. Отрицательный lookahead исключает «DD.MM.YYYY».
_BARE_DDMM_RE: re.Pattern[str] = re.compile(r"\b(\d{1,2})[./](\d{1,2})\b(?![./]\d)")


def _numeric_ddmm_to_words(snippet: str | None) -> str | None:
    """«23.07» → «23 июля». dateparser читает голый «DD.MM» как ВРЕМЯ (23:07), а
    «DD.MM HH:MM» вообще не парсит — тогда как «DD <месяц> HH:MM» разбирается
    верно. Трогаем только даты БЕЗ года (с годом dateparser читает как дату)."""
    if not snippet:
        return snippet

    def repl(m: re.Match[str]) -> str:
        day, mon = int(m.group(1)), int(m.group(2))
        if 1 <= day <= 31 and 1 <= mon <= 12:
            return f"{day} {_MONTHS_GEN[mon]}"
        return m.group(0)

    return _BARE_DDMM_RE.sub(repl, snippet)


def _has_explicit_year(snippet: str | None) -> bool:
    """True if the snippet already carries a four-digit (20YY) year."""
    return bool(snippet and _YEAR_RE.search(snippet))


def _resolve_bare_year(dt: datetime | None, base: datetime) -> datetime | None:
    """Pick the calendar year that places (month, day) closest to the post.

    `_parse_dt` uses PREFER_DATES_FROM='future', so a yearless date that already
    passed («4 июля» parsed in late July) is rolled a full year forward — the
    stale event then reads as ~a year away and never expires from the feed's
    `event_time >= now` gate, cluttering the queue with far-future ghosts.

    An announcement sits near its post date, so resolve to the *nearest*
    occurrence instead: a day/month that already passed this year stays this
    year's past date (a one-off event → correctly in the past, drops from the
    feed) while a December post naming a January date still wraps to next
    year."""
    if dt is None:
        return None
    best: datetime | None = None
    for year in (base.year - 1, base.year, base.year + 1):
        try:
            cand = dt.replace(year=year)
        except ValueError:
            continue  # e.g. 29 Feb in a non-leap year
        if best is None or abs(cand - base) < abs(best - base):
            best = cand
    return best if best is not None else dt


def _drop_far_future(dt: datetime | None, base: datetime) -> datetime | None:
    """Backstop: a date landing >2 years ahead is a misparse (a stray number
    read as a year), not a real listing → drop it rather than let a far-future
    ghost sit in the queue."""
    if dt is not None and (dt - base).days > _FAR_FUTURE_DAYS:
        return None
    return dt


# ── Date-range end («19.07 — 01.09», «с 30 мая по 27 сентября», «до 1 сентября») ──
# Exhibitions/festivals run for weeks and state a closing date, but the enricher
# used to keep only the opening date (event_time), leaving event_time_end NULL.
# Once the opening passed, the feed's `event_time >= now OR event_time_end >= now`
# gate — and any «past event» sweep — read the still-running show as finished and
# dropped it. Parse the range's END so an ongoing show stays live to its close.
#
# A single date token: «19 июля[ 2026]» or «19.07[.26]» (mirrors the detector).
_DATE_TOKEN = (
    rf"(?:\d{{1,2}}\s*(?:{'|'.join(RU_MONTHS)})[а-я]*(?:\s+20\d{{2}})?"
    rf"|\d{{1,2}}[./]\d{{1,2}}(?:[./]\d{{2,4}})?)"
)
# «DATE <по|до|—> DATE» — a date on both sides makes the connective unambiguous.
_RANGE_RE: re.Pattern[str] = re.compile(
    rf"({_DATE_TOKEN})\s*(?:[–—-]|по|до)\s*({_DATE_TOKEN})", re.IGNORECASE
)
# «до DATE» with no start — an open-ended «работает до 1 сентября». Restricted to
# «до» (not «по») to avoid false hits like «по 8 адресам».
_END_ONLY_RE: re.Pattern[str] = re.compile(rf"\bдо\s+({_DATE_TOKEN})", re.IGNORECASE)


def _find_end_date_snippet(text: str) -> str | None:
    """The closing date of a range, if the text states one."""
    if (m := _RANGE_RE.search(text)) is not None:
        return m.group(2)
    if (m := _END_ONLY_RE.search(text)) is not None:
        return m.group(1)
    return None


def _build_range_end(text: str, base: datetime) -> datetime | None:
    """Normalized closing date, run through the same pipeline as event_time."""
    snippet = _find_end_date_snippet(text)
    if not snippet:
        return None
    snippet = _expand_two_digit_year(snippet)  # «01.09.26» → «01.09.2026»
    snippet = _numeric_ddmm_to_words(snippet)  # «01.09» → «1 сентября»
    dt = _parse_dt(snippet, base=base)
    if dt is None:
        return None
    if not _has_explicit_year(snippet):
        dt = _resolve_bare_year(dt, base)
    return _drop_far_future(dt, base)


def enrich_event(
    text: str,
    hits: DetectionHits,
    published_at: datetime | None = None,
    channel_handle: str | None = None,
) -> EnrichmentResult:
    # ── Datetime ──
    # An absolute date (DD month / DD.MM[.YY]) carries — or can be resolved to —
    # a year; a relative day («сегодня», «завтра») is anchored to the post and
    # must be left to dateparser untouched.
    has_absolute_date = bool(hits.date)
    date_snippet = hits.date[0] if hits.date else (hits.relative_day[0] if hits.relative_day else None)
    if has_absolute_date:
        date_snippet = _expand_two_digit_year(date_snippet)  # «15.05.26» → «15.05.2026»
        date_snippet = _numeric_ddmm_to_words(date_snippet)  # «23.07» → «23 июля» (иначе dateparser читает как время)
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

    base_dt = published_at or datetime.utcnow()
    # A yearless absolute date → resolve to the nearest sensible year instead of
    # dateparser's blind roll-forward; an explicit 20YY (incl. an expanded
    # two-digit year) is trusted as written.
    if has_absolute_date and not _has_explicit_year(date_snippet):
        event_time = _resolve_bare_year(event_time, base_dt)
        event_time_end = _resolve_bare_year(event_time_end, base_dt)
    event_time = _drop_far_future(event_time, base_dt)
    event_time_end = _drop_far_future(event_time_end, base_dt)

    # A multi-day range («19.07 — 01.09», «до 1 сентября») → closing date. Only
    # when a same-day time-range hasn't already set an end, and only if it's not
    # before the start (a mis-paired date is dropped rather than trusted).
    if event_time_end is None:
        range_end = _build_range_end(text, base_dt)
        if range_end is not None and (event_time is None or range_end >= event_time):
            event_time_end = range_end

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
