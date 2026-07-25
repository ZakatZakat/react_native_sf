/**
 * Бейдж «НОВОЕ». Показываем на событии, которое впервые попало в базу за
 * последние ~2 дня (Ev.createdTs = ингест, не время аппрува) И которое это
 * устройство ещё НЕ видело. Как только карточка побыла в вьюпорте (~1с) —
 * помечаем «просмотрено» в localStorage: бейдж гаснет и больше не появляется.
 * Per-device (localStorage) — как и всё остальное клиентское состояние.
 */
import type { Ev } from "./buildDerived"

const NEW_WINDOW_MS = 2 * 86400000 // «новое» = моложе 2 суток
const LS_KEY = "cs.new.seen"
const CAP = 600 // держим только последние N id (старые всё равно перестают быть «новыми»)

/** Событие свежее (по ингесту)? */
export function isFresh(ev: Ev): boolean {
  return ev.createdTs != null && Date.now() - ev.createdTs < NEW_WINDOW_MS
}

function load(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/** Это событие уже отметили как просмотренное? */
export function hasSeenNew(id: string): boolean {
  return load().includes(id)
}

/** Пометить событие просмотренным (idempotent, с ограничением размера). */
export function markNewSeen(id: string): void {
  try {
    const arr = load()
    if (arr.includes(id)) return
    arr.push(id)
    const trimmed = arr.length > CAP ? arr.slice(arr.length - CAP) : arr
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed))
  } catch {
    /* нет доступа к storage / quota — молча */
  }
}
