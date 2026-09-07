"""Fetch OSM park polygons for park-type gazetteer venues (regenerates venueParks.ts).

Parks/gardens/estates are open-air AREAS, not buildings — a 3D building extrusion
makes no sense for them, and venueFootprints.py deliberately leaves them as a dot.
This companion pulls their `leisure=park` (/garden/nature_reserve/estate) polygon so
the map can paint the whole park in brand colour instead of a lone dot.

    python3 -m app.fetch_parks            # fetch + verify + write venueParks.ts
    python3 -m app.fetch_parks --dry      # fetch + print the verification table only

Selection is verification-first (same ethos as fetch_footprints): a candidate wins on
NAME match to the venue, else the containing polygon in a sane park area-range; every
choice is printed (venue → park name, area, contains?) so a wrong polygon is obvious
before it ships. Relations (multipolygon parks) get their outer ring stitched — a
park's boundary is usually split across many member ways.
"""

from __future__ import annotations

import json
import math
import re
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAZ = HERE / "pipeline" / "gazetteer.py"
SRC_DIR = HERE.parent.parent.parent / "src" / "pages" / "cs"
VENUES_TS = SRC_DIR / "venues.ts"
PARKS_TS = SRC_DIR / "venueParks.ts"

OVERPASS_MIRRORS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
UA = "citysignal-parks/1.0 (contact: comradefrunze@gmail.com)"

# Настоящие открытые парки/сады/усадебные территории Москвы, где событие идёт «в
# парке» (а не в конкретном здании). Только эти ключи филлим площадью. Заведения
# ВНУТРИ парка (бары/сцены/залы) остаются точкой/домом — не сюда.
PARK_KEYS: list[str] = [
    "park_iskusstv_muzeon",   # Музеон
    "gorky_park",             # Парк Горького
    "park_sokolniki",         # Сокольники
    "park_zaryade",           # Зарядье
    "poklonnaya_gora",        # Поклонная гора / Парк Победы
    "park_serebryanyy_bor",   # Серебряный Бор
    "sad_imeni_baumana",      # Сад им. Баумана
    "park_pokrovskiy_bereg",  # Покровский берег
    "kuskovo",                # Кусково (усадьба-парк)
    "tsaritsyno",             # Царицыно (музей-заповедник, парк)
    "vdnh",                   # ВДНХ
]

R = 1500  # around-radius (m): parks are large; coord may sit at an entrance

# Родовые слова названий — не считать за именной матч (иначе Музеон ловит «Парк
# Горького» по «парк», а любой сад — соседний по «сад»).
_GENERIC_NAME_TOK = {"парк", "сад", "сквер", "музей", "центр", "усадьба", "площадь",
                     "аллея", "набережная", "лесопарк", "заповедник", "искусств"}


def overpass(query: str) -> list:
    last = None
    for attempt in range(12):
        url = OVERPASS_MIRRORS[attempt % len(OVERPASS_MIRRORS)]
        try:
            req = urllib.request.Request(
                url, data=("data=" + query).encode("utf-8"),
                headers={"User-Agent": UA, "Accept": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)["elements"]
        except Exception as e:  # noqa: BLE001
            last = e
            wait = min(45, 4 * (attempt + 1))
            print(f"[overpass] {url.split('/')[2]} try {attempt+1}: {e!r}; retry {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"overpass failed: {last!r}")


def parse_gazetteer() -> dict:
    src = GAZ.read_text(encoding="utf-8")
    out = {}
    for k, lat, lng in re.findall(r'Venue\(\s*"([a-z0-9_]+)"\s*,\s*([\d.]+)\s*,\s*([\d.]+)', src):
        out[k] = (float(lat), float(lng))
    return out


def venue_names() -> dict:
    src = VENUES_TS.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'^\s{2}([a-z0-9_]+):\s*\{.*?name:\s*"((?:[^"\\]|\\.)*)"', src, re.S | re.M):
        out.setdefault(m.group(1), m.group(2))
    return out


def ring_from_geometry(geom: list) -> list:
    return [[round(p["lon"], 6), round(p["lat"], 6)] for p in geom if p.get("lon") is not None]


def centroid(ring: list):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def point_in_ring(lng: float, lat: float, ring: list) -> bool:
    inside = False; n = len(ring); j = n - 1
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def ring_area_m2(ring: list) -> float:
    if len(ring) < 4:
        return 0.0
    clat = sum(p[1] for p in ring) / len(ring)
    mlat = 111320.0; mlng = 111320.0 * math.cos(math.radians(clat))
    a = 0.0
    for i in range(len(ring) - 1):
        a += (ring[i][0] * mlng) * (ring[i + 1][1] * mlat) - (ring[i + 1][0] * mlng) * (ring[i][1] * mlat)
    return abs(a) / 2.0


def stitch_outer_ring(members: list) -> list:
    """One closed outer ring from a multipolygon relation's members (boundary is
    usually split across many ways). Largest closed ring wins."""
    segs = [ring_from_geometry(m["geometry"]) for m in members
            if m.get("role") in ("outer", "") and m.get("geometry")]
    segs = [s for s in segs if len(s) >= 2]
    rings: list = []
    while segs:
        ring = list(segs.pop(0)); changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for i, s in enumerate(segs):
                if ring[-1] == s[0]:
                    ring += s[1:]
                elif ring[-1] == s[-1]:
                    ring += list(reversed(s))[1:]
                elif ring[0] == s[-1]:
                    ring = s[:-1] + ring
                elif ring[0] == s[0]:
                    ring = list(reversed(s))[:-1] + ring
                else:
                    continue
                segs.pop(i); changed = True; break
        if len(ring) >= 4:
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            rings.append(ring)
    return max(rings, key=ring_area_m2) if rings else []


def _perp(p, a, b) -> float:
    """Perp distance of p from segment a-b in degrees (good enough for RDP)."""
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify(ring: list, tol: float = 6e-5) -> list:
    """Douglas–Peucker so a 400-node park boundary doesn't bloat venueParks.ts.
    tol≈6e-5° ≈ 5–7 m — visually lossless for an area fill. Keeps the ring closed."""
    if len(ring) <= 6:
        return ring
    closed = ring[0] == ring[-1]
    pts = ring[:-1] if closed else ring[:]

    def rdp(seq):
        if len(seq) < 3:
            return seq
        dmax, idx = 0.0, 0
        for i in range(1, len(seq) - 1):
            d = _perp(seq[i], seq[0], seq[-1])
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol:
            return rdp(seq[:idx + 1])[:-1] + rdp(seq[idx:])
        return [seq[0], seq[-1]]

    out = rdp(pts)
    if closed:
        out = out + [out[0]]
    return out if len(out) >= 4 else ring


def fetch_one(key: str, lat: float, lng: float, want_name: str) -> dict | None:
    q = (f"[out:json][timeout:120];("
         f'way(around:{R},{lat},{lng})["leisure"~"^(park|garden|nature_reserve)$"];'
         f'relation(around:{R},{lat},{lng})["leisure"~"^(park|garden|nature_reserve)$"];'
         f'relation(around:{R},{lat},{lng})["boundary"="national_park"];'
         f'relation(around:{R},{lat},{lng})["tourism"="theme_park"];'
         f'relation(around:{R},{lat},{lng})["tourism"="museum"];'  # Музеон = open-air музей-парк
         f");out geom;")
    els = overpass(q)
    cands = []
    wn = (want_name or "").lower().replace("ё", "е")
    for e in els:
        if e["type"] == "way" and e.get("geometry"):
            ring = ring_from_geometry(e["geometry"])
        elif e["type"] == "relation":
            ring = stitch_outer_ring(e.get("members", []))
        else:
            continue
        if len(ring) < 4:
            continue
        t = e.get("tags", {})
        nm = (t.get("name", "") or "").lower().replace("ё", "е")
        # name match on SPECIFIC tokens only — «парк»/«сад»/«музей» и т.п. общие
        # слова дают ложный матч (Музеон ловил «Парк Горького» по слову «парк»).
        toks = [w for w in re.split(r"[^0-9a-zа-я]+", wn)
                if len(w) >= 4 and w not in _GENERIC_NAME_TOK]
        name_hit = any(w in nm for w in toks) if toks else False
        cands.append({
            "id": e["id"], "type": e["type"], "name": t.get("name", ""),
            "leisure": t.get("leisure", "") or t.get("boundary", "") or t.get("tourism", ""),
            "ring": ring, "area_m2": ring_area_m2(ring),
            "contains": point_in_ring(lng, lat, ring), "name_hit": name_hit,
        })
    if not cands:
        return None
    # Rank: полигон, который И содержит точку, И матчит имя — лучший. Затем просто
    # содержащий (верное место даже при родовом имени вроде «Парк Победы»); затем
    # именной матч (площадка у края парка); затем разумная площадь и размер.
    def score(c):
        sane = 5_000 <= c["area_m2"] <= 12_000_000
        return (c["contains"] and c["name_hit"], c["contains"], c["name_hit"], sane, c["area_m2"])
    cands.sort(key=score, reverse=True)
    return cands[0]


def diag(key: str) -> None:
    """Печать ВСЕХ park-кандидатов для одной площадки — понять, почему auto-pick
    выбрал не тот полигон (и есть ли вообще нужный)."""
    gaz = parse_gazetteer()
    names = venue_names()
    if key not in gaz:
        print(f"{key} not in gazetteer"); return
    lat, lng = gaz[key]
    want = names.get(key, "")
    q = (f"[out:json][timeout:120];("
         f'way(around:{R},{lat},{lng})["leisure"~"^(park|garden|nature_reserve)$"];'
         f'relation(around:{R},{lat},{lng})["leisure"~"^(park|garden|nature_reserve)$"];'
         f'relation(around:{R},{lat},{lng})["boundary"="national_park"];'
         f'relation(around:{R},{lat},{lng})["tourism"="theme_park"];'
         f'relation(around:{R},{lat},{lng})["tourism"="museum"];'  # Музеон = open-air музей-парк
         f");out geom;")
    els = overpass(q)
    print(f"{key}  coord={lat},{lng}  name='{want}'  ({len(els)} elements)")
    rows = []
    for e in els:
        ring = ring_from_geometry(e["geometry"]) if e["type"] == "way" and e.get("geometry") else (
            stitch_outer_ring(e.get("members", [])) if e["type"] == "relation" else [])
        t = e.get("tags", {})
        rows.append((round(ring_area_m2(ring) / 1e6, 3) if len(ring) >= 4 else 0,
                     point_in_ring(lng, lat, ring) if len(ring) >= 4 else False,
                     e["type"], e["id"], t.get("name", "")[:40], t.get("leisure", "") or t.get("boundary", "") or t.get("tourism", ""), len(ring)))
    for area, cont, typ, oid, nm, leis, npts in sorted(rows, reverse=True):
        print(f"  {area:7.3f}km²  {'IN ' if cont else '   '} {typ[:3]} {oid:>12}  {leis:14} {npts:>4}pts  {nm}")


def main(dry: bool) -> None:
    gaz = parse_gazetteer()
    names = venue_names()
    chosen: dict = {}
    print(f"{'venue':26} {'park name':34} {'area':>9}  cont name", file=sys.stderr)
    print("-" * 90, file=sys.stderr)
    for k in PARK_KEYS:
        if k not in gaz:
            print(f"{k:26} !! not in gazetteer", file=sys.stderr); continue
        lat, lng = gaz[k]
        try:
            best = fetch_one(k, lat, lng, names.get(k, ""))
        except Exception as e:  # noqa: BLE001
            print(f"{k:26} !! fetch failed: {e!r}", file=sys.stderr); continue
        if not best:
            print(f"{k:26} -- no park polygon found (stays a dot)", file=sys.stderr); continue
        ring = simplify(best["ring"])
        chosen[k] = ring
        km2 = best["area_m2"] / 1_000_000
        print(f"{k:26} {best['name'][:34]:34} {km2:7.3f}km²  "
              f"{'Y' if best['contains'] else 'n'}  {'name' if best['name_hit'] else '·'} "
              f"[{best['leisure']}, {len(best['ring'])}→{len(ring)} pts]", file=sys.stderr)
        time.sleep(1.0)

    print(f"\n[fetch_parks] chosen {len(chosen)}/{len(PARK_KEYS)} parks", file=sys.stderr)
    if dry:
        print("[fetch_parks] --dry: not writing venueParks.ts", file=sys.stderr)
        return

    header = (
        "/**\n"
        " * Предрасчитанные контуры ПАРКОВ площадок (OSM leisure=park/garden и т.п.).\n"
        " * Ключи = gazetteer.venue. Кольцо в порядке [lng, lat] (GeoJSON), внешний\n"
        " * контур, упрощён Дугласом–Пекером (~6 м). Рисуем ПЛОСКОЙ бренд-заливкой\n"
        " * (не 3D-домом): парк — это площадь, а не здание. Площадки-парки без здания\n"
        " * (Музеон, Горького, Сокольники…) так подсвечиваются территорией, а не точкой.\n"
        " *\n"
        " * Сгенерировано app/fetch_parks.py — не редактировать руками.\n"
        " */\n\n")
    body = "\n".join(
        f"  {k}: [" + ",".join("[" + ",".join(str(c) for c in p) + "]" for p in chosen[k]) + "],"
        for k in sorted(chosen))
    PARKS_TS.write_text(
        header + "export const VENUE_PARKS: Record<string, [number, number][]> = {\n" + body + "\n}\n",
        encoding="utf-8")
    print(f"[fetch_parks] wrote {PARKS_TS} ({len(chosen)} parks)", file=sys.stderr)


if __name__ == "__main__":
    argv = sys.argv[1:]
    if argv and argv[0] == "--diag" and len(argv) > 1:
        diag(argv[1])
    else:
        main(dry="--dry" in argv)
