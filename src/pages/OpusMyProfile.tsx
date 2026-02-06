import { useState, useEffect, useCallback, useRef } from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"
const R = "#E53535"

const STORAGE_KEY = "opus-profile"

type Category = {
  id: string
  label: string
  icon: string
  rotation: number
}

const CATEGORIES: Category[] = [
  { id: "contemporary",  label: "Совриск",      icon: "◆", rotation: -2.1 },
  { id: "music",          label: "Музыка",       icon: "♫", rotation: 1.4 },
  { id: "theatre",        label: "Театр",        icon: "◉", rotation: -1.0 },
  { id: "cinema",         label: "Кино",         icon: "▶", rotation: 2.2 },
  { id: "architecture",   label: "Архитектура",  icon: "△", rotation: -1.6 },
  { id: "streetart",      label: "Стрит-арт",    icon: "✦", rotation: 0.9 },
  { id: "lectures",       label: "Лекции",       icon: "◇", rotation: -2.4 },
  { id: "parties",        label: "Вечеринки",    icon: "★", rotation: 1.7 },
  { id: "festivals",      label: "Фестивали",    icon: "⬡", rotation: -0.7 },
  { id: "photo",          label: "Фото",         icon: "◎", rotation: 2.0 },
]

type ProfileData = {
  name: string
  city: string
  selected: string[]
}

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

/* ── Page entrance wipe ── */
function PageWipe() {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 900)
    return () => clearTimeout(t)
  }, [])
  if (done) return null
  return (
    <Box position="fixed" inset="0" zIndex={100} pointerEvents="none" overflow="hidden">
      <Box position="absolute" inset="-20% -40%" bg={B}
        style={{ animation: "p5-wipe 0.8s cubic-bezier(0.77,0,0.175,1) forwards" }} />
      <Box position="absolute" inset="-20% -40%" bg={K}
        style={{ animation: "p5-wipe-black 0.8s cubic-bezier(0.77,0,0.175,1) 0.08s forwards" }} />
    </Box>
  )
}

/* ── Available category card (big, tilted) ── */
function CategoryCard({ cat, onPick, animClass }: {
  cat: Category; onPick: () => void; animClass: string
}) {
  return (
    <Box
      className={animClass}
      style={{ "--rot": `${cat.rotation}deg`, transform: `rotate(${cat.rotation}deg)` } as React.CSSProperties}
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
        {/* Diagonal accent */}
        <Box position="absolute" top="0" right="0" w="28px" h="28px"
          style={{ background: B, clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />

        <Box px="3" pt="3" pb="2.5">
          <Text fontSize="20px" lineHeight="1" mb="1">{cat.icon}</Text>
          <Text fontSize="13px" fontWeight="900" textTransform="uppercase" letterSpacing="0.04em" lineHeight="1.1">
            {cat.label}
          </Text>
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

/* ── Selected category tag (compact, in the dossier) ── */
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

/* ══════════════════════════════════════════════ */

export default function OpusMyProfile() {
  const [profile, setProfile] = useState<ProfileData>(loadProfile)

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
    setTimeout(() => setShowSaved(false), 1500)
  }, [profile])

  return (
    <Box minH="100dvh" bg={W} color={K} position="relative" overflow="hidden">
      <PageWipe />

      <Stack maxW="430px" mx="auto" px="6" pt="14" pb="20" gap="0" position="relative" zIndex={1}>

        {/* ── NAV ── */}
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

        {/* ── PROFILE HEADER ── */}
        <Box
          className="p5-reveal p5-visible-left"
          style={{ animationDelay: "0.4s" }}
          mb="8"
        >
          <Box border={`3px solid ${K}`} position="relative" overflow="hidden">
            {/* Black header with diagonal cut */}
            <Box bg={K} px="5" pt="5" pb="14" position="relative">
              <Box position="absolute" bottom="0" left="0" right="0" h="40px"
                style={{ background: B, clipPath: "polygon(0 45%,100% 0,100% 100%,0 100%)" }} />
              <Box position="absolute" bottom="0" left="0" right="0" h="40px"
                style={{ background: W, clipPath: "polygon(0 65%,100% 25%,100% 100%,0 100%)" }} />

              <Flex align="center" gap="3" position="relative" zIndex={1}>
                <Box w="52px" h="52px" borderRadius="full" border={`2.5px solid ${B}`}
                  bg={`${W}10`} position="relative" overflow="hidden">
                  <Flex position="absolute" inset="0" align="center" justify="center">
                    <Text fontSize="22px" fontWeight="900" color={W}>
                      {profile.name.charAt(0)}
                    </Text>
                  </Flex>
                </Box>
                <Stack gap="0">
                  <Text fontSize="22px" fontWeight="900" textTransform="uppercase"
                    letterSpacing="-0.02em" color={W}>
                    {profile.name}
                  </Text>
                  <Text fontSize="9px" fontWeight="600" letterSpacing="0.15em"
                    textTransform="uppercase" color={`${W}50`}>
                    {profile.city} · Арт-энтузиаст
                  </Text>
                </Stack>
              </Flex>
            </Box>

            {/* Stats bar */}
            <Flex px="5" py="3" align="center" justify="space-between">
              <Flex align="center" gap="5">
                <Stack gap="0" align="center">
                  <Text fontSize="24px" fontWeight="900" color={B} lineHeight="1">{selectedCats.length}</Text>
                  <Text fontSize="7px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={G}>Выбрано</Text>
                </Stack>
                <Box w="1px" h="28px" bg={`${K}12`} />
                <Stack gap="0" align="center">
                  <Text fontSize="24px" fontWeight="900" color={K} lineHeight="1">{CATEGORIES.length}</Text>
                  <Text fontSize="7px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={G}>Всего</Text>
                </Stack>
              </Flex>
              {selectedCats.length > 0 && (
                <Flex bg={K} px="2.5" py="1.5"
                  style={{ clipPath: "polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)" }}>
                  <Text fontSize="8px" fontWeight="800" letterSpacing="0.1em" textTransform="uppercase" color={B}>
                    {Math.round((selectedCats.length / CATEGORIES.length) * 100)}% заполнено
                  </Text>
                </Flex>
              )}
            </Flex>
          </Box>
        </Box>

        {/* ── SELECTED ZONE (dossier) ── */}
        <Box
          className="p5-drop" style={{ animationDelay: "0.55s" }}
          mb="6"
        >
          <Flex align="center" gap="2" mb="3">
            <Box w="4px" h="18px" bg={B} />
            <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase">
              Мои интересы
            </Text>
            {selectedCats.length > 0 && (
              <Flex ml="1" px="2" py="0.5" border={`1.5px solid ${B}`}>
                <Text fontSize="9px" fontWeight="800" color={B}>{selectedCats.length}</Text>
              </Flex>
            )}
          </Flex>

          {selectedCats.length === 0 ? (
            <Box border={`2px dashed ${K}15`} py="6" px="4">
              <Text fontSize="11px" fontWeight="600" color={G} textAlign="center" letterSpacing="0.06em">
                Выбери категории ниже — они появятся здесь
              </Text>
            </Box>
          ) : (
            <Flex gap="2" flexWrap="wrap">
              {selectedCats.map((cat) => {
                let anim = ""
                if (landingIn === cat.id) anim = "p5-land-in"
                if (ejecting === cat.id) anim = "p5-eject"
                return (
                  <SelectedTag
                    key={cat.id}
                    cat={cat}
                    onRemove={() => handleRemove(cat.id)}
                    animClass={anim}
                  />
                )
              })}
            </Flex>
          )}
        </Box>

        {/* ── SEPARATOR ── */}
        <Box position="relative" h="28px" overflow="hidden" mb="4"
          className="p5-drop" style={{ animationDelay: "0.65s" }}>
          <Box position="absolute" inset="0"
            style={{
              background: `linear-gradient(135deg, ${B}12, transparent 50%, ${K}08)`,
              clipPath: "polygon(0 25%,100% 0,100% 75%,0 100%)",
            }} />
          <Flex position="absolute" left="50%" top="50%"
            style={{ transform: "translate(-50%,-50%) skewX(-8deg)" }}
            bg={K} px="4" py="1">
            <Text fontSize="8px" fontWeight="900" letterSpacing="0.2em" textTransform="uppercase" color={W}>
              Выбери свои
            </Text>
          </Flex>
        </Box>

        {/* ── CATEGORY PICKER GRID ── */}
        <Box
          className="p5-drop" style={{ animationDelay: "0.7s" }}
          mb="8"
        >
          <Flex align="center" gap="2" mb="4">
            <Box w="20px" h="20px" bg={B}
              style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} />
            <Text fontSize="12px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase" color={B}>
              Категории
            </Text>
            <Box flex="1" h="1.5px" bg={`${B}20`} ml="1" />
            <Text fontSize="9px" fontWeight="700" color={G}>{available.length} доступно</Text>
          </Flex>

          {available.length === 0 ? (
            <Box border={`2.5px solid ${B}`} bg={`${B}06`} py="6" px="4">
              <Text fontSize="12px" fontWeight="800" textTransform="uppercase" textAlign="center"
                letterSpacing="0.08em" color={B}>
                Все категории выбраны!
              </Text>
            </Box>
          ) : (
            <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap="3">
              {available.map((cat) => {
                let anim = ""
                if (pickingOut === cat.id) anim = "p5-pick-out"
                if (returning === cat.id) anim = "p5-return"
                return (
                  <CategoryCard
                    key={cat.id}
                    cat={cat}
                    onPick={() => handlePick(cat.id)}
                    animClass={anim}
                  />
                )
              })}
            </Box>
          )}
        </Box>

        {/* ── SAVE BUTTON ── */}
        <Box className="p5-reveal p5-visible-left" style={{ animationDelay: "0.85s" }}>
          <Box position="relative" ref={savedBanner}>
            <Flex
              as="button"
              align="center" justify="center" gap="2"
              bg={B} color={W}
              py="4" width="100%"
              fontSize="11px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase"
              cursor="pointer" _hover={{ opacity: 0.88 }} transition="opacity 0.15s"
              position="relative" overflow="hidden"
              onClick={handleSave}
              style={{ clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)" }}
            >
              <Box position="absolute" left="-20px" top="-20px" w="60px" h="60px"
                borderRadius="full" bg={`${W}08`} />
              Сохранить профиль
              <Text as="span" fontSize="14px">→</Text>
            </Flex>

            {/* Saved confirmation banner */}
            {showSaved && (
              <Flex
                position="absolute" inset="0"
                align="center" justify="center"
                bg={K}
                style={{
                  clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)",
                  animation: "p5-land-in 0.3s cubic-bezier(0.22,1,0.36,1) both",
                }}
              >
                <Text fontSize="11px" fontWeight="800" letterSpacing="0.15em"
                  textTransform="uppercase" color={B}>
                  ✓ Сохранено!
                </Text>
              </Flex>
            )}
          </Box>
        </Box>

        {/* ── FOOTER ── */}
        <Flex justify="space-between" align="center" pt="10"
          className="p5-drop" style={{ animationDelay: "1s" }}>
          <Text fontSize="10px" color={G} fontWeight="600" letterSpacing="0.06em">
            © 2026 Opus
          </Text>
          <Flex gap="4">
            {["TG", "IG", "X"].map(s => (
              <Text key={s} fontSize="10px" fontWeight="800" letterSpacing="0.12em"
                color={K} cursor="pointer" _hover={{ color: B }} transition="color 0.15s">
                {s}
              </Text>
            ))}
          </Flex>
        </Flex>

      </Stack>
    </Box>
  )
}
