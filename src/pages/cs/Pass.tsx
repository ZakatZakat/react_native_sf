/**
 * CitySignal · 04 · Пропуск.
 *
 *  Knockout pass card: the user's name in NAVY ghost + WHITE foreground,
 *  initials in a square frame, "barcode" strip.
 */

import { useNavigate } from "@tanstack/react-router"
import { CsPage, CS, FONT_SANS, Mono, ScreenBG, initials, PBARS } from "./shared"
import { useJourneyState } from "./useJourney"
import { analytics } from "../../lib/analytics"

export default function CsPass() {
  const navigate = useNavigate()
  const { name } = useJourneyState()
  const safeName = name.trim() || "Гость"
  const lines = safeName.split(/\s+/)

  const onEnter = () => {
    analytics.track("cs.pass.continue", {})
    navigate({ to: "/cs/swipe" })
  }

  return (
    <CsPage>
      <ScreenBG theme="dots" />
      <div style={{ position: "absolute", inset: 0, padding: "44px 22px 132px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => navigate({ to: "/cs/name" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><Mono color={CS.B}>← Имя</Mono></button>
          <Mono>Пропуск</Mono>
        </div>
        {/* Card sits near the top, blurb hugs the CTA — `space-between`
            distributes the leftover height as a single gap between them
            instead of dead space on both sides of a centred card. Card
            is back to its original compact size; only the bottom blurb
            scales up to fill the remaining room. */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", marginTop: 20, gap: 16 }}>
          <div style={{ position: "relative", border: `2.5px solid ${CS.K}`, background: CS.B, color: CS.W, padding: "18px 18px 20px", overflow: "hidden", boxShadow: `7px 7px 0 ${CS.K}`, animation: "cs-j-spring 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Mono color="rgba(255,255,255,0.7)">CitySignal</Mono>
              <div style={{ width: 44, height: 44, border: `2.5px solid ${CS.W}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 17, color: CS.W }}>{initials(safeName)}</div>
            </div>
            {/* Navy ghost + white foreground share one positioned wrapper
                so the offset stays glued to the white type. */}
            <div style={{ position: "relative", display: "inline-block", marginTop: 22 }}>
              <div style={{ position: "absolute", left: 4, top: 5, fontWeight: 900, fontSize: 38, lineHeight: 0.82, letterSpacing: "-0.05em", textTransform: "uppercase", color: CS.NAVY }}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
              <div style={{ position: "relative", fontWeight: 900, fontSize: 38, lineHeight: 0.82, letterSpacing: "-0.05em", textTransform: "uppercase", color: CS.W }}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
            </div>
            <div style={{ display: "flex", gap: 2, height: 16, marginTop: 20 }}>{PBARS.map((w, j) => <span key={j} style={{ width: w, background: CS.W, opacity: 0.9 }} />)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <Mono color="rgba(255,255,255,0.7)">В городе с 2026</Mono>
              <Mono color={CS.W}>№ 0421</Mono>
            </div>
          </div>
          {/* Description blurb — sizes bumped up so it actually carries
              visual weight in the remaining viewport space. */}
          <div style={{ animation: "cs-j-rise 0.4s ease 0.5s both" }}>
            <Mono color={CS.G55} style={{ fontSize: 11, letterSpacing: "0.2em" }}>Пропуск готов · {lines[0]}</Mono>
            <div style={{ fontWeight: 900, fontSize: 32, lineHeight: 0.94, letterSpacing: "-0.035em", textTransform: "uppercase", color: CS.K, marginTop: 12 }}>
              Соберём твой профиль —<br />
              <span style={{ color: CS.B }}>под что тебя тянет</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.45, color: CS.G55, marginTop: 12 }}>10 карточек, ✕ или ♥. Лента настроится под тебя.</div>
          </div>
        </div>
      </div>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 22px 22px", background: CS.W }}>
        <button onClick={onEnter} style={{ width: "100%", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", border: `3px solid ${CS.K}`, background: CS.K, color: CS.W, boxShadow: `4px 4px 0 ${CS.B}`, cursor: "pointer" }}>
          <span>Собрать профиль</span><span style={{ fontSize: 20 }}>→</span>
        </button>
      </div>
    </CsPage>
  )
}
