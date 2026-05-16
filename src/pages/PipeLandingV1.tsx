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

/** Duotone poster — canonical CitySignal recipe (from shared.jsx):
 *    white tile → grayscale image → BLUE OVERLAY with mix-blend-mode multiply
 *    @ 0.85 opacity → tiny riso dot overlay on top.
 *  When the image is still loading the tile shows blue (overlay over white). */
function DuotonePoster({ src }: { src: string | null }) {
  return (
    <Box
      position="relative"
      w="100%"
      flexShrink={0}
      bg={W}
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
            display: "block",
            filter: "grayscale(1) contrast(1.18) brightness(0.95)",
          }}
        />
      )}
      {/* Blue duotone overlay — multiplies onto the grayscale image */}
      <Box
        position="absolute"
        inset="0"
        bg={B}
        opacity={0.85}
        pointerEvents="none"
        style={{ mixBlendMode: "multiply" }}
      />
      {/* Riso dot overlay — fine grain on top */}
      <Box
        position="absolute"
        inset="0"
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

  // Build 3 column strips of EXACTLY equal length — different rotations of
  // the same base so each column scrolls different content but the looping
  // strip height is identical, which keeps the animation in sync and
  // guarantees every column is filled top-to-bottom from the first frame.
  const COL_LEN = 8
  const rotate = (arr: string[], n: number) => [...arr.slice(n), ...arr.slice(0, n)]
  const base: string[] = (() => {
    const src = posters.length > 0 ? posters : Array(COL_LEN).fill("")
    // pad by repeating to at least COL_LEN, then trim to exactly COL_LEN
    const padded = src.length >= COL_LEN ? src : [...src, ...src, ...src].slice(0, COL_LEN)
    return padded.slice(0, COL_LEN)
  })()
  const colA = base
  const colB = rotate(base, Math.floor(COL_LEN / 3)).reverse()
  const colC = rotate(base, Math.floor((COL_LEN * 2) / 3))

  const goNext = () => navigate({ to: "/pipe-onboarding" })

  // Edition week-of-year (approx — just for the strip label)
  const now = new Date()
  const wk = String(
    Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7),
  ).padStart(2, "0")

  return (
    <Box
      bg={W}
      color={K}
      // position:fixed pins us to the viewport regardless of any parent
      // Container's padding, and prevents the document from growing tall
      // enough to scroll past the CTA.
      position="fixed"
      top="0" left="0" right="0" bottom="0"
      overflow="hidden"
      style={{
        fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
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

      {/* Outer flex column — exactly viewport height. Strip + stage (flex 1)
          + CTA are all in flow, so the stage's bottom edge sits right at the
          CTA's top edge — and the bottom fade at `bottom: 0` of the stage
          renders cleanly just above the CTA, exactly like the JSX mockup. */}
      <Flex
        direction="column"
        h="100%"
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
          minH="0"
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

          {/* fade top/bottom into white — exact JSX recipe (40px, simple gradient) */}
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

          {/* Overlay card with the manifesto — sits in the upper third so the
              triptych below has room to breathe and the fade above blends into it. */}
          <Box
            position="absolute"
            left={{ base: "10px", sm: "16px" }}
            right={{ base: "10px", sm: "16px" }}
            top={{ base: "18%", sm: "20%" }}
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

          {/* Bottom-of-stage labels — sit at stage bottom edge, inside the fade */}
          <Flex
            position="absolute"
            left="0" right="0" bottom="8px"
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

      {/* Bottom CTA — sits in the Flex flow right below the stage so the
          stage's bottom edge (where the fade lives) butts directly against it. */}
      <Flex
        as="button"
        onClick={goNext}
        bg={K}
        color={W}
        align="center"
        justify="space-between"
        cursor="pointer"
        flexShrink={0}
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
      </Flex>
    </Box>
  )
}
