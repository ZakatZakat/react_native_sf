/**
 * Sub-categories within each major direction (e.g. cinema → showings / Q&A / series / doc / animation).
 *
 * `keywords: null` matches everything in the parent category ("Все").
 * Date-based bins ("Сегодня"/"Неделя"/"Позже") are handled via the special
 * sentinel keys "_today" / "_week" / "_later".
 */

import type { FeedItem } from "../../lib/curator"

export type SubCategory = {
  key: string
  label: string
  keywords: string[] | null
}

export const SUB_CATEGORIES: Record<string, SubCategory[]> = {
  cinema: [
    { key: "all", label: "Все", keywords: null },
    { key: "showings", label: "Показы", keywords: ["показ", "кинопоказ", "просмотр"] },
    { key: "qa", label: "Q&A", keywords: ["q&a", "обсужден", "встреч с реж", "разговор"] },
    { key: "series", label: "Программы", keywords: ["цикл", "кинопрограмм", "ретроспект", "серия показов"] },
    { key: "doc", label: "Док", keywords: ["док", "documentary", "неигров"] },
    { key: "animation", label: "Анимация", keywords: ["анимац", "мульт"] },
    { key: "_today", label: "Сегодня", keywords: null },
    { key: "_week", label: "Неделя", keywords: null },
  ],
  contemporary: [
    { key: "all", label: "Все", keywords: null },
    { key: "shows", label: "Выставки", keywords: ["выстав", "экспоз", "вернисаж"] },
    { key: "perf", label: "Перформанс", keywords: ["перформ", "акци"] },
    { key: "video", label: "Видео-арт", keywords: ["видеоискусств", "медиа"] },
    { key: "residency", label: "Резиденции", keywords: ["резиденц", "мастерская"] },
    { key: "research", label: "Исследования", keywords: ["исследоват", "архив", "семинар"] },
    { key: "_today", label: "Сегодня", keywords: null },
    { key: "_week", label: "Неделя", keywords: null },
  ],
  music: [
    { key: "all", label: "Все", keywords: null },
    { key: "concerts", label: "Концерты", keywords: ["концерт", "live", "gig"] },
    { key: "club", label: "Клубы", keywords: ["клуб", "вечеринк", "rave", "dj"] },
    { key: "classical", label: "Классика", keywords: ["оркестр", "симфон", "хор", "опер", "камерн"] },
    { key: "experimental", label: "Эксперим.", keywords: ["электрон", "эксперим", "noise", "ambient"] },
    { key: "_today", label: "Сегодня", keywords: null },
    { key: "_week", label: "Неделя", keywords: null },
  ],
  exhibition: [
    { key: "all", label: "Все", keywords: null },
    { key: "openings", label: "Открытия", keywords: ["вернисаж", "открыти"] },
    { key: "tours", label: "Кураторские туры", keywords: ["тур", "экскурс"] },
    { key: "permanent", label: "Постоянные", keywords: ["постоянн"] },
    { key: "_today", label: "Сегодня", keywords: null },
    { key: "_week", label: "Неделя", keywords: null },
  ],
}

const FALLBACK_SUBCATS: SubCategory[] = [
  { key: "all", label: "Все", keywords: null },
  { key: "_today", label: "Сегодня", keywords: null },
  { key: "_week", label: "На неделе", keywords: null },
  { key: "_later", label: "Позже", keywords: null },
]

export function subCategoriesFor(categoryKey: string): SubCategory[] {
  return SUB_CATEGORIES[categoryKey] ?? FALLBACK_SUBCATS
}

/* ── Filtering ─────────────────────────────────────────── */

function inDateBin(ev: FeedItem, bin: string): boolean {
  const t = ev.event_time ? new Date(ev.event_time).getTime() : NaN
  if (Number.isNaN(t)) return bin === "_later"
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const diffDays = Math.floor((t - now) / day)
  if (bin === "_today") return diffDays >= 0 && diffDays < 1
  if (bin === "_week") return diffDays >= 0 && diffDays < 7
  if (bin === "_later") return diffDays >= 7
  return true
}

export function matchSub(ev: FeedItem, sub: SubCategory): boolean {
  if (sub.key === "all") return true
  if (sub.key.startsWith("_")) return inDateBin(ev, sub.key)
  if (!sub.keywords || sub.keywords.length === 0) return true
  const text = `${ev.title ?? ""}\n${ev.description ?? ""}`.toLowerCase()
  return sub.keywords.some((kw) => text.includes(kw.toLowerCase()))
}

export function countBySubcat(events: FeedItem[], categoryKey: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const sub of subCategoriesFor(categoryKey)) {
    out.set(sub.key, events.filter((ev) => matchSub(ev, sub)).length)
  }
  return out
}
