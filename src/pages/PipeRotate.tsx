import { useState, useCallback, useRef, useEffect } from "react"
import { Box, Button, Flex, Text, Image } from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"
import { API, PageWipe, isImg, resolveMedia } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

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

function channelImageSrc(ch: ChannelItem): string {
  if (ch.thumb) return ch.thumb
  return channelDirectMediaUrl(ch.name)
}

type ChannelItem = { name: string; subs: string; thumb?: string }

type EventPreview = { id?: string; title: string; date: string; media_urls?: string[] }

type UserClass = {
  id: string
  label: string
  desc: string
  icon: string
  rotation: number
  available: boolean
  channels: ChannelItem[]
  events: EventPreview[]
  stat: string
}

const USER_CLASSES: UserClass[] = [
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

function ClassCard({ item, onPick, isAvailable, idx, failedEventImgs, setFailedEventImgs }: {
  item: UserClass
  onPick: () => void
  isAvailable: boolean
  idx: number
  failedEventImgs: Record<string, true>
  setFailedEventImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
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
                        src={channelImageSrc(ch)}
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
                    <Image src={channelImageSrc(ch)} alt="" w="100%" h="100%" objectFit="cover" display="block" onError={(e) => { (e.target as HTMLImageElement).src = channelThumb(ch.name) }} />
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
}: { ev: EventPreview; failedImgs: Record<string, true>; onImageError: () => void }) {
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


export default function PipeRotate() {
  const navigate = useNavigate()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [failedEventImgs, setFailedEventImgs] = useState<Record<string, true>>({})
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  const handleSelectClass = useCallback((cls: UserClass) => {
    if (!cls.available) return
    setSelectedClass(cls.id)
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
                  item={cls}
                  onPick={() => handleSelectClass(cls)}
                  isAvailable={cls.available}
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
            disabled={!selectedClass}
          >
            Продолжить →
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}
