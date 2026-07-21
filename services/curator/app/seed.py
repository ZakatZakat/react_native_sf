"""Initial taxonomy. Mirrors what was in frontend's preferences.ts INTERESTS,
but lives server-side so backend can rank/filter independently."""

from __future__ import annotations

INITIAL_TAGS: list[dict] = [
    {
        "key": "contemporary", "label": "Современное искусство", "symbol": "◤", "sort_order": 1,
        "keywords": [
            "совр", "contemporary", "художни", "художниц", "куратор",
            "арт-объект", "арт-проект", "видеоискусств",
            "авангард", "неоавангард", "концептуал", "минимализм",
            "резиденц", "мастерская художни",
        ],
    },
    {
        "key": "cinema", "label": "Кино", "symbol": "▶", "sort_order": 2,
        "keywords": [
            "кино", "фильм", "кинопоказ", "кинопрограмм", "кинокритик", "киноцикл",
            "киновед", "видеоискусств", "показ", "просмотр", "screening", "режис",
            "cinema", "док", "q&a", "комеди", "триллер", "сценарист",
        ],
    },
    {
        "key": "theatre", "label": "Театр", "symbol": "◐", "sort_order": 3,
        "keywords": ["театр", "спектакл", "пьес", "постановк", "сцена ", "сцены ", "режисс"],
    },
    {
        "key": "performance", "label": "Перформанс", "symbol": "◆", "sort_order": 4,
        "keywords": [
            "перформ", "performance", "акци", "хеппенинг", "процесс",
            "перформанс-наблюден", "аудиальн", "звуков ландшафт", "хореограф",
        ],
    },
    {
        "key": "exhibition", "label": "Выставки", "symbol": "▢", "sort_order": 5,
        "keywords": [
            "выстав", "галере", "экспоз", "биенналь", "вернисаж",
            "инсталляц", "экспонат", "архив", "медиаархив",
            "коллекци", "тур по экспозиции", "медиаци",
        ],
    },
    {
        "key": "literature", "label": "Литература", "symbol": "▤", "sort_order": 6,
        "keywords": [
            "литер", "книг", "поэз", "поэт", "поэтес", "поэтическ",
            "стих", "проза", "чтени", "автор", "авторок", "самиздат",
            "лауреат", "роман", "эссе", "презентац книги",
        ],
    },
    {
        "key": "music", "label": "Музыка", "symbol": "♪", "sort_order": 7,
        "keywords": [
            "концерт", "музык", "live", "gig", "оркест", "хор", "опер", "симфон",
            "панк-рок", "джаз", "электрон", "рейв", "rave", "dj", "саундтрек",
            "вечеринк",
        ],
    },
    {
        "key": "dance", "label": "Танец", "symbol": "※", "sort_order": 8,
        "keywords": [
            "танец", "танц", "балет", "хореогр", "contemporary dance",
            "перформанс-наблюден", "движени", "пластик",
        ],
    },
    {
        "key": "photo", "label": "Фотография", "symbol": "◳", "sort_order": 9,
        "keywords": ["фото", "photo", "снимк", "репортаж", "фотовыставк", "фотограф"],
    },
    {
        "key": "architecture", "label": "Архитектура", "symbol": "▲", "sort_order": 10,
        # tightened: dropped geo-generic words (город/пространств/парк/дом/петербург)
        # that matched ~half of all events — kept architecture-specific terms.
        "keywords": [
            "архитект", "урбан", "здани", "вднх", "наркомфин",
            "зодчеств", "особняк", "конструктивизм",
        ],
    },
    {
        "key": "design", "label": "Дизайн", "symbol": "◎", "sort_order": 11,
        "keywords": [
            "дизайн", "график", "плакат", "иллюстр", "design", "тип",
            "зин", "коллаж", "книга художни", "шрифт", "верстк",
        ],
    },
    {
        "key": "talks", "label": "Лекции", "symbol": "¶", "sort_order": 12,
        # dropped over-broad «встреч»/«беседа»/«обсужден»/«разбор» (matched any
        # meetup) — kept lecture/seminar/discussion-specific terms.
        "keywords": [
            "лекц", "лектор", "talk", "дискус", "круглый стол", "презентац",
            "семинар", "мастер-класс", "воркшоп", "workshop", "медиаци", "конференц",
        ],
    },
    {
        # Games + community gatherings + markets — social events with no arts
        # home among the 11 arts coarse (мафия, настолки, квизы, нетворкинг,
        # разговорные клубы, спид-дейтинг, маркеты/свопы). Kept keywords narrow
        # so they don't bleed into arts events.
        "key": "community", "label": "Игры и сообщество", "symbol": "▦", "sort_order": 13,
        "keywords": [
            "настольн", "настолк", "мафия", "ролев", "квиз", "квест", "игротек",
            "board game", "нетворкинг", "networking", "спид-дейтинг",
            "разговорн клуб", "разговорный клуб", "сходка",
            "маркет", "барахолк", "фримаркет", "блошин", "своп ",
        ],
    },
]
