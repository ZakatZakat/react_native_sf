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

export default function PipeFeedSwipe() {
  const navigate = useNavigate()
  const [items, setItems] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [failedImgs, setFailedImgs] = useState<Record<string, true>>({})
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<EventCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [dragOffsetX, setDragOffsetX] = useState(0)
  const [imageSizes, setImageSizes] = useState<Record<string, { w: number; h: number }>>({})
  const [containerWidth, setContainerWidth] = useState(0)
  const stackRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const justSwiped = useRef(false)


  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/events?limit=40`, { cache: "no-store" })
        if (res.ok) setItems(await res.json())
      } catch {
        /* */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const display = useMemo(
    () => items.filter((ev) => ev.media_urls?.some(isImg)),
    [items]
  )

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

  const goNext = useCallback(() => {
    if (hasNext) {
      justSwiped.current = true
      setIndex((i) => i + 1)
      setDragOffsetX(0)
    }
  }, [hasNext])

  const goPrev = useCallback(() => {
    if (hasPrev) {
      justSwiped.current = true
      setIndex((i) => i - 1)
      setDragOffsetX(0)
    }
  }, [hasPrev])

  const onSwipeStart = useCallback((x: number) => {
    touchStartX.current = x
    setDragOffsetX(0)
    justSwiped.current = false
  }, [])

  const onSwipeMove = useCallback((x: number) => {
    setDragOffsetX(x - touchStartX.current)
  }, [])

  const onSwipeEnd = useCallback(
    (endX: number) => {
      const dx = endX - touchStartX.current
      if (dx < -SWIPE_THRESHOLD) goNext()
      else if (dx > SWIPE_THRESHOLD) goPrev()
      else setDragOffsetX(0)
      touchStartX.current = endX
    },
    [goNext, goPrev]
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
    const front = display[index]
    if (!front || !cardWidthPx) return CARD_MIN_HEIGHT
    const sizes = imageSizes[front.id]
    if (!sizes || sizes.w <= 0) return CARD_MIN_HEIGHT
    const imageHeight = cardWidthPx * (sizes.h / sizes.w)
    const total = Math.round(imageHeight) + CONTENT_BLOCK_HEIGHT
    return Math.min(CARD_MAX_HEIGHT, Math.max(CARD_MIN_HEIGHT, total))
  }, [display, index, imageSizes, cardWidthPx])

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
          <Box ref={stackRef} position="relative" w="100%" h={`${stackHeight}px`}>
            {visibleCards.map((card, i) => (
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
            ))}
          </Box>
        )}

        {display.length > 0 && (
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
        )}
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
