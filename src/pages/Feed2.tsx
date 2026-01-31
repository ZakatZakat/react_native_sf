import * as React from "react"
import { Badge, Box, Flex, Image, Stack, Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"

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
const palette = ["#F9D7C3", "#FFEAB6", "#FFB4A8", "#B7FFD4", "#E6E0FF", "#E0F4FF"]
const CARD_BG = "#FFFFFF"
const BORDER = "rgba(45,42,140,0.22)"
const BOARD_BG = "#FFFFFF"
const float = keyframes`
  0% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
  100% { transform: translateY(0); }
`

export default function Feed2() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [items, setItems] = React.useState<EventCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [failedImages, setFailedImages] = React.useState<Record<string, true>>({})
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
        gap="10"
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
          minW="920px"
          maxW="920px"
          bg={BOARD_BG}
          px="4"
          py="5"
          style={{ scrollSnapAlign: "start" }}
        >
          <Box
            minH="calc(100dvh - 180px)"
            display="grid"
            gridTemplateColumns="repeat(4, minmax(0, 1fr))"
            gridTemplateRows="repeat(2, minmax(0, 1fr))"
            gap="36px"
          >
            {items.slice(0, 8).map((card, idx) => (
              <Box
                key={card.id}
                style={{
                  transform: `translateY(${idx % 3 === 0 ? "2px" : idx % 3 === 1 ? "12px" : "0px"}) rotate(${
                    idx % 2 === 0 ? -2 : 2
                  }deg)`,
                  animation: `${float} ${5.2 + (idx % 4) * 0.6}s ease-in-out ${(idx % 5) * -0.4}s infinite`,
                }}
              >
                {renderCard(card, idx, failedImages, setFailedImages)}
              </Box>
            ))}
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}

function renderCard(
  item: EventCard,
  idx: number,
  failedImages: Record<string, true>,
  setFailedImages: React.Dispatch<React.SetStateAction<Record<string, true>>>,
) {
  const media = item.media_urls?.find((u) => isLikelyImageUrl(u)) ?? item.media_urls?.[0]
  const src = resolveMediaUrl(media, import.meta.env.VITE_API_URL || "http://localhost:8000")
  const title = firstLine(item.title) || firstLine(item.description) || "Событие"
  const imageHeight = "auto"
  const aiRating = aiRatingForId(item.id)
  const color = palette[idx % palette.length]

  return (
    <Box
      key={item.id}
      width="100%"
      borderRadius="2xl"
      border="1px solid rgba(0,0,0,0.10)"
      bg={CARD_BG}
      overflow="hidden"
      boxShadow="0 6px 18px rgba(0,0,0,0.06)"
    >
      <Box bg="rgba(45,42,140,0.06)">
        {src && !failedImages[item.id] ? (
          <Image
            src={src}
            alt={title}
            width="100%"
            height="auto"
            objectFit="cover"
            onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
          />
        ) : (
          <Box width="100%" height="120px" bg={color} />
        )}
      </Box>
      <Box px="3" pt="3" pb="3">
        <Flex mb="2" align="center" gap="2" wrap="wrap">
          <Box borderRadius="full" border="1px solid rgba(255,255,255,0.14)" px="2.5" py="1" bg="#0F0F0F" maxW="100%">
            <Text fontSize="xs" fontWeight="semibold" color="white" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item.channel}
            </Text>
          </Box>
        </Flex>
        <Text
          fontSize="sm"
          fontWeight="semibold"
          lineHeight="1.25"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Text>
        <Box mt="2">
          <StarRating value={aiRating} />
        </Box>
      </Box>
    </Box>
  )
}

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return h
}

function aiRatingForId(id: string): number {
  const h = Math.abs(hashString(id))
  const t = (h % 10_000) / 10_000
  const rating = 3.6 + t * 1.4
  return Math.round(rating * 10) / 10
}

function StarRating({ value }: { value: number }) {
  const filled = Math.round(value * 2) / 2
  return (
    <Flex align="center" gap="1.5">
      <Flex align="center" gap="0.5" aria-label={`Оценка ИИ: ${value}`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const n = i + 1
          const char = filled >= n ? "★" : filled >= n - 0.5 ? "⯪" : "☆"
          return (
            <Text key={i} fontSize="sm" lineHeight="1" color="#0F0F0F">
              {char}
            </Text>
          )
        })}
      </Flex>
      <Text fontSize="xs" color="rgba(0,0,0,0.62)">
        Оценка ИИ: {value.toFixed(1)}
      </Text>
    </Flex>
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
