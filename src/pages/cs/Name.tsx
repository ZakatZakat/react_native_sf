/**
 * CitySignal · 03 · Имя.
 *
 *  Big input field for the user's name. Persists to localStorage via the
 *  shared journey state, so the Pass card (next step) can render it.
 */

import { useNavigate } from "@tanstack/react-router"
import { CsPage, CS, FONT_SANS, ScreenBG } from "./shared"
import { useJourneyState } from "./useJourney"
import { analytics } from "../../lib/analytics"

export default function CsName() {
  const navigate = useNavigate()
  const { name, setName } = useJourneyState()
  const ok = name.trim().length > 0

  const onDone = () => {
    if (!ok) return
    analytics.track("cs.name.submit", { name_len: name.trim().length })
    navigate({ to: "/cs/pass" })
  }

  return (
    <CsPage>
      <ScreenBG theme="dots" />
      <div style={{ position: "absolute", inset: 0, padding: "44px 22px 96px", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 40, lineHeight: 0.9, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.K, marginBottom: 28 }}>
            Как тебя<br />зовут?
          </div>
          <input
            autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ok) onDone() }}
            placeholder="Имя"
            style={{
              width: "100%", boxSizing: "border-box", border: "none",
              borderBottom: `3px solid ${CS.K}`, outline: "none", background: "transparent",
              fontFamily: FONT_SANS, fontWeight: 900, fontSize: 34,
              letterSpacing: "-0.035em", textTransform: "uppercase", color: CS.K,
              padding: "2px 0 10px",
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
    </CsPage>
  )
}
