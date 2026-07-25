/**
 * «Недельная афиша» (лендинг → загрузка → «Неделя») показывается один раз в
 * неделю на пользователя. Первый заход в новую неделю проигрывает интро целиком,
 * повторные заходы в ту же неделю уходят сразу в ленту (/cs/feed).
 *
 * Храним НОМЕР недели показа в localStorage. В Telegram-webview localStorage — это
 * хранилище конкретного пользователя (свой девайс/webview у каждого), так что это
 * и есть «на пользователя». Ключуем ещё и по tg-id — на случай, если браузером
 * пользуются несколько человек (десктоп-дев, общий комп). Синхронно — чтобы
 * решение можно было принять прямо в router beforeLoad без вспышки лендинга.
 *
 * Ограничение: per-DEVICE. С другого устройства того же пользователя интро
 * покажется ещё раз за неделю. Кросс-девайсно это решается только через
 * Telegram CloudStorage (async) — если понадобится, вынесем.
 */

/** Год+номер недели — та же формула недели, что в weekMeta (WK N на карточке),
 *  плюс год, чтобы неделя 52/2025 и 52/2026 не схлопнулись. */
function weekKey(d: Date = new Date()): string {
  const start = new Date(d.getFullYear(), 0, 1)
  const n = Math.ceil((((d.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7)
  return `${d.getFullYear()}-${n}`
}

function storageKey(): string {
  let id = "anon"
  try {
    const u = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } })
      .Telegram?.WebApp?.initDataUnsafe?.user?.id
    if (u) id = String(u)
  } catch {
    /* noop */
  }
  return `cs.intro.week.${id}`
}

/** Уже видел недельное интро на этой неделе? */
export function introSeenThisWeek(): boolean {
  try {
    return localStorage.getItem(storageKey()) === weekKey()
  } catch {
    return false // нет доступа к storage → показываем интро (безопасный дефолт)
  }
}

/** Отметить, что интро показано на текущей неделе. */
export function markIntroSeen(): void {
  try {
    localStorage.setItem(storageKey(), weekKey())
  } catch {
    /* noop */
  }
}
