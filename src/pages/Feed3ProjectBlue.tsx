import * as React from "react"
import { Box, Flex, Image, Stack, Text } from "@chakra-ui/react"
import {
  projectBlueTheme,
  ProjectBluePage,
  ProjectBlueEventCard,
  isLikelyImageUrl,
  resolveMediaUrl,
} from "../components/project_blue"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  event_time?: string | null
  media_urls?: string[]
  created_at: string
}

function firstLine(text?: string | null): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "6 May 2022"
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function Feed3ProjectBlue() {
  const { ink, inkMuted, accent } = projectBlueTheme
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [items, setItems] = React.useState<EventCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [heroImage, setHeroImage] = React.useState<string | null>(null)
  const [failedImages, setFailedImages] = React.useState<Record<string, true>>({})

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=12`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as EventCard[]
        setItems(data)
        const primary = data.find((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u))) ?? data[0] ?? null
        const media = primary?.media_urls?.find((u) => isLikelyImageUrl(u))
        const resolved = resolveMediaUrl(media, apiUrl)
        setHeroImage(resolved && isLikelyImageUrl(resolved) ? resolved : null)
      } catch {
        setItems([])
        setHeroImage(null)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [apiUrl])

  const headlineBase = items[0] ? firstLine(items[0].title) : "Feels good to"

  return (
    <ProjectBluePage pt="6" pb="16" gap="0" showDecor={false}>
      <Flex align="center" justify="space-between" mb="8">
        <Text fontSize="sm" fontWeight="bold" letterSpacing="0.15em" textTransform="uppercase">
          AI-Picks
        </Text>
        <Box as="span" fontSize="xl" cursor="pointer" lineHeight="1">
          ☰
        </Box>
      </Flex>

      <Box width="100%" minH="320px" aspectRatio="4/5" overflow="hidden" bg={ink} mb="8" position="relative">
        {heroImage ? (
          <>
            <Image
              src={heroImage}
              alt=""
              width="100%"
              height="100%"
              objectFit="contain"
              objectPosition="center"
            />
            <Box
              position="absolute"
              inset="0"
              bg={`${accent}40`}
              mixBlendMode="multiply"
            />
          </>
        ) : (
          <Box width="100%" height="100%" bg={ink} />
        )}
      </Box>

      <Stack gap="6" mb="10">
        <Text
          fontSize={{ base: "3xl", sm: "4xl" }}
          fontWeight="bold"
          letterSpacing="-0.02em"
          lineHeight="1.05"
          textTransform="uppercase"
        >
          {headlineBase}
          <Text as="span" color={accent} fontSize="1.15em" ml="0.5">
            &
          </Text>
        </Text>
        <Text fontSize="sm" color={inkMuted} lineHeight="1.6" maxW="320px">
          Inspiration makes you feel alive & connected. Enjoy!
        </Text>
      </Stack>

      <Flex
        as="button"
        align="center"
        gap="3"
        bg={accent}
        color="white"
        px="5"
        py="4"
        fontWeight="bold"
        fontSize="sm"
        letterSpacing="0.08em"
        textTransform="uppercase"
        cursor="pointer"
        _hover={{ opacity: 0.9 }}
        mb="12"
      >
        This is prepared for you
        <Text as="span">→</Text>
      </Flex>

      <Text
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="0.2em"
        color={inkMuted}
        textTransform="uppercase"
        mb="6"
      >
        Upcoming
      </Text>

      {loading ? (
        <Text fontSize="sm" color={inkMuted}>
          Loading…
        </Text>
      ) : (
        <Stack gap="8">
          {items.slice(0, 4).map((card, idx) => {
            const media = card.media_urls?.find((u) => isLikelyImageUrl(u)) ?? card.media_urls?.[0]
            const imgSrc = resolveMediaUrl(media, apiUrl)
            const titleLine = firstLine(card.title) || firstLine(card.description) || `Event ${idx + 1}`

            return (
              <ProjectBlueEventCard
                key={card.id}
                imageSrc={imgSrc}
                imageError={!!failedImages[card.id]}
                onImageError={() => setFailedImages((prev) => ({ ...prev, [card.id]: true }))}
                title={titleLine}
                date={card.event_time ? formatDate(card.event_time) : formatDate(card.created_at)}
                accentOverlay={idx % 2 === 1}
              />
            )
          })}
        </Stack>
      )}
    </ProjectBluePage>
  )
}
