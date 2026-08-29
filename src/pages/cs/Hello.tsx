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
 * Гейт стоит в router.tsx на /web (веб-лента): нет флага cs.reg.done → сюда,
 * после ввода/скипа — обратно в /web.
 *
 * Вёрстка — web-native (НЕ мобильная карточка): экран выведен из телефонной
 * рамки .cs-frame (см. isWebFullWidth в App.tsx), поэтому идёт во всю ширину.
 * Бренд сверху-слева, крупный hero-заголовок по центру, ввод — широкой
 * горизонтальной строкой (поле + кнопка), как строка поиска на /web. На узком
 * экране строка складывается в колонку.
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
    // preventScroll — иначе автофокус на низком вьюпорте утаскивает страницу
    // вниз (сверху проглядывал тёмный сурраунд #root).
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350)
    return () => clearTimeout(t)
  }, [])

  const finish = () => {
    try { localStorage.setItem(REG_DONE_KEY, "1") } catch { /* quota / private mode */ }
    navigate({ to: "/web" })
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
        position: "relative", width: "100%", minHeight: "100vh", boxSizing: "border-box",
        background: SK.paper,
        backgroundImage:
          "linear-gradient(#EAE9E4 1px, transparent 1px), linear-gradient(90deg, #EAE9E4 1px, transparent 1px)",
        backgroundSize: "30px 30px",
        fontFamily: FONT_SANS, color: SK.ink,
        display: "flex", flexDirection: "column",
      }}
    >
      <style>{`
        .hello-wrap { flex: 1; width: 100%; max-width: 1180px; margin: 0 auto; padding: 40px clamp(22px, 5vw, 72px) 48px; box-sizing: border-box; display: flex; flex-direction: column; }
        .hello-center { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        .hello-title { font-weight: 900; text-transform: uppercase; letter-spacing: -0.045em; line-height: 0.92; margin: 18px 0 clamp(22px, 3.2vw, 36px); font-size: clamp(48px, 8.4vw, 108px); }
        .hello-bar { display: flex; gap: 16px; align-items: stretch; width: 100%; max-width: 860px; }
        .hello-input { flex: 1 1 auto; min-width: 0; }
        .hello-go { flex: 0 0 auto; white-space: nowrap; }
        @media (max-width: 640px) {
          .hello-bar { flex-direction: column; gap: 12px; }
          .hello-go { width: 100%; }
          .hello-title { font-size: clamp(40px, 13vw, 64px); }
        }
      `}</style>

      <div className="hello-wrap">
        {/* ── Бренд сверху-слева ── */}
        <div style={{ display: "inline-flex", alignSelf: "flex-start", height: 44, border: `2px solid ${SK.ink}`, boxShadow: `3px 3px 0 ${SK.ink}` }}>
          <span style={{ display: "flex", alignItems: "center", padding: "0 15px", background: SK.ink, color: "#fff", fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", textTransform: "uppercase" }}>City</span>
          <span style={{ display: "flex", alignItems: "center", padding: "0 15px", background: SK.blue, color: "#fff", fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", textTransform: "uppercase" }}>Signal</span>
        </div>

        {/* ── Hero по центру ── */}
        <div className="hello-center">
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: "0.26em", textTransform: "uppercase", color: SK.ink55 }}>
            Афиша Москвы · знакомимся
          </div>
          <h1 className="hello-title" style={{ marginBottom: "clamp(26px, 3.4vw, 40px)" }}>
            Привет!<br />Как тебя <span style={{ color: SK.blue }}>называть?</span>
          </h1>

          {/* широкая строка ввода: поле + кнопка */}
          <div className="hello-bar">
            <input
              ref={inputRef}
              className="hello-input"
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => { if (e.key === "Enter") submit() }}
              placeholder="Имя"
              maxLength={MAX}
              autoComplete="given-name"
              style={{
                boxSizing: "border-box", height: 70, padding: "0 22px",
                fontFamily: FONT_SANS, fontSize: 22, fontWeight: 600, color: SK.ink,
                background: "#fff", border: `2.5px solid ${SK.ink}`, boxShadow: `5px 5px 0 ${SK.ink}`,
                outline: "none", borderRadius: 0,
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = `5px 5px 0 ${SK.blue}`; e.currentTarget.style.borderColor = SK.blue }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = `5px 5px 0 ${SK.ink}`; e.currentTarget.style.borderColor = SK.ink }}
            />
            <button
              className="hello-go"
              onClick={submit}
              disabled={!canGo}
              style={{
                boxSizing: "border-box", height: 70, padding: "0 clamp(24px, 3vw, 44px)",
                fontFamily: FONT_SANS, fontWeight: 800, fontSize: 18, letterSpacing: "0.02em", textTransform: "uppercase",
                color: "#fff", background: canGo ? SK.blue : SK.ink35,
                border: `2.5px solid ${SK.ink}`, boxShadow: canGo ? `5px 5px 0 ${SK.ink}` : "none",
                cursor: canGo ? "pointer" : "default", borderRadius: 0, transition: "background 0.12s, box-shadow 0.12s",
              }}
            >
              Продолжить →
            </button>
          </div>

          <button
            onClick={skip}
            style={{
              alignSelf: "flex-start", marginTop: 22, padding: "8px 0",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: FONT_MONO, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase",
              color: SK.ink55, textDecoration: "underline", textUnderlineOffset: 4,
            }}
          >
            Пропустить и сразу к афише
          </button>
        </div>
      </div>
    </div>
  )
}
