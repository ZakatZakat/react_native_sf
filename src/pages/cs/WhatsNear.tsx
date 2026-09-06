/**
 * CitySignal · «Что рядом 4A» — стартовый экран-афиша по районам.
 *
 *  Порт дизайн-экспорта export-4a: список 5 районов Москвы (счётчик событий,
 *  места, постеры-дуотон) + тумблер СПИСОК/КАРТА. Данные — РЕАЛЬНЫЕ: события
 *  ленты раскладываются по районам той же геометрией, что и карта
 *  (zoneOf/inMoscow — копия из MapIntro, чтобы тюнинг карты не ехал по счётчикам).
 *  КАРТА переиспользует существующий 3D-MapIntro. «ВСЯ ЛЕНТА» / «ЛЕНТА РАЙОНА»
 *  → onEnter (вход в ленту). Экран рассчитан на мобильный вьюпорт (заполняет
 *  контейнер-родитель inset:0).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Ev } from "./buildDerived"
import { FONT_SANS, FONT_MONO } from "./shared"
import { venueInfo } from "./venues"
import { CS_STYLE_LIGHT } from "./csMapStyle"
import { analytics } from "../../lib/analytics"

const INK = "#0D0D0D"
const PAPER = "#FFFFFF"
const SIGNAL = "#0055FF"

// Центроиды районов для реальной карты (display-позиции из MapIntro ZONES,
// подтянутые к центру, чтобы дальний Восток/Юг влезали в кадр). [lng, lat].
const DISPLAY_LL: Record<string, [number, number]> = {
  center: [37.619, 55.7587],
  east: [37.6735, 55.7628],
  north: [37.6051, 55.8029],
  south: [37.6339, 55.7034],
  west: [37.5565, 55.7457],
}

// ── Геометрия районов — дословная копия MapIntro (локально, чтобы правки
//    камеры/зон в MapIntro не сдвигали молча эти счётчики). ──
const inMoscow = (lat: number, lng: number) => lat >= 55.3 && lat <= 56.1 && lng >= 36.9 && lng <= 38.0
const CITY: [number, number] = [55.752, 37.6175]
const R_CENTER_KM = 1.8
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

// Порядок и подписи районов как в дизайне 4A + позиции счётчиков на
// схематичной карте-превью (px внутри контейнера 394×148).
const ORDER: { id: string; name: string; badge: [number, number] }[] = [
  { id: "center", name: "ЦЕНТР", badge: [150, 58] },
  { id: "east", name: "ВОСТОК", badge: [296, 32] },
  { id: "north", name: "СЕВЕР", badge: [196, 14] },
  { id: "south", name: "ЮГ", badge: [212, 110] },
  { id: "west", name: "ЗАПАД", badge: [34, 74] },
]

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - ys.getTime()) / 86400000 + 1) / 7)
}

function venueName(e: Ev): string | null {
  const vi = e.venueKey ? venueInfo(e.venueKey) : null
  const n = (vi?.name || e.v || "").trim()
  return n || null
}

type Dist = { id: string; name: string; badge: [number, number]; n: number; meta: string; thumbs: string[] }

/** Реальная карта Москвы (brand-стиль MapLibre) вместо схематичного шаблона.
 *  Не интерактивная: используется как превью-подложка + как полотно режима
 *  КАРТА; поверх — HTML-плашки районов, спроецированные на реальные центроиды.
 *  interactive={false} по умолчанию (превью); в режиме КАРТА пины кликабельны. */
function MiniMap({
  dists,
  sel,
  onPick,
  onOpen,
  interactive = false,
  apiRef,
}: {
  dists: Dist[]
  sel: string
  onPick?: (id: string) => void
  onOpen?: () => void
  interactive?: boolean
  apiRef?: React.MutableRefObject<maplibregl.Map | null>
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [pins, setPins] = useState<Record<string, { x: number; y: number }>>({})

  useEffect(() => {
    if (!box.current) return
    let map: maplibregl.Map | null = null
    try {
      const pts = dists.map((d) => DISPLAY_LL[d.id]).filter(Boolean) as [number, number][]
      const b = new maplibregl.LngLatBounds(pts[0], pts[0])
      pts.forEach((p) => b.extend(p))
      map = new maplibregl.Map({
        container: box.current,
        style: CS_STYLE_LIGHT,
        bounds: b,
        fitBoundsOptions: { padding: interactive ? 64 : 30, maxZoom: 12 },
        interactive,
        attributionControl: false,
        pitch: 0,
      })
    } catch {
      return
    }
    mapRef.current = map
    if (apiRef) apiRef.current = map
    const reproject = () => {
      if (!map) return
      const next: Record<string, { x: number; y: number }> = {}
      for (const d of dists) {
        const ll = DISPLAY_LL[d.id]
        if (!ll) continue
        const p = map.project(ll)
        next[d.id] = { x: p.x, y: p.y }
      }
      setPins(next)
    }
    map.on("load", reproject)
    map.on("idle", reproject)
    return () => {
      map?.remove()
      mapRef.current = null
      if (apiRef) apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive])

  return (
    <div
      onClick={onOpen}
      style={{
        position: "absolute",
        inset: 0,
        cursor: onOpen ? "pointer" : "default",
        backgroundImage: "radial-gradient(rgba(13,13,13,0.18) 1px, transparent 1.4px)",
        backgroundSize: "12px 12px",
      }}
    >
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      {dists.map((d) => {
        const p = pins[d.id]
        if (!p) return null
        const on = d.id === sel
        return (
          <div
            key={d.id}
            onClick={
              interactive && onPick
                ? (e) => {
                    e.stopPropagation()
                    onPick(d.id)
                  }
                : undefined
            }
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              transform: "translate(-50%,-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 3,
              pointerEvents: interactive ? "auto" : "none",
              cursor: interactive ? "pointer" : "default",
              zIndex: on ? 3 : 2,
            }}
          >
            <span
              style={{
                background: on ? SIGNAL : PAPER,
                color: on ? PAPER : INK,
                border: `2px solid ${INK}`,
                fontFamily: FONT_MONO,
                fontWeight: 700,
                fontSize: interactive ? 12 : on ? 11 : 10,
                padding: interactive ? "2px 6px" : on ? "2px 5px" : "1px 4px",
              }}
            >
              {d.n}
            </span>
            {interactive && (
              <span
                style={{
                  background: on ? INK : PAPER,
                  color: on ? PAPER : INK,
                  border: `2px solid ${INK}`,
                  fontWeight: 900,
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  padding: "3px 6px",
                }}
              >
                {d.name}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function WhatsNear({ events, onEnter }: { events: Ev[]; onEnter: () => void }) {
  const [view, setView] = useState<"list" | "map">("list")
  const [sel, setSel] = useState<string>("center")
  const mapApiRef = useRef<maplibregl.Map | null>(null)

  const { dists, total } = useMemo(() => {
    const byZone: Record<string, Ev[]> = { center: [], north: [], east: [], south: [], west: [] }
    for (const e of events) {
      if (e.p && e.geo && inMoscow(e.geo[0], e.geo[1])) byZone[zoneOf(e.geo[0], e.geo[1])].push(e)
    }
    const dists: Dist[] = ORDER.map((z) => {
      const evs = byZone[z.id] || []
      const vc = new Map<string, number>()
      for (const e of evs) {
        const nm = venueName(e)
        if (nm) vc.set(nm, (vc.get(nm) ?? 0) + 1)
      }
      const meta =
        [...vc.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map((x) => x[0])
          .join(" · ") || "—"
      const thumbs = evs.filter((e) => e.p).slice(0, 3).map((e) => e.p as string)
      return { id: z.id, name: z.name, badge: z.badge, n: evs.length, meta, thumbs }
    })
    return { dists, total: dists.reduce((s, d) => s + d.n, 0) }
  }, [events])

  useEffect(() => {
    analytics.track("cs.wn.shown")
  }, [])

  const selD = dists.find((d) => d.id === sel) ?? dists[0]
  const wk = isoWeek(new Date())

  const enterFeed = (zone?: string) => {
    analytics.track("cs.wn.enter_feed", { zone: zone ?? "all" }, { data: zone ?? "all" })
    onEnter()
  }
  const openMap = () => {
    analytics.track("cs.wn.open_map", { zone: sel }, { data: sel })
    setView("map")
  }
  const pick = (id: string) => {
    setSel(id)
    analytics.track("cs.wn.district_tap", { zone: id }, { data: id })
  }

  const tog = (active: boolean) => ({
    flex: 1,
    textAlign: "center" as const,
    padding: "10px 0",
    border: `2px solid ${INK}`,
    background: active ? INK : PAPER,
    color: active ? PAPER : INK,
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: "0.18em",
    cursor: "pointer",
  })

  const duo = (url: string | undefined, w: number, h: number, br = 1) => (
    <div
      style={{
        width: w,
        height: h,
        flex: w ? undefined : 1,
        overflow: "hidden",
        background: "rgba(0,85,255,0.5)",
        border: `${br}px solid ${INK}`,
      }}
    >
      {url ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundImage: `url("${url}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "grayscale(1) contrast(1.05)",
            mixBlendMode: "multiply",
          }}
        />
      ) : null}
    </div>
  )

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: INK,
        fontFamily: FONT_SANS,
        overflow: "hidden",
      }}
    >
      {/* Edition strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px",
          borderBottom: `2px solid ${INK}`,
          fontWeight: 900,
          fontSize: 9,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
        }}
      >
        <span>N° 001</span>
        <span>MOSCOW · WK {wk}</span>
      </div>

      {/* Заголовок */}
      <div style={{ padding: "16px 16px 12px" }}>
        <div style={{ fontWeight: 900, fontSize: 40, lineHeight: 0.9, letterSpacing: "-0.045em" }}>ЧТО РЯДОМ</div>
        <div
          style={{
            display: "inline-block",
            marginTop: 10,
            background: SIGNAL,
            color: PAPER,
            fontFamily: FONT_MONO,
            fontWeight: 500,
            fontSize: 12,
            padding: "6px 10px",
          }}
        >
          {total} {plural(total, "событие", "события", "событий")} · 5 районов
        </div>
      </div>

      {/* Тумблер */}
      <div style={{ display: "flex", gap: 0, padding: "0 16px 14px" }}>
        <div onClick={() => setView("list")} style={tog(view === "list")}>
          СПИСОК
        </div>
        <div onClick={openMap} style={{ ...tog(view === "map"), borderLeft: 0 }}>
          КАРТА
        </div>
      </div>

      {view === "list" && (
      <>
      {/* Превью карты */}
      <div
        onClick={openMap}
        style={{ margin: "0 16px 14px", border: `2.5px solid ${INK}`, boxShadow: `4px 4px 0 ${SIGNAL}`, cursor: "pointer" }}
      >
        <div style={{ position: "relative", height: 124, overflow: "hidden", borderBottom: `2px solid ${INK}` }}>
          <MiniMap dists={dists} sel={sel} onOpen={openMap} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: PAPER }}>
          <span style={{ width: 8, height: 8, background: SIGNAL, display: "inline-block" }} />
          <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            {total} {plural(total, "событие", "события", "событий")} на карте
          </span>
          <span style={{ marginLeft: "auto", fontWeight: 900, fontSize: 10, letterSpacing: "0.15em", color: SIGNAL }}>РАЗВЕРНУТЬ →</span>
        </div>
      </div>

      {/* Строки районов */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", borderTop: `2px solid ${INK}` }}>
        {dists.map((d) => {
          const on = d.id === sel
          return (
            <div key={d.id} style={{ borderBottom: "1px solid rgba(13,13,13,0.18)" }}>
              <div
                onClick={() => pick(d.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: on ? INK : PAPER,
                  color: on ? PAPER : INK,
                  cursor: "pointer",
                }}
              >
                <div style={{ width: 52, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 30, lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {d.n}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.01em", textTransform: "uppercase" }}>{d.name}</div>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      opacity: 0.6,
                      marginTop: 3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {d.meta}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {duo(d.thumbs[0], 26, 36)}
                  {duo(d.thumbs[1], 26, 36)}
                </div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>→</div>
              </div>
              {on && (
                <div style={{ display: "flex", gap: 8, background: "rgba(13,13,13,0.06)", padding: "10px 16px 12px" }}>
                  <div
                    onClick={() => enterFeed(d.id)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "10px 0",
                      background: SIGNAL,
                      color: PAPER,
                      border: `2px solid ${INK}`,
                      boxShadow: `3px 3px 0 ${INK}`,
                      fontWeight: 900,
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      cursor: "pointer",
                    }}
                  >
                    ЛЕНТА РАЙОНА →
                  </div>
                  <div
                    onClick={openMap}
                    style={{ padding: "10px 13px", border: `2px solid ${INK}`, fontWeight: 900, fontSize: 11, letterSpacing: "0.18em", cursor: "pointer" }}
                  >
                    НА КАРТЕ
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      </>
      )}

      {view === "map" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderTop: `2px solid ${INK}`, overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <MiniMap dists={dists} sel={sel} interactive onPick={pick} apiRef={mapApiRef} />
            <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", zIndex: 5 }}>
              <span
                onClick={() => mapApiRef.current?.zoomIn()}
                style={{ width: 34, height: 34, border: `2px solid ${INK}`, background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, cursor: "pointer" }}
              >
                +
              </span>
              <span
                onClick={() => mapApiRef.current?.zoomOut()}
                style={{ width: 34, height: 34, border: `2px solid ${INK}`, borderTop: 0, background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, cursor: "pointer" }}
              >
                −
              </span>
            </div>
            <span
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                background: PAPER,
                border: `2px solid ${INK}`,
                fontWeight: 900,
                fontSize: 9,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                padding: "6px 8px",
                zIndex: 5,
              }}
            >
              Тапни район
            </span>
          </div>
          <div style={{ borderTop: `2.5px solid ${INK}`, padding: "12px 16px 14px", background: PAPER }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 24, letterSpacing: "-0.025em", textTransform: "uppercase" }}>{selD.name}</span>
              <span style={{ background: SIGNAL, color: PAPER, fontFamily: FONT_MONO, fontSize: 11, padding: "3px 7px" }}>{selD.n}</span>
              <span
                onClick={() => setView("list")}
                style={{ marginLeft: "auto", fontWeight: 900, fontSize: 10, letterSpacing: "0.15em", color: SIGNAL, cursor: "pointer" }}
              >
                СПИСКОМ ↑
              </span>
            </div>
            <div
              style={{
                fontWeight: 500,
                fontSize: 11,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(13,13,13,0.55)",
                marginTop: 6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selD.meta}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {duo(selD.thumbs[0], 0, 76, 1.5)}
              {duo(selD.thumbs[1], 0, 76, 1.5)}
              {duo(selD.thumbs[2], 0, 76, 1.5)}
            </div>
            <div
              onClick={() => enterFeed(sel)}
              style={{
                textAlign: "center",
                padding: "14px 0",
                marginTop: 12,
                background: INK,
                color: PAPER,
                boxShadow: `4px 4px 0 ${SIGNAL}`,
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: "0.18em",
                cursor: "pointer",
              }}
            >
              ЛЕНТА РАЙОНА →
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ borderTop: `2.5px solid ${INK}`, padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)", background: PAPER }}>
        <div
          onClick={() => enterFeed()}
          style={{
            textAlign: "center",
            padding: "15px 0",
            background: INK,
            color: PAPER,
            boxShadow: `4px 4px 0 ${SIGNAL}`,
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: "0.18em",
            cursor: "pointer",
          }}
        >
          ВСЯ ЛЕНТА →
        </div>
      </div>
    </div>
  )
}
