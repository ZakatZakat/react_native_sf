"""Гард розыгрышей: чистые giveaway-посты отсекаются (score 0, reason 'giveaway'),
а реальные события, что вскользь разыгрывают билеты, — остаются."""
from app.pipeline.detector import detect_event, looks_like_giveaway

PURE = [
    "В честь долгожданного выхода Анти-Эдипа разыгрываем один экземпляр с нашим шопером",
    "РАЗЫГРЫВАЕМ 2 БИЛЕТА НА фестиваль MINIMUM POP V, пятый юбилейный",
    "Розыгрыш билета на ASYLUM MOSCOW x BARREL 23 DUBAI 12 сентября в клубе Dex",
    "Вы поедете на New Star Weekend за наш счёт. Разыгрываем путешествия в формате",
    "Giveaway в честь Дня открытых дверей в Scream School 6 сентября",
    "Розыгрыш, который объединяет столицы! Разыгрываем 2 билета на концерт Канье Уэста",
]

REAL = [
    "12 сентября пройдёт Осенний Велофестиваль\nМаршрут: старт у Воробьёвых гор, м. Спортивная",
    "Фестиваль радио Monte Carlo в Аутлете Новая Рига, 6 сентября, ул. Ленина 1",
    "Представляем лайн-ап Monasterio Rave 2026 и по традиции разыгрываем четыре билета",
    "5–6 сентября на Хлебозаводе — фестиваль, а ещё разыгрываем проходки. ул. Новодмитровская",
]


def test_pure_giveaways_flagged():
    for t in PURE:
        assert looks_like_giveaway(t), t
        assert detect_event(t).reasons == ["giveaway"], t


def test_real_events_not_flagged_as_giveaway():
    for t in REAL:
        assert not looks_like_giveaway(t), t
        assert "giveaway" not in detect_event(t).reasons, t
