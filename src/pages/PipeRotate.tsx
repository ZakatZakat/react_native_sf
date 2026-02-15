import { useState, useCallback, useRef, useEffect } from "react"
import { Box, Button, Flex, Text, Image } from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"
import { API, type EventCard as ApiEventCard, PageWipe, PIPE_ROTATE_STORAGE, isImg, resolveMedia } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

const STORAGE_KEY = PIPE_ROTATE_STORAGE

function channelThumb(name: string): string {
  const slug = name.replace(/^@/, "").slice(0, 20)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(slug)}&size=80&background=0055FF&color=fff&bold=true`
}

function channelAvatarUrl(name: string): string {
  const slug = name.replace(/^@/, "").trim()
  return `${API}/debug/channel-avatar?channel=${encodeURIComponent(slug)}`
}

function channelDirectMediaUrl(name: string): string {
  const slug = name.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().slice(0, 64)
  return `${API}/media/channel_avatar_${slug}.jpg`
}

function channelImageSrc(ch: ChannelItem, _isEco: boolean): string {
  if (ch.thumb) return ch.thumb
  return channelDirectMediaUrl(ch.name)
}

type ChannelItem = { name: string; subs: string; thumb?: string }

type UserClass = {
  id: string
  label: string
  desc: string
  icon: string
  rotation: number
  available: boolean
  channels: ChannelItem[]
  events: { title: string; date: string }[]
  stat: string
}

const USER_CLASSES: UserClass[] = [
  {
    id: "eco", label: "Эко-энтузиаст", icon: "🌿", rotation: -1.2, available: false,
    desc: "В разработке",
    channels: [],
    events: [],
    stat: "В разработке",
  },
  {
    id: "business", label: "Бизнес", icon: "💼", rotation: 0.8, available: false,
    desc: "В разработке",
    channels: [],
    events: [],
    stat: "В разработке",
  },
  {
    id: "parties", label: "Тусовщик Москвы", icon: "🎧", rotation: -0.6, available: false,
    desc: "В разработке",
    channels: [],
    events: [],
    stat: "В разработке",
  },
  {
    id: "exhibitions", label: "Выставки", icon: "🖼", rotation: 1.2, available: false,
    desc: "В разработке",
    channels: [],
    events: [],
    stat: "В разработке",
  },
]

type InterestEvent = { id?: string; title: string; date: string; media_urls?: string[] }

type EcoInterest = {
  id: string
  label: string
  icon: string
  keywords: string[]
  channels: ChannelItem[]
  events: InterestEvent[]
  stat: string
}

const ECO_INTEREST_GROUPS: {
  id: string
  label: string
  icon: string
  keywords: string[]
  channelNames: string[]
  events: { title: string; date: string }[]
}[] = [
  {
    id: "upcycle", label: "Upcycle одежда", icon: "♻️",
    keywords: ["upcycle", "апсайкл", "переработк", "second hand"],
    channelNames: ["constructor_brand", "exclusive_art_upcycling", "hodveshey", "dmsk_bag", "melme"],
    events: [
      { title: "Swap Party Artplay", date: "15 мар" },
      { title: "Upcycle Мастерская", date: "20 мар" },
      { title: "Second Hand Pop-Up", date: "1 апр" },
    ],
  },
  {
    id: "fairs", label: "Фэры и маркеты", icon: "🛒",
    keywords: ["фэр", "маркет", "ярмарк", "блошинг", "fleamarket"],
    channelNames: ["swop_market_msk", "tutryadom", "beindvz"],
    events: [
      { title: "Ламбада-маркет", date: "кажд. вс" },
      { title: "Хлебозавод Fair", date: "22 мар" },
      { title: "Garage Sale", date: "5 апр" },
    ],
  },
  {
    id: "niche", label: "Нишевые бренды", icon: "🏷",
    keywords: ["sustainable", "эко", "локальн", "handmade"],
    channelNames: ["skrvshch", "syyyyyyyr", "yergaworkshop", "zelenyy_syr"],
    events: [
      { title: "Local Brands Market", date: "10 мар" },
      { title: "Handmade Expo", date: "28 мар" },
      { title: "Slow Fashion Meetup", date: "12 апр" },
    ],
  },
]

const MONTHS = "янв фев мар апр май июн июл авг сен окт ноя дек".split(" ")

function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ""}`
  } catch {
    return "—"
  }
}

function buildEcoInterests(
  ecoChannels: ChannelItem[] | null,
  ecoEvents: ApiEventCard[] | null
): EcoInterest[] {
  const norm = (s: string) => s.replace(/^@/, "").toLowerCase()
  return ECO_INTEREST_GROUPS.map((g) => {
    const channels = ecoChannels
      ? ecoChannels.filter((c) => g.channelNames.includes(norm(c.name)))
      : []
    const channelSet = new Set(g.channelNames.map((c) => c.toLowerCase()))
    const groupEvents =
      ecoEvents === null
        ? []
        : ecoEvents
            .filter((e) => channelSet.has(norm(e.channel)))
            .slice(0, SLOTS)
            .map((e) => ({
              id: e.id,
              title: e.title || "Без названия",
              date: formatEventDate(e.event_time ?? e.created_at),
              media_urls: e.media_urls,
            }))
    const events = groupEvents
    return {
      ...g,
      channels,
      events,
      stat: `${channels.length} каналов`,
    }
  })
}

const SLOTS = 6
const SLOT_ROTATE_MS = 5000

function RotatingSlots<T extends { id?: string; name?: string; title?: string }>({
  items,
  slotOffsets,
  render,
}: {
  items: T[]
  slotOffsets: number[]
  render: (item: T) => React.ReactNode
}) {
  const half = Math.floor(items.length / 2)
  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => {
        const idx = (i + slotOffsets[i]! * half) % items.length
        const item = items[idx]
        if (!item) return null
        const key = (item as { id?: string }).id ?? ("name" in item ? item.name : (item as { title: string }).title)
        return (
          <Box key={`${i}-${slotOffsets[i]}-${key}`} className="pipe-rotate-slot">
            {render(item)}
          </Box>
        )
      })}
    </>
  )
}

function ClassCard({ item, onPick, isAvailable, idx }: {
  item: UserClass; onPick: () => void; isAvailable: boolean; idx: number
}) {
  const tickRef = useRef(0)
  const [chSlotOffsets, setChSlotOffsets] = useState(() => [0, 0, 0, 0, 0, 0])
  const [evSlotOffsets, setEvSlotOffsets] = useState(() => [0, 0, 0, 0, 0, 0])

  useEffect(() => {
    const halfCh = Math.floor(item.channels.length / 2)
    const halfEv = Math.floor(item.events.length / 2)
    if (halfCh < 1 || halfEv < 1) return
    const t = setInterval(() => {
      tickRef.current += 1
      const slotIdx = Math.floor(tickRef.current / 2) % SLOTS
      const isChannel = tickRef.current % 2 === 0
      if (isChannel) {
        setChSlotOffsets((o) => {
          const next = [...o]
          next[slotIdx] = (next[slotIdx]! + 1) % 2
          return next
        })
      } else {
        setEvSlotOffsets((o) => {
          const next = [...o]
          next[slotIdx] = (next[slotIdx]! + 1) % 2
          return next
        })
      }
    }, SLOT_ROTATE_MS)
    return () => clearInterval(t)
  }, [item.channels.length, item.events.length])

  const useRotating = item.channels.length >= SLOTS * 2 && item.events.length >= SLOTS * 2

  return (
    <Box
      flexShrink={0}
      w="260px"
      cursor={isAvailable ? "pointer" : "default"}
      onClick={onPick}
      transition="transform 0.25s, box-shadow 0.25s"
      style={{
        transform: `rotate(${item.rotation}deg)`,
        opacity: isAvailable ? 1 : 0.7,
      }}
      _hover={isAvailable ? { transform: "rotate(0deg) translateY(-4px)", boxShadow: `0 12px 32px ${B}30` } : {}}
    >
      <Box
        bg={W}
        position="relative"
        overflow="hidden"
        borderRadius="0"
        border={`2px solid ${K}`}
      >
        <Box bg={B} px="4" py="3" position="relative">
          <Flex justify="space-between" align="flex-start">
            <Text fontSize="32px" lineHeight="1">{item.icon}</Text>
            <Text fontSize="9px" fontWeight="800" color={`${W}CC`} letterSpacing="0.1em" textTransform="uppercase">
              {isAvailable ? "ACTIVE" : "SOON"}
            </Text>
          </Flex>
          <Text fontSize="16px" fontWeight="900" color={W} textTransform="uppercase" letterSpacing="0.02em" mt="2" lineHeight="1.1">
            {item.label}
          </Text>
          <Text fontSize="10px" fontWeight="600" color={`${W}CC`} mt="1">{item.desc}</Text>
        </Box>

        <Flex bg={`${B}12`} px="4" py="1.5" align="center" gap="2">
          <Box w="5px" h="5px" borderRadius="full" bg={B} />
          <Text fontSize="8px" fontWeight="700" color={B} letterSpacing="0.06em" textTransform="uppercase">
            {item.stat}
          </Text>
        </Flex>

        <Box px="4" pt="3" pb="2" bg={W}>
          <Text fontSize="8px" fontWeight="800" letterSpacing="0.08em" textTransform="uppercase" color={G} mb="2">
            Каналы
          </Text>
          <Flex gap="2" flexWrap="wrap">
            {useRotating ? (
              <RotatingSlots
                items={item.channels}
                slotOffsets={chSlotOffsets}
                render={(ch) => (
                  <Flex key={ch.name} direction="column" align="center" gap="0.5" flexShrink={0}>
                    <Box
                      w="36px"
                      h="36px"
                      borderRadius="md"
                      overflow="hidden"
                      border={`2px solid ${B}30`}
                      flexShrink={0}
                    >
                      <Image
                        src={channelImageSrc(ch, item.id === "eco")}
                        alt=""
                        w="100%"
                        h="100%"
                        objectFit="cover"
                        display="block"
                        onError={(e) => { (e.target as HTMLImageElement).src = channelThumb(ch.name) }}
                      />
                    </Box>
                    <Text fontSize="7px" fontWeight="700" color={K} textAlign="center" lineHeight="1.1" noOfLines={1} maxW="44px">
                      {ch.name.replace(/^@/, "")}
                    </Text>
                    <Text fontSize="6px" fontWeight="600" color={B}>{ch.subs}</Text>
                  </Flex>
                )}
              />
            ) : (
              item.channels.slice(0, SLOTS).map((ch) => (
                <Flex key={ch.name} direction="column" align="center" gap="0.5" flexShrink={0}>
                  <Box w="36px" h="36px" borderRadius="md" overflow="hidden" border={`2px solid ${B}30`} flexShrink={0}>
                    <Image src={channelImageSrc(ch, item.id === "eco")} alt="" w="100%" h="100%" objectFit="cover" display="block" onError={(e) => { (e.target as HTMLImageElement).src = channelThumb(ch.name) }} />
                  </Box>
                  <Text fontSize="7px" fontWeight="700" color={K} textAlign="center" lineHeight="1.1" noOfLines={1} maxW="44px">
                    {ch.name.replace(/^@/, "")}
                  </Text>
                  <Text fontSize="6px" fontWeight="600" color={B}>{ch.subs}</Text>
                </Flex>
              ))
            )}
          </Flex>
        </Box>

        <Box px="4" pt="1" pb="3" bg={W}>
          <Text fontSize="8px" fontWeight="800" letterSpacing="0.08em" textTransform="uppercase" color={G} mb="2">
            Ближайшие ивенты
          </Text>
          {useRotating ? (
            <RotatingSlots
              items={item.events}
              slotOffsets={evSlotOffsets}
              render={(ev) => (
                <Flex align="center" gap="2" mb="1.5">
                  <Box w="3px" h="14px" bg={B} flexShrink={0} />
                  <Box flex="1" minW={0}>
                    <Text fontSize="10px" fontWeight="700" color={K} lineHeight="1.2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {ev.title}
                    </Text>
                  </Box>
                  <Text fontSize="8px" fontWeight="600" color={G} flexShrink={0}>{ev.date}</Text>
                </Flex>
              )}
            />
          ) : (
            item.events.slice(0, SLOTS).map((ev) => (
              <Flex key={ev.title} align="center" gap="2" mb="1.5">
                <Box w="3px" h="14px" bg={B} flexShrink={0} />
                <Box flex="1" minW={0}>
                  <Text fontSize="10px" fontWeight="700" color={K} lineHeight="1.2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ev.title}
                  </Text>
                </Box>
                <Text fontSize="8px" fontWeight="600" color={G} flexShrink={0}>{ev.date}</Text>
              </Flex>
            ))
          )}
        </Box>

        {isAvailable ? (
          <Flex bg={B} px="4" py="2.5" align="center" justify="center" gap="2" cursor="pointer"
            _hover={{ opacity: 0.9 }} transition="opacity 0.15s">
            <Text fontSize="10px" fontWeight="900" letterSpacing="0.14em" textTransform="uppercase" color={W}>
              Выбрать
            </Text>
            <Text fontSize="12px" color={W}>→</Text>
          </Flex>
        ) : (
          <Flex bg={`${K}06`} px="4" py="2.5" align="center" justify="center">
            <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={G}>
              Скоро
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  )
}

function EventMiniCard({
  ev,
  failedImgs,
  onImageError,
}: { ev: InterestEvent; failedImgs: Record<string, true>; onImageError: () => void }) {
  const key = ev.id ?? `ev-${ev.title}-${ev.date}`
  const media = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
  const imgSrc = media && isImg(media) && !failedImgs[key] ? resolveMedia(media) : null
  return (
    <Box
      border={`2px solid ${K}`}
      overflow="hidden"
      flexShrink={0}
      _hover={{ boxShadow: `3px 3px 0 ${B}` }}
      transition="box-shadow 0.15s"
    >
      {imgSrc && (
        <Box borderBottom={`1px solid ${K}`} h="72px" overflow="hidden">
          <Image
            src={imgSrc}
            alt=""
            w="100%"
            h="100%"
            objectFit="cover"
            display="block"
            onError={onImageError}
          />
        </Box>
      )}
      <Box px="2" py="1.5">
        <Text fontSize="9px" fontWeight="700" letterSpacing="0.06em" color={G} textTransform="uppercase" mb="0.5">
          {ev.date}
        </Text>
        <Text fontSize="10px" fontWeight="800" lineHeight="1.2" noOfLines={2} textTransform="uppercase" letterSpacing="-0.01em">
          {ev.title}
        </Text>
      </Box>
    </Box>
  )
}

function InterestCard({ item, onPick, selected, idx, failedEventImgs, setFailedEventImgs }: {
  item: EcoInterest; onPick: () => void; selected: boolean; idx: number
  failedEventImgs: Record<string, true>; setFailedEventImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
}) {
  const rotation = [-1.2, 0.8, -0.6][idx % 3] ?? 0
  const border = selected ? B : `${W}20`
  const tickRef = useRef(0)
  const [chSlotOffsets, setChSlotOffsets] = useState(() => [0, 0, 0, 0, 0, 0])
  const [evSlotOffsets, setEvSlotOffsets] = useState(() => [0, 0, 0, 0, 0, 0])

  useEffect(() => {
    const halfCh = Math.floor(item.channels.length / 2)
    const halfEv = Math.floor(item.events.length / 2)
    if (halfCh < 1 || halfEv < 1) return
    const t = setInterval(() => {
      tickRef.current += 1
      const slotIdx = Math.floor(tickRef.current / 2) % SLOTS
      const isChannel = tickRef.current % 2 === 0
      if (isChannel) {
        setChSlotOffsets((o) => {
          const next = [...o]
          next[slotIdx] = (next[slotIdx]! + 1) % 2
          return next
        })
      } else {
        setEvSlotOffsets((o) => {
          const next = [...o]
          next[slotIdx] = (next[slotIdx]! + 1) % 2
          return next
        })
      }
    }, SLOT_ROTATE_MS)
    return () => clearInterval(t)
  }, [item.channels.length, item.events.length])

  const useRotating = item.channels.length >= SLOTS * 2 && item.events.length >= SLOTS * 2

  return (
    <Box
      flexShrink={0}
      w="260px"
      cursor="pointer"
      onClick={onPick}
      transition="transform 0.25s, box-shadow 0.25s"
      style={{ transform: `rotate(${rotation}deg)` }}
      _hover={{ transform: "rotate(0deg) translateY(-4px)", boxShadow: `0 12px 32px ${B}30` }}
    >
      <Box
        bg={W}
        position="relative"
        overflow="hidden"
        border={`2px solid ${border}`}
        transition="border-color 0.2s"
      >
        <Box bg={selected ? B : `${B}CC`} px="4" py="3" position="relative">
          <Flex justify="space-between" align="flex-start">
            <Text fontSize="32px" lineHeight="1">{item.icon}</Text>
            {selected && (
              <Flex bg={W} w="22px" h="22px" align="center" justify="center" borderRadius="full">
                <Text fontSize="12px" color={B} lineHeight="1">✓</Text>
              </Flex>
            )}
          </Flex>
          <Text fontSize="16px" fontWeight="900" color={W} textTransform="uppercase" letterSpacing="0.02em" mt="2" lineHeight="1.1">
            {item.label}
          </Text>
        </Box>

        <Flex bg={`${B}12`} px="4" py="1.5" align="center" gap="2">
          <Box w="5px" h="5px" borderRadius="full" bg={B} />
          <Text fontSize="8px" fontWeight="700" color={B} letterSpacing="0.06em" textTransform="uppercase">
            {item.stat}
          </Text>
        </Flex>

        <Box px="4" pt="3" pb="2" bg={W}>
          <Text fontSize="8px" fontWeight="800" letterSpacing="0.08em" textTransform="uppercase" color={G} mb="2">
            Каналы
          </Text>
          <Flex gap="2" flexWrap="wrap">
            {useRotating ? (
              <RotatingSlots
                items={item.channels}
                slotOffsets={chSlotOffsets}
                render={(ch) => (
                  <Flex key={ch.name} direction="column" align="center" gap="0.5" flexShrink={0}>
                    <Box w="36px" h="36px" borderRadius="md" overflow="hidden" border={`2px solid ${B}30`} flexShrink={0}>
                      <Image src={channelImageSrc(ch, item.id === "eco")} alt="" w="100%" h="100%" objectFit="cover" display="block" onError={(e) => { (e.target as HTMLImageElement).src = channelThumb(ch.name) }} />
                    </Box>
                    <Text fontSize="7px" fontWeight="700" color={K} textAlign="center" lineHeight="1.1" noOfLines={1} maxW="44px">
                      {ch.name.replace(/^@/, "")}
                    </Text>
                    <Text fontSize="6px" fontWeight="600" color={B}>{ch.subs}</Text>
                  </Flex>
                )}
              />
            ) : (
              item.channels.slice(0, SLOTS).map((ch) => (
                <Flex key={ch.name} direction="column" align="center" gap="0.5" flexShrink={0}>
                  <Box w="36px" h="36px" borderRadius="md" overflow="hidden" border={`2px solid ${B}30`} flexShrink={0}>
                    <Image src={channelImageSrc(ch, item.id === "eco")} alt="" w="100%" h="100%" objectFit="cover" display="block" onError={(e) => { (e.target as HTMLImageElement).src = channelThumb(ch.name) }} />
                  </Box>
                  <Text fontSize="7px" fontWeight="700" color={K} textAlign="center" lineHeight="1.1" noOfLines={1} maxW="44px">
                    {ch.name.replace(/^@/, "")}
                  </Text>
                  <Text fontSize="6px" fontWeight="600" color={B}>{ch.subs}</Text>
                </Flex>
              ))
            )}
          </Flex>
        </Box>

        <Box px="4" pt="1" pb="3" bg={W}>
          <Text fontSize="8px" fontWeight="800" letterSpacing="0.08em" textTransform="uppercase" color={G} mb="2">
            Ивенты
          </Text>
          {item.events.length === 0 ? (
            <Text fontSize="10px" color={G}>Нет ивентов</Text>
          ) : useRotating ? (
            <RotatingSlots
              items={item.events}
              slotOffsets={evSlotOffsets}
              render={(ev) => (
                <EventMiniCard
                  ev={ev}
                  failedImgs={failedEventImgs}
                  onImageError={() => setFailedEventImgs((p) => ({ ...p, [ev.id ?? `ev-${ev.title}-${ev.date}`]: true }))}
                />
              )}
            />
          ) : (
            <Flex gap="2" wrap="wrap" justify="flex-start">
              {item.events.slice(0, SLOTS).map((ev) => (
                <Box key={ev.id ?? `${ev.title}-${ev.date}`} flex="1 1 45%" minW="0" maxW="50%">
                  <EventMiniCard
                    ev={ev}
                    failedImgs={failedEventImgs}
                    onImageError={() => setFailedEventImgs((p) => ({ ...p, [ev.id ?? `ev-${ev.title}-${ev.date}`]: true }))}
                  />
                </Box>
              ))}
            </Flex>
          )}
        </Box>

        <Flex
          bg={selected ? B : `${K}06`}
          px="4" py="2.5" align="center" justify="center" gap="2"
          transition="background 0.2s"
          _hover={{ bg: selected ? B : `${K}10` }}
        >
          <Text fontSize="10px" fontWeight="900" letterSpacing="0.14em" textTransform="uppercase"
            color={selected ? W : K}>
            {selected ? "Выбрано ✓" : "Выбрать"}
          </Text>
        </Flex>
      </Box>
    </Box>
  )
}

function loadSelected(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* noop */ }
  return []
}

function saveSelected(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export default function PipeRotate() {
  const navigate = useNavigate()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<"class" | "interests">("class")
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    () => new Set(loadSelected())
  )
  const [ecoChannels, setEcoChannels] = useState<ChannelItem[] | null>(null)
  const [ecoEvents, setEcoEvents] = useState<ApiEventCard[] | null>(null)
  const [failedEventImgs, setFailedEventImgs] = useState<Record<string, true>>({})
  const [loadingEvents, setLoadingEvents] = useState(false)

  useEffect(() => {
    let cancelled = false
    let retryId: ReturnType<typeof setTimeout> | null = null
    const load = () => {
      fetch(`${API}/debug/eco-channels`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Array<{ name: string; subs: string; avatar: string | null }> | null) => {
          if (cancelled) return
          if (!Array.isArray(data)) {
            setEcoChannels([])
            return
          }
          const withAvatar = data.filter((ch) => ch.avatar)
          setEcoChannels(
            withAvatar.map((ch) => ({
              name: ch.name,
              subs: ch.subs,
              thumb: ch.avatar!.startsWith("http") ? ch.avatar! : `${API}${ch.avatar}`,
            }))
          )
        })
        .catch(() => {
          if (!cancelled) {
            setEcoChannels([])
            retryId = setTimeout(load, 2000)
          }
        })
    }
    load()
    return () => {
      cancelled = true
      if (retryId) clearTimeout(retryId)
    }
  }, [])

  useEffect(() => {
    if (step !== "interests") return
    let cancelled = false
    setLoadingEvents(true)
    fetch(
      `${API}/debug/telegram-fetch-event-posts?per_channel_limit=15&event_only=false`,
      { method: "POST" }
    )
      .then(() => (cancelled ? null : fetch(`${API}/events?limit=60`)))
      .then((r) => (r && r.ok ? r.json() : null))
      .then((data: ApiEventCard[] | null) => {
        if (!cancelled) setEcoEvents(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setEcoEvents([])
      })
      .finally(() => {
        if (!cancelled) setLoadingEvents(false)
      })
    return () => { cancelled = true }
  }, [step])

  const toggleInterest = useCallback((id: string) => {
    setSelectedInterests((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveSelected([...next])
      return next
    })
  }, [])

  const handleSelectClass = useCallback((cls: UserClass) => {
    if (!cls.available) return
    setSelectedClass(cls.id)
    if (cls.id === "eco") setStep("interests")
  }, [])

  const handleContinue = useCallback(() => {
    navigate({ to: "/pipe-personal", state: { openFeed: true } })
  }, [navigate])

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!scrollerRef.current) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    scrollerRef.current.scrollLeft += e.deltaY
    e.preventDefault()
  }

  const scrollBy = useCallback((dir: -1 | 1) => {
    if (!scrollerRef.current) return
    scrollerRef.current.scrollBy({ left: dir * 280, behavior: "smooth" })
  }, [])

  return (
    <Box minH="100dvh" bg={W} color={K} position="relative" overflow="hidden">
      <PageWipe primary={B} secondary={K} />
      <Box position="relative" zIndex={1} pt="14" pb="20" maxW="100vw">
        {step === "class" ? (
          <>
            <Box px="6">
              <Flex align="center" gap="2" mb="6" className="p5-drop" style={{ animationDelay: "0.2s" }}>
                <Box w="4px" h="18px" bg={B} />
                <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase">
                  Выберите тип
                </Text>
              </Flex>
              <Text fontSize="24px" fontWeight="900" mb="6" letterSpacing="-0.02em" lineHeight="1.1">
                Кто вы?
              </Text>
            </Box>
            <Box position="relative">
              <Flex
                ref={scrollerRef}
                flexDirection="row"
                flexWrap="nowrap"
                gap="4"
                overflowX="auto"
                overflowY="hidden"
                py="6"
                onWheel={onWheel}
                className="pipe-rotate-scroll"
                style={{
                  scrollSnapType: "x mandatory",
                  touchAction: "pan-x",
                  overscrollBehaviorX: "contain",
                  paddingLeft: "calc(50vw - 130px)",
                  paddingRight: "calc(50vw - 130px)",
                }}
              >
                {USER_CLASSES.map((cls, idx) => (
                  <Box key={cls.id} flexShrink={0} style={{ scrollSnapAlign: "center" }}>
                    <ClassCard
                      item={cls.id === "eco" && cls.available && ecoChannels?.length ? { ...cls, channels: ecoChannels } : cls}
                      onPick={() => handleSelectClass(cls)}
                      isAvailable={cls.available}
                      idx={idx}
                    />
                  </Box>
                ))}
              </Flex>
              <Box
                position="absolute" left="8px" top="50%" style={{ transform: "translateY(-50%)" }}
                zIndex={2} cursor="pointer" onClick={() => scrollBy(-1)}
                bg={W} border={`2px solid ${K}`} w="36px" h="36px" display="flex"
                alignItems="center" justifyContent="center"
                _hover={{ bg: B, color: W, borderColor: B }}
                transition="all 0.15s"
              >
                <Text fontSize="16px" fontWeight="900" lineHeight="1">←</Text>
              </Box>
              <Box
                position="absolute" right="8px" top="50%" style={{ transform: "translateY(-50%)" }}
                zIndex={2} cursor="pointer" onClick={() => scrollBy(1)}
                bg={W} border={`2px solid ${K}`} w="36px" h="36px" display="flex"
                alignItems="center" justifyContent="center"
                _hover={{ bg: B, color: W, borderColor: B }}
                transition="all 0.15s"
              >
                <Text fontSize="16px" fontWeight="900" lineHeight="1">→</Text>
              </Box>
            </Box>
          </>
        ) : (
          <>
            <Box px="6">
              <Flex align="center" gap="2" mb="6" className="p5-drop" style={{ animationDelay: "0.2s" }}>
                <Box w="4px" h="18px" bg={B} />
                <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase">
                  Эко-энтузиаст
                </Text>
              </Flex>
              <Text fontSize="20px" fontWeight="900" mb="2" letterSpacing="-0.02em">
                Что вам интересно?
              </Text>
              <Text fontSize="12px" color={G} mb="6">
                Upcycle одежда, фэры, нишевые бренды
              </Text>
            </Box>
            <Box position="relative">
              <Flex
                ref={scrollerRef}
                flexDirection="row"
                flexWrap="nowrap"
                gap="4"
                overflowX="auto"
                overflowY="hidden"
                py="6"
                onWheel={onWheel}
                className="pipe-rotate-scroll"
                style={{
                  scrollSnapType: "x mandatory",
                  touchAction: "pan-x",
                  overscrollBehaviorX: "contain",
                  paddingLeft: "calc(50vw - 130px)",
                  paddingRight: "calc(50vw - 130px)",
                }}
              >
                {buildEcoInterests(ecoChannels, ecoEvents).map((it, idx) => (
                  <Box key={it.id} flexShrink={0} style={{ scrollSnapAlign: "center" }}>
                    <InterestCard
                      item={it}
                      onPick={() => toggleInterest(it.id)}
                      selected={selectedInterests.has(it.id)}
                      idx={idx}
                      failedEventImgs={failedEventImgs}
                      setFailedEventImgs={setFailedEventImgs}
                    />
                  </Box>
                ))}
              </Flex>
              <Box
                position="absolute" left="8px" top="50%" style={{ transform: "translateY(-50%)" }}
                zIndex={2} cursor="pointer" onClick={() => scrollBy(-1)}
                bg={W} border={`2px solid ${K}`} w="36px" h="36px" display="flex"
                alignItems="center" justifyContent="center"
                _hover={{ bg: B, color: W, borderColor: B }}
                transition="all 0.15s"
              >
                <Text fontSize="16px" fontWeight="900" lineHeight="1">←</Text>
              </Box>
              <Box
                position="absolute" right="8px" top="50%" style={{ transform: "translateY(-50%)" }}
                zIndex={2} cursor="pointer" onClick={() => scrollBy(1)}
                bg={W} border={`2px solid ${K}`} w="36px" h="36px" display="flex"
                alignItems="center" justifyContent="center"
                _hover={{ bg: B, color: W, borderColor: B }}
                transition="all 0.15s"
              >
                <Text fontSize="16px" fontWeight="900" lineHeight="1">→</Text>
              </Box>
            </Box>
            <Flex justify="center" mt="8">
              <Button
                bg={B}
                color={W}
                py="4"
                px="8"
                fontSize="12px"
                fontWeight="800"
                letterSpacing="0.12em"
                textTransform="uppercase"
                _hover={{ opacity: 0.9 }}
                onClick={handleContinue}
                isDisabled={loadingEvents}
              >
                {loadingEvents ? "Загрузка ивентов…" : "Продолжить →"}
              </Button>
            </Flex>
          </>
        )}
      </Box>
    </Box>
  )
}
