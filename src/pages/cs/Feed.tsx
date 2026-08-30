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
import { closingSoon } from "./buildDerived"
import { isFresh, hasSeenNew, markNewSeen } from "./newBadge"
import { INTERESTS } from "../pipe/preferences"
import { weekMeta } from "./WeekDesigns"

// Метка крупной категории → её символ из таксономии (◤ ▶ ♪ ▦ …) — ведущий глиф
// на чипах фильтра, чтобы категории читались и «фирменно», и быстрее.
const CAT_SYM = new Map(INTERESTS.map((i) => [i.label, i.symbol]))
// Порядок чипов-категорий в фильтре: сначала «якорные» (выставки/кино/музыка),
// затем всё остальное в порядке первого появления. По просьбе — арт вперёд.
const CAT_PRIORITY = ["Выставки", "Кино", "Музыка"]
import { useDerived, useJourneyState } from "./useJourney"
import { analytics } from "../../lib/analytics"
import CsFeedLegacy from "./FeedLegacy"
import MapIntro from "./MapIntro"
import { FeedbackSheet } from "./FeedbackModal"

const FALLBACK: Ev = {
  id: "—", t: "—", sub: "", v: "—", d: "—", tm: "—",
  p: null, c: "—", catKey: "", ch: "@—",
  desc: "", price: "—", note: "", venueKey: "", ts: null,
  access: "", age: "", tier: "", friction: 1, createdTs: null,
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
function StampBadge({ label, square, style, compact = false }: { label: string; square: string; style?: React.CSSProperties; compact?: boolean }) {
  const b = compact ? 1.5 : 2
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: compact ? 4 : 5, whiteSpace: "nowrap",
      fontFamily: FONT_SANS, fontWeight: 800, fontSize: compact ? 8 : 9.5, letterSpacing: compact ? "0.03em" : "0.05em",
      textTransform: "uppercase", lineHeight: 1, padding: compact ? "3px 6px 3px 4px" : "4px 8px 4px 5px",
      background: SK.paper, color: SK.ink, border: `${b}px solid ${SK.ink}`,
      boxShadow: `${b}px ${b}px 0 ${SK.ink}`, ...style,
    }}>
      <span style={{ width: compact ? 7 : 10, height: compact ? 7 : 10, flex: "0 0 auto", background: square }} />
      {label}
    </span>
  )
}

/** Бейдж доступа. Рендерит «свободно» и все барьеры; пусто — без сигнала. */
function AccessTag({ ev, style, compact }: { ev: Ev; style?: React.CSSProperties; compact?: boolean }) {
  const label = ACCESS_LABEL[ev.access]
  if (!label) return null
  return <StampBadge label={label} square={accessSquare(ev.access)} style={style} compact={compact} />
}

/** Возрастной ценз «18+» — тот же штамп с чёрным квадратом. */
function AgeTag({ ev, style, compact }: { ev: Ev; style?: React.CSSProperties; compact?: boolean }) {
  if (!ev.age) return null
  return <StampBadge label={ev.age} square={SK.ink} style={style} compact={compact} />
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
function MosaicCard({ ev, i, onImg, onBroken }: { ev: Ev; i: number; onImg?: () => void; onBroken?: (id: string) => void }) {
  const open = useOpenEvent()
  // Poster failed to load (0-byte/404/corrupt) — a mosaic card is poster-first,
  // so drop the whole card rather than show a broken «?» tile. CSS columns reflow
  // automatically; onImg re-packs any JS-measured layout.
  const [broken, setBroken] = useState(false)
  // Бейдж «НОВОЕ»: свежее событие, ещё не виденное этим устройством. Как только
  // карточка побыла в вьюпорте ~1с — помечаем «просмотрено» и гасим бейдж.
  const [showNew, setShowNew] = useState(() => isFresh(ev) && !hasSeenNew(ev.id))
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!showNew || typeof IntersectionObserver === "undefined") return
    const el = rootRef.current
    if (!el) return
    let timer = 0
    const io = new IntersectionObserver((entries) => {
      const vis = entries.some((en) => en.isIntersecting)
      if (vis) timer = window.setTimeout(() => { markNewSeen(ev.id); setShowNew(false) }, 1000)
      else if (timer) { clearTimeout(timer); timer = 0 }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => { io.disconnect(); if (timer) clearTimeout(timer) }
  }, [showNew, ev.id])
  // Карточки держим ПРЯМО (без scrapbook-наклона) — квадратный бейдж на
  // наклонённой карточке читался «косо/резко». Оставляем только мягкий
  // вертикальный float (без вращения). `rot` — лишь для разброса тайминга float.
  const rot = [-2.5, 2, -1.5, 2.5][i % 4]
  const dur = (4.6 + (Math.abs(rot) % 3) * 0.7).toFixed(2)
  const delay = ((Math.abs(Math.round(rot * 7)) % 20) / 10).toFixed(2)
  const float = i < 20
  // venue / subtitle only if it's a real place (not a bare @channel handle)
  const venue = ev.v && !ev.v.startsWith("@") ? ev.v : ""
  // «00:00» — дефолт для события без указанного часа (парсится в полночь);
  // как в вебе (whenLabel) его НЕ показываем — только реальное время.
  const time = ev.tm && ev.tm !== "—" && ev.tm !== "00:00" ? ev.tm : ""
  // «Свободный вход» уносим — его показывает синий бейдж «свободно», чтобы не
  // дублировать; остаётся реальная цена (₽).
  const price = ev.price && ev.price !== "—" && !/свобод|беспл|free/i.test(ev.price) && ev.price.length <= 14 ? ev.price.trim() : ""
  // description = the post body BELOW its first line (the first line is the
  // title, already shown in full above — don't repeat it).
  const nl = (ev.desc || "").indexOf("\n")
  const body = nl >= 0 ? stripHandles(ev.desc.slice(nl + 1).replace(/\s+/g, " ").trim()) : ""
  if (broken) return null
  return (
    <div ref={rootRef} style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: 20, animation: `sk-refresh 0.5s cubic-bezier(0.22,1,0.36,1) ${(Math.min(i, 12) * 0.06).toFixed(2)}s both` }}>
      <div style={{ animation: float ? `sk-float ${dur}s ease-in-out ${delay}s infinite` : undefined }}>
        <div
          onClick={() => open(ev)}
          style={{
            background: SK.paper, border: `2.5px solid ${SK.ink}`,
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
            {ev.p && <img src={ev.p} alt="" onLoad={onImg} onError={() => { setBroken(true); onBroken?.(ev.id); onImg?.() }} style={{ width: "100%", height: "auto", maxHeight: 380, objectFit: "cover", display: "block" }} />}
            {(() => {
              const cs = closingSoon(ev)
              const hasDate = !!ev.d && ev.d !== "—"   // выставки-диапазоны без даты старта → бейдж не рисуем
              return (
                <>
                  {/* Дата — обычно top-right. Если есть красный бейдж «закрывается»
                      (top-left, длинный) — уводим дату в НИЖНИЙ правый угол, иначе на
                      узкой карточке плашка налезает на дату. Пустой «—» не показываем. */}
                  {hasDate && <span style={{ position: "absolute", right: 8, ...(cs ? { bottom: 8 } : { top: 8 }), background: SK.ink, color: SK.paper, fontWeight: 900, fontSize: 13, letterSpacing: "0.02em", lineHeight: 1, padding: "5px 8px" }}>{ev.d}</span>}
                  {cs && (
                    <span style={{ position: "absolute", top: 8, left: 8, background: "#E0162B", color: "#fff", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", padding: "4px 6px", border: `1.5px solid ${SK.ink}`, lineHeight: 1 }}>{cs.label}</span>
                  )}
                  {/* «НОВОЕ» — top-left, синий. Уступаем место красной плашке
                      «закрывается» (та важнее), поэтому только когда её нет. */}
                  {showNew && !cs && (
                    <span style={{ position: "absolute", top: 8, left: 8, background: CS.B, color: "#fff", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 7px", border: `1.5px solid ${SK.ink}`, boxShadow: `1.5px 1.5px 0 ${SK.ink}`, lineHeight: 1 }}>Новое</span>
                  )}
                </>
              )
            })()}
          </div>
          {/* footer block */}
          <div style={{ padding: "9px 11px 11px" }}>
            {/* время + доступ + возраст — компактные блок-штампы в один ряд;
                стремятся уместиться в одну строку (мельче + меньше gap) */}
            {(time || ACCESS_LABEL[ev.access] || price || ev.age) && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                {time && <StampBadge label={time} square={CS.B} compact />}
                <AccessTag ev={ev} compact />
                {price && <StampBadge label={price} square={SK.ink} compact />}
                <AgeTag ev={ev} compact />
              </div>
            )}
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "-0.01em", lineHeight: 1.08, color: SK.ink, marginTop: 8, textTransform: "uppercase", overflowWrap: "break-word", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.t}</div>
            {venue && <div style={{ fontWeight: 700, fontSize: 11, lineHeight: 1.25, color: SK.ink55, marginTop: 5 }}>{venue}</div>}
            {body && (
              <div style={{ fontSize: 10.5, lineHeight: 1.34, color: SK.ink55, marginTop: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{body}</div>
            )}
            {ev.tags && ev.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {ev.tags.slice(0, 3).map((tg) => (
                  <span key={tg} style={{ fontFamily: FONT_SANS, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase", color: "#fff", background: CS.B, border: `1.5px solid ${SK.ink}`, boxShadow: `2px 2px 0 ${SK.ink}`, padding: "3px 6px", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", boxSizing: "border-box" }}>{tg}</span>
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
  // Постеры-битые карточки (404/0-байт) МЫ ВЫКИДЫВАЕМ из раскладки целиком, а не
  // рендерим на месте `null`: иначе битая карточка держит слот в колонке нулевой
  // высоты, а над ней остаётся пустая дыра (симптом «секция едет не с начала»).
  // Исключаем их ДО окна/упаковки — остальные перетекают влево.
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  const markBroken = (id: string) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  const live = useMemo(() => events.filter((e) => !broken.has(e.id)), [events, broken])
  useEffect(() => { setVisible(INITIAL); firstRef.current = false; setBroken(new Set()) }, [events]) // reset on category/data change
  useEffect(() => {
    if (visible >= live.length) return
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
        setVisible((v) => Math.min(v + STEP, live.length))
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    onScroll() // in case the initial window already fits without scrolling
    return () => el.removeEventListener("scroll", onScroll)
  }, [visible, live.length])
  const shown = live.slice(0, visible)
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
  useLayoutEffect(relayout, [visible, live])
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
          <MosaicCard ev={e} i={i} onImg={scheduleRelayout} onBroken={markBroken} />
        </div>
      ))}
    </div>
  )
}

function RefreshGlyph({ spin = 0 }: { variant?: string; spin?: number }) {
  // круговая стрелка «обновить» — новый набор иконок шапки (пунктирный круг +
  // сплошной треугольник); currentColor, чтобы читать цвет плитки. Крутится на тап.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <g style={{ transformOrigin: "12px 12px", transform: `rotate(${spin}deg)`, transition: "transform 0.7s cubic-bezier(0.34,1.12,0.64,1)" }}>
        <circle cx="12" cy="12" r="8" strokeDasharray="37.7 12.6" strokeLinecap="butt" />
        <polygon points="12,0.9 12,7.1 17.6,4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}

// ── Плитки шапки «быстрые действия» (ПОИСК / ПРОФИЛЬ / ОБНОВИТЬ / ОТЗЫВ) ──
// Новый дизайн (вариант caption-below): белая плитка, ink-рамка, синяя тень,
// иконка по центру, подпись капсом под ней. Тап/наведение — лёгкий сдвиг.
const CTRL_TILE = 44
function CtrlTile({
  label, onClick, ariaLabel, children,
}: { label: string; onClick?: () => void; ariaLabel?: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false)
  const [press, setPress] = useState(false)
  const lift = press ? "translate(2px,2px)" : hover ? "translate(-1px,-1px)" : "none"
  const shadow = press ? `1px 1px 0 ${SK.blue}` : hover ? `5px 5px 0 ${SK.blue}` : `4px 4px 0 ${SK.blue}`
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false) }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      onTouchStart={() => setPress(true)}
      onTouchEnd={() => setPress(false)}
      style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}
    >
      <span
        style={{
          display: "flex", width: CTRL_TILE, height: CTRL_TILE, alignItems: "center", justifyContent: "center",
          background: SK.paper, color: SK.ink, border: `2.5px solid ${SK.ink}`,
          boxShadow: shadow, transform: lift,
          transition: "transform 0.13s cubic-bezier(0.22,1,0.36,1), box-shadow 0.13s cubic-bezier(0.22,1,0.36,1)",
        }}
      >{children}</span>
      <span style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 7.5, letterSpacing: "0.09em", textTransform: "uppercase", color: SK.ink, lineHeight: 1, whiteSpace: "nowrap" }}>{label}</span>
    </button>
  )
}

// Иконки набора — тонкий ink line-art (stroke=currentColor, квадратные торцы).
const CTRL_ICON = 22
const IconSearch = () => (
  <svg width={CTRL_ICON} height={CTRL_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="square">
    <circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="21" y2="21" />
  </svg>
)
const IconProfile = () => (
  <svg width={CTRL_ICON} height={CTRL_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="square">
    <circle cx="12" cy="8" r="4" /><path d="M4.5 21c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
  </svg>
)
const IconFeedback = () => (
  <svg width={CTRL_ICON} height={CTRL_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="square">
    <path d="M3 4h18v13H9l-6 4z" /><line x1="8" y1="10.5" x2="16" y2="10.5" />
  </svg>
)
const IconMap = () => (
  <svg width={CTRL_ICON} height={CTRL_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round">
    <path d="M12 21 C12 21 5 13.5 5 9 A7 7 0 0 1 19 9 C19 13.5 12 21 12 21 Z" /><circle cx="12" cy="9" r="2.4" fill="currentColor" stroke="none" />
  </svg>
)

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
  // «Выбор недели» = про эту неделю: мягкий штраф за дальние даты, чтобы событие
  // через месяц-полтора (напр. сентябрьское в июле) не возглавляло герой. Линейно
  // от 14 дней, кап +2: 14д→0, 28д→+1, 42д+→+2.
  if (e.ts != null) {
    const days = (e.ts - Date.now()) / 86400000
    if (days > 14) s += Math.min((days - 14) / 14, 2)
  }
  return s
}

function BoardView({ feed, searchFeed, btn = "b", name = "Гость", onMap }: { feed: Ev[]; searchFeed?: Ev[]; btn?: string; name?: string; onMap?: () => void }) {
  const nav = useContext(NavCtx)
  const wk = weekMeta()
  const [nonce, setNonce] = useState(0)
  const [sweep, setSweep] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [fbOpen, setFbOpen] = useState(false)
  const [heroIdx, setHeroIdx] = useState(0)  // «выбор недели»: индекс листаемого кандидата (стрелки ‹ ›)
  // Full upcoming catalog (already future-filtered + chronological upstream).
  const E = useMemo(() => feed.filter((e) => e && !e.id.startsWith("__placeholder")), [feed])
  // Полка «для знатока» убрана — insider-контент (закрытые/пресс/VIP-показы,
  // финисаж) теперь в общем каталоге наравне со всеми (по трению осядет вниз).
  const mainE = E
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
  // «Выбор недели» листается стрелками (heroIdx) по топ-N кандидатам того же
  // heroPool (доступность / близость даты). refresh тоже сдвигает.
  const heroN = Math.min(heroPool.length, 8)
  const heroCur = heroN ? (((heroIdx % heroN) + heroN) % heroN) : 0
  const hero = heroN ? heroPool[heroCur] : undefined
  const rest = mainE.filter((e) => e !== hero)
  const refresh = () => { setNonce((n) => n + 1); setSweep((s) => s + 360); setHeroIdx((i) => i + 1) }
  // Category filter — applies ONLY to the «Каталог» grid; «выбор недели» stays.
  const [cat, setCat] = useState("Все")
  const [tag, setTag] = useState<string | null>(null) // second-tier fine tag
  const [access, setAccess] = useState<string | null>(null) // фильтр по барьеру входа
  const cats = useMemo(() => {
    const seen: string[] = []
    for (const e of mainE) if (e.c && e.c !== "—" && !seen.includes(e.c)) seen.push(e.c)
    const origIdx = new Map(seen.map((c, i) => [c, i]))
    const pr = (c: string) => { const i = CAT_PRIORITY.indexOf(c); return i === -1 ? 99 : i }
    const ordered = [...seen].sort((a, b) => (pr(a) - pr(b)) || (origIdx.get(a)! - origIdx.get(b)!))
    return ["Все", ...ordered]
  }, [mainE])
  // events in the chosen category (before the fine-tag narrowing)
  const inCat = cat === "Все" ? rest : rest.filter((e) => e.c === cat)
  // статусы доступа, встречающиеся в категории — в порядке «доступнее → сложнее»
  const accessOptions = useMemo(() => {
    const present = new Set<string>()
    for (const e of inCat) if (ACCESS_LABEL[e.access]) present.add(e.access)
    const order = ["free", "registration", "signup", "ticket", "accreditation", "registration_closed", "sold_out"]
    return order.filter((a) => present.has(a))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [E, cat])
  // second-row fine-tag chips — the tags that actually occur on this category's
  // events, ranked by frequency, top 12. Data-driven, no bundled taxonomy.
  const tagChips = useMemo(() => {
    const freq = new Map<string, number>()
    for (const e of inCat) for (const t of e.tags || []) freq.set(t, (freq.get(t) || 0) + 1)
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [E, cat])
  let filtered = tag ? inCat.filter((e) => e.tags?.includes(tag)) : inCat
  if (access) filtered = filtered.filter((e) => e.access === access)
  // Строгий календарный порядок (из filtered — по дате), СТАБИЛЬНЫЙ между заходами
  // и «обновить». Жёсткие барьеры (рега закрыта / sold out) — в конец; внутри групп
  // порядок сохраняется (по дате). Как в веб-каталоге.
  const catalogAll = [
    ...filtered.filter((e) => !HARD_ACCESS.has(e.access)),
    ...filtered.filter((e) => HARD_ACCESS.has(e.access)),
  ]
  // «Последний шанс» — закрывающиеся в ближайшие дни (в осн. выставки), по
  // возрастанию дней. Отдельной полкой на дефолт-виде; из каталога убираем, чтобы
  // не дублировать.
  const closing = useMemo(() => mainE
    .map((e) => ({ e, cs: closingSoon(e) }))
    .filter((x) => x.cs)
    .sort((a, b) => a.cs!.days - b.cs!.days)
    .map((x) => x.e), [mainE])
  const showClosing = cat === "Все" && !tag && !access && closing.length > 0
  const closingSet = useMemo(() => new Set(closing.map((e) => e.id)), [closing])
  const catalog = showClosing ? catalogAll.filter((e) => !closingSet.has(e.id)) : catalogAll
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

  // Стрелка-переключатель «выбора недели».
  const HERO_ARROW: React.CSSProperties = { width: 26, height: 26, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `2px 2px 0 ${SK.blue}`, cursor: "pointer", fontWeight: 900, fontSize: 17, lineHeight: 1, color: SK.ink }

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
        {/* controls — 2×2 кластер иконок с подписями: [поиск][профиль] / [обновить][карта] */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 9, marginTop: 2 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <CtrlTile label="Поиск" ariaLabel="Поиск по афише" onClick={() => setSearchOpen(true)}>
              <IconSearch />
            </CtrlTile>
            <CtrlTile label="Профиль" onClick={nav.openProfile}>
              <IconProfile />
            </CtrlTile>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <CtrlTile label="Обновить" ariaLabel="Обновить ленту" onClick={refresh}>
              <RefreshGlyph spin={sweep} />
            </CtrlTile>
            <CtrlTile label="Отзыв" ariaLabel="Оставить отзыв" onClick={() => setFbOpen(true)}>
              <IconFeedback />
            </CtrlTile>
            {onMap && (
              <CtrlTile label="Карта" ariaLabel="Открыть карту" onClick={onMap}>
                <IconMap />
              </CtrlTile>
            )}
          </div>
        </div>
      </div>

      {/* category filter — chips filter the «Каталог» grid only (hero stays) */}
      <div ref={catRowRef} onScroll={measureBeak} className="sk-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 4px", marginBottom: (accessOptions.length > 0 || (cat !== "Все" && tagChips.length > 0)) ? 8 : 14 }}>
        {cats.map((c) => {
          const on = cat === c
          const sym = c !== "Все" ? CAT_SYM.get(c) : undefined
          return (
            <button key={c} data-active={on ? "1" : undefined} onClick={() => { setCat(c); setTag(null); setAccess(null); analytics.track("cs.feed.filter", { kind: "category", value: c }) }} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : SK.paper, color: on ? SK.paper : SK.ink, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer" }}>
              {sym && <span style={{ fontWeight: 400, fontSize: 12.5, lineHeight: 1 }}>{sym}</span>}{c}
            </button>
          )
        })}
      </div>
      {/* фильтр доступа — как в вебе: свободно / регистрация / билеты / … .
          Показываем статусы, реально встречающиеся в текущей категории. */}
      {accessOptions.length > 0 && (
        <div className="sk-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 14px 4px", marginBottom: (cat !== "Все" && tagChips.length > 0) ? 8 : 14 }}>
          {accessOptions.map((a) => {
            const on = access === a
            return (
              <button key={a} onClick={() => { setAccess(on ? null : a); if (!on) analytics.track("cs.feed.filter", { kind: "access", value: a }) }} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px 6px 7px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : SK.paper, color: on ? "#fff" : SK.ink, boxShadow: on ? `2.5px 2.5px 0 ${CS.B}` : `2.5px 2.5px 0 ${SK.ink}`, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer" }}>
                <span style={{ width: 11, height: 11, flex: "0 0 auto", background: on ? "#fff" : accessSquare(a) }} />
                {ACCESS_LABEL[a]}
              </button>
            )
          })}
        </div>
      )}
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
        {/* «выбор недели» + листание: стрелки ‹ N/M › крутят топ-кандидатов */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "24px 0 14px" }}>
          <Lbl size={9} style={{ letterSpacing: "0.24em" }}>выбор недели</Lbl>
          <div style={{ flex: 1, height: 2, background: SK.ink }} />
          {heroN > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button onClick={() => setHeroIdx((i) => i - 1)} aria-label="Предыдущий вариант" style={HERO_ARROW}>‹</button>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.06em", color: SK.ink55, minWidth: 30, textAlign: "center" }}>{heroCur + 1}/{heroN}</span>
              <button onClick={() => setHeroIdx((i) => i + 1)} aria-label="Следующий вариант" style={HERO_ARROW}>›</button>
            </div>
          )}
        </div>
        {hero && <div key={`hero-${heroCur}`}><BoardLead ev={hero} /></div>}
        {showClosing && (
          <>
            <SectionLabel>последний шанс · закрывается скоро</SectionLabel>
            <div key={`closing-${closing.length}`}><MosaicGrid events={closing} /></div>
          </>
        )}
        <SectionLabel>каталог</SectionLabel>
        {catalog.length > 0 ? (
          <div key={`${nonce}-${cat}-${tag ?? ""}-${access ?? ""}`}><MosaicGrid events={catalog} /></div>
        ) : (
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: SK.ink55, letterSpacing: "0.04em", padding: "10px 2px 4px" }}>
            {access ? "по этому фильтру пусто" : cat === "Все" ? "событий пока нет" : `в категории «${cat.toLowerCase()}» пока пусто`}
          </div>
        )}
      </div>

      {searchOpen && <BoardSearch events={searchFeed ?? E} onClose={() => setSearchOpen(false)} />}
      <FeedbackSheet open={fbOpen} onClose={() => setFbOpen(false)} />
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
      // старт в будущем / без даты / ИЛИ ещё идёт (конец сегодня-позже) — идущие
      // многодневные выставки с прошедшим открытием не выпадают из каталога.
      .filter((e) => e.ts == null || e.ts >= c || (e.endTs != null && e.endTs >= c))
      .sort((a, b) => {
        // «прошедшее» = и старт, и конец в прошлом; идущая выставка не тонет
        const ap = a.ts != null && a.ts < now && !(a.endTs != null && a.endTs >= now)
        const bp = b.ts != null && b.ts < now && !(b.endTs != null && b.endTs >= now)
        if (ap !== bp) return ap ? 1 : -1
        // будущий старт → по старту; идущее (старт в прошлом) → по дате закрытия
        const ka = a.ts != null && a.ts >= now ? a.ts : (a.endTs ?? a.ts ?? Infinity)
        const kb = b.ts != null && b.ts >= now ? b.ts : (b.endTs ?? b.ts ?? Infinity)
        return ka - kb
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
  // ВКЛЮЧЕНО (2026-08-30): при первом входе на доску за сессию показываем карту-
  // интро (раз за сессию, флаг cs.mapintro.seen; `?nointro=1` пропускает), плюс
  // кнопка «карта» в 2×2-кластере переоткрывает её. Чтобы снова отключить —
  // поставь MAP_ENABLED=false (доска грузится сразу, без карты).
  const MAP_ENABLED = true
  const [showIntro, setShowIntro] = useState(() => {
    if (!MAP_ENABLED) return false
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
  else inner = <BoardView feed={boardCatalog} searchFeed={upcoming} btn={btn} name={safeName} onMap={MAP_ENABLED ? () => setShowIntro(true) : undefined} />

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
