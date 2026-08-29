/**
 * CitySignal · Быстрая рега (веб).
 *
 * Веб-версия открывается без Telegram-identity → юзер аноним, в профиле «Гость».
 * Здесь один раз спрашиваем, как обращаться: имя пишется в существующий
 * cs.journey.name → displayName (профиль перестаёт быть «Гость»). Показывается
 * ТОЛЬКО вне Telegram (в мини-аппе имя берём из аккаунта) и один раз (флаг
 * cs.reg.done). Скиппабельно.
 *
 * Воронка логируется: cs.reg.shown (показан) / cs.reg.submit (ввёл, имя в data) /
 * cs.reg.skip (пропустил) — чтобы понять, сколько веб-заходов доходит до реги.
 * Гейт стоит в router.tsx (root «/»): веб + нет имени + нет флага → сюда.
 */
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SK, FONT_SANS, FONT_MONO } from "./shared"
import { useJourneyState } from "./useJourney"
import { analytics } from "../../lib/analytics"

export const REG_DONE_KEY = "cs.reg.done"
const MAX = 32

export default function CsHello() {
  const navigate = useNavigate()
  const { setName } = useJourneyState()
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    analytics.track("cs.reg.shown")
    const t = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [])

  const finish = () => {
    try { localStorage.setItem(REG_DONE_KEY, "1") } catch { /* quota / private mode */ }
    navigate({ to: "/cs/feed" })
  }
  const submit = () => {
    if (doneRef.current) return
    const n = value.trim().slice(0, MAX)
    if (!n) { inputRef.current?.focus(); return }
    doneRef.current = true
    setName(n)
    analytics.track("cs.reg.submit", { len: n.length }, { data: n })
    finish()
  }
  const skip = () => {
    if (doneRef.current) return
    doneRef.current = true
    analytics.track("cs.reg.skip")
    finish()
  }

  const canGo = value.trim().length > 0

  return (
    <div
      style={{
        position: "fixed", inset: 0, overflow: "auto",
        background: SK.paper,
        backgroundImage:
          "linear-gradient(#EAE9E4 1px, transparent 1px), linear-gradient(90deg, #EAE9E4 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        fontFamily: FONT_SANS, color: SK.ink,
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "32px 26px",
      }}
    >
      <div style={{ maxWidth: 460, width: "100%", margin: "0 auto" }}>
        {/* Лого-локап */}
        <div style={{ display: "inline-flex", height: 40, border: `2px solid ${SK.ink}`, boxShadow: `3px 3px 0 ${SK.ink}`, marginBottom: 30 }}>
          <span style={{ display: "flex", alignItems: "center", padding: "0 13px", background: SK.ink, color: "#fff", fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", textTransform: "uppercase" }}>City</span>
          <span style={{ display: "flex", alignItems: "center", padding: "0 13px", background: SK.blue, color: "#fff", fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", textTransform: "uppercase" }}>Signal</span>
        </div>

        <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.22em", textTransform: "uppercase", color: SK.ink55, marginBottom: 12 }}>
          Афиша Москвы · знакомимся
        </div>
        <h1 style={{ fontWeight: 900, fontSize: "clamp(30px, 8vw, 42px)", lineHeight: 1.02, letterSpacing: "-0.035em", margin: "0 0 10px", textTransform: "uppercase" }}>
          Привет!<br />Как тебя <span style={{ color: SK.blue }}>называть?</span>
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: SK.ink55, margin: "0 0 24px", maxWidth: 380 }}>
          Чтобы обращаться по-человечески. Одно поле — и сразу к афише. Можно пропустить.
        </p>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => { if (e.key === "Enter") submit() }}
          placeholder="Имя"
          maxLength={MAX}
          autoComplete="given-name"
          style={{
            width: "100%", boxSizing: "border-box", height: 56, padding: "0 16px",
            fontFamily: FONT_SANS, fontSize: 19, fontWeight: 600, color: SK.ink,
            background: "#fff", border: `2.5px solid ${SK.ink}`, boxShadow: `4px 4px 0 ${SK.ink}`,
            outline: "none", borderRadius: 0,
          }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = `4px 4px 0 ${SK.blue}`; e.currentTarget.style.borderColor = SK.blue }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = `4px 4px 0 ${SK.ink}`; e.currentTarget.style.borderColor = SK.ink }}
        />

        <button
          onClick={submit}
          disabled={!canGo}
          style={{
            width: "100%", boxSizing: "border-box", height: 56, marginTop: 18,
            fontFamily: FONT_SANS, fontWeight: 800, fontSize: 17, letterSpacing: "0.01em", textTransform: "uppercase",
            color: "#fff", background: canGo ? SK.blue : SK.ink35,
            border: `2.5px solid ${SK.ink}`, boxShadow: canGo ? `4px 4px 0 ${SK.ink}` : "none",
            cursor: canGo ? "pointer" : "default", borderRadius: 0, transition: "background 0.12s, box-shadow 0.12s",
          }}
        >
          Продолжить
        </button>

        <button
          onClick={skip}
          style={{
            display: "block", margin: "18px auto 0", padding: "8px 12px",
            background: "none", border: "none", cursor: "pointer",
            fontFamily: FONT_MONO, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
            color: SK.ink55, textDecoration: "underline", textUnderlineOffset: 3,
          }}
        >
          Пропустить
        </button>
      </div>
    </div>
  )
}
