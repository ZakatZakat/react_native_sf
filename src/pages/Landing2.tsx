import * as React from "react"
import { Box, Button, Flex, Image, Stack, Text } from "@chakra-ui/react"
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

function hashSeed(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return h
}

function chooseCards(all: EventCard[], seed: number, want: number): EventCard[] {
  const withImg = all.filter((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
  const scored = [...withImg].sort((a, b) => {
    const sa = firstLine(a.title).length + (a.description ?? "").length + (hashSeed(a.id) ^ seed)
    const sb = firstLine(b.title).length + (b.description ?? "").length + (hashSeed(b.id) ^ seed)
    return sb - sa
  })
  const out: EventCard[] = []
  const used = new Set<string>()
  for (const e of scored) {
    if (out.length >= want) break
    if (used.has(e.channel)) continue
    out.push(e)
    used.add(e.channel)
  }
  for (const e of scored) {
    if (out.length >= want) break
    if (out.some((x) => x.id === e.id)) continue
    out.push(e)
  }
  return out.slice(0, want)
}

type TileProps = {
  title: string
  label: string
  img: string | null
  bg: string
  textColor?: string
  tall?: boolean
}

function Tile({ title, label, img, bg, textColor = "#0F0F0F", tall }: TileProps) {
  return (
    <Box
      borderRadius="2xl"
      overflow="hidden"
      border="1px solid rgba(0,0,0,0.12)"
      bg={bg}
      position="relative"
      height={tall ? "320px" : "155px"}
    >
      {img ? (
        <Image src={img} alt={title} width="100%" height="100%" objectFit="cover" />
      ) : (
        <Box position="absolute" inset="0" bg="linear-gradient(135deg, rgba(255,255,255,0.25), rgba(0,0,0,0.06))" />
      )}

      <Box position="absolute" inset="0" p="3" display="flex" flexDirection="column" justifyContent="space-between">
        <Flex align="center" justify="space-between">
          <Box
            px="3"
            py="1"
            borderRadius="full"
            bg="rgba(255,255,255,0.75)"
            color="rgba(0,0,0,0.75)"
            fontSize="xs"
            fontWeight="semibold"
          >
            {label}
          </Box>
          <Box
            w="8"
            h="8"
            borderRadius="full"
            bg="rgba(255,255,255,0.75)"
            display="grid"
            placeItems="center"
            color="rgba(0,0,0,0.75)"
            fontSize="sm"
          >
            ↗
          </Box>
        </Flex>

        <Text
          fontSize={tall ? "2xl" : "lg"}
          fontWeight="black"
          lineHeight="1.05"
          letterSpacing="-0.5px"
          color={textColor}
          style={{
            textShadow: img ? "0 2px 10px rgba(0,0,0,0.25)" : "none",
            display: "-webkit-box",
            WebkitLineClamp: tall ? 4 : 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Text>
      </Box>
    </Box>
  )
}

export default function Landing2() {
  const [events, setEvents] = React.useState<EventCard[]>([])
  const [variant, setVariant] = React.useState<number>(() => Date.now())
  const [activeTab, setActiveTab] = React.useState<string>("Все")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=120`, { cache: "no-store" })
        if (!res.ok) throw new Error(`events status ${res.status}`)
        const data: EventCard[] = await res.json()
        setEvents(data)
      } catch (e) {
        console.error("landing2 load", e)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = React.useMemo(() => {
    if (activeTab === "Все") return events
    const key = activeTab.toLowerCase()
    return events.filter((e) => `${(e.title ?? "").toLowerCase()}\n${(e.description ?? "").toLowerCase()}`.includes(key))
  }, [activeTab, events])

  const cards = React.useMemo(() => chooseCards(filtered, variant, 4), [filtered, variant])
  const tiles = cards.map((c) => {
    const media = c.media_urls?.find((u) => isLikelyImageUrl(u)) ?? c.media_urls?.[0]
    const raw = resolveMediaUrl(media, apiUrl)
    return {
      card: c,
      img: raw && isLikelyImageUrl(raw) ? raw : null,
      title: firstLine(c.title) || firstLine(c.description) || "Событие",
      label: c.channel.replace(/^@/, "").slice(0, 18),
    }
  })

  return (
    <Box minH="100dvh" bg="#F2F2F2" color="#0F0F0F" fontFamily="system-ui" pb="10">
      <Stack gap="4" px="4" pt="5" maxW="430px" mx="auto">
        <Flex align="center" justify="space-between">
          <Flex align="center" gap="2">
            <Box w="9" h="9" borderRadius="full" bg="#FFD34E" display="grid" placeItems="center" fontWeight="black">
              L
            </Box>
            <Text fontSize="2xl" fontWeight="black" letterSpacing="-0.6px">
              lazy
            </Text>
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
            <RouterLink to="/">
              <Button size="sm" variant="outline" borderColor="rgba(0,0,0,0.14)" bg="rgba(255,255,255,0.65)">
                Landing 1
              </Button>
            </RouterLink>
          </Flex>
        </Flex>

        <Flex align="center" justify="space-between" gap="3" mt="1">
          <Text fontSize="4xl" fontWeight="black" lineHeight="0.95" letterSpacing="-0.9px">
            Подборка
            <br />
            ивентов
          </Text>
          <Box w="11" h="11" borderRadius="full" bg="#FFD34E" display="grid" placeItems="center" fontSize="lg">
            🛍️
          </Box>
        </Flex>

        {loading ? <Text color="rgba(0,0,0,0.55)">Загружаем…</Text> : null}

        {!loading && tiles.length < 4 ? (
          <Box borderRadius="2xl" bg="white" border="1px solid rgba(0,0,0,0.10)" p="4">
            <Text fontWeight="semibold">Недостаточно ивентов с картинками</Text>
            <Text fontSize="sm" color="rgba(0,0,0,0.6)" mt="1">
              Открой ленту и нажми «Забрать из TG», затем вернись сюда.
            </Text>
            <RouterLink to="/feed">
              <Button mt="3" bg="#0F0F0F" color="white">
                Перейти в ленту
              </Button>
            </RouterLink>
          </Box>
        ) : null}

        {!loading && tiles.length >= 4 ? (
          <Box>
            <Flex gap="10px">
              <Box flex="1.05">
                <Tile
                  tall
                  title={tiles[0].title}
                  label="в подборке"
                  img={tiles[0].img}
                  bg="#111"
                  textColor="white"
                />
              </Box>
              <Stack flex="0.95" gap="10px">
                <Tile
                  title={tiles[1].title}
                  label="топ"
                  img={null}
                  bg="white"
                  textColor="#0F0F0F"
                />
                <Tile
                  title={tiles[2].title}
                  label="быстро"
                  img={null}
                  bg="#111"
                  textColor="white"
                />
              </Stack>
            </Flex>
            <Box mt="10px">
              <Tile
                title={tiles[3].title}
                label="сегодня"
                img={tiles[3].img}
                bg="#FFD34E"
                textColor="#0F0F0F"
              />
            </Box>
          </Box>
        ) : null}

        <Flex gap="2" overflowX="auto" pb="2" style={{ scrollbarWidth: "none" }}>
          {["Все", "Концерты", "Вечеринки", "Театр", "Бесплатно", "Стендап"].map((t) => {
            const active = t === activeTab
            return (
              <Button
                key={t}
                size="sm"
                borderRadius="full"
                variant={active ? "solid" : "outline"}
                bg={active ? "#0F0F0F" : "white"}
                color={active ? "white" : "#111"}
                borderColor="rgba(0,0,0,0.18)"
                onClick={() => setActiveTab(t)}
                flex="0 0 auto"
              >
                {t}
              </Button>
            )
          })}
        </Flex>

        <RouterLink to="/feed">
          <Button bg="#0F0F0F" color="white" borderRadius="full">
            Открыть ленту
          </Button>
        </RouterLink>
      </Stack>
    </Box>
  )
}

