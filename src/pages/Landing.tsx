import * as React from "react"
import { Badge, Box, Button, Flex, Image, Stack, Text } from "@chakra-ui/react"

const PRIMARY = "#2D2A8C"
const PRIMARY_MUTED = "rgba(45,42,140,0.7)"
const PRIMARY_SOFT = "rgba(45,42,140,0.12)"
const PRIMARY_BORDER = "rgba(45,42,140,0.28)"

export default function Landing() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const [heroImage, setHeroImage] = React.useState<string | null>(null)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=60`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { media_urls?: string[] }[]
        const first = data.find((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
        const media = first?.media_urls?.find((u) => isLikelyImageUrl(u))
        const resolved = resolveMediaUrl(media, apiUrl)
        setHeroImage(resolved && isLikelyImageUrl(resolved) ? resolved : null)
      } catch {
        setHeroImage(null)
      }
    }
    void load()
  }, [apiUrl])

  return (
    <Box minH="100dvh" bg="#FFFFFF" color={PRIMARY}>
      <Stack maxW="420px" mx="auto" px="4" pt="10" pb="12" gap="6">
        <Flex align="center" justify="space-between">
          <Text fontSize="2xl" fontWeight="semibold" letterSpacing="-0.2px">
            Поиск ивентов
            <br />
            и событий в Москве
          </Text>
        </Flex>

        <Stack gap="6" align="center">
          <Box className="tg-float-1" style={{ animationDuration: "6.4s", animationDelay: "-0.8s" }} alignSelf="flex-start">
            <Box
              width="290px"
              border="1px solid rgba(45,42,140,0.28)"
              borderRadius="xl"
              p="4"
              bg="white"
              boxShadow="0 16px 30px rgba(45,42,140,0.12)"
              style={{ transform: "rotate(-2.4deg)" }}
            >
            <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.4px">
              ПОДБОРКИ С МЕДИА
            </Text>
            <Box
              mt="3"
              border="1px solid rgba(45,42,140,0.2)"
              borderRadius="lg"
              overflow="hidden"
              bg={PRIMARY_SOFT}
            >
              {heroImage ? (
                <Image src={heroImage} alt="Event preview" height="160px" width="100%" objectFit="cover" />
              ) : (
                <Box height="160px" bg="linear-gradient(135deg, #2D2A8C 0%, #C4C6F5 100%)" />
              )}
              <Box px="3" py="2" borderTop="1px solid rgba(45,42,140,0.2)">
                <Text fontSize="xs" fontWeight="semibold">
                  ЛУЧШЕЕ В МОСКВЕ
                </Text>
                <Text fontSize="xs" color={PRIMARY_MUTED}>
                  1000+ каналов
                </Text>
              </Box>
            </Box>
            </Box>
          </Box>

          <Box className="tg-float-2" style={{ animationDuration: "7.2s", animationDelay: "-1.1s" }} alignSelf="flex-end">
            <Box
              width="220px"
              border="1px solid rgba(45,42,140,0.28)"
              borderRadius="xl"
              p="3"
              bg="white"
              boxShadow="0 16px 30px rgba(45,42,140,0.12)"
              style={{ transform: "rotate(2.8deg)" }}
            >
            <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.3px">
              ИИ-АГЕНТЫ
            </Text>
            <Text fontSize="xs" color={PRIMARY_MUTED} mt="1">
              ИИ-агенты обрабатывают события и подбирают те, что подходят именно вам.
            </Text>
            <Badge mt="3" fontSize="9px" borderRadius="full" px="2" py="1" bg={PRIMARY_SOFT}>
              ПЕРСОНАЛЬНЫЙ ФИД
            </Badge>
            <Text fontSize="xs" color={PRIMARY_MUTED} mt="2">
              Москва
            </Text>
            </Box>
          </Box>
        </Stack>

        <Button bg={PRIMARY} color="white" borderRadius="full" height="48px" fontWeight="semibold">
          Открыть ленту
        </Button>

      </Stack>
    </Box>
  )
}

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
