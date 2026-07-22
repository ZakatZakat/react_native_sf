/**
 * CitySignal · веб — страница события (не модалка).
 *
 *  В вебе клик по событию ведёт на отдельную страницу /web/event/$id, а не
 *  открывает нижний лист (модалка — мобильный паттерн). Десктоп-раскладка:
 *  крупный постер слева, детали справа (заголовок, дата/цена, бейджи доступа,
 *  место, описание, теги, «в профиль» + ссылка на источник в Telegram).
 *
 *  Данные берём из useDerived (тот же кэш, что у ленты). Роут: /web/event/$id
 */

import { useMemo } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { CS, SK, FONT_SANS, FONT_MONO, ScreenBG, GoingProvider, useGoing } from "./shared"
import type { Ev } from "./buildDerived"
import { useDerived } from "./useJourney"
import { accessBadges } from "./WebFeed"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: CS.W, color: SK.ink, fontFamily: FONT_SANS }}>
      <ScreenBG theme="grid" opacity={0.5} />
      <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "30px 32px 90px" }}>{children}</div>
    </div>
  )
}

function BackLink() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate({ to: "/web" })} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `3px 3px 0 ${SK.ink}`, padding: "9px 15px", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 800, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: SK.ink }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> к афише
    </button>
  )
}

function EventDetail({ ev }: { ev: Ev }) {
  const going = useGoing()
  const isOn = going.isGoing(ev)
  const ch = ev.ch.replace(/^@/, "")
  const tgUrl = ev.mid ? `https://t.me/${ch}/${ev.mid}` : (ch && ch !== "—" ? `https://t.me/${ch}` : null)
  const venue = ev.v && !ev.v.startsWith("@") ? ev.v : ""
  const priceStr = ev.price && ev.price !== "—" ? ev.price : ""
  const bd = accessBadges(ev)

  // описание: убираем первую строку, если это дубль заголовка (частый случай).
  // NB: нормализуем через \p{L}\p{N} с флагом u — ASCII-\W съедал бы кириллицу.
  const norm = (s: string) => (s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
  const lines = (ev.desc || "").split("\n")
  const first = norm(lines[0] || "")
  const titleKey = norm(ev.t || "").slice(0, 24)
  const bodyLines = first && titleKey && first.startsWith(titleKey.slice(0, 12)) ? lines.slice(1) : lines

  return (
    <Shell>
      <BackLink />
      <div style={{ display: "flex", gap: 36, marginTop: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* постер */}
        {ev.p && (
          <div style={{ flex: "0 0 auto", width: "min(440px, 100%)" }}>
            <div style={{ position: "relative", border: `2.5px solid ${SK.ink}`, boxShadow: `6px 6px 0 ${SK.ink}`, background: "#E4E4E1", lineHeight: 0 }}>
              <img src={ev.p} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
              <span style={{ position: "absolute", top: 11, left: 11, background: CS.B, color: "#fff", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 10px", border: `1.5px solid ${SK.ink}` }}>{ev.c}</span>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", padding: "8px 11px", background: SK.ink, color: "#fff", fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.06em" }}>
                <span>{ev.d} · {ev.tm}</span>{priceStr && <span>{priceStr}</span>}
              </div>
            </div>
          </div>
        )}

        {/* детали */}
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: "0.06em", color: SK.ink55 }}>{ev.d} · {ev.tm}{priceStr ? ` · ${priceStr}` : ""}</div>
          <h1 style={{ fontWeight: 900, fontSize: 40, lineHeight: 1.0, letterSpacing: "-0.03em", textTransform: "uppercase", margin: "12px 0 0", overflowWrap: "break-word" }}>{ev.t}</h1>

          {bd.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>{bd}</div>}

          {venue && (
            <div style={{ display: "flex", gap: 12, marginTop: 18, padding: "12px 15px", border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `3px 3px 0 ${CS.B}` }}>
              <span style={{ fontSize: 18, lineHeight: 1.1 }}>📍</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: CS.B }}>Место</div>
                <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.01em", marginTop: 3 }}>{venue}</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
            <button onClick={() => going.toggle(ev)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", border: `3px solid ${SK.ink}`, background: isOn ? SK.paper : SK.ink, color: isOn ? SK.ink : "#fff", boxShadow: isOn ? "none" : `4px 4px 0 ${CS.B}`, cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {isOn ? <>✓ в профиле</> : <>добавить в профиль <span style={{ fontSize: 18, lineHeight: 1 }}>→</span></>}
            </button>
            {tgUrl && (
              <a href={tgUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", border: `3px solid ${SK.ink}`, background: SK.paper, color: SK.ink, boxShadow: `4px 4px 0 ${SK.ink}`, textDecoration: "none", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                открыть в telegram <span style={{ fontSize: 15, lineHeight: 1 }}>↗</span>
              </a>
            )}
          </div>

          {ev.tags && ev.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
              {ev.tags.map((tg) => (
                <span key={tg} style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase", color: CS.B, background: "rgba(0,85,255,0.10)", border: "1px solid rgba(0,85,255,0.30)", padding: "4px 9px" }}>{tg}</span>
              ))}
            </div>
          )}

          <div style={{ height: 2, background: SK.ink, margin: "26px 0 18px" }} />
          <div style={{ fontSize: 16, lineHeight: 1.62, color: SK.ink, maxWidth: 680 }}>
            {bodyLines.map((line, i) => (line.trim() ? <p key={i} style={{ margin: "0 0 11px" }}>{line}</p> : <div key={i} style={{ height: 8 }} />))}
          </div>
        </div>
      </div>
    </Shell>
  )
}

export default function CsWebEvent() {
  const params = useParams({ strict: false }) as { id?: string }
  const { derived } = useDerived()
  const all = useMemo(() => Object.values(derived.pool).flat(), [derived])
  const ev = useMemo(() => all.find((e) => e.id === params.id), [all, params.id])

  if (!ev) {
    return (
      <Shell>
        <BackLink />
        <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: SK.ink55, letterSpacing: "0.04em", padding: "80px 0", textAlign: "center" }}>
          {all.length ? "событие не найдено" : "загружаем…"}
        </div>
      </Shell>
    )
  }
  return (
    <GoingProvider>
      <EventDetail ev={ev} />
    </GoingProvider>
  )
}
