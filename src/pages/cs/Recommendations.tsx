/**
 * CitySignal · «Рекомендации» — лента редакторских дайджестов из @napervom
 * («Первый ночной»). Дайджесты — статьи на Teletype («Выставки недели»,
 * «Тусовки недели»); карточка показывает обложку + заголовок + тизер и ведёт
 * на полную статью. Данные — GET /recommendations (кэш на бэке 15 мин).
 */

import { useEffect, useState } from "react"
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

function Card({ r }: { r: Recommendation }) {
  const [broken, setBroken] = useState(false)
  const open = () => {
    analytics.track("cs.reco.open", { message_id: r.message_id, url: r.digest_url })
    window.open(r.digest_url, "_blank", "noopener")
  }
  return (
    <div
      onClick={open}
      style={{ background: SK.paper, border: `2.5px solid ${SK.ink}`, boxShadow: `5px 6px 0 ${SK.ink}`, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}
    >
      {r.cover && !broken && (
        <div style={{ position: "relative", lineHeight: 0, borderBottom: `2.5px solid ${SK.ink}`, background: "#E4E4E1" }}>
          <img src={r.cover} alt="" onError={() => setBroken(true)} style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }} />
          <span style={{ position: "absolute", top: 10, left: 10, background: CS.B, color: "#fff", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 10px", border: `1.5px solid ${SK.ink}` }}>дайджест</span>
        </div>
      )}
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: CS.B }}>
          Первый ночной{r.published_at ? ` · ${fmtDate(r.published_at)}` : ""}
        </div>
        <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 20, lineHeight: 1.05, letterSpacing: "-0.02em", color: SK.ink }}>{r.title}</div>
        {r.teaser && (
          <div style={{ fontFamily: FONT_SANS, fontSize: 13.5, lineHeight: 1.5, color: "rgba(13,13,13,0.7)", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.teaser}</div>
        )}
        <div style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT_SANS, fontWeight: 900, fontSize: 13, letterSpacing: "0.03em", textTransform: "uppercase", color: SK.ink, paddingTop: 4 }}>
          читать подборку <span style={{ fontSize: 15, lineHeight: 1 }}>↗</span>
        </div>
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
    Curator.recommendations(24)
      .then((r) => setItems(r.items || []))
      .catch(() => setErr(true))
  }, [])

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: CS.W, color: SK.ink, fontFamily: FONT_SANS }}>
      <ScreenBG theme="grid" opacity={0.5} />
      <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "26px 20px 90px" }}>
        <button onClick={() => navigate({ to: "/web" })} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `3px 3px 0 ${SK.ink}`, padding: "9px 15px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 800, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: SK.ink }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> к афише
        </button>

        <h1 style={{ fontWeight: 900, fontSize: 40, lineHeight: 1.0, letterSpacing: "-0.03em", textTransform: "uppercase", margin: "22px 0 4px" }}>Рекомендации</h1>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "rgba(13,13,13,0.6)", letterSpacing: "0.03em", marginBottom: 22 }}>
          Дайджесты недели от «Первого ночного» — выставки и тусовки Москвы
        </div>

        {items === null && !err && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "60px 0", textAlign: "center" }}>загружаем…</div>
        )}
        {err && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "60px 0", textAlign: "center" }}>не удалось загрузить рекомендации</div>
        )}
        {items && items.length === 0 && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "60px 0", textAlign: "center" }}>пока нет дайджестов</div>
        )}
        {items && items.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {items.map((r) => <Card key={r.id} r={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}
