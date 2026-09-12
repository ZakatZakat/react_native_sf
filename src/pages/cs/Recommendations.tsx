/**
 * CitySignal · «Рекомендации» — ивенты, вытащенные из редакторских дайджестов
 * @napervom («Первый ночной», статьи на Teletype). Каждый ивент — карточка
 * (обложка/категория + название + площадка + дата + описание), сгруппированы по
 * подборке («Выставки недели», «Тусовки недели»). Ссылка ведёт на статью-источник.
 * Данные — GET /recommendations.
 */

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CS, SK, FONT_SANS, FONT_MONO, ScreenBG } from "./shared"
import { Curator, type Recommendation } from "../../lib/curator"
import { analytics } from "../../lib/analytics"

function fmtDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
}

function EventCard({ r }: { r: Recommendation }) {
  const [broken, setBroken] = useState(false)
  const open = () => {
    analytics.track("cs.reco.open", { title: r.title, url: r.digest_url })
    window.open(r.digest_url, "_blank", "noopener")
  }
  const when = r.date_text || fmtDate(r.event_time)
  return (
    <div onClick={open} style={{ background: SK.paper, border: `2.5px solid ${SK.ink}`, boxShadow: `5px 6px 0 ${SK.ink}`, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      {r.cover && !broken ? (
        <div style={{ position: "relative", lineHeight: 0, borderBottom: `2.5px solid ${SK.ink}`, background: "#E4E4E1" }}>
          <img src={r.cover} alt="" onError={() => setBroken(true)} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
          {r.category && <span style={{ position: "absolute", top: 10, left: 10, background: CS.B, color: "#fff", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 10px", border: `1.5px solid ${SK.ink}` }}>{r.category}</span>}
        </div>
      ) : (
        <div style={{ background: SK.ink, color: "#fff", padding: "10px 14px", borderBottom: `2.5px solid ${SK.ink}` }}>
          <span style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", background: CS.B, padding: "3px 8px" }}>{r.category || "событие"}</span>
        </div>
      )}
      <div style={{ padding: "13px 15px 15px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 17, lineHeight: 1.06, letterSpacing: "-0.02em", color: SK.ink }}>{r.title}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.02em", color: CS.B, fontWeight: 700 }}>
          {[r.venue, when].filter(Boolean).join(" · ")}
        </div>
        {r.description && (
          <div style={{ fontFamily: FONT_SANS, fontSize: 12.5, lineHeight: 1.45, color: "rgba(13,13,13,0.68)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.description}</div>
        )}
      </div>
    </div>
  )
}

export default function CsRecommendations() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Recommendation[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    analytics.track("cs.reco.shown")
    Curator.recommendations(80)
      .then((r) => setItems(r.items || []))
      .catch(() => setErr(true))
  }, [])

  // группировка по подборке (сохраняя порядок — свежие дайджесты сверху)
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; url: string; items: Recommendation[] }>()
    for (const it of items || []) {
      const key = it.digest_url
      if (!map.has(key)) map.set(key, { title: it.digest_title || "Подборка", url: it.digest_url, items: [] })
      map.get(key)!.items.push(it)
    }
    return Array.from(map.values())
  }, [items])

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: CS.W, color: SK.ink, fontFamily: FONT_SANS }}>
      <ScreenBG theme="grid" opacity={0.5} />
      <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "26px 20px 90px" }}>
        <button onClick={() => navigate({ to: "/web" })} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `3px 3px 0 ${SK.ink}`, padding: "9px 15px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 800, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: SK.ink }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> к афише
        </button>

        <h1 style={{ fontWeight: 900, fontSize: 40, lineHeight: 1.0, letterSpacing: "-0.03em", textTransform: "uppercase", margin: "22px 0 4px" }}>Рекомендации</h1>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "rgba(13,13,13,0.6)", letterSpacing: "0.03em", marginBottom: 26 }}>
          Выбор редакции «Первого ночного» — выставки и тусовки недели
        </div>

        {items === null && !err && <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "60px 0", textAlign: "center" }}>загружаем…</div>}
        {err && <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "60px 0", textAlign: "center" }}>не удалось загрузить</div>}
        {items && items.length === 0 && <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "60px 0", textAlign: "center" }}>пока пусто</div>}

        {groups.map((g) => (
          <div key={g.url} style={{ marginBottom: 34 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, borderBottom: `2.5px solid ${SK.ink}`, paddingBottom: 8, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.02em", margin: 0 }}>{g.title}</h2>
              <a href={g.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CS.B, textDecoration: "none" }}>вся подборка ↗</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {g.items.map((r) => <EventCard key={r.id} r={r} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
