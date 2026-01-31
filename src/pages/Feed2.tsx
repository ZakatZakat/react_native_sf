import * as React from "react"
import { Badge, Box, Flex, Image, Stack, Text } from "@chakra-ui/react"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  media_urls?: string[]
  created_at: string
}

const PRIMARY = "#2D2A8C"
const PRIMARY_MUTED = "rgba(45,42,140,0.7)"
const CARD_BG = "#FFFFFF"
const BORDER = "rgba(45,42,140,0.22)"
const BOARD_BG = "#FFFFFF"

export default function Feed2() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [items, setItems] = React.useState<EventCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const scrollerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=24`, { cache: "no-store" })
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

  if (loading) {
    return (
      <Box px="2" py="6">
        <Text fontSize="sm" color={PRIMARY_MUTED}>
          Загружаем события…
        </Text>
      </Box>
    )
  }

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!scrollerRef.current) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    scrollerRef.current.scrollLeft += e.deltaY
    e.preventDefault()
  }

  return (
    <Box px="1" pt="2" pb="10" height="calc(100dvh - 140px)" overflow="hidden">
      <Flex
        ref={scrollerRef}
        gap="4"
        overflowX="auto"
        overflowY="hidden"
        height="100%"
        py="4"
        px="1"
        onWheel={onWheel}
        style={{
          scrollSnapType: "x mandatory",
          touchAction: "pan-x",
          overscrollBehaviorX: "contain",
          overscrollBehaviorY: "none",
        }}
      >
        <Box
          minW="820px"
          maxW="820px"
          bg={BOARD_BG}
          px="4"
          py="5"
          style={{ scrollSnapAlign: "start" }}
        >
          <Box
            minH="calc(100dvh - 180px)"
            display="grid"
            gridTemplateColumns="repeat(4, minmax(0, 1fr))"
            gridTemplateRows="repeat(3, minmax(0, 1fr))"
            gap="16px"
          >
            {items.slice(0, 12).map((card, idx) => (
              <Box
                key={card.id}
                style={{
                  transform: `translateY(${idx % 3 === 0 ? "2px" : idx % 3 === 1 ? "10px" : "0px"}) rotate(${
                    idx % 2 === 0 ? -2 : 2
                  }deg)`,
                }}
              >
                {renderCard(card, idx)}
              </Box>
            ))}
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}

function renderCard(item: EventCard, idx: number) {
  const media = item.media_urls?.find((u) => isLikelyImageUrl(u)) ?? item.media_urls?.[0]
  const src = resolveMediaUrl(media, import.meta.env.VITE_API_URL || "http://localhost:8000")
  const title = firstLine(item.title) || "Событие"
  const imageHeight = idx % 2 === 0 ? "130px" : "160px"

  return (
    <Box
      key={item.id}
      width="100%"
      borderRadius="2xl"
      border="2px solid"
      borderColor={BORDER}
      bg={CARD_BG}
      overflow="hidden"
      boxShadow="0 8px 18px rgba(45,42,140,0.08)"
    >
      <Box
        height={imageHeight}
        bg="rgba(45,42,140,0.06)"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {src ? (
          <Image src={src} alt={title} width="100%" height="100%" objectFit="cover" />
        ) : (
          <Box width="100%" height="100%" bg="rgba(45,42,140,0.10)" />
        )}
      </Box>
      <Stack gap="2" px="3" py="3">
        <Badge
          alignSelf="flex-start"
          border={`1px solid ${PRIMARY}`}
          borderRadius="sm"
          px="2"
          py="0.5"
          fontSize="8px"
          bg="white"
          color={PRIMARY}
        >
          {item.channel.replace(/^@/, "").toUpperCase().slice(0, 12) || "EVENT"}
        </Badge>
        <Text fontWeight="semibold" fontSize="xs" lineHeight="1.2" color={PRIMARY} noOfLines={2}>
          {title}
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

function firstLine(text: string | null | undefined): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
}
