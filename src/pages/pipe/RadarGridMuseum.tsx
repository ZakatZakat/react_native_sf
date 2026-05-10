/**
 * RadarGridMuseum — Bauhaus / De Stijl / constructivist museum-poster style.
 *
 * Each card is a small modernist exhibition poster:
 *   • Cream paper background (#F4EEE3)
 *   • Big abstract ULTRAMARINE supergraphic — one of 12 hand-tuned SVG shapes
 *   • Stretched display typography — title oversized, letterSpacing tight,
 *     deliberately bleeds past the card edge (overflow: hidden clips it)
 *   • Editorial mono markers (№, k, label) using narrow grotesk
 *   • Selected state inverts paper → black, supergraphic stays blue
 *
 * Inspirations: Kandinsky, Bauhaus, El Lissitzky, Wim Crouwel,
 * Herbert Bayer, Jan Tschichold museum/exhibition posters.
 */

import { Box, Flex, Grid, Text } from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"
import { INTERESTS, type Interest } from "./preferences"

// Palette — restricted modernist
const PAPER = "#F4EEE3"   // cream
const INK = "#0D0D0D"     // black
const ULTRA = "#2042D8"   // ultramarine
const INK_DIM = "rgba(13,13,13,0.55)"

export function RadarGridMuseum({
  picked,
  onToggle,
}: {
  picked: Set<string>
  onToggle: (key: string) => void
}) {
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap="3" w="100%">
      {INTERESTS.map((interest, i) => (
        <MuseumCard
          key={interest.key}
          interest={interest}
          index={i}
          active={picked.has(interest.key)}
          onToggle={() => onToggle(interest.key)}
        />
      ))}
    </Grid>
  )
}

function MuseumCard({
  interest,
  index,
  active,
  onToggle,
}: {
  interest: Interest
  index: number
  active: boolean
  onToggle: () => void
}) {
  const navigate = useNavigate()
  const num = String(index + 1).padStart(2, "0")
  const goPreview = () => navigate({ to: "/pipe-radar/$key", params: { key: interest.key } })
  const Shape = SHAPES[index % SHAPES.length] ?? Shape0
  const TYPO = TYPOGRAPHY[index % TYPOGRAPHY.length] ?? TYPOGRAPHY[0]

  // Selected state inverts paper-and-ink, keeps blue as the only non-mono accent
  const bg = active ? INK : PAPER
  const fg = active ? PAPER : INK
  const fgDim = active ? "rgba(244,238,227,0.55)" : INK_DIM
  const blueOnActive = active ? ULTRA : ULTRA

  return (
    <Box
      as="button"
      onClick={goPreview}
      position="relative"
      w="100%"
      bg={bg}
      color={fg}
      border={`${active ? "3px" : "1.5px"} solid ${INK}`}
      cursor="pointer"
      textAlign="left"
      overflow="hidden"
      transition="background 0.18s, color 0.18s, border-width 0.15s, transform 0.16s"
      _hover={{ transform: "translateY(-2px)" }}
      style={{
        aspectRatio: "1 / 1.2",
        fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* SUPERGRAPHIC — the abstract blue form fills most of the card */}
      <Box position="absolute" inset="0" pointerEvents="none">
        <Shape color={blueOnActive} dimmed={active} />
      </Box>

      {/* Top row — editorial markers */}
      <Flex
        position="absolute"
        top="0"
        left="0"
        right="0"
        justify="space-between"
        align="flex-start"
        px="2.5"
        pt="2.5"
        zIndex={3}
      >
        <Text
          fontSize="10px"
          fontWeight="900"
          letterSpacing="0.32em"
          textTransform="uppercase"
          color={fg}
          lineHeight="1"
        >
          № {num}
        </Text>
        <Text
          fontSize="10px"
          fontWeight="900"
          letterSpacing="0.32em"
          textTransform="uppercase"
          color={fg}
          opacity={0.65}
          lineHeight="1"
          textAlign="right"
        >
          {active ? "selected" : "exhibit"}
        </Text>
      </Flex>

      {/* HUGE TITLE — stretched display typography that bleeds.
          Split by space so each word stays on its own line — no mid-word breaks. */}
      <Box
        position="absolute"
        left={TYPO.left}
        right={TYPO.right}
        bottom={TYPO.bottom}
        top={TYPO.top}
        zIndex={2}
        pointerEvents="none"
      >
        {interest.label.split(" ").map((word, i) => (
          <Text
            key={i}
            as="div"
            fontWeight="900"
            color={fg}
            textTransform="uppercase"
            style={{
              fontSize: TYPO.size,
              lineHeight: TYPO.lh,
              letterSpacing: TYPO.tracking,
              whiteSpace: "nowrap",
              transform: TYPO.scaleX ? `scaleX(${TYPO.scaleX})` : undefined,
              transformOrigin: "left",
            }}
          >
            {word}
          </Text>
        ))}
      </Box>

      {/* Bottom-left meta + bottom-right action arrow */}
      <Flex
        position="absolute"
        bottom="0"
        left="0"
        right="0"
        justify="space-between"
        align="flex-end"
        px="2.5"
        pb="2.5"
        zIndex={3}
      >
        <Flex align="center" gap="1.5">
          <Box w="12px" h="1.5px" bg={fg} opacity={0.85} />
          <Text
            fontSize="9px"
            fontWeight="900"
            letterSpacing="0.28em"
            textTransform="uppercase"
            color={fgDim}
          >
            {(interest.keywords?.length ?? 0).toString().padStart(2, "0")} k
          </Text>
        </Flex>
        <Box
          w="22px"
          h="22px"
          border={`1.5px solid ${fg}`}
          color={fg}
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="11px"
          fontWeight="900"
          lineHeight="1"
          bg={active ? ULTRA : "transparent"}
          style={{ borderColor: active ? ULTRA : fg }}
        >
          {active ? "✓" : "↗"}
        </Box>
      </Flex>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * TYPOGRAPHY VARIANTS — different stretching / positioning per card
 * to feel like 12 distinct posters
 * ──────────────────────────────────────────────────────────────── */

type TypoSpec = {
  size: string
  lh: string | number
  tracking: string
  scaleX?: number
  // positioning of the wrapper
  left?: string
  right?: string
  top?: string
  bottom?: string
}

// Sizes hand-tuned for narrow ~135px text columns on mobile.
// Every label is rendered word-by-word with `nowrap` — no mid-word breaks.
// Long single-word labels (10–11 chars) use small + horizontal compression.
// Short labels (4–6 chars) get massive sizes with slight horizontal scaling.
const TYPOGRAPHY: TypoSpec[] = [
  // 0 — «Современное искусство» (2 слова) → каждое слово на своей строке
  { size: "26px", lh: "0.92", tracking: "-0.035em", scaleX: 0.95, left: "-2px", right: "4px", bottom: "32px" },
  // 1 — «Кино» (4): MASSIVE
  { size: "64px", lh: "0.86", tracking: "-0.05em", scaleX: 1.05, left: "-4px", right: "0", bottom: "32px" },
  // 2 — «Театр» (5): big
  { size: "52px", lh: "0.86", tracking: "-0.05em", scaleX: 0.95, left: "-3px", right: "0", bottom: "32px" },
  // 3 — «Перформанс» (10)
  { size: "26px", lh: "0.92", tracking: "-0.035em", scaleX: 0.95, left: "-2px", right: "4px", bottom: "32px" },
  // 4 — «Выставки» (8)
  { size: "34px", lh: "0.88", tracking: "-0.045em", scaleX: 0.95, left: "-3px", right: "0", bottom: "32px" },
  // 5 — «Литература» (10)
  { size: "26px", lh: "0.92", tracking: "-0.035em", scaleX: 0.95, left: "-2px", right: "4px", bottom: "32px" },
  // 6 — «Музыка» (6)
  { size: "48px", lh: "0.88", tracking: "-0.045em", scaleX: 0.95, left: "-3px", right: "0", bottom: "32px" },
  // 7 — «Танец» (5): big wide
  { size: "56px", lh: "0.86", tracking: "-0.05em", scaleX: 1.05, left: "-4px", right: "0", bottom: "32px" },
  // 8 — «Фотография» (10)
  { size: "26px", lh: "0.92", tracking: "-0.035em", scaleX: 0.95, left: "-2px", right: "4px", bottom: "32px" },
  // 9 — «Архитектура» (11): tightest
  { size: "24px", lh: "0.92", tracking: "-0.035em", scaleX: 0.95, left: "-2px", right: "4px", bottom: "32px" },
  // 10 — «Дизайн» (6): big
  { size: "48px", lh: "0.88", tracking: "-0.045em", scaleX: 1.0, left: "-3px", right: "0", bottom: "32px" },
  // 11 — «Лекции» (6): big
  { size: "48px", lh: "0.88", tracking: "-0.045em", scaleX: 1.0, left: "-3px", right: "0", bottom: "32px" },
]

/* ─────────────────────────────────────────────────────────────────
 * SUPERGRAPHIC SHAPES — 12 SVG-based abstract blue forms
 * Each renders as full-card-sized SVG (viewport 100×120 to match aspect)
 * ──────────────────────────────────────────────────────────────── */

type ShapeProps = { color: string; dimmed?: boolean }

function ShapeSVG({ children, opacity = 1 }: { children: React.ReactNode; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 100 120"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block", opacity }}
    >
      {children}
    </svg>
  )
}

// 0 — large half-circle bottom-right (Bauhaus arc)
function Shape0({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <path d="M100 50 A 60 60 0 0 0 40 110 L 100 110 Z" fill={color} />
    </ShapeSVG>
  )
}

// 1 — diagonal stripe top-left to bottom-right (constructivist bar)
function Shape1({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <polygon points="0,0 35,0 100,90 100,120 65,120 0,30" fill={color} />
    </ShapeSVG>
  )
}

// 2 — thick vertical bar on left
function Shape2({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <rect x="0" y="0" width="34" height="120" fill={color} />
      <circle cx="34" cy="36" r="6" fill={color} />
    </ShapeSVG>
  )
}

// 3 — sine wave horizontal (Kandinsky-like)
function Shape3({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <path
        d="M0 60 Q 25 20 50 60 T 100 60 L 100 120 L 0 120 Z"
        fill={color}
      />
    </ShapeSVG>
  )
}

// 4 — two stacked circles (eyes / abstract)
function Shape4({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <circle cx="28" cy="42" r="22" fill={color} />
      <circle cx="74" cy="78" r="32" fill={color} />
    </ShapeSVG>
  )
}

// 5 — quarter circle top-right
function Shape5({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <path d="M100 0 L 100 70 A 70 70 0 0 0 30 0 Z" fill={color} />
    </ShapeSVG>
  )
}

// 6 — large triangle bottom-left
function Shape6({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <polygon points="0,30 80,120 0,120" fill={color} />
    </ShapeSVG>
  )
}

// 7 — cross of two thick bars (De Stijl)
function Shape7({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <rect x="0" y="46" width="100" height="22" fill={color} />
      <rect x="60" y="0" width="22" height="120" fill={color} />
    </ShapeSVG>
  )
}

// 8 — concentric arcs (target)
function Shape8({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <circle cx="78" cy="40" r="46" fill={color} opacity="0.35" />
      <circle cx="78" cy="40" r="32" fill={color} opacity="0.6" />
      <circle cx="78" cy="40" r="16" fill={color} />
    </ShapeSVG>
  )
}

// 9 — stair-step (constructivist diagonal)
function Shape9({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <polygon points="0,120 0,90 30,90 30,60 60,60 60,30 100,30 100,120" fill={color} />
    </ShapeSVG>
  )
}

// 10 — freeform blob (organic)
function Shape10({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <path
        d="M70 18 Q 102 30 95 65 Q 105 100 60 110 Q 18 105 16 70 Q 8 30 35 22 Q 50 8 70 18 Z"
        fill={color}
      />
    </ShapeSVG>
  )
}

// 11 — solid offset square (Malevich)
function Shape11({ color, dimmed }: ShapeProps) {
  return (
    <ShapeSVG opacity={dimmed ? 0.45 : 1}>
      <rect x="22" y="38" width="62" height="62" fill={color} transform="rotate(8, 53, 69)" />
    </ShapeSVG>
  )
}

const SHAPES = [Shape0, Shape1, Shape2, Shape3, Shape4, Shape5, Shape6, Shape7, Shape8, Shape9, Shape10, Shape11]
