/**
 * CitySignal · v4 map-first intro.
 *
 *  A 3D MapLibre map (OpenFreeMap "liberty" vector tiles, tilted) shown over
 *  the feed on first entry — the "карта-первой" idea from v4. Real geocoded
 *  events drop as poster-pins; "Войти в ленту" dismisses into the feed.
 *
 *  Uses maplibre-gl (no API key; OpenFreeMap tiles). Falls back to a plain
 *  CTA card if WebGL/tiles fail or nothing is geocoded yet.
 */

import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Ev } from "./buildDerived"
import { SK, FONT_SANS, FONT_MONO } from "./shared"

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"
const MSK: [number, number] = [37.6173, 55.7558]

// Defensive Moscow bounding box — keeps a stray bad coordinate from
// dragging fitBounds across the whole country (prod data is cleaned, but
// guard anyway).
const inMoscow = (lat: number, lng: number) =>
  lat >= 55.3 && lat <= 56.1 && lng >= 36.9 && lng <= 38.0

function pinEl(e: Ev): HTMLElement {
  const el = document.createElement("div")
  el.className = "cs-pin"
  el.innerHTML =
    `<div class="cs-pin-card">` +
    (e.p ? `<img src="${e.p}" alt=""/>` : `<div style="width:100%;height:100%;background:#ccc"></div>`) +
    (e.c ? `<span class="cs-pin-cat">${e.c}</span>` : "") +
    `</div><div class="cs-pin-tip"></div>`
  return el
}

export default function MapIntro({ events, onEnter }: { events: Ev[]; onEnter: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const geos = events.filter((e) => e.geo && inMoscow(e.geo[0], e.geo[1]))
  const count = geos.length

  // Create the map once.
  useEffect(() => {
    if (!boxRef.current) return
    let map: maplibregl.Map | null = null
    try {
      map = new maplibregl.Map({
        container: boxRef.current,
        style: STYLE_URL,
        center: MSK,
        zoom: 10.6,
        pitch: 52,
        bearing: -14,
        antialias: true,
        attributionControl: false,
      })
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right")
      map.on("error", () => setFailed(true))
      map.on("load", () => setReady(true))
      mapRef.current = map
    } catch {
      setFailed(true)
    }
    return () => { try { map?.remove() } catch { /* noop */ } finally { mapRef.current = null } }
  }, [])

  // (Re)draw markers whenever the geocoded events arrive/change. Curator
  // data loads async, so this runs after the map is ready AND data lands.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    const b = new maplibregl.LngLatBounds()
    geos.forEach((e) => {
      const ll: [number, number] = [e.geo![1], e.geo![0]] // [lng, lat]
      b.extend(ll)
      markersRef.current.push(new maplibregl.Marker({ element: pinEl(e), anchor: "bottom" }).setLngLat(ll).addTo(map))
    })
    if (!b.isEmpty()) {
      map.fitBounds(b, { padding: { top: 100, bottom: 150, left: 60, right: 60 }, maxZoom: 13.5, duration: 900 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, count])

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: SK.ink, animation: "cs-mapintro-in 0.4s ease both", fontFamily: FONT_SANS }}>
      {!failed && <div ref={boxRef} style={{ position: "absolute", inset: 0, isolation: "isolate" }} />}
      {failed && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#16213a,#0d0d0d)" }} />
      )}

      {/* top header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "calc(env(safe-area-inset-top,0px) + 18px) 18px 14px", background: "linear-gradient(180deg, rgba(13,13,13,0.85), rgba(13,13,13,0))", color: "#fff", pointerEvents: "none" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>CitySignal · карта</div>
        <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.03em", marginTop: 4 }}>Что рядом</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
          {count > 0 ? `${count} событий на карте` : "Город на карте"}
        </div>
      </div>

      {/* enter CTA */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "20px 18px calc(env(safe-area-inset-bottom,0px) + 20px)", background: "linear-gradient(0deg, rgba(13,13,13,0.92), rgba(13,13,13,0))" }}>
        <button
          onClick={onEnter}
          style={{ width: "100%", padding: "15px 18px", border: "none", background: SK.blue, color: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,85,255,0.4)" }}
        >
          Войти в ленту <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
        </button>
      </div>
    </div>
  )
}
