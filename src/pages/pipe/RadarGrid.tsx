/**
 * Reusable bento-style "radar" grid of art-direction cards.
 *
 * Used by both PipeOnboarding (new Swiss/brutalist 2-step flow)
 * and PipeOnboardingClassic (original single-step flow).
 *
 * Props:
 * - `picked`: Set of selected tag-keys
 * - `onToggle(key)`: handler for tap on a card
 * - `interestImages`: per-tag-key array of image URLs to show as background
 *   (rotated with crossfade); pass {} for solid-color fallback only.
 */

import { useEffect, useRef, useState } from "react"
import { Box, Flex, Grid, Text } from "@chakra-ui/react"
import { INTERESTS, type Interest } from "./preferences"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"

type Variant = "image" | "text" | "combo"
type Scheme = "dark" | "light" | "blue"

export type Layout = { variant: Variant; scheme: Scheme; rowSpan: number; wide?: boolean }

// Hand-tuned bento rhythm: mix of image-hero, text-only, and combo cards
// rowSpan unit = 64px (autoRows). 4≈256, 5≈320, 6≈384.
export const LAYOUTS: Layout[] = [
  { variant: "image", scheme: "dark", rowSpan: 6, wide: true },   // 0
  { variant: "text",  scheme: "light", rowSpan: 3 },              // 1
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 2
  { variant: "combo", scheme: "blue", rowSpan: 5 },               // 3
  { variant: "text",  scheme: "dark", rowSpan: 3 },               // 4
  { variant: "image", scheme: "dark", rowSpan: 5 },               // 5
  { variant: "text",  scheme: "blue", rowSpan: 3 },               // 6
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 7
  { variant: "combo", scheme: "light", rowSpan: 5 },              // 8
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 9
  { variant: "text",  scheme: "light", rowSpan: 3 },              // 10
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 11
]

export function RadarGrid({
  picked,
  onToggle,
  interestImages,
}: {
  picked: Set<string>
  onToggle: (key: string) => void
  interestImages: Record<string, string[]>
}) {
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap="3" autoRows="64px" autoFlow="dense">
      {INTERESTS.map((interest, i) => (
        <RisingTile key={interest.key} index={i} layout={LAYOUTS[i]}>
          <InterestCard
            interest={interest}
            index={i}
            active={picked.has(interest.key)}
            bgImages={interestImages[interest.key] ?? []}
            onToggle={() => onToggle(interest.key)}
          />
        </RisingTile>
      ))}
    </Grid>
  )
}

function CornerBadge({ active, fg }: { active: boolean; fg: string }) {
  return (
    <Box
      w="26px"
      h="26px"
      border={`2px solid ${active ? W : fg}`}
      bg={active ? W : "transparent"}
      color={active ? K : fg}
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontSize="14px"
      fontWeight="900"
      lineHeight="1"
      flexShrink={0}
      style={{
        transform: active ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), background 0.15s, color 0.15s",
      }}
    >
      {active ? "✓" : "↗"}
    </Box>
  )
}

function TopLabel({ index, fg, muted }: { index: number; fg: string; muted: boolean }) {
  return (
    <Box minW="0">
      <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={fg} opacity={muted ? 0.55 : 0.75} lineHeight="1.2">
        № {String(index + 1).padStart(2, "0")}
      </Text>
      <Text fontSize="9px" fontWeight="700" letterSpacing="0.16em" textTransform="uppercase" color={fg} opacity={muted ? 0.4 : 0.6} lineHeight="1.2">
        Сигнал
      </Text>
    </Box>
  )
}

function useRotator(images: string[], intervalMs: number, offsetMs: number) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (images.length < 2) return
    let cancelled = false
    const startTimeout = window.setTimeout(() => {
      if (cancelled) return
      setActive((i) => (i + 1) % images.length)
      const t = window.setInterval(() => {
        setActive((i) => (i + 1) % images.length)
      }, intervalMs)
      ;(startTimeout as unknown as { _intervalId: number })._intervalId = t
    }, offsetMs)
    return () => {
      cancelled = true
      window.clearTimeout(startTimeout)
      const i = (startTimeout as unknown as { _intervalId?: number })._intervalId
      if (typeof i === "number") window.clearInterval(i)
    }
  }, [images, intervalMs, offsetMs])
  return active
}

function InterestCard({
  interest, index, active, bgImages, onToggle,
}: {
  interest: Interest
  index: number
  active: boolean
  bgImages: string[]
  onToggle: () => void
}) {
  const layout = LAYOUTS[index] ?? { variant: "image" as Variant, scheme: "dark" as Scheme, rowSpan: 4 }
  const { variant, scheme } = layout

  const cardBg = scheme === "dark" ? K : scheme === "blue" ? B : W
  const cardFg = scheme === "light" ? K : W

  const finalBg = active && variant === "text" ? B : cardBg
  const finalFg = active && variant === "text" ? W : cardFg
  const borderColor = active ? B : K
  const borderWidth = active ? "3px" : "2.5px"
  const shadow = active ? `5px 6px 0 ${B}, 0 0 0 2px ${K}` : `3px 4px 0 ${K}`

  return (
    <Box
      as="button"
      onClick={onToggle}
      position="relative"
      w="100%"
      h="100%"
      border={`${borderWidth} solid ${borderColor}`}
      bg={finalBg}
      color={finalFg}
      boxShadow={shadow}
      cursor="pointer"
      textAlign="left"
      overflow="hidden"
      _hover={{ transform: "translate(-1px, -1px)", boxShadow: active ? `7px 8px 0 ${B}, 0 0 0 2px ${K}` : `5px 6px 0 ${K}` }}
      style={{
        transition: "transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.15s, background 0.15s, border-color 0.15s",
      }}
      display="flex"
      flexDirection="column"
    >
      {variant === "image" && (
        <ImageVariant interest={interest} index={index} bgImages={bgImages} active={active} fallbackBg={cardBg} fallbackFg={cardFg} />
      )}
      {variant === "text" && (
        <TextVariant interest={interest} index={index} active={active} fg={finalFg} />
      )}
      {variant === "combo" && (
        <ComboVariant interest={interest} index={index} bgImages={bgImages} active={active} fallbackBg={cardBg} scheme={scheme} />
      )}
    </Box>
  )
}

function ImageVariant({
  interest, index, bgImages, active, fallbackBg, fallbackFg,
}: {
  interest: Interest
  index: number
  bgImages: string[]
  active: boolean
  fallbackBg: string
  fallbackFg: string
}) {
  const hasImages = bgImages.length > 0
  const activeIdx = useRotator(bgImages, 4500, (index % 6) * 700)
  const overlay = active
    ? `linear-gradient(180deg, rgba(0,85,255,0.5) 0%, rgba(0,85,255,0.7) 100%), linear-gradient(180deg, rgba(13,13,13,0.3) 0%, rgba(13,13,13,0.85) 100%)`
    : `linear-gradient(180deg, rgba(13,13,13,0.15) 0%, rgba(13,13,13,0.45) 55%, rgba(13,13,13,0.92) 100%)`

  return (
    <Box position="relative" w="100%" h="100%" overflow="hidden">
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
                filter: active ? "saturate(1.2) contrast(1.05)" : "saturate(0.9)",
                opacity: i === activeIdx ? 1 : 0,
                transform: i === activeIdx ? "scale(1)" : "scale(1.04)",
                transition: "opacity 900ms ease-in-out, transform 6s linear, filter 0.2s",
              }}
              pointerEvents="none"
            />
          ))}
          <Box position="absolute" inset="0" style={{ backgroundImage: overlay }} pointerEvents="none" />
        </>
      ) : (
        <Box position="absolute" inset="0" bg={fallbackBg} />
      )}

      <Box
        position="absolute"
        right="-22px"
        top="40%"
        fontSize="160px"
        lineHeight="0.85"
        color={hasImages ? "rgba(255,255,255,0.9)" : fallbackFg}
        opacity={hasImages ? 0.9 : 0.18}
        style={{
          fontFamily: "system-ui, sans-serif",
          userSelect: "none",
          pointerEvents: "none",
          textShadow: hasImages ? "0 4px 18px rgba(0,0,0,0.5)" : undefined,
          mixBlendMode: hasImages && !active ? "overlay" : undefined,
        }}
      >
        {interest.symbol}
      </Box>

      <Flex position="absolute" top="10px" left="12px" right="12px" justify="space-between" align="flex-start" zIndex={2}>
        <TopLabel index={index} fg={W} muted />
        <CornerBadge active={active} fg={W} />
      </Flex>

      <Box position="absolute" bottom="12px" left="12px" right="12px" zIndex={2}>
        <Text
          fontSize="22px"
          fontWeight="900"
          lineHeight="0.98"
          letterSpacing="-0.025em"
          color={W}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >
          {interest.label}
        </Text>
      </Box>
    </Box>
  )
}

function TextVariant({
  interest, index, active, fg,
}: {
  interest: Interest
  index: number
  active: boolean
  fg: string
}) {
  return (
    <Box position="relative" w="100%" h="100%" p="3" display="flex" flexDirection="column" justifyContent="space-between">
      <Flex justify="space-between" align="flex-start">
        <TopLabel index={index} fg={fg} muted={false} />
        <CornerBadge active={active} fg={fg} />
      </Flex>

      <Box>
        <Text
          fontSize="28px"
          fontWeight="900"
          lineHeight="0.95"
          letterSpacing="-0.03em"
          color={fg}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {interest.label}
        </Text>
        <Flex align="center" gap="2" mt="2">
          <Box w="22px" h="2px" bg={fg} opacity={0.7} />
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" color={fg} opacity={0.6} textTransform="uppercase">
            Сигнал
          </Text>
        </Flex>
      </Box>

      <Box
        position="absolute"
        right="-12px"
        bottom="-18px"
        fontSize="86px"
        lineHeight="0.85"
        color={fg}
        style={{ fontFamily: "system-ui, sans-serif", userSelect: "none", pointerEvents: "none", opacity: 0.1 }}
      >
        {interest.symbol}
      </Box>
    </Box>
  )
}

function ComboVariant({
  interest, index, bgImages, active, fallbackBg, scheme,
}: {
  interest: Interest
  index: number
  bgImages: string[]
  active: boolean
  fallbackBg: string
  scheme: Scheme
}) {
  const hasImages = bgImages.length > 0
  const activeIdx = useRotator(bgImages, 5500, (index % 6) * 700 + 350)
  const panelBg = active ? B : W
  const panelFg = active ? W : K
  return (
    <Flex direction="column" w="100%" h="100%">
      <Box position="relative" flex="1.6" minH="0" borderBottom={`2px solid ${K}`} overflow="hidden">
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
                  filter: active ? "saturate(1.2)" : "saturate(0.9)",
                  opacity: i === activeIdx ? 1 : 0,
                  transform: i === activeIdx ? "scale(1)" : "scale(1.05)",
                  transition: "opacity 900ms ease-in-out, transform 7s linear, filter 0.2s",
                }}
                pointerEvents="none"
              />
            ))}
            {active && <Box position="absolute" inset="0" bg="rgba(0,85,255,0.32)" pointerEvents="none" />}
          </>
        ) : (
          <Box position="absolute" inset="0" bg={scheme === "light" ? `${B}18` : fallbackBg} />
        )}

        <Box
          position="absolute"
          right="-14px"
          bottom="-30px"
          fontSize="100px"
          lineHeight="0.85"
          color={hasImages ? W : K}
          opacity={hasImages ? 0.9 : 0.18}
          style={{
            fontFamily: "system-ui, sans-serif",
            userSelect: "none",
            pointerEvents: "none",
            textShadow: hasImages ? "0 3px 14px rgba(0,0,0,0.5)" : undefined,
          }}
        >
          {interest.symbol}
        </Box>

        <Flex position="absolute" top="10px" left="12px" right="12px" justify="space-between" align="flex-start" zIndex={2}>
          <TopLabel index={index} fg={W} muted />
          <CornerBadge active={active} fg={W} />
        </Flex>
      </Box>

      <Box flex="1" minH="0" bg={panelBg} color={panelFg} px="3" py="2.5" display="flex" alignItems="center">
        <Text
          fontSize="18px"
          fontWeight="900"
          lineHeight="0.98"
          letterSpacing="-0.02em"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {interest.label}
        </Text>
      </Box>
    </Flex>
  )
}

function RisingTile({
  index, layout, children,
}: {
  index: number
  layout?: Layout
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)
  const wide = layout?.wide
  const rowSpan = layout?.rowSpan ?? 4

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e?.isIntersecting) {
          setRevealed(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const variant = layout?.variant ?? "image"
    const factor = variant === "image" ? -0.06 : variant === "combo" ? -0.04 : 0.05
    let raf = 0
    let pending = false

    const update = () => {
      pending = false
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const center = rect.top + rect.height / 2
      const delta = (center - vh / 2)
      const offset = delta * factor
      el.style.setProperty("--p5-parallax", `${offset.toFixed(2)}px`)
    }

    const onScroll = () => {
      if (pending) return
      pending = true
      raf = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [layout?.variant])

  return (
    <Box
      ref={ref}
      className={`p5-rise p5-parallax ${revealed ? "p5-rise-in" : ""}`}
      gridColumn={wide ? "span 2" : undefined}
      gridRow={`span ${rowSpan}`}
      style={{ animationDelay: revealed ? `${(index % 8) * 60}ms` : undefined }}
    >
      {children}
    </Box>
  )
}

/* ── Image preloader (shared) ──────────────────────────────────── */
import type { EventCard } from "./shared"
import { isImg, resolveMedia } from "./shared"
import { scoreEvent } from "./preferences"

export function buildInterestImages(events: EventCard[]): Record<string, string[]> {
  const PER_INTEREST = 3
  const out: Record<string, string[]> = {}
  INTERESTS.forEach((i) => (out[i.key] = []))

  const pickUrls = (ev: EventCard): string[] => {
    const urls: string[] = []
    for (const m of ev.media_urls ?? []) {
      if (!isImg(m)) continue
      const r = resolveMedia(m)
      if (r && isImg(r)) urls.push(r)
    }
    return urls
  }

  const used = new Set<string>()

  for (const interest of INTERESTS) {
    const scored = events
      .filter((ev) => !used.has(ev.id))
      .map((ev) => ({ ev, s: scoreEvent(ev, [interest.key]) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
    for (const { ev } of scored) {
      if ((out[interest.key]?.length ?? 0) >= PER_INTEREST) break
      const urls = pickUrls(ev)
      if (urls.length === 0) continue
      out[interest.key]?.push(...urls.slice(0, PER_INTEREST - (out[interest.key]?.length ?? 0)))
      used.add(ev.id)
    }
  }

  let cursor = 0
  for (const interest of INTERESTS) {
    while ((out[interest.key]?.length ?? 0) < PER_INTEREST && cursor < events.length) {
      const ev = events[cursor++]
      if (!ev || used.has(ev.id)) continue
      const urls = pickUrls(ev)
      if (urls.length === 0) continue
      out[interest.key]?.push(urls[0]!)
      used.add(ev.id)
    }
  }

  for (const interest of INTERESTS) {
    let n = out[interest.key]?.length ?? 0
    while (n < PER_INTEREST) {
      out[interest.key]?.push(`https://picsum.photos/seed/${interest.key}-${n}/640/800`)
      n += 1
    }
  }

  return out
}
