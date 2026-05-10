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

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.55)"

type Step = "intro" | "radar"

export default function PipeOnboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>("intro")
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
    if (step !== "radar") return
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
  }, [step])

  const interestImages = useMemo(() => buildInterestImages(events), [events])

  const toggle = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const goSeeAll = async () => {
    setInterests([])
    try { await Curator.setInterests([]) } catch { /* */ }
    navigate({ to: "/pipe-feed-swipe" })
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

  if (step === "intro") {
    return <IntroScreen onRadar={() => setStep("radar")} onSeeAll={goSeeAll} />
  }
  return (
    <RadarStep
      picked={picked}
      onToggle={toggle}
      onBack={() => setStep("intro")}
      onFinish={finishRadar}
      interestImages={interestImages}
    />
  )
}

/* ───────────────────────────────────────────────────────────────── */
/* STEP 1 — INTRO POSTER                                            */
/* ───────────────────────────────────────────────────────────────── */

function IntroScreen({ onRadar, onSeeAll }: { onRadar: () => void; onSeeAll: () => void }) {
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
      {/* Faint diagonal grid lines — Swiss-poster construction marks */}
      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        opacity={0.06}
        style={{
          backgroundImage:
            `linear-gradient(${K} 1px, transparent 1px), linear-gradient(90deg, ${K} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <Flex
        maxW="520px"
        mx="auto"
        px="6"
        pt="6"
        pb="6"
        direction="column"
        position="relative"
        zIndex={1}
        minH="100dvh"
        gap="6"
      >
        {/* Top header — editorial markers */}
        <Flex justify="space-between" align="flex-start" w="100%">
          <Box>
            <Text fontSize="10px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={K}>
              N° 001
            </Text>
            <Text fontSize="10px" fontWeight="700" letterSpacing="0.22em" textTransform="uppercase" color={G} mt="1">
              v 0 . 1 — radar issue
            </Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="10px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={K}>
              MOSCOW / SPB
            </Text>
            <Text fontSize="10px" fontWeight="700" letterSpacing="0.22em" textTransform="uppercase" color={G} mt="1">
              {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                .format(new Date())
                .toUpperCase()}
            </Text>
          </Box>
        </Flex>

        {/* The hero block */}
        <Flex direction="column" gap="5" flex="1" justify="center">
          {/* Big WORDMARK */}
          <Box>
            <Box
              h="3px"
              bg={K}
              w="100%"
              mb="3"
            />
            <Text
              fontSize={{ base: "64px", sm: "96px" }}
              fontWeight="900"
              lineHeight="0.86"
              letterSpacing="-0.05em"
              textTransform="uppercase"
              color={K}
            >
              CITY
            </Text>
            <Text
              fontSize={{ base: "64px", sm: "96px" }}
              fontWeight="900"
              lineHeight="0.86"
              letterSpacing="-0.05em"
              textTransform="uppercase"
              color={B}
            >
              SIGNAL
            </Text>
            <Box
              h="3px"
              bg={K}
              w="100%"
              mt="3"
            />
          </Box>

          {/* Promise / lede paragraph */}
          <Box>
            <Text
              fontSize={{ base: "20px", sm: "24px" }}
              fontWeight="900"
              lineHeight="1.1"
              letterSpacing="-0.02em"
              color={K}
              textTransform="none"
            >
              События, которые не попали в обычные афиши.
            </Text>
            <Text
              mt="3"
              fontSize="13px"
              fontWeight="700"
              lineHeight="1.45"
              color={G}
              maxW="420px"
            >
              Телеграм-каналы, подвалы, галереи, клубы, кинопоказы,
              лекции и странные штуки на сегодня.
            </Text>
          </Box>

          {/* Side meta — looks like a poster spec sheet */}
          <Flex gap="0" borderTop={`1.5px solid ${K}`} borderBottom={`1.5px solid ${K}`} mt="2">
            <SpecCol label="Источники" value="35+" />
            <SpecCol label="Сигналов" value="12" middle />
            <SpecCol label="Период" value="LIVE" />
          </Flex>
        </Flex>

        {/* Bottom CTAs */}
        <Flex direction="column" gap="3" pb="2">
          {/* Primary */}
          <Flex
            as="button"
            onClick={onRadar}
            align="center"
            justify="space-between"
            px="5"
            py="4"
            bg={K}
            color={W}
            border={`3px solid ${K}`}
            cursor="pointer"
            _hover={{ bg: B, borderColor: B }}
            _active={{ transform: "translate(2px, 2px)" }}
            transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
          >
            <Text
              fontSize={{ base: "16px", sm: "20px" }}
              fontWeight="900"
              letterSpacing="0.05em"
              textTransform="uppercase"
            >
              Собрать радар
            </Text>
            <Text fontSize="22px" fontWeight="900" lineHeight="1">→</Text>
          </Flex>

          {/* Secondary */}
          <Flex
            as="button"
            onClick={onSeeAll}
            align="center"
            justify="space-between"
            px="5"
            py="3.5"
            bg={W}
            color={K}
            border={`3px solid ${K}`}
            cursor="pointer"
            _hover={{ bg: K, color: W }}
            _active={{ transform: "translate(2px, 2px)" }}
            transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
          >
            <Text
              fontSize={{ base: "14px", sm: "16px" }}
              fontWeight="900"
              letterSpacing="0.05em"
              textTransform="uppercase"
            >
              Смотреть всё
            </Text>
            <Text fontSize="18px" fontWeight="900" lineHeight="1" opacity={0.7}>→</Text>
          </Flex>

          {/* Tiny footnote */}
          <Text fontSize="9px" fontWeight="700" letterSpacing="0.22em" textTransform="uppercase" color={G} mt="1" textAlign="center">
            Радар можно собрать позже. Любой выбор обратимый.
          </Text>
        </Flex>
      </Flex>
    </Box>
  )
}

function SpecCol({ label, value, middle = false }: { label: string; value: string; middle?: boolean }) {
  return (
    <Flex
      direction="column"
      flex="1"
      px="3"
      py="3"
      borderLeft={middle ? `1.5px solid ${K}` : undefined}
      borderRight={middle ? `1.5px solid ${K}` : undefined}
    >
      <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={G}>
        {label}
      </Text>
      <Text fontSize="24px" fontWeight="900" letterSpacing="-0.03em" color={K} lineHeight="1.05" mt="1">
        {value}
      </Text>
    </Flex>
  )
}

/* ───────────────────────────────────────────────────────────────── */
/* STEP 2 — RADAR GRID                                               */
/* ───────────────────────────────────────────────────────────────── */

type GridStyle = "swiss" | "museum"

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
            Шаг 02 / 02
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

        {/* Grid style toggle — Swiss / Museum */}
        <Flex
          mb="4"
          border={`1.5px solid ${K}`}
          alignSelf="flex-start"
        >
          {(["museum", "swiss"] as GridStyle[]).map((s, idx, arr) => {
            const activeStyle = gridStyle === s
            const label = s === "swiss" ? "Старый" : "Новый"
            return (
              <Flex
                key={s}
                as="button"
                onClick={() => setGridStyle(s)}
                px="4"
                py="2"
                bg={activeStyle ? K : W}
                color={activeStyle ? W : K}
                fontSize="10px"
                fontWeight="900"
                letterSpacing="0.22em"
                textTransform="uppercase"
                cursor="pointer"
                borderRight={idx < arr.length - 1 ? `1.5px solid ${K}` : undefined}
                transition="background 0.12s, color 0.12s"
              >
                {label}
              </Flex>
            )
          })}
        </Flex>

        {gridStyle === "museum" ? (
          <RadarGridMuseum picked={picked} onToggle={onToggle} />
        ) : (
          <RadarGridSwiss picked={picked} onToggle={onToggle} interestImages={interestImages} />
        )}
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
