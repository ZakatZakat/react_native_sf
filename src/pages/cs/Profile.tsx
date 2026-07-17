/**
 * CitySignal · 08 · Профиль («V2 · Спектр»).
 *
 *  City Pass identity card + horizontal taste-spectrum bar (segments
 *  weighted by how many events live in each liked category) + legend
 *  with percentages + hero stat ("312 событий отсмотрено").
 *
 *  Data wiring:
 *   - `name` from useJourneyState() (typed on /cs/name).
 *   - `profile` from useJourneyState() — falls back to SEED_PROFILE so
 *     opening /cs/profile straight from the dropdown still renders.
 *   - per-category counts come from useDerived().catCounts (real Curator
 *     events grouped by interest label) instead of the reference's
 *     hardcoded CAT_COUNTS map.
 */

import { useNavigate } from "@tanstack/react-router"
import {
  CsPage, CS, FONT_MONO, FONT_SANS, Mark, Mono, Monogram, PBARS, ScreenBG,
  GoingProvider, GoingAgenda, EventModalProvider, useGoing,
} from "./shared"
import { useDerived, useJourneyState } from "./useJourney"
import { FeedbackButton } from "./FeedbackModal"

/** Taste spectrum. When the user has added ≥2 categories of events, it's their
 *  REAL taste (frequency of added events per category). Otherwise it falls back
 *  to the city's biggest scenes (by how many events live in each), labelled
 *  honestly — no fabricated per-user taste. */
function buildSpectrum(going: { cat: string }[], catCounts: Record<string, number>) {
  const freq: Record<string, number> = {}
  for (const g of going) { const c = g.cat || "Событие"; freq[c] = (freq[c] || 0) + 1 }
  const personalCats = Object.keys(freq)
  if (personalCats.length >= 2) {
    return {
      personal: true,
      items: Object.entries(freq).map(([cat, n]) => ({ cat, n })).sort((a, b) => b.n - a.n).slice(0, 5),
    }
  }
  const top = Object.entries(catCounts)
    .filter(([c]) => c && c !== "Событие")
    .map(([cat, n]) => ({ cat, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
  return { personal: false, items: top }
}

/** Outer wrapper provides the Going store (RSVP list) + the bottom-sheet
 *  modal. Tapping a row in GoingAgenda opens that event's sheet. */
export default function CsProfile() {
  return (
    <GoingProvider>
      <EventModalProvider>
        <ProfileInner />
      </EventModalProvider>
    </GoingProvider>
  )
}

function ProfileInner() {
  const navigate = useNavigate()
  const { derived } = useDerived()
  const { displayName: name } = useJourneyState()
  const going = useGoing()

  const safeName = (name || "Гость").trim()
  const spectrum = buildSpectrum(going.list, derived.catCounts)
  const cats = spectrum.items
  const total = cats.reduce((s, x) => s + x.n, 0) || 1
  const pct = (n: number) => Math.round((n / total) * 100)
  const segColor = (i: number) =>
    i === 0 ? CS.B :
    (["#0D0D0D", "rgba(13,13,13,0.60)", "rgba(13,13,13,0.38)", "rgba(13,13,13,0.20)"][i - 1] || CS.G18)
  const parts = safeName.split(/\s+/)
  const first = parts[0] || "Гость"
  const last = parts.slice(1).join(" ")
  // Real stats: afisha size (all upcoming events) + the user's added list.
  const afishaCount = Object.values(derived.catCounts).reduce((s, n) => s + n, 0)
  const addedCount = going.list.length
  const remindCount = going.list.filter((e) => e.remind).length

  return (
    <CsPage>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <ScreenBG theme="dots" opacity={0.35} />
        {/* Top bar */}
        <div style={{ position: "relative", flexShrink: 0, padding: "42px 18px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: `2px solid ${CS.K}` }}>
            <button onClick={() => navigate({ to: "/cs/feed" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <Mono color={CS.B} style={{ fontWeight: 700 }}>← Лента</Mono>
            </button>
            <Mark color={CS.B}>City Pass</Mark>
          </div>
        </div>
        {/* Body */}
        <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px 10px" }}>
          {/* Identity card — same shape as /cs/pass */}
          <div style={{
            border: `2.5px solid ${CS.K}`, background: CS.W,
            display: "flex",
            boxShadow: `6px 6px 0 ${CS.K}`,
            animation: "cs-j-spring 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>
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
            <div style={{ flex: 1, padding: "15px 15px 14px", minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: CS.G55, letterSpacing: "0.14em", lineHeight: 1.5 }}>
                  КАРТОЧКА<br />ПОЛЬЗОВАТЕЛЯ
                </div>
                <Monogram w={42} name={safeName} />
              </div>
              <div style={{
                fontWeight: 900, fontSize: 26, lineHeight: 0.9,
                letterSpacing: "-0.035em", textTransform: "uppercase",
                marginTop: 12,
              }}>
                {first}{last ? <>
                  <br />{last}
                </> : null}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: CS.B, fontWeight: 700, marginTop: 8 }}>
                {addedCount > 0 ? `${addedCount} добавлено` : "новая карта"} · {afishaCount} в афише
              </div>
              <div style={{ display: "flex", gap: 2, height: 22, alignItems: "stretch", marginTop: 12 }}>
                {PBARS.map((w, j) => <span key={j} style={{ width: w, background: CS.K }} />)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1.5px solid ${CS.K}`, paddingTop: 6, marginTop: 6 }}>
                <Mark color={CS.G55}>Москва</Mark>
                <Mark color={CS.G55}>с 2026</Mark>
              </div>
            </div>
          </div>

          {/* «Я иду» — calendar of events the user has RSVP'd to. Shared
              with the EventSheet via the surrounding GoingProvider so
              toggling "Иду" in the modal updates this list live. */}
          <GoingAgenda />

          {/* Spectrum bar — real taste (from added events) or the city's scenes */}
          <Mark style={{ display: "block", marginTop: 22, marginBottom: 12 }}>{spectrum.personal ? "Ты про" : "Популярно в городе"}</Mark>
          <div style={{ display: "flex", height: 46, border: `2px solid ${CS.K}` }}>
            {cats.map((x, i) => (
              <div key={x.cat} style={{
                flex: x.n, background: segColor(i),
                borderRight: i < cats.length - 1 ? `1.5px solid ${CS.W}` : "none",
              }} />
            ))}
          </div>

          {/* Legend */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            {cats.map((x, i) => (
              <div key={x.cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 11, height: 11, flexShrink: 0, background: segColor(i), border: `1px solid ${CS.K}` }} />
                <span style={{ flex: 1, fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{x.cat}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: CS.G55 }}>{pct(x.n)}%</span>
              </div>
            ))}
          </div>

          {/* Hero stat — real afisha size + the user's own added events */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 11 }}>
              <span style={{ fontWeight: 900, fontSize: 54, letterSpacing: "-0.045em", lineHeight: 0.82 }}>{afishaCount}</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: CS.G55, lineHeight: 1.2 }}>событий<br />в афише</span>
            </div>
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 12.5, color: CS.G55, lineHeight: 1.55 }}>
              {addedCount > 0 ? (
                <>
                  <span style={{ color: CS.K, fontWeight: 900 }}>{addedCount}</span> добавлено · <span style={{ color: CS.K, fontWeight: 900 }}>{remindCount}</span> с напоминанием
                </>
              ) : (
                <>Пока ничего не добавлено — открой событие и жми «Добавить».</>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: "relative", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, padding: "12px 18px 18px", borderTop: `2px solid ${CS.K}`, background: CS.W }}>
          <FeedbackButton />
          <button
            onClick={() => navigate({ to: "/cs/swipe" })}
            style={{
              width: "100%", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 14,
              letterSpacing: "0.05em", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "13px 16px", border: `3px solid ${CS.K}`,
              background: CS.K, color: CS.W, cursor: "pointer",
              boxShadow: `3px 3px 0 ${CS.B}`,
            }}
          >
            <span>Редактировать профиль</span><span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
          </button>
        </div>
      </div>
    </CsPage>
  )
}
