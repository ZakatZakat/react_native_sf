"""Date extraction / normalization for curated events.

Regression coverage for three bugs that filled the manual_review queue with
far-future ghosts and hid real (past) events from reports:

  1. A bare (yearless) date rolled a full year *forward* instead of resolving
     to the nearest sensible year — «28 июня» seen in July 2026 became 2027.
  2. A two-digit year «26» parsed as the year 2126 («15.05.26» → 2126-05-15).
  3. An explicit four-digit year in the text was dropped, and the date rolled
     forward anyway («15 июля 2026.» → 2027-07-15).
"""

from datetime import datetime

import pytest

from app.pipeline.detector import detect_event
from app.pipeline.enricher import (
    _drop_far_future,
    _expand_two_digit_year,
    _has_explicit_year,
    _resolve_bare_year,
    enrich_event,
)


# A post published in late July 2026 — the window the prod symptoms came from.
JUL_2026 = datetime(2026, 7, 22, 12, 0, 0)


def _event_date(text: str, base: datetime) -> str | None:
    """Run the real detector + enricher and return event_time as YYYY-MM-DD."""
    det = detect_event(text)
    enr = enrich_event(text, det.hits, published_at=base)
    return enr.event_time.strftime("%Y-%m-%d") if enr.event_time else None


# ── End-to-end: the exact prod symptoms ────────────────────────────
@pytest.mark.parametrize(
    "label, text, base, expected",
    [
        # 1) bare date that already passed → this year's past date, NOT +1 year
        ("id=1672 сегодня, 4 июля", "Сегодня, 4 июля в музее концерт", JUL_2026, "2026-07-04"),
        ("id=616 28 июня", "28 июня приглашаем на спектакль", JUL_2026, "2026-06-28"),
        ("id=877 с 30 мая", "Выставка с 30 мая по 27 сентября в галерее", JUL_2026, "2026-05-30"),
        # 2) two-digit year → 20YY, not 21YY
        ("id=333 15.05.26", "Концерт 15.05.26, вход по билетам", JUL_2026, "2026-05-15"),
        ("id=4246 16.07.26", "Фестиваль 16.07.26 – 23.08.26 в парке", JUL_2026, "2026-07-16"),
        # 3) explicit four-digit year is honoured, not rolled forward
        ("id=3340 15 июля 2026", "Открытие 15 июля 2026. в центре", JUL_2026, "2026-07-15"),
    ],
)
def test_reported_symptoms(label, text, base, expected):
    assert _event_date(text, base) == expected, label


# ── Bare-date year resolution ──────────────────────────────────────
def test_bare_future_date_stays_this_year():
    # A day/month still ahead this year must not be pushed to next year.
    assert _event_date("Концерт 27 сентября в клубе", JUL_2026) == "2026-09-27"


def test_bare_date_wraps_to_next_year_for_december_post():
    # A December post naming a January date should wrap forward, not resolve to
    # this year's long-gone January.
    dec_2026 = datetime(2026, 12, 30, 12, 0, 0)
    assert _event_date("2 января большой концерт в 19:00", dec_2026) == "2027-01-02"


def test_explicit_year_survives_even_when_far_in_past():
    # An explicit past year is respected (it is not a roll-forward artefact).
    assert _event_date("Ретроспектива 10.01.2025 в кинотеатре", JUL_2026) == "2025-01-10"


# ── Relative days are left to dateparser (anchored to the post) ────
def test_relative_day_is_not_year_shifted():
    assert _event_date("Завтра в 19:00 концерт в клубе", JUL_2026) == "2026-07-23"


# ── Helper units ───────────────────────────────────────────────────
@pytest.mark.parametrize(
    "raw, expanded",
    [
        ("15.05.26", "15.05.2026"),
        ("16.7.26", "16.7.2026"),
        ("1/2/27", "1/2/2027"),
        ("15.05.2026", "15.05.2026"),  # already four-digit → untouched
        ("15.05", "15.05"),            # no year → untouched
        ("4 июля", "4 июля"),          # month-name form → untouched
    ],
)
def test_expand_two_digit_year(raw, expanded):
    assert _expand_two_digit_year(raw) == expanded


@pytest.mark.parametrize(
    "snippet, has_year",
    [
        ("15 июля 2026", True),
        ("15.05.2026", True),
        ("15.05.26", False),   # a two-digit year is not four-digit
        ("4 июля", False),
        ("28 июня 1500 ₽", False),  # a price is not a year
    ],
)
def test_has_explicit_year(snippet, has_year):
    assert _has_explicit_year(snippet) is has_year


def test_resolve_bare_year_prefers_nearest_occurrence():
    base = JUL_2026
    # Parsed (yearless) as some arbitrary year; resolution keys off month/day.
    passed = datetime(2099, 6, 28)          # 28 June
    assert _resolve_bare_year(passed, base).year == 2026  # nearest → this year
    ahead = datetime(2099, 9, 27)           # 27 Sept — still ahead this year
    assert _resolve_bare_year(ahead, base).year == 2026


def test_resolve_bare_year_none_passthrough():
    assert _resolve_bare_year(None, JUL_2026) is None


def test_drop_far_future_discards_misparse():
    # >2 years ahead is treated as a stray number read as a year → dropped.
    assert _drop_far_future(datetime(2030, 1, 1), JUL_2026) is None
    # A normal near-term date is kept.
    kept = datetime(2026, 9, 1)
    assert _drop_far_future(kept, JUL_2026) == kept
