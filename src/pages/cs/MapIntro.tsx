/**
 * CitySignal · v5 map-first intro — district zones (faithful port of the
 * design's MapIntroModal with mapGroup="zones").
 *
 *  A 3D MapLibre map of Moscow. Real geocoded events are clustered into 5
 *  districts (Центр/Север/Восток/Юг/Запад); each district is a bubble with a
 *  fan of up to 3 posters + a count badge. Tapping a district "explodes" it
 *  into individual poster-pins (grid layout) and opens a carousel deck of its
 *  events at the bottom; tapping again collapses back. "Войти в ленту" leaves
 *  the intro for the feed.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Ev } from "./buildDerived"
import { CS, FONT_SANS, FONT_MONO, useCsKeyframes, useOpenEvent } from "./shared"
import { CS_STYLE_LIGHT, applyCinematicSky } from "./csMapStyle"
import { venueInfo, type VenueInfo } from "./venues"

const MSK: [number, number] = [37.62, 55.745]

// `ll` = real district centre (events are assigned to their true nearest
// district by this). `dll` = display position — pulled ≈45% toward central
// Moscow so far districts like Восток (Винзавод, 7+ km east) still sit in
// frame; the bubble + its exploded pins draw here, but assignment stays
// geographically correct.
type Zone = { id: string; t: string; sub: string; ll: [number, number]; dll: [number, number]; r: number }
const ZONES: Zone[] = [
  { id: "center", t: "Центр",  sub: "Бульварное",        ll: [55.7660, 37.6210], dll: [55.7587, 37.6190], r: 1500 },
  { id: "north",  t: "Север",  sub: "ВДНХ · Речной",     ll: [55.8650, 37.5900], dll: [55.8029, 37.6051], r: 1900 },
  { id: "east",   t: "Восток", sub: "Винзавод · ARMA",   ll: [55.7760, 37.7420], dll: [55.7628, 37.6735], r: 1700 },
  { id: "south",  t: "Юг",     sub: "ЗИЛ · Даниловский", ll: [55.6440, 37.6540], dll: [55.7034, 37.6339], r: 1800 },
  { id: "west",   t: "Запад",  sub: "Сити · Кутузово",   ll: [55.7380, 37.4820], dll: [55.7457, 37.5565], r: 1800 },
]
const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]))

const inMoscow = (lat: number, lng: number) => lat >= 55.3 && lat <= 56.1 && lng >= 36.9 && lng <= 38.0

// Central Moscow + a central radius. Inside the radius → Центр; beyond it the
// event goes to the directional sector (Север/Восток/Юг/Запад) by its bearing
// from the centre. Bearing-based assignment spreads events across the city
// instead of dumping everything past the centre into «Центр» (the old
// nearest-zone-centre rule pulled the whole central band into one zone).
const CITY: [number, number] = [55.7520, 37.6175]
const R_CENTER_KM = 3.0

function zoneOf(lat: number, lng: number): string {
  const cosLat = Math.cos((CITY[0] * Math.PI) / 180)
  const dNorth = (lat - CITY[0]) * 111.32
  const dEast = (lng - CITY[1]) * 111.32 * cosLat
  if (Math.hypot(dNorth, dEast) < R_CENTER_KM) return "center"
  let ang = (Math.atan2(dEast, dNorth) * 180) / Math.PI // 0=N, 90=E, 180=S, -90=W
  if (ang < 0) ang += 360
  if (ang >= 315 || ang < 45) return "north"
  if (ang < 135) return "east"
  if (ang < 225) return "south"
  return "west"
}

/** District bubble marker. With events: fan of ≤3 posters + count + name.
 *  Empty: a solid signal-blue card («нет результатов») in place of the fan +
 *  name (always shown, non-interactive), so every district stays on the map
 *  even with nothing this week. */
function zoneBubbleEl(zone: Zone, evs: Ev[], onClick: (id: string) => void): HTMLElement {
  const el = document.createElement("div")
  el.dataset.zone = zone.id
  if (!evs.length) {
    el.className = "cs-zone cs-zone-empty"
    el.innerHTML =
      `<div class="cs-zone-bubble">` +
      `<div class="cs-zone-empty-card">нет<br>результатов</div>` +
      `<div class="cs-zone-name">${zone.t}</div></div>` +
      `<div class="cs-zone-dot"></div>`
    return el // no click handler — empty districts are just labels
  }
  const fan = evs.slice(0, 3)
  const rots = [-14, 0, 14]
  const single = fan.length === 1
  // a lone card sits upright and centred (no fan tilt/offset)
  const thumbs = fan.map((e, i) =>
    `<span class="cs-zfan-card" style="--zr:${single ? 0 : rots[i] || 0}deg;--zz:${single ? 1 : i}">${e.p ? `<img src="${e.p}" alt=""/>` : ""}</span>`,
  ).join("")
  el.className = "cs-zone"
  el.innerHTML =
    `<div class="cs-zone-ring"></div>` +
    `<div class="cs-zone-bubble"><div class="cs-zfan">${thumbs}<span class="cs-zone-count">${evs.length}</span></div>` +
    `<div class="cs-zone-name">${zone.t}</div></div>` +
    `<div class="cs-zone-dot"></div>`
  el.addEventListener("click", (e) => { e.stopPropagation(); onClick(zone.id) })
  return el
}

// ── v7 sys-fan (hybrid) ────────────────────────────────────────────────────
// v7 groups a zone into fans + polaroid drill-down, but places them
// SYNTHETICALLY (golden-angle around the zone centre). We keep the v7 LOOK but
// anchor everything to REAL geo coordinates: clusters by true proximity, fans
// at member centroids, polaroids on each event's actual spot.

type Cluster = { ll: [number, number]; members: Ev[] }

const RU_PLURAL = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? "событие" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "события" : "событий"}`

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))

function metersBetween(a: [number, number], b: [number, number]): number {
  const dLat = (b[0] - a[0]) * 111320
  const dLng = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

/** Greedy geographic clustering by REAL proximity (radius in metres). Each
 *  cluster sits at its members' centroid. Co-located events (same building)
 *  are distance ~0 so they always group; the deck flips through them. */
function clusterByProximity(evs: Ev[], radiusM = 250): Cluster[] {
  // 250m (not 650m): a cluster should be truly co-located venues, not a whole
  // district — 650m greedily swallowed the dense centre into one blob and lit
  // dozens of buildings. Co-located events (dist ~0) still group; distinct
  // venues >250m apart split into their own clusters.
  const withGeo = evs.filter((e) => e.geo)
  const used = new Array(withGeo.length).fill(false)
  const out: Cluster[] = []
  for (let a = 0; a < withGeo.length; a++) {
    if (used[a]) continue
    used[a] = true
    const members = [withGeo[a]]
    const seed = withGeo[a].geo as [number, number]
    for (let b = a + 1; b < withGeo.length; b++) {
      if (used[b]) continue
      if (metersBetween(seed, withGeo[b].geo as [number, number]) < radiusM) { used[b] = true; members.push(withGeo[b]) }
    }
    const lat = members.reduce((s, e) => s + (e.geo as [number, number])[0], 0) / members.length
    const lng = members.reduce((s, e) => s + (e.geo as [number, number])[1], 0) / members.length
    out.push({ ll: [lat, lng], members })
  }
  return out
}

/** Cluster fan marker (v7 makeClusterEl): 3 posters + count + «N событий». */
function clusterFanEl(cl: Cluster, gi: number): HTMLElement {
  const rots = [-12, 0, 12]
  const thumbs = cl.members.slice(0, 3).map((e, i) =>
    `<span class="cs-clu-card" style="--zr:${rots[i] || 0}deg;--zz:${i}">${e.p ? `<img src="${e.p}" alt=""/>` : ""}</span>`,
  ).join("")
  const wrap = document.createElement("div")
  wrap.className = "cs-scatter-wrap"
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;"
  wrap.innerHTML =
    `<div class="cs-clu" style="--si:${gi}"><div class="cs-clu-fan">${thumbs}` +
    `<span class="cs-clu-count">${cl.members.length}</span></div>` +
    `<div class="cs-clu-name">${RU_PLURAL(cl.members.length)}</div><div class="cs-clu-tip"></div></div>`
  return wrap
}

/** Inner HTML for the cluster DECK: the active event as a full card in front,
 *  up to two "ghost" cards fanned behind to show the pile, and a ← N/total →
 *  pager. Co-located events (all at one building) are a tidy deck you flip
 *  through, not a confusing ring of overlapping cards. */
/** Just the event side of the deck (ghosts + front card) — rebuilt on paging. */
function eventStackHTML(members: Ev[], i: number): string {
  const e = members[i]
  const n = members.length
  const date = e.d && e.d !== "—" ? e.d : ""
  const meta = [e.tm, e.v].filter((s) => s && s !== "—").join(" · ")
  const ghosts = n > 1 ? `<div class="cs-deck-ghost cs-dg2"></div><div class="cs-deck-ghost cs-dg1"></div>` : ""
  return ghosts +
    `<div class="cs-pola-card cs-deck-front">` +
      `<div class="cs-pola-img">${e.p ? `<img src="${e.p}" alt=""/>` : ""}</div>` +
      `<div class="cs-pola-body">` +
        `<div class="cs-pola-top"><span class="cs-pola-cat">${esc(e.c || "событие")}</span>${date ? `<span class="cs-pola-date">${esc(date)}</span>` : ""}</div>` +
        `<div class="cs-pola-title cs-deck-title">${esc(e.t || "")}</div>` +
        (meta ? `<div class="cs-pola-meta">${esc(meta)}</div>` : "") +
      `</div>` +
    `</div>`
}

/** The place card (left) — rebuilt ONLY when the venue changes. */
function placeCardHTML(vi: VenueInfo): string {
  return `<div class="cs-deck-place">` +
    (vi.img ? `<div class="cs-deck-place-img"><img src="${vi.img}" alt=""/></div>` : "") +
    `<div class="cs-deck-place-body">` +
      `<div class="cs-deck-place-kind">место · ${esc(vi.kind)}</div>` +
      `<div class="cs-deck-place-name">${esc(vi.name)}</div>` +
      `<div class="cs-deck-place-blurb">${esc(vi.blurb)}</div>` +
      (vi.address ? `<div class="cs-deck-place-addr">📍 ${esc(vi.address)}</div>` : "") +
      `<button class="cs-deck-center" type="button">Центрировать карту</button>` +
    `</div>` +
  `</div>`
}

// ── Highlight event buildings (signal-blue) ─────────────────────────────────
// We draw the picked footprints into our OWN geojson fill-extrusion layer —
// NOT feature-state. The MapTiler building tiles reuse feature ids across
// tiles, so feature-state `hl` bleeds onto same-id buildings elsewhere on
// screen (a stray blue tower far from any event). Drawing the exact geometries
// we chose is bleed-proof. The overlay is OPAQUE and its footprint is inflated
// a few %, so it fully covers the grey building underneath (no coincident walls
// → no z-fighting) and reads as a solid blue building.
const EVT_BLDG_SRC = "cs-evt-bldg"
const EVT_BLDG_LAYER = "cs-evt-bldg-fill"
const FOCUS_SRC = "cs-focus"
type BldgRef = { source: string; sourceLayer: string; id: string | number }
type Hl = { key: string; feat: GeoJSON.Feature }

function ensureEventBuildingsLayer(map: maplibregl.Map) {
  if (map.getSource(EVT_BLDG_SRC)) return
  map.addSource(EVT_BLDG_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  map.addLayer({
    id: EVT_BLDG_LAYER, type: "fill-extrusion", source: EVT_BLDG_SRC, minzoom: 13,
    paint: {
      "fill-extrusion-color": CS.B,
      // real building height, floored at ~42m so a tiny gallery still reads as a
      // landmark, +4m so the blue top clears the grey roof it covers.
      "fill-extrusion-height": ["+", ["max", ["coalesce", ["to-number", ["get", "render_height"]], 8], 42], 4],
      "fill-extrusion-base": ["coalesce", ["to-number", ["get", "render_min_height"]], 0],
      "fill-extrusion-opacity": 1,
    },
  } as maplibregl.AddLayerObject)
  // Focus marker — a blue dot + halo at the venue coord. Always visible, even
  // where MapTiler has no building footprint to paint (e.g. mansions set back
  // from the street). This is the reliable "here is the place" indicator.
  map.addSource(FOCUS_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  map.addLayer({
    id: "cs-focus-halo", type: "circle", source: FOCUS_SRC,
    paint: { "circle-radius": 30, "circle-color": CS.B, "circle-opacity": 0.2, "circle-blur": 0.35 },
  } as maplibregl.AddLayerObject)
  map.addLayer({
    id: "cs-focus-dot", type: "circle", source: FOCUS_SRC,
    paint: { "circle-radius": 10, "circle-color": CS.B, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 },
  } as maplibregl.AddLayerObject)
}

/** Show a focus dot at a [lat,lng] venue coord (or clear it with null). */
function setFocus(map: maplibregl.Map, coord: [number, number] | null) {
  const src = map.getSource(FOCUS_SRC) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData(coord
    ? { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [coord[1], coord[0]] }, properties: {} }] }
    : { type: "FeatureCollection", features: [] })
}

/** Inflate a footprint ~4% around its centroid so the opaque blue overlay's
 *  walls sit just outside the grey building's walls — no coincident faces. */
function inflate(geom: GeoJSON.Geometry, f = 1.04): GeoJSON.Geometry {
  const c = polyCentroid(geom); if (!c) return geom
  const [cx, cy] = c
  const sp = (p: GeoJSON.Position): GeoJSON.Position => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]
  if (geom.type === "Polygon") return { type: "Polygon", coordinates: geom.coordinates.map((r) => r.map(sp)) }
  if (geom.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: geom.coordinates.map((poly) => poly.map((r) => r.map(sp))) }
  return geom
}

/** Push the current set of highlighted footprints into the overlay layer. */
function renderEventBuildings(map: maplibregl.Map, hls: Hl[]) {
  const src = map.getSource(EVT_BLDG_SRC) as maplibregl.GeoJSONSource | undefined
  if (src) src.setData({ type: "FeatureCollection", features: hls.map((h) => h.feat) })
}

/** Rough lng/lat centroid of a (Multi)Polygon's outer ring. */
function polyCentroid(geom: GeoJSON.Geometry): [number, number] | null {
  let ring: GeoJSON.Position[] | undefined
  if (geom.type === "Polygon") ring = geom.coordinates[0]
  else if (geom.type === "MultiPolygon") ring = geom.coordinates[0]?.[0]
  if (!ring || !ring.length) return null
  let x = 0, y = 0
  ring.forEach((c) => { x += c[0]; y += c[1] })
  return [x / ring.length, y / ring.length]
}

/** Ray-casting point-in-polygon over a GeoJSON Polygon/MultiPolygon (lng/lat).
 *  Tests outer rings only — building footprints have no meaningful holes. */
function pointInPolygon(pt: [number, number], geom: GeoJSON.Geometry): boolean {
  const rings: GeoJSON.Position[][] =
    geom.type === "Polygon" ? [geom.coordinates[0]]
      : geom.type === "MultiPolygon" ? geom.coordinates.map((poly) => poly[0])
        : []
  const [x, y] = pt
  return rings.some((ring) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  })
}

/** The event's building: prefer the footprint the point is INSIDE (point-in-
 *  polygon) — that's the actual venue building — and only fall back to the
 *  nearest by centroid when the point isn't inside any. Fixes the "painted the
 *  neighbour" glitch the old nearest-centroid-only heuristic caused. Only finds
 *  RENDERED buildings, so the point must be on-screen. */
function buildingUnder(map: maplibregl.Map, lngLat: maplibregl.LngLatLike): Hl | null {
  const queryLayers = ["cs-building-3d", "cs-building"].filter((l) => map.getLayer(l))
  if (!queryLayers.length) return null
  const c0 = maplibregl.LngLat.convert(lngLat)
  const pt: [number, number] = [c0.lng, c0.lat]
  const p = map.project(lngLat)
  // Tight candidate box — enough to catch the footprint under (or just beside)
  // the point without pulling in the far neighbours the old 40px box grabbed.
  const R = 22
  const hits = map.queryRenderedFeatures([[p.x - R, p.y - R], [p.x + R, p.y + R]], { layers: queryLayers })
  let best: maplibregl.MapGeoJSONFeature | null = null, bestD = Infinity
  let inside: maplibregl.MapGeoJSONFeature | null = null, insideD = Infinity
  hits.forEach((f) => {
    if (f.id == null) return
    const c = polyCentroid(f.geometry); if (!c) return
    const cp = map.project(c)
    const d = (cp.x - p.x) ** 2 + (cp.y - p.y) ** 2
    if (d < bestD) { bestD = d; best = f }
    if (pointInPolygon(pt, f.geometry) && d < insideD) { insideD = d; inside = f }
  })
  // Prefer the footprint the point is INSIDE. Only fall back to the nearest
  // when the centroid is very close (~14px) — otherwise a point on a road /
  // courtyard would paint an unrelated neighbour.
  const chosen = (inside || (bestD < 14 * 14 ? best : null)) as maplibregl.MapGeoJSONFeature | null
  if (!chosen) return null
  const bf = chosen
  const ref: BldgRef = { source: bf.source, sourceLayer: bf.sourceLayer as string, id: bf.id as string | number }
  return {
    key: `${ref.source}/${ref.sourceLayer}/${ref.id}`,
    feat: { type: "Feature", geometry: inflate(bf.geometry), properties: bf.properties || {} },
  }
}

export default function MapIntro({ events, onEnter }: { events: Ev[]; onEnter: () => void }) {
  useCsKeyframes()
  const openEvent = useOpenEvent()
  const openRef = useRef(openEvent); openRef.current = openEvent

  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const fitAllRef = useRef<() => void>(() => {})
  const pendulumStopRef = useRef<() => void>(() => {})
  const hlTokenRef = useRef(0)
  const hlBuildingsRef = useRef<Hl[]>([]) // all currently-lit event buildings
  const leaderSvgRef = useRef<SVGSVGElement | null>(null) // overlay for card→building leaders
  const leadersRef = useRef<{ card: [number, number]; target: [number, number]; i: number }[]>([])
  const deckWrapRef = useRef<HTMLDivElement | null>(null) // the cluster deck marker element
  const deckMembersRef = useRef<Ev[]>([])
  const zoneMarkersRef = useRef<Record<string, HTMLElement>>({})
  const scatterRef = useRef<maplibregl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [headOpen, setHeadOpen] = useState(true) // heading card collapse
  const [deckHidden, setDeckHidden] = useState(false) // hide the deck to reveal the centred building
  const [selZone, setSelZone] = useState<string | null>(null)
  const [selCluster, setSelCluster] = useState<number | null>(null)
  const [evIdx, setEvIdx] = useState(0)
  const evIdxRef = useRef(0); evIdxRef.current = evIdx
  const selZoneRef = useRef<string | null>(null); selZoneRef.current = selZone
  const selClusterRef = useRef<number | null>(null); selClusterRef.current = selCluster

  // Draw a single leader line — only for the ACTIVE card — to its building's
  // ground point. Runs every map frame (via the `render` event) so it tracks
  // pan/zoom. Showing every card's line at once was a scary starburst when many
  // events share one building; one thin line for the card you're on is clean.
  const drawLeaders = () => {
    const map = mapRef.current, svg = leaderSvgRef.current
    if (!map || !svg) return
    const ld = leadersRef.current[0]
    if (!ld) { if (svg.childNodes.length) svg.replaceChildren(); return }
    const a = map.project([ld.card[1], ld.card[0]])     // card anchor (bottom of card)
    const b = map.project([ld.target[1], ld.target[0]]) // building ground point
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 16) { if (svg.childNodes.length) svg.replaceChildren(); return } // card on its building
    const ux = dx / len, uy = dy / len
    const hx = b.x - ux * 8, hy = b.y - uy * 8 // arrowhead base, backed off the tip
    const px = -uy, py = ux, w = 4
    const f = (n: number) => n.toFixed(1)
    svg.innerHTML =
      `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(hx)}" y2="${f(hy)}" stroke="#0D0D0D" stroke-width="1.75" stroke-dasharray="1 4" stroke-linecap="round"/>` +
      `<polygon points="${f(b.x)},${f(b.y)} ${f(hx + px * w)},${f(hy + py * w)} ${f(hx - px * w)},${f(hy - py * w)}" fill="#0D0D0D"/>`
  }
  const drawLeadersRef = useRef(drawLeaders); drawLeadersRef.current = drawLeaders

  // Light EVERY event building in the current cluster at once — not just the
  // active card. Buildings only render at zoom ≥14, so this runs once the
  // cluster view has zoomed in: queryRenderedFeatures finds each member's
  // footprint (point-in-polygon) and we push them all into the blue overlay
  // layer. Merged, so panning/swiping between cards never drops an already-lit
  // building; a single `idle` retry catches footprints whose tiles hadn't
  // loaded yet.
  const lightClusterBuildings = (cl: Cluster, token: number) => {
    const map = mapRef.current
    if (!map || !cl) return
    if (map.getZoom() < 13.5) return // buildings not rendered yet
    const collect = (retry: boolean) => {
      if (hlTokenRef.current !== token) return // superseded by a newer zone/cluster
      const seen = new Set(hlBuildingsRef.current.map((h) => h.key))
      const union = [...hlBuildingsRef.current]
      let found = 0
      // Light the building under each event's REAL coord (e.geo) — NOT the fanned
      // card position (cl.pts). Co-located events share e.geo, so they collapse
      // to ONE building (the true venue), instead of painting random neighbours
      // under the spread-out cards.
      cl.members.forEach((ev) => {
        const g = ev.geo; if (!g) return
        const b = buildingUnder(map, [g[1], g[0]]) // g = [lat,lng]
        if (b) { found++; if (!seen.has(b.key)) { seen.add(b.key); union.push(b) } }
      })
      hlBuildingsRef.current = union
      renderEventBuildings(map, union)
      if (retry && found < cl.members.length) map.once("idle", () => collect(false))
    }
    collect(true)
  }
  const lightClusterRef = useRef(lightClusterBuildings); lightClusterRef.current = lightClusterBuildings

  // Recenter on the active card (keeps it framed) then (re)light the cluster.
  // Rebuild the deck's DOM for a given active index + (re)wire its ← / → / open
  // handlers. One marker, updated in place, so paging doesn't recreate it.
  const renderDeck = (idx: number) => {
    const wrap = deckWrapRef.current
    if (!wrap) return
    const members = deckMembersRef.current
    const n = members.length
    if (!n) return
    const i = ((idx % n) + n) % n
    const e = members[i]
    // Build the shell + wire handlers once per cluster (wrap is recreated on
    // cluster change, so a fresh wrap has no .cs-deck yet).
    if (!wrap.querySelector(".cs-deck")) {
      const nav = n > 1
        ? `<div class="cs-deck-nav"><button class="cs-deck-prev" type="button" aria-label="назад">←</button><span class="cs-deck-count"></span><button class="cs-deck-next" type="button" aria-label="вперёд">→</button></div>`
        : ""
      wrap.innerHTML = `<div class="cs-pola cs-deck"><div class="cs-deck-place-slot"></div><div class="cs-deck-right"><div class="cs-deck-stack-slot"></div>${nav}</div></div>`
      wrap.dataset.venue = " " // sentinel → force the first place render
      wrap.querySelector(".cs-deck-prev")?.addEventListener("click", (ev) => { ev.stopPropagation(); setEvIdx((x) => (x - 1 + n) % n) })
      wrap.querySelector(".cs-deck-next")?.addEventListener("click", (ev) => { ev.stopPropagation(); setEvIdx((x) => (x + 1) % n) })
      wrap.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement
        // «Центрировать карту» — плавно наводим на здание активного события
        // (оно уже подсвечено синим), с зумом на площадку.
        if (t.closest?.(".cs-deck-center")) {
          ev.stopPropagation()
          const map = mapRef.current
          const g = deckMembersRef.current[evIdxRef.current]?.geo
          if (map && Array.isArray(g)) {
            // hide the cards so the (blue) building is actually visible. Use
            // display:none — MapLibre resets a marker's `opacity` to 1 on every
            // move, so opacity:0 would be wiped by the easeTo below.
            if (deckWrapRef.current) deckWrapRef.current.style.display = "none"
            setDeckHidden(true)
            setFocus(map, g as [number, number]) // reliable blue dot on the venue
            map.easeTo({ center: [g[1], g[0]], zoom: 16.6, pitch: 52, bearing: -14, duration: 650 })
            // re-light after zooming in so the venue building is definitely blue
            map.once("moveend", () => { const c = clustersRef.current[selZoneRef.current || ""]?.[selClusterRef.current ?? -1]; if (c) lightClusterRef.current(c, hlTokenRef.current) })
          }
          return
        }
        if (t.closest?.(".cs-deck-front")) openRef.current(deckMembersRef.current[evIdxRef.current] ?? deckMembersRef.current[0])
      })
    }
    // Place card — update ONLY when the venue changes, so paging same-venue
    // events doesn't re-render (flicker) the identical place card.
    const vk = e.venueKey || ""
    if (wrap.dataset.venue !== vk) {
      const slot = wrap.querySelector(".cs-deck-place-slot")
      const vi = venueInfo(vk)
      if (slot) slot.innerHTML = vi ? placeCardHTML(vi) : ""
      wrap.dataset.venue = vk
    }
    // Event card + counter — always update on paging.
    const stackSlot = wrap.querySelector(".cs-deck-stack-slot")
    if (stackSlot) stackSlot.innerHTML = eventStackHTML(members, i)
    const count = wrap.querySelector(".cs-deck-count")
    if (count) count.textContent = `${i + 1} / ${n}`
  }
  const renderDeckRef = useRef(renderDeck); renderDeckRef.current = renderDeck

  // group real geocoded events by centre-disk + directional sector
  const byZone = useMemo(() => {
    const m: Record<string, Ev[]> = {}
    ZONES.forEach((z) => (m[z.id] = []))
    events.forEach((e) => {
      if (e.geo && inMoscow(e.geo[0], e.geo[1])) m[zoneOf(e.geo[0], e.geo[1])].push(e)
    })
    return m
  }, [events])
  const byZoneRef = useRef(byZone); byZoneRef.current = byZone
  const totalPlaced = useMemo(() => Object.values(byZone).reduce((a, b) => a + b.length, 0), [byZone])
  // sys-fan clusters per zone (real-proximity grouping)
  const clustersByZone = useMemo(() => {
    const m: Record<string, Cluster[]> = {}
    ZONES.forEach((z) => { m[z.id] = clusterByProximity(byZone[z.id]) })
    return m
  }, [byZone])
  const clustersRef = useRef(clustersByZone); clustersRef.current = clustersByZone
  const onZone = (id: string) => setSelZone((p) => (p === id ? null : id))
  const onZoneRef = useRef(onZone); onZoneRef.current = onZone

  const zoneMlRef = useRef<maplibregl.Marker[]>([])
  /** (Re)place the district bubble markers. Runs on map load AND when the feed
   *  data arrives — so zones still appear if the curator responded only after
   *  the map finished loading (they used to be placed once → lost that race). */
  const placeZones = () => {
    const map = mapRef.current
    if (!map) return
    zoneMlRef.current.forEach((m) => m.remove())
    zoneMlRef.current = []
    zoneMarkersRef.current = {}
    ZONES.forEach((z) => {
      // render ALL districts — empty ones show a pulsing ghost + name
      const el = zoneBubbleEl(z, byZoneRef.current[z.id], (id) => onZoneRef.current(id))
      zoneMarkersRef.current[z.id] = el
      const mk = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([z.dll[1], z.dll[0]]).addTo(map)
      zoneMlRef.current.push(mk)
    })
  }
  const placeZonesRef = useRef(placeZones); placeZonesRef.current = placeZones

  // reset drill-down + carousel when the zone or cluster changes
  useEffect(() => { setSelCluster(null) }, [selZone])
  useEffect(() => { setEvIdx(0) }, [selZone, selCluster])

  // (re)place district bubbles when the feed data lands — covers the case where
  // the curator answered after the map loaded. Skip while a zone is open so an
  // in-flight refresh doesn't disturb the current drill-down.
  useEffect(() => {
    if (ready && selZone == null) placeZonesRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byZone, ready])

  // create map + zone markers once
  useEffect(() => {
    if (!boxRef.current) return
    let map: maplibregl.Map | null = null
    try {
      map = new maplibregl.Map({
        container: boxRef.current, style: CS_STYLE_LIGHT, center: MSK, zoom: 10.5,
        pitch: 52, bearing: -14, antialias: true, attributionControl: { compact: true },
      })
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right")
      map.on("error", () => setFailed(true))
      mapRef.current = map
      map.on("load", () => {
        if (!map) return
        // v7 csbrand: фирменный стиль уже содержит 3D-дома (cs-building-3d) —
        // добавляем только кинематографичное небо + туман у горизонта.
        applyCinematicSky(map, false)
        ensureEventBuildingsLayer(map) // blue overlay for event buildings

        // SVG overlay for card→building leader lines (drawn every frame so they
        // track the map). Sits above the canvas, below the DOM card markers.
        if (boxRef.current && !leaderSvgRef.current) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
          svg.setAttribute("class", "cs-leader-svg")
          boxRef.current.appendChild(svg)
          leaderSvgRef.current = svg
        }
        map.on("render", () => drawLeadersRef.current())

        placeZonesRef.current() // district bubbles (re-placed later if data was slow)
        // Fixed view anchored on central Moscow — NOT fitBounds, which would
        // centre on the midpoint of whatever districts happen to exist and
        // drift east when only Центр+Восток are populated. Padding offsets the
        // centre below the heading card so the central districts sit in view.
        const VIEW = { center: [37.6190, 55.7600] as [number, number], zoom: 10.4, pitch: 52, bearing: -14, padding: { top: 230, bottom: 170, left: 0, right: 0 } }
        fitAllRef.current = () => map!.easeTo({ ...VIEW, duration: 700 })
        map.jumpTo(VIEW)
        setReady(true)

        // gentle camera pendulum until the user touches the map
        const baseBearing = map.getBearing()
        const startT = performance.now()
        let raf = 0, stopped = false
        const stop = () => { stopped = true; cancelAnimationFrame(raf); ["mousedown", "touchstart", "wheel", "dragstart"].forEach((ev) => map!.off(ev as any, stop)) }
        ;["mousedown", "touchstart", "wheel", "dragstart"].forEach((ev) => map!.on(ev as any, stop))
        pendulumStopRef.current = stop
        const tick = (now: number) => {
          // Stop the wobble once a zone is picked — otherwise the per-frame
          // setBearing interrupts the zone fitBounds easeTo (tapping a DOM
          // marker doesn't fire the map's mousedown, so `stop` never triggers).
          if (stopped || !mapRef.current || selZoneRef.current) return
          map!.setBearing(baseBearing + 13 * Math.sin(((now - startT) * 2 * Math.PI) / 30000))
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      })
    } catch { setFailed(true) }
    return () => { try { map?.remove() } catch { /* noop */ } finally { mapRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // explode / collapse selected zone
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    // clear previous scatter + building highlight
    scatterRef.current.forEach((m) => m.remove())
    scatterRef.current = []
    const hlToken = ++hlTokenRef.current
    hlBuildingsRef.current = []
    renderEventBuildings(map, [])
    leadersRef.current = []
    drawLeadersRef.current()
    setFocus(map, null)
    setDeckHidden(false) // a fresh zone/cluster always shows its deck
    // toggle zone bubble states
    ZONES.forEach((z) => {
      const el = zoneMarkersRef.current[z.id]
      if (!el) return
      el.classList.toggle("cs-zone-exploded", selZone === z.id)
      el.classList.toggle("cs-zone-sel", selZone === z.id)
      el.classList.toggle("cs-zone-dim", !!selZone && selZone !== z.id)
      const bub = el.querySelector<HTMLElement>(".cs-zone-bubble")
      if (bub) bub.style.display = selZone === z.id ? "none" : ""
    })
    if (!selZone) { fitAllRef.current(); return }
    // Stop the idle wobble before any programmatic camera move — its per-frame
    // setBearing would otherwise cancel the easeTo (a DOM-marker tap never fires
    // the map's mousedown, so the auto-stop on interaction doesn't trigger).
    pendulumStopRef.current()

    const clusters = clustersRef.current[selZone] || []
    if (selCluster == null) {
      // Level 1 — cluster fans at real member centroids; tap drills in.
      clusters.forEach((cl, gi) => {
        const el = clusterFanEl(cl, gi)
        el.style.cursor = "pointer"
        el.addEventListener("click", (ev) => { ev.stopPropagation(); setSelCluster(gi) })
        const m = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([cl.ll[1], cl.ll[0]]).addTo(map)
        scatterRef.current.push(m)
      })
      // easeTo a fixed zoom on the event-weighted centroid — robust to a single
      // far-flung event (which would blow up a fitBounds and leave the view at
      // city scale), and immune to the pitched-camera fitBounds under-zoom.
      if (clusters.length) {
        let sx = 0, sy = 0, n = 0
        clusters.forEach((c) => { sx += c.ll[1] * c.members.length; sy += c.ll[0] * c.members.length; n += c.members.length })
        map.easeTo({ center: [sx / n, sy / n], zoom: 12.6, pitch: 52, bearing: -14, duration: 800 })
      }
    } else {
      // Level 2 — ONE fanned deck at the cluster centre; browse with ← →.
      const cl = clusters[selCluster]
      if (cl) {
        const wrap = document.createElement("div")
        wrap.className = "cs-scatter-wrap"
        deckMembersRef.current = cl.members
        deckWrapRef.current = wrap
        renderDeckRef.current(0)
        // anchor "bottom" at the cluster centroid; the leader points from here
        // down to the active event's real building.
        const m = new maplibregl.Marker({ element: wrap, anchor: "bottom", offset: [0, -6] }).setLngLat([cl.ll[1], cl.ll[0]]).addTo(map)
        scatterRef.current.push(m)
        leadersRef.current = [{ card: cl.ll, target: (cl.members[0]?.geo as [number, number]) ?? cl.ll, i: 0 }]
        drawLeadersRef.current()
        // Ease to the centroid at building-visible zoom; lightClusterBuildings
        // then lights every event building in the cluster. Pass the captured cl
        // + token so it can't drift onto a re-clustered/stale member set.
        map.easeTo({ center: [cl.ll[1], cl.ll[0]], zoom: 15, pitch: 52, bearing: -14, duration: 700 })
        map.once("moveend", () => { if (hlTokenRef.current === hlToken) { lightClusterRef.current(cl, hlToken); drawLeadersRef.current() } })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selZone, selCluster, ready])

  // Paging the deck: rebuild its front card + re-point the leader at the new
  // active event's building. No camera move — the deck stays put.
  useEffect(() => {
    if (selCluster == null) return
    renderDeckRef.current(evIdx)
    const members = deckMembersRef.current
    const ld = leadersRef.current[0]
    const g = members[evIdx]?.geo
    if (ld && Array.isArray(g)) ld.target = g as [number, number]
    drawLeadersRef.current()
  }, [evIdx, selZone, selCluster])

  const activeCluster = selZone != null && selCluster != null ? (clustersByZone[selZone]?.[selCluster] ?? null) : null
  const deckEvents = activeCluster ? activeCluster.members : (selZone ? byZone[selZone] : [])
  const zoneCount = ZONES.filter((z) => byZone[z.id].length).length

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "#E4E4E1", animation: "cs-mapintro-in 0.4s ease both", fontFamily: FONT_SANS }}>
      {!failed && <div ref={boxRef} style={{ position: "absolute", inset: 0, isolation: "isolate", background: "#E4E4E1" }} />}
      {failed && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#16213a,#0d0d0d)" }} />}

      {/* subtle scrims for legibility */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150, background: "linear-gradient(rgba(13,13,13,0.18), rgba(13,13,13,0))", zIndex: 6, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 180, background: "linear-gradient(rgba(13,13,13,0), rgba(13,13,13,0.22))", zIndex: 6, pointerEvents: "none" }} />

      {/* heading card — brutalist (design MapHeading · classic); collapsible */}
      {headOpen ? (
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 16px)", left: 14, right: 14, zIndex: 10 }}>
        <div style={{ position: "relative", background: CS.W, border: `2.5px solid ${CS.K}`, boxShadow: `4px 4px 0 ${CS.K}`, padding: "12px 14px" }}>
          <button onClick={() => setHeadOpen(false)} aria-label="скрыть шапку" style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, border: `2px solid ${CS.K}`, background: CS.W, cursor: "pointer", fontSize: 13, fontWeight: 900, lineHeight: 1, color: CS.K, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(13,13,13,0.55)" }}>сначала — карта · WK 22</div>
          <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 34, letterSpacing: "-0.045em", lineHeight: 0.9, color: CS.K, marginTop: 6 }}>Что рядом</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 11 }}>
            <span style={{ background: CS.B, color: "#fff", padding: "3px 9px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{totalPlaced} событий · {zoneCount} районов</span>
            <span style={{ background: CS.W, color: CS.K, border: `1.5px solid ${CS.K}`, padding: "2px 7px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>движок · CitySignal · 3D</span>
          </div>
        </div>
      </div>
      ) : (
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 16px)", left: 14, zIndex: 10 }}>
        <button onClick={() => setHeadOpen(true)} aria-label="показать шапку" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: CS.W, border: `2.5px solid ${CS.K}`, boxShadow: `3px 3px 0 ${CS.K}`, padding: "7px 11px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 14, letterSpacing: "-0.02em", color: CS.K, textTransform: "uppercase" }}>
          Что рядом
          <span style={{ background: CS.B, color: "#fff", fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, padding: "1.5px 5px", letterSpacing: "0.02em" }}>{totalPlaced}</span>
          <span style={{ fontSize: 11, lineHeight: 1 }}>▾</span>
        </button>
      </div>
      )}

      {/* «Показать карточки» — возвращает колоду после «Центрировать карту» */}
      {selCluster != null && deckHidden && (
        <div style={{ position: "absolute", top: "30%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 11, pointerEvents: "none" }}>
          <button
            onClick={() => { if (deckWrapRef.current) deckWrapRef.current.style.display = "" ; if (mapRef.current) setFocus(mapRef.current, null); setDeckHidden(false) }}
            style={{ pointerEvents: "auto", display: "inline-flex", alignItems: "center", gap: 8, background: CS.K, color: "#fff", border: `2.5px solid ${CS.K}`, boxShadow: `3px 3px 0 ${CS.B}`, padding: "9px 15px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 13, letterSpacing: "0.02em", textTransform: "uppercase" }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>↑</span> Показать карточки
          </button>
        </div>
      )}

      {/* bottom — hint + «Вся лента» CTA (hidden when a zone is open) */}
      {!selZone && (
        <div style={{ position: "absolute", left: 14, right: 14, bottom: "calc(env(safe-area-inset-bottom,0px) + 10px)", zIndex: 10 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: CS.W, border: `2px solid ${CS.K}`, boxShadow: `2px 2px 0 ${CS.K}`, padding: "6px 11px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", color: CS.K, transform: "rotate(-0.8deg)" }}>
              <span style={{ width: 8, height: 8, background: CS.B, borderRadius: "50%" }} />тапни район на карте
            </span>
          </div>
          <button onClick={onEnter} style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 18px", border: `3px solid ${CS.K}`, background: CS.K, color: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 16, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: `4px 4px 0 ${CS.B}` }}>
            <span>Вся лента</span><span style={{ fontSize: 19, lineHeight: 1 }}>→</span>
          </button>
        </div>
      )}

      {/* district bottom-sheet — selected zone deck */}
      {selZone && deckEvents.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 12, background: CS.W, borderTop: `3px solid ${CS.K}`, boxShadow: "0 -6px 0 rgba(13,13,13,0.08)", animation: "cs-sheet-up 0.34s cubic-bezier(0.22,1,0.36,1) both", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "9px 14px 6px" }}>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(13,13,13,0.55)" }}>{activeCluster ? `кластер · ${ZONE_BY_ID[selZone].t}` : `район · ${ZONE_BY_ID[selZone].sub}`}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 1 }}>
                <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.04em", lineHeight: 0.9, color: CS.K, textTransform: "uppercase" }}>{activeCluster ? "Места рядом" : ZONE_BY_ID[selZone].t}</span>
                <span style={{ background: CS.B, color: "#fff", padding: "2px 6px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em" }}>{deckEvents.length} событий</span>
              </div>
            </div>
            <button onClick={() => (activeCluster ? setSelCluster(null) : setSelZone(null))} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: CS.W, border: `2px solid ${CS.K}`, padding: "4px 8px", cursor: "pointer", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: CS.K }}>{activeCluster ? "← кластеры" : "← все районы"}</button>
          </div>
          {/* level 1 (clusters): hint to drill in · level 2 (cluster): event carousel */}
          {!activeCluster ? (
            <div style={{ padding: "0 14px 11px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: CS.W, border: `2px solid ${CS.K}`, boxShadow: `2px 2px 0 ${CS.K}`, padding: "7px 11px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", color: CS.K }}>
                <span style={{ width: 8, height: 8, background: CS.B, borderRadius: "50%" }} />тапни кластер, чтобы раскрыть
              </div>
            </div>
          ) : (
          <div style={{ padding: "0 14px 11px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: CS.W, border: `2px solid ${CS.K}`, boxShadow: `2px 2px 0 ${CS.K}`, padding: "7px 11px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", color: CS.K }}>
              <span style={{ width: 8, height: 8, background: CS.B, borderRadius: "50%" }} />карточки — на карте · листай ← →
            </div>
          </div>
          )}
          <div style={{ padding: "0 14px 12px" }}>
            <button onClick={onEnter} style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 18px", border: `2.5px solid ${CS.K}`, background: CS.K, color: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: `3px 3px 0 ${CS.B}` }}>
              <span>Открыть район в ленте</span><span style={{ fontSize: 15, lineHeight: 1 }}>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
