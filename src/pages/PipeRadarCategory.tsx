/**
 * PipeRadarCategory — exhibition catalog of one art-direction.
 *
 * Visual: same museum/Bauhaus poster vibe as RadarGridMuseum.
 *  • Cream paper bg, ultramarine accent, hairline rules.
 *  • Each event card uses its poster image as the supergraphic,
 *    rendered as a black + ultramarine DUOTONE (grayscale + multiply).
 *  • Stretched display title, mono editorial markers.
 */

import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Box, Flex, Text, Image } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { INTERESTS, getInterests, setInterests } from "./pipe/preferences"
import { isImg, resolveMedia, type EventCard } from "./pipe/shared"
import { FloatingFeedCard } from "./pipe/FloatingFeedCard"
import { countBySubcat, matchSub, subCategoriesFor, type SubCategory } from "./pipe/subCategories"

// Unified with rest of the app — same K/W/B as PipeFeedSwipe etc.
const PAPER = "#FFFFFF"
const INK = "#0D0D0D"
const ULTRA = "#0055FF"
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

  // NEW: layout variant + active sub-category (for STRIP variant)
  type Variant = "panel" | "strip" | "sections"
  const [variant, setVariant] = useState<Variant>("panel")
  const [activeSub, setActiveSub] = useState<string>("all")

  const subCats = useMemo(() => subCategoriesFor(key), [key])
  const subCounts = useMemo(() => countBySubcat(feed, key), [feed, key])
  const filteredFeed = useMemo(() => {
    const sub = subCats.find((s) => s.key === activeSub) ?? subCats[0]
    return feed.filter((ev) => matchSub(ev, sub))
  }, [feed, subCats, activeSub])

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
              Section / Вариант
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
              ? `Нашли ${feed.length} ${plural(feed.length, "ивент", "ивента", "ивентов")} в этом варианте.`
              : "Сейчас пусто — ивентов пока нет. Зайди позже."}
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
            {isPicked ? "✓ ВЫБРАНО" : "+ ВЫБРАТЬ"}
          </Text>
          <Text fontSize="18px" fontWeight="900" lineHeight="1">→</Text>
        </Flex>

        {/* Variant toggle */}
        {feed.length > 0 && (
          <Flex border={`1.5px solid ${INK}`} alignSelf="flex-start" mt="2">
            {(["panel", "strip", "sections"] as Variant[]).map((v, i, arr) => {
              const isActive = variant === v
              const label =
                v === "panel" ? "Полотно / I"
                : v === "strip" ? "Лента / II"
                : "Секции / III"
              return (
                <Flex
                  key={v}
                  as="button"
                  onClick={() => setVariant(v)}
                  px="3"
                  py="1.5"
                  bg={isActive ? INK : PAPER}
                  color={isActive ? PAPER : INK}
                  fontSize="9px"
                  fontWeight="900"
                  letterSpacing="0.22em"
                  textTransform="uppercase"
                  cursor="pointer"
                  borderRight={i < arr.length - 1 ? `1.5px solid ${INK}` : undefined}
                  transition="background 0.12s, color 0.12s"
                >
                  {label}
                </Flex>
              )
            })}
          </Flex>
        )}

        {/* Catalog of events */}
        {loading ? (
          <Text mt="6" textAlign="center" color={INK_DIM} fontSize="11px" fontWeight="800" letterSpacing="0.22em" textTransform="uppercase">
            Загрузка…
          </Text>
        ) : error ? (
          <Text mt="6" textAlign="center" color={INK} fontSize="11px" fontWeight="800">{error}</Text>
        ) : feed.length === 0 ? (
          <EmptyState />
        ) : variant === "panel" ? (
          <PanelVariant
            subCats={subCats}
            counts={subCounts}
            activeSub={activeSub}
            onPickSub={setActiveSub}
            feed={filteredFeed}
            failedImgs={failedImgs}
            setFailedImgs={setFailedImgs}
            onSelectEvent={setSelected}
          />
        ) : variant === "strip" ? (
          <StripVariant
            subCats={subCats}
            counts={subCounts}
            activeSub={activeSub}
            onPickSub={setActiveSub}
            feed={filteredFeed}
            failedImgs={failedImgs}
            setFailedImgs={setFailedImgs}
            onSelectEvent={setSelected}
          />
        ) : (
          <SectionsVariant
            subCats={subCats}
            counts={subCounts}
            feed={feed}
            failedImgs={failedImgs}
            setFailedImgs={setFailedImgs}
            onSelectEvent={setSelected}
          />
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
        Пусто в этом варианте
      </Text>
      <Text fontSize="11px" fontWeight="700" color={INK_DIM} letterSpacing="0.06em" maxW="280px">
        Скоро будут ивенты — заходи позже.
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

/* ─────────────────────────────────────────────────────────── */
/* VARIANT I — STRIP                                           */
/* Horizontal sub-category pills + 2-col floating cards below */
/* ─────────────────────────────────────────────────────────── */

function StripVariant({
  subCats, counts, activeSub, onPickSub, feed,
  failedImgs, setFailedImgs, onSelectEvent,
}: {
  subCats: SubCategory[]
  counts: Map<string, number>
  activeSub: string
  onPickSub: (key: string) => void
  feed: FeedItem[]
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onSelectEvent: (ev: FeedItem) => void
}) {
  return (
    <>
      {/* Section break + ruler */}
      <Box mt="2">
        <Box h="2px" bg={INK} w="100%" />
        <Flex justify="space-between" align="center" mt="2">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
            Index / Подборки
          </Text>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
            {subCats.length} осей
          </Text>
        </Flex>
      </Box>

      {/* Horizontal scrollable strip of sub-cat pills */}
      <Box
        overflowX="auto"
        mx="-5"
        px="5"
        mt="3"
        pb="1"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <Flex gap="2" minW="max-content">
          {subCats.map((sc, i) => {
            const isActive = sc.key === activeSub
            const cnt = counts.get(sc.key) ?? 0
            const num = String(i + 1).padStart(2, "0")
            return (
              <Flex
                key={sc.key}
                as="button"
                onClick={() => onPickSub(sc.key)}
                direction="column"
                align="flex-start"
                justify="space-between"
                px="3"
                py="2"
                minW="120px"
                bg={isActive ? INK : PAPER}
                color={isActive ? PAPER : INK}
                border={`1.5px solid ${INK}`}
                cursor="pointer"
                transition="background 0.12s, color 0.12s, transform 0.12s"
                _hover={{ transform: "translateY(-1px)" }}
                style={{ flexShrink: 0 }}
              >
                <Flex align="center" gap="1.5">
                  <Box w="6px" h="6px" bg={isActive ? ULTRA : INK} />
                  <Text fontSize="9px" fontWeight="900" letterSpacing="0.28em" opacity={isActive ? 1 : 0.55}>
                    №{num}
                  </Text>
                </Flex>
                <Text
                  fontSize="14px"
                  fontWeight="900"
                  textTransform="uppercase"
                  letterSpacing="-0.02em"
                  lineHeight="1.05"
                  mt="1.5"
                  whiteSpace="nowrap"
                >
                  {sc.label}
                </Text>
                <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" opacity={0.55} mt="1.5">
                  {cnt} {cnt === 1 ? "ШТ" : "ШТ"}
                </Text>
              </Flex>
            )
          })}
        </Flex>
      </Box>

      {/* Active sub-cat marker */}
      <Flex align="center" gap="2" mt="4">
        <Box h="1.5px" w="40px" bg={INK} />
        <Text fontSize="11px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={INK}>
          {(subCats.find((s) => s.key === activeSub) ?? subCats[0]).label} · {feed.length}
        </Text>
        <Box h="1.5px" flex="1" bg={INK} opacity={0.2} />
      </Flex>

      {feed.length === 0 ? (
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
                onTap={() => onSelectEvent(ev)}
              />
            )
          })}
        </Box>
      )}
    </>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* VARIANT II — SECTIONS                                       */
/* Each non-empty sub-cat = its own chapter with Roman numeral */
/* ─────────────────────────────────────────────────────────── */

function SectionsVariant({
  subCats, counts, feed,
  failedImgs, setFailedImgs, onSelectEvent,
}: {
  subCats: SubCategory[]
  counts: Map<string, number>
  feed: FeedItem[]
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onSelectEvent: (ev: FeedItem) => void
}) {
  // Skip "Все" — it duplicates everything else
  const sections = subCats.filter((s) => s.key !== "all" && (counts.get(s.key) ?? 0) > 0)

  if (sections.length === 0) {
    // Fall back: no subdivisions hit, render flat
    return (
      <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" columnGap="4" rowGap="6" mt="4" pt="2" pb="6" overflow="visible">
        {feed.map((ev, i) => {
          const card: EventCard = {
            id: ev.id, title: ev.title, description: ev.description,
            channel: ev.channel, message_id: ev.message_id,
            event_time: ev.event_time, media_urls: ev.media_urls,
            created_at: ev.created_at,
          }
          return (
            <FloatingFeedCard key={ev.id} card={card} index={i}
              failedImgs={failedImgs} setFailedImgs={setFailedImgs}
              onTap={() => onSelectEvent(ev)}
            />
          )
        })}
      </Box>
    )
  }

  return (
    <Flex direction="column" gap="10" mt="4" pb="6">
      {sections.map((sc, i) => {
        const items = feed.filter((ev) => matchSub(ev, sc))
        if (items.length === 0) return null
        return (
          <Box key={sc.key}>
            <SectionHead index={i} label={sc.label} count={items.length} />
            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" columnGap="4" rowGap="6" mt="3" pt="2" overflow="visible">
              {items.map((ev, j) => {
                const card: EventCard = {
                  id: ev.id, title: ev.title, description: ev.description,
                  channel: ev.channel, message_id: ev.message_id,
                  event_time: ev.event_time, media_urls: ev.media_urls,
                  created_at: ev.created_at,
                }
                return (
                  <FloatingFeedCard key={ev.id} card={card} index={i * 7 + j}
                    failedImgs={failedImgs} setFailedImgs={setFailedImgs}
                    onTap={() => onSelectEvent(ev)}
                  />
                )
              })}
            </Box>
          </Box>
        )
      })}
    </Flex>
  )
}

function SectionHead({ index, label, count }: { index: number; label: string; count: number }) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][index] ?? String(index + 1)
  return (
    <Box position="relative">
      <Box h="2px" bg={INK} w="100%" />
      <Flex justify="space-between" align="flex-end" mt="2" mb="2">
        <Flex align="baseline" gap="3">
          <Text
            fontSize="48px"
            fontWeight="900"
            lineHeight="0.85"
            letterSpacing="-0.04em"
            color={ULTRA}
            style={{ fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif" }}
          >
            {roman}
          </Text>
          <Box>
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
              Section / Подборка
            </Text>
            <Text
              fontSize="22px"
              fontWeight="900"
              lineHeight="0.95"
              letterSpacing="-0.025em"
              textTransform="uppercase"
              color={INK}
              mt="1"
              style={{ whiteSpace: "nowrap" }}
            >
              {label}
            </Text>
          </Box>
        </Flex>
        <Box textAlign="right">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.28em" color={INK_DIM} textTransform="uppercase">
            EXHIBITS
          </Text>
          <Text fontSize="22px" fontWeight="900" letterSpacing="-0.03em" color={INK} lineHeight="1" mt="1">
            {String(count).padStart(2, "0")}
          </Text>
        </Box>
      </Flex>
      <Box h="1.5px" bg={INK} w="100%" opacity={0.3} />
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* VARIANT III — PANEL (журнальная полоса)                     */
/* Compact sub-cat micro-strip + huge HERO event poster        */
/* + dense vertical listing (newspaper-style row cards) below  */
/* ─────────────────────────────────────────────────────────── */

function PanelVariant({
  subCats, counts, activeSub, onPickSub, feed,
  failedImgs, setFailedImgs, onSelectEvent,
}: {
  subCats: SubCategory[]
  counts: Map<string, number>
  activeSub: string
  onPickSub: (key: string) => void
  feed: FeedItem[]
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onSelectEvent: (ev: FeedItem) => void
}) {
  const hero = feed[0]
  const rest = feed.slice(1)

  return (
    <Box mt="3">
      {/* Section ruler + label */}
      <Flex justify="space-between" align="end" mb="2">
        <Box>
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.32em" textTransform="uppercase" color={INK_DIM}>
            Index / Подборки
          </Text>
          <Text fontSize="20px" fontWeight="900" letterSpacing="-0.025em" color={INK} lineHeight="1" mt="1">
            Срезы по дате
          </Text>
        </Box>
        <Box textAlign="right">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.28em" textTransform="uppercase" color={INK_DIM}>
            Active
          </Text>
          <Text fontSize="22px" fontWeight="900" letterSpacing="-0.03em" color={ULTRA} lineHeight="1" mt="1" textTransform="uppercase">
            {(subCats.find((s) => s.key === activeSub) ?? subCats[0]).label}
          </Text>
        </Box>
      </Flex>
      <Box h="2px" bg={INK} mb="3" />

      {/* Editorial sub-cat chips — Bauhaus mini-posters, wrap to multiple rows */}
      <Box pb="3" display="grid" gridTemplateColumns="repeat(auto-fill, minmax(96px, 1fr))" gap="2">
        {subCats.map((sc, i) => {
          const isActive = sc.key === activeSub
          const cnt = counts.get(sc.key) ?? 0
          const idx = String(i + 1).padStart(2, "0")
          const layoutVariant = i % 3
          return (
            <SubcatChip
              key={sc.key}
              label={sc.label}
              count={cnt}
              idx={idx}
              isActive={isActive}
              layoutVariant={layoutVariant}
              onClick={() => onPickSub(sc.key)}
            />
          )
        })}
      </Box>

      {feed.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* HERO — full-width feature poster */}
          {hero && <PanelHero ev={hero} onSelect={() => onSelectEvent(hero)} failedImgs={failedImgs} setFailedImgs={setFailedImgs} />}

          {/* LISTING — editorial poster cards (mixed asymmetric layouts) */}
          {rest.length > 0 && (
            <Box mt="6">
              <Flex align="center" gap="2" mb="3">
                <Box w="40px" h="2px" bg={INK} />
                <Text fontSize="11px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={INK}>
                  Ещё афиш · {rest.length}
                </Text>
                <Box flex="1" h="2px" bg={INK} opacity={0.2} />
              </Flex>
              <Flex direction="column" gap="3">
                {rest.map((ev, i) => (
                  <PanelEditorialCard
                    key={ev.id}
                    ev={ev}
                    index={i}
                    onSelect={() => onSelectEvent(ev)}
                    failedImgs={failedImgs}
                    setFailedImgs={setFailedImgs}
                  />
                ))}
              </Flex>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

function PanelHero({ ev, onSelect, failedImgs, setFailedImgs }: {
  ev: FeedItem
  onSelect: () => void
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
}) {
  const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  const src = r && isImg(r) && !failedImgs[ev.id] ? r : null
  const date = ev.event_time
    ? new Date(ev.event_time).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "").toUpperCase()
    : ""
  const time = ev.event_time
    ? new Date(ev.event_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : ""
  const titleWords = (ev.title || "Событие").split(" ").slice(0, 5)
  const longest = Math.max(...titleWords.map((w) => w.length), 4)
  const titleSize = longest <= 4 ? "44px" : longest <= 6 ? "36px" : longest <= 8 ? "28px" : longest <= 10 ? "22px" : "20px"

  return (
    <Box
      as="button"
      onClick={onSelect}
      mt="4"
      w="100%"
      bg={PAPER}
      color={INK}
      border={`2.5px solid ${INK}`}
      cursor="pointer"
      textAlign="left"
      overflow="hidden"
      transition="transform 0.16s, box-shadow 0.16s"
      _hover={{ transform: "translate(-2px, -2px)", boxShadow: `5px 5px 0 ${ULTRA}` }}
      display="flex"
      flexDirection="column"
    >
      {/* Top markers */}
      <Flex justify="space-between" align="center" px="3" py="2" borderBottom={`1.5px solid ${INK}`} bg={PAPER}>
        <Flex align="center" gap="2">
          <Box w="8px" h="8px" bg={ULTRA} />
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.28em" textTransform="uppercase" color={INK}>
            FEATURE / N° 01
          </Text>
        </Flex>
        <Text fontSize="9px" fontWeight="900" letterSpacing="0.28em" textTransform="uppercase" color={INK}>
          {ev.channel.replace(/^@/, "").slice(0, 18)}
        </Text>
      </Flex>

      {/* Image */}
      {src && (
        <Box position="relative" w="100%" h="280px" overflow="hidden" borderBottom={`2px solid ${INK}`} bg={INK}>
          <Image
            src={src}
            alt=""
            position="absolute"
            inset="0"
            w="100%"
            h="100%"
            objectFit="cover"
            draggable={false}
            onError={() => setFailedImgs((p) => ({ ...p, [ev.id]: true }))}
          />
          {/* Date stamp top-right of image */}
          {(date || time) && (
            <Flex
              position="absolute"
              top="0"
              right="0"
              bg={ULTRA}
              color={PAPER}
              px="3"
              py="2"
              direction="column"
              align="flex-end"
              borderLeft={`2px solid ${INK}`}
              borderBottom={`2px solid ${INK}`}
            >
              {date && (
                <Text fontSize="14px" fontWeight="900" letterSpacing="-0.01em" lineHeight="1">
                  {date}
                </Text>
              )}
              {time && (
                <Text fontSize="10px" fontWeight="900" letterSpacing="0.16em" mt="0.5" opacity={0.85}>
                  {time}
                </Text>
              )}
            </Flex>
          )}
        </Box>
      )}

      {/* Title — bauhaus bold */}
      <Box px="3" py="3">
        {titleWords.map((word, i) => (
          <Text
            key={i}
            as="div"
            fontWeight="900"
            color={INK}
            textTransform="uppercase"
            style={{
              fontSize: titleSize,
              lineHeight: "0.96",
              letterSpacing: "-0.025em",
              whiteSpace: "nowrap",
              marginLeft: "-2px",
            }}
          >
            {word}
          </Text>
        ))}
        {/* Bottom row */}
        <Flex align="center" justify="space-between" mt="3" pt="2" borderTop={`1.5px solid ${INK}30`}>
          <Text fontSize="10px" fontWeight="800" letterSpacing="0.12em" textTransform="uppercase" color={INK_DIM}>
            Открыть афишу
          </Text>
          <Box w="26px" h="26px" border={`1.5px solid ${INK}`} display="flex" alignItems="center" justifyContent="center" fontSize="13px" fontWeight="900" lineHeight="1" bg={PAPER}>
            ↗
          </Box>
        </Flex>
      </Box>
    </Box>
  )
}


/* ─────────────────────────────────────────────────────────── */
/* PanelEditorialCard — asymmetric Bauhaus row poster          */
/* 3 layouts cycled by index for rhythm (no mid-word breaks).  */
/* ─────────────────────────────────────────────────────────── */

function PanelEditorialCard({ ev, index, onSelect, failedImgs, setFailedImgs }: {
  ev: FeedItem
  index: number
  onSelect: () => void
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
}) {
  const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const r = resolveMedia(m ?? null)
  const src = r && isImg(r) && !failedImgs[ev.id] ? r : null
  const date = ev.event_time
    ? new Date(ev.event_time).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "").toUpperCase()
    : ""
  const num = String(index + 2).padStart(2, "0")  // +2 because index 0 is hero
  const titleWords = (ev.title || "Событие").split(/\s+/).filter(Boolean).slice(0, 5)
  const longest = Math.max(...titleWords.map((w) => w.length), 4)

  // Cycle through 3 distinct layouts for visual rhythm
  const layoutIdx = index % 3
  const accent = index % 2 === 0 ? ULTRA : INK

  if (layoutIdx === 0) return (
    <LayoutImageLeft ev={ev} num={num} date={date} src={src} titleWords={titleWords} longest={longest}
      accent={accent} onSelect={onSelect} setFailedImgs={setFailedImgs} />
  )
  if (layoutIdx === 1) return (
    <LayoutTypeHero ev={ev} num={num} date={date} src={src} titleWords={titleWords} longest={longest}
      accent={accent} onSelect={onSelect} setFailedImgs={setFailedImgs} />
  )
  return (
    <LayoutImageRight ev={ev} num={num} date={date} src={src} titleWords={titleWords} longest={longest}
      accent={accent} onSelect={onSelect} setFailedImgs={setFailedImgs} />
  )
}

type LayoutProps = {
  ev: FeedItem
  num: string
  date: string
  src: string | null
  titleWords: string[]
  longest: number
  accent: string
  onSelect: () => void
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
}

function titleSizeFor(longest: number): string {
  if (longest <= 4) return "32px"
  if (longest <= 6) return "26px"
  if (longest <= 8) return "22px"
  if (longest <= 10) return "18px"
  if (longest <= 12) return "16px"
  return "14px"
}

/* Layout A — image LEFT, big right column with HUGE number anchor + title */
function LayoutImageLeft({ ev, num, date, src, titleWords, longest, accent, onSelect, setFailedImgs }: LayoutProps) {
  return (
    <Box
      as="button"
      onClick={onSelect}
      position="relative"
      w="100%"
      bg={PAPER}
      color={INK}
      border={`2px solid ${INK}`}
      boxShadow={`4px 5px 0 ${accent}`}
      cursor="pointer"
      textAlign="left"
      overflow="hidden"
      transition="transform 0.16s, box-shadow 0.16s"
      _hover={{ transform: "translate(-1px, -1px)", boxShadow: `5px 6px 0 ${accent}` }}
      style={{ minHeight: "152px" }}
    >
      <Flex h="100%" minH="152px">
        {/* Image */}
        <Box flexShrink={0} w="40%" maxW="160px" minW="120px" position="relative" bg={INK} borderRight={`2px solid ${INK}`}>
          {src ? (
            <Image
              src={src}
              alt=""
              position="absolute"
              inset="0"
              w="100%"
              h="100%"
              objectFit="cover"
              draggable={false}
              onError={() => setFailedImgs((p) => ({ ...p, [ev.id]: true }))}
            />
          ) : (
            <Box position="absolute" inset="0" bg={ULTRA} />
          )}
          {/* Date stamp on image */}
          {date && (
            <Box position="absolute" bottom="0" left="0" bg={ULTRA} color={PAPER} px="2" py="1" borderTop={`2px solid ${INK}`} borderRight={`2px solid ${INK}`}>
              <Text fontSize="11px" fontWeight="900" letterSpacing="-0.005em" lineHeight="1">
                {date}
              </Text>
            </Box>
          )}
        </Box>

        {/* Body */}
        <Box flex="1" minW="0" p="3" position="relative" display="flex" flexDirection="column" justifyContent="space-between">
          {/* Top row: channel mono */}
          <Flex justify="space-between" align="flex-start" gap="2" mb="1">
            <Text
              fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={ULTRA}
              minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
            >
              {ev.channel.replace(/^@/, "").slice(0, 18)}
            </Text>
            <Text fontSize="36px" fontWeight="900" letterSpacing="-0.04em" color={INK} lineHeight="0.8" mt="-2px">
              {num}
            </Text>
          </Flex>
          {/* Title */}
          <Box flex="1" mt="1">
            {titleWords.map((word, i) => (
              <Text
                key={i}
                as="div"
                fontWeight="900"
                color={INK}
                textTransform="uppercase"
                style={{
                  fontSize: titleSizeFor(longest),
                  lineHeight: "1.0",
                  letterSpacing: "-0.025em",
                  whiteSpace: "nowrap",
                  marginLeft: "-1px",
                }}
              >
                {word}
              </Text>
            ))}
          </Box>
          {/* Bottom marker */}
          <Flex align="center" justify="space-between" mt="2" pt="2" borderTop={`1.5px solid ${INK}20`}>
            <Box w="22px" h="2px" bg={INK} />
            <Text fontSize="14px" fontWeight="900" color={INK} lineHeight="1">↗</Text>
          </Flex>
        </Box>
      </Flex>
    </Box>
  )
}

/* Layout B — type HERO: massive number on left, image small in corner, title dominates */
function LayoutTypeHero({ ev, num, date, src, titleWords, longest, accent, onSelect, setFailedImgs }: LayoutProps) {
  return (
    <Box
      as="button"
      onClick={onSelect}
      position="relative"
      w="100%"
      bg={PAPER}
      color={INK}
      border={`2px solid ${INK}`}
      boxShadow={`4px 5px 0 ${accent}`}
      cursor="pointer"
      textAlign="left"
      overflow="hidden"
      transition="transform 0.16s, box-shadow 0.16s"
      _hover={{ transform: "translate(-1px, -1px)", boxShadow: `5px 6px 0 ${accent}` }}
      minH="160px"
      p="3"
    >
      {/* Header: channel + date */}
      <Flex justify="space-between" align="center" mb="2">
        <Flex align="center" gap="1.5">
          <Box w="6px" h="6px" bg={ULTRA} />
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={INK}>
            {ev.channel.replace(/^@/, "").slice(0, 18)}
          </Text>
        </Flex>
        {date && (
          <Box bg={INK} color={PAPER} px="1.5" py="0.5">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.16em" textTransform="uppercase">
              {date}
            </Text>
          </Box>
        )}
      </Flex>

      {/* Body: HUGE number on the left, title-block on the right */}
      <Flex align="flex-start" gap="3" mt="1">
        {/* Giant index */}
        <Box flexShrink={0} position="relative">
          <Text
            fontSize="84px"
            fontWeight="900"
            letterSpacing="-0.06em"
            lineHeight="0.82"
            color={INK}
          >
            {num}
          </Text>
          {/* Tiny accent square under the number */}
          <Box position="absolute" left="2px" bottom="-6px" w="20px" h="6px" bg={ULTRA} />
        </Box>

        {/* Title fill remaining width */}
        <Box flex="1" minW="0" mt="2">
          {titleWords.map((word, i) => (
            <Text
              key={i}
              as="div"
              fontWeight="900"
              color={INK}
              textTransform="uppercase"
              style={{
                fontSize: titleSizeFor(longest),
                lineHeight: "1.0",
                letterSpacing: "-0.025em",
                whiteSpace: "nowrap",
                marginLeft: "-1px",
              }}
            >
              {word}
            </Text>
          ))}
        </Box>
      </Flex>

      {/* Tiny image bottom-right as poster watermark */}
      {src && (
        <Box position="absolute" bottom="-1px" right="-1px" w="68px" h="68px" border={`2px solid ${INK}`} bg={INK} overflow="hidden">
          <Image src={src} alt="" w="100%" h="100%" objectFit="cover" onError={() => setFailedImgs((p) => ({ ...p, [ev.id]: true }))} />
        </Box>
      )}

      {/* Bottom-left arrow marker */}
      <Box position="absolute" bottom="6px" left="6px" w="22px" h="22px" border={`1.5px solid ${INK}`} bg={PAPER} display="flex" alignItems="center" justifyContent="center" fontSize="11px" fontWeight="900" lineHeight="1">
        ↗
      </Box>
    </Box>
  )
}

/* Layout C — image RIGHT vertical, content left, accent bar */
function LayoutImageRight({ ev, num, date, src, titleWords, longest, accent, onSelect, setFailedImgs }: LayoutProps) {
  return (
    <Box
      as="button"
      onClick={onSelect}
      position="relative"
      w="100%"
      bg={PAPER}
      color={INK}
      border={`2px solid ${INK}`}
      boxShadow={`4px 5px 0 ${accent}`}
      cursor="pointer"
      textAlign="left"
      overflow="hidden"
      transition="transform 0.16s, box-shadow 0.16s"
      _hover={{ transform: "translate(-1px, -1px)", boxShadow: `5px 6px 0 ${accent}` }}
      minH="160px"
    >
      <Flex h="100%" minH="160px">
        {/* Body left */}
        <Box flex="1" minW="0" p="3" position="relative" display="flex" flexDirection="column" justifyContent="space-between">
          <Flex align="center" gap="2" mb="1">
            <Text fontSize="44px" fontWeight="900" letterSpacing="-0.05em" color={ULTRA} lineHeight="0.8">
              {num}
            </Text>
            <Flex direction="column" gap="0.5" minW="0">
              <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={INK} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {ev.channel.replace(/^@/, "").slice(0, 16)}
              </Text>
              {date && (
                <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={INK_DIM}>
                  {date}
                </Text>
              )}
            </Flex>
          </Flex>
          {/* Title */}
          <Box flex="1" mt="2">
            {titleWords.map((word, i) => (
              <Text
                key={i}
                as="div"
                fontWeight="900"
                color={INK}
                textTransform="uppercase"
                style={{
                  fontSize: titleSizeFor(longest),
                  lineHeight: "1.0",
                  letterSpacing: "-0.025em",
                  whiteSpace: "nowrap",
                  marginLeft: "-1px",
                }}
              >
                {word}
              </Text>
            ))}
          </Box>
          <Flex align="center" gap="2" mt="2">
            <Box w="40px" h="2px" bg={INK} />
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.22em" textTransform="uppercase" color={INK_DIM}>
              Открыть →
            </Text>
          </Flex>
        </Box>

        {/* Image right */}
        <Box flexShrink={0} w="38%" maxW="150px" minW="115px" position="relative" bg={INK} borderLeft={`2px solid ${INK}`}>
          {src ? (
            <Image
              src={src}
              alt=""
              position="absolute"
              inset="0"
              w="100%"
              h="100%"
              objectFit="cover"
              onError={() => setFailedImgs((p) => ({ ...p, [ev.id]: true }))}
            />
          ) : (
            <Box position="absolute" inset="0" bg={ULTRA} />
          )}
          {/* Vertical ULTRAMARINE accent strip on the very right edge of the image */}
          <Box position="absolute" top="0" right="0" bottom="0" w="8px" bg={ULTRA} borderLeft={`2px solid ${INK}`} />
        </Box>
      </Flex>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* SubcatChip — Bauhaus mini-poster for the sub-cat strip      */
/* Three cycling layouts for visual rhythm.                    */
/* ─────────────────────────────────────────────────────────── */

function SubcatChip({
  label, count, idx, isActive, layoutVariant, onClick,
}: {
  label: string
  count: number
  idx: string
  isActive: boolean
  layoutVariant: number
  onClick: () => void
}) {
  const bg = isActive ? INK : PAPER
  const fg = isActive ? PAPER : INK
  // Auto-size label by length so it doesn't break out
  const labelSize = label.length <= 4 ? "16px" : label.length <= 6 ? "13px" : label.length <= 8 ? "11px" : "10px"
  const H_CHIP = 76

  // Layout A — Index top-left + label + count w/ blue dash bottom
  if (layoutVariant === 0) return (
    <Box
      as="button"
      onClick={onClick}
      w="100%"
      h={`${H_CHIP}px`}
      bg={bg}
      color={fg}
      border={`2px solid ${INK}`}
      boxShadow={isActive ? `3px 3px 0 ${ULTRA}` : `2px 2px 0 ${INK}40`}
      cursor="pointer"
      textAlign="left"
      position="relative"
      px="2"
      py="1.5"
      overflow="hidden"
      transition="transform 0.14s, box-shadow 0.14s, background 0.12s, color 0.12s"
      _hover={{ transform: "translate(-1px, -1px)", boxShadow: `3px 4px 0 ${INK}` }}
    >
      <Text fontSize="8px" fontWeight="900" letterSpacing="0.2em" lineHeight="1" opacity={isActive ? 0.7 : 0.55}>
        №{idx}
      </Text>
      <Text
        fontSize={labelSize}
        fontWeight="900"
        textTransform="uppercase"
        letterSpacing="-0.02em"
        lineHeight="1"
        mt="2"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
      >
        {label}
      </Text>
      <Flex position="absolute" bottom="5px" left="8px" right="8px" align="center" gap="1.5" justify="space-between">
        <Flex align="center" gap="1">
          <Box w="10px" h="2px" bg={ULTRA} />
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.16em">
            {count}
          </Text>
        </Flex>
        {isActive && <Box w="5px" h="5px" bg={ULTRA} />}
      </Flex>
    </Box>
  )

  // Layout B — Number left column + label right
  if (layoutVariant === 1) return (
    <Box
      as="button"
      onClick={onClick}
      w="100%"
      h={`${H_CHIP}px`}
      bg={bg}
      color={fg}
      border={`2px solid ${INK}`}
      boxShadow={isActive ? `3px 3px 0 ${ULTRA}` : `2px 2px 0 ${INK}40`}
      cursor="pointer"
      textAlign="left"
      position="relative"
      overflow="hidden"
      transition="transform 0.14s, box-shadow 0.14s, background 0.12s, color 0.12s"
      _hover={{ transform: "translate(-1px, -1px)", boxShadow: `3px 4px 0 ${INK}` }}
    >
      <Flex h="100%" align="stretch">
        <Flex
          direction="column"
          align="center"
          justify="center"
          flexShrink={0}
          w="32px"
          bg={isActive ? ULTRA : INK}
          color={PAPER}
          borderRight={`2px solid ${INK}`}
        >
          <Text fontSize="22px" fontWeight="900" letterSpacing="-0.04em" lineHeight="1">
            {idx}
          </Text>
        </Flex>
        <Flex direction="column" justify="space-between" flex="1" minW="0" px="2" py="1.5">
          <Text
            fontSize={labelSize}
            fontWeight="900"
            textTransform="uppercase"
            letterSpacing="-0.02em"
            lineHeight="1"
            mt="1"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
          >
            {label}
          </Text>
          <Flex align="center" gap="1">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" opacity={0.7}>
              {count}
            </Text>
            {isActive && <Box w="5px" h="5px" bg={ULTRA} />}
          </Flex>
        </Flex>
      </Flex>
    </Box>
  )

  // Layout C — Top-right blue square corner + bottom big count
  return (
    <Box
      as="button"
      onClick={onClick}
      w="100%"
      h={`${H_CHIP}px`}
      bg={bg}
      color={fg}
      border={`2px solid ${INK}`}
      boxShadow={isActive ? `3px 3px 0 ${ULTRA}` : `2px 2px 0 ${INK}40`}
      cursor="pointer"
      textAlign="left"
      position="relative"
      px="2"
      py="1.5"
      overflow="hidden"
      transition="transform 0.14s, box-shadow 0.14s, background 0.12s, color 0.12s"
      _hover={{ transform: "translate(-1px, -1px)", boxShadow: `3px 4px 0 ${INK}` }}
    >
      {/* Blue square corner accent */}
      <Box position="absolute" top="0" right="0" w="16px" h="16px" bg={ULTRA} borderLeft={`2px solid ${INK}`} borderBottom={`2px solid ${INK}`} />
      <Text fontSize="8px" fontWeight="900" letterSpacing="0.2em" lineHeight="1" opacity={isActive ? 0.7 : 0.55}>
        №{idx}
      </Text>
      <Text
        fontSize={labelSize}
        fontWeight="900"
        textTransform="uppercase"
        letterSpacing="-0.02em"
        lineHeight="1"
        mt="2"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
      >
        {label}
      </Text>
      <Flex position="absolute" bottom="5px" left="8px" right="8px" align="center" justify="space-between">
        <Text fontSize="18px" fontWeight="900" letterSpacing="-0.025em" lineHeight="1">
          {String(count).padStart(2, "0")}
        </Text>
        {isActive && (
          <Text fontSize="10px" fontWeight="900" lineHeight="1">
            ✓
          </Text>
        )}
      </Flex>
    </Box>
  )
}
