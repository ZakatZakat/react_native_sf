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

import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  CS, FONT_MONO, FONT_SANS, ScreenBG,
  NavCtx, ProfileBadge, BillboardProfileBadge,
  EventModalProvider, GoingProvider, useOpenEvent,
  // v3 scrapbook
  SK, EdgeCtx, EDGE_PRESETS,
  Clip, Polaroid, Hand, Lbl, Scribble, Sparkle, SkMark, stripHandles,
} from "./shared"
import type { Ev } from "./buildDerived"
import { INTERESTS } from "../pipe/preferences"
import { weekMeta } from "./WeekDesigns"

// Метка крупной категории → её символ из таксономии (◤ ▶ ♪ ▦ …) — ведущий глиф
// на чипах фильтра, чтобы категории читались и «фирменно», и быстрее.
const CAT_SYM = new Map(INTERESTS.map((i) => [i.label, i.symbol]))
import { useDerived, useJourneyState } from "./useJourney"
import { analytics } from "../../lib/analytics"
import CsFeedLegacy from "./FeedLegacy"
import MapIntro from "./MapIntro"

const FALLBACK: Ev = {
  id: "—", t: "—", sub: "", v: "—", d: "—", tm: "—",
  p: null, c: "—", catKey: "", ch: "@—",
  desc: "", price: "—", note: "", venueKey: "", ts: null,
  access: "", age: "", tier: "", friction: 1,
}

// ── Доступность как первоклассный сигнал (фидбек #3) ─────────────────────
// Бейдж-«штамп» (вариант B): белый блок с жирной рамкой + смещённой тенью и
// ведущим цветным квадратом-индикатором. Цвет квадрата = барьер входа: синий —
// «просто приходи», красный — «уже не попасть», чёрный — «нужно действие».
const ACCESS_LABEL: Record<string, string> = {
  free: "свободно",
  registration: "нужна регистрация",
  registration_closed: "регистрация закрыта",
  ticket: "по билетам",
  signup: "по записи",
  accreditation: "аккредитация",
  sold_out: "мест нет",
}
// «Жёсткие» барьеры (уже не попасть) — красный квадрат (и тонут в конец каталога).
const HARD_ACCESS = new Set(["registration_closed", "sold_out"])
const RED = "#E0162B"
// Цвет квадрата-индикатора: свободно → синий, жёсткий барьер → красный, иначе чёрный.
function accessSquare(access: string): string {
  if (access === "free") return CS.B
  if (HARD_ACCESS.has(access)) return RED
  return SK.ink
}

/** Блок-штамп: рамка + смещённая тень + цветной квадрат + подпись капсом.
 *  Углы прямые (квадратный вид) — по вкусу. */
function StampBadge({ label, square, style }: { label: string; square: string; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
      fontFamily: FONT_SANS, fontWeight: 800, fontSize: 9.5, letterSpacing: "0.05em",
      textTransform: "uppercase", lineHeight: 1, padding: "4px 8px 4px 5px",
      background: SK.paper, color: SK.ink, border: `2px solid ${SK.ink}`,
      boxShadow: `2px 2px 0 ${SK.ink}`, ...style,
    }}>
      <span style={{ width: 10, height: 10, flex: "0 0 auto", background: square }} />
      {label}
    </span>
  )
}

/** Бейдж доступа. Рендерит «свободно» и все барьеры; пусто — без сигнала. */
function AccessTag({ ev, style }: { ev: Ev; style?: React.CSSProperties }) {
  const label = ACCESS_LABEL[ev.access]
  if (!label) return null
  return <StampBadge label={label} square={accessSquare(ev.access)} style={style} />
}

/** Возрастной ценз «18+» — тот же штамп с чёрным квадратом. */
function AgeTag({ ev, style }: { ev: Ev; style?: React.CSSProperties }) {
  if (!ev.age) return null
  return <StampBadge label={ev.age} square={SK.ink} style={style} />
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
  const wk = weekMeta()
  return (
    <div style={{ position: "relative", width: "100%", minHeight: 1180, paddingBottom: 60 }}>
      <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
        <Lbl size={9} style={{ letterSpacing: "0.3em" }}>{wk.dates}</Lbl>
        <div style={{ fontWeight: 900, fontSize: 44, letterSpacing: "-0.045em", lineHeight: 0.9, marginTop: 5, color: SK.ink }}>Москва</div>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", marginTop: 7 }}>
          <Lbl color={SK.ink} size={10} style={{ fontWeight: 700, letterSpacing: "0.24em" }}>неделя {wk.n}</Lbl>
          <Scribble color={"#E0162B"} w={64} style={{ marginTop: 2 }} />
        </div>
        <Sparkle color={SK.blue} s={17} style={{ position: "absolute", top: 20, left: 60 }} />
        <Sparkle color={"#E0162B"} s={12} style={{ position: "absolute", top: 60, right: 56 }} />
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
        <div><Lbl size={9} style={{ letterSpacing: "0.24em" }}>{feed.length} событий · москва · wk{wk.n}</Lbl></div>
      </div>
    </div>
  )
}

// ── VARIANT 2 · Доска (mapcombo: Карта + Афиша + Мозаика) ───────────────

/** Display label for the price chip — only a real monetary price now. «Свободно»
 *  is carried by the access badge, and the start time already shows in the meta
 *  line, so the chip no longer doubles them (null → hidden, no empty tag). */
function priceLabel(ev: Ev): string | null {
  const p = (ev.price || "").trim()
  if (p && p !== "—" && !/свобод|беспл|free/i.test(p) && p.length <= 12) return p
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
    <div onClick={() => open(ev)} style={{ display: "flex", alignItems: "stretch", gap: 12, background: SK.paper, border: `2px solid ${SK.ink}`, borderRadius: 16, boxShadow: `4px 4px 0 ${SK.ink}`, padding: 8, cursor: "pointer", animation: "sk-refresh 0.5s cubic-bezier(0.22,1,0.36,1) both" }}>
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
          {(() => {
            // fit-to-length: the «выбор недели» title must read whole, not clip.
            // Short titles stay big and bold; long ones step down so they fit —
            // balanced line lengths, no mid-word «БЛАГОТВОРИТЕ…» cut.
            const len = (ev.t || "").length
            const fs = len <= 20 ? 27 : len <= 34 ? 22 : len <= 52 ? 18 : len <= 74 ? 15 : 13
            return (
              <div style={{ fontWeight: 900, fontSize: fs, letterSpacing: "-0.03em", lineHeight: 1.02, color: SK.ink, textTransform: "uppercase", overflowWrap: "break-word", textWrap: "balance", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{ev.t}</div>
            )
          })()}
          {ev.sub && <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: 11, color: SK.ink55, marginTop: 3 }}>{ev.sub}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.04em", color: SK.ink, lineHeight: 1.5, minWidth: 0, overflow: "hidden" }}>{ev.v}<br />{ev.d} · {ev.tm}{ev.dur ? ` · ${ev.dur}` : ""}</div>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, flexShrink: 0, maxWidth: "58%" }}>
            <AccessTag ev={ev} />
            <AgeTag ev={ev} />
            <PriceTag ev={ev} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Catalog card — one bordered component: framed poster (date badge) + a
 *  distinct footer block (meta · full title · venue · description). */
function MosaicCard({ ev, i, onImg }: { ev: Ev; i: number; onImg?: () => void }) {
  const open = useOpenEvent()
  // Poster failed to load (0-byte/404/corrupt) — a mosaic card is poster-first,
  // so drop the whole card rather than show a broken «?» tile. CSS columns reflow
  // automatically; onImg re-packs any JS-measured layout.
  const [broken, setBroken] = useState(false)
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
  // «Свободный вход» уносим из меты — его показывает синий бейдж «свободно»,
  // чтобы не дублировать; в мете остаётся время + реальная цена (₽).
  const price = ev.price && ev.price !== "—" && !/свобод|беспл|free/i.test(ev.price) ? ev.price : ""
  const meta = [time, price].filter(Boolean).join(" · ")
  // description = the post body BELOW its first line (the first line is the
  // title, already shown in full above — don't repeat it).
  const nl = (ev.desc || "").indexOf("\n")
  const body = nl >= 0 ? stripHandles(ev.desc.slice(nl + 1).replace(/\s+/g, " ").trim()) : ""
  if (broken) return null
  return (
    <div style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: 20, animation: `sk-refresh 0.5s cubic-bezier(0.22,1,0.36,1) ${(Math.min(i, 12) * 0.06).toFixed(2)}s both` }}>
      <div style={{ animation: float ? `sk-float ${dur}s ease-in-out ${delay}s infinite` : undefined }}>
        <div
          onClick={() => open(ev)}
          style={{
            transform: `rotate(${rot}deg)`,
            background: SK.paper, border: `2.5px solid ${SK.ink}`, borderRadius: 16,
            boxShadow: `3px 4px 0 ${SK.ink}`, overflow: "hidden", cursor: "pointer",
          }}
        >
          {/* poster — natural aspect so the whole image shows uncropped; the
              card hugs it (maxHeight caps a runaway-tall poster). No min-height
              floor — otherwise a wide (16:9) poster renders shorter than the
              floor and leaves an empty grey band below it. The card's bottom
              edge is the divider; the date badge floats top-right. */}
          <div style={{ position: "relative", borderBottom: `2.5px solid ${SK.ink}`, background: "#E4E4E1", overflow: "hidden", lineHeight: 0 }}>
            {/* NB: без loading="lazy" — нативный lazy для картинок во вложенном
                overflow:auto-скроллере не срабатывает в WebKit/iOS (Telegram),
                постеры остаются пустыми. Число картинок в DOM и так ограничено
                виндовингом MosaicGrid, поэтому грузим сразу. */}
            {ev.p && <img src={ev.p} alt="" onLoad={onImg} onError={() => { setBroken(true); onImg?.() }} style={{ width: "100%", height: "auto", maxHeight: 380, objectFit: "cover", display: "block" }} />}
            <span style={{ position: "absolute", top: 8, right: 8, background: SK.ink, color: SK.paper, fontWeight: 900, fontSize: 13, letterSpacing: "0.02em", lineHeight: 1, padding: "5px 8px" }}>{ev.d}</span>
          </div>
          {/* footer block */}
          <div style={{ padding: "9px 11px 11px" }}>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.03em", color: SK.ink55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
            {(ACCESS_LABEL[ev.access] || ev.age) && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 7 }}>
                <AccessTag ev={ev} />
                <AgeTag ev={ev} />
              </div>
            )}
            <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.015em", lineHeight: 1.06, color: SK.ink, marginTop: 6, textTransform: "uppercase", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.t}</div>
            {venue && <div style={{ fontWeight: 700, fontSize: 11, lineHeight: 1.25, color: SK.ink55, marginTop: 5 }}>{venue}</div>}
            {body && (
              <div style={{ fontSize: 10.5, lineHeight: 1.34, color: SK.ink55, marginTop: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{body}</div>
            )}
            {ev.tags && ev.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {ev.tags.slice(0, 3).map((tg) => (
                  <span key={tg} style={{ fontFamily: FONT_SANS, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase", color: CS.B, background: "rgba(0,85,255,0.10)", border: "1px solid rgba(0,85,255,0.30)", padding: "2px 5px", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", boxSizing: "border-box" }}>{tg}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MosaicGrid({ events }: { events: Ev[] }) {
  // Height-aware 2-column masonry. Each card is measured and placed into the
  // currently-SHORTER column (greedy) — so uneven poster heights don't leave a
  // big empty gap the way CSS `column-count` did (its heuristic balance made a
  // bad split when the filtered set was small/varied, ~200px of dead space).
  // Re-runs as posters load and change card heights (rAF-debounced).
  //
  // WINDOWING: render only the first `visible` cards, growing by STEP near the
  // bottom — rendering all ~150 posters at once was the entry-jank/reflow storm.
  const INITIAL = 10, STEP = 20, GAP = 14, VGAP = 20
  const [visible, setVisible] = useState(INITIAL)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const firstRef = useRef(false) // first layout of a set → place without animating
  const [layout, setLayout] = useState<{ pos: { x: number; y: number; w: number }[]; h: number; anim: boolean }>({ pos: [], h: 0, anim: false })
  useEffect(() => { setVisible(INITIAL); firstRef.current = false }, [events]) // reset on category/data change
  useEffect(() => {
    if (visible >= events.length) return
    // Walk UP from the grid to its real scroll container and grow the window
    // when the user nears the bottom. (There can be more than one `.sk-scroll`
    // in the tree, so query-by-class grabs the wrong one; and a viewport-root
    // IntersectionObserver won't fire inside this nested overflow:auto scroller.)
    let sc: HTMLElement | null = wrapRef.current?.parentElement ?? null
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement
    if (!sc) return
    const el = sc
    const onScroll = () => {
      // grow well BEFORE the bottom (2400px ≈ 3 screens) so the shorter column's
      // ragged gap is filled by new cards off-screen — otherwise you scroll into
      // a masonry "dead end" (one column ends ~a card short → white gap). Only
      // the true end of the list keeps a small ragged edge (masonry is like that).
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2400) {
        setVisible((v) => Math.min(v + STEP, events.length))
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    onScroll() // in case the initial window already fits without scrolling
    return () => el.removeEventListener("scroll", onScroll)
  }, [visible, events.length])
  const shown = events.slice(0, visible)
  const relayout = () => {
    const wrap = wrapRef.current
    if (!wrap) return
    const colW = Math.floor(((wrap.clientWidth || 375) - GAP) / 2)
    const colH = [0, 0]
    const pos = shown.map((_, i) => {
      const h = cardRefs.current[i]?.offsetHeight || 0
      const c = colH[0] <= colH[1] ? 0 : 1
      const p = { x: c * (colW + GAP), y: colH[c], w: colW }
      colH[c] += h + VGAP
      return p
    })
    setLayout({ pos, h: Math.max(0, Math.max(colH[0], colH[1]) - VGAP), anim: firstRef.current })
    firstRef.current = true
  }
  // deps are the STABLE inputs (a number + the prop ref), NOT `shown` — `shown`
  // is a fresh slice every render, so depending on it re-ran the effect on its
  // own setLayout → infinite loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(relayout, [visible, events])
  const scheduleRelayout = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(relayout) }
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])
  return (
    <div ref={wrapRef} style={{ position: "relative", height: layout.h || undefined }}>
      {shown.map((e, i) => (
        <div
          key={e.id}
          ref={(el) => { cardRefs.current[i] = el }}
          style={{ position: "absolute", left: 0, top: 0, width: layout.pos[i]?.w ?? "calc(50% - 7px)", transform: `translate(${layout.pos[i]?.x ?? 0}px, ${layout.pos[i]?.y ?? 0}px)`, transition: layout.anim ? "transform 0.22s cubic-bezier(0.22,1,0.36,1)" : "none" }}
        >
          <MosaicCard ev={e} i={i} onImg={scheduleRelayout} />
        </div>
      ))}
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState("")
  // Windowed render — the board can hold hundreds of events; mounting every
  // result row (each with an <img>) on open janks low-end phones. Show a page,
  // grow it as the user scrolls.
  const [shown, setShown] = useState(40)
  useEffect(() => { inputRef.current?.focus() }, [])
  const query = q.trim().toLowerCase()
  const results = useMemo(
    () => (query
      ? events.filter((e) => `${e.t} ${e.v} ${e.ch} ${e.c}`.toLowerCase().includes(query))
      : events),
    [events, query],
  )
  useEffect(() => { setShown(40); scrollRef.current?.scrollTo?.(0, 0) }, [query])
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 700) setShown((s) => (s < results.length ? s + 40 : s))
  }
  const list = results.slice(0, shown)
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
      <div ref={scrollRef} onScroll={onScroll} className="sk-scroll" style={{ flex: 1, overflowY: "auto", padding: "6px 15px 24px" }}>
        {results.length === 0 && (
          <div style={{ padding: "44px 0", textAlign: "center", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.04em", color: SK.ink55 }}>ничего не нашлось</div>
        )}
        {list.map((e) => {
          const venue = e.v && !e.v.startsWith("@") ? e.v : ""
          const date = [e.d, e.tm].filter((s) => s && s !== "—").join(" · ")
          const sub = venue
          return (
            <button key={e.id} onClick={() => { open(e); onClose() }} style={{ width: "100%", display: "flex", gap: 11, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid rgba(13,13,13,0.12)", background: "transparent", cursor: "pointer", textAlign: "left" }}>
              <div style={{ flexShrink: 0, width: 46, height: 58, border: `2px solid ${SK.ink}`, background: "#E4E4E1", overflow: "hidden" }}>{e.p && <img src={e.p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}</div>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ background: SK.blue, color: "#fff", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 7.5, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 5px", whiteSpace: "nowrap" }}>{e.c}</span>
                  {date && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: SK.ink55, whiteSpace: "nowrap" }}>{date}</span>}
                  <AccessTag ev={e} />
                  <AgeTag ev={e} />
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

// Скоринг героя «выбор редакции» (фидбек #4): наверх — предстоящее + доступное
// (free / без регистрации) + с конкретным местом. Меньше = лучше.
function heroScore(e: Ev): number {
  let s = e.friction                       // 0 (свободно) … 7 (sold out)
  if (e.ts == null) s += 1.5               // без даты — «приходи сейчас» слабее
  if (!e.v || e.v.startsWith("@")) s += 1  // нет конкретной площадки
  if (e.geo) s -= 0.5                       // геокодированное — точно есть куда идти
  return s
}

/** Полка «для знатока» (фидбек #5) — курируемый вниз хвост: закрытые/пресс/VIP-
 *  показы и анонсы закрытий. Не в герой и не в общий каталог — отдельной лентой
 *  в конце, чтобы редкий формат не выкидывать, но и не путать неопытного. */
function InsiderStrip({ events }: { events: Ev[] }) {
  const open = useOpenEvent()
  if (!events.length) return null
  return (
    <div style={{ marginTop: 10 }}>
      <SectionLabel>для знатока · по секрету</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.04em", color: SK.ink55, lineHeight: 1.45, margin: "-6px 0 12px" }}>
        Закрытые показы, пресс-события и редкие форматы — не для всех, но вдруг твоё.
      </div>
      <div className="sk-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
        {events.map((ev) => (
          <div key={ev.id} onClick={() => open(ev)} style={{ flexShrink: 0, width: 150, cursor: "pointer", background: SK.paper, border: `2px solid ${SK.ink}`, borderRadius: 12, overflow: "hidden", boxShadow: `3px 3px 0 ${SK.ink}` }}>
            <div style={{ position: "relative", background: "#E4E4E1", borderBottom: `2px solid ${SK.ink}`, lineHeight: 0 }}>
              {ev.p && <img src={ev.p} alt="" style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }} />}
              <span style={{ position: "absolute", top: 6, left: 6, background: SK.ink, color: SK.paper, fontFamily: FONT_MONO, fontWeight: 700, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", padding: "2px 5px" }}>инсайд</span>
            </div>
            <div style={{ padding: "8px 9px 10px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: SK.ink55, letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[ev.d, ev.tm].filter((s) => s && s !== "—").join(" · ") || "—"}</div>
              <div style={{ fontWeight: 900, fontSize: 12, lineHeight: 1.08, letterSpacing: "-0.01em", textTransform: "uppercase", color: SK.ink, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{ev.t}</div>
              {ACCESS_LABEL[ev.access] && <div style={{ marginTop: 7 }}><AccessTag ev={ev} /></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardView({ feed, searchFeed, btn = "b", name = "Гость", onMap }: { feed: Ev[]; searchFeed?: Ev[]; btn?: string; name?: string; onMap?: () => void }) {
  const nav = useContext(NavCtx)
  const wk = weekMeta()
  const [nonce, setNonce] = useState(0)
  const [sweep, setSweep] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  // Full upcoming catalog (already future-filtered + chronological upstream).
  const E = useMemo(() => feed.filter((e) => e && !e.id.startsWith("__placeholder")), [feed])
  // «Для знатока» (фидбек #5) — инсайд-контент (закрытые/пресс/VIP-показы, анонсы
  // закрытий) уводим из героя и общего каталога в отдельную полку внизу.
  const mainE = useMemo(() => E.filter((e) => e.tier !== "insider"), [E])
  const insiderE = useMemo(() => E.filter((e) => e.tier === "insider"), [E])
  // Герой «выбор редакции» (фидбек #4): из ещё НЕ начавшихся событий, ранжированных
  // по доступности (свободно / без регистрации / есть место+дата → выше). Крутим
  // топ-6 по refresh. Прошедшее сегодня (мастер-класс в 15:00, а сейчас 18:00) —
  // в шапку не берём.
  const heroPool = useMemo(() => {
    const now = Date.now()
    const up = mainE.filter((e) => e.ts == null || e.ts >= now)
    const base = up.length ? up : mainE
    return [...base].sort((a, b) => {
      const sa = heroScore(a), sb = heroScore(b)
      if (sa !== sb) return sa - sb
      return (a.ts ?? Infinity) - (b.ts ?? Infinity) // при равной доступности — раньше
    })
  }, [mainE])
  const hero = heroPool.length ? heroPool[nonce % Math.min(heroPool.length, 6)] : undefined
  const rest = mainE.filter((e) => e !== hero)
  const refresh = () => { setNonce((n) => n + 1); setSweep((s) => s + 360) }
  // Category filter — applies ONLY to the «Каталог» grid; «выбор недели» stays.
  const [cat, setCat] = useState("Все")
  const [tag, setTag] = useState<string | null>(null) // second-tier fine tag
  const cats = useMemo(() => {
    const seen: string[] = []
    for (const e of mainE) if (e.c && e.c !== "—" && !seen.includes(e.c)) seen.push(e.c)
    return ["Все", ...seen]
  }, [mainE])
  // events in the chosen category (before the fine-tag narrowing)
  const inCat = cat === "Все" ? rest : rest.filter((e) => e.c === cat)
  // second-row fine-tag chips — the tags that actually occur on this category's
  // events, ranked by frequency, top 12. Data-driven, no bundled taxonomy.
  const tagChips = useMemo(() => {
    const freq = new Map<string, number>()
    for (const e of inCat) for (const t of e.tags || []) freq.set(t, (freq.get(t) || 0) + 1)
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [E, cat])
  const filtered = tag ? inCat.filter((e) => e.tags?.includes(tag)) : inCat
  // Ранжирование по трению (фидбек #3): жёсткие барьеры (рега закрыта / sold out)
  // тонут в конец каталога; остальное сохраняет хронологический порядок (stable sort).
  const catalog = [...filtered].sort((a, b) => {
    const ha = HARD_ACCESS.has(a.access), hb = HARD_ACCESS.has(b.access)
    return ha === hb ? 0 : ha ? 1 : -1
  })
  // «Носик» подтег-лотка целится в ВЫБРАННУЮ категорию: меряем её позицию в
  // (скроллящемся) ряду и двигаем треугольник под неё; прячем, если она уехала.
  const catRowRef = useRef<HTMLDivElement | null>(null)
  const [beakX, setBeakX] = useState<number | null>(null)
  const measureBeak = () => {
    const row = catRowRef.current
    const btn = row?.querySelector('[data-active="1"]') as HTMLElement | null
    if (!row || !btn) { setBeakX(null); return }
    const bx = btn.getBoundingClientRect(), rx = row.getBoundingClientRect()
    const x = bx.left - rx.left + bx.width / 2
    setBeakX(x < 10 || x > rx.width - 10 ? null : x) // за краем ряда — прячем
  }
  useLayoutEffect(() => { measureBeak() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cat, tagChips.length])

  return (
    <div style={{ width: "100%", paddingBottom: 54 }}>
      {/* header — title block on the left, profile + refresh on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: 12, padding: "0 14px", marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", background: SK.paper, border: `2px solid ${SK.ink}`, padding: "11px 13px 12px", transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${SK.ink}` }}>
          <Lbl size={10} style={{ letterSpacing: "0.3em" }}>доска недели · wk {wk.n}</Lbl>
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
      <div ref={catRowRef} onScroll={measureBeak} className="sk-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 4px", marginBottom: (cat !== "Все" && tagChips.length > 0) ? 0 : 14 }}>
        {cats.map((c) => {
          const on = cat === c
          const sym = c !== "Все" ? CAT_SYM.get(c) : undefined
          return (
            <button key={c} data-active={on ? "1" : undefined} onClick={() => { setCat(c); setTag(null); analytics.track("cs.feed.filter", { kind: "category", value: c }) }} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : SK.paper, color: on ? SK.paper : SK.ink, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer" }}>
              {sym && <span style={{ fontWeight: 400, fontSize: 12.5, lineHeight: 1 }}>{sym}</span>}{c}
            </button>
          )
        })}
      </div>
      {/* Вариант 1 — подтеги раскрываются ИЗ-ПОД выбранной категории: «носик»-
          треугольник + выезд, в лёгком синем лотке, мельче и тонким синим. «Все»
          → второго ряда нет вообще (не тащим пустой уровень). */}
      {cat !== "Все" && tagChips.length > 0 && (
        <div key={cat} style={{ position: "relative", marginBottom: 14, animation: "sk-refresh 0.28s cubic-bezier(0.22,1,0.36,1) both" }}>
          {/* сплошная синяя стрелка вверх — целит в выбранную категорию */}
          {beakX != null && (
            <div style={{ position: "absolute", top: 1, left: beakX - 7, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: `8px solid ${CS.B}` }} />
          )}
          <div style={{ padding: "12px 0 0" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.16em", color: SK.ink55, textTransform: "uppercase", padding: "0 14px" }}>уточнить · <span style={{ color: CS.B, fontWeight: 700 }}>{cat}</span></div>
            <div className="sk-scroll" style={{ display: "flex", gap: 9, overflowX: "auto", padding: "9px 14px 8px" }}>
              {tagChips.map((t) => {
                const on = tag === t
                return (
                  <button key={t} onClick={() => { setTag(on ? null : t); if (!on) analytics.track("cs.feed.filter", { kind: "tag", value: t }) }} style={{ flexShrink: 0, padding: "6px 11px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : CS.B, color: "#fff", boxShadow: `2.5px 2.5px 0 ${on ? CS.B : SK.ink}`, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer" }}>{t}</button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* board body — выбор недели (hero) → каталог (filtered by category). The
          inline map was removed from the feed (the map lives in the intro). */}
      <div style={{ padding: "0 14px" }}>
        {/* hero re-animates only on refresh (nonce → new heroIdx); a category
            tap must not remount it. The catalog keys on the filter too, so its
            stagger replays when the visible set changes. */}
        <SectionLabel>выбор недели</SectionLabel>
        {hero && <div key={nonce}><BoardLead ev={hero} /></div>}
        <SectionLabel>каталог</SectionLabel>
        {catalog.length > 0 ? (
          <div key={`${nonce}-${cat}-${tag ?? ""}`}><MosaicGrid events={catalog} /></div>
        ) : (
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: SK.ink55, letterSpacing: "0.04em", padding: "10px 2px 4px" }}>
            {cat === "Все" ? "событий пока нет" : `в категории «${cat.toLowerCase()}» пока пусто`}
          </div>
        )}
        {cat === "Все" && <InsiderStrip events={insiderE} />}
      </div>

      {searchOpen && <BoardSearch events={searchFeed ?? E} onClose={() => setSearchOpen(false)} />}
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
  const wk = weekMeta()
  return (
    <div style={{ width: "100%", paddingBottom: 50 }}>
      <div style={{ padding: "0 18px" }}>
        <Lbl size={9} style={{ letterSpacing: "0.3em" }}>{wk.dates} · wk {wk.n}</Lbl>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 3 }}>
          <div style={{ fontWeight: 900, fontSize: 38, letterSpacing: "-0.045em", lineHeight: 0.86, color: SK.ink }}>Лента</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
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
  const { displayName: name } = useJourneyState()
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
  // Every UPCOMING event (from the start of today), soonest first; undated last.
  const upcoming = useMemo(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0)
    const c = cutoff.getTime()
    const now = Date.now()
    return allEvents
      .filter((e) => e.ts == null || e.ts >= c) // сегодняшние остаются (findable)
      .sort((a, b) => {
        // прошедшие сегодня тонут ПОД ещё-предстоящими (asc клал их наверх)
        const ap = a.ts != null && a.ts < now, bp = b.ts != null && b.ts < now
        if (ap !== bp) return ap ? 1 : -1
        return (a.ts ?? Infinity) - (b.ts ?? Infinity)
      })
  }, [allEvents])
  // Visual surfaces (board hero + poster mosaic + map) show only events WITH an
  // afisha poster — imageless posts (often digests/news) render bare as cards.
  // `upcoming` (with them) still feeds the search list so they stay findable.
  const boardCatalog = useMemo(() => upcoming.filter((e) => e.p), [upcoming])
  const mapEvents = useMemo(() => allEvents.filter((e) => e.p), [allEvents])
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
  else inner = <BoardView feed={boardCatalog} searchFeed={upcoming} btn={btn} name={safeName} onMap={() => setShowIntro(true)} />

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
                <div style={{ height: "calc(env(safe-area-inset-top, 0px) + 10px)" }} />
                {!(view === "board" && showIntro) && inner}
              </div>
              {view === "board" && showIntro && <MapIntro events={mapEvents} onEnter={dismissIntro} />}
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
