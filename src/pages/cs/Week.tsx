/**
 * CitySignal · 04 · Неделя.
 *
 *  Intro screen shown after Loading (name step is skipped in prod). Shows one of
 *  four «Семейство Сплит» digest designs (WeekDesigns.tsx), picked at random on
 *  each open. The hero event is the editorial «выбор недели» (GET /me/week); if
 *  the editor hasn't picked one, it falls back to the auto top event so the
 *  screen is never empty. Auto-advances to the feed after ~1.7s via a CSS wipe;
 *  a tap anywhere continues too.
 *
 *  `?wk=split3` (or split/split2/split4) pins a design for QA and holds the
 *  screen without auto-advancing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SK, FONT_SANS } from "./shared"
import { useDerived } from "./useJourney"
import { toEv, type Ev } from "./buildDerived"
import { Curator } from "../../lib/curator"
import { analytics } from "../../lib/analytics"
import { WeekDesign, WEEK_VARIANTS, weekMeta, type WeekVariant } from "./WeekDesigns"

const AUTO_MS = 1700

export default function CsWeek() {
  const navigate = useNavigate()
  const { derived } = useDerived()
  const wk = useMemo(weekMeta, [])
  const rootRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)

  // Design: the editor's pick wins (ui_variants.week_design, chosen in
  // /cs/admin/week); "auto"/unset keeps the original random-per-open. `?wk=split3`
  // still overrides everything for QA and holds the screen.
  const forced = (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("wk") : null) as WeekVariant | null
  const dev = !!forced && WEEK_VARIANTS.includes(forced)
  const [variant, setVariant] = useState<WeekVariant>(() => (dev ? forced! : WEEK_VARIANTS[Math.floor(Math.random() * WEEK_VARIANTS.length)]))
  useEffect(() => {
    if (dev) return                       // QA override — don't let the pin move it
    let live = true
    Curator.getUiVariants()
      .then((v) => {
        const p = v?.week_design
        if (live && p && (WEEK_VARIANTS as readonly string[]).includes(p)) setVariant(p as WeekVariant)
      })
      .catch(() => { /* keep the random one */ })
    return () => { live = false }
  }, [dev])

  // Editorial hero pick (GET /me/week). Null until fetched / if none set — the
  // screen then falls back to the auto top event. A missing endpoint (404) is
  // swallowed so the screen still renders.
  const [pick, setPick] = useState<Ev | null>(null)
  useEffect(() => {
    let alive = true
    Curator.getWeekPick().then((it) => { if (alive && it) setPick(toEv(it)) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const feed = derived.feed
  const hero = pick ?? feed[0]
  // Триптих needs three posters: hero first, then fill from the feed.
  const trio = [hero, ...feed.filter((e) => e && e.id !== hero?.id)].filter(Boolean).slice(0, 3) as Ev[]
  const eventsCount = feed.length || Object.values(derived.catCounts).reduce((a, b) => a + b, 0)
  const lead = derived.shelves.length
    ? `На этой неделе — ${derived.shelves.map((s) => s.cat.toLowerCase()).slice(0, 3).join(", ")} и не только. Редакция собрала, ради чего стоит выйти.`
    : "Свежая подборка городских событий. Редакция собрала, ради чего стоит выйти."

  const go = useCallback((via: "tap" | "auto") => {
    if (doneRef.current) return
    doneRef.current = true
    analytics.track("cs.week.continue", { variant, via })
    if (rootRef.current) rootRef.current.style.animation = "cs-week-wipe 0.55s cubic-bezier(0.5,0,0.2,1) forwards"
    setTimeout(() => navigate({ to: "/cs/feed" }), 480)
  }, [navigate, variant])

  // Log which of the 4 «Сплит» designs was shown, once per open.
  useEffect(() => { analytics.track("cs.week.view", { variant }) }, [variant])

  useEffect(() => {
    if (dev) return
    const t = setTimeout(() => go("auto"), AUTO_MS)
    return () => clearTimeout(t)
  }, [go, dev])

  return (
    <div
      ref={rootRef}
      onClick={() => go("tap")}
      style={{ position: "fixed", inset: 0, fontFamily: FONT_SANS, cursor: "pointer", background: SK.ink, overflow: "hidden", color: "#fff" }}
    >
      <WeekDesign variant={variant} hero={hero} trio={trio} wk={wk} lead={lead} eventsCount={eventsCount} still={dev} />
    </div>
  )
}
