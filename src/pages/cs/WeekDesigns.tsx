/**
 * CitySignal · «Семейство Сплит» — the four Week-digest designs, shared by the
 * Week screen (Week.tsx) and the editorial picker preview (AdminWeek.tsx).
 *
 * Each <WeekDesign> fills its positioned parent (position:absolute inset:0), so
 * the host controls the frame: the Week screen is full-bleed, the picker renders
 * it inside a phone-shaped box. `still` drops the entry animation (for previews).
 */

import { SK, FONT_SANS, FONT_MONO } from "./shared"

export const WEEK_VARIANTS = ["split", "split2", "split3", "split4"] as const
export type WeekVariant = (typeof WEEK_VARIANTS)[number]
export const WEEK_VARIANT_LABELS: Record<WeekVariant, string> = {
  split: "Сплит",
  split2: "Горизонталь",
  split3: "Диагональ",
  split4: "Триптих",
}

export type WeekHero = { p: string | null; tm?: string }

// Week label — a stable-ish ISO week number + date span for "this week".
export function weekMeta() {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // Mon=0
  const mon = new Date(now); mon.setDate(now.getDate() - day)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  const start = new Date(now.getFullYear(), 0, 1)
  const n = Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7)
  return { n, dates: `${f(mon)} — ${f(sun)}` }
}

// Poster with a graceful gradient fallback when the item has no image.
function Poster({ url, style }: { url: string | null; style?: React.CSSProperties }) {
  const base: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", ...style }
  return url
    ? <img src={url} alt="" style={base} />
    : <div style={{ ...base, background: "linear-gradient(160deg,#222,#0d0d0d)" }} />
}

function Kicker({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: color || "rgba(255,255,255,0.6)" }}>
      {children}
    </span>
  )
}

export function WeekDesign({
  variant, hero, trio = [], wk, lead, eventsCount, still = false,
}: {
  variant: WeekVariant
  hero?: WeekHero
  trio?: WeekHero[]
  wk: { n: number; dates: string }
  lead: string
  eventsCount: number
  still?: boolean
}) {
  const anim = (d: number): React.CSSProperties => still ? {} : ({ animation: `sk-week-up 0.55s cubic-bezier(0.22,1,0.36,1) ${d}s both` })
  const heroTag = hero?.tm && hero.tm !== "—" ? `ГЛАВНОЕ · ${hero.tm}` : "ГЛАВНОЕ"

  // ── Сплит — постер сверху, тёмная панель снизу ──
  if (variant === "split") {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontFamily: FONT_SANS, color: "#fff" }}>
        <div style={{ height: "46%", position: "relative", overflow: "hidden", ...anim(0) }}>
          <Poster url={hero?.p ?? null} />
          <div style={{ position: "absolute", left: 0, bottom: 0, background: SK.blue, color: "#fff", fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", padding: "4px 9px" }}>{heroTag}</div>
        </div>
        <div style={{ flex: 1, background: SK.ink, color: "#fff", padding: "22px", display: "flex", flexDirection: "column" }}>
          <div style={anim(0.1)}><Kicker>Неделя</Kicker></div>
          <div style={{ fontWeight: 900, fontSize: 84, lineHeight: 0.82, letterSpacing: "-0.05em", ...anim(0.16) }}>{wk.n}</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(255,255,255,0.85)", marginTop: 10, ...anim(0.24) }}>{lead}</p>
          <div style={{ flex: 1 }} />
        </div>
      </div>
    )
  }

  // ── Горизонталь — постер слева, тёмная панель справа ──
  if (variant === "split2") {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", fontFamily: FONT_SANS, color: "#fff" }}>
        <div style={{ width: "46%", overflow: "hidden", borderRight: `3px solid ${SK.ink}`, ...anim(0) }}>
          <Poster url={hero?.p ?? null} />
        </div>
        <div style={{ flex: 1, background: SK.ink, color: "#fff", padding: "calc(env(safe-area-inset-top,0px) + 26px) 18px 20px", display: "flex", flexDirection: "column" }}>
          <div style={anim(0.1)}><Kicker>Неделя</Kicker></div>
          <div style={{ fontWeight: 900, fontSize: 96, lineHeight: 0.8, letterSpacing: "-0.05em", ...anim(0.16) }}>{wk.n}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.08em", color: "rgba(255,255,255,0.8)", marginTop: 6, ...anim(0.22) }}>{wk.dates}</div>
          <p style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.85)", marginTop: 14, ...anim(0.28) }}>{lead}</p>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", ...anim(0.36) }}>
            нажмите, чтобы продолжить →
          </div>
        </div>
      </div>
    )
  }

  // ── Диагональ — постер с диагональным клипом + копирайт снизу ──
  if (variant === "split3") {
    return (
      <div style={{ position: "absolute", inset: 0, background: SK.ink, color: "#fff", overflow: "hidden", fontFamily: FONT_SANS }}>
        {hero?.p
          ? <img src={hero.p} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: "polygon(100% 0, 100% 64%, 0 0)", ...anim(0) }} />
          : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#222,#0d0d0d)", clipPath: "polygon(100% 0, 100% 64%, 0 0)", ...anim(0) }} />}
        <div style={{ position: "absolute", inset: 0, padding: "30px 22px 22px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={anim(0.12)}><Kicker color={SK.blue}>CitySignal · неделя</Kicker></div>
          <div style={{ fontWeight: 900, fontSize: 92, lineHeight: 0.78, letterSpacing: "-0.06em", ...anim(0.18) }}>WK<br />{wk.n}</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(255,255,255,0.85)", margin: "12px 0 0", ...anim(0.26) }}>{lead}</p>
        </div>
      </div>
    )
  }

  // ── Триптих — три постера + синяя недельная полоса ──
  const cols = trio.length ? trio : [null, null, null]
  return (
    <div style={{ position: "absolute", inset: 0, background: SK.ink, overflow: "hidden", fontFamily: FONT_SANS, color: "#fff" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", ...anim(0) }}>
        {cols.map((e, i) => (
          <div key={i} style={{ flex: 1, overflow: "hidden", borderRight: i < 2 ? `2px solid ${SK.ink}` : "none" }}>
            <Poster url={e?.p ?? null} style={{ opacity: 0.9 }} />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", background: SK.blue, color: "#fff", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", ...anim(0.2) }}>
        <span style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.03em" }}>WEEK {wk.n}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.08em", textAlign: "right" }}>{wk.dates}<br />{eventsCount} событий</span>
      </div>
    </div>
  )
}
