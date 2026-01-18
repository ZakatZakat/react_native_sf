import * as React from "react"
import { Badge, Box, Button, Dialog, Flex, Image, Portal, Stack, Text } from "@chakra-ui/react"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  message_id: number
  event_time?: string | null
  media_urls?: string[]
  created_at: string
}

type TelegramCreds = {
  login_mode: string
  channel_ids: string[]
  api_id: number
  api_hash_masked: string
  bot_token_masked?: string | null
}

const palette = ["#F9D7C3", "#FFEAB6", "#FFB4A8", "#B7FFD4", "#E6E0FF", "#E0F4FF"]
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"

function isLikelyImageUrl(url: string): boolean {
  const u = url.toLowerCase()
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".webp") || u.endsWith(".gif")
}

function firstLine(text: string | null | undefined): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
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

type EventFilter = {
  key: string
  label: string
  icon: string
  color: string
  keywords: string[]
}

const eventFilters: EventFilter[] = [
  { key: "all", label: "Все", icon: "✨", color: "#111111", keywords: [] },
  { key: "concerts", label: "Концерты", icon: "🎸", color: "#1677FF", keywords: ["концерт", "gig", "live", "выступ", "музы", "band"] },
  { key: "theatre", label: "Театр", icon: "🎭", color: "#722ED1", keywords: ["театр", "спектакл", "пьеса", "постановк"] },
  { key: "party", label: "Вечеринки", icon: "🎧", color: "#EB2F96", keywords: ["вечерин", "rave", "dj", "техно", "house"] },
  { key: "exhibition", label: "Выставки", icon: "🖼️", color: "#13C2C2", keywords: ["выстав", "экспоз", "галере", "museum", "арт", "art"] },
  { key: "lecture", label: "Лекции", icon: "🎤", color: "#FAAD14", keywords: ["лекц", "talk", "meetup", "воркшоп", "мастер", "workshop"] },
  { key: "kids", label: "Детям", icon: "🧸", color: "#52C41A", keywords: ["дет", "семейн", "утренник", "школ", "kids"] },
]

function matchesFilter(event: EventCard, filter: EventFilter): boolean {
  if (filter.key === "all") return true
  const t = `${(event.title ?? "").toLowerCase()}\n${(event.description ?? "").toLowerCase()}\n${event.channel.toLowerCase()}`
  return filter.keywords.some((k) => t.includes(k))
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

export default function Feed() {
  const [items, setItems] = React.useState<EventCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creds, setCreds] = React.useState<TelegramCreds | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<string | null>(null)
  const [syncing, setSyncing] = React.useState(false)
  const [syncError, setSyncError] = React.useState<string | null>(null)
  const [failedImages, setFailedImages] = React.useState<Record<string, true>>({})
  const [activeFilterKey, setActiveFilterKey] = React.useState<string>("all")
  const [selected, setSelected] = React.useState<EventCard | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const showDebug = React.useMemo(() => {
    if (typeof window === "undefined") return false
    try {
      return new URLSearchParams(window.location.search).has("debug")
    } catch {
      return false
    }
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [eventsRes, credsRes] = await Promise.all([
        fetch(`${apiUrl}/events?limit=20`, { cache: "no-store" }),
        fetch(`${apiUrl}/debug/telegram-creds`, { cache: "no-store" }),
      ])
      if (!eventsRes.ok) throw new Error(`events status ${eventsRes.status}`)
      const data: EventCard[] = await eventsRes.json()
      setItems(data)
      if (credsRes.ok) {
        const credsData: TelegramCreds = await credsRes.json()
        setCreds(credsData)
      }
      setLastUpdatedAt(new Date().toISOString())
      setSyncError(null)
    } catch (err) {
      console.error("fetch events", err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const syncFromTelegram = React.useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(
        `${apiUrl}/debug/telegram-fetch-recent?per_channel_limit=5&pause_between_channels_seconds=1.2&pause_between_messages_seconds=0.05`,
        { method: "POST" },
      )
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { detail?: unknown } | null
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null
        throw new Error(detail ? `status ${res.status}: ${detail}` : `status ${res.status}`)
      }
      await load()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Не удалось синхронизироваться")
    } finally {
      setSyncing(false)
    }
  }, [load])

  const filteredItems = React.useMemo(() => {
    const f = eventFilters.find((x) => x.key === activeFilterKey) ?? eventFilters[0]
    return items.filter((e) => matchesFilter(e, f))
  }, [items, activeFilterKey])

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
    const text = (selected.description ?? selected.title ?? "").trim()
    return text
  }, [selected])

  const selectedImgSrc = React.useMemo(() => {
    if (!selected) return null
    const media = selected.media_urls?.find((u) => isLikelyImageUrl(u)) ?? selected.media_urls?.[0]
    const raw = resolveMediaUrl(media, apiUrl)
    return raw && isLikelyImageUrl(raw) ? raw : null
  }, [selected])

  const selectedAiRating = React.useMemo(() => {
    if (!selected) return null
    return aiRatingForId(selected.id)
  }, [selected])

  return (
    <Box
      minH="100dvh"
      bg="#FFFFFF"
      color="#0F0F0F"
      fontFamily="system-ui"
      pb="10"
    >
      <Stack gap="4" px="4" pt="4" maxW="430px" mx="auto">
        <Flex align="center" justify="space-between" gap="3">
          <Text fontSize="lg" fontWeight="semibold" letterSpacing="-0.2px">
            AI-Picks for You
          </Text>
          <Flex gap="2">
            <Button size="sm" variant="outline" borderColor="rgba(0,0,0,0.14)" onClick={load} loading={loading}>
              Обновить
            </Button>
            <Button size="sm" bg="#0F0F0F" color="white" onClick={syncFromTelegram} loading={syncing}>
              Забрать из TG
            </Button>
          </Flex>
        </Flex>

        <Flex align="center" gap="2" wrap="wrap">
          <Badge borderRadius="full" px="3" py="1" bg="rgba(0,0,0,0.06)" color="#111" textTransform="none">
            Москва
          </Badge>
          {lastUpdatedAt ? (
            <Text fontSize="xs" color="rgba(0,0,0,0.55)">
              Обновлено: {new Date(lastUpdatedAt).toLocaleString()}
            </Text>
          ) : null}
          {syncError ? (
            <Text fontSize="xs" color="red.600">
              {syncError}
            </Text>
          ) : null}
        </Flex>

        {showDebug && creds ? (
          <Box border="1px solid rgba(0,0,0,0.12)" borderRadius="xl" bg="rgba(0,0,0,0.02)" p="3">
            <Text fontWeight="semibold" mb="2">
              Debug: Telegram creds (masked)
            </Text>
            <Stack fontSize="sm" color="#222" gap="1">
              <Text>login_mode: {creds.login_mode}</Text>
              <Text>channels: {creds.channel_ids.join(", ")}</Text>
              <Text>api_id: {creds.api_id}</Text>
              <Text>api_hash: {creds.api_hash_masked}</Text>
              {creds.bot_token_masked ? <Text>bot_token: {creds.bot_token_masked}</Text> : null}
            </Stack>
          </Box>
        ) : null}

        {loading ? <Text color="rgba(0,0,0,0.55)">Загружаем...</Text> : null}

        {!loading ? (
          <>
            <Box>
              <Text fontSize="xs" fontWeight="semibold" color="rgba(0,0,0,0.55)" mb="2" letterSpacing="0.2px">
                ФИЛЬТРЫ
              </Text>
              <Flex gap="8px" wrap="wrap">
                {eventFilters.map((f, i) => {
                  const active = f.key === activeFilterKey
                  const floatClass = i % 2 === 0 ? "tg-float-1" : "tg-float-2"
                  const floatDurationSec = 5.4 + (i % 4) * 0.6
                  const floatDelaySec = ((i * 0.19) % 1.5) * -1
                  return (
                    <Box
                      key={f.key}
                      className={floatClass}
                      style={{
                        animationDuration: `${floatDurationSec}s`,
                        animationDelay: `${floatDelaySec}s`,
                      }}
                    >
                      <Flex
                        align="center"
                        gap="1.5"
                        borderRadius="full"
                        px="2.5"
                        py="1.5"
                        bg={active ? "#0F0F0F" : "white"}
                        border="1px solid rgba(0,0,0,0.10)"
                        boxShadow={active ? "0 8px 18px rgba(0,0,0,0.16)" : "0 6px 14px rgba(0,0,0,0.07)"}
                        cursor="pointer"
                        onClick={() => setActiveFilterKey(f.key)}
                        maxW="100%"
                      >
                        <Flex
                          width="22px"
                          height="22px"
                          borderRadius="full"
                          align="center"
                          justify="center"
                          bg={f.color}
                          flex="0 0 auto"
                        >
                          <Text fontSize="xs" lineHeight="1" color="white">
                            {f.icon}
                          </Text>
                        </Flex>
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color={active ? "white" : "#0F0F0F"}
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {f.label}
                        </Text>
                      </Flex>
                    </Box>
                  )
                })}
              </Flex>
            </Box>

            <Flex align="flex-start" gap="18px" pt="2">
            {(() => {
              const split = Math.ceil(filteredItems.length / 2)
              const left = filteredItems.slice(0, split)
              const right = filteredItems.slice(split)

              const renderCard = (card: EventCard, idxInCol: number, col: 0 | 1) => {
                const media = card.media_urls?.find((u) => isLikelyImageUrl(u)) ?? card.media_urls?.[0]
                const rawSrc = resolveMediaUrl(media, apiUrl)
                const imgSrc = rawSrc && isLikelyImageUrl(rawSrc) ? rawSrc : null
                const color = palette[(idxInCol + (col === 1 ? 3 : 0)) % palette.length]
                const titleLine = firstLine(card.title) || firstLine(card.description) || "Событие"
                const aiRating = aiRatingForId(card.id)

                const base = col === 0 ? -2.2 : 2.0
                const tilt = idxInCol % 2 === 0 ? base : -base * 0.85
                const floatClass = (idxInCol + col) % 2 === 0 ? "tg-float-1" : "tg-float-2"
                const floatDurationSec = 6.2 + ((idxInCol + col) % 4) * 0.7
                const floatDelaySec = ((idxInCol * 0.23 + col * 0.41) % 1.4) * -1

                return (
                  <Box
                    key={card.id}
                    className={floatClass}
                    style={{
                      animationDuration: `${floatDurationSec}s`,
                      animationDelay: `${floatDelaySec}s`,
                    }}
                  >
                    <Box
                      width="100%"
                      borderRadius="2xl"
                      overflow="hidden"
                      bg="#FFFFFF"
                      border="1px solid rgba(0,0,0,0.10)"
                      boxShadow="0 6px 18px rgba(0,0,0,0.06)"
                      cursor="pointer"
                      onClick={() => openDetails(card)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openDetails(card)
                      }}
                      tabIndex={0}
                      style={{
                        transform: `rotate(${tilt}deg)`,
                        transformOrigin: "center",
                      }}
                    >
                    {imgSrc && !failedImages[card.id] ? (
                      <Image
                        src={imgSrc}
                        alt={titleLine}
                        width="100%"
                        height="auto"
                        objectFit="cover"
                        onError={() => {
                          setFailedImages((prev) => ({ ...prev, [card.id]: true }))
                        }}
                      />
                    ) : (
                      <Box bg={color} height="120px" />
                    )}

                    <Box px="3" pt="3" pb="3">
                      <Flex mb="2" align="center" gap="2" wrap="wrap">
                        <Box
                          borderRadius="full"
                          border="1px solid rgba(255,255,255,0.14)"
                          px="2.5"
                          py="1"
                          bg="#0F0F0F"
                          maxW="100%"
                        >
                          <Text
                            fontSize="xs"
                            fontWeight="semibold"
                            color="white"
                            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          >
                            {card.channel}
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
                        {titleLine}
                      </Text>

                      <Box mt="2">
                        <StarRating value={aiRating} />
                      </Box>
                    </Box>
                    </Box>
                  </Box>
                )
              }

              return (
                <>
                  <Stack flex="1" gap="12px">
                    {left.map((card, idxInCol) => renderCard(card, idxInCol, 0))}
                  </Stack>
                  <Stack flex="1" gap="12px">
                    {right.map((card, idxInCol) => renderCard(card, idxInCol, 1))}
                  </Stack>
                </>
              )
            })()}
          </Flex>
          </>
        ) : null}
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
                        {selected.channel}
                      </Text>
                    </Box>
                  ) : null}

                  {selectedAiRating != null ? <StarRating value={selectedAiRating} /> : null}

                  <Text fontSize="sm" color="rgba(0,0,0,0.85)" whiteSpace="pre-wrap">
                    {selectedBodyText}
                  </Text>
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




