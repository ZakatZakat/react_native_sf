/**
 * PipeOnboarding — primary entry point.
 *
 * Two-step flow inspired by Swiss/International Typographic Style + brutalist
 * editorial poster grids:
 *   1. INTRO — brand poster: "CITY SIGNAL" + promise + two CTAs
 *      ▸ "СОБРАТЬ РАДАР" → step 2
 *      ▸ "СМОТРЕТЬ ВСЁ"  → straight to /pipe-feed-swipe with empty interests
 *   2. RADAR — chaotic bento grid (RadarGrid) with new framing
 *      ▸ "ЗАПУСТИТЬ" → save interests, navigate to feed with ?radar=N count
 *
 * Old single-screen onboarding is preserved at /pipe-onboarding-classic.
 */

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { INTERESTS, getInterests, setInterests } from "./pipe/preferences"
import { isImg, type EventCard, API } from "./pipe/shared"
import { Curator } from "../lib/curator"
import { buildInterestImages } from "./pipe/RadarGrid"
import { RadarGridSwiss } from "./pipe/RadarGridSwiss"
import { RadarGridMuseum } from "./pipe/RadarGridMuseum"
import { RadarGridBrussels, RadarGridTriptic, RadarGridBlockParty, RadarGridOscilloscope, RadarGridBento } from "./pipe/RadarGridEditorial"
import { PixelClusterBackdrop } from "./pipe/PixelClusters"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.55)"

export default function PipeOnboarding() {
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Set<string>>(() => new Set(getInterests()))
  const [events, setEvents] = useState<EventCard[]>([])

  // Hydrate interests from server (overrides localStorage)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const remote = await Curator.getInterests()
        if (cancelled || !Array.isArray(remote)) return
        if (remote.length > 0) {
          setPicked(new Set(remote))
          setInterests(remote)
        }
      } catch { /* */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Preload events to feed RadarGrid backgrounds
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

  const finishRadar = async () => {
    const keys = [...picked]
    setInterests(keys)
    try { await Curator.setInterests(keys) } catch { /* */ }
    // Predict the catch — fetch feed count for the chosen radar
    let count = 0
    try {
      const feed = await Curator.getFeed({ tags: keys, limit: 100 })
      count = feed.length
    } catch { /* */ }
    navigate({ to: "/pipe-feed-swipe", search: count > 0 ? { radar: String(count) } : undefined })
  }

  return (
    <RadarStep
      picked={picked}
      onToggle={toggle}
      onBack={() => navigate({ to: "/pipe-landing" })}
      onFinish={finishRadar}
      interestImages={interestImages}
    />
  )
}


/* ───────────────────────────────────────────────────────────────── */
/* STEP 2 — RADAR GRID                                               */
/* ───────────────────────────────────────────────────────────────── */

type GridStyle = "museum" | "swiss" | "brussels" | "triptic" | "blockparty" | "radar" | "bento"
const GRID_STYLES: { key: GridStyle; letter: string; label: string }[] = [
  { key: "museum",    letter: "A", label: "Museum"      },
  { key: "swiss",     letter: "B", label: "Swiss"       },
  { key: "brussels",  letter: "C", label: "Brussels"    },
  { key: "triptic",   letter: "D", label: "Triptic"     },
  { key: "blockparty", letter: "E", label: "Block Party" },
  { key: "radar",     letter: "F", label: "Radar"       },
  { key: "bento",     letter: "G", label: "Bento"       },
]

function RadarStep({
  picked, onToggle, onBack, onFinish, interestImages,
}: {
  picked: Set<string>
  onToggle: (key: string) => void
  onBack: () => void
  onFinish: () => void
  interestImages: Record<string, string[]>
}) {
  const count = picked.size
  const canFinish = count >= 1
  const recommended = 3
  const [gridStyle, setGridStyle] = useState<GridStyle>("museum")
  const isBento = gridStyle === "bento"

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
        fontFamily:
          "'Helvetica Neue', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* Bento (G) decorations live at the page root so they bleed into the
          corners and don't get clipped by inner containers. */}
      {isBento && (
        <>
          <Box
            position="absolute" inset="0" pointerEvents="none" opacity={0.55} zIndex={0}
            style={{
              backgroundImage: `radial-gradient(rgba(13,13,13,0.18) 1px, transparent 1.4px)`,
              backgroundSize: "12px 12px",
            }}
          />
          <PixelClusterBackdrop />
        </>
      )}

      <Flex
        maxW="430px"
        mx="auto"
        px="5"
        pt="4"
        pb="32"
        direction="column"
        align="stretch"
        position="relative"
        zIndex={1}
      >
        {isBento ? (
          <BentoEditorialHeader
            onBack={onBack}
            recommended={recommended}
          />
        ) : (
          <>
            {/* Editorial header row */}
            <Flex align="center" justify="space-between" mb="4">
              <Flex
                as="button" onClick={onBack}
                align="center" gap="2" cursor="pointer"
                fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={K}
                _hover={{ color: B }} transition="color 0.12s"
              >
                <Text fontSize="14px" lineHeight="1">←</Text> Назад
              </Flex>
              <Box bg={K} color={W} px="2.5" py="1" fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase">
                Радар
              </Box>
            </Flex>

            {/* Section ruler + heading — Swiss poster style */}
            <Box mb="2">
              <Box h="2px" bg={K} w="100%" />
              <Flex justify="space-between" align="flex-end" mt="2" mb="1">
                <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={G}>
                  Section / Радар
                </Text>
                <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={G}>
                  {INTERESTS.length} сигналов
                </Text>
              </Flex>
            </Box>

            <Box pb="2">
              <Text
                fontSize={{ base: "44px", sm: "56px" }}
                fontWeight="900"
                lineHeight="0.86"
                letterSpacing="-0.045em"
                textTransform="uppercase"
                color={K}
              >
                Собери
              </Text>
              <Text
                fontSize={{ base: "44px", sm: "56px" }}
                fontWeight="900"
                lineHeight="0.86"
                letterSpacing="-0.045em"
                textTransform="uppercase"
                color={B}
                ml="4"
              >
                свой радар
              </Text>
            </Box>

            <Text
              mt="3" mb="4"
              fontSize="13px" fontWeight="700" lineHeight="1.4"
              color={G} maxW="360px"
            >
              Выбирай не жанры, а сигналы.
              {' '}
              <Text as="span" color={K} fontWeight="800">{recommended}–5 штук</Text> хватит, чтобы лента поймала своё.
            </Text>
          </>
        )}

        {gridStyle === "museum"     && <RadarGridMuseum     picked={picked} onToggle={onToggle} />}
        {gridStyle === "swiss"      && <RadarGridSwiss      picked={picked} onToggle={onToggle} interestImages={interestImages} />}
        {gridStyle === "brussels"   && <RadarGridBrussels   picked={picked} onToggle={onToggle} />}
        {gridStyle === "triptic"    && <RadarGridTriptic    picked={picked} onToggle={onToggle} />}
        {gridStyle === "blockparty" && <RadarGridBlockParty picked={picked} onToggle={onToggle} interestImages={interestImages} />}
        {gridStyle === "radar"      && <RadarGridOscilloscope picked={picked} onToggle={onToggle} />}
        {gridStyle === "bento"      && <RadarGridBento picked={picked} onToggle={onToggle} interestImages={interestImages} />}
      </Flex>

      {/* SIDE TOGGLE — vertical pills on the left edge, one per layout */}
      <Flex
        position="fixed"
        top="50%"
        left="12px"
        direction="column"
        gap="2"
        zIndex={20}
        style={{ transform: "translateY(-50%)" }}
      >
        {GRID_STYLES.map(({ key: s, letter }) => {
          const activeStyle = gridStyle === s
          return (
            <Box
              key={s}
              as="button"
              onClick={() => setGridStyle(s)}
              w="40px" h="40px"
              border={`2px solid ${K}`}
              bg={activeStyle ? K : W}
              color={activeStyle ? W : K}
              fontSize="14px" fontWeight="900" letterSpacing="0.04em"
              cursor="pointer"
              display="flex" alignItems="center" justifyContent="center"
              transition="all 0.12s"
              _hover={{ transform: "translateX(2px)" }}
              boxShadow={activeStyle ? `3px 3px 0 ${B}` : `2px 2px 0 ${K}`}
            >
              {letter}
            </Box>
          )
        })}
      </Flex>

      {/* Sticky bottom action bar */}
      <Flex
        position="fixed" left="0" right="0" bottom="0"
        bg={W} borderTop={`2.5px solid ${K}`} zIndex={5}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        px="5" pt="3" justify="center"
      >
        <Flex maxW="430px" w="100%" align="center" gap="3">
          <Box flex="1">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" color={G} textTransform="uppercase">
              На радаре
            </Text>
            <Flex align="baseline" gap="1.5">
              <Text fontSize="28px" fontWeight="900" color={K} lineHeight="1" letterSpacing="-0.03em">
                {count}
              </Text>
              <Text fontSize="11px" fontWeight="800" color={G}>
                / {INTERESTS.length}
              </Text>
            </Flex>
          </Box>
          <Flex
            as="button"
            onClick={canFinish ? onFinish : undefined}
            aria-disabled={!canFinish}
            px="5" py="3.5"
            bg={canFinish ? K : `${K}30`} color={W}
            border={`3px solid ${K}`}
            cursor={canFinish ? "pointer" : "not-allowed"}
            opacity={canFinish ? 1 : 0.6}
            pointerEvents={canFinish ? "auto" : "none"}
            _hover={canFinish ? { bg: B, borderColor: B } : undefined}
            _active={{ transform: "translate(2px, 2px)" }}
            transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
            align="center" gap="3"
          >
            <Text fontSize="14px" fontWeight="900" letterSpacing="0.06em" textTransform="uppercase">
              Запустить
            </Text>
            <Text fontSize="18px" fontWeight="900" lineHeight="1">→</Text>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  )
}

/**
 * Bento editorial header — landing page variant D style transposed onto the
 * onboarding radar page. Big "Собери / свой радар" wordmark + date / tags row +
 * tagline, instead of the back-button + section-ruler chrome.
 */
function BentoEditorialHeader({
  onBack, recommended,
}: {
  onBack: () => void
  recommended: number
}) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "1fr", sm: "repeat(8, 1fr)" }}
      gap="2"
      alignItems="flex-start"
      mb={{ base: "4", sm: "5" }}
    >
      {/* Left column — title + date + tags */}
      <Box gridColumn={{ base: "1 / -1", sm: "span 5" }} minW="0">
        <Flex
          as="button" onClick={onBack}
          align="center" gap="2" cursor="pointer"
          fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={K}
          mb="2"
          _hover={{ color: B }} transition="color 0.12s"
        >
          <Text fontSize="14px" lineHeight="1">←</Text> Назад
        </Flex>
        <Flex align="flex-start" gap="2">
          <Text
            fontSize={{ base: "40px", sm: "60px" }}
            fontWeight="900" lineHeight="0.86" letterSpacing="-0.045em" color={K}
            textTransform="uppercase"
          >
            Собери
          </Text>
          <Text fontSize={{ base: "11px", sm: "14px" }} fontWeight="900" color={K} mt="1.5">
            01
          </Text>
        </Flex>
        <Text
          fontSize={{ base: "40px", sm: "60px" }}
          fontWeight="900" lineHeight="0.86" letterSpacing="-0.045em" color={B}
          textTransform="uppercase"
          ml="4"
        >
          свой радар
        </Text>
      </Box>

      {/* Right column — section ruler + signal count + tagline */}
      <Box gridColumn={{ base: "1 / -1", sm: "span 3" }} minW="0" mt={{ base: "1", sm: "0" }}>
        <Box h="2px" bg={K} w="100%" mb="2" />
        <Flex align="center" justify="space-between" mb="3">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={G}>
            Section / Радар
          </Text>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={G}>
            {INTERESTS.length} сигналов
          </Text>
        </Flex>
        <Text fontSize="12px" fontWeight="700" lineHeight="1.4" color={G}>
          Выбирай не жанры, а сигналы.
          {' '}
          <Text as="span" color={K} fontWeight="800">{recommended}–5 штук</Text> хватит, чтобы лента поймала своё.
        </Text>
      </Box>
    </Box>
  )
}
