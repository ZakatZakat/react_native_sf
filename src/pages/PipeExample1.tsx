import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Button, Flex, Image, Text } from "@chakra-ui/react"
import { API, isImg, resolveMedia, type EventCard } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.5)"

const CROSSFADE_DURATION = 4000
const TEXT_TO_IMAGE_SPACING = "32px"

export default function PipeExample1() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventCard[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    fetch(`${API}/events?limit=40`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EventCard[]) => setEvents(data))
      .catch(() => setEvents([]))
  }, [])

  const imageUrls = [...new Set(
    events
      .flatMap((e) => e.media_urls ?? [])
      .filter(isImg)
      .map((u) => resolveMedia(u))
      .filter((u): u is string => !!u)
  )].slice(0, 12)

  useEffect(() => {
    if (imageUrls.length <= 1) return
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % imageUrls.length)
    }, CROSSFADE_DURATION)
    return () => clearInterval(id)
  }, [imageUrls.length])

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      css={{ WebkitTapHighlightColor: "transparent" }}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <Flex
        flexDirection="column"
        align="center"
        justify="center"
        w="100%"
        maxW="min(96vw, 680px)"
        px={{ base: "5", sm: "6" }}
        py={{ base: "4", sm: "6" }}
      >
        <Box mb={TEXT_TO_IMAGE_SPACING}>
          <Text
            fontSize={{ base: "xl", sm: "2xl" }}
            fontWeight="800"
            letterSpacing="-0.02em"
            textAlign="center"
          >
            Подбираем <Text as="span" color={B}>ивенты</Text> под вас
          </Text>
        </Box>
        <Flex
          align="center"
          justify="center"
          gap={{ base: "3", sm: "4", md: "5" }}
          flexWrap="nowrap"
          overflow="hidden"
        >
          <Text
            fontSize={{ base: "clamp(28px, 10vw, 48px)", sm: "clamp(48px, 15vw, 120px)", md: "clamp(72px, 18vw, 140px)" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            lineHeight="0.92"
            textTransform="uppercase"
          >
            PI
          </Text>
          <Box
            className="pipe-hero-img"
            position="relative"
            w={{ base: "clamp(140px, 52vw, 220px)", sm: "clamp(160px, 32vw, 240px)" }}
            h={{ base: "clamp(120px, 44vw, 190px)", sm: "clamp(130px, 26vw, 200px)" }}
            flexShrink={0}
            border={`2.5px solid ${K}`}
            overflow="hidden"
            boxShadow={`4px 4px 0 ${B}`}
          >
              {imageUrls.length > 0 ? (
                imageUrls.map((src, i) => (
                  <Box
                    key={`${src}-${i}`}
                    position="absolute"
                    inset="0"
                    opacity={i === activeIdx ? 1 : 0}
                    zIndex={i === activeIdx ? 2 : 1}
                    transition="opacity 1.2s ease-in-out"
                    bg={G}
                  >
                    <Image
                      src={src}
                      alt=""
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      display="block"
                    />
                  </Box>
                ))
              ) : (
                <Box w="100%" h="100%" bg={`${B}15`} />
              )}
          </Box>
          <Text
            fontSize={{ base: "clamp(28px, 10vw, 48px)", sm: "clamp(48px, 15vw, 120px)", md: "clamp(72px, 18vw, 140px)" }}
            fontWeight="900"
            letterSpacing="-0.04em"
            lineHeight="0.92"
            textTransform="uppercase"
          >
            PE
          </Text>
        </Flex>
        <Box mt={TEXT_TO_IMAGE_SPACING}>
          <Text
            fontSize={{ base: "sm", sm: "md" }}
            fontWeight="600"
            color={G}
            letterSpacing="0.02em"
            textAlign="center"
          >
            На основе анализа 1000+ каналов <Text as="span" color={B}>ии-агентами</Text>
          </Text>
        </Box>
        <Button
          mt="6"
          bg={B}
          color={W}
          size="lg"
          fontSize={{ base: "md", sm: "lg" }}
          fontWeight="700"
          letterSpacing="0.04em"
          _hover={{ opacity: 0.9 }}
          _active={{ opacity: 0.85 }}
          onClick={() => navigate({ to: "/pipe-rotate" })}
        >
          Попробовать
        </Button>
      </Flex>
    </Box>
  )
}
