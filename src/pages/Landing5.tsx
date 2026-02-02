import * as React from "react"
import { Badge, Box, Flex, Image, Stack, Text } from "@chakra-ui/react"
import { useNavigate } from "@tanstack/react-router"

const INK = "#111111"
const INK_MUTED = "rgba(17,17,17,0.6)"
const BG = "#FAFAFA"
const ACCENT = "#0066FF"

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

function matchesSelectedPost(title?: string | null, description?: string | null): boolean {
  const t = `${title ?? ""}\n${description ?? ""}`.toLowerCase()
  return t.includes("вечеринка идентичность") || t.includes("15.11")
}

const ROTATE_INTERVAL_MS = 4500

export default function Landing5() {
  const navigate = useNavigate()
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [heroImages, setHeroImages] = React.useState<string[]>([])
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=60`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { title?: string | null; description?: string | null; media_urls?: string[] }[]
        const withImages = data.filter((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
        const preferred = data.find((e) => matchesSelectedPost(e.title, e.description))
        const ordered =
          preferred && withImages.includes(preferred)
            ? [preferred, ...withImages.filter((e) => e !== preferred)]
            : withImages
        const urls = ordered
          .map((e) => {
            const media = (e.media_urls ?? []).find((u) => isLikelyImageUrl(u))
            return resolveMediaUrl(media, apiUrl)
          })
          .filter((u): u is string => u != null)
          .slice(0, 8)
        setHeroImages(urls)
      } catch {
        setHeroImages([])
      }
    }
    void load()
  }, [apiUrl])

  React.useEffect(() => {
    if (heroImages.length <= 1) return
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % heroImages.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [heroImages.length])

  return (
    <Box minH="100dvh" bg={BG} color={INK} position="relative" overflow="hidden">
      <Box position="fixed" inset="0" bg={BG} zIndex={-1} />
      <Box
        position="absolute"
        top="-100px"
        right="-100px"
        width="260px"
        height="260px"
        borderRadius="full"
        bg={`${ACCENT}08`}
        border={`50px solid ${ACCENT}12`}
      />
      <Stack maxW="430px" mx="auto" px="5" pt="10" pb="16" gap="10">
        <Box>
          <Text
            fontSize={{ base: "3xl", sm: "4xl" }}
            fontWeight="bold"
            letterSpacing="-0.02em"
            lineHeight="1.1"
            textTransform="uppercase"
          >
            Поиск ивентов
            <br />
            и событий в Москве
            <Text as="span" color={ACCENT}>
              &
            </Text>
          </Text>
          <Box width="16" height="1" bg={ACCENT} mt="5" />
          <Flex gap="4" mt="4" fontSize="sm" color={INK_MUTED} letterSpacing="0.05em">
            <Text>1000+ каналов</Text>
            <Text>·</Text>
            <Text>24/7</Text>
          </Flex>
        </Box>

        <Stack gap="10" align="center">
          <Box
            className="tg-float-1"
            style={{ animationDuration: "6.4s", animationDelay: "-0.8s" }}
            alignSelf="flex-start"
          >
            <Box
              width="340px"
              maxW="100%"
              border={`2px solid ${INK}`}
              borderRadius="2xl"
              p="5"
              bg={BG}
              boxShadow="0 8px 24px rgba(0,0,0,0.06)"
              style={{ transform: "rotate(-2.4deg)" }}
            >
              <Text fontSize="sm" fontWeight="bold" letterSpacing="0.15em" textTransform="uppercase" color={ACCENT}>
                ПОДБОРКИ С МЕДИА
              </Text>
              <Box
                mt="4"
                border={`1px solid ${INK_MUTED}`}
                borderRadius="xl"
                overflow="hidden"
                bg={INK}
                position="relative"
                minH="180px"
              >
                {heroImages.length > 0 ? (
                  <>
                    {heroImages.map((src, i) => (
                      <Box
                        key={src}
                        position={i === activeIndex ? "relative" : "absolute"}
                        top={0}
                        left={0}
                        right={0}
                        opacity={i === activeIndex ? 1 : 0}
                        transition="opacity 0.6s ease-in-out"
                        pointerEvents="none"
                      >
                        <Image
                          src={src}
                          alt=""
                          width="100%"
                          height="auto"
                          display="block"
                          objectFit="contain"
                        />
                      </Box>
                    ))}
                  </>
                ) : (
                  <Box height="180px" bg={INK} />
                )}
                <Box px="4" py="3" borderTop={`1px solid ${INK_MUTED}`} bg={INK}>
                  <Text fontSize="sm" fontWeight="bold" letterSpacing="0.1em" textTransform="uppercase" color="white">
                    ЛУЧШЕЕ В МОСКВЕ
                  </Text>
                  <Text fontSize="sm" color="rgba(255,255,255,0.7)">1000+ каналов</Text>
                </Box>
              </Box>
            </Box>
          </Box>

          <Box
            className="tg-float-2"
            style={{ animationDuration: "7.2s", animationDelay: "-1.1s" }}
            alignSelf="flex-end"
          >
            <Box
              width="300px"
              maxW="100%"
              border={`2px solid ${INK}`}
              borderRadius="2xl"
              p="5"
              bg={BG}
              boxShadow="0 8px 24px rgba(0,0,0,0.06)"
              style={{ transform: "rotate(2.8deg)" }}
            >
              <Text fontSize="sm" fontWeight="bold" letterSpacing="0.15em" textTransform="uppercase" color={ACCENT}>
                ИИ-АГЕНТЫ
              </Text>
              <Text fontSize="sm" color={INK_MUTED} mt="3" lineHeight="1.6">
                ИИ-агенты обрабатывают события и подбирают те, что подходят именно вам.
              </Text>
              <Badge
                mt="4"
                fontSize="10px"
                borderRadius="full"
                px="4"
                py="1.5"
                bg={ACCENT}
                color="white"
                fontWeight="bold"
                letterSpacing="0.08em"
              >
                ПЕРСОНАЛЬНЫЙ ФИД
              </Badge>
              <Text fontSize="sm" color={INK_MUTED} mt="3">
                Москва
              </Text>
            </Box>
          </Box>
        </Stack>

        <Box>
          <Flex
            as="button"
            align="center"
            justify="center"
            gap="4"
            bg={ACCENT}
            color="white"
            px="8"
            py="6"
            fontWeight="bold"
            fontSize="md"
            letterSpacing="0.12em"
            textTransform="uppercase"
            cursor="pointer"
            borderRadius="0"
            _hover={{ opacity: 0.9 }}
            transition="opacity 0.2s"
            onClick={() => navigate({ to: "/feed-3" })}
          >
            Открыть ленту
            <Text as="span" display="inline-block">
              →
            </Text>
          </Flex>
          <Text fontSize="sm" color={INK_MUTED} textAlign="center" mt="4" letterSpacing="0.02em">
            Бесплатно · Без регистрации
          </Text>
        </Box>
      </Stack>
    </Box>
  )
}
