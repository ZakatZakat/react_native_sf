/**
 * CitySignal · 07 · Лента (v3 scrapbook).
 *
 *  Three brand-aligned collage views:
 *    • Дневник  (DiaryView)   — free poster collage with angled cutouts
 *    • Доска    (BoardView)   — two columns with profile + refresh on top
 *    • Журнал   (JournalView) — calm reading column, alternates L/R
 *
 *  All views reuse Curator events through useDerived().feed and render
 *  through the Clip/Polaroid scrapbook atoms in shared.tsx. Edge presets
 *  (Контур/Жирный/Карточка/Паспарту) flow via EdgeCtx.
 *
 *  URL params:
 *    ?view=diary|board|journal   (default: board)
 *    ?edge=thin|bold|card|mat    (default: thin)
 *    ?btn=a|b|c                  (refresh-glyph variant on Board; default b)
 *
 *  The previous 7-variant editorial feed (Cover/Shelves/Magazine/Catalog/
 *  Spread/Billboard/Combo) is removed per v3 spec.
 */

import { useContext, useMemo, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  CS, FONT_MONO, FONT_SANS, ScreenBG,
  NavCtx, ProfileBadge, BillboardProfileBadge,
  EventModalProvider, GoingProvider, useOpenEvent,
  // v3 scrapbook
  SK, EdgeCtx, EDGE_PRESETS,
  Clip, Polaroid, Hand, Lbl, Scribble, Sparkle, Avatar, SkMark,
} from "./shared"
import type { Ev } from "./buildDerived"
import { useDerived, useJourneyState } from "./useJourney"
import CsFeedLegacy from "./FeedLegacy"

const FALLBACK: Ev = {
  id: "—", t: "—", sub: "", v: "—", d: "—", tm: "—",
  p: null, c: "—", catKey: "", ch: "@—",
  desc: "", price: "—", note: "",
}

/** Pick N events from the feed; pad with positionally-unique placeholders
 *  so views with hardcoded slots can still render layout while the feed
 *  warms up (unique ids keep React's reconciliation happy). */
function pad(feed: Ev[], n: number): Ev[] {
  const out: Ev[] = feed.slice(0, n)
  while (out.length < n) out.push({ ...FALLBACK, id: `__placeholder_${out.length}` })
  return out
}

// ── VARIANT 1 · Дневник ─────────────────────────────────────────────────

function DiaryView({ feed }: { feed: Ev[] }) {
  const E = pad(feed, 8)
  return (
    <div style={{ position: "relative", width: "100%", minHeight: 1180, paddingBottom: 60 }}>
      <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
        <Lbl size={9} style={{ letterSpacing: "0.3em" }}>пятница · 23 мая</Lbl>
        <div style={{ fontWeight: 900, fontSize: 44, letterSpacing: "-0.045em", lineHeight: 0.9, marginTop: 5, color: SK.ink }}>Москва</div>
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", marginTop: 7 }}>
          <Lbl color={SK.ink} size={10} style={{ fontWeight: 700, letterSpacing: "0.24em" }}>неделя 22</Lbl>
          <Scribble color={"#E0162B"} w={64} style={{ marginTop: 2 }} />
        </div>
        <Sparkle color={SK.blue} s={17} style={{ position: "absolute", top: 20, left: 60 }} />
        <Sparkle color={"#E0162B"} s={12} style={{ position: "absolute", top: 60, right: 56 }} />
      </div>
      <div style={{ position: "absolute", top: 120, right: 10, textAlign: "right", zIndex: 3 }}>
        <Hand color={"#E0162B"} size={20} style={{ marginRight: 2 }}>кто ведёт</Hand>
        {feed.slice(0, 3).map((ev, k) => (
          <div key={ev.id + k} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
            <Avatar label={ev.ch.replace(/^@/, "").slice(0, 1).toUpperCase()} color={[SK.blue, "#E0162B", SK.blue][k]} s={18} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: SK.ink }}>{ev.ch}</span>
          </div>
        ))}
      </div>

      <Polaroid ev={E[0]} w={128} rot={-4} ar={1.12} caption="до утра" capColor={SK.blue} style={{ position: "absolute", left: 10, top: 186 }} />
      <Hand color={SK.ink} size={17} style={{ position: "absolute", left: 12, top: 376, zIndex: 5 }}>{E[0].c || "клуб"} · {E[0].v.slice(0, 20)}</Hand>

      <Clip ev={E[3]} w={114} h={150} rot={4} style={{ position: "absolute", right: 12, top: 298 }} />
      <Hand color={SK.blue} size={19} style={{ position: "absolute", right: 12, top: 456, textAlign: "right", zIndex: 5 }}>{E[3].price !== "—" ? E[3].price : "вход свободный"}</Hand>

      <div style={{ position: "absolute", left: 14, top: 420, zIndex: 5 }}>
        <Hand color={SK.ink} size={16} style={{ display: "block", marginBottom: 3 }}>
          <SkMark color={SK.blue}>лид недели —</SkMark>
        </Hand>
        <Polaroid ev={E[1]} w={140} rot={3} ar={0.84} caption="редакция топит" capColor={"#E0162B"} />
      </div>
      <Sparkle color={SK.blue} s={15} style={{ position: "absolute", left: 150, top: 456 }} />

      <Clip ev={E[4]} w={112} h={146} rot={-5} style={{ position: "absolute", right: 14, top: 552 }} />
      <div style={{ position: "absolute", right: 12, top: 706, textAlign: "right", zIndex: 5 }}>
        <Hand color={SK.blue} size={19}>open-air</Hand>
        <div><Lbl size={9}>{E[4].d} · {E[4].tm}</Lbl></div>
      </div>

      <div style={{ position: "absolute", left: 112, top: 662, zIndex: 7, display: "inline-flex", alignItems: "center", gap: 6, background: SK.paper, border: `2px solid ${SK.ink}`, padding: "7px 12px", transform: "rotate(-2deg)", boxShadow: "2px 2px 0 rgba(22,20,15,0.25)" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: SK.blue }} />
        <Lbl color={SK.ink} size={10} style={{ fontWeight: 700, letterSpacing: "0.18em" }}>иду · {Math.max(1, Math.floor(feed.length / 2))}</Lbl>
      </div>

      <Clip ev={E[5]} w={118} h={148} rot={4} style={{ position: "absolute", left: 14, top: 736 }} />
      <Hand color={"#E0162B"} size={19} style={{ position: "absolute", left: 16, top: 896, zIndex: 5 }}>успей · {E[5].price !== "—" ? E[5].price : "ограничено"}</Hand>

      <Polaroid ev={E[7]} w={116} rot={-3} ar={1.0} caption="премьера" capColor={SK.ink} style={{ position: "absolute", right: 12, top: 762 }} />

      <div style={{ position: "absolute", left: 0, right: 0, top: 1000, textAlign: "center" }}>
        <Scribble color={SK.ink35} w={110} />
        <div><Lbl size={9} style={{ letterSpacing: "0.24em" }}>{feed.length} событий · msc—spb · wk22</Lbl></div>
      </div>
    </div>
  )
}

// ── VARIANT 2 · Доска ───────────────────────────────────────────────────

/** Short tag for the price chip — falls back to the time when the price
 *  is absent or too long to fit the rotated tag cleanly. */
function priceTag(ev: Ev): string {
  const p = (ev.price || "").trim()
  if (!p || p === "—") return ev.tm
  if (/свобод|беспл|free/i.test(p)) return "free"
  return p.length <= 10 ? p : ev.tm
}

/** Deterministic social-proof "идут N" count derived from the event id —
 *  stable across renders, in the 40..280 range. */
function goingCount(ev: Ev): number {
  let h = 0
  for (const ch of ev.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return 40 + (h % 240)
}

/** Board card — poster with a category badge (top-left) + price chip
 *  (top-right, overhanging) and a clean title + "идут N" caption below.
 *  Matches the polished v3 board design. */
function BoardCard({ ev, i }: { ev: Ev; i: number }) {
  const rot = [-3, 2.5, -2, 3][i % 4]
  const dur = (4.6 + (Math.abs(rot) % 3) * 0.7).toFixed(2)
  const delay = ((Math.abs(Math.round(rot * 7)) % 20) / 10).toFixed(2)
  const open = useOpenEvent()
  return (
    <div style={{ marginBottom: 6, animation: `sk-refresh 0.5s cubic-bezier(0.22,1,0.36,1) ${(i * 0.06).toFixed(2)}s both` }}>
      {/* poster (floats gently); badge + price tag overhang, so the
          rotated wrapper keeps overflow visible. */}
      <div style={{ animation: `sk-float ${dur}s ease-in-out ${delay}s infinite` }}>
        <div
          onClick={() => open(ev)}
          style={{
            position: "relative", width: "100%", aspectRatio: "4 / 5",
            transform: `rotate(${rot}deg)`,
            background: SK.paper,
            border: `2px solid ${SK.ink}`, boxShadow: `3px 3px 0 ${SK.ink}`,
            cursor: "pointer",
          }}
        >
          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            {ev.p && (
              <img src={ev.p} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
          </div>
          {/* category badge — top-left */}
          {ev.c !== "—" && (
            <div style={{ position: "absolute", top: 8, left: 8, background: SK.ink, color: SK.paper, padding: "4px 8px", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1 }}>{ev.c}</div>
          )}
          {/* price tag — top-right, rotated, overhanging */}
          <div style={{ position: "absolute", top: 6, right: -5, background: SK.paper, border: `1.5px solid ${SK.ink}`, padding: "4px 8px", transform: "rotate(4deg)", fontFamily: FONT_SANS, fontWeight: 900, fontSize: 11, color: SK.ink, lineHeight: 1, boxShadow: `2px 2px 0 ${SK.ink}`, whiteSpace: "nowrap" }}>{priceTag(ev)}</div>
        </div>
      </div>
      {/* title + caption — clean, no box */}
      <div style={{ marginTop: 14, paddingLeft: 2 }}>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em", lineHeight: 1.0, color: SK.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.t}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.04em", color: SK.ink55, marginTop: 6 }}>
          {ev.d} · {ev.tm} · <span style={{ color: SK.blue, fontWeight: 700 }}>идут {goingCount(ev)}</span>
        </div>
      </div>
    </div>
  )
}

function RefreshGlyph({ variant = "b", spin = 0 }: { variant?: string; spin?: number }) {
  const wrap = (children: React.ReactNode) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <g style={{ transformOrigin: "12px 12px", transform: `rotate(${spin}deg)`, transition: "transform 0.7s cubic-bezier(0.34,1.12,0.64,1)" }}>{children}</g>
    </svg>
  )
  if (variant === "b") {
    // two chasing arrows (recycle)
    return wrap(<>
      <path d="M5 9 A7 7 0 0 1 18 7.5" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" />
      <polygon points="18,3.5 19.5,8.5 14,8" fill={SK.blue} />
      <path d="M19 15 A7 7 0 0 1 6 16.5" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" />
      <polygon points="6,20.5 4.5,15.5 10,16" fill={SK.blue} />
    </>)
  }
  if (variant === "c") {
    // rotating square + dot
    return wrap(<>
      <rect x="5.5" y="5.5" width="13" height="13" stroke={SK.ink} strokeWidth="2" />
      <circle cx="12" cy="12" r="2.6" fill={SK.blue} />
    </>)
  }
  // a — single circular arrow
  return wrap(<>
    <path d="M12 5 A7 7 0 1 1 5 12" fill="none" stroke={SK.ink} strokeWidth="2" strokeLinecap="round" />
    <polygon points="12.2,1.6 12.2,8.4 16.8,5" fill={SK.blue} />
  </>)
}

function BoardView({ feed, btn = "b", name = "Гость" }: { feed: Ev[]; btn?: string; name?: string }) {
  const nav = useContext(NavCtx)
  const [nonce, setNonce] = useState(0)
  const [sweep, setSweep] = useState(0)
  // Shuffle deterministically by nonce so the order changes on every tap of refresh
  const order = useMemo(() => {
    const idx = feed.map((_, i) => i)
    return idx.sort((a, b) => ((a * 7 + nonce * 13) % 11) - ((b * 7 + nonce * 13) % 11))
  }, [nonce, feed])
  // Use only real events (drop warm-up placeholders) so the board never
  // shows empty cards; split into two staggered columns.
  const E = order.map((i) => feed[i]).filter((e) => e && !e.id.startsWith("__placeholder")).slice(0, 8)
  const colL = E.filter((_, i) => i % 2 === 0)
  const colR = E.filter((_, i) => i % 2 === 1)
  const refresh = () => { setNonce((n) => n + 1); setSweep((s) => s + 360) }

  return (
    <div style={{ width: "100%", paddingBottom: 54 }}>
      {/* header — title block on the left, profile + refresh on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "0 14px", marginBottom: 24 }}>
        <div style={{ flex: 1, minWidth: 0, background: SK.paper, border: `2px solid ${SK.ink}`, padding: "10px 12px 11px", transform: "rotate(-1deg)", boxShadow: `3px 3px 0 ${SK.ink}` }}>
          <Lbl size={9} style={{ letterSpacing: "0.3em" }}>доска недели · wk 22</Lbl>
          <div style={{ fontWeight: 900, fontSize: 27, letterSpacing: "-0.04em", lineHeight: 0.9, marginTop: 3, color: SK.ink }}>Что в городе</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
            <Lbl size={9}>москва — спб</Lbl>
            <Scribble color={SK.blue} w={40} />
          </div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, marginTop: 2 }}>
          <ProfileBadge name={name} onClick={nav.openProfile} />
          <button
            onClick={refresh}
            aria-label="Обновить ленту"
            style={{
              width: 38, height: 38, background: SK.paper,
              border: `2px solid ${SK.ink}`,
              boxShadow: `2.5px 2.5px 0 ${SK.blue}`,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}
          >
            <RefreshGlyph variant={btn} spin={sweep} />
          </button>
        </div>
      </div>
      {/* two columns — right column nudged down for a staggered montage */}
      <div key={nonce} style={{ display: "flex", gap: 16, padding: "0 16px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 30 }}>
          {colL.map((e, i) => <BoardCard key={e.id + nonce} ev={e} i={i * 2} />)}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 30, paddingTop: 40 }}>
          {colR.map((e, i) => <BoardCard key={e.id + nonce} ev={e} i={i * 2 + 1} />)}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 30 }}>
        <span style={{ display: "inline-block", background: SK.ink, color: SK.paper, padding: "6px 12px", transform: "rotate(-1deg)" }}>
          <Lbl color={SK.paper} size={9} style={{ letterSpacing: "0.2em" }}>{feed.length} приколото · обновлено сейчас</Lbl>
        </span>
      </div>
    </div>
  )
}

// ── VARIANT 3 · Журнал ──────────────────────────────────────────────────

const NOTE_COLORS = [SK.blue, "#E0162B", SK.blue, "#E0162B"]

function JournalEntry({ ev, i }: { ev: Ev; i: number }) {
  const flip = i % 2 === 1
  const rot = [-3, 2.5, -2, 3][i % 4]
  const nc = NOTE_COLORS[i % 4]
  // Channel + venue copy on a per-side basis
  return (
    <div style={{
      position: "relative", display: "flex", gap: 13,
      alignItems: "flex-start",
      flexDirection: flip ? "row-reverse" : "row",
      padding: "0 18px", marginBottom: 8,
    }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Clip ev={ev} w={100} h={130} rot={rot} />
        <div style={{
          position: "absolute", bottom: -10,
          [flip ? "left" : "right"]: -4,
          fontFamily: FONT_MONO, fontSize: 8, letterSpacing: "0.08em",
          color: SK.ink55, transform: `rotate(${flip ? 4 : -4}deg)`,
        }}>{ev.ch}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 6, textAlign: flip ? "right" : "left" }}>
        <div style={{ display: "inline-block" }}>
          <SkMark color={SK.blue}>
            <Lbl color={SK.paper} size={9} style={{ fontWeight: 700, letterSpacing: "0.16em" }}>{ev.c}</Lbl>
          </SkMark>
        </div>
        <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.02em", lineHeight: 1.0, marginTop: 7, color: SK.ink }}>{ev.t}</div>
        {ev.sub && (
          <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: 10.5, color: SK.ink55, marginTop: 2 }}>{ev.sub}</div>
        )}
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.05em", color: SK.ink, marginTop: 7, lineHeight: 1.5 }}>
          {ev.v}<br />{ev.d} · {ev.tm} · {ev.price}
        </div>
        {ev.note && (
          <Hand color={nc} size={18} rot={flip ? 2 : -2} style={{ marginTop: 5 }}>{ev.note}</Hand>
        )}
      </div>
    </div>
  )
}

function JournalView({ feed, name = "Гость" }: { feed: Ev[]; name?: string }) {
  const nav = useContext(NavCtx)
  return (
    <div style={{ width: "100%", paddingBottom: 50 }}>
      <div style={{ padding: "0 18px" }}>
        <Lbl size={9} style={{ letterSpacing: "0.3em" }}>пятница · 23 мая · wk 22</Lbl>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 3 }}>
          <div style={{ fontWeight: 900, fontSize: 38, letterSpacing: "-0.045em", lineHeight: 0.86, color: SK.ink }}>Лента</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ display: "flex" }}>
              {feed.slice(0, 3).map((ev, k) => (
                <Avatar
                  key={ev.id + k}
                  label={ev.ch.replace(/^@/, "").slice(0, 1).toUpperCase()}
                  color={[SK.blue, "#E0162B", SK.blue][k]}
                  s={21}
                  style={{ marginLeft: k ? -7 : 0 }}
                />
              ))}
            </div>
            <ProfileBadge name={name} onClick={nav.openProfile} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
          <Hand color={SK.blue} size={19} rot={-1}>{feed.length} событий, отобранных вручную</Hand>
          <Sparkle color={"#E0162B"} s={13} />
        </div>
        <div style={{ height: 2, background: SK.ink, marginTop: 10 }} />
      </div>
      <div style={{ height: 20 }} />
      {feed.map((ev, i) => (
        <div key={ev.id + i}>
          <JournalEntry ev={ev} i={i} />
          {i < feed.length - 1 && (
            <div style={{ textAlign: "center", margin: "13px 0 17px" }}>
              <Scribble color={"rgba(13,13,13,0.16)"} w={140} />
            </div>
          )}
        </div>
      ))}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Hand color={SK.ink35} size={18}>— это всё на этой неделе —</Hand>
      </div>
    </div>
  )
}

// ── Billboard-style "dark" header used by views that ride on black ───────
// (kept available for future variants; not used in any of the 3 main views
// — but BillboardProfileBadge is still exported via shared.tsx) //
void BillboardProfileBadge

// ── Page entry — switches between the three views ───────────────────────

type FeedView = "diary" | "board" | "journal"
type FeedEdge = "thin" | "bold" | "card" | "mat"
type FeedBtn = "a" | "b" | "c"

export default function CsFeed() {
  const navigate = useNavigate()
  const { derived } = useDerived()
  const { name } = useJourneyState()
  const search = useSearch({ strict: false }) as Record<string, string | undefined>

  // Legacy editorial feed (pre-v3 Cover/Shelves/Magazine/...) is preserved
  // and reachable via ?legacy=1&v=0..6. Useful for design comparison.
  // Note: tanstack-router may parse "1" as number, so check truthy + not "0".
  if (search.legacy && String(search.legacy) !== "0") return <CsFeedLegacy />

  // v3 defaults: Доска · Контур · Цикл (per "Клиентский путь прод v3.html").
  const view: FeedView = (["diary", "board", "journal"].includes(search.view ?? "")
    ? (search.view as FeedView)
    : "board")
  const edgeKey: FeedEdge = (["thin", "bold", "card", "mat"].includes(search.edge ?? "")
    ? (search.edge as FeedEdge)
    : "thin")
  const btn: FeedBtn = (["a", "b", "c"].includes(search.btn ?? "")
    ? (search.btn as FeedBtn)
    : "b")

  const safeName = name.trim() || "Гость"
  const feed = derived.feed
  const edge = EDGE_PRESETS[edgeKey] ?? EDGE_PRESETS.thin

  const navValue = useMemo(
    () => ({ openProfile: () => navigate({ to: "/cs/profile" }) }),
    [navigate],
  )

  let inner: React.ReactNode
  if (view === "diary") inner = <DiaryView feed={feed} />
  else if (view === "journal") inner = <JournalView feed={feed} name={safeName} />
  else inner = <BoardView feed={feed} btn={btn} name={safeName} />

  return (
    <NavCtx.Provider value={navValue}>
      <GoingProvider>
        <EventModalProvider>
          <EdgeCtx.Provider value={edge}>
            {/* relative + 100dvh gives the absolute children a real
                positioning context (the App's Chakra Container is static
                with 0 content-height so absolute-only didn't fill the
                viewport). */}
            <div style={{
              position: "relative", width: "100%", height: "100dvh",
              background: CS.W, fontFamily: FONT_SANS, color: SK.ink,
              overflow: "hidden",
            }}>
              <ScreenBG theme="grid" opacity={0.5} />
              <div className="sk-scroll" key={view} style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
                <div style={{ height: 46 }} />
                {inner}
              </div>
            </div>
          </EdgeCtx.Provider>
        </EventModalProvider>
      </GoingProvider>
    </NavCtx.Provider>
  )
}

// Silence unused-import warning for FONT_MONO in case linter complains —
// (Hand and other atoms use it directly).
void FONT_MONO
