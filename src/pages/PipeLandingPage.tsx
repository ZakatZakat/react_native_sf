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
        const feed = await Curator.getFeed({ limit: 36 })
        if (cancelled) return
        const urls: string[] = []
        for (const ev of feed) {
          const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
          const r = resolveMedia(m ?? null)
          if (r && isImg(r)) urls.push(r)
          if (urls.length >= 12) break
        }
        setPosters(urls)
        // For variant D — keep events with image. Need pool >= 5 for rotation.
        setEvents(feed.filter((ev) => ev.media_urls?.some(isImg)).slice(0, 16))
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

      {/* ── Bauhaus 4 blue corner blocks ── */}
      <Box
        position="absolute" top="0" left="0"
        w={{ base: "200px", sm: "300px" }} h={{ base: "220px", sm: "320px" }}
        bg={B} zIndex={0} pointerEvents="none" opacity={0.95}
        style={{ clipPath: "polygon(0 0, 78% 0, 78% 14%, 100% 14%, 100% 36%, 88% 36%, 88% 56%, 70% 56%, 70% 80%, 42% 80%, 42% 100%, 0 100%)" }}
      />
      <Box
        position="absolute" top={{ base: "320px", sm: "400px" }} right="0"
        w={{ base: "100px", sm: "160px" }} h={{ base: "180px", sm: "240px" }}
        bg={B} zIndex={0} pointerEvents="none" opacity={0.95}
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 30% 100%, 30% 70%, 0 70%)" }}
      />
      <Box
        position="absolute" bottom={{ base: "120px", sm: "160px" }} left="0"
        w={{ base: "150px", sm: "210px" }} h={{ base: "150px", sm: "210px" }}
        zIndex={0} pointerEvents="none" opacity={0.85}
      >
        <PixelCluster color={B} />
      </Box>
      <Box
        position="absolute" bottom="0" right="0"
        w={{ base: "180px", sm: "260px" }} h={{ base: "130px", sm: "170px" }}
        bg={B} zIndex={0} pointerEvents="none" opacity={0.95}
        style={{ clipPath: "polygon(0 36%, 24% 36%, 24% 0, 100% 0, 100% 100%, 0 100%)" }}
      />

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
        {/* TOP — editorial info section (Grafist-style) */}
        <Flex direction={{ base: "column", sm: "row" }} gap="6" align="flex-start">
          {/* Left col — title + date */}
          <Box flex="1.1" minW="0">
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

          {/* Right col — sources / programme */}
          <Box flex="1" minW="0">
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
        </Flex>

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
  /** Approx W/H aspect of the rendered image area in this slot — used to match posters. */
  targetAspect: number
}

// 5 slot bento layout (8-col grid, ~68px row units, dense flow).
// targetAspect is roughly (colSpan * colWidth) / (rowSpan * 68px) — for matching against image aspects.
// Assuming container ≈ 720px wide → colWidth ≈ 90px. Tweak by shape to account for text panels.
const BENTO_SLOTS: SlotConfig[] = [
  { colSpan: 5, rowSpan: 5, shape: "tall",      accent: "blue",  targetAspect: 0.85 }, // big portrait
  { colSpan: 3, rowSpan: 2, shape: "wide",      accent: "black", targetAspect: 0.55 }, // image is 38% of wide → narrow tall
  { colSpan: 3, rowSpan: 3, shape: "tallSmall", accent: "blue",  targetAspect: 0.80 }, // medium portrait
  { colSpan: 4, rowSpan: 3, shape: "wide",      accent: "black", targetAspect: 0.65 }, // image is 38% of wide
  { colSpan: 4, rowSpan: 3, shape: "square",    accent: "blue",  targetAspect: 1.50 }, // wide square area
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
 * Greedy assignment: for each slot (in order), pick the unused event whose image aspect
 * is closest to slot.targetAspect. Events without images go last as fallback.
 */
function assignEventsToSlots(
  events: FeedItem[],
  aspects: Record<string, number>,
): FeedItem[] {
  const used = new Set<string>()
  const result: FeedItem[] = []
  for (const slot of BENTO_SLOTS) {
    let best: FeedItem | null = null
    let bestDist = Infinity
    for (const ev of events) {
      if (used.has(ev.id)) continue
      const url = eventPosterUrl(ev)
      const aspect = url ? (aspects[url] ?? null) : null
      // events without loaded image get a large penalty so they're picked last
      const dist = aspect == null
        ? 10 + (url ? 0 : 5)
        : Math.abs(Math.log(aspect) - Math.log(slot.targetAspect))
      if (dist < bestDist) {
        bestDist = dist
        best = ev
      }
    }
    if (best) {
      used.add(best.id)
      result.push(best)
    }
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
      // pick a random slot, replace with the best-fitting unused event for that slot
      setSlotEvents((prev) => {
        const slotIdx = Math.floor(Math.random() * BENTO_SLOTS.length)
        const slot = BENTO_SLOTS[slotIdx]
        const usedIds = new Set(prev.map((e) => e.id))
        let best: FeedItem | null = null
        let bestDist = Infinity
        for (const ev of events) {
          if (usedIds.has(ev.id)) continue
          const url = eventPosterUrl(ev)
          const aspect = url ? (aspects[url] ?? null) : null
          const dist = aspect == null
            ? 10 + (url ? 0 : 5)
            : Math.abs(Math.log(aspect) - Math.log(slot.targetAspect))
          if (dist < bestDist) { bestDist = dist; best = ev }
        }
        if (!best) return prev
        return prev.map((e, i) => (i === slotIdx ? best! : e))
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
                <BentoCard key={ev.id} ev={ev} shape={slot.shape} accent={slot.accent} index={i} />
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
  ev, shape, accent, index,
}: {
  ev: FeedItem
  shape: SlotShape
  accent: "blue" | "black"
  index: number
}) {
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

  // SQUARE — title overlaid on image with bottom gradient
  if (shape === "square") {
    return (
      <Box
        className="bento-card-anim"
        position="relative"
        w="100%"
        h="100%"
        bg={K}
        border={`2px solid ${K}`}
        overflow="hidden"
      >
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
        <Box
          position="absolute"
          inset="0"
          bg="linear-gradient(180deg, rgba(13,13,13,0.1) 0%, rgba(13,13,13,0) 35%, rgba(13,13,13,0.85) 100%)"
          pointerEvents="none"
        />
        {/* Top markers */}
        <Flex position="absolute" top="6px" left="8px" right="8px" justify="space-between" align="center">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={W} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            № {num}
          </Text>
          {date && (
            <Box bg={B} color={W} px="1.5" py="0.5" fontSize="9px" fontWeight="900" letterSpacing="0.14em">
              {date}
            </Box>
          )}
        </Flex>
        {/* Title bottom */}
        <Box position="absolute" bottom="8px" left="8px" right="8px">
          <Text
            fontSize="10px"
            fontWeight="900"
            letterSpacing="0.14em"
            color={B}
            mb="1"
            style={{
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {channelStr}
          </Text>
          <Text
            fontSize="14px"
            fontWeight="900"
            lineHeight="1.08"
            letterSpacing="-0.018em"
            textTransform="uppercase"
            color={W}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 2px 10px rgba(0,0,0,0.7)",
              wordBreak: "break-word",
            }}
          >
            {title}
          </Text>
        </Box>
      </Box>
    )
  }

  // TALL — image top (60-70%), text bottom
  if (shape === "tall" || shape === "tallSmall") {
    return (
      <Flex
        className="bento-card-anim"
        direction="column"
        w="100%"
        h="100%"
        bg={W}
        border={`2px solid ${K}`}
        overflow="hidden"
      >
        <Box position="relative" flex={shape === "tall" ? "1.6" : "1.3"} minH="0" bg={K} overflow="hidden" borderBottom={`2px solid ${K}`}>
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
        <Flex direction="column" justify="space-between" px="2.5" py="2" flex="1" minH="0" gap="1">
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
                WebkitLineClamp: shape === "tall" ? 4 : 3,
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
      className="bento-card-anim"
      align="stretch"
      w="100%"
      h="100%"
      bg={W}
      border={`2px solid ${K}`}
      overflow="hidden"
    >
      <Box position="relative" w="38%" bg={K} overflow="hidden" borderRight={`2px solid ${K}`} flexShrink={0}>
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
 * 8×8 grid of small squares with hand-tuned cut-outs — pixel-cluster supergraphic
 * (used in the Bauhaus background of Variant D).
 */
function PixelCluster({ color }: { color: string }) {
  const grid = [
    [0, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 0, 1, 1, 1, 0, 0],
  ]
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      {grid.map((row, y) =>
        row.map((cell, x) =>
          cell === 1 ? (
            <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="10" height="10" fill={color} />
          ) : null
        )
      )}
    </svg>
  )
}
