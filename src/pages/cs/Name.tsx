/**
 * CitySignal · 03 · Имя.
 *
 *  Big typewriter title; the input field reveals only after the title
 *  finishes typing, then auto-focuses. When the user arrives with
 *  ?wipe=1 (set by Loading on auto-advance), the blue LoadCurtain
 *  wipes up to reveal the screen and the typewriter waits behind it.
 */

import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { CsPage, CS, FONT_SANS, ScreenBG, Typewriter, LoadCurtain } from "./shared"
import { useJourneyState } from "./useJourney"
import { analytics } from "../../lib/analytics"

export default function CsName() {
  const navigate = useNavigate()
  const { name, setName } = useJourneyState()
  const search = useSearch({ strict: false }) as Record<string, string | undefined>
  const entering = search.wipe === "1"
  const [typed, setTyped] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { if (typed && inputRef.current) inputRef.current.focus() }, [typed])

  const ok = name.trim().length > 0
  const onDone = () => {
    if (!ok) return
    analytics.track("cs.name.submit", { name_len: name.trim().length })
    // v3 short path: name → feed directly (Pass/Swipe/Summary moved to
    // alternative variants).
    navigate({ to: "/cs/feed" })
  }

  return (
    <CsPage>
      <ScreenBG theme="dots" />
      <div style={{ position: "absolute", inset: 0, padding: "44px 22px 96px", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Typewriter
            text={"Как тебя\nзовут?"}
            startDelay={entering ? 720 : 170}
            onDone={() => setTimeout(() => setTyped(true), 140)}
            style={{
              fontWeight: 900, fontSize: 40, lineHeight: 0.9,
              letterSpacing: "-0.045em", textTransform: "uppercase",
              color: CS.K, marginBottom: 28, minHeight: 72,
            }}
          />
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ok) onDone() }}
            placeholder="Имя"
            style={{
              width: "100%", boxSizing: "border-box", border: "none",
              borderBottom: `3px solid ${CS.K}`, outline: "none", background: "transparent",
              fontFamily: FONT_SANS, fontWeight: 900, fontSize: 34,
              letterSpacing: "-0.035em", textTransform: "uppercase", color: CS.K,
              padding: "2px 0 10px",
              opacity: typed ? 1 : 0,
              transform: typed ? "translateY(0)" : "translateY(12px)",
              pointerEvents: typed ? "auto" : "none",
              transition: "opacity 0.45s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </div>
      </div>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 22px 22px", background: CS.W }}>
        <button
          onClick={ok ? onDone : undefined} disabled={!ok}
          style={{
            width: "100%", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15,
            letterSpacing: "0.04em", textTransform: "uppercase",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "15px 18px", border: `3px solid ${CS.K}`,
            background: ok ? CS.K : "transparent", color: ok ? CS.W : CS.G35,
            cursor: ok ? "pointer" : "not-allowed",
            boxShadow: ok ? `4px 4px 0 ${CS.B}` : "none",
            transition: "all 0.14s",
          }}
        >
          <span>Готово</span><span style={{ fontSize: 20 }}>→</span>
        </button>
      </div>
      {entering && <LoadCurtain />}
    </CsPage>
  )
}
