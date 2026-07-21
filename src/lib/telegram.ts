/**
 * Telegram deep-links — open an event's source channel or its original post.
 *
 * Inside the Telegram mini-app we use `WebApp.openTelegramLink`, which hands the
 * t.me link to the Telegram client (navigates to the channel/post). In a plain
 * browser (dev / web) we fall back to opening the link in a new tab.
 */

type TgUser = { first_name?: string; last_name?: string; username?: string }

type TgWebApp = {
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
  initDataUnsafe?: { user?: TgUser }
}

function webApp(): TgWebApp | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp
}

/** The signed-in Telegram account's display name, or "" outside Telegram.
 *  This is the only source of the user's name now — the name-input step was
 *  removed; any stored `name` is just a stale leftover from an old session. */
export function tgUserName(): string {
  const u = webApp()?.initDataUnsafe?.user
  if (!u) return ""
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim()
  return full || (u.username || "").trim()
}

/** Bare channel username from a stored handle ("@garagemca", "garagemca", or a
 *  full t.me URL) — or "" when there's nothing linkable. */
function channelName(ch: string | null | undefined): string {
  return (ch || "")
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
}

/** t.me URL for the source channel, or null when the handle isn't linkable. */
export function tgChannelUrl(ch: string | null | undefined): string | null {
  const name = channelName(ch)
  return name ? `https://t.me/${name}` : null
}

/** t.me URL for the original post (channel + message id), or null. */
export function tgPostUrl(ch: string | null | undefined, mid: number | null | undefined): string | null {
  const name = channelName(ch)
  return name && mid ? `https://t.me/${name}/${mid}` : null
}

/** Open a t.me link — via the Telegram client inside the mini-app, else a tab. */
export function openTelegram(url: string | null | undefined): void {
  if (!url) return
  const wa = webApp()
  if (wa?.openTelegramLink) { wa.openTelegramLink(url); return }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer")
}
