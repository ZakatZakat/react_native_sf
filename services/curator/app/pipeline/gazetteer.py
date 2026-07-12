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
    # РанДом Культуры — Б. Николопесковский пер., 13 (м. Смоленская)
    Venue("random_culture", 55.750955, 37.589662, ("@random_culture",),
          ("рандом культуры", "большой николопесковский переулок 13", "николопесковский переулок 13")),
    Venue("mo_yeti", 55.7820, 37.7055, ("@mo_yeti",)),
    Venue("splyu", 55.7870, 37.4480, ("@splyuivizhuu",)),
    Venue("bestiarii", 55.7320, 37.6647, ("@ago_shvd_shtil_bestiarii",)),
    # ── Волна 4: авто-извлечение из постов + веб-геокодинг (агенты, 2026-07) ──
    Venue("zorka", 55.70797, 37.54576, (), ("ZORKA", "ZORKA (Zorka Panoramic Terrace & Bar)", "Zorka Panoramic Terrace & Bar",)),
    Venue("dex", 55.71959, 37.68633, (), ("DEX", "Клуб DEX",)),
    Venue("lahesis", 55.76009, 37.64689, (), ("Lachesis Groves", "Лахесис",)),
    Venue("rndm", 55.75002, 37.66524, (), ("RNDM", "RNDM (РанДом)",)),
    Venue("kulturnyy_kvartal_brusni", 59.92277, 30.24943, (), ("Брусницын", "Культурный квартал «Брусницын»",)),
    Venue("fabula_hq", 55.75668, 37.67645, (), ("Fabula HQ", "Fábula (fābula radio)", "fābula HQ",)),
    Venue("prostranstvo_supermetall", 55.76407, 37.68337, (), ("«Суперметалл»", "Пространство «Суперметалл»", "Радио (на Суперметалле)", "Суперметалл",)),
    Venue("kay_kan", 55.76633, 37.62993, (), ("Кай Кан",)),
    Venue("community", 55.74591, 37.63817, (), ("Community", "Community Moscow",)),
    Venue("af_i_if", 55.75485, 37.64541, (), ("AF и IF", "IF + AF",)),
    Venue("depo_tri_vokzala", 55.77273, 37.66335, (), ("Бар «Станция»", "Бар Станция (Депо.Москва, Три вокзала)", "Депо «Три вокзала»", "Депо.Москва", "Три вокзала",)),
    Venue("klub_smena", 55.74153, 37.65998, (), ("«Смена»", "Клуб «Смена»", "Смена", "Смена (Smena)", "Смена 2.0",)),
    Venue("made_in_bali", 55.73255, 37.59978, (), ("Made in Bali",)),
    Venue("klub_ton71", 55.77970, 37.69174, (), ("Тон71", "клуб Тон71",)),
    Venue("biznes_kvartal_arma", 55.75587, 37.61770, (), ("Арма", "Бизнес-квартал «Арма»",)),
    Venue("le_th_l_me", 55.78779, 37.58188, (), ("Île Thélème",)),
    Venue("purba_place", 55.74426, 37.62991, (), ("Purba Place",)),
    Venue("park_serebryanyy_bor", 55.78112, 37.44013, (), ("«Серебряный бор»", "Парк «Серебряный бор»", "Серебряный бор",)),
    Venue("moryak_i_chayka", 55.75923, 37.64565, (), ("Моряк и Чайка",)),
    Venue("boylernaya_hlebozavod_9", 55.80663, 37.58568, (), ("Бойлерная", "Бойлерная (Хлебозавод №9)",)),
    Venue("odzu", 55.76220, 37.55781, (), ("ODZU", "Ресторан ODZU (ЖК Lucky)",)),
    Venue("restoran_nyuans", 55.76335, 37.61576, (), ("Нюанс", "ресторан Нюанс",)),
    Venue("treff8", 55.76270, 37.66121, (), ("TREFF8",)),
    Venue("fond_ruarts", 55.75105, 37.58739, (), ("Ruarts", "Фонд Ruarts",)),
    Venue("mason_st_one", 55.73963, 37.65421, (), ("Mason St.One",)),
    Venue("avtodrom_igora_drayv", 60.51444, 30.19417, (), ("Автодром «Игора Драйв»", "Игора Драйв",)),
    Venue("live_arena", 55.70640, 37.35569, (), ("Live Арена",)),
    Venue("koncertnyy_zal_moskva_os", 55.69393, 37.67376, (), ("Концертный зал «Москва» (Остров Мечты)", "Москва",)),
    Venue("park_300_letiya_sankt_pe", 59.98288, 30.20144, (), ("300-летия Санкт-Петербурга", "Парк 300-летия Санкт-Петербурга",)),
    Venue("kurort_zavidovo", 56.61539, 36.54426, (), ("Курорт Завидово",)),
    Venue("luzhniki", 55.71583, 37.55361, (), ("Лужники",)),
    Venue("cube_moscow_kub", 55.75743, 37.61267, (), ("Cube Moscow (КУБ)", "Cube.Moscow",)),
    Venue("centr_vostochnoy_literat", 55.75027, 37.61059, (), ("Центр восточной литературы (ЦВЛ)", "Центр восточной литературы РГБ (ЦВЛ)", "восточной литературы (ЦВЛ)",)),
    Venue("nevrotik", 55.74951, 37.64511, (), ("Невротик", "клуб «Невротик»",)),
    Venue("vladey_dom_s_atlantami", 55.75241, 37.64039, (), ("VLADEY (Дом с Атлантами)", "VLADEY МУЗЕЙ", "VLADEY Музей (Дом с Атлантами)",)),
    Venue("inzhenernyy_korpus_trety", 55.74099, 37.62112, (), ("Инженерный корпус Третьяковской галереи",)),
    Venue("the_last_bar", 55.75720, 37.63383, (), ("The Last Bar",)),
    Venue("ciferblat", 55.76231, 37.62584, (), ("Циферблат",)),
    Venue("kultura", 55.75924, 37.58026, (), ("Культура",)),
    Venue("soma", 55.76705, 37.62017, (), ("Soma",)),
    Venue("galereya_peresvetov_pere", 55.71478, 37.66158, (), ("«Пересветов переулок»", "Галерея «Пересветов переулок»", "Пересветов переулок",)),
    Venue("sklad_3", 55.78458, 37.70620, (), ("Склад №3",)),
    Venue("billie", 55.76634, 37.62072, (), ("Billie",)),
    Venue("leveldva_dvor", 55.75653, 37.60646, (), ("Leveldva (двор)",)),
    Venue("arma_arma", 55.75913, 37.66754, (), ("ARMA (Арма)",)),
    Venue("ad_marginem", 55.77922, 37.68893, (), ("Ad Marginem",)),
    Venue("kristall", 55.75590, 37.67725, (), ("Кристалл",)),
    Venue("park_gorkogo_pushkinskay", 55.73101, 37.59766, (), ("Горького (Пушкинская набережная)", "Парк Горького (Пушкинская набережная)",)),
    Venue("poklonnaya_gora", 55.73169, 37.50667, (), ("Поклонная гора",)),
    Venue("mamm_multimedia_art_muze", 55.74162, 37.59866, (), ("МАММ (Мультимедиа Арт Музей)", "Мультимедиа-арт-музей (МАММ)",)),
    Venue("severnyy_rechnoy_vokzal", 55.85141, 37.46699, (), ("Северный и Южный речные вокзалы", "Северный речной вокзал",)),
    Venue("dom_sily_powerhouse_mosc", 55.74576, 37.64616, (), ("Дом Силы (Powerhouse Moscow)", "Зангези",)),
    Venue("loft_hall_loft_1", 55.71105, 37.65494, (), ("LOFT HALL (LOFT#1)", "LOFT#1 (LOFT HALL)",)),
    Venue("galereya_na_trubnoy", 55.76835, 37.61869, (), ("Галерея на Трубной", "Трубная галерея (Trubnaya Gallery)", "на Трубной",)),
    Venue("ugol", 55.77354, 37.66980, (), ("КЦ «Угол»", "Угол",)),
    Venue("prostranstvo_bestiariy", 55.74464, 37.56607, (), ("BESTиарий", "«Бестиарий»", "Бестиарий", "Пространство «Бестиарий»",)),
    Venue("yauza", 55.75200, 37.64480, (), ("Yauza", "Яуза",)),
    Venue("rossiyskaya_gosudarstven", 55.75103, 37.60924, (), ("Российская государственная библиотека",)),
    Venue("galereya_hodynka", 55.78849, 37.49217, (), ("«Ходынка»", "Галерея «Ходынка»", "Ходынка",)),
    Venue("kulturnyy_centr_moskvich", 55.70787, 37.73297, (), ("Культурный центр «Москвич»", "Москвич",)),
    Venue("teatr_naciy", 55.76594, 37.61275, (), ("Наций", "Театр Наций",)),
    Venue("amber_plaza", 55.77999, 37.60577, (), ("Амбер Плаза",)),
    Venue("muzey_kriptografii", 55.83069, 37.59742, (), ("Музей криптографии", "криптографии",)),
    Venue("galereya_na_peschanoy", 55.79296, 37.51300, ("@pschgallery",), ("Галерея на Песчаной", "на Песчаной",)),
    Venue("bar_strelka", 55.74245, 37.60931, (), ("«Стрелка»", "Бар «Стрелка»", "Стрелка",)),
    Venue("osobnyak_v_a_lemana", 55.76587, 37.66803, (), ("Особняк В.А. Лемана",)),
    Venue("klubklub", 55.75762, 37.64630, (), ("КлубКлуб",)),
    Venue("klub_dff", 55.74638, 37.64709, (), ("DFF", "Клуб DFF",)),
    Venue("klub_sound", 59.92446, 30.23976, (), ("Sound", "Клуб Sound",)),
    Venue("novaya_scena_aleksandrin", 59.93041, 30.33758, (), ("Новая сцена Александринского театра",)),
    Venue("punk_fiction", 55.77460, 37.67107, (), ("Punk Fiction",)),
    Venue("kinoteatr_chtivo_dom", 55.73625, 37.59410, (), ("Кинотеатр Чтиво (Дом)",)),
    Venue("dom_uryadnika", 56.25076, 37.99793, (), ("Дом Урядника",)),
    Venue("centr_voznesenskogo", 55.73555, 37.62403, (), ("Вознесенского", "Центр Вознесенского",)),
    Venue("galereya_rostokino", 55.83575, 37.65908, (), ("«Ростокино»", "Галерея «Ростокино»", "Ростокино",)),
    Venue("vinzavod", 55.75557, 37.66459, (), ("Винзавод",)),
    Venue("park_pokrovskiy_bereg", 55.83292, 37.47232, (), ("«Покровский берег»", "Покровский берег", "парк «Покровский берег»",)),
    Venue("chert_poberi", 59.92295, 30.34875, (), ("Черт Побери",)),
    Venue("basmannyy_dvor", 55.77572, 37.67771, (), ("Басманный двор",)),
    Venue("kafe_delfin", 59.95830, 30.30224, (), ("Кафе Дельфин",)),
    Venue("rosizo", 55.75679, 37.63662, (), ("РОСИЗО",)),
    Venue("usadba_dolgorukovyh_bobr", 55.75869, 37.59359, (), ("Усадьба Долгоруковых-Бобринских (филиал Ельцин Центра)",)),
    Venue("art_prostranstvo_locus_s", 55.65375, 37.59402, (), ("Арт-пространство Locus Solus",)),
    Venue("park_zaryade_malyy_amfit", 55.75064, 37.63097, (), ("«Зарядье» (Малый амфитеатр)", "Зарядье", "Парк «Зарядье» (Малый амфитеатр)",)),
    Venue("siksseven", 55.79946, 37.58469, (), ("СИКССЕВЕН",)),
    Venue("muzey_russkogo_lubka_i_n", 55.76904, 37.63440, (), ("Музей русского лубка и наивного искусства", "русского лубка и наивного искусства",)),
    Venue("planetariy_1", 59.91153, 30.33094, (), ("Планетарий № 1",)),
    Venue("loft_kompressor", 55.75127, 37.73303, (), ("Компрессор", "Лофт «Компрессор»",)),
    Venue("art_prostranstvo_artemev", 55.75639, 37.60495, (), ("Арт-пространство «Артемьев»", "Артемьев",)),
    Venue("dk_alfa_kristall", 55.75711, 37.67579, (), ("Альфа Кристалл", "ДК «Альфа Кристалл»",)),
    Venue("osobnyak_brusnicynyh", 59.92278, 30.25083, (), ("Особняк Брусницыных",)),
    Venue("park_zaryade", 55.75148, 37.62708, (), ("«Зарядье»", "Зарядье", "Парк «Зарядье»",)),
    Venue("surf_coffee", 55.77257, 37.67879, (), ("Surf Coffee",)),
    Venue("sad_imeni_baumana", 55.76585, 37.66040, (), ("Сад имени Баумана",)),
    Venue("artplay_malyy_vystavochn", 55.75317, 37.66932, (), ("ARTPLAY (Малый выставочный зал)",)),
    Venue("vostochnyy_kulturnyy_cen", 55.76358, 37.62381, (), ("Восточный культурный центр Института востоковедения РАН",)),
    Venue("masterskaya_aacademy19_a", 55.75875, 37.68224, (), ("Мастерская AAcademy19 (AA19)",)),
    Venue("the_spot", 55.78940, 37.53683, (), ("The Spot",)),
    Venue("galereya_vdohnovenie_tc_", 55.69625, 37.66558, (), ("«Вдохновение» (ТЦ «Мегаполис»)", "Вдохновение", "Галерея «Вдохновение» (ТЦ «Мегаполис»)", "Мегаполис",)),
    Venue("bar_rovesnik", 55.76242, 37.60592, (), ("«Ровесник»", "Ровесник", "бар «Ровесник»",)),
    Venue("letnyaya_scena_csi_vinza", 55.75652, 37.66573, (), ("Летняя сцена ЦСИ Винзавод",)),
    Venue("krasnyy_ugol", 59.90699, 30.28494, (), ("Красный угол",)),
    Venue("galereya_na_varshavke", 55.65944, 37.61842, (), ("Галерея на Варшавке", "на Варшавке",)),
    Venue("vladey", 55.75594, 37.66555, (), ("VLADEY",)),
    Venue("galereya_korney", 55.75711, 37.60311, (), ("Галерея Корней", "Корней",)),
    Venue("flagshtok", 59.97061, 30.21268, (), ("Флагшток",)),
    Venue("park_sokolniki", 55.78924, 37.67966, (), ("«Сокольники»", "Парк «Сокольники»", "Сокольники",)),
    Venue("kulturnyy_centr_ugol", 55.77329, 37.66880, (), ("Культурный центр «Угол»", "Угол",)),
    Venue("original", 55.76169, 37.65854, (), (".оригинал",)),
    Venue("orbita", 55.75052, 37.64350, (), ("Орбита",)),
    Venue("dezhurnaya_ryumochnaya", 55.75236, 37.59747, (), ("Дежурная рюмочная",)),
    Venue("galereya_artzip", 55.77055, 37.64162, (), ("АРТЗИП", "Галерея АРТЗИП",)),
    Venue("f_bula_radio", 55.75722, 37.67444, (), ("fābula radio",)),
    Venue("kooperativ_chernyy", 55.75999, 37.65178, (), ("Кооператив Чёрный",)),
    Venue("madame_roche", 55.72828, 37.64675, (), ("Madame Roche",)),
    Venue("teatr_truda", 55.79069, 37.61012, ("@teatrtruda_10",), ("Театр труда", "труда",)),
    Venue("park_iskusstv_muzeon", 55.73464, 37.60577, (), ("Музеон", "Парк искусств «Музеон»", "искусств «Музеон»",)),
    Venue("moskovskiy_soyuz_hudozhn", 55.76206, 37.62199, (), ("Московский Союз художников (МСХ)",)),
    Venue("substance_2_0", 55.73141, 37.60162, (), ("SUBSTANCE 2.0",)),
    Venue("park_patriot", 55.57231, 36.82977, (), ("«Патриот»", "Парк «Патриот»", "Патриот",)),
    Venue("ketch_up", 55.76114, 37.61731, (), ("KETCH UP",)),
    Venue("art_pavilon_letniy_marke", 55.74510, 37.61720, (), ("Арт-павильон «Летний маркет»", "Летний маркет",)),
    Venue("galereya_n1_33", 55.78136, 37.56863, (), ("N1.33", "Галерея N1.33",)),
    Venue("roks", 59.96438, 30.27734, (), ("ROKS",)),
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
