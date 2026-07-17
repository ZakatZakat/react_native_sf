/**
 * CitySignal · admin — «Постеры лендинга».
 *
 *  Editorial picker for the 4-poster strip on the landing. Admin-only (same
 *  require_admin gate as the week pick). Browse the poster-first shortlist, tap
 *  up to 4 (order = slot 0..3), preview them in the real landing cells, save.
 *  The landing then reads GET /me/landing; empty → auto triptych fallback.
 */

import { useEffect, useMemo, useState } from "react"
import { SK, FONT_SANS, FONT_MONO } from "./shared"
import { toEv, resolvePoster, type Ev } from "./buildDerived"
import { Curator } from "../../lib/curator"
import type { FeedItem } from "../../lib/curator"
import { weekMeta } from "./WeekDesigns"

const MAX = 4

export default function AdminLanding() {
  const wk = useMemo(weekMeta, [])
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "error">("loading")
  const [cands, setCands] = useState<FeedItem[]>([])
  const [chosen, setChosen] = useState<FeedItem[]>([])
  const [savedIds, setSavedIds] = useState<string>("")   // id-signature of the last saved set
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([Curator.adminLandingCandidates(60), Curator.adminLandingCurrent()])
      .then(([c, cur]) => {
        setCands(c || [])
        setChosen(cur || [])
        setSavedIds((cur || []).map((x) => x.id).join(","))
        setStatus("ok")
      })
      .catch(async (e) => {
        if (import.meta.env.DEV) {
          try {
            const f = await Curator.getFeed({ limit: 60 })
            setCands((f || []).filter((it) => resolvePoster(it)))
            setStatus("ok")
            return
          } catch { /* fall through */ }
        }
        setStatus(String(e).includes("403") ? "denied" : "error")
      })
  }, [])

  const toggle = (it: FeedItem) => {
    setChosen((prev) => {
      if (prev.some((x) => x.id === it.id)) return prev.filter((x) => x.id !== it.id)
      if (prev.length >= MAX) return prev
      return [...prev, it]
    })
  }

  const dirty = chosen.map((x) => x.id).join(",") !== savedIds
  const save = async () => {
    setSaving(true)
    try {
      await Curator.adminClearLandingPick()
      for (let i = 0; i < chosen.length; i++) await Curator.adminSetLandingPick(i, Number(chosen[i].id))
      setSavedIds(chosen.map((x) => x.id).join(","))
    } catch { /* button stays enabled on failure */ } finally {
      setSaving(false)
    }
  }
  const clearAll = async () => {
    setSaving(true)
    try { await Curator.adminClearLandingPick(); setChosen([]); setSavedIds("") } catch { /* noop */ } finally { setSaving(false) }
  }

  const pageStyle: React.CSSProperties = { position: "fixed", inset: 0, overflowY: "auto", background: SK.paper, color: SK.ink, fontFamily: FONT_SANS, WebkitOverflowScrolling: "touch" }

  if (status === "loading") return <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em", color: SK.ink55 }}>загрузка…</div>
  if (status === "denied") return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, padding: 24, textAlign: "center" }}>
      <div style={{ fontWeight: 900, fontSize: 22, textTransform: "uppercase" }}>Нет доступа</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: SK.ink55, letterSpacing: "0.06em" }}>Раздел только для админов (Telegram-id в ADMIN_USER_IDS).</div>
    </div>
  )
  if (status === "error") return <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: FONT_MONO, fontSize: 12, color: SK.ink55 }}>не удалось загрузить кандидатов</div>

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "calc(env(safe-area-inset-top,0px) + 20px) 16px 48px" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: SK.ink55 }}>CitySignal · редакция</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `3px solid ${SK.ink}`, paddingBottom: 10, marginTop: 4 }}>
          <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.03em", textTransform: "uppercase" }}>Постеры лендинга</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", color: SK.ink55, textAlign: "right" }}>нед. {wk.n}<br />{wk.dates}</div>
        </div>

        {/* live preview — the 4 landing cells (contain, exactly as on the landing) */}
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: SK.ink55, margin: "16px 0 9px" }}>
          как на лендинге · выбрано {chosen.length}/{MAX}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7 }}>
          {Array.from({ length: MAX }).map((_, i) => {
            const it = chosen[i]
            const p = it ? toEv(it).p : null
            return (
              <div key={i} style={{ position: "relative", aspectRatio: "3 / 4", border: `1.5px solid ${SK.ink}`, background: "#e8e8e4", padding: 3, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {p ? <img src={p} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
                   : <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.08em", color: SK.ink55 }}>слот {i + 1}</span>}
                {it && (
                  <button onClick={() => toggle(it)} aria-label="убрать" style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, border: `1.5px solid ${SK.ink}`, background: SK.paper, cursor: "pointer", fontSize: 11, fontWeight: 900, lineHeight: 1, color: SK.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={save}
            disabled={saving || !dirty}
            style={{ flex: 1, padding: "15px 18px", border: "none", cursor: saving || !dirty ? "default" : "pointer", background: !dirty ? "rgba(13,13,13,0.2)" : SK.blue, color: "#fff", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase", boxShadow: !dirty ? "none" : `4px 4px 0 ${SK.ink}` }}
          >
            {saving ? "сохраняю…" : !dirty ? "сохранено" : "сохранить →"}
          </button>
          {chosen.length > 0 && (
            <button onClick={clearAll} disabled={saving} style={{ padding: "15px 16px", border: `2px solid ${SK.ink}`, background: SK.paper, cursor: "pointer", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: SK.ink }}>сбросить</button>
          )}
        </div>

        {/* candidate shortlist — tap to add/remove (max 4) */}
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: SK.ink55, margin: "24px 0 10px" }}>
          кандидаты · {cands.length} · по качеству
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          {cands.map((c) => {
            const ev = toEv(c)
            const idx = chosen.findIndex((x) => x.id === c.id)
            const on = idx >= 0
            const full = chosen.length >= MAX && !on
            return (
              <button
                key={c.id}
                onClick={() => toggle(c)}
                disabled={full}
                style={{ display: "flex", gap: 11, alignItems: "stretch", textAlign: "left", cursor: full ? "default" : "pointer", opacity: full ? 0.5 : 1, padding: 8, background: SK.paper, border: `2px solid ${on ? SK.blue : "rgba(13,13,13,0.14)"}`, boxShadow: on ? `3px 3px 0 ${SK.blue}` : "none" }}
              >
                <div style={{ position: "relative", width: 54, height: 72, flexShrink: 0, overflow: "hidden", background: "#e8e8e4", border: `1px solid rgba(13,13,13,0.15)` }}>
                  {ev.p ? <img src={ev.p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg,#ccc,#999)" }} />}
                  {on && <div style={{ position: "absolute", top: 0, left: 0, width: 20, height: 20, background: SK.blue, color: "#fff", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{idx + 1}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 900, fontSize: 13.5, lineHeight: 1.12, textTransform: "uppercase", letterSpacing: "-0.01em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.t}</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: FONT_MONO, fontSize: 9.5, color: SK.ink55, letterSpacing: "0.04em" }}>
                    <span style={{ fontWeight: 700, color: SK.blue }}>★ {c.filter_score}</span>
                    <span>{ev.d}{ev.tm && ev.tm !== "—" ? ` · ${ev.tm}` : ""}</span>
                    {ev.c && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {ev.c}</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
