import * as React from "react"
import { Badge, Box, Button, Flex, Image, Spinner, Stack, Text } from "@chakra-ui/react"

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
    <Box minH="100dvh" bg="#F6F1EA" color="#121212">
      <Stack maxW="420px" mx="auto" px="4" pt="10" pb="12" gap="6">
        <Flex align="center" justify="space-between">
          <Text fontSize="2xl" fontWeight="semibold" letterSpacing="-0.2px">
            What does wellbeing
            <br />
            mean to you?
          </Text>
          <Spinner size="sm" thickness="2px" speed="0.8s" color="#121212" />
        </Flex>

        <Flex gap="4">
          <Box flex="1" border="1px solid rgba(0,0,0,0.16)" borderRadius="xl" p="4" bg="white">
            <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.4px">
              001 VISUAL ESSAY
            </Text>
            <Box
              mt="3"
              border="1px solid rgba(0,0,0,0.12)"
              borderRadius="lg"
              overflow="hidden"
              bg="rgba(0,0,0,0.04)"
            >
              {heroImage ? (
                <Image src={heroImage} alt="Event preview" height="160px" width="100%" objectFit="cover" />
              ) : (
                <Box height="160px" bg="linear-gradient(135deg, #DCD7D1 0%, #B8B2AB 100%)" />
              )}
              <Box px="3" py="2" borderTop="1px solid rgba(0,0,0,0.1)">
                <Text fontSize="xs" fontWeight="semibold">
                  SLOW SUNDAYS
                </Text>
                <Text fontSize="xs" color="rgba(0,0,0,0.6)">
                  SOUTH OF FRANCE
                </Text>
              </Box>
            </Box>
          </Box>

          <Box
            width="160px"
            border="1px solid rgba(0,0,0,0.16)"
            borderRadius="xl"
            p="3"
            bg="white"
          >
            <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.3px">
              001 SOUND SCAPE
            </Text>
            <Text fontSize="xs" color="rgba(0,0,0,0.45)" mt="1">
              Do you ever think of the passive moments who designed the day? I&apos;ve definitely...
            </Text>
            <Badge mt="3" fontSize="9px" borderRadius="full" px="2" py="1" bg="rgba(0,0,0,0.08)">
              IT TAKES A VILLAGE
            </Badge>
            <Text fontSize="xs" color="rgba(0,0,0,0.5)" mt="2">
              EDINBURGH, UK
            </Text>
          </Box>
        </Flex>

        <Button bg="#121212" color="white" borderRadius="full" height="48px" fontWeight="semibold">
          CONTRIBUTE
        </Button>

        <Flex align="center" justify="space-between" pt="2">
          <Box width="32px" height="32px" borderRadius="full" border="1px solid rgba(0,0,0,0.2)" />
          <Box
            width="46px"
            height="26px"
            borderRadius="full"
            border="1px solid rgba(0,0,0,0.2)"
            position="relative"
            bg="rgba(0,0,0,0.04)"
          >
            <Box
              width="22px"
              height="22px"
              borderRadius="full"
              bg="#121212"
              position="absolute"
              top="1.5px"
              left="2px"
            />
          </Box>
          <Box width="32px" height="32px" borderRadius="full" border="1px solid rgba(0,0,0,0.2)" display="grid" placeItems="center">
            +
          </Box>
        </Flex>
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
