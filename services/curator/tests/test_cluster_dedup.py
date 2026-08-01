"""Семантические склейки кросс-постов в cluster() — проход A (venue+день) и
проход B (день+точное время + разные каналы + общее имя в кавычках).

Регресс на прод-кейсы, что токен-оверлап (0.85) не брал из-за разных
постеров/текста: «Солянка Гиг Фест» и «Театр Вкуса» (id 5780/6007)."""

from datetime import datetime

from app.ranking import cluster, _Row

D_1830 = datetime(2026, 7, 31, 18, 30)
D_NOON = datetime(2026, 7, 31, 12, 0)
D_2000 = datetime(2026, 7, 31, 20, 0)


def _mk(id, descr, channel, dt, title="", venue=None, media_hash=None):
    return _Row(
        id=id, title=title, descr=descr, event_time=dt, event_time_end=None,
        media_hash=media_hash, filter_score=5, channel=channel, message_id=id,
        ctype=None, authority=1.0, venue=venue,
    )


def _sizes(groups):
    return sorted(len(g) for g in groups)


# ── Проход B: кросс-пост одного события, разные постеры/текст, общее имя ──
def test_theatre_vkusa_crosspost_merges():
    # Реальный кейс 5780/6007: 31.07 18:30, разные каналы, «Театр Вкуса»/«Вкуса».
    rows = [
        _mk(5780, "«Театр Вкуса» ассоциируется с чем-то тёплым, как лето у бабушки", "damuseum_garden", D_1830),
        _mk(6007, "Театр «Вкуса» выступит бесплатно на фестивале «Русский КоТ» в саду", "freeartnewsletter", D_1830),
    ]
    groups = cluster(rows)
    assert len(groups) == 1, _sizes(groups)


def test_pass_b_needs_exact_same_time():
    # То же имя, разные каналы, но РАЗНОЕ время → не склеиваем (могут быть 2 показа).
    rows = [
        _mk(1, "«Театр Вкуса» спектакль дневной", "chanA", D_NOON),
        _mk(2, "Театр «Вкуса» спектакль вечерний", "chanB", D_2000),
    ]
    assert len(cluster(rows)) == 2


def test_pass_b_needs_different_channels():
    # Одна площадка, одно время, но РАЗНЫЕ имена в кавычках → 2 разных события.
    rows = [
        _mk(1, "Концерт «Джаз Вечер» на сцене", "sameclub", D_2000),
        _mk(2, "Вечеринка «Рок Ночь» на сцене", "sameclub", D_2000),
    ]
    assert len(cluster(rows)) == 2


def test_pass_b_precision_diff_quotes_same_time():
    # Разные каналы, одно время, но РАЗНЫЕ имена → НЕ склеиваем (защита от over-merge).
    rows = [
        _mk(1, "Концерт «Джаз Вечер» большой", "chanA", D_2000),
        _mk(2, "Спектакль «Рок Ночь» премьера", "chanB", D_2000),
    ]
    assert len(cluster(rows)) == 2


def test_pass_b_ignores_midnight_allday():
    # Время 00:00 (all-day/выставка) — проход B по времени НЕ склеивает: имена в
    # разных кавычках (containment), базовый ключ их не берёт, а полночь исключена.
    midnight = datetime(2026, 8, 1, 0, 0)
    rows = [
        _mk(1, "«Театр Вкуса» большая выставка", "chanA", midnight),
        _mk(2, "Театр «Вкуса» иная выставка", "chanB", midnight),
    ]
    assert len(cluster(rows)) == 2


# ── Проход A: одна площадка (venue) + день + похожий текст (overlap≥0.5) ──
def test_pass_a_venue_lowers_threshold():
    # overlap титулов ~0.75 (<0.85 базового) — базой НЕ склеится, а с общим venue склеится.
    a = _mk(1, "детали", "chanA", D_NOON, title="выставка мозаика цветы лето", venue="ges2")
    b = _mk(2, "иное", "chanB", D_NOON, title="выставка мозаика цветы весна", venue="ges2")
    assert len(cluster([a, b])) == 1


def test_pass_a_no_venue_stays_split():
    # Тот же ~0.75 overlap, но БЕЗ venue → база (0.85) не берёт, проход A выключен → 2.
    a = _mk(1, "детали", "chanA", D_NOON, title="выставка мозаика цветы лето")
    b = _mk(2, "иное", "chanB", D_NOON, title="выставка мозаика цветы весна")
    assert len(cluster([a, b])) == 2


def test_pass_a_precision_diff_events_same_venue():
    # Одна площадка+день, но РАЗНЫЕ события (overlap 0) → НЕ склеиваем.
    a = _mk(1, "детали", "chanA", D_NOON, title="выставка мозаика цветы лето", venue="ges2")
    b = _mk(2, "иное", "chanB", D_2000, title="концерт джаз квартет вечер", venue="ges2")
    assert len(cluster([a, b])) == 2
