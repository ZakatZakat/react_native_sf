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

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"
const MSK: [number, number] = [37.62, 55.745]

type Zone = { id: string; t: string; sub: string; ll: [number, number]; r: number }
const ZONES: Zone[] = [
  { id: "center", t: "Центр",  sub: "Бульварное",       ll: [55.7660, 37.6210], r: 1600 },
  { id: "north",  t: "Север",  sub: "ВДНХ · Речной",    ll: [55.8650, 37.5900], r: 2600 },
  { id: "east",   t: "Восток", sub: "Винзавод · ARMA",  ll: [55.7760, 37.7420], r: 2200 },
  { id: "south",  t: "Юг",     sub: "ЗИЛ · Даниловский", ll: [55.6440, 37.6540], r: 2400 },
  { id: "west",   t: "Запад",  sub: "Сити · Кутузово",  ll: [55.7380, 37.4820], r: 2500 },
]
const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]))

const inMoscow = (lat: number, lng: number) => lat >= 55.3 && lat <= 56.1 && lng >= 36.9 && lng <= 38.0

function nearestZoneId(lat: number, lng: number): string {
  let best = ZONES[0].id, bestD = Infinity
  for (const z of ZONES) {
    const d = (z.ll[0] - lat) ** 2 + (z.ll[1] - lng) ** 2
    if (d < bestD) { bestD = d; best = z.id }
  }
  return best
}

/** Chessboard grid of [lat,lng] inside a zone — guaranteed no overlap. */
function gridPositions(z: Zone, n: number): [number, number][] {
  if (n === 0) return []
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const cosLat = Math.cos((z.ll[0] * Math.PI) / 180)
  const step = (z.r * 1.85) / Math.max(cols, rows)
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols)
    const inRow = Math.min(cols, n - r * cols)
    const c = i - r * cols
    const cx = (c - (inRow - 1) / 2) * step
    const cy = (r - (rows - 1) / 2) * step
    out.push([z.ll[0] - cy / 111320, z.ll[1] + cx / (111320 * cosLat)])
  }
  return out
}

/** District bubble marker: fan of ≤3 posters + count + name + dot + ring. */
function zoneBubbleEl(zone: Zone, evs: Ev[], onClick: (id: string) => void): HTMLElement {
  const fan = evs.slice(0, 3)
  const rots = [-14, 0, 14]
  const thumbs = fan.map((e, i) =>
    `<span class="cs-zfan-card" style="--zr:${rots[i] || 0}deg;--zz:${i}">${e.p ? `<img src="${e.p}" alt=""/>` : ""}</span>`,
  ).join("")
  const el = document.createElement("div")
  el.className = "cs-zone"
  el.dataset.zone = zone.id
  el.innerHTML =
    `<div class="cs-zone-ring"></div>` +
    `<div class="cs-zone-bubble"><div class="cs-zfan">${thumbs}<span class="cs-zone-count">${evs.length}</span></div>` +
    `<div class="cs-zone-name">${zone.t}</div></div>` +
    `<div class="cs-zone-dot"></div>`
  el.addEventListener("click", (e) => { e.stopPropagation(); onClick(zone.id) })
  return el
}

/** Single event pin for the exploded scatter. */
function scatterPinEl(e: Ev): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "cs-scatter-wrap"
  const pin = document.createElement("div")
  pin.className = "cs-pin cs-scatter-pin"
  pin.innerHTML =
    `<span class="cs-pin-halo"></span>` +
    `<div class="cs-pin-card">${e.p ? `<img src="${e.p}" alt=""/>` : `<div style="width:100%;height:100%;background:#ccc"></div>`}</div>` +
    `<div class="cs-pin-tip"></div>`
  wrap.appendChild(pin)
  return wrap
}

export default function MapIntro({ events, onEnter }: { events: Ev[]; onEnter: () => void }) {
  useCsKeyframes()
  const openEvent = useOpenEvent()
  const openRef = useRef(openEvent); openRef.current = openEvent

  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const fitAllRef = useRef<() => void>(() => {})
  const zoneMarkersRef = useRef<Record<string, HTMLElement>>({})
  const scatterRef = useRef<maplibregl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selZone, setSelZone] = useState<string | null>(null)
  const [evIdx, setEvIdx] = useState(0)
  const selZoneRef = useRef<string | null>(null); selZoneRef.current = selZone

  // group real geocoded events by nearest district
  const byZone = useMemo(() => {
    const m: Record<string, Ev[]> = {}
    ZONES.forEach((z) => (m[z.id] = []))
    events.forEach((e) => {
      if (e.geo && inMoscow(e.geo[0], e.geo[1])) m[nearestZoneId(e.geo[0], e.geo[1])].push(e)
    })
    return m
  }, [events])
  const byZoneRef = useRef(byZone); byZoneRef.current = byZone
  const totalPlaced = useMemo(() => Object.values(byZone).reduce((a, b) => a + b.length, 0), [byZone])
  const onZone = (id: string) => setSelZone((p) => (p === id ? null : id))
  const onZoneRef = useRef(onZone); onZoneRef.current = onZone

  useEffect(() => { setEvIdx(0) }, [selZone])

  // create map + zone markers once
  useEffect(() => {
    if (!boxRef.current) return
    let map: maplibregl.Map | null = null
    try {
      map = new maplibregl.Map({
        container: boxRef.current, style: STYLE_URL, center: MSK, zoom: 10.5,
        pitch: 52, bearing: -14, antialias: true, attributionControl: false,
      })
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right")
      map.on("error", () => setFailed(true))
      mapRef.current = map
      map.on("load", () => {
        if (!map) return
        // 3D buildings extrusion
        try {
          const style = map.getStyle()
          const vsrc = Object.keys(style.sources).find((k) => (style.sources as any)[k].type === "vector")
          if (vsrc && !map.getLayer("cs-3d-buildings")) {
            map.addLayer({
              id: "cs-3d-buildings", type: "fill-extrusion", source: vsrc, "source-layer": "building", minzoom: 12,
              paint: {
                "fill-extrusion-color": "#cdd0c8",
                "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 6],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
                "fill-extrusion-opacity": 0.92,
              },
            } as any)
          }
        } catch { /* style without building layer */ }

        const b = new maplibregl.LngLatBounds()
        ZONES.forEach((z) => {
          if (!byZoneRef.current[z.id].length) return
          const ll: [number, number] = [z.ll[1], z.ll[0]]
          b.extend(ll)
          const el = zoneBubbleEl(z, byZoneRef.current[z.id], (id) => onZoneRef.current(id))
          zoneMarkersRef.current[z.id] = el
          new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(ll).addTo(map!)
        })
        const pad = { top: 150, bottom: 120, left: 55, right: 55 }
        fitAllRef.current = () => map!.fitBounds(b, { padding: pad, maxZoom: 12.4, pitch: 52, bearing: -14, duration: 700 })
        if (!b.isEmpty()) map.fitBounds(b, { padding: pad, maxZoom: 12.4, pitch: 52, bearing: -14, animate: false })
        setReady(true)

        // gentle camera pendulum until the user touches the map
        const baseBearing = map.getBearing()
        const startT = performance.now()
        let raf = 0, stopped = false
        const stop = () => { stopped = true; cancelAnimationFrame(raf); ["mousedown", "touchstart", "wheel", "dragstart"].forEach((ev) => map!.off(ev as any, stop)) }
        ;["mousedown", "touchstart", "wheel", "dragstart"].forEach((ev) => map!.on(ev as any, stop))
        const tick = (now: number) => {
          if (stopped || !mapRef.current) return
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
    // clear previous scatter
    scatterRef.current.forEach((m) => m.remove())
    scatterRef.current = []
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
    if (selZone) {
      const z = ZONE_BY_ID[selZone]
      const evs = byZone[selZone]
      const pts = gridPositions(z, evs.length)
      const b = new maplibregl.LngLatBounds()
      evs.forEach((e, i) => {
        const ll = pts[i]
        const el = scatterPinEl(e)
        el.style.cursor = "pointer"
        el.addEventListener("click", (ev) => { ev.stopPropagation(); setEvIdx(i); openRef.current(e) })
        const m = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([ll[1], ll[0]]).addTo(map)
        scatterRef.current.push(m)
        b.extend([ll[1], ll[0]])
      })
      if (!b.isEmpty()) map.fitBounds(b, { padding: { top: 140, bottom: 230, left: 50, right: 50 }, maxZoom: 14.5, pitch: 52, bearing: -14, duration: 750 })
    } else {
      fitAllRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selZone, ready])

  // highlight the active scatter pin (sync with the deck carousel)
  useEffect(() => {
    scatterRef.current.forEach((m, i) => {
      const pin = m.getElement().querySelector(".cs-pin")
      if (pin) pin.classList.toggle("cs-scatter-active", i === evIdx)
    })
  }, [evIdx, selZone])

  const deckEvents = selZone ? byZone[selZone] : []

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: SK.ink, animation: "cs-mapintro-in 0.4s ease both", fontFamily: FONT_SANS }}>
      {!failed && <div ref={boxRef} style={{ position: "absolute", inset: 0, isolation: "isolate" }} />}
      {failed && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#16213a,#0d0d0d)" }} />}

      {/* header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "calc(env(safe-area-inset-top,0px) + 18px) 18px 14px", background: "linear-gradient(180deg, rgba(13,13,13,0.85), rgba(13,13,13,0))", color: "#fff", pointerEvents: "none" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>CitySignal · карта</div>
        <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.03em", marginTop: 4 }}>Что рядом</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
          {selZone ? `${ZONE_BY_ID[selZone].t} · ${deckEvents.length} событий` : `${totalPlaced} событий · ${ZONES.filter((z) => byZone[z.id].length).length} районов`}
        </div>
      </div>

      {/* district deck (carousel) when a zone is open */}
      {selZone && deckEvents.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 92px)", padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
            <button onClick={() => setEvIdx((i) => (i - 1 + deckEvents.length) % deckEvents.length)} style={{ width: 28, flexShrink: 0, border: `2px solid ${SK.ink}`, background: SK.white, cursor: "pointer", fontSize: 15, fontWeight: 900, color: SK.ink, lineHeight: 1 }}>←</button>
            <button onClick={() => openRef.current(deckEvents[evIdx])} style={{ flex: 1, minWidth: 0, display: "flex", gap: 0, textAlign: "left", padding: 0, border: `2.5px solid ${SK.ink}`, boxShadow: `3px 3px 0 ${SK.ink}`, background: SK.white, cursor: "pointer", overflow: "hidden" }}>
              <div style={{ width: 60, flexShrink: 0, borderRight: `2px solid ${SK.ink}`, overflow: "hidden", background: "#eee" }}>
                {deckEvents[evIdx]?.p && <img key={deckEvents[evIdx].id} src={deckEvents[evIdx].p!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "cs-burst-in 0.3s ease both" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, padding: "7px 9px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span style={{ fontWeight: 900, fontSize: 7.5, letterSpacing: "0.14em", textTransform: "uppercase", color: SK.blue }}>{deckEvents[evIdx]?.c}</span>
                <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.02em", lineHeight: 1, color: SK.ink, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deckEvents[evIdx]?.t}</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 5, fontFamily: FONT_MONO, fontSize: 9.5, color: "rgba(13,13,13,0.55)" }}>
                  <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{deckEvents[evIdx]?.v}</span>
                  <span style={{ color: SK.ink, fontWeight: 700, whiteSpace: "nowrap" }}>{deckEvents[evIdx]?.tm}</span>
                </div>
              </div>
            </button>
            <button onClick={() => setEvIdx((i) => (i + 1) % deckEvents.length)} style={{ width: 28, flexShrink: 0, border: `2px solid ${SK.ink}`, background: SK.white, cursor: "pointer", fontSize: 15, fontWeight: 900, color: SK.ink, lineHeight: 1 }}>→</button>
          </div>
          <div style={{ textAlign: "center", marginTop: 6, fontFamily: FONT_MONO, fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{evIdx + 1} / {deckEvents.length} · тап по карточке — открыть</div>
        </div>
      )}

      {/* enter CTA */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "20px 18px calc(env(safe-area-inset-bottom,0px) + 20px)", background: "linear-gradient(0deg, rgba(13,13,13,0.92), rgba(13,13,13,0))" }}>
        <button onClick={onEnter} style={{ width: "100%", padding: "15px 18px", border: "none", background: SK.blue, color: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,85,255,0.4)" }}>
          Войти в ленту <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
        </button>
      </div>
    </div>
  )
}
