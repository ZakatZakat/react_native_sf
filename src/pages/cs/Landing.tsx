/**
 * CitySignal · 01 · Лендинг.
 *
 *  Port of PipeLandingV1 — three vertical columns of scrolling posters fill
 *  the viewport, a white ink-bordered ABOUT card sits in the upper third,
 *  and a sticky "Войти в эту картинку" CTA fills the bottom edge.
 *
 *  Posters come from Curator via useDerived() (same singleton fetch every
 *  CS screen uses) and render through cs/shared's untinted DuotonePoster.
 */

import { useNavigate } from "@tanstack/react-router"
import { useMemo } from "react"
import { Box, Flex, Text } from "@chakra-ui/react"
import { useCsKeyframes, CS, FONT_MONO, FONT_SANS } from "./shared"
import { useDerived } from "./useJourney"
import { analytics } from "../../lib/analytics"

const K = CS.K
const W = CS.W
const B = CS.B
const G55 = CS.G55
const G70 = CS.G70

// ── Atoms ────────────────────────────────────────────────────────────────

/** Blue-duotone poster — Landing-only. Other CS screens (Swipe / Feed /
 *  Summary) use the natural-colour DuotonePoster from cs/shared. The
 *  triptych keeps its signal-blue wash because it's the brand statement
 *  on the entry screen. */
function BluePoster({ src, style }: { src: string | null; style?: React.CSSProperties }) {
  return (
    <Box position="relative" overflow="hidden" bg={W} style={style}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", display: "block",
            filter: "grayscale(1) contrast(1.18) brightness(0.95)",
          }}
        />
      )}
      {/* Signal-blue duotone overlay — multiplies onto the grayscale image */}
      <Box
        position="absolute" inset="0"
        bg={B} opacity={0.85}
        pointerEvents="none"
        style={{ mixBlendMode: "multiply" }}
      />
      {/* Riso dot overlay — fine grain on top */}
      <Box
        position="absolute" inset="0"
        opacity={0.18}
        pointerEvents="none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 1.2px)",
          backgroundSize: "4px 4px",
        }}
      />
    </Box>
  )
}

function Mark({ children, color = K }: { children: React.ReactNode; color?: string }) {
  return (
    <Text
      as="span"
      fontSize="9px"
      fontWeight="900"
      letterSpacing="0.22em"
      textTransform="uppercase"
      color={color}
      style={{ fontFamily: FONT_MONO }}
    >
      {children}
    </Text>
  )
}

/** Single vertical column — duplicates the strip so the loop seems endless. */
function TriptychColumn({
  posters, durSec, dir, gapPx = 6, borderRight = true,
}: {
  posters: (string | null)[]
  durSec: number
  dir: "down" | "up"
  gapPx?: number
  borderRight?: boolean
}) {
  const strip = useMemo(() => [...posters, ...posters], [posters])
  return (
    <Box
      position="relative"
      overflow="hidden"
      bg={K}
      h="100%"
      borderRight={borderRight ? `1.5px solid ${K}` : undefined}
    >
      <Box
        display="flex"
        flexDirection="column"
        p={`${gapPx}px`}
        style={{
          gap: `${gapPx}px`,
          animation: `cs-tri-${dir} ${durSec}s linear infinite`,
          willChange: "transform",
        }}
      >
        {strip.map((p, i) => (
          <BluePoster
            key={`${p ?? "none"}-${i}`}
            src={p}
            style={{ width: "100%", aspectRatio: "1 / 1.32", border: `1px solid ${K}`, flexShrink: 0 }}
          />
        ))}
      </Box>
    </Box>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function CsLanding() {
  useCsKeyframes()
  const navigate = useNavigate()
  const { derived } = useDerived()

  // Build 3 column strips of EXACTLY equal length — different rotations of
  // the same base so each column scrolls different content but the looping
  // strip height stays in sync.
  const COL_LEN = 8
  const rotate = <T,>(arr: T[], n: number): T[] => [...arr.slice(n), ...arr.slice(0, n)]
  const base = useMemo(() => {
    const src = derived.triptychPosters
    const padded = src.length >= COL_LEN ? src : [...src, ...src, ...src].slice(0, COL_LEN)
    return padded.slice(0, COL_LEN)
  }, [derived.triptychPosters])
  const colA = base
  const colB = useMemo(() => rotate(base, Math.floor(COL_LEN / 3)).reverse(), [base])
  const colC = useMemo(() => rotate(base, Math.floor((COL_LEN * 2) / 3)), [base])

  const goNext = () => {
    analytics.track("cs.landing.enter", {})
    navigate({ to: "/cs/loading" })
  }

  // Edition week-of-year for the header strip.
  const now = new Date()
  const wk = String(
    Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7),
  ).padStart(2, "0")

  return (
    <Box
      bg={W}
      color={K}
      // Pin to viewport: no document scroll, CTA always visible at bottom.
      position="fixed"
      top="0" left="0" right="0" bottom="0"
      overflow="hidden"
      style={{
        fontFamily: FONT_SANS,
      }}
    >
      {/* Outer flex column: edition strip → stage (flex 1) → CTA. */}
      <Flex direction="column" h="100%" w="100%">
        {/* Edition strip — flush against the stage, no margin. */}
        <Flex
          justify="space-between"
          align="center"
          px="4"
          py="2"
          borderBottom={`2px solid ${K}`}
          flexShrink={0}
        >
          <Mark>N° 001 · CITYSIGNAL</Mark>
          <Mark color={G55}>MSC · SPB · WK {wk}</Mark>
        </Flex>

        {/* Triptych stage — fills remaining vertical space. */}
        <Box position="relative" flex="1" minH="0" overflow="hidden">
          {/* The 3 scrolling columns */}
          <Box
            position="absolute"
            inset="0"
            display="grid"
            gridTemplateColumns="1fr 1fr 1fr"
          >
            <TriptychColumn posters={colA} durSec={30} dir="down" />
            <TriptychColumn posters={colB} durSec={24} dir="up" />
            <TriptychColumn posters={colC} durSec={36} dir="down" borderRight={false} />
          </Box>

          {/* Top + bottom 40px fade — same JSX recipe. */}
          <Box
            position="absolute" top="0" left="0" right="0" h="40px"
            pointerEvents="none" zIndex={2}
            style={{ background: `linear-gradient(to bottom, ${W}, transparent)` }}
          />
          <Box
            position="absolute" bottom="0" left="0" right="0" h="40px"
            pointerEvents="none" zIndex={2}
            style={{ background: `linear-gradient(to top, ${W}, transparent)` }}
          />

          {/* ABOUT card — upper third so the triptych below has room to breathe. */}
          <Box
            position="absolute"
            left={{ base: "10px", sm: "16px" }}
            right={{ base: "10px", sm: "16px" }}
            top={{ base: "18%", sm: "20%" }}
            bg={W}
            border={`2.5px solid ${K}`}
            zIndex={5}
            p="4"
            style={{
              boxShadow: `5px 5px 0 ${B}`,
              fontFamily: FONT_SANS,
            }}
          >
            {/* Corner stamp */}
            <Box
              position="absolute" top="-3px" right="-3px"
              bg={B} color={W}
              px="2" py="1"
              fontWeight="900"
              fontSize="9px"
              letterSpacing="0.22em"
              lineHeight="1"
            >
              ABOUT
            </Box>

            <Mark color={G55}>Что это</Mark>
            <Text
              fontWeight="900"
              fontSize={{ base: "26px", sm: "30px" }}
              lineHeight="0.92"
              letterSpacing="-0.04em"
              textTransform="uppercase"
              color={K}
              mt="1.5"
            >
              CitySignal —
            </Text>
            <Text
              fontWeight="900"
              fontSize={{ base: "26px", sm: "30px" }}
              lineHeight="0.92"
              letterSpacing="-0.04em"
              textTransform="uppercase"
              color={B}
              ml="2"
            >
              то, что
            </Text>
            <Text
              fontWeight="900"
              fontSize={{ base: "26px", sm: "30px" }}
              lineHeight="0.92"
              letterSpacing="-0.04em"
              textTransform="uppercase"
              color={K}
            >
              движется в городе
            </Text>

            <Text
              fontWeight="600"
              fontSize="12.5px"
              lineHeight="1.45"
              color={G70}
              mt="2.5"
            >
              Подборка ивентов Москвы и Петербурга, которых нет в больших афишах:
              подвалы, галереи, клубы, кинопоказы, лекции. Раз в неделю — одна
              лента под твой вкус.
            </Text>

            {/* Mini how-it-works */}
            <Box
              mt="3" pt="2.5"
              borderTop={`1.5px solid ${K}`}
              display="grid"
              gridTemplateColumns="1fr 1fr 1fr"
              gap="2"
            >
              {[
                { n: "01", t: "Слежу", b: "35+ каналов" },
                { n: "02", t: "Отбираю", b: "ред. + алг." },
                { n: "03", t: "Шлю", b: "1 раз / нед." },
              ].map((s) => (
                <Box key={s.n}>
                  <Text
                    fontSize="9px"
                    color={B}
                    fontWeight="700"
                    letterSpacing="0.06em"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {s.n}
                  </Text>
                  <Text
                    fontWeight="900"
                    fontSize="12px"
                    lineHeight="1"
                    letterSpacing="-0.02em"
                    textTransform="uppercase"
                    color={K}
                    mt="0.5"
                  >
                    {s.t}
                  </Text>
                  <Text
                    fontSize="9px"
                    color={G55}
                    mt="0.5"
                    letterSpacing="0.04em"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {s.b}
                  </Text>
                </Box>
              ))}
            </Box>

            {/* Stats bottom row */}
            <Flex
              mt="3" pt="2"
              borderTop={`2px solid ${K}`}
              justify="space-between"
              align="baseline"
            >
              <Mark>Сейчас в эфире</Mark>
              <Flex align="baseline" gap="2">
                <Text
                  fontWeight="900"
                  fontSize="22px"
                  color={B}
                  lineHeight="1"
                  letterSpacing="-0.04em"
                >
                  142
                </Text>
                <Text
                  fontSize="10px"
                  color={G55}
                  style={{ fontFamily: FONT_MONO }}
                >
                  ивентов / нед.
                </Text>
              </Flex>
            </Flex>
          </Box>

          {/* Bottom-of-stage labels — inside the fade. */}
          <Flex
            position="absolute"
            left="0" right="0" bottom="8px"
            px="4.5"
            zIndex={3}
            justify="space-between"
            color={W}
            style={{
              fontFamily: FONT_MONO,
              textShadow: "0 0 4px rgba(0,0,0,0.5)",
            }}
            fontSize="9px"
            letterSpacing="0.16em"
            textTransform="uppercase"
          >
            <Text as="span">↓ за неделю</Text>
            <Text as="span">↑ live now</Text>
            <Text as="span">↓ MSC + SPB</Text>
          </Flex>
        </Box>

        {/* Bottom CTA — in-flow under the stage. */}
        <Flex
          as="button"
          onClick={goNext}
          bg={K}
          color={W}
          align="center"
          justify="space-between"
          cursor="pointer"
          flexShrink={0}
          style={{
            paddingTop: "14px",
            paddingBottom: "max(18px, env(safe-area-inset-bottom))",
            paddingLeft: "18px",
            paddingRight: "18px",
            fontFamily: FONT_SANS,
          }}
          _hover={{ bg: B }}
          _active={{ transform: "translateY(1px)" }}
          transition="background 0.14s"
        >
          <Box textAlign="left">
            <Mark color="rgba(255,255,255,0.5)">Шаг 1 / 7</Mark>
            <Text
              fontWeight="900"
              fontSize="18px"
              lineHeight="1"
              mt="1"
              letterSpacing="-0.025em"
              textTransform="uppercase"
              color={W}
            >
              Войти в эту картинку
            </Text>
          </Box>
          <Text fontSize="26px" lineHeight="1" fontWeight="900">→</Text>
        </Flex>
      </Flex>
    </Box>
  )
}
