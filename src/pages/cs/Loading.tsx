/**
 * CitySignal · 02 · Загрузка.
 *
 *  Animated scan + progress + "CITYSIGNAL" wordmark on signal-blue.
 *  Auto-advances to /cs/name when the progress bar fills.
 */

import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import maplibregl from "maplibre-gl"
import { CS, FONT_MONO, FONT_SANS, useWordmarkFont } from "./shared"
import { CS_STYLE_LIGHT } from "./csMapStyle"

// Same intro view MapIntro opens at — so the prewarm fetches the right tiles.
const MSK: [number, number] = [37.62, 55.745]

export default function CsLoading() {
  const navigate = useNavigate()
  const [pct, setPct] = useState(0)
  const wmReady = useWordmarkFont() // hold the City/Signal lockup until Inter is loaded (no FOUT swap)
  const warmRef = useRef<HTMLDivElement>(null)

  // Prewarm the intro map while the loading screen runs: spin up the SAME
  // MapLibre map (csbrand style + JetBrains glyphs + Moscow vector tiles) in a
  // hidden, off-screen container so all its resources land in the browser HTTP
  // cache. When MapIntro mounts on /cs/feed it re-requests the identical URLs →
  // cache hits → the map draws almost immediately instead of showing a blank
  // canvas that fills in. Best-effort: any failure (no WebGL / tile errors) is
  // swallowed and the app behaves exactly as before.
  useEffect(() => {
    const el = warmRef.current
    if (!el) return
    let map: maplibregl.Map | null = null
    try {
      map = new maplibregl.Map({
        container: el,
        style: CS_STYLE_LIGHT,
        center: MSK, zoom: 10.5, pitch: 52, bearing: -14,
        interactive: false, attributionControl: false, antialias: false, fadeDuration: 0,
      })
      map.on("error", () => { /* warm is best-effort — ignore tile/style errors */ })
    } catch { /* no WebGL context available — skip warming */ }
    return () => { try { map?.remove() } catch { /* noop */ } }
  }, [])

  useEffect(() => {
    let raf: number
    let start: number | null = null
    const DUR = 2400
    const ease = (x: number) => 1 - Math.pow(1 - x, 2.4)
    const tick = (now: number) => {
      if (start == null) start = now
      const k = Math.min(1, (now - start) / DUR)
      setPct(Math.round(ease(k) * 100))
      if (k < 1) raf = requestAnimationFrame(tick)
      // v4 prod flow: skip the Name step — Loading rolls straight into the
      // "Неделя" intro screen, which auto-advances into the feed.
      else setTimeout(() => navigate({ to: "/cs/week" }), 520)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [navigate])

  const status =
    pct < 22 ? "Соединяюсь" :
    pct < 55 ? "Сканирую каналы" :
    pct < 88 ? "Отбираю сигнал" :
    pct < 100 ? "Собираю ленту" : "Готово"

  const L = (t: string, color: string) => (
    <div style={{ overflow: "hidden", padding: "0 2px" }}>
      <div style={{ fontWeight: 900, fontSize: 60, lineHeight: 0.86, letterSpacing: "-0.055em", textTransform: "uppercase", color }}>{t}</div>
    </div>
  )

  return (
    <div className="cs-jr" style={{ position: "fixed", inset: 0, background: CS.B, overflow: "hidden", fontFamily: FONT_SANS, display: "flex", flexDirection: "column" }}>
      {/* hidden map-prewarm surface — full-size (loads the right tiles) but invisible & non-interactive, behind the loading UI */}
      <div ref={warmRef} aria-hidden style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: "-20% -20%", pointerEvents: "none", opacity: 0.16, backgroundImage: "linear-gradient(#FFFFFF 1px, transparent 1px), linear-gradient(90deg, #FFFFFF 1px, transparent 1px)", backgroundSize: "22px 22px", animation: "cs-j-drift 6s linear infinite" }} />
      <div style={{ position: "absolute", left: 0, right: 0, height: 2, zIndex: 3, pointerEvents: "none", background: "rgba(255,255,255,0.75)", boxShadow: "0 0 14px 1px rgba(255,255,255,0.7)", animation: "cs-j-scan 2.6s cubic-bezier(0.45,0,0.55,1) infinite" }} />
      <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "44px 22px 0", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 7, height: 7, background: CS.W, animation: "cs-j-blink 1s steps(1) infinite" }} />N° 001</span>
        <span>MSC · SPB</span>
      </div>
      <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
        <div style={{ position: "relative", visibility: wmReady ? "visible" : "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, animation: "cs-j-ghost 3.4s ease-in-out infinite" }}>{L("City", CS.NAVY)}{L("Signal", CS.NAVY)}</div>
          <div style={{ position: "relative" }}>{L("City", CS.W)}{L("Signal", CS.W)}</div>
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 2, padding: "0 22px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: CS.W, fontWeight: 700 }}>{status}<span style={{ animation: "cs-j-blink 0.9s steps(1) infinite" }}>{pct < 100 ? "…" : " ✓"}</span></span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: "0.04em", color: CS.W, fontWeight: 700 }}>{String(pct).padStart(3, "0")}%</span>
        </div>
        <div style={{ height: 6, width: "100%", background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: pct + "%", background: CS.W, transition: "width 0.12s linear" }} />
        </div>
      </div>
    </div>
  )
}
