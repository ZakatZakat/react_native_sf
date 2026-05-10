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

import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { isImg, resolveMedia } from "./pipe/shared"

// Unified palette — same B as everywhere, no yellow.
const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.55)"
const G_LIGHT = "rgba(13,13,13,0.18)"
// Lighter blue tint for layered supergraphic — gives depth without breaking palette
const B_LIGHT = "rgba(0, 85, 255, 0.55)"

export default function PipeLandingPosters() {
  const navigate = useNavigate()
  const [posters, setPosters] = useState<string[]>([])

  // Pull a few real event posters to use as duotone supergraphic
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const feed = await Curator.getFeed({ limit: 24 })
        if (cancelled) return
        const urls: string[] = []
        for (const ev of feed) {
          const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
          const r = resolveMedia(m ?? null)
          if (r && isImg(r)) urls.push(r)
          if (urls.length >= 4) break
        }
        setPosters(urls)
      } catch {
        /* offline fallback — supergraphic still renders without posters */
      }
    })()
    return () => { cancelled = true }
  }, [])

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

      {/* ── Bauhaus 4-corner blocks (kept untouched per user feedback) ── */}

      <Box
        position="absolute" top="0" left="0"
        w={{ base: "240px", sm: "320px" }} h={{ base: "260px", sm: "340px" }}
        bg={B} zIndex={0} pointerEvents="none"
        style={{ clipPath: "polygon(0 0, 78% 0, 78% 14%, 100% 14%, 100% 36%, 88% 36%, 88% 56%, 70% 56%, 70% 80%, 42% 80%, 42% 100%, 0 100%)" }}
      />
      <Box
        position="absolute" top={{ base: "320px", sm: "400px" }} right="0"
        w={{ base: "120px", sm: "180px" }} h={{ base: "200px", sm: "260px" }}
        bg={B} zIndex={0} pointerEvents="none"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 30% 100%, 30% 70%, 0 70%)" }}
      />
      <Box
        position="absolute" bottom={{ base: "150px", sm: "200px" }} left="0"
        w={{ base: "180px", sm: "240px" }} h={{ base: "180px", sm: "240px" }}
        zIndex={0} pointerEvents="none"
      >
        <PixelCluster color={B} />
      </Box>
      <Box
        position="absolute" bottom="0" right="0"
        w={{ base: "200px", sm: "280px" }} h={{ base: "140px", sm: "180px" }}
        bg={B} zIndex={0} pointerEvents="none"
        style={{ clipPath: "polygon(0 36%, 24% 36%, 24% 0, 100% 0, 100% 100%, 0 100%)" }}
      />

      {/* ── Foreground content (minimal Amsterdam-style) ── */}
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
        gap={{ base: "8", sm: "10" }}
      >
        {/* TOP STRIP — minimal editorial markers */}
        <Flex justify="space-between" align="flex-start">
          <Text fontSize="10px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={K}>
            N° 001
          </Text>
          <Text fontSize="10px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={K}>
            {dateLong}
          </Text>
        </Flex>

        {/* HERO — wordmark on the LEFT, ONE big duotone poster on the RIGHT (Amsterdam) */}
        <Flex
          direction={{ base: "column", sm: "row" }}
          align="flex-start"
          gap={{ base: "5", sm: "6" }}
        >
          {/* LEFT — just the wordmark, nothing else */}
          <Box flexShrink={0}>
            <Text
              fontSize={{ base: "76px", sm: "112px" }}
              fontWeight="900"
              lineHeight="0.84"
              letterSpacing="-0.055em"
              textTransform="uppercase"
              color={K}
              style={{ marginLeft: "-4px" }}
            >
              CITY
            </Text>
            <Text
              fontSize={{ base: "76px", sm: "112px" }}
              fontWeight="900"
              lineHeight="0.84"
              letterSpacing="-0.055em"
              textTransform="uppercase"
              color={K}
              style={{ marginLeft: "-4px" }}
            >
              SIGNAL
            </Text>
          </Box>

          {/* RIGHT — ONE big poster, duotone, free-standing (no container) */}
          <Box
            flex="1"
            w={{ base: "100%", sm: "auto" }}
            minH={{ base: "380px", sm: "440px" }}
            position="relative"
            overflow="hidden"
            bg={K}
          >
            <PosterDuotone src={posters[0]} />
          </Box>
        </Flex>

        {/* Single CTA — primary only */}
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
          mt="auto"
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

        {/* BOTTOM strip — date + brand mark */}
        <Flex justify="space-between" align="flex-end" pt="3" borderTop={`2px solid ${K}`}>
          <Text
            fontSize={{ base: "26px", sm: "32px" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            color={K}
            lineHeight="1"
          >
            <Text as="span">{dd}.{mm}.</Text>
            <Text as="span" bg={B} color={W} px="1.5">{yy}</Text>
          </Text>
          <Text fontSize={{ base: "22px", sm: "28px" }} fontWeight="900" letterSpacing="-0.03em" lineHeight="1" color={K}>
            PIPE / RD{yy.slice(2)}
          </Text>
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
 * PosterDuotone — event poster cropped inside the BLUE ZONE,
 * rendered as a black + ultramarine duotone (grayscale + multiply).
 * Adds a small editorial caption strip at the top of the photo.
 */
function PosterDuotone({ src }: { src: string | undefined }) {
  if (!src) {
    // Fallback: plain blue block while feed is loading / offline
    return <Box position="absolute" inset="0" bg={B} />
  }
  return (
    <>
      <Box
        position="absolute"
        inset="0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "grayscale(1) contrast(1.18) brightness(0.95)",
        }}
      />
      {/* Multiply ultramarine over greyscale → black + blue duotone (Amsterdam-style) */}
      <Box position="absolute" inset="0" bg={B} style={{ mixBlendMode: "multiply" }} pointerEvents="none" />
      {/* Subtle white grain for risograph feel */}
      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        opacity={0.18}
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 0.5px, transparent 0.6px)",
          backgroundSize: "3px 3px",
          mixBlendMode: "screen",
        }}
      />
    </>
  )
}

/**
 * RadarWaves — concentric arcs emanating from a corner, with a subtle pulse animation.
 * Anchor point = bottom-right of the SVG viewBox (100, 100).
 */
function RadarWaves({ color }: { color: string }) {
  // Multiple arcs at increasing radii; alternating fill/stroke for visual rhythm.
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <style>{`
          .ping1 { animation: radar-pulse 4s ease-out infinite; }
          .ping2 { animation: radar-pulse 4s ease-out infinite; animation-delay: 0.9s; }
          .ping3 { animation: radar-pulse 4s ease-out infinite; animation-delay: 1.8s; }
          @keyframes radar-pulse {
            0%   { opacity: 0.0; transform: scale(0.55); }
            12%  { opacity: 1.0; }
            70%  { opacity: 0.4; }
            100% { opacity: 0.0; transform: scale(1.05); }
          }
          @media (prefers-reduced-motion: reduce) {
            .ping1, .ping2, .ping3 { animation: none; opacity: 0.7; }
          }
        `}</style>
      </defs>

      {/* Static ring (largest, faint) — establishes outer boundary */}
      <circle cx="100" cy="100" r="92" fill="none" stroke={color} strokeWidth="1.2" opacity="0.18" />

      {/* Pulsing rings — origin = bottom-right corner (100,100) */}
      <g style={{ transformOrigin: "100% 100%" }}>
        <circle className="ping3" cx="100" cy="100" r="80" fill="none" stroke={color} strokeWidth="1.6" />
        <circle className="ping2" cx="100" cy="100" r="60" fill="none" stroke={color} strokeWidth="2" />
        <circle className="ping1" cx="100" cy="100" r="38" fill="none" stroke={color} strokeWidth="2.5" />
      </g>

      {/* Solid epicenter quarter-disc */}
      <path d="M 100 100 L 100 78 A 22 22 0 0 1 78 100 Z" fill={color} />

      {/* Tiny inner dot — the "ping" itself */}
      <circle cx="92" cy="92" r="2.2" fill={color} />

      {/* Crosshair lines for radar-screen feel */}
      <line x1="20" y1="100" x2="100" y2="100" stroke={color} strokeWidth="0.6" opacity="0.35" />
      <line x1="100" y1="20" x2="100" y2="100" stroke={color} strokeWidth="0.6" opacity="0.35" />
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
