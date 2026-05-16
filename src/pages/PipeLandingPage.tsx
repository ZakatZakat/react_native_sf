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

type Variant = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P"
type BgStyle = "pixels" | "strips" | "folio" | "tags" | "circles" | "bars" | "solid" | "halftone" | "accent" | "hairline" | "dotgrid" | "plain" | "swissgrid"

export default function PipeLandingPage() {
  const navigate = useNavigate()
  const [variant, setVariant] = useState<Variant>("D")
  const [posters, setPosters] = useState<string[]>([])
  const [events, setEvents] = useState<FeedItem[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
      {/* SIDE TOGGLE — fixed vertical pills with show/hide */}
      <Flex
        position="fixed"
        top="50%"
        left="12px"
        direction="column"
        gap="2"
        zIndex={20}
        align="flex-start"
        style={{ transform: "translateY(-50%)" }}
      >
        {/* Collapse / expand button — small chevron pill on top */}
        <Box
          as="button"
          onClick={() => setSidebarOpen((v) => !v)}
          w="40px"
          h="22px"
          border={`1.5px solid ${K}`}
          bg={W}
          color={K}
          fontSize="11px"
          fontWeight="900"
          cursor="pointer"
          display="flex"
          alignItems="center"
          justifyContent="center"
          transition="all 0.12s"
          _hover={{ bg: K, color: W }}
          aria-label={sidebarOpen ? "Hide variants" : "Show variants"}
          title={sidebarOpen ? "Скрыть переключатель" : "Показать переключатель"}
        >
          {sidebarOpen ? "‹" : "›"}
        </Box>

        {sidebarOpen && (["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"] as Variant[]).map((v) => {
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
      {variant === "D" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="pixels" />}
      {variant === "E" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="strips" />}
      {variant === "F" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="folio" />}
      {variant === "G" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="tags" />}
      {variant === "H" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="circles" />}
      {variant === "I" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="bars" />}
      {variant === "J" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="solid" />}
      {variant === "K" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="halftone" />}
      {variant === "L" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="accent" />}
      {variant === "M" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="hairline" />}
      {variant === "N" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="dotgrid" />}
      {variant === "O" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="plain" />}
      {variant === "P" && <VariantBento onCta={goRadar} dd={dd} mm={mm} yy={yy} dateLong={dateLong} posters={posters} events={events} bgStyle="swissgrid" />}
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
            способ найти ивент.
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
            Показать варианты
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
            Показать варианты
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
            Показать варианты
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

function VariantBento({ onCta, dd, mm, yy, dateLong, posters: _posters, events, bgStyle = "pixels" }: {
  onCta: () => void
  dd: string; mm: string; yy: string; dateLong: string
  posters: string[]
  events: FeedItem[]
  bgStyle?: BgStyle
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
      {/* Dotted bauhaus bg — base layer for most variants. Variants that bring
          their own background grid (S — swissgrid) opt out. */}
      {bgStyle !== "swissgrid" && (
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
      )}

      {bgStyle === "pixels"  && <BgPixels  />}
      {bgStyle === "strips"  && <BgStrips  />}
      {bgStyle === "folio"   && <BgFolio   />}
      {bgStyle === "tags"    && <BgTags    />}
      {bgStyle === "circles"   && <BgCircles   />}
      {bgStyle === "bars"      && <BgBars      />}
      {bgStyle === "solid"     && <BgSolid     />}
      {bgStyle === "halftone"  && <BgHalftone  />}
      {bgStyle === "accent"    && <BgAccent    />}
      {bgStyle === "hairline"  && <BgHairline  />}
      {bgStyle === "dotgrid"   && <BgDotGrid   />}
      {bgStyle === "plain"     && <BgPlain     />}
      {bgStyle === "swissgrid" && <BgSwissGrid />}

      <Flex
        maxW="640px"
        mx="auto"
        px={{ base: "4", sm: "6" }}
        pt={{ base: "3", sm: "6" }}
        pb={{ base: "3", sm: "6" }}
        direction="column"
        position="relative"
        zIndex={2}
        minH="100dvh"
        gap={{ base: "3", sm: "5" }}
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
                fontSize={{ base: "40px", sm: "60px" }}
                fontWeight="900"
                lineHeight="0.86"
                letterSpacing="-0.045em"
                color={K}
              >
                CitySignal
              </Text>
              <Text fontSize={{ base: "11px", sm: "14px" }} fontWeight="900" color={K} mt="1.5">
                01
              </Text>
            </Flex>
            <Text
              fontSize={{ base: "11px", sm: "13px" }}
              fontWeight="800" color={K} mt={{ base: "2", sm: "3" }} lineHeight="1.3"
            >
              Выпуск № 001
              {' · '}
              <Text as="span" fontStyle="italic" color={G}>Curated city signal weekly</Text>
            </Text>
            <Text
              fontSize="11px" fontWeight="900" color={K}
              mt={{ base: "2", sm: "6" }} letterSpacing="-0.01em"
            >
              {dd}.{mm}.{yy} —— {dateLong.split(" ").slice(0, 2).join(" ")}
              <Text as="span" color={B} ml="2" letterSpacing="0.04em">citysignal.io</Text>
            </Text>

            {/* Tiny logo placeholders */}
            <Flex gap="2" mt={{ base: "2", sm: "6" }} align="center" wrap="wrap">
              <Box bg={K} color={W} px="2" py="0.5" fontSize="9px" fontWeight="900" letterSpacing="0.16em">
                PIPE/RD{yy.slice(2)}
              </Box>
              <Box border={`1.5px solid ${K}`} px="2" py="0.5" fontSize="9px" fontWeight="900" letterSpacing="0.16em">
                MOSCOW · SPB
              </Box>
            </Flex>
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
            Показать варианты
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
        // Mobile: 2-col grid with 170px row tracks — hero spans 2×2 so it stays
        // the visual anchor, and the four small cards beneath grow to use the
        // available viewport space cleanly instead of leaving a gap above CTA.
        // Desktop: original 8-col bento with rowSpan'd cells.
        display="grid"
        gridTemplateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(8, 1fr)" }}
        gridAutoRows={{ base: "170px", sm: "68px" }}
        gap="2"
        gridAutoFlow="dense"
      >
        {BENTO_SLOTS.map((slot, i) => {
          const ev = slotEvents[i]
          // Hero (slot 0): full-width AND double-height. Rest: half-width single.
          const mobileColSpan = i === 0 ? 2 : 1
          const mobileRowSpan = i === 0 ? 2 : 1
          return (
            <Box
              key={`slot-${i}`}
              gridColumn={{ base: `span ${mobileColSpan}`, sm: `span ${slot.colSpan}` }}
              gridRow={{ base: `span ${mobileRowSpan}`, sm: `span ${slot.rowSpan}` }}
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

/* ─────────────────────────────────────────────────────────── */
/* Background variants for VariantBento                        */
/* ─────────────────────────────────────────────────────────── */

/** D — pixels: 4 blue pixel-clusters in the corners (the existing default). */
function BgPixels() {
  // cellSize is responsive — smaller on mobile, larger on sm+. Each cluster
  // bleeds off its corner so the pixels read as edge decoration rather than
  // blocks sitting on top of content.
  return (
    <>
      <Box
        position="absolute"
        top={{ base: "-44px", sm: "-30px" }}
        left={{ base: "-44px", sm: "-30px" }}
        w={{ base: `${TOP_LEFT_GRID[0].length * 14}px`, sm: `${TOP_LEFT_GRID[0].length * 26}px` }}
        h={{ base: `${TOP_LEFT_GRID.length * 14}px`,    sm: `${TOP_LEFT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.95}
      >
        <PixelCluster grid={TOP_LEFT_GRID} color={B} shimmerSeed={0} />
      </Box>
      <Box
        position="absolute"
        top={{ base: "300px", sm: "400px" }}
        right={{ base: "-30px", sm: "-20px" }}
        w={{ base: `${MID_RIGHT_GRID[0].length * 14}px`, sm: `${MID_RIGHT_GRID[0].length * 26}px` }}
        h={{ base: `${MID_RIGHT_GRID.length * 14}px`,    sm: `${MID_RIGHT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.9}
      >
        <PixelCluster grid={MID_RIGHT_GRID} color={B} shimmerSeed={400} />
      </Box>
      <Box
        position="absolute"
        bottom={{ base: "140px", sm: "160px" }}
        left={{ base: "-30px", sm: "0" }}
        w={{ base: `${BOTTOM_LEFT_GRID[0].length * 14}px`, sm: `${BOTTOM_LEFT_GRID[0].length * 26}px` }}
        h={{ base: `${BOTTOM_LEFT_GRID.length * 14}px`,    sm: `${BOTTOM_LEFT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.85}
      >
        <PixelCluster grid={BOTTOM_LEFT_GRID} color={B} shimmerSeed={900} />
      </Box>
      <Box
        position="absolute"
        bottom={{ base: "-30px", sm: "0" }}
        right={{ base: "-30px", sm: "0" }}
        w={{ base: `${BOTTOM_RIGHT_GRID[0].length * 14}px`, sm: `${BOTTOM_RIGHT_GRID[0].length * 26}px` }}
        h={{ base: `${BOTTOM_RIGHT_GRID.length * 14}px`,    sm: `${BOTTOM_RIGHT_GRID.length * 26}px` }}
        zIndex={0} pointerEvents="none" opacity={0.95}
      >
        <PixelCluster grid={BOTTOM_RIGHT_GRID} color={B} shimmerSeed={1500} />
      </Box>
    </>
  )
}

/**
 * E — strips: full-bleed colored bands (top/bottom horizontal + left vertical),
 * reversed white condensed caps. Eye magazine / Acne Paper editorial header.
 */
function BgStrips() {
  const topText  = "NO 001 · WEEKLY SIGNAL · 10 MAY 2026 · MOSCOW–SPB · CITY SIGNAL · NO 001 · WEEKLY SIGNAL · 10 MAY 2026 · MOSCOW–SPB · CITY SIGNAL · "
  const botText  = "↗ FIELD GUIDE · CURATED · SCANS 35+ TG-CHANNELS · LIVE · UPDATED EVERY 30 MIN · ↗ FIELD GUIDE · CURATED · SCANS 35+ TG-CHANNELS · LIVE · "
  const sideText = "RADAR · ISSUE 001 · MOSCOW–SPB · LIVE · CURATED · WEEKLY"
  return (
    <>
      <Flex position="absolute" top="0" left="0" right="0" h="32px" bg={B} zIndex={1} align="center" overflow="hidden">
        <Text fontSize="11px" color={W} fontWeight="900" letterSpacing="0.22em" px="3" style={{ whiteSpace: "nowrap" }}>{topText.repeat(2)}</Text>
      </Flex>
      <Flex position="absolute" bottom="0" left="0" right="0" h="32px" bg={K} zIndex={1} align="center" overflow="hidden">
        <Text fontSize="11px" color={W} fontWeight="900" letterSpacing="0.22em" px="3" style={{ whiteSpace: "nowrap" }}>{botText.repeat(2)}</Text>
      </Flex>
      <Flex position="absolute" top="44px" bottom="44px" left="0" w="22px" bg={B} zIndex={0} align="center" justify="center">
        <Text
          fontSize="9px" color={W} fontWeight="900" letterSpacing="0.32em"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap" }}
        >
          {sideText}
        </Text>
      </Flex>
    </>
  )
}

/**
 * F — folio: technical/publication marks. + at grid intersections, edge ruler ticks,
 * tiny corner folios. Karel Martens / Lars Müller minimalism.
 */
function BgFolio() {
  const cols = 18
  const rows = 28
  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
      >
        {Array.from({ length: rows }, (_, y) =>
          Array.from({ length: cols }, (_, x) => (
            <text
              key={`${x}-${y}`}
              x={`${((x + 0.5) / cols) * 100}%`}
              y={`${((y + 0.5) / rows) * 100}%`}
              fill="rgba(13,13,13,0.18)"
              fontSize="11"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontWeight: 900 }}
            >
              +
            </text>
          ))
        )}
      </svg>
      {/* Corner folios */}
      <Text position="absolute" top="14px" left="14px" fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={K} zIndex={0}>
        001 / 005
      </Text>
      <Text position="absolute" top="14px" right="14px" fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={K} zIndex={0}>
        FOLIO · A
      </Text>
      <Text position="absolute" bottom="14px" left="14px" fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={K} zIndex={0}>
        ↗ N
      </Text>
      <Text position="absolute" bottom="14px" right="14px" fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={K} zIndex={0}>
        10 · 05 · 26
      </Text>
      {/* Left edge ruler ticks */}
      <Box position="absolute" top="40px" bottom="40px" left="0" w="14px" zIndex={0}>
        {Array.from({ length: 28 }, (_, i) => (
          <Box
            key={i}
            position="absolute"
            left="0"
            top={`${(i / 27) * 100}%`}
            w={i % 5 === 0 ? "12px" : "6px"}
            h="1px"
            bg={K}
            opacity={0.5}
          />
        ))}
      </Box>
      {/* Right edge crop marks */}
      <Box position="absolute" top="40px" right="0" w="14px" h="14px" borderTop={`1.5px solid ${K}`} borderRight={`1.5px solid ${K}`} opacity={0.7} zIndex={0} />
      <Box position="absolute" bottom="40px" right="0" w="14px" h="14px" borderBottom={`1.5px solid ${K}`} borderRight={`1.5px solid ${K}`} opacity={0.7} zIndex={0} />
    </>
  )
}

/**
 * G — tags: scattered black/blue mini-plates floating in negative space — like
 * editorial stickers / Tschichold tag accents.
 */
function BgTags() {
  const Tag = (props: { bg?: string; color?: string; outline?: boolean; children: React.ReactNode }) => (
    <Box
      bg={props.outline ? "transparent" : props.bg ?? K}
      color={props.color ?? W}
      px="2"
      py="1"
      fontSize="9px"
      fontWeight="900"
      letterSpacing="0.18em"
      border={props.outline ? `1.5px solid ${props.color ?? K}` : undefined}
      style={{ whiteSpace: "nowrap" }}
    >
      {props.children}
    </Box>
  )
  return (
    <>
      <Box position="absolute" top="40px"  left="14px"   zIndex={1}><Tag bg={K}><Box as="span" color={B}>●</Box> LIVE</Tag></Box>
      <Box position="absolute" top="92px"  right="14px"  zIndex={1}><Tag outline color={B}>WEEKLY</Tag></Box>
      <Box position="absolute" top="200px" left="22px"   zIndex={1}><Tag bg={B}>№ 001</Tag></Box>
      <Box position="absolute" top="320px" right="22px"  zIndex={1}><Tag bg={K}>FIELD GUIDE</Tag></Box>
      <Box position="absolute" top="430px" left="14px"   zIndex={1}><Tag outline color={K}>↗ MOSCOW</Tag></Box>
      <Box position="absolute" bottom="180px" right="20px" zIndex={1}><Tag bg={K}>UPDATED · 30M</Tag></Box>
      <Box position="absolute" bottom="80px"  left="80px"  zIndex={1}><Tag bg={B}>SUB-SIGNAL</Tag></Box>
      <Box position="absolute" bottom="40px"  right="80px" zIndex={1}><Tag outline color={K}>SCANS 35+</Tag></Box>
    </>
  )
}

/**
 * H — circles: big solid circles & half-circles bleeding off the edges.
 * Müller-Brockmann / Lohse — pure geometric primitives, lots of negative space.
 */
function BgCircles() {
  return (
    <>
      {/* Top-right big circle, half off-canvas */}
      <Box
        position="absolute"
        top={{ base: "-120px", sm: "-160px" }}
        right={{ base: "-140px", sm: "-200px" }}
        w={{ base: "320px", sm: "480px" }}
        h={{ base: "320px", sm: "480px" }}
        bg={B}
        borderRadius="50%"
        zIndex={0} pointerEvents="none" opacity={0.95}
      />
      {/* Bottom-left half-circle, bleeding off bottom + left */}
      <Box
        position="absolute"
        bottom={{ base: "-120px", sm: "-160px" }}
        left={{ base: "-100px", sm: "-140px" }}
        w={{ base: "260px", sm: "380px" }}
        h={{ base: "260px", sm: "380px" }}
        bg={K}
        borderRadius="50%"
        zIndex={0} pointerEvents="none"
      />
      {/* Mid-right small accent disc — fully on-canvas */}
      <Box
        position="absolute"
        top={{ base: "440px", sm: "560px" }}
        right={{ base: "20px", sm: "60px" }}
        w={{ base: "80px", sm: "110px" }}
        h={{ base: "80px", sm: "110px" }}
        bg={B}
        borderRadius="50%"
        zIndex={0} pointerEvents="none"
      />
      {/* Mid-left ring (outline circle) */}
      <Box
        position="absolute"
        top={{ base: "320px", sm: "420px" }}
        left={{ base: "-30px", sm: "-40px" }}
        w={{ base: "120px", sm: "180px" }}
        h={{ base: "120px", sm: "180px" }}
        border={`6px solid ${K}`}
        borderRadius="50%"
        zIndex={0} pointerEvents="none"
      />
    </>
  )
}

/**
 * I — bars: heavy horizontal/vertical rectangles marking the typographic grid.
 * Wim Crouwel / The Designers Republic.
 */
function BgBars() {
  return (
    <>
      {/* Top horizontal rule, blue */}
      <Box position="absolute" top="0" left="0" right="0" h="14px" bg={B} zIndex={0} />
      {/* Second top rule, black, narrower */}
      <Box position="absolute" top="22px" left="0" w={{ base: "60%", sm: "55%" }} h="6px" bg={K} zIndex={0} />
      {/* Right vertical bar, blue, full-height */}
      <Box position="absolute" top="0" bottom="0" right="0" w={{ base: "16px", sm: "24px" }} bg={B} zIndex={0} />
      {/* Left vertical bar, black, partial height */}
      <Box position="absolute" top={{ base: "120px", sm: "180px" }} bottom={{ base: "180px", sm: "240px" }} left="0" w="10px" bg={K} zIndex={0} />
      {/* Mid-right horizontal accent bar */}
      <Box position="absolute" top={{ base: "400px", sm: "520px" }} right="0" w={{ base: "55%", sm: "45%" }} h="10px" bg={K} zIndex={0} />
      {/* Bottom horizontal rule, blue */}
      <Box position="absolute" bottom="0" left="0" right="0" h="18px" bg={B} zIndex={0} />
      {/* Second bottom rule, black, offset */}
      <Box position="absolute" bottom="28px" right={{ base: "40px", sm: "80px" }} w={{ base: "40%", sm: "35%" }} h="6px" bg={K} zIndex={0} />
    </>
  )
}

/**
 * J — solid: full-bleed colored columns. Right column entirely blue with the
 * marker plate; left edge has a narrow black gutter strip.
 */
function BgSolid() {
  return (
    <>
      {/* Full-height blue column on the right (~12% width = 1 of 8 cols) */}
      <Box
        position="absolute"
        top="0" bottom="0" right="0"
        w={{ base: "44px", sm: "12.5%" }}
        bg={B}
        zIndex={0}
      >
        <Flex direction="column" h="100%" justify="space-between" align="center" py="6">
          <Text
            fontSize={{ base: "10px", sm: "11px" }}
            color={W}
            fontWeight="900"
            letterSpacing="0.32em"
            style={{ writingMode: "vertical-rl", whiteSpace: "nowrap" }}
          >
            CITY SIGNAL · WEEKLY · 001
          </Text>
          <Text
            fontSize={{ base: "44px", sm: "60px" }}
            color={W}
            fontWeight="900"
            letterSpacing="-0.04em"
            lineHeight="0.86"
            style={{ writingMode: "vertical-rl" }}
          >
            №01
          </Text>
          <Text
            fontSize={{ base: "10px", sm: "11px" }}
            color={W}
            fontWeight="900"
            letterSpacing="0.32em"
            style={{ writingMode: "vertical-rl", whiteSpace: "nowrap" }}
          >
            ↗ MOSCOW · SPB · LIVE
          </Text>
        </Flex>
      </Box>
      {/* Narrow black gutter on the far left */}
      <Box position="absolute" top="0" bottom="0" left="0" w="14px" bg={K} zIndex={0} />
      {/* Top horizontal rule above content */}
      <Box position="absolute" top="0" left="14px" right={{ base: "44px", sm: "12.5%" }} h="6px" bg={K} zIndex={0} />
      {/* Bottom horizontal rule */}
      <Box position="absolute" bottom="0" left="14px" right={{ base: "44px", sm: "12.5%" }} h="6px" bg={K} zIndex={0} />
    </>
  )
}

/**
 * K — halftone: big blue half-sphere gradient with raster-dot texture.
 * The Designers Republic / Tomato. SVG `<radialGradient>` + dot pattern overlay.
 */
function BgHalftone() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    >
      <defs>
        <radialGradient id="halftone-blue" cx="80%" cy="0%" r="75%">
          <stop offset="0%"  stopColor={B} stopOpacity="1" />
          <stop offset="55%" stopColor={B} stopOpacity="0.8" />
          <stop offset="85%" stopColor={B} stopOpacity="0.15" />
          <stop offset="100%" stopColor={B} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="halftone-black" cx="20%" cy="100%" r="55%">
          <stop offset="0%"  stopColor={K} stopOpacity="0.95" />
          <stop offset="60%" stopColor={K} stopOpacity="0.5" />
          <stop offset="100%" stopColor={K} stopOpacity="0" />
        </radialGradient>
        <pattern id="halftone-dots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.4" fill="rgba(255,255,255,0.55)" />
        </pattern>
      </defs>
      {/* Big top-right blue blob */}
      <rect x="0" y="0" width="100%" height="100%" fill="url(#halftone-blue)" />
      {/* Halftone dots over blue area */}
      <rect x="0" y="0" width="100%" height="100%" fill="url(#halftone-dots)" opacity="0.85" />
      {/* Bottom-left dark blob */}
      <rect x="0" y="0" width="100%" height="100%" fill="url(#halftone-black)" />
    </svg>
  )
}

/**
 * L — type-as-shape: a phrase repeated so densely it becomes a textural block.
 * Yale-school / Sulki & Min. Single super-tight wall of caps in the corners.
 */
function BgTypeShape() {
  const phrase = "CITY·SIGNAL·"
  // Build very long string so wrapping forms a textural slab
  const long = phrase.repeat(80)
  return (
    <>
      {/* Top-left dense slab */}
      <Box
        position="absolute"
        top="0"
        left="0"
        w={{ base: "240px", sm: "360px" }}
        h={{ base: "260px", sm: "360px" }}
        zIndex={0}
        pointerEvents="none"
        overflow="hidden"
        style={{
          fontFamily: "'Helvetica Neue', sans-serif",
          fontWeight: 900,
          letterSpacing: "0.04em",
          lineHeight: 0.95,
          fontSize: "11px",
          color: K,
          wordBreak: "break-all",
        }}
      >
        {long}
      </Box>
      {/* Bottom-right blue dense slab */}
      <Box
        position="absolute"
        bottom="0"
        right="0"
        w={{ base: "200px", sm: "300px" }}
        h={{ base: "200px", sm: "280px" }}
        zIndex={0}
        pointerEvents="none"
        overflow="hidden"
        style={{
          fontFamily: "'Helvetica Neue', sans-serif",
          fontWeight: 900,
          letterSpacing: "0.04em",
          lineHeight: 0.95,
          fontSize: "11px",
          color: B,
          wordBreak: "break-all",
        }}
      >
        {long}
      </Box>
      {/* Mid-right vertical column of repeating word */}
      <Box
        position="absolute"
        top={{ base: "260px", sm: "340px" }}
        right="0"
        w={{ base: "60px", sm: "80px" }}
        h={{ base: "320px", sm: "440px" }}
        zIndex={0}
        pointerEvents="none"
        overflow="hidden"
        style={{
          fontFamily: "'Helvetica Neue', sans-serif",
          fontWeight: 900,
          letterSpacing: "0.04em",
          lineHeight: 0.92,
          fontSize: "10px",
          color: K,
          wordBreak: "break-all",
        }}
      >
        {phrase.repeat(60)}
      </Box>
    </>
  )
}

/**
 * M — diagram: thin-line architectural / isometric drawing in blue.
 * Single-stroke abstract building / radar plan, no fills.
 */
function BgDiagram() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    >
      <g stroke={B} strokeWidth="1.5" fill="none" opacity="0.85">
        {/* Top-right isometric cube */}
        <g transform="translate(75%, 80) scale(1)">
          <polygon points="0,0 60,-30 120,0 60,30" />          {/* top diamond */}
          <line x1="0" y1="0" x2="0" y2="80" />
          <line x1="60" y1="30" x2="60" y2="110" />
          <line x1="120" y1="0" x2="120" y2="80" />
          <polygon points="0,80 60,110 120,80" />              {/* bottom diamond top */}
        </g>
        {/* Top-left radar concentric arcs */}
        <g transform="translate(40, 60)">
          {[40, 80, 120, 160].map((r) => (
            <path key={r} d={`M 0,${r} A ${r},${r} 0 0 1 ${r},0`} />
          ))}
          <line x1="0" y1="0" x2="170" y2="170" />
          <line x1="0" y1="0" x2="170" y2="0" strokeDasharray="3 4" />
          <circle cx="120" cy="40" r="3" fill={B} />
        </g>
        {/* Bottom-right plan with rooms */}
        <g transform="translate(64%, 80%) scale(1)">
          <rect x="0" y="0" width="220" height="120" />
          <line x1="120" y1="0" x2="120" y2="120" />
          <line x1="0" y1="60" x2="120" y2="60" />
          <line x1="120" y1="80" x2="220" y2="80" />
          <line x1="160" y1="80" x2="160" y2="120" />
          <line x1="60" y1="60" x2="60" y2="120" />
        </g>
        {/* Bottom-left axis with labelled point */}
        <g transform="translate(30, 70%)">
          <line x1="0" y1="160" x2="180" y2="160" />
          <line x1="0" y1="160" x2="0" y2="0" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`hx${i}`} x1={i * 30} y1="160" x2={i * 30} y2="155" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`hy${i}`} x1="0" y1={i * 30} x2="5" y2={i * 30} />
          ))}
          <circle cx="100" cy="60" r="4" fill={B} />
          <line x1="100" y1="60" x2="100" y2="160" strokeDasharray="3 3" />
          <line x1="100" y1="60" x2="0" y2="60" strokeDasharray="3 3" />
        </g>
      </g>
    </svg>
  )
}

/**
 * N — ruler: architectural-style measurement scale running along the page edges.
 * Major ticks every 5 units with numeric labels, minor ticks each unit.
 */
function BgRuler() {
  const N = 60
  return (
    <>
      {/* Left edge vertical ruler */}
      <Box position="absolute" top="0" bottom="0" left="0" w={{ base: "26px", sm: "34px" }} zIndex={0} pointerEvents="none">
        {Array.from({ length: N }, (_, i) => {
          const major = i % 5 === 0
          return (
            <Box
              key={`l${i}`}
              position="absolute"
              left="0"
              top={`${(i / (N - 1)) * 100}%`}
              w={major ? "16px" : "8px"}
              h={major ? "1.5px" : "1px"}
              bg={K}
              opacity={major ? 0.85 : 0.4}
            />
          )
        })}
        {Array.from({ length: Math.floor(N / 5) }, (_, j) => (
          <Text
            key={`l-lbl-${j}`}
            position="absolute"
            left="20px"
            top={`${((j * 5) / (N - 1)) * 100}%`}
            fontSize="8px"
            fontWeight="900"
            letterSpacing="0.08em"
            color={K}
            opacity={0.7}
            style={{ transform: "translateY(-50%)" }}
          >
            {String(j * 5).padStart(2, "0")}
          </Text>
        ))}
      </Box>
      {/* Right edge vertical ruler — blue */}
      <Box position="absolute" top="0" bottom="0" right="0" w={{ base: "20px", sm: "26px" }} zIndex={0} pointerEvents="none">
        {Array.from({ length: N }, (_, i) => {
          const major = i % 5 === 0
          return (
            <Box
              key={`r${i}`}
              position="absolute"
              right="0"
              top={`${(i / (N - 1)) * 100}%`}
              w={major ? "12px" : "6px"}
              h={major ? "1.5px" : "1px"}
              bg={B}
              opacity={major ? 0.95 : 0.55}
            />
          )
        })}
      </Box>
      {/* Top horizontal ruler */}
      <Box position="absolute" top="0" left={{ base: "26px", sm: "34px" }} right={{ base: "20px", sm: "26px" }} h="22px" zIndex={0} pointerEvents="none">
        {Array.from({ length: 80 }, (_, i) => {
          const major = i % 5 === 0
          return (
            <Box
              key={`t${i}`}
              position="absolute"
              top="0"
              left={`${(i / 79) * 100}%`}
              h={major ? "12px" : "6px"}
              w={major ? "1.5px" : "1px"}
              bg={K}
              opacity={major ? 0.85 : 0.4}
            />
          )
        })}
      </Box>
      {/* Bottom horizontal ruler */}
      <Box position="absolute" bottom="0" left={{ base: "26px", sm: "34px" }} right={{ base: "20px", sm: "26px" }} h="22px" zIndex={0} pointerEvents="none">
        {Array.from({ length: 80 }, (_, i) => {
          const major = i % 5 === 0
          return (
            <Box
              key={`b${i}`}
              position="absolute"
              bottom="0"
              left={`${(i / 79) * 100}%`}
              h={major ? "12px" : "6px"}
              w={major ? "1.5px" : "1px"}
              bg={B}
              opacity={major ? 0.95 : 0.55}
            />
          )
        })}
      </Box>
    </>
  )
}

/**
 * O — accent: a single big graphic mark (▲ in blue, ● in black) sits in the corner.
 * Lars Müller — one shape, lots of breathing room.
 */
function BgAccent() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1400"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    >
      {/* Big blue triangle, top-right corner — bleeds off canvas */}
      <polygon points="1000,-30 1300,420 700,420" fill={B} opacity="0.95" />
      {/* Big black filled circle, bottom-left — partial bleed */}
      <circle cx="80" cy="1320" r="220" fill={K} />
    </svg>
  )
}

/**
 * P — hairline: only thin 0.5–1px frame lines on left and right margins.
 * Ultra-restrained. Karel Martens / Lars Müller editorial framework.
 */
function BgHairline() {
  return (
    <>
      {/* Left margin double-rule */}
      <Box position="absolute" top="0" bottom="0" left={{ base: "8px", sm: "20px" }} w="1px" bg={K} opacity={0.7} zIndex={0} />
      <Box position="absolute" top="0" bottom="0" left={{ base: "13px", sm: "27px" }} w="1px" bg={B} opacity={0.85} zIndex={0} />
      {/* Right margin single rule */}
      <Box position="absolute" top="0" bottom="0" right={{ base: "8px", sm: "20px" }} w="1px" bg={K} opacity={0.7} zIndex={0} />
      {/* Tiny corner ticks */}
      <Box position="absolute" top="20px" left={{ base: "8px", sm: "20px" }} w="14px" h="1px" bg={K} opacity={0.7} zIndex={0} />
      <Box position="absolute" bottom="20px" left={{ base: "8px", sm: "20px" }} w="14px" h="1px" bg={K} opacity={0.7} zIndex={0} />
      <Box position="absolute" top="20px" right={{ base: "8px", sm: "20px" }} w="14px" h="1px" bg={K} opacity={0.7} zIndex={0} />
      <Box position="absolute" bottom="20px" right={{ base: "8px", sm: "20px" }} w="14px" h="1px" bg={K} opacity={0.7} zIndex={0} />
    </>
  )
}

/**
 * Q — dotgrid: same dotted background, but density modulated by a radial
 * gradient — empty cells become small filled squares in "hot" zones.
 */
function BgDotGrid() {
  // 32 cols × 56 rows feels dense enough on phone & desktop.
  const cols = 32
  const rows = 56
  // Centers of the two density "hot zones" in normalized 0..1
  const hot1 = { x: 0.78, y: 0.18, r: 0.32 }   // top-right
  const hot2 = { x: 0.18, y: 0.82, r: 0.28 }   // bottom-left
  const cells: React.ReactNode[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = x / (cols - 1)
      const ny = y / (rows - 1)
      const d1 = Math.hypot(nx - hot1.x, ny - hot1.y) / hot1.r
      const d2 = Math.hypot(nx - hot2.x, ny - hot2.y) / hot2.r
      const intensity = Math.max(0, 1 - Math.min(d1, d2))   // 0..1
      // base small dot everywhere; intensify into bigger square in hot zones
      let size = 1.4
      let color: string = "rgba(13,13,13,0.35)"
      if (intensity > 0.75) { size = 5; color = d1 < d2 ? B : K }
      else if (intensity > 0.5) { size = 3.5; color = d1 < d2 ? "rgba(0,85,255,0.85)" : "rgba(13,13,13,0.85)" }
      else if (intensity > 0.25) { size = 2.4; color = "rgba(13,13,13,0.55)" }
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={`${(nx) * 100}%`}
          y={`${(ny) * 100}%`}
          width={size}
          height={size}
          fill={color}
          transform={`translate(-${size / 2},-${size / 2})`}
        />
      )
    }
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    >
      {cells}
    </svg>
  )
}

/**
 * R — plain: same dotted "Bauhaus" grid as PipeLandingBauhaus, nothing else.
 * No corner supergraphics, no shapes, no tags — just the underlying grid.
 * Slightly darker / more pronounced dots than VariantBento's default base.
 */
function BgPlain() {
  return (
    <Box
      position="absolute"
      inset="0"
      pointerEvents="none"
      opacity={0.75}
      style={{
        backgroundImage: "radial-gradient(rgba(13,13,13,0.28) 1.1px, transparent 1.5px)",
        backgroundSize: "12px 12px",
      }}
      zIndex={0}
    />
  )
}

/**
 * S — swissgrid: thin crosshatch grid (vertical + horizontal lines, 48×48 px),
 * the same construction-marks grid used in PipeOnboarding.
 * Suitable for Swiss-poster / drafting-paper aesthetic.
 */
function BgSwissGrid() {
  return (
    <Box
      position="absolute"
      inset="0"
      pointerEvents="none"
      opacity={0.1}
      style={{
        backgroundImage:
          `linear-gradient(${K} 1px, transparent 1px), linear-gradient(90deg, ${K} 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }}
      zIndex={0}
    />
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
