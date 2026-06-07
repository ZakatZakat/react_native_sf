/**
 * Haptics — thin wrapper over Telegram WebApp's HapticFeedback API.
 *
 * Outside the Telegram client (plain browser) every call is a safe no-op.
 * `installGlobalTap()` wires a light impact to every interactive element
 * click so the whole app feels tactile without touching each component;
 * call the specific helpers (success/warning/select) where a richer cue
 * fits (RSVP confirm, errors, chip switches).
 */

type ImpactStyle = "light" | "medium" | "heavy" | "soft" | "rigid"
type NotificationType = "success" | "warning" | "error"

type TgHaptics = {
  impactOccurred?: (s: ImpactStyle) => void
  notificationOccurred?: (t: NotificationType) => void
  selectionChanged?: () => void
}

function hf(): TgHaptics | null {
  if (typeof window === "undefined") return null
  const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: TgHaptics } } }).Telegram?.WebApp
  return tg?.HapticFeedback ?? null
}

export const haptics = {
  impact(style: ImpactStyle = "light") {
    try { hf()?.impactOccurred?.(style) } catch { /* unsupported */ }
  },
  tap() { this.impact("light") },
  press() { this.impact("medium") },
  notify(type: NotificationType) {
    try { hf()?.notificationOccurred?.(type) } catch { /* unsupported */ }
  },
  success() { this.notify("success") },
  warning() { this.notify("warning") },
  error() { this.notify("error") },
  select() {
    try { hf()?.selectionChanged?.() } catch { /* unsupported */ }
  },
}

/** Global capture-phase listener: a light tap on every button / link /
 *  role=button click. Idempotent. */
export function installGlobalTap() {
  if (typeof window === "undefined") return
  const w = window as unknown as { __csHapticsInstalled?: boolean }
  if (w.__csHapticsInstalled) return
  w.__csHapticsInstalled = true
  window.addEventListener(
    "click",
    (ev) => {
      const el = (ev.target as HTMLElement | null)?.closest?.(
        "button, a, [role='button'], input[type='checkbox'], input[type='radio'], select",
      )
      if (el) haptics.tap()
    },
    { capture: true },
  )
}
