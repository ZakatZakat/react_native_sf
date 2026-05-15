/**
 * RadarGridEditorial — three interchangeable layouts for the radar / interest picker:
 *
 *   C. RadarGridBrussels    — overlapping bleeding colour-blocks, type set huge
 *                             with fragments running off the canvas (Brussels Museums
 *                             Nocturnes 2018 reference).
 *   D. RadarGridTriptic     — 3 colour-zoned columns with structured numerals
 *                             (Triptic 2013 cultural-exchange poster reference).
 *   E. RadarGridBlockParty  — dark canvas + rounded pastel cards in a 2-col bento
 *                             (Block Party events board reference).
 *
 * All three accept the same props and reuse INTERESTS from preferences.ts.
 */

import * as React from "react"
import { useState } from "react"
import { Box, Flex, Grid, Text } from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"
import { INTERESTS, type Interest } from "./preferences"

const INK = "#0D0D0D"
const PAPER = "#FFFFFF"
const ULTRA = "#0055FF"

type GridProps = {
  picked: Set<string>
  onToggle: (key: string) => void
  /** Optional — keyed by interest.key, array of poster URLs to use as card backgrounds. */
  interestImages?: Record<string, string[]>
}

/* ─── Synthetic event count per interest (stable, not random per render). ─── */
function pseudoCount(key: string, index: number): string {
  const seed = key.length * 7 + index * 13
  const v = 4 + (seed % 18)
  return `${String(v).padStart(2, "0")} K`
}

/* ════════════════════════════════════════════════════════════════ */
/* C — BRUSSELS                                                     */
/* ════════════════════════════════════════════════════════════════ */

const BRUSSELS_PINK   = "#F5C7CC"
const BRUSSELS_RED    = "#E64C2E"
const BRUSSELS_GREEN  = "#7FBA9A"
const BRUSSELS_BLUE   = "#1F4FB4"
const BRUSSELS_CREAM  = "#F1ECDF"

export function RadarGridBrussels({ picked, onToggle }: GridProps) {
  // Colour blocks distributed throughout the card grid — each one tied to a
  // particular card index so the bleeds spread evenly down the page instead
  // of clustering at the top.
  const bleeds: Array<{ atIndex: number; side: "L" | "R"; color: string; w: string; h: string; offset: number }> = [
    { atIndex: 0, side: "L", color: BRUSSELS_BLUE,  w: "70%",  h: "260px", offset: -40 },
    { atIndex: 1, side: "R", color: BRUSSELS_PINK,  w: "85%",  h: "240px", offset: -50 },
    { atIndex: 4, side: "L", color: BRUSSELS_RED,   w: "120%", h: "240px", offset: -30 },
    { atIndex: 6, side: "R", color: BRUSSELS_GREEN, w: "100%", h: "260px", offset: -60 },
    { atIndex: 9, side: "L", color: BRUSSELS_CREAM, w: "60%",  h: "220px", offset: -20 },
  ]

  return (
    <Box position="relative" w="100%" overflow="hidden" pb="3">
      <Grid templateColumns="repeat(2, 1fr)" gap="3" w="100%" position="relative">
        {INTERESTS.map((interest, i) => {
          const bleed = bleeds.find((b) => b.atIndex === i)
          return (
            <Box key={interest.key} position="relative">
              {bleed && (
                <Box
                  position="absolute"
                  top={`${bleed.offset}px`}
                  {...(bleed.side === "L" ? { left: `-${parseInt(bleed.w) * 0.4}%` } : { right: `-${parseInt(bleed.w) * 0.4}%` })}
                  w={bleed.w}
                  h={bleed.h}
                  bg={bleed.color}
                  zIndex={0}
                  pointerEvents="none"
                />
              )}
              <Box position="relative" zIndex={1}>
                <BrusselsCard
                  interest={interest}
                  index={i}
                  active={picked.has(interest.key)}
                  onToggle={() => onToggle(interest.key)}
                />
              </Box>
            </Box>
          )
        })}
      </Grid>
    </Box>
  )
}

function BrusselsCard({ interest, index, active, onToggle }: {
  interest: Interest; index: number; active: boolean; onToggle: () => void
}) {
  const navigate = useNavigate()
  const num = String(index + 1).padStart(2, "0")
  const goPreview = () => navigate({ to: "/pipe-radar/$key", params: { key: interest.key } })
  const bg = active ? INK : PAPER
  const fg = active ? PAPER : INK
  return (
    <Box
      as="button"
      onClick={goPreview}
      onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); onToggle() }}
      position="relative" w="100%" bg={bg} color={fg}
      border={`${active ? "3px" : "1.5px"} solid ${INK}`}
      cursor="pointer" textAlign="left" overflow="hidden"
      transition="background 0.18s, color 0.18s, border-width 0.15s"
      _hover={{ transform: "translateY(-2px)" }}
      style={{ aspectRatio: "1 / 1.22", fontFamily: "'Helvetica Neue', sans-serif" }}
    >
      <Flex direction="column" h="100%" p="3" justify="space-between">
        <Flex justify="space-between" align="flex-start">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em">№ {num}</Text>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em">EXHIBIT</Text>
        </Flex>
        <Text
          fontSize={{ base: "20px", sm: "24px" }}
          fontWeight="900"
          lineHeight="0.9"
          letterSpacing="-0.03em"
          textTransform="uppercase"
          style={{ wordBreak: "break-word" }}
        >
          {interest.label}
        </Text>
        <Flex justify="space-between" align="flex-end">
          <Text fontSize="11px" fontWeight="900" letterSpacing="0.04em">
            {pseudoCount(interest.key, index)}
          </Text>
          <Text fontSize="14px" fontWeight="900" lineHeight="1">↗</Text>
        </Flex>
      </Flex>
      {/* Toggle pill — small button bottom-left, doesn't trigger navigate */}
      <Box
        as="span"
        role="button"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggle() }}
        position="absolute" top="6px" right="6px"
        w="14px" h="14px"
        bg={active ? ULTRA : "transparent"}
        border={`1.5px solid ${active ? ULTRA : fg}`}
        borderRadius="50%"
        cursor="pointer"
      />
    </Box>
  )
}

/* ════════════════════════════════════════════════════════════════ */
/* D — TRIPTIC                                                       */
/* ════════════════════════════════════════════════════════════════ */

const TRIPTIC_PURPLE = "#B7A6E0"
const TRIPTIC_GREEN  = "#9BD2B5"
const TRIPTIC_RED    = "#E26B5C"

export function RadarGridTriptic({ picked, onToggle }: GridProps) {
  // Distribute interests across 3 colored columns
  const cols: Interest[][] = [[], [], []]
  INTERESTS.forEach((it, i) => cols[i % 3].push(it))
  const colColors = [TRIPTIC_PURPLE, TRIPTIC_GREEN, TRIPTIC_RED]

  return (
    <Box w="100%">
      {/* TRIPTIC header bar */}
      <Flex
        align="center" justify="center" gap="3"
        borderTop={`2px solid ${INK}`} borderBottom={`2px solid ${INK}`}
        py="2" mb="3"
      >
        <Text fontSize="12px" fontWeight="900" letterSpacing="0.18em">▾</Text>
        <Text fontSize="14px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase">
          Triptic / Радар
        </Text>
        <Text fontSize="12px" fontWeight="900" letterSpacing="0.18em">▾</Text>
      </Flex>

      <Grid
        templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }}
        gap="0"
        border={`2px solid ${INK}`}
      >
        {cols.map((items, ci) => (
          <Flex
            key={ci}
            direction="column"
            bg={colColors[ci]}
            borderRight={{ base: undefined, sm: ci < 2 ? `2px solid ${INK}` : undefined }}
            borderBottom={{ base: ci < 2 ? `2px solid ${INK}` : undefined, sm: undefined }}
            p="3"
            gap="2"
            minH="240px"
          >
            <Flex justify="space-between" align="flex-start" mb="2">
              <Text fontSize="34px" fontWeight="900" letterSpacing="-0.04em" lineHeight="0.9" color={INK}>
                {String(ci + 1).padStart(2, "0")}.
              </Text>
              <Text
                fontSize="9px" fontWeight="900" letterSpacing="0.22em"
                textTransform="uppercase" textAlign="right" color={INK} maxW="80px"
              >
                {ci === 0 ? "Визуальное" : ci === 1 ? "Сценическое" : "Литер. & звук"}
              </Text>
            </Flex>
            {items.map((it, idx) => (
              <TripticChip
                key={it.key}
                interest={it}
                num={ci * 10 + idx + 1}
                active={picked.has(it.key)}
                onToggle={() => onToggle(it.key)}
              />
            ))}
          </Flex>
        ))}
      </Grid>
    </Box>
  )
}

function TripticChip({ interest, num, active, onToggle }: {
  interest: Interest; num: number; active: boolean; onToggle: () => void
}) {
  const navigate = useNavigate()
  const goPreview = () => navigate({ to: "/pipe-radar/$key", params: { key: interest.key } })
  return (
    <Flex
      as="button"
      onClick={goPreview}
      onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); onToggle() }}
      align="center" justify="space-between"
      bg={active ? INK : "transparent"}
      color={active ? PAPER : INK}
      border={`1.5px solid ${INK}`}
      px="2.5" py="2"
      cursor="pointer"
      transition="background 0.16s, color 0.16s"
      _hover={{ bg: active ? INK : "rgba(13,13,13,0.08)" }}
    >
      <Box minW="0" flex="1" textAlign="left">
        <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" opacity={0.7}>
          № {String(num).padStart(2, "0")}
        </Text>
        <Text
          fontSize="15px" fontWeight="900" letterSpacing="-0.01em"
          lineHeight="1.05" textTransform="uppercase"
          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {interest.label}
        </Text>
      </Box>
      <Box
        as="span"
        role="button"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggle() }}
        ml="2"
        w="16px" h="16px"
        bg={active ? ULTRA : "transparent"}
        border={`1.5px solid ${active ? ULTRA : INK}`}
        borderRadius="50%"
        flexShrink={0}
        cursor="pointer"
      />
    </Flex>
  )
}

/* ════════════════════════════════════════════════════════════════ */
/* F — CONSTELLATION                                                */
/* Categories as stars on a night sky. Tap to light a star;         */
/* lit stars connect with lines in the order they were picked,      */
/* forming the user's personal "созвездие сигналов".                 */
/* ════════════════════════════════════════════════════════════════ */

const SKY_BG       = "#070912"
const STAR_DIM     = "rgba(255,255,255,0.55)"
const STAR_LIT     = "#FFFFFF"
const ULTRA_LIT    = "#5A8CFF"

/** Stable pseudo-random scatter for 12 stars (varies per index but reproducible). */
function starPositions(): Array<{ x: number; y: number; size: number }> {
  // Hand-picked positions in 0..100 % (looks more "natural" than algorithmic random).
  // size: relative star radius (0.7..1.3)
  return [
    { x: 18, y: 16, size: 1.1 },   // 01 — top left
    { x: 52, y: 10, size: 0.9 },   // 02 — top center
    { x: 84, y: 22, size: 1.2 },   // 03 — top right
    { x: 70, y: 38, size: 0.8 },   // 04
    { x: 32, y: 36, size: 1.3 },   // 05
    { x: 12, y: 54, size: 0.9 },   // 06
    { x: 50, y: 52, size: 1.0 },   // 07 — center
    { x: 88, y: 56, size: 1.1 },   // 08
    { x: 26, y: 72, size: 1.2 },   // 09
    { x: 62, y: 70, size: 0.85 },  // 10
    { x: 80, y: 86, size: 1.0 },   // 11
    { x: 42, y: 88, size: 1.15 },  // 12 — bottom
  ]
}

/** Background dust — small fixed stars scattered around for depth. */
const DUST_STARS = Array.from({ length: 60 }, (_, i) => {
  // deterministic LCG for reproducibility
  let s = (i + 1) * 9301 + 49297
  s = (s * 9301 + 49297) % 233280
  const x = (s % 100) + (((s / 100) | 0) % 100) / 100
  s = (s * 9301 + 49297) % 233280
  const y = (s % 100) + (((s / 100) | 0) % 100) / 100
  s = (s * 9301 + 49297) % 233280
  const sz = 0.4 + ((s % 100) / 100) * 0.9
  s = (s * 9301 + 49297) % 233280
  const op = 0.18 + ((s % 100) / 100) * 0.45
  return { x, y, sz, op, i }
})

export function RadarGridOscilloscope({ picked, onToggle }: GridProps) {
  // Track the order in which interests were picked → lines connect them in that order.
  const [order, setOrder] = useState<string[]>([])

  // Reconcile order with picked set: drop unpicked, append newly-picked we haven't seen.
  React.useEffect(() => {
    setOrder((prev) => {
      const filtered = prev.filter((k) => picked.has(k))
      const newKeys = INTERESTS.map((it) => it.key).filter((k) => picked.has(k) && !filtered.includes(k))
      return [...filtered, ...newKeys]
    })
  }, [picked])

  const positions = starPositions()
  const indexByKey: Record<string, number> = {}
  INTERESTS.forEach((it, i) => { indexByKey[it.key] = i })

  return (
    <Box w="100%" maxW="500px" mx="auto" position="relative">
      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1;   }
        }
        @keyframes lit-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    box-shadow: 0 0 12px rgba(255,255,255,0.55), 0 0 28px rgba(90,140,255,0.55); }
          50%      { transform: translate(-50%, -50%) scale(1.15); box-shadow: 0 0 18px rgba(255,255,255,0.85), 0 0 38px rgba(90,140,255,0.85); }
        }
        @keyframes line-draw {
          from { stroke-dashoffset: 200; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 0.85; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sky-star, .sky-star-lit, .sky-line { animation: none !important; }
        }
      `}</style>

      {/* The sky */}
      <Box
        position="relative"
        w="100%"
        bg={SKY_BG}
        overflow="hidden"
        borderRadius="md"
        style={{
          aspectRatio: "1 / 1.15",
          backgroundImage:
            "radial-gradient(ellipse at 30% 20%, rgba(40,55,140,0.35) 0%, transparent 55%), " +
            "radial-gradient(ellipse at 80% 90%, rgba(80,40,140,0.25) 0%, transparent 60%)",
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Dust starfield */}
        {DUST_STARS.map(({ x, y, sz, op, i }) => (
          <Box
            key={`d${i}`}
            position="absolute"
            left={`${x}%`}
            top={`${y}%`}
            w={`${sz}px`}
            h={`${sz}px`}
            bg={STAR_LIT}
            borderRadius="50%"
            style={{
              opacity: op,
              animation: `star-twinkle ${3 + (i % 5)}s ease-in-out ${(i % 7) * 0.4}s infinite`,
            }}
          />
        ))}

        {/* Connection lines — between picked stars in selection order */}
        <svg
          viewBox="0 0 100 115"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        >
          {order.map((k, idx) => {
            if (idx === 0) return null
            const prev = order[idx - 1]
            const a = positions[indexByKey[prev]]
            const b = positions[indexByKey[k]]
            if (!a || !b) return null
            // viewBox is 100×115 to match the 1/1.15 aspect; scale Y by 1.15
            return (
              <line
                key={`${prev}-${k}`}
                x1={a.x}    y1={a.y * 1.15}
                x2={b.x}    y2={b.y * 1.15}
                stroke={ULTRA_LIT}
                strokeWidth="0.35"
                strokeOpacity="0.85"
                strokeLinecap="round"
                strokeDasharray="200"
                className="sky-line"
                style={{ animation: "line-draw 0.7s ease-out forwards" }}
              />
            )
          })}
        </svg>

        {/* Main stars — interest categories */}
        {positions.map((p, i) => {
          const interest = INTERESTS[i]
          if (!interest) return null
          const isLit = picked.has(interest.key)
          return (
            <ConstellationStar
              key={interest.key}
              x={p.x}
              y={p.y}
              size={p.size}
              num={i + 1}
              label={interest.label}
              isLit={isLit}
              onPick={() => onToggle(interest.key)}
            />
          )
        })}

        {/* Center HUD — count badge, doesn't grab clicks */}
        <Box
          position="absolute"
          left="50%" top="50%"
          style={{ transform: "translate(-50%, -50%)" }}
          textAlign="center"
          pointerEvents="none"
        >
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" color="rgba(255,255,255,0.4)" textTransform="uppercase" mb="1">
            Созвездие
          </Text>
          <Text fontSize="48px" fontWeight="900" letterSpacing="-0.04em" color={STAR_LIT} lineHeight="1">
            {picked.size}
          </Text>
          <Text fontSize="9px" fontWeight="800" letterSpacing="0.22em" color="rgba(255,255,255,0.4)" textTransform="uppercase" mt="1">
            из {INTERESTS.length}
          </Text>
        </Box>
      </Box>

      {/* Compact legend below the sky — list of picks in order */}
      <Box mt="3">
        {order.length === 0 ? (
          <Text fontSize="10px" fontWeight="800" letterSpacing="0.22em" color={INK} opacity={0.5} textAlign="center" textTransform="uppercase">
            Тапни звезду чтобы зажечь
          </Text>
        ) : (
          <Flex wrap="wrap" gap="1.5" justify="center">
            {order.map((k, i) => {
              const it = INTERESTS.find((x) => x.key === k)
              if (!it) return null
              const num = INTERESTS.findIndex((x) => x.key === k) + 1
              return (
                <Box
                  key={k}
                  as="button"
                  onClick={() => onToggle(k)}
                  px="2.5" py="1"
                  bg={SKY_BG}
                  color={STAR_LIT}
                  border={`1.5px solid ${ULTRA_LIT}`}
                  fontSize="10px" fontWeight="900" letterSpacing="0.16em"
                  textTransform="uppercase"
                  cursor="pointer"
                  style={{ boxShadow: `0 0 8px rgba(90,140,255,0.4)` }}
                  _hover={{ bg: ULTRA_LIT }}
                >
                  ★ {String(i + 1).padStart(2, "0")}<Text as="span" opacity={0.55}> · </Text>{it.label} <Text as="span" opacity={0.55}>№{String(num).padStart(2, "0")}</Text>
                </Box>
              )
            })}
          </Flex>
        )}
      </Box>
    </Box>
  )
}

function ConstellationStar({ x, y, size, num, label, isLit, onPick }: {
  x: number; y: number; size: number; num: number; label: string; isLit: boolean; onPick: () => void
}) {
  // Idle stars get a per-position twinkle delay so they don't blink in unison.
  const twinkleDelay = ((num * 1.3) % 3).toFixed(2)
  return (
    <Box
      as="button"
      onClick={onPick}
      position="absolute"
      left={`${x}%`}
      top={`${y}%`}
      style={{
        transform: "translate(-50%, -50%)",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {/* The star itself */}
      <Box
        position="relative"
        w={`${(isLit ? 14 : 8) * size}px`}
        h={`${(isLit ? 14 : 8) * size}px`}
        bg={isLit ? STAR_LIT : STAR_DIM}
        borderRadius="50%"
        className={isLit ? "sky-star-lit" : "sky-star"}
        style={
          isLit
            ? { animation: "lit-pulse 2.4s ease-in-out infinite", transform: "translate(0,0)" }
            : {
                animation: `star-twinkle 3.2s ease-in-out ${twinkleDelay}s infinite`,
                boxShadow: `0 0 4px rgba(255,255,255,0.4)`,
              }
        }
      />
      {/* Halo for lit star */}
      {isLit && (
        <Box
          position="absolute"
          left="50%" top="50%"
          w="34px" h="34px"
          borderRadius="50%"
          border={`1px solid rgba(90,140,255,0.7)`}
          style={{ transform: "translate(-50%, -50%)" }}
        />
      )}
      {/* Floating label */}
      <Box
        position="absolute"
        left="50%"
        top={`calc(100% + 6px)`}
        style={{ transform: "translate(-50%, 0)", whiteSpace: "nowrap" }}
        textAlign="center"
      >
        <Text fontSize="7px" fontWeight="900" letterSpacing="0.18em" color={isLit ? ULTRA_LIT : "rgba(255,255,255,0.45)"} lineHeight="1">
          № {String(num).padStart(2, "0")}
        </Text>
        <Text
          fontSize="9px"
          fontWeight="900"
          letterSpacing={isLit ? "-0.005em" : "0.04em"}
          color={isLit ? STAR_LIT : "rgba(255,255,255,0.7)"}
          textTransform="uppercase"
          lineHeight="1.1"
          mt="0.5"
        >
          {label}
        </Text>
      </Box>
    </Box>
  )
}
/* ════════════════════════════════════════════════════════════════ */
/* E — BLOCK PARTY                                                  */
/* ════════════════════════════════════════════════════════════════ */

const BLOCK_BG = "#161616"
const BP_PALETTE = [
  "#B8D4CB", // mint
  "#F2C2BD", // salmon
  "#F0E1D5", // sand
  "#E5615A", // tomato
  "#E8B4A0", // peach
  "#C7B8D9", // lavender
]

/**
 * Card "modes" cycle through the grid to break the 2-col uniformity:
 *   - "photo"     : poster image fills the card, gradient + title overlaid bottom
 *   - "colour"    : solid pastel block, big title only (existing look)
 *   - "split"     : image top half, pastel bottom half with title (Riche Fenix style)
 *
 * Mode picked deterministically per index so layout is stable across renders.
 */
type BPMode = "photo" | "colour" | "split"
const BP_MODE_PATTERN: BPMode[] = ["photo", "colour", "split", "colour", "photo", "split"]

export function RadarGridBlockParty({ picked, onToggle, interestImages }: GridProps) {
  return (
    <Box bg={BLOCK_BG} p="3" position="relative" borderRadius="md">
      <Grid templateColumns="repeat(2, 1fr)" gap="3" w="100%">
        {INTERESTS.map((interest, i) => {
          const images = interestImages?.[interest.key] ?? []
          const image = images[i % Math.max(1, images.length)] ?? null
          const desiredMode = BP_MODE_PATTERN[i % BP_MODE_PATTERN.length]
          // No image available → fall back to "colour" so card still looks intentional
          const mode: BPMode = image ? desiredMode : "colour"
          return (
            <BlockPartyCard
              key={interest.key}
              interest={interest}
              index={i}
              tone={BP_PALETTE[i % BP_PALETTE.length]}
              image={image}
              mode={mode}
              active={picked.has(interest.key)}
              onToggle={() => onToggle(interest.key)}
            />
          )
        })}
      </Grid>
    </Box>
  )
}

function BlockPartyCard({ interest, index, tone, image, mode, active, onToggle }: {
  interest: Interest
  index: number
  tone: string
  image: string | null
  mode: BPMode
  active: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const num = String(index + 1).padStart(2, "0")
  const count = pseudoCount(interest.key, index)
  const goPreview = () => navigate({ to: "/pipe-radar/$key", params: { key: interest.key } })

  const ringColor = active ? ULTRA : (mode === "photo" ? PAPER : INK)
  const ringBg   = active ? ULTRA : "transparent"

  // Common shell — sets aspect, rounded corners, hover, toggles
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <Box
      as="button"
      onClick={goPreview}
      onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); onToggle() }}
      position="relative" w="100%"
      borderRadius="lg"
      border={active ? `2px solid ${ULTRA}` : "none"}
      cursor="pointer" overflow="hidden"
      transition="transform 0.16s"
      _hover={{ transform: "translateY(-2px)" }}
      style={{ aspectRatio: "1 / 1.18", fontFamily: "'Helvetica Neue', sans-serif" }}
    >
      {children}
      {/* Toggle dot — top-right */}
      <Box
        as="span"
        role="button"
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggle() }}
        position="absolute" top="8px" right="8px"
        w="14px" h="14px"
        bg={ringBg}
        border={`1.5px solid ${ringColor}`}
        borderRadius="50%"
        cursor="pointer"
        zIndex={3}
      />
    </Box>
  )

  /* MODE 1 — PHOTO: full poster image with gradient overlay */
  if (mode === "photo" && image) {
    return (
      <Shell>
        {/* Image */}
        <Box
          position="absolute" inset="0"
          style={{
            backgroundImage: `url(${image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "grayscale(0.4) contrast(1.05)",
          }}
        />
        {/* Bottom gradient for legibility */}
        <Box
          position="absolute" inset="0"
          bg="linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.85) 100%)"
          pointerEvents="none"
        />
        {/* Top label — small chip */}
        <Flex position="absolute" top="10px" left="10px" align="center" gap="1.5">
          <Box w="14px" h="1.5px" bg={PAPER} transform="rotate(-30deg)" />
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" color={PAPER} textTransform="uppercase">
            EXHIBIT
          </Text>
        </Flex>
        {/* Bottom title block */}
        <Box position="absolute" bottom="10px" left="10px" right="10px" color={PAPER}>
          <Flex align="baseline" gap="2" mb="1">
            <Text fontSize="22px" fontWeight="900" letterSpacing="-0.04em" lineHeight="0.9">
              {num}
            </Text>
            <Text fontSize="9px" fontWeight="800" letterSpacing="0.18em" opacity={0.85} textTransform="uppercase">
              {count}
            </Text>
          </Flex>
          <Text
            fontSize="20px" fontWeight="900" lineHeight="0.92"
            letterSpacing="-0.02em" textTransform="uppercase"
            style={{ wordBreak: "break-word" }}
          >
            {interest.label}
          </Text>
        </Box>
      </Shell>
    )
  }

  /* MODE 2 — SPLIT: image top half, pastel bottom half with title */
  if (mode === "split" && image) {
    return (
      <Shell>
        <Flex direction="column" h="100%" bg={tone} color={INK}>
          {/* Top — image */}
          <Box
            flex="1.05" minH="0" position="relative"
            style={{
              backgroundImage: `url(${image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "grayscale(0.35) contrast(1.05)",
            }}
          >
            <Flex position="absolute" top="8px" left="10px" align="center" gap="1.5">
              <Box w="14px" h="1.5px" bg={PAPER} transform="rotate(-30deg)" />
              <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" color={PAPER} textTransform="uppercase">
                EXHIBIT
              </Text>
            </Flex>
          </Box>
          {/* Bottom — pastel block with title */}
          <Box flex="1" p="3" position="relative">
            <Flex justify="space-between" align="flex-start" mb="1.5">
              <Text fontSize="9px" fontWeight="800" letterSpacing="0.18em" textTransform="uppercase" opacity={0.7}>
                {count}
              </Text>
              <Text fontSize="22px" fontWeight="900" letterSpacing="-0.04em" lineHeight="0.9">
                {num}
              </Text>
            </Flex>
            <Text
              fontSize="18px" fontWeight="900" lineHeight="0.92"
              letterSpacing="-0.02em" textTransform="uppercase"
              style={{ wordBreak: "break-word" }}
            >
              {interest.label}
            </Text>
          </Box>
        </Flex>
      </Shell>
    )
  }

  /* MODE 3 — COLOUR: solid pastel card, big text only (the original) */
  return (
    <Shell>
      <Flex
        direction="column" h="100%" p="3.5"
        bg={active ? BLOCK_BG : tone}
        color={active ? tone : INK}
        justify="space-between"
        textAlign="left"
      >
        <Flex align="flex-start" justify="space-between" gap="2">
          <Box>
            <Flex align="center" gap="1.5" mb="1">
              <Box w="14px" h="1.5px" bg={active ? tone : INK} transform="rotate(-30deg)" />
              <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase">
                EXHIBIT
              </Text>
            </Flex>
            <Text fontSize="9px" fontWeight="800" letterSpacing="0.18em" textTransform="uppercase" opacity={0.65}>
              {count}
            </Text>
          </Box>
          <Text
            fontSize={{ base: "26px", sm: "30px" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            lineHeight="0.9"
          >
            {num}
          </Text>
        </Flex>
        <Text
          fontSize={{ base: "22px", sm: "26px" }}
          fontWeight="900"
          letterSpacing="-0.02em"
          lineHeight="0.92"
          textTransform="uppercase"
          style={{ wordBreak: "break-word" }}
        >
          {interest.label}
        </Text>
      </Flex>
    </Shell>
  )
}
