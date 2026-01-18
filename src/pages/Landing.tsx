import * as React from "react"
import { Box, Button, Dialog, Flex, Image, Portal, Stack, Text } from "@chakra-ui/react"
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

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]
}

function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return h
}

function aiRatingForId(id: string): number {
  const h = Math.abs(hashSeed(id))
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

function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function chooseLandingCards(all: EventCard[], seed: number): EventCard[] {
  const rng = mulberry32(seed)
  const score = (e: EventCard): number => {
    const textLen = (firstLine(e.title).length + (e.description ?? "").length) | 0
    const diversity = Math.min(140, textLen) / 10
    return diversity + rng() * 0.6
  }

  const shuffled = [...all].sort((a, b) => score(b) - score(a))
  const out: EventCard[] = []
  const usedChannels = new Set<string>()

  for (const e of shuffled) {
    if (out.length >= 3) break
    if (usedChannels.has(e.channel)) continue
    out.push(e)
    usedChannels.add(e.channel)
  }

  if (out.length < 3) {
    for (const e of shuffled) {
      if (out.length >= 3) break
      if (out.some((x) => x.id === e.id)) continue
      out.push(e)
    }
  }

  return out.slice(0, 3)
}

function aiRecommendation(card: EventCard): { author: string; meta: string; text: string } {
  const seed = hashSeed(card.id)
  const author = pick(["Tanim", "Ratul", "Jahin", "Sasha", "Mila", "Artem"] as const, seed)
  const meta = pick(["just now", "5m", "12m", "1h"] as const, seed >> 3)
  const base = firstLine(card.title) || firstLine(card.description) || "Ивент"
  const templates = [
    `ИИ‑бот (как пользователь) советует: присмотрись к «${base}» — выглядит как хороший повод выбраться из дома.`,
    `Написано ИИ‑ботом от лица пользователя: «${base}» — я бы сходил(а), звучит живо и без скуки.`,
    `Рекомендация от ИИ‑бота (симуляция пользователя): «${base}». Сохрани и проверь даты/место.`,
  ] as const
  return { author, meta, text: pick(templates, seed >> 7) }
}

export default function Landing() {
  const [allWithImages, setAllWithImages] = React.useState<EventCard[]>([])
  const [variant, setVariant] = React.useState<number>(() => hashSeed(new Date().toISOString().slice(0, 10)))
  const [loading, setLoading] = React.useState(true)
  const [failedImages, setFailedImages] = React.useState<Record<string, true>>({})
  const [selected, setSelected] = React.useState<EventCard | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=60`, { cache: "no-store" })
        if (!res.ok) throw new Error(`events status ${res.status}`)
        const data: EventCard[] = await res.json()
        const withImages = data
          .filter((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
          .filter((e) => firstLine(e.title).length >= 6 || (e.description ?? "").length >= 40)
        setAllWithImages(withImages)
      } catch (e) {
        console.error("landing load", e)
        setAllWithImages([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = React.useMemo(() => chooseLandingCards(allWithImages, variant), [allWithImages, variant])

  const preview = cards.map((c) => {
    const media = c.media_urls?.find((u) => isLikelyImageUrl(u)) ?? c.media_urls?.[0]
    const raw = resolveMediaUrl(media, apiUrl)
    return { card: c, img: raw && isLikelyImageUrl(raw) ? raw : null }
  })

  const openDetails = React.useCallback((card: EventCard) => {
    setSelected(card)
    setDetailsOpen(true)
  }, [])

  const selectedTitleLine = React.useMemo(() => {
    if (!selected) return "Событие"
    return firstLine(selected.title) || firstLine(selected.description) || "Событие"
  }, [selected])

  const selectedBodyText = React.useMemo(() => {
    if (!selected) return ""
    return (selected.description ?? selected.title ?? "").trim()
  }, [selected])

  const selectedImgSrc = React.useMemo(() => {
    if (!selected) return null
    const media = selected.media_urls?.find((u) => isLikelyImageUrl(u)) ?? selected.media_urls?.[0]
    const raw = resolveMediaUrl(media, apiUrl)
    return raw && isLikelyImageUrl(raw) ? raw : null
  }, [selected])

  const selectedAiReview = React.useMemo(() => {
    if (!selected) return null
    return aiRecommendation(selected)
  }, [selected])

  const selectedAiRating = React.useMemo(() => {
    if (!selected) return null
    return aiRatingForId(selected.id)
  }, [selected])

  return (
    <Box
      minH="100dvh"
      bg="#D8DEE3"
      color="#0F0F0F"
      fontFamily="system-ui"
      pb="10"
    >
      <Stack gap="4" px="4" pt="5" maxW="430px" mx="auto">
        <Text fontSize="md" fontWeight="semibold" color="rgba(0,0,0,0.75)">
          Casapolino
        </Text>

        <Text fontSize="4xl" fontWeight="semibold" lineHeight="0.95" letterSpacing="-0.6px">
          Hey!
          <br />
          What you upto?
        </Text>

        <Flex align="center" justify="space-between" gap="3">
          <Flex gap="2" bg="rgba(255,255,255,0.55)" p="1" borderRadius="full">
            <Box px="3" py="1.5" borderRadius="full" bg="white" fontSize="sm" fontWeight="semibold">
              Post
            </Box>
            <Box px="3" py="1.5" borderRadius="full" color="rgba(0,0,0,0.65)" fontSize="sm" fontWeight="semibold">
              Creator
            </Box>
          </Flex>
          <Flex gap="2">
            <Button
              size="sm"
              variant="outline"
              borderColor="rgba(0,0,0,0.14)"
              bg="rgba(255,255,255,0.65)"
              onClick={() => setVariant(Date.now())}
            >
              Другие
            </Button>
            <Box
              w="10"
              h="10"
              borderRadius="full"
              bg="rgba(255,255,255,0.65)"
              display="grid"
              placeItems="center"
              fontSize="lg"
              color="rgba(0,0,0,0.65)"
            >
              ⌕
            </Box>
            <Box
              w="10"
              h="10"
              borderRadius="full"
              bg="rgba(255,255,255,0.65)"
              display="grid"
              placeItems="center"
              fontSize="lg"
              color="rgba(0,0,0,0.65)"
            >
              ⋯
            </Box>
          </Flex>
        </Flex>

        <Box position="relative" minH="520px" mt="0">
          {loading ? (
            <Text color="rgba(0,0,0,0.55)">Загружаем…</Text>
          ) : preview.length < 3 ? (
            <Box
              borderRadius="2xl"
              bg="rgba(255,255,255,0.6)"
              border="1px solid rgba(0,0,0,0.08)"
              p="4"
            >
              <Text fontWeight="semibold">Недостаточно постов с картинками</Text>
              <Text fontSize="sm" color="rgba(0,0,0,0.6)" mt="1">
                Нажми «Забрать из TG», затем вернись сюда.
              </Text>
              <RouterLink to="/feed">
                <Button mt="3" bg="#0F0F0F" color="white">
                  Перейти в ленту
                </Button>
              </RouterLink>
            </Box>
          ) : (
            <>
              {/* Back/base card */}
              {(() => {
                const p = preview[0]
                const rec = aiRecommendation(p.card)
                return (
                  <Box
                    position="absolute"
                    left="0"
                    right="0"
                    top="10px"
                    mx="auto"
                    width="92%"
                    borderRadius="2xl"
                    overflow="hidden"
                    bg="white"
                    border="1px solid rgba(0,0,0,0.10)"
                    boxShadow="0 20px 40px rgba(0,0,0,0.12)"
                    transform="rotate(-2.5deg)"
                    cursor="pointer"
                    onClick={() => openDetails(p.card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openDetails(p.card)
                    }}
                    tabIndex={0}
                  >
                    <Box p="4">
                      <Flex align="center" gap="2" mb="2">
                        <Box w="7" h="7" borderRadius="full" bg="rgba(0,0,0,0.08)" display="grid" placeItems="center">
                          🤖
                        </Box>
                        <Text fontSize="xs" fontWeight="semibold" color="rgba(0,0,0,0.75)">
                          {rec.author}
                        </Text>
                        <Text fontSize="xs" color="rgba(0,0,0,0.45)">
                          • {rec.meta}
                        </Text>
                      </Flex>
                      <Text fontSize="lg" fontWeight="semibold" lineHeight="1.1">
                        {rec.text}
                      </Text>
                      <Text fontSize="xs" color="rgba(0,0,0,0.55)" mt="2">
                        {p.card.channel} • #{p.card.message_id}
                      </Text>
                    </Box>
                    {p.img && !failedImages[p.card.id] ? (
                      <Image
                        src={p.img}
                        alt={p.card.title}
                        width="100%"
                        height="220px"
                        objectFit="cover"
                        onError={() => {
                          setFailedImages((prev) => ({ ...prev, [p.card.id]: true }))
                        }}
                      />
                    ) : null}
                  </Box>
                )
              })()}

              {/* Middle card */}
              {(() => {
                const p = preview[1]
                const rec = aiRecommendation(p.card)
                return (
                  <Box
                    position="absolute"
                    right="-6px"
                    top="105px"
                    width="78%"
                    borderRadius="2xl"
                    overflow="hidden"
                    bg="#F4A8DE"
                    border="1px solid rgba(0,0,0,0.10)"
                    boxShadow="0 22px 42px rgba(0,0,0,0.14)"
                    transform="rotate(10deg)"
                    className="tg-float-1"
                    style={{ animationDuration: "7.5s", animationDelay: "-1.2s" }}
                    cursor="pointer"
                    onClick={() => openDetails(p.card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openDetails(p.card)
                    }}
                    tabIndex={0}
                  >
                    <Box p="4">
                      <Flex align="center" gap="2" mb="2">
                        <Box w="6" h="6" borderRadius="full" bg="rgba(0,0,0,0.10)" display="grid" placeItems="center">
                          🤖
                        </Box>
                        <Text fontSize="xs" fontWeight="semibold" color="rgba(0,0,0,0.75)">
                          {rec.author}
                        </Text>
                        <Text fontSize="xs" color="rgba(0,0,0,0.45)">
                          • {rec.meta}
                        </Text>
                      </Flex>
                      <Text fontSize="md" fontWeight="semibold" lineHeight="1.15">
                        {rec.text.slice(0, 115)}
                      </Text>
                      <Text fontSize="xs" color="rgba(0,0,0,0.6)" mt="2">
                        {p.card.channel} • #{p.card.message_id}
                      </Text>
                    </Box>
                    {p.img && !failedImages[p.card.id] ? (
                      <Image
                        src={p.img}
                        alt={p.card.title}
                        width="100%"
                        height="160px"
                        objectFit="cover"
                        onError={() => {
                          setFailedImages((prev) => ({ ...prev, [p.card.id]: true }))
                        }}
                      />
                    ) : null}
                  </Box>
                )
              })()}

              {/* Front card */}
              {(() => {
                const p = preview[2]
                const rec = aiRecommendation(p.card)
                return (
                  <Box
                    position="absolute"
                    left="-4px"
                    top="225px"
                    width="84%"
                    borderRadius="2xl"
                    overflow="hidden"
                    bg="#3ED47C"
                    border="1px solid rgba(0,0,0,0.10)"
                    boxShadow="0 22px 42px rgba(0,0,0,0.14)"
                    transform="rotate(-12deg)"
                    className="tg-float-2"
                    style={{ animationDuration: "8.1s", animationDelay: "-0.6s" }}
                    cursor="pointer"
                    onClick={() => openDetails(p.card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openDetails(p.card)
                    }}
                    tabIndex={0}
                  >
                    <Box p="4">
                      <Flex align="center" gap="2" mb="2">
                        <Box w="6" h="6" borderRadius="full" bg="rgba(0,0,0,0.10)" display="grid" placeItems="center">
                          🤖
                        </Box>
                        <Text fontSize="xs" fontWeight="semibold" color="rgba(0,0,0,0.75)">
                          {rec.author}
                        </Text>
                        <Text fontSize="xs" color="rgba(0,0,0,0.45)">
                          • {rec.meta}
                        </Text>
                      </Flex>
                      <Text fontSize="md" fontWeight="semibold" lineHeight="1.15">
                        {rec.text.slice(0, 115)}
                      </Text>
                      <Text fontSize="xs" color="rgba(0,0,0,0.6)" mt="2">
                        {p.card.channel} • #{p.card.message_id}
                      </Text>
                    </Box>
                    {p.img && !failedImages[p.card.id] ? (
                      <Image
                        src={p.img}
                        alt={p.card.title}
                        width="100%"
                        height="160px"
                        objectFit="cover"
                        onError={() => {
                          setFailedImages((prev) => ({ ...prev, [p.card.id]: true }))
                        }}
                      />
                    ) : null}
                  </Box>
                )
              })()}
            </>
          )}
        </Box>

        <RouterLink to="/feed">
          <Button bg="#0F0F0F" color="white" borderRadius="full" mt="6">
            Открыть ленту
          </Button>
        </RouterLink>
      </Stack>

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
                  <Text fontWeight="black" letterSpacing="-0.3px">
                    {selectedTitleLine}
                  </Text>
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="3">
                  <Box borderRadius="xl" overflow="hidden" border="1px solid rgba(0,0,0,0.10)">
                    {selectedImgSrc && selected && !failedImages[selected.id] ? (
                      <Image
                        src={selectedImgSrc}
                        alt={selected.title}
                        width="100%"
                        height="auto"
                        objectFit="cover"
                        onError={() => {
                          if (!selected) return
                          setFailedImages((prev) => ({ ...prev, [selected.id]: true }))
                        }}
                      />
                    ) : (
                      <Box bg="rgba(0,0,0,0.06)" height="220px" />
                    )}
                  </Box>

                  {selected?.channel ? (
                    <Box
                      alignSelf="flex-start"
                      borderRadius="full"
                      border="1px solid rgba(255,255,255,0.14)"
                      px="3"
                      py="1.5"
                      bg="#0F0F0F"
                      maxW="100%"
                    >
                      <Text
                        fontSize="xs"
                        fontWeight="semibold"
                        color="white"
                        style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {selected.channel} • #{selected.message_id}
                      </Text>
                    </Box>
                  ) : null}

                  {selectedAiRating != null ? <StarRating value={selectedAiRating} /> : null}

                  <Text fontSize="sm" color="rgba(0,0,0,0.85)" whiteSpace="pre-wrap">
                    {selectedBodyText}
                  </Text>

                  {selectedAiReview ? (
                    <Box borderRadius="xl" border="1px solid rgba(0,0,0,0.10)" bg="rgba(0,0,0,0.02)" p="3">
                      <Flex align="center" gap="2" mb="2">
                        <Box w="7" h="7" borderRadius="full" bg="rgba(0,0,0,0.08)" display="grid" placeItems="center">
                          🤖
                        </Box>
                        <Text fontSize="sm" fontWeight="semibold" color="rgba(0,0,0,0.85)">
                          Отзыв ИИ (симуляция пользователя)
                        </Text>
                        <Text fontSize="sm" color="rgba(0,0,0,0.45)">
                          • {selectedAiReview.meta}
                        </Text>
                      </Flex>
                      <Text fontSize="sm" color="rgba(0,0,0,0.85)" whiteSpace="pre-wrap">
                        {selectedAiReview.text}
                      </Text>
                    </Box>
                  ) : null}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button bg="#0F0F0F" color="white" onClick={() => setDetailsOpen(false)}>
                  Закрыть
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  )
}


