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

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { isImg, resolveMedia } from "./pipe/shared"
import { INTERESTS, type Interest, setInterests } from "./pipe/preferences"

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
/* Page                                                          */
/* ─────────────────────────────────────────────────────────── */

export default function PipeSwipeTrain() {
  const navigate = useNavigate()
  const [deck, setDeck] = useState<FeedItem[]>([])
  const [i, setI] = useState(0)
  const [tally, setTally] = useState<Record<string, number>>({})
  const [liked, setLiked] = useState(0)
  const [verdict, setVerdict] = useState<"yes" | "no" | null>(null)

  // Fetch a varied deck — events with images, tagged with at least one interest,
  // picking the first occurrence of each distinct category to keep it diverse.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const feed = await Curator.getFeed({ limit: 120 })
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
      } catch {
        /* offline — empty deck, show "ничего не зацепило" state */
      }
    })()
    return () => { cancelled = true }
  }, [])

  const done = deck.length > 0 && i >= deck.length
  const top = !done ? deck[i] : null

  const decide = (kind: "yes" | "no") => {
    if (done || verdict || !top) return
    setVerdict(kind)
    if (kind === "yes") {
      const tags = top.tags ?? []
      if (tags.length > 0) {
        const k = tags[0]
        setTally((t) => ({ ...t, [k]: (t[k] || 0) + 1 }))
      }
      setLiked((n) => n + 1)
    }
    setTimeout(() => {
      setVerdict(null)
      setI((x) => x + 1)
    }, 360)
  }

  const reset = () => {
    setI(0); setTally({}); setLiked(0); setVerdict(null)
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
      // Lock to viewport: page never scrolls, content is bounded by 100dvh,
      // the absolutely-positioned footer is always visible at the bottom.
      position="relative"
      h="100dvh"
      overflow="hidden"
      pb="96px"
      style={{ fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes cs-stamp {
          0% { opacity: 0; transform: translateX(-50%) scale(0.5) rotate(0deg); }
          100% { opacity: 1; }
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
              {done ? "Готово." : "Пошёл бы?"}
            </Text>
            <Text fontWeight="900" fontSize="40px" lineHeight="0.86" letterSpacing="-0.045em" textTransform="uppercase" color={B} ml="3.5">
              {done ? "Лента" : "Жми."}
            </Text>
          </Box>
          <Text fontWeight="700" fontSize="12.5px" lineHeight="1.4" color={G55} mt="2.5">
            {done ? (
              <>Что тебя зацепило — стало <Text as="span" color={K} fontWeight="900">категориями</Text>. Можно поправить.</>
            ) : (
              <>Смотри карточки, тапай <Text as="span" color={K} fontWeight="900">✕ или ♥</Text>. Лента подстроится сама.</>
            )}
          </Text>
        </Box>

        {/* Body — either swipe stack or result */}
        <Box px="4" position="relative">
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
            // Result card
            <Box
              border={`2px solid ${K}`}
              p="4"
              style={{ boxShadow: `4px 4px 0 ${B}` }}
              mt="1"
            >
              <Mark color={G55}>На основе ♥ {liked} из {deck.length}</Mark>
              <Text
                fontWeight="900" fontSize="24px" lineHeight="1"
                letterSpacing="-0.035em" textTransform="uppercase" mt="1.5"
              >
                Похоже, ты про
              </Text>
              <Flex direction="column" gap="2" mt="3.5">
                {inferred.length === 0 ? (
                  <Text fontWeight="600" fontSize="12px" color={G55}>
                    Ничего не зацепило. Можно пройти ещё раз.
                  </Text>
                ) : (
                  inferred.map((x, j) => (
                    <Box
                      key={x.cat.key}
                      display="grid"
                      gridTemplateColumns="24px 1fr auto"
                      alignItems="center"
                      gap="2.5"
                      pb="1.5"
                      borderBottom={`1px solid ${G18}`}
                    >
                      <Text
                        fontFamily="'JetBrains Mono', ui-monospace, monospace"
                        fontSize="10px" color={G55}
                      >
                        {String(j + 1).padStart(2, "0")}
                      </Text>
                      <Text
                        fontWeight="900" fontSize="17px"
                        letterSpacing="-0.025em" textTransform="uppercase"
                      >
                        {x.cat.label}
                      </Text>
                      <Text
                        fontFamily="'JetBrains Mono', ui-monospace, monospace"
                        fontSize="10px" color={B} textAlign="right"
                      >
                        +{x.n} ♥
                      </Text>
                    </Box>
                  ))
                )}
              </Flex>
              <Flex
                as="button"
                onClick={reset}
                mt="3" w="100%"
                cursor="pointer"
                fontWeight="900" fontSize="11px" letterSpacing="0.18em" textTransform="uppercase"
                p="2.5"
                border={`2px solid ${K}`}
                bg={W} color={K}
                align="center" justify="center"
                style={{ background: W, border: `2px solid ${K}` }}
              >
                ↻ Пройти ещё раз
              </Flex>
            </Box>
          )}
        </Box>

        {/* Footer — ✕ / ♥ during swipe; finish CTA on result. Absolute over
            the scrollable page (PageShell pattern from Alt1Swipe). */}
        {!done ? (
          <Flex
            position="absolute" left="0" right="0" bottom="0"
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
