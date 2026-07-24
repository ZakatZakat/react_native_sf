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
  mid: number | null // source Telegram message id (for the t.me/<ch>/<mid> deep-link)
  desc: string      // full curator description (used in the bottom-sheet)
  price: string     // curator's price field, normalised to "—" if empty
  note: string      // short editorial note ("до утра" / "редакция топит") — optional
  dur: string       // duration ("до 08:00" / "96 мин") — optional
  geo: [number, number] | null  // resolved [lat, lng] for the map, if geocoded
  venueKey: string  // gazetteer venue key (e.g. "ges2") for the place card, or ""
  ts: number | null // event start as epoch ms (for future-filtering / sorting), null if undated
  endTs: number | null // event CLOSE/end as epoch ms — для «последнего шанса» выставок, null если нет
  tags?: string[]   // fine-grained tag labels for badges (excludes the coarse category `c`)
  access: Access    // барьер входа: свободный / регистрация / билеты / закрыта / sold out
  age: string       // возрастной ценз "18+" / "" если нет
  tier: "insider" | "" // «для знатока» — курируем вниз (закрытые/пресс/VIP-анонсы)
  friction: number  // 0 (свободно) … 7 (sold out) — чем ниже, тем выше ранг
}

/** Барьер посещения, извлечённый из текста поста. Порядок в UI — от «просто
 *  приходи» к «так просто не попасть». */
export type Access =
  | "free" | "registration" | "registration_closed"
  | "ticket" | "signup" | "accreditation" | "sold_out" | ""

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
  // Невидимые/комбинирующие символы из TG-постов (мягкий перенос «Кварти­рник»,
  // zero-width, bidi-метки, variation selectors, enclosing keycap «1️⃣»,
  // комбинирующая диакритика) рендерятся «крючками» под буквами. В русских/
  // латинских названиях таких нет — вычищаем глобально.
  let s = orig.replace(/[\u00AD\u200B-\u200F\u2060\uFEFF\uFE00-\uFE0F\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF]/gu, "")
  // leading date token: 10.07 / 10.07.2026 / 10/07
  s = s.replace(/^\s*\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?/, "").trim()
  // leading emoji / stars / separators up to the first real letter, digit or quote
  s = s.replace(/^[^\p{L}\p{Nd}«"'(]+/u, "").trim()
  return s || orig
}

/** Parse a curator `event_time` into an absolute instant.
 *  Curator stores Moscow wall-clock, frequently WITHOUT a timezone suffix.
 *  Plain `new Date("2026-07-10T18:00")` reads such a string in the *viewer's*
 *  zone — our Spain-based reviewer (−1h) would then see every time shifted and
 *  the sort/dedup keys drift with it. So: strings that already carry an offset
 *  are trusted as-is; naive strings are pinned to +03:00. All formatting then
 *  goes through `MSK_D`/`MSK_T` so the wall-clock shown is Moscow's, whoever
 *  is looking. */
export function parseEventTime(raw: string | null | undefined): Date | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  s = s.replace(" ", "T")
  if (!s.includes("T")) s += "T00:00:00" // date-only → midnight Moscow
  const d = new Date(`${s}+03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

const MSK_D: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" }
const MSK_T: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }

// «Трение» — насколько трудно попасть. Ниже = доступнее = выше в ранжировании
// и в приоритете для героя «выбор редакции».
const FRICTION: Record<Access, number> = {
  free: 0, "": 1, registration: 2, signup: 2, ticket: 3,
  accreditation: 5, registration_closed: 6, sold_out: 7,
}

/** Барьер входа из текста поста. Проверки идут от самых «запирающих» к мягким,
 *  чтобы «регистрация закрыта» не схлопнулась в обычную «регистрацию». */
export function detectAccess(text: string, priceFree: boolean): Access {
  const t = (text || "").toLowerCase()
  // жёсткие барьеры (уже не попасть)
  if (/распродан|sold\s*out|все билеты продан|билеты (закончил|распродан)|мест нет|мест не осталось|аншлаг/.test(t)) return "sold_out"
  if (/регистрац\w* (закрыт|заверш|окончен|прекращен)|список закрыт|запись закрыт|регистрац\w* больше не/.test(t)) return "registration_closed"
  if (/аккредитац/.test(t)) return "accreditation"
  // мягкие барьеры (нужно действие заранее)
  if (/регистрац|зарегистрир|\bregister\b/.test(t)) return "registration"
  if (/по (предварительной )?записи|запись обязательн|необходима запись|нужна запись/.test(t)) return "signup"
  if (/по билет|вход по билет|купить билет|цена билета|стоимость билета|билеты по ссылке/.test(t)) return "ticket"
  if (priceFree) return "free"
  return ""
}

/** Возрастной ценз «18+»/«16+» и т.п., если указан в тексте. */
export function detectAge(text: string): string {
  const m = (text || "").match(/(?:^|[^\d])(6|12|16|18|21)\s*\+/)
  return m ? `${m[1]}+` : ""
}

/** «Для знатока» — контент, который курируем ВНИЗ, а не в герой: пресс-/VIP-/
 *  закрытые показы, анонсы по приглашениям и объявления о закрытии выставок
 *  (это инфо-повод, а не «приходи и смотри»). Публичный вернисаж (открытие) сюда
 *  НЕ попадает — он должен ранжироваться выше. */
export function detectTier(text: string, access: Access): "insider" | "" {
  if (access === "accreditation") return "insider"
  const t = (text || "").toLowerCase()
  if (/по приглашени|пресс-показ|пресс-конференц|закрыт(ый|ая|ое) (показ|просмотр|вернисаж|мероприят|встреч|презентац|событ)|только для (член|прессы|профессионал|специалист|своих)|для профессионал|для прессы|\bvip\b|клубный формат/.test(t)) return "insider"
  if (/последний день (выставк|экспозиц)|закрытие выставк|прощание с выставк|выставка закрывает|финисаж|финиссаж/.test(t)) return "insider"
  return ""
}

export function toEv(e: FeedItem): Ev {
  // Category = the FIRST tag that's a known coarse interest. Blindly taking
  // tags[0] now surfaces a raw fine-tag slug (e.g. "haus-vecherinka") when a
  // fine tag outranks the coarse one — fine keys aren't in INTERESTS.
  const coarseKey = (e.tags ?? []).find((k) => INTEREST_BY_KEY[k])
  const primaryKey = coarseKey ?? (e.tags ?? [])[0] ?? "contemporary"
  const interest = coarseKey ? INTEREST_BY_KEY[coarseKey] : undefined
  const dateObj = parseEventTime(e.event_time)
  const d = dateObj ? dateObj.toLocaleDateString("ru-RU", MSK_D) : "—"
  const tm = dateObj ? dateObj.toLocaleTimeString("ru-RU", MSK_T) : "—"
  const channel = e.channel.replace(/^@/, "")
  // Сигнал доступности (тема фидбека #3–5): барьер входа, возраст и тир контента
  // считаем из тела поста — цена «свободный вход» уже извлечена куратором в price.
  const priceFree = /свобод|беспл|free/i.test(e.price || "")
  const access = detectAccess(e.description || "", priceFree)
  const age = detectAge(e.description || "")
  const tier = detectTier(e.description || "", access)
  return {
    id: e.id,
    t: cleanTitle(e.title || "Событие"),
    sub: "",  // curator doesn't carry editorial subtitles yet — left empty by design
    v: e.location || "",  // no channel-handle fallback — we don't expose sources in the UI
    d, tm,
    p: resolvePoster(e),
    c: interest?.label ?? "Событие",
    catKey: interest?.key ?? primaryKey,
    ch: `@${channel}`,
    mid: e.message_id ?? null,
    desc: (e.description || "").trim() || "Описание появится ближе к дате. Следи за каналом события.",
    price: (e.price || "").trim() || "—",
    note: "",  // ditto — editorial highlight, populated by curator later
    dur: "",   // duration — curator doesn't carry it yet
    geo: (Array.isArray(e.geo) && e.geo.length === 2) ? [e.geo[0], e.geo[1]] : null,
    venueKey: e.venue || "",
    ts: dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.getTime() : null,
    endTs: (() => { const eo = parseEventTime(e.event_time_end); return eo && !Number.isNaN(eo.getTime()) ? eo.getTime() : null })(),
    // fine-grained tag labels for badges — drop the 12 coarse categories and the
    // one already shown as `c`, so the badge row shows only the specific tags.
    tags: (e.tag_labels ?? []).filter((l) => !COARSE_LABELS.has(l) && l !== (interest?.label ?? "")),
    access, age, tier,
    friction: FRICTION[access] ?? 1,
  }
}

// «Последний шанс» — сколько дней до закрытия (по МСК-дню). Подпись для бейджа
// возвращаем только для МНОГОДНЕВНЫХ событий (выставок), закрывающихся в ближайшие
// `within` дней; иначе null (однодневное / уже закрыто / далеко). МСК-день считаем
// фиксированным сдвигом +3ч — стабильно для любого пояса зрителя.
const MSK_MS = 3 * 3600000
const mskDay = (ts: number): number => Math.floor((ts + MSK_MS) / 86400000)
export function closingSoon(ev: Ev, within = 14): { days: number; label: string } | null {
  if (ev.endTs == null) return null
  const endDay = mskDay(ev.endTs)
  const startDay = ev.ts != null ? mskDay(ev.ts) : null
  if (startDay != null && endDay <= startDay) return null // однодневное — не «закрывается»
  const days = endDay - mskDay(Date.now())
  if (days < 0 || days > within) return null
  const label = days === 0 ? "закрывается сегодня" : days === 1 ? "закрывается завтра" : `закр. через ${days} дн.`
  return { days, label }
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
    "Игры и сообщество": "Настолки, квизы, маркеты, нетворкинг.",
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
    // Title-only при ≥3 значимых словах (тело не зашумляет набор); добор из тела
    // только для совсем коротких заголовков (дата вместо названия). Порог 3 ловит
    // короткие кросс-посты вроде «Save Russian Wave».
    let toks = tokenize(e.title)
    if (toks.length < 3) toks = tokenize(`${e.title || ""} ${(e.description || "").slice(0, 80)}`)
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
  // Canonical event URL from the body — the ticket/info page (outlinefestival.org,
  // timepad, qtickets…). Cross-posts of the SAME event carry the SAME such link;
  // t.me / соцсети differ per repost, so they're skipped. Combined with the start
  // time this catches festival promos whose captions AND posters all differ
  // («190 имён…», «финализированы лайнапы…», «OID × SILA SVETA…» → один Outline).
  const urlKey = (e: FeedItem): string => {
    // Match bare domains too — posts routinely drop the protocol
    // («🎫 → outlinefestival.org/2026»), so requiring https:// missed most links.
    // Require a /path so plain «19.00»/prose can't masquerade as a URL.
    const urls = (e.description || "").match(/(?:https?:\/\/)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\/[^\s)<>"'»]+/gi)
    if (!urls) return ""
    for (const u of urls) {
      const low = u.toLowerCase().replace(/^https?:\/\//, "")
      // channel/social links differ per repost, image paths aren't event ids
      if (/^(t\.me\/|telegram\.|instagram\.|vk\.(com|ru)\/|facebook\.|youtu|\S+\.jpe?g)/.test(low)) continue
      const norm = low.replace(/[?#].*$/, "").replace(/\/+$/, "")
      if (norm) return norm
    }
    return ""
  }
  // Quoted event name («Во дворе», «ОВОЩИ», «Зал ожидания») — a strong same-event
  // signal cross-posts share even when captions and posters differ. The title-token
  // overlap is unreliable here: a short quoted title («Во дворе» → 3 tokens) pulls in
  // the body, a longer one doesn't, and the two token sets then diverge below the 0.8
  // threshold though they're the same event. First «…» in the title (fallback: body
  // head); ≥5 chars so «Лето»/«Ночь»-type generics can't merge unrelated events.
  const quoteKey = (e: FeedItem): string => {
    const src = `${e.title || ""} ${(e.description || "").slice(0, 60)}`
    const m = src.match(/«([^»]{5,80})»/) || src.match(/"([^"]{5,80})"/)
    return m ? m[1].toLowerCase().replace(/\s+/g, " ").trim() : ""
  }
  const kept: FeedItem[] = []
  const exactToIdx = new Map<string, number>() // exact key → index in `kept`
  const nameBuckets = new Map<string, { nm: Set<string>; idx: number }[]>() // display time → name-sets
  for (const e of events) {
    // Bucket by the DISPLAYED date+time — cross-posts sometimes carry the start
    // time stored differently (seconds / timezone), so an exact match on the raw
    // event_time misses them even though the user sees the same «10.07 · 18:00».
    const td = parseEventTime(e.event_time)
    const t = td
      ? td.toLocaleDateString("ru-RU", MSK_D) + " " + td.toLocaleTimeString("ru-RU", MSK_T)
      : ""
    // Fuzzy-склейку бакетим по ДНЮ (а не дню+времени): кросс-посты одного события
    // часто несут чуть разное время (15:30 vs 16:00). Exact-ключи — на дню+времени.
    const day = td ? td.toLocaleDateString("ru-RU", MSK_D) : ""
    // Exact keys: byte-identical poster or identical body at the same time.
    const exact: string[] = []
    if (e.media_hash) exact.push(`img:${e.media_hash}|${t}`)
    if (t) { const u = urlKey(e); if (u) exact.push(`url:${u}|${t}`) }
    if (t) { const q = quoteKey(e); if (q) exact.push(`name:${q}|${t}`) }
    const body = (e.description || "").trim().toLowerCase().replace(/\s+/g, " ")
    if (body) exact.push(`txt:${body}|${t}`)
    // Fuzzy name key: same day + heavy name-word overlap. Catches re-worded
    // captions and re-uploaded (byte-different) posters that exact keys miss.
    const nm = nameTokens(e)

    // Find an already-kept event this one duplicates (exact first, then fuzzy).
    let dupIdx = -1
    for (const k of exact) { const i = exactToIdx.get(k); if (i !== undefined) { dupIdx = i; break } }
    if (dupIdx < 0 && nm.size >= 3) {
      const hit = (nameBuckets.get(day) ?? []).find((b) => b.nm.size >= 3 && overlap(nm, b.nm) >= 0.85)
      if (hit) dupIdx = hit.idx
    }

    if (dupIdx >= 0) {
      // Duplicate — swap in the better-titled copy (keeps its feed position), and
      // register this copy's keys against the same slot so later dups still match.
      if (titleScore(e) > titleScore(kept[dupIdx])) kept[dupIdx] = e
      exact.forEach((k) => { if (!exactToIdx.has(k)) exactToIdx.set(k, dupIdx) })
      if (nm.size >= 3) { const b = nameBuckets.get(day) ?? []; b.push({ nm, idx: dupIdx }); nameBuckets.set(day, b) }
      continue
    }

    const idx = kept.length
    kept.push(e)
    exact.forEach((k) => exactToIdx.set(k, idx))
    if (nm.size >= 3) { const b = nameBuckets.get(day) ?? []; b.push({ nm, idx }); nameBuckets.set(day, b) }
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
