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
import { VENUE_FOOTPRINTS } from "./venueFootprints"

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
// 1.8km (was 3.0): the 3km centre swallowed ~half of all events into «Центр».
// A tighter core pushes the 2–3km ring out to its real directional sector.
const R_CENTER_KM = 1.8
// clusters shown per page (map fans + sheet list) once a district is opened —
// kept small so the sheet stays short and the map stays visible above it
const PER_PAGE = 4

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
  // a bubble poster that 404s → hide it in place (no global bad-image tracking)
  el.querySelectorAll("img").forEach((im) => im.addEventListener("error", () => { (im as HTMLElement).style.display = "none" }))
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

/** Cluster fan marker (v7 makeClusterEl): up to 3 posters + a NUMBER badge
 *  (matches the numbered list in the sheet) + the event count + a place label.
 *  A lone poster sits upright and centred (no fan tilt). */
function clusterFanEl(cl: Cluster, gi: number): HTMLElement {
  const fan = cl.members.slice(0, 3)
  const single = fan.length === 1
  const rots = [-12, 0, 12]
  const thumbs = fan.map((e, i) =>
    `<span class="cs-clu-card" style="--zr:${single ? 0 : (rots[i] || 0)}deg;--zz:${single ? 1 : i}">${e.p ? `<img src="${e.p}" alt="" data-eid="${esc(e.id)}"/>` : ""}</span>`,
  ).join("")
  const { name } = clusterLabel(cl)
  const wrap = document.createElement("div")
  wrap.className = "cs-scatter-wrap"
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;"
  wrap.innerHTML =
    `<div class="cs-clu${single ? " cs-clu-single" : ""}" style="--si:${gi}"><div class="cs-clu-fan">${thumbs}` +
    `<span class="cs-clu-num">${gi + 1}</span>` +
    `<span class="cs-clu-count">${cl.members.length}</span></div>` +
    `<div class="cs-clu-name">${esc(name)}</div></div>`
  return wrap
}

/** Human label for a cluster: its dominant known venue, else the members'
 *  venue/channel text. Used by the numbered list in the sheet. */
function clusterLabel(cl: Cluster): { name: string; sub: string } {
  const counts = new Map<string, number>()
  cl.members.forEach((e) => { if (e.venueKey) counts.set(e.venueKey, (counts.get(e.venueKey) || 0) + 1) })
  let bestKey = "", bestN = 0
  counts.forEach((n, k) => { if (n > bestN) { bestN = n; bestKey = k } })
  const vi = venueInfo(bestKey)
  if (vi) return { name: vi.name, sub: vi.address || vi.kind }
  // No known venue: title = a REAL location text (Ev.v is `location || "@channel"`,
  // so skip the bare @handle), else a friendly generic; the channel goes to the
  // subtitle where a raw handle reads fine.
  const e = cl.members[0]
  const loc = e?.v && e.v !== "—" && !e.v.startsWith("@") ? e.v : ""
  return { name: loc || "Места рядом", sub: e?.ch || RU_PLURAL(cl.members.length) }
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
      `<div class="cs-pola-img">${e.p ? `<img src="${e.p}" alt="" data-eid="${esc(e.id)}"/>` : ""}</div>` +
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
    (vi.img ? `<div class="cs-deck-place-img"><img class="cs-deck-place-bg" src="${vi.img}" alt=""/><img class="cs-deck-place-fg" src="${vi.img}" alt=""/></div>` : "") +
    `<div class="cs-deck-place-body">` +
      `<div class="cs-deck-place-kind">место · ${esc(vi.kind)}</div>` +
      `<div class="cs-deck-place-name">${esc(vi.name)}</div>` +
      `<div class="cs-deck-place-blurb">${esc(vi.blurb)}</div>` +
      (vi.address ? `<div class="cs-deck-place-addr">📍 ${esc(vi.address)}</div>` : "") +
      `<button class="cs-deck-center" type="button">Показать на карте</button>` +
      `<button class="cs-deck-yandex" type="button" data-q="${esc(vi.name + (vi.address ? ", " + vi.address : ""))}">Яндекс.Карты →</button>` +
    `</div>` +
  `</div>`
}

/** Open an external URL from inside the Telegram mini-app (falls back to a
 *  normal new tab when running in a plain browser). */
function openExternalMap(url: string): void {
  const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp
  if (tg?.openLink) tg.openLink(url)
  else window.open(url, "_blank", "noopener")
}

/** Yandex.Maps deep-link: a dropped pin at exact coords, else an address search. */
function yandexMapsUrl(geo: [number, number] | null | undefined, query: string): string {
  if (Array.isArray(geo) && geo.length === 2) {
    const [lat, lng] = geo
    return `https://yandex.ru/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat},pm2rdm`
  }
  return `https://yandex.ru/maps/?text=${encodeURIComponent(query)}`
}

// ── Highlight event venues (signal-blue) ────────────────────────────────────
// A venue's building is drawn from a PRECOMPUTED OSM footprint (venueFootprints)
// into our own geojson fill-extrusion layer — deterministic, no dependence on
// MapTiler's (often-missing) building tiles or live queryRenderedFeatures, and
// bleed-proof (unlike feature-state, whose ids repeat across tiles). The overlay
// is opaque + inflated ~4% so it fully covers the grey building (no z-fighting).
// Venues with no building (metro, parks, aggregators) get a blue dot instead.
const EVT_BLDG_SRC = "cs-evt-bldg"
const EVT_BLDG_LAYER = "cs-evt-bldg-fill"
const FOCUS_SRC = "cs-focus"

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

/** Show blue focus dots for point-type venues (coords already [lng,lat]). */
function renderVenueDots(map: maplibregl.Map, coords: [number, number][]) {
  const src = map.getSource(FOCUS_SRC) as maplibregl.GeoJSONSource | undefined
  if (!src) return
  src.setData({ type: "FeatureCollection", features: coords.map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: {} })) })
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

/** Paint the given building footprints (blue extrusions) into the overlay. */
function renderEventBuildings(map: maplibregl.Map, features: GeoJSON.Feature[]) {
  const src = map.getSource(EVT_BLDG_SRC) as maplibregl.GeoJSONSource | undefined
  if (src) src.setData({ type: "FeatureCollection", features })
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

/** Build a blue-building overlay Feature from a stored footprint ring ([lng,lat]).
 *  Inflated ~4% so it fully covers the grey MapTiler building beneath it. */
function footprintFeature(ring: [number, number][]): GeoJSON.Feature {
  return { type: "Feature", geometry: inflate({ type: "Polygon", coordinates: [ring] }), properties: {} }
}

export default function MapIntro({ events, onEnter }: { events: Ev[]; onEnter: () => void }) {
  useCsKeyframes()
  const openEvent = useOpenEvent()
  const openRef = useRef(openEvent); openRef.current = openEvent

  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const fitAllRef = useRef<() => void>(() => {})
  const pendulumStopRef = useRef<() => void>(() => {})
  const leaderSvgRef = useRef<SVGSVGElement | null>(null) // overlay for card→building leaders
  const leaderNodesRef = useRef<{ line: SVGLineElement; poly: SVGPolygonElement } | null>(null) // reused leader nodes
  const leadersRef = useRef<{ card: [number, number]; target: [number, number]; i: number }[]>([])
  const deckWrapRef = useRef<HTMLDivElement | null>(null) // the cluster deck marker element
  const deckMembersRef = useRef<Ev[]>([])
  const zoneMarkersRef = useRef<Record<string, HTMLElement>>({})
  const scatterRef = useRef<maplibregl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  // A poster that 404s at runtime is hidden IN PLACE (its <img> is display:none'd,
  // leaving a clean blank card frame). We deliberately do NOT remove the event
  // from clustering: doing that mutated a global Set → re-clustered + re-sorted →
  // the explode effect re-ran and the dense «Центр» fans reshuffled/repositioned
  // for the first few seconds as posters streamed in («всё летает при открытии»).
  const [headOpen, setHeadOpen] = useState(true) // heading card collapse
  const [deckHidden, setDeckHidden] = useState(false) // hide the deck to reveal the centred building
  const [selZone, setSelZone] = useState<string | null>(null)
  const [selCluster, setSelCluster] = useState<number | null>(null)
  const [selPage, setSelPage] = useState(0)  // page within the opened district (Level 1)
  const [evIdx, setEvIdx] = useState(0)
  const evIdxRef = useRef(0); evIdxRef.current = evIdx
  const selZoneRef = useRef<string | null>(null); selZoneRef.current = selZone
  const selClusterRef = useRef<number | null>(null); selClusterRef.current = selCluster
  // Reset drill-down + page SYNCHRONOUSLY when the district changes — during
  // render, not in an effect. An effect fires AFTER the commit, so for one
  // painted frame the sheet + map fans showed the PREVIOUS district's open
  // cluster (or its non-zero page) before snapping back to page 0. That 1-frame
  // swap was the "cards appear, then immediately change to another set" flicker.
  // Adjusting state during render makes React restart the render before it
  // paints, so the stale frame never shows. (Guarded by the ref → no loop.)
  const prevSelZoneRef = useRef(selZone)
  if (prevSelZoneRef.current !== selZone) {
    prevSelZoneRef.current = selZone
    if (selCluster !== null) setSelCluster(null)
    if (selPage !== 0) setSelPage(0)
  }
  // zone whose overview camera is already fit — so paging (selPage) doesn't
  // re-fly the camera each tap (that 800ms easeTo per page was the jank)
  const overviewFitRef = useRef<string | null>(null)
  const deckHiddenRef = useRef(false); deckHiddenRef.current = deckHidden

  // Draw a single leader line — only for the ACTIVE card — to its building's
  // ground point. Runs every map frame (via the `render` event) so it tracks
  // pan/zoom. Showing every card's line at once was a scary starburst when many
  // events share one building; one thin line for the card you're on is clean.
  const drawLeaders = () => {
    const map = mapRef.current, svg = leaderSvgRef.current
    if (!map || !svg) return
    const hide = () => {
      const n = leaderNodesRef.current
      if (n) { n.line.style.display = "none"; n.poly.style.display = "none" }
    }
    // No leader while the deck is hidden («Центрировать карту») — otherwise the
    // dashed line keeps drawing from the invisible card to the building.
    if (deckHiddenRef.current) return hide()
    const ld = leadersRef.current[0]
    if (!ld) return hide()
    const a = map.project([ld.card[1], ld.card[0]])     // card anchor (bottom of card)
    const b = map.project([ld.target[1], ld.target[0]]) // building ground point
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 16) return hide() // card on its building
    const ux = dx / len, uy = dy / len
    const hx = b.x - ux * 8, hy = b.y - uy * 8 // arrowhead base, backed off the tip
    const px = -uy, py = ux, w = 4
    const f = (n: number) => n.toFixed(1)
    // Build the two leader nodes ONCE, then only mutate their geometry attrs on
    // each frame — reassigning svg.innerHTML re-parsed the SVG markup ~60×/sec
    // during a Level-2 pan.
    let nodes = leaderNodesRef.current
    if (!nodes) {
      const NS = "http://www.w3.org/2000/svg"
      const line = document.createElementNS(NS, "line")
      line.setAttribute("stroke", "#0D0D0D"); line.setAttribute("stroke-width", "1.75")
      line.setAttribute("stroke-dasharray", "1 4"); line.setAttribute("stroke-linecap", "round")
      const poly = document.createElementNS(NS, "polygon")
      poly.setAttribute("fill", "#0D0D0D")
      svg.appendChild(line); svg.appendChild(poly)
      nodes = leaderNodesRef.current = { line, poly }
    }
    nodes.line.style.display = ""; nodes.poly.style.display = ""
    nodes.line.setAttribute("x1", f(a.x)); nodes.line.setAttribute("y1", f(a.y))
    nodes.line.setAttribute("x2", f(hx)); nodes.line.setAttribute("y2", f(hy))
    nodes.poly.setAttribute("points", `${f(b.x)},${f(b.y)} ${f(hx + px * w)},${f(hy + py * w)} ${f(hx - px * w)},${f(hy - py * w)}`)
  }
  const drawLeadersRef = useRef(drawLeaders); drawLeadersRef.current = drawLeaders

  // Scale the deck WITH the map zoom so it doesn't dominate the view when you
  // zoom out (constant-px markers otherwise stay huge over a tiny map). Scale
  // tracks the map (2^Δzoom from the cluster's home zoom 15), clamped so cards
  // never vanish or get absurd. Applied to the inner .cs-deck (the marker sets
  // its own transform on the wrap, so we scale a child to avoid clobbering it).
  const DECK_REF_ZOOM = 15
  const scaleDeck = () => {
    const map = mapRef.current, wrap = deckWrapRef.current
    if (!map || !wrap) return
    const inner = wrap.firstElementChild as HTMLElement | null // .cs-pola.cs-deck
    if (!inner) return
    const s = Math.min(1.2, Math.max(0.34, Math.pow(2, map.getZoom() - DECK_REF_ZOOM)))
    inner.style.transformOrigin = "bottom center"
    inner.style.transform = `scale(${s.toFixed(3)})`
  }
  const scaleDeckRef = useRef(scaleDeck); scaleDeckRef.current = scaleDeck

  // Mark every venue in the cluster: a precomputed building footprint → a blue
  // building; a venue with no footprint (metro/park/aggregator) → a blue dot.
  // Fully deterministic (no queryRenderedFeatures) so it's instant, consistent,
  // and can't over-paint. De-duped so co-located events collapse to one mark.
  const paintCluster = (cl: Cluster) => {
    const map = mapRef.current
    if (!map || !cl) return
    const feats: GeoJSON.Feature[] = []
    const dots: [number, number][] = []
    const seenFp = new Set<string>()
    const seenDot = new Set<string>()
    cl.members.forEach((ev) => {
      const fp = ev.venueKey ? VENUE_FOOTPRINTS[ev.venueKey] : undefined
      if (fp && fp.length >= 4) {
        if (!seenFp.has(ev.venueKey)) { seenFp.add(ev.venueKey); feats.push(footprintFeature(fp)) }
      } else if (ev.geo) {
        const k = `${ev.geo[0].toFixed(5)},${ev.geo[1].toFixed(5)}`
        if (!seenDot.has(k)) { seenDot.add(k); dots.push([ev.geo[1], ev.geo[0]]) }
      }
    })
    renderEventBuildings(map, feats)
    renderVenueDots(map, dots)
  }
  const paintClusterRef = useRef(paintCluster); paintClusterRef.current = paintCluster

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
        // «Центрировать карту» — прячем карточки и наводим на площадку активного
        // события (она уже отмечена синим домом или точкой из paintCluster).
        if (t.closest?.(".cs-deck-center")) {
          ev.stopPropagation()
          const map = mapRef.current
          const g = deckMembersRef.current[evIdxRef.current]?.geo
          if (map && Array.isArray(g)) {
            // hide the cards via display:none — MapLibre resets a marker's
            // opacity to 1 on every move, so opacity:0 would be wiped by easeTo.
            if (deckWrapRef.current) deckWrapRef.current.style.display = "none"
            setDeckHidden(true)
            deckHiddenRef.current = true; drawLeadersRef.current() // erase the leader now
            map.easeTo({ center: [g[1], g[0]], zoom: 16.6, pitch: 52, bearing: -14, duration: 650 })
          }
          return
        }
        // «Открыть в Яндекс.Картах» — редирект наружу на площадку активного
        // события (точный пин по координатам, иначе поиск по адресу).
        const yaBtn = t.closest?.(".cs-deck-yandex") as HTMLElement | null
        if (yaBtn) {
          ev.stopPropagation()
          const g = deckMembersRef.current[evIdxRef.current]?.geo
          openExternalMap(yandexMapsUrl(g, yaBtn.dataset.q || ""))
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
    if (stackSlot) {
      stackSlot.innerHTML = eventStackHTML(members, i)
      stackSlot.querySelector("img[data-eid]")?.addEventListener("error", (ev) =>
        { (ev.target as HTMLElement).style.display = "none" })
    }
    const count = wrap.querySelector(".cs-deck-count")
    if (count) count.textContent = `${i + 1} / ${n}`
  }
  const renderDeckRef = useRef(renderDeck); renderDeckRef.current = renderDeck

  // group real geocoded events by centre-disk + directional sector. Drop
  // events with no resolved poster (e.p === null) entirely — a card with a
  // missing/broken image looks broken, so such events never make it onto the
  // map, into a cluster deck, or the district counts.
  const byZone = useMemo(() => {
    const m: Record<string, Ev[]> = {}
    ZONES.forEach((z) => (m[z.id] = []))
    events.forEach((e) => {
      if (e.p && e.geo && inMoscow(e.geo[0], e.geo[1])) m[zoneOf(e.geo[0], e.geo[1])].push(e)
    })
    return m
  }, [events])
  const byZoneRef = useRef(byZone); byZoneRef.current = byZone
  const totalPlaced = useMemo(() => Object.values(byZone).reduce((a, b) => a + b.length, 0), [byZone])
  // sys-fan clusters per zone (real-proximity grouping)
  const clustersByZone = useMemo(() => {
    const m: Record<string, Cluster[]> = {}
    // sort clusters by event count desc → biggest venues lead each page
    ZONES.forEach((z) => { m[z.id] = clusterByProximity(byZone[z.id]).sort((a, b) => b.members.length - a.members.length) })
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

  // (drill-down + page reset now happens synchronously during render, above —
  // see prevSelZoneRef — so no stale frame paints on a district switch)
  // reset the carousel index when the zone or cluster changes
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
        // antialias:false — MSAA is a context-creation flag paid on EVERY
        // rendered frame across the whole pitch:52 viewport (the opening
        // tile-fade + every pan), the dominant per-frame GPU cost on mobile.
        // At retina DPR the softer building/label edges are barely visible; the
        // smoothness win is large. Flip back to true if the edges bother you.
        pitch: 52, bearing: -14, antialias: false, attributionControl: false,
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
        map.on("render", () => { drawLeadersRef.current(); scaleDeckRef.current() })

        placeZonesRef.current() // district bubbles (re-placed later if data was slow)
        // Fixed view anchored on central Moscow — NOT fitBounds, which would
        // centre on the midpoint of whatever districts happen to exist and
        // drift east when only Центр+Восток are populated. Padding offsets the
        // centre below the heading card so the central districts sit in view.
        const VIEW = { center: [37.6190, 55.7600] as [number, number], zoom: 10.4, pitch: 52, bearing: -14, padding: { top: 230, bottom: 170, left: 0, right: 0 } }
        // Opening flourish — the map "spins as it opens" again, but SELF-
        // TERMINATING: it opens pre-rotated and glides into its resting bearing
        // ONCE via a single ease-out easeTo, then the camera goes fully idle. No
        // return to the old INFINITE pendulum (that called setBearing() every
        // frame forever → a full 3D re-render 60×/sec AT REST — the stutter).
        // The first fitAllRef() (fired by the explode effect on `ready`) runs
        // the flourish; later returns to overview use a quick plain fit.
        let opened = false
        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
        fitAllRef.current = () => {
          if (!opened) { opened = true; map!.easeTo({ ...VIEW, duration: 6200, easing: easeOutCubic }) }
          else map!.easeTo({ ...VIEW, duration: 700 })
        }
        map.jumpTo({ ...VIEW, bearing: VIEW.bearing + 28 }) // open pre-rotated → eases home
        // tapping a district mid-spin cancels the flourish before the zone fly-in
        pendulumStopRef.current = () => { try { map!.stop() } catch { /* noop */ } }
        setReady(true)
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
    renderEventBuildings(map, [])
    renderVenueDots(map, [])
    leadersRef.current = []
    drawLeadersRef.current()
    // Leaving any open Level-2 deck → drop its refs so the per-frame render
    // handler (scaleDeck / drawLeaders) stops writing to the marker node that
    // was just .remove()d above. The Level-2 branch below re-sets them when a
    // cluster is (re)opened.
    deckWrapRef.current = null
    deckMembersRef.current = []
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
    if (!selZone) { overviewFitRef.current = null; fitAllRef.current(); return }
    // Stop the idle wobble before any programmatic camera move — its per-frame
    // setBearing would otherwise cancel the easeTo (a DOM-marker tap never fires
    // the map's mousedown, so the auto-stop on interaction doesn't trigger).
    pendulumStopRef.current()

    const clusters = clustersRef.current[selZone] || []
    if (selCluster == null) {
      // Level 1 — cluster fans at their REAL positions; tap a fan to drill in.
      //
      // Fans stay on true coords so tapping one doesn't make it jump — Level 2
      // just flies the camera into the same spot. Spread districts (Восток
      // scatters venues ~4 km) are handled purely by ZOOMING OUT to fit them
      // all in the band between the heading card and the district sheet.
      // Only the CURRENT PAGE's clusters draw — keeps a dense district (Центр)
      // uncluttered. The badge number (gi+1) stays GLOBAL so it matches the
      // numbered sheet list, and tapping still opens the right cluster.
      const shown = clusters.map((cl, gi) => ({ cl, gi })).slice(selPage * PER_PAGE, selPage * PER_PAGE + PER_PAGE)
      shown.forEach(({ cl, gi }) => {
        const el = clusterFanEl(cl, gi)
        el.style.cursor = "pointer"
        el.addEventListener("click", (ev) => { ev.stopPropagation(); setSelCluster(gi) })
        // A poster that 404s → hide just that <img> (leaves the card frame as a
        // clean blank, keeps the fan geometry). NO re-cluster — that was the jank.
        el.querySelectorAll("img[data-eid]").forEach((im) =>
          im.addEventListener("error", () => { (im as HTMLElement).style.display = "none" }))
        const m = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([cl.ll[1], cl.ll[0]]).addTo(map)
        scatterRef.current.push(m)
      })
      // Fit all fans by ZOOMING OUT to a zoom WE compute (Web-Mercator fit),
      // not map.cameraForBounds — the latter silently folds in the map's
      // leftover padding and returned null/oddly-low zooms here. The overview
      // is kept at a GENTLE pitch so the flat fit stays honest (at 52° the edge
      // venues Черкизовская↔Пролетарская slide off the sides) and reads clearer.
      // Level 2 tilts back to 52 for the cinematic building view.
      const OVERVIEW_PITCH = 30
      // fit the WHOLE district (all clusters) so paging never needs a camera move
      const lats = clusters.map((c) => c.ll[0])
      const lngs = clusters.map((c) => c.ll[1])
      const minLat = Math.min(...lats), maxLat = Math.max(...lats)
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
      const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2
      // normalised Web-Mercator Y in [0,1]
      const mercY = (lat: number) => {
        const s = Math.sin((lat * Math.PI) / 180)
        return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
      }
      const W = map.getContainer().clientWidth || 375
      const H = map.getContainer().clientHeight || 812
      // visible band = viewport minus the heading card (top) and the district
      // sheet (bottom); the fans anchor from the bottom so they draw upward.
      const usableW = Math.max(120, W - 56)
      // reserve extra up top: fans anchor at the bottom, so the card + place
      // label draw ~90px ABOVE the geo point — without this the top fan tucks
      // under the heading card.
      const usableH = Math.max(120, H - 250 - 300)
      const lngFrac = Math.max((maxLng - minLng) / 360, 1e-6)
      const latFrac = Math.max(Math.abs(mercY(maxLat) - mercY(minLat)), 1e-6)
      const zLng = Math.log2(usableW / (256 * lngFrac))
      const zLat = Math.log2(usableH / (256 * latFrac))
      // Headroom below the exact fit: covers the −14° bearing + 30° pitch
      // stretching the box, and leaves a little breathing room around the fans.
      const zoom = Math.max(10.3, Math.min(14.0, Math.min(zLng, zLat) - 0.85))
      // camera fit is applied once per district (below, after deOverlap)

      // De-overlap: once the camera settles, project every fan to the screen
      // and shove any that sit closer than one card-width apart (co-located
      // venues like Фабрика/Страдариум) away from each other with a pixel
      // offset — the geo anchor is unchanged, so tapping still drills into the
      // right building. A few relaxation passes spread a tight knot evenly.
      const deOverlap = () => {
        const ms = scatterRef.current
        if (ms.length < 2) return
        const pts = ms.map((mk) => map.project(mk.getLngLat()))
        const off = ms.map(() => ({ x: 0, y: 0 }))
        const MIN = 80 // ~fan card + place label width, so labels clear too
        for (let it = 0; it < 40; it++) {
          for (let a = 0; a < ms.length; a++) {
            for (let b = a + 1; b < ms.length; b++) {
              let dx = (pts[b].x + off[b].x) - (pts[a].x + off[a].x)
              let dy = (pts[b].y + off[b].y) - (pts[a].y + off[a].y)
              let d = Math.hypot(dx, dy)
              if (d < 0.01) { dx = 1; dy = 0; d = 1 } // exact overlap → split sideways
              if (d < MIN) {
                const push = (MIN - d) / 2
                off[a].x -= (dx / d) * push; off[a].y -= (dy / d) * push
                off[b].x += (dx / d) * push; off[b].y += (dy / d) * push
              }
            }
          }
        }
        ms.forEach((mk, i) => mk.setOffset([off[i].x, off[i].y]))
      }
      if (overviewFitRef.current !== selZone) {
        // first entry into this district → fit the camera ONCE
        overviewFitRef.current = selZone
        map.easeTo({ center: [cLng, cLat], zoom, pitch: OVERVIEW_PITCH, bearing: -14, duration: 800, padding: { top: 250, bottom: 300, left: 20, right: 20 } })
        map.once("moveend", deOverlap)
      } else {
        // paging within the same district → NO camera move (that per-page 800ms
        // fly was the jank); just re-spread the freshly-drawn page's fans
        requestAnimationFrame(() => deOverlap())
      }
    } else {
      overviewFitRef.current = null  // Level 2 open → re-fit overview on return
      // Level 2 — ONE fanned deck at the cluster centre; browse with ← →.
      const cl = clusters[selCluster]
      if (cl) {
        const wrap = document.createElement("div")
        wrap.className = "cs-scatter-wrap"
        deckMembersRef.current = cl.members
        deckWrapRef.current = wrap
        renderDeckRef.current(0)
        scaleDeckRef.current() // size the deck to the current zoom right away
        // anchor "bottom" at the cluster centroid; the leader points from here
        // down to the active event's real building.
        const m = new maplibregl.Marker({ element: wrap, anchor: "bottom", offset: [0, -6] }).setLngLat([cl.ll[1], cl.ll[0]]).addTo(map)
        scatterRef.current.push(m)
        leadersRef.current = [{ card: cl.ll, target: (cl.members[0]?.geo as [number, number]) ?? cl.ll, i: 0 }]
        drawLeadersRef.current()
        // Mark venues immediately (deterministic — no need to wait for tiles),
        // then ease to the centroid at building-visible zoom.
        paintClusterRef.current(cl)
        map.easeTo({ center: [cl.ll[1], cl.ll[0]], zoom: 15, pitch: 52, bearing: -14, duration: 700 })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selZone, selCluster, selPage, ready])

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

      {/* top-left stack: heading card + a «back to districts» button that shows
          once a district/cluster is open. The only way back to the overview used
          to be the tiny «← районы» in the bottom-sheet corner (easy to miss) —
          this puts an obvious return right under the «Что рядом» title. */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 16px)", left: 14, right: 14, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 9 }}>
        {headOpen ? (
          <div style={{ position: "relative", width: "100%", background: CS.W, border: `2.5px solid ${CS.K}`, boxShadow: `4px 4px 0 ${CS.K}`, padding: "12px 14px" }}>
            <button onClick={() => setHeadOpen(false)} aria-label="скрыть шапку" style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, border: `2px solid ${CS.K}`, background: CS.W, cursor: "pointer", fontSize: 13, fontWeight: 900, lineHeight: 1, color: CS.K, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(13,13,13,0.55)" }}>сначала — карта · WK 22</div>
            <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 34, letterSpacing: "-0.045em", lineHeight: 0.9, color: CS.K, marginTop: 6 }}>Что рядом</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 11 }}>
              <span style={{ background: CS.B, color: "#fff", padding: "3px 9px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{totalPlaced} событий · {zoneCount} районов</span>
              <span style={{ background: CS.W, color: CS.K, border: `1.5px solid ${CS.K}`, padding: "2px 7px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>движок · CitySignal · 3D</span>
            </div>
          </div>
        ) : (
          <button onClick={() => setHeadOpen(true)} aria-label="показать шапку" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: CS.W, border: `2.5px solid ${CS.K}`, boxShadow: `3px 3px 0 ${CS.K}`, padding: "7px 11px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 14, letterSpacing: "-0.02em", color: CS.K, textTransform: "uppercase" }}>
            Что рядом
            <span style={{ background: CS.B, color: "#fff", fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, padding: "1.5px 5px", letterSpacing: "0.02em" }}>{totalPlaced}</span>
            <span style={{ fontSize: 11, lineHeight: 1 }}>▾</span>
          </button>
        )}
        {selZone && (() => {
          // Breadcrumb: Районы › [зона] › [место]. Past crumbs are white/tappable
          // (jump to that level); the current level is the solid black crumb. This
          // is the ONE place all map navigation lives — the scattered «← Все
          // районы» / «← кластеры» buttons are gone.
          const zoneName = ZONE_BY_ID[selZone].t
          const atCluster = selCluster != null && !!activeCluster
          const clusterName = activeCluster ? clusterLabel(activeCluster).name : ""
          const past = { display: "inline-flex", alignItems: "center", flexShrink: 0, background: CS.W, border: `2px solid ${CS.K}`, boxShadow: `2px 2px 0 ${CS.K}`, padding: "5px 9px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, letterSpacing: "0.02em", textTransform: "uppercase" as const, color: CS.K }
          const now = { display: "inline-block", maxWidth: 176, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, background: CS.K, color: "#fff", border: `2px solid ${CS.K}`, boxShadow: `2px 2px 0 ${CS.B}`, padding: "5px 9px", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, letterSpacing: "0.02em", textTransform: "uppercase" as const }
          const sep = { fontSize: 18, color: CS.K, lineHeight: 1, margin: "0 4px" }
          return (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
              <button onClick={() => setSelZone(null)} style={past}>Районы</button>
              <span style={sep}>▸</span>
              {atCluster ? (
                <>
                  <button onClick={() => setSelCluster(null)} style={past}>{zoneName}</button>
                  <span style={sep}>▸</span>
                  <span style={now}>{clusterName}</span>
                </>
              ) : (
                <span style={now}>{zoneName}</span>
              )}
            </div>
          )
        })()}
      </div>

      {/* «Показать карточки» — возвращает колоду после «Центрировать карту» */}
      {selCluster != null && deckHidden && (
        <div style={{ position: "absolute", top: "30%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 11, pointerEvents: "none" }}>
          <button
            onClick={() => { if (deckWrapRef.current) deckWrapRef.current.style.display = "" ; setDeckHidden(false); deckHiddenRef.current = false; drawLeadersRef.current() }}
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
          {activeCluster ? (
            /* Level 2 — content row only: count + «листай» hint on the left,
               [Лента →] on the right. Back navigation lives in the breadcrumb
               under the heading now (no «← кластеры» here). */
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, minWidth: 0 }}>
                <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, letterSpacing: "0.02em", color: CS.K, whiteSpace: "nowrap" }}><span style={{ color: CS.B }}>●</span> {RU_PLURAL(deckEvents.length)}</span>
                <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.06em", color: "rgba(13,13,13,0.5)", textTransform: "uppercase", whiteSpace: "nowrap" }}>листай ← → между карточками</span>
              </div>
              <button onClick={onEnter} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, background: CS.K, border: `2px solid ${CS.K}`, padding: "6px 11px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase", color: "#fff", boxShadow: `2px 2px 0 ${CS.B}` }}>Лента →</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px 3px" }}>
              {/* zone name lives in the breadcrumb now — the sheet just titles
                  the list of places + the events count, and offers «Лента →» */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                <span style={{ fontWeight: 900, fontSize: 14, letterSpacing: "-0.03em", lineHeight: 1, color: CS.K, textTransform: "uppercase", whiteSpace: "nowrap" }}>Места</span>
                <span style={{ background: CS.B, color: "#fff", padding: "2px 6px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 8.5, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{RU_PLURAL(deckEvents.length)}</span>
              </div>
              <button onClick={onEnter} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, background: CS.K, border: `2px solid ${CS.K}`, padding: "6px 11px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, letterSpacing: "0.03em", textTransform: "uppercase", color: "#fff", boxShadow: `2px 2px 0 ${CS.B}` }}>Лента →</button>
            </div>
          )}
          {/* level 1 (clusters): hint to drill in · level 2 (cluster): event carousel */}
          {!activeCluster ? (
            (() => {
              const all = selZone ? (clustersByZone[selZone] || []) : []
              const pages = Math.max(1, Math.ceil(all.length / PER_PAGE))
              const page = Math.min(selPage, pages - 1)
              const start = page * PER_PAGE
              const shownCl = all.map((cl, gi) => ({ cl, gi })).slice(start, start + PER_PAGE)
              const pgBtn = (active: boolean) => ({ minWidth: 26, height: 26, boxSizing: "border-box" as const, border: `2px solid ${CS.K}`, background: active ? CS.B : "#F0EEE7", color: active ? "#fff" : CS.K, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", boxShadow: `2px 2px 0 ${CS.K}` })
              const arwBtn = { ...pgBtn(false), background: CS.K, color: "#fff" }
              return (
                <div>
                  {pages > 1 && (() => {
                    const ws = Math.max(0, Math.min(page - 2, pages - 5))
                    const we = Math.min(pages - 1, ws + 4)
                    const nums = []
                    for (let p = ws; p <= we; p++) nums.push(p)
                    return (
                      <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "1px 12px 6px" }}>
                        <button onClick={() => setSelPage(Math.max(0, page - 1))} style={arwBtn}>‹</button>
                        {nums.map((p) => (<button key={p} onClick={() => setSelPage(p)} style={pgBtn(p === page)}>{p + 1}</button>))}
                        <button onClick={() => setSelPage(Math.min(pages - 1, page + 1))} style={arwBtn}>›</button>
                        {we < pages - 1 && <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: "rgba(13,13,13,0.4)" }}>/{pages}</span>}
                      </div>
                    )
                  })()}
                  <div style={{ padding: "0 12px 7px" }}>
                    {shownCl.map(({ cl, gi }) => {
                      const { name } = clusterLabel(cl)
                      return (
                        <button key={gi} onClick={() => setSelCluster(gi)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "3px 4px", background: "transparent", border: "none", borderTop: gi === start ? "none" : "1px solid rgba(13,13,13,0.1)", cursor: "pointer", textAlign: "left" }}>
                          <span style={{ width: 16, height: 16, flexShrink: 0, background: CS.B, color: "#fff", borderRadius: 999, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{gi + 1}</span>
                          <span style={{ flex: 1, minWidth: 0, fontWeight: 900, fontSize: 11, letterSpacing: "-0.01em", textTransform: "uppercase", color: CS.K, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                          <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10.5, color: CS.B, flexShrink: 0 }}>{cl.members.length}</span>
                          <span style={{ fontSize: 13, fontWeight: 900, color: CS.K, flexShrink: 0, marginLeft: 2 }}>→</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()
          ) : null /* Level 2 hint moved into the header row above */}
        </div>
      )}
    </div>
  )
}
