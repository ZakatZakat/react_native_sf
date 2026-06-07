/**
 * Analytics SDK — minimal telemetry client for the CitySignal mini-app.
 *
 * Ships events to the shared da-analytics receiver
 * (POST /api/v1/events) which validates a per-project JWT and queues
 * them into a Postgres table partitioned by month. Grafana reads from
 * the same DB.
 *
 *  ─── Lifecycle ────────────────────────────────────────────────
 *    main.tsx → analytics.init()
 *    router   → analytics.page(route)         on every navigation
 *    UI code  → analytics.track(name, props)  on user actions
 *
 *  ─── Mapping to receiver's EventIn ────────────────────────────
 *    type            ←  name (e.g. "swipe_train.card.like")
 *    event_id        ←  fresh uuid v4 (each event)
 *    client_timestamp←  ISO 8601 (UTC)
 *    service         ←  VITE_ANALYTICS_SERVICE ("citysignal")
 *    status          ←  opts.status (default "ok")
 *    request_id      ←  session_id  (indexed → fast per-session queries)
 *    data            ←  opts.data   (short label, ≤ 2048 chars)
 *    scenario (jsonb)←  { user_id, device_id, route, platform,
 *                         app_version, viewport, tg, ...props }
 *
 *  ─── Buffering ────────────────────────────────────────────────
 *    Track() writes to an in-memory queue. We flush every 5s OR when
 *    the queue reaches 20 events OR when the tab is being hidden
 *    (uses navigator.sendBeacon so the final batch survives unload).
 *    Each event in a batch is sent as its own POST (the receiver only
 *    accepts singles) but they go out in parallel with Promise.all.
 *
 *  ─── Offline / errors ────────────────────────────────────────
 *    Each event has up to 3 retries with exponential backoff. After
 *    that we drop it (we don't yet persist to localStorage — easy
 *    follow-up if we start seeing real loss).
 */

const ENDPOINT = import.meta.env.VITE_ANALYTICS_URL as string | undefined
const TOKEN = import.meta.env.VITE_ANALYTICS_TOKEN as string | undefined
const SERVICE = (import.meta.env.VITE_ANALYTICS_SERVICE as string) || "citysignal"
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string) || "dev"

const FLUSH_INTERVAL_MS = 5000
const FLUSH_AT_SIZE = 20
const MAX_RETRIES = 3
const ENABLED = Boolean(ENDPOINT && TOKEN)

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type EventName =
  // session lifecycle
  | "session.start" | "session.end" | "session.heartbeat"
  // navigation
  | "page.view" | "page.leave"
  // swipe train
  | "swipe_train.card.view" | "swipe_train.card.like" | "swipe_train.card.skip"
  | "swipe_train.deck.complete"
  // quiz
  | "quiz.step.view" | "quiz.option.select" | "quiz.complete"
  // cover hero / shelves
  | "cover_hero.shelf.scroll" | "cover_hero.event.click"
  // feed
  | "feed.view" | "feed.event.open"
  // generic CTA
  | "cta.click"
  // network + perf + errors
  | "api.call" | "perf.lcp" | "perf.cls" | "perf.fid" | "perf.ttfb"
  | "error.js" | "error.promise" | "error.api" | "error.image"

type TrackOpts = {
  /** "ok" | "error" | "dropped" | ... (≤16 chars, receiver-side limit) */
  status?: string
  /** short text label, ≤2048 chars */
  data?: string
}

type QueuedEvent = {
  body: Record<string, unknown>
  attempts: number
}

type Identity = {
  user_id: string | null
  tg?: { id?: number; lang?: string; theme?: string }
}

// ────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────

let initialized = false
let identity: Identity = { user_id: null }
let currentRoute = ""
let lastRouteAt = 0
const sessionId = readOrCreateSessionId()
const deviceId = readOrCreateDeviceId()
const sessionStartedAt = Date.now()
let eventsInSession = 0

const queue: QueuedEvent[] = []
let flushTimer: number | null = null

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

export function init() {
  if (initialized) return
  initialized = true
  if (!ENABLED) {
    // Silently no-op in environments without analytics config.
    // eslint-disable-next-line no-console
    console.info("[analytics] disabled (no VITE_ANALYTICS_URL/TOKEN)")
    return
  }

  installGlobalHooks()

  track("session.start", {
    started_at: new Date(sessionStartedAt).toISOString(),
    viewport: getViewport(),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
  })
}

/** Attach user id + Telegram context once we know it. Safe to call repeatedly. */
export function identify(next: Partial<Identity>) {
  identity = { ...identity, ...next }
}

/** Fire a page.view. Call from your router's onResolved listener. */
export function page(route: string) {
  const now = Date.now()
  if (currentRoute && currentRoute !== route) {
    // Closing event for the previous route, with time-on-page.
    track("page.leave", { route: currentRoute, next_route: route, time_on_page_ms: now - lastRouteAt })
  }
  currentRoute = route
  lastRouteAt = now
  track("page.view", { route })
}

/** The workhorse. Adds context + queues the event for the next flush. */
export function track(name: EventName | string, props: Record<string, unknown> = {}, opts: TrackOpts = {}) {
  if (!ENABLED) return
  eventsInSession += 1
  const scenario: Record<string, unknown> = {
    user_id: identity.user_id,
    device_id: deviceId,
    route: currentRoute || (typeof window !== "undefined" ? window.location.pathname : ""),
    platform: detectPlatform(),
    app_version: APP_VERSION,
    viewport: getViewport(),
    tg: identity.tg,
    ...props,
  }
  const body: Record<string, unknown> = {
    type: name.slice(0, 64),
    event_id: uuid(),
    client_timestamp: new Date().toISOString(),
    service: SERVICE,
    status: (opts.status ?? "ok").slice(0, 16),
    request_id: sessionId.slice(0, 128),
    scenario,
  }
  if (opts.data) body.data = opts.data.slice(0, 2048)
  enqueue({ body, attempts: 0 })
}

/** Wrap a promise; emits {name} with status + duration_ms. Re-throws errors. */
export async function measure<T>(name: EventName | string, fn: () => Promise<T>, props: Record<string, unknown> = {}): Promise<T> {
  const t0 = performance.now()
  try {
    const v = await fn()
    track(name, { ...props, duration_ms: Math.round(performance.now() - t0) }, { status: "ok" })
    return v
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    track(name, { ...props, duration_ms: Math.round(performance.now() - t0), error: message }, { status: "error" })
    throw err
  }
}

/** Force-flush everything currently buffered. Mostly for tests / dev. */
export function flush(): Promise<void> {
  return flushBatch()
}

export type AdminStats = {
  service: string
  events: { d1: number; d7: number; total: number }
  users: { d1: number; d7: number; total: number; devices: number }
  sessions_24h: number
  errors_24h: number
  top_types: { type: string; n: number }[]
  per_day: { day: string; n: number }[]
  funnel: { step: string; n: number }[]
}

/** Read project-scoped rollups from the receiver (GET /api/v1/stats).
 *  Derives the stats URL from the ingest endpoint. */
export async function fetchStats(): Promise<AdminStats> {
  if (!ENDPOINT || !TOKEN) throw new Error("analytics not configured")
  const statsUrl = ENDPOINT.replace(/\/events$/, "/stats")
  const res = await fetch(statsUrl, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!res.ok) throw new Error(`stats ${res.status}`)
  return res.json() as Promise<AdminStats>
}

// ────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────

function enqueue(e: QueuedEvent) {
  queue.push(e)
  if (queue.length >= FLUSH_AT_SIZE) {
    void flushBatch()
  } else {
    scheduleFlush()
  }
}

function scheduleFlush() {
  if (flushTimer != null) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flushBatch()
  }, FLUSH_INTERVAL_MS)
}

async function flushBatch(): Promise<void> {
  if (!ENABLED || queue.length === 0) return
  if (flushTimer != null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  // Drain into a local batch; new track()s during flight queue up for next flush.
  const batch = queue.splice(0, queue.length)
  await Promise.all(batch.map(sendOne))
}

async function sendOne(item: QueuedEvent): Promise<void> {
  try {
    const res = await fetch(ENDPOINT!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(item.body),
      keepalive: true,
    })
    if (res.ok) return
    // 4xx → no point retrying (bad shape, bad token). 5xx → backoff.
    if (res.status >= 400 && res.status < 500) {
      // eslint-disable-next-line no-console
      console.warn("[analytics] dropped 4xx", res.status, await safeText(res))
      return
    }
    throw new Error(`status ${res.status}`)
  } catch (err) {
    item.attempts += 1
    if (item.attempts >= MAX_RETRIES) {
      // eslint-disable-next-line no-console
      console.warn("[analytics] dropped after retries", item.body.type, err)
      return
    }
    const delay = Math.min(15_000, 500 * 2 ** item.attempts) + Math.random() * 250
    setTimeout(() => { void sendOne(item) }, delay)
  }
}

function safeText(r: Response): Promise<string> {
  return r.text().catch(() => "")
}

// ────────────────────────────────────────────────────────────────
// Global hooks: errors, perf, beacon flush
// ────────────────────────────────────────────────────────────────

function installGlobalHooks() {
  if (typeof window === "undefined") return

  window.addEventListener("error", (e) => {
    track("error.js", {
      message: String(e.message ?? "unknown"),
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack?.slice(0, 1500),
    }, { status: "error", data: String(e.message ?? "").slice(0, 200) })
  })

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    track("error.promise", {
      message,
      stack: reason instanceof Error ? reason.stack?.slice(0, 1500) : undefined,
    }, { status: "error", data: message.slice(0, 200) })
  })

  // Final flush before the tab dies — sendBeacon is the only thing that
  // survives `pagehide`. Fall back to keepalive fetch in older browsers.
  const beaconFlush = () => {
    if (queue.length === 0) return
    const batch = queue.splice(0, queue.length)
    // session.end summary
    batch.push({
      body: buildBody("session.end", {
        duration_ms: Date.now() - sessionStartedAt,
        events_in_session: eventsInSession,
      }, {}),
      attempts: 0,
    })
    for (const item of batch) {
      const blob = new Blob([JSON.stringify(item.body)], { type: "application/json" })
      try {
        const url = `${ENDPOINT}?t=${encodeURIComponent(TOKEN!)}`
        if (navigator.sendBeacon?.(url, blob)) continue
      } catch { /* fall through */ }
      // Fallback keep-alive POST. Best-effort.
      void fetch(ENDPOINT!, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
        body: JSON.stringify(item.body),
      }).catch(() => {})
    }
  }
  window.addEventListener("pagehide", beaconFlush)
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") beaconFlush()
  })

  // Web Vitals — minimal subset using PerformanceObserver. Avoids the
  // web-vitals dep; covers LCP/CLS. FID/INP would need event-timing
  // entries which are noisier — add later if needed.
  if ("PerformanceObserver" in window) {
    try {
      let lcp = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const v = (entry as PerformanceEntry & { renderTime?: number; loadTime?: number }).renderTime
            ?? (entry as PerformanceEntry & { loadTime?: number }).loadTime
            ?? entry.startTime
          if (v > lcp) lcp = v
        }
      }).observe({ type: "largest-contentful-paint", buffered: true })
      window.addEventListener("pagehide", () => {
        if (lcp > 0) track("perf.lcp", { value_ms: Math.round(lcp), route: currentRoute })
      })

      let cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
          if (!e.hadRecentInput) cls += e.value ?? 0
        }
      }).observe({ type: "layout-shift", buffered: true })
      window.addEventListener("pagehide", () => {
        if (cls > 0) track("perf.cls", { value: Number(cls.toFixed(4)), route: currentRoute })
      })

      // TTFB
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
      if (nav) {
        track("perf.ttfb", { value_ms: Math.round(nav.responseStart - nav.requestStart), route: window.location.pathname })
      }
    } catch {
      /* PerformanceObserver type not supported — silently skip */
    }
  }

  // Auto-track any element marked data-track-id="..." as cta.click
  window.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-track-id]")
    if (!el) return
    track("cta.click", {
      cta_id: el.dataset.trackId,
      cta_meta: el.dataset.trackMeta,
    })
  }, { capture: true })
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function buildBody(name: string, props: Record<string, unknown>, opts: TrackOpts): Record<string, unknown> {
  const scenario: Record<string, unknown> = {
    user_id: identity.user_id,
    device_id: deviceId,
    route: currentRoute,
    platform: detectPlatform(),
    app_version: APP_VERSION,
    viewport: getViewport(),
    tg: identity.tg,
    ...props,
  }
  const body: Record<string, unknown> = {
    type: name.slice(0, 64),
    event_id: uuid(),
    client_timestamp: new Date().toISOString(),
    service: SERVICE,
    status: (opts.status ?? "ok").slice(0, 16),
    request_id: sessionId.slice(0, 128),
    scenario,
  }
  if (opts.data) body.data = opts.data.slice(0, 2048)
  return body
}

function readOrCreateSessionId(): string {
  if (typeof window === "undefined") return uuid()
  try {
    const k = "cs_session_id"
    let v = sessionStorage.getItem(k)
    if (!v) {
      v = uuid()
      sessionStorage.setItem(k, v)
    }
    return v
  } catch {
    return uuid()
  }
}

function readOrCreateDeviceId(): string {
  if (typeof window === "undefined") return uuid()
  try {
    const k = "cs_device_id"
    let v = localStorage.getItem(k)
    if (!v) {
      v = uuid()
      localStorage.setItem(k, v)
    }
    return v
  } catch {
    return uuid()
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  // RFC4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getViewport() {
  if (typeof window === "undefined") return { w: 0, h: 0 }
  return { w: window.innerWidth, h: window.innerHeight }
}

function detectPlatform(): string {
  if (typeof window === "undefined") return "ssr"
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
  return tg?.initData ? "tg-webapp" : "web"
}

export const analytics = { init, identify, page, track, measure, flush, fetchStats }
