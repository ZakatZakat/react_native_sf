/**
 * «Сообщить об ошибке» — шторка с фиксированными причинами. Открывается по
 * диплинку из кнопки под постом в канале (report_e<id>_m<msg>). Тап по причине
 * улетает в POST /events/{id}/report. Репорт эксперта (гейт как у оценок) сразу
 * скрывает событие и удаляет пост — ответ говорит, сработало ли (acted).
 */

import { useState } from "react"
import { CS, FONT_MONO, FONT_SANS } from "./shared"
import { Curator } from "../../lib/curator"
import { tgUserName } from "../../lib/telegram"

const REASONS: { code: string; label: string }[] = [
  { code: "dup", label: "Дубль" },
  { code: "source", label: "Источник не бьётся" },
  { code: "past", label: "Мероприятие прошло" },
  { code: "place", label: "Не то место" },
  { code: "time", label: "Не то время" },
  { code: "other", label: "Прочее" },
]

type State = "idle" | "sending" | "done" | "error"

export function ReportSheet({
  open,
  onClose,
  eventId,
  msgId,
}: {
  open: boolean
  onClose: () => void
  eventId: number | null
  msgId?: number
}) {
  const [state, setState] = useState<State>("idle")
  const [acted, setActed] = useState(false)

  const close = () => {
    onClose()
    setTimeout(() => { setState("idle"); setActed(false) }, 250)
  }

  const pick = async (reason: string) => {
    if (eventId == null || state === "sending") return
    setState("sending")
    try {
      const r = await Curator.reportEvent(eventId, reason, { msgId, author: tgUserName() || undefined })
      setActed(!!r?.acted)
      setState("done")
      setTimeout(close, 1600)
    } catch {
      setState("error")
    }
  }

  if (!open) return null
  return (
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
          fontFamily: FONT_SANS, animation: "cs-rep-up 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <style>{"@keyframes cs-rep-up{from{transform:translateY(101%)}to{transform:translateY(0)}}"}</style>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.03em", textTransform: "uppercase" }}>Сообщить об ошибке</div>
          <button onClick={close} aria-label="Закрыть" style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, fontWeight: 900, color: CS.K, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {state === "done" ? (
          <div style={{ padding: "26px 0 20px", textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>{acted ? "🗑" : "🙌"}</div>
            <div style={{ fontWeight: 800, fontSize: 15, marginTop: 8 }}>
              {acted ? "Спасибо! Скрыли и передали." : "Спасибо! Передали на проверку."}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: CS.G55, letterSpacing: "0.04em", marginBottom: 12, lineHeight: 1.5 }}>
              Что не так с этим событием?
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {REASONS.map((r) => (
                <button
                  key={r.code}
                  onClick={() => pick(r.code)}
                  disabled={state === "sending"}
                  style={{
                    width: "100%", textAlign: "left", padding: "13px 14px", border: `2px solid ${CS.K}`,
                    background: CS.W, color: CS.K, cursor: state === "sending" ? "default" : "pointer",
                    fontFamily: FONT_SANS, fontWeight: 800, fontSize: 15, boxShadow: `3px 3px 0 ${CS.K}`,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {state === "error" && (
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#D6142A", marginTop: 10 }}>Не отправилось — попробуй ещё раз.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
