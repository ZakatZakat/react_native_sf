/**
 * CitySignal — shared atoms, tokens, types.
 *
 * Everything below is consumed by the 7 step pages under `src/pages/cs/`.
 * Anything truly screen-specific lives in its own page file.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react"

// ── Tokens ────────────────────────────────────────────────────────────────

export const CS = {
  K: "#0D0D0D", W: "#FFFFFF", B: "#0055FF", NAVY: "#001E73", PAGE: "#E4E4E1",
  G70: "rgba(13,13,13,0.70)", G55: "rgba(13,13,13,0.55)",
  G35: "rgba(13,13,13,0.35)", G18: "rgba(13,13,13,0.18)",
} as const

export const FONT_SANS = "var(--cs-font-sans)"
export const FONT_MONO = "var(--cs-font-mono)"

// Decorative "barcode" strip on the Pass card.
export const PBARS = [3, 6, 2, 8, 3, 5, 2, 7, 4, 3, 6, 2, 9, 3, 5, 2, 6, 3, 4, 7]

// ── Step metadata (single source of truth for the dropdown + nav) ─────────

export type StepKey = "landing" | "loading" | "name" | "pass" | "swipe" | "summary" | "feed"

export type StepKey2 = StepKey | "profile"

export const STEPS: { key: StepKey2; n: string; title: string; path: string }[] = [
  { key: "landing",  n: "01", title: "Лендинг",        path: "/cs/landing" },
  { key: "loading",  n: "02", title: "Загрузка",       path: "/cs/loading" },
  { key: "name",     n: "03", title: "Имя",            path: "/cs/name" },
  { key: "pass",     n: "04", title: "Пропуск",        path: "/cs/pass" },
  { key: "swipe",    n: "05", title: "Интересы",       path: "/cs/swipe" },
  { key: "summary",  n: "06", title: "Суммаризация",   path: "/cs/summary" },
  { key: "feed",     n: "07", title: "Лента",          path: "/cs/feed" },
  { key: "profile",  n: "08", title: "Профиль",        path: "/cs/profile" },
]

export function nextStep(from: StepKey): StepKey | null {
  const i = STEPS.findIndex((s) => s.key === from)
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1].key : null
}

// ── Keyframe injection (idempotent — once per page lifetime) ─────────────

const KEYFRAMES_ID = "cs-j-kf"
const KEYFRAMES = `
  .cs-jr, .cs-jr * { box-sizing: border-box; }
  @keyframes cs-tri-down { from { transform: translateY(-50%); } to { transform: translateY(0); } }
  @keyframes cs-tri-up   { from { transform: translateY(0); }     to { transform: translateY(-50%); } }
  @keyframes cs-j-rise   { from { opacity: 0; transform: translateY(108%); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cs-j-ghost  { 0%,100% { transform: translate(8px,10px); } 50% { transform: translate(13px,15px); } }
  @keyframes cs-j-scan   { 0% { top: 6%; } 100% { top: 94%; } }
  @keyframes cs-j-blink  { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0.2; } }
  @keyframes cs-j-drift  { from { transform: translate(0,0); } to { transform: translate(22px,22px); } }
  @keyframes cs-j-spring { 0% { opacity: 0; transform: translateY(16px) scale(0.96); } 60% { opacity: 1; transform: translateY(0) scale(1.02); } 100% { transform: translateY(0) scale(1); } }
  @keyframes cs-j-screen { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  /* loading→name transition + typewriter caret (export-prod dev integration) */
  @keyframes cs-j-up     { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cs-j-settle { from { transform: translateY(11px); } to { transform: translateY(0); } }
  @keyframes cs-j-caret  { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
  @keyframes cs-j-curtain { 0%, 15% { transform: translateY(0); } 100% { transform: translateY(-101%); } }
  @keyframes cs-j-curtain-fade { 0%, 50% { opacity: 1; } 100% { opacity: 0; } }
  @keyframes cs-j-curtain-mark { 0%, 15% { transform: translateY(0) scale(1); } 100% { transform: translateY(-24px) scale(0.86); } }
  @keyframes cs-j-stamp  { 0% { opacity: 0; transform: translateX(-50%) scale(0.5); } 100% { opacity: 1; } }
  .cs-shelf::-webkit-scrollbar { display: none; }
  .cs-shelf { scrollbar-width: none; }
`

/** Inject the keyframe stylesheet once. Call from any step component. */
export function useCsKeyframes() {
  useEffect(() => {
    if (typeof document === "undefined") return
    if (document.getElementById(KEYFRAMES_ID)) return
    const el = document.createElement("style")
    el.id = KEYFRAMES_ID
    el.textContent = KEYFRAMES
    document.head.appendChild(el)
    // Don't clean up — keyframes are global and re-injecting on every nav
    // is wasteful.
  }, [])
}

// ── Tiny atoms ────────────────────────────────────────────────────────────

export function Mark({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontWeight: 900, fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase",
      color: color || CS.K, lineHeight: 1, fontFamily: FONT_SANS, ...style,
    }}>{children}</span>
  )
}

export function Mono({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.16em",
      textTransform: "uppercase", color: color || CS.G55, ...style,
    }}>{children}</span>
  )
}

export function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return "—"
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

/** Poster — raw event image, full colour.
 *  Previously a blue-duotone (grayscale + signal-blue multiply + riso dots),
 *  but the design moved to natural photos so all CitySignal screens reuse
 *  this single component without any tint. */
export function DuotonePoster({ src, style }: { src: string | null; style?: React.CSSProperties }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: CS.W, ...style }}>
      {src ? (
        <img
          src={src}
          alt=""
          style={{
            width: "100%", height: "100%", objectFit: "cover", display: "block",
          }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", background: CS.G18 }} />
      )}
    </div>
  )
}

export function TriptychColumn({ posters, dur, dir, gap = 6 }: { posters: (string | null)[]; dur: number; dir: "up" | "down"; gap?: number }) {
  const strip = [...posters, ...posters]
  return (
    <div style={{ position: "relative", overflow: "hidden", background: CS.K, height: "100%", borderRight: `1.5px solid ${CS.K}` }}>
      <div style={{
        display: "flex", flexDirection: "column", gap, padding: `${gap}px`,
        animation: `cs-tri-${dir} ${dur}s linear infinite`, willChange: "transform",
      }}>
        {strip.map((p, i) => (
          <DuotonePoster
            key={`${p ?? "none"}-${i}`} src={p}
            style={{ width: "100%", aspectRatio: "1 / 1.32", border: `1px solid ${CS.K}`, flexShrink: 0 }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Background pattern (3 modernist styles) ──────────────────────────────

const THEME_PATTERN: Record<string, (col: string) => React.CSSProperties> = {
  dots:  (col) => ({ backgroundImage: `radial-gradient(${col} 1px, transparent 1.4px)`, backgroundSize: "12px 12px" }),
  grid:  (col) => ({ backgroundImage: `linear-gradient(${col} 1px, transparent 1px), linear-gradient(90deg, ${col} 1px, transparent 1px)`, backgroundSize: "24px 24px" }),
  rules: (col) => ({ backgroundImage: `repeating-linear-gradient(0deg, ${col} 0, ${col} 1px, transparent 1px, transparent 15px)` }),
  diag:  (col) => ({ backgroundImage: `repeating-linear-gradient(45deg, ${col} 0, ${col} 1.5px, transparent 1.5px, transparent 17px)` }),
  cross: (col) => ({ backgroundImage: `repeating-linear-gradient(45deg, ${col} 0, ${col} 1px, transparent 1px, transparent 13px), repeating-linear-gradient(-45deg, ${col} 0, ${col} 1px, transparent 1px, transparent 13px)` }),
}

export function ScreenBG({ theme = "dots", dark = false, opacity }: { theme?: string; dark?: boolean; opacity?: number }) {
  const col = dark ? "rgba(255,255,255,0.5)" : CS.G18
  const p = (THEME_PATTERN[theme] || THEME_PATTERN.dots)(col)
  return <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: opacity != null ? opacity : (dark ? 0.3 : 0.55), ...p }} />
}

// ── NavCtx — feed headers open the profile screen via this ───────────────

type NavValue = { openProfile: () => void }
export const NavCtx = createContext<NavValue>({ openProfile: () => {} })
export function useNav() { return useContext(NavCtx) }

// ── Typewriter — letter-by-letter print with a blinking caret ───────────

export function Typewriter({
  text, startDelay = 0, speed = 58, style, cursorColor = CS.B, onDone,
}: {
  text: string
  startDelay?: number
  speed?: number
  style?: React.CSSProperties
  cursorColor?: string
  onDone?: () => void
}) {
  const [count, setCount] = useState(0)
  const done = count >= text.length
  // Keep onDone in a ref so the effect doesn't restart whenever the parent
  // hands us a fresh closure.
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    setCount(0)
    let timer: number | undefined
    let i = 0
    const tick = () => {
      i += 1
      setCount(i)
      if (i < text.length) {
        const ch = text[i - 1]
        const d = ch === "\n" ? speed * 3.4 : ch === " " ? speed * 1.5 : speed * (0.78 + Math.random() * 0.5)
        timer = window.setTimeout(tick, d)
      } else if (doneRef.current) {
        doneRef.current()
      }
    }
    const begin = window.setTimeout(tick, startDelay)
    return () => { window.clearTimeout(begin); if (timer) window.clearTimeout(timer) }
  }, [text, startDelay, speed])

  const shown = text.slice(0, count)
  const lines = shown.split("\n")
  return (
    <div style={style}>
      {lines.map((ln, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {ln}
        </span>
      ))}
      <span style={{
        display: "inline-block", width: "0.58em", height: "0.82em",
        background: cursorColor, marginLeft: 5,
        transform: "translateY(0.04em)",
        animation: done ? "cs-j-caret 0.9s steps(1) infinite" : "none",
        verticalAlign: "baseline",
      }} />
    </div>
  )
}

// ── LoadCurtain — blue curtain wipes up to reveal the next screen ────────

export function LoadCurtain() {
  const [gone, setGone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 840)
    return () => clearTimeout(t)
  }, [])
  if (gone) return null
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 150,
      background: CS.B, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "cs-j-curtain 0.78s cubic-bezier(0.76,0,0.24,1) both",
      willChange: "transform",
    }}>
      <div style={{
        position: "absolute", inset: "-20% -20%", pointerEvents: "none",
        opacity: 0.16,
        backgroundImage: "radial-gradient(#FFFFFF 1px, transparent 1.6px)",
        backgroundSize: "22px 22px",
      }} />
      <div style={{ position: "relative", textAlign: "center", animation: "cs-j-curtain-mark 0.78s cubic-bezier(0.76,0,0.24,1) both" }}>
        <div style={{ animation: "cs-j-curtain-fade 0.78s ease both" }}>
          <div style={{ fontWeight: 900, fontSize: 44, lineHeight: 0.84, letterSpacing: "-0.05em", textTransform: "uppercase", color: CS.W }}>City<br />Signal</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", marginTop: 14 }}>Лента собрана ✓</div>
        </div>
      </div>
    </div>
  )
}

// ── Monogram (square initials chip) ──────────────────────────────────────

export function Monogram({
  w = 42, name, bg = CS.K, color = CS.W,
}: { w?: number; name: string; bg?: string; color?: string }) {
  return (
    <div style={{
      width: w, height: w, flexShrink: 0,
      background: bg, color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 900, fontSize: w * 0.42, letterSpacing: "-0.02em",
      border: `2.5px solid ${CS.K}`, fontFamily: FONT_SANS,
    }}>{initials(name)}</div>
  )
}

// ── ProfileBadge — small square button with brutalist blue shadow ───────

export function ProfileBadge({
  name, dark = false, onClick,
}: { name: string; dark?: boolean; onClick?: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Профиль"
      style={{
        width: 38, height: 38, flexShrink: 0, padding: 0, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT_SANS, fontWeight: 900, fontSize: 13.5, letterSpacing: "-0.02em",
        background: dark ? CS.W : CS.K, color: dark ? CS.K : CS.W,
        border: `2px solid ${dark ? CS.W : CS.K}`,
        boxShadow: `${hover ? 3.5 : 2.5}px ${hover ? 3.5 : 2.5}px 0 ${CS.B}`,
        transform: hover ? "translate(-1px,-1px)" : "none",
        transition: "transform 0.12s, box-shadow 0.12s",
      }}
    >{initials(name)}</button>
  )
}

/** Variant for dark headers (Billboard feed) — reads the openProfile
 *  callback from the surrounding NavCtx provider. */
export function BillboardProfileBadge({ name }: { name: string }) {
  const nav = useNav()
  return <ProfileBadge name={name} dark onClick={nav.openProfile} />
}

// ── Event modal (bottom sheet) — opened by tapping a shelf card ─────────

import type { Ev } from "./buildDerived"

type OpenEvent = (ev: Ev) => void
export const EventModalCtx = createContext<OpenEvent>(() => {})
export function useOpenEvent() { return useContext(EventModalCtx) }

export function EventModalProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Ev | null>(null)
  return (
    <EventModalCtx.Provider value={setActive}>
      {children}
      <EventSheet ev={active} onClose={() => setActive(null)} />
    </EventModalCtx.Provider>
  )
}

// ── Going (RSVP) store + helpers + UI ────────────────────────────────────
//
// @NEW-GOING: User taps "Иду" inside the EventSheet → event is appended
// to a localStorage-backed list keyed by `ev.t` (title). The profile
// screen renders the list as a chronological agenda. A reminder flag
// per entry drives the date-chip colour and the agenda toggle.

const MON_RU = ["", "ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"]

/** "31.05" → { day: "31", mon: "МАЙ" }. Falls back gracefully on weird inputs
 *  like "до 30.06" by stripping the leading "до " and returning whatever it can. */
export function dateChip(d: string): { day: string; mon: string } {
  const m = (d || "").match(/(\d{1,2})\.(\d{1,2})/)
  if (!m) return { day: (d || "—").replace(/^до\s*/, "").slice(0, 5), mon: "" }
  return { day: m[1], mon: MON_RU[parseInt(m[2], 10)] || "" }
}

/** Sortable integer key from a "DD.MM" date — month-major so the list
 *  groups by month. Events without a parseable date sink to the bottom. */
export function dateSort(d: string): number {
  const m = (d || "").match(/(\d{1,2})\.(\d{1,2})/)
  if (!m) return 9999
  return parseInt(m[2], 10) * 100 + parseInt(m[1], 10)
}

const GO_KEY = "cs-going-v1"

/** Slim subset of Ev kept in the store — enough to re-render the agenda
 *  and the EventSheet without keeping the heavy `desc` text in storage. */
export type GoingItem = {
  t: string; v: string; d: string; tm: string; ch: string; cat: string;
  p: string | null; remind: boolean
}

type GoingValue = {
  list: GoingItem[]
  isGoing: (ev: { t: string }) => boolean
  toggle: (ev: Ev | GoingItem) => void
  setRemind: (ev: { t: string }, on: boolean) => void
}

export const GoingCtx = createContext<GoingValue>({
  list: [], isGoing: () => false, toggle: () => {}, setRemind: () => {},
})
export function useGoing() { return useContext(GoingCtx) }

/** Provider — keeps the list in localStorage; default empty (the
 *  reference's mock items don't apply to real Curator events). */
export function GoingProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<GoingItem[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(GO_KEY)
      if (raw) return JSON.parse(raw) as GoingItem[]
    } catch { /* parse error — treat as empty */ }
    return []
  })
  useEffect(() => {
    try { localStorage.setItem(GO_KEY, JSON.stringify(list)) } catch { /* quota */ }
  }, [list])

  const isGoing = (ev: { t: string }) => list.some((e) => e.t === ev.t)

  const toggle = (ev: Ev | GoingItem) => setList((cur) =>
    cur.some((e) => e.t === ev.t)
      ? cur.filter((e) => e.t !== ev.t)
      : [...cur, {
          t: ev.t, v: ev.v, d: ev.d, tm: ev.tm, ch: ev.ch,
          cat: ("c" in ev ? ev.c : ev.cat), p: ev.p, remind: true,
        }],
  )
  const setRemind = (ev: { t: string }, on: boolean) =>
    setList((cur) => cur.map((e) => e.t === ev.t ? { ...e, remind: on } : e))

  return (
    <GoingCtx.Provider value={{ list, isGoing, toggle, setRemind }}>
      {children}
    </GoingCtx.Provider>
  )
}

/** Brutalist mini toggle (used in agenda rows + modal footer). */
export function MiniSwitch({ on, onClick }: { on: boolean; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 38, height: 22, flexShrink: 0, padding: 0, cursor: "pointer", position: "relative",
        border: `2px solid ${CS.K}`, background: on ? CS.B : CS.W,
        transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 1, left: on ? 17 : 1,
        width: 16, height: 16,
        background: on ? CS.W : CS.K,
        transition: "left 0.15s",
      }} />
    </button>
  )
}

function EventSheet({ ev, onClose }: { ev: Ev | null; onClose: () => void }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!ev) { setShown(false); return }
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [ev])

  // @NEW-GOING: modal reads the RSVP store so the footer can flip between
  // "Иду →" and "Я иду ✓" + reveal the reminder toggle when the event is
  // already in the list.
  const going = useGoing()

  if (!ev) return null
  const close = () => { setShown(false); setTimeout(onClose, 240) }
  const isOn = going.isGoing(ev)
  const entry = going.list.find((e) => e.t === ev.t)
  const remind = entry ? entry.remind : true

  const metaRow = (k: string, v: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: `1px solid ${CS.G18}` }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: CS.G55, letterSpacing: "0.14em", textTransform: "uppercase" }}>{k}</span>
      <span style={{ fontWeight: 800, fontSize: 12, color: CS.K, textAlign: "right", maxWidth: "62%" }}>{v}</span>
    </div>
  )

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, fontFamily: FONT_SANS }}>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(13,13,13,0.55)",
          opacity: shown ? 1 : 0,
          transition: "opacity 0.24s ease",
        }}
      />
      {/* Sheet */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%",
        display: "flex", flexDirection: "column",
        background: CS.W, borderTop: `3px solid ${CS.K}`,
        transform: shown ? "translateY(0)" : "translateY(101%)",
        transition: "transform 0.30s cubic-bezier(0.22, 1, 0.36, 1)",
        boxShadow: "0 -18px 40px rgba(13,13,13,0.20)",
      }}>
        {/* drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px", flexShrink: 0 }}>
          <div style={{ width: 44, height: 4, background: CS.K }} />
        </div>
        <div style={{ overflowY: "auto", overflowX: "hidden" }}>
          {/* poster */}
          <div style={{ position: "relative", margin: "8px 14px 0", border: `2.5px solid ${CS.K}`, overflow: "hidden", aspectRatio: "16 / 10", background: CS.K }}>
            {ev.p && (
              <img
                src={ev.p} alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            )}
            <div style={{ position: "absolute", top: 8, left: 8, background: CS.B, color: CS.W, padding: "4px 8px", border: `1.5px solid ${CS.K}`, fontWeight: 900, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}>{ev.c}</div>
            <button onClick={close} aria-label="Закрыть" style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, background: CS.W, border: `1.5px solid ${CS.K}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, lineHeight: 1, color: CS.K, padding: 0 }}>✕</button>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", padding: "6px 9px", background: CS.K, color: CS.W, fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.06em" }}>
              <span>{ev.d} · {ev.tm}</span><span>{ev.price}</span>
            </div>
          </div>
          {/* body */}
          <div style={{ padding: "13px 14px 0" }}>
            <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 0.96, letterSpacing: "-0.03em", textTransform: "uppercase", color: CS.K }}>{ev.t}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 12, color: CS.K }}>{ev.v}</span>
              <span style={{ width: 3, height: 3, background: CS.G35, borderRadius: "50%" }} />
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: CS.B, fontWeight: 700 }}>{ev.ch}</span>
            </div>
            <div style={{ height: 2, background: CS.K, margin: "12px 0 11px" }} />
            <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.5, color: CS.G70 }}>{ev.desc}</div>
            <div style={{ marginTop: 13 }}>
              {metaRow("Дата", ev.d)}
              {metaRow("Время", ev.tm)}
              {metaRow("Место", ev.v)}
              {metaRow("Канал", ev.ch)}
              {metaRow("Цена", ev.price)}
            </div>
          </div>
        </div>
        {/* Footer — Going RSVP. When the user is already going, the
            status strip above the CTAs shows the reminder toggle. */}
        <div style={{ flexShrink: 0, borderTop: `2px solid ${CS.K}`, background: CS.W }}>
          {isOn && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px 0" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", color: CS.B, textTransform: "uppercase" }}>✓ Ты идёшь</div>
                <div style={{ fontWeight: 600, fontSize: 11, color: CS.G55, marginTop: 2 }}>{remind ? "Напомним за день до начала" : "Без напоминания"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: CS.G55, letterSpacing: "0.1em", textTransform: "uppercase" }}>Напомнить</span>
                <MiniSwitch on={remind} onClick={() => going.setRemind(ev, !remind)} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 9, padding: "12px 14px 16px" }}>
            <button
              onClick={() => going.toggle(ev)}
              style={{
                flex: 1, fontFamily: FONT_SANS, fontWeight: 900, fontSize: 14,
                letterSpacing: "0.04em", textTransform: "uppercase",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 14px", border: `3px solid ${CS.K}`,
                background: isOn ? CS.W : CS.K, color: isOn ? CS.K : CS.W,
                cursor: "pointer",
                boxShadow: isOn ? "none" : `3px 3px 0 ${CS.B}`,
                transition: "background 0.14s",
              }}
            >
              {isOn ? <><span>Я иду</span><span style={{ fontSize: 16, lineHeight: 1 }}>✓</span></> : <><span>Иду</span><span style={{ fontSize: 17, lineHeight: 1 }}>→</span></>}
            </button>
            <button onClick={close} style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", padding: "13px 14px", border: `3px solid ${CS.K}`, background: CS.W, color: CS.K, cursor: "pointer", flexShrink: 0 }}>Канал</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── GoingAgenda — calendar of events the user is attending ──────────────

export function GoingAgenda() {
  const { list, setRemind } = useGoing()
  const openEvent = useOpenEvent()
  const items = [...list].sort((a, b) => dateSort(a.d) - dateSort(b.d))
  const remindN = items.filter((e) => e.remind).length

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `2px solid ${CS.K}`, paddingBottom: 7 }}>
        <Mark>Я иду</Mark>
        <Mono color={CS.G55}>{items.length} событий · {remindN} напоминаний</Mono>
      </div>

      {items.length === 0 ? (
        <div style={{ border: `2px dashed ${CS.G35}`, padding: "18px 14px", marginTop: 12, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, color: CS.G55 }}>Пока пусто</div>
          <div style={{ fontWeight: 600, fontSize: 11, color: CS.G35, marginTop: 4 }}>Открой событие и нажми «Иду» — оно появится здесь.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {items.map((ev, i) => {
            const dc = dateChip(ev.d)
            // Synthesise an Ev-shaped object for the modal: store items
            // don't carry `desc`/`price`/`catKey`, so we provide soft
            // defaults — the sheet renders the curator-text fallback.
            const evForSheet: Ev = {
              id: ev.t,
              t: ev.t, v: ev.v, d: ev.d, tm: ev.tm,
              p: ev.p, c: ev.cat, catKey: "",
              ch: ev.ch,
              desc: "Открой канал для подробностей.",
              price: "—",
            }
            return (
              <div
                key={ev.t}
                onClick={() => openEvent(evForSheet)}
                style={{
                  display: "flex", alignItems: "stretch",
                  border: `2px solid ${CS.K}`, background: CS.W, cursor: "pointer",
                  animation: `cs-j-up 0.4s ease ${0.04 * i}s both`,
                }}
              >
                {/* Date chip — coloured blue when reminder is on. */}
                <div style={{
                  width: 50, flexShrink: 0,
                  borderRight: `2px solid ${CS.K}`,
                  background: ev.remind ? CS.B : CS.W,
                  color: ev.remind ? CS.W : CS.K,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", padding: "8px 0",
                }}>
                  <span style={{ fontWeight: 900, fontSize: 22, lineHeight: 0.9, letterSpacing: "-0.04em" }}>{dc.day}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: "0.12em", marginTop: 3 }}>{dc.mon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: "9px 10px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 12.5, lineHeight: 1.05, letterSpacing: "-0.02em", textTransform: "uppercase", color: CS.K, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.t}</div>
                  <div style={{ fontWeight: 600, fontSize: 10, color: CS.G55, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.v} · {ev.tm}</div>
                </div>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "0 10px", borderLeft: `1.5px solid ${CS.G18}` }}>
                  <MiniSwitch on={ev.remind} onClick={(e) => { e.stopPropagation(); setRemind(ev, !ev.remind) }} />
                  <span style={{ fontFamily: FONT_MONO, fontSize: 7, letterSpacing: "0.08em", color: ev.remind ? CS.B : CS.G35, textTransform: "uppercase" }}>
                    {ev.remind ? "напомню" : "напомнить"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page wrapper — full viewport, applies cs-jr class for the box-sizing reset ──

export function CsPage({ children }: { children: React.ReactNode }) {
  useCsKeyframes()
  return (
    <div
      className="cs-jr"
      style={{
        position: "relative", width: "100%", minHeight: "100dvh",
        overflow: "hidden", background: CS.W,
        fontFamily: FONT_SANS, color: CS.K,
        animation: "cs-j-screen 0.4s cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      {children}
    </div>
  )
}
