/**
 * Thin client for the event-curator microservice.
 *
 * Auth: passes Telegram WebApp init_data via X-Tg-Init-Data header.
 * Dev fallback: when init_data is absent AND VITE_DEV_USER_ID is set,
 * appends `?as_user=<id>` (curator must have AUTH_DEV_MODE=true).
 */

export const CURATOR_BASE = (
  import.meta.env.VITE_CURATOR_URL || "http://localhost:8003"
).replace(/\/$/, "")

// Fallback for browser dev: any non-empty id makes curator (in AUTH_DEV_MODE) auth as that user
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID || "12345"

function readInitData(): string {
  try {
    const wa = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    return wa?.initData || ""
  } catch {
    return ""
  }
}

export type FeedItem = {
  id: string
  channel: string
  channel_id: number
  message_id: number
  title: string
  description: string
  media_urls: string[]
  media_hash?: string | null // sha256 of the poster — reliable cross-post de-dupe key
  event_time: string | null
  event_time_end: string | null
  location: string | null
  price: string | null
  tags: string[]
  tag_labels?: string[] // human labels for `tags`, confidence-ordered (for badges)
  filter_score: number
  created_at: string
  geo?: [number, number] | null
  venue?: string | null // gazetteer venue key (e.g. "ges2") for the place card
}

export type CuratorTag = {
  id: number
  key: string
  label: string
  symbol: string | null
  keywords: string[]
  sort_order: number
}

async function curatorFetch<T>(
  path: string,
  opts: RequestInit & { auth?: boolean; query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const { auth = false, query, headers, ...rest } = opts
  const params = new URLSearchParams()
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
    }
  }
  if (auth) {
    const initData = readInitData()
    if (!initData) {
      // Browser fallback (curator must run with AUTH_DEV_MODE=true): send
      // ?as_user=. An explicit ?as_user=<id> in the page URL wins — this is how
      // an editor opens /cs/admin/week?as_user=<admin-id> in a plain desktop
      // browser without Telegram. Otherwise fall back to the dev default.
      let urlAsUser = ""
      try { urlAsUser = new URLSearchParams(window.location.search).get("as_user") || "" } catch { /* noop */ }
      const au = urlAsUser || DEV_USER_ID
      if (au) params.set("as_user", au)
    }
  }
  const qs = params.toString() ? `?${params.toString()}` : ""
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  }
  if (auth) {
    const initData = readInitData()
    if (initData) finalHeaders["X-Tg-Init-Data"] = initData
  }
  const res = await fetch(`${CURATOR_BASE}${path}${qs}`, {
    ...rest,
    headers: finalHeaders,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as { detail?: string }
      detail = j.detail || detail
    } catch {
      /* */
    }
    throw new Error(`${res.status} ${detail}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/* ── Public API ─────────────────────────────────────────────────── */

export const Curator = {
  // Tags
  listTags: () => curatorFetch<CuratorTag[]>("/tags"),

  // Interests
  getInterests: () => curatorFetch<string[]>("/me/interests", { auth: true }),
  setInterests: (tag_keys: string[]) =>
    curatorFetch<string[]>("/me/interests", {
      auth: true,
      method: "PUT",
      body: JSON.stringify({ tag_keys }),
    }),

  // Feed
  getFeed: (opts?: { limit?: number; offset?: number; tags?: string[] }) =>
    curatorFetch<FeedItem[]>("/me/feed", {
      auth: true,
      query: {
        limit: opts?.limit,
        offset: opts?.offset,
        tags: opts?.tags?.length ? opts.tags.join(",") : undefined,
      },
    }),

  // Feedback
  feedback: (eventId: number | string, action: "like" | "hide" | "save" | "dismiss") =>
    curatorFetch(`/me/feedback/${eventId}`, {
      auth: true,
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  // Push
  getVapidKey: () => curatorFetch<{ public_key: string }>("/me/push/vapid"),
  subscribePush: (sub: PushSubscriptionJSON) =>
    curatorFetch<{ id: number; endpoint: string }>("/me/push/subscribe", {
      auth: true,
      method: "POST",
      body: JSON.stringify(sub),
    }),
  listPushSubs: () => curatorFetch<Array<{ id: number; endpoint: string; user_agent: string | null; created_at: string }>>("/me/push/list", { auth: true }),
  unsubscribePush: (id: number) =>
    curatorFetch(`/me/push/subscribe/${id}`, { auth: true, method: "DELETE" }),
  testPush: () => curatorFetch<{ sent: number; failed: number; subscriptions: number }>("/me/push/test", { auth: true, method: "POST" }),

  // Admin / moderation
  modList: (opts?: { limit?: number; offset?: number }) =>
    curatorFetch<Array<{
      event_id: number
      channel: string
      message_id: number
      text: string
      media_urls: string[]
      event_time: string | null
      location: string | null
      price: string | null
      filter_score: number
      filter_reasons: string[]
      created_at: string
    }>>("/admin/moderation", {
      auth: true,
      query: { limit: opts?.limit, offset: opts?.offset },
    }),
  modApprove: (eventId: number) =>
    curatorFetch(`/admin/moderation/${eventId}/approve`, { auth: true, method: "POST" }),
  modReject: (eventId: number, reason?: string) =>
    curatorFetch(`/admin/moderation/${eventId}/reject`, {
      auth: true,
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminStats: () => curatorFetch<{
    channels: { total: number; enabled: number }
    posts_raw: number
    events_by_status: Record<string, number>
  }>("/admin/stats", { auth: true }),

  // Week digest — editorial «выбор недели» hero pick
  getWeekPick: () => curatorFetch<FeedItem | null>("/me/week"),
  adminWeekCandidates: (limit = 40) =>
    curatorFetch<FeedItem[]>("/admin/week/candidates", { auth: true, query: { limit } }),
  adminWeekCurrent: () => curatorFetch<FeedItem | null>("/admin/week/current", { auth: true }),
  adminSetWeekPick: (eventId: number) =>
    curatorFetch<FeedItem>("/admin/week/pick", {
      auth: true, method: "POST", body: JSON.stringify({ event_id: eventId }),
    }),
  adminClearWeekPick: () =>
    curatorFetch<{ status: string }>("/admin/week/pick", { auth: true, method: "DELETE" }),

  // Landing posters — up to 4 editor-chosen event posters for the strip
  getLandingPicks: () => curatorFetch<FeedItem[]>("/me/landing"),
  adminLandingCandidates: (limit = 40) =>
    curatorFetch<FeedItem[]>("/admin/landing/candidates", { auth: true, query: { limit } }),
  adminLandingCurrent: () => curatorFetch<FeedItem[]>("/admin/landing/current", { auth: true }),
  adminSetLandingPick: (slot: number, eventId: number) =>
    curatorFetch<FeedItem[]>("/admin/landing/pick", {
      auth: true, method: "POST", body: JSON.stringify({ slot, event_id: eventId }),
    }),
  adminClearLandingPick: (slot?: number) =>
    curatorFetch<{ status: string }>("/admin/landing/pick", {
      auth: true, method: "DELETE", query: slot != null ? { slot } : undefined,
    }),
}
