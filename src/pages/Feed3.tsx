import * as React from "react"
import { Box, Flex, Image, Stack, Text } from "@chakra-ui/react"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  event_time?: string | null
  media_urls?: string[]
  created_at: string
}

const INK = "#111111"
const INK_MUTED = "rgba(17,17,17,0.6)"
const BG = "#FAFAFA"
const ACCENT = "#0066FF"

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
  if (Number.isNaN(d.getTime())) return "6 May 2022"
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function Feed3() {
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
    <Box minH="100dvh" bg={BG} color={INK} position="relative">
      <Box position="fixed" inset="0" bg={BG} zIndex={-1} />
      <Stack maxW="430px" mx="auto" px="5" pt="6" pb="16" gap="0">
        <Flex align="center" justify="space-between" mb="8">
          <Text fontSize="sm" fontWeight="bold" letterSpacing="0.15em" textTransform="uppercase">
            AI-Picks
          </Text>
          <Box as="span" fontSize="xl" cursor="pointer" lineHeight="1">
            ☰
          </Box>
        </Flex>

        <Box width="100%" minH="320px" aspectRatio="4/5" overflow="hidden" bg={INK} mb="8" position="relative">
          {heroImage ? (
            <>
              <Image
                src={heroImage}
                alt=""
                width="100%"
                height="100%"
                objectFit="contain"
                objectPosition="center"
                filter="grayscale(100%) contrast(1.1)"
              />
              <Box
                position="absolute"
                inset="0"
                bg={`${ACCENT}40`}
                mixBlendMode="multiply"
              />
            </>
          ) : (
            <Box width="100%" height="100%" bg={INK} />
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
            <Text as="span" color={ACCENT} fontSize="1.15em" ml="0.5">
              &
            </Text>
          </Text>
          <Text fontSize="sm" color={INK_MUTED} lineHeight="1.6" maxW="320px">
            Inspiration makes you feel alive & connected. Enjoy!
          </Text>
        </Stack>

        <Flex
          as="button"
          align="center"
          gap="3"
          bg={ACCENT}
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
          color={INK_MUTED}
          textTransform="uppercase"
          mb="6"
        >
          Upcoming
        </Text>

        {loading ? (
          <Text fontSize="sm" color={INK_MUTED}>
            Loading…
          </Text>
        ) : (
          <Stack gap="8">
            {items.slice(0, 4).map((card, idx) => {
              const media = card.media_urls?.find((u) => isLikelyImageUrl(u)) ?? card.media_urls?.[0]
              const imgSrc = resolveMediaUrl(media, apiUrl)
              const titleLine = firstLine(card.title) || firstLine(card.description) || `Event ${idx + 1}`

              return (
                <Box key={card.id}>
                  <Box
                    width="100%"
                    minH="200px"
                    aspectRatio="16/10"
                    overflow="hidden"
                    bg={INK}
                    mb="4"
                    position="relative"
                  >
                    {imgSrc && !failedImages[card.id] ? (
                      <>
                        <Image
                          src={imgSrc}
                          alt={titleLine}
                          width="100%"
                          height="100%"
                          objectFit="contain"
                          objectPosition="center"
                          filter="grayscale(100%) contrast(1.05)"
                          onError={() => setFailedImages((prev) => ({ ...prev, [card.id]: true }))}
                        />
                        {idx % 2 === 1 && (
                          <Box
                            position="absolute"
                            inset="0"
                            bg={`${ACCENT}30`}
                            mixBlendMode="multiply"
                          />
                        )}
                      </>
                    ) : (
                      <Box width="100%" height="100%" bg={INK} />
                    )}
                  </Box>
                  <Text
                    fontSize="xl"
                    fontWeight="bold"
                    letterSpacing="-0.01em"
                    textTransform="uppercase"
                    lineHeight="1.2"
                    noOfLines={2}
                  >
                    {titleLine}
                    <Text as="span" color={ACCENT} fontSize="1.1em">
                      &
                    </Text>
                  </Text>
                  <Text fontSize="sm" color={INK_MUTED} mt="1">
                    {card.event_time ? formatDate(card.event_time) : formatDate(card.created_at)}
                  </Text>
                  <Flex
                    align="center"
                    gap="2"
                    mt="3"
                    color={ACCENT}
                    fontWeight="bold"
                    fontSize="xs"
                    letterSpacing="0.1em"
                    textTransform="uppercase"
                    cursor="pointer"
                    _hover={{ textDecoration: "underline" }}
                  >
                    Get ticket
                    <Text as="span">→</Text>
                  </Flex>
                </Box>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
