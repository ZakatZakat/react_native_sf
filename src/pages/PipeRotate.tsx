import { useState, useCallback, useRef, useEffect } from "react"
import { Box, Button, Flex, Text } from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"
import { PageWipe, PIPE_ROTATE_STORAGE } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

const STORAGE_KEY = PIPE_ROTATE_STORAGE

type UserClass = {
  id: string
  label: string
  desc: string
  icon: string
  rotation: number
  available: boolean
  channels: { name: string; subs: string }[]
  events: { title: string; date: string }[]
  stat: string
}

const USER_CLASSES: UserClass[] = [
  {
    id: "eco", label: "Эко-энтузиаст", icon: "🌿", rotation: -1.2, available: true,
    desc: "Upcycle, фэры, sustainable-бренды",
    channels: [
      { name: "@greenfashionmsk", subs: "12K" },
      { name: "@upcycle_community", subs: "8K" },
      { name: "@eco_swap_msk", subs: "5K" },
      { name: "@zerowaste_msk", subs: "15K" },
      { name: "@slow_fashion_ru", subs: "9K" },
      { name: "@organic_market", subs: "7K" },
      { name: "@ecology_events", subs: "11K" },
      { name: "@sustainable_life", subs: "6K" },
      { name: "@green_tech_msk", subs: "4K" },
      { name: "@ethical_consumption", subs: "18K" },
      { name: "@climate_action_ru", subs: "22K" },
      { name: "@reuse_reduce", subs: "10K" },
    ],
    events: [
      { title: "Swap-вечеринка Artplay", date: "15 мар" },
      { title: "Eco Fair Хлебозавод", date: "22 мар" },
      { title: "Upcycle Weekend", date: "5 апр" },
      { title: "Фёр Zerowaste", date: "18 мар" },
      { title: "Green Market Винзавод", date: "28 мар" },
      { title: "Sustainable Meetup", date: "2 апр" },
      { title: "Eco Design Week", date: "10 апр" },
      { title: "Zero Waste Festival", date: "18 апр" },
      { title: "Thrift Pop-Up ВДНХ", date: "25 апр" },
      { title: "Climate Forum", date: "3 мая" },
      { title: "Organic Food Market", date: "12 мая" },
      { title: "Repair Cafe Moscow", date: "20 мая" },
    ],
    stat: "40+ каналов · 120 ивентов/мес",
  },
  {
    id: "business", label: "Бизнес", icon: "💼", rotation: 0.8, available: false,
    desc: "Нетворкинг, конференции, стартапы",
    channels: [
      { name: "@startup_events_msk", subs: "25K" },
      { name: "@vc_digest", subs: "90K" },
      { name: "@biztech_meetups", subs: "15K" },
      { name: "@founders_club", subs: "32K" },
      { name: "@scale_up_msk", subs: "18K" },
      { name: "@angel_invest_ru", subs: "22K" },
      { name: "@tech_meetups_ru", subs: "28K" },
      { name: "@business_breakfast", subs: "14K" },
      { name: "@accelerator_events", subs: "9K" },
      { name: "@corporate_innovation", subs: "12K" },
      { name: "@startup_grants", subs: "35K" },
      { name: "@pitch_events_msk", subs: "19K" },
    ],
    events: [
      { title: "Startup Village 2026", date: "12 июн" },
      { title: "Founders Friday", date: "кажд. пт" },
      { title: "Tech Pitch Night", date: "20 мар" },
      { title: "Investor Breakfast", date: "кажд. чт" },
      { title: "Product Hunt Moscow", date: "25 мар" },
      { title: "ScaleUp Conference", date: "15 апр" },
      { title: "AI Business Summit", date: "22 апр" },
      { title: "Fintech Meetup", date: "30 апр" },
      { title: "Corporate Hackathon", date: "8 мая" },
      { title: "Seed Camp Demo Day", date: "16 мая" },
      { title: "Growth Marketing Day", date: "24 мая" },
      { title: "HR Tech Conference", date: "5 июн" },
    ],
    stat: "70+ каналов · 200 ивентов/мес",
  },
  {
    id: "parties", label: "Тусовщик Москвы", icon: "🎧", rotation: -0.6, available: false,
    desc: "Вечеринки, клубы, поп-апы",
    channels: [
      { name: "@msk_raves", subs: "30K" },
      { name: "@night_culture", subs: "18K" },
      { name: "@popupmoscow", subs: "22K" },
      { name: "@club_life_msk", subs: "45K" },
      { name: "@electronic_events", subs: "28K" },
      { name: "@afterparty_digest", subs: "12K" },
      { name: "@techno_msk", subs: "38K" },
      { name: "@rooftop_events", subs: "24K" },
      { name: "@underground_raves", subs: "16K" },
      { name: "@dj_sessions", subs: "20K" },
      { name: "@party_agenda", subs: "42K" },
      { name: "@live_music_events", subs: "33K" },
    ],
    events: [
      { title: "Mutabor Open Air", date: "8 мар" },
      { title: "Рейв Красный Октябрь", date: "15 мар" },
      { title: "Secret Rooftop Party", date: "TBA" },
      { title: "Boiler Room Moscow", date: "22 мар" },
      { title: "House Night в Солянке", date: "29 мар" },
      { title: "Open Air Gorky Park", date: "6 апр" },
      { title: "Techno Night Arma", date: "13 апр" },
      { title: "Disco Inferno", date: "20 апр" },
      { title: "Jazz Evening Solyanka", date: "27 апр" },
      { title: "Synthwave Party", date: "4 мая" },
      { title: "Live DJ Set Proximity", date: "11 мая" },
      { title: "Summer Rave Измайлово", date: "18 мая" },
    ],
    stat: "55+ каналов · 90 ивентов/мес",
  },
  {
    id: "exhibitions", label: "Выставки", icon: "🖼", rotation: 1.2, available: false,
    desc: "Галереи, музеи, арт-пространства",
    channels: [
      { name: "@garage_museum", subs: "45K" },
      { name: "@tretyakov_today", subs: "60K" },
      { name: "@artmoscow_daily", subs: "20K" },
      { name: "@mmoma_events", subs: "35K" },
      { name: "@manege_moscow", subs: "25K" },
      { name: "@winzavod_art", subs: "42K" },
      { name: "@contemporary_art", subs: "28K" },
      { name: "@photo_center_gallery", subs: "15K" },
      { name: "@design_museum", subs: "19K" },
      { name: "@sculpture_park", subs: "11K" },
      { name: "@biennale_digest", subs: "32K" },
      { name: "@art_galleries_msk", subs: "26K" },
    ],
    events: [
      { title: "Cosmoscow 2026", date: "сент" },
      { title: "Ночь музеев", date: "18 мая" },
      { title: "Выставка ГЭС-2", date: "до 30 апр" },
      { title: "Art Moscow", date: "12 апр" },
      { title: "Молодёжная биеннале", date: "20 апр" },
      { title: "Design Weekend", date: "5 мая" },
      { title: "Фотобиеннале", date: "10 мая" },
      { title: "Скульптура в парке", date: "15 мая" },
      { title: "Арт-медиа инсталляции", date: "22 мая" },
      { title: "Young Artists Expo", date: "28 мая" },
      { title: "Architecture Day", date: "5 июн" },
      { title: "Video Art Festival", date: "12 июн" },
    ],
    stat: "35+ каналов · 80 ивентов/мес",
  },
]

type EcoInterest = {
  id: string
  label: string
  icon: string
  keywords: string[]
  channels: { name: string; subs: string }[]
  events: { title: string; date: string }[]
  stat: string
}

const ECO_INTERESTS: EcoInterest[] = [
  {
    id: "upcycle", label: "Upcycle одежда", icon: "♻️",
    keywords: ["upcycle", "апсайкл", "переработк", "second hand"],
    channels: [
      { name: "@upcycle_msk", subs: "8K" },
      { name: "@secondhand_finds", subs: "14K" },
      { name: "@rework_studio", subs: "6K" },
      { name: "@swap_community", subs: "11K" },
      { name: "@thrift_moscow", subs: "9K" },
      { name: "@vintage_styling", subs: "12K" },
      { name: "@recycling_fashion", subs: "7K" },
      { name: "@preloved_moscow", subs: "10K" },
      { name: "@upcycle_diy", subs: "5K" },
      { name: "@slow_wardrobe", subs: "8K" },
      { name: "@consignment_events", subs: "6K" },
      { name: "@fashion_swap", subs: "13K" },
    ],
    events: [
      { title: "Swap Party Artplay", date: "15 мар" },
      { title: "Upcycle Мастерская", date: "20 мар" },
      { title: "Second Hand Pop-Up", date: "1 апр" },
      { title: "Thrift Fashion Day", date: "12 мар" },
      { title: "Recycle Workshop", date: "25 мар" },
      { title: "Vintage Fair Vinzavod", date: "5 апр" },
      { title: "Clothes Swap Sunday", date: "14 апр" },
      { title: "DIY Upcycle Masterclass", date: "21 апр" },
      { title: "Preloved Market", date: "28 апр" },
      { title: "Capsule Wardrobe Talk", date: "6 мая" },
      { title: "Mending Circle", date: "13 мая" },
      { title: "Sustainable Fashion Week", date: "20 мая" },
    ],
    stat: "15 каналов · 30 ивентов/мес",
  },
  {
    id: "fairs", label: "Фэры и маркеты", icon: "🛒",
    keywords: ["фэр", "маркет", "ярмарк", "блошинг", "fleamarket"],
    channels: [
      { name: "@fair_moscow", subs: "20K" },
      { name: "@market_weekly", subs: "11K" },
      { name: "@flea_culture", subs: "9K" },
      { name: "@lambada_market", subs: "15K" },
      { name: "@design_markets", subs: "12K" },
      { name: "@antique_markets", subs: "18K" },
      { name: "@handmade_markets", subs: "10K" },
      { name: "@vinyl_community", subs: "14K" },
      { name: "@book_fairs_msk", subs: "8K" },
      { name: "@collectors_swap", subs: "6K" },
      { name: "@craft_markets", subs: "22K" },
      { name: "@weekend_bazaars", subs: "16K" },
    ],
    events: [
      { title: "Ламбада-маркет", date: "кажд. вс" },
      { title: "Хлебозавод Fair", date: "22 мар" },
      { title: "Garage Sale", date: "5 апр" },
      { title: "Vinyl Market", date: "16 мар" },
      { title: "Designers Fair", date: "30 мар" },
      { title: "Antique Sunday", date: "7 апр" },
      { title: "Handmade Bazaar", date: "14 апр" },
      { title: "Book Swap Festival", date: "21 апр" },
      { title: "Collectors Meet", date: "28 апр" },
      { title: "Craft Weekend", date: "5 мая" },
      { title: "Bike & Flea Market", date: "12 мая" },
      { title: "Art Print Fair", date: "19 мая" },
    ],
    stat: "20 каналов · 45 ивентов/мес",
  },
  {
    id: "niche", label: "Нишевые бренды", icon: "🏷",
    keywords: ["sustainable", "эко", "локальн", "handmade"],
    channels: [
      { name: "@local_brands_msk", subs: "7K" },
      { name: "@handmade_digest", subs: "12K" },
      { name: "@slow_fashion_ru", subs: "5K" },
      { name: "@ethical_fashion", subs: "8K" },
      { name: "@craft_moscow", subs: "10K" },
      { name: "@independent_designers", subs: "9K" },
      { name: "@artisan_market", subs: "6K" },
      { name: "@small_batch_brands", subs: "4K" },
      { name: "@maker_community", subs: "11K" },
      { name: "@boutique_digest", subs: "7K" },
      { name: "@unique_fashion", subs: "8K" },
      { name: "@designer_stories", subs: "5K" },
    ],
    events: [
      { title: "Local Brands Market", date: "10 мар" },
      { title: "Handmade Expo", date: "28 мар" },
      { title: "Slow Fashion Meetup", date: "12 апр" },
      { title: "Ethical Fashion Week", date: "8 апр" },
      { title: "Craft Fair ВДНХ", date: "15 апр" },
      { title: "Designer Pop-Up", date: "22 апр" },
      { title: "Artisan Day", date: "29 апр" },
      { title: "Small Batch Showcase", date: "6 мая" },
      { title: "Maker Fair", date: "13 мая" },
      { title: "Boutique Weekend", date: "20 мая" },
      { title: "Unique Brands Expo", date: "27 мая" },
      { title: "Designer Stories Talk", date: "3 июн" },
    ],
    stat: "12 каналов · 25 ивентов/мес",
  },
]

const SLOTS = 6
const SLOT_ROTATE_MS = 5000

function RotatingSlots<T extends { name?: string; title?: string }>({
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
        const key = "name" in item ? item.name : (item as { title: string }).title
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
          <Flex gap="1.5" flexWrap="wrap">
            {useRotating ? (
              <RotatingSlots
                items={item.channels}
                slotOffsets={chSlotOffsets}
                render={(ch) => (
                  <Flex key={ch.name} bg={`${K}06`} px="2" py="0.5" align="center" gap="1" borderRadius="0">
                    <Text fontSize="9px" fontWeight="700" color={K}>{ch.name}</Text>
                    <Text fontSize="7px" fontWeight="600" color={B}>{ch.subs}</Text>
                  </Flex>
                )}
              />
            ) : (
              item.channels.slice(0, SLOTS).map((ch) => (
                <Flex key={ch.name} bg={`${K}06`} px="2" py="0.5" align="center" gap="1" borderRadius="0">
                  <Text fontSize="9px" fontWeight="700" color={K}>{ch.name}</Text>
                  <Text fontSize="7px" fontWeight="600" color={B}>{ch.subs}</Text>
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

function InterestCard({ item, onPick, selected, idx }: {
  item: EcoInterest; onPick: () => void; selected: boolean; idx: number
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
          <Flex gap="1.5" flexWrap="wrap">
            {useRotating ? (
              <RotatingSlots
                items={item.channels}
                slotOffsets={chSlotOffsets}
                render={(ch) => (
                  <Flex key={ch.name} bg={`${K}06`} px="2" py="0.5" align="center" gap="1">
                    <Text fontSize="9px" fontWeight="700" color={K}>{ch.name}</Text>
                    <Text fontSize="7px" fontWeight="600" color={B}>{ch.subs}</Text>
                  </Flex>
                )}
              />
            ) : (
              item.channels.slice(0, SLOTS).map((ch) => (
                <Flex key={ch.name} bg={`${K}06`} px="2" py="0.5" align="center" gap="1">
                  <Text fontSize="9px" fontWeight="700" color={K}>{ch.name}</Text>
                  <Text fontSize="7px" fontWeight="600" color={B}>{ch.subs}</Text>
                </Flex>
              ))
            )}
          </Flex>
        </Box>

        <Box px="4" pt="1" pb="3" bg={W}>
          <Text fontSize="8px" fontWeight="800" letterSpacing="0.08em" textTransform="uppercase" color={G} mb="2">
            Ивенты
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
                      item={cls}
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
                {ECO_INTERESTS.map((it, idx) => (
                  <Box key={it.id} flexShrink={0} style={{ scrollSnapAlign: "center" }}>
                    <InterestCard
                      item={it}
                      onPick={() => toggleInterest(it.id)}
                      selected={selectedInterests.has(it.id)}
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
              >
                Продолжить →
              </Button>
            </Flex>
          </>
        )}
      </Box>
    </Box>
  )
}
