/**
 * CitySignal — shared atoms, tokens, types.
 *
 * Everything below is consumed by the 7 step pages under `src/pages/cs/`.
 * Anything truly screen-specific lives in its own page file.
 */

import { useEffect } from "react"

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

export const STEPS: { key: StepKey; n: string; title: string; path: string }[] = [
  { key: "landing",  n: "01", title: "Лендинг",        path: "/cs/landing" },
  { key: "loading",  n: "02", title: "Загрузка",       path: "/cs/loading" },
  { key: "name",     n: "03", title: "Имя",            path: "/cs/name" },
  { key: "pass",     n: "04", title: "Пропуск",        path: "/cs/pass" },
  { key: "swipe",    n: "05", title: "Интересы",       path: "/cs/swipe" },
  { key: "summary",  n: "06", title: "Суммаризация",   path: "/cs/summary" },
  { key: "feed",     n: "07", title: "Лента",          path: "/cs/feed" },
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
