import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text, Grid } from "@chakra-ui/react"
import { INTERESTS, getInterests, scoreEvent, setInterests } from "./pipe/preferences"
import { API, isImg, resolveMedia, type EventCard } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.5)"

export default function PipeOnboarding() {
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Set<string>>(() => new Set(getInterests()))
  const [events, setEvents] = useState<EventCard[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API}/events?limit=300`, { cache: "no-store" })
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn("[onboarding] events fetch failed:", res.status)
          return
        }
        const all: EventCard[] = await res.json()
        if (cancelled) return
        const withImages = all.filter((ev) => ev.media_urls?.some(isImg))
        // eslint-disable-next-line no-console
        console.log("[onboarding] events loaded:", all.length, "with images:", withImages.length)
        setEvents(withImages)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[onboarding] events fetch error:", e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const interestImages = useMemo(() => {
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

    // Pass 1: keyword match — take best-scoring event per interest, harvest its images
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

    // Pass 2: fill remaining slots with any unused event
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

    // Pass 3: pad with deterministic Lorem Picsum fallbacks so each card has at least PER_INTEREST images
    for (const interest of INTERESTS) {
      let n = out[interest.key]?.length ?? 0
      while (n < PER_INTEREST) {
        out[interest.key]?.push(`https://picsum.photos/seed/${interest.key}-${n}/640/800`)
        n += 1
      }
    }

    return out
  }, [events])

  const toggle = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const finish = () => {
    setInterests([...picked])
    navigate({ to: "/pipe-feed-swipe" })
  }

  const skip = () => {
    setInterests([])
    navigate({ to: "/pipe-feed-swipe" })
  }

  const count = picked.size
  const canFinish = count > 0

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      position="relative"
      overflow="hidden"
      css={{ WebkitTapHighlightColor: "transparent" }}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <Box
        position="absolute"
        top="240px"
        left="-30%"
        right="-30%"
        h="240px"
        bg={`${B}10`}
        style={{ transform: "skewY(-8deg)" }}
        zIndex={0}
        pointerEvents="none"
      />

      <Flex
        maxW="430px"
        mx="auto"
        px="5"
        pt="4"
        pb="32"
        direction="column"
        align="stretch"
        position="relative"
        zIndex={1}
      >
        <Flex align="center" justify="space-between" mb="4">
          <Box
            bg={K}
            color={W}
            px="2.5"
            py="1"
            fontSize="10px"
            fontWeight="900"
            letterSpacing="0.18em"
            textTransform="uppercase"
          >
            Шаг 1 / 1
          </Box>
          <Flex
            as="button"
            onClick={skip}
            fontSize="10px"
            fontWeight="900"
            letterSpacing="0.16em"
            textTransform="uppercase"
            color={G}
            cursor="pointer"
            _hover={{ color: K }}
            transition="color 0.12s"
          >
            Пропустить →
          </Flex>
        </Flex>

        <Box pb="2">
          <Text
            fontSize="40px"
            fontWeight="900"
            lineHeight="0.9"
            letterSpacing="-0.04em"
            textTransform="uppercase"
            color={K}
          >
            Какое
          </Text>
          <Text
            fontSize="40px"
            fontWeight="900"
            lineHeight="0.9"
            letterSpacing="-0.04em"
            textTransform="uppercase"
            color={B}
            ml="6"
          >
            искусство?
          </Text>
        </Box>

        <Text
          mt="3"
          mb="6"
          fontSize="12px"
          fontWeight="700"
          letterSpacing="0.06em"
          color={G}
          maxW="320px"
        >
          Отметь то, что тебе интересно — поднимем такие события вверх ленты. Можно несколько.
        </Text>

        <Grid
          templateColumns="repeat(2, 1fr)"
          gap="3"
          autoRows="64px"
          autoFlow="dense"
        >
          {INTERESTS.map((interest, i) => (
            <RisingTile key={interest.key} index={i} layout={LAYOUTS[i]}>
              <InterestCard
                interest={interest}
                index={i}
                active={picked.has(interest.key)}
                bgImages={interestImages[interest.key] ?? []}
                onToggle={() => toggle(interest.key)}
              />
            </RisingTile>
          ))}
        </Grid>
      </Flex>

      <Flex
        position="fixed"
        left="0"
        right="0"
        bottom="0"
        bg={W}
        borderTop={`2.5px solid ${K}`}
        zIndex={5}
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        px="5"
        pt="3"
        justify="center"
      >
        <Flex maxW="430px" w="100%" align="center" gap="3">
          <Box flex="1">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" color={G} textTransform="uppercase">
              Выбрано
            </Text>
            <Text fontSize="22px" fontWeight="900" color={K} lineHeight="1" letterSpacing="-0.02em">
              {count} <Text as="span" fontSize="10px" color={G}>/ {INTERESTS.length}</Text>
            </Text>
          </Box>
          <Flex
            as="button"
            onClick={canFinish ? finish : undefined}
            aria-disabled={!canFinish}
            px="5"
            py="3"
            bg={canFinish ? B : `${B}40`}
            color={W}
            border={`2.5px solid ${K}`}
            boxShadow={canFinish ? `4px 4px 0 ${K}` : `2px 2px 0 ${K}30`}
            fontSize="11px"
            fontWeight="900"
            letterSpacing="0.18em"
            textTransform="uppercase"
            cursor={canFinish ? "pointer" : "not-allowed"}
            opacity={canFinish ? 1 : 0.6}
            pointerEvents={canFinish ? "auto" : "none"}
            _hover={canFinish ? { transform: "translate(-1px,-1px)", boxShadow: `5px 5px 0 ${K}` } : undefined}
            transition="all 0.12s"
            align="center"
            gap="2"
          >
            Готово
            <Text as="span" fontSize="13px">→</Text>
          </Flex>
        </Flex>
      </Flex>

    </Box>
  )
}

type Variant = "image" | "text" | "combo"
type Scheme = "dark" | "light" | "blue"

type Layout = { variant: Variant; scheme: Scheme; rowSpan: number; wide?: boolean }

// Hand-tuned bento rhythm: mix of image-hero, text-only, and combo cards
// rowSpan unit = 64px (autoRows). 4≈256, 5≈320, 6≈384.
const LAYOUTS: Layout[] = [
  { variant: "image", scheme: "dark", rowSpan: 6, wide: true },   // 0 Совр иск (large image hero, full width)
  { variant: "text",  scheme: "light", rowSpan: 3 },              // 1 Кино (text card)
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 2 Театр
  { variant: "combo", scheme: "blue", rowSpan: 5 },               // 3 Перформанс
  { variant: "text",  scheme: "dark", rowSpan: 3 },               // 4 Выставки
  { variant: "image", scheme: "dark", rowSpan: 5 },               // 5 Литература
  { variant: "text",  scheme: "blue", rowSpan: 3 },               // 6 Музыка
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 7 Танец
  { variant: "combo", scheme: "light", rowSpan: 5 },              // 8 Фотография
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 9 Архитектура
  { variant: "text",  scheme: "light", rowSpan: 3 },              // 10 Дизайн
  { variant: "image", scheme: "dark", rowSpan: 4 },               // 11 Лекции
]

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
        Направление
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
  interest,
  index,
  active,
  bgImages,
  onToggle,
}: {
  interest: import("./pipe/preferences").Interest
  index: number
  active: boolean
  bgImages: string[]
  onToggle: () => void
}) {
  const layout = LAYOUTS[index] ?? { variant: "image" as Variant, scheme: "dark" as Scheme, rowSpan: 4 }
  const { variant, scheme, rowSpan, wide } = layout

  const cardBg = scheme === "dark" ? K : scheme === "blue" ? B : W
  const cardFg = scheme === "light" ? K : W

  // Selected state shifts the visual: card border thickens to blue, lifts a bit,
  // image cards tint blue, text cards swap to blue bg + white text.
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
        <TextVariant interest={interest} index={index} active={active} fg={finalFg} bg={finalBg} />
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
  interest: import("./pipe/preferences").Interest
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

      {/* Bleeding symbol */}
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
  interest, index, active, fg, bg,
}: {
  interest: import("./pipe/preferences").Interest
  index: number
  active: boolean
  fg: string
  bg: string
}) {
  const dim = `${fg === W ? "rgba(255,255,255," : "rgba(13,13,13,"}`
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
            Категория
          </Text>
        </Flex>
      </Box>

      {/* Big symbol watermark bottom-right */}
      <Box
        position="absolute"
        right="-12px"
        bottom="-18px"
        fontSize="86px"
        lineHeight="0.85"
        color={fg}
        style={{
          fontFamily: "system-ui, sans-serif",
          userSelect: "none",
          pointerEvents: "none",
          opacity: 0.1,
        }}
      >
        {interest.symbol}
      </Box>
      {/* Avoid lint warning for `bg` and `dim` unused if extracted later */}
      <Box display="none" data-bg={bg} data-dim={dim} />
    </Box>
  )
}

function ComboVariant({
  interest, index, bgImages, active, fallbackBg, scheme,
}: {
  interest: import("./pipe/preferences").Interest
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
      {/* Image top */}
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
            {active && (
              <Box position="absolute" inset="0" bg="rgba(0,85,255,0.32)" pointerEvents="none" />
            )}
          </>
        ) : (
          <Box position="absolute" inset="0" bg={scheme === "light" ? `${B}18` : fallbackBg} />
        )}

        {/* Symbol bleeding from image into panel */}
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

      {/* Text panel bottom */}
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
  index,
  layout,
  children,
}: {
  index: number
  layout?: Layout
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)
  const wide = layout?.wide
  const rowSpan = layout?.rowSpan ?? 4

  // Reveal on enter viewport (one-shot)
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

  // Subtle parallax: slower for variant=image (heavier elements feel anchored),
  // a bit faster for text — gives layered depth on scroll
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
      // distance from viewport center; normalized roughly to [-1, 1]
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
      style={{
        animationDelay: revealed ? `${(index % 8) * 60}ms` : undefined,
      }}
    >
      {children}
    </Box>
  )
}
