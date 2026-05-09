/**
 * Web Push subscription helper.
 * Registers a ServiceWorker, asks user permission, subscribes via PushManager,
 * and POSTs the subscription to curator.
 */

import { Curator } from "./curator"

const SW_PATH = "/push-sw.js"

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4)
  const safe = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(safe)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i)
  return arr
}

export type PushState =
  | "unsupported"
  | "denied"
  | "default"
  | "subscribed"

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported"
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported"
  if (Notification.permission === "denied") return "denied"
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH)
    const sub = await reg?.pushManager?.getSubscription?.()
    if (sub) return "subscribed"
  } catch { /* */ }
  return Notification.permission === "granted" ? "default" : "default"
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH)
  if (existing) return existing
  return await navigator.serviceWorker.register(SW_PATH, { scope: "/" })
}

export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "Push не поддерживается этим браузером" }
  }
  let permission = Notification.permission
  if (permission === "default") {
    permission = await Notification.requestPermission()
  }
  if (permission !== "granted") {
    return { ok: false, reason: "Разрешение на уведомления не дано" }
  }
  try {
    const reg = await ensureServiceWorker()
    const { public_key } = await Curator.getVapidKey()
    if (!public_key) return { ok: false, reason: "VAPID ключ недоступен на сервере" }
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    })
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "Subscription без ключей" }
    }
    await Curator.subscribePush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String(e) }
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH)
    const sub = await reg?.pushManager?.getSubscription?.()
    if (sub) {
      const subs = await Curator.listPushSubs().catch(() => [])
      const match = subs.find((s) => sub.endpoint.startsWith(s.endpoint.replace(/\.\.\.$/, "")))
      if (match) await Curator.unsubscribePush(match.id).catch(() => {})
      await sub.unsubscribe()
    }
  } catch { /* */ }
}
