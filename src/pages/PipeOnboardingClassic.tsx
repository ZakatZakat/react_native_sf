/**
 * Classic single-screen onboarding ("Какое искусство?").
 *
 * Kept around as an alternative variant (in App.tsx ALT_ROUTES).
 * The primary entry point is the new Swiss/brutalist 2-step flow in PipeOnboarding.tsx.
 */

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { INTERESTS, getInterests, setInterests } from "./pipe/preferences"
import { API, isImg, type EventCard } from "./pipe/shared"
import { Curator } from "../lib/curator"
import { RadarGrid, buildInterestImages } from "./pipe/RadarGrid"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.5)"

export default function PipeOnboardingClassic() {
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Set<string>>(() => new Set(getInterests()))
  const [events, setEvents] = useState<EventCard[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API}/events?limit=300`, { cache: "no-store" })
        if (!res.ok) return
        const all: EventCard[] = await res.json()
        if (cancelled) return
        setEvents(all.filter((ev) => ev.media_urls?.some(isImg)))
      } catch { /* */ }
    })()
    return () => { cancelled = true }
  }, [])

  const interestImages = useMemo(() => buildInterestImages(events), [events])

  const toggle = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const finish = async () => {
    const keys = [...picked]
    setInterests(keys)
    try { await Curator.setInterests(keys) } catch { /* */ }
    navigate({ to: "/pipe-feed-swipe" })
  }

  const skip = async () => {
    setInterests([])
    try { await Curator.setInterests([]) } catch { /* */ }
    navigate({ to: "/pipe-feed-swipe" })
  }

  // Pre-load existing interests from server (overwrites local cache)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const remote = await Curator.getInterests()
        if (cancelled || !Array.isArray(remote)) return
        setPicked(new Set(remote))
        setInterests(remote)
      } catch { /* */ }
    })()
    return () => { cancelled = true }
  }, [])

  const count = picked.size
  const canFinish = count > 0

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      position="relative"
      overflow="hidden"
      css={{ WebkitTapHighlightColor: "transparent" }}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <Box
        position="absolute" top="240px" left="-30%" right="-30%" h="240px"
        bg={`${B}10`} style={{ transform: "skewY(-8deg)" }}
        zIndex={0} pointerEvents="none"
      />

      <Flex
        maxW="430px" mx="auto" px="5" pt="4" pb="32"
        direction="column" align="stretch" position="relative" zIndex={1}
      >
        <Flex align="center" justify="space-between" mb="4">
          <Box bg={K} color={W} px="2.5" py="1" fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase">
            Шаг 1 / 1
          </Box>
          <Flex
            as="button" onClick={skip}
            fontSize="10px" fontWeight="900" letterSpacing="0.16em" textTransform="uppercase"
            color={G} cursor="pointer" _hover={{ color: K }} transition="color 0.12s"
          >
            Пропустить →
          </Flex>
        </Flex>

        <Box pb="2">
          <Text fontSize="40px" fontWeight="900" lineHeight="0.9" letterSpacing="-0.04em" textTransform="uppercase" color={K}>
            Какое
          </Text>
          <Text fontSize="40px" fontWeight="900" lineHeight="0.9" letterSpacing="-0.04em" textTransform="uppercase" color={B} ml="6">
            искусство?
          </Text>
        </Box>

        <Text mt="3" mb="6" fontSize="12px" fontWeight="700" letterSpacing="0.06em" color={G} maxW="320px">
          Отметь то, что тебе интересно — поднимем такие события вверх ленты. Можно несколько.
        </Text>

        <RadarGrid picked={picked} onToggle={toggle} interestImages={interestImages} />
      </Flex>

      <Flex
        position="fixed" left="0" right="0" bottom="0"
        bg={W} borderTop={`2.5px solid ${K}`} zIndex={5}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        px="5" pt="3" justify="center"
      >
        <Flex maxW="430px" w="100%" align="center" gap="3">
          <Box flex="1">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={G} textTransform="uppercase">
              Выбрано
            </Text>
            <Text fontSize="22px" fontWeight="900" color={K} lineHeight="1" letterSpacing="-0.02em">
              {count} <Text as="span" fontSize="10px" color={G}>/ {INTERESTS.length}</Text>
            </Text>
          </Box>
          <Flex
            as="button"
            onClick={canFinish ? finish : undefined}
            aria-disabled={!canFinish}
            px="5" py="3"
            bg={canFinish ? B : `${B}40`} color={W}
            border={`2.5px solid ${K}`}
            boxShadow={canFinish ? `4px 4px 0 ${K}` : `2px 2px 0 ${K}30`}
            fontSize="11px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase"
            cursor={canFinish ? "pointer" : "not-allowed"}
            opacity={canFinish ? 1 : 0.6}
            pointerEvents={canFinish ? "auto" : "none"}
            _hover={canFinish ? { transform: "translate(-1px,-1px)", boxShadow: `5px 5px 0 ${K}` } : undefined}
            transition="all 0.12s" align="center" gap="2"
          >
            Готово
            <Text as="span" fontSize="13px">→</Text>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  )
}
