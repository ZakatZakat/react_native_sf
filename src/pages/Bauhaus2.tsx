import * as React from "react"
import { Badge, Box, Dialog, Flex, Image, Portal, Stack, Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"

const PRIMARY = "#2D2A8C"
const PRIMARY_BORDER = "rgba(45,42,140,0.28)"
const BG = "#FFFFFF"

const likeBurst = keyframes`
  0% {
    transform: scale(0.7);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.7);
    opacity: 0;
  }
`

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  media_urls?: string[]
  created_at: string
}

export default function Bauhaus2() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [items, setItems] = React.useState<EventCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selected, setSelected] = React.useState<EventCard | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [likedIds, setLikedIds] = React.useState<Set<string>>(() => new Set())
  const [burstId, setBurstId] = React.useState<string | null>(null)
  const [shortImageIds, setShortImageIds] = React.useState<Set<string>>(() => new Set())

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=100`, { cache: "no-store" })
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

  const list = loading ? [] : items.filter((e) => e.media_urls?.some((u) => isLikelyImageUrl(u)))
  const openDetails = (item: EventCard) => {
    setSelected(item)
    setDetailsOpen(true)
  }
  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setBurstId(id)
    window.setTimeout(() => setBurstId((current) => (current === id ? null : current)), 420)
  }

  return (
    <Box minH="100dvh" bg={BG} color={PRIMARY}>
      <Box
        height="100dvh"
        overflowY="auto"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {loading ? (
          <Box minH="100dvh" display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="sm" color="rgba(45,42,140,0.7)">
              Загружаем события…
            </Text>
          </Box>
        ) : list.length === 0 ? (
          <Box minH="100dvh" display="flex" alignItems="center" justifyContent="center">
            <Text fontSize="sm" color="rgba(45,42,140,0.7)">
              Пока нет событий
            </Text>
          </Box>
        ) : (
          list.map((item, idx) => {
            const media = item.media_urls?.find((u) => isLikelyImageUrl(u))
            const src = resolveMediaUrl(media, apiUrl)
            const title = firstLine(item.title) || "Событие"
            return (
              <Box
                key={item.id}
                minH="100dvh"
                display="flex"
                flexDirection="column"
                position="relative"
                px="5"
                pt="3"
                pb="calc(132px + env(safe-area-inset-bottom))"
                style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
              >
                <Box
                  flex="0 0 auto"
                  height="auto"
                  mt="-2"
                  border="none"
                  borderRadius="2xl"
                  overflow="hidden"
                  bg="transparent"
                  display="flex"
                  alignItems="flex-start"
                  justifyContent="center"
                  cursor="pointer"
                  onClick={() => openDetails(item)}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt={title}
                      width="100%"
                      height="auto"
                      maxH={{ base: "48dvh", sm: "52dvh", md: "56dvh" }}
                      objectFit="contain"
                      objectPosition="top center"
                      px={{ base: "2", sm: "3" }}
                      pt={{ base: "1", sm: "2" }}
                      pb="0"
                      onLoad={(e) => {
                        const { naturalWidth, naturalHeight } = e.currentTarget
                        if (!naturalWidth || !naturalHeight) return
                        const isShort = naturalWidth / naturalHeight >= 1.4
                        setShortImageIds((prev) => {
                          const next = new Set(prev)
                          if (isShort) {
                            next.add(item.id)
                          } else {
                            next.delete(item.id)
                          }
                          return next
                        })
                      }}
                    />
                  ) : (
                    <Box width="100%" height="100%" bg="rgba(45,42,140,0.10)" />
                  )}
                </Box>

                <Stack gap="2.5" pt="3">
                  <Flex gap="2" align="center" wrap="wrap">
                    <Badge
                      border={`1px solid ${PRIMARY}`}
                      borderRadius="sm"
                      px="2"
                      py="0.5"
                      fontSize="10px"
                      bg="white"
                      color={PRIMARY}
                    >
                      {item.channel.replace(/^@/, "").toUpperCase().slice(0, 14) || "EVENT"}
                    </Badge>
                    <Text fontSize="xs" color="rgba(45,42,140,0.6)">
                      {idx + 1} / {list.length}
                    </Text>
                  </Flex>
                  <Text
                    fontWeight="semibold"
                    fontSize={shortImageIds.has(item.id) ? "4xl" : "2xl"}
                    lineHeight="1.1"
                    cursor="pointer"
                    onClick={() => openDetails(item)}
                    noOfLines={2}
                  >
                    {title}
                  </Text>
                  {item.description ? (
                    <Text fontSize={shortImageIds.has(item.id) ? "lg" : "sm"} color="rgba(45,42,140,0.8)">
                      {truncateText(item.description, 240)}
                    </Text>
                  ) : null}
                  <Text fontSize="sm" color={PRIMARY} fontWeight="semibold">
                    Посмотреть ивент
                  </Text>
                </Stack>
                <Box
                  position="absolute"
                  right="20px"
                  bottom="calc(72px + env(safe-area-inset-bottom))"
                  width="52px"
                  height="52px"
                  borderRadius="full"
                  border={`1px solid ${PRIMARY}`}
                  bg={likedIds.has(item.id) ? PRIMARY : "white"}
                  color={likedIds.has(item.id) ? "white" : PRIMARY}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onClick={() => toggleLike(item.id)}
                >
                  <Text fontSize="lg">♥</Text>
                  {burstId === item.id ? (
                    <Box
                      position="absolute"
                      inset="0"
                      borderRadius="full"
                      border={`1px solid ${PRIMARY}`}
                      animation={`${likeBurst} 420ms ease-out`}
                    />
                  ) : null}
                </Box>
              </Box>
            )
          })
        )}
      </Box>
      <Dialog.Root open={detailsOpen} onOpenChange={(d) => setDetailsOpen(d.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content
              borderRadius="2xl"
              overflow="hidden"
              maxW="min(92vw, 420px)"
              mx="auto"
              boxShadow="0 24px 60px rgba(0,0,0,0.28)"
            >
              <Dialog.CloseTrigger />
              <Dialog.Header>
                <Dialog.Title>
                  <Text fontWeight="black" letterSpacing="-0.3px" color={PRIMARY}>
                    {selected ? firstLine(selected.title) || "Событие" : "Событие"}
                  </Text>
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="3">
                  {selected ? (
                    <Box borderRadius="xl" overflow="hidden" border="1px solid rgba(0,0,0,0.10)">
                      {(() => {
                        const media = selected.media_urls?.find((u) => isLikelyImageUrl(u))
                        const src = resolveMediaUrl(media, apiUrl)
                        return src ? (
                          <Image src={src} alt={selected.title} width="100%" height="auto" objectFit="contain" />
                        ) : (
                          <Box bg="rgba(45,42,140,0.10)" height="220px" />
                        )
                      })()}
                    </Box>
                  ) : null}
                  {selected?.description ? (
                    <Text fontSize="sm" color="rgba(45,42,140,0.85)" whiteSpace="pre-wrap">
                      {selected.description}
                    </Text>
                  ) : null}
                </Stack>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
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

function truncateText(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}
