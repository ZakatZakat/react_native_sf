import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text, Image, Dialog, Portal } from "@chakra-ui/react"
import {
  API,
  isImg,
  resolveMedia,
  firstLine,
  formatDate,
  type EventCard,
} from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

const STACK_OFFSET = 24
const SWIPE_THRESHOLD = 50
const CARD_MIN_HEIGHT = 400
const CARD_MAX_HEIGHT = 720
const CONTENT_BLOCK_HEIGHT = 172
const STACK_VISIBLE = 4

const CHAOS_ROTATE = [-1.2, 0.9, -0.6, 1.1, -0.8]
const chaosRotate = (i: number) => CHAOS_ROTATE[i % CHAOS_ROTATE.length]!
const chaosJitter = (i: number, seed: number) => ((i * seed) % 7) - 3

function EventCardStackCard({
  card,
  index,
  total,
  isTop,
  dragOffsetX,
  cardHeight,
  failedImgs,
  setFailedImgs,
  onTap,
  onImageLoad,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel,
}: {
  card: EventCard
  index: number
  total: number
  isTop: boolean
  dragOffsetX: number
  cardHeight: number
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onTap: () => void
  onImageLoad?: (id: string, w: number, h: number) => void
  onSwipeStart: (x: number) => void
  onSwipeMove: (x: number) => void
  onSwipeEnd: (x: number) => void
  onSwipeCancel: () => void
}) {
  const media = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
  const rawSrc = resolveMedia(media)
  const imgSrc = rawSrc && isImg(rawSrc) && !failedImgs[card.id] ? rawSrc : null
  const title = firstLine(card.title) || firstLine(card.description) || "Событие"
  const date = formatDate(card.event_time || card.created_at)
  const rawDesc = (card.description ?? "").trim()
  const firstLineOfDesc = rawDesc.split("\n")[0]?.trim() ?? ""
  const sameAsTitle =
    firstLineOfDesc.length > 0 &&
    (title.slice(0, 25).toLowerCase() === firstLineOfDesc.slice(0, 25).toLowerCase() ||
      firstLineOfDesc.length < 40 && title.toLowerCase().includes(firstLineOfDesc.toLowerCase()))
  const body = sameAsTitle && rawDesc.includes("\n")
    ? rawDesc.split("\n").slice(1).join("\n").trim().slice(0, 480)
    : rawDesc.slice(0, 480)

  const offsetPx = index * STACK_OFFSET
  const zIndex = total - index
  const translateX = isTop ? dragOffsetX : 0
  const peek = (total - 1) * STACK_OFFSET
  const cardW = `calc(100% - ${peek}px)`
  const imageBlockHeight = cardHeight - CONTENT_BLOCK_HEIGHT
  const rotate = chaosRotate(index)
  const jitterX = chaosJitter(index, 11)
  const jitterY = chaosJitter(index, 13)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isTop) return
      onSwipeStart(e.touches[0]!.clientX)
    },
    [isTop, onSwipeStart]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTop) return
      onSwipeMove(e.touches[0]!.clientX)
    },
    [isTop, onSwipeMove]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isTop) return
      const end = e.changedTouches[0]
      if (end) onSwipeEnd(end.clientX)
    },
    [isTop, onSwipeEnd]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isTop) return
      onSwipeStart(e.clientX)
    },
    [isTop, onSwipeStart]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isTop) return
      onSwipeMove(e.clientX)
    },
    [isTop, onSwipeMove]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isTop) return
      onSwipeEnd(e.clientX)
    },
    [isTop, onSwipeEnd]
  )

  return (
    <Box
      position="absolute"
      left={`${offsetPx + jitterX}px`}
      top={`${offsetPx + jitterY}px`}
      width={cardW}
      height={`${cardHeight}px`}
      zIndex={zIndex}
      transform={`translateX(${translateX}px) rotate(${rotate}deg)`}
      transformOrigin="center center"
      border={`2.5px solid ${K}`}
      boxShadow={isTop ? `4px 4px 0 ${B}` : `2px 2px 6px ${K}20`}
      bg={W}
      cursor={isTop ? "grab" : "default"}
      overflow="hidden"
      transition={isTop && dragOffsetX === 0 ? "transform 0.25s ease-out, box-shadow 0.15s" : undefined}
      _hover={isTop ? { boxShadow: `6px 6px 0 ${B}` } : undefined}
      _active={isTop ? { cursor: "grabbing" } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isTop && onSwipeCancel()}
      onClick={isTop ? onTap : undefined}
      style={{ touchAction: "pan-y" }}
      display="flex"
      flexDirection="column"
    >
      {imgSrc ? (
        <Box overflow="hidden" borderBottom={`2px solid ${K}`} h={`${imageBlockHeight}px`} flexShrink={0}>
          <Image
            src={imgSrc}
            alt={title}
            width="100%"
            height="100%"
            objectFit="contain"
            display="block"
            onLoad={(e) => {
              const img = e.target as HTMLImageElement
              onImageLoad?.(card.id, img.naturalWidth, img.naturalHeight)
            }}
            onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
          />
        </Box>
      ) : (
        <Box h={`${imageBlockHeight}px`} flexShrink={0} bg={`${B}12`} borderBottom={`2px solid ${K}`} />
      )}
      <Box px="4" py="3" flexShrink={0}>
        <Flex justify="space-between" align="center" mb="2">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.15em" textTransform="uppercase" color={B}>
            {card.channel.replace(/^@/, "").slice(0, 24)}
          </Text>
          {date && (
            <Text fontSize="10px" fontWeight="600" letterSpacing="0.08em" color={G} textTransform="uppercase">
              {date}
            </Text>
          )}
        </Flex>
        <Text
          fontSize="16px"
          fontWeight="900"
          lineHeight="1.15"
          textTransform="uppercase"
          letterSpacing="-0.01em"
          color={K}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Text>
        {body ? (
          <Box position="relative" mt="2" maxH="52px" overflow="hidden">
            <Text
              fontSize="11px"
              lineHeight="1.35"
              color={G}
              whiteSpace="pre-wrap"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {body}
            </Text>
            <Box
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              h="24px"
              bg={`linear-gradient(to top, ${W} 30%, transparent)`}
              pointerEvents="none"
            />
          </Box>
        ) : null}
        <Flex mt="3" align="center" justify="space-between" borderTop={`1px solid ${K}12`} pt="2">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={G}>
            Подробнее
          </Text>
          <Text fontSize="14px" fontWeight="900" color={B}>→</Text>
        </Flex>
      </Box>
    </Box>
  )
}

type Mode = "classic" | "deluxe" | "coverflow"

const FLING_DURATION = 280
const SWIPE_VELOCITY_THRESHOLD = 0.55

function DeluxeCard({
  card,
  index,
  total,
  isTop,
  dragOffsetX,
  flingDir,
  cardHeight,
  containerWidth,
  failedImgs,
  setFailedImgs,
  onTap,
  onImageLoad,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel,
}: {
  card: EventCard
  index: number
  total: number
  isTop: boolean
  dragOffsetX: number
  flingDir: 0 | 1 | -1
  cardHeight: number
  containerWidth: number
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onTap: () => void
  onImageLoad?: (id: string, w: number, h: number) => void
  onSwipeStart: (x: number) => void
  onSwipeMove: (x: number) => void
  onSwipeEnd: (x: number) => void
  onSwipeCancel: () => void
}) {
  const media = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
  const rawSrc = resolveMedia(media)
  const imgSrc = rawSrc && isImg(rawSrc) && !failedImgs[card.id] ? rawSrc : null
  const title = firstLine(card.title) || firstLine(card.description) || "Событие"
  const date = formatDate(card.event_time || card.created_at)
  const rawDesc = (card.description ?? "").trim()
  const firstLineOfDesc = rawDesc.split("\n")[0]?.trim() ?? ""
  const sameAsTitle =
    firstLineOfDesc.length > 0 &&
    (title.slice(0, 25).toLowerCase() === firstLineOfDesc.slice(0, 25).toLowerCase() ||
      firstLineOfDesc.length < 40 && title.toLowerCase().includes(firstLineOfDesc.toLowerCase()))
  const body = sameAsTitle && rawDesc.includes("\n")
    ? rawDesc.split("\n").slice(1).join("\n").trim().slice(0, 480)
    : rawDesc.slice(0, 480)

  const depthScale = 1 - Math.min(index, 3) * 0.06
  const depthY = Math.min(index, 3) * 14
  const topProgress = isTop ? Math.min(1, Math.abs(dragOffsetX) / 140) : 0

  const baseScale = isTop
    ? depthScale
    : depthScale + (index === 1 ? topProgress * 0.06 : index === 2 ? topProgress * 0.04 : 0)
  const baseY = isTop
    ? depthY
    : depthY - (index === 1 ? topProgress * 14 : index === 2 ? topProgress * 12 : 0)

  let translateX = 0
  let rotate = 0
  let transition: string | undefined = undefined

  if (isTop) {
    if (flingDir !== 0) {
      const target = (containerWidth + 220) * flingDir
      translateX = target
      rotate = flingDir * 22
      transition = `transform ${FLING_DURATION}ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity ${FLING_DURATION}ms ease-out`
    } else {
      translateX = dragOffsetX
      rotate = dragOffsetX * 0.06
      transition = dragOffsetX === 0 ? "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)" : undefined
    }
  } else {
    transition = "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
  }

  const showLikeBadge = isTop && dragOffsetX < -20 && flingDir === 0
  const showPrevBadge = isTop && dragOffsetX > 20 && flingDir === 0
  const badgeOpacity = Math.min(1, Math.abs(dragOffsetX) / 90)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isTop) return
      onSwipeStart(e.touches[0]!.clientX)
    },
    [isTop, onSwipeStart]
  )
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTop) return
      onSwipeMove(e.touches[0]!.clientX)
    },
    [isTop, onSwipeMove]
  )
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isTop) return
      const end = e.changedTouches[0]
      if (end) onSwipeEnd(end.clientX)
    },
    [isTop, onSwipeEnd]
  )
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isTop) return
      onSwipeStart(e.clientX)
    },
    [isTop, onSwipeStart]
  )
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isTop) return
      onSwipeMove(e.clientX)
    },
    [isTop, onSwipeMove]
  )
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isTop) return
      onSwipeEnd(e.clientX)
    },
    [isTop, onSwipeEnd]
  )

  return (
    <Box
      position="absolute"
      left="0"
      right="0"
      top="0"
      mx="auto"
      width="100%"
      height={`${cardHeight}px`}
      zIndex={total - index}
      transform={`translate3d(${translateX}px, ${baseY}px, 0) rotate(${rotate}deg) scale(${baseScale})`}
      transformOrigin="center 120%"
      transition={transition}
      border={`2.5px solid ${K}`}
      boxShadow={isTop ? `4px 6px 0 ${B}, 0 18px 40px -18px rgba(13,13,13,0.45)` : `2px 3px 0 ${K}10`}
      bg={W}
      cursor={isTop ? "grab" : "default"}
      overflow="hidden"
      _active={isTop ? { cursor: "grabbing" } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isTop && flingDir === 0 && onSwipeCancel()}
      onClick={isTop ? onTap : undefined}
      style={{ touchAction: "pan-y", willChange: "transform" }}
      display="flex"
      flexDirection="column"
    >
      <Flex
        position="relative"
        zIndex={2}
        flexShrink={0}
        h="52px"
        bg={W}
        borderBottom={`2.5px solid ${K}`}
        align="center"
        justify="space-between"
        px="3"
        gap="2"
      >
        <Flex align="center" gap="2" minW="0">
          <Box w="8px" h="8px" bg={B} flexShrink={0} />
          <Text
            fontSize="11px"
            fontWeight="900"
            letterSpacing="0.16em"
            textTransform="uppercase"
            color={K}
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {card.channel.replace(/^@/, "").slice(0, 22)}
          </Text>
        </Flex>
        {date && (
          <Box
            bg={K}
            color={W}
            px="2.5"
            py="1"
            fontSize="10px"
            fontWeight="900"
            letterSpacing="0.14em"
            textTransform="uppercase"
            flexShrink={0}
          >
            {date}
          </Box>
        )}
      </Flex>

      <Box position="relative" flex="1" overflow="hidden">
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
            style={{
              transform: isTop ? `scale(1.04) translateX(${dragOffsetX * -0.06}px)` : "scale(1.02)",
              transition: isTop && dragOffsetX === 0 ? "transform 0.4s ease-out" : undefined,
            }}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement
              onImageLoad?.(card.id, img.naturalWidth, img.naturalHeight)
            }}
            onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
          />
        ) : (
          <Box position="absolute" inset="0" bg={`linear-gradient(135deg, ${B}22, ${K}18)`} />
        )}

        <Box
          position="absolute"
          left="0"
          right="0"
          bottom="0"
          h="55%"
          bg={`linear-gradient(to top, rgba(13,13,13,0.92) 0%, rgba(13,13,13,0.78) 28%, rgba(13,13,13,0.35) 65%, rgba(13,13,13,0) 100%)`}
          pointerEvents="none"
        />

      {showLikeBadge && (
        <Box
          position="absolute"
          top="22%"
          right="18px"
          px="4"
          py="2"
          bg={B}
          color={W}
          border={`3px solid ${W}`}
          boxShadow={`4px 4px 0 ${K}`}
          fontSize="22px"
          fontWeight="900"
          letterSpacing="0.18em"
          textTransform="uppercase"
          pointerEvents="none"
          style={{
            opacity: badgeOpacity,
            transform: `rotate(14deg) scale(${0.85 + badgeOpacity * 0.25})`,
          }}
        >
          Like
        </Box>
      )}
      {showPrevBadge && (
        <Box
          position="absolute"
          top="22%"
          left="18px"
          px="4"
          py="2"
          bg={K}
          color={W}
          border={`3px solid ${W}`}
          boxShadow={`-4px 4px 0 ${B}`}
          fontSize="22px"
          fontWeight="900"
          letterSpacing="0.18em"
          textTransform="uppercase"
          pointerEvents="none"
          style={{
            opacity: badgeOpacity,
            transform: `rotate(-14deg) scale(${0.85 + badgeOpacity * 0.25})`,
          }}
        >
          Nope
        </Box>
      )}

        <Box position="absolute" left="0" right="0" bottom="0" px="5" pb="5" pt="6" pointerEvents="none">
          <Text
            fontSize="22px"
            fontWeight="900"
            lineHeight="1.05"
            textTransform="uppercase"
            letterSpacing="-0.02em"
            color={W}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {title}
          </Text>
          {body ? (
            <Text
              mt="2"
              fontSize="12px"
              lineHeight="1.4"
              color={W}
              opacity={0.78}
              whiteSpace="pre-wrap"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {body}
            </Text>
          ) : null}
          <Flex mt="3" align="center" gap="1.5">
            <Box w="6px" h="6px" bg={B} border={`1.5px solid ${W}`} />
            <Text fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={W}>
              Тапни — детали
            </Text>
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}

function CoverflowCard({
  card,
  relPos,
  dragOffsetX,
  cardHeight,
  cardWidth,
  failedImgs,
  setFailedImgs,
  onTap,
  onImageLoad,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel,
  isActive,
}: {
  card: EventCard
  relPos: number
  dragOffsetX: number
  cardHeight: number
  cardWidth: number
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onTap: () => void
  onImageLoad?: (id: string, w: number, h: number) => void
  onSwipeStart: (x: number) => void
  onSwipeMove: (x: number) => void
  onSwipeEnd: (x: number) => void
  onSwipeCancel: () => void
  isActive: boolean
}) {
  const media = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
  const rawSrc = resolveMedia(media)
  const imgSrc = rawSrc && isImg(rawSrc) && !failedImgs[card.id] ? rawSrc : null
  const title = firstLine(card.title) || firstLine(card.description) || "Событие"
  const date = formatDate(card.event_time || card.created_at)

  const dragNorm = dragOffsetX / Math.max(120, cardWidth * 0.6)
  const effPos = relPos - dragNorm

  const stepPx = cardWidth * 0.62
  const tx = effPos * stepPx
  const ry = Math.max(-55, Math.min(55, effPos * -38))
  const tz = -Math.abs(effPos) * 160
  const scale = Math.max(0.7, 1 - Math.abs(effPos) * 0.12)
  const opacity = Math.abs(effPos) > 2.4 ? 0 : Math.max(0.25, 1 - Math.abs(effPos) * 0.28)

  const transform = `translate3d(calc(-50% + ${tx}px), 0, ${tz}px) rotateY(${ry}deg) scale(${scale})`

  const handleTouchStart = (e: React.TouchEvent) => onSwipeStart(e.touches[0]!.clientX)
  const handleTouchMove = (e: React.TouchEvent) => onSwipeMove(e.touches[0]!.clientX)
  const handleTouchEnd = (e: React.TouchEvent) => {
    const end = e.changedTouches[0]
    if (end) onSwipeEnd(end.clientX)
  }
  const handleMouseDown = (e: React.MouseEvent) => onSwipeStart(e.clientX)
  const handleMouseMove = (e: React.MouseEvent) => onSwipeMove(e.clientX)
  const handleMouseUp = (e: React.MouseEvent) => onSwipeEnd(e.clientX)

  const imageBlockHeight = cardHeight - CONTENT_BLOCK_HEIGHT

  return (
    <Box
      position="absolute"
      left="50%"
      top="0"
      width={`${cardWidth}px`}
      height={`${cardHeight}px`}
      transform={transform}
      transformOrigin="center center"
      transition={dragOffsetX === 0 ? "transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease" : "opacity 0.2s ease"}
      style={{
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        opacity,
        willChange: "transform",
        zIndex: 100 - Math.round(Math.abs(effPos) * 10),
        touchAction: "pan-y",
      }}
      border={`2.5px solid ${K}`}
      boxShadow={isActive ? `5px 7px 0 ${B}, 0 22px 50px -22px rgba(13,13,13,0.55)` : `2px 3px 0 ${K}25`}
      bg={W}
      cursor={isActive ? "grab" : "pointer"}
      overflow="hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isActive && onSwipeCancel()}
      onClick={isActive ? onTap : undefined}
      display="flex"
      flexDirection="column"
    >
      {imgSrc ? (
        <Box overflow="hidden" borderBottom={`2px solid ${K}`} h={`${imageBlockHeight}px`} flexShrink={0}>
          <Image
            src={imgSrc}
            alt={title}
            width="100%"
            height="100%"
            objectFit="contain"
            display="block"
            draggable={false}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement
              onImageLoad?.(card.id, img.naturalWidth, img.naturalHeight)
            }}
            onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
          />
        </Box>
      ) : (
        <Box h={`${imageBlockHeight}px`} flexShrink={0} bg={`${B}12`} borderBottom={`2px solid ${K}`} />
      )}
      <Box px="4" py="3" flexShrink={0}>
        <Flex justify="space-between" align="center" mb="2">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.15em" textTransform="uppercase" color={B}>
            {card.channel.replace(/^@/, "").slice(0, 24)}
          </Text>
          {date && (
            <Text fontSize="10px" fontWeight="600" letterSpacing="0.08em" color={G} textTransform="uppercase">
              {date}
            </Text>
          )}
        </Flex>
        <Text
          fontSize="16px"
          fontWeight="900"
          lineHeight="1.15"
          textTransform="uppercase"
          letterSpacing="-0.01em"
          color={K}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Text>
        <Flex mt="3" align="center" justify="space-between" borderTop={`1px solid ${K}12`} pt="2">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={G}>
            {isActive ? "Тапни" : "В фокус"}
          </Text>
          <Text fontSize="14px" fontWeight="900" color={B}>→</Text>
        </Flex>
      </Box>
      {!isActive && (
        <Box
          position="absolute"
          inset="0"
          bg={`linear-gradient(${effPos < 0 ? "90deg" : "270deg"}, rgba(13,13,13,0.0), rgba(13,13,13,0.18))`}
          pointerEvents="none"
        />
      )}
    </Box>
  )
}

export default function PipeFeedSwipe() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("deluxe")
  const [items, setItems] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [failedImgs, setFailedImgs] = useState<Record<string, true>>({})
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<EventCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [dragOffsetX, setDragOffsetX] = useState(0)
  const [flingDir, setFlingDir] = useState<0 | 1 | -1>(0)
  const [imageSizes, setImageSizes] = useState<Record<string, { w: number; h: number }>>({})
  const [containerWidth, setContainerWidth] = useState(0)
  const stackRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const lastMoveX = useRef(0)
  const lastMoveT = useRef(0)
  const velocity = useRef(0)
  const justSwiped = useRef(false)


  useEffect(() => {
    const pickRandom = (list: EventCard[], count: number) => {
      const arr = [...list]
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr.slice(0, count)
    }

    ;(async () => {
      try {
        const res = await fetch(`${API}/events?limit=200`, { cache: "no-store" })
        if (res.ok) {
          const all: EventCard[] = await res.json()
          const withImages = all.filter((ev) => ev.media_urls?.some(isImg))
          setItems(pickRandom(withImages, 20))
        }
      } catch {
        /* */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const display = useMemo(() => items, [items])

  useEffect(() => {
    const el = stackRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    setContainerWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [display.length])

  const hasNext = index < display.length - 1
  const hasPrev = index > 0

  const advanceWithFling = useCallback(
    (dir: 1 | -1) => {
      const can = dir === 1 ? hasNext : hasPrev
      if (!can) {
        setDragOffsetX(0)
        return
      }
      if (mode === "deluxe") {
        justSwiped.current = true
        setFlingDir(dir)
        window.setTimeout(() => {
          setIndex((i) => (dir === 1 ? i + 1 : i - 1))
          setDragOffsetX(0)
          setFlingDir(0)
        }, FLING_DURATION)
      } else {
        justSwiped.current = true
        setIndex((i) => (dir === 1 ? i + 1 : i - 1))
        setDragOffsetX(0)
      }
    },
    [hasNext, hasPrev, mode]
  )

  const goNext = useCallback(() => advanceWithFling(1), [advanceWithFling])
  const goPrev = useCallback(() => advanceWithFling(-1), [advanceWithFling])

  const onSwipeStart = useCallback((x: number) => {
    if (flingDir !== 0) return
    touchStartX.current = x
    lastMoveX.current = x
    lastMoveT.current = performance.now()
    velocity.current = 0
    setDragOffsetX(0)
    justSwiped.current = false
  }, [flingDir])

  const onSwipeMove = useCallback(
    (x: number) => {
      if (flingDir !== 0) return
      const now = performance.now()
      const dt = Math.max(1, now - lastMoveT.current)
      velocity.current = (x - lastMoveX.current) / dt
      lastMoveX.current = x
      lastMoveT.current = now
      const raw = x - touchStartX.current
      const canDir = raw < 0 ? hasNext : hasPrev
      const eased = canDir ? raw : Math.sign(raw) * Math.sqrt(Math.abs(raw)) * 6
      setDragOffsetX(eased)
    },
    [flingDir, hasNext, hasPrev]
  )

  const onSwipeEnd = useCallback(
    (endX: number) => {
      if (flingDir !== 0) return
      const dx = endX - touchStartX.current
      const v = velocity.current
      const fastLeft = v < -SWIPE_VELOCITY_THRESHOLD
      const fastRight = v > SWIPE_VELOCITY_THRESHOLD
      if (dx < -SWIPE_THRESHOLD || fastLeft) goNext()
      else if (dx > SWIPE_THRESHOLD || fastRight) goPrev()
      else setDragOffsetX(0)
      touchStartX.current = endX
      velocity.current = 0
    },
    [goNext, goPrev, flingDir]
  )

  const onSwipeCancel = useCallback(() => setDragOffsetX(0), [])

  const openDetail = useCallback((card: EventCard) => {
    if (justSwiped.current) return
    setSelected(card)
    setDetailOpen(true)
  }, [])

  const selTitle = useMemo(() => {
    if (!selected) return ""
    return firstLine(selected.title) || firstLine(selected.description) || "Событие"
  }, [selected])

  const selImg = useMemo(() => {
    if (!selected) return null
    const m = selected.media_urls?.find(isImg) ?? selected.media_urls?.[0]
    const r = resolveMedia(m)
    return r && isImg(r) ? r : null
  }, [selected])

  const visibleCards = display.slice(index, index + STACK_VISIBLE)
  const peekPx = (STACK_VISIBLE - 1) * STACK_OFFSET
  const cardWidthPx = Math.max(0, containerWidth - peekPx)

  const frontCardHeight = useMemo(() => {
    if (mode === "deluxe") {
      if (!containerWidth) return CARD_MIN_HEIGHT
      const viewport = typeof window !== "undefined" ? window.innerHeight : 800
      const HEADER_H = 52
      const innerW = Math.max(1, containerWidth - 5)
      const front = display[index]
      const sizes = front ? imageSizes[front.id] : undefined
      const aspect = sizes && sizes.w > 0 ? sizes.h / sizes.w : 1.4
      const clampedAspect = Math.max(0.9, Math.min(1.7, aspect))
      const imageH = innerW * clampedAspect
      const total = Math.round(imageH + HEADER_H)
      const cap = Math.round(viewport * 0.78)
      return Math.max(CARD_MIN_HEIGHT, Math.min(total, cap))
    }
    const front = display[index]
    if (!front || !cardWidthPx) return CARD_MIN_HEIGHT
    const sizes = imageSizes[front.id]
    if (!sizes || sizes.w <= 0) return CARD_MIN_HEIGHT
    const imageHeight = cardWidthPx * (sizes.h / sizes.w)
    const total = Math.round(imageHeight) + CONTENT_BLOCK_HEIGHT
    return Math.min(CARD_MAX_HEIGHT, Math.max(CARD_MIN_HEIGHT, total))
  }, [display, index, imageSizes, cardWidthPx, containerWidth, mode])

  const stackHeight = frontCardHeight + peekPx

  const handleImageLoad = useCallback((id: string, w: number, h: number) => {
    setImageSizes((prev) => (prev[id]?.w === w && prev[id]?.h === h ? prev : { ...prev, [id]: { w, h } }))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      justSwiped.current = false
    }, 400)
    return () => clearTimeout(t)
  }, [index])

  useEffect(() => {
    if (dragOffsetX === 0) return
    const up = (e: MouseEvent) => {
      onSwipeEnd(e.clientX)
    }
    document.addEventListener("mouseup", up)
    return () => document.removeEventListener("mouseup", up)
  }, [dragOffsetX, onSwipeEnd])

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={B}
      position="relative"
      css={{ WebkitTapHighlightColor: "transparent" }}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <Flex
        maxW="430px"
        mx="auto"
        px="5"
        pt="4"
        pb="6"
        direction="column"
        align="stretch"
      >
        <Flex align="center" justify="space-between" mb="4">
          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-landing" })}
            align="center"
            gap="2"
            fontSize="11px"
            fontWeight="800"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color={B}
            _hover={{ color: B }}
            transition="color 0.15s"
          >
            <Text fontSize="16px">←</Text>
            Назад
          </Flex>
        </Flex>

        <Text
          fontSize="36px"
          fontWeight="900"
          lineHeight="0.92"
          letterSpacing="-0.03em"
          textTransform="uppercase"
          pb="6"
        >
          <Text as="span" color={K}>Свайпай </Text>
          <Text as="span" color={B}>карточки</Text>
        </Text>

        <Flex
          mb="5"
          border={`2.5px solid ${K}`}
          bg={W}
          boxShadow={`3px 3px 0 ${B}`}
          alignSelf="flex-start"
        >
          {(["classic", "deluxe", "coverflow"] as Mode[]).map((m, idx, arr) => {
            const active = mode === m
            const label = m === "classic" ? "Старый" : m === "deluxe" ? "Новый" : "3D"
            return (
              <Flex
                key={m}
                as="button"
                onClick={() => {
                  setMode(m)
                  setDragOffsetX(0)
                  setFlingDir(0)
                }}
                px="4"
                py="2"
                bg={active ? K : W}
                color={active ? W : K}
                fontSize="10px"
                fontWeight="900"
                letterSpacing="0.18em"
                textTransform="uppercase"
                cursor="pointer"
                borderRight={idx < arr.length - 1 ? `2.5px solid ${K}` : undefined}
                transition="background 0.12s, color 0.12s"
              >
                {label}
              </Flex>
            )
          })}
        </Flex>

        <Text
          fontSize="10px"
          fontWeight="800"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color={G}
          mb="6"
        >
          {display.length} {display.length === 1 ? "событие" : "событий"}
        </Text>

        {loading && display.length === 0 ? (
          <Text color={G} fontSize="sm" py="10" textAlign="center">
            Загружаем события...
          </Text>
        ) : display.length === 0 ? (
          <Text color={G} fontSize="sm" py="10" textAlign="center">
            Нет событий с изображениями
          </Text>
        ) : (
          mode === "coverflow" ? (
            <Box
              ref={stackRef}
              position="relative"
              w="100%"
              h={`${frontCardHeight + 40}px`}
              style={{ perspective: "1400px", perspectiveOrigin: "50% 50%" }}
              overflow="visible"
            >
              {(() => {
                const window = 2
                const cardW = Math.min(Math.max(220, containerWidth * 0.72), 360)
                const out: JSX.Element[] = []
                for (let off = -window; off <= window; off += 1) {
                  const i = index + off
                  if (i < 0 || i >= display.length) continue
                  const card = display[i]
                  if (!card) continue
                  out.push(
                    <CoverflowCard
                      key={`${card.id}-${i}`}
                      card={card}
                      relPos={off}
                      dragOffsetX={dragOffsetX}
                      cardHeight={frontCardHeight}
                      cardWidth={cardW}
                      failedImgs={failedImgs}
                      setFailedImgs={setFailedImgs}
                      onTap={() => openDetail(card)}
                      onImageLoad={handleImageLoad}
                      onSwipeStart={onSwipeStart}
                      onSwipeMove={onSwipeMove}
                      onSwipeEnd={onSwipeEnd}
                      onSwipeCancel={onSwipeCancel}
                      isActive={off === 0}
                    />
                  )
                }
                return out
              })()}
            </Box>
          ) : (
          <Box ref={stackRef} position="relative" w="100%" h={`${stackHeight}px`}>
            {visibleCards.map((card, i) =>
              mode === "classic" ? (
                <EventCardStackCard
                  key={`${card.id}-${index + i}`}
                  card={card}
                  index={i}
                  total={visibleCards.length}
                  isTop={i === 0}
                  dragOffsetX={i === 0 ? dragOffsetX : 0}
                  cardHeight={frontCardHeight}
                  failedImgs={failedImgs}
                  setFailedImgs={setFailedImgs}
                  onTap={() => openDetail(card)}
                  onImageLoad={handleImageLoad}
                  onSwipeStart={onSwipeStart}
                  onSwipeMove={onSwipeMove}
                  onSwipeEnd={onSwipeEnd}
                  onSwipeCancel={onSwipeCancel}
                />
              ) : (
                <DeluxeCard
                  key={`${card.id}-${index + i}`}
                  card={card}
                  index={i}
                  total={visibleCards.length}
                  isTop={i === 0}
                  dragOffsetX={i === 0 ? dragOffsetX : 0}
                  flingDir={i === 0 ? flingDir : 0}
                  cardHeight={frontCardHeight}
                  containerWidth={containerWidth}
                  failedImgs={failedImgs}
                  setFailedImgs={setFailedImgs}
                  onTap={() => openDetail(card)}
                  onImageLoad={handleImageLoad}
                  onSwipeStart={onSwipeStart}
                  onSwipeMove={onSwipeMove}
                  onSwipeEnd={onSwipeEnd}
                  onSwipeCancel={onSwipeCancel}
                />
              )
            )}
          </Box>
          )
        )}

        {display.length > 0 && mode === "deluxe" ? (
          <Flex justify="center" align="center" gap="5" mt="8">
            <Flex
              as="button"
              onClick={goPrev}
              aria-disabled={!hasPrev}
              align="center"
              justify="center"
              w="56px"
              h="56px"
              borderRadius="50%"
              border={`3px solid ${K}`}
              bg={W}
              color={K}
              boxShadow={hasPrev ? `4px 4px 0 ${K}` : `2px 2px 0 ${K}30`}
              cursor={hasPrev ? "pointer" : "not-allowed"}
              opacity={hasPrev ? 1 : 0.45}
              _hover={hasPrev ? { transform: "translate(-2px,-2px)", boxShadow: `6px 6px 0 ${K}` } : undefined}
              _active={{ transform: "translate(2px,2px)", boxShadow: `0px 0px 0 ${K}` }}
              transition="all 0.12s"
              pointerEvents={hasPrev ? "auto" : "none"}
              style={{ fontSize: "22px", fontWeight: 900 }}
            >
              ←
            </Flex>
            <Flex
              direction="column"
              align="center"
              minW="64px"
            >
              <Text fontSize="22px" fontWeight="900" color={K} lineHeight="1">
                {index + 1}
              </Text>
              <Text fontSize="9px" fontWeight="800" letterSpacing="0.18em" color={G} mt="1">
                / {display.length}
              </Text>
            </Flex>
            <Flex
              as="button"
              onClick={goNext}
              aria-disabled={!hasNext}
              align="center"
              justify="center"
              w="68px"
              h="68px"
              borderRadius="50%"
              border={`3px solid ${K}`}
              bg={B}
              color={W}
              boxShadow={hasNext ? `5px 5px 0 ${K}` : `2px 2px 0 ${K}30`}
              cursor={hasNext ? "pointer" : "not-allowed"}
              opacity={hasNext ? 1 : 0.45}
              _hover={hasNext ? { transform: "translate(-2px,-2px)", boxShadow: `7px 7px 0 ${K}` } : undefined}
              _active={{ transform: "translate(2px,2px)", boxShadow: `0px 0px 0 ${K}` }}
              transition="all 0.12s"
              pointerEvents={hasNext ? "auto" : "none"}
              style={{ fontSize: "26px", fontWeight: 900 }}
            >
              ♥
            </Flex>
          </Flex>
        ) : display.length > 0 ? (
          <Flex justify="center" gap="4" mt="6">
            <Flex
              as="button"
              onClick={goPrev}
              aria-disabled={!hasPrev}
              align="center"
              justify="center"
              w="48px"
              h="48px"
              border={`2px solid ${hasPrev ? B : `${B}40`}`}
              bg={hasPrev ? W : `${B}08`}
              color={B}
              cursor={hasPrev ? "pointer" : "not-allowed"}
              opacity={hasPrev ? 1 : 0.5}
              _hover={hasPrev ? { bg: `${B}12`, borderColor: B } : undefined}
              _disabled={{ cursor: "not-allowed", opacity: 0.5 }}
              transition="all 0.15s"
              pointerEvents={hasPrev ? "auto" : "none"}
            >
              <Text fontSize="20px" fontWeight="900">←</Text>
            </Flex>
            <Text
              fontSize="12px"
              fontWeight="800"
              letterSpacing="0.1em"
              alignSelf="center"
              color={B}
            >
              {index + 1} / {display.length}
            </Text>
            <Flex
              as="button"
              onClick={goNext}
              aria-disabled={!hasNext}
              align="center"
              justify="center"
              w="48px"
              h="48px"
              border={`2px solid ${hasNext ? B : `${B}40`}`}
              bg={hasNext ? W : `${B}08`}
              color={B}
              cursor={hasNext ? "pointer" : "not-allowed"}
              opacity={hasNext ? 1 : 0.5}
              _hover={hasNext ? { bg: `${B}12`, borderColor: B } : undefined}
              _disabled={{ cursor: "not-allowed", opacity: 0.5 }}
              transition="all 0.15s"
              pointerEvents={hasNext ? "auto" : "none"}
            >
              <Text fontSize="20px" fontWeight="900">→</Text>
            </Flex>
          </Flex>
        ) : null}
      </Flex>

      <Dialog.Root open={detailOpen} onOpenChange={(d) => setDetailOpen(d.open)}>
        <Portal>
          <Dialog.Backdrop style={{ animation: "p5-backdrop 0.35s ease-out forwards" }} />
          <Dialog.Positioner>
            <Dialog.Content
              maxW="min(92vw, 420px)"
              mx="auto"
              border={`3px solid ${K}`}
              borderRadius="0"
              overflow="hidden"
              boxShadow={`6px 6px 0 ${B}`}
              style={{
                animation: "p5-dialog-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
              }}
            >
              <Dialog.CloseTrigger />
              <Dialog.Header
                bg={K}
                px="5"
                py="3"
                position="relative"
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  top="0"
                  right="-20px"
                  bottom="0"
                  w="60px"
                  bg={B}
                  style={{ transform: "skewX(-12deg)" }}
                  opacity={0.2}
                />
                <Dialog.Title>
                  <Text
                    fontSize="12px"
                    fontWeight="800"
                    letterSpacing="0.15em"
                    textTransform="uppercase"
                    color={W}
                    position="relative"
                  >
                    {selTitle}
                  </Text>
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px="5" py="4" bg={W}>
                <Flex direction="column" gap="3">
                  {selImg &&
                    selected &&
                    !failedImgs[selected.id] && (
                      <Box overflow="hidden">
                        <Image
                          src={selImg}
                          alt={selTitle}
                          width="100%"
                          height="auto"
                          maxH="min(480px, 70vh)"
                          objectFit="contain"
                          display="block"
                          onError={() => {
                            if (selected)
                              setFailedImgs((p) => ({ ...p, [selected.id]: true }))
                          }}
                        />
                      </Box>
                    )}
                  {selected?.channel && (
                    <Text
                      fontSize="10px"
                      fontWeight="800"
                      letterSpacing="0.15em"
                      textTransform="uppercase"
                      color={B}
                    >
                      {selected.channel}
                    </Text>
                  )}
                  <Text
                    fontSize="sm"
                    color={K}
                    whiteSpace="pre-wrap"
                    lineHeight="1.5"
                  >
                    {selected?.description ?? selected?.title ?? ""}
                  </Text>
                </Flex>
              </Dialog.Body>
              <Dialog.Footer
                px="5"
                py="3"
                bg={W}
                borderTop={`1px solid ${K}12`}
              >
                <Flex
                  as="button"
                  onClick={() => setDetailOpen(false)}
                  bg={B}
                  color={W}
                  px="5"
                  py="2.5"
                  fontSize="11px"
                  fontWeight="800"
                  letterSpacing="0.15em"
                  textTransform="uppercase"
                  cursor="pointer"
                  _hover={{ opacity: 0.88 }}
                  transition="opacity 0.15s"
                >
                  Закрыть
                </Flex>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  )
}
