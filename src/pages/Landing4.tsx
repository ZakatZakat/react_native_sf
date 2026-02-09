import * as React from "react"
import { Box, Flex, Image, Stack, Text } from "@chakra-ui/react"
import { useColorMode } from "../components/ui/color-mode"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  event_time?: string | null
  media_urls?: string[]
  location?: string | null
  created_at: string
}

const LIGHT = {
  ink: "#111111",
  inkMuted: "rgba(17,17,17,0.55)",
  bg: "#FFFFFF",
  border: "rgba(17,17,17,0.12)",
}

const DARK = {
  ink: "#f5f5f5",
  inkMuted: "rgba(245,245,245,0.6)",
  bg: "#0a0a0a",
  border: "rgba(255,255,255,0.12)",
}

const TAGS = ["Club", "Music", "Quiz"] as const
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

const SERIF = "'Playfair Display', Georgia, serif"

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
  if (Number.isNaN(d.getTime())) return "6. May 2022"
  const day = d.getDate()
  const month = d.toLocaleDateString("en-GB", { month: "short" })
  const year = d.getFullYear()
  return `${day}. ${month} ${year}`
}

export default function Landing4() {
  const { colorMode, toggleColorMode } = useColorMode()
  const theme = colorMode === "dark" ? DARK : LIGHT

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [items, setItems] = React.useState<EventCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [heroImage, setHeroImage] = React.useState<string | null>(null)
  const [activeTag, setActiveTag] = React.useState<string | null>("Music")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")
  const selectedYear = 2022
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(null)
  const [failedImages, setFailedImages] = React.useState<Record<string, true>>({})

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=24`, { cache: "no-store" })
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

  const hasActiveFilters = activeTag !== null || selectedMonth !== null

  const filteredItems = React.useMemo(() => {
    let list = items
    if (selectedMonth !== null) {
      list = list.filter((e) => {
        const d = new Date(e.event_time || e.created_at)
        return !Number.isNaN(d.getTime()) && d.getMonth() === selectedMonth
      })
    }
    return list.length > 0 ? list : items
  }, [items, selectedMonth])

  return (
    <Box minH="100dvh" bg={theme.bg} color={theme.ink} transition="background-color 0.2s, color 0.2s" position="relative">
      <Box position="fixed" inset="0" bg={theme.bg} zIndex={-1} />
      <Stack maxW="430px" mx="auto" px="5" pt="8" pb="24" gap="8">
        <Box width="100%" aspectRatio="16/10" overflow="hidden" bg={theme.border}>
          {heroImage ? (
            <Image
              src={heroImage}
              alt=""
              width="100%"
              height="100%"
              objectFit="contain"
              filter="grayscale(100%)"
              opacity={colorMode === "dark" ? 0.9 : 1}
            />
          ) : (
            <Box width="100%" height="100%" bg={theme.border} />
          )}
        </Box>

        <Box>
          <Text
            fontSize="xs"
            fontWeight="medium"
            letterSpacing="0.15em"
            color={theme.inkMuted}
            textTransform="uppercase"
            mb="4"
          >
            001 Events
          </Text>
          <Box height="1px" bg={theme.border} mb="6" />
        </Box>

        <Flex align="center" justify="space-between" wrap="wrap" gap="3">
          <Text
            fontSize="xs"
            fontWeight="medium"
            letterSpacing="0.12em"
            color={theme.ink}
            textTransform="uppercase"
          >
            Filter
          </Text>
          {hasActiveFilters && (
            <Flex align="center" gap="3">
              <Text
                as="span"
                fontSize="sm"
                color={theme.inkMuted}
                cursor="pointer"
                onClick={() => setActiveTag(null)}
              >
                ×
              </Text>
              <Text
                fontSize="xs"
                fontWeight="medium"
                letterSpacing="0.1em"
                color={theme.inkMuted}
                textTransform="uppercase"
                cursor="pointer"
                onClick={() => {
                  setActiveTag(null)
                  setSelectedMonth(null)
                }}
              >
                Reset
              </Text>
            </Flex>
          )}
        </Flex>

        <Flex gap="5" wrap="wrap">
          {TAGS.map((tag) => {
            const active = activeTag === tag
            return (
              <Text
                key={tag}
                fontSize="sm"
                fontWeight={active ? "semibold" : "normal"}
                color={theme.ink}
                cursor="pointer"
                letterSpacing="0.02em"
                onClick={() => setActiveTag(active ? null : tag)}
              >
                {tag}
              </Text>
            )
          })}
        </Flex>

        <Box height="1px" bg={theme.border} />

        <Flex align="center" justify="space-between" wrap="wrap" gap="3">
          <Flex gap="5">
            <Text
              fontSize="sm"
              fontWeight={viewMode === "grid" ? "semibold" : "normal"}
              color={theme.ink}
              cursor="pointer"
              letterSpacing="0.02em"
              onClick={() => setViewMode("grid")}
            >
              Grid
            </Text>
            <Text
              fontSize="sm"
              fontWeight={viewMode === "list" ? "semibold" : "normal"}
              color={theme.ink}
              cursor="pointer"
              letterSpacing="0.02em"
              onClick={() => setViewMode("list")}
            >
              List
            </Text>
          </Flex>
          <Text fontSize="sm" color={theme.inkMuted} letterSpacing="0.02em">
            {selectedYear}
          </Text>
        </Flex>

        <Flex gap="3" wrap="wrap" fontSize="xs" color={theme.inkMuted} letterSpacing="0.05em">
          {MONTHS.map((m, i) => {
            const active = selectedMonth === i
            return (
              <Text
                key={m}
                fontWeight={active ? "semibold" : "normal"}
                color={active ? theme.ink : theme.inkMuted}
                cursor="pointer"
                onClick={() => setSelectedMonth(active ? null : i)}
              >
                {m}
              </Text>
            )
          })}
        </Flex>

        <Box height="1px" bg={theme.border} />

        {loading ? (
          <Text fontSize="sm" color={theme.inkMuted} letterSpacing="0.02em">
            Loading…
          </Text>
        ) : viewMode === "grid" ? (
          <Flex gap="6" wrap="wrap" pt="2">
            {filteredItems.slice(0, 8).map((card, idx) => {
              const media = card.media_urls?.find((u) => isLikelyImageUrl(u)) ?? card.media_urls?.[0]
              const imgSrc = resolveMediaUrl(media, apiUrl)
              const titleLine = firstLine(card.title) || firstLine(card.description) || `No. ${idx + 1}`

              return (
                <Box key={card.id} flex="1 1 calc(50% - 12px)" minW="140px" maxW="calc(50% - 12px)">
                  <Box
                    width="100%"
                    aspectRatio="4/3"
                    overflow="hidden"
                    bg={theme.border}
                    mb="3"
                  >
                    {imgSrc && !failedImages[card.id] ? (
                      <Image
                        src={imgSrc}
                        alt={titleLine}
                        width="100%"
                        height="100%"
                        objectFit="contain"
                        onError={() => setFailedImages((prev) => ({ ...prev, [card.id]: true }))}
                      />
                    ) : (
                      <Box width="100%" height="100%" bg={theme.border} />
                    )}
                  </Box>
                  <Text
                    fontFamily={SERIF}
                    fontSize="md"
                    fontWeight="500"
                    color={theme.ink}
                    noOfLines={2}
                    lineHeight="1.25"
                  >
                    {titleLine}
                  </Text>
                  <Text fontSize="xs" color={theme.inkMuted} letterSpacing="0.02em" mt="1">
                    {card.event_time ? formatDate(card.event_time) : formatDate(card.created_at)}
                  </Text>
                  <Text
                    fontSize="xs"
                    color={theme.inkMuted}
                    letterSpacing="0.05em"
                    cursor="pointer"
                    _hover={{ textDecoration: "underline" }}
                    mt="2"
                  >
                    Get ticket
                  </Text>
                </Box>
              )
            })}
          </Flex>
        ) : (
          <Stack gap="10" pt="2">
            {filteredItems.slice(0, 8).map((card, idx) => {
              const media = card.media_urls?.find((u) => isLikelyImageUrl(u)) ?? card.media_urls?.[0]
              const imgSrc = resolveMediaUrl(media, apiUrl)
              const titleLine = firstLine(card.title) || firstLine(card.description) || `No. ${idx + 1}`

              return (
                <Box key={card.id}>
                  <Box
                    width="100%"
                    aspectRatio={idx === 0 ? "16/9" : "21/9"}
                    overflow="hidden"
                    bg={theme.border}
                    mb="4"
                  >
                    {imgSrc && !failedImages[card.id] ? (
                      <Image
                        src={imgSrc}
                        alt={titleLine}
                        width="100%"
                        height="100%"
                        objectFit="contain"
                        onError={() => setFailedImages((prev) => ({ ...prev, [card.id]: true }))}
                      />
                    ) : (
                      <Box width="100%" height="100%" bg={theme.border} />
                    )}
                  </Box>
                  <Flex align="flex-end" justify="space-between" gap="4" flexWrap="wrap">
                    <Stack gap="0" flex="1" minW="0">
                      <Text
                        fontFamily={SERIF}
                        fontSize={idx === 0 ? "2xl" : "xl"}
                        fontWeight="500"
                        color={theme.ink}
                        lineHeight="1.2"
                        noOfLines={2}
                      >
                        {titleLine}
                      </Text>
                      <Text fontSize="sm" color={theme.inkMuted} letterSpacing="0.02em" mt="2">
                        {card.event_time ? formatDate(card.event_time) : formatDate(card.created_at)}
                      </Text>
                    </Stack>
                    <Text
                      fontSize="xs"
                      color={theme.inkMuted}
                      letterSpacing="0.08em"
                      textTransform="uppercase"
                      whiteSpace="nowrap"
                      cursor="pointer"
                      _hover={{ textDecoration: "underline" }}
                    >
                      Get ticket
                    </Text>
                  </Flex>
                  {idx < filteredItems.length - 1 && (
                    <Box height="1px" bg={theme.border} mt="8" />
                  )}
                </Box>
              )
            })}
          </Stack>
        )}
      </Stack>

      <Flex
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        maxW="430px"
        mx="auto"
        px="5"
        py="4"
        align="center"
        justify="space-between"
        bg={theme.bg}
        borderTop="1px solid"
        borderColor={theme.border}
      >
        <Box
          width="8px"
          height="8px"
          borderRadius="full"
          bg={theme.ink}
        />
        <Box
          as="button"
          width="10"
          height="6"
          borderRadius="full"
          bg={theme.inkMuted}
          position="relative"
          onClick={toggleColorMode}
          aria-label="Toggle dark mode"
        >
          <Box
            position="absolute"
            top="1"
            left={colorMode === "dark" ? "5" : "1"}
            width="4"
            height="4"
            borderRadius="full"
            bg={theme.ink}
            transition="left 0.2s ease"
          />
        </Box>
        <Box
          as="span"
          fontSize="lg"
          color={theme.ink}
          cursor="pointer"
          lineHeight="1"
        >
          +
        </Box>
      </Flex>
    </Box>
  )
}
