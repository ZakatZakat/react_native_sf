import * as React from "react"
import { Box, Button, Flex, Image, Stack, Text } from "@chakra-ui/react"
import { Link as RouterLink } from "@tanstack/react-router"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  message_id: number
  media_urls?: string[]
  created_at: string
}

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"

function isLikelyImageUrl(url: string): boolean {
  const u = url.toLowerCase()
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".webp") || u.endsWith(".gif")
}

function resolveMediaUrl(media: string | undefined, apiBase: string): string | null {
  if (!media) return null
  if (media.startsWith("http://") || media.startsWith("https://")) return media
  try {
    const base = new URL(apiBase)
    if (media.startsWith("/media/")) return `${base.origin}${media}`
    return `${apiBase}${media.startsWith("/") ? "" : "/"}${media}`
  } catch {
    return media
  }
}

function firstLine(text: string | null | undefined): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
}

function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return h
}

function chooseN(all: EventCard[], seed: number, want: number): EventCard[] {
  const withImg = all.filter((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
  const scored = [...withImg].sort((a, b) => {
    const sa = firstLine(a.title).length + (a.description ?? "").length + (hashSeed(a.id) ^ seed)
    const sb = firstLine(b.title).length + (b.description ?? "").length + (hashSeed(b.id) ^ seed)
    return sb - sa
  })
  const out: EventCard[] = []
  const used = new Set<string>()
  for (const e of scored) {
    if (out.length >= want) break
    if (used.has(e.channel)) continue
    out.push(e)
    used.add(e.channel)
  }
  for (const e of scored) {
    if (out.length >= want) break
    if (out.some((x) => x.id === e.id)) continue
    out.push(e)
  }
  return out.slice(0, want)
}

type Slide = { title: string; subtitle: string; img: string | null }

type Section = {
  key: string
  title: string
  keywords: string[]
}

const sections: Section[] = [
  { key: "concerts", title: "Концерты", keywords: ["концерт", "gig", "live", "выступ", "музы", "band"] },
  { key: "theatre", title: "Театр", keywords: ["театр", "спектакл", "пьеса", "постановк"] },
  { key: "party", title: "Вечеринки", keywords: ["вечерин", "rave", "dj", "техно", "house"] },
]

function matchesAny(event: EventCard, keywords: string[]): boolean {
  const t = `${(event.title ?? "").toLowerCase()}\n${(event.description ?? "").toLowerCase()}\n${event.channel.toLowerCase()}`
  return keywords.some((k) => t.includes(k))
}

function toSlides(cards: EventCard[]): Slide[] {
  return cards.map((c) => {
    const media = c.media_urls?.find((u) => isLikelyImageUrl(u)) ?? c.media_urls?.[0]
    const raw = resolveMediaUrl(media, apiUrl)
    return {
      title: firstLine(c.title) || firstLine(c.description) || "Событие",
      subtitle: `${c.channel} • #${c.message_id}`,
      img: raw && isLikelyImageUrl(raw) ? raw : null,
    }
  })
}

type CarouselRowProps = {
  title: string
  slides: Slide[]
}

function CarouselRow({ title, slides }: CarouselRowProps) {
  const [active, setActive] = React.useState(0)
  const [dragX, setDragX] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const startXRef = React.useRef<number | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = React.useState<number>(360)

  React.useEffect(() => {
    setActive(0)
    setDragX(0)
    setDragging(false)
    startXRef.current = null
  }, [slides.map((s) => s.subtitle).join("|")])

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const update = () => {
      const next = Math.max(280, Math.floor(el.clientWidth))
      setWidth(next)
    }

    update()

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => update())
      ro.observe(el)
      return () => ro.disconnect()
    }

    const onResize = () => update()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

  const maxDrag = Math.round(width * 0.4)
  const threshold = Math.round(width * 0.18)
  const offset = -active * width + dragX

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
    setDragging(true)
    setDragX(0)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || startXRef.current == null) return
    setDragX(clamp(e.clientX - startXRef.current, -maxDrag, maxDrag))
  }

  const finishDrag = () => {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > threshold) {
      setActive((prev) => clamp(prev + (dragX < 0 ? 1 : -1), 0, Math.max(0, slides.length - 1)))
    }
    setDragX(0)
    startXRef.current = null
  }

  return (
    <Box>
      <Flex align="baseline" justify="space-between" mb="2">
        <Text fontSize="lg" fontWeight="black" letterSpacing="-0.4px">
          {title}
        </Text>
        <Text fontSize="xs" color="rgba(0,0,0,0.55)">
          Подборка
        </Text>
      </Flex>

      <Box
        borderRadius="2xl"
        overflow="hidden"
        border="1px solid rgba(0,0,0,0.12)"
        bg="white"
        boxShadow="0 18px 40px rgba(0,0,0,0.10)"
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{ touchAction: "pan-y" }}
      >
        <Box height="520px" position="relative" bg="rgba(0,0,0,0.06)">
          <Box
            position="absolute"
            top="0"
            left="0"
            height="100%"
            width={`${slides.length * width}px`}
            transform={`translate3d(${offset}px,0,0)`}
            transition={dragging ? "none" : "transform 240ms ease"}
            display="flex"
          >
            {slides.map((s, i) => (
              <Box key={i} width={`${width}px`} height="100%" position="relative">
                {s.img ? (
                  <Image src={s.img} alt={s.title} width="100%" height="100%" objectFit="cover" />
                ) : (
                  <Box width="100%" height="100%" bg="rgba(0,0,0,0.06)" />
                )}
              </Box>
            ))}
          </Box>
        </Box>

        <Box p="4">
          <Text fontSize="xs" color="rgba(0,0,0,0.60)">
            {slides[active]?.subtitle}
          </Text>
          <Text fontSize="md" fontWeight="black" lineHeight="1.1" mt="2">
            <span
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: "5.5em",
              }}
            >
              {slides[active]?.title}
            </span>
          </Text>
          <Flex gap="1.5" mt="3" justify="center">
            {slides.map((_, i) => (
              <Box
                key={i}
                width={i === active ? "18px" : "8px"}
                height="8px"
                borderRadius="full"
                bg={i === active ? "#0F0F0F" : "rgba(0,0,0,0.18)"}
                transition="all 180ms ease"
                onClick={() => setActive(i)}
                cursor="pointer"
              />
            ))}
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}

export default function Landing6() {
  const [events, setEvents] = React.useState<EventCard[]>([])
  const [variant, setVariant] = React.useState<number>(() => Date.now())
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=120`, { cache: "no-store" })
        if (!res.ok) throw new Error(`events status ${res.status}`)
        const data: EventCard[] = await res.json()
        setEvents(data)
      } catch (e) {
        console.error("landing6 load", e)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sectionsData = React.useMemo(() => {
    const seed = variant
    return sections.map((s, idx) => {
      const filtered = events.filter((e) => matchesAny(e, s.keywords))
      const chosen = chooseN(filtered.length ? filtered : events, seed + idx * 97, 5)
      return { title: s.title, slides: toSlides(chosen) }
    })
  }, [events, variant])

  return (
    <Box minH="100dvh" bg="#EEF1F6" color="#0F0F0F" fontFamily="system-ui" pb="10">
      <Stack gap="4" px="4" pt="5" maxW="430px" mx="auto">
        <Flex align="center" justify="space-between" gap="3">
          <Text fontSize="md" fontWeight="semibold" color="rgba(0,0,0,0.75)">
            Landing 6 (подборки)
          </Text>
          <Flex gap="2">
            <Button
              size="sm"
              variant="outline"
              borderColor="rgba(0,0,0,0.14)"
              bg="white"
              onClick={() => setVariant(Date.now())}
            >
              Другие
            </Button>
            <RouterLink to="/feed">
              <Button size="sm" bg="#0F0F0F" color="white">
                Лента
              </Button>
            </RouterLink>
          </Flex>
        </Flex>

        <Text fontSize="4xl" fontWeight="black" lineHeight="0.95" letterSpacing="-0.9px">
          Листай
          <br />
          подборки
        </Text>

        {loading ? <Text color="rgba(0,0,0,0.55)">Загружаем…</Text> : null}
        {!loading
          ? sectionsData.map((s) => <CarouselRow key={s.title} title={s.title} slides={s.slides} />)
          : null}
      </Stack>
    </Box>
  )
}

