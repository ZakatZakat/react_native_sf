/**
 * CitySignal · 04 · Пропуск.
 *
 *  Knockout pass card: the user's name in NAVY ghost + WHITE foreground,
 *  initials in a square frame, "barcode" strip.
 */

import { useNavigate } from "@tanstack/react-router"
import { CsPage, CS, FONT_MONO, FONT_SANS, Mark, Mono, ScreenBG, Monogram, PBARS } from "./shared"
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
        {/* City Pass — replaces the old knockout card.
            Vertical blue spine + identity block on the right (monogram +
            name + barcode). Same shape as the Profile screen's pass. */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", marginTop: 20, gap: 16 }}>
          <div style={{
            border: `2.5px solid ${CS.K}`, background: CS.W,
            display: "flex",
            boxShadow: `7px 7px 0 ${CS.K}`,
            animation: "cs-j-spring 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>
            {/* Vertical blue spine */}
            <div style={{
              width: 46, flexShrink: 0,
              background: CS.B, color: CS.W,
              borderRight: `2.5px solid ${CS.K}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                writingMode: "vertical-rl", transform: "rotate(180deg)",
                fontWeight: 900, fontSize: 10.5, letterSpacing: "0.26em",
                textTransform: "uppercase", whiteSpace: "nowrap",
              }}>City Pass · N°0421</span>
            </div>
            {/* Identity block */}
            <div style={{ flex: 1, padding: "16px 16px 15px", minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: CS.G55, letterSpacing: "0.14em", lineHeight: 1.5 }}>
                  КАРТА<br />ЧИТАТЕЛЯ<br />ГОРОДА
                </div>
                <Monogram w={44} name={safeName} />
              </div>
              <div style={{
                fontWeight: 900, fontSize: 30, lineHeight: 0.88,
                letterSpacing: "-0.04em", textTransform: "uppercase",
                color: CS.K, marginTop: 14,
              }}>
                {lines.map((l, i) => <div key={i}>{l}</div>)}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: CS.B, fontWeight: 700, marginTop: 9 }}>
                Новый читатель · в городе с 2026
              </div>
              <div style={{ display: "flex", gap: 2, height: 22, alignItems: "stretch", marginTop: 13 }}>
                {PBARS.map((w, j) => <span key={j} style={{ width: w, background: CS.K }} />)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1.5px solid ${CS.K}`, paddingTop: 6, marginTop: 6 }}>
                <Mark color={CS.G55}>Москва</Mark>
                <Mark color={CS.G55}>№ 0421</Mark>
              </div>
            </div>
          </div>
          {/* Description blurb */}
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
