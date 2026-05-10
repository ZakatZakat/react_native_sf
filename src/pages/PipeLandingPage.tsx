/**
 * PipeLandingPage — full-bleed Bauhaus / Swiss conference poster.
 *
 * Visual references: Future Shapers (ECAP RO 2019), UCLA School of the Arts,
 * Brightech identity. The landing IS a poster you scroll once.
 *
 * Composition:
 *  • Dotted-grid bg (like ECAP)
 *  • Three big yellow blocks anchored to corners (HERO supergraphic)
 *  • Pixel cluster (8×8 yellow squares with cut-outs) bottom-left
 *  • Massive CITY/SIGNAL black wordmark layered over the blocks
 *  • Tiny mono-caps editorial labels in opposite corners (issue/date)
 *  • Two CTAs as architectural buttons
 *  • Bottom: huge date plate + code label
 *
 * Palette: WHITE / BLACK / BLUE (existing) + new YELLOW (#FFD500)
 *  — yellow only used here as the poster supergraphic, doesn't bleed elsewhere.
 */

import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"

// Unified palette — same B as everywhere, no yellow.
const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.55)"
const G_LIGHT = "rgba(13,13,13,0.18)"
// Lighter blue tint for layered supergraphic — gives depth without breaking palette
const B_LIGHT = "rgba(0, 85, 255, 0.55)"

export default function PipeLandingPage() {
  const navigate = useNavigate()

  const dateLong = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date())
    .toUpperCase()
  const dd = String(new Date().getDate()).padStart(2, "0")
  const mm = String(new Date().getMonth() + 1).padStart(2, "0")
  const yy = String(new Date().getFullYear())

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      position="relative"
      overflow="hidden"
      css={{ WebkitTapHighlightColor: "transparent" }}
      style={{
        fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Dotted grid background */}
      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        opacity={0.65}
        style={{
          backgroundImage: `radial-gradient(${G_LIGHT} 1px, transparent 1.4px)`,
          backgroundSize: "12px 12px",
        }}
      />

      {/* ── Blue supergraphic — 4 sparse pixel-blocks (как было в жёлтом) ── */}

      {/* Big block top-left: irregular pixel-stair shape */}
      <Box
        position="absolute"
        top="0"
        left="0"
        w={{ base: "240px", sm: "320px" }}
        h={{ base: "260px", sm: "340px" }}
        bg={B}
        zIndex={0}
        pointerEvents="none"
        style={{
          clipPath:
            "polygon(0 0, 78% 0, 78% 14%, 100% 14%, 100% 36%, 88% 36%, 88% 56%, 70% 56%, 70% 80%, 42% 80%, 42% 100%, 0 100%)",
        }}
      />

      {/* Right rectangle mid */}
      <Box
        position="absolute"
        top={{ base: "320px", sm: "400px" }}
        right="0"
        w={{ base: "120px", sm: "180px" }}
        h={{ base: "200px", sm: "260px" }}
        bg={B}
        zIndex={0}
        pointerEvents="none"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 30% 100%, 30% 70%, 0 70%)" }}
      />

      {/* Pixel cluster bottom-left — 8x8 grid of small blue squares */}
      <Box
        position="absolute"
        bottom={{ base: "150px", sm: "200px" }}
        left="0"
        w={{ base: "180px", sm: "240px" }}
        h={{ base: "180px", sm: "240px" }}
        zIndex={0}
        pointerEvents="none"
      >
        <PixelCluster color={B} />
      </Box>

      {/* Bottom right architectural block */}
      <Box
        position="absolute"
        bottom="0"
        right="0"
        w={{ base: "200px", sm: "280px" }}
        h={{ base: "140px", sm: "180px" }}
        bg={B}
        zIndex={0}
        pointerEvents="none"
        style={{ clipPath: "polygon(0 36%, 24% 36%, 24% 0, 100% 0, 100% 100%, 0 100%)" }}
      />

      {/* ── Foreground content ── */}
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
        gap="6"
      >
        {/* Top edition strip */}
        <Flex justify="space-between" align="flex-start" gap="4">
          <Box>
            <Text fontSize="10px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={K}>
              N° 001
            </Text>
            <Text fontSize="10px" fontWeight="700" letterSpacing="0.22em" textTransform="uppercase" color={G} mt="1">
              v 0 . 1 — radar issue
            </Text>
          </Box>
          <Box textAlign="right" maxW="240px">
            <Text fontSize="11px" fontWeight="800" lineHeight="1.25" color={K}>
              Discovery engine for things that<br />
              never make the official posters.
            </Text>
            <Text fontSize="10px" fontWeight="700" letterSpacing="0.22em" textTransform="uppercase" color={G} mt="2">
              MOSCOW · SPB · {dateLong}
            </Text>
          </Box>
        </Flex>

        {/* Hero wordmark */}
        <Box position="relative" mt="2">
          <Text
            fontSize={{ base: "84px", sm: "128px" }}
            fontWeight="900"
            lineHeight="0.84"
            letterSpacing="-0.055em"
            textTransform="uppercase"
            color={K}
            style={{ marginLeft: "-6px" }}
          >
            CITY
          </Text>
          <Text
            fontSize={{ base: "84px", sm: "128px" }}
            fontWeight="900"
            lineHeight="0.84"
            letterSpacing="-0.055em"
            textTransform="uppercase"
            color={K}
            style={{ marginLeft: "-6px" }}
          >
            SIGNAL
          </Text>
        </Box>

        {/* Mid spec block — auditorium-style caption */}
        <Box mt="-2" pl="2" borderLeft={`3px solid ${K}`}>
          <Text
            fontSize="11px"
            fontWeight="900"
            letterSpacing="0.22em"
            textTransform="uppercase"
            color={K}
          >
            Auditorium / online
          </Text>
          <Text fontSize="11px" fontWeight="700" lineHeight="1.4" color={G} mt="1">
            Подвалы, галереи, клубы,<br />
            кинопоказы и странные штуки на сегодня.
          </Text>
        </Box>

        {/* Manifesto headline */}
        <Box mt="2">
          <Text
            fontSize={{ base: "22px", sm: "30px" }}
            fontWeight="900"
            lineHeight="1.05"
            letterSpacing="-0.025em"
            color={K}
            maxW="500px"
          >
            События, которые{" "}
            <Text as="span" bg={B} color={W} px="2" py="0.5" style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
              не попали
            </Text>{" "}
            в обычные афиши.
          </Text>
        </Box>

        {/* Spec sheet */}
        <Flex gap="0" borderTop={`2px solid ${K}`} borderBottom={`2px solid ${K}`} mt="2">
          <SpecCol label="Источников" value="35+" />
          <SpecCol label="Сигналов" value="12" middle />
          <SpecCol label="В эфире" value="LIVE" accent />
        </Flex>

        {/* CTAs */}
        <Flex direction="column" gap="3" mt="auto" pt="2">
          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-onboarding", search: { step: "radar" } })}
            align="center"
            justify="space-between"
            px="5"
            py="4"
            bg={K}
            color={W}
            border={`3px solid ${K}`}
            cursor="pointer"
            position="relative"
            overflow="hidden"
            _hover={{ bg: B, borderColor: B }}
            _active={{ transform: "translate(2px, 2px)" }}
            transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
          >
            <Box position="absolute" top="0" left="0" w="16px" h="16px" bg={B} borderRight={`2px solid ${W}`} borderBottom={`2px solid ${W}`} />
            <Text
              fontSize={{ base: "16px", sm: "20px" }}
              fontWeight="900"
              letterSpacing="0.05em"
              textTransform="uppercase"
              ml="6"
            >
              Собрать радар
            </Text>
            <Text fontSize="22px" fontWeight="900" lineHeight="1">→</Text>
          </Flex>

          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-feed-swipe" })}
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
            <Text fontSize={{ base: "14px", sm: "16px" }} fontWeight="900" letterSpacing="0.05em" textTransform="uppercase">
              Смотреть всё
            </Text>
            <Text fontSize="18px" fontWeight="900" lineHeight="1" opacity={0.7}>→</Text>
          </Flex>
        </Flex>

        {/* Bottom: HUGE date + code label like ECAP */}
        <Flex justify="space-between" align="flex-end" mt="2" pt="3" borderTop={`2px solid ${K}`}>
          <Text
            fontSize={{ base: "30px", sm: "38px" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={K}
            lineHeight="1"
          >
            <Text as="span">{dd}.{mm}.</Text>
            <Text as="span" bg={B} color={W} px="1.5">{yy}</Text>
          </Text>
          <Box textAlign="right">
            <Text fontSize={{ base: "26px", sm: "32px" }} fontWeight="900" letterSpacing="-0.03em" lineHeight="1" color={K}>
              PIPE
            </Text>
            <Text fontSize={{ base: "26px", sm: "32px" }} fontWeight="900" letterSpacing="-0.03em" lineHeight="1" color={K}>
              RD{yy.slice(2)}
            </Text>
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */

function SpecCol({ label, value, middle = false, accent = false }: { label: string; value: string; middle?: boolean; accent?: boolean }) {
  return (
    <Flex
      direction="column"
      flex="1"
      px="3"
      py="3"
      borderLeft={middle ? `1.5px solid ${K}` : undefined}
      borderRight={middle ? `1.5px solid ${K}` : undefined}
      position="relative"
      bg={W}
    >
      {accent && (
        <Box position="absolute" top="6px" right="6px" w="10px" h="10px" bg={B} />
      )}
      <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={G}>
        {label}
      </Text>
      <Text fontSize="26px" fontWeight="900" letterSpacing="-0.035em" color={K} lineHeight="1.05" mt="1">
        {value}
      </Text>
    </Flex>
  )
}

/**
 * 8×8 grid of small squares with random cut-outs — pixel-cluster supergraphic.
 * Deterministic pattern (no randomness on render) so it always looks the same.
 */
/**
 * Bottom skyline — irregular pixel-blocks city silhouette.
 * Rises from the bottom edge with varying tower heights, like the ECAP poster bottom.
 */
function Skyline({ color }: { color: string }) {
  // Each value = relative height fraction (0..1) of that vertical strip.
  // 24 strips across the width.
  const towers = [
    0.15, 0.35, 0.30, 0.55, 0.45, 0.70, 0.60, 0.50,
    0.85, 0.75, 0.95, 0.65, 0.50, 0.30, 0.20, 0.45,
    0.55, 0.75, 0.85, 0.65, 0.45, 0.55, 0.40, 0.25,
  ]
  const stripW = 100 / towers.length
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }}>
      {towers.map((h, i) => (
        <rect
          key={i}
          x={i * stripW}
          y={(1 - h) * 100}
          width={stripW + 0.3 /* tiny overlap to avoid hairline gaps */}
          height={h * 100}
          fill={color}
        />
      ))}
    </svg>
  )
}

function PixelCluster({ color }: { color: string }) {
  // 1 = filled, 0 = empty. Hand-tuned to look like an organic urban silhouette.
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
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
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
