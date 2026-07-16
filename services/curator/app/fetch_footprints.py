"""Fetch OSM building footprints for gazetteer venues (regenerates venueFootprints.ts).

Two-stage, verification-first (a wrong building on the map is worse than a dot):

  Stage 1 (this script, --collect): for every venue WITHOUT a footprint, pull ALL
    candidate buildings within RADIUS_M of its gazetteer coord from Overpass —
    id, name/addr tags, ring geometry, distance, point-in-polygon flag — into a
    candidates JSON. No building is chosen yet.
  Stage 2 (agents): pick the correct building id per venue (or "dot" for
    parks/quarters/aggregators/multi-building), writing a decisions JSON.
  Stage 3 (this script, --emit): read decisions, splice chosen rings into
    venueFootprints.ts (keeps existing entries, only adds/updates decided ones).

The gazetteer coords are rounded to ~4 decimals (~11 m), so a naive nearest
building is unreliable — hence candidates + address-aware judgement.
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
    out = {}
    for line in VENUES_TS.read_text(encoding="utf-8").splitlines():
        m = re.match(r'\s*([a-z0-9_]+):\s*\{\s*name:', line)
        if not m:
            continue
        k = m.group(1)
        out[k] = {"name": _field(line, "name"), "kind": _field(line, "kind"),
                  "blurb": _field(line, "blurb"), "address": _field(line, "address")}
    return out


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
        # way-only: building relations are rare and 'out geom' on them is what
        # times out; the handful of relation-buildings can stay dots / be added by hand.
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
    elif cmd == "emit":
        emit()
    else:
        print("usage: fetch_footprints.py [collect|emit]", file=sys.stderr)
