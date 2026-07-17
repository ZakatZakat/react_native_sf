/**
 * CitySignal · admin — «Выбор недели».
 *
 *  Editorial picker for the Week digest. Admin-only (endpoints gated by
 *  require_admin via Telegram initData). Two independent picks:
 *
 *    ПОСТЕР  — browse a poster-first shortlist ranked by filter_score, preview it
 *              inside ALL four «Сплит» designs (image suitability is the point),
 *              pin with «Поставить на неделю» (GET /me/week).
 *    ДИЗАЙН  — tap a design frame to pin THAT layout for everyone
 *              (ui_variants.week_design); «Авто» restores random-per-open, which
 *              is what the screen did before this switcher existed.
 *
 *  The design frames are both the preview and the control — one place, no
 *  duplicated layout to drift.
 */

import { useEffect, useMemo, useState } from "react"
import { SK, FONT_SANS, FONT_MONO } from "./shared"
import { useDerived } from "./useJourney"
import { toEv, resolvePoster, type Ev } from "./buildDerived"
import { Curator } from "../../lib/curator"
import type { FeedItem } from "../../lib/curator"
import { analytics } from "../../lib/analytics"
import { WeekDesign, WEEK_VARIANTS, WEEK_VARIANT_LABELS, weekMeta, type WeekVariant } from "./WeekDesigns"

// Ключ компонента в ui_variants + значение «не закреплять» (рандом как раньше).
const UI_KEY = "week_design"
const AUTO = "auto" as const

// A phone-accurate preview: render the design at full 375×812 then scale down,
// so font sizes / crops read exactly as on device.
const FRAME_W = 156
const PHONE_W = 375
const PHONE_H = 812
const SCALE = FRAME_W / PHONE_W

function DesignFrame({ variant, hero, trio, wk, lead, eventsCount, active, onPick }: {
  variant: (typeof WEEK_VARIANTS)[number]
  hero?: Ev; trio: Ev[]; wk: { n: number; dates: string }; lead: string; eventsCount: number
  active?: boolean
  onPick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={!!active}
      style={{ padding: 0, border: "none", background: "none", cursor: onPick ? "pointer" : "default", textAlign: "center", display: "block" }}
    >
      <div style={{
        width: FRAME_W, height: FRAME_W * (PHONE_H / PHONE_W), position: "relative", overflow: "hidden",
        border: `2px solid ${SK.ink}`, background: SK.ink,
        // The pinned design is called out with the signal-blue offset the rest of
        // the admin uses for «this is the live one».
        boxShadow: active ? `4px 4px 0 ${SK.blue}` : "none",
        outline: active ? `2px solid ${SK.blue}` : "none",
        outlineOffset: 2,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: PHONE_W, height: PHONE_H, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
          <WeekDesign variant={variant} hero={hero} trio={trio} wk={wk} lead={lead} eventsCount={eventsCount} still />
        </div>
      </div>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
        color: active ? SK.ink : SK.ink55, fontWeight: active ? 700 : 400, marginTop: 5,
      }}>
        {active ? "▸ " : ""}{WEEK_VARIANT_LABELS[variant]}
      </div>
    </button>
  )
}

export default function AdminWeek() {
  const { derived } = useDerived()
  const wk = useMemo(weekMeta, [])
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "error">("loading")
  const [cands, setCands] = useState<FeedItem[]>([])
  const [current, setCurrent] = useState<FeedItem | null>(null)
  const [selected, setSelected] = useState<FeedItem | null>(null)
  const [saving, setSaving] = useState(false)
  // Which design the Week screen uses. AUTO = the original random-per-open.
  // Saved on tap (one value, no Save step) — the frame highlight IS the state.
  const [design, setDesign] = useState<WeekVariant | typeof AUTO>(AUTO)

  useEffect(() => {
    Curator.adminGetUiVariants()
      .then((v) => {
        const p = v?.[UI_KEY]
        if (p && (WEEK_VARIANTS as readonly string[]).includes(p)) setDesign(p as WeekVariant)
      })
      .catch(() => { /* switcher just shows АВТО */ })
  }, [])

  const pickDesign = async (v: WeekVariant | typeof AUTO) => {
    const prev = design
    setDesign(v)                                  // optimistic — the highlight must feel instant
    try { await Curator.adminSetUiVariant(UI_KEY, v) } catch { setDesign(prev) }
  }

  useEffect(() => {
    Promise.all([Curator.adminWeekCandidates(60), Curator.adminWeekCurrent()])
      .then(([c, cur]) => {
        setCands(c || [])
        setCurrent(cur)
        setSelected(cur)
        setStatus("ok")
      })
      .catch(async (e) => {
        // Local dev has no admin backend — seed the picker from the public feed
        // so previews/selection are testable. Prod (DEV=false) surfaces the error.
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

  const heroEv = selected ? toEv(selected) : undefined
  const trio: Ev[] = selected
    ? [toEv(selected), ...cands.filter((c) => c.id !== selected.id).map(toEv)].slice(0, 3)
    : []
  const eventsCount = derived.feed.length || Object.values(derived.catCounts).reduce((a, b) => a + b, 0)
  const lead = derived.shelves.length
    ? `На этой неделе — ${derived.shelves.map((s) => s.cat.toLowerCase()).slice(0, 3).join(", ")} и не только. Редакция собрала, ради чего стоит выйти.`
    : "Свежая подборка городских событий. Редакция собрала, ради чего стоит выйти."

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await Curator.adminSetWeekPick(Number(selected.id))
      setCurrent(updated)
      analytics.track("cs.admin.week_pick", { event_id: selected.id })
    } catch { /* surfaced by the button staying enabled */ } finally {
      setSaving(false)
    }
  }
  const clear = async () => {
    setSaving(true)
    try { await Curator.adminClearWeekPick(); setCurrent(null); setSelected(null); analytics.track("cs.admin.week_clear", {}) } catch { /* noop */ } finally { setSaving(false) }
  }

  const pageStyle: React.CSSProperties = { position: "fixed", inset: 0, overflowY: "auto", background: SK.paper, color: SK.ink, fontFamily: FONT_SANS, WebkitOverflowScrolling: "touch" }

  if (status === "loading") {
    return <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.1em", color: SK.ink55 }}>загрузка…</div>
  }
  if (status === "denied") {
    return <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, padding: 24, textAlign: "center" }}>
      <div style={{ fontWeight: 900, fontSize: 22, textTransform: "uppercase" }}>Нет доступа</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: SK.ink55, letterSpacing: "0.06em" }}>Раздел только для админов (Telegram-id в ADMIN_USER_IDS).</div>
    </div>
  }
  if (status === "error") {
    return <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: FONT_MONO, fontSize: 12, color: SK.ink55 }}>не удалось загрузить кандидатов</div>
  }

  const currentEv = current ? toEv(current) : null

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "calc(env(safe-area-inset-top,0px) + 20px) 16px 40px" }}>
        {/* header */}
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: SK.ink55 }}>CitySignal · редакция</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `3px solid ${SK.ink}`, paddingBottom: 10, marginTop: 4 }}>
          <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.03em", textTransform: "uppercase" }}>Выбор недели</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em", color: SK.ink55, textAlign: "right" }}>нед. {wk.n}<br />{wk.dates}</div>
        </div>

        {/* current pick */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 12px", background: currentEv ? "rgba(0,85,255,0.08)" : "rgba(13,13,13,0.05)", border: `2px solid ${currentEv ? SK.blue : "rgba(13,13,13,0.15)"}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: currentEv ? SK.blue : SK.ink55, whiteSpace: "nowrap" }}>сейчас</div>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 13, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentEv ? currentEv.t : "авто (ближайший топ-ивент)"}
          </div>
          {currentEv && (
            <button onClick={clear} disabled={saving} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: SK.ink55, textDecoration: "underline" }}>снять</button>
          )}
        </div>

        {/* live preview of the selected poster across all 4 designs */}
        {heroEv && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: SK.ink55 }}>
                как ляжет постер · тапни дизайн
              </div>
              {/* АВТО keeps the old behaviour (random per open) — the escape hatch
                  from a pin, and the default when nothing is chosen. */}
              <button
                type="button"
                onClick={() => pickDesign(AUTO)}
                aria-pressed={design === AUTO}
                style={{
                  cursor: "pointer", padding: "5px 11px", border: `2px solid ${SK.ink}`,
                  background: design === AUTO ? SK.ink : SK.paper, color: design === AUTO ? "#fff" : SK.ink,
                  boxShadow: design === AUTO ? `2px 2px 0 ${SK.blue}` : "none",
                  fontFamily: FONT_SANS, fontWeight: 900, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
                }}
              >
                Авто · рандом
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(2, ${FRAME_W}px)`, gap: 16, justifyContent: "center" }}>
              {WEEK_VARIANTS.map((v) => (
                <DesignFrame
                  key={v} variant={v} hero={heroEv} trio={trio} wk={wk} lead={lead} eventsCount={eventsCount}
                  active={design === v}
                  onPick={() => pickDesign(v)}
                />
              ))}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.06em", color: SK.ink55, marginTop: 9, textAlign: "center" }}>
              {design === AUTO
                ? "сейчас: случайный из 4 при каждом открытии"
                : `сейчас всем показывается «${WEEK_VARIANT_LABELS[design]}»`}
            </div>
            <button
              onClick={save}
              disabled={saving || (!!current && current.id === selected?.id)}
              style={{
                width: "100%", marginTop: 16, padding: "15px 18px", border: "none", cursor: saving ? "default" : "pointer",
                background: (!!current && current.id === selected?.id) ? "rgba(13,13,13,0.2)" : SK.blue, color: "#fff",
                fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase",
                boxShadow: (!!current && current.id === selected?.id) ? "none" : `4px 4px 0 ${SK.ink}`,
              }}
            >
              {saving ? "сохраняю…" : (!!current && current.id === selected?.id) ? "уже на неделе" : "поставить на неделю →"}
            </button>
          </div>
        )}

        {/* candidate shortlist */}
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: SK.ink55, margin: "24px 0 10px" }}>
          кандидаты · {cands.length} · по качеству
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          {cands.map((c) => {
            const ev = toEv(c)
            const on = selected?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  display: "flex", gap: 11, alignItems: "stretch", textAlign: "left", cursor: "pointer",
                  padding: 8, background: SK.paper, border: `2px solid ${on ? SK.blue : "rgba(13,13,13,0.14)"}`,
                  boxShadow: on ? `3px 3px 0 ${SK.blue}` : "none",
                }}
              >
                <div style={{ width: 54, height: 72, flexShrink: 0, overflow: "hidden", background: "#e8e8e4", border: `1px solid rgba(13,13,13,0.15)` }}>
                  {ev.p
                    ? <img src={ev.p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg,#ccc,#999)" }} />}
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
