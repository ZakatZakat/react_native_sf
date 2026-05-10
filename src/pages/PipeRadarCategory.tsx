/**
 * PipeRadarCategory — exhibition catalog of one art-direction.
 *
 * Visual: same museum/Bauhaus poster vibe as RadarGridMuseum.
 *  • Cream paper bg, ultramarine accent, hairline rules.
 *  • Each event card uses its poster image as the supergraphic,
 *    rendered as a black + ultramarine DUOTONE (grayscale + multiply).
 *  • Stretched display title, mono editorial markers.
 */

import { useEffect, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Box, Flex, Text, Image } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { INTERESTS, getInterests, setInterests } from "./pipe/preferences"
import { isImg, resolveMedia, type EventCard } from "./pipe/shared"
import { FloatingFeedCard } from "./pipe/FloatingFeedCard"

const PAPER = "#F4EEE3"
const INK = "#0D0D0D"
const ULTRA = "#2042D8"
const INK_DIM = "rgba(13,13,13,0.55)"

export default function PipeRadarCategory() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { key?: string }
  const key = params.key ?? ""
  const interest = INTERESTS.find((i) => i.key === key) ?? null

  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(getInterests()))
  const isPicked = picked.has(key)
  const [selected, setSelected] = useState<FeedItem | null>(null)
  const [failedImgs, setFailedImgs] = useState<Record<string, true>>({})

  useEffect(() => {
    if (!key) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const f = await Curator.getFeed({ tags: [key], limit: 60 })
        if (cancelled) return
        setFeed(f.filter((x) => x.media_urls?.some(isImg)))
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [key])

  // Sync local picked from server on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const remote = await Curator.getInterests()
        if (cancelled || !Array.isArray(remote)) return
        setPicked(new Set(remote))
        setInterests(remote)
      } catch { /* */ }
    })()
    return () => { cancelled = true }
  }, [])

  const togglePick = async () => {
    const next = new Set(picked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    const arr = [...next]
    setPicked(next)
    setInterests(arr)
    try { await Curator.setInterests(arr) } catch { /* */ }
  }

  if (!interest) {
    return (
      <Box minH="100dvh" bg={PAPER} color={INK} p="6">
        <Text>Категория «{key}» не найдена.</Text>
      </Box>
    )
  }

  return (
    <Box
      minH="100dvh"
      bg={PAPER}
      color={INK}
      style={{
        fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <Flex maxW="430px" mx="auto" px="5" pt="4" pb="6" direction="column" gap="4">
        {/* Top editorial header */}
        <Flex align="center" justify="space-between">
          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-onboarding" })}
            align="center" gap="2"
            fontSize="10px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={INK}
            cursor="pointer" _hover={{ color: ULTRA }} transition="color 0.12s"
          >
            <Text fontSize="14px" lineHeight="1">←</Text> К сетке
          </Flex>
          <Text fontSize="10px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
            EXHIBIT N° {String((INTERESTS.findIndex((i) => i.key === key) + 1)).padStart(2, "0")}
          </Text>
        </Flex>

        {/* Hairline + section markers */}
        <Box>
          <Box h="2px" bg={INK} w="100%" />
          <Flex justify="space-between" align="center" mt="2">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
              Section / Сигнал
            </Text>
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
              {feed.length} в эфире
            </Text>
          </Flex>
        </Box>

        {/* Big stretched typography of the category — split by space, nowrap */}
        <Box position="relative" mt="2">
          {interest.label.split(" ").map((word, i) => (
            <Text
              key={i}
              as="div"
              fontWeight="900"
              color={INK}
              textTransform="uppercase"
              style={{
                fontSize: typoSizeFor(word.length),
                lineHeight: "0.86",
                letterSpacing: "-0.045em",
                whiteSpace: "nowrap",
                marginLeft: "-3px",
              }}
            >
              {word}
            </Text>
          ))}
          {/* small ultramarine accent — supergraphic mark for the category */}
          <Box position="absolute" right="-12px" top="-14px" w="80px" h="80px" pointerEvents="none">
            <CategoryMark colorIndex={INTERESTS.findIndex((i) => i.key === key)} />
          </Box>
        </Box>

        {/* Lede + actions */}
        <Box mt="1">
          <Text fontSize="13px" fontWeight="700" lineHeight="1.4" color={INK_DIM} maxW="320px">
            {feed.length > 0
              ? `Радар поймал ${feed.length} ${plural(feed.length, "событие", "события", "событий")} по этому сигналу.`
              : "Сейчас тихо — событий пока нет. Зайди позже."}
          </Text>
        </Box>

        {/* Toggle in radar */}
        <Flex
          as="button"
          onClick={togglePick}
          align="center"
          justify="space-between"
          mt="1"
          px="4"
          py="3.5"
          bg={isPicked ? ULTRA : INK}
          color={PAPER}
          border={`3px solid ${INK}`}
          cursor="pointer"
          _hover={{ bg: isPicked ? INK : ULTRA, borderColor: isPicked ? INK : ULTRA }}
          _active={{ transform: "translate(2px, 2px)" }}
          transition="all 0.14s cubic-bezier(0.22, 1, 0.36, 1)"
        >
          <Text fontSize="14px" fontWeight="900" letterSpacing="0.06em" textTransform="uppercase">
            {isPicked ? "✓ В РАДАРЕ" : "+ В РАДАР"}
          </Text>
          <Text fontSize="18px" fontWeight="900" lineHeight="1">→</Text>
        </Flex>

        {/* Catalog of events */}
        {loading ? (
          <Text mt="6" textAlign="center" color={INK_DIM} fontSize="11px" fontWeight="800" letterSpacing="0.22em" textTransform="uppercase">
            Загрузка…
          </Text>
        ) : error ? (
          <Text mt="6" textAlign="center" color={INK} fontSize="11px" fontWeight="800">{error}</Text>
        ) : feed.length === 0 ? (
          <EmptyState />
        ) : (
          <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" columnGap="4" rowGap="6" mt="4" pt="2" pb="6" overflow="visible">
            {feed.map((ev, i) => {
              const card: EventCard = {
                id: ev.id,
                title: ev.title,
                description: ev.description,
                channel: ev.channel,
                message_id: ev.message_id,
                event_time: ev.event_time,
                media_urls: ev.media_urls,
                created_at: ev.created_at,
              }
              return (
                <FloatingFeedCard
                  key={ev.id}
                  card={card}
                  index={i}
                  failedImgs={failedImgs}
                  setFailedImgs={setFailedImgs}
                  onTap={() => setSelected(ev)}
                />
              )
            })}
          </Box>
        )}
      </Flex>

      {/* Detail modal */}
      {selected && <EventDetailModal ev={selected} onClose={() => setSelected(null)} />}
    </Box>
  )
}

function typoSizeFor(longestWordLen: number): string {
  if (longestWordLen <= 4) return "72px"
  if (longestWordLen <= 5) return "60px"
  if (longestWordLen <= 6) return "52px"
  if (longestWordLen <= 8) return "40px"
  if (longestWordLen <= 10) return "30px"
  return "26px"
}

function plural(n: number, one: string, few: string, many: string): string {
  const m = n % 10
  const t = n % 100
  if (t >= 11 && t <= 19) return many
  if (m === 1) return one
  if (m >= 2 && m <= 4) return few
  return many
}

/* ─────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <Flex direction="column" align="center" gap="3" mt="10" textAlign="center">
      <Text fontSize="48px" lineHeight="1" color={ULTRA}>○</Text>
      <Text fontSize="13px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={INK}>
        Пусто на этом сигнале
      </Text>
      <Text fontSize="11px" fontWeight="700" color={INK_DIM} letterSpacing="0.06em" maxW="280px">
        Радар работает — заходи позже, может что-то поймает.
      </Text>
    </Flex>
  )
}

/* ─────────────────────────────────────────────────────────── */

function EventDetailModal({ ev, onClose }: { ev: FeedItem; onClose: () => void }) {
  const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  const src = r && isImg(r) ? r : null
  const dateStr = ev.event_time
    ? new Date(ev.event_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : ""

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <Box
      position="fixed" inset="0" zIndex={50}
      bg="rgba(13,13,13,0.45)"
      onClick={onClose}
      style={{ backdropFilter: "blur(2px)" }}
      display="flex"
      alignItems="flex-start"
      justifyContent="center"
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        maxW="min(92vw, 480px)"
        w="100%"
        bg={PAPER}
        color={INK}
        border={`2.5px solid ${INK}`}
        mx="auto"
        mt={{ base: "20", sm: "24" }}
        mb="6"
        style={{
          fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif",
          animation: "p5-dialog-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
          boxShadow: `5px 5px 0 ${ULTRA}`,
        }}
        maxH="80vh"
        overflow="auto"
      >
        <Flex justify="space-between" align="center" px="4" py="3" borderBottom={`1.5px solid ${INK}`}>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
            {ev.channel} {dateStr && `· ${dateStr}`}
          </Text>
          <Box as="button" onClick={onClose} w="28px" h="28px" border={`1.5px solid ${INK}`} display="flex" alignItems="center" justifyContent="center" cursor="pointer" fontSize="12px" fontWeight="900">
            ✕
          </Box>
        </Flex>
        {src && (
          <Box position="relative" h="280px" overflow="hidden" bg={INK}>
            <Image src={src} alt="" position="absolute" inset="0" w="100%" h="100%" objectFit="cover" style={{ filter: "grayscale(1) contrast(1.15)" }} />
            <Box position="absolute" inset="0" bg={ULTRA} style={{ mixBlendMode: "multiply" }} pointerEvents="none" />
          </Box>
        )}
        <Box px="4" py="4">
          <Text fontSize="22px" fontWeight="900" lineHeight="1.05" letterSpacing="-0.025em" textTransform="uppercase">
            {ev.title}
          </Text>
          <Text mt="3" fontSize="14px" lineHeight="1.5" color={INK} whiteSpace="pre-wrap">
            {ev.description}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */

function CategoryMark({ colorIndex }: { colorIndex: number }) {
  // Reuse one of the supergraphic shapes by index
  const idx = ((colorIndex % 12) + 12) % 12
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      {idx === 0 && <path d="M100 50 A 50 50 0 0 0 50 100 L 100 100 Z" fill={ULTRA} />}
      {idx === 1 && <polygon points="0,0 30,0 100,80 100,100 70,100 0,30" fill={ULTRA} />}
      {idx === 2 && <rect x="0" y="0" width="35" height="100" fill={ULTRA} />}
      {idx === 3 && <path d="M0 60 Q 25 20 50 60 T 100 60 L 100 100 L 0 100 Z" fill={ULTRA} />}
      {idx === 4 && <><circle cx="30" cy="35" r="22" fill={ULTRA} /><circle cx="72" cy="70" r="28" fill={ULTRA} /></>}
      {idx === 5 && <path d="M100 0 L 100 60 A 60 60 0 0 0 30 0 Z" fill={ULTRA} />}
      {idx === 6 && <polygon points="0,30 80,100 0,100" fill={ULTRA} />}
      {idx === 7 && <><rect x="0" y="40" width="100" height="20" fill={ULTRA} /><rect x="55" y="0" width="20" height="100" fill={ULTRA} /></>}
      {idx === 8 && <><circle cx="70" cy="40" r="40" fill={ULTRA} opacity="0.35" /><circle cx="70" cy="40" r="26" fill={ULTRA} opacity="0.6" /><circle cx="70" cy="40" r="14" fill={ULTRA} /></>}
      {idx === 9 && <polygon points="0,100 0,75 25,75 25,50 50,50 50,25 100,25 100,100" fill={ULTRA} />}
      {idx === 10 && <path d="M70 18 Q 100 30 90 60 Q 105 90 55 95 Q 15 95 14 65 Q 8 30 35 22 Q 50 8 70 18 Z" fill={ULTRA} />}
      {idx === 11 && <rect x="22" y="35" width="55" height="55" fill={ULTRA} transform="rotate(8, 50, 62)" />}
    </svg>
  )
}
