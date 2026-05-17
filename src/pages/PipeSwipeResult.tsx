/**
 * PipeSwipeResult — standalone preview of the B8 "Cover Hero" result screen
 * from /pipe-swipe-train, with the data pre-baked from the live feed.
 *
 * Pretends the user already swiped through a deck and liked a handful of
 * events: takes the first 4–5 categories present in the fetched pool and
 * uses each one's first event as the hero / thumbnail / shelf source.
 */

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { isImg } from "./pipe/shared"
import { INTERESTS, type Interest, setInterests } from "./pipe/preferences"
import { CoverHero } from "./PipeSwipeTrain"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G55 = "rgba(13,13,13,0.55)"

const INTEREST_BY_KEY: Record<string, Interest> =
  Object.fromEntries(INTERESTS.map((i) => [i.key, i]))

export default function PipeSwipeResult() {
  const navigate = useNavigate()
  const [pool, setPool] = useState<FeedItem[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const feed = await Curator.getFeed({ limit: 120 })
        if (cancelled) return
        setPool(feed.filter((e) => e.media_urls?.some(isImg)))
      } catch { /* offline */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Build a plausible "inferred" set from the pool: top 5 categories by
  // number of events, with a hits count proxied from that frequency.
  const { inferred, likedSamples, liked } = useMemo(() => {
    if (pool.length === 0) {
      return { inferred: [], likedSamples: {} as Record<string, FeedItem>, liked: 0 }
    }
    const byCat = new Map<string, FeedItem[]>()
    for (const ev of pool) {
      const k = ev.tags?.[0]
      if (!k || !INTEREST_BY_KEY[k]) continue
      if (!byCat.has(k)) byCat.set(k, [])
      byCat.get(k)!.push(ev)
    }
    const ranked = [...byCat.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
    const inferred = ranked.map(([k, evs], idx) => ({
      cat: INTEREST_BY_KEY[k],
      n: Math.max(1, 4 - idx), // 4, 3, 2, 1, 1
    }))
    const likedSamples: Record<string, FeedItem> = {}
    for (const [k, evs] of ranked) {
      likedSamples[k] = evs[0]
    }
    const liked = inferred.reduce((s, x) => s + x.n, 0)
    return { inferred, likedSamples, liked }
  }, [pool])

  const finish = async () => {
    const keys = inferred.map((x) => x.cat.key)
    setInterests(keys)
    try { await Curator.setInterests(keys) } catch { /* */ }
    navigate({ to: "/pipe-feed-swipe" })
  }

  return (
    <Box
      bg={W} color={K}
      position="relative"
      h="100dvh"
      overflow="hidden"
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
      {/* Scrollable content area — matches alt1's PageShell pattern. Header,
          cover hero AND shelves all live here; paddingBottom reserves the
          110px slot for the absolutely-positioned footer below. */}
      <Box
        position="relative"
        zIndex={1}
        h="100%"
        overflowY="auto"
        overflowX="hidden"
        px="4"
        pt="4"
        pb="110px"
        sx={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
        }}
      >
        {/* Editorial header */}
        <Flex justify="space-between" align="center" pb="2" mb="2" borderBottom={`2px solid ${K}`}>
          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-swipe-train" })}
            align="center" gap="1.5" cursor="pointer"
            fontSize="11px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase" color={B}
            style={{ background: "none", border: "none", padding: 0 }}
          >
            <Text fontSize="14px" lineHeight="1">←</Text> Назад
          </Flex>
          <Box bg={K} color={W} px="2.5" py="1" fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase">
            Шаг 2 / 2
          </Box>
        </Flex>

        <Flex justify="space-between" align="flex-end" mb="2">
          <Text fontWeight="900" fontSize="9px" letterSpacing="0.32em" textTransform="uppercase" color={G55} lineHeight="1">
            Section / Профиль
          </Text>
          <Text fontWeight="900" fontSize="9px" letterSpacing="0.32em" textTransform="uppercase" color={G55} lineHeight="1">
            B8 · Cover Hero
          </Text>
        </Flex>

        <Box pb="1">
          <Text fontWeight="900" fontSize="40px" lineHeight="0.86" letterSpacing="-0.045em" textTransform="uppercase" color={K}>
            Похоже,
          </Text>
          <Text fontWeight="900" fontSize="40px" lineHeight="0.86" letterSpacing="-0.045em" textTransform="uppercase" color={B} ml="3.5">
            ты про
          </Text>
        </Box>
        <Text fontWeight="700" fontSize="12.5px" lineHeight="1.4" color={G55} mt="2.5" mb="3">
          Сверху — <Text as="span" color={K} fontWeight="900">главный сигнал</Text>. Внизу — поддержка.
        </Text>

        {/* CoverHero */}
        {pool.length === 0 ? (
          <Text fontSize="13px" fontWeight="700" color={G55} textAlign="center" mt="6">
            Загружаем ленту…
          </Text>
        ) : (
          <CoverHero
            inferred={inferred}
            liked={liked}
            likedSamples={likedSamples}
            pool={pool}
          />
        )}
      </Box>

      {/* Footer — В твоей ленте N · ОТКРЫТЬ */}
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
          <Text fontWeight="900" fontSize="9px" letterSpacing="0.32em" textTransform="uppercase" color={G55} lineHeight="1">
            В твоей ленте
          </Text>
          <Flex align="baseline" gap="1.5" mt="1">
            <Text fontWeight="900" fontSize="28px" color={K} lineHeight="1" letterSpacing="-0.03em">
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
    </Box>
  )
}
