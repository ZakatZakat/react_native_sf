"""Fetch OSM building footprints for gazetteer venues (regenerates venueFootprints.ts).

Verification-first: a WRONG building on the map is worse than a dot. Nothing is
chosen by proximity alone — a candidate is only accepted on an address/name match
that an agent (and, when shaky, an adversarial second agent) signed off on.

Passes — run in order, each is resumable (re-run to fill gaps):
  collect   — ways near each venue coord (radius 70) -> footprint_candidates.json
  collect2  — ways with addr/name near the coord (radius 450) -> footprint_candidates2.json
              (finds the right строение when the rounded coord missed it)
  collect3  — RELATION buildings (radius 450), merged into footprint_candidates2.json
  <agents>  — pick an osm id per venue, or null = stay a dot -> footprint_decisions*.json
  emit      — splice the chosen rings into venueFootprints.ts (keeps existing keys)

HARD-WON GOTCHAS — read before "optimising" any of this:

 1. RELATIONS ARE NOT OPTIONAL. Whole complexes/mansions are mapped as multipolygon
    relations, never as ways: «Главное здание РГБ», «КЦ Москвич», «Дом Пашкова»,
    «Особняк Брусницыных», «Северный речной вокзал», the Кудринская высотка…
    A way-only sweep silently returns "no building here" for all of them and they
    wrongly stay dots. This file once claimed relations were "rare" — that belief
    cost ~40 venues. ALWAYS run collect3.
 2. `out geom tags` SUPPRESSES member geometry on relations (members == []). Use
    `out geom` — it returns tags AND members. This looks like "relation has no
    geometry" and is very easy to misdiagnose.
 3. A relation's outer ring is usually SPLIT across many member ways (РГБ: 29,
    Дом Пашкова: 32). Taking members[0] yields a fragment = a broken polygon.
    Use stitch_outer_ring(): chain segments end-to-end, largest closed ring wins.
 4. Gazetteer coords are rounded to ~4 decimals (~11 m), so the venue point often
    is NOT inside its own building, and the nearest building is often a neighbour
    (for ges2 it grabbed Болотная 7с2 instead of №15). Match on ADDRESS first;
    treat contains/dist as tiebreakers only.
 5. Nominatim reverse is useless here: at zoom 18 it returns the nearest *feature*
    — a bench, a playground, a neighbouring church — not the venue's building.
 6. Overpass overloads for long stretches; all mirrors 504 at once. maps.mail.ru is
    the slow-but-reliable one (CHUNK=4 max; 8 times out). Hence: mirror rotation,
    backoff, per-chunk try/except, and persist-after-each-chunk so a re-run resumes.

Venues that legitimately stay dots (do NOT force a building): parks, embankments,
«квартал»/кластер territories, stadium grounds, open-air stages, temporary pavilions,
multi-venue aggregators, and any venue whose exact строение simply isn't in OSM.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAZ = HERE / "pipeline" / "gazetteer.py"
SRC_DIR = HERE.parent.parent.parent / "src" / "pages" / "cs"
VENUES_TS = SRC_DIR / "venues.ts"
FOOTPRINTS_TS = SRC_DIR / "venueFootprints.ts"

SCRATCH = Path("/private/tmp/claude-501/-Users-askarembulatov-event-app/91ec51f2-2f7a-4266-8451-92bedeff5771/scratchpad")
CAND_JSON = SCRATCH / "footprint_candidates.json"
DEC_JSON = SCRATCH / "footprint_decisions.json"

OVERPASS_MIRRORS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",  # slow but reliable now
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
UA = "citysignal-footprints/1.0 (contact: comradefrunze@gmail.com)"
RADIUS_M = 70          # search radius for candidate buildings
CHUNK = 4              # points per Overpass union query (mail.ru handles 4, not 8)


# -- parse the two source files ----------------------------------------------
def parse_gazetteer() -> dict:
    src = GAZ.read_text(encoding="utf-8")
    out = {}
    for k, lat, lng in re.findall(r'Venue\(\s*"([a-z0-9_]+)"\s*,\s*([\d.]+)\s*,\s*([\d.]+)', src):
        out[k] = (float(lat), float(lng))
    return out


def _field(line: str, name: str) -> str:
    m = re.search(name + r':\s*"((?:[^"\\]|\\.)*)"', line)
    return m.group(1) if m else ""


def parse_venues_ts() -> dict:
    """key -> {name,kind,blurb,address} from venues.ts.

    Entries come in BOTH shapes — one-liners and multi-line blocks:
        zorka: { name: "ZORKA", kind: "клуб", ... },
        mo_yeti: {
          name: "Бар МО[ТРИ]",
          ...
        },
    A line-based `key: { name:` regex silently drops every multi-line entry (it
    dropped 24, leaving them with no address, so the address search never ran for
    them). Match the whole brace-block instead.
    """
    src = VENUES_TS.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'^\s{2}([a-z0-9_]+):\s*\{', src, re.M):
        # Walk to the entry's matching close brace, tracking depth and skipping
        # braces inside strings. Line-shape regexes get this wrong: entries appear
        # as one-liners, as blocks closed by a bare `},`, AND as blocks closed by
        # `..., img: "..." },` on a field line.
        depth, j, in_str, esc = 1, m.end(), False, False
        while j < len(src) and depth:
            ch = src[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            elif ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            j += 1
        out[m.group(1)] = _venue_fields(src[m.end():j - 1])
    return out


def _venue_fields(body: str) -> dict:
    return {"name": _field(body, "name"), "kind": _field(body, "kind"),
            "blurb": _field(body, "blurb"), "address": _field(body, "address")}


def existing_footprint_keys() -> set:
    src = FOOTPRINTS_TS.read_text(encoding="utf-8")
    return set(re.findall(r'^\s{2}([a-z0-9_]+):\s*\[\[', src, re.M))


# -- geometry helpers --------------------------------------------------------
def _m_per_deg(lat: float):
    import math
    return 111320.0, 111320.0 * math.cos(math.radians(lat))


def dist_m(lat1, lng1, lat2, lng2) -> float:
    import math
    mlat, mlng = _m_per_deg((lat1 + lat2) / 2)
    return math.hypot((lat1 - lat2) * mlat, (lng1 - lng2) * mlng)


def ring_from_geometry(geom: list) -> list:
    return [[round(p["lon"], 6), round(p["lat"], 6)] for p in geom]


def centroid(ring: list):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return sum(xs) / len(xs), sum(ys) / len(ys)  # lng, lat


def point_in_ring(lng: float, lat: float, ring: list) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


# -- Overpass ----------------------------------------------------------------
def overpass(query: str) -> list:
    last = None
    for attempt in range(12):
        url = OVERPASS_MIRRORS[attempt % len(OVERPASS_MIRRORS)]
        try:
            req = urllib.request.Request(
                url, data=("data=" + query).encode("utf-8"),
                headers={"User-Agent": UA, "Accept": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)["elements"]
        except Exception as e:  # noqa: BLE001
            last = e
            # gentle: back off up to 60s so we probe overloaded mirrors politely
            wait = min(60, 5 * (attempt + 1))
            print(f"[overpass] {url.split('/')[2]} attempt {attempt+1} failed: {e!r}; retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"overpass failed after retries: {last!r}")


def collect() -> None:
    gaz = parse_gazetteer()
    info = parse_venues_ts()
    have = existing_footprint_keys()
    todo = {k: gaz[k] for k in gaz if k not in have}

    # Resumable: keep any candidates already collected; only fetch the rest.
    out = {}
    geom_store = {}
    if CAND_JSON.exists():
        out = json.loads(CAND_JSON.read_text(encoding="utf-8"))
    geom_path = SCRATCH / "footprint_geometry.json"
    if geom_path.exists():
        geom_store = json.loads(geom_path.read_text(encoding="utf-8"))
    remaining = {k: v for k, v in todo.items() if k not in out or not out[k].get("candidates")}
    print(f"[collect] gazetteer={len(gaz)} have_footprint={len(have)} todo={len(todo)} "
          f"already={len(todo)-len(remaining)} remaining={len(remaining)}", file=sys.stderr)

    items = list(remaining.items())
    all_bldgs = {int(k): {"id": int(k), "ring": v} for k, v in geom_store.items()}
    failed_chunks = 0
    for i in range(0, len(items), CHUNK):
        chunk = items[i:i + CHUNK]
        # Ways only in THIS pass (a union of relation+`out geom` is what times out).
        # Relations are NOT skippable — collect3 covers them; see gotcha #1 up top.
        clauses = "".join(
            f'way(around:{RADIUS_M},{lat},{lng})["building"];'
            for _, (lat, lng) in chunk)
        q = f"[out:json][timeout:60];({clauses});out geom tags;"
        try:
            els = overpass(q)
        except Exception as e:  # noqa: BLE001 — non-fatal: skip chunk, fill on re-run
            failed_chunks += 1
            print(f"[collect] chunk {i//CHUNK+1} FAILED (skipped): {e!r}", file=sys.stderr)
            continue
        for e in els:
            if e["type"] == "way" and e.get("geometry"):
                all_bldgs[e["id"]] = {"id": e["id"], "type": "way",
                                      "ring": ring_from_geometry(e["geometry"]),
                                      "tags": e.get("tags", {})}
        # incrementally compute + persist candidates for THIS chunk's venues
        for k, (lat, lng) in chunk:
            out[k] = _venue_candidates(k, lat, lng, all_bldgs, info)
        _persist(out, all_bldgs, geom_path)
        print(f"[collect] chunk {i//CHUNK+1}/{(len(items)+CHUNK-1)//CHUNK}: +{len(els)} els, "
              f"buildings {len(all_bldgs)}, venues_done {len([1 for vv in out.values() if vv.get('candidates') is not None])}",
              file=sys.stderr)
        time.sleep(2.0)

    no_cand = [k for k, v in out.items() if not v.get("candidates")]
    still_missing = [k for k in todo if k not in out or out[k].get("candidates") is None]
    print(f"[collect] DONE venues={len(out)} no_building={len(no_cand)} "
          f"failed_chunks={failed_chunks} still_missing={len(still_missing)}", file=sys.stderr)
    if still_missing:
        print(f"[collect] rerun to fill: {still_missing[:20]}{'...' if len(still_missing)>20 else ''}", file=sys.stderr)
    return


def _venue_candidates(k, lat, lng, all_bldgs, info) -> dict:
    """Build the candidate-buildings block for one venue from all fetched buildings."""
    cands = []
    for b in all_bldgs.values():
        ring = b.get("ring")
        if not ring or len(ring) < 4:
            continue
        clng, clat = centroid(ring)
        d = dist_m(lat, lng, clat, clng)
        if d > RADIUS_M:
            continue
        t = b.get("tags", {})
        cands.append({
            "id": b["id"], "type": b.get("type", "way"), "dist_m": round(d, 1),
            "contains": point_in_ring(lng, lat, ring),
            "n_pts": len(ring),
            "name": t.get("name", ""),
            "addr": " ".join(filter(None, [t.get("addr:street", ""), t.get("addr:housenumber", "")])),
            "building": t.get("building", ""),
            "amenity": t.get("amenity", "") or t.get("tourism", "") or t.get("leisure", ""),
        })
    cands.sort(key=lambda c: (not c["contains"], c["dist_m"]))
    vi = info.get(k, {})
    return {"name": vi.get("name", ""), "kind": vi.get("kind", ""),
            "blurb": vi.get("blurb", ""), "address": vi.get("address", ""),
            "lat": lat, "lng": lng, "candidates": cands[:8]}


def _persist(out: dict, all_bldgs: dict, geom_path: Path) -> None:
    CAND_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    geom_path.write_text(
        json.dumps({str(b["id"]): b["ring"] for b in all_bldgs.values() if b.get("ring")}, ensure_ascii=False),
        encoding="utf-8")


CAND2_JSON = SCRATCH / "footprint_candidates2.json"


def _norm_street(s: str) -> str:
    s = s.lower().replace("ё", "е")
    # drop street-type words so "ул./улица/переулок/пер./бульвар" don't block a match
    s = re.sub(r"\b(улица|ул|переулок|пер|бульвар|б-р|бул|набережная|наб|проспект|пр-т|пр|площадь|пл|шоссе|ш|линия|проезд|аллея|тупик)\b\.?", " ", s)
    return re.sub(r"[^0-9a-zа-я]+", "", s)


_STREET_RE = re.compile(
    r"(улиц|переул|\bпер\b|\bпер\.|бульвар|бульв|набереж|\bнаб\b|\bнаб\.|проспект|"
    r"\bпр-т\b|площад|\bпл\b|\bпл\.|шоссе|\bш\b|\bш\.|линия|проезд|аллея|\bвал\b|\bул\b|\bул\.|"
    r"дорога|тупик|спуск|съезд)", re.I)


def parse_address(addr: str) -> tuple[str, str]:
    """Return (normalized street, house-string) from a hand-written RU address by
    locating the street-type segment and taking the house from the following segment(s)."""
    segs = [s.strip() for s in addr.split(",")]
    si = next((i for i, s in enumerate(segs) if _STREET_RE.search(s)), None)
    if si is None:
        # no street word — fall back to first segment that isn't a city/region
        si = 0
    street = _norm_street(segs[si])
    # house = first following segment starting with a (optionally «д.») digit,
    # joined with any subsequent стр./корп. fragment.
    parts: list[str] = []
    j = si + 1
    while j < len(segs) and len(parts) < 3:
        s = segs[j]
        if not parts:
            if re.match(r"(д(ом)?\.?\s*)?\d", s):
                parts.append(s)
            else:
                break
        elif re.match(r"(стр|строение|с|корп|корпус|к)\.?\s*\d", s, re.I):
            parts.append(s)
        else:
            break
        j += 1
    house = " ".join(parts)
    # house may also be inline in the street segment tail ("Покровка 16") — if we
    # found nothing after, scan the street segment itself for a trailing number.
    if not house:
        m = re.search(r"\b(\d+[а-яА-Я]?(?:\s*[/-]\s*\d+[а-яА-Я]?)?(?:\s*(?:стр|с|к|корп)\.?\s*\d+)?)\s*$", segs[si])
        if m:
            house = m.group(1)
    return street, house


def _house_variants(addr_or_house: str) -> list[str]:
    """Normalized house comparison keys, e.g. '4 стр.1'->{'4с1'}, '1/8 стр6'->{'1/8с6'},
    '1с1'->{'1с1','1'}. Accepts either a full address (parsed) or an already-isolated house."""
    house = addr_or_house
    if "," in addr_or_house or _STREET_RE.search(addr_or_house):
        _, house = parse_address(addr_or_house)
    house = re.sub(r"д(ом)?\.?\s*", "", house, flags=re.I)
    # base = number (+ /number) + optional литера-letter (а/б/в/г/д — NOT с/к, which
    # are строение/корпус markers). e.g. '4Бс2' -> base '4б', стр '2'.
    m = re.match(r"\s*(\d+(?:\s*/\s*\d+)?(?:\s*[абвгд])?)"
                 r"\s*(?:(?:стр|строение|с)\.?\s*(\d+))?"
                 r"\s*(?:(?:корп|корпус|к)\.?\s*(\d+))?", house, flags=re.I)
    if not m:
        return []
    base, stro, korp = m.group(1), m.group(2), m.group(3)
    base = re.sub(r"\s+", "", base).lower().replace("ё", "е")
    keys = {base}
    if stro:
        keys |= {f"{base}с{stro}", f"{base}стр{stro}"}
    if korp:
        keys |= {f"{base}к{korp}", f"{base}корп{korp}"}
    if stro and korp:
        keys.add(f"{base}к{korp}с{stro}")
    return list(keys)


def _norm_house(hn: str) -> str:
    hn = hn.lower().replace("ё", "е")
    hn = re.sub(r"стр(оение)?\.?\s*", "с", hn)
    hn = re.sub(r"корп(ус)?\.?\s*", "к", hn)
    hn = re.sub(r"\s+", "", hn)
    return hn


def collect2() -> None:
    """Round 2: for venues still a dot, search by ADDRESS (addressed/named buildings
    within 450 m) so the exact строение is found even when the rounded coord missed it."""
    decisions = json.loads(DEC_JSON.read_text(encoding="utf-8"))
    info = json.loads(CAND_JSON.read_text(encoding="utf-8"))
    geom_path = SCRATCH / "footprint_geometry.json"
    geom_store = json.loads(geom_path.read_text(encoding="utf-8")) if geom_path.exists() else {}
    all_bldgs = {int(k): {"id": int(k), "ring": v} for k, v in geom_store.items()}

    dots = [k for k, v in decisions.items() if not v.get("osm_id")]
    todo = [(k, info[k]) for k in dots if info.get(k, {}).get("address")]
    out = json.loads(CAND2_JSON.read_text(encoding="utf-8")) if CAND2_JSON.exists() else {}
    todo = [(k, vi) for k, vi in todo if k not in out]
    print(f"[collect2] dots={len(dots)} with_address_todo={len(todo)} already={len(out)}", file=sys.stderr)

    RADIUS2 = 450
    for i, (k, vi) in enumerate(todo):
        lat, lng = vi["lat"], vi["lng"]
        q = (f"[out:json][timeout:60];("
             f'way(around:{RADIUS2},{lat},{lng})["building"]["addr:housenumber"];'
             f'way(around:{RADIUS2},{lat},{lng})["building"]["name"];'
             f");out geom tags;")
        try:
            els = overpass(q)
        except Exception as e:  # noqa: BLE001
            print(f"[collect2] {k} FAILED (skip): {e!r}", file=sys.stderr)
            continue
        want_street, _ = parse_address(vi["address"])
        want_house = set(_norm_house(h) for h in _house_variants(vi["address"]))
        cands = []
        for e in els:
            if e["type"] != "way" or not e.get("geometry"):
                continue
            ring = ring_from_geometry(e["geometry"])
            if len(ring) < 4:
                continue
            all_bldgs[e["id"]] = {"id": e["id"], "ring": ring, "tags": e.get("tags", {})}
            clng, clat = centroid(ring)
            d = dist_m(lat, lng, clat, clng)
            if d > RADIUS2:
                continue
            t = e.get("tags", {})
            hn = _norm_house(t.get("addr:housenumber", ""))
            st = _norm_street(t.get("addr:street", ""))
            house_hit = bool(hn) and hn in want_house
            street_hit = bool(st) and bool(want_street) and (st in want_street or want_street in st)
            cands.append({
                "id": e["id"], "dist_m": round(d, 1), "contains": point_in_ring(lng, lat, ring),
                "name": t.get("name", ""), "addr": " ".join(filter(None, [t.get("addr:street", ""), t.get("addr:housenumber", "")])),
                "building": t.get("building", ""),
                "amenity": t.get("amenity", "") or t.get("tourism", "") or t.get("leisure", ""),
                "house_hit": house_hit, "street_hit": street_hit,
            })
        # rank: exact house+street match first, then house, then contains, then distance
        cands.sort(key=lambda c: (not (c["house_hit"] and c["street_hit"]), not c["house_hit"], not c["contains"], c["dist_m"]))
        out[k] = {"name": vi["name"], "kind": vi["kind"], "blurb": vi["blurb"], "address": vi["address"],
                  "lat": lat, "lng": lng, "want_house": sorted(want_house), "candidates": cands[:8]}
        CAND2_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
        _persist_geom(all_bldgs, geom_path)
        hit = sum(1 for c in cands if c["house_hit"] and c["street_hit"])
        print(f"[collect2] {i+1}/{len(todo)} {k}: {len(cands)} cands, {hit} exact addr-hit", file=sys.stderr)
        time.sleep(1.5)

    exact = sum(1 for v in out.values() if any(c["house_hit"] and c["street_hit"] for c in v["candidates"]))
    print(f"[collect2] DONE venues={len(out)} with_exact_addr_hit={exact}", file=sys.stderr)


def _ring_area(ring: list) -> float:
    """Absolute shoelace area (deg²) — only used to compare rings."""
    a = 0.0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(a) / 2.0


def stitch_outer_ring(members: list) -> list:
    """Build ONE closed outer ring from a building multipolygon's members.

    A relation's outer boundary is usually split across many member ways (РГБ has 29),
    so taking just the first member yields a fragment — a broken footprint. Segments are
    chained end-to-end (flipping as needed) into closed rings; if the relation has several
    separate outer rings, the largest-area one wins (VENUE_FOOTPRINTS holds a single ring).
    """
    segs = [ring_from_geometry(m["geometry"]) for m in members
            if m.get("role") in ("outer", "") and m.get("geometry")]
    segs = [s for s in segs if len(s) >= 2]
    rings: list[list] = []
    while segs:
        ring = list(segs.pop(0))
        changed = True
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
                segs.pop(i)
                changed = True
                break
        if len(ring) >= 4:
            if ring[0] != ring[-1]:
                ring.append(ring[0])  # force-close a stray open chain
            rings.append(ring)
    if not rings:
        return []
    return max(rings, key=_ring_area)


def collect3() -> None:
    """Round 3: RELATION buildings only. Rounds 1-2 queried ways only (relation
    `out geom` was timing out during an Overpass overload), which silently missed
    every multipolygon-mapped building — e.g. 'Главное здание РГБ', 'КЦ Москвич'.
    Merges relation candidates into the round-2 candidate file."""
    c2 = json.loads(CAND2_JSON.read_text(encoding="utf-8"))
    geom_path = SCRATCH / "footprint_geometry.json"
    geom_store = json.loads(geom_path.read_text(encoding="utf-8")) if geom_path.exists() else {}
    all_bldgs = {int(k): {"id": int(k), "ring": v} for k, v in geom_store.items()}

    done_path = SCRATCH / "collect3_done.json"
    done = set(json.loads(done_path.read_text(encoding="utf-8"))) if done_path.exists() else set()
    todo = [k for k in c2 if k not in done]
    print(f"[collect3] venues={len(c2)} todo={len(todo)}", file=sys.stderr)

    for i, k in enumerate(todo):
        v = c2[k]
        lat, lng = v["lat"], v["lng"]
        # NB: "out geom tags" SUPPRESSES member geometry — "out geom" returns tags AND members
        q = f'[out:json][timeout:90];relation(around:450,{lat},{lng})["building"];out geom;'
        try:
            els = overpass(q)
        except Exception as e:  # noqa: BLE001
            print(f"[collect3] {k} FAILED (skip): {e!r}", file=sys.stderr)
            continue
        want_street, _ = parse_address(v["address"])
        want_house = set(_norm_house(h) for h in _house_variants(v["address"]))
        added = 0
        for e in els:
            if e["type"] != "relation":
                continue
            ring = stitch_outer_ring(e.get("members", []))
            if len(ring) < 4:
                continue
            all_bldgs[e["id"]] = {"id": e["id"], "ring": ring, "tags": e.get("tags", {})}
            clng, clat = centroid(ring)
            d = dist_m(lat, lng, clat, clng)
            if d > 450:
                continue
            t = e.get("tags", {})
            hn = _norm_house(t.get("addr:housenumber", ""))
            st = _norm_street(t.get("addr:street", ""))
            v["candidates"].append({
                "id": e["id"], "dist_m": round(d, 1), "contains": point_in_ring(lng, lat, ring),
                "name": t.get("name", ""), "addr": " ".join(filter(None, [t.get("addr:street", ""), t.get("addr:housenumber", "")])),
                "building": t.get("building", ""),
                "amenity": t.get("amenity", "") or t.get("tourism", "") or t.get("leisure", ""),
                "house_hit": bool(hn) and hn in want_house,
                "street_hit": bool(st) and bool(want_street) and (st in want_street or want_street in st),
                "is_relation": True,
            })
            added += 1
        v["candidates"].sort(key=lambda c: (not (c["house_hit"] and c["street_hit"]), not c["house_hit"], not c["contains"], c["dist_m"]))
        v["candidates"] = v["candidates"][:10]
        done.add(k)
        CAND2_JSON.write_text(json.dumps(c2, ensure_ascii=False, indent=1), encoding="utf-8")
        done_path.write_text(json.dumps(sorted(done), ensure_ascii=False), encoding="utf-8")
        _persist_geom(all_bldgs, geom_path)
        print(f"[collect3] {i+1}/{len(todo)} {k}: +{added} relations", file=sys.stderr)
        time.sleep(1.0)
    print(f"[collect3] DONE done={len(done)}/{len(c2)}", file=sys.stderr)


def _persist_geom(all_bldgs: dict, geom_path: Path) -> None:
    geom_path.write_text(
        json.dumps({str(b["id"]): b["ring"] for b in all_bldgs.values() if b.get("ring")}, ensure_ascii=False),
        encoding="utf-8")


def emit() -> None:
    geom = json.loads((SCRATCH / "footprint_geometry.json").read_text(encoding="utf-8"))
    decisions = json.loads(DEC_JSON.read_text(encoding="utf-8"))
    src = FOOTPRINTS_TS.read_text(encoding="utf-8")
    existing = {}
    for m in re.finditer(r'^\s{2}([a-z0-9_]+):\s*(\[\[.*?\]\]),?\s*$', src, re.M):
        existing[m.group(1)] = m.group(2)

    added = 0
    for k, d in decisions.items():
        oid = d.get("osm_id")
        if not oid:
            continue
        ring = geom.get(str(oid))
        if not ring or len(ring) < 4:
            print(f"[emit] WARN {k}: no geometry for osm {oid}", file=sys.stderr)
            continue
        existing[k] = "[" + ",".join("[" + ",".join(str(c) for c in p) + "]" for p in ring) + "]"
        added += 1

    keys = sorted(existing)
    body = "\n".join(f"  {k}: {existing[k]}," for k in keys)
    header = src.split("export const VENUE_FOOTPRINTS")[0]
    FOOTPRINTS_TS.write_text(
        header + "export const VENUE_FOOTPRINTS: Record<string, [number, number][]> = {\n" + body + "\n}\n",
        encoding="utf-8")
    print(f"[emit] total footprints now {len(keys)} (added/updated {added})", file=sys.stderr)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "collect"
    if cmd == "collect":
        collect()
    elif cmd == "collect2":
        collect2()
    elif cmd == "collect3":
        collect3()
    elif cmd == "emit":
        emit()
    else:
        print("usage: fetch_footprints.py [collect|collect2|collect3|emit]", file=sys.stderr)
