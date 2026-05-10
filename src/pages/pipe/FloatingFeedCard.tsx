/**
 * FloatingFeedCard — the "Карточки" mode card from PipeFeedSwipe extracted
 * for reuse on category-preview pages.
 *
 * Visual: white card with bold black border, blue/black offset shadow,
 * tilted ±2° per index, gentle floating animation (3 stagger keyframes).
 * Header: channel chip + date chip. Image: dynamic aspect (matches poster).
 * Bottom: title block. Tap → onTap callback.
 */

import { useState } from "react"
import { Box, Flex, Image, Text } from "@chakra-ui/react"
import { firstLine, formatDate, isImg, resolveMedia, type EventCard } from "./shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"

export function FloatingFeedCard({
  card,
  index,
  failedImgs,
  setFailedImgs,
  onTap,
}: {
  card: EventCard
  index: number
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onTap: () => void
}) {
  const media = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
  const rawSrc = resolveMedia(media)
  const imgSrc = rawSrc && isImg(rawSrc) && !failedImgs[card.id] ? rawSrc : null
  const title = firstLine(card.title) || firstLine(card.description) || "Событие"
  const date = formatDate(card.event_time || card.created_at)
  const [imgAspect, setImgAspect] = useState<number | null>(null)
  const aspect = imgAspect ?? 0.8
  const clamped = Math.max(0.55, Math.min(1.4, aspect))
  const floatClass = ["p5-float-a", "p5-float-b", "p5-float-c"][index % 3]
  const accent = index % 2 === 0 ? B : K
  const animDelay = `${(index % 6) * 0.35}s`
  const TILTS = [-2.4, 1.8, -1.4, 2.2, -2.0, 1.2, -2.6, 1.6, -1.0, 2.0, -1.8, 0.9, -2.2, 1.4, -1.6, 2.0, -2.0, 1.0, -1.2, 1.8]
  const tilt = TILTS[index % TILTS.length]
  const offsetY = (index % 4 === 1 || index % 4 === 2) ? "14px" : "0px"

  return (
    <Box className={floatClass} style={{ animationDelay: animDelay, marginTop: offsetY }}>
      <Box
        position="relative"
        w="100%"
        style={{
          transform: `translateZ(0) rotate(${tilt}deg)`,
          transformOrigin: "center center",
          backfaceVisibility: "hidden",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Box
          as="button"
          onClick={onTap}
          position="relative"
          w="100%"
          cursor="pointer"
          textAlign="left"
          border={`2.5px solid ${K}`}
          bg={W}
          boxShadow={`4px 6px 1px ${accent}, 0 14px 28px -14px rgba(13,13,13,0.55)`}
          overflow="hidden"
          _hover={{
            transform: "translate(-2px,-2px) scale(1.03)",
            boxShadow: `6px 8px 1px ${accent}, 0 16px 32px -14px rgba(13,13,13,0.6)`,
          }}
          transition="all 0.18s cubic-bezier(0.22, 1, 0.36, 1)"
          display="flex"
          flexDirection="column"
        >
          {/* Header strip — channel chip + date chip */}
          <Flex
            position="relative"
            zIndex={2}
            flexShrink={0}
            h="32px"
            bg={W}
            borderBottom={`2.5px solid ${K}`}
            align="center"
            justify="space-between"
            px="2"
            gap="1.5"
          >
            <Flex align="center" gap="1.5" minW="0">
              <Box w="6px" h="6px" bg={B} flexShrink={0} />
              <Text
                fontSize="9px"
                fontWeight="900"
                letterSpacing="0.14em"
                textTransform="uppercase"
                color={K}
                style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {card.channel.replace(/^@/, "").slice(0, 16)}
              </Text>
            </Flex>
            {date && (
              <Box
                bg={K}
                color={W}
                px="1.5"
                py="0.5"
                fontSize="8px"
                fontWeight="900"
                letterSpacing="0.12em"
                textTransform="uppercase"
                flexShrink={0}
              >
                {date}
              </Box>
            )}
          </Flex>

          {/* Image area — aspect matches the actual poster, no cropping */}
          <Box
            position="relative"
            w="100%"
            overflow="hidden"
            borderBottom={`2px solid ${K}`}
            flexShrink={0}
            style={{ aspectRatio: `1 / ${clamped}`, transition: "aspect-ratio 0.25s ease-out" }}
          >
            {imgSrc ? (
              <Image
                src={imgSrc}
                alt={title}
                position="absolute"
                inset="0"
                width="100%"
                height="100%"
                objectFit="cover"
                display="block"
                draggable={false}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement
                  if (img.naturalWidth > 0) setImgAspect(img.naturalHeight / img.naturalWidth)
                }}
                onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
              />
            ) : (
              <Box position="absolute" inset="0" bg={`linear-gradient(135deg, ${B}22, ${K}18)`} />
            )}
          </Box>

          {/* Bottom panel — title only */}
          <Box bg={W} px="2.5" py="2.5" flexShrink={0}>
            <Text
              fontSize="12px"
              fontWeight="900"
              lineHeight="1.18"
              textTransform="uppercase"
              letterSpacing="-0.01em"
              color={K}
            >
              {title}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
