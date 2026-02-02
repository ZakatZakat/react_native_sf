import * as React from "react"
import { Box, Image, Text } from "@chakra-ui/react"
import { projectBlueTheme } from "./theme"

const ROTATE_INTERVAL_MS = 4500

type ProjectBlueMediaCarouselProps = {
  images: string[]
  footerTitle?: string
  footerSubtitle?: string
}

export function ProjectBlueMediaCarousel({
  images,
  footerTitle = "ЛУЧШЕЕ В МОСКВЕ",
  footerSubtitle = "1000+ каналов",
}: ProjectBlueMediaCarouselProps) {
  const { ink, inkMuted } = projectBlueTheme
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % images.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [images.length])

  return (
    <Box
      mt="4"
      border={`1px solid ${inkMuted}`}
      borderRadius="xl"
      overflow="hidden"
      bg={ink}
      position="relative"
      minH="180px"
    >
      {images.length > 0 ? (
        <>
          {images.map((src, i) => (
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
        <Box height="180px" bg={ink} />
      )}
      <Box px="4" py="3" borderTop={`1px solid ${inkMuted}`} bg={ink}>
        <Text fontSize="sm" fontWeight="bold" letterSpacing="0.1em" textTransform="uppercase" color="white">
          {footerTitle}
        </Text>
        <Text fontSize="sm" color="rgba(255,255,255,0.7)">
          {footerSubtitle}
        </Text>
      </Box>
    </Box>
  )
}
