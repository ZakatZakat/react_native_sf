"""Venue / location_text extraction.

Bug (prod ids 5034/4068, @mosafishka): «Бесплатные кинопоказы в саду им. Баумана …
превращается в кино-театр» → location_text became «театр» (matched inside
«кино-театр»), so an outdoor cinema in a garden read as a theatre venue. Fixes:
a named garden/park is captured and preferred; «кино-театр» no longer yields a
theatre venue.
"""

from datetime import datetime

from app.pipeline.detector import detect_event
from app.pipeline.enricher import enrich_event

BASE = datetime(2026, 7, 29, 12, 0, 0)


def _loc(text: str) -> str | None:
    det = detect_event(text)
    return enrich_event(text, det.hits, published_at=BASE).location_text


def test_kino_teatr_metaphor_is_not_a_theatre_venue():
    # The reported post: garden name wins, «кино-театр» does NOT become «театр».
    text = ("Бесплатные кинопоказы в саду им. Баумана. Уличный экран рядом со "
            "сценой «Ракушка» превращается в кино-театр под открытым небом!")
    got = _loc(text)
    assert got == "саду им. Баумана"
    assert got != "театр"


def test_garden_name_without_space_after_im():
    assert _loc("«КиноСредА» в Саду им.Баумана каждую среду") == "Саду им.Баумана"


def test_named_park_captured():
    assert _loc("Выставка в Парке Горького, вход свободный") == "Парке Горького"


def test_bare_kino_teatr_yields_no_theatre():
    # No garden, just the metaphor → theatre must not be extracted.
    assert _loc("Экран превращается в кино-театр под открытым небом") != "театр"


def test_quoted_institution_name_kept():
    # Bonus: a quoted proper name is kept with the institution word.
    assert _loc("Показ в кинотеатр «Ноябрь» сегодня в 20:00") == "кинотеатр «Ноябрь»"


def test_real_theatre_still_detected():
    # A genuine «театр» (not preceded by кино-) is still a venue.
    assert _loc("Спектакль в театр «Практика» в 19:00") == "театр «Практика»"


def test_garden_does_not_capture_lowercase_noise():
    # The proper name must start with a REAL uppercase letter — a garden word
    # followed by a lowercase word is NOT a venue name («парк своими руками»).
    for text in (
        "Мастер-класс: соберём парк своими руками в 15:00",
        "Экран превращается в кино-театр под небом",
        "у сада на входе встречаемся",
    ):
        got = _loc(text)
        assert got not in {"парк своими", "сада на", "театр"}, text
