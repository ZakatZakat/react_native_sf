/**
 * CitySignal · веб-версия ленты (не Telegram).
 *
 *  Заготовка десктоп-ленты: тот же контент и дизайн, что в мини-аппе, но
 *  крупнее и шире — многоколоночная masonry вместо мобильных 2 колонок,
 *  увеличенный герой и типографика. Карты нет: пользователь сразу в ленте.
 *
 *  Переиспользует данные (useDerived), токены/шрифты (CS/SK) и общую модалку
 *  события (EventModalProvider/useOpenEvent). Логика доступности/тиров уже в
 *  Ev (buildDerived) — здесь только рендер в веб-масштабе.
 *
 *  Роут: /web
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  CS, SK, FONT_SANS, FONT_MONO, ScreenBG,
} from "./shared"
import { closingSoon, type Ev } from "./buildDerived"
import { INTERESTS } from "../pipe/preferences"
import { useDerived } from "./useJourney"
import { analytics } from "../../lib/analytics"

const CAT_SYM = new Map(INTERESTS.map((i) => [i.label, i.symbol]))
// Порядок чипов-категорий: сначала «якорные» (выставки/кино/музыка), потом остальное.
const CAT_PRIORITY = ["Выставки", "Кино", "Музыка"]

// ── Доступность (тот же смысл, что в мобильной ленте, крупнее) ──────────
const ACCESS_LABEL: Record<string, string> = {
  free: "свободно",
  registration: "нужна регистрация",
  registration_closed: "регистрация закрыта",
  ticket: "по билетам",
  signup: "по записи",
  accreditation: "аккредитация",
  sold_out: "мест нет",
}
const HARD_ACCESS = new Set(["registration_closed", "sold_out"])
const RED = "#E0162B"
const accessSquare = (a: string): string => (a === "free" ? CS.B : HARD_ACCESS.has(a) ? RED : SK.ink)

// Детерминированный псевдослучай 0..1 из (индекс, seed) — перемешивание каталога
// со сдвигом по рангу (свой порядок на каждую загрузку страницы).
function seededRand(i: number, s: number): number {
  const x = Math.sin((i + 1) * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Бейдж-штамп (веб-масштаб): белый блок, квадрат-индикатор, прямые углы.
 *  Компактный — чтобы несколько бейджей помещались в ряд. */
function Stamp({ label, square }: { label: string; square: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      fontFamily: FONT_SANS, fontWeight: 800, fontSize: 10.5, letterSpacing: "0.04em",
      textTransform: "uppercase", lineHeight: 1, padding: "4px 9px 4px 6px",
      background: SK.paper, color: SK.ink, border: `2px solid ${SK.ink}`, boxShadow: `2px 2px 0 ${SK.ink}`,
    }}>
      <span style={{ width: 11, height: 11, flex: "0 0 auto", background: square }} />
      {label}
    </span>
  )
}

/** Бейдж «когда» — тёмный штамп (дата · время) с синей тенью: якорь среди
 *  белых бейджей доступа. */
function DateStamp({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
      fontFamily: FONT_MONO, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.04em",
      lineHeight: 1, padding: "5px 9px",
      background: SK.ink, color: "#fff", border: `2px solid ${SK.ink}`, boxShadow: `2px 2px 0 ${CS.B}`,
    }}>{label}</span>
  )
}

/** «Когда»: дата и время. «00:00» — это дефолт для даты-без-времени (событие
 *  без указанного часа парсится в полночь), поэтому его НЕ показываем — только дату. */
export function whenLabel(ev: Ev): string {
  const t = ev.tm && ev.tm !== "—" && ev.tm !== "00:00" ? ev.tm : ""
  if (ev.d && ev.d !== "—") return t ? `${ev.d} · ${t}` : ev.d
  return t
}

export function accessBadges(ev: Ev): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const when = whenLabel(ev)
  if (when) out.push(<DateStamp key="d" label={when} />)
  if (ACCESS_LABEL[ev.access]) out.push(<Stamp key="a" label={ACCESS_LABEL[ev.access]} square={accessSquare(ev.access)} />)
  if (ev.age) out.push(<Stamp key="g" label={ev.age} square={SK.ink} />)
  return out
}

// Скоринг героя «выбор редакции» — как в мобильной ленте (доступнее = выше).
function heroScore(e: Ev): number {
  let s = e.friction
  if (e.ts == null) s += 1.5
  if (!e.v || e.v.startsWith("@")) s += 1
  if (e.geo) s -= 0.5
  // «Выбор недели» = про эту неделю: мягкий штраф за дальние даты (14д→0, 28д→+1, 42д+→+2).
  if (e.ts != null) {
    const days = (e.ts - Date.now()) / 86400000
    if (days > 14) s += Math.min((days - 14) / 14, 2)
  }
  return s
}

// ── Карточка каталога (крупная) ─────────────────────────────────────────
function WebCard({ ev, i = 0, onBroken }: { ev: Ev; i?: number; onBroken?: (id: string) => void }) {
  const navigate = useNavigate()
  const [broken, setBroken] = useState(false)
  if (broken) return null
  const venue = ev.v && !ev.v.startsWith("@") ? ev.v : ""
  // дата·время ушли в бейдж «когда» — в мете остаётся только реальная цена
  const meta = ev.price && ev.price !== "—" && !/свобод|беспл|free/i.test(ev.price) ? ev.price : ""
  const nl = (ev.desc || "").indexOf("\n")
  const body = nl >= 0 ? ev.desc.slice(nl + 1).replace(/\s+/g, " ").trim() : ""
  const bd = accessBadges(ev)
  return (
    <div className="cs-card" style={{ breakInside: "avoid", WebkitColumnBreakInside: "avoid", marginBottom: 24, animationDelay: `${Math.min(i, 24) * 0.028}s` }}>
      <div onClick={() => navigate({ to: "/web/event/$id", params: { id: ev.id } })} style={{ background: SK.paper, border: `2.5px solid ${SK.ink}`, boxShadow: `4px 5px 0 ${SK.ink}`, overflow: "hidden", cursor: "pointer" }}>
        <div style={{ position: "relative", borderBottom: `2.5px solid ${SK.ink}`, background: "#E4E4E1", lineHeight: 0 }}>
          {ev.p && <img src={ev.p} alt="" onError={() => { setBroken(true); onBroken?.(ev.id) }} style={{ width: "100%", height: "auto", maxHeight: 540, objectFit: "cover", display: "block" }} />}
          {ev.d && ev.d !== "—" && <span style={{ position: "absolute", top: 11, right: 11, background: SK.ink, color: SK.paper, fontWeight: 900, fontSize: 16, letterSpacing: "0.02em", padding: "6px 10px" }}>{ev.d}</span>}
          {(() => { const cs = closingSoon(ev); return cs ? (
            <span style={{ position: "absolute", top: 11, left: 11, background: "#E0162B", color: "#fff", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", padding: "5px 9px", border: `2px solid ${SK.ink}`, lineHeight: 1 }}>{cs.label}</span>
          ) : null })()}
        </div>
        <div style={{ padding: "14px 16px 17px" }}>
          {meta && <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12.5, letterSpacing: "0.03em", color: SK.ink55, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>}
          {bd.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: meta ? 12 : 0 }}>{bd}</div>}
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.015em", lineHeight: 1.07, marginTop: 12, textTransform: "uppercase", color: SK.ink, overflowWrap: "break-word", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{ev.t}</div>
          {venue && <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, color: SK.ink55, marginTop: 8 }}>{venue}</div>}
          {body && <div style={{ fontSize: 13.5, lineHeight: 1.42, color: SK.ink55, marginTop: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{body}</div>}
          {ev.tags && ev.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {ev.tags.slice(0, 4).map((tg) => (
                <span key={tg} style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase", color: "#fff", background: CS.B, border: `2px solid ${SK.ink}`, boxShadow: `2px 2px 0 ${SK.ink}`, padding: "4px 9px" }}>{tg}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Детерминированная masonry: N колонок по ширине контейнера, карточки
 *  раскладываются round-robin (i % N) — верхний ряд всегда на одной линии,
 *  порядок чтения слева-направо. Замена CSS column-fill:balance, который
 *  недетерминирован: при асинхронной догрузке высоких постеров он то
 *  сваливал всё в одну колонку, то ломал верхнюю линию карточек. */
function MasonryCols({ items }: { items: Ev[] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState(3)
  const COLW = 300, GAP = 22
  useLayoutEffect(() => {
    const measure = () => {
      const w = ref.current?.clientWidth || 900
      setCols(Math.max(1, Math.min(5, Math.floor((w + GAP) / (COLW + GAP)))))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])
  // Карточки с битым постером (404/0-байт) WebCard рендерит как `null`. При
  // round-robin такой `null` держал бы слот в своей колонке → вертикальный
  // пробел + сбитый порядок чтения. Поднимаем «битость» сюда и выкидываем
  // такие события ДО раскладки — остальные заполняют ряды без пустот.
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  const markBroken = (id: string) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  const live = useMemo(() => items.filter((e) => !broken.has(e.id)), [items, broken])
  // Число колонок не больше числа карточек: при 3 событиях в «последнем шансе»
  // раскладка по 5 колонок оставляла пустые bucket'ы → дыра в ряду. Теперь
  // карточки заполняют ряд слева направо без пустот.
  const n = Math.max(1, Math.min(cols, live.length))
  const buckets: { ev: Ev; i: number }[][] = Array.from({ length: Math.max(1, n) }, () => [])
  live.forEach((ev, i) => buckets[i % n].push({ ev, i }))
  return (
    <div ref={ref} style={{ display: "flex", gap: GAP, alignItems: "flex-start" }}>
      {buckets.map((bucket, c) => (
        <div key={c} style={{ flex: 1, minWidth: 0 }}>
          {bucket.map(({ ev, i }) => <WebCard key={ev.id} ev={ev} i={i} onBroken={markBroken} />)}
        </div>
      ))}
    </div>
  )
}

// ── Герой «выбор редакции» (крупный) ───────────────────────────────────
function WebHero({ ev, onBroken }: { ev: Ev; onBroken?: (id: string) => void }) {
  const navigate = useNavigate()
  const [broken, setBroken] = useState(false)
  const bd = accessBadges(ev)
  const len = (ev.t || "").length
  const fs = len <= 22 ? 46 : len <= 38 ? 38 : len <= 58 ? 30 : len <= 84 ? 24 : 20
  return (
    <div className="cs-hero" onClick={() => navigate({ to: "/web/event/$id", params: { id: ev.id } })} style={{ display: "flex", gap: 26, alignItems: "stretch", background: SK.paper, border: `2.5px solid ${SK.ink}`, boxShadow: `6px 6px 0 ${SK.ink}`, padding: 16, cursor: "pointer" }}>
      {ev.p && !broken && <img className="cs-hero-img" src={ev.p} alt="" onError={() => { setBroken(true); onBroken?.(ev.id) }} style={{ flexShrink: 0, alignSelf: "center", maxWidth: 360, maxHeight: 420, width: "auto", height: "auto", border: `2px solid ${SK.ink}` }} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ background: SK.ink, color: SK.paper, fontFamily: FONT_SANS, fontWeight: 900, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", padding: "5px 11px" }}>{ev.c}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: SK.ink55 }}>выбор редакции</span>
        </div>
        <div className="cs-hero-title" style={{ fontWeight: 900, fontSize: fs, letterSpacing: "-0.02em", lineHeight: 1.02, textTransform: "uppercase", color: SK.ink, overflowWrap: "break-word" }}>{ev.t}</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          {/* дату/время не дублируем текстом — она уже в бейдже (accessBadges) */}
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: "0.03em", color: SK.ink, lineHeight: 1.6 }}>{ev.v && ev.v !== "—" && !ev.v.startsWith("@") ? ev.v : ""}</div>
          {bd.length > 0 && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{bd}</div>}
        </div>
      </div>
    </div>
  )
}

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "36px 0 18px" }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: SK.ink55 }}>{children}</span>
      <div style={{ flex: 1, height: 2, background: SK.ink }} />
    </div>
  )
}

// Стрелка-переключатель «выбора редакции» (веб-масштаб).
const WEB_HERO_ARROW: React.CSSProperties = { width: 34, height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `3px 3px 0 ${SK.blue}`, cursor: "pointer", fontWeight: 900, fontSize: 22, lineHeight: 1, color: SK.ink }

// ── Страница ────────────────────────────────────────────────────────────
export default function CsWebFeed() {
  const { derived } = useDerived()

  const allEvents = useMemo(() => Object.values(derived.pool).flat(), [derived])
  // Предстоящее (с начала сегодня), прошедшее-сегодня тонет вниз — как в мобиле.
  const upcoming = useMemo(() => {
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0)
    const c = cutoff.getTime(), now = Date.now()
    return allEvents
      // старт в будущем / без даты / ИЛИ ещё идёт (конец сегодня-позже) — идущие
      // многодневные выставки с прошедшим открытием не выпадают из каталога.
      .filter((e) => e.ts == null || e.ts >= c || (e.endTs != null && e.endTs >= c))
      .sort((a, b) => {
        const ap = a.ts != null && a.ts < now && !(a.endTs != null && a.endTs >= now)
        const bp = b.ts != null && b.ts < now && !(b.endTs != null && b.endTs >= now)
        if (ap !== bp) return ap ? 1 : -1
        const ka = a.ts != null && a.ts >= now ? a.ts : (a.endTs ?? a.ts ?? Infinity)
        const kb = b.ts != null && b.ts >= now ? b.ts : (b.endTs ?? b.ts ?? Infinity)
        return ka - kb
      })
  }, [allEvents])
  const withPoster = useMemo(() => upcoming.filter((e) => e.p), [upcoming])
  // Полка «для знатока» убрана — insider-контент теперь в общем каталоге.
  const mainE = withPoster

  // Битые постеры героя (404) — WebHero сообщает сюда, и мы выкидываем событие
  // из пула, авто-подставляя следующего кандидата (без «?»-глифа в шапке).
  const [brokenHero, setBrokenHero] = useState<Set<string>>(() => new Set())
  const markHeroBroken = (id: string) => setBrokenHero((p) => (p.has(id) ? p : new Set(p).add(id)))
  const heroPool = useMemo(() => {
    const now = Date.now()
    // Герой «выбор редакции» обязан быть с картинкой — событие без постера
    // (или с дохлым) в шапку не берём.
    const withPoster = mainE.filter((e) => e.p && !brokenHero.has(e.id))
    const src = withPoster.length ? withPoster : mainE
    const up = src.filter((e) => e.ts == null || e.ts >= now)
    const base = up.length ? up : src
    return [...base].sort((a, b) => {
      const s = heroScore(a) - heroScore(b)
      return s !== 0 ? s : (a.ts ?? Infinity) - (b.ts ?? Infinity)
    })
  }, [mainE, brokenHero])
  // «Выбор редакции» листается стрелками (heroIdx) по топ-N кандидатам heroPool.
  const [heroIdx, setHeroIdx] = useState(0)
  const heroN = Math.min(heroPool.length, 8)
  const heroCur = heroN ? (((heroIdx % heroN) + heroN) % heroN) : 0
  const hero = heroN ? heroPool[heroCur] : heroPool[0]
  const rest = useMemo(() => mainE.filter((e) => e !== hero), [mainE, hero])

  const cats = useMemo(() => {
    const seen: string[] = []
    for (const e of mainE) if (e.c && e.c !== "—" && !seen.includes(e.c)) seen.push(e.c)
    const origIdx = new Map(seen.map((c, i) => [c, i]))
    const pr = (c: string) => { const i = CAT_PRIORITY.indexOf(c); return i === -1 ? 99 : i }
    const ordered = [...seen].sort((a, b) => (pr(a) - pr(b)) || (origIdx.get(a)! - origIdx.get(b)!))
    return ["Все", ...ordered]
  }, [mainE])
  // Сид перемешивания — свой на каждый заход (загрузку страницы). Каталог
  // тасуется со сдвигом по рангу: качество вверху сохраняется, но порядок разный.
  const [shuffleSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [cat, setCat] = useState("Все")        // 1-й уровень — крупная категория
  const [tag, setTag] = useState<string | null>(null) // 2-й уровень — подтег
  const [access, setAccess] = useState<string | null>(null) // фильтр по барьеру входа
  const [q, setQ] = useState("")
  // Поиск логируем с дебаунсом — settled-запрос, а не каждое нажатие.
  useEffect(() => {
    const query = q.trim()
    if (!query) return
    const t = setTimeout(() => analytics.track("cs.feed.filter", { kind: "search", value: query.slice(0, 80) }), 800)
    return () => clearTimeout(t)
  }, [q])
  // события выбранной категории (до сужения подтегом)
  const inCat = useMemo(() => (cat === "Все" ? rest : rest.filter((e) => e.c === cat)), [rest, cat])
  // подтеги 2-го уровня — те, что реально встречаются в этой категории, по частоте
  const tagChips = useMemo(() => {
    const freq = new Map<string, number>()
    for (const e of inCat) for (const t of e.tags || []) freq.set(t, (freq.get(t) || 0) + 1)
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([t]) => t)
  }, [inCat])
  // статусы доступа, встречающиеся в категории — в порядке «доступнее → сложнее»
  const accessOptions = useMemo(() => {
    const present = new Set<string>()
    for (const e of inCat) if (ACCESS_LABEL[e.access]) present.add(e.access)
    const order = ["free", "registration", "signup", "ticket", "accreditation", "registration_closed", "sold_out"]
    return order.filter((a) => present.has(a))
  }, [inCat])
  const catalog = useMemo(() => {
    let list = tag ? inCat.filter((e) => e.tags?.includes(tag)) : inCat
    if (access) list = list.filter((e) => e.access === access)
    const query = q.trim().toLowerCase()
    if (query) list = list.filter((e) => `${e.t} ${e.v} ${e.ch} ${e.c}`.toLowerCase().includes(query))
    // Перемешивание со сдвигом по рангу: к позиции i прибавляем случайный сдвиг
    // (до ~60% длины), поэтому топ остаётся сверху, но порядок разный на заход.
    // Жёсткие барьеры (sold_out/closed) — всегда в конец, как в мобиле.
    const spread = list.length * 0.6
    return list
      .map((e, i) => ({ e, hard: HARD_ACCESS.has(e.access), key: i + seededRand(i, shuffleSeed) * spread }))
      .sort((a, b) => (a.hard === b.hard ? a.key - b.key : a.hard ? 1 : -1))
      .map((x) => x.e)
  }, [inCat, tag, access, q, shuffleSeed])

  // «Последний шанс» — идущие/будущие события, закрывающиеся в ближайшие дни
  // (в осн. выставки), по возрастанию дней до закрытия. Показываем отдельной
  // секцией на дефолт-виде и убираем их из общего каталога, чтобы не дублировать.
  const closing = useMemo(() => mainE
    .map((e) => ({ e, cs: closingSoon(e) }))
    .filter((x) => x.cs)
    .sort((a, b) => a.cs!.days - b.cs!.days)
    .map((x) => x.e), [mainE])
  const showClosing = cat === "Все" && !q.trim() && !access && closing.length > 0
  const closingSet = useMemo(() => new Set(closing.map((e) => e.id)), [closing])
  const catalogShown = showClosing ? catalog.filter((e) => !closingSet.has(e.id)) : catalog

  const ready = allEvents.length > 0

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: CS.W, color: SK.ink, fontFamily: FONT_SANS }}>
      <ScreenBG theme="grid" opacity={0.5} />
      <style>{`
        @keyframes cs-card-in { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .cs-card { animation: cs-card-in 0.46s cubic-bezier(0.22,1,0.36,1) both; will-change: opacity, transform; }
        @media (prefers-reduced-motion: reduce) { .cs-card { animation: none } }
        /* Мобилка: десктоп-лента адаптируется под узкий экран. Горизонтальный
           hero складывается в колонку (иначе колонка деталей ужималась до ~1
           символа и вёрстка «слетала»). !important — перебить inline-стили. */
        @media (max-width: 640px) {
          .cs-wrap { padding: 18px 14px 72px !important; }
          .cs-head-title { font-size: 32px !important; }
          .cs-search { width: 100% !important; min-width: 0 !important; }
          .cs-hero { flex-direction: column !important; gap: 14px !important; padding: 12px !important; }
          .cs-hero-img { max-width: 100% !important; width: 100% !important; max-height: none !important; align-self: stretch !important; }
          .cs-hero-title { font-size: 24px !important; }
        }
      `}</style>
      <div className="cs-wrap" style={{ position: "relative", maxWidth: 1360, margin: "0 auto", padding: "40px 32px 90px" }}>

              {/* header — карточка «Что в городе» РАСТЯНУТА на всю свободную ширину
                  (заголовок слева, счётчик справа — чтобы не пустовала), а поиск
                  остаётся своей компактной ширины */}
              <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 460px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, background: SK.paper, border: `2.5px solid ${SK.ink}`, boxShadow: `5px 5px 0 ${SK.ink}`, padding: "16px 24px 18px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", color: SK.ink55 }}>афиша · москва</div>
                    <div className="cs-head-title" style={{ fontWeight: 900, fontSize: 54, letterSpacing: "-0.045em", lineHeight: 0.92, marginTop: 6 }}>Что в городе</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right", lineHeight: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 44, letterSpacing: "-0.03em", color: SK.ink }}>{mainE.length}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: SK.ink55, marginTop: 7 }}>событий впереди</div>
                  </div>
                </div>
                <div className="cs-search" style={{ flex: "0 0 auto", width: 320, minWidth: 240, display: "flex", alignItems: "center", gap: 10, border: `2px solid ${SK.ink}`, background: SK.paper, boxShadow: `3px 3px 0 ${CS.B}`, padding: "15px 18px" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7.5" cy="7.5" r="5.3" stroke={SK.ink} strokeWidth="2.2" /><line x1="11.5" y1="11.5" x2="16" y2="16" stroke={SK.ink} strokeWidth="2.2" strokeLinecap="round" /></svg>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по афише…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: FONT_MONO, fontSize: 14, letterSpacing: "0.02em", color: SK.ink }} />
                  {q && <button onClick={() => setQ("")} aria-label="Очистить" style={{ border: "none", background: "none", cursor: "pointer", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 16, color: SK.ink55 }}>✕</button>}
                </div>
              </div>

              {/* category filter */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
                {cats.map((c) => {
                  const on = cat === c
                  const sym = c !== "Все" ? CAT_SYM.get(c) : undefined
                  return (
                    <button key={c} onClick={() => { setCat(c); setTag(null); analytics.track("cs.feed.filter", { kind: "category", value: c }) }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : SK.paper, color: on ? SK.paper : SK.ink, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", boxShadow: on ? `3px 3px 0 ${CS.B}` : "none" }}>
                      {sym && <span style={{ fontWeight: 400, fontSize: 15, lineHeight: 1 }}>{sym}</span>}{c}
                    </button>
                  )
                })}
              </div>

              {/* Фильтр по доступу — «на что можно просто прийти». Чипы выглядят как
                  сами бейджи (квадрат-индикатор), чтобы связь читалась. */}
              {accessOptions.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: SK.ink55 }}>доступ</span>
                  {accessOptions.map((a) => {
                    const on = access === a
                    return (
                      <button key={a} onClick={() => { setAccess(on ? null : a); if (!on) analytics.track("cs.feed.filter", { kind: "access", value: a }) }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px 7px 8px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : SK.paper, color: on ? "#fff" : SK.ink, boxShadow: on ? `3px 3px 0 ${CS.B}` : `3px 3px 0 ${SK.ink}`, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}>
                        <span style={{ width: 12, height: 12, flex: "0 0 auto", background: on ? "#fff" : accessSquare(a) }} />
                        {ACCESS_LABEL[a]}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 2-й уровень — подтеги выбранной категории (появляется, только когда
                  категория выбрана и подтеги есть) */}
              {cat !== "Все" && tagChips.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: SK.ink55 }}>уточнить · <span style={{ color: CS.B, fontWeight: 700 }}>{cat}</span></span>
                  {tagChips.map((t) => {
                    const on = tag === t
                    return (
                      <button key={t} onClick={() => { setTag(on ? null : t); if (!on) analytics.track("cs.feed.filter", { kind: "tag", value: t }) }} style={{ padding: "8px 14px", border: `2px solid ${SK.ink}`, background: on ? SK.ink : CS.B, color: "#fff", boxShadow: `3px 3px 0 ${on ? CS.B : SK.ink}`, fontFamily: FONT_SANS, fontWeight: 800, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}>{t}</button>
                    )
                  })}
                </div>
              )}

              {!ready ? (
                <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: SK.ink55, letterSpacing: "0.04em", padding: "80px 0", textAlign: "center" }}>загружаем афишу…</div>
              ) : (
                <>
                  {/* hero — только когда не ищем/не фильтруем, как «выбор редакции» */}
                  {cat === "Все" && !q.trim() && !access && hero && (
                    <>
                      {/* «выбор редакции» + листание: стрелки ‹ N/M › крутят топ-кандидатов */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "36px 0 18px" }}>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: SK.ink55 }}>выбор редакции</span>
                        <div style={{ flex: 1, height: 2, background: SK.ink }} />
                        {heroN > 1 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <button onClick={() => setHeroIdx((i) => i - 1)} aria-label="Предыдущий вариант" style={WEB_HERO_ARROW}>‹</button>
                            <span style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.06em", color: SK.ink55, minWidth: 40, textAlign: "center" }}>{heroCur + 1}/{heroN}</span>
                            <button onClick={() => setHeroIdx((i) => i + 1)} aria-label="Следующий вариант" style={WEB_HERO_ARROW}>›</button>
                          </div>
                        )}
                      </div>
                      <WebHero key={hero.id} ev={hero} onBroken={markHeroBroken} />
                    </>
                  )}

                  {showClosing && (
                    <>
                      <SectionRule>последний шанс · закрывается скоро</SectionRule>
                      {/* CSS-grid auto-fit, а не MasonryCols: если у события битый постер,
                          карточка рендерит null и просто исчезает из DOM — остальные
                          сами сдвигаются влево, пустой колонки-«дыры» не остаётся */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22, alignItems: "start" }}>
                        {closing.map((ev, i) => <WebCard key={ev.id} ev={ev} i={i} />)}
                      </div>
                    </>
                  )}

                  <SectionRule>{cat === "Все" ? "каталог" : cat.toLowerCase()}{access ? ` · ${ACCESS_LABEL[access]}` : ""}{q.trim() ? ` · поиск «${q.trim()}»` : ""}</SectionRule>
                  {catalogShown.length > 0 ? (
                    // key завязан на фильтр — при смене категории/подтега/доступа/поиска
                    // грид перемонтируется и ступенчатая анимация появления проигрывается заново
                    <MasonryCols key={`${cat}|${tag ?? ""}|${access ?? ""}|${q.trim()}`} items={catalogShown} />
                  ) : (
                    <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: SK.ink55, letterSpacing: "0.04em", padding: "40px 0" }}>ничего не нашлось</div>
                  )}
                </>
              )}

      </div>
    </div>
  )
}
