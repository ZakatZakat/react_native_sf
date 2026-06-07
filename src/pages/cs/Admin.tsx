/**
 * CitySignal · Админ-панель (/admin).
 *
 *  Brutalist dashboard combining two data sources:
 *   - analytics-platform (GET /api/v1/stats) — engagement: users, sessions,
 *     events, funnel, per-day series, top event types.
 *   - curator (GET /admin/stats) — content: channels, raw posts, events by
 *     moderation status.
 *
 *  Reached by direct URL only (not in the journey). No auth beyond the
 *  analytics JWT baked into the build + curator dev-mode — fine for an
 *  internal panel; tighten later if it goes public.
 */

import { useEffect, useState } from "react"
import { CsPage, CS, FONT_MONO, FONT_SANS, Mark, Mono } from "./shared"
import { analytics, type AdminStats } from "../../lib/analytics"
import { CURATOR_BASE } from "../../lib/curator"

const K = CS.K, W = CS.W, B = CS.B, G55 = CS.G55, G35 = CS.G35

type CuratorStats = {
  channels: { total: number; enabled: number }
  posts_raw: number
  events_by_status: Record<string, number>
}

// ── atoms ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = false }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div style={{ border: `2.5px solid ${K}`, background: accent ? B : W, color: accent ? W : K, padding: "12px 13px 13px", boxShadow: `3px 3px 0 ${K}` }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: accent ? "rgba(255,255,255,0.75)" : G55 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: accent ? "rgba(255,255,255,0.7)" : G55, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `2px solid ${K}`, paddingBottom: 7, marginBottom: 12 }}>
        <Mark>{title}</Mark>
        {right != null && <Mono color={G55}>{right}</Mono>}
      </div>
      {children}
    </div>
  )
}

function BarRow({ label, n, max, accent = false }: { label: string; n: number; max: number; accent?: boolean }) {
  const pct = max > 0 ? Math.round((n / max) * 100) : 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ width: 92, flexShrink: 0, fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "-0.01em", color: K, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 14, background: "rgba(13,13,13,0.06)", border: `1.5px solid ${K}`, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: accent ? B : K }} />
      </div>
      <span style={{ width: 36, flexShrink: 0, textAlign: "right", fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: K }}>{n}</span>
    </div>
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
    <CsPage>
      <div style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", padding: "44px 16px 40px", fontFamily: FONT_SANS, color: K }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: `2px solid ${K}`, paddingBottom: 10 }}>
          <div>
            <Mark color={G55}>CitySignal · Admin</Mark>
            <div style={{ fontWeight: 900, fontSize: 32, letterSpacing: "-0.045em", lineHeight: 0.9, marginTop: 5 }}>Статистика</div>
          </div>
          <button onClick={load} style={{ flexShrink: 0, border: `2px solid ${K}`, background: W, padding: "8px 12px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", boxShadow: `2.5px 2.5px 0 ${B}` }}>
            {loading ? "…" : "↻ Обновить"}
          </button>
        </div>

        {err && (
          <div style={{ marginTop: 16, border: `2px solid ${CS.K}`, background: "#FDECEC", padding: "10px 12px", fontFamily: FONT_MONO, fontSize: 11, color: "#B00" }}>
            Аналитика недоступна: {err}
          </div>
        )}

        {loading && !stats && (
          <div style={{ marginTop: 24, fontFamily: FONT_MONO, fontSize: 12, color: G55 }}>Загружаю…</div>
        )}

        {stats && (
          <>
            {/* top stat grid */}
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatCard label="Пользователей (TG)" value={stats.users.total} sub={`за 24ч: ${stats.users.d1} · 7д: ${stats.users.d7}`} accent />
              <StatCard label="Устройств всего" value={stats.users.devices} sub="вкл. веб-визиты" />
              <StatCard label="Сессий за 24ч" value={stats.sessions_24h} />
              <StatCard label="Событий за 24ч" value={stats.events.d1} sub={`7д: ${stats.events.d7} · всего: ${stats.events.total}`} />
            </div>
            {stats.errors_24h > 0 && (
              <div style={{ marginTop: 10 }}>
                <StatCard label="Ошибок за 24ч" value={stats.errors_24h} />
              </div>
            )}

            {/* funnel */}
            <Section title="Воронка · 7 дней" right="сессий на шаге">
              {stats.funnel.map((f) => <BarRow key={f.step} label={f.step} n={f.n} max={funnelMax} accent />)}
            </Section>

            {/* per-day */}
            <Section title="События по дням" right="14 дней">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90, borderBottom: `2px solid ${K}`, paddingBottom: 2 }}>
                {stats.per_day.map((d) => {
                  const h = Math.round((d.n / maxDay) * 84) + 2
                  return (
                    <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }} title={`${d.day}: ${d.n}`}>
                      <div style={{ width: "100%", height: h, background: B, border: `1px solid ${K}` }} />
                    </div>
                  )
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <Mono color={G35}>{stats.per_day[0]?.day?.slice(5) ?? ""}</Mono>
                <Mono color={G35}>{stats.per_day[stats.per_day.length - 1]?.day?.slice(5) ?? ""}</Mono>
              </div>
            </Section>

            {/* top types */}
            <Section title="Топ событий" right="7 дней">
              {stats.top_types.slice(0, 10).map((t) => <BarRow key={t.type} label={t.type} n={t.n} max={maxType} />)}
            </Section>
          </>
        )}

        {/* content stats from curator */}
        {content && (
          <Section title="Контент · Curator">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatCard label="Каналов" value={content.channels.total} sub={`активных: ${content.channels.enabled}`} />
              <StatCard label="Сырых постов" value={content.posts_raw} />
            </div>
            {Object.keys(content.events_by_status).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Mono color={G55} style={{ display: "block", marginBottom: 8 }}>События по статусу</Mono>
                {Object.entries(content.events_by_status).map(([st, n]) => (
                  <div key={st} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px dotted ${G35}` }}>
                    <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>{st}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: B }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Mono color={G35}>CitySignal · аналитика обновляется в реальном времени</Mono>
        </div>
      </div>
    </CsPage>
  )
}
