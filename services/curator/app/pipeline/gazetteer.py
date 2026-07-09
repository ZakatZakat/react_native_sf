"""Venue gazetteer — building-precise coordinates for known Moscow venues.

Автогеокод события до адреса ЗДАНИЯ (issue #2), без внешних геокодеров и
API-ключей: координаты каждой площадки выверены вручную до её здания
(rooftop-уровень), поэтому матч сразу даёт точную точку для карты.

Два пути матча, per-event первым:
  1) НАЗВАНИЕ/алиас площадки, найденное в тексте поста или в извлечённом
     location_text → конкретная площадка, о которой пост (перекрывает канал).
     Ловит агрегаторы, которые называют известную площадку в тексте.
  2) HANDLE канала-источника → дефолтная локация этой площадки (канал
     площадки почти всегда постит про своё же здание).

Расширять по мере появления новых площадок: добавить запись в VENUES с
handle и/или отличительными алиасами. Алиасы должны быть достаточно
уникальными, чтобы не ловить ложные срабатывания (не «фабрика», а
«цти фабрика»).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class Venue:
    key: str
    lat: float
    lng: float
    handles: tuple[str, ...] = ()
    aliases: tuple[str, ...] = ()
    # normalized aliases, filled in __post_init__ (frozen → object.__setattr__)
    norm_aliases: tuple[str, ...] = field(default=(), compare=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "norm_aliases", tuple(_norm(a) for a in self.aliases))
        object.__setattr__(self, "handles", tuple(h.lower() for h in self.handles))


def _norm(s: str) -> str:
    """Lowercase, ё→е, strip punctuation to single spaces — for word-ish matching."""
    s = s.lower().replace("ё", "е")
    return re.sub(r"\s+", " ", re.sub(r"[^0-9a-zа-я ]+", " ", s)).strip()


# Выверенные вручную площадки (координаты — до здания). Волны geo_channels 1–3.
VENUES: tuple[Venue, ...] = (
    Venue("ges2", 55.7407, 37.6107, ("@vacges2",),
          ("гэс-2", "ges-2", "дом культуры гэс 2", "болотная набережная 15")),
    Venue("garage", 55.7287, 37.6017, ("@garagemca",),
          ("музей гараж", "garage museum", "крымский вал 9")),
    Venue("mmoma", 55.7669, 37.6147, ("@mmoma",),
          ("mmoma", "ммома", "московский музей современного искусства", "петровка 25")),
    Venue("rodchenko", 55.7818, 37.6680, ("@rodchenkoartschool",),
          ("школа родченко", "rodchenko")),
    Venue("zverev", 55.7720, 37.6840, ("@zverevcenter",),
          ("зверевский центр", "новорязанская 29")),
    Venue("fabrika", 55.7805, 37.6720, ("@cci_fabrika",),
          ("цти фабрика", "переведеновский 18")),
    Venue("nekrasovka", 55.7710, 37.6790, ("@nekrasovkalibrary",),
          ("некрасовка", "библиотека некрасова")),
    Venue("zotov", 55.7770, 37.5540, ("@centrezotov",),
          ("центр зотов", "зотов", "ходынская 2")),
    Venue("pokrovka27", 55.7600, 37.6470, ("@pokrovka27",),
          ("покровские ворота", "покровка 27")),
    Venue("stoyania", 55.7565, 37.6440, ("@stoyania",),
          ("хохловские стояния", "хохловский переулок")),
    Venue("rgbm", 55.7960, 37.7150, ("@rgubru",),
          ("ргбм", "библиотека для молодежи", "черкизовская 4")),
    Venue("kholmy", 55.7380, 37.6450, ("@kholmygallery",),
          ("краснохолмская галерея", "галерея краснохолмская")),
    Venue("jaoda", 55.7540, 37.6330, ("@jao_da_official",),
          ("джао да", "jao da")),
    Venue("tsaritsyno", 55.6157, 37.6869, ("@tsaritsyno_museum",),
          ("царицыно", "дольская 1")),
    Venue("vdnh", 55.8264, 37.6377, ("@vdnh_moscow",),
          ("вднх",)),
    Venue("jewish", 55.7935, 37.6045, ("@jewishmuseum",),
          ("еврейский музей", "музей толерантности", "образцова 11")),
    Venue("a3", 55.7476, 37.5936, ("@a3gallery",),
          ("галерея а3", "староконюшенный")),
    Venue("openklub", 55.7594, 37.5946, ("@openklub",),
          ("открытый клуб", "спиридоновка 9")),
    Venue("stradarium", 55.7700, 37.6810, ("@stradarium1",),
          ("страдариум",)),
    # channel-only (нет надёжного текстового алиаса — геокодим по своему каналу)
    Venue("random_culture", 55.7479, 37.5837, ("@random_culture",)),
    Venue("mo_yeti", 55.7820, 37.7055, ("@mo_yeti",)),
    Venue("splyu", 55.7870, 37.4480, ("@splyuivizhuu",)),
    Venue("bestiarii", 55.7320, 37.6647, ("@ago_shvd_shtil_bestiarii",)),
)


def geocode(
    *,
    text: Optional[str],
    location_text: Optional[str] = None,
    channel_handle: Optional[str] = None,
) -> Optional[dict]:
    """Building-precise geo for an event, or None if no known venue matched.

    Returns {"lat", "lng", "source", "venue"}. Per-event venue name in the
    post wins over the channel default.
    """
    # 1) per-event: venue named in the extracted location or the post body
    hay = _norm(" ".join(p for p in (location_text, text) if p))
    if hay:
        padded = f" {hay} "
        for v in VENUES:
            for a in v.norm_aliases:
                if a and f" {a} " in padded:
                    return {"lat": v.lat, "lng": v.lng, "source": "gazetteer", "venue": v.key}

    # 2) channel default — a venue channel posts about its own building
    if channel_handle:
        h = channel_handle.lower()
        if not h.startswith("@"):
            h = "@" + h
        for v in VENUES:
            if h in v.handles:
                return {"lat": v.lat, "lng": v.lng, "source": "gazetteer-channel", "venue": v.key}

    return None
