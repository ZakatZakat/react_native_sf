/**
 * CitySignal · 01 · Открытие (v5 cold-open «Монтаж»).
 *
 *  Brand cold-open played at launch, before the landing. Two beats:
 *    1. Wordmark — constructivist stack: ink "City" + signal "Signal" blocks
 *       fly in with hard-offset shadows; the N°001 tag drops last.
 *    2. Slogan — a rule draws, then «то, что движется в городе» reveals line
 *       by line.
 *  Then a composed exit: blocks scatter diagonally, the white grid page splits
 *  into 3 vertical columns (= the landing triptych) that slide off, revealing
 *  the landing. Auto-advances to /cs/landing (~4.2s); tap to skip.
 */

import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CS, FONT_SANS, FONT_MONO } from "./shared"

export default function CsOpen() {
  const navigate = useNavigate()
  const [exiting, setExiting] = useState(false)

  const go = () => navigate({ to: "/cs/landing" })

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2950)
    const t2 = setTimeout(go, 4180)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grid = "rgba(13,13,13,0.09)"
  const gridImg = `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`
  const wm: React.CSSProperties = { fontWeight: 900, fontSize: 50, lineHeight: 0.82, letterSpacing: "-0.055em", textTransform: "uppercase", color: CS.W, fontFamily: FONT_SANS }
  const cmBase: React.CSSProperties = { position: "absolute", width: 15, height: 15, zIndex: 6 }
  const cmAnim = exiting ? "co5-fade 0.28s ease both" : "co5-cropIn 0.3s steps(2) 1.3s both"

  return (
    <div
      onClick={go}
      style={{ position: "fixed", inset: 0, zIndex: 400, overflow: "hidden", fontFamily: FONT_SANS, background: CS.W, cursor: "pointer", pointerEvents: exiting ? "none" : "auto" }}
    >
      {/* white curtain — 3 vertical columns (= landing triptych) */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, height: "100%", background: CS.W, backgroundImage: gridImg, backgroundSize: "22px 22px", borderRight: i < 2 ? `1px solid ${grid}` : "none", animation: exiting ? `${i % 2 === 0 ? "co5-colUp" : "co5-colDn"} 0.62s cubic-bezier(0.76,0,0.24,1) ${0.34 + i * 0.08}s both` : "co5-gdrift 6s linear infinite" }} />
        ))}
      </div>

      {/* crop marks */}
      <div style={{ ...cmBase, top: 14, left: 14, borderTop: `2px solid ${CS.K}`, borderLeft: `2px solid ${CS.K}`, animation: cmAnim }} />
      <div style={{ ...cmBase, top: 14, right: 14, borderTop: `2px solid ${CS.K}`, borderRight: `2px solid ${CS.K}`, animation: cmAnim }} />
      <div style={{ ...cmBase, bottom: 14, left: 14, borderBottom: `2px solid ${CS.K}`, borderLeft: `2px solid ${CS.K}`, animation: cmAnim }} />
      <div style={{ ...cmBase, bottom: 14, right: 14, borderBottom: `2px solid ${CS.K}`, borderRight: `2px solid ${CS.K}`, animation: cmAnim }} />

      {/* top row */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 6, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top,0px) + 18px) 22px 0", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(13,13,13,0.55)", animation: exiting ? "co5-fade 0.3s ease both" : "co5-labelIn 0.4s ease 1.35s both" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 7, height: 7, background: CS.B, animation: "cs-j-blink 1s steps(1) infinite" }} />N° 001</span>
        <span>Монтаж</span>
      </div>

      {/* block stack (wordmark) + slogan */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <div style={{ position: "relative", width: 226, height: 178 }}>
          <div style={{ position: "absolute", left: 0, top: 6, width: 172, height: 78, background: CS.K, display: "flex", alignItems: "center", paddingLeft: 16, boxShadow: `5px 5px 0 ${CS.B}`, "--bx": "-160%", "--by": "0px", animation: exiting ? "co5-cityOut 0.5s cubic-bezier(0.5,0,0.75,0) both" : "co5-blk 0.54s cubic-bezier(0.16,1,0.3,1) 0.12s both" } as React.CSSProperties}><span style={wm}>City</span></div>
          <div style={{ position: "absolute", right: 0, top: 92, width: 200, height: 78, background: CS.B, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 16, boxShadow: `5px 5px 0 ${CS.K}`, "--bx": "160%", "--by": "0px", animation: exiting ? "co5-sigOut 0.5s cubic-bezier(0.5,0,0.75,0) 0.05s both" : "co5-blk 0.54s cubic-bezier(0.16,1,0.3,1) 0.28s both" } as React.CSSProperties}><span style={wm}>Signal</span></div>
          <div style={{ position: "absolute", left: -6, top: -16, background: CS.K, color: CS.W, padding: "3px 7px", fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", animation: exiting ? "co5-fade 0.22s ease both" : "co5-tagIn 0.3s cubic-bezier(0.34,1.4,0.5,1) 0.95s both" }}>N° 001</div>
        </div>
        <div style={{ width: 226, animation: exiting ? "co5-tagOut 0.42s cubic-bezier(0.5,0,0.75,0) 0.02s both" : "none" }}>
          <div style={{ height: 3, background: CS.K, transformOrigin: "left", marginBottom: 11, animation: "co5-ruleX 0.42s cubic-bezier(0.83,0,0.17,1) 1.5s both" }} />
          {([["то, что", CS.K], ["движется", CS.B], ["в городе", CS.K]] as const).map(([t, c], i) => (
            <div key={i} style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 900, fontSize: 27, lineHeight: 1.02, letterSpacing: "-0.04em", textTransform: "uppercase", color: c, animation: `co5-revUp 0.5s cubic-bezier(0.16,1,0.3,1) ${1.66 + i * 0.1}s both` }}>{t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom row */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 6, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 22px calc(env(safe-area-inset-bottom,0px) + 24px)", fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(13,13,13,0.55)", animation: exiting ? "co5-fade 0.3s ease both" : "co5-labelIn 0.4s ease 1.5s both" }}>
        <span>Полоса собрана · слоган</span><span>2026</span>
      </div>
    </div>
  )
}
