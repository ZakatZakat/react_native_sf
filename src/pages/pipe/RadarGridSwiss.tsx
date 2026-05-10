/**
 * Swiss / International Typographic Style grid for the new Radar onboarding.
 *
 * Design principles:
 * - Strict 2-column grid, equal cell aspect, no chaos tilt, no offset shadows.
 * - 1px hairline rules, mono editorial markers (№ 01, source counts).
 * - Helvetica-grotesk weight 900 for titles. Letter-spacing mostly 0 to slightly tight.
 * - Information hierarchy from size/weight, not from color tricks.
 * - Selected state = invert (white→black + ✓ stamp), no extra glow.
 * - Photography is strict crop (cover); no decorative parallax — Ken-Burns kept subtle.
 */

import { useEffect, useState } from "react"
import { Box, Flex, Grid, Text } from "@chakra-ui/react"
import { INTERESTS, type Interest } from "./preferences"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.5)"

export function RadarGridSwiss({
  picked,
  onToggle,
  interestImages,
}: {
  picked: Set<string>
  onToggle: (key: string) => void
  interestImages: Record<string, string[]>
}) {
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap="3" w="100%">
      {INTERESTS.map((interest, i) => (
        <SwissCard
          key={interest.key}
          interest={interest}
          index={i}
          active={picked.has(interest.key)}
          bgImages={interestImages[interest.key] ?? []}
          onToggle={() => onToggle(interest.key)}
        />
      ))}
    </Grid>
  )
}

function useRotator(images: string[], intervalMs: number, offsetMs: number) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (images.length < 2) return
    let cancelled = false
    const start = window.setTimeout(() => {
      if (cancelled) return
      setActive((i) => (i + 1) % images.length)
      const t = window.setInterval(() => {
        setActive((i) => (i + 1) % images.length)
      }, intervalMs)
      ;(start as unknown as { _interval?: number })._interval = t
    }, offsetMs)
    return () => {
      cancelled = true
      window.clearTimeout(start)
      const i = (start as unknown as { _interval?: number })._interval
      if (typeof i === "number") window.clearInterval(i)
    }
  }, [images, intervalMs, offsetMs])
  return active
}

function SwissCard({
  interest,
  index,
  active,
  bgImages,
  onToggle,
}: {
  interest: Interest
  index: number
  active: boolean
  bgImages: string[]
  onToggle: () => void
}) {
  const hasImages = bgImages.length > 0
  const activeIdx = useRotator(bgImages, 5500, (index % 6) * 700)
  const num = String(index + 1).padStart(2, "0")
  const keys = interest.keywords?.length ?? 0

  // Top zone (image / solid) takes 62% of the card, bottom zone is meta panel
  return (
    <Box
      as="button"
      onClick={onToggle}
      position="relative"
      w="100%"
      bg={active ? K : W}
      color={active ? W : K}
      border={`${active ? "3px" : "1.5px"} solid ${K}`}
      cursor="pointer"
      textAlign="left"
      overflow="hidden"
      transition="background 0.18s, color 0.18s, border-width 0.15s, transform 0.15s"
      _hover={{ transform: "translateY(-1px)" }}
      style={{
        aspectRatio: "1 / 1.35",
        fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
      }}
      display="flex"
      flexDirection="column"
    >
      {/* Top band — micro-meta (always present, runs across the photo) */}
      <Flex
        position="absolute"
        top="0"
        left="0"
        right="0"
        justify="space-between"
        align="center"
        px="2"
        py="1.5"
        zIndex={3}
        bg={active ? K : "transparent"}
      >
        <Text
          fontSize="9px"
          fontWeight="900"
          letterSpacing="0.28em"
          textTransform="uppercase"
          color={active ? W : W}
          style={{ textShadow: !active && hasImages ? "0 1px 4px rgba(0,0,0,0.6)" : undefined }}
        >
          № {num}
        </Text>
        <Text
          fontSize="9px"
          fontWeight="900"
          letterSpacing="0.28em"
          textTransform="uppercase"
          color={active ? W : W}
          style={{ textShadow: !active && hasImages ? "0 1px 4px rgba(0,0,0,0.6)" : undefined }}
        >
          {active ? "выбран" : "сигнал"}
        </Text>
      </Flex>

      {/* Image block (62% of height) */}
      <Box position="relative" flex="0 0 62%" minH="0" overflow="hidden">
        {hasImages ? (
          <>
            {bgImages.map((url, i) => (
              <Box
                key={url + i}
                position="absolute"
                inset="0"
                style={{
                  backgroundImage: `url(${url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: active ? "saturate(1) contrast(1.05)" : "saturate(0.55) contrast(1.05)",
                  opacity: i === activeIdx ? 1 : 0,
                  transition: "opacity 900ms ease-in-out, filter 0.25s",
                }}
                pointerEvents="none"
              />
            ))}
          </>
        ) : (
          <Box position="absolute" inset="0" bg={`${K}10`} />
        )}

        {/* Strong overlay on selected state to dim image */}
        {active && hasImages && (
          <Box position="absolute" inset="0" bg="rgba(13,13,13,0.55)" pointerEvents="none" />
        )}
        {/* Subtle bottom shadow for contrast against the white meta panel */}
        {!active && hasImages && (
          <Box
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            h="40%"
            bg="linear-gradient(to top, rgba(13,13,13,0.35), rgba(13,13,13,0))"
            pointerEvents="none"
          />
        )}

        {/* Big symbol watermark — bottom-right of image, semi-transparent */}
        <Box
          position="absolute"
          right="6px"
          bottom="2px"
          fontSize="68px"
          lineHeight="0.85"
          color={W}
          opacity={hasImages ? 0.85 : 0.18}
          style={{
            fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
            userSelect: "none",
            pointerEvents: "none",
            textShadow: hasImages ? "0 2px 10px rgba(0,0,0,0.5)" : undefined,
          }}
        >
          {interest.symbol}
        </Box>

        {/* ✓ stamp on selected */}
        {active && (
          <Box
            position="absolute"
            top="50%"
            left="50%"
            w="44px"
            h="44px"
            border={`3px solid ${W}`}
            color={W}
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="22px"
            fontWeight="900"
            lineHeight="1"
            style={{
              transform: "translate(-50%, -50%) rotate(-4deg)",
              boxShadow: `4px 4px 0 ${B}`,
            }}
          >
            ✓
          </Box>
        )}
      </Box>

      {/* Hairline divider */}
      <Box h="1.5px" bg={K} />

      {/* Bottom meta panel */}
      <Flex
        flex="1"
        minH="0"
        direction="column"
        justify="space-between"
        px="3"
        py="2.5"
        bg={active ? K : W}
        color={active ? W : K}
      >
        <Text
          fontSize="14px"
          fontWeight="900"
          lineHeight="1.02"
          letterSpacing="-0.02em"
          textTransform="uppercase"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {interest.label}
        </Text>

        <Flex align="center" justify="space-between" mt="2">
          <Flex align="center" gap="1.5">
            <Box w="14px" h="1.5px" bg={active ? W : K} />
            <Text
              fontSize="9px"
              fontWeight="900"
              letterSpacing="0.22em"
              textTransform="uppercase"
              color={active ? W : G}
            >
              {keys} {keys === 1 ? "ключ" : keys < 5 ? "ключа" : "ключей"}
            </Text>
          </Flex>
          <Text
            fontSize="14px"
            fontWeight="900"
            lineHeight="1"
            color={active ? W : K}
          >
            {active ? "✓" : "↗"}
          </Text>
        </Flex>
      </Flex>
    </Box>
  )
}
