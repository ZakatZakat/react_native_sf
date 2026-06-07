/**
 * Pure data shaping for CitySignal screens.
 *
 *  Curator.getFeed() → FeedItem[]  →  DerivedData {
 *    triptychPosters,   // 8 image URLs for the landing animation
 *    deck,              // 10 swipe cards (varied by category)
 *    feed,              // ≥8 events for the Feed screen
 *    pool,              // by-category-label index for Summary / Shelves
 *    shelves,           // top 4 categories with ≥2 events
 *    superByCat,        // a "voted" headliner card per category
 *    catCounts,         // for the "+22" badges in Digest
 *  }
 */

import type { FeedItem } from "../../lib/curator"
import { isImg, resolveMedia } from "../pipe/shared"
import { INTERESTS, type Interest } from "../pipe/preferences"

const INTEREST_BY_KEY: Record<string, Interest> =
  Object.fromEntries(INTERESTS.map((i) => [i.key, i]))

export type Ev = {
  id: string
  t: string         // title
  sub: string       // editorial subtitle ("акустика" / "closing season") — optional
  v: string         // venue (location || channel)
  d: string         // short date "31.05" or "—"
  tm: string        // time "23:00" or "—"
  p: string | null  // resolved poster URL
  c: string         // category label
  catKey: string    // INTERESTS.key
  ch: string        // @channel
  desc: string      // full curator description (used in the bottom-sheet)
  price: string     // curator's price field, normalised to "—" if empty
  note: string      // short editorial note ("до утра" / "редакция топит") — optional
  dur: string       // duration ("до 08:00" / "96 мин") — optional
  geo: [number, number] | null  // resolved [lat, lng] for the map, if geocoded
}

export type DerivedData = {
  triptychPosters: (string | null)[]
  deck: Ev[]
  feed: Ev[]
  pool: Record<string, Ev[]>
  shelves: { cat: string; hits: number; evs: Ev[]; note: string }[]
  superByCat: Record<string, {
    rank: string; title: string; poster: string | null; badge: string;
    copy: { kicker: string; meta: string; foot: string }[];
  }>
  catCounts: Record<string, number>
}

export function resolvePoster(e: FeedItem): string | null {
  const m = e.media_urls?.find(isImg) ?? e.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  return r && isImg(r) ? r : null
}

export function toEv(e: FeedItem): Ev {
  const primaryKey = (e.tags ?? [])[0] ?? "contemporary"
  const interest = INTEREST_BY_KEY[primaryKey]
  const dateObj = e.event_time ? new Date(e.event_time) : null
  const d = dateObj
    ? dateObj.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
    : "—"
  const tm = dateObj
    ? dateObj.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "—"
  const channel = e.channel.replace(/^@/, "")
  return {
    id: e.id,
    t: e.title || "Событие",
    sub: "",  // curator doesn't carry editorial subtitles yet — left empty by design
    v: e.location || `@${channel}`,
    d, tm,
    p: resolvePoster(e),
    c: interest?.label ?? primaryKey,
    catKey: interest?.key ?? primaryKey,
    ch: `@${channel}`,
    desc: (e.description || "").trim() || "Описание появится ближе к дате. Следи за каналом события.",
    price: (e.price || "").trim() || "—",
    note: "",  // ditto — editorial highlight, populated by curator later
    dur: "",   // duration — curator doesn't carry it yet
    geo: (Array.isArray(e.geo) && e.geo.length === 2) ? [e.geo[0], e.geo[1]] : null,
  }
}

export function shelfNote(cat: string): string {
  const map: Record<string, string> = {
    "Театр": "Постановки и читки — то, что трясёт здесь и сейчас.",
    "Кино": "Ретро, ночные показы и док — не из сетки мультиплексов.",
    "Музыка": "Живой звук в небольших залах: акустика, джаз, эксперимент.",
    "Современное искусство": "Большие выставки и тихие галереи.",
    "Перформанс": "Тело, жест, голос — то, что нельзя пересказать.",
    "Литература": "Чтения, поэзия, презентации книг.",
    "Лекции": "Разобраться: архитектура, культура, эпохи.",
    "Танец": "Хореография и telesные практики.",
    "Фото": "Выставки, авторские туры, портфолио-ревью.",
    "Архитектура": "Прогулки, лекции, разбор зданий.",
    "Дизайн": "Графика, индастриал, выставки школ.",
    "Выставки": "Что добавилось в этом сезоне.",
  }
  return map[cat] ?? "Подборка по этой категории."
}

export function buildDerived(events: FeedItem[]): DerivedData {
  const withImg = events.filter((e) => resolvePoster(e) !== null)
  const allEv = withImg.map(toEv)

  // 8 distinct poster URLs for the landing triptych, padded with fallbacks
  // if the feed gave us fewer than 8 images.
  const tripPool = allEv.map((e) => e.p).filter((u): u is string => !!u)
  const triptychPosters: (string | null)[] = []
  for (let i = 0; i < 8; i++) {
    triptychPosters.push(tripPool[i % Math.max(1, tripPool.length)] ?? null)
  }

  // Deck — first occurrence of each catKey first, then doubles.
  const seenCats = new Set<string>()
  const deckHead: Ev[] = []
  const deckRest: Ev[] = []
  for (const ev of allEv) {
    if (!seenCats.has(ev.catKey)) {
      seenCats.add(ev.catKey)
      deckHead.push(ev)
    } else {
      deckRest.push(ev)
    }
  }
  const deck = [...deckHead, ...deckRest].slice(0, 10)

  const feed = allEv.slice(0, 8)

  // Pool — group by category label.
  const pool: Record<string, Ev[]> = {}
  for (const ev of allEv) {
    if (!pool[ev.c]) pool[ev.c] = []
    pool[ev.c].push(ev)
  }

  // Shelves — top 4 categories with ≥2 events.
  const ranked = Object.entries(pool)
    .map(([c, evs]) => ({ c, evs }))
    .filter((x) => x.evs.length >= 2)
    .sort((a, b) => b.evs.length - a.evs.length)
    .slice(0, 4)
  const shelves = ranked.map(({ c, evs }) => ({
    cat: c,
    hits: Math.min(evs.length, 3),
    evs: evs.slice(0, 6),
    note: shelfNote(c),
  }))

  // Super-event per category — top event + 3 copy variants.
  const superByCat: DerivedData["superByCat"] = {}
  for (const { c, evs } of ranked) {
    const top = evs[0]
    if (!top) continue
    superByCat[c] = {
      rank: "01",
      title: top.t,
      poster: top.p,
      badge: `${60 + (top.id.length * 7) % 30}%`,
      copy: [
        { kicker: `Выбор в ${c.toLowerCase()}`, meta: `${top.v} · ${top.d} · ${top.tm}`, foot: "★ топ категории" },
        { kicker: "Событие недели", meta: top.v, foot: "Большинство добавили в избранное" },
        { kicker: `${c} голосуют`, meta: `Обогнал ещё ${evs.length} событий`, foot: "топ категории" },
      ],
    }
  }

  const catCounts: Record<string, number> = {}
  for (const [c, evs] of Object.entries(pool)) catCounts[c] = evs.length

  return { triptychPosters, deck, feed, pool, shelves, superByCat, catCounts }
}

/** Empty bundle — used as initial state before the Curator fetch lands so
 *  every screen can render its layout (with placeholder grey tiles). */
export const EMPTY_DERIVED: DerivedData = {
  triptychPosters: new Array(8).fill(null),
  deck: [],
  feed: [],
  pool: {},
  shelves: [],
  superByCat: {},
  catCounts: {},
}
