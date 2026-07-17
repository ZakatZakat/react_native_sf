/**
 * Пожелания / фидбэк — кнопка + форма. Свободный текст улетает в
 * POST /me/feedback-note, привязывается к Telegram-id пользователя (в БД
 * curator.feedback_notes), так что редактор потом видит, кто что написал.
 */

import { useState } from "react"
import { CS, FONT_MONO, FONT_SANS } from "./shared"
import { Curator } from "../../lib/curator"
import { tgUserName } from "../../lib/telegram"

type SendState = "idle" | "sending" | "done" | "error"

export function FeedbackButton({ style }: { style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [state, setState] = useState<SendState>("idle")

  const close = () => { setOpen(false); setTimeout(() => { setText(""); setState("idle") }, 250) }

  const send = async () => {
    const t = text.trim()
    if (!t || state === "sending") return
    setState("sending")
    try {
      await Curator.sendFeedbackNote(t, tgUserName() || undefined)
      setState("done")
      setTimeout(close, 1400)
    } catch {
      setState("error")
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 13,
          letterSpacing: "0.05em", textTransform: "uppercase",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
          padding: "12px 16px", border: `3px solid ${CS.K}`,
          background: CS.W, color: CS.K, cursor: "pointer",
          boxShadow: `3px 3px 0 ${CS.K}`, ...style,
        }}
      >
        <span>Оставить пожелание</span><span style={{ fontSize: 15, lineHeight: 1 }}>✍️</span>
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 11000, background: "rgba(13,13,13,0.5)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 520, background: CS.W, color: CS.K,
              borderTop: `3px solid ${CS.K}`, padding: "18px 18px calc(env(safe-area-inset-bottom,0px) + 20px)",
              fontFamily: FONT_SANS,
              animation: "cs-fb-up 0.28s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <style>{"@keyframes cs-fb-up{from{transform:translateY(101%)}to{transform:translateY(0)}}"}</style>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", textTransform: "uppercase" }}>Пожелание</div>
              <button onClick={close} aria-label="Закрыть" style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, fontWeight: 900, color: CS.K, lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {state === "done" ? (
              <div style={{ padding: "26px 0 20px", textAlign: "center" }}>
                <div style={{ fontSize: 34 }}>🙌</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 8 }}>Спасибо! Записали.</div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: CS.G55, letterSpacing: "0.04em", marginBottom: 10, lineHeight: 1.5 }}>
                  Что улучшить, чего не хватает, что понравилось — пиши как есть.
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Твоё пожелание…"
                  rows={5}
                  autoFocus
                  maxLength={2000}
                  style={{
                    width: "100%", resize: "vertical", boxSizing: "border-box",
                    border: `2px solid ${CS.K}`, background: CS.W, color: CS.K,
                    padding: "11px 12px", fontFamily: FONT_SANS, fontSize: 15, lineHeight: 1.4,
                    outline: "none",
                  }}
                />
                {state === "error" && (
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#D6142A", marginTop: 8 }}>Не отправилось — попробуй ещё раз.</div>
                )}
                <button
                  onClick={send}
                  disabled={!text.trim() || state === "sending"}
                  style={{
                    width: "100%", marginTop: 14, padding: "14px 16px", border: "none",
                    cursor: (!text.trim() || state === "sending") ? "default" : "pointer",
                    background: (!text.trim() || state === "sending") ? "rgba(13,13,13,0.2)" : CS.B, color: CS.W,
                    fontFamily: FONT_SANS, fontWeight: 900, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase",
                    boxShadow: (!text.trim() || state === "sending") ? "none" : `4px 4px 0 ${CS.K}`,
                  }}
                >
                  {state === "sending" ? "Отправляю…" : "Отправить →"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
