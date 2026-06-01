/**
 * useJourney — shared state across all 7 CitySignal route pages.
 *
 *  • derived (poster/feed/shelves/...) — one Curator fetch, cached at module
 *    scope so navigating between routes never refetches. Subscribers re-render
 *    when the fetch lands.
 *  • name + profile — persisted in localStorage. Reset via clearJourney().
 *  • lastVisited — last step the user was on, so we can offer a "resume" CTA
 *    later if needed.
 */

import { useEffect, useState } from "react"
import { Curator } from "../../lib/curator"
import { analytics } from "../../lib/analytics"
import { buildDerived, EMPTY_DERIVED, type DerivedData } from "./buildDerived"

const LS_NAME = "cs.journey.name"
const LS_PROFILE = "cs.journey.profile"

// ── Curator fetch — module singleton ─────────────────────────────────────

let cached: DerivedData | null = null
let inflight: Promise<DerivedData> | null = null
const subscribers = new Set<(d: DerivedData) => void>()

function notify(d: DerivedData) { for (const fn of subscribers) fn(d) }

async function ensureFetched(): Promise<DerivedData> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const events = await analytics.measure(
        "api.call",
        () => Curator.getFeed({ limit: 120 }),
        { path: "/me/feed", method: "GET", page: "cs_journey" },
      )
      const d = buildDerived(events)
      cached = d
      notify(d)
      return d
    } catch {
      analytics.track("error.api", { endpoint: "/me/feed", page: "cs_journey" }, { status: "error" })
      cached = EMPTY_DERIVED
      notify(EMPTY_DERIVED)
      return EMPTY_DERIVED
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** Hook: returns derived data; triggers a fetch on first mount across the app. */
export function useDerived(): { ready: boolean; derived: DerivedData } {
  const [state, setState] = useState<{ ready: boolean; derived: DerivedData }>(
    () => cached ? { ready: true, derived: cached } : { ready: false, derived: EMPTY_DERIVED },
  )
  useEffect(() => {
    if (cached) {
      if (!state.ready) setState({ ready: true, derived: cached })
      return
    }
    const cb = (d: DerivedData) => setState({ ready: true, derived: d })
    subscribers.add(cb)
    void ensureFetched()
    return () => { subscribers.delete(cb) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}

// ── Local journey state (name + profile) ─────────────────────────────────

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeLS(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

const CHANGE_EVENT = "cs:journey-changed"
function broadcast() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Returns persisted name + profile and setters that write through to LS.
 *  Hooks across pages stay in sync via a single window-level event. */
export function useJourneyState() {
  const [name, _setName] = useState<string>(() => readLS<string>(LS_NAME, ""))
  const [profile, _setProfile] = useState<Record<string, number>>(() => readLS<Record<string, number>>(LS_PROFILE, {}))

  useEffect(() => {
    const sync = () => {
      _setName(readLS<string>(LS_NAME, ""))
      _setProfile(readLS<Record<string, number>>(LS_PROFILE, {}))
    }
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener("storage", sync) // other tabs
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const setName = (n: string) => { writeLS(LS_NAME, n); _setName(n); broadcast() }
  const setProfile = (p: Record<string, number>) => { writeLS(LS_PROFILE, p); _setProfile(p); broadcast() }
  const clear = () => {
    if (typeof window === "undefined") return
    try {
      localStorage.removeItem(LS_NAME)
      localStorage.removeItem(LS_PROFILE)
    } catch { /* */ }
    _setName(""); _setProfile({}); broadcast()
  }

  return { name, setName, profile, setProfile, clear }
}

/** Seed profile used when the user opens a downstream step (summary/feed)
 *  without first completing swipe — keeps demo navigation feeling alive. */
export const SEED_PROFILE: Record<string, number> = {
  "Театр": 1, "Кино": 1, "Музыка": 1, "Современное искусство": 1,
}
