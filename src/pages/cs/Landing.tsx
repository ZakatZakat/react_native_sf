/**
 * CitySignal · 01 · Лендинг · вариант «Ван Гог».
 *
 *  Three vertical columns of scrolling blue-duotone posters fill the viewport
 *  (the triptych "gallery" stage). A white ink-bordered ABOUT card floats in
 *  the upper third — the «Ван Гог» reference layout: a slim CITY|SIGNAL banner
 *  (kept as the cold-open lockup's dock target), a big «ТО ЧТО ДВИЖЕТСЯ В
 *  ГОРОДЕ» headline + «WK 22» block, a 4-poster thumbnail strip, and a
 *  ▮▮▮ · tagline · «142 событий» footer. A sticky «Войти в эту картинку» CTA
 *  fills the bottom edge.
 *
 *  Posters come from Curator via useDerived() (same singleton fetch every CS
 *  screen uses).
 */

import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { Box, Flex, Text } from "@chakra-ui/react"
import { useCsKeyframes, CS, FONT_MONO, FONT_SANS, POSTER_CELL_RATIO, POSTER_CELL_MAT } from "./shared"
import { useDerived } from "./useJourney"
import { weekMeta } from "./WeekDesigns"
import { Curator } from "../../lib/curator"
import { resolvePoster } from "./buildDerived"
import { analytics } from "../../lib/analytics"
import ColdOpenBar from "./ColdOpenBar"

const K = CS.K
const W = CS.W
const B = CS.B
const G55 = CS.G55

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
  const wk = weekMeta()

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
  // 4 posters for the «Ван Гог» card thumbnail strip — distinct images only
  // (no repeated event posters); pad with null if the feed has fewer than 4.
  const thumbs = useMemo(() => {
    const seen = new Set<string>()
    const out: (string | null)[] = []
    for (const p of base) {
      if (p && !seen.has(p)) { seen.add(p); out.push(p) }
      if (out.length === 4) break
    }
    while (out.length < 4) out.push(null)
    return out
  }, [base])
  // Editor-chosen landing posters (GET /me/landing). When set, they replace the
  // auto triptych in the strip; empty → keep the auto thumbs. Picked via
  // /cs/admin/landing.
  const [picked, setPicked] = useState<string[]>([])
  useEffect(() => {
    let live = true
    Curator.getLandingPicks()
      .then((items) => { if (live) setPicked((items || []).map((it) => resolvePoster(it)).filter((p): p is string => !!p)) })
      .catch(() => { /* fall back to auto thumbs */ })
    return () => { live = false }
  }, [])
  const strip = useMemo<(string | null)[]>(() => {
    if (!picked.length) return thumbs
    const out: (string | null)[] = picked.slice(0, 4)
    while (out.length < 4) out.push(null)
    return out
  }, [picked, thumbs])

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

          {/* ABOUT card — «Ван Гог» variant. The slim CITY|SIGNAL banner on top
              stays as the cold-open lockup's dock target (.cs-about-host +
              City/Signal spans); the gallery body sits below it. */}
          <Box
            className="cs-about-host"
            position="absolute"
            left={{ base: "12px", sm: "16px" }}
            right={{ base: "12px", sm: "16px" }}
            top={{ base: "11%", sm: "12%" }}
            bg={W}
            border={`3px solid ${K}`}
            zIndex={5}
            style={{ boxShadow: `5px 5px 0 ${B}`, fontFamily: FONT_SANS, padding: "14px" }}
          >
            {/* slim banner CITY|SIGNAL — cold-open dock target; hidden while the lockup is in flight */}
            <Box display="flex" style={{ height: 26, visibility: coldOpen ? "hidden" : "visible" }}>
              <Box style={{ width: 108, background: K, display: "flex", alignItems: "center", paddingLeft: 10 }}>
                <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.05em", textTransform: "uppercase", color: W }}>City</span>
              </Box>
              <Box style={{ flex: 1, background: B, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10 }}>
                <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: "-0.05em", textTransform: "uppercase", color: W }}>Signal</span>
              </Box>
            </Box>

            {/* headline «ТО ЧТО ДВИЖЕТСЯ В ГОРОДЕ» + «WK 22» */}
            <Flex justify="space-between" align="flex-start" style={{ gap: 8, marginTop: 12 }}>
              <Text as="div" fontWeight="900" fontSize="28px" lineHeight="0.84" letterSpacing="-0.05em" textTransform="uppercase" color={K}>
                То что<br />движется<br />в городе
              </Text>
              <Text as="div" fontWeight="900" fontSize="21px" lineHeight="0.9" letterSpacing="-0.03em" color={B} style={{ textAlign: "right", flexShrink: 0 }}>
                WK<br />{wk.n}
              </Text>
            </Flex>

            {/* 4-poster thumbnail strip — posters shown WHOLE (contain, no crop);
                a small inset + neutral mat frames the odd aspect ratios. */}
            <Box display="grid" mt="3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7 }}>
              {strip.map((p, i) => (
                <Box key={`${p ?? "none"}-${i}`} overflow="hidden" style={{ background: POSTER_CELL_MAT, aspectRatio: POSTER_CELL_RATIO, border: `1.5px solid ${K}`, padding: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p && (
                    <img
                      src={p}
                      alt=""
                      loading="lazy"
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
                    />
                  )}
                </Box>
              ))}
            </Box>

            {/* footer — ▮▮▮ · tagline · «142 событий» */}
            <Flex align="flex-start" mt="3" style={{ gap: 10, borderTop: `2px solid ${K}`, paddingTop: 10 }}>
              <Flex style={{ gap: 2, flexShrink: 0 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 3, height: 18, background: K }} />)}
              </Flex>
              <Box flex="1" />
              <Box style={{ textAlign: "right", flexShrink: 0 }}>
                <Text fontWeight="900" fontSize="20px" letterSpacing="-0.03em" color={B} lineHeight="1">142</Text>
                <Text fontSize="8px" color={G55} style={{ fontFamily: FONT_MONO }}>событий</Text>
              </Box>
            </Flex>
          </Box>

        </Box>
      </Flex>

      {/* sticky bottom CTA — «Запустить» */}
      <Flex
        as="button"
        onClick={goNext}
        position="absolute"
        left="0" right="0" bottom="0"
        zIndex={30}
        bg={K} color={W}
        align="center" justify="space-between"
        cursor="pointer"
        style={{ border: "none", padding: "16px 18px 20px", gap: 10, fontFamily: FONT_SANS, textAlign: "left" }}
        _active={{ transform: "translateY(1px)" }}
      >
        <Box>
          <Text fontWeight="900" fontSize="20px" letterSpacing="-0.025em" textTransform="uppercase">Запустить</Text>
        </Box>
        <Flex as="span" align="center" justify="center" style={{ fontSize: 26, fontWeight: 900, width: 40, height: 40, background: B, color: W, flexShrink: 0 }}>→</Flex>
      </Flex>

      {/* v6 cold-open «Полоса» — overlay; the City/Signal lockup settles into
          the card banner above, then this is removed (once per session). */}
      {coldOpen && <ColdOpenBar onDone={dismissColdOpen} />}
    </Box>
  )
}
