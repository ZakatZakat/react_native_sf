/**
 * PipeSwipeTrain — Tinder-style taste trainer.
 *
 *  • 10 real event cards from the live feed, shuffled to cover varied tags.
 *  • User taps ✕ (Мимо) or ♥ (Хочу) on the top card.
 *  • Each ♥ counts a vote for that event's interest tag.
 *  • After the deck, top 3–4 inferred interests are saved and the user is
 *    taken to /pipe-feed-swipe.
 *
 *  Ported from /Users/askarembulatov/Downloads/alt1-swipe.jsx with our
 *  Curator-backed event source.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { isImg, resolveMedia } from "./pipe/shared"
import { INTERESTS, type Interest, setInterests } from "./pipe/preferences"
import { analytics } from "../lib/analytics"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G18 = "rgba(13,13,13,0.18)"
const G55 = "rgba(13,13,13,0.55)"
const G70 = "rgba(13,13,13,0.70)"

const INTEREST_BY_KEY: Record<string, Interest> =
  Object.fromEntries(INTERESTS.map((i) => [i.key, i]))

const DECK_SIZE = 10

/* ─────────────────────────────────────────────────────────── */
/* Small atoms                                                  */
/* ─────────────────────────────────────────────────────────── */

function Mark({ children, color = K }: { children: React.ReactNode; color?: string }) {
  return (
    <Text
      as="span"
      fontWeight="900"
      fontSize="9px"
      letterSpacing="0.32em"
      textTransform="uppercase"
      color={color}
      lineHeight="1"
    >
      {children}
    </Text>
  )
}

/** Poster image — natural-aspect, like /feed. The image is `width: 100% /
 *  height: auto`, so its own natural ratio drives the card height: short /
 *  wide posters give shorter cards, tall portraits give taller cards.
 *  maxHeight caps it so a freakishly tall poster can't push the layout. */
function DuotonePoster({ src }: { src: string | null }) {
  if (!src) {
    return <Box w="100%" h="180px" bg={K} />
  }
  return (
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        maxHeight: "60dvh",
        objectFit: "contain",
      }}
    />
  )
}

/* ─────────────────────────────────────────────────────────── */
/* Card + verdict stamp                                          */
/* ─────────────────────────────────────────────────────────── */

function SwipeCard({
  ev, idx, isTop,
}: {
  ev: FeedItem; idx: number; isTop: boolean
}) {
  const top = idx * 6
  const rotate = [-1.2, 0.9, -0.6][idx % 3] ?? 0
  const scale = 1 - idx * 0.04
  const cat = (ev.tags ?? []).map((k) => INTEREST_BY_KEY[k]).find(Boolean)
  const catLabel = cat?.label ?? "Событие"
  const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  const poster = r && isImg(r) ? r : null
  const date = ev.event_time
    ? new Date(ev.event_time).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
    : ""
  const time = ev.event_time
    ? new Date(ev.event_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : ""
  const channel = ev.channel.replace(/^@/, "")
  // Top card sits in flow (its image's natural height drives stack height);
  // back cards mirror it via `absolute inset: 0` and sit behind with offsets.
  return (
    <Box
      {...(isTop
        ? { position: "relative" as const }
        : { position: "absolute" as const, top: "0", left: "0", right: "0", bottom: "0" })}
      pointerEvents={isTop ? "auto" : "none"}
      zIndex={10 - idx}
      style={{
        transform: `translateY(${top}px) scale(${scale}) rotate(${rotate}deg)`,
        transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <Box
        className="cs-shelf-card"
        w="100%"
        bg={W}
        border={`2.5px solid ${K}`}
        overflow="hidden"
        style={{
          boxShadow: isTop ? `5px 5px 0 ${K}` : `3px 3px 0 ${K}`,
          fontFamily: "'Helvetica Neue', sans-serif",
        }}
      >
        {/* Poster area — height driven by the image's natural aspect */}
        <Box position="relative">
          <DuotonePoster src={poster} />
          {/* Category chip — top-left */}
          <Box
            position="absolute" top="10px" left="10px" zIndex={2}
            bg={W} color={K}
            px="2" py="1"
            border={`1.5px solid ${K}`}
            fontWeight="900" fontSize="9px" letterSpacing="0.22em"
            lineHeight="1" textTransform="uppercase"
            style={{ whiteSpace: "nowrap", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {catLabel}
          </Box>
          {/* Date + time — top-right */}
          {date && (
            <Box
              position="absolute" top="10px" right="10px" zIndex={2}
              bg={K} color={W}
              px="2" py="1"
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="9px" letterSpacing="0.06em"
              lineHeight="1"
            >
              {date}{time ? ` · ${time}` : ""}
            </Box>
          )}
        </Box>

        {/* Title block */}
        <Box px="3.5" pt="3" pb="3.5" borderTop={`2px solid ${K}`}>
          <Flex justify="space-between" mb="1.5">
            <Text
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="9px" letterSpacing="0.06em" color={G55}
            >
              @{channel}
            </Text>
            <Text
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontSize="9px" letterSpacing="0.06em" color={G55}
            >
              пошёл бы?
            </Text>
          </Flex>
          <Text
            fontWeight="900" fontSize="19px" lineHeight="1"
            letterSpacing="-0.03em" textTransform="uppercase" color={K}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {ev.title || "Событие"}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

function VerdictBadge({ verdict }: { verdict: "yes" | "no" | null }) {
  if (!verdict) return null
  const isYes = verdict === "yes"
  return (
    <Box
      position="absolute" top="60px" left="50%" zIndex={30}
      bg={isYes ? B : K} color={W}
      px="4" py="2.5"
      fontWeight="900" fontSize="22px" letterSpacing="0.16em"
      border={`3px solid ${K}`}
      pointerEvents="none"
      style={{
        transform: `translateX(-50%) rotate(${isYes ? -8 : 8}deg)`,
        animation: "cs-stamp 0.5s cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      {isYes ? "ХОЧУ" : "МИМО"}
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* CoverHero — magazine-cover result screen (B8)                */
/* Port of alt1-result-b8-cover-hero.jsx                        */
/* ─────────────────────────────────────────────────────────── */

export function CoverHero({
  inferred, liked, likedSamples, pool,
}: {
  inferred: { cat: Interest; n: number }[]
  liked: number
  likedSamples: Record<string, FeedItem>
  pool: FeedItem[]
}) {
  if (inferred.length === 0) {
    return (
      <Box border={`2px solid ${K}`} p="4" style={{ boxShadow: `4px 4px 0 ${B}` }} mt="2">
        <Mark color={G55}>На основе ♥ {liked}</Mark>
        <Text fontWeight="700" fontSize="13px" color={G55} mt="2.5">
          Ничего не зацепило — попробуй ещё.
        </Text>
      </Box>
    )
  }

  const top = inferred[0]
  const rest = inferred.slice(1)
  const totalHits = inferred.reduce((s, x) => s + x.n, 0)
  const topPct = Math.round((top.n / Math.max(1, totalHits)) * 100)

  // Helper: poster URL for a category — first liked sample, else first pool event with that tag.
  const posterFor = (catKey: string): string | null => {
    const ev = likedSamples[catKey] ?? pool.find((e) => (e.tags ?? []).includes(catKey))
    if (!ev) return null
    const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
    const r = resolveMedia(m ?? null)
    return r && isImg(r) ? r : null
  }

  // Build shelves — one row per inferred category, populated from the pool.
  const shelves = inferred.map((x) => {
    const events = pool
      .filter((e) => (e.tags ?? []).includes(x.cat.key))
      .slice(0, 8)
    return { cat: x.cat, hits: x.n, events }
  })
  const totalFeed = shelves.reduce((s, x) => s + x.events.length, 0)

  const topPoster = posterFor(top.cat.key)

  return (
    <Box style={{ fontFamily: "'Helvetica Neue', sans-serif" }} mt="1" pb="4">
      {/* Shelf-card floating animation — lives inside CoverHero so it works
          both when embedded in PipeSwipeTrain done-state AND PipeSwipeResult. */}
      <style>{`
        @keyframes cs-shelf-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25%      { transform: translateY(-3px) rotate(-0.6deg); }
          50%      { transform: translateY(0)    rotate(0deg); }
          75%      { transform: translateY(-2px) rotate(0.5deg); }
        }
        .cs-shelf-card {
          animation: cs-shelf-float 4.2s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-shelf-card { animation: none; }
        }
      `}</style>

      {/* Edition strip */}
      <Flex
        justify="space-between" align="center"
        py="2"
        borderTop={`2px solid ${K}`} borderBottom={`2px solid ${K}`}
      >
        <Mark>Профиль</Mark>
        <Mark color={G55}>♥{liked} → {inferred.length} сигналов</Mark>
      </Flex>

      {/* HERO — top category. Image is in-flow (width:100% / height:auto),
          so the poster's natural aspect drives the block's height — same
          stretching technique PipeFeedSwipe uses. maxHeight caps it so a
          freakishly tall portrait can't blow up the layout. Overlays
          (SHARE stat, bottom name strip) stay absolutely positioned. */}
      <Box
        position="relative" mt="2"
        border={`2.5px solid ${K}`}
        overflow="hidden"
        bg={K}
      >
        {topPoster ? (
          <img
            src={topPoster}
            alt=""
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              maxHeight: "70dvh",
              objectFit: "contain",
            }}
          />
        ) : (
          <Box w="100%" style={{ aspectRatio: "1 / 1.2" }} />
        )}

        {/* Top-right stat block */}
        <Box
          position="absolute" top="8px" right="8px" zIndex={3}
          bg={K} color={W}
          px="2.5" py="1.5"
          textAlign="right"
        >
          <Text
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            fontSize="8.5px"
            color="rgba(255,255,255,0.65)"
            letterSpacing="0.16em"
          >
            SHARE
          </Text>
          <Text
            fontWeight="900" fontSize="22px"
            letterSpacing="-0.04em" lineHeight="1"
            mt="0.5"
          >
            {topPct}%
          </Text>
        </Box>

      </Box>

      {/* Bottom: stats strip + huge name — in flow below the poster so the
          image is never clipped by an overlay. */}
      <Box border={`2.5px solid ${K}`} borderTop="0">
        {/* hits stats strip */}
        <Flex
          justify="space-between" align="center"
          px="2.5" py="1"
          bg={W}
          borderBottom={`1.5px solid ${K}`}
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontSize="9px" color={G55}
          style={{ letterSpacing: "0.06em" }}
        >
          <Flex align="center" gap="0.5">
            {Array.from({ length: top.n }).map((_, j) => (
              <Box key={j} w="7px" h="12px" bg={B} />
            ))}
            <Text as="span" ml="1.5">×{top.n} hit</Text>
          </Flex>
          <Text as="span">+{top.cat.label}</Text>
        </Flex>
        {/* Big name */}
        <Box
          bg={K} color={W}
          px="3" pt="2.5" pb="3"
          fontWeight="900"
          style={{
            fontSize: "32px", lineHeight: "0.92",
            letterSpacing: "-0.04em",
            textTransform: "uppercase",
          }}
        >
          {top.cat.label}
        </Box>
      </Box>

      {/* Strip head for the rest */}
      {rest.length > 0 && (
        <>
          <Flex
            mt="3" pb="1.5"
            borderBottom={`1.5px solid ${K}`}
            justify="space-between"
          >
            <Mark>Поддержка / +{rest.length}</Mark>
            <Mark color={G55}>тап — убрать</Mark>
          </Flex>

          {/* Supporting thumbnails grid */}
          <Box
            mt="2"
            display="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(rest.length, 5)}, 1fr)`,
              gap: "6px",
            }}
          >
            {rest.map((x, i) => {
              const p = posterFor(x.cat.key)
              return (
                <Box
                  key={x.cat.key}
                  border={`1.5px solid ${K}`}
                  bg={W}
                  display="flex" flexDirection="column"
                >
                  <Box position="relative" style={{ aspectRatio: "1 / 1" }} overflow="hidden" bg={K}>
                    {p && (
                      <img
                        src={p}
                        alt=""
                        style={{
                          position: "absolute", inset: 0,
                          width: "100%", height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}
                    <Box
                      position="absolute" top="3px" left="3px"
                      bg={W}
                      px="1" py="0"
                      fontFamily="'JetBrains Mono', ui-monospace, monospace"
                      fontSize="8px" fontWeight="700"
                      border={`1px solid ${K}`}
                    >
                      {String(i + 2).padStart(2, "0")}
                    </Box>
                    <Flex
                      position="absolute" top="3px" right="3px"
                      gap="0.5"
                      bg={W}
                      px="0.5" py="0.5"
                      border={`1px solid ${K}`}
                    >
                      {Array.from({ length: x.n }).map((_, j) => (
                        <Box key={j} w="4px" h="5px" bg={B} />
                      ))}
                    </Flex>
                  </Box>
                  <Box px="1.5" pt="1" pb="1.5" borderTop={`1px solid ${K}`}>
                    <Text
                      fontWeight="900"
                      style={{
                        fontSize: "9.5px", lineHeight: "1",
                        letterSpacing: "-0.015em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {x.cat.label}
                    </Text>
                    <Text
                      fontFamily="'JetBrains Mono', ui-monospace, monospace"
                      fontSize="8px" color={G55}
                      mt="0.5"
                    >
                      ×{x.n}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </Box>
        </>
      )}

      {/* Полки / Shelves */}
      {shelves.length > 0 && (
        <>
          <Flex
            mt="5" mb="1"
            justify="space-between" align="baseline"
          >
            <Text
              fontWeight="900" fontSize="10px" letterSpacing="0.18em"
              textTransform="uppercase" color={K} lineHeight="1"
            >
              Полки / Shelves
            </Text>
            <Mark color={G55}>
              {shelves.length} рядов · {totalFeed} ивентов
            </Mark>
          </Flex>
          <Box mt="3">
            {shelves.map((s, idx) => (
              <Shelf key={s.cat.key} idx={idx} cat={s.cat} hits={s.hits} events={s.events} />
            ))}
          </Box>
        </>
      )}
    </Box>
  )
}

/** One horizontal shelf — row header + scrollable mini event cards. */
function Shelf({
  idx, cat, hits, events,
}: {
  idx: number
  cat: Interest
  hits: number
  events: FeedItem[]
}) {
  return (
    <Box mb="4">
      {/* Row header */}
      <Flex align="center" justify="space-between" mb="2">
        <Flex align="center" gap="2.5" minW="0">
          <Text
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            fontSize="10px" color={G55} flexShrink={0}
          >
            {String(idx + 1).padStart(2, "0")}
          </Text>
          <Text
            fontWeight="900" fontSize="16px"
            letterSpacing="-0.025em" textTransform="uppercase"
            color={K}
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {cat.label}
          </Text>
          <Flex gap="0.5" flexShrink={0}>
            {Array.from({ length: hits }).map((_, j) => (
              <Box key={j} w="6px" h="10px" bg={B} />
            ))}
          </Flex>
        </Flex>
        <Text
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontSize="10px" color={G55} flexShrink={0}
        >
          01 / {String(events.length).padStart(2, "0")} →
        </Text>
      </Flex>

      {/* Horizontal scroll of event mini-cards. py adds room for the gentle
          floating animation (cards rise up to -3px) — overflow-x:auto would
          otherwise clip those few pixels off the top. */}
      <Flex
        gap="2"
        overflowX="auto"
        sx={{
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
        mx="-4"
        px="4"
        py="2"
      >
        {events.map((ev, j) => {
          const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
          const r = resolveMedia(m ?? null)
          const poster = r && isImg(r) ? r : null
          const date = ev.event_time
            ? new Date(ev.event_time).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
            : ""
          return (
            <Box
              key={`${ev.id}-${j}`}
              className="cs-shelf-card"
              flexShrink={0}
              w={{ base: "160px", sm: "180px" }}
              border={`1.5px solid ${K}`}
              bg={W}
              overflow="hidden"
              style={{
                // Each card uses a different delay so the strip drifts in a
                // gentle, non-uniform rhythm — like posters caught in a breeze.
                animationDelay: `${(idx * 0.7 + j * 0.45) % 4}s`,
              }}
            >
              <Box position="relative" style={{ aspectRatio: "1 / 1" }} overflow="hidden" bg={K}>
                {poster && (
                  <img
                    src={poster}
                    alt=""
                    style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
                <Box
                  position="absolute" top="4px" left="4px"
                  bg={W} px="1.5" py="0.5"
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  fontSize="9px" fontWeight="700"
                  border={`1px solid ${K}`}
                >
                  N°{String(j + 1).padStart(2, "0")}
                </Box>
                {date && (
                  <Box
                    position="absolute" top="4px" right="4px"
                    bg={K} color={W}
                    px="1.5" py="0.5"
                    fontFamily="'JetBrains Mono', ui-monospace, monospace"
                    fontSize="9px" letterSpacing="0.06em"
                  >
                    до {date}
                  </Box>
                )}
              </Box>
              <Box px="2" pt="1.5" pb="2" borderTop={`1px solid ${K}`}>
                <Text
                  fontWeight="900" fontSize="11px" lineHeight="1.1"
                  letterSpacing="-0.015em" textTransform="uppercase"
                  color={K}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {ev.title || "Событие"}
                </Text>
              </Box>
            </Box>
          )
        })}
      </Flex>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* Page                                                          */
/* ─────────────────────────────────────────────────────────── */

export default function PipeSwipeTrain() {
  const navigate = useNavigate()
  const [deck, setDeck] = useState<FeedItem[]>([])
  // Full pool — used to populate shelves on the result page with multiple
  // events per category.
  const [pool, setPool] = useState<FeedItem[]>([])
  const [i, setI] = useState(0)
  const [tally, setTally] = useState<Record<string, number>>({})
  const [likedSamples, setLikedSamples] = useState<Record<string, FeedItem>>({})
  const [liked, setLiked] = useState(0)
  const [verdict, setVerdict] = useState<"yes" | "no" | null>(null)
  // Timestamps for telemetry — when the deck started and when the current
  // card was first shown to the user (used for time_to_decide_ms).
  const deckStartedAt = useRef<number>(Date.now())
  const cardShownAt = useRef<number>(Date.now())

  // Fetch a varied deck — events with images, tagged with at least one interest,
  // picking the first occurrence of each distinct category to keep it diverse.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const feed = await analytics.measure("api.call", () => Curator.getFeed({ limit: 120 }), { path: "/me/feed", method: "GET" })
        if (cancelled) return
        const seenCats = new Set<string>()
        const picked: FeedItem[] = []
        const rest: FeedItem[] = []
        for (const ev of feed) {
          if (!ev.media_urls?.some(isImg)) continue
          const tags = ev.tags ?? []
          if (tags.length === 0) {
            rest.push(ev)
            continue
          }
          const primary = tags[0]
          if (!seenCats.has(primary)) {
            seenCats.add(primary)
            picked.push(ev)
          } else {
            rest.push(ev)
          }
        }
        // top up if we don't have enough variety yet
        const out = [...picked, ...rest].slice(0, DECK_SIZE)
        setDeck(out)
        // pool keeps everything with an image for shelves on the result page
        setPool([...picked, ...rest])
        deckStartedAt.current = Date.now()
        cardShownAt.current = Date.now()
        analytics.track("feed.view", { count: out.length, route: "/pipe-swipe-train" })
      } catch {
        /* offline — empty deck, show "ничего не зацепило" state */
        analytics.track("error.api", { endpoint: "/me/feed", page: "swipe_train" }, { status: "error" })
      }
    })()
    return () => { cancelled = true }
  }, [])

  const done = deck.length > 0 && i >= deck.length
  const top = !done ? deck[i] : null

  // Reset the time-to-decide clock whenever a new top card is revealed.
  // Also fires a card.view for the card the user is currently looking at.
  useEffect(() => {
    if (!top) return
    cardShownAt.current = Date.now()
    analytics.track("swipe_train.card.view", {
      event_id: top.id,
      position: i,
      primary_tag: top.tags?.[0] ?? null,
    })
  }, [top?.id, i])

  // When the deck completes, log a summary event with the inferred profile.
  // Guarded against firing twice if React re-renders the done state.
  const completeFiredRef = useRef(false)
  useEffect(() => {
    if (!done || completeFiredRef.current) return
    completeFiredRef.current = true
    const counts = Object.entries(tally).map(([k, n]) => ({ k, n }))
    analytics.track("swipe_train.deck.complete", {
      liked,
      deck_size: deck.length,
      inferred: counts.sort((a, b) => b.n - a.n).slice(0, 4),
      duration_ms: Date.now() - deckStartedAt.current,
    })
  }, [done, liked, tally, deck.length])

  const decide = (kind: "yes" | "no") => {
    if (done || verdict || !top) return
    setVerdict(kind)
    const time_to_decide_ms = Date.now() - cardShownAt.current
    const primary = top.tags?.[0] ?? null
    if (kind === "yes") {
      const tags = top.tags ?? []
      if (tags.length > 0) {
        const k = tags[0]
        setTally((t) => ({ ...t, [k]: (t[k] || 0) + 1 }))
        // First liked event for this category becomes its hero poster
        setLikedSamples((prev) => (prev[k] ? prev : { ...prev, [k]: top }))
      }
      setLiked((n) => n + 1)
      analytics.track("swipe_train.card.like", {
        event_id: top.id,
        position: i,
        primary_tag: primary,
        channel: top.channel,
        time_to_decide_ms,
      }, { data: top.title?.slice(0, 200) })
    } else {
      analytics.track("swipe_train.card.skip", {
        event_id: top.id,
        position: i,
        primary_tag: primary,
        channel: top.channel,
        time_to_decide_ms,
      }, { data: top.title?.slice(0, 200) })
    }
    setTimeout(() => {
      setVerdict(null)
      setI((x) => x + 1)
    }, 360)
  }

  const reset = () => {
    setI(0); setTally({}); setLiked(0); setVerdict(null); setLikedSamples({})
  }

  // Top 4 inferred categories
  const inferred = useMemo(
    () =>
      Object.entries(tally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, n]) => ({ cat: INTEREST_BY_KEY[k], n }))
        .filter((x) => x.cat),
    [tally],
  )

  const finish = async () => {
    const keys = inferred.map((x) => x.cat.key)
    setInterests(keys)
    try { await Curator.setInterests(keys) } catch { /* */ }
    navigate({ to: "/pipe-feed-swipe" })
  }

  return (
    <Box
      bg={W} color={K}
      // Swipe state: in-flow layout (minH 100dvh) so the action footer sits
      // naturally under the card — short posters don't leave a yawning gap.
      // Done state: locked viewport with absolute footer, so the CoverHero
      // shelves can scroll while the CTA stays pinned.
      position="relative"
      {...(done
        ? { h: "100dvh", overflow: "hidden", pb: "96px" }
        : {})}
      style={{ fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif" }}
    >
      {/* Dotted bauhaus background — same recipe as Pipe Landing Page variant D */}
      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        opacity={0.55}
        zIndex={0}
        style={{
          backgroundImage: "radial-gradient(rgba(13,13,13,0.18) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px",
        }}
      />

      <style>{`
        @keyframes cs-stamp {
          0% { opacity: 0; transform: translateX(-50%) scale(0.5) rotate(0deg); }
          100% { opacity: 1; }
        }
        @keyframes cs-shelf-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25%      { transform: translateY(-3px) rotate(-0.6deg); }
          50%      { transform: translateY(0)    rotate(0deg); }
          75%      { transform: translateY(-2px) rotate(0.5deg); }
        }
        .cs-shelf-card {
          animation: cs-shelf-float 4.2s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-shelf-card { animation: none; }
        }
      `}</style>

      <Box w="100%">
        {/* Editorial header — back + step badge + ruler + hero text */}
        <Box px="4" pt="4" pb="3">
          <Flex justify="space-between" align="center" pb="2" mb="2" borderBottom={`2px solid ${K}`}>
            <Flex
              as="button"
              onClick={() => navigate({ to: "/pipe-landing-v1" })}
              align="center" gap="1.5" cursor="pointer"
              fontSize="11px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase" color={B}
              style={{ background: "none", border: "none", padding: 0 }}
              _hover={{ color: K }} transition="color 0.12s"
            >
              <Text fontSize="14px" lineHeight="1">←</Text> Назад
            </Flex>
            <Box bg={K} color={W} px="2.5" py="1" fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase">
              Шаг 1 / 2
            </Box>
          </Flex>

          <Flex justify="space-between" align="flex-end" mb="2">
            <Mark color={G55}>Section / Интересы</Mark>
            <Mark color={G55}>{deck.length || DECK_SIZE} карточек</Mark>
          </Flex>

          <Box pb="1">
            <Text fontWeight="900" fontSize="40px" lineHeight="0.86" letterSpacing="-0.045em" textTransform="uppercase" color={K}>
              {done ? "Похоже," : "Пошёл бы?"}
            </Text>
            <Text fontWeight="900" fontSize="40px" lineHeight="0.86" letterSpacing="-0.045em" textTransform="uppercase" color={B} ml="3.5">
              {done ? "ты про" : "Жми."}
            </Text>
          </Box>
          <Text fontWeight="700" fontSize="12.5px" lineHeight="1.4" color={G55} mt="2.5">
            {done ? (
              <>Сверху — <Text as="span" color={K} fontWeight="900">главный сигнал</Text>. Внизу — поддержка.</>
            ) : (
              <>Смотри карточки, тапай <Text as="span" color={K} fontWeight="900">✕ или ♥</Text>. Лента подстроится сама.</>
            )}
          </Text>
        </Box>

        {/* Body — either swipe stack or result. In result-mode body becomes
            scrollable so the cover hero + thumbnails can spill over. */}
        <Box
          px="4"
          position="relative"
          sx={done ? { overflowY: "auto", maxHeight: "calc(100dvh - 320px)" } : undefined}
        >
          {!done ? (
            <Box>
              {/* Progress dots + counter */}
              <Flex justify="space-between" align="center" mb="3">
                <Flex gap="1">
                  {(deck.length > 0 ? deck : Array(DECK_SIZE)).map((_, idx) => (
                    <Box
                      key={idx}
                      w="18px" h="5px"
                      bg={idx < i ? K : idx === i ? B : G18}
                    />
                  ))}
                </Flex>
                <Text fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize="10px" color={G55}>
                  {Math.min(i + 1, deck.length || DECK_SIZE)} / {deck.length || DECK_SIZE}  ·  ♥ {liked}
                </Text>
              </Flex>

              {/* Card stack — height = top card's natural height (image
                  natural ratio + title block). Back cards mirror via
                  absolute inset:0, so the stack adapts per poster. */}
              <Box
                position="relative"
                w="100%"
                mx="auto"
              >
                {deck.length === 0 ? (
                  <Flex w="100%" h="100%" align="center" justify="center">
                    <Text fontSize="13px" fontWeight="700" color={G55} textAlign="center">
                      Загружаем карточки…
                    </Text>
                  </Flex>
                ) : (
                  // Render only the top card — back cards are hidden so the
                  // image's natural aspect cleanly drives the layout.
                  (() => {
                    const ev = deck[i]
                    if (!ev) return null
                    return <SwipeCard key={`${ev.id}-${i}`} ev={ev} idx={0} isTop />
                  })()
                )}
                <VerdictBadge verdict={verdict} />
              </Box>
            </Box>
          ) : (
            <CoverHero
              inferred={inferred}
              liked={liked}
              likedSamples={likedSamples}
              pool={pool}
            />
          )}
        </Box>

        {/* Footer — ✕ / ♥ during swipe (in flow, sits under the card so it
            "pulls up" close to short posters); finish CTA on result
            (absolute, so the shelves can scroll behind it). */}
        {!done ? (
          <Flex
            mt="6"
            zIndex={20}
            bg={W} borderTop={`2.5px solid ${K}`}
            gap="2.5"
            style={{
              paddingTop: "12px",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              paddingLeft: "16px",
              paddingRight: "16px",
            }}
          >
            <Flex
              as="button"
              onClick={() => decide("no")}
              flex="1"
              align="center" justify="center" gap="2.5"
              cursor="pointer"
              fontWeight="900" fontSize="14px" letterSpacing="0.12em" textTransform="uppercase"
              border={`3px solid ${K}`}
              bg={W} color={K}
              py="3.5"
              style={{ boxShadow: `3px 3px 0 ${K}` }}
              _active={{ transform: "translate(2px, 2px)" }}
              transition="all 0.12s"
            >
              <Text as="span" fontSize="20px" lineHeight="1">✕</Text>
              <Text as="span">Мимо</Text>
            </Flex>
            <Flex
              as="button"
              onClick={() => decide("yes")}
              flex="1"
              align="center" justify="center" gap="2.5"
              cursor="pointer"
              fontWeight="900" fontSize="14px" letterSpacing="0.12em" textTransform="uppercase"
              border={`3px solid ${K}`}
              bg={K} color={W}
              py="3.5"
              style={{ boxShadow: `3px 3px 0 ${B}` }}
              _active={{ transform: "translate(2px, 2px)" }}
              transition="all 0.12s"
            >
              <Text as="span" fontSize="18px" lineHeight="1" color={B}>♥</Text>
              <Text as="span">Хочу</Text>
            </Flex>
          </Flex>
        ) : (
          <Flex
            position="absolute" left="0" right="0" bottom="0"
            zIndex={20}
            bg={W} borderTop={`2.5px solid ${K}`}
            align="center" gap="3"
            style={{
              paddingTop: "12px",
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              paddingLeft: "16px",
              paddingRight: "16px",
            }}
          >
            <Box flex="1" minW="0">
              <Mark color={G55}>В твоей ленте</Mark>
              <Flex align="baseline" gap="1.5" mt="1">
                <Text
                  fontWeight="900" fontSize="28px" color={K}
                  lineHeight="1" letterSpacing="-0.03em"
                >
                  {inferred.length}
                </Text>
                <Text fontWeight="800" fontSize="11px" color={G55}>
                  кат. · ♥ {liked} ивентов
                </Text>
              </Flex>
            </Box>
            <Flex
              as="button"
              onClick={finish}
              align="center" gap="2.5"
              cursor={inferred.length > 0 ? "pointer" : "not-allowed"}
              fontWeight="900" fontSize="14px" letterSpacing="0.05em" textTransform="uppercase"
              border={`3px solid ${K}`}
              bg={inferred.length > 0 ? K : W} color={inferred.length > 0 ? W : G55}
              px="4" py="3.25"
              opacity={inferred.length > 0 ? 1 : 0.6}
              style={{
                boxShadow: inferred.length > 0 ? `3px 3px 0 ${B}` : "none",
                pointerEvents: inferred.length > 0 ? "auto" : "none",
              }}
              _active={{ transform: "translate(2px, 2px)" }}
              transition="all 0.12s"
            >
              <Text as="span">Открыть</Text>
              <Text as="span" fontSize="18px" lineHeight="1">→</Text>
            </Flex>
          </Flex>
        )}
      </Box>
    </Box>
  )
}
