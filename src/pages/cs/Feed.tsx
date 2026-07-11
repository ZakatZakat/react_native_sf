/**
 * CitySignal · 07 · Лента (v3 scrapbook).
 *
 *  Three brand-aligned collage views:
 *    • Дневник  (DiaryView)   — free poster collage with angled cutouts
 *    • Доска    (BoardView)   — two columns with profile + refresh on top
 *    • Журнал   (JournalView) — calm reading column, alternates L/R
 *
 *  All views reuse Curator events through useDerived().feed and render
 *  through the Clip/Polaroid scrapbook atoms in shared.tsx. Edge presets
 *  (Контур/Жирный/Карточка/Паспарту) flow via EdgeCtx.
 *
 *  URL params:
 *    ?view=diary|board|journal   (default: board)
 *    ?edge=thin|bold|card|mat    (default: thin)
 *    ?btn=a|b|c                  (refresh-glyph variant on Board; default b)
 *
 *  The previous 7-variant editorial feed (Cover/Shelves/Magazine/Catalog/
 *  Spread/Billboard/Combo) is removed per v3 spec.
 */

import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  CS, FONT_MONO, FONT_SANS, ScreenBG,
  NavCtx, ProfileBadge, BillboardProfileBadge,
  EventModalProvider, GoingProvider, useOpenEvent,
  // v3 scrapbook
  SK, EdgeCtx, EDGE_PRESETS,
  Clip, Polaroid, Hand, Lbl, Scribble, Sparkle, Avatar, SkMark,
} from "./shared"
import type { Ev } from "./buildDerived"
import { useDerived, useJourneyState } from "./useJourney"
import CsFeedLegacy from "./FeedLegacy"
import MapIntro from "./MapIntro"

const FALLBACK: Ev = {
  id: "—", t: "—", sub: "", v: "—", d: "—", tm: "—",
  p: null, c: "—", catKey: "", ch: "@—",
  desc: "", price: "—", note: "", venueKey: "", ts: null,
}

/** Pick N events from the feed; pad with positionally-unique placeholders
 *  so views with hardcoded slots can still render layout while the feed
 *  warms up (unique ids keep React's reconciliation happy). */
function pad(feed: Ev[], n: number): Ev[] {
  const out: Ev[] = feed.slice(0, n)
  while (out.length < n) out.push({ ...FALLBACK, id: `__placeholder_${out.length}` })
  return out
}

// ── VARIANT 1 · Дневник ─────────────────────────────────────────────────

function DiaryView({ feed }: { feed: Ev[] }) {
  const E = pad(feed, 8)
  return (
    <div style={{ position: "relative", width: "100%", minHeight: 1180, paddingBottom: 60 }}>
      <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
        <Lbl size={9} style={{ letterSpacing: "0.3em" }}>пятница · 23 мая</Lbl>
        <div style={{ fontWeight: 900, fontSize: 44, letterSpacing: "-0.045em", lineHeight: 0.9, marginTop: 5, color: SK.ink }}>Москва</div>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", marginTop: 7 }}>
          <Lbl color={SK.ink} size={10} style={{ fontWeight: 700, letterSpacing: "0.24em" }}>неделя 22</Lbl>
          <Scribble color={"#E0162B"} w={64} style={{ marginTop: 2 }} />
        </div>
        <Sparkle color={SK.blue} s={17} style={{ position: "absolute", top: 20, left: 60 }} />
        <Sparkle color={"#E0162B"} s={12} style={{ position: "absolute", top: 60, right: 56 }} />
      </div>
      <div style={{ position: "absolute", top: 120, right: 10, textAlign: "right", zIndex: 3 }}>
        <Hand color={"#E0162B"} size={20} style={{ marginRight: 2 }}>кто ведёт</Hand>
        {feed.slice(0, 3).map((ev, k) => (
          <div key={ev.id + k} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            <Avatar label={ev.ch.replace(/^@/, "").slice(0, 1).toUpperCase()} color={[SK.blue, "#E0162B", SK.blue][k]} s={18} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: SK.ink }}>{ev.ch}</span>
          </div>
        ))}
      </div>

      <Polaroid ev={E[0]} w={128} rot={-4} ar={1.12} caption="до утра" capColor={SK.blue} style={{ position: "absolute", left: 10, top: 186 }} />
      <Hand color={SK.ink} size={17} style={{ position: "absolute", left: 12, top: 376, zIndex: 5 }}>{E[0].c || "клуб"} · {E[0].v.slice(0, 20)}</Hand>

      <Clip ev={E[3]} w={114} h={150} rot={4} style={{ position: "absolute", right: 12, top: 298 }} />
      <Hand color={SK.blue} size={19} style={{ position: "absolute", right: 12, top: 456, textAlign: "right", zIndex: 5 }}>{E[3].price !== "—" ? E[3].price : "вход свободный"}</Hand>

      <div style={{ position: "absolute", left: 14, top: 420, zIndex: 5 }}>
        <Hand color={SK.ink} size={16} style={{ display: "block", marginBottom: 3 }}>
          <SkMark color={SK.blue}>лид недели —</SkMark>
        </Hand>
        <Polaroid ev={E[1]} w={140} rot={3} ar={0.84} caption="редакция топит" capColor={"#E0162B"} />
      </div>
      <Sparkle color={SK.blue} s={15} style={{ position: "absolute", left: 150, top: 456 }} />

      <Clip ev={E[4]} w={112} h={146} rot={-5} style={{ position: "absolute", right: 14, top: 552 }} />
      <div style={{ position: "absolute", right: 12, top: 706, textAlign: "right", zIndex: 5 }}>
        <Hand color={SK.blue} size={19}>open-air</Hand>
        <div><Lbl size={9}>{E[4].d} · {E[4].tm}</Lbl></div>
      </div>

      <div style={{ position: "absolute", left: 112, top: 662, zIndex: 7, display: "inline-flex", alignItems: "center", gap: 6, background: SK.paper, border: `2px solid ${SK.ink}`, padding: "7px 12px", transform: "rotate(-2deg)", boxShadow: "2px 2px 0 rgba(22,20,15,0.25)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: SK.blue }} />
        <Lbl color={SK.ink} size={10} style={{ fontWeight: 700, letterSpacing: "0.18em" }}>иду · {Math.max(1, Math.floor(feed.length / 2))}</Lbl>
      </div>

      <Clip ev={E[5]} w={118} h={148} rot={4} style={{ position: "absolute", left: 14, top: 736 }} />
      <Hand color={"#E0162B"} size={19} style={{ position: "absolute", left: 16, top: 896, zIndex: 5 }}>успей · {E[5].price !== "—" ? E[5].price : "ограничено"}</Hand>

      <Polaroid ev={E[7]} w={116} rot={-3} ar={1.0} caption="премьера" capColor={SK.ink} style={{ position: "absolute", right: 12, top: 762 }} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 1000, textAlign: "center" }}>
        <Scribble color={SK.ink35} w={110} />
        <div><Lbl size={9} style={{ letterSpacing: "0.24em" }}>{feed.length} событий · москва · wk22</Lbl></div>
      </div>
    </div>
  )
}

// ── VARIANT 2 · Доска (mapcombo: Карта + Афиша + Мозаика) ───────────────

/** Deterministic social-proof "идут N" count from the event id. */
function going(ev: Ev, i: number): number {
  let h = i * 53
  for (const ch of ev.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 380) + 64
}

/** Display label for the price chip. Real price wins; "вход свободный"
 *  etc. → "free". When there's no usable price we fall back to the start
 *  time, but only if curator actually gave one — otherwise null so the
 *  chip is hidden (no empty white tag). */
function priceLabel(ev: Ev): string | null {
  const p = (ev.price || "").trim()
  if (p && p !== "—") {
    if (/свобод|беспл|free/i.test(p)) return "free"
    if (p.length <= 12) return p
  }
  if (ev.tm && ev.tm !== "—") return ev.tm
  return null
}

function CatChip({ c, dark = false, style }: { c: string; dark?: boolean; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-block", background: dark ? SK.ink : "transparent", color: dark ? SK.paper : SK.ink, border: `1.5px solid ${SK.ink}`, padding: "2px 6px", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1, ...style }}>{c}</span>
  )
}

/** Self-contained price chip — always a solid, readable background so it
 *  works on white cards and over posters alike. Renders nothing when
 *  there's no price or time to show. The `solid` flag forces a white
 *  plate (used when sitting on top of a poster). */
function PriceTag({ ev, solid = false, style }: { ev: Ev; solid?: boolean; style?: React.CSSProperties }) {
  const label = priceLabel(ev)
  if (!label) return null
  const free = label === "free"
  return (
    <span style={{ display: "inline-block", background: free ? SK.blue : (solid ? SK.paper : "transparent"), color: free ? SK.paper : SK.ink, border: `1.5px solid ${free ? SK.blue : SK.ink}`, padding: "2px 6px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", lineHeight: 1.1, whiteSpace: "nowrap", ...style }}>{free ? "FREE" : label}</span>
  )
}

function GoingBar({ n, style }: { n: number; style?: React.CSSProperties }) {
  const pct = Math.min(100, Math.round((n / 440) * 100))
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...style }}>
      <div style={{ flex: 1, height: 4, background: SK.ink12, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: SK.blue }} />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 8.5, letterSpacing: "0.04em", color: SK.ink55, whiteSpace: "nowrap" }}>идут {n}</span>
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "24px 0 14px", ...style }}>
      <Lbl size={9} style={{ letterSpacing: "0.24em" }}>{children}</Lbl>
      <div style={{ flex: 1, height: 2, background: SK.ink }} />
    </div>
  )
}

/** Hero "выбор недели" card — poster + title + meta + price. */
function BoardLead({ ev }: { ev: Ev }) {
  const open = useOpenEvent()
  return (
    <div onClick={() => open(ev)} style={{ display: "flex", alignItems: "stretch", gap: 12, background: SK.paper, border: `2px solid ${SK.ink}`, boxShadow: `4px 4px 0 ${SK.ink}`, padding: 8, cursor: "pointer", animation: "sk-refresh 0.5s cubic-bezier(0.22,1,0.36,1) both" }}>
      {/* poster shown whole at its own aspect (no crop) — fits within a box,
          so a wide poster stays short and the card grows for a tall one.
          alignSelf center keeps it undistorted while the card stretches. */}
      {ev.p && <img src={ev.p} alt="" draggable={false} style={{ display: "block", flexShrink: 0, alignSelf: "center", maxWidth: 150, maxHeight: 172, width: "auto", height: "auto", border: `1.5px solid ${SK.ink}` }} />}
      {/* content stretches to the card height; rows spread edge-to-edge so the
          text/badges fill the component instead of clustering in a corner. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <CatChip c={ev.c} dark />
          <Lbl size={8} style={{ letterSpacing: "0.2em" }}>выбор редакции</Lbl>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 25, letterSpacing: "-0.03em", lineHeight: 0.96, color: SK.ink, textTransform: "uppercase", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.t}</div>
          {ev.sub && <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: 11, color: SK.ink55, marginTop: 3 }}>{ev.sub}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.04em", color: SK.ink, lineHeight: 1.5, minWidth: 0, overflow: "hidden" }}>{ev.v}<br />{ev.d} · {ev.tm}{ev.dur ? ` · ${ev.dur}` : ""}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <PriceTag ev={ev} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: SK.ink55, whiteSpace: "nowrap" }}>{ev.ch}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Square grid card — poster + chips + title. */
function GridCard({ ev, i }: { ev: Ev; i: number }) {
  const open = useOpenEvent()
  return (
    <div onClick={() => open(ev)} style={{ cursor: "pointer", animation: `sk-refresh 0.5s cubic-bezier(0.22,1,0.36,1) ${(i * 0.05).toFixed(2)}s both` }}>
      <Clip ev={ev} w="100%" h={132} rot={0} />
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <CatChip c={ev.c} />
          <PriceTag ev={ev} />
        </div>
        <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: "-0.02em", lineHeight: 0.98, marginTop: 6, color: SK.ink, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.t}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: "0.04em", color: SK.ink55, marginTop: 4 }}>{ev.d} · {ev.tm}</div>
      </div>
    </div>
  )
}

/** Masonry mosaic card — rotated poster with overlay chips + caption. */
/** Catalog card — one bordered component: framed poster (date badge) + a
 *  distinct footer block (meta · full title · venue · description). */
function MosaicCard({ ev, i }: { ev: Ev; i: number }) {
  const open = useOpenEvent()
  // Slight scrapbook tilt + gentle idle float. Three nested layers so the
  // transforms compose instead of overriding each other: entrance (once) →
  // float (idle, infinite) → static rotate on the card itself. Float only on
  // the first cards — hundreds of infinite anims would tax mobile.
  const rot = [-2.5, 2, -1.5, 2.5][i % 4]
  const dur = (4.6 + (Math.abs(rot) % 3) * 0.7).toFixed(2)
  const delay = ((Math.abs(Math.round(rot * 7)) % 20) / 10).toFixed(2)
  const float = i < 20
  // venue / subtitle only if it's a real place (not a bare @channel handle)
  const venue = ev.v && !ev.v.startsWith("@") ? ev.v : ""
  const time = ev.tm && ev.tm !== "—" ? ev.tm : ""
  const price = ev.price && ev.price !== "—" ? ev.price : ""
  const meta = [ev.ch, time, price].filter(Boolean).join(" · ")
  // description = the post body BELOW its first line (the first line is the
  // title, already shown in full above — don't repeat it).
  const nl = (ev.desc || "").indexOf("\n")
  const body = nl >= 0 ? ev.desc.slice(nl + 1).replace(/\s+/g, " ").trim() : ""
  return (
    <div style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: 20, animation: `sk-refresh 0.5s cubic-bezier(0.22,1,0.36,1) ${(Math.min(i, 12) * 0.06).toFixed(2)}s both` }}>
      <div style={{ animation: float ? `sk-float ${dur}s ease-in-out ${delay}s infinite` : undefined }}>
        <div
          onClick={() => open(ev)}
          style={{
            transform: `rotate(${rot}deg)`,
            background: SK.paper, border: `2.5px solid ${SK.ink}`,
            boxShadow: `3px 4px 0 ${SK.ink}`, overflow: "hidden", cursor: "pointer",
          }}
        >
          {/* poster — natural aspect so the whole image shows uncropped; the
              card grows to fit it (maxHeight caps a runaway-tall poster).
              Its bottom edge is the divider; the date badge floats top-right. */}
          <div style={{ position: "relative", minHeight: 120, borderBottom: `2.5px solid ${SK.ink}`, background: "#E4E4E1", overflow: "hidden" }}>
            {ev.p && <img src={ev.p} alt="" loading="lazy" style={{ width: "100%", height: "auto", maxHeight: 380, objectFit: "cover", display: "block" }} />}
            <span style={{ position: "absolute", top: 8, right: 8, background: SK.ink, color: SK.paper, fontWeight: 900, fontSize: 13, letterSpacing: "0.02em", lineHeight: 1, padding: "5px 8px" }}>{ev.d}</span>
          </div>
          {/* footer block */}
          <div style={{ padding: "9px 11px 11px" }}>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.03em", color: SK.ink55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
            <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.01em", lineHeight: 1.08, color: SK.ink, marginTop: 6, textTransform: "uppercase", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.t}</div>
            {venue && <div style={{ fontWeight: 700, fontSize: 11, lineHeight: 1.25, color: SK.ink55, marginTop: 5 }}>{venue}</div>}
            {body && (
              <div style={{ fontSize: 10.5, lineHeight: 1.34, color: SK.ink55, marginTop: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{body}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MosaicGrid({ events }: { events: Ev[] }) {
  // CSS multi-column = real masonry: the browser balances the two columns by
  // height, so variable-aspect posters no longer leave one column short with a
  // gap. `break-inside: avoid` on each card keeps it intact within a column.
  return (
    <div style={{ columnCount: 2, columnGap: 14 }}>
      {events.map((e, i) => <MosaicCard key={e.id} ev={e} i={i} />)}
    </div>
  )
}

// ── Real Moscow map (Leaflet + CARTO tiles) ─────────────────────────────

/** Real Moscow venue coordinates (lat, lng). Curator events don't carry
 *  geo, so each event is pinned at one of these (cycled by index) — pins
 *  scatter across real Moscow venues for the montage. */
const MOSCOW_GEO: [number, number][] = [
  [55.7283, 37.6755], // Шарикоподшипниковская
  [55.7360, 37.6190], // Дом музыки
  [55.7297, 37.6017], // Парк Горького
  [55.7409, 37.6110], // ГЭС-2
  [55.8401, 37.4870], // Сев. Речной вокзал
  [55.7700, 37.5980], // Театр.doc
  [55.7416, 37.6090], // Стрелка
  [55.7090, 37.6560], // ЗИЛ
]

function CsMap({ events, height = 236 }: { events: Ev[]; height?: number }) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const open = useOpenEvent()
  const openRef = useRef(open)
  openRef.current = open
  const [cat, setCat] = useState("Все")
  const [query, setQuery] = useState("")
  const [ready, setReady] = useState(false)

  const withGeo = useMemo(() => {
    const list = events.filter((e) => e.p && !e.id.startsWith("__placeholder")).slice(0, 8)
    // Prefer real geocoded coords; fall back to the Moscow venue pool
    // (cycled) for events that haven't been geocoded yet.
    return list.map((e, i) => ({ e, geo: e.geo ?? MOSCOW_GEO[i % MOSCOW_GEO.length] }))
  }, [events])

  const cats = useMemo(() => {
    const seen: string[] = []
    for (const { e } of withGeo) if (e.c !== "—" && !seen.includes(e.c)) seen.push(e.c)
    return ["Все", ...seen]
  }, [withGeo])

  // Init the map once.
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return
    // scrollWheelZoom off — the map lives inside a vertically scrolling
    // feed, so wheel-zoom would trap the page scroll. Zoom via the +/-
    // buttons (added below) and pinch (touchZoom, on by default).
    const map = L.map(boxRef.current, { center: [55.745, 37.62], zoom: 12, zoomControl: false, scrollWheelZoom: false, attributionControl: false })
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd" }).addTo(map)
    L.control.zoom({ position: "bottomright" }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    setReady(true)
    setTimeout(() => map.invalidateSize(), 150)
    setTimeout(() => map.invalidateSize(), 600)
    return () => { map.remove(); mapRef.current = null; layerRef.current = null }
  }, [])

  // Text matcher — search across title / venue / channel / category.
  const matches = (e: Ev) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${e.t} ${e.v} ${e.ch} ${e.c}`.toLowerCase().includes(q)
  }

  // Render / re-render markers when data, filters, query, or readiness change.
  useEffect(() => {
    const map = mapRef.current, lyr = layerRef.current
    if (!ready || !map || !lyr) return
    lyr.clearLayers()
    const pts: [number, number][] = []
    for (const { e, geo } of withGeo) {
      if (cat !== "Все" && e.c !== cat) continue
      if (!matches(e)) continue
      pts.push(geo)
      const icon = L.divIcon({
        className: "",
        html: `<div class="cs-pin"><div class="cs-pin-card"><img src="${e.p}" alt=""/></div><div class="cs-pin-tip"></div></div>`,
        iconSize: [50, 60], iconAnchor: [25, 60],
      })
      L.marker(geo, { icon }).addTo(lyr).on("click", () => openRef.current(e))
    }
    if (pts.length > 1) map.fitBounds(pts, { padding: [44, 44], maxZoom: 14, animate: true })
    else if (pts.length === 1) map.setView(pts[0], 14, { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withGeo, cat, query, ready])

  const visibleCount = withGeo.filter((p) => (cat === "Все" || p.e.c === cat) && matches(p.e)).length

  return (
    <div style={{ padding: "0 14px" }}>
      {/* search bar — filters pins by title / venue / channel / category */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: `2px solid ${SK.ink}`, background: SK.paper, padding: "9px 12px", boxShadow: `3px 3px 0 ${SK.ink}` }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}><circle cx="6" cy="6" r="4.4" stroke={SK.ink} strokeWidth="2" /><line x1="9.4" y1="9.4" x2="13" y2="13" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="искать место…"
            style={{
              flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
              fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.04em", color: SK.ink,
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Очистить" style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", padding: 0, fontFamily: FONT_SANS, fontWeight: 900, fontSize: 14, lineHeight: 1, color: SK.ink55 }}>✕</button>
          )}
        </div>
        <button aria-label="Где я" onClick={() => mapRef.current?.setView([55.745, 37.62], 12)} style={{ flexShrink: 0, width: 42, border: `2px solid ${SK.ink}`, background: SK.blue, boxShadow: `3px 3px 0 ${SK.ink}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2 L2 7 L7 9 L9 14 Z" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {/* category filter chips */}
      <div className="sk-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
        {cats.map((c) => {
          const on = cat === c
          return <button key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, padding: "6px 12px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : SK.paper, color: on ? SK.paper : SK.ink, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer" }}>{c}</button>
        })}
      </div>
      {/* map canvas — isolate so Leaflet's internal high z-index panes
          stay contained and never escape over the event sheet. */}
      <div style={{ position: "relative", isolation: "isolate", width: "100%", height, border: `2.5px solid ${SK.ink}`, boxShadow: `4px 4px 0 ${SK.ink}`, overflow: "hidden", background: "#EAEDF0" }}>
        <div ref={boxRef} style={{ position: "absolute", inset: 0 }} />
        {!ready && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}><Lbl size={10} style={{ letterSpacing: "0.2em" }}>загружаю карту…</Lbl></div>}
        <div style={{ position: "absolute", left: 10, top: 10, zIndex: 500, background: SK.ink, color: SK.paper, padding: "4px 9px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.08em", pointerEvents: "none" }}>{visibleCount} рядом · Москва</div>
      </div>
    </div>
  )
}

function RefreshGlyph({ variant = "b", spin = 0 }: { variant?: string; spin?: number }) {
  const wrap = (children: React.ReactNode) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <g style={{ transformOrigin: "12px 12px", transform: `rotate(${spin}deg)`, transition: "transform 0.7s cubic-bezier(0.34,1.12,0.64,1)" }}>{children}</g>
    </svg>
  )
  if (variant === "b") {
    // two chasing arrows (recycle)
    return wrap(<>
      <path d="M5 9 A7 7 0 0 1 18 7.5" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" />
      <polygon points="18,3.5 19.5,8.5 14,8" fill={SK.blue} />
      <path d="M19 15 A7 7 0 0 1 6 16.5" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" />
      <polygon points="6,20.5 4.5,15.5 10,16" fill={SK.blue} />
    </>)
  }
  if (variant === "c") {
    // rotating square + dot
    return wrap(<>
      <rect x="5.5" y="5.5" width="13" height="13" stroke={SK.ink} strokeWidth="2" />
      <circle cx="12" cy="12" r="2.6" fill={SK.blue} />
    </>)
  }
  // a — single circular arrow
  return wrap(<>
    <path d="M12 5 A7 7 0 1 1 5 12" fill="none" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" />
    <polygon points="12.2,1.6 12.2,8.4 16.8,5" fill={SK.blue} />
  </>)
}

/** Full-screen catalog search — filters the board's events by title / venue /
 *  channel / category as you type; tap a result to open its sheet. Replaces the
 *  «искать место» search that lived in the removed inline map. */
function BoardSearch({ events, onClose }: { events: Ev[]; onClose: () => void }) {
  const open = useOpenEvent()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState("")
  useEffect(() => { inputRef.current?.focus() }, [])
  const query = q.trim().toLowerCase()
  const results = useMemo(
    () => (query
      ? events.filter((e) => `${e.t} ${e.v} ${e.ch} ${e.c}`.toLowerCase().includes(query))
      : events),
    [events, query],
  )
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: SK.paper, display: "flex", flexDirection: "column", fontFamily: FONT_SANS }}>
      {/* search bar + close */}
      <div style={{ flexShrink: 0, display: "flex", gap: 8, padding: "12px 14px", borderBottom: `2.5px solid ${SK.ink}` }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: `2px solid ${SK.ink}`, background: SK.paper, padding: "9px 12px", boxShadow: `3px 3px 0 ${SK.ink}` }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}><circle cx="6.5" cy="6.5" r="4.7" stroke={SK.ink} strokeWidth="2" /><line x1="10" y1="10" x2="13.5" y2="13.5" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" /></svg>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по афише…" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.03em", color: SK.ink }} />
          {q && <button onClick={() => setQ("")} aria-label="Очистить" style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", padding: 0, fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, lineHeight: 1, color: SK.ink55 }}>✕</button>}
        </div>
        <button onClick={onClose} aria-label="Закрыть поиск" style={{ flexShrink: 0, width: 42, border: `2px solid ${SK.ink}`, background: SK.ink, color: SK.paper, boxShadow: `3px 3px 0 ${SK.blue}`, cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>✕</button>
      </div>
      {/* count */}
      <div style={{ flexShrink: 0, padding: "10px 15px 2px", fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: SK.ink55 }}>{query ? "найдено" : "вся афиша"} · {results.length}</div>
      {/* results */}
      <div className="sk-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 15px 24px" }}>
        {results.length === 0 && (
          <div style={{ padding: "44px 0", textAlign: "center", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.04em", color: SK.ink55 }}>ничего не нашлось</div>
        )}
        {results.map((e) => {
          const venue = e.v && !e.v.startsWith("@") ? e.v : ""
          const date = [e.d, e.tm].filter((s) => s && s !== "—").join(" · ")
          const sub = [venue, e.ch].filter(Boolean).join(" · ")
          return (
            <button key={e.id} onClick={() => open(e)} style={{ width: "100%", display: "flex", gap: 11, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid rgba(13,13,13,0.12)", background: "transparent", cursor: "pointer", textAlign: "left" }}>
              <div style={{ flexShrink: 0, width: 46, height: 58, border: `2px solid ${SK.ink}`, background: "#E4E4E1", overflow: "hidden" }}>{e.p && <img src={e.p} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}</div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: SK.blue, color: "#fff", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 7.5, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 5px", whiteSpace: "nowrap" }}>{e.c}</span>
                  {date && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: SK.ink55, whiteSpace: "nowrap" }}>{date}</span>}
                </div>
                <div style={{ fontWeight: 900, fontSize: 13.5, lineHeight: 1.1, letterSpacing: "-0.01em", textTransform: "uppercase", color: SK.ink, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.t}</div>
                {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: SK.ink55, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BoardView({ feed, btn = "b", name = "Гость", onMap }: { feed: Ev[]; btn?: string; name?: string; onMap?: () => void }) {
  const nav = useContext(NavCtx)
  const [nonce, setNonce] = useState(0)
  const [sweep, setSweep] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  // Full upcoming catalog (already future-filtered + chronological upstream).
  const E = useMemo(() => feed.filter((e) => e && !e.id.startsWith("__placeholder")), [feed])
  // «Выбор недели» hero rotates through the soonest few on each refresh; the
  // catalog below always shows the rest of what's ahead.
  const heroIdx = E.length ? nonce % Math.min(E.length, 6) : 0
  const hero = E[heroIdx]
  const rest = E.filter((_, i) => i !== heroIdx)
  const refresh = () => { setNonce((n) => n + 1); setSweep((s) => s + 360) }
  const total = E.reduce((s, e, i) => s + going(e, i), 0)
  // Category filter — applies ONLY to the «Каталог» grid; «выбор недели» stays.
  const [cat, setCat] = useState("Все")
  const cats = useMemo(() => {
    const seen: string[] = []
    for (const e of E) if (e.c && e.c !== "—" && !seen.includes(e.c)) seen.push(e.c)
    return ["Все", ...seen]
  }, [E])
  const catalog = cat === "Все" ? rest : rest.filter((e) => e.c === cat)

  return (
    <div style={{ width: "100%", paddingBottom: 54 }}>
      {/* header — title block on the left, profile + refresh on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: 12, padding: "0 14px", marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", background: SK.paper, border: `2px solid ${SK.ink}`, padding: "11px 13px 12px", transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${SK.ink}` }}>
          <Lbl size={10} style={{ letterSpacing: "0.3em" }}>доска недели · wk 22</Lbl>
          <div style={{ fontWeight: 900, fontSize: 35, letterSpacing: "-0.045em", lineHeight: 0.9, marginTop: 4, color: SK.ink }}>Что в городе</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Lbl size={10}>{E.length} событий · москва</Lbl>
          </div>
        </div>
        {/* controls — 2×2 cluster: [search][ГО] on top, [refresh][map] below.
            Compact so the title card doesn't stretch tall. */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginTop: 2 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Поиск по афише"
              title="Поиск"
              style={{
                width: 38, height: 38, background: SK.paper,
                border: `2px solid ${SK.ink}`,
                boxShadow: `2.5px 2.5px 0 ${SK.blue}`,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0,
              }}
            >
              <svg width="19" height="19" viewBox="0 0 19 19" fill="none">
                <circle cx="8" cy="8" r="5.6" stroke={SK.ink} strokeWidth="2.2" />
                <line x1="12.3" y1="12.3" x2="17" y2="17" stroke={SK.ink} strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <ProfileBadge name={name} onClick={nav.openProfile} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={refresh}
              aria-label="Обновить ленту"
              style={{
                width: 38, height: 38, background: SK.paper,
                border: `2px solid ${SK.ink}`,
                boxShadow: `2.5px 2.5px 0 ${SK.blue}`,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0,
              }}
            >
              <RefreshGlyph variant={btn} spin={sweep} />
            </button>
            {onMap && (
              <button
                onClick={onMap}
                aria-label="Открыть карту"
                title="Карта"
                style={{
                  width: 38, height: 38, background: SK.paper,
                  border: `2px solid ${SK.ink}`,
                  boxShadow: `2.5px 2.5px 0 ${SK.blue}`,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21 C12 21 5 13.5 5 9 A7 7 0 0 1 19 9 C19 13.5 12 21 12 21 Z" stroke={SK.ink} strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="12" cy="9" r="2.6" fill={SK.blue} />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* category filter — chips filter the «Каталог» grid only (hero stays) */}
      <div className="sk-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 4px", marginBottom: 14 }}>
        {cats.map((c) => {
          const on = cat === c
          return (
            <button key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, padding: "6px 12px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : SK.paper, color: on ? SK.paper : SK.ink, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer" }}>{c}</button>
          )
        })}
      </div>

      {/* board body — выбор недели (hero) → каталог (filtered by category). The
          inline map was removed from the feed (the map lives in the intro). */}
      <div key={`${nonce}-${cat}`}>
        <div style={{ padding: "0 14px" }}>
          <SectionLabel>выбор недели</SectionLabel>
          {hero && <BoardLead ev={hero} />}
          <SectionLabel>каталог</SectionLabel>
          {catalog.length > 0 ? (
            <MosaicGrid events={catalog} />
          ) : (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: SK.ink55, letterSpacing: "0.04em", padding: "10px 2px 4px" }}>
              в категории «{cat.toLowerCase()}» пока пусто
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 30 }}>
        <span style={{ display: "inline-block", background: SK.ink, color: SK.paper, padding: "6px 12px" }}>
          <Lbl color={SK.paper} size={9} style={{ letterSpacing: "0.18em" }}>{total.toLocaleString("ru")} идут · обновлено сейчас</Lbl>
        </span>
      </div>

      {searchOpen && <BoardSearch events={E} onClose={() => setSearchOpen(false)} />}
    </div>
  )
}

// ── VARIANT 3 · Журнал ──────────────────────────────────────────────────

const NOTE_COLORS = [SK.blue, "#E0162B", SK.blue, "#E0162B"]

function JournalEntry({ ev, i }: { ev: Ev; i: number }) {
  const flip = i % 2 === 1
  const rot = [-3, 2.5, -2, 3][i % 4]
  const nc = NOTE_COLORS[i % 4]
  // Channel + venue copy on a per-side basis
  return (
    <div style={{
      position: "relative", display: "flex", gap: 13,
      alignItems: "flex-start",
      flexDirection: flip ? "row-reverse" : "row",
      padding: "0 18px", marginBottom: 8,
    }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Clip ev={ev} w={100} h={130} rot={rot} />
        <div style={{
          position: "absolute", bottom: -10,
          [flip ? "left" : "right"]: -4,
          fontFamily: FONT_MONO, fontSize: 8, letterSpacing: "0.08em",
          color: SK.ink55, transform: `rotate(${flip ? 4 : -4}deg)`,
        }}>{ev.ch}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 6, textAlign: flip ? "right" : "left" }}>
        <div style={{ display: "inline-block" }}>
          <SkMark color={SK.blue}>
            <Lbl color={SK.paper} size={9} style={{ fontWeight: 700, letterSpacing: "0.16em" }}>{ev.c}</Lbl>
          </SkMark>
        </div>
        <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.02em", lineHeight: 1.0, marginTop: 7, color: SK.ink }}>{ev.t}</div>
        {ev.sub && (
          <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: 10.5, color: SK.ink55, marginTop: 2 }}>{ev.sub}</div>
        )}
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.05em", color: SK.ink, marginTop: 7, lineHeight: 1.5 }}>
          {ev.v}<br />{ev.d} · {ev.tm} · {ev.price}
        </div>
        {ev.note && (
          <Hand color={nc} size={18} rot={flip ? 2 : -2} style={{ marginTop: 5 }}>{ev.note}</Hand>
        )}
      </div>
    </div>
  )
}

function JournalView({ feed, name = "Гость" }: { feed: Ev[]; name?: string }) {
  const nav = useContext(NavCtx)
  return (
    <div style={{ width: "100%", paddingBottom: 50 }}>
      <div style={{ padding: "0 18px" }}>
        <Lbl size={9} style={{ letterSpacing: "0.3em" }}>пятница · 23 мая · wk 22</Lbl>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 3 }}>
          <div style={{ fontWeight: 900, fontSize: 38, letterSpacing: "-0.045em", lineHeight: 0.86, color: SK.ink }}>Лента</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ display: "flex" }}>
              {feed.slice(0, 3).map((ev, k) => (
                <Avatar
                  key={ev.id + k}
                  label={ev.ch.replace(/^@/, "").slice(0, 1).toUpperCase()}
                  color={[SK.blue, "#E0162B", SK.blue][k]}
                  s={21}
                  style={{ marginLeft: k ? -7 : 0 }}
                />
              ))}
            </div>
            <ProfileBadge name={name} onClick={nav.openProfile} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
          <Hand color={SK.blue} size={19} rot={-1}>{feed.length} событий, отобранных вручную</Hand>
          <Sparkle color={"#E0162B"} s={13} />
        </div>
        <div style={{ height: 2, background: SK.ink, marginTop: 10 }} />
      </div>
      <div style={{ height: 20 }} />
      {feed.map((ev, i) => (
        <div key={ev.id + i}>
          <JournalEntry ev={ev} i={i} />
          {i < feed.length - 1 && (
            <div style={{ textAlign: "center", margin: "13px 0 17px" }}>
              <Scribble color={"rgba(13,13,13,0.16)"} w={140} />
            </div>
          )}
        </div>
      ))}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Hand color={SK.ink35} size={18}>— это всё на этой неделе —</Hand>
      </div>
    </div>
  )
}

// ── Billboard-style "dark" header used by views that ride on black ───────
// (kept available for future variants; not used in any of the 3 main views
// — but BillboardProfileBadge is still exported via shared.tsx) //
void BillboardProfileBadge

// ── Page entry — switches between the three views ───────────────────────

type FeedView = "diary" | "board" | "journal"
type FeedEdge = "thin" | "bold" | "card" | "mat"
type FeedBtn = "a" | "b" | "c"

export default function CsFeed() {
  const navigate = useNavigate()
  const { derived } = useDerived()
  const { name } = useJourneyState()
  const search = useSearch({ strict: false }) as Record<string, string | undefined>

  // Legacy editorial feed (pre-v3 Cover/Shelves/Magazine/...) is preserved
  // and reachable via ?legacy=1&v=0..6. Useful for design comparison.
  // Note: tanstack-router may parse "1" as number, so check truthy + not "0".
  if (search.legacy && String(search.legacy) !== "0") return <CsFeedLegacy />

  // v3 defaults: Доска · Контур · Цикл (per "Клиентский путь прод v3.html").
  const view: FeedView = (["diary", "board", "journal"].includes(search.view ?? "")
    ? (search.view as FeedView)
    : "board")
  const edgeKey: FeedEdge = (["thin", "bold", "card", "mat"].includes(search.edge ?? "")
    ? (search.edge as FeedEdge)
    : "thin")
  const btn: FeedBtn = (["a", "b", "c"].includes(search.btn ?? "")
    ? (search.btn as FeedBtn)
    : "b")

  const safeName = name.trim() || "Гость"
  const feed = derived.feed
  // All events (flattened from the category pool) — the map intro wants
  // every geocoded event, not just the 8 in the main feed.
  const allEvents = useMemo(() => Object.values(derived.pool).flat(), [derived])
  // Доска catalog — every UPCOMING event (from the start of today), soonest
  // first; undated events go last. Powers the «выбор недели» hero + full
  // «Каталог» so the board shows everything ahead, not a truncated slice.
  const boardCatalog = useMemo(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0)
    const c = cutoff.getTime()
    return allEvents
      .filter((e) => e.p && (e.ts == null || e.ts >= c))
      .sort((a, b) => (a.ts ?? Infinity) - (b.ts ?? Infinity))
  }, [allEvents])
  const edge = EDGE_PRESETS[edgeKey] ?? EDGE_PRESETS.thin

  const navValue = useMemo(
    () => ({ openProfile: () => navigate({ to: "/cs/profile" }) }),
    [navigate],
  )

  // v4 map-first intro — a 3D map overlay on first board entry per session.
  // Disable with ?nointro=1; reopen via the "↻ карта" button.
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return false
    if (search.nointro && String(search.nointro) !== "0") return false
    return !sessionStorage.getItem("cs.mapintro.seen")
  })
  const dismissIntro = () => {
    try { sessionStorage.setItem("cs.mapintro.seen", "1") } catch { /* noop */ }
    setShowIntro(false)
  }

  let inner: React.ReactNode
  if (view === "diary") inner = <DiaryView feed={feed} />
  else if (view === "journal") inner = <JournalView feed={feed} name={safeName} />
  else inner = <BoardView feed={boardCatalog} btn={btn} name={safeName} onMap={() => setShowIntro(true)} />

  return (
    <NavCtx.Provider value={navValue}>
      <GoingProvider>
        <EventModalProvider>
          <EdgeCtx.Provider value={edge}>
            {/* relative + 100dvh gives the absolute children a real
                positioning context (the App's Chakra Container is static
                with 0 content-height so absolute-only didn't fill the
                viewport). */}
            <div style={{
              position: "relative", width: "100%", height: "100dvh",
              background: CS.W, fontFamily: FONT_SANS, color: SK.ink,
              overflow: "hidden",
            }}>
              <ScreenBG theme="grid" opacity={0.5} />
              {/* While the map intro covers the board, DON'T mount it — not
                  even hidden. The board is the full upcoming catalog (200+
                  MosaicCards + their lazy posters) in a CSS multi-column
                  masonry; behind the opaque map that's 2500 dead DOM nodes,
                  200+ image decodes, and — every time a poster streams in and
                  changes a card's height — a full re-balance of all columns on
                  the main thread. That reflow storm is the stutter you feel the
                  instant the map opens. Unmounting also kills the flash-through
                  the old visibility:hidden guarded against (nothing to flash). */}
              <div className="sk-scroll" key={view} style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
                <div style={{ height: 46 }} />
                {!(view === "board" && showIntro) && inner}
              </div>
              {view === "board" && showIntro && <MapIntro events={allEvents} onEnter={dismissIntro} />}
            </div>
          </EdgeCtx.Provider>
        </EventModalProvider>
      </GoingProvider>
    </NavCtx.Provider>
  )
}

// Silence unused-import warning for FONT_MONO in case linter complains —
// (Hand and other atoms use it directly).
void FONT_MONO
