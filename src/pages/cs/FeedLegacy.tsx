/**
 * CitySignal · Legacy Feed (pre-v3 editorial layout).
 *
 *  The 7-variant editorial feed (Cover/Shelves/Magazine/Catalog/Spread/
 *  Billboard/Combo) was replaced by the v3 scrapbook design (Дневник/
 *  Доска/Журнал). This file is preserved as a fallback — Feed.tsx routes
 *  to it when the URL carries `?legacy=1`:
 *    /cs/feed?legacy=1&v=0..6        (default v = 6, Combo)
 *
 *  Pick via ?v=0..6 (0=Cover, 1=Shelves, 2=Magazine, 3=Catalog, 4=Spread,
 *  5=Billboard, 6=Combo). All variants share `FeedHeader` and pull from
 *  the same Curator-derived bundle via useDerived().
 *
 *  Note: the EventSheet that opens from any tap here is the v3-redesigned
 *  one (shared.tsx) — bigger poster, no meta-rows table, single "Добавить"
 *  CTA. Going store + reminder toggle still apply.
 */

import { useContext, useEffect, useRef, useState, useMemo } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  CsPage, CS, FONT_MONO, FONT_SANS, DuotonePoster, Mark, Mono,
  NavCtx, ProfileBadge, BillboardProfileBadge,
  EventModalProvider, useOpenEvent,
  GoingProvider,
} from "./shared"
import type { Ev, DerivedData } from "./buildDerived"
import { useDerived, useJourneyState } from "./useJourney"

// ── Shared header ────────────────────────────────────────────────────────

function FeedHeader({ name, right, onReset }: { name: string; right: React.ReactNode; onReset?: () => void }) {
  const nav = useContext(NavCtx)
  return (
    <div style={{ padding: "0 18px 10px", borderBottom: `2px solid ${CS.K}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
      <div>
        <Mark color={CS.G55}>N° 001 · лента · {name.trim().split(/\s+/)[0]}</Mark>
        <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 0.9, letterSpacing: "-0.04em", textTransform: "uppercase", color: CS.K, marginTop: 6 }}>Эта неделя</div>
      </div>
      {/* Right side: count + profile badge (tap → /cs/profile via NavCtx). */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 900, fontSize: 22, color: CS.B, letterSpacing: "-0.04em", cursor: onReset ? "pointer" : "default" }} onClick={onReset} title={onReset ? "Заново" : ""}>{right}</span>
        <ProfileBadge name={name} onClick={nav.openProfile} />
      </div>
    </div>
  )
}

function FeedEmpty({ name }: { name: string }) {
  return (
    <CsPage>
      <div style={{ padding: "44px 22px" }}>
        <FeedHeader name={name} right="0" />
        <div style={{ marginTop: 22, padding: 22, border: `2px solid ${CS.K}`, background: CS.W, color: CS.G55, fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>
          Лента пуста — попробуй обновить или зайти позже.
        </div>
      </div>
    </CsPage>
  )
}

// ── Variant 0 · Cover ────────────────────────────────────────────────────

function VCover({ name, feed, onReset }: { name: string; feed: Ev[]; onReset: () => void }) {
  if (feed.length === 0) return <FeedEmpty name={name} />
  const hero = feed[0]
  const rest = feed.slice(1, 5)
  return (
    <CsPage>
      <div style={{ position: "absolute", inset: 0, padding: "44px 0 22px", display: "flex", flexDirection: "column" }}>
        <FeedHeader name={name} right={feed.length} onReset={onReset} />
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 0" }}>
          <div style={{ border: `2.5px solid ${CS.K}`, background: CS.K, boxShadow: `5px 5px 0 ${CS.B}` }}>
            <div style={{ position: "relative", overflow: "hidden", aspectRatio: "1.42 / 1" }}>
              <DuotonePoster src={hero.p} style={{ position: "absolute", inset: 0 }} />
              <div style={{ position: "absolute", top: 8, left: 8, zIndex: 3, background: CS.W, color: CS.K, padding: "4px 8px", fontWeight: 900, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", border: `1.5px solid ${CS.K}`, lineHeight: 1 }}>N°01 · главный</div>
              <div style={{ position: "absolute", top: 8, right: 8, zIndex: 3, background: CS.K, color: CS.W, padding: "5px 9px", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em" }}>{hero.d} · {hero.tm}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 11px", background: CS.W, borderTop: `2px solid ${CS.K}`, borderBottom: `2px solid ${CS.K}`, fontFamily: FONT_MONO, fontSize: 9, color: CS.G55, letterSpacing: "0.06em" }}>
              <span style={{ color: CS.B, fontWeight: 700 }}>{hero.c}</span>
            </div>
            <div style={{ background: CS.K, color: CS.W, padding: "12px 13px 13px" }}>
              <div style={{ fontWeight: 900, fontSize: 25, lineHeight: 0.94, letterSpacing: "-0.04em", textTransform: "uppercase" }}>{hero.t}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 7, letterSpacing: "0.04em" }}>{hero.v}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, paddingBottom: 6, borderBottom: `1.5px solid ${CS.K}`, display: "flex", justifyContent: "space-between" }}>
            <Mark>Ещё в ленте / +{rest.length}</Mark><Mark color={CS.G55}>WK 22</Mark>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 9 }}>
            {rest.map((e, i) => (
              <div key={i} style={{ display: "flex", border: `2px solid ${CS.K}`, background: CS.W, minHeight: 66 }}>
                <DuotonePoster src={e.p} style={{ width: 60, flexShrink: 0, alignSelf: "stretch", borderRight: `2px solid ${CS.K}` }} />
                <div style={{ flex: 1, padding: "8px 10px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><Mono color={CS.B}>{e.c}</Mono><Mono>{e.d} · {e.tm}</Mono></div>
                  <div style={{ fontWeight: 900, fontSize: 13, lineHeight: 0.98, letterSpacing: "-0.025em", textTransform: "uppercase", color: CS.K, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CsPage>
  )
}

// ── Variant 1 · Shelves ──────────────────────────────────────────────────

function ShelfCard({ ev }: { ev: Ev }) {
  const [hover, setHover] = useState(false)
  const openEvent = useOpenEvent()
  return (
    <div
      onClick={() => openEvent(ev)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0, scrollSnapAlign: "start", width: 142, height: 204,
        position: "relative", overflow: "hidden",
        border: `2px solid ${CS.K}`, background: CS.W, cursor: "pointer",
        boxShadow: hover ? `4px 4px 0 ${CS.B}` : "none",
        transform: hover ? "translate(-2px,-2px)" : "translate(0,0)",
        transition: "transform 0.14s, box-shadow 0.14s",
      }}
    >
      <DuotonePoster src={ev.p} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", top: 6, right: 6, zIndex: 3, background: CS.K, color: CS.W, padding: "3px 6px", fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.06em" }}>{ev.d}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: CS.W, borderTop: `1.5px solid ${CS.K}`, padding: "8px 9px 9px" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: CS.G55, letterSpacing: "0.04em", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.tm}</div>
        <div style={{ fontWeight: 900, fontSize: 12, lineHeight: 1.05, letterSpacing: "-0.02em", textTransform: "uppercase", color: CS.K, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 24 }}>{ev.t}</div>
        <div style={{ fontWeight: 600, fontSize: 9.5, color: CS.G55, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.v}</div>
      </div>
    </div>
  )
}

function Shelf({ cat, hits, evs, note, idx }: { cat: string; hits: number; evs: Ev[]; note: string; idx: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [page, setPage] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const onScroll = () => setPage(Math.min(evs.length - 1, Math.max(0, Math.round(el.scrollLeft / 152))))
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [evs.length])
  return (
    <section style={{ marginTop: idx === 0 ? 0 : 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 7, borderBottom: `2px solid ${CS.K}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: CS.G55 }}>{String(idx + 1).padStart(2, "0")}</span>
          <span style={{ fontWeight: 900, fontSize: 19, lineHeight: 1, letterSpacing: "-0.03em", textTransform: "uppercase" }}>{cat}</span>
          <span style={{ display: "inline-flex", gap: 3, alignItems: "center", paddingLeft: 4 }}>
            {Array.from({ length: hits }).map((_, i) => <span key={i} style={{ width: 6, height: 6, background: CS.B, display: "inline-block" }} />)}
          </span>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: CS.K, fontWeight: 700, letterSpacing: "0.06em" }}>{String(page + 1).padStart(2, "0")} / {String(evs.length).padStart(2, "0")} →</span>
      </div>
      {note ? <div style={{ fontWeight: 600, fontSize: 11, lineHeight: 1.35, color: CS.G55, margin: "7px 0 2px" }}>{note}</div> : null}
      <div style={{ margin: "8px -18px 0" }}>
        <div ref={ref} className="cs-shelf" style={{ display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden", padding: "2px 18px 10px", scrollSnapType: "x mandatory" }}>
          {evs.map((ev, i) => <ShelfCard key={i} ev={ev} />)}
        </div>
      </div>
    </section>
  )
}

function VShelves({ name, feed, shelves, onReset }: { name: string; feed: Ev[]; shelves: DerivedData["shelves"]; onReset: () => void }) {
  return (
    <CsPage>
      <div style={{ position: "absolute", inset: 0, padding: "44px 0 22px", display: "flex", flexDirection: "column" }}>
        <FeedHeader name={name} right={feed.length} onReset={onReset} />
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: CS.K }}>Полки / Shelves</span>
            <Mark color={CS.G55}>{shelves.length} категорий · свайп →</Mark>
          </div>
          {shelves.map((s, i) => <Shelf key={s.cat} idx={i} cat={s.cat} hits={s.hits} evs={s.evs} note={s.note} />)}
        </div>
      </div>
    </CsPage>
  )
}

// ── Variant 2 · Magazine ─────────────────────────────────────────────────

function MagTile({ e, ar, big }: { e: Ev; ar?: string; big?: boolean }) {
  const lines = big ? 2 : 1
  return (
    <div style={{ position: "relative", border: `2.5px solid ${CS.K}`, overflow: "hidden", aspectRatio: ar, boxShadow: `3px 3px 0 ${CS.B}` }}>
      <DuotonePoster src={e.p} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", top: 6, left: 6, background: CS.W, color: CS.K, padding: "3px 6px", fontWeight: 900, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", border: `1.5px solid ${CS.K}`, lineHeight: 1 }}>{e.c}</div>
      <div style={{ position: "absolute", top: 6, right: 6, background: CS.K, color: CS.W, padding: "3px 5px", fontFamily: FONT_MONO, fontSize: 8, letterSpacing: "0.04em" }}>{e.d}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: CS.K, color: CS.W, padding: big ? "9px 10px 10px" : "7px 8px 8px", borderTop: `1.5px solid ${CS.K}` }}>
        <div style={{ fontWeight: 900, fontSize: big ? 18 : 11, lineHeight: 0.98, letterSpacing: "-0.03em", textTransform: "uppercase", display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.t}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: big ? 9 : 8, color: "rgba(255,255,255,0.7)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.tm} · {e.v}</div>
      </div>
    </div>
  )
}

function VMagazine({ name, feed, onReset }: { name: string; feed: Ev[]; onReset: () => void }) {
  if (feed.length === 0) return <FeedEmpty name={name} />
  const lead = feed[0]
  return (
    <CsPage>
      <div style={{ position: "absolute", inset: 0, padding: "44px 0 22px", display: "flex", flexDirection: "column" }}>
        <FeedHeader name={name} right={feed.length} onReset={onReset} />
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 0", display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ border: `2.5px solid ${CS.K}`, background: CS.K, boxShadow: `3px 3px 0 ${CS.B}` }}>
            <div style={{ position: "relative", overflow: "hidden", aspectRatio: "1.5 / 1" }}>
              <DuotonePoster src={lead.p} style={{ position: "absolute", inset: 0 }} />
              <div style={{ position: "absolute", top: 6, left: 6, background: CS.W, color: CS.K, padding: "3px 7px", fontWeight: 900, fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", border: `1.5px solid ${CS.K}`, lineHeight: 1 }}>{lead.c}</div>
              <div style={{ position: "absolute", top: 6, right: 6, background: CS.K, color: CS.W, padding: "3px 6px", fontFamily: FONT_MONO, fontSize: 8.5, letterSpacing: "0.04em" }}>{lead.d} · {lead.tm}</div>
            </div>
            <div style={{ background: CS.K, color: CS.W, padding: "11px 12px 12px", borderTop: `2px solid ${CS.K}` }}>
              <div style={{ fontWeight: 900, fontSize: 19, lineHeight: 0.96, letterSpacing: "-0.035em", textTransform: "uppercase" }}>{lead.t}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: "rgba(255,255,255,0.7)", marginTop: 6, letterSpacing: "0.04em" }}>{lead.v}</div>
            </div>
          </div>
          {feed[1] && feed[2] && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <MagTile e={feed[1]} ar="1 / 1.34" />
              <MagTile e={feed[2]} ar="1 / 1.34" />
            </div>
          )}
          {feed[3] && feed[4] && feed[5] && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
              <MagTile e={feed[3]} ar="1 / 1.4" />
              <MagTile e={feed[4]} ar="1 / 1.4" />
              <MagTile e={feed[5]} ar="1 / 1.4" />
            </div>
          )}
          {feed[6] && feed[7] && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              <MagTile e={feed[6]} ar="1 / 1.34" />
              <MagTile e={feed[7]} ar="1 / 1.34" />
            </div>
          )}
        </div>
      </div>
    </CsPage>
  )
}

// ── Variant 3 · Catalog ──────────────────────────────────────────────────

function CatalogRow({ e, i, hits, catCounts }: { e: Ev; i: number; hits: number; catCounts: Record<string, number> }) {
  const cnt = catCounts[e.c] || 12
  const pct = Math.round((hits / 9) * 100)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 11, padding: "11px 0", borderBottom: `1.5px solid ${CS.G18}`, alignItems: "stretch" }}>
      <DuotonePoster src={e.p} style={{ width: 70, height: 70, border: `2px solid ${CS.K}`, flexShrink: 0 }} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: CS.G55 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontWeight: 900, fontSize: 15, lineHeight: 0.98, letterSpacing: "-0.03em", textTransform: "uppercase", color: CS.K, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.t}</span>
          </div>
          <Mono color={CS.B} style={{ flexShrink: 0 }}>{e.c}</Mono>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontFamily: FONT_MONO, fontSize: 9.5, color: CS.G55, letterSpacing: "0.04em" }}>
            <span style={{ display: "inline-flex", gap: 2 }}>{Array.from({ length: hits }).map((_, j) => <span key={j} style={{ width: 5, height: 10, background: CS.B }} />)}</span>
            <span>×{hits}</span><span style={{ color: CS.G35 }}>·</span>
            <span>{e.d} {e.tm}</span><span style={{ color: CS.G35 }}>·</span>
            <span style={{ color: CS.K, fontWeight: 700 }}>{pct}% / {cnt}</span>
          </div>
          <div style={{ marginTop: 5, height: 4, background: "rgba(13,13,13,0.06)", border: `1px solid ${CS.K}`, position: "relative" }}>
            <div style={{ position: "absolute", top: -1, bottom: -1, left: -1, width: `calc(${pct}% + 1px)`, background: CS.K }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function VCatalog({ name, feed, catCounts, onReset }: { name: string; feed: Ev[]; catCounts: Record<string, number>; onReset: () => void }) {
  return (
    <CsPage>
      <div style={{ position: "absolute", inset: 0, padding: "44px 0 22px", display: "flex", flexDirection: "column" }}>
        <FeedHeader name={name} right={feed.length} onReset={onReset} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 18px", background: CS.K, color: CS.W, flexShrink: 0 }}>
          <span style={{ fontWeight: 900, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}>Картотека / Index</span>
          <Mono color="rgba(255,255,255,0.6)">картинка + цифры</Mono>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "2px 18px 0" }}>
          {feed.map((e, i) => <CatalogRow key={i} e={e} i={i} hits={Math.max(1, catCounts[e.c] ?? 1)} catCounts={catCounts} />)}
        </div>
      </div>
    </CsPage>
  )
}

// ── Variant 4 · Spread ───────────────────────────────────────────────────

function VSpread({ name, feed, onReset }: { name: string; feed: Ev[]; onReset: () => void }) {
  if (feed.length === 0) return <FeedEmpty name={name} />
  const lead = feed[0]
  const rest = feed.slice(1, 6)
  return (
    <CsPage>
      <div style={{ position: "absolute", inset: 0, padding: "44px 0 22px", display: "flex", flexDirection: "column" }}>
        <FeedHeader name={name} right={feed.length} onReset={onReset} />
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 0" }}>
          <Mono color={CS.B} style={{ fontWeight: 700 }}>Главное / Лид недели</Mono>
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 10, marginTop: 8, alignItems: "start" }}>
            <DuotonePoster src={lead.p} style={{ width: "100%", aspectRatio: "1 / 1.3", border: `2.5px solid ${CS.K}`, boxShadow: `4px 4px 0 ${CS.B}` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "inline-block", background: CS.K, color: CS.W, padding: "3px 7px", fontWeight: 900, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase" }}>{lead.c}</div>
              <div style={{ fontWeight: 900, fontSize: 23, lineHeight: 0.9, letterSpacing: "-0.04em", textTransform: "uppercase", color: CS.K, marginTop: 8 }}>{lead.t}</div>
              <div style={{ fontWeight: 600, fontSize: 11, lineHeight: 1.4, color: CS.G70, marginTop: 8 }}>Подборка недели. Один лид + подкреплённый список.</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, paddingTop: 7, borderTop: `1.5px solid ${CS.K}` }}>
            <Mono>{lead.v}</Mono><Mono color={CS.K} style={{ fontWeight: 700 }}>{lead.d} · {lead.tm}</Mono>
          </div>
          <div style={{ marginTop: 16, paddingBottom: 6, borderBottom: `2px solid ${CS.K}`, display: "flex", justifyContent: "space-between" }}>
            <Mark>Также на неделе</Mark><Mark color={CS.G55}>+{rest.length}</Mark>
          </div>
          <div style={{ marginTop: 4 }}>
            {rest.map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 48px 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${CS.G18}` }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: CS.B, fontWeight: 700 }}>{String(i + 2).padStart(2, "0")}</span>
                <DuotonePoster src={e.p} style={{ width: 48, height: 48, border: `2px solid ${CS.K}` }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 0.98, letterSpacing: "-0.03em", textTransform: "uppercase", color: CS.K, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.t}</div>
                  <Mono style={{ display: "block", marginTop: 3 }}>{e.c} · {e.v}</Mono>
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: CS.K, fontWeight: 700, textAlign: "right" }}>{e.d}<br />{e.tm}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CsPage>
  )
}

// ── Variant 5 · Billboard ────────────────────────────────────────────────

function VBillboard({ name, feed, onReset }: { name: string; feed: Ev[]; onReset: () => void }) {
  if (feed.length === 0) return <FeedEmpty name={name} />
  const hero = feed[0]
  const sheet = feed.slice(1, 7)
  return (
    <div className="cs-jr" style={{ position: "fixed", inset: 0, background: CS.K, fontFamily: FONT_SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, padding: "44px 0 22px", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 18px 10px", borderBottom: `2px solid ${CS.W}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
          <div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>N° 001 · афиша · {name.trim().split(/\s+/)[0]}</span>
            <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 0.9, letterSpacing: "-0.04em", textTransform: "uppercase", color: CS.W, marginTop: 6 }}>Эта неделя</div>
          </div>
          {/* Right side: count + white profile badge for the dark header. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 900, fontSize: 22, color: CS.B, letterSpacing: "-0.04em", cursor: "pointer" }} onClick={onReset}>{feed.length}</span>
            <BillboardProfileBadge name={name} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 0" }}>
          <div style={{ position: "relative", border: `2.5px solid ${CS.W}`, overflow: "hidden", aspectRatio: "1 / 1.12" }}>
            <DuotonePoster src={hero.p} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", top: 8, left: 8, background: CS.W, color: CS.K, padding: "4px 8px", fontWeight: 900, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", border: `1.5px solid ${CS.K}` }}>{hero.c}</div>
            <div style={{ position: "absolute", top: 8, right: 8, background: CS.B, color: CS.W, padding: "5px 9px", fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em" }}>{hero.d} · {hero.tm}</div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 12px 14px", background: "linear-gradient(to top, rgba(0,0,0,0.92) 40%, transparent)" }}>
              <div style={{ fontWeight: 900, fontSize: 38, lineHeight: 0.82, letterSpacing: "-0.05em", textTransform: "uppercase", color: CS.W }}>{hero.t}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: "rgba(255,255,255,0.75)", marginTop: 9, letterSpacing: "0.04em" }}>{hero.v}</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 0 9px" }}>
            <span style={{ fontWeight: 900, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: CS.W }}>Контактный лист</span>
            <Mono color="rgba(255,255,255,0.6)">+{sheet.length}</Mono>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {sheet.map((e, i) => (
              <div key={i} style={{ position: "relative", border: `1.5px solid ${CS.W}`, aspectRatio: "1 / 1.16", overflow: "hidden" }}>
                <DuotonePoster src={e.p} style={{ position: "absolute", inset: 0 }} />
                <span style={{ position: "absolute", top: 3, left: 3, background: CS.W, color: CS.K, padding: "1px 4px", fontFamily: FONT_MONO, fontSize: 7.5, fontWeight: 700, border: `1px solid ${CS.K}` }}>{String(i + 2).padStart(2, "0")}</span>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.82)", color: CS.W, padding: "4px 5px" }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: CS.B, letterSpacing: "0.04em", textTransform: "uppercase" }}>{e.c}</div>
                  <div style={{ fontWeight: 900, fontSize: 9, lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Variant 6 · Combo ────────────────────────────────────────────────────

function ComboSection({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 18 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: CS.B }}>{n}</span>
      <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: CS.K }}>{title}</span>
      <span style={{ flex: 1, height: 2, background: CS.K }} />
    </div>
  )
}

function SuperSplit({ cat, copyVar = 0, superByCat }: { cat: string; copyVar?: number; superByCat: DerivedData["superByCat"] }) {
  const d = superByCat[cat]
  if (!d) return null
  const c = d.copy[copyVar] || d.copy[0]
  return (
    <div style={{ position: "relative", marginTop: 16, marginBottom: 2, border: `2.5px solid ${CS.K}`, background: CS.W, overflow: "hidden", boxShadow: `6px 6px 0 ${CS.B}`, display: "flex", minHeight: 168 }}>
      <div style={{ width: 120, flexShrink: 0, position: "relative", borderRight: `2.5px solid ${CS.K}` }}>
        <DuotonePoster src={d.poster} style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", left: 0, bottom: 0, background: CS.B, color: CS.W, padding: "4px 9px", fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}>{d.badge}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "13px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontWeight: 900, fontSize: 38, lineHeight: 0.8, letterSpacing: "-0.06em", color: CS.B }}>{d.rank}</span>
          <span style={{ fontWeight: 900, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: CS.K, lineHeight: 1.1 }}>{c.kicker}</span>
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 21, lineHeight: 0.88, letterSpacing: "-0.04em", textTransform: "uppercase", color: CS.K, marginTop: 8 }}>{d.title}</div>
          <div style={{ fontWeight: 600, fontSize: 11, lineHeight: 1.35, color: CS.G55, marginTop: 7 }}>{c.meta}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 9, borderTop: `2px solid ${CS.K}` }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: CS.K, letterSpacing: "0.02em" }}>{c.foot}</span>
          <span style={{ fontWeight: 900, fontSize: 18, color: CS.B }}>→</span>
        </div>
      </div>
    </div>
  )
}

function VCombo({ name, feed, shelves, superByCat, superVar, onReset }: { name: string; feed: Ev[]; shelves: DerivedData["shelves"]; superByCat: DerivedData["superByCat"]; superVar: number; onReset: () => void }) {
  if (feed.length === 0) return <FeedEmpty name={name} />
  const lead = feed[0]
  return (
    <CsPage>
      <div style={{ position: "absolute", inset: 0, padding: "44px 0 22px", display: "flex", flexDirection: "column" }}>
        <FeedHeader name={name} right={feed.length} onReset={onReset} />
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 0" }}>
          <ComboSection n="01" title="Главное недели" />
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 10, alignItems: "start" }}>
            <DuotonePoster src={lead.p} style={{ width: "100%", aspectRatio: "1 / 1.3", border: `2.5px solid ${CS.K}`, boxShadow: `4px 4px 0 ${CS.B}` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "inline-block", background: CS.K, color: CS.W, padding: "3px 7px", fontWeight: 900, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase" }}>{lead.c}</div>
              <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 0.9, letterSpacing: "-0.04em", textTransform: "uppercase", color: CS.K, marginTop: 8 }}>{lead.t}</div>
              <div style={{ fontWeight: 600, fontSize: 11, lineHeight: 1.4, color: CS.G70, marginTop: 8 }}>Лид недели. Подборка живёт неделю.</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, paddingTop: 7, borderTop: `1.5px solid ${CS.K}` }}>
            <Mono>{lead.v}</Mono><Mono color={CS.K} style={{ fontWeight: 700 }}>{lead.d} · {lead.tm}</Mono>
          </div>
          <ComboSection n="02" title="По вкусу · по категориям" />
          {shelves.slice(0, 3).map((s, i) => (
            <div key={s.cat}>
              <Shelf idx={i} cat={s.cat} hits={s.hits} evs={s.evs} note={s.note} />
              <SuperSplit cat={s.cat} copyVar={superVar} superByCat={superByCat} />
            </div>
          ))}
        </div>
      </div>
    </CsPage>
  )
}

// ── Page entry — picks variant from ?v= ──────────────────────────────────

export default function CsFeedLegacy() {
  const navigate = useNavigate()
  const { derived } = useDerived()
  const { name, clear } = useJourneyState()
  const search = useSearch({ strict: false }) as Record<string, string | undefined>
  const variant = Math.max(0, Math.min(6, Number(search.v ?? 6)))
  const superVar = Math.max(0, Math.min(2, Number(search.superVar ?? 1)))

  const safeName = name.trim() || "Гость"

  const onReset = () => {
    clear()
    navigate({ to: "/cs/landing" })
  }

  // NavCtx — lets the ProfileBadge inside any feed header (light or dark)
  // open the profile screen without prop-drilling a callback.
  const navValue = useMemo(() => ({ openProfile: () => navigate({ to: "/cs/profile" }) }), [navigate])

  const { feed, shelves, superByCat, catCounts } = derived
  let body: React.ReactNode
  if (variant === 1) body = <VShelves name={safeName} feed={feed} shelves={shelves} onReset={onReset} />
  else if (variant === 2) body = <VMagazine name={safeName} feed={feed} onReset={onReset} />
  else if (variant === 3) body = <VCatalog name={safeName} feed={feed} catCounts={catCounts} onReset={onReset} />
  else if (variant === 4) body = <VSpread name={safeName} feed={feed} onReset={onReset} />
  else if (variant === 5) body = <VBillboard name={safeName} feed={feed} onReset={onReset} />
  else if (variant === 6) body = <VCombo name={safeName} feed={feed} shelves={shelves} superByCat={superByCat} superVar={superVar} onReset={onReset} />
  else body = <VCover name={safeName} feed={feed} onReset={onReset} />

  // @NEW-GOING: GoingProvider wraps the whole tree so the EventSheet's
  // "Иду →" button writes into the same store that Profile/GoingAgenda
  // reads from. localStorage carries the list across route changes.
  return (
    <NavCtx.Provider value={navValue}>
      <GoingProvider>
        <EventModalProvider>{body}</EventModalProvider>
      </GoingProvider>
    </NavCtx.Provider>
  )
}
