"""Venue-default for cinema-venue channels (apply_cinema_venue_default).

Bug (prod id 5332, «Особняк Кости» на Бульваре Рокоссовского): a film-club post
describing the films (composer, plot, discussion) matched «академическая музыка»,
«лекция», «литература» by keyword. cinema is coarse (hidden from chips), so the
visible chip became «академическая музыка» — a cinema night read as classical
music. For a cinema-venue channel with a cinema signal we keep ONLY cinema-domain
tags and guarantee cinema+киноклуб.
"""

from app.models import Tag
from app.pipeline.classifier import (
    TagAssignment,
    apply_cinema_venue_default,
)

# Minimal tag universe (only .id/.key are read by the helper).
_TAGS = [
    Tag(id=1, key="cinema", label="Кино", keywords=[]),
    Tag(id=2, key="kinoklub", label="киноклуб", keywords=[]),
    Tag(id=3, key="akademicheskaya-muzyka", label="академическая музыка", keywords=[]),
    Tag(id=4, key="lekciya", label="лекция", keywords=[]),
    Tag(id=5, key="theatre", label="Театр", keywords=[]),
    Tag(id=6, key="music", label="Музыка", keywords=[]),
    Tag(id=7, key="tehno-reyv", label="техно-рейв", keywords=[]),
    Tag(id=8, key="arthaus", label="артхаус", keywords=[]),
]
_BY_KEY = {t.key: t for t in _TAGS}


def _a(*keys: str) -> list[TagAssignment]:
    return [TagAssignment(tag_id=_BY_KEY[k].id, tag_key=k, confidence=0.5) for k in keys]


def _keys(assignments: list[TagAssignment]) -> set[str]:
    return {a.tag_key for a in assignments}


def test_cinema_venue_keeps_only_cinema_domain():
    # The reported case: cinema + академическая музыка + лекция + литература.
    got = apply_cinema_venue_default(
        "@osobnyakkosti", _a("cinema", "akademicheskaya-muzyka", "lekciya"), _TAGS
    )
    assert _keys(got) == {"cinema", "kinoklub"}  # noise dropped, киноклуб added


def test_cinema_venue_preserves_cinema_subgenre():
    got = apply_cinema_venue_default("perfect_days_cinema", _a("cinema", "arthaus", "music"), _TAGS)
    assert _keys(got) == {"cinema", "kinoklub", "arthaus"}  # music dropped, arthaus kept


def test_cinema_venue_forces_cinema_when_only_subgenre_matched():
    # A film post that matched only a sub-genre still gets coarse cinema + киноклуб.
    got = apply_cinema_venue_default("novembercinema", _a("arthaus"), _TAGS)
    assert _keys(got) == {"arthaus", "cinema", "kinoklub"}


def test_mixed_venue_non_cinema_post_untouched():
    # DFF party (no cinema signal) must keep its music tags — gate skips it.
    before = _a("music", "tehno-reyv")
    got = apply_cinema_venue_default("@dffradio", before, _TAGS)
    assert _keys(got) == {"music", "tehno-reyv"}


def test_non_venue_channel_untouched():
    before = _a("cinema", "akademicheskaya-muzyka")
    got = apply_cinema_venue_default("some_random_channel", before, _TAGS)
    assert _keys(got) == {"cinema", "akademicheskaya-muzyka"}
