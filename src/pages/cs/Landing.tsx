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
import { useMemo, useState } from "react"
import { Box, Flex, Text } from "@chakra-ui/react"
import { useCsKeyframes, CS, FONT_MONO, FONT_SANS } from "./shared"
import { useDerived } from "./useJourney"
import { analytics } from "../../lib/analytics"
import ColdOpenBar from "./ColdOpenBar"

const K = CS.K
const W = CS.W
const B = CS.B
const G55 = CS.G55
const G70 = CS.G70

const ABOUT_DESC = "Подборка событий Москвы и Петербурга, которых нет в больших афишах: подвалы, галереи, клубы, кинопоказы, лекции. Раз в неделю — одна лента под твой вкус."
const ABOUT_STEPS = [
  { n: "01", t: "Слежу", b: "35+ каналов" },
  { n: "02", t: "Отбираю", b: "ред. + алг." },
  { n: "03", t: "Шлю", b: "1 раз / нед." },
]

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

  // v6 cold-open «Полоса» — plays once per session, the City/Signal lockup
  // settles into the bar card's banner. While it runs the card's own banner is
  // hidden (the lockup draws it), so there's no double banner.
  const [coldOpen, setColdOpen] = useState(() => {
    if (typeof window === "undefined") return false
    return !sessionStorage.getItem("cs.coldopen.seen")
  })
  const dismissColdOpen = () => {
    try { sessionStorage.setItem("cs.coldopen.seen", "1") } catch { /* noop */ }
    setColdOpen(false)
  }

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
      {/* v6: full-screen triptych + floating bar card — no edition strip. */}
      <Flex direction="column" h="100%" w="100%">
        {/* Triptych stage — fills the screen. */}
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

          {/* ABOUT card — v6 «bar» variant: banner header CITY|SIGNAL + steps +
              «Запустить». The .cs-about-host wrapper + City/Signal spans are
              the homing target for the cold-open lockup. */}
          <Box
            className="cs-about-host"
            position="absolute"
            left={{ base: "12px", sm: "16px" }}
            right={{ base: "12px", sm: "16px" }}
            top={{ base: "11%", sm: "12%" }}
            bg={W}
            border={`2.5px solid ${K}`}
            zIndex={5}
            style={{ boxShadow: `5px 5px 0 ${B}`, fontFamily: FONT_SANS, padding: "16px" }}
          >
            {/* banner CITY|SIGNAL — hidden while the cold-open lockup is in flight */}
            <Box display="flex" style={{ height: 30, visibility: coldOpen ? "hidden" : "visible" }}>
              <Box style={{ width: 118, background: K, display: "flex", alignItems: "center", paddingLeft: 11 }}>
                <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.05em", textTransform: "uppercase", color: W }}>City</span>
              </Box>
              <Box style={{ flex: 1, background: B, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 11 }}>
                <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.05em", textTransform: "uppercase", color: W }}>Signal</span>
              </Box>
            </Box>

            <Flex justify="space-between" align="center" mt="3">
              <Mark color={G55}>Что это</Mark><Mark color={G55}>N°001</Mark>
            </Flex>

            <Text fontWeight="900" fontSize="27px" lineHeight="0.92" letterSpacing="-0.045em" textTransform="uppercase" color={K} mt="2.5">
              То, что <Text as="span" color={B}>движется</Text> в городе
            </Text>

            <Text fontWeight="600" fontSize="12px" lineHeight="1.5" color={G70} mt="2.5">{ABOUT_DESC}</Text>

            {/* steps 01 / 02 / 03 */}
            <Box display="flex" mt="3" style={{ borderTop: `2px solid ${K}`, borderBottom: `2px solid ${K}` }}>
              {ABOUT_STEPS.map((s, i) => (
                <Box key={s.n} flex="1" style={{ padding: "9px 0 10px", borderLeft: i ? `1px solid ${K}` : "none", paddingLeft: i ? "10px" : 0 }}>
                  <Text fontSize="10px" color={B} fontWeight="700" letterSpacing="0.06em" style={{ fontFamily: FONT_MONO }}>{s.n}</Text>
                  <Text fontWeight="900" fontSize="13.5px" letterSpacing="-0.02em" textTransform="uppercase" color={K} mt="1.5">{s.t}</Text>
                </Box>
              ))}
            </Box>

            {/* «Запустить» — launches the journey (replaces the old bottom CTA + «Сейчас в эфире») */}
            <Flex
              as="button"
              onClick={goNext}
              w="100%" mt="3"
              bg={K} color={W}
              align="center" justify="space-between"
              cursor="pointer"
              style={{ border: "none", padding: "11px 11px 11px 14px", gap: 10, fontFamily: FONT_SANS }}
              _active={{ transform: "translateY(1px)" }}
            >
              <Text as="span" fontWeight="900" fontSize="17px" letterSpacing="-0.025em" textTransform="uppercase">Запустить</Text>
              <Flex as="span" align="center" justify="center" style={{ fontSize: 20, fontWeight: 900, width: 34, height: 34, background: B, color: W, flexShrink: 0 }}>→</Flex>
            </Flex>
          </Box>

        </Box>
      </Flex>

      {/* v6 cold-open «Полоса» — overlay; the City/Signal lockup settles into
          the card banner above, then this is removed (once per session). */}
      {coldOpen && <ColdOpenBar onDone={dismissColdOpen} />}
    </Box>
  )
}
