import { useEffect, useState, useCallback } from "react"
import type { EventCard } from "./shared"

const SAVED_KEY = "pipe.savedEvents.v1"
const HIDDEN_KEY = "pipe.hiddenEventIds.v1"
const CHANGE_EVENT = "pipe:saved-changed"

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    /* quota / private mode */
  }
}

export function getSaved(): EventCard[] {
  return readJSON<EventCard[]>(SAVED_KEY, [])
}

export function isSaved(id: string): boolean {
  return getSaved().some((e) => e.id === id)
}

export function addSaved(card: EventCard) {
  const list = getSaved()
  if (list.some((e) => e.id === card.id)) return
  list.unshift(card)
  writeJSON(SAVED_KEY, list)
}

export function removeSaved(id: string) {
  const list = getSaved().filter((e) => e.id !== id)
  writeJSON(SAVED_KEY, list)
}

export function getHidden(): string[] {
  return readJSON<string[]>(HIDDEN_KEY, [])
}

export function addHidden(id: string) {
  const set = new Set(getHidden())
  set.add(id)
  writeJSON(HIDDEN_KEY, [...set])
}

export function removeHidden(id: string) {
  const list = getHidden().filter((x) => x !== id)
  writeJSON(HIDDEN_KEY, list)
}

export function useSavedEvents() {
  const [saved, setSaved] = useState<EventCard[]>(() => getSaved())
  const refresh = useCallback(() => setSaved(getSaved()), [])
  useEffect(() => {
    const onChange = () => setSaved(getSaved())
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])
  return { saved, refresh }
}

/* ── .ics export ── */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function toIcsDate(iso: string | null | undefined, fallback?: Date): string {
  const d = iso ? new Date(iso) : fallback ?? new Date()
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

export function buildIcs(card: EventCard): string {
  const start = card.event_time ? new Date(card.event_time) : new Date(card.created_at)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const dtStart = toIcsDate(start.toISOString())
  const dtEnd = toIcsDate(end.toISOString())
  const stamp = toIcsDate(new Date().toISOString())
  const uid = `${card.id}@pipe.events`
  const summary = escapeIcs(card.title || "Событие")
  const description = escapeIcs(`${card.description ?? ""}\nКанал: ${card.channel}`)
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pipe//Events//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

export function downloadIcs(card: EventCard) {
  const ics = buildIcs(card)
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${(card.title || "event").replace(/[^a-zа-я0-9-_ ]/gi, "_").slice(0, 60)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── Date bucketing ── */

export type DateBucket = "today" | "tomorrow" | "thisWeek" | "later" | "noDate"

export function bucketFor(card: EventCard): DateBucket {
  const iso = card.event_time
  if (!iso) return "noDate"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "noDate"
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
  const startOfDayAfter = new Date(startOfDay.getTime() + 2 * 24 * 60 * 60 * 1000)
  const dayOfWeek = startOfDay.getDay()
  const daysUntilWeekEnd = (7 - dayOfWeek) % 7 || 7
  const startOfNextWeek = new Date(startOfDay.getTime() + (daysUntilWeekEnd + 1) * 24 * 60 * 60 * 1000)
  if (d.getTime() < startOfDay.getTime()) return "later"
  if (d.getTime() < startOfTomorrow.getTime()) return "today"
  if (d.getTime() < startOfDayAfter.getTime()) return "tomorrow"
  if (d.getTime() < startOfNextWeek.getTime()) return "thisWeek"
  return "later"
}

export function timeUntil(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const diff = d.getTime() - Date.now()
  if (diff < 0) return null
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  if (hours >= 24) return null
  if (hours === 0) return `через ${minutes} мин`
  if (hours === 1) return `через час`
  if (hours < 5) return `через ${hours} часа`
  return `через ${hours} часов`
}
