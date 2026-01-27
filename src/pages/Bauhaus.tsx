import * as React from "react"
import { AspectRatio, Badge, Box, Flex, Image, SimpleGrid, Stack, Text } from "@chakra-ui/react"

const PRIMARY = "#2D2A8C"
const PRIMARY_BORDER = "rgba(45,42,140,0.28)"
const BG = "#FFFFFF"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  media_urls?: string[]
  created_at: string
}

export default function Bauhaus() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [items, setItems] = React.useState<EventCard[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=12`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as EventCard[]
        setItems(data)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [apiUrl])


  return (
    <Box minH="100dvh" bg={BG} color={PRIMARY}>
      <Stack maxW="980px" mx="auto" px="6" py="8" gap="5">
        <Flex
          align="center"
          justify="space-between"
          border="2px solid"
          borderColor={PRIMARY}
          borderRadius="md"
          px="3"
          py="2"
        >
          <Text fontWeight="semibold">Event Channel</Text>
          <Flex gap="4" fontSize="sm">
            <Text>EDITORIAL</Text>
            <Text>ESSENTIALS</Text>
            <Text>SPACES</Text>
            <Text>BLOG</Text>
            <Text>ABOUT</Text>
          </Flex>
        </Flex>

        <Flex
          align="center"
          justify="flex-end"
          border="2px solid"
          borderColor={PRIMARY}
          borderRadius="md"
          px="3"
          py="2"
          fontSize="sm"
        >
          <Text>FACEBOOK ↗</Text>
          <Text mx="3">INSTAGRAM ↗</Text>
          <Text>TWITTER ↗</Text>
        </Flex>

        <Flex
          wrap="wrap"
          gap="2"
          border="2px solid"
          borderColor={PRIMARY}
          borderRadius="md"
          px="3"
          py="2"
        >
          {[
            "INTERVIEW",
            "GERMAN",
            "MUSIC",
            "ENGLISH",
            "ART",
            "PHOTOGRAPHY",
            "PERFORMANCE",
            "REVIEW",
            "ESSAY",
            "CLUB CULTURE",
            "FESTIVAL",
          ].map((tag) => (
            <Badge
              key={tag}
              border={`1px solid ${PRIMARY}`}
              borderRadius="sm"
              px="2"
              py="0.5"
              fontSize="10px"
              bg="white"
              color={PRIMARY}
            >
              {tag}
            </Badge>
          ))}
        </Flex>

        {loading ? (
          <Text fontSize="sm" color="rgba(45,42,140,0.7)">
            Загружаем события…
          </Text>
        ) : (
          <>
            <SimpleGrid columns={{ base: 2, md: 3 }} spacing="4">
              {items.map((item) => (
                <Box key={item.id} border="2px solid" borderColor={PRIMARY_BORDER} borderRadius="md" overflow="hidden">
                  <AspectRatio ratio={1}>
                    {(() => {
                      const media = item.media_urls?.find((u) => isLikelyImageUrl(u))
                      const src = resolveMediaUrl(media, apiUrl)
                      return src ? (
                        <Image src={src} alt={item.title} objectFit="cover" />
                      ) : (
                        <Box bg="rgba(45,42,140,0.08)" />
                      )
                    })()}
                  </AspectRatio>
                  <Box px="3" py="2" borderTop="2px solid" borderColor={PRIMARY_BORDER}>
                    <Text fontWeight="semibold" fontSize="sm" noOfLines={2}>
                      {item.title}
                    </Text>
                    <Flex gap="2" mt="2" wrap="wrap">
                      {makeTags(item).map((tag) => (
                        <Badge key={tag} border={`1px solid ${PRIMARY}`} borderRadius="sm" px="2" py="0.5" fontSize="10px">
                          {tag}
                        </Badge>
                      ))}
                    </Flex>
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          </>
        )}
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

function makeTags(item: EventCard): string[] {
  const base = item.channel.replace(/^@/, "").toUpperCase()
  const extra = item.title.toLowerCase().includes("концерт") ? "CONCERT" : "EVENT"
  return [base.slice(0, 12) || "EVENT", extra]
}
