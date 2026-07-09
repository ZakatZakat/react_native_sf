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
import { CS, FONT_SANS, FONT_MONO, SK, useCsKeyframes, useOpenEvent } from "./shared"
import { CS_STYLE_LIGHT, applyCinematicSky } from "./csMapStyle"

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

type Cluster = { ll: [number, number]; members: Ev[]; pts: [number, number][] }

const RU_PLURAL = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? "событие" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "события" : "событий"}`

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))

function metersBetween(a: [number, number], b: [number, number]): number {
  const dLat = (b[0] - a[0]) * 111320
  const dLng = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

/** Greedy geographic clustering by REAL proximity (radius in metres). Each
 *  cluster sits at its members' centroid; singles keep real coords (same-venue
 *  duplicates fan out via realPositions). */
function clusterByProximity(evs: Ev[], radiusM = 650): Cluster[] {
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
    out.push({ ll: [lat, lng], members, pts: realPositions(members) })
  }
  return out
}

/** Drill-down positions for a cluster's events: each event sits on its OWN real
 *  coordinate (so the card hovers over its real building). Only events that
 *  share the exact same venue are spread — placed on a small ring around it so
 *  the polaroids don't overlap at the L2 zoom while staying on the spot. */
function realPositions(evs: Ev[]): [number, number][] {
  const groups = new Map<string, number[]>()
  evs.forEach((e, i) => {
    const [la, ln] = e.geo as [number, number]
    const key = `${la.toFixed(4)},${ln.toFixed(4)}`
    const arr = groups.get(key); if (arr) arr.push(i); else groups.set(key, [i])
  })
  const out: [number, number][] = new Array(evs.length)
  groups.forEach((idxs) => {
    const n = idxs.length
    idxs.forEach((idx, j) => {
      const [la, ln] = evs[idx].geo as [number, number]
      if (n === 1) { out[idx] = [la, ln]; return }
      const cosLat = Math.cos((la * Math.PI) / 180)
      const r = Math.max(95, 28 * n) // ring radius, metres — keeps cards from overlapping
      const a = (j / n) * 2 * Math.PI + 0.5
      out[idx] = [la + (r * Math.sin(a)) / 111320, ln + (r * Math.cos(a)) / (111320 * cosLat)]
    })
  })
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

/** Single-event polaroid marker (v7 makePolaEl) for cluster drill-down. */
function polaEl(e: Ev, i: number): HTMLElement {
  const rots = [-6, 4, -3, 6, -5, 3, 5, -4]
  const wrap = document.createElement("div")
  wrap.className = "cs-scatter-wrap"
  wrap.innerHTML =
    `<div class="cs-pola" style="--si:${i};--pr:${rots[i % rots.length]}deg"><div class="cs-pola-card">` +
    `<div class="cs-pola-img">${e.p ? `<img src="${e.p}" alt=""/>` : ""}</div>` +
    `<div class="cs-pola-name">${esc(e.t || "")}</div></div></div>`
  return wrap
}

// ── Highlight the event's building (signal-blue) ────────────────────────────
// Two parts so the building is BOTH artifact-free AND impossible to miss:
//   1. feature-state recolours the real building blue → any wall that overlaps
//      the tower below is blue-on-blue, so there's no z-fighting.
//   2. a taller blue overlay "tower" (geojson) rises ~28m above the real roof,
//      so even a tiny/low venue building is a clear landmark above its
//      neighbours at the 3D tilt (recolour alone was invisible for small ones).
// Only the ACTIVE card's nearest building lights up.
const EVT_BLDG_SRC = "cs-evt-bldg"
const EVT_BLDG_LAYER = "cs-evt-bldg-tower"
type BldgRef = { source: string; sourceLayer: string; id: string | number }
type Hl = { ref: BldgRef; feat: GeoJSON.Feature }

function ensureEventBuildingTower(map: maplibregl.Map) {
  if (map.getSource(EVT_BLDG_SRC)) return
  map.addSource(EVT_BLDG_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
  map.addLayer({
    id: EVT_BLDG_LAYER, type: "fill-extrusion", source: EVT_BLDG_SRC, minzoom: 13,
    paint: {
      "fill-extrusion-color": CS.B,
      // fixed 45m so every highlighted venue — even a tiny footprint — reads as
      // a clear blue column above its neighbours.
      "fill-extrusion-height": 45,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.96,
    },
  } as maplibregl.AddLayerObject)
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
  const chosen = (inside || best) as maplibregl.MapGeoJSONFeature | null
  if (!chosen) return null
  const bf = chosen
  return {
    ref: { source: bf.source, sourceLayer: bf.sourceLayer as string, id: bf.id as string | number },
    feat: { type: "Feature", geometry: bf.geometry, properties: bf.properties || {} },
  }
}

/** Light up exactly one building (or none), clearing the previously lit one. */
function setActiveBuilding(map: maplibregl.Map, prev: Hl | null, next: Hl | null): Hl | null {
  if (prev) { try { map.setFeatureState(prev.ref, { hl: false }) } catch { /* tile evicted */ } }
  if (next) { try { map.setFeatureState(next.ref, { hl: true }) } catch { /* tile not loaded */ } }
  const src = map.getSource(EVT_BLDG_SRC) as maplibregl.GeoJSONSource | undefined
  if (src) src.setData(next ? { type: "FeatureCollection", features: [next.feat] } : { type: "FeatureCollection", features: [] })
  return next
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
  const hlBuildingRef = useRef<Hl | null>(null) // currently lit building
  const zoneMarkersRef = useRef<Record<string, HTMLElement>>({})
  const scatterRef = useRef<maplibregl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selZone, setSelZone] = useState<string | null>(null)
  const [selCluster, setSelCluster] = useState<number | null>(null)
  const [evIdx, setEvIdx] = useState(0)
  const evIdxRef = useRef(0); evIdxRef.current = evIdx
  const selZoneRef = useRef<string | null>(null); selZoneRef.current = selZone
  const selClusterRef = useRef<number | null>(null); selClusterRef.current = selCluster

  // Centre the map on the ACTIVE event and light its building. Always centring
  // guarantees the active card and its blue column are together in view — no
  // more "where is the highlight?" with the building off-screen or off to the
  // side. queryRenderedFeatures only sees on-screen buildings, so centring also
  // makes the lookup reliable.
  const applyActiveHighlight = () => {
    const map = mapRef.current
    if (!map || selClusterRef.current == null) return
    if (map.getZoom() < 13.5) return // buildings not rendered yet — the moveend pass handles it
    const mk = scatterRef.current[evIdxRef.current]
    if (!mk) { hlBuildingRef.current = setActiveBuilding(map, hlBuildingRef.current, null); return }
    const ll = mk.getLngLat()
    const target = evIdxRef.current
    // retry on `idle`: at moveend the building tiles for a fresh view may not be
    // loaded yet, so queryRenderedFeatures finds nothing — wait for them once.
    const doHl = (retry: boolean) => {
      if (selClusterRef.current == null || evIdxRef.current !== target) return
      const b = buildingUnder(map, ll)
      if (b) hlBuildingRef.current = setActiveBuilding(map, hlBuildingRef.current, b)
      else if (retry) map.once("idle", () => doHl(false))
    }
    map.easeTo({ center: ll, zoom: 15.2, pitch: 52, bearing: -14, duration: 450 })
    map.once("moveend", () => doHl(true))
  }
  const applyActiveRef = useRef(applyActiveHighlight); applyActiveRef.current = applyActiveHighlight

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
        ensureEventBuildingTower(map) // blue tower layer for the active event's building

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
    hlBuildingRef.current = setActiveBuilding(map, hlBuildingRef.current, null)
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
      // Level 2 — polaroids on each event's REAL spot.
      const cl = clusters[selCluster]
      if (cl) {
        cl.members.forEach((e, i) => {
          const ll = cl.pts[i]
          const el = polaEl(e, i)
          el.style.cursor = "pointer"
          el.addEventListener("click", (ev) => { ev.stopPropagation(); setEvIdx(i); openRef.current(e) })
          // anchor "bottom" + lift: the card floats ABOVE its building like a tag.
          // Cards stay on their real coords (no snap-move → no "redistribute" jump).
          const m = new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -10] }).setLngLat([ll[1], ll[0]]).addTo(map)
          scatterRef.current.push(m)
        })
        // Fly straight to the first event (centred) — applyActiveHighlight then
        // lights its building. No centroid hop, so no extra camera motion.
        const first = cl.pts[0] || [cl.ll[0], cl.ll[1]]
        map.easeTo({ center: [first[1], first[0]], zoom: 15.2, pitch: 52, bearing: -14, duration: 700 })
        map.once("moveend", () => { if (hlTokenRef.current === hlToken) applyActiveRef.current() })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selZone, selCluster, ready])

  // highlight the active polaroid + paint ONLY the active event's building, so
  // the map never shows more blue buildings than the card you're looking at.
  useEffect(() => {
    scatterRef.current.forEach((m, i) => {
      const pola = m.getElement().querySelector(".cs-pola")
      if (pola) pola.classList.toggle("cs-scatter-active", i === evIdx)
    })
    if (selCluster != null) applyActiveRef.current()
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

      {/* heading card — brutalist (design MapHeading · classic) */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 16px)", left: 14, right: 14, zIndex: 10 }}>
        <div style={{ background: CS.W, border: `2.5px solid ${CS.K}`, boxShadow: `4px 4px 0 ${CS.K}`, padding: "12px 14px" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(13,13,13,0.55)" }}>сначала — карта · WK 22</div>
          <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 34, letterSpacing: "-0.045em", lineHeight: 0.9, color: CS.K, marginTop: 6 }}>Что рядом</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 11 }}>
            <span style={{ background: CS.B, color: "#fff", padding: "3px 9px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{totalPlaced} событий · {zoneCount} районов</span>
            <span style={{ background: CS.W, color: CS.K, border: `1.5px solid ${CS.K}`, padding: "2px 7px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>движок · CitySignal · 3D</span>
          </div>
        </div>
      </div>

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
          <div style={{ padding: "0 14px 10px" }}>
            <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
              <button onClick={() => setEvIdx((i) => (i - 1 + deckEvents.length) % deckEvents.length)} style={{ width: 28, flexShrink: 0, border: `2px solid ${CS.K}`, background: CS.W, cursor: "pointer", fontSize: 15, fontWeight: 900, color: CS.K, lineHeight: 1 }}>←</button>
              <button onClick={() => openRef.current(deckEvents[evIdx])} style={{ flex: 1, minWidth: 0, display: "flex", gap: 0, textAlign: "left", padding: 0, border: `2.5px solid ${CS.K}`, boxShadow: `3px 3px 0 ${CS.K}`, background: CS.W, cursor: "pointer", overflow: "hidden" }}>
                <div style={{ width: 60, flexShrink: 0, borderRight: `2px solid ${CS.K}`, overflow: "hidden", background: "#eee" }}>
                  {deckEvents[evIdx]?.p && <img key={deckEvents[evIdx].id} src={deckEvents[evIdx].p!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "cs-burst-in 0.3s ease both" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: "7px 9px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span style={{ fontWeight: 900, fontSize: 7.5, letterSpacing: "0.14em", textTransform: "uppercase", color: CS.B }}>{deckEvents[evIdx]?.c}</span>
                  <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.02em", lineHeight: 1, color: CS.K, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deckEvents[evIdx]?.t}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 5, fontFamily: FONT_MONO, fontSize: 9.5, color: "rgba(13,13,13,0.55)" }}>
                    <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{deckEvents[evIdx]?.v}</span>
                    <span style={{ color: CS.K, fontWeight: 700, whiteSpace: "nowrap" }}>{deckEvents[evIdx]?.tm}</span>
                  </div>
                </div>
              </button>
              <button onClick={() => setEvIdx((i) => (i + 1) % deckEvents.length)} style={{ width: 28, flexShrink: 0, border: `2px solid ${CS.K}`, background: CS.W, cursor: "pointer", fontSize: 15, fontWeight: 900, color: CS.K, lineHeight: 1 }}>→</button>
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
