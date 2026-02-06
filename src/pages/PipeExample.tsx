import { useState, useCallback } from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { PageWipe, PipeFooter } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"
const R = "#E53535"

type VenueSource = { name: string; count: number }

type Venue = {
  id: string
  name: string
  tag: string
  district: string
  addr: string
  rotation: number
  sources: VenueSource[]
}

const VENUES: Venue[] = [
  { id: "ges2",      name: "ГЭС-2",              tag: "Музей",     district: "Якиманка",      addr: "Болотная наб., 15",        rotation: -1.4,
    sources: [{ name: "Афиша Daily", count: 87 }, { name: "TG: moscowart", count: 143 }] },
  { id: "garage",    name: "Гараж",               tag: "Музей",     district: "Парк Горького", addr: "Крымский Вал, 9/32",       rotation: 0.8,
    sources: [{ name: "Афиша Daily", count: 102 }, { name: "The Village", count: 64 }, { name: "TG: kudago_msk", count: 231 }] },
  { id: "zotov",     name: "Центр «Зотов»",      tag: "Центр",     district: "Пресня",        addr: "Ходынская ул., 2",         rotation: -0.6,
    sources: [{ name: "The Village", count: 38 }, { name: "TG: moscowart", count: 92 }] },
  { id: "winzavod",  name: "Винзавод",            tag: "Кластер",   district: "Курская",       addr: "4-й Сыромятнический, 1/8", rotation: 1.2,
    sources: [{ name: "Афиша Daily", count: 76 }, { name: "The Village", count: 54 }, { name: "TG: moscowart", count: 412 }, { name: "TG: kudago_msk", count: 287 }] },
  { id: "xl",        name: "XL Gallery",          tag: "Галерея",   district: "Винзавод",      addr: "Корпус 1, этаж 2",         rotation: -1.8,
    sources: [{ name: "TG: moscowart", count: 156 }, { name: "Афиша Daily", count: 23 }] },
  { id: "regina",    name: "Regina Gallery",      tag: "Галерея",   district: "Винзавод",      addr: "Корпус 6",                  rotation: 0.5,
    sources: [{ name: "TG: moscowart", count: 89 }, { name: "The Village", count: 18 }] },
  { id: "popoffart", name: "Pop/off/art",         tag: "Галерея",   district: "Винзавод",      addr: "Корпус 3",                  rotation: -0.9,
    sources: [{ name: "TG: moscowart", count: 134 }, { name: "Афиша Daily", count: 31 }] },
  { id: "streetart", name: "Street-art courtyard", tag: "Стрит-арт", district: "Винзавод",     addr: "Внутренний двор",           rotation: 1.6,
    sources: [{ name: "TG: kudago_msk", count: 198 }, { name: "TG: moscowart", count: 179 }] },
]

function aggregateSources(venues: Venue[]): VenueSource[] {
  const map = new Map<string, number>()
  for (const v of venues) {
    for (const s of v.sources) {
      map.set(s.name, (map.get(s.name) ?? 0) + s.count)
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
}

const DEFAULT_LIKES: Record<string, boolean> = {
  ges2: true, garage: true, winzavod: true, xl: true, streetart: true,
  zotov: false, regina: false, popoffart: false,
}

function VenueTile({ venue, liked, onToggle, idx }: {
  venue: Venue; liked: boolean; onToggle: () => void; idx: number
}) {
  const accent = liked ? B : R
  const isWide = idx === 0
  return (
    <Box
      gridColumn={isWide ? "1 / -1" : undefined}
      cursor="pointer"
      onClick={onToggle}
      style={{ transform: `rotate(${venue.rotation}deg)`, transition: "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)" }}
      _hover={{ style: { transform: "rotate(0deg) scale(1.02)" } as any }}
    >
      <Box
        border={`2.5px solid ${liked ? K : `${R}50`}`}
        bg={liked ? W : `${R}04`}
        position="relative"
        overflow="hidden"
        transition="all 0.2s"
      >
        <Box position="absolute" top="0" right="0" w="40px" h="40px"
          style={{ background: accent, clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />

        <Flex position="absolute" top="0" left="0" bg={accent} px="2" py="1">
          <Text fontSize="7px" fontWeight="800" letterSpacing="0.14em" textTransform="uppercase" color={W}>
            {venue.tag}
          </Text>
        </Flex>

        <Box px="4" pt="7" pb="2">
          <Text
            fontSize={isWide ? "18px" : "14px"} fontWeight="900" lineHeight="1.1"
            textTransform="uppercase" letterSpacing="-0.01em"
            color={liked ? K : G}
            style={{ textDecoration: liked ? "none" : "line-through", transition: "all 0.2s" }}
          >
            {venue.name}
          </Text>

          <Flex mt="2" align="center" gap="1.5">
            <Box w="4px" h="4px" borderRadius="full" bg={accent} flexShrink={0} />
            <Text fontSize="9px" fontWeight="600" color={G} letterSpacing="0.02em">{venue.district}</Text>
          </Flex>
          <Text fontSize="8px" color={`${K}30`} fontWeight="500" mt="0.5" letterSpacing="0.02em">
            {venue.addr}
          </Text>

          <Flex mt="2.5" gap="1" flexWrap="wrap">
            {venue.sources.map((s) => (
              <Flex key={s.name} px="1.5" py="0.5"
                bg={liked ? `${B}08` : `${R}06`}
                border={`1px solid ${liked ? `${B}18` : `${R}14`}`}
                align="center" gap="1" transition="all 0.2s"
              >
                <Box w="3px" h="3px" borderRadius="full" bg={liked ? B : R} flexShrink={0} />
                <Text fontSize="7px" fontWeight="600" color={liked ? K : G}
                  style={{ whiteSpace: "nowrap" }}>{s.name}</Text>
                <Text fontSize="7px" fontWeight="800" color={liked ? B : R}>{s.count}</Text>
              </Flex>
            ))}
          </Flex>
        </Box>

        <Flex px="4" py="2" bg={liked ? `${B}08` : `${R}06`}
          align="center" justify="space-between" transition="background 0.2s">
          <Flex align="center" gap="1.5">
            <Flex w="14px" h="14px" align="center" justify="center"
              border={`1.5px solid ${accent}`} bg={liked ? B : "transparent"} transition="all 0.18s">
              {liked && <Text fontSize="8px" color={W} lineHeight="1" fontWeight="900">✓</Text>}
              {!liked && <Text fontSize="7px" color={R} lineHeight="1" fontWeight="900">✕</Text>}
            </Flex>
            <Text fontSize="8px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={accent}>
              {liked ? "Нравится" : "Не хочу"}
            </Text>
          </Flex>
          <Text fontSize="7px" color={G} fontWeight="600">
            {venue.sources.reduce((a, s) => a + s.count, 0)} упоминаний
          </Text>
        </Flex>

        {!liked && (
          <Box position="absolute" inset="0" pointerEvents="none"
            style={{ background: `repeating-linear-gradient(135deg, transparent, transparent 8px, ${R}08 8px, ${R}08 9px)` }} />
        )}
      </Box>
    </Box>
  )
}

function ProfileCard() {
  const [likes, setLikes] = useState<Record<string, boolean>>(DEFAULT_LIKES)
  const toggle = useCallback((id: string) => setLikes((p) => ({ ...p, [id]: !p[id] })), [])

  const likedVenues = VENUES.filter((v) => likes[v.id])
  const dislikedVenues = VENUES.filter((v) => !likes[v.id])

  return (
    <Box className="p5-reveal p5-visible-left" style={{ animationDelay: "0.6s" }} mb="10">
      <Box border={`3px solid ${K}`} position="relative" overflow="hidden">

        <Box position="absolute" top="-1px" right="-1px" zIndex={3}>
          <Flex bg={B} px="3" py="1.5"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 8px 100%)" }}>
            <Text fontSize="9px" fontWeight="800" letterSpacing="0.18em" textTransform="uppercase" color={W}>
              Активный
            </Text>
          </Flex>
        </Box>

        <Box position="relative" overflow="hidden">
          <Box bg={K} px="5" pt="5" pb="16" position="relative">
            <Box position="absolute" bottom="0" left="0" right="0" h="50px"
              style={{ background: B, clipPath: "polygon(0 40%, 100% 0, 100% 100%, 0 100%)" }} />
            <Box position="absolute" bottom="0" left="0" right="0" h="50px"
              style={{ background: W, clipPath: "polygon(0 60%, 100% 20%, 100% 100%, 0 100%)" }} />

            <Flex align="center" gap="3" mb="3" position="relative" zIndex={1}>
              <Box w="48px" h="48px" borderRadius="full" border={`2.5px solid ${B}`}
                position="relative" overflow="hidden" bg={`${W}10`}>
                <Flex position="absolute" inset="0" align="center" justify="center">
                  <Text fontSize="20px" fontWeight="900" color={W}>А</Text>
                </Flex>
              </Box>
              <Stack gap="0">
                <Text fontSize="20px" fontWeight="900" textTransform="uppercase" letterSpacing="-0.02em" color={W}>
                  Алексей К.
                </Text>
                <Text fontSize="9px" fontWeight="600" letterSpacing="0.15em" textTransform="uppercase" color={`${W}50`}>
                  Москва · Арт-энтузиаст
                </Text>
              </Stack>
            </Flex>
          </Box>
        </Box>

        <Flex px="5" py="3" align="center" justify="space-between">
          <Flex align="center" gap="6">
            <Stack gap="0" align="center">
              <Text fontSize="22px" fontWeight="900" color={B} lineHeight="1">{likedVenues.length}</Text>
              <Text fontSize="7px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={G}>Нравится</Text>
            </Stack>
            <Box w="1px" h="28px" bg={`${K}12`} />
            <Stack gap="0" align="center">
              <Text fontSize="22px" fontWeight="900" color={R} lineHeight="1">{dislikedVenues.length}</Text>
              <Text fontSize="7px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={G}>Не хочу</Text>
            </Stack>
            <Box w="1px" h="28px" bg={`${K}12`} />
            <Stack gap="0" align="center">
              <Text fontSize="22px" fontWeight="900" color={K} lineHeight="1">{VENUES.length}</Text>
              <Text fontSize="7px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={G}>Всего</Text>
            </Stack>
          </Flex>
          <Flex bg={K} px="2.5" py="1.5"
            style={{ clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)" }}>
            <Text fontSize="8px" fontWeight="800" letterSpacing="0.1em" textTransform="uppercase" color={B}>
              87% мэтч
            </Text>
          </Flex>
        </Flex>

        <Box h="2px" bg={K} />

        <Box px="4" pt="4" pb="2">
          <Flex align="center" gap="2" mb="3">
            <Box w="20px" h="20px" bg={B}
              style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
            <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase" color={B}>
              Нравится
            </Text>
            <Box flex="1" h="1.5px" bg={`${B}20`} ml="1" />
          </Flex>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap="3">
            {likedVenues.map((v, i) => (
              <VenueTile key={v.id} venue={v} liked={true} onToggle={() => toggle(v.id)} idx={i} />
            ))}
          </Box>
        </Box>

        <Box position="relative" h="32px" overflow="hidden" my="1">
          <Box position="absolute" inset="0"
            style={{
              background: `linear-gradient(135deg, ${B}15 0%, transparent 40%, transparent 60%, ${R}15 100%)`,
              clipPath: "polygon(0 20%, 100% 0, 100% 80%, 0 100%)",
            }} />
          <Flex position="absolute" left="50%" top="50%"
            style={{ transform: "translate(-50%, -50%) skewX(-8deg)" }}
            bg={K} px="4" py="1">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.2em" textTransform="uppercase" color={W}>VS</Text>
          </Flex>
        </Box>

        <Box px="4" pt="2" pb="4">
          <Flex align="center" gap="2" mb="3">
            <Box w="20px" h="20px" bg={R}
              style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
            <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase" color={R}>
              Не хочу
            </Text>
            <Box flex="1" h="1.5px" bg={`${R}20`} ml="1" />
          </Flex>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap="3">
            {dislikedVenues.map((v, i) => (
              <VenueTile key={v.id} venue={v} liked={false} onToggle={() => toggle(v.id)} idx={i} />
            ))}
          </Box>
        </Box>

        <Box h="2px" bg={`${K}12`} />

        <Box px="5" pt="3" pb="3">
          <Text fontSize="8px" fontWeight="700" letterSpacing="0.14em" textTransform="uppercase" color={G} mb="2">
            Источники · Спаршено агентами
          </Text>
          <Flex gap="2" flexWrap="wrap">
            {aggregateSources(VENUES).map((s) => (
              <Flex key={s.name} px="2" py="1" bg={`${B}06`} border={`1px solid ${B}15`}
                align="center" gap="1.5">
                <Box w="4px" h="4px" borderRadius="full" bg={B} />
                <Text fontSize="8px" fontWeight="600" color={K}>{s.name}</Text>
                <Text fontSize="7px" fontWeight="800" color={B}>{s.count}</Text>
              </Flex>
            ))}
          </Flex>
        </Box>

        <Box h="1.5px" bg={`${K}08`} />

        <Flex px="5" py="4" align="center" justify="space-between">
          <Text fontSize="14px" fontWeight="900" textTransform="uppercase" letterSpacing="0.04em">Итого</Text>
          <Flex align="center" gap="3">
            <Flex align="center" gap="1">
              <Box w="8px" h="8px" bg={B} style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
              <Text fontSize="14px" fontWeight="900" color={B}>{likedVenues.length}</Text>
            </Flex>
            <Text fontSize="11px" color={G} fontWeight="700">/</Text>
            <Flex align="center" gap="1">
              <Box w="8px" h="8px" bg={R} style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
              <Text fontSize="14px" fontWeight="900" color={R}>{dislikedVenues.length}</Text>
            </Flex>
          </Flex>
        </Flex>

        <Box px="5" pb="5">
          <Flex as="button" align="center" justify="center" gap="2"
            bg={B} color={W} py="4" width="100%"
            fontSize="11px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase"
            cursor="pointer" _hover={{ opacity: 0.88 }} transition="opacity 0.15s"
            position="relative" overflow="hidden"
            style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
            <Box position="absolute" left="-20px" top="-20px" w="60px" h="60px" borderRadius="full" bg={`${W}08`} />
            Сохранить анкету
            <Text as="span" fontSize="14px">→</Text>
          </Flex>
        </Box>

        <Box position="absolute" bottom="-8px" left="20px" w="16px" h="16px" bg={B}
          style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
      </Box>
    </Box>
  )
}

export default function PipeExample() {
  return (
    <Box minH="100dvh" bg={W} color={K} position="relative" overflow="hidden">
      <PageWipe primary={B} secondary={K} />

      <Stack maxW="430px" mx="auto" px="6" pt="14" pb="20" gap="0" position="relative" zIndex={1}>

        <Flex align="center" justify="space-between" pb="12"
          className="p5-drop" style={{ animationDelay: "0.3s" }}>
          <Flex align="center" gap="3">
            <Box w="32px" h="32px" borderRadius="full" bg={B} />
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.25em" textTransform="uppercase">Pipe</Text>
          </Flex>
          <Flex direction="column" gap="2px" cursor="pointer">
            <Box w="20px" h="2px" bg={K} />
            <Box w="14px" h="2px" bg={K} />
          </Flex>
        </Flex>

        <Box pb="8" position="relative">
          <Text fontSize="48px" fontWeight="900" lineHeight="0.92" letterSpacing="-0.03em"
            textTransform="uppercase" className="p5-drop" style={{ animationDelay: "0.4s" }}>
            Мой
            <br />
            Профиль
            <Text as="span" color={B}>.</Text>
          </Text>
          <Text fontSize="11px" fontWeight="600" letterSpacing="0.14em" textTransform="uppercase"
            color={G} mt="4" maxW="260px" lineHeight="1.6"
            className="p5-drop" style={{ animationDelay: "0.5s" }}>
            Площадки Москвы · Твой выбор.
            <br />
            Агенты парсят события под тебя.
          </Text>
        </Box>

        <ProfileCard />

        <Flex gap="4" pb="10">
          {[
            { label: "Визитов", value: "42", sub: "за последний год" },
            { label: "Мэтч", value: "87%", sub: "с твоими вкусами" },
          ].map((card, i) => (
            <Box key={card.label} flex="1"
              className={`p5-reveal ${i === 0 ? "p5-visible-left" : "p5-visible-right"}`}
              style={{ animationDelay: `${0.8 + i * 0.12}s` }}>
              <Box border={`2.5px solid ${K}`} p="5" position="relative"
                style={{ transform: `rotate(${i === 0 ? -1.2 : 1.5}deg)` }}>
                <Text fontSize="10px" fontWeight="800" letterSpacing="0.18em" textTransform="uppercase" color={B}>
                  {card.label}
                </Text>
                <Text fontSize="42px" fontWeight="900" lineHeight="1" mt="1" letterSpacing="-0.03em">
                  {card.value}
                </Text>
                <Text fontSize="10px" color={G} fontWeight="600" mt="1" letterSpacing="0.04em">{card.sub}</Text>
                {i === 0 && (
                  <Box position="absolute" top="-7px" right="-7px" w="14px" h="14px" bg={B}
                    style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }} />
                )}
              </Box>
            </Box>
          ))}
        </Flex>

        <Box className="p5-drop" style={{ animationDelay: "1.1s" }}>
          <PipeFooter muted={G} accent={K} hoverColor={B} />
        </Box>

      </Stack>
    </Box>
  )
}
