import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Box, Flex, Stack, Text, Image } from "@chakra-ui/react"
import {
  PageWipe, OpusFooter, useCountUp, useScrollReveal,
  API, isImg, resolveMedia, firstLine, formatDate,
  type EventCard,
} from "./opus/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

const STORAGE_KEY = "opus-profile"

type Category = {
  id: string
  label: string
  icon: string
  rotation: number
  channels: number
  posts: number
  keywords: string[]
}

const CATEGORIES: Category[] = [
  { id: "contemporary", label: "Совриск",     icon: "◆", rotation: -1.2, channels: 38,  posts: 214, keywords: ["совриск", "выстав", "экспоз", "галере", "арт", "art", "инсталляц"] },
  { id: "music",        label: "Музыка",      icon: "♫", rotation: 0.8,  channels: 52,  posts: 487, keywords: ["концерт", "gig", "live", "выступ", "музы", "фестивал"] },
  { id: "theatre",      label: "Театр",       icon: "◉", rotation: -0.6, channels: 27,  posts: 163, keywords: ["театр", "спектакл", "пьеса", "постановк"] },
  { id: "cinema",       label: "Кино",        icon: "▶", rotation: 1.2,  channels: 41,  posts: 329, keywords: ["кино", "фильм", "премьер", "показ", "cinema"] },
  { id: "architecture", label: "Архитектура", icon: "△", rotation: -0.9, channels: 19,  posts: 97,  keywords: ["архитектур", "здани", "город"] },
  { id: "streetart",    label: "Стрит-арт",   icon: "✦", rotation: 0.5,  channels: 23,  posts: 178, keywords: ["стрит", "street", "граффит", "мурал"] },
  { id: "lectures",     label: "Лекции",      icon: "◇", rotation: -1.3, channels: 34,  posts: 256, keywords: ["лекц", "talk", "meetup", "воркшоп", "workshop"] },
  { id: "parties",      label: "Вечеринки",   icon: "★", rotation: 1.0,  channels: 46,  posts: 412, keywords: ["вечерин", "rave", "dj", "техно", "house", "клуб"] },
  { id: "festivals",    label: "Фестивали",   icon: "⬡", rotation: -0.4, channels: 31,  posts: 189, keywords: ["фестивал", "fest", "open air"] },
  { id: "photo",        label: "Фото",        icon: "◎", rotation: 1.1,  channels: 22,  posts: 134, keywords: ["фото", "photo", "снимк", "выстав"] },
]

type ProfileData = { name: string; city: string; selected: string[] }

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* noop */ }
  return { name: "Алексей К.", city: "Москва", selected: [] }
}

function saveProfile(data: ProfileData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function CategoryCard({ cat, onPick, animClass, idx }: {
  cat: Category; onPick: () => void; animClass: string; idx: number
}) {
  const floatDur = 2.8 + (idx % 5) * 0.4
  const floatDel = (idx % 7) * 0.3
  const cls = animClass || "p5-float"

  return (
    <Box
      className={cls}
      style={{
        "--rot": `${cat.rotation}deg`,
        "--float-dur": `${floatDur}s`,
        "--float-del": `${floatDel}s`,
        transform: `rotate(${cat.rotation}deg)`,
      } as React.CSSProperties}
      cursor="pointer"
      onClick={onPick}
      _hover={{ style: { transform: "rotate(0deg) scale(1.05)" } as any }}
    >
      <Box
        border={`2.5px solid ${K}`}
        bg={W}
        position="relative"
        overflow="hidden"
        transition="box-shadow 0.2s"
        _hover={{ boxShadow: `4px 4px 0 ${B}` }}
      >
        <Box position="absolute" top="0" right="0" w="28px" h="28px"
          style={{ background: B, clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />

        <Box px="3" pt="3" pb="1.5">
          <Text fontSize="20px" lineHeight="1" mb="1">{cat.icon}</Text>
          <Text fontSize="12px" fontWeight="900" textTransform="uppercase" letterSpacing="0.04em" lineHeight="1.1" color={K}>
            {cat.label}
          </Text>
        </Box>

        <Box px="3" pb="2">
          <Flex align="center" gap="2">
            <Text fontSize="7px" fontWeight="700" color={G}>
              {cat.channels} кан.
            </Text>
            <Box w="2px" h="2px" borderRadius="full" bg={G} />
            <Text fontSize="7px" fontWeight="700" color={G}>
              {cat.posts} пост.
            </Text>
          </Flex>
        </Box>

        <Flex px="3" py="1.5" bg={`${B}08`} align="center" gap="1">
          <Box w="6px" h="6px" bg={B} style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} />
          <Text fontSize="7px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={B}>
            Выбрать
          </Text>
        </Flex>
      </Box>
    </Box>
  )
}

function SelectedTag({ cat, onRemove, animClass }: {
  cat: Category; onRemove: () => void; animClass: string
}) {
  return (
    <Flex
      className={animClass}
      align="center" gap="1.5"
      px="3" py="1.5"
      bg={B} color={W}
      cursor="pointer"
      onClick={onRemove}
      style={{ clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)" }}
      _hover={{ opacity: 0.85 }}
      transition="opacity 0.15s"
    >
      <Text fontSize="11px" lineHeight="1">{cat.icon}</Text>
      <Text fontSize="9px" fontWeight="800" letterSpacing="0.1em" textTransform="uppercase">
        {cat.label}
      </Text>
      <Text fontSize="9px" fontWeight="400" ml="0.5" opacity={0.6}>✕</Text>
    </Flex>
  )
}

function AgentStats({ selectedCats }: { selectedCats: Category[] }) {
  const totalChannels = selectedCats.reduce((a, c) => a + c.channels, 0)
  const totalPosts = selectedCats.reduce((a, c) => a + c.posts, 0)

  const animChannels = useCountUp(totalChannels)
  const animPosts = useCountUp(totalPosts)

  if (selectedCats.length === 0) return null

  return (
    <Box mb="6" className="p5-land-in">
      <Flex align="center" gap="2" mb="3">
        <Box w="4px" h="18px" bg={B} />
        <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase" color={K}>
          AI-агенты нашли
        </Text>
      </Flex>

      <Flex gap="3">
        {[
          { value: animChannels, label: "Каналов" },
          { value: animPosts, label: "Постов" },
          { value: selectedCats.length, label: "Категорий" },
        ].map((s) => (
          <Box key={s.label} flex="1" border={`2px solid ${K}`} bg={`${B}04`} p="3.5" position="relative" overflow="hidden">
            <Box position="absolute" top="0" right="0" w="24px" h="24px"
              style={{ background: `${B}12`, clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />
            <Text fontSize="28px" fontWeight="900" color={B} lineHeight="1">{s.value}</Text>
            <Text fontSize="8px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={G} mt="1">
              {s.label}
            </Text>
          </Box>
        ))}
      </Flex>

      <Stack gap="0" mt="3">
        {selectedCats.map((cat) => (
          <Flex key={cat.id} px="3" py="2" justify="space-between" align="center"
            borderBottom={`1px solid ${K}10`}>
            <Flex align="center" gap="2">
              <Text fontSize="12px" lineHeight="1">{cat.icon}</Text>
              <Text fontSize="10px" fontWeight="800" textTransform="uppercase" letterSpacing="0.04em" color={K}>
                {cat.label}
              </Text>
            </Flex>
            <Flex align="center" gap="3">
              <Text fontSize="9px" fontWeight="700" color={G}>{cat.channels} кан.</Text>
              <Box w="2px" h="2px" borderRadius="full" bg={`${K}30`} />
              <Text fontSize="9px" fontWeight="700" color={G}>{cat.posts} пост.</Text>
            </Flex>
          </Flex>
        ))}
      </Stack>
    </Box>
  )
}

/* ── Transition Wipe ── */
function TransitionWipe({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<"idle" | "in" | "hold" | "out">("idle")

  useEffect(() => {
    if (!active) { setPhase("idle"); return }
    setPhase("in")
    const t1 = setTimeout(() => setPhase("hold"), 400)
    const t2 = setTimeout(() => setPhase("out"), 700)
    const t3 = setTimeout(() => setPhase("idle"), 1100)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [active])

  if (phase === "idle") return null

  return (
    <Box position="fixed" inset="0" zIndex={200} pointerEvents="none" overflow="hidden">
      {/* Blue stripe */}
      <Box position="absolute" inset="-20% -40%" bg={B}
        style={{
          transform: phase === "in" ? "translateX(0%) skewX(-18deg)"
            : phase === "hold" ? "translateX(0%) skewX(-18deg)"
            : "translateX(110%) skewX(-18deg)",
          transition: phase === "in" ? "transform 0.4s cubic-bezier(0.77,0,0.175,1)"
            : "transform 0.4s cubic-bezier(0.77,0,0.175,1)",
          ...(phase === "in" ? {} : {}),
        }} />
      {/* Black stripe (delayed) */}
      <Box position="absolute" inset="-20% -40%" bg={K}
        style={{
          transform: phase === "in" ? "translateX(0%) skewX(-18deg)"
            : phase === "hold" ? "translateX(0%) skewX(-18deg)"
            : "translateX(110%) skewX(-18deg)",
          transition: phase === "in" ? "transform 0.4s cubic-bezier(0.77,0,0.175,1) 0.06s"
            : "transform 0.4s cubic-bezier(0.77,0,0.175,1) 0.06s",
        }} />
      {/* Center text during hold */}
      {(phase === "hold") && (
        <Flex position="absolute" inset="0" align="center" justify="center" zIndex={1}>
          <Text fontSize="14px" fontWeight="900" letterSpacing="0.3em" textTransform="uppercase" color={W}
            style={{ animation: "p5-land-in 0.3s cubic-bezier(0.22,1,0.36,1) both" }}>
            Твоя лента
          </Text>
        </Flex>
      )}
    </Box>
  )
}

/* ── Personal Feed ── */
function PersonalFeed({ categories, onBack }: { categories: Category[]; onBack: () => void }) {
  const [items, setItems] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [failedImgs, setFailedImgs] = useState<Record<string, true>>({})
  const reveal = useScrollReveal()

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/events?limit=40`, { cache: "no-store" })
        if (res.ok) setItems(await res.json())
      } catch { /* */ } finally {
        setLoading(false)
      }
    })()
  }, [])

  const allKeywords = useMemo(() =>
    categories.flatMap((c) => c.keywords), [categories])

  const filtered = useMemo(() => {
    if (allKeywords.length === 0) return items
    return items.filter((ev) => {
      const t = `${ev.title ?? ""}\n${ev.description ?? ""}\n${ev.channel}`.toLowerCase()
      return allKeywords.some((kw) => t.includes(kw))
    })
  }, [items, allKeywords])

  const display = filtered.length > 0 ? filtered : items.slice(0, 12)

  return (
    <Stack gap="0">
      {/* Header */}
      <Flex align="center" justify="space-between" pb="6"
        className="p5-drop" style={{ animationDelay: "0.1s" }}>
        <Stack gap="1">
          <Text fontSize="32px" fontWeight="900" lineHeight="0.92"
            letterSpacing="-0.03em" textTransform="uppercase">
            Твоя
            <Text as="span" color={B}> Лента</Text>
          </Text>
          <Flex gap="1.5" flexWrap="wrap">
            {categories.map((c) => (
              <Flex key={c.id} align="center" gap="1" px="2" py="0.5" bg={`${B}08`}
                border={`1px solid ${B}15`}>
                <Text fontSize="9px" lineHeight="1">{c.icon}</Text>
                <Text fontSize="7px" fontWeight="700" letterSpacing="0.08em"
                  textTransform="uppercase" color={B}>{c.label}</Text>
              </Flex>
            ))}
          </Flex>
        </Stack>
        <Flex
          as="button" onClick={onBack}
          px="3" py="1.5"
          border={`2px solid ${K}`}
          fontSize="10px" fontWeight="800" letterSpacing="0.12em" textTransform="uppercase"
          cursor="pointer" _hover={{ bg: K, color: W }} transition="all 0.15s"
        >
          ← Назад
        </Flex>
      </Flex>

      {/* Count */}
      <Text fontSize="10px" fontWeight="700" letterSpacing="0.15em"
        textTransform="uppercase" color={G} pb="4"
        className="p5-drop" style={{ animationDelay: "0.2s" }}>
        {display.length} {display.length === 1 ? "событие" : "событий"}
        {filtered.length === 0 && items.length > 0 && " · Показываем рекомендации"}
      </Text>

      {/* Cards */}
      {loading ? (
        <Text color={G} fontSize="sm" py="10" textAlign="center">Загружаем события...</Text>
      ) : (
        <Stack gap="5">
          {display.map((card, idx) => {
            const media = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
            const rawSrc = resolveMedia(media)
            const imgSrc = rawSrc && isImg(rawSrc) && !failedImgs[card.id] ? rawSrc : null
            const title = firstLine(card.title) || firstLine(card.description) || "Событие"
            const date = formatDate(card.event_time || card.created_at)
            const tilt = idx % 3 === 0 ? -0.6 : idx % 3 === 1 ? 0.5 : 0

            return (
              <Box key={card.id} ref={(el) => reveal(el, idx)}>
                <Box
                  border={`2.5px solid ${K}`}
                  position="relative"
                  style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
                  _hover={{ boxShadow: `4px 4px 0 ${B}` }}
                  transition="box-shadow 0.15s"
                >
                  {imgSrc && (
                    <Box overflow="hidden" borderBottom={`2px solid ${K}`}>
                      <Image
                        src={imgSrc} alt={title}
                        width="100%" height="auto" maxH="260px"
                        objectFit="cover" display="block"
                        onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
                      />
                    </Box>
                  )}
                  <Box px="4" py="3">
                    <Flex justify="space-between" align="center" mb="2">
                      <Text fontSize="10px" fontWeight="700" letterSpacing="0.15em"
                        textTransform="uppercase" color={B}>{card.channel}</Text>
                      {date && (
                        <Text fontSize="10px" fontWeight="600" letterSpacing="0.08em"
                          color={G} textTransform="uppercase">{date}</Text>
                      )}
                    </Flex>
                    <Text fontSize="16px" fontWeight="900" lineHeight="1.15"
                      textTransform="uppercase" letterSpacing="-0.01em"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                      {title}
                    </Text>
                    <Flex mt="3" align="center" justify="space-between"
                      borderTop={`1px solid ${K}12`} pt="2">
                      <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em"
                        textTransform="uppercase" color={G}>Подробнее</Text>
                      <Text fontSize="14px" fontWeight="900" color={B}>→</Text>
                    </Flex>
                  </Box>
                  {idx === 0 && (
                    <Box position="absolute" top="-8px" right="-8px"
                      w="16px" h="16px" borderRadius="full" bg={B} />
                  )}
                </Box>
              </Box>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}

/* ── Main Page ── */
export default function OpusMyProfile() {
  const [profile, setProfile] = useState<ProfileData>(loadProfile)
  const [view, setView] = useState<"profile" | "transition" | "feed">("profile")

  const [pickingOut, setPickingOut] = useState<string | null>(null)
  const [landingIn, setLandingIn] = useState<string | null>(null)
  const [ejecting, setEjecting] = useState<string | null>(null)
  const [returning, setReturning] = useState<string | null>(null)

  const selected = new Set(profile.selected)
  const available = CATEGORIES.filter((c) => !selected.has(c.id))
  const selectedCats = CATEGORIES.filter((c) => selected.has(c.id))

  const persist = useCallback((sel: string[]) => {
    const next = { ...profile, selected: sel }
    setProfile(next)
    saveProfile(next)
  }, [profile])

  const handlePick = useCallback((id: string) => {
    if (pickingOut || ejecting) return
    setPickingOut(id)
    setTimeout(() => {
      setPickingOut(null)
      setLandingIn(id)
      persist([...profile.selected, id])
      setTimeout(() => setLandingIn(null), 350)
    }, 400)
  }, [pickingOut, ejecting, profile, persist])

  const handleRemove = useCallback((id: string) => {
    if (pickingOut || ejecting) return
    setEjecting(id)
    setTimeout(() => {
      setEjecting(null)
      setReturning(id)
      persist(profile.selected.filter((s) => s !== id))
      setTimeout(() => setReturning(null), 450)
    }, 250)
  }, [pickingOut, ejecting, profile, persist])

  const savedBanner = useRef<HTMLDivElement>(null)
  const [showSaved, setShowSaved] = useState(false)

  const handleSave = useCallback(() => {
    saveProfile(profile)
    setShowSaved(true)
    setTimeout(() => {
      setShowSaved(false)
      setView("transition")
      setTimeout(() => {
        setView("feed")
        window.scrollTo({ top: 0 })
      }, 700)
    }, 800)
  }, [profile])

  const handleBack = useCallback(() => {
    setView("transition")
    setTimeout(() => {
      setView("profile")
      window.scrollTo({ top: 0 })
    }, 700)
  }, [])

  return (
    <Box minH="100dvh" bg={W} color={K} position="relative" overflow="hidden">
      {view === "profile" && <PageWipe primary={B} secondary={K} />}
      <TransitionWipe active={view === "transition"} />

      <Stack maxW="430px" mx="auto" px="6" pt="14" pb="20" gap="0" position="relative" zIndex={1}>

        {view === "feed" ? (
          /* ── FEED VIEW ── */
          <PersonalFeed
            categories={selectedCats}
            onBack={handleBack}
          />
        ) : view === "profile" ? (
          /* ── PROFILE VIEW ── */
          <>
            {/* NAV */}
            <Flex align="center" justify="space-between" pb="10"
              className="p5-drop" style={{ animationDelay: "0.3s" }}>
              <Flex align="center" gap="3">
                <Box w="32px" h="32px" borderRadius="full" bg={B} />
                <Text fontSize="11px" fontWeight="800" letterSpacing="0.25em" textTransform="uppercase">
                  Opus
                </Text>
              </Flex>
              <Flex direction="column" gap="2px" cursor="pointer">
                <Box w="20px" h="2px" bg={K} />
                <Box w="14px" h="2px" bg={K} />
              </Flex>
            </Flex>

            {/* PROFILE HEADER — P5R Confidant Card */}
            <Box className="p5-reveal p5-visible-left" style={{ animationDelay: "0.4s" }} mb="8"
              position="relative">
              <Box border={`3px solid ${K}`} position="relative" overflow="hidden" bg={W}>
                <Box position="absolute" top="0" left="0" bottom="0" w="72px" bg={B} zIndex={0} />
                <Box position="absolute" top="0" right="0" w="100px" h="28px" zIndex={0}
                  style={{ background: K, clipPath: "polygon(40px 0,100% 0,100% 100%,0 100%)" }} />

                <Box position="absolute" top="16px" left="12px" zIndex={3}>
                  <Box w="48px" h="48px" position="relative">
                    <Box position="absolute" inset="0" borderRadius="full" bg={W} />
                    <Box position="absolute" inset="2px" borderRadius="full" bg={K} />
                    <Flex position="absolute" inset="0" align="center" justify="center">
                      <Text fontSize="22px" fontWeight="900" color={B}>{profile.name.charAt(0)}</Text>
                    </Flex>
                  </Box>
                </Box>

                <Box position="relative" zIndex={1} pl="84px" pr="5">
                  <Box pt="4" pb="1">
                    <Flex align="center" gap="2">
                      <Text fontSize="9px" fontWeight="800" letterSpacing="0.18em"
                        textTransform="uppercase" color={`${W}70`}>№01</Text>
                      <Box flex="1" h="1px" bg={`${K}10`} />
                    </Flex>
                    <Text fontSize="24px" fontWeight="900" textTransform="uppercase"
                      letterSpacing="-0.02em" color={K} lineHeight="1" mt="1">
                      {profile.name}
                    </Text>
                    <Flex align="center" gap="1.5" mt="1.5">
                      <Box w="5px" h="5px" bg={B}
                        style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} />
                      <Text fontSize="8px" fontWeight="700" letterSpacing="0.12em"
                        textTransform="uppercase" color={G}>{profile.city}</Text>
                    </Flex>
                  </Box>

                  <Box h="1.5px" my="2"
                    style={{ background: `linear-gradient(90deg, ${B}, ${K}20, transparent)` }} />

                  <Flex gap="4" pb="4" align="flex-end">
                    <Stack gap="1" flex="1">
                      <Text fontSize="6px" fontWeight="800" letterSpacing="0.14em"
                        textTransform="uppercase" color={G}>Выбрано</Text>
                      <Flex align="center" gap="2">
                        <Text fontSize="28px" fontWeight="900" color={B} lineHeight="1">
                          {selectedCats.length}
                        </Text>
                        <Box flex="1" h="6px" bg={`${K}08`} position="relative" overflow="hidden">
                          <Box h="100%" bg={B} transition="width 0.4s cubic-bezier(0.22,1,0.36,1)"
                            style={{ width: `${(selectedCats.length / CATEGORIES.length) * 100}%` }} />
                        </Box>
                      </Flex>
                    </Stack>
                    <Stack gap="0" align="center" flexShrink={0}>
                      <Text fontSize="6px" fontWeight="800" letterSpacing="0.14em"
                        textTransform="uppercase" color={G}>/ {CATEGORIES.length}</Text>
                    </Stack>
                  </Flex>
                </Box>

                <Box position="relative" overflow="hidden">
                  <Box h="32px" bg={K} position="relative">
                    <Box position="absolute" top="0" left="0" bottom="0" w="72px" bg={B} style={{ opacity: 0.4 }} />
                    <Box position="absolute" top="0" left="60px" bottom="0" w="40px"
                      style={{ background: B, clipPath: "polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)" }} />
                    <Flex position="relative" zIndex={1} h="100%" align="center" justify="flex-end" px="5">
                      {selectedCats.length > 0 ? (
                        <Flex align="center" gap="2">
                          <Text fontSize="8px" fontWeight="700" letterSpacing="0.1em"
                            textTransform="uppercase" color={`${W}50`}>Мэтч</Text>
                          <Text fontSize="18px" fontWeight="900" color={B} lineHeight="1">
                            {Math.round((selectedCats.length / CATEGORIES.length) * 100)}%
                          </Text>
                        </Flex>
                      ) : (
                        <Text fontSize="8px" fontWeight="700" letterSpacing="0.12em"
                          textTransform="uppercase" color={`${W}30`}>Выбери категории</Text>
                      )}
                    </Flex>
                  </Box>
                </Box>
              </Box>
              <Box position="absolute" top="-5px" right="-5px" w="14px" h="14px" bg={B}
                style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} />
            </Box>

            {/* SELECTED ZONE */}
            <Box className="p5-drop" style={{ animationDelay: "0.55s" }} mb="6">
              <Flex align="center" gap="2" mb="3">
                <Box w="4px" h="18px" bg={B} />
                <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase">
                  Мои интересы
                </Text>
                {selectedCats.length > 0 && (
                  <Flex ml="1" px="2" py="0.5" border={`1.5px solid ${K}`}>
                    <Text fontSize="9px" fontWeight="800" color={K}>{selectedCats.length}</Text>
                  </Flex>
                )}
              </Flex>

              {selectedCats.length === 0 ? (
                <Box border={`2px dashed ${K}25`} py="6" px="4">
                  <Text fontSize="11px" fontWeight="600" color={G} textAlign="center" letterSpacing="0.06em">
                    Выбери категории ниже — AI-агенты начнут искать события
                  </Text>
                </Box>
              ) : (
                <Flex gap="2" flexWrap="wrap">
                  {selectedCats.map((cat) => {
                    let anim = ""
                    if (landingIn === cat.id) anim = "p5-land-in"
                    if (ejecting === cat.id) anim = "p5-eject"
                    return (
                      <SelectedTag key={cat.id} cat={cat} onRemove={() => handleRemove(cat.id)} animClass={anim} />
                    )
                  })}
                </Flex>
              )}
            </Box>

            {/* AGENT STATS */}
            <AgentStats selectedCats={selectedCats} />

            {/* SEPARATOR */}
            <Box position="relative" h="28px" overflow="hidden" mb="4"
              className="p5-drop" style={{ animationDelay: "0.65s" }}>
              <Box position="absolute" inset="0"
                style={{
                  background: `linear-gradient(135deg, ${B}15, transparent 50%, ${K}08)`,
                  clipPath: "polygon(0 25%,100% 0,100% 75%,0 100%)",
                }} />
              <Flex position="absolute" left="50%" top="50%"
                style={{ transform: "translate(-50%,-50%) skewX(-8deg)" }}
                bg={K} px="4" py="1">
                <Text fontSize="8px" fontWeight="900" letterSpacing="0.2em" textTransform="uppercase" color={W}>
                  AI подберёт
                </Text>
              </Flex>
            </Box>

            {/* CATEGORY PICKER */}
            <Box className="p5-drop" style={{ animationDelay: "0.7s" }} mb="8" overflow="visible">
              <Flex align="center" gap="2" mb="4">
                <Box w="20px" h="20px" bg={B}
                  style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} />
                <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase">
                  Категории
                </Text>
                <Box flex="1" h="1.5px" bg={`${K}15`} ml="1" />
                <Text fontSize="9px" fontWeight="700" color={G}>{available.length} доступно</Text>
              </Flex>

              {available.length === 0 ? (
                <Box border={`2.5px solid ${K}`} bg={`${B}06`} py="6" px="4">
                  <Text fontSize="12px" fontWeight="800" textTransform="uppercase" textAlign="center"
                    letterSpacing="0.08em" color={K}>
                    Все категории выбраны!
                  </Text>
                </Box>
              ) : (
                <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap="3"
                  px="2" py="2" overflow="visible">
                  {available.map((cat, i) => {
                    let anim = ""
                    if (pickingOut === cat.id) anim = "p5-pick-out"
                    if (returning === cat.id) anim = "p5-return"
                    return (
                      <CategoryCard key={cat.id} cat={cat} onPick={() => handlePick(cat.id)} animClass={anim} idx={i} />
                    )
                  })}
                </Box>
              )}
            </Box>

            {/* SAVE → transitions to feed */}
            <Box className="p5-reveal p5-visible-left" style={{ animationDelay: "0.85s" }}>
              <Box position="relative" ref={savedBanner}>
                <Flex
                  as="button" align="center" justify="center" gap="2"
                  bg={B} color={W} py="4" width="100%"
                  fontSize="11px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase"
                  cursor="pointer" _hover={{ opacity: 0.88 }} transition="opacity 0.15s"
                  position="relative" overflow="hidden" onClick={handleSave}
                  style={{ clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)" }}
                >
                  <Box position="absolute" left="-20px" top="-20px" w="60px" h="60px" borderRadius="full" bg={`${W}08`} />
                  Сохранить и смотреть
                  <Text as="span" fontSize="14px">→</Text>
                </Flex>

                {showSaved && (
                  <Flex position="absolute" inset="0" align="center" justify="center"
                    bg={`${K}DD`}
                    style={{
                      clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)",
                      animation: "p5-land-in 0.3s cubic-bezier(0.22,1,0.36,1) both",
                    }}>
                    <Text fontSize="11px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase" color={W}>
                      ✓ Сохранено!
                    </Text>
                  </Flex>
                )}
              </Box>
            </Box>

            {/* FOOTER */}
            <Box className="p5-drop" style={{ animationDelay: "1s" }} pt="2">
              <OpusFooter muted={G} accent={K} hoverColor={B} />
            </Box>
          </>
        ) : null}

        {/* Footer on feed view */}
        {view === "feed" && (
          <Box pt="8">
            <OpusFooter muted={G} accent={K} hoverColor={B} />
          </Box>
        )}
      </Stack>
    </Box>
  )
}
