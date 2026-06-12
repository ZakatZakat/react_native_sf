/**
 * CitySignal · 04 · Неделя (v4).
 *
 *  Intro screen shown after Loading (name step is skipped in prod). Mirrors
 *  v4's WeekIntro "split2" variant — a poster column + dark editorial panel
 *  with the week number, dates and a lead paragraph. Auto-advances to the
 *  feed after ~1.7s (matching weekAuto), and rolls up via a CSS wipe.
 *
 *  Real data: hero poster from the live feed, counts derived from Curator.
 */

import { useEffect, useMemo, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SK, FONT_SANS, FONT_MONO } from "./shared"
import { useDerived } from "./useJourney"

const AUTO_MS = 1700

// Week label — derive a stable-ish week number + date span for "this week".
function weekMeta() {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // Mon=0
  const mon = new Date(now); mon.setDate(now.getDate() - day)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  // ISO-ish week number
  const start = new Date(now.getFullYear(), 0, 1)
  const n = Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7)
  return { n, dates: `${f(mon)} — ${f(sun)}` }
}

export default function CsWeek() {
  const navigate = useNavigate()
  const { derived } = useDerived()
  const wk = useMemo(weekMeta, [])
  const leftRef = useRef<HTMLDivElement>(null)

  const hero = derived.feed[0]
  const eventsCount = derived.feed.length || Object.values(derived.catCounts).reduce((a, b) => a + b, 0)
  const zonesCount = Object.keys(derived.pool).length
  const lead = derived.shelves.length
    ? `На этой неделе — ${derived.shelves.map((s) => s.cat.toLowerCase()).slice(0, 3).join(", ")} и не только. Редакция собрала, ради чего стоит выйти.`
    : "Свежая подборка городских событий. Редакция собрала, ради чего стоит выйти."

  useEffect(() => {
    const go = () => {
      // roll the screen up, then navigate
      if (leftRef.current?.parentElement) {
        leftRef.current.parentElement.style.animation = "cs-week-wipe 0.55s cubic-bezier(0.5,0,0.2,1) forwards"
      }
      setTimeout(() => navigate({ to: "/cs/feed" }), 480)
    }
    const t = setTimeout(go, AUTO_MS)
    return () => clearTimeout(t)
  }, [navigate])

  const anim = (d: number) => ({ animation: `sk-week-up 0.55s cubic-bezier(0.22,1,0.36,1) ${d}s both` })

  return (
    <div
      onClick={() => navigate({ to: "/cs/feed" })}
      style={{ position: "fixed", inset: 0, display: "flex", fontFamily: FONT_SANS, cursor: "pointer", background: SK.ink, overflow: "hidden" }}
    >
      {/* poster column */}
      <div ref={leftRef} style={{ width: "46%", overflow: "hidden", borderRight: `3px solid ${SK.ink}`, background: "#1a1a1a", ...anim(0) }}>
        {hero?.p
          ? <img src={hero.p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg,#222,#0d0d0d)" }} />}
      </div>
      {/* editorial panel */}
      <div style={{ flex: 1, background: SK.ink, color: "#fff", padding: "calc(env(safe-area-inset-top,0px) + 30px) 20px 24px", display: "flex", flexDirection: "column" }}>
        <div style={{ ...anim(0.1) }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Неделя</span>
        </div>
        <div style={{ fontWeight: 900, fontSize: 92, lineHeight: 0.8, letterSpacing: "-0.05em", ...anim(0.16) }}>{wk.n}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.32em", color: "rgba(255,255,255,0.8)", marginTop: 8, ...anim(0.22) }}>{wk.dates}</div>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.85)", marginTop: 14, ...anim(0.28) }}>{lead}</p>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 18, ...anim(0.34) }}>
          {[[eventsCount, "событий"], [zonesCount, "категорий"]].map(([n, l]) => (
            <div key={l as string}>
              <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: "-0.03em", lineHeight: 1 }}>{n}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginTop: 16, ...anim(0.4) }}>
          нажмите, чтобы продолжить →
        </div>
      </div>
    </div>
  )
}
