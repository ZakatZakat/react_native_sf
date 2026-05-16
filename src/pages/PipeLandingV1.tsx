/**
 * PipeLandingV1 — Triptych landing.
 *
 * Three vertical columns of scrolling posters fill the page background
 * (down / up / down at different speeds). A white ink-bordered card with
 * the manifesto and "how it works" sits centered on top. Posters keep
 * scrolling above and below the card — hint of constant city motion.
 *
 * Port of /Users/askarembulatov/Downloads/landing-l6-triptych.jsx.
 */

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Curator } from "../lib/curator"
import { isImg, resolveMedia } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G55 = "rgba(13,13,13,0.55)"
const G70 = "rgba(13,13,13,0.70)"

/* ─────────────────────────────────────────────────────────── */
/* Tiny atoms                                                   */
/* ─────────────────────────────────────────────────────────── */

function Mark({ children, color = K }: { children: React.ReactNode; color?: string }) {
  return (
    <Text
      as="span"
      fontSize="9px"
      fontWeight="900"
      letterSpacing="0.22em"
      textTransform="uppercase"
      color={color}
      style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
    >
      {children}
    </Text>
  )
}

/** Duotone poster — blue/white duotone. Blue background + grayscale image
 *  with `mix-blend-mode: screen` so dark pixels become blue, light stay white. */
function DuotonePoster({ src }: { src: string | null }) {
  return (
    <Box
      position="relative"
      w="100%"
      flexShrink={0}
      bg={B}
      border={`1px solid ${K}`}
      overflow="hidden"
      style={{ aspectRatio: "1 / 1.32" }}
    >
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            mixBlendMode: "screen",
            filter: "grayscale(1) contrast(1.25) brightness(1.1)",
          }}
        />
      )}
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* Triptych column — vertical scrolling strip of posters        */
/* ─────────────────────────────────────────────────────────── */

function TriptychColumn({
  posters,
  durSec,
  dir,
  gapPx = 6,
  borderRight = true,
}: {
  posters: string[]
  durSec: number
  dir: "down" | "up"
  gapPx?: number
  borderRight?: boolean
}) {
  // Double the strip so the loop seems endless (we translate -50% ↔ 0%).
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
          <DuotonePoster key={`${p}-${i}`} src={p} />
        ))}
      </Box>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* Page                                                         */
/* ─────────────────────────────────────────────────────────── */

export default function PipeLandingV1() {
  const navigate = useNavigate()
  const [posters, setPosters] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const feed = await Curator.getFeed({ limit: 80 })
        if (cancelled) return
        const urls: string[] = []
        for (const ev of feed) {
          const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
          const r = resolveMedia(m ?? null)
          if (r && isImg(r) && !urls.includes(r)) urls.push(r)
          if (urls.length >= 16) break
        }
        setPosters(urls)
      } catch {
        /* offline ok — DuotonePoster falls back to solid colour */
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Need at least 8 distinct posters per column for the loop not to feel
  // repetitive. Pad with placeholders (null) up to 8 if we have fewer.
  const pool: string[] = posters.length > 0 ? posters : Array(8).fill("")
  const colA = pool.slice(0, Math.max(8, Math.ceil(pool.length / 3)))
  const colB = [...pool].reverse().slice(0, Math.max(8, Math.ceil(pool.length / 3)))
  const colC = pool.slice(Math.floor(pool.length / 2)).concat(pool.slice(0, Math.floor(pool.length / 2)))

  const goNext = () => navigate({ to: "/pipe-onboarding" })

  // Edition week-of-year (approx — just for the strip label)
  const now = new Date()
  const wk = String(
    Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7),
  ).padStart(2, "0")

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      position="relative"
      overflow="hidden"
      // Break out of any parent max-width container so the triptych truly
      // covers the full viewport.
      w="100vw"
      ml="calc((100% - 100vw) / 2)"
      style={{
        fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Triptych scroll keyframes */}
      <style>{`
        @keyframes cs-tri-down { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        @keyframes cs-tri-up   { from { transform: translateY(0); }     to { transform: translateY(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .cs-tri-strip { animation: none !important; }
        }
      `}</style>

      {/* Outer flex column — fills the full viewport. Header on top,
          stage flex-grows to the bottom; the fixed CTA simply overlaps
          the last 86px of the stage. */}
      <Flex
        direction="column"
        minH="100dvh"
        w="100%"
      >
        {/* Edition strip — flush against the stage, no margin */}
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

        {/* The triptych "stage" — fills remaining vertical space all the
            way to the viewport bottom (CTA overlays the last 86px). */}
        <Box
          position="relative"
          flex="1"
          minH="520px"
          overflow="hidden"
        >
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

          {/* fade top/bottom into white */}
          <Box
            position="absolute" top="0" left="0" right="0" h="40px"
            pointerEvents="none" zIndex={2}
            bgGradient={`linear(to-b, ${W}, transparent)`}
          />
          <Box
            position="absolute" bottom="86px" left="0" right="0" h="40px"
            pointerEvents="none" zIndex={2}
            bgGradient={`linear(to-t, ${W}, transparent)`}
          />

          {/* Centered overlay card with the manifesto */}
          <Box
            position="absolute"
            left={{ base: "10px", sm: "16px" }}
            right={{ base: "10px", sm: "16px" }}
            top={{ base: "72px", sm: "96px" }}
            bg={W}
            border={`2.5px solid ${K}`}
            zIndex={5}
            p="4"
            style={{
              boxShadow: `5px 5px 0 ${B}`,
              fontFamily: "'Helvetica Neue', sans-serif",
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
                    style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
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
                    style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
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
                  style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                >
                  ивентов / нед.
                </Text>
              </Flex>
            </Flex>
          </Box>

          {/* Bottom-of-stage labels — pinned above the fixed CTA so they stay visible */}
          <Flex
            position="absolute"
            left="0" right="0" bottom="94px"
            px="4.5"
            zIndex={3}
            justify="space-between"
            color={W}
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
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
      </Flex>

      {/* Sticky bottom CTA — "Шаг 1 / 4 — Войти в эту картинку →" */}
      <Flex
        as="button"
        onClick={goNext}
        position="fixed"
        left="0" right="0" bottom="0"
        bg={K}
        color={W}
        zIndex={30}
        align="center"
        justify="space-between"
        cursor="pointer"
        style={{
          paddingTop: "14px",
          paddingBottom: "max(18px, env(safe-area-inset-bottom))",
          paddingLeft: "18px",
          paddingRight: "18px",
          fontFamily: "'Helvetica Neue', sans-serif",
        }}
        _hover={{ bg: B }}
        _active={{ transform: "translateY(1px)" }}
        transition="background 0.14s"
      >
        <Box textAlign="left">
          <Mark color="rgba(255,255,255,0.5)">Шаг 1 / 4</Mark>
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
    </Box>
  )
}
