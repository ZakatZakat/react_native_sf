/**
 * «Скрытые события» веб-ленты — чисто клиентское, без регистрации/бэкенда.
 *
 * Храним id скрытых событий в localStorage (тот же принцип, что интересы в
 * preferences.ts): не уходит на сервер, переживает перезагрузку, синкается
 * между вкладками. Реактивность — через useSyncExternalStore, так что лента
 * сама перерисовывается при hide/unhide.
 */

import { useSyncExternalStore } from "react"

const KEY = "cs_hidden_events_v1"

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

// Единый снапшот-референс: useSyncExternalStore требует, чтобы getSnapshot
// возвращал СТАБИЛЬНУЮ ссылку, пока данные не менялись (иначе бесконечный рендер).
let snapshot: string[] = readIds()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function commit(ids: string[]) {
  snapshot = ids
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* private mode / quota — молча */
  }
  emit()
}

export function hideEvent(id: string) {
  if (!snapshot.includes(id)) commit([...snapshot, id])
}

export function unhideEvent(id: string) {
  if (snapshot.includes(id)) commit(snapshot.filter((x) => x !== id))
}

export function clearHidden() {
  if (snapshot.length) commit([])
}

// Изменение в другой вкладке → подхватываем.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      snapshot = readIds()
      emit()
    }
  })
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Реактивный список id скрытых событий. */
export function useHiddenIds(): string[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}
