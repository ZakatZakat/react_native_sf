import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Box, Flex, Stack, Text, Image, Dialog, Portal } from "@chakra-ui/react"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  message_id: number
  event_time?: string | null
  media_urls?: string[]
  created_at: string
}

type Filter = { key: string; label: string; keywords: string[] }

const FILTERS: Filter[] = [
  { key: "all", label: "Все", keywords: [] },
  { key: "concerts", label: "Концерты", keywords: ["концерт", "gig", "live", "выступ", "музы"] },
  { key: "theatre", label: "Театр", keywords: ["театр", "спектакл", "пьеса", "постановк"] },
  { key: "party", label: "Вечеринки", keywords: ["вечерин", "rave", "dj", "техно", "house"] },
  { key: "exhibition", label: "Выставки", keywords: ["выстав", "экспоз", "галере", "арт", "art"] },
  { key: "lecture", label: "Лекции", keywords: ["лекц", "talk", "meetup", "воркшоп", "workshop"] },
]

function isImg(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
}

function resolveMedia(media: string | undefined): string | null {
  if (!media) return null
  if (media.startsWith("http")) return media
  try {
    const base = new URL(API)
    return media.startsWith("/") ? `${base.origin}${media}` : `${API}/${media}`
  } catch {
    return media
  }
}

function firstLine(text: string | null | undefined): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
}

function matchFilter(ev: EventCard, f: Filter): boolean {
  if (f.key === "all") return true
  const t = `${ev.title ?? ""}\n${ev.description ?? ""}\n${ev.channel}`.toLowerCase()
  return f.keywords.some((k) => t.includes(k))
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "")
  } catch {
    return ""
  }
}

function useScrollReveal() {
  const observer = useRef<IntersectionObserver | null>(null)
  const register = useCallback((el: HTMLElement | null, idx: number) => {
    if (!el) return
    el.dataset.cardIdx = String(idx)
    el.classList.add("p5-reveal")
    if (!observer.current) {
      observer.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement
              const i = parseInt(target.dataset.cardIdx ?? "0", 10)
              const dir = i % 2 === 0 ? "p5-visible-left" : "p5-visible-right"
              target.style.animationDelay = `${i * 0.08}s`
              target.classList.add(dir)
              observer.current?.unobserve(target)
            }
          })
        },
        { threshold: 0.15 },
      )
    }
    observer.current.observe(el)
  }, [])

  useEffect(() => {
    return () => { observer.current?.disconnect() }
  }, [])

  return register
}

function PageWipe() {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 900)
    return () => clearTimeout(t)
  }, [])
  if (done) return null
  return (
    <Box position="fixed" inset="0" zIndex={100} pointerEvents="none" overflow="hidden">
      <Box
        position="absolute" inset="-20% -40%"
        bg={B}
        style={{ animation: "p5-wipe 0.8s cubic-bezier(0.77, 0, 0.175, 1) forwards" }}
      />
      <Box
        position="absolute" inset="-20% -40%"
        bg={K}
        style={{ animation: "p5-wipe-black 0.8s cubic-bezier(0.77, 0, 0.175, 1) 0.08s forwards" }}
      />
    </Box>
  )
}

export default function OpusFeed() {
  const [items, setItems] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState("all")
  const [failedImgs, setFailedImgs] = useState<Record<string, true>>({})
  const [selected, setSelected] = useState<EventCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [filterKey, setFilterKey] = useState(0)

  const reveal = useScrollReveal()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/events?limit=30`, { cache: "no-store" })
      if (res.ok) setItems(await res.json())
    } catch { /* */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === activeFilter) ?? FILTERS[0]
    return items.filter((e) => matchFilter(e, f))
  }, [items, activeFilter])

  const handleFilter = useCallback((key: string) => {
    setActiveFilter(key)
    setFilterKey((k) => k + 1)
  }, [])

  const openDetail = useCallback((card: EventCard) => {
    setSelected(card)
    setDetailOpen(true)
  }, [])

  const selTitle = useMemo(() => {
    if (!selected) return ""
    return firstLine(selected.title) || firstLine(selected.description) || "Событие"
  }, [selected])

  const selImg = useMemo(() => {
    if (!selected) return null
    const m = selected.media_urls?.find(isImg) ?? selected.media_urls?.[0]
    const r = resolveMedia(m)
    return r && isImg(r) ? r : null
  }, [selected])

  return (
    <Box minH="100dvh" bg={W} color={K} position="relative">
      <PageWipe />

      <Stack maxW="430px" mx="auto" px="5" pt="8" pb="20" gap="0">

        {/* HEADER */}
        <Flex
          align="center" justify="space-between" pb="6"
          className="p5-drop" style={{ animationDelay: "0.3s" }}
        >
          <Flex align="center" gap="3">
            <Box w="28px" h="28px" borderRadius="full" bg={B} />
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.25em" textTransform="uppercase">
              Opus
            </Text>
          </Flex>
          <Flex
            as="button"
            onClick={load}
            px="3" py="1.5"
            border={`2px solid ${K}`}
            fontSize="10px" fontWeight="800" letterSpacing="0.12em" textTransform="uppercase"
            cursor="pointer" _hover={{ bg: K, color: W }} transition="all 0.15s"
          >
            {loading ? "..." : "Обновить"}
          </Flex>
        </Flex>

        {/* TITLE */}
        <Text
          fontSize="36px" fontWeight="900" lineHeight="0.92"
          letterSpacing="-0.03em" textTransform="uppercase" pb="6"
          className="p5-drop" style={{ animationDelay: "0.45s" }}
        >
          Лента
          <Text as="span" color={B}> событий</Text>
        </Text>

        {/* FILTERS */}
        <Box pb="6" className="p5-drop" style={{ animationDelay: "0.55s" }}>
          <Box h="1px" bg={`${K}12`} mb="4" />
          <Flex gap="0" flexWrap="wrap">
            {FILTERS.map((f, i) => (
              <Flex
                key={f.key}
                onClick={() => handleFilter(f.key)}
                cursor="pointer"
                px="3" py="1.5"
                border={`2px solid ${f.key === activeFilter ? K : `${K}12`}`}
                bg={f.key === activeFilter ? K : "transparent"}
                color={f.key === activeFilter ? W : K}
                fontSize="10px" fontWeight="800"
                letterSpacing="0.12em" textTransform="uppercase"
                transition="all 0.15s"
                mr="-2px" mb="-2px"
                className={f.key === activeFilter ? "p5-tab-pop" : undefined}
              >
                {f.label}
              </Flex>
            ))}
          </Flex>
          <Box h="1px" bg={`${K}12`} mt="4" />
        </Box>

        {/* COUNT */}
        <Text
          fontSize="10px" fontWeight="700" letterSpacing="0.15em"
          textTransform="uppercase" color={G} pb="4"
          className="p5-drop" style={{ animationDelay: "0.6s" }}
        >
          {filtered.length} {filtered.length === 1 ? "событие" : "событий"}
        </Text>

        {/* EVENT LIST */}
        {loading && items.length === 0 ? (
          <Text color={G} fontSize="sm" py="10" textAlign="center">Загружаем...</Text>
        ) : (
          <Stack gap="5" key={filterKey}>
            {filtered.map((card, idx) => {
              const media = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
              const rawSrc = resolveMedia(media)
              const imgSrc = rawSrc && isImg(rawSrc) && !failedImgs[card.id] ? rawSrc : null
              const title = firstLine(card.title) || firstLine(card.description) || "Событие"
              const date = formatDate(card.event_time || card.created_at)
              const tilt = idx % 3 === 0 ? -0.6 : idx % 3 === 1 ? 0.5 : 0

              return (
                <Box
                  key={card.id}
                  ref={(el) => reveal(el, idx)}
                >
                <Box
                  border={`2.5px solid ${K}`}
                  position="relative"
                  cursor="pointer"
                  onClick={() => openDetail(card)}
                  style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
                  _hover={{ boxShadow: `4px 4px 0 ${B}` }}
                  transition="box-shadow 0.15s"
                >
                  {imgSrc && (
                    <Box overflow="hidden" borderBottom={`2px solid ${K}`}>
                      <Image
                        src={imgSrc}
                        alt={title}
                        width="100%"
                        height="auto"
                        maxH="260px"
                        objectFit="cover"
                        display="block"
                        onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
                      />
                    </Box>
                  )}
                  <Box px="4" py="3">
                    <Flex justify="space-between" align="center" mb="2">
                      <Text fontSize="10px" fontWeight="700" letterSpacing="0.15em" textTransform="uppercase" color={B}>
                        {card.channel}
                      </Text>
                      {date && (
                        <Text fontSize="10px" fontWeight="600" letterSpacing="0.08em" color={G} textTransform="uppercase">
                          {date}
                        </Text>
                      )}
                    </Flex>
                    <Text
                      fontSize="16px" fontWeight="900" lineHeight="1.15"
                      textTransform="uppercase" letterSpacing="-0.01em"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {title}
                    </Text>
                    <Flex
                      mt="3" align="center" justify="space-between"
                      borderTop={`1px solid ${K}12`} pt="2"
                    >
                      <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={G}>
                        Подробнее
                      </Text>
                      <Text fontSize="14px" fontWeight="900" color={B}>→</Text>
                    </Flex>
                  </Box>

                  {idx === 0 && (
                    <Box position="absolute" top="-8px" right="-8px" w="16px" h="16px" borderRadius="full" bg={B} />
                  )}
                </Box>
                </Box>
              )
            })}
          </Stack>
        )}

        {/* FOOTER */}
        <Flex justify="space-between" align="center" pt="10">
          <Text fontSize="10px" color={G} fontWeight="600" letterSpacing="0.06em">
            © 2026 Opus
          </Text>
          <Flex gap="4">
            {["TG", "IG", "X"].map((s) => (
              <Text key={s} fontSize="10px" fontWeight="800" letterSpacing="0.12em" color={K} cursor="pointer" _hover={{ color: B }} transition="color 0.15s">
                {s}
              </Text>
            ))}
          </Flex>
        </Flex>
      </Stack>

      {/* DETAIL DIALOG — P5R slam animation */}
      <Dialog.Root open={detailOpen} onOpenChange={(d) => setDetailOpen(d.open)}>
        <Portal>
          <Dialog.Backdrop
            style={{ animation: "p5-backdrop 0.35s ease-out forwards" }}
          />
          <Dialog.Positioner>
            <Dialog.Content
              maxW="min(92vw, 420px)" mx="auto"
              border={`3px solid ${K}`} borderRadius="0"
              overflow="hidden" boxShadow={`6px 6px 0 ${B}`}
              style={{ animation: "p5-dialog-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
            >
              <Dialog.CloseTrigger />

              {/* Diagonal accent stripe inside dialog header */}
              <Dialog.Header bg={K} px="5" py="3" position="relative" overflow="hidden">
                <Box
                  position="absolute" top="0" right="-20px" bottom="0" w="60px"
                  bg={B} style={{ transform: "skewX(-12deg)" }} opacity={0.2}
                />
                <Dialog.Title>
                  <Text fontSize="12px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase" color={W} position="relative">
                    {selTitle}
                  </Text>
                </Dialog.Title>
              </Dialog.Header>

              <Dialog.Body px="5" py="4" bg={W}>
                <Stack gap="3">
                  {selImg && selected && !failedImgs[selected.id] && (
                    <Box border={`2px solid ${K}`} overflow="hidden">
                      <Image
                        src={selImg} alt={selTitle}
                        width="100%" height="auto" maxH="300px"
                        objectFit="cover" display="block"
                        onError={() => {
                          if (selected) setFailedImgs((p) => ({ ...p, [selected.id]: true }))
                        }}
                      />
                    </Box>
                  )}
                  {selected?.channel && (
                    <Text fontSize="10px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase" color={B}>
                      {selected.channel}
                    </Text>
                  )}
                  <Text fontSize="sm" color={K} whiteSpace="pre-wrap" lineHeight="1.5">
                    {selected?.description ?? selected?.title ?? ""}
                  </Text>
                </Stack>
              </Dialog.Body>

              <Dialog.Footer px="5" py="3" bg={W} borderTop={`1px solid ${K}12`}>
                <Flex
                  as="button"
                  onClick={() => setDetailOpen(false)}
                  bg={B} color={W}
                  px="5" py="2.5"
                  fontSize="11px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase"
                  cursor="pointer" _hover={{ opacity: 0.88 }} transition="opacity 0.15s"
                >
                  Закрыть
                </Flex>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  )
}
