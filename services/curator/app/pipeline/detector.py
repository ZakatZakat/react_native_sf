"""Rule-based event detector. Scores text along several signals and returns hits.

Threshold-based gating happens later in the processor:
- score < REVIEW (4)  → rejected
- REVIEW ≤ score < AUTO (6) → manual_review
- score ≥ AUTO (6) → approved
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Pattern


# ── Date patterns ──────────────────────────────────────────────────
RU_MONTHS = (
    "янв", "фев", "мар", "апр", "ма[яй]", "июн", "июл",
    "авг", "сент?", "окт", "нояб?", "дек",
)
DATE_DD_MONTH: Pattern[str] = re.compile(
    rf"\b(\d{{1,2}})\s*(?:{'|'.join(RU_MONTHS)})[а-я]*\b",
    re.IGNORECASE,
)
DATE_DD_MM: Pattern[str] = re.compile(r"\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b")

# Time patterns
TIME_HHMM: Pattern[str] = re.compile(r"\b(\d{1,2}):(\d{2})\b")
TIME_RANGE: Pattern[str] = re.compile(
    r"\b(\d{1,2}):(\d{2})\s*[–\-—]\s*(\d{1,2}):(\d{2})\b"
)
TIME_VERBAL: Pattern[str] = re.compile(
    r"\bв\s+(\d{1,2})(?::(\d{2}))?\s+(?:час|часов|утра|дня|вечера|ночи)\b",
    re.IGNORECASE,
)

# Weekdays
RU_WEEKDAYS = ("понедельник", "вторник", "сред[ау]", "четверг", "пятниц[ау]",
               "суббот[ау]", "воскресень[еяю]")
WEEKDAY: Pattern[str] = re.compile(
    rf"\b(?:в\s+)?(?:эт[уо]\s+|следующ[уеаюй]+\s+|ближайш[уеаюй]+\s+)?({'|'.join(RU_WEEKDAYS)})\b",
    re.IGNORECASE,
)

# Relative
RELATIVE_DAY: Pattern[str] = re.compile(
    r"\b(сегодня|завтра|послезавтра|на\s+этой\s+неделе|на\s+следующей\s+неделе|на\s+выходных)\b",
    re.IGNORECASE,
)

# Venue / location
VENUE_METRO: Pattern[str] = re.compile(
    r"\b(?:м\.|метро)\s*[«»\"\']?[А-ЯЁA-Z][а-яёa-z\-\s]+", re.IGNORECASE
)
VENUE_STREET: Pattern[str] = re.compile(
    r"\b(?:ул(?:ица)?\.?|пр-?т|пр\.|просп\.|пер\.|переулок|бул\.|бульвар|пл\.|площадь|наб\.|набережная|шоссе|ш\.)\s+[«»\"\']?[А-ЯЁA-Z][а-яёa-z\-\s\d]{2,}",
    re.IGNORECASE,
)
VENUE_INSTITUTION: Pattern[str] = re.compile(
    r"\b(?:музе[йяюе]|театр|клуб|центр|галере[яюи]|парк|дом|кинотеатр|библиотек[аеуи]|павильон|пространств[оае]|кафе|бар|ресторан|лофт|холл|аудитори[яюи]|кафедра)\b",
    re.IGNORECASE,
)
VENUE_LINK: Pattern[str] = re.compile(
    r"(?:t\.me/|yandex\.\w+/maps|2gis\.ru|maps\.google|goo\.gl/maps)", re.IGNORECASE
)

# Action / verbs
ACTION_VERBS: Pattern[str] = re.compile(
    r"\b(?:пройдёт|пройдет|состоится|приглашаем|открыти[ея]|начало|начнётся|начнется|стартует|ждём|ждем|устраиваем|организуем|показы|концерт|вечер|спектакль|открытие)\b",
    re.IGNORECASE,
)

# Registration / tickets
REGISTRATION: Pattern[str] = re.compile(
    r"\b(?:регистрац|по\s+(?:предварительной|регистрации)|вход\s+(?:свободн|бесплатн|по\s+билет)|билет|по\s+ссылке|записывайтесь|регистрируйтесь)\b",
    re.IGNORECASE,
)

# ── Digest / roundup detection ─────────────────────────────────────
# Aggregator "week ahead" posts list dozens of events across many days with
# many links. They score high on every event signal, so without a guard they
# auto-approve and show as ONE bogus event. Reject them up front.
URL_RE: Pattern[str] = re.compile(
    r"https?://|t\.me/|instagram\.com|vk\.(?:com|ru)|timepad\.ru|telegra\.ph|teatr\.mos\.ru",
    re.IGNORECASE,
)
ROUNDUP_KW: Pattern[str] = re.compile(
    r"#\s*артобз|#\s*артраспис|#\s*афиш|обзор\s+недел|расписан\w*\s+недел|афиш\w*\s+недел|"
    r"подборк|дайджест|смотрим\s+каналы|продолжение\s+следует|что\s+посетить|"
    r"событи[йя]\s+недел|план\s+на\s+недел",
    re.IGNORECASE,
)


def looks_like_digest(text: str) -> bool:
    """True if the post is a multi-event roundup, not a single event."""
    urls = len(URL_RE.findall(text))
    weekdays = len({w.lower()[:4] for w in WEEKDAY.findall(text)})
    dates = len(DATE_DD_MONTH.findall(text)) + len(DATE_DD_MM.findall(text))
    if ROUNDUP_KW.search(text):
        return True
    if urls >= 5:  # a single event rarely carries 5+ distinct links
        return True
    if weekdays >= 4:  # 4+ different weekdays enumerated = a week plan
        return True
    if weekdays >= 3 and urls >= 3:
        return True
    if dates >= 6 and urls >= 3:
        return True
    return False


@dataclass
class DetectionHits:
    date: list[str] = field(default_factory=list)
    time: list[str] = field(default_factory=list)
    time_range: bool = False
    weekday: list[str] = field(default_factory=list)
    relative_day: list[str] = field(default_factory=list)
    venues: list[str] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)
    registration: bool = False


@dataclass
class DetectionResult:
    score: int
    reasons: list[str]
    hits: DetectionHits

    @property
    def is_event_review(self) -> bool:
        return self.score >= 4

    @property
    def is_event_auto(self) -> bool:
        return self.score >= 6


def detect_event(text: str) -> DetectionResult:
    if not text:
        return DetectionResult(0, [], DetectionHits())

    # Digest / roundup posts (a week's worth of events in one message) score
    # high on every signal — reject before scoring so they never surface as a
    # single event.
    if looks_like_digest(text):
        return DetectionResult(0, ["digest"], DetectionHits())

    hits = DetectionHits()
    score = 0
    reasons: list[str] = []

    # Date — DD month or DD.MM
    m_dm = DATE_DD_MONTH.findall(text)
    m_dd = DATE_DD_MM.findall(text)
    if m_dm or m_dd:
        score += 3
        reasons.append("date")
        for m in DATE_DD_MONTH.finditer(text):
            hits.date.append(m.group(0))
        for m in DATE_DD_MM.finditer(text):
            hits.date.append(m.group(0))

    # Time
    times = TIME_HHMM.findall(text)
    if times:
        score += 2
        reasons.append("time")
        for m in TIME_HHMM.finditer(text):
            hits.time.append(m.group(0))
        if TIME_RANGE.search(text):
            score += 1
            hits.time_range = True
            reasons.append("time_range")
    elif TIME_VERBAL.search(text):
        score += 2
        reasons.append("time_verbal")

    # Weekday
    if (m := WEEKDAY.findall(text)):
        score += 1
        reasons.append("weekday")
        hits.weekday.extend(m)

    # Relative day
    if (rel := RELATIVE_DAY.findall(text)):
        score += 1
        reasons.append("relative_day")
        hits.relative_day.extend(rel)

    # Venue
    venue_score = 0
    if VENUE_METRO.search(text):
        venue_score = 2
        for m in VENUE_METRO.finditer(text):
            hits.venues.append(m.group(0).strip())
    elif VENUE_STREET.search(text):
        venue_score = 2
        for m in VENUE_STREET.finditer(text):
            hits.venues.append(m.group(0).strip())
    elif VENUE_INSTITUTION.search(text):
        venue_score = 1
        for m in VENUE_INSTITUTION.finditer(text):
            hits.venues.append(m.group(0).strip())
    if VENUE_LINK.search(text):
        venue_score = max(venue_score, 1)
    if venue_score:
        score += venue_score
        reasons.append(f"venue:{venue_score}")

    # Action
    if (m := ACTION_VERBS.findall(text)):
        score += 1
        reasons.append("action")
        hits.actions.extend(m)

    # Registration
    if REGISTRATION.search(text):
        score += 1
        reasons.append("registration")
        hits.registration = True

    return DetectionResult(score=score, reasons=reasons, hits=hits)
