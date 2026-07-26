/**
 * CitySignal · /cs/pulse — приватная аналитика владельца («секретная» страница).
 *
 *  Активность пользователей / дней / действий из analytics-platform. Доступ —
 *  только владелец: внутри Telegram по подписанному initData, из браузера по
 *  секретной закладке ?k=<секрет>. Реальный гейт на бэке (require_owner);
 *  здесь при 401/403 просто показываем «нет доступа».
 *
 *  Не входит в основной journey, ниоткуда не линкуется (кроме скрытой строки
 *  в профиле, видимой только владельцу).
 */

import { useEffect, useMemo, useState } from "react"
import { CS, FONT_MONO, FONT_SANS } from "./shared"
import { Curator, type Insights, type InsightsUser } from "../../lib/curator"

const INK = CS.K
const PAPER = CS.W
const BLUE = CS.B
const MUTE = CS.G55
const FAINT = CS.G35
const HAIR = CS.G18

// cs.* действия → человекочитаемые ярлыки (для «топ действий»).
const ACTION_LABEL: Record<string, string> = {
  "cs.landing.enter": "Заходы на лендинг",
  "cs.pass.continue": "Прошли вход",
  "cs.swipe.card.like": "Лайки в свайпах",
  "cs.swipe.card.skip": "Скипы в свайпах",
  "cs.swipe.deck.complete": "Прошли свайпы",
  "cs.summary.enter_feed": "Вошли в ленту",
  "cs.week.view": "Смотрели «Неделю»",
  "cs.week.continue": "«Неделя» → далее",
  "cs.feed.filter": "Фильтры ленты",
  "cs.event.open": "Открытия события",
  "cs.event.going": "Отметки «пойду»",
  "cs.event.remind": "Напоминания",
  "cs.event.tg_channel": "Открытия канала",
  "cs.event.tg_post": "Открытия поста",
  "cs.name.submit": "Ввод имени",
  "cs.admin.week_pick": "Правки «выбора недели»",
  "cs.admin.week_clear": "Сброс «выбора недели»",
}

function readKey(): string {
  try { return new URLSearchParams(window.location.search).get("k") || "" } catch { return "" }
}

function fmtDay(iso: string): { d: string; wd: string; weekend: boolean } {
  const dt = new Date(iso + "T00:00:00")
  const wd = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][dt.getDay()]
  return { d: String(dt.getDate()), wd, weekend: dt.getDay() === 0 || dt.getDay() === 6 }
}

function relTime(iso: string | null): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (mins < 60) return `${mins}м`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}ч`
  const d = Math.round(h / 24)
  if (d < 31) return `${d}д`
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
}

function userLabel(u: InsightsUser): string {
  if (u.username) return `@${u.username}`
  if (u.name) return u.name
  return `id ${u.user_id}`
}

/* ── мелкие строительные блоки ─────────────────────────────────────── */

function Kpi({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div style={{ border: `2px solid ${INK}`, background: PAPER, padding: "12px 14px 13px", minWidth: 0 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 30, letterSpacing: "-0.04em", lineHeight: 1.05, color: accent ? BLUE : INK, marginTop: 5 }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: FAINT, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "-0.01em", textTransform: "uppercase", color: INK }}>{title}</div>
        {right && <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: FAINT }}>{right}</div>}
      </div>
      {children}
    </div>
  )
}

function HBar({ label, n, max, accent }: { label: string; n: number; max: number; accent?: boolean }) {
  const pct = max > 0 ? Math.round((n / max) * 100) : 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
      <span style={{ width: 150, flexShrink: 0, fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 14, border: `1.5px solid ${INK}`, background: PAPER, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: accent ? BLUE : INK }} />
      </div>
      <span style={{ width: 46, flexShrink: 0, textAlign: "right", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12.5, color: INK }}>{n}</span>
    </div>
  )
}

/** Двойной столбчатый ряд «по дням»: синие — события, чёрные тонкие — уник. пользователи. */
function DayChart({ per_day }: { per_day: Insights["per_day"] }) {
  const maxE = Math.max(1, ...per_day.map((d) => d.events))
  const maxU = Math.max(1, ...per_day.map((d) => d.users))
  return (
    <div style={{ border: `2px solid ${INK}`, background: PAPER, padding: "16px 14px 10px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
        {per_day.map((d) => {
          const { weekend } = fmtDay(d.day)
          const he = Math.round((d.events / maxE) * 108) + 2
          const hu = Math.round((d.users / maxU) * 108) + 1
          return (
            <div key={d.day} title={`${d.day}: ${d.events} событий · ${d.users} польз. · ${d.sessions} сессий`} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative" }}>
              {/* события (синий) */}
              <div style={{ width: "100%", maxWidth: 22, height: he, background: weekend ? "rgba(0,85,255,0.55)" : BLUE }} />
              {/* уник. пользователи (чёрная тонкая накладка) */}
              <div style={{ position: "absolute", bottom: 0, width: "100%", maxWidth: 22, height: hu, borderTop: `2px solid ${INK}`, pointerEvents: "none" }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
        {per_day.map((d, i) => {
          const { d: dd, wd } = fmtDay(d.day)
          const show = per_day.length <= 31 ? (i % Math.ceil(per_day.length / 15) === 0) : (i % 3 === 0)
          return (
            <div key={d.day} style={{ flex: 1, minWidth: 0, textAlign: "center", fontFamily: FONT_MONO, fontSize: 9, color: FAINT, whiteSpace: "nowrap" }}>
              {show ? `${dd}` : ""}
              {show && <div style={{ fontSize: 8, color: HAIR }}>{wd}</div>}
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontFamily: FONT_MONO, fontSize: 10.5, color: MUTE }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: BLUE, marginRight: 5, verticalAlign: "-1px" }} />события</span>
        <span><span style={{ display: "inline-block", width: 10, height: 0, borderTop: `2px solid ${INK}`, marginRight: 5, verticalAlign: "3px" }} />уник. пользователей</span>
      </div>
    </div>
  )
}

function HourChart({ by_hour }: { by_hour: number[] }) {
  const max = Math.max(1, ...by_hour)
  return (
    <div style={{ border: `2px solid ${INK}`, background: PAPER, padding: "14px 14px 8px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
        {by_hour.map((n, h) => (
          <div key={h} title={`${h}:00 — ${n}`} style={{ flex: 1, height: Math.round((n / max) * 54) + 2, background: h >= 7 && h < 23 ? INK : FAINT }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontFamily: FONT_MONO, fontSize: 9.5, color: FAINT }}>
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  )
}

function UsersTable({ users }: { users: InsightsUser[] }) {
  const [by, setBy] = useState<"last" | "events" | "rsvps">("events")
  const sorted = useMemo(() => {
    const c = [...users]
    if (by === "events") c.sort((a, b) => b.events - a.events)
    else if (by === "rsvps") c.sort((a, b) => b.rsvps - a.rsvps || b.events - a.events)
    else c.sort((a, b) => (new Date(b.last_seen || 0).getTime()) - (new Date(a.last_seen || 0).getTime()))
    return c
  }, [users, by])
  const maxE = Math.max(1, ...users.map((u) => u.events))
  const Th = ({ id, children }: { id: "last" | "events" | "rsvps"; children: React.ReactNode }) => (
    <button onClick={() => setBy(id)} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: by === id ? BLUE : MUTE, padding: 0 }}>{children}{by === id ? " ↓" : ""}</button>
  )
  return (
    <div style={{ border: `2px solid ${INK}`, background: PAPER }}>
      {/* header row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 58px 54px 54px 56px", gap: 8, padding: "10px 13px", borderBottom: `2px solid ${INK}`, alignItems: "center" }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTE }}>Пользователь</span>
        <span style={{ textAlign: "right" }}><Th id="events">Событий</Th></span>
        <span style={{ textAlign: "right", fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTE }}>Открыл</span>
        <span style={{ textAlign: "right" }}><Th id="rsvps">Пойду</Th></span>
        <span style={{ textAlign: "right" }}><Th id="last">Был</Th></span>
      </div>
      {sorted.map((u, i) => {
        const pct = Math.round((u.events / maxE) * 100)
        return (
          <div key={u.user_id} style={{ display: "grid", gridTemplateColumns: "1fr 58px 54px 54px 56px", gap: 8, padding: "11px 13px", borderTop: i === 0 ? "none" : `1px solid ${HAIR}`, alignItems: "center", position: "relative" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT_SANS, fontSize: 13.5, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userLabel(u)}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: FAINT, marginTop: 2 }}>
                {u.sessions} сес. · {u.platform === "web" ? "веб" : "tg"}{u.name && u.username ? ` · ${u.name}` : ""}
              </div>
              {/* тонкая полоса активности под именем */}
              <div style={{ height: 3, background: HAIR, marginTop: 5, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: BLUE }} />
              </div>
            </div>
            <span style={{ textAlign: "right", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: INK }}>{u.events}</span>
            <span style={{ textAlign: "right", fontFamily: FONT_MONO, fontSize: 13, color: MUTE }}>{u.opens}</span>
            <span style={{ textAlign: "right", fontFamily: FONT_MONO, fontWeight: u.rsvps ? 700 : 400, fontSize: 13, color: u.rsvps ? BLUE : FAINT }}>{u.rsvps}</span>
            <span style={{ textAlign: "right", fontFamily: FONT_MONO, fontSize: 12, color: MUTE }}>{relTime(u.last_seen)}</span>
          </div>
        )
      })}
      {users.length === 0 && <div style={{ padding: "16px 13px", fontFamily: FONT_MONO, fontSize: 12, color: MUTE }}>Пока нет пользователей с TG-профилем.</div>}
    </div>
  )
}

/* ── страница ──────────────────────────────────────────────────────── */

export default function CsPulse() {
  const [data, setData] = useState<Insights | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const k = useMemo(readKey, [])

  const load = async () => {
    setLoading(true); setErr(null)
    try {
      setData(await Curator.getInsights(k || undefined))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() /* eslint-disable-next-line */ }, [])

  const denied = err && /\b(401|403)\b/.test(err)

  const funnelSteps = data ? [
    { label: "Всего людей", n: data.funnel.reach },
    { label: "Лендинг", n: data.funnel.landing },
    { label: "«Неделя»", n: data.funnel.week },
    { label: "Лента", n: data.funnel.feed },
    { label: "Открыл событие", n: data.funnel.opened },
    { label: "Отметил «пойду»", n: data.funnel.going },
  ] : []
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.n))
  const actions = (data?.actions || []).filter((a) => ACTION_LABEL[a.type]).slice(0, 12)
  const actMax = Math.max(1, ...actions.map((a) => a.n))
  const rangeLabel = data?.range.first && data.range.last
    ? `${new Date(data.range.first).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })} — ${new Date(data.range.last).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}`
    : ""

  return (
    <div style={{ minHeight: "100dvh", background: CS.PAGE, color: INK, fontFamily: FONT_SANS }}>
      <div style={{ maxWidth: "min(920px, 96vw)", margin: "0 auto", padding: "30px 18px 70px" }}>
        {/* шапка */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTE }}>CitySignal · приватно</div>
            <h1 style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 34, letterSpacing: "-0.04em", textTransform: "uppercase", margin: "6px 0 0" }}>Пульс</h1>
            {rangeLabel && <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: FAINT, marginTop: 4 }}>{rangeLabel}</div>}
          </div>
          <button onClick={load} disabled={loading} style={{ border: `2px solid ${INK}`, background: PAPER, boxShadow: `3px 3px 0 ${INK}`, padding: "9px 16px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 800, fontSize: 12.5, letterSpacing: "0.05em", textTransform: "uppercase", color: INK }}>
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        {denied && (
          <div style={{ marginTop: 40, border: `2px solid ${INK}`, background: PAPER, padding: "22px 20px", fontFamily: FONT_MONO, fontSize: 13, lineHeight: 1.6, color: INK }}>
            Нет доступа. Эта страница — только для владельца: откройте её внутри
            Telegram-аккаунта владельца или добавьте секретную ссылку с <code>?k=…</code>.
          </div>
        )}
        {err && !denied && (
          <div style={{ marginTop: 30, fontFamily: FONT_MONO, fontSize: 12.5, color: "#C0392B" }}>Не загрузилось: {err}</div>
        )}
        {loading && !data && !err && (
          <div style={{ marginTop: 40, fontFamily: FONT_MONO, fontSize: 13, color: MUTE }}>Загружаю…</div>
        )}

        {data && (
          <>
            {/* KPI-сетка */}
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <Kpi label="Событий всего" value={data.totals.events.toLocaleString("ru-RU")} sub={`${data.totals.sessions} сессий`} />
              <Kpi label="Пользователи TG" value={data.totals.tg_users} sub={`${data.totals.devices} устройств`} accent />
              <Kpi label="Активны · 24ч" value={data.active.dau} sub={`7д ${data.active.wau} · 30д ${data.active.mau}`} />
              <Kpi label="Отметок «пойду»" value={data.totals.rsvps} accent />
              <Kpi label="Ошибок" value={data.totals.errors} />
            </div>

            <Section title="По дням" right={`${data.per_day.length} дней · МСК`}>
              <DayChart per_day={data.per_day} />
            </Section>

            <Section title="По пользователям" right={`${data.users.length} с TG-профилем`}>
              <UsersTable users={data.users} />
            </Section>

            <Section title="Воронка" right="уник. людей">
              {funnelSteps.map((s) => <HBar key={s.label} label={s.label} n={s.n} max={funnelMax} accent={s.label === 'Отметил «пойду»'} />)}
            </Section>

            <Section title="Топ действий" right="за всё время">
              {actions.map((a) => <HBar key={a.type} label={ACTION_LABEL[a.type] || a.type} n={a.n} max={actMax} />)}
            </Section>

            <Section title="По часам" right="активность · МСК">
              <HourChart by_hour={data.by_hour} />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
