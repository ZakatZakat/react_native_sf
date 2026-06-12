/**
 * CitySignal · v6 cold-open «Полоса» (ColdOpenBar).
 *
 *  Single gesture: crop marks fade in, the City+Signal lockup assembles in the
 *  centre, then the white grid cover (= landing triptych) slides up while the
 *  lockup flies and SETTLES as the banner in the About card's header.
 *
 *  Self-homing: before the flight it measures the real DOM position of the
 *  card's banner (`.cs-about-host` City/Signal spans) and animates exactly into
 *  it via the Web Animations API — so it lands correctly on any viewport. The
 *  card's own banner stays hidden while the lockup is in flight (no double
 *  banner). Rendered as an overlay on the Landing screen.
 */

import { useEffect, useRef, useState } from "react"
import { CS, FONT_SANS } from "./shared"

const EASE = "cubic-bezier(0.65,0,0.32,1)"
const D = 0.7 // flight duration (s)

type Pos = { left: number; top: number; width: number; height: number; fs: number; pl?: number; pr?: number }

export default function ColdOpenBar({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false)
  // Gate the montage on web-fonts ready — without this the FIRST paint renders
  // the City/Signal lockup in a system fallback and visibly swaps to Inter
  // mid-flight. The original v6 was masked by its in-browser Babel boot delay;
  // a compiled build paints instantly, so we gate explicitly (capped 800ms).
  const [fontsReady, setFontsReady] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const cityRef = useRef<HTMLDivElement>(null)
  const sigRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone

  // The original v6 hero coords (50/256, 76/342) centre the lockup inside a
  // FIXED 316px phone frame. We render full-bleed (Telegram mini-app), so we
  // shift the whole cluster (bbox centre ≈ 163,338) to the real viewport
  // centre — otherwise it sits left-of-centre. Computed once, synchronously.
  const [off] = useState(() => {
    if (typeof window === "undefined") return { dx: 0, dy: 0 }
    return { dx: Math.round(window.innerWidth / 2 - 163), dy: Math.round(window.innerHeight / 2 - 338) }
  })

  // centre (hero) positions in overlay-local coords (offset to viewport centre)
  const cityHero: Pos = { left: 50 + off.dx, top: 256 + off.dy, width: 172, height: 78, fs: 44, pl: 15 }
  const sigHero: Pos = { left: 76 + off.dx, top: 342 + off.dy, width: 200, height: 78, fs: 44, pr: 15 }

  useEffect(() => {
    let done = false
    const ready = () => { if (!done) { done = true; setFontsReady(true) } }
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
    if (fonts?.ready) fonts.ready.then(ready)
    const t = setTimeout(ready, 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!fontsReady) return
    const t1 = setTimeout(() => {
      // measure the card banner's real position and fly there
      let cityDock: Pos = { left: 56, top: 164, width: 116, height: 30, fs: 17, pl: 11 }
      let sigDock: Pos = { left: 173, top: 164, width: 127, height: 30, fs: 17, pr: 11 }
      try {
        const rootEl = rootRef.current!
        const rootR = rootEl.getBoundingClientRect()
        const k = rootR.width / (rootEl.offsetWidth || rootR.width) || 1 // compensate phone transform-scale
        const host = document.querySelector(".cs-about-host")
        const spans = host ? Array.from(host.querySelectorAll("span")) : []
        const citySpan = spans.find((s) => s.textContent === "City")
        const sigSpan = spans.find((s) => s.textContent === "Signal")
        if (citySpan?.parentElement && sigSpan?.parentElement) {
          const toLocal = (el: Element) => {
            const r = el.getBoundingClientRect()
            return { left: (r.left - rootR.left) / k, top: (r.top - rootR.top) / k, width: r.width / k, height: r.height / k }
          }
          const c = toLocal(citySpan.parentElement)
          const s = toLocal(sigSpan.parentElement)
          cityDock = { ...c, fs: 17, pl: 11 }
          sigDock = { ...s, fs: 17, pr: 11 }
        }
      } catch { /* fallback to static dock coords */ }

      const opt: KeyframeAnimationOptions = { duration: D * 1000, easing: EASE, fill: "forwards" }
      const moveBlk = (el: HTMLDivElement | null, hero: Pos, dock: Pos, shadowCol: string, padKey: "paddingLeft" | "paddingRight") => {
        if (!el) return
        const padField = padKey === "paddingLeft" ? "pl" : "pr"
        const from: Keyframe = { left: hero.left + "px", top: hero.top + "px", width: hero.width + "px", height: hero.height + "px", boxShadow: `5px 5px 0 ${shadowCol}`, [padKey]: (hero[padField] ?? 0) + "px" }
        const to: Keyframe = { left: dock.left + "px", top: dock.top + "px", width: dock.width + "px", height: dock.height + "px", boxShadow: "0px 0px 0 rgba(0,0,0,0)", [padKey]: (dock[padField] ?? 0) + "px" }
        el.animate([from, to], opt)
        const span = el.querySelector("span")
        if (span) span.animate([{ fontSize: hero.fs + "px" }, { fontSize: dock.fs + "px" }], opt)
      }
      moveBlk(cityRef.current, cityHero, cityDock, CS.B, "paddingLeft")
      moveBlk(sigRef.current, sigHero, sigDock, CS.K, "paddingRight")
      setExiting(true)
    }, 2900)
    const t2 = setTimeout(() => onDoneRef.current(), 3760)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsReady])

  // Hold a blank white stage (= grid cover bg) until fonts are ready, so the
  // lockup never paints in a fallback face.
  if (!fontsReady) return <div style={{ position: "absolute", inset: 0, zIndex: 400, background: CS.W }} />

  const grid = "rgba(13,13,13,0.09)"
  const gridImg = `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`
  const cmBase: React.CSSProperties = { position: "absolute", width: 15, height: 15, zIndex: 6 }
  const cmAnim = exiting ? "co5-fade 0.28s ease both" : "co5-cropIn 0.3s steps(2) 1.3s both"
  const wmText = (fs: number): React.CSSProperties => ({ fontWeight: 900, fontSize: fs, lineHeight: 1, letterSpacing: "-0.05em", textTransform: "uppercase", color: CS.W, fontFamily: FONT_SANS, whiteSpace: "nowrap" })

  return (
    <div ref={rootRef} style={{ position: "absolute", inset: 0, zIndex: 400, overflow: "hidden", fontFamily: FONT_SANS, pointerEvents: exiting ? "none" : "auto" }}>
      {/* white grid cover (= landing triptych) — slides up to reveal the card */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ flex: 1, height: "100%", background: CS.W, backgroundImage: gridImg, backgroundSize: "22px 22px", backgroundPosition: `${-i * (100 / 3)}vw 0px`, animation: exiting ? `${i % 2 === 0 ? "co5-colUp" : "co5-colDn"} 0.66s cubic-bezier(0.76,0,0.24,1) ${i * 0.05}s both` : "none" }} />
        ))}
      </div>
      {/* crop marks */}
      <div style={{ ...cmBase, top: 14, left: 14, borderTop: `2px solid ${CS.K}`, borderLeft: `2px solid ${CS.K}`, animation: cmAnim }} />
      <div style={{ ...cmBase, top: 14, right: 14, borderTop: `2px solid ${CS.K}`, borderRight: `2px solid ${CS.K}`, animation: cmAnim }} />
      <div style={{ ...cmBase, bottom: 14, left: 14, borderBottom: `2px solid ${CS.K}`, borderLeft: `2px solid ${CS.K}`, animation: cmAnim }} />
      <div style={{ ...cmBase, bottom: 14, right: 14, borderBottom: `2px solid ${CS.K}`, borderRight: `2px solid ${CS.K}`, animation: cmAnim }} />
      {/* slogan (centre) — leaves; the card has its own title */}
      <div style={{ position: "absolute", left: 50 + off.dx, top: 448 + off.dy, width: 226, zIndex: 5, animation: exiting ? "co5-tagOut 0.4s cubic-bezier(0.5,0,0.75,0) both" : "none" }}>
        <div style={{ height: 3, background: CS.K, transformOrigin: "left", marginBottom: 11, animation: "co5-ruleX 0.42s cubic-bezier(0.83,0,0.17,1) 1.5s both" }} />
        {([["то, что", CS.K], ["движется", CS.B], ["в городе", CS.K]] as const).map(([t, c], i) => (
          <div key={i} style={{ overflow: "hidden" }}>
            <div style={{ fontWeight: 900, fontSize: 27, lineHeight: 1.02, letterSpacing: "-0.04em", textTransform: "uppercase", color: c, animation: `co5-revUp 0.5s cubic-bezier(0.16,1,0.3,1) ${1.66 + i * 0.1}s both` }}>{t}</div>
          </div>
        ))}
      </div>
      {/* lockup: City + Signal assemble centre (co5-blk), then WAAPI flies them into the card banner */}
      <div ref={cityRef} style={{ position: "absolute", zIndex: 7, left: cityHero.left, top: cityHero.top, width: cityHero.width, height: cityHero.height, background: CS.K, boxShadow: `5px 5px 0 ${CS.B}`, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: cityHero.pl, overflow: "hidden", animation: "co5-blk 0.54s cubic-bezier(0.16,1,0.3,1) 0.12s both", "--bx": "-160%", "--by": "0px" } as React.CSSProperties}>
        <span style={wmText(cityHero.fs)}>City</span>
      </div>
      <div ref={sigRef} style={{ position: "absolute", zIndex: 8, left: sigHero.left, top: sigHero.top, width: sigHero.width, height: sigHero.height, background: CS.B, boxShadow: `5px 5px 0 ${CS.K}`, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: sigHero.pr, overflow: "hidden", animation: "co5-blk 0.54s cubic-bezier(0.16,1,0.3,1) 0.28s both", "--bx": "160%", "--by": "0px" } as React.CSSProperties}>
        <span style={wmText(sigHero.fs)}>Signal</span>
      </div>
    </div>
  )
}
