/**
 * CitySignal · «Голоса» — живая стена постов из авторских культур-каналов Москвы
 * (рецензии, вайбы, находки). Формат Pinterest/Insta: masonry из карточек с
 * картинками и текстовыми баблами, в брутал-скрапбук-стиле CitySignal. Тап по
 * карточке открывает исходный пост в Telegram. Данные — GET /wall (t.me/s-парсинг).
 */

import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { CS, SK, FONT_SANS, FONT_MONO, ScreenBG } from "./shared"
import { Curator, type WallPost } from "../../lib/curator"
import { analytics } from "../../lib/analytics"

function fmtWhen(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const day = 86400000
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(now) - startOf(d)) / day)
  if (diff <= 0) return "сегодня"
  if (diff === 1) return "вчера"
  if (diff < 7) return `${diff} дн. назад`
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
}

// хэши в стабильный акцент: у каждого канала свой цвет плашки-автора
const ACCENTS = ["#2D2A8C", "#0B7A3B", "#B5122A", "#8A5A00", "#5A2D8C", "#0E6E8C"]
function accentFor(ch: string): string {
  let h = 0
  for (let i = 0; i < ch.length; i++) h = (h * 31 + ch.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

function WallCard({ p, i }: { p: WallPost; i: number }) {
  const [broken, setBroken] = useState(false)
  const img = p.images[0]
  const hasImg = !!img && !broken
  const accent = accentFor(p.channel)
  const when = fmtWhen(p.date)
  const text = (p.text || "").replace(/\n{3,}/g, "\n\n").trim()
  const open = () => {
    analytics.track("cs.wall.open", { channel: p.channel, post: p.post })
    window.open(p.url, "_blank", "noopener")
  }
  // альтернируем цвет тени для скрапбук-ощущения
  const shadow = i % 3 === 0 ? CS.B : SK.ink
  return (
    <div
      onClick={open}
      style={{
        breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: 13,
        background: SK.paper, border: `2px solid ${SK.ink}`, boxShadow: `3px 4px 0 ${shadow}`,
        overflow: "hidden", cursor: "pointer", display: "block",
      } as React.CSSProperties}
    >
      {hasImg ? (
        <div style={{ position: "relative", lineHeight: 0, borderBottom: `2px solid ${SK.ink}`, background: "#E4E4E1" }}>
          <img src={img} alt="" loading="lazy" onError={() => setBroken(true)} style={{ width: "100%", height: "auto", display: "block", maxHeight: 460, objectFit: "cover" }} />
          {p.images.length > 1 && (
            <span style={{ position: "absolute", top: 8, right: 8, background: SK.ink, color: "#fff", fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", padding: "3px 7px", border: `1.5px solid ${SK.ink}` }}>{p.images.length} фото</span>
          )}
        </div>
      ) : (
        // текст-бабл: узкая акцентная полоса сверху + кавычка
        <div style={{ height: 6, background: accent }} />
      )}
      <div style={{ padding: hasImg ? "10px 12px 11px" : "12px 13px 13px" }}>
        {text && (
          <div style={{
            fontFamily: FONT_SANS, color: SK.ink, whiteSpace: "pre-wrap", overflow: "hidden",
            ...(hasImg
              ? { fontSize: 12.5, lineHeight: 1.42, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" as const }
              : { fontSize: 15, lineHeight: 1.4, fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 12, WebkitBoxOrient: "vertical" as const }),
          }}>{text}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 9 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, background: accent, flexShrink: 0, border: `1px solid ${SK.ink}` }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: SK.ink, letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.channel_title || "@" + p.channel}</span>
          </span>
          {when && <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "rgba(13,13,13,0.5)", flexShrink: 0 }}>{when}</span>}
        </div>
      </div>
    </div>
  )
}

export default function CsRecommendations() {
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = location.pathname.startsWith("/cs") ? "/cs/feed" : "/web"
  const [items, setItems] = useState<WallPost[] | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    analytics.track("cs.wall.shown")
    Curator.wall(160)
      .then((r) => setItems(r.items || []))
      .catch(() => setErr(true))
  }, [])

  const authors = useMemo(() => {
    const s = new Set((items || []).map((p) => p.channel))
    return s.size
  }, [items])

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: CS.W, color: SK.ink, fontFamily: FONT_SANS }}>
      <ScreenBG theme="grid" opacity={0.5} />
      <div style={{ position: "relative", maxWidth: 1160, margin: "0 auto", padding: "26px 16px 90px" }}>
        <button onClick={() => navigate({ to: backTo })} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `3px 3px 0 ${SK.ink}`, padding: "9px 15px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 800, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: SK.ink }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> к афише
        </button>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", margin: "22px 0 4px" }}>
          <h1 style={{ fontWeight: 900, fontSize: "clamp(34px, 10vw, 52px)", lineHeight: 0.92, letterSpacing: "-0.04em", textTransform: "uppercase", margin: 0 }}>Голоса</h1>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#fff", background: CS.B, border: `1.5px solid ${SK.ink}`, padding: "4px 8px", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 6 }}>живая лента</span>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "rgba(13,13,13,0.62)", letterSpacing: "0.02em", marginBottom: 22 }}>
          что пишут авторские каналы москвы — рецензии, вайбы, находки{items && authors ? ` · ${authors} автор.` : ""}
        </div>

        {items === null && !err && <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "70px 0", textAlign: "center" }}>собираем голоса…</div>}
        {err && <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "70px 0", textAlign: "center" }}>не удалось загрузить</div>}
        {items && items.length === 0 && <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "rgba(13,13,13,0.55)", padding: "70px 0", textAlign: "center" }}>пока тихо</div>}

        {items && items.length > 0 && (
          <div style={{ columnWidth: 172, columnGap: 13 } as React.CSSProperties}>
            {items.map((p, i) => <WallCard key={p.post} p={p} i={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}
