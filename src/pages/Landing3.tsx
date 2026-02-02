import * as React from "react"
import { Box, Flex, Image, Stack, Text } from "@chakra-ui/react"

type EventCard = {
  id: string
  title: string
  description?: string | null
  media_urls?: string[]
  created_at: string
}

const INK = "#111111"
const INK_MUTED = "rgba(17,17,17,0.62)"
const BG = "#EFEDE8"

export default function Landing3() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [item, setItem] = React.useState<EventCard | null>(null)
  const [heroImage, setHeroImage] = React.useState<string | null>(null)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=12`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as EventCard[]
        const primary = data.find((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u))) ?? data[0] ?? null
        setItem(primary)
        const media = primary?.media_urls?.find((u) => isLikelyImageUrl(u))
        const resolved = resolveMediaUrl(media, apiUrl)
        setHeroImage(resolved && isLikelyImageUrl(resolved) ? resolved : null)
      } catch {
        setItem(null)
        setHeroImage(null)
      }
    }
    void load()
  }, [apiUrl])

  const dateLabel = item?.created_at ? formatDate(item.created_at) : "5 мар 2022"
  const timeLabel = item?.created_at ? formatTime(item.created_at) : "22:00"
  const titleLine = firstLine(item?.title) || "Открытие ночи с Funky Loffe"
  const subtitle = "Клуб, музыка, квиз"
  const body = item?.description?.trim() || "Новая программа в Hermetikken. Приходите к 22:00."

  return (
    <Box minH="100dvh" bg={BG} color={INK}>
      <Stack maxW="430px" mx="auto" px="4" pt="4" pb="10" gap="4">
        <Flex align="center" justify="space-between" fontSize="sm" color={INK}>
          <Text>Treverafabrikken</Text>
          <Text>Меню</Text>
        </Flex>

        <Text fontSize="3xl" fontWeight="semibold" color={INK} lineHeight="1.05">
          Stay, Taste,
          <br />
          Take Part, Move
        </Text>

        <Box border="1px solid rgba(17,17,17,0.2)" bg={BG}>
          {heroImage ? (
            <Image src={heroImage} alt={titleLine} width="100%" height="auto" objectFit="cover" />
          ) : (
            <Box height="220px" bg="rgba(17,17,17,0.06)" />
          )}
        </Box>

        <Stack gap="1">
          <Text fontSize="lg" fontWeight="semibold" color={INK}>
            {titleLine}
          </Text>
          <Text fontSize="sm" color={INK_MUTED}>
            {dateLabel} · {timeLabel}
          </Text>
        </Stack>

        <Text fontSize="md" color={INK} lineHeight="1.5">
          {body}
        </Text>

        <Flex align="center" justify="space-between" pt="2">
          <Text fontSize="sm" color={INK_MUTED}>
            {subtitle}
          </Text>
          <Text fontSize="sm" fontWeight="semibold" color={INK}>
            RSVP
          </Text>
        </Flex>
      </Stack>
    </Box>
  )
}

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

function firstLine(text?: string | null): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "5 мар 2022"
  return d.toLocaleDateString("ru-RU", { month: "short", day: "2-digit", year: "numeric" })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "22:00"
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}
