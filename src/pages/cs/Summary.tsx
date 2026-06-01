/**
 * CitySignal · 06 · Суммаризация.
 *
 *  3 variants of the inferred profile (preview / digest / wall). Picks the
 *  variant from ?v=0|1|2 (defaults to 0 = preview). Empty profile shows a
 *  redo CTA back to /cs/swipe.
 */

import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  CsPage, CS, FONT_MONO, FONT_SANS, DuotonePoster, Mark, Mono, ScreenBG,
} from "./shared"
import type { Ev } from "./buildDerived"
import { useDerived, useJourneyState, SEED_PROFILE } from "./useJourney"
import { Curator } from "../../lib/curator"
import { INTERESTS, setInterests as savePrefs } from "../pipe/preferences"
import { analytics } from "../../lib/analytics"

function summaryEvents(top: [string, number][], pool: Record<string, Ev[]>, perCat = 1): Ev[] {
  return top.flatMap(([cat]) => (pool[cat] || []).slice(0, perCat))
}

function SumStat({ est }: { est: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16, paddingTop: 12, borderTop: `2px solid ${CS.K}` }}>
      <span style={{ fontWeight: 900, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: CS.K }}>Всего в ленте</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontWeight: 900, fontSize: 26, color: CS.B, lineHeight: 1, letterSpacing: "-0.04em" }}>≈{est}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: CS.G55 }}>событий / нед.</span>
      </span>
    </div>
  )
}

function Preview({ top, est, pool }: { top: [string, number][]; est: number; pool: Record<string, Ev[]> }) {
  const evs = summaryEvents(top, pool, 1).slice(0, 3)
  return (
    <>
      <div style={{ marginTop: 4, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 36, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.K }}>Твоя</div>
        <div style={{ fontWeight: 900, fontSize: 36, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.B, marginLeft: 6 }}>неделя</div>
        <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: CS.G55, marginTop: 10 }}>Под твой вкус собрали <span style={{ color: CS.K, fontWeight: 900 }}>≈{est} событий</span>. Вот ближайшие:</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {evs.map((e, j) => (
          <div key={j} style={{ display: "flex", border: `2.5px solid ${CS.K}`, boxShadow: `3px 3px 0 ${CS.B}`, background: CS.W, minHeight: 86, animation: `cs-j-rise 0.4s ease ${0.05 + j * 0.08}s both` }}>
            <DuotonePoster src={e.p} style={{ width: 82, flexShrink: 0, alignSelf: "stretch", borderRight: `2px solid ${CS.K}` }} />
            <div style={{ flex: 1, padding: "10px 12px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <Mono color={CS.B}>{e.c} · {e.d}</Mono>
                <div style={{ fontWeight: 900, fontSize: 15, lineHeight: 0.98, letterSpacing: "-0.03em", textTransform: "uppercase", color: CS.K, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.t}</div>
              </div>
              <Mono>{e.v}</Mono>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Digest({ top, est, pool, catCounts }: { top: [string, number][]; est: number; pool: Record<string, Ev[]>; catCounts: Record<string, number> }) {
  return (
    <>
      <div style={{ marginTop: 4, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 36, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.K }}>Твой</div>
        <div style={{ fontWeight: 900, fontSize: 36, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.B, marginLeft: 6 }}>дайджест</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {top.map(([cat], j) => {
          const e = (pool[cat] || [])[0]
          return (
            <div key={cat} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 0", borderTop: j === 0 ? `2px solid ${CS.K}` : `1.5px solid ${CS.G18}`, animation: `cs-j-rise 0.4s ease ${0.05 + j * 0.07}s both` }}>
              <DuotonePoster src={e?.p ?? null} style={{ width: 54, height: 54, flexShrink: 0, border: `2px solid ${CS.K}` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.03em", textTransform: "uppercase", color: CS.K }}>{cat}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: CS.B, fontWeight: 700, whiteSpace: "nowrap" }}>+{catCounts[cat] || 10}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 11, color: CS.G55, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e?.t ?? "—"}</div>
              </div>
            </div>
          )
        })}
      </div>
      <SumStat est={est} />
    </>
  )
}

function Wall({ top, est, pool }: { top: [string, number][]; est: number; pool: Record<string, Ev[]> }) {
  const evs = summaryEvents(top, pool, 2).slice(0, 6)
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 32, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.K }}>Собрали</div>
          <div style={{ fontWeight: 900, fontSize: 32, lineHeight: 0.84, letterSpacing: "-0.045em", textTransform: "uppercase", color: CS.B, marginLeft: 4 }}>под тебя</div>
        </div>
        <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontWeight: 900, fontSize: 30, color: CS.B, lineHeight: 1, letterSpacing: "-0.04em" }}>≈{est}</span>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {evs.map((e, j) => (
          <div key={j} style={{ position: "relative", border: `2px solid ${CS.K}`, aspectRatio: "1 / 1.12", overflow: "hidden", animation: `cs-j-rise 0.4s ease ${0.04 + j * 0.06}s both` }}>
            <DuotonePoster src={e.p} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", top: 6, left: 6, background: CS.W, color: CS.K, padding: "3px 6px", fontWeight: 900, fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", border: `1.5px solid ${CS.K}`, lineHeight: 1 }}>{e.c}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: CS.K, color: CS.W, padding: "4px 6px", fontFamily: FONT_MONO, fontSize: 8, letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.d} · {e.t}</div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function CsSummary() {
  const navigate = useNavigate()
  const { derived } = useDerived()
  const { profile } = useJourneyState()
  const search = useSearch({ strict: false }) as Record<string, string | undefined>
  const variant = Math.max(0, Math.min(2, Number(search.v ?? 0)))

  // Use the persisted profile, or fall back to a seed when the user lands
  // here straight from the dropdown without first running the swipe.
  const effectiveProfile = Object.keys(profile).length > 0 ? profile : SEED_PROFILE

  const ranked = Object.entries(effectiveProfile).sort((a, b) => b[1] - a[1])
  const top = ranked.slice(0, 4) as [string, number][]
  const liked = ranked.reduce((s, [, n]) => s + n, 0)
  const est = top.reduce((s, [k]) => s + (derived.catCounts[k] || 10), 0)
  const empty = liked === 0

  const onEnter = async () => {
    // Save inferred interests to Curator so the next-step feed reflects them.
    const keys = top
      .map(([label]) => INTERESTS.find((i) => i.label === label)?.key)
      .filter((k): k is string => !!k)
    if (keys.length > 0) {
      savePrefs(keys)
      analytics.track("cs.summary.enter_feed", { inferred_keys: keys, top_labels: top.map(([l]) => l) })
      try { await Curator.setInterests(keys) } catch { /* offline */ }
    }
    navigate({ to: "/cs/feed" })
  }

  return (
    <CsPage>
      <ScreenBG theme="dots" />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", flexShrink: 0, padding: "42px 18px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: `2px solid ${CS.K}` }}>
            <button onClick={() => navigate({ to: "/cs/swipe" })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: CS.B }}>← Назад</button>
            <span style={{ background: CS.K, color: CS.W, padding: "5px 9px", fontWeight: 900, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>Шаг 6 / 7</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
            <Mark color={CS.G55}>Section / Суммаризация</Mark>
            <Mark color={CS.G55}>♥ {liked} из {derived.deck.length || 10}</Mark>
          </div>
        </div>
        <div style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 18px 8px" }}>
          {empty ? (
            <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.5, color: CS.G55, marginTop: 8 }}>Ничего не зацепило — ни одного ♥. Пройди ещё раз, чтобы собрать суммаризацию.</div>
          ) : variant === 1 ? <Digest top={top} est={est} pool={derived.pool} catCounts={derived.catCounts} />
            : variant === 2 ? <Wall top={top} est={est} pool={derived.pool} />
            : <Preview top={top} est={est} pool={derived.pool} />}
        </div>
        <div style={{ position: "relative", flexShrink: 0, padding: "12px 18px 18px" }}>
          <button onClick={empty ? () => navigate({ to: "/cs/swipe" }) : onEnter} style={{ width: "100%", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", border: `3px solid ${CS.K}`, background: CS.K, color: CS.W, boxShadow: `4px 4px 0 ${CS.B}`, cursor: "pointer" }}>
            <span>{empty ? "Пройти ещё раз" : "Открыть ленту"}</span><span style={{ fontSize: 20 }}>→</span>
          </button>
        </div>
      </div>
    </CsPage>
  )
}
