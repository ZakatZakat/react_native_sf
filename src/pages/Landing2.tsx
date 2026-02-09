import * as React from "react"
import { Box, Flex, Image, Stack, Text } from "@chakra-ui/react"

type EventCard = {
  id: string
  title: string
  description?: string | null
  media_urls?: string[]
  created_at: string
}

const BLUE = "#2D6AE3"
const BLUE_MUTED = "rgba(45,106,227,0.75)"

export default function Landing2() {
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

  const dateLabel = item?.created_at ? formatDate(item.created_at) : "Apr 12 2025"
  const readLabel = `${Math.max(1, Math.min(8, Math.ceil((item?.description?.length ?? 200) / 350)))} min`
  const titleLine = firstLine(item?.title) || "Introducing: Margaux Duseigneur"
  const subtitle = "Typography, Design, Art"
  const body = item?.description?.trim() || "Mauris in ultrices urna. In eu risus est. Aenean non."

  return (
    <Box minH="100dvh" bg="#F2F1EA" color={BLUE}>
      <Stack maxW="430px" mx="auto" px="4" pt="4" pb="10" gap="4">
        <Flex align="center" justify="space-between" fontSize="sm" color={BLUE}>
          <Text>Menu</Text>
          <Text fontWeight="semibold">Fidèle</Text>
          <Text>Cart (3)</Text>
        </Flex>

        <Box border="1px solid rgba(45,106,227,0.35)" bg="#F2F1EA">
          {heroImage ? (
            <Image src={heroImage} alt={titleLine} width="100%" height="auto" objectFit="contain" />
          ) : (
            <Box height="240px" bg="rgba(45,106,227,0.12)" />
          )}
        </Box>

        <Flex align="center" justify="space-between" fontSize="xs" color={BLUE_MUTED}>
          <Box>
            <Text fontWeight="semibold" letterSpacing="0.2px">
              DATE
            </Text>
            <Text fontSize="sm" color={BLUE}>
              {dateLabel}
            </Text>
          </Box>
          <Box textAlign="right">
            <Text fontWeight="semibold" letterSpacing="0.2px">
              READ
            </Text>
            <Text fontSize="sm" color={BLUE}>
              {readLabel}
            </Text>
          </Box>
        </Flex>

        <Stack gap="2">
          <Text fontSize="2xl" fontWeight="semibold" color={BLUE} lineHeight="1.1">
            {titleLine}
          </Text>
          <Text fontSize="sm" color={BLUE_MUTED}>
            {subtitle}
          </Text>
        </Stack>

        <Box height="1px" bg="rgba(45,106,227,0.35)" />

        <Text fontSize="md" color={BLUE} lineHeight="1.5">
          {body}
        </Text>
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
  if (Number.isNaN(d.getTime())) return "Apr 12 2025"
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
}
