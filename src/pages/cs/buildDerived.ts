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
// labels of the 12 coarse categories — used to keep them OUT of the fine-tag
// badge row (the coarse one is already shown as the card's category `c`).
const COARSE_LABELS: Set<string> = new Set(INTERESTS.map((i) => i.label))

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
  venueKey: string  // gazetteer venue key (e.g. "ges2") for the place card, or ""
  ts: number | null // event start as epoch ms (for future-filtering / sorting), null if undated
  tags?: string[]   // fine-grained tag labels for badges (excludes the coarse category `c`)
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

/** Strip a leading date and/or emoji prefix that some channels prepend to the
 *  post title (e.g. "10.07 🌟 GROOVE LESSON" → "GROOVE LESSON"). The date is
 *  already shown on the card/poster, so it's noise in the title. Falls back to
 *  the original if stripping would empty it. */
export function cleanTitle(raw: string): string {
  const orig = (raw || "").trim()
  // leading date token: 10.07 / 10.07.2026 / 10/07
  let s = orig.replace(/^\s*\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?/, "").trim()
  // leading emoji / stars / separators up to the first real letter, digit or quote
  s = s.replace(/^[^\p{L}\p{Nd}«"'(]+/u, "").trim()
  return s || orig
}

export function toEv(e: FeedItem): Ev {
  // Category = the FIRST tag that's a known coarse interest. Blindly taking
  // tags[0] now surfaces a raw fine-tag slug (e.g. "haus-vecherinka") when a
  // fine tag outranks the coarse one — fine keys aren't in INTERESTS.
  const coarseKey = (e.tags ?? []).find((k) => INTEREST_BY_KEY[k])
  const primaryKey = coarseKey ?? (e.tags ?? [])[0] ?? "contemporary"
  const interest = coarseKey ? INTEREST_BY_KEY[coarseKey] : undefined
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
    t: cleanTitle(e.title || "Событие"),
    sub: "",  // curator doesn't carry editorial subtitles yet — left empty by design
    v: e.location || `@${channel}`,
    d, tm,
    p: resolvePoster(e),
    c: interest?.label ?? "Событие",
    catKey: interest?.key ?? primaryKey,
    ch: `@${channel}`,
    desc: (e.description || "").trim() || "Описание появится ближе к дате. Следи за каналом события.",
    price: (e.price || "").trim() || "—",
    note: "",  // ditto — editorial highlight, populated by curator later
    dur: "",   // duration — curator doesn't carry it yet
    geo: (Array.isArray(e.geo) && e.geo.length === 2) ? [e.geo[0], e.geo[1]] : null,
    venueKey: e.venue || "",
    ts: dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.getTime() : null,
    // fine-grained tag labels for badges — drop the 12 coarse categories and the
    // one already shown as `c`, so the badge row shows only the specific tags.
    tags: (e.tag_labels ?? []).filter((l) => !COARSE_LABELS.has(l) && l !== (interest?.label ?? "")),
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
  // Collapse cross-posts. One event is posted across channels with different
  // captions AND sometimes different posters (resized / re-cropped, so NOT
  // byte-identical). Match on ANY of three identities at the SAME start time:
  //   • img — poster sha256 (catches byte-identical re-uploads)
  //   • sig — the sorted set of a title's significant words (catches the same
  //           event whose caption/poster differ but title words match, e.g.
  //           «MAGIC TRIBE x TRIANGLE /-/ MADE IN BALI» ≈ «MAGIC TRIBE x
  //           TRIANGLE | MADE IN BALI»)
  //   • txt — full body (identical copy-paste)
  // Only KEPT events record their keys → no transitive over-merge. `sig` needs
  // ≥3 significant tokens + a real start time so short/generic titles can't
  // merge unrelated events.
  const TITLE_STOP = new Set([
    "январь", "января", "февраль", "февраля", "март", "марта", "апрель", "апреля", "май", "мая", "июнь", "июня", "июль", "июля", "август", "августа", "сентябрь", "сентября", "октябрь", "октября", "ноябрь", "ноября", "декабрь", "декабря",
    "понедельник", "вторник", "среда", "среду", "четверг", "пятница", "пятницу", "суббота", "субботу", "воскресенье",
    "для", "что", "как", "это", "все", "уже", "при", "под", "над", "без", "про", "или", "где", "там", "так", "the", "and", "for", "with",
  ])
  const tokenize = (s: string): string[] =>
    (s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !TITLE_STOP.has(w))
  // Name-word set for an event: from the title, or (when the title is too
  // generic, e.g. «10 июля») from the title + the head of the body, which
  // usually leads with the event name.
  const nameTokens = (e: FeedItem): Set<string> => {
    let toks = tokenize(e.title)
    if (toks.length < 4) toks = tokenize(`${e.title || ""} ${(e.description || "").slice(0, 80)}`)
    return new Set(toks)
  }
  // Containment (overlap coefficient) — |∩| / smaller set. Better than Jaccard
  // for cross-posts where one caption is a clean title («MADE IN BALI») and the
  // other buries the same name in a longer body (extra tokens shouldn't tank the
  // score): a clean name fully inside the noisy one scores 1.0.
  const overlap = (a: Set<string>, b: Set<string>): number => {
    const [s, l] = a.size <= b.size ? [a, b] : [b, a]
    let inter = 0
    s.forEach((x) => { if (l.has(x)) inter++ })
    return s.size ? inter / s.size : 0
  }
  // How informative a title is — number of significant tokens. A generic date
  // («10 июля» → 0) loses to a real name («MAGIC TRIBE x TRIANGLE…» → 5), so the
  // better-titled copy of a cross-post is the one we keep.
  const titleScore = (e: FeedItem) => tokenize(e.title).length
  const kept: FeedItem[] = []
  const exactToIdx = new Map<string, number>() // exact key → index in `kept`
  const nameBuckets = new Map<string, { nm: Set<string>; idx: number }[]>() // display time → name-sets
  for (const e of events) {
    // Bucket by the DISPLAYED date+time — cross-posts sometimes carry the start
    // time stored differently (seconds / timezone), so an exact match on the raw
    // event_time misses them even though the user sees the same «10.07 · 18:00».
    const td = e.event_time ? new Date(e.event_time) : null
    const t = td && !Number.isNaN(td.getTime())
      ? td.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + " " + td.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : ""
    // Exact keys: byte-identical poster or identical body at the same time.
    const exact: string[] = []
    if (e.media_hash) exact.push(`img:${e.media_hash}|${t}`)
    const body = (e.description || "").trim().toLowerCase().replace(/\s+/g, " ")
    if (body) exact.push(`txt:${body}|${t}`)
    // Fuzzy name key: same start time + heavy name-word overlap. Catches re-worded
    // captions and re-uploaded (byte-different) posters that exact keys miss.
    const nm = t ? nameTokens(e) : new Set<string>()

    // Find an already-kept event this one duplicates (exact first, then fuzzy).
    let dupIdx = -1
    for (const k of exact) { const i = exactToIdx.get(k); if (i !== undefined) { dupIdx = i; break } }
    if (dupIdx < 0 && nm.size >= 4) {
      const hit = (nameBuckets.get(t) ?? []).find((b) => b.nm.size >= 4 && overlap(nm, b.nm) >= 0.8)
      if (hit) dupIdx = hit.idx
    }

    if (dupIdx >= 0) {
      // Duplicate — swap in the better-titled copy (keeps its feed position), and
      // register this copy's keys against the same slot so later dups still match.
      if (titleScore(e) > titleScore(kept[dupIdx])) kept[dupIdx] = e
      exact.forEach((k) => { if (!exactToIdx.has(k)) exactToIdx.set(k, dupIdx) })
      if (nm.size >= 4) { const b = nameBuckets.get(t) ?? []; b.push({ nm, idx: dupIdx }); nameBuckets.set(t, b) }
      continue
    }

    const idx = kept.length
    kept.push(e)
    exact.forEach((k) => exactToIdx.set(k, idx))
    if (nm.size >= 4) { const b = nameBuckets.get(t) ?? []; b.push({ nm, idx }); nameBuckets.set(t, b) }
  }
  const uniqueEvents = kept

  const withImg = uniqueEvents.filter((e) => resolvePoster(e) !== null)
  const allEv = withImg.map(toEv)

  // 8 distinct poster URLs for the landing triptych, padded with fallbacks if
  // the feed gave us fewer than 8 images. Also dedupe by URL as a final guard
  // (exact same media file) after the cross-post collapse above.
  const tripPool = [...new Set(allEv.map((e) => e.p).filter((u): u is string => !!u))]
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
