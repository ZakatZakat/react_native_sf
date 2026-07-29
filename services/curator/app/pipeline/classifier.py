"""Keyword-based classifier. Returns tag IDs with confidence."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import Tag


@dataclass
class TagAssignment:
    tag_id: int
    tag_key: str
    confidence: float  # 0..1


class KeywordClassifier:
    def classify(self, text: str, tags: list[Tag]) -> list[TagAssignment]:
        if not text or not tags:
            return []
        tl = text.lower()
        out: list[TagAssignment] = []
        for tag in tags:
            kws = [kw.lower() for kw in (tag.keywords or [])]
            if not kws:
                continue
            hits = sum(1 for kw in kws if kw in tl)
            if hits == 0:
                continue
            # Confidence: 0.4 floor + (matches / total_keywords) * 0.6, capped at 1.0
            conf = min(1.0, 0.4 + (hits / max(1, len(kws))) * 0.6)
            out.append(TagAssignment(tag_id=tag.id, tag_key=tag.key, confidence=round(conf, 3)))
        return out


# ── Venue-default: alt-venue cinemas ─────────────────────────────────────
# Каналы-площадки, где кино идёт в баре/кафе/инди-точке: КАЖДЫЙ их пост — показ,
# а не лекция. На их литературных киноанонсах keyword-классификатор течёт в
# «лекция»/«театр» (мягкие фразы «поговорим о», «разберём») и не ловит «киноклуб»
# (у него точная подстрока «смотрим фильм»). Поэтому метим по каналу-источнику,
# не завися от текста. Handle хранится без «@».
CINEMA_VENUE_CHANNELS: frozenset[str] = frozenset({
    "vspyshkafriends",    # Друзья Вспышки (кофейня «Вспышка»)
    "neuroticlub",        # невротик (бар)
    "novembercinema",     # Кинотеатр «Ноябрь» (инди-кинотеатр)
    "kinoclub_verticals",  # Киноклуб «Вертикали»
})
# Для этих каналов (когда пост реально про кино) гарантируем cinema+киноклуб и
# снимаем ложные лекция/театр.
_CINEMA_FORCE: tuple[tuple[str, float], ...] = (("cinema", 0.95), ("kinoklub", 0.9))
_CINEMA_STRIP: frozenset[str] = frozenset({"lekciya", "theatre"})
# Киносигнал: coarse «cinema» или любой fine-тег кино-домена (sort_order 100-116).
_CINEMA_FAMILY: frozenset[str] = frozenset({
    "cinema", "arthaus", "dokumentalnoe-kino", "animaciya", "kinoklub",
    "retrospektiva", "nemoe-kino", "eksperimentalnoe-kino", "kinofestival",
    "horror", "kultovoe-kino", "kinolektoriy", "plenochnyy-pokaz",
    "etnograficheskoe-kino", "kino-o-telesnosti", "press-pokaz",
})


def apply_cinema_venue_default(
    handle: str, assignments: list[TagAssignment], tags: list[Tag]
) -> list[TagAssignment]:
    """Для alt-venue кино-каналов И только если пост реально про кино: выбросить
    ложные лекция/театр (течёт из keyword-матча) и гарантировать cinema+киноклуб.
    Гейт по киносигналу важен для смешанных площадок (Невротик = бар: кино +
    настоящие лекции + вечеринки) — иначе форс исказил бы не-кино события. Для
    прочих каналов / постов без киносигнала — no-op."""
    h = (handle or "").lstrip("@").lower()
    if h not in CINEMA_VENUE_CHANNELS:
        return assignments
    keys = {a.tag_key for a in assignments}
    if keys.isdisjoint(_CINEMA_FAMILY):
        return assignments  # не кино (лекция/вечеринка на смешанной площадке)
    by_key = {t.key: t for t in tags}
    kept = [a for a in assignments if a.tag_key not in _CINEMA_STRIP]
    have = {a.tag_key for a in kept}
    for key, conf in _CINEMA_FORCE:
        if key not in have and (t := by_key.get(key)) is not None:
            kept.append(TagAssignment(tag_id=t.id, tag_key=key, confidence=conf))
    return kept
