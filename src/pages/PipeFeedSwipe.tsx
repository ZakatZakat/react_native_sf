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

const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(0,85,255,0.55)"

const STACK_OFFSET = 24
const SWIPE_THRESHOLD = 50
const CARD_MIN_HEIGHT = 580
const STACK_VISIBLE = 4

function EventCardStackCard({
  card,
  index,
  total,
  isTop,
  dragOffsetX,
  failedImgs,
  setFailedImgs,
  onTap,
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
  failedImgs: Record<string, true>
  setFailedImgs: React.Dispatch<React.SetStateAction<Record<string, true>>>
  onTap: () => void
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

  const offsetPx = index * STACK_OFFSET
  const zIndex = total - index
  const translateX = isTop ? dragOffsetX : 0
  const peek = (total - 1) * STACK_OFFSET
  const cardW = `calc(100% - ${peek}px)`
  const cardH = `calc(100% - ${peek}px)`

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
      left={`${offsetPx}px`}
      top={`${offsetPx}px`}
      width={cardW}
      height={cardH}
      zIndex={zIndex}
      transform={`translateX(${translateX}px)`}
      border={`2.5px solid ${B}`}
      bg={W}
      cursor={isTop ? "grab" : "default"}
      overflow="hidden"
      transition={isTop && dragOffsetX === 0 ? "transform 0.25s ease-out" : undefined}
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
    >
      <Box
        position="absolute"
        left={0}
        top={0}
        right={0}
        bottom={0}
        bg={W}
        backgroundImage={imgSrc ? `url(${imgSrc})` : undefined}
        backgroundSize="contain"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
        style={{
          backgroundImage: imgSrc ? `url("${imgSrc.replace(/"/g, "%22")}")` : undefined,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {imgSrc && (
          <img
            src={imgSrc}
            alt=""
            aria-hidden
            onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
            style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          />
        )}
        {!imgSrc && (
          <Box position="absolute" left={0} top={0} right={0} bottom={0} bg={`${B}18`} />
        )}
      </Box>
      <Flex
        position="absolute"
        left="0"
        right="0"
        bottom="0"
        direction="column"
        px="4"
        py="5"
        color={W}
      >
        <Flex justify="space-between" align="center" mb="2">
          <Text
            fontSize="10px"
            fontWeight="700"
            letterSpacing="0.15em"
            textTransform="uppercase"
            color={B}
          >
            {card.channel.replace(/^@/, "").slice(0, 20)}
          </Text>
          {date && (
            <Text
              fontSize="10px"
              fontWeight="600"
              letterSpacing="0.08em"
              color={`${W}99`}
              textTransform="uppercase"
            >
              {date}
            </Text>
          )}
        </Flex>
        <Text
          fontSize="18px"
          fontWeight="900"
          lineHeight="1.2"
          textTransform="uppercase"
          letterSpacing="-0.01em"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </Text>
        <Flex mt="3" align="center" justify="space-between" borderTop={`1px solid rgba(255,255,255,0.12)`} pt="3">
          <Text
            fontSize="10px"
            fontWeight="700"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color={`${W}99`}
          >
            Подробнее
          </Text>
          <Box as="span" color={B} fontSize="14px" fontWeight="900">→</Box>
        </Flex>
      </Flex>
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

  const stackHeight = CARD_MIN_HEIGHT + (STACK_VISIBLE - 1) * STACK_OFFSET

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
          <Text
            fontSize="10px"
            fontWeight="700"
            letterSpacing="0.15em"
            textTransform="uppercase"
            color={G}
          >
            Лента
          </Text>
        </Flex>

        <Text
          fontSize="28px"
          fontWeight="900"
          lineHeight="0.92"
          letterSpacing="-0.03em"
          textTransform="uppercase"
          mb="2"
        >
          Свайпай
          <Text as="span" color={B}> карточки</Text>
        </Text>

        <Text
          fontSize="10px"
          fontWeight="700"
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
          <Box position="relative" w="100%" h={`${stackHeight}px`}>
            {visibleCards.map((card, i) => (
              <EventCardStackCard
                key={`${card.id}-${index + i}`}
                card={card}
                index={i}
                total={visibleCards.length}
                isTop={i === 0}
                dragOffsetX={i === 0 ? dragOffsetX : 0}
                failedImgs={failedImgs}
                setFailedImgs={setFailedImgs}
                onTap={() => openDetail(card)}
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
              border={`3px solid ${B}`}
              borderRadius="0"
              overflow="hidden"
              style={{
                animation: "p5-dialog-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
              }}
            >
              <Dialog.CloseTrigger />
              <Dialog.Header
                bg={B}
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
                      <Box border={`2px solid ${B}`} overflow="hidden">
                        <Image
                          src={selImg}
                          alt={selTitle}
                          width="100%"
                          height="auto"
                          maxH="300px"
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
                    color={B}
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
                borderTop={`1px solid rgba(0,85,255,0.2)`}
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
