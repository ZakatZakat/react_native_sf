/**
 * CitySignal · Админ-панель (/admin) — минималистичный дашборд.
 *
 *  Plain, low-chrome stats view. Two sources:
 *   - analytics-platform (GET /api/v1/stats) — users, sessions, events,
 *     funnel, per-day series, top event types.
 *   - curator (GET /admin/stats) — channels, raw posts, events by status.
 *
 *  Direct URL only; not part of the journey.
 */

import { useEffect, useState } from "react"
import { analytics, type AdminStats } from "../../lib/analytics"
import { CURATOR_BASE } from "../../lib/curator"
import { isImg, resolveMedia } from "../pipe/shared"

const AS_USER = import.meta.env.VITE_DEV_USER_ID || "12345"

type AdminPost = {
  event_id: number
  status: string
  channel: string
  text: string | null
  media_urls: string[]
  event_time: string | null
  location: string | null
  price: string | null
  created_at: string
}

const STATUS_TABS: { id: string; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "approved", label: "Approved" },
  { id: "manual_review", label: "На модерации" },
  { id: "rejected", label: "Rejected" },
]

const STATUS_COLOR: Record<string, string> = {
  approved: "#1a8f3c",
  manual_review: "#b8860b",
  rejected: "#c0392b",
  pending: "#8a8a8a",
}

// Neutral, minimal palette — no brutalist borders/shadows.
const INK = "#111111"
const MUTE = "#8a8a8a"
const FAINT = "#b8b8b8"
const LINE = "#ececec"
const BAR = "#111111"
const BAR_BG = "#f1f1f1"
const ACCENT = "#0055FF"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SANS = "'Inter', system-ui, -apple-system, sans-serif"

type CuratorStats = {
  channels: { total: number; enabled: number }
  posts_raw: number
  events_by_status: Record<string, number>
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ padding: "2px 0" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: MUTE }}>{label}</div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: "-0.03em", lineHeight: 1.1, color: INK, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 34, marginBottom: 14 }}>
      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: INK }}>{children}</div>
      {right != null && <div style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>{right}</div>}
    </div>
  )
}

function Bar({ label, n, max }: { label: string; n: number; max: number }) {
  const pct = max > 0 ? Math.round((n / max) * 100) : 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
      <span style={{ width: 110, flexShrink: 0, fontFamily: SANS, fontSize: 12.5, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: BAR_BG, borderRadius: 3, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: BAR, borderRadius: 3 }} />
      </div>
      <span style={{ width: 40, flexShrink: 0, textAlign: "right", fontFamily: MONO, fontSize: 12, color: MUTE }}>{n}</span>
    </div>
  )
}

function PostsPanel() {
  const [status, setStatus] = useState("all")
  const [items, setItems] = useState<AdminPost[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const PAGE = 20

  const fetchPage = async (st: string, off: number, replace: boolean) => {
    setLoading(true)
    try {
      const r = await fetch(`${CURATOR_BASE}/admin/events?status=${st}&limit=${PAGE}&offset=${off}&as_user=${AS_USER}`)
      if (!r.ok) throw new Error(`${r.status}`)
      const rows = (await r.json()) as AdminPost[]
      setItems((prev) => replace ? rows : [...prev, ...rows])
      setDone(rows.length < PAGE)
      setOffset(off + rows.length)
    } catch {
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setItems([]); setOffset(0); setDone(false); void fetchPage(status, 0, true) /* eslint-disable-next-line */ }, [status])

  const act = async (id: number, action: "approve" | "reject") => {
    setBusy(id)
    try {
      const url = `${CURATOR_BASE}/admin/moderation/${id}/${action}?as_user=${AS_USER}`
      const opts: RequestInit = action === "reject"
        ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: null }) }
        : { method: "POST" }
      const r = await fetch(url, opts)
      if (r.ok) {
        const newStatus = action === "approve" ? "approved" : "rejected"
        // If a status filter is active and the new status no longer matches, drop the row; else update it.
        setItems((prev) => prev
          .map((p) => p.event_id === id ? { ...p, status: newStatus } : p)
          .filter((p) => status === "all" || p.status === status))
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SectionTitle right={`${items.length} загружено`}>Посты</SectionTitle>
      {/* status tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUS_TABS.map((t) => {
          const on = status === t.id
          return (
            <button
              key={t.id}
              onClick={() => setStatus(t.id)}
              style={{ border: `1px solid ${on ? INK : LINE}`, background: on ? INK : "#fff", color: on ? "#fff" : INK, borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontFamily: SANS, fontSize: 12.5 }}
            >{t.label}</button>
          )
        })}
      </div>

      {items.map((p) => {
        const m = p.media_urls.find(isImg) ?? p.media_urls[0]
        const poster = resolveMedia(m ?? null)
        const img = poster && isImg(poster) ? poster : null
        const date = p.event_time ? new Date(p.event_time).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) : ""
        const isManual = p.status === "manual_review" || p.status === "pending"
        return (
          <div key={p.event_id} style={{ display: "flex", gap: 12, padding: "14px 0", borderTop: `1px solid ${LINE}` }}>
            <div style={{ width: 64, height: 64, flexShrink: 0, background: "#f3f3f3", borderRadius: 6, overflow: "hidden" }}>
              {img && <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: STATUS_COLOR[p.status] ?? MUTE, textTransform: "uppercase" }}>{p.status}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: FAINT }}>{p.channel}{date ? ` · ${date}` : ""}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: INK, marginTop: 5, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {(p.text || "—").trim()}
              </div>
              {isManual && (
                <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                  <button disabled={busy === p.event_id} onClick={() => act(p.event_id, "approve")} style={{ border: "1px solid #1a8f3c", background: busy === p.event_id ? "#eee" : "#fff", color: "#1a8f3c", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: SANS, fontSize: 12 }}>✓ Approve</button>
                  <button disabled={busy === p.event_id} onClick={() => act(p.event_id, "reject")} style={{ border: "1px solid #c0392b", background: busy === p.event_id ? "#eee" : "#fff", color: "#c0392b", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: SANS, fontSize: 12 }}>✕ Reject</button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {!loading && items.length === 0 && (
        <div style={{ fontFamily: MONO, fontSize: 12, color: MUTE, padding: "12px 0" }}>Пусто.</div>
      )}
      {!done && (
        <button onClick={() => fetchPage(status, offset, false)} disabled={loading} style={{ width: "100%", marginTop: 14, border: `1px solid ${LINE}`, background: "#fff", borderRadius: 8, padding: "10px", cursor: "pointer", fontFamily: SANS, fontSize: 13, color: INK }}>
          {loading ? "Загружаю…" : "Показать ещё"}
        </button>
      )}
    </>
  )
}

export default function CsAdmin() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [content, setContent] = useState<CuratorStats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true); setErr(null)
    const [s, c] = await Promise.allSettled([
      analytics.fetchStats(),
      fetch(`${CURATOR_BASE}/admin/stats?as_user=${import.meta.env.VITE_DEV_USER_ID || "12345"}`).then((r) => r.ok ? r.json() : Promise.reject(new Error(`curator ${r.status}`))),
    ])
    if (s.status === "fulfilled") setStats(s.value); else setErr(String(s.reason?.message ?? s.reason))
    if (c.status === "fulfilled") setContent(c.value as CuratorStats)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const maxDay = stats ? Math.max(1, ...stats.per_day.map((d) => d.n)) : 1
  const maxType = stats ? Math.max(1, ...stats.top_types.map((t) => t.n)) : 1
  const funnelMax = stats ? Math.max(1, ...stats.funnel.map((f) => f.n)) : 1

  return (
    <div style={{ minHeight: "100dvh", background: "#fff", fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 20px 56px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: MUTE, textTransform: "uppercase" }}>CitySignal · Admin</div>
            <h1 style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: "-0.03em", margin: "6px 0 0" }}>Статистика</h1>
          </div>
          <button
            onClick={load}
            style={{ flexShrink: 0, border: `1px solid ${LINE}`, background: "#fff", borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontFamily: SANS, fontSize: 12.5, color: INK }}
          >
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        {err && (
          <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 12, color: "#c0392b" }}>
            Аналитика недоступна ({err})
          </div>
        )}
        {loading && !stats && !content && (
          <div style={{ marginTop: 24, fontFamily: MONO, fontSize: 12, color: MUTE }}>Загружаю…</div>
        )}

        {stats && (
          <>
            {/* stat grid — plain 2-col, hairline divided */}
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 28px", borderTop: `1px solid ${LINE}`, paddingTop: 22 }}>
              <Stat label="Пользователи (TG)" value={stats.users.total} sub={`24ч ${stats.users.d1} · 7д ${stats.users.d7}`} />
              <Stat label="Устройства" value={stats.users.devices} sub="вкл. веб" />
              <Stat label="Сессии · 24ч" value={stats.sessions_24h} />
              <Stat label="События · 24ч" value={stats.events.d1} sub={`7д ${stats.events.d7} · всего ${stats.events.total}`} />
            </div>
            {stats.errors_24h > 0 && (
              <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 12, color: "#c0392b" }}>Ошибок за 24ч: {stats.errors_24h}</div>
            )}

            {/* funnel */}
            <SectionTitle right="сессий · 7д">Воронка</SectionTitle>
            {stats.funnel.map((f) => <Bar key={f.step} label={f.step} n={f.n} max={funnelMax} />)}

            {/* per-day + top types — temporarily hidden per request
            <SectionTitle right="14 дней">События по дням</SectionTitle>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
              {stats.per_day.map((d) => {
                const h = Math.round((d.n / maxDay) * 64) + 2
                return <div key={d.day} title={`${d.day}: ${d.n}`} style={{ flex: 1, height: h, background: ACCENT, borderRadius: 2, opacity: 0.85 }} />
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: MONO, fontSize: 10.5, color: FAINT }}>
              <span>{stats.per_day[0]?.day?.slice(5) ?? ""}</span>
              <span>{stats.per_day[stats.per_day.length - 1]?.day?.slice(5) ?? ""}</span>
            </div>

            <SectionTitle right="7 дней">Топ событий</SectionTitle>
            {stats.top_types.slice(0, 10).map((t) => <Bar key={t.type} label={t.type} n={t.n} max={maxType} />)}
            */}
          </>
        )}

        {/* posts moderation browser */}
        <PostsPanel />

        {/* content */}
        {content && (
          <>
            <SectionTitle>Контент</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 28px" }}>
              <Stat label="Каналы" value={content.channels.total} sub={`активных ${content.channels.enabled}`} />
              <Stat label="Сырые посты" value={content.posts_raw} />
            </div>
            {Object.keys(content.events_by_status).length > 0 && (
              <div style={{ marginTop: 20 }}>
                {Object.entries(content.events_by_status).map(([st, n]) => (
                  <div key={st} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${LINE}` }}>
                    <span style={{ fontFamily: SANS, fontSize: 12.5, color: INK }}>{st}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
