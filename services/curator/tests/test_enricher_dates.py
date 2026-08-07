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
    _strip_ordinal,
    enrich_event,
)


# A post published in late July 2026 — the window the prod symptoms came from.
JUL_2026 = datetime(2026, 7, 22, 12, 0, 0)   # Wednesday
JUL29_2026 = datetime(2026, 7, 29, 8, 0, 0)  # Wednesday — coming Saturday = 1 Aug


def _event_date(text: str, base: datetime) -> str | None:
    """Run the real detector + enricher and return event_time as YYYY-MM-DD."""
    det = detect_event(text)
    enr = enrich_event(text, det.hits, published_at=base)
    return enr.event_time.strftime("%Y-%m-%d") if enr.event_time else None


def _event_end_date(text: str, base: datetime) -> str | None:
    """Run the real detector + enricher and return event_time_end as YYYY-MM-DD."""
    det = detect_event(text)
    enr = enrich_event(text, det.hits, published_at=base)
    return enr.event_time_end.strftime("%Y-%m-%d") if enr.event_time_end else None


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


# ── Date-range END extraction (exhibitions run for weeks) ──────────
# The bug: only the opening date was kept, so once it passed the still-running
# show read as finished and dropped from the feed (prod: Studio 54, id=3258).
@pytest.mark.parametrize(
    "label, text, base, start, end",
    [
        # numeric range with em-dash — the real Studio 54 poster form
        ("19.07 — 01.09", "Studio 54 and Others, выставка 19.07 — 01.09 на Яузской",
         JUL_2026, "2026-07-19", "2026-09-01"),
        # «с DD месяц по DD месяц»
        ("с 30 мая по 27 сентября", "Выставка с 30 мая по 27 сентября в галерее",
         JUL_2026, "2026-05-30", "2026-09-27"),
        # numeric two-digit-year range
        ("16.07.26 – 23.08.26", "Фестиваль 16.07.26 – 23.08.26 в парке",
         JUL_2026, "2026-07-16", "2026-08-23"),
        # month-name dash range
        ("19 июля — 1 сентября", "Экспозиция 19 июля — 1 сентября, вход свободный",
         JUL_2026, "2026-07-19", "2026-09-01"),
    ],
)
def test_range_end_extracted(label, text, base, start, end):
    assert _event_date(text, base) == start, f"{label} start"
    assert _event_end_date(text, base) == end, f"{label} end"


def test_open_ended_until_date():
    # «до DATE» with no explicit start still yields a closing date so the show
    # stays live until it actually closes.
    assert _event_end_date("Выставка работает до 1 сентября в музее", JUL_2026) == "2026-09-01"


def test_single_date_has_no_range_end():
    # A one-off event (single date, no range) must not invent an end date.
    assert _event_end_date("Концерт 27 сентября в 19:00 в клубе", JUL_2026) is None


def test_same_day_time_range_is_not_a_date_range():
    # «19:00 — 22:00» is a time span within one day, not a multi-day run: the end
    # stays the same calendar day, not mis-read as a date range.
    assert _event_end_date("Лекция 5 августа 19:00 — 22:00 в центре", JUL_2026) == "2026-08-05"


# ── Общий месяц: «с 6 по 16 августа», «15-16 августа» — у СТАРТА своего месяца
# нет (вынесен к концу). Детектор берёт единственной датой конец («16 августа»),
# так что БЕЗ фикса и старт, и end встали бы на 16-е (событие «однодневное»,
# выпадает из «последнего шанса»). Фикс тянет ОБА дня общего месяца.
@pytest.mark.parametrize(
    "label, text, start, end",
    [
        ("с 6 по 16 августа", "Выставка «Под небом Гнесинки» с 6 по 16 августа в зале", "2026-08-06", "2026-08-16"),
        ("15-16 августа", "Фестиваль «Э» 15-16 августа на поляне", "2026-08-15", "2026-08-16"),
        ("7 - 8 августа", "СУПЕРЖАТВА 7 - 8 августа в Суперметалле", "2026-08-07", "2026-08-08"),
        ("20—24 августа", "Ярмарка 20—24 августа в Гостином дворе", "2026-08-20", "2026-08-24"),
        ("с 4 по 14 августа", "НОРА уходит на каникулы с 4 по 14 августа", "2026-08-04", "2026-08-14"),
    ],
)
def test_shared_month_range(label, text, start, end):
    assert _event_date(text, JUL_2026) == start, f"{label} start"
    assert _event_end_date(text, JUL_2026) == end, f"{label} end"


def test_two_dates_with_i_are_not_a_range():
    # «6 и 16 августа» — два дня через «и», НЕ диапазон: end не выдумываем.
    assert _event_end_date("Показы 6 и 16 августа в 19:00 в клубе", JUL_2026) is None


# ── Weekday-as-date («в субботу … 23:00») ──────────────────────────
# The bug (prod id=5567 «SATURDAY NIGHT SHKAF.FM»): posters put the numeric date
# on the image, the text says only «в эту субботу». The enricher ignored the
# detected weekday → event_time fell to the PUBLISH day. Resolve a lone weekday
# (with a clock time, no recurring phrasing) to its next future occurrence.
SHKAF = (
    "SATURDAY NIGHT 🤍SHKAF.FM\n\n"
    "В эту субботу вход на вечеринку Shkaf через бар Стрелка.\n"
    "Начало 23:00, вход свободный 🎰"
)


def test_weekday_resolves_to_next_occurrence():
    # Wed 29 Jul → «в эту субботу … 23:00» = Sat 1 Aug (NOT the publish day).
    assert _event_date(SHKAF, JUL29_2026) == "2026-08-01"


def test_weekday_coming_saturday_from_wednesday():
    assert _event_date("В субботу вечеринка, начало в 22:00", JUL_2026) == "2026-07-25"


def test_weekday_without_time_is_not_dated():
    # No clock time → too weak to date (a weekday in an event NAME must not
    # silently become the event date). Better no date than a wrong one.
    assert _event_date("В субботу большая вечеринка в баре", JUL_2026) is None


# The next two verify the GUARD only: a recurring / multi-weekday mention must
# NOT be turned into a specific weekday date (e.g. next Monday). It falls back to
# the pre-existing bare-time behaviour (publish day at the stated time) — that
# fallback is a separate, broader concern, out of scope for the weekday fix. The
# assertion here is «not a weekday-resolved date», i.e. still the publish day.
def test_recurring_weekday_hours_not_resolved_to_a_weekday():
    # «с понедельника по пятницу … 12:00» = opening hours, not a dated event:
    # must NOT become next Monday (2026-07-27).
    got = _event_date("Открыто с понедельника по пятницу с 12:00 до 19:00", JUL_2026)
    assert got != "2026-07-27"
    assert got == "2026-07-22"  # publish day (bare-time fallback), weekday unused


def test_two_weekdays_not_resolved_to_a_weekday():
    # Two distinct weekdays (a slogan) → must NOT become Fri 24 or Sun 26.
    got = _event_date("Рай — пятница, ад — воскресенье. Экскурсия в 20:00", JUL_2026)
    assert got not in {"2026-07-24", "2026-07-26"}
    assert got == "2026-07-22"  # publish day, weekday unused


def test_numeric_date_wins_over_weekday():
    # An explicit numeric date takes precedence over the weekday word.
    assert _event_date("В субботу 1 августа концерт в 20:00", JUL_2026) == "2026-08-01"


# ── Ordinal numeric dates («1-го августа», «5-е мая») ──────────────
# dateparser can't read «1-го августа»; the detector missed it (no ordinal in the
# regex) → the date fell through. Detect the ordinal, strip the suffix, parse.
def test_ordinal_date_is_parsed():
    assert _event_date("Концерт 1-го августа в 19:00 в клубе", JUL_2026) == "2026-08-01"


def test_ordinal_date_resolves_nearest_year():
    # «5-е мая» seen in July → this year's May (past), not next year.
    assert _event_date("Выставка 5-е мая в 18:00 в галерее", JUL_2026) == "2026-05-05"


@pytest.mark.parametrize(
    "raw, stripped",
    [
        ("1-го августа", "1 августа"),
        ("5-е мая", "5 мая"),
        ("1 августа", "1 августа"),   # no ordinal → untouched
        ("15.05.2026", "15.05.2026"),  # numeric date → untouched
    ],
)
def test_strip_ordinal(raw, stripped):
    assert _strip_ordinal(raw) == stripped


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
