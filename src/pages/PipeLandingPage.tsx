/**
 * PipeLandingPage — typography-only landing with 3 switchable poster variants.
 *
 *   A. BLOCK     — grey blocks behind big sans, like "Posters Without Any Pictures? YES."
 *   B. SHAPE     — type-as-shape on solid blue (INDEX ARCHITECTURE / Museo Jumex style)
 *   C. WAVE      — torn / wave-cut white island on blue ("Our future in the delta")
 *
 * Side toggle (vertical pills, left edge) switches between them.
 * All variants share the same K/W/B palette and a single primary CTA → /pipe-onboarding?step=radar.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { isImg, resolveMedia } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.55)"
// Light "paper" greys for variant A
const PAPER_A = "#EBEAE6"
const BLOCK_A = "#D2D0CA"

type Variant = "A" | "B" | "C" | "D"

export default function PipeLandingPage() {
  const navigate = useNavigate()
  const [variant, setVariant] = useState<Variant>("D")
  const [posters, setPosters] = useState<string[]>([])
  const [events, setEvents] = useState<FeedItem[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const feed = await Curator.getFeed({ limit: 80 })
        if (cancelled) return
        const urls: string[] = []
        for (const ev of feed) {
          const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
          const r = resolveMedia(m ?? null)
          if (r && isImg(r)) urls.push(r)
          if (urls.length >= 12) break
        }
        setPosters(urls)
        // For variant D — keep events with image. Bigger pool → smart-assignment has more
        // candidates to filter against the per-slot aspect threshold.
        setEvents(feed.filter((ev) => ev.media_urls?.some(isImg)).slice(0, 60))
      } catch { /* offline ok */ }
    })()
    return () => { cancelled = true }
  }, [])

  const dateLong = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date())
    .toUpperCase()
  const dd = String(new Date().getDate()).padStart(2, "0")
  const mm = String(new Date().getMonth() + 1).padStart(2, "0")
  const yy = String(new Date().getFullYear())

  const goRadar = () => navigate({ to: "/pipe-onboarding", search: { step: "radar" } })

  return (
    <Box
      minH="100dvh"
      position="relative"
      overflow="hidden"
      css={{ WebkitTapHighlightColor: "transparent" }}
      style={{
        fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* SIDE TOGGLE — fixed vertical pills */}
      <Flex
        position="fixed"
        top="50%"
        left="12px"
        direction="column"
        gap="2"
        zIndex={20}
        style={{ transform: "translateY(-50%)" }}
      >
        {(["A", "B", "C", "D"] as Variant[]).map((v) => {
          const isActive = variant === v
          return (
            <Box
              key={v}
              as="button"
              onClick={() => setVariant(v)}
              w="40px"
              h="40px"
              border={`2px solid ${K}`}
              bg={isActive ? K : W}
              color={isActive ? W : K}
              fontSize="14px"
              fontWeight="900"
              letterSpacing="0.04em"
              cursor="pointer"
              display="flex"
              alignItems="center"
              justifyContent="center"
              transition="all 0.12s"
              _hover={{ transform: "translateX(2px)" }}
              boxShadow={isActive ? `3px 3px 0 ${B}` : `2px 2px 0 ${K}`}
            >
              {v}
            </Box>
          )
        })}
      </Flex>

      {variant === "A" && <VariantBlock onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} />}
      {variant === "B" && <VariantShape onCta={goRadar} dateLong={dateLong} />}
      {variant === "C" && <VariantWave onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} />}
      {variant === "D" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} />}
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* VARIANT A — BLOCKS                                          */
/* Big sans words on dark-grey rectangular blocks.             */
/* Black "ДА." plate as accent. Editorial labels in corners.  */
/* ─────────────────────────────────────────────────────────── */

function VariantBlock({ onCta, dd, mm, yy, dateLong }: { onCta: () => void; dd: string; mm: string; yy: string; dateLong: string }) {
  return (
    <Box
      minH="100dvh"
      bg={PAPER_A}
      color={K}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
      position="relative"
    >
      {/* Subtle grain */}
      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        opacity={0.4}
        style={{
          backgroundImage: "radial-gradient(rgba(13,13,13,0.07) 0.5px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />

      <Flex
        maxW="540px"
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
        {/* Top corner labels */}
        <Flex justify="space-between" align="flex-start" gap="3">
          <CornerTag bg={K} color={W}>
            UI/UX & WEB<br />DESIGNER → СОБЫТИЯ
          </CornerTag>
          <CornerTag bg={K} color={W}>
            DOCUMENTING<br />MY CITY SIGNAL
          </CornerTag>
          <CornerTag bg={K} color={W}>C.08</CornerTag>
        </Flex>

        {/* HERO — words on grey blocks */}
        <Box position="relative" mt="4">
          {["События", "которые", "не попали", "в афиши?"].map((word, i) => (
            <Box key={i} display="inline-block" bg={BLOCK_A} px="3" py="1" mr="2" mb="2">
              <Text
                fontSize={{ base: "44px", sm: "60px" }}
                fontWeight="900"
                lineHeight="0.94"
                letterSpacing="-0.025em"
                color={K}
              >
                {word}
              </Text>
            </Box>
          ))}

          {/* Mini caption block */}
          <Box display="inline-block" bg={K} color={W} px="2" py="1.5" ml="2" mt="-3" verticalAlign="middle">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" lineHeight="1.4" textTransform="uppercase">
              35+ ТЕЛЕГРАМ-КАНАЛОВ,<br />
              которые не публикуют<br />
              нигде кроме себя.
            </Text>
          </Box>
        </Box>

        {/* Big black YES plate */}
        <Box mt="4" alignSelf="flex-end">
          <Box bg={K} color={W} px="6" py="3" display="inline-block">
            <Text
              fontSize={{ base: "70px", sm: "100px" }}
              fontWeight="900"
              letterSpacing="-0.04em"
              lineHeight="0.86"
            >
              ДА.
            </Text>
          </Box>
        </Box>

        {/* Side caption */}
        <Box bg={W} color={K} px="3" py="2" alignSelf="flex-start" maxW="320px">
          <Text fontSize="12px" fontWeight="900" letterSpacing="0.04em" textTransform="uppercase" lineHeight="1.3">
            Потому что афиши —<br />
            не единственный<br />
            способ поймать сигнал.
          </Text>
        </Box>

        {/* CTA */}
        <Flex
          as="button"
          onClick={onCta}
          align="center"
          justify="space-between"
          px="5"
          py="4"
          bg={K}
          color={W}
          border={`3px solid ${K}`}
          cursor="pointer"
          mt="auto"
          _hover={{ bg: B, borderColor: B }}
          _active={{ transform: "translate(2px, 2px)" }}
          transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
        >
          <Text fontSize={{ base: "16px", sm: "20px" }} fontWeight="900" letterSpacing="0.05em" textTransform="uppercase">
            Собрать радар
          </Text>
          <Text fontSize="22px" fontWeight="900" lineHeight="1">→</Text>
        </Flex>

        {/* Bottom corner labels */}
        <Flex justify="space-between" align="flex-start" gap="3">
          <CornerTag bg={K} color={W}>
            N° 001<br />v 0.1
          </CornerTag>
          <CornerTag bg={K} color={W}>{dd}.{mm}.{yy}</CornerTag>
          <CornerTag bg={K} color={W}>PIPE / RD{yy.slice(2)}</CornerTag>
        </Flex>
      </Flex>
    </Box>
  )
}

function CornerTag({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <Box bg={bg} color={color} px="2" py="1" fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" lineHeight="1.3">
      {children}
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* VARIANT B — SHAPE                                            */
/* Solid blue. Words tilted to compose a typographic letter "S".*/
/* Side vertical text. Black-on-blue.                          */
/* ─────────────────────────────────────────────────────────── */

function VariantShape({ onCta, dateLong }: { onCta: () => void; dateLong: string }) {
  // Words arranged on staggered diagonal lines forming an "S" shape
  const lines: { text: string; x: number; y: number; rotate: number; size: string }[] = [
    { text: "CITY SIGNAL", x: 25, y: 18, rotate: -22, size: "30px" },
    { text: "RADAR", x: 50, y: 32, rotate: -22, size: "44px" },
    { text: "MOSCOW · SPB", x: 30, y: 46, rotate: -22, size: "26px" },
    { text: `${dateLong}`, x: 16, y: 60, rotate: -22, size: "22px" },
    { text: "EVENTS THAT", x: 28, y: 72, rotate: -22, size: "24px" },
    { text: "DON'T MAKE IT", x: 42, y: 84, rotate: -22, size: "28px" },
  ]

  return (
    <Box minH="100dvh" bg={B} color={K} position="relative" overflow="hidden"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Vertical text — left edge */}
      <Box
        position="absolute"
        top="6%"
        left="14px"
        color={K}
        fontSize="11px"
        fontWeight="700"
        letterSpacing="0.12em"
        textTransform="lowercase"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        :city signal — radar issue n° 001
      </Box>

      {/* Vertical text — right edge */}
      <Box
        position="absolute"
        top="6%"
        right="14px"
        color={K}
        fontSize="11px"
        fontWeight="900"
        letterSpacing="0.18em"
        textTransform="uppercase"
        style={{ writingMode: "vertical-rl" }}
      >
        ✱ MOSCOW JUMEX
      </Box>

      {/* Composition — words on diagonal lines */}
      <Box position="relative" w="100%" h="100dvh" px="14">
        {lines.map((l, i) => (
          <Box
            key={i}
            position="absolute"
            top={`${l.y}%`}
            left={`${l.x}%`}
            style={{
              transform: `translate(-50%, -50%) rotate(${l.rotate}deg)`,
              transformOrigin: "center center",
            }}
            pointerEvents="none"
          >
            <Text
              fontSize={l.size}
              fontWeight="900"
              letterSpacing="-0.025em"
              textTransform="uppercase"
              color={K}
              whiteSpace="nowrap"
            >
              {l.text}
            </Text>
          </Box>
        ))}

        {/* Tiny rotated descriptor near top of S */}
        <Box
          position="absolute"
          top="22%"
          right="18%"
          maxW="200px"
          color={K}
          fontSize="10px"
          fontWeight="700"
          lineHeight="1.35"
          style={{ transform: "rotate(-22deg)", transformOrigin: "left top" }}
        >
          подвалы, галереи, клубы и кинопоказы — собранные с 35+ телеграм-каналов
        </Box>
      </Box>

      {/* CTA — bottom right */}
      <Box position="absolute" bottom="20px" right="20px" zIndex={5}>
        <Flex
          as="button"
          onClick={onCta}
          align="center"
          gap="3"
          px="5"
          py="3.5"
          bg={K}
          color={W}
          border={`3px solid ${K}`}
          cursor="pointer"
          _hover={{ bg: W, color: K }}
          _active={{ transform: "translate(2px, 2px)" }}
          transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
        >
          <Text fontSize="16px" fontWeight="900" letterSpacing="0.05em" textTransform="uppercase">
            Собрать радар
          </Text>
          <Text fontSize="20px" fontWeight="900" lineHeight="1">→</Text>
        </Flex>
      </Box>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* VARIANT C — WAVE                                             */
/* Solid blue with a torn / wave-cut white island top-right.   */
/* Type sits inside the white island. Bottom bleed strip.      */
/* ─────────────────────────────────────────────────────────── */

function VariantWave({ onCta, dd, mm, yy, dateLong }: { onCta: () => void; dd: string; mm: string; yy: string; dateLong: string }) {
  // Irregular path approximating a coastline
  const wavePath =
    "M 0 0 L 100 0 L 100 100 L 56 100 L 54 96 L 52 90 L 49 86 L 50 80 L 47 76 L 45 71 L 47 66 L 44 61 L 46 55 L 42 50 L 40 45 L 43 40 L 41 35 L 38 30 L 41 25 L 38 20 L 35 14 L 31 9 L 25 5 L 17 3 L 8 2 L 0 0 Z"

  return (
    <Box minH="100dvh" bg={B} color={K} position="relative" overflow="hidden"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Wave-cut white area — top-right */}
      <Box position="absolute" top="0" right="0" w="100%" h={{ base: "70%", sm: "75%" }} pointerEvents="none">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
          <path d={wavePath} fill={W} />
        </svg>
      </Box>

      {/* Content inside the white island */}
      <Flex maxW="540px" mx="auto" px="6" pt="6" pb="6" direction="column" position="relative" zIndex={2} minH="100dvh">
        <Box maxW={{ base: "92%", sm: "70%" }} ml="auto" textAlign="left">
          <Text fontSize="11px" fontWeight="800" lineHeight="1.25" color={K}>
            international<br />
            architecture<br />
            biennale<br />
            moscow · spb
          </Text>
          <Text
            mt="3"
            fontSize={{ base: "44px", sm: "60px" }}
            fontWeight="900"
            lineHeight="0.94"
            letterSpacing="-0.03em"
            color={K}
          >
            события,<br />
            которые<br />
            пропускают<br />
            обычные афиши
          </Text>

          <Flex mt="4" gap="6" align="flex-start">
            <Box>
              <Text fontSize="11px" fontWeight="800" lineHeight="1.4" color={K}>
                подвалы<br />
                галереи<br />
                клубы<br />
                кинопоказы<br />
                лекции
              </Text>
            </Box>
            <Box>
              <Text fontSize="13px" fontWeight="900" lineHeight="1.25" color={K}>
                {dateLong}<br />
                live · {dateLong.split(" ")[2]}
              </Text>
              <Text fontSize="13px" fontWeight="900" mt="2" color={K}>
                citysignal.io
              </Text>
            </Box>
          </Flex>
        </Box>

        {/* CTA — middle of blue area */}
        <Flex
          as="button"
          onClick={onCta}
          align="center"
          justify="space-between"
          px="5"
          py="4"
          bg={K}
          color={W}
          border={`3px solid ${K}`}
          cursor="pointer"
          mt="auto"
          mb="6"
          alignSelf={{ base: "stretch", sm: "flex-start" }}
          minW={{ sm: "300px" }}
          _hover={{ bg: W, color: K }}
          _active={{ transform: "translate(2px, 2px)" }}
          transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
        >
          <Text fontSize={{ base: "16px", sm: "18px" }} fontWeight="900" letterSpacing="0.05em" textTransform="uppercase">
            Собрать радар
          </Text>
          <Text fontSize="20px" fontWeight="900" lineHeight="1">→</Text>
        </Flex>
      </Flex>

      {/* Bottom bleed strip — code crossing white/blue boundary */}
      <Box
        position="absolute"
        bottom={{ base: "12px", sm: "20px" }}
        left="0"
        right="0"
        textAlign="left"
        px="6"
        zIndex={3}
      >
        <Text
          fontSize={{ base: "26px", sm: "34px" }}
          fontWeight="900"
          letterSpacing="-0.02em"
          textTransform="uppercase"
          color={W}
          lineHeight="1"
        >
          PIPE — {dd}.{mm}.{yy} — CITY SIGNAL — RD{yy.slice(2)} — THE MISSING LINK
        </Text>
      </Box>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* VARIANT D — BENTO  (Grafist 22 reference)                    */
/* Editorial info on top half, bento wall of event-card blocks  */
/* on the bottom. Bauhaus dotted bg, white + blue palette.     */
/* ─────────────────────────────────────────────────────────── */

function VariantBento({ onCta, dd, mm, yy, dateLong, posters: _posters, events }: {
  onCta: () => void
  dd: string; mm: string; yy: string; dateLong: string
  posters: string[]
  events: FeedItem[]
}) {
  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      position="relative"
      overflow="hidden"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Dotted bauhaus bg */}
      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        opacity={0.55}
        style={{
          backgroundImage: `radial-gradient(rgba(13,13,13,0.18) 1px, transparent 1.4px)`,
          backgroundSize: "12px 12px",
        }}
      />

      {/* ── Bauhaus 4 blue pixel-clusters — same cell size everywhere ── */}
      {/* Container size = grid cols/rows × cell size (22px on mobile, 26px on sm+). */}
      <Box
        position="absolute" top="0" left="0"
        w={{ base: `${TOP_LEFT_GRID[0].length * 22}px`, sm: `${TOP_LEFT_GRID[0].length * 26}px` }}
        h={{ base: `${TOP_LEFT_GRID.length * 22}px`,    sm: `${TOP_LEFT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.95}
      >
        <PixelCluster grid={TOP_LEFT_GRID} color={B} shimmerSeed={0} />
      </Box>
      <Box
        position="absolute" top={{ base: "320px", sm: "400px" }} right="0"
        w={{ base: `${MID_RIGHT_GRID[0].length * 22}px`, sm: `${MID_RIGHT_GRID[0].length * 26}px` }}
        h={{ base: `${MID_RIGHT_GRID.length * 22}px`,    sm: `${MID_RIGHT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.95}
      >
        <PixelCluster grid={MID_RIGHT_GRID} color={B} shimmerSeed={400} />
      </Box>
      <Box
        position="absolute" bottom={{ base: "120px", sm: "160px" }} left="0"
        w={{ base: `${BOTTOM_LEFT_GRID[0].length * 22}px`, sm: `${BOTTOM_LEFT_GRID[0].length * 26}px` }}
        h={{ base: `${BOTTOM_LEFT_GRID.length * 22}px`,    sm: `${BOTTOM_LEFT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.85}
      >
        <PixelCluster grid={BOTTOM_LEFT_GRID} color={B} shimmerSeed={900} />
      </Box>
      <Box
        position="absolute" bottom="0" right="0"
        w={{ base: `${BOTTOM_RIGHT_GRID[0].length * 22}px`, sm: `${BOTTOM_RIGHT_GRID[0].length * 26}px` }}
        h={{ base: `${BOTTOM_RIGHT_GRID.length * 22}px`,    sm: `${BOTTOM_RIGHT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.95}
      >
        <PixelCluster grid={BOTTOM_RIGHT_GRID} color={B} shimmerSeed={1500} />
      </Box>

      <Flex
        maxW="640px"
        mx="auto"
        px="6"
        pt="6"
        pb="6"
        direction="column"
        position="relative"
        zIndex={2}
        minH="100dvh"
        gap="5"
      >
        {/* TOP — editorial info section. Uses the SAME 8-col grid as the bento below
            so the right text block lines up with card #2 (slot 1, cols 6-8). */}
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", sm: "repeat(8, 1fr)" }}
          gap="2"
          alignItems="flex-start"
        >
          {/* Left col — title + date (cols 1-5, same as the big TALL slot below) */}
          <Box gridColumn={{ base: "1 / -1", sm: "span 5" }} minW="0">
            <Flex align="flex-start" gap="2">
              <Text
                fontSize={{ base: "44px", sm: "60px" }}
                fontWeight="900"
                lineHeight="0.86"
                letterSpacing="-0.04em"
                color={K}
              >
                CitySignal
              </Text>
              <Text fontSize="14px" fontWeight="900" color={K} mt="2">
                01
              </Text>
            </Flex>
            <Text fontSize="13px" fontWeight="800" color={K} mt="3" lineHeight="1.3">
              Радар-выпуск № 001<br />
              <Text as="span" fontStyle="italic" color={G}>Curated city signal weekly</Text>
            </Text>
            <Text fontSize="11px" fontWeight="700" color={B} mt="3" letterSpacing="0.04em">
              citysignal.io
            </Text>
            <Text fontSize="13px" fontWeight="900" color={K} mt="6" letterSpacing="-0.01em">
              {dd}.{mm}.{yy} —— {dateLong.split(" ").slice(0, 2).join(" ")}
            </Text>

            {/* Tiny logo placeholders */}
            <Flex gap="3" mt="6" align="center">
              <Box bg={K} color={W} px="2" py="1" fontSize="9px" fontWeight="900" letterSpacing="0.16em">
                PIPE/RD{yy.slice(2)}
              </Box>
              <Box border={`1.5px solid ${K}`} px="2" py="0.5" fontSize="9px" fontWeight="900" letterSpacing="0.16em">
                MOSCOW · SPB
              </Box>
            </Flex>
          </Box>

          {/* Right col — sources / programme (cols 6-8, lines up with card #2 above) */}
          <Box gridColumn={{ base: "1 / -1", sm: "span 3" }} minW="0">
            <Flex direction="column" gap="0.5">
              <Text fontSize="13px" fontWeight="900" color={K}>Garagemca</Text>
              <Text fontSize="13px" fontWeight="900" color={K}>Faux_monnayage</Text>
              <Text fontSize="13px" fontWeight="900" color={K}>Random_culture</Text>
              <Text fontSize="13px" fontWeight="900" color={K}>Cyclelab</Text>
              <Text fontSize="13px" fontWeight="900" color={K}>Tancevat</Text>
            </Flex>

            <Box mt="5">
              <Flex align="center" gap="1">
                <Text fontSize="13px" fontWeight="900" color={B}>↗</Text>
                <Text fontSize="13px" fontWeight="900" color={K}>
                  Подсигналы / <Text as="span" fontStyle="italic" color={G}>Sub-signals</Text>
                </Text>
              </Flex>
              <Text fontSize="13px" fontWeight="900" color={K} mt="1">
                {dd}.{mm}.{yy} —— {dateLong.split(" ").slice(0, 2).join(" ")}
              </Text>
              <Text fontSize="11px" color={K} mt="1" lineHeight="1.4">
                Кино / Театр / Музыка / Перформанс /<br />
                Выставки / Лекции / Танец / Дизайн
              </Text>

              <Flex align="center" gap="1" mt="4">
                <Text fontSize="13px" fontWeight="900" color={B}>↗</Text>
                <Text fontSize="13px" fontWeight="900" color={K}>
                  35+ ТГ-каналов / <Text as="span" fontStyle="italic" color={G}>Sources</Text>
                </Text>
              </Flex>
              <Text fontSize="13px" fontWeight="900" color={K} mt="1">
                LIVE / каждые 30 минут
              </Text>
            </Box>
          </Box>
        </Box>

        {/* EVENT CARDS — bento grid with varying sizes + auto-rotation */}
        <Box mt="2" pb="3">
          <BentoEventWall events={events} />
        </Box>

        {/* CTA */}
        <Flex
          as="button"
          onClick={onCta}
          align="center"
          justify="space-between"
          px="5"
          py="4"
          bg={K}
          color={W}
          border={`3px solid ${K}`}
          cursor="pointer"
          mt="auto"
          _hover={{ bg: B, borderColor: B }}
          _active={{ transform: "translate(2px, 2px)" }}
          transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
        >
          <Text fontSize={{ base: "16px", sm: "20px" }} fontWeight="900" letterSpacing="0.05em" textTransform="uppercase">
            Собрать радар
          </Text>
          <Text fontSize="22px" fontWeight="900" lineHeight="1">→</Text>
        </Flex>

        {/* Footer credits */}
        <Flex justify="space-between" align="center" gap="2" pt="2" borderTop={`1.5px solid ${K}`} flexWrap="wrap">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={G}>
            partnership / kollab
          </Text>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={G}>
            sponsor / spons.
          </Text>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={G}>
            partners / part.
          </Text>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={G}>
            media / med.
          </Text>
        </Flex>
      </Flex>
    </Box>
  )
}

/**
 * EventEditorialCard — landscape split-layout card used on the Bento variant.
 * Mirrors the user's reference style:
 *   • image on one side (original color, slight grayscale for poster feel)
 *   • text panel on the other with channel (blue), big № tag, big title (black),
 *     blue date plate at bottom-left of the image, ↗ arrow bottom-right
 *   • alternating image left/right per index for visual rhythm
 */
function EventEditorialCard({ ev, index }: { ev: FeedItem; index: number }) {
  const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  const src = r && isImg(r) ? r : null
  const num = String(index + 2).padStart(2, "0")
  const date = ev.event_time
    ? new Date(ev.event_time).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "").toUpperCase()
    : ""
  const title = (ev.title || "Событие").trim()
  const channelStr = ev.channel.replace(/^@/, "").toUpperCase()

  // Alternate image side per index
  const imageRight = index % 2 === 1

  const imagePanel = (
    <Box
      position="relative"
      flexShrink={0}
      w={{ base: "120px", sm: "200px" }}
      bg={K}
      overflow="hidden"
      borderRight={imageRight ? undefined : `2px solid ${K}`}
      borderLeft={imageRight ? `2px solid ${K}` : undefined}
    >
      {src && (
        <Box
          position="absolute"
          inset="0"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "grayscale(0.85) contrast(1.05)",
          }}
        />
      )}
      {/* Blue date plate bottom-left of image */}
      {date && (
        <Box
          position="absolute"
          bottom="0"
          left={imageRight ? undefined : "0"}
          right={imageRight ? "0" : undefined}
          bg={B}
          color={W}
          px="2"
          py="1"
          fontSize="10px"
          fontWeight="900"
          letterSpacing="0.14em"
        >
          {date}
        </Box>
      )}
    </Box>
  )

  const textPanel = (
    <Flex flex="1" minW="0" direction="column" justify="space-between" px="3" py="3" bg={W}>
      {/* Top — channel + № tag */}
      <Flex justify="space-between" align="flex-start" gap="2" mb="2">
        <Flex align="center" gap="1.5" minW="0">
          <Box w="8px" h="8px" bg={B} flexShrink={0} />
          <Text
            fontSize="11px"
            fontWeight="900"
            letterSpacing="0.16em"
            color={B}
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {channelStr}
          </Text>
        </Flex>
        <Text
          fontSize="20px"
          fontWeight="900"
          letterSpacing="-0.03em"
          color={K}
          lineHeight="1"
          flexShrink={0}
        >
          {num}
        </Text>
      </Flex>

      {/* Title — splits by space, no wrap-break */}
      <Box flex="1">
        <Text
          fontSize={{ base: "14px", sm: "16px" }}
          fontWeight="900"
          lineHeight="1.1"
          letterSpacing="-0.015em"
          textTransform="uppercase"
          color={K}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Text>
      </Box>

      {/* Bottom row — divider + arrow */}
      <Flex align="center" justify="space-between" mt="2" pt="2" borderTop={`1.5px solid ${K}20`}>
        <Box w="22px" h="2px" bg={K} />
        <Text fontSize="14px" fontWeight="900" color={K} lineHeight="1">↗</Text>
      </Flex>
    </Flex>
  )

  return (
    <Flex
      align="stretch"
      bg={W}
      color={K}
      border={`2px solid ${K}`}
      minH={{ base: "140px", sm: "170px" }}
      transition="transform 0.16s, box-shadow 0.16s"
      _hover={{ transform: "translateY(-2px)", boxShadow: `4px 4px 0 ${B}` }}
    >
      {imageRight ? (
        <>
          {textPanel}
          {imagePanel}
        </>
      ) : (
        <>
          {imagePanel}
          {textPanel}
        </>
      )}
    </Flex>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* BentoEventWall — irregular grid with auto-rotating cards    */
/* ─────────────────────────────────────────────────────────── */

type SlotShape = "tall" | "wide" | "square" | "tallSmall"
type SlotConfig = {
  colSpan: number
  rowSpan: number
  shape: SlotShape
  accent: "blue" | "black"
  /** ACTUAL W/H aspect of the rendered image area — used by smart-assignment to pick best-fitting poster. */
  targetAspect: number
  /** TALL/SQUARE — fraction of card height occupied by the image (0..1). Default 0.7. */
  imageRatio?: number
  /** WIDE — fraction of card width occupied by the image (0..1). Default 0.38. */
  imageWidth?: number
}

// 5 slot bento layout (8-col grid, ~68px row units, dense flow).
// Per-slot imageRatio / imageWidth lets big slots devote more space to the poster
// (and shrink the text panel). targetAspect is set to MATCH the resulting image area.
// Container ≈ 720px wide → colWidth ≈ 83px (with 8px gaps). Row 68px + 8px gap.
const BENTO_SLOTS: SlotConfig[] = [
  // 5×5 TALL big poster: cardW=447, cardH=372. imageRatio 0.72 → imgH≈268, text≈104px → aspect ≈ 1.67
  { colSpan: 5, rowSpan: 5, shape: "tall",      accent: "blue",  targetAspect: 1.65, imageRatio: 0.72 },
  // 3×2 WIDE small: cardW=265, cardH=144. imageWidth 0.38 → imgW≈100, imgH=144 → aspect ≈ 0.70
  { colSpan: 3, rowSpan: 2, shape: "wide",      accent: "black", targetAspect: 0.70, imageWidth: 0.38 },
  // 3×3 TALLSMALL: cardW=265, cardH=220. imageRatio 0.68 → imgH≈150, text≈70px → aspect ≈ 1.77
  { colSpan: 3, rowSpan: 3, shape: "tallSmall", accent: "blue",  targetAspect: 1.75, imageRatio: 0.68 },
  // 4×3 WIDE: cardW=356, cardH=220. imageWidth 0.45 → imgW≈160, imgH=220 → aspect ≈ 0.73
  { colSpan: 4, rowSpan: 3, shape: "wide",      accent: "black", targetAspect: 0.73, imageWidth: 0.45 },
  // 4×3 SQUARE: cardW=356, cardH=220. imageRatio 0.65 → imgH≈143, text≈77px → aspect ≈ 2.49
  { colSpan: 4, rowSpan: 3, shape: "square",    accent: "blue",  targetAspect: 2.45, imageRatio: 0.65 },
]

const ROTATE_INTERVAL_MS = 5000

/** Get poster URL for an event (first image in media_urls). */
function eventPosterUrl(ev: FeedItem): string | null {
  const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  return r && isImg(r) ? r : null
}

/** Preload images and resolve to map of url → aspect (W/H). Failures map to 1 (square). */
function useImageAspects(urls: (string | null)[]) {
  const [aspects, setAspects] = useState<Record<string, number>>({})
  useEffect(() => {
    let cancelled = false
    const unique = Array.from(new Set(urls.filter((u): u is string => !!u)))
    unique.forEach((url) => {
      if (aspects[url]) return
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
        setAspects((prev) => ({ ...prev, [url]: ratio }))
      }
      img.onerror = () => {
        if (cancelled) return
        setAspects((prev) => ({ ...prev, [url]: 1 }))
      }
      img.src = url
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.join("|")])
  return aspects
}

/**
 * Maximum log-distance between an image's natural aspect and a slot's targetAspect
 * for it to be considered a "good fit". 0.35 ≈ image aspect within ±42% of target
 * (e.g. target 1.0 → accepts 0.70 .. 1.42). Anything past this gets dropped.
 */
const FIT_THRESHOLD = 0.35
/** Looser fallback if strict pass leaves slots empty (rare with a 60-event pool). */
const FALLBACK_THRESHOLD = 0.65

function aspectDistance(aspect: number | null, target: number): number {
  if (aspect == null) return Infinity
  return Math.abs(Math.log(aspect) - Math.log(target))
}

/**
 * Smart assignment: for each slot, pick the best-fitting unused event whose image
 * aspect is within FIT_THRESHOLD of slot.targetAspect. If no candidate qualifies,
 * relax to FALLBACK_THRESHOLD. Events without loaded image dimensions are skipped.
 */
function assignEventsToSlots(
  events: FeedItem[],
  aspects: Record<string, number>,
): FeedItem[] {
  const used = new Set<string>()
  const result: FeedItem[] = []
  const pickFor = (slot: SlotConfig, threshold: number): FeedItem | null => {
    let best: FeedItem | null = null
    let bestDist = threshold
    for (const ev of events) {
      if (used.has(ev.id)) continue
      const url = eventPosterUrl(ev)
      if (!url) continue
      const aspect = aspects[url]
      const dist = aspectDistance(aspect ?? null, slot.targetAspect)
      if (dist < bestDist) { bestDist = dist; best = ev }
    }
    return best
  }
  for (const slot of BENTO_SLOTS) {
    const ev = pickFor(slot, FIT_THRESHOLD) ?? pickFor(slot, FALLBACK_THRESHOLD)
    if (ev) { used.add(ev.id); result.push(ev) }
  }
  return result
}

function BentoEventWall({ events }: { events: FeedItem[] }) {
  // Preload aspects for the whole pool so smart assignment has data on hand.
  const allUrls = useMemo(() => events.map(eventPosterUrl), [events])
  const aspects = useImageAspects(allUrls)

  const [slotEvents, setSlotEvents] = useState<FeedItem[]>([])
  const poolIdxRef = useRef(BENTO_SLOTS.length)

  useEffect(() => {
    if (events.length === 0) return
    // initial smart assignment
    setSlotEvents(assignEventsToSlots(events, aspects))
    poolIdxRef.current = BENTO_SLOTS.length
    if (events.length <= BENTO_SLOTS.length) return
    const id = window.setInterval(() => {
      // pick a random slot, swap in the best-fitting unused event with image fit < threshold
      setSlotEvents((prev) => {
        const slotIdx = Math.floor(Math.random() * BENTO_SLOTS.length)
        const slot = BENTO_SLOTS[slotIdx]
        const usedIds = new Set(prev.map((e) => e.id))
        const findBest = (threshold: number): FeedItem | null => {
          let best: FeedItem | null = null
          let bestDist = threshold
          for (const ev of events) {
            if (usedIds.has(ev.id)) continue
            const url = eventPosterUrl(ev)
            if (!url) continue
            const dist = aspectDistance(aspects[url] ?? null, slot.targetAspect)
            if (dist < bestDist) { bestDist = dist; best = ev }
          }
          return best
        }
        const next = findBest(FIT_THRESHOLD) ?? findBest(FALLBACK_THRESHOLD)
        if (!next) return prev // no qualifying replacement — keep current
        return prev.map((e, i) => (i === slotIdx ? next : e))
      })
      poolIdxRef.current += 1
    }, ROTATE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [events, aspects])

  return (
    <>
      <style>{`
        @keyframes bento-card-in {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);   }
        }
        .bento-card-anim {
          animation: bento-card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: opacity, transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .bento-card-anim { animation: none; }
        }
      `}</style>

      <Box
        display="grid"
        gridTemplateColumns="repeat(8, 1fr)"
        gridAutoRows="68px"
        gap="2"
        gridAutoFlow="dense"
      >
        {BENTO_SLOTS.map((slot, i) => {
          const ev = slotEvents[i]
          return (
            <Box
              key={`slot-${i}`}
              gridColumn={`span ${slot.colSpan}`}
              gridRow={`span ${slot.rowSpan}`}
              position="relative"
              overflow="hidden"
            >
              {ev ? (
                <BentoCard
                  key={ev.id}
                  ev={ev}
                  shape={slot.shape}
                  accent={slot.accent}
                  index={i}
                  imageRatio={slot.imageRatio ?? 0.7}
                  imageWidth={slot.imageWidth ?? 0.38}
                />
              ) : (
                <Box w="100%" h="100%" bg={`${K}06`} border={`2px solid ${K}10`} />
              )}
            </Box>
          )
        })}
      </Box>
    </>
  )
}

function BentoCard({
  ev, shape, accent, index, imageRatio = 0.7, imageWidth = 0.38,
}: {
  ev: FeedItem
  shape: SlotShape
  accent: "blue" | "black"
  index: number
  /** TALL/SQUARE — fraction of card height for the image (0..1). */
  imageRatio?: number
  /** WIDE — fraction of card width for the image (0..1). */
  imageWidth?: number
}) {
  // Convert ratios to flex weights (×100 for whole numbers).
  const imgFlex = Math.round(imageRatio * 100)
  const txtFlex = Math.round((1 - imageRatio) * 100)
  const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  const src = r && isImg(r) ? r : null
  const date = ev.event_time
    ? new Date(ev.event_time).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "").toUpperCase()
    : ""
  const num = String(index + 1).padStart(2, "0")
  const channelStr = ev.channel.replace(/^@/, "").toUpperCase()
  const title = (ev.title || "Событие").trim()

  const accentColor = accent === "blue" ? B : K
  const accentTextColor = accent === "blue" ? W : W

  // SQUARE — image on top, white text panel below (same pattern as TALL)
  if (shape === "square") {
    return (
      <Flex
        direction="column"
        w="100%"
        h="100%"
        bg={W}
        border={`2px solid ${K}`}
        overflow="hidden"
      >
        <Box position="relative" flex={imgFlex} minH="0" bg={K} overflow="hidden" borderBottom={`2px solid ${K}`}>
          {src && (
            <Box
              position="absolute"
              inset="0"
              style={{
                backgroundImage: `url(${src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "grayscale(0.7) contrast(1.05)",
              }}
            />
          )}
          {date && (
            <Box position="absolute" bottom="0" left="0" bg={B} color={W} px="2" py="0.5" fontSize="10px" fontWeight="900" letterSpacing="0.14em" lineHeight="1.4">
              {date}
            </Box>
          )}
          <Text position="absolute" top="6px" right="8px" fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={W} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            № {num}
          </Text>
        </Box>
        <Flex direction="column" justify="space-between" px="2.5" py="2" flex={txtFlex} minH="0" gap="1">
          <Box minW="0">
            <Flex align="center" gap="1.5" mb="1" minW="0">
              <Box w="6px" h="6px" bg={B} flexShrink={0} />
              <Text
                fontSize="10px"
                fontWeight="900"
                letterSpacing="0.12em"
                color={B}
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {channelStr}
              </Text>
            </Flex>
            <Text
              fontSize="12px"
              fontWeight="900"
              lineHeight="1.1"
              letterSpacing="-0.012em"
              textTransform="uppercase"
              color={K}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {title}
            </Text>
          </Box>
          <Flex justify="space-between" align="center" mt="1">
            <Box w="16px" h="2px" bg={K} />
            <Text fontSize="12px" fontWeight="900" color={accentColor} lineHeight="1">↗</Text>
          </Flex>
        </Flex>
      </Flex>
    )
  }

  // TALL — image top (60-70%), text bottom
  if (shape === "tall" || shape === "tallSmall") {
    return (
      <Flex
        direction="column"
        w="100%"
        h="100%"
        bg={W}
        border={`2px solid ${K}`}
        overflow="hidden"
      >
        <Box position="relative" flex={imgFlex} minH="0" bg={K} overflow="hidden" borderBottom={`2px solid ${K}`}>
          {src && (
            <Box
              position="absolute"
              inset="0"
              style={{
                backgroundImage: `url(${src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "grayscale(0.85) contrast(1.05)",
              }}
            />
          )}
          {date && (
            <Box position="absolute" bottom="0" left="0" bg={B} color={W} px="2" py="0.5" fontSize="10px" fontWeight="900" letterSpacing="0.14em" lineHeight="1.4">
              {date}
            </Box>
          )}
          <Text position="absolute" top="6px" right="8px" fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={W} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            № {num}
          </Text>
        </Box>
        <Flex direction="column" justify="space-between" px="2.5" py="2" flex={txtFlex} minH="0" gap="1">
          <Box minW="0">
            <Flex align="center" gap="1.5" mb="1" minW="0">
              <Box w="6px" h="6px" bg={B} flexShrink={0} />
              <Text
                fontSize="10px"
                fontWeight="900"
                letterSpacing="0.12em"
                color={B}
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {channelStr}
              </Text>
            </Flex>
            <Text
              fontSize={shape === "tall" ? "13px" : "11px"}
              fontWeight="900"
              lineHeight="1.1"
              letterSpacing="-0.012em"
              textTransform="uppercase"
              color={K}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: shape === "tall" ? 3 : 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {title}
            </Text>
          </Box>
          <Flex justify="space-between" align="center" mt="1">
            <Box w="16px" h="2px" bg={K} />
            <Text fontSize="12px" fontWeight="900" color={accentColor} lineHeight="1">↗</Text>
          </Flex>
        </Flex>
      </Flex>
    )
  }

  // WIDE — image left, text right
  return (
    <Flex
      align="stretch"
      w="100%"
      h="100%"
      bg={W}
      border={`2px solid ${K}`}
      overflow="hidden"
    >
      <Box position="relative" w={`${Math.round(imageWidth * 100)}%`} bg={K} overflow="hidden" borderRight={`2px solid ${K}`} flexShrink={0}>
        {src && (
          <Box
            position="absolute"
            inset="0"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "grayscale(0.85) contrast(1.05)",
            }}
          />
        )}
        {date && (
          <Box position="absolute" bottom="0" left="0" bg={B} color={W} px="1.5" py="0.5" fontSize="9px" fontWeight="900" letterSpacing="0.12em" lineHeight="1.2">
            {date}
          </Box>
        )}
      </Box>
      <Flex direction="column" justify="space-between" flex="1" minW="0" px="2.5" py="2" gap="1">
        <Flex justify="space-between" align="center" gap="1.5">
          <Flex align="center" gap="1.5" minW="0" flex="1">
            <Box w="6px" h="6px" bg={B} flexShrink={0} />
            <Text fontSize="10px" fontWeight="900" letterSpacing="0.12em" color={B} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {channelStr}
            </Text>
          </Flex>
          <Text fontSize="13px" fontWeight="900" letterSpacing="-0.03em" color={K} lineHeight="1" flexShrink={0}>
            {num}
          </Text>
        </Flex>
        <Text
          fontSize="12px"
          fontWeight="900"
          lineHeight="1.12"
          letterSpacing="-0.012em"
          textTransform="uppercase"
          color={K}
          flex="1"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {title}
        </Text>
        <Flex justify="space-between" align="center">
          <Box w="14px" h="2px" bg={accentColor} />
          <Text fontSize="13px" fontWeight="900" color={accent === "blue" ? B : K} lineHeight="1">↗</Text>
        </Flex>
      </Flex>
    </Flex>
  )
}

/**
 * Hand-tuned blue-blob grids for the 4 corner supergraphics.
 * Each is a 2D array of 0 / 1 — same convention as the original PixelCluster.
 * All rendered by `PixelCluster` with identical cell rect + sub-pixel gap look.
 */
const TOP_LEFT_GRID = [
  [1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,0],
  [1,1,0,1,1,1,1,1],   // hole
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,0,1,1],   // hole
  [1,1,1,1,1,0,0,0],
  [1,1,1,1,1,0,0,0],
  [1,1,1,0,1,0,0,0],   // hole + step
  [1,1,1,0,0,0,0,0],
  [1,1,0,0,0,0,0,0],
]

const MID_RIGHT_GRID = [
  [1,1,1,1,1],
  [1,1,1,1,1],
  [1,0,1,1,1],   // hole
  [1,1,1,1,1],
  [1,1,1,0,1],   // hole
  [1,1,1,1,1],
  [0,1,1,1,1],
  [0,1,1,1,1],
]

const BOTTOM_RIGHT_GRID = [
  [0,0,1,1,1,1,1,1],
  [0,0,1,1,1,0,1,1],   // hole
  [1,1,1,1,1,1,1,1],
  [1,1,0,1,1,1,0,1],   // 2 holes
  [1,1,1,1,1,1,1,1],
]

const BOTTOM_LEFT_GRID = [
  [0,0,0,1,1,1,0,0],
  [0,0,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1],
  [0,1,1,1,0,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,0,1,1],
  [1,1,1,1,1,1,1,0],
  [1,1,0,1,1,1,0,0],
]

/**
 * Renders a grid of pixel cells the same way for every shape — chunky `<rect>`s
 * with no explicit gap (sub-pixel anti-aliasing creates the white gridlines).
 *
 * EDGE cells (those touching emptiness or grid boundary) animate as a
 * "spotlight" rotating around the perimeter — phase based on each cell's
 * angle from the cluster centroid. Interior cells stay solid.
 */
const ROTATE_DURATION_MS = 4200

function PixelCluster({
  grid,
  color,
  shimmerSeed = 0,
}: {
  grid: number[][]
  color: string
  /** Offset in ms — pass different values to desync clusters from each other. */
  shimmerSeed?: number
}) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  // Compute centroid + per-cell phase delay (only matters for edge cells).
  const cellMeta = useMemo(() => {
    let sumX = 0, sumY = 0, n = 0
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) { sumX += x; sumY += y; n++ }
      }
    }
    const cx = n ? sumX / n : cols / 2
    const cy = n ? sumY / n : rows / 2
    const meta: Array<Array<{ isEdge: boolean; delayMs: number }>> = []
    for (let y = 0; y < rows; y++) {
      const row: Array<{ isEdge: boolean; delayMs: number }> = []
      for (let x = 0; x < cols; x++) {
        let isEdge = false
        if (grid[y][x] === 1) {
          // edge if any 4-neighbor is empty or off-grid
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
            const ny = y + dy, nx = x + dx
            if (ny < 0 || ny >= rows || nx < 0 || nx >= cols || grid[ny][nx] !== 1) {
              isEdge = true
              break
            }
          }
        }
        // angle 0..2π → delay 0..duration. Negative delay so animation runs already in-progress.
        const angle = Math.atan2(y - cy, x - cx) // -π..π
        const norm = (angle + Math.PI) / (2 * Math.PI) // 0..1
        const delayMs = -Math.round(norm * ROTATE_DURATION_MS) + shimmerSeed
        row.push({ isEdge, delayMs })
      }
      meta.push(row)
    }
    return meta
  }, [grid, rows, cols, shimmerSeed])

  return (
    <svg
      viewBox={`0 0 ${cols * 10} ${rows * 10}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <style>{`
        @keyframes edge-orbit {
          0%   { opacity: 0.35; }
          18%  { opacity: 1;    }
          36%  { opacity: 0.65; }
          100% { opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          .edge-cell { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
      {grid.map((row, y) =>
        row.map((cell, x) => {
          if (cell !== 1) return null
          const { isEdge, delayMs } = cellMeta[y][x]
          return (
            <rect
              key={`${x}-${y}`}
              className={isEdge ? "edge-cell" : undefined}
              x={x * 10}
              y={y * 10}
              width="10"
              height="10"
              fill={color}
              style={
                isEdge
                  ? {
                      animation: `edge-orbit ${ROTATE_DURATION_MS}ms linear infinite`,
                      animationDelay: `${delayMs}ms`,
                    }
                  : undefined
              }
            />
          )
        })
      )}
    </svg>
  )
}

/* ─── Below: AnimatedPixelShape — kept for future use, not currently rendered. ─── */

type PixelGrid = number[][]

const SHAPE_GRIDS: Record<string, PixelGrid> = {
  // top-left "stair" descending towards bottom-right
  topLeft: [
    [1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,0,0],
    [1,1,1,1,1,0,0,0],
    [1,1,1,1,1,0,0,0],
    [1,1,1,1,0,0,0,0],
    [1,1,1,0,0,0,0,0],
    [1,1,0,0,0,0,0,0],
  ],
  // mid-right L-shape (notch at bottom-left)
  midRight: [
    [1,1,1,1,1],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,1,1,1,1],
    [0,1,1,1,1],
  ],
  // bottom-left cluster (organic blob with holes)
  bottomLeft: [
    [0,0,0,1,1,1,0,0],
    [0,0,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1],
    [0,1,1,1,0,1,1,1],
    [1,1,1,1,1,1,1,1],
    [1,1,1,1,1,0,1,1],
    [1,1,1,1,1,1,1,0],
    [1,1,0,1,1,1,0,0],
  ],
  // bottom-right rectangle with notch top-left
  bottomRight: [
    [0,0,1,1,1,1,1,1],
    [0,0,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1],
  ],
}

/** Count live neighbors of cell (x,y) in `state` grid. */
function countNeighbors(state: boolean[][], x: number, y: number): number {
  const rows = state.length
  const cols = state[0].length
  let n = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const ny = y + dy, nx = x + dx
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && state[ny][nx]) n++
    }
  }
  return n
}

/**
 * Pixel shape with optional Game-of-Life animation along its edges.
 * Interior cells (filled with all 8 neighbors filled in the original silhouette)
 * are immutable. Border cells (anything else within reach of the silhouette)
 * follow GoL rules — flickering, marching, sparkling on the perimeter.
 */
function AnimatedPixelShape({
  grid,
  color,
  cellSize = 10,
  gap = 1.4,
  intervalMs = 700,
}: {
  grid: PixelGrid
  color: string
  cellSize?: number
  gap?: number
  intervalMs?: number
}) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  // Compute static interior + animated border once per grid.
  const { isInterior, borderCells } = useMemo(() => {
    const isInt: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))
    const border: Array<[number, number]> = []
    const original = grid.map((row) => row.map((c) => c === 1))
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // count filled neighbors in original silhouette
        let filledNb = 0
        let totalNb = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const ny = y + dy, nx = x + dx
            if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue
            totalNb++
            if (original[ny][nx]) filledNb++
          }
        }
        if (original[y][x] && filledNb === totalNb && totalNb === 8) {
          isInt[y][x] = true
        } else if (original[y][x] || filledNb > 0) {
          border.push([x, y])
        }
      }
    }
    return { isInterior: isInt, borderCells: border }
  }, [grid, rows, cols])

  const [state, setState] = useState<boolean[][]>(() => grid.map((row) => row.map((c) => c === 1)))

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => {
        const next = prev.map((r) => [...r])
        for (const [x, y] of borderCells) {
          if (isInterior[y][x]) continue
          const n = countNeighbors(prev, x, y)
          if (prev[y][x]) {
            // alive: stays alive on 2-3 neighbors, else dies
            next[y][x] = n === 2 || n === 3 || n === 4
          } else {
            // dead: born on exactly 3 neighbors
            next[y][x] = n === 3
          }
        }
        return next
      })
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [borderCells, isInterior, intervalMs])

  const inner = cellSize - gap
  const w = cols * cellSize
  const h = rows * cellSize

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {state.map((row, y) =>
        row.map((alive, x) =>
          alive ? (
            <rect
              key={`${x}-${y}`}
              x={x * cellSize + gap / 2}
              y={y * cellSize + gap / 2}
              width={inner}
              height={inner}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  )
}
