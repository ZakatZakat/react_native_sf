/**
 * CitySignal · 05 · Интересы (swipe taste trainer).
 *
 *  10 real Curator events; user taps ✕ / ♥. The tally per category becomes
 *  the profile that drives steps 06–07. Persists via useJourneyState() so
 *  Summary/Feed can render even after a full page refresh.
 */

import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CsPage, CS, FONT_MONO, FONT_SANS, DuotonePoster, Mark, ScreenBG } from "./shared"
import type { Ev } from "./buildDerived"
import { useDerived, useJourneyState } from "./useJourney"
import { analytics } from "../../lib/analytics"

function SwipeCard({ ev, depth, isTop }: { ev: Ev; depth: number; isTop: boolean }) {
  const rot = [-1.2, 0.9, -0.6][depth % 3] || 0
  return (
    <div style={{
      position: "absolute", inset: 0,
      transform: `translateY(${depth * 6}px) scale(${1 - depth * 0.04}) rotate(${rot}deg)`,
      transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
      zIndex: 10 - depth, pointerEvents: isTop ? "auto" : "none",
    }}>
      <div style={{
        width: "100%", height: "100%",
        border: `2.5px solid ${CS.K}`, background: CS.W,
        boxShadow: isTop ? `5px 5px 0 ${CS.B}` : `3px 3px 0 ${CS.K}`,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <DuotonePoster src={ev.p} style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, background: CS.W, color: CS.K, padding: "4px 8px", fontWeight: 900, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", border: `1.5px solid ${CS.K}`, lineHeight: 1 }}>{ev.c}</div>
          <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2, background: CS.K, color: CS.W, padding: "4px 8px", fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.06em" }}>{ev.d} · {ev.tm}</div>
        </div>
        <div style={{ padding: "12px 14px 14px", borderTop: `2px solid ${CS.K}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: CS.G55, letterSpacing: "0.06em", marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
            <span>{ev.ch}</span><span>пошёл бы?</span>
          </div>
          <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase", color: CS.K, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.t}</div>
          <div style={{ fontWeight: 600, fontSize: 11, color: CS.G55, marginTop: 6 }}>{ev.v}</div>
        </div>
      </div>
    </div>
  )
}

export default function CsSwipe() {
  const navigate = useNavigate()
  const { ready, derived } = useDerived()
  const { setProfile } = useJourneyState()
  const deck = derived.deck

  const [i, setI] = useState(0)
  const [liked, setLiked] = useState(0)
  const [verdict, setVerdict] = useState<"yes" | "no" | null>(null)
  const tallyRef = useRef<Record<string, number>>({})
  const cardShownAt = useRef<number>(Date.now())

  useEffect(() => { cardShownAt.current = Date.now() }, [i])

  const decide = (kind: "yes" | "no") => {
    if (verdict || i >= deck.length) return
    setVerdict(kind)
    const ev = deck[i]
    const time_to_decide_ms = Date.now() - cardShownAt.current
    if (kind === "yes") {
      tallyRef.current[ev.c] = (tallyRef.current[ev.c] || 0) + 1
      setLiked((n) => n + 1)
      analytics.track("cs.swipe.card.like", { event_id: ev.id, category: ev.c, catKey: ev.catKey, position: i, time_to_decide_ms }, { data: ev.t.slice(0, 200) })
    } else {
      analytics.track("cs.swipe.card.skip", { event_id: ev.id, category: ev.c, catKey: ev.catKey, position: i, time_to_decide_ms }, { data: ev.t.slice(0, 200) })
    }
    setTimeout(() => {
      setVerdict(null)
      setI((x) => {
        const nx = x + 1
        if (nx >= deck.length) {
          // Persist + advance to summary.
          setProfile({ ...tallyRef.current })
          analytics.track("cs.swipe.deck.complete", { liked: liked + (kind === "yes" ? 1 : 0), deck_size: deck.length, tally: { ...tallyRef.current } })
          setTimeout(() => navigate({ to: "/cs/summary" }), 260)
        }
        return nx
      })
    }, 380)
  }

  return (
    <CsPage>
      <ScreenBG theme="dots" />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", flexShrink: 0, padding: "42px 18px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: `2px solid ${CS.K}` }}>
            <button onClick={() => navigate({ to: "/cs/pass" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: CS.B }}>← Назад</button>
            <span style={{ background: CS.K, color: CS.W, padding: "5px 9px", fontWeight: 900, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>Шаг 5 / 7</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
            <Mark color={CS.G55}>Section / Интересы</Mark>
            <Mark color={CS.G55}>{deck.length} карточек</Mark>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 38, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.K }}>Пошёл бы?</div>
            <div style={{ fontWeight: 900, fontSize: 38, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.B, marginLeft: 6 }}>Жми.</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: CS.G55, marginTop: 12 }}>Смотри карточки, тапай <span style={{ color: CS.K, fontWeight: 900 }}>✕ или ♥</span>. Лента подстроится сама.</div>
          <div style={{ display: "flex", gap: 4, marginTop: 12, justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {(deck.length > 0 ? deck : Array.from({ length: 10 })).map((_, idx) => <span key={idx} style={{ width: 16, height: 5, background: idx < i ? CS.K : idx === i ? CS.B : CS.G18 }} />)}
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: CS.G55 }}>{Math.min(i + 1, deck.length || 10)} / {deck.length || 10} · ♥ {liked}</span>
          </div>
        </div>
        <div style={{ position: "relative", flex: 1, minHeight: 0, margin: "14px 18px 0" }}>
          {!ready ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: CS.G55, fontWeight: 700, fontSize: 13 }}>Загружаем карточки…</div>
          ) : deck.length === 0 ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: CS.G55, fontWeight: 700, fontSize: 13 }}>Нет событий в фиде.</div>
          ) : (
            [2, 1, 0].map((k) => {
              const idx = i + k
              if (idx >= deck.length) return null
              return <SwipeCard key={deck[idx].id + idx} ev={deck[idx]} depth={k} isTop={k === 0} />
            })
          )}
          {verdict && (
            <div style={{
              position: "absolute", top: 40, left: "50%",
              transform: `translateX(-50%) rotate(${verdict === "yes" ? -8 : 8}deg)`,
              zIndex: 30, pointerEvents: "none",
              background: verdict === "yes" ? CS.B : CS.K, color: CS.W,
              padding: "10px 18px", fontWeight: 900, fontSize: 22, letterSpacing: "0.16em",
              border: `3px solid ${CS.K}`, animation: "cs-j-stamp 0.4s cubic-bezier(0.22,1,0.36,1) both",
            }}>{verdict === "yes" ? "ХОЧУ" : "МИМО"}</div>
          )}
        </div>
        <div style={{ position: "relative", flexShrink: 0, padding: "12px 16px 18px", display: "flex", gap: 10 }}>
          <button onClick={() => decide("no")} style={{ flex: 1, padding: "14px 0", fontFamily: FONT_SANS, cursor: "pointer", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", border: `3px solid ${CS.K}`, background: CS.W, color: CS.K, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `3px 3px 0 ${CS.K}` }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>✕</span><span>Мимо</span>
          </button>
          <button onClick={() => decide("yes")} style={{ flex: 1, padding: "14px 0", fontFamily: FONT_SANS, cursor: "pointer", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", border: `3px solid ${CS.K}`, background: CS.K, color: CS.W, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `3px 3px 0 ${CS.B}` }}>
            <span style={{ fontSize: 18, lineHeight: 1, color: CS.B }}>♥</span><span>Хочу</span>
          </button>
        </div>
      </div>
    </CsPage>
  )
}
