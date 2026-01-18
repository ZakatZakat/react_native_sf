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

function choose3(all: EventCard[], seed: number): EventCard[] {
  const withImg = all.filter((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
  const scored = [...withImg].sort((a, b) => {
    const sa = firstLine(a.title).length + (a.description ?? "").length + (hashSeed(a.id) ^ seed)
    const sb = firstLine(b.title).length + (b.description ?? "").length + (hashSeed(b.id) ^ seed)
    return sb - sa
  })
  return scored.slice(0, 3)
}

type PeekCardProps = {
  order: 0 | 1 | 2
  active: 0 | 1 | 2
  onActivate: (idx: 0 | 1 | 2) => void
  title: string
  subtitle: string
  img: string | null
  accent: string
}

function PeekCard({ order, active, onActivate, title, subtitle, img, accent }: PeekCardProps) {
  const isActive = order === active
  const y = [0, 28, 56][order]
  const z = isActive ? 10 : order + 1
  const scale = isActive ? 1.02 : 1

  return (
    <Box
      position="absolute"
      left="0"
      right="0"
      top="0"
      mx="auto"
      width="100%"
      transform={`translate3d(0, ${y}px, 0) scale(${scale})`}
      transformOrigin="center"
      borderRadius="2xl"
      overflow="hidden"
      border="1px solid rgba(0,0,0,0.12)"
      boxShadow={isActive ? "0 28px 58px rgba(0,0,0,0.18)" : "0 18px 40px rgba(0,0,0,0.14)"}
      zIndex={z}
      transition="transform 220ms ease, box-shadow 220ms ease"
      cursor="pointer"
      onClick={() => onActivate(order)}
      bg="white"
    >
      <Box position="absolute" left="0" top="0" height="6px" width="100%" bg={accent} />
      {img ? <Image src={img} alt={title} width="100%" height="210px" objectFit="cover" /> : <Box height="210px" bg="rgba(0,0,0,0.06)" />}
      <Box p="4" bg="white">
        <Text fontSize="xs" color="rgba(0,0,0,0.60)">
          {subtitle}
        </Text>
        <Text fontSize="lg" fontWeight="black" lineHeight="1.1" mt="2">
          {title}
        </Text>
      </Box>
    </Box>
  )
}

export default function Landing5() {
  const [events, setEvents] = React.useState<EventCard[]>([])
  const [variant, setVariant] = React.useState<number>(() => Date.now())
  const [active, setActive] = React.useState<0 | 1 | 2>(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=120`, { cache: "no-store" })
        if (!res.ok) throw new Error(`events status ${res.status}`)
        const data: EventCard[] = await res.json()
        setEvents(data)
      } catch (e) {
        console.error("landing5 load", e)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = React.useMemo(() => choose3(events, variant), [events, variant])
  const preview = cards.map((c) => {
    const media = c.media_urls?.find((u) => isLikelyImageUrl(u)) ?? c.media_urls?.[0]
    const raw = resolveMediaUrl(media, apiUrl)
    return {
      title: firstLine(c.title) || firstLine(c.description) || "Событие",
      subtitle: `${c.channel} • #${c.message_id}`,
      img: raw && isLikelyImageUrl(raw) ? raw : null,
    }
  })

  return (
    <Box minH="100dvh" bg="#F6F6F6" color="#0F0F0F" fontFamily="system-ui" pb="10">
      <Stack gap="4" px="4" pt="5" maxW="430px" mx="auto">
        <Flex align="center" justify="space-between" gap="3">
          <Text fontSize="md" fontWeight="semibold" color="rgba(0,0,0,0.75)">
            Landing 5 (peek stack)
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
          Смотри
          <br />
          подборки
        </Text>

        <Box position="relative" minH="520px">
          {loading ? <Text color="rgba(0,0,0,0.55)">Загружаем…</Text> : null}
          {!loading && preview.length < 3 ? (
            <Box borderRadius="2xl" bg="white" border="1px solid rgba(0,0,0,0.10)" p="4">
              <Text fontWeight="semibold">Недостаточно ивентов с картинками</Text>
              <Text fontSize="sm" color="rgba(0,0,0,0.6)" mt="1">
                Открой ленту и нажми «Забрать из TG», затем вернись сюда.
              </Text>
            </Box>
          ) : null}

          {!loading && preview.length >= 3 ? (
            <>
              <PeekCard
                order={2}
                active={active}
                onActivate={(i) => setActive(i)}
                title={preview[2].title}
                subtitle={preview[2].subtitle}
                img={preview[2].img}
                accent="#FFD34E"
              />
              <PeekCard
                order={1}
                active={active}
                onActivate={(i) => setActive(i)}
                title={preview[1].title}
                subtitle={preview[1].subtitle}
                img={preview[1].img}
                accent="#F4A8DE"
              />
              <PeekCard
                order={0}
                active={active}
                onActivate={(i) => setActive(i)}
                title={preview[0].title}
                subtitle={preview[0].subtitle}
                img={preview[0].img}
                accent="#3ED47C"
              />
            </>
          ) : null}
        </Box>
      </Stack>
    </Box>
  )
}

