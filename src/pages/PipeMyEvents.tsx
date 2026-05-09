import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text, Image, Dialog, Portal, Grid } from "@chakra-ui/react"
import { isImg, resolveMedia, firstLine, type EventCard } from "./pipe/shared"
import {
  bucketFor,
  downloadIcs,
  removeSaved,
  timeUntil,
  useSavedEvents,
  type DateBucket,
} from "./pipe/savedEvents"

type Layout = "timeline" | "grid"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

const BUCKET_LABEL: Record<DateBucket, string> = {
  today: "Сегодня",
  tomorrow: "Завтра",
  thisWeek: "Эта неделя",
  later: "Позже",
  noDate: "Без даты",
}

const BUCKET_ORDER: DateBucket[] = ["today", "tomorrow", "thisWeek", "later", "noDate"]

const MONTHS_RU = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"]

function getDayParts(iso: string | null | undefined): { day: string; month: string; time: string } {
  if (!iso) return { day: "—", month: "", time: "" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { day: "—", month: "", time: "" }
  const day = String(d.getDate())
  const month = MONTHS_RU[d.getMonth()] ?? ""
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const hasTime = hours !== 0 || minutes !== 0
  const time = hasTime ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` : ""
  return { day, month, time }
}

export default function PipeMyEvents() {
  const navigate = useNavigate()
  const { saved } = useSavedEvents()
  const [failedImgs, setFailedImgs] = useState<Record<string, true>>({})
  const [selected, setSelected] = useState<EventCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [layout, setLayout] = useState<Layout>("timeline")

  const sortedAll = useMemo(() => {
    return [...saved].sort((a, b) => {
      const ta = a.event_time ? new Date(a.event_time).getTime() : Number.POSITIVE_INFINITY
      const tb = b.event_time ? new Date(b.event_time).getTime() : Number.POSITIVE_INFINITY
      return ta - tb
    })
  }, [saved])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return sortedAll.find((c) => {
      if (!c.event_time) return false
      const t = new Date(c.event_time).getTime()
      return !Number.isNaN(t) && t >= now
    }) ?? null
  }, [sortedAll])

  const grouped = useMemo(() => {
    const groups: Record<DateBucket, EventCard[]> = {
      today: [], tomorrow: [], thisWeek: [], later: [], noDate: [],
    }
    for (const card of sortedAll) groups[bucketFor(card)].push(card)
    return groups
  }, [sortedAll])

  const openDetail = (card: EventCard) => {
    setSelected(card)
    setDetailOpen(true)
  }

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      position="relative"
      overflow="hidden"
      css={{ WebkitTapHighlightColor: "transparent" }}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Decorative diagonal stripe in background */}
      <Box
        position="absolute"
        top="180px"
        left="-30%"
        right="-30%"
        h="220px"
        bg={`${B}08`}
        style={{ transform: "skewY(-8deg)" }}
        zIndex={0}
        pointerEvents="none"
      />
      <Box
        position="absolute"
        top="0"
        right="-40px"
        w="120px"
        h="120px"
        bg={B}
        style={{ transform: "rotate(45deg) translateY(-60px)" }}
        zIndex={0}
        pointerEvents="none"
        opacity={0.08}
      />

      <Flex maxW="430px" mx="auto" px="5" pt="4" pb="6" direction="column" align="stretch" position="relative" zIndex={1}>
        <Flex align="center" justify="space-between" mb="4">
          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-feed-swipe" })}
            align="center"
            gap="2"
            fontSize="11px"
            fontWeight="800"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color={B}
          >
            <Text fontSize="16px">←</Text>
            К свайпу
          </Flex>
          <Box
            bg={K}
            color={W}
            px="2.5"
            py="1"
            fontSize="10px"
            fontWeight="900"
            letterSpacing="0.16em"
            textTransform="uppercase"
          >
            {saved.length} {saved.length === 1 ? "ивент" : "ивентов"}
          </Box>
        </Flex>

        <Box pb="6">
          <Text
            fontSize="44px"
            fontWeight="900"
            lineHeight="0.88"
            letterSpacing="-0.04em"
            textTransform="uppercase"
            color={K}
          >
            Мои
          </Text>
          <Text
            fontSize="44px"
            fontWeight="900"
            lineHeight="0.88"
            letterSpacing="-0.04em"
            textTransform="uppercase"
            color={B}
            ml="6"
          >
            события
          </Text>
        </Box>

        {saved.length > 0 && (
          <Flex
            mb="5"
            border={`2.5px solid ${K}`}
            bg={W}
            boxShadow={`3px 3px 0 ${B}`}
            alignSelf="flex-start"
          >
            {(["timeline", "grid"] as Layout[]).map((m, idx, arr) => {
              const active = layout === m
              const label = m === "timeline" ? "Старый" : "Новый"
              return (
                <Flex
                  key={m}
                  as="button"
                  onClick={() => setLayout(m)}
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
        )}

        {saved.length === 0 ? (
          <EmptyState onGo={() => navigate({ to: "/pipe-feed-swipe" })} />
        ) : layout === "timeline" ? (
          <>
            {upcoming && (
              <NextUpHero
                card={upcoming}
                failed={!!failedImgs[upcoming.id]}
                onImgFail={() => setFailedImgs((p) => ({ ...p, [upcoming.id]: true }))}
                onOpen={() => openDetail(upcoming)}
                onCalendar={() => downloadIcs(upcoming)}
              />
            )}

            <Flex direction="column" gap="7" mt={upcoming ? "8" : "0"}>
              {BUCKET_ORDER.map((bucket) => {
                const list = grouped[bucket]
                if (list.length === 0) return null
                return (
                  <Box key={bucket}>
                    <BucketHeader label={BUCKET_LABEL[bucket]} count={list.length} />
                    <Box position="relative" pl="14px">
                      <Box position="absolute" left="3px" top="6px" bottom="6px" w="2px" bg={K} />
                      <Flex direction="column" gap="3">
                        {list.map((card) => (
                          <TicketCard
                            key={card.id}
                            card={card}
                            isHero={card.id === upcoming?.id}
                            failed={!!failedImgs[card.id]}
                            onImgFail={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
                            onOpen={() => openDetail(card)}
                            onRemove={() => removeSaved(card.id)}
                            onCalendar={() => downloadIcs(card)}
                          />
                        ))}
                      </Flex>
                    </Box>
                  </Box>
                )
              })}
            </Flex>
          </>
        ) : (
          <Flex direction="column" gap="6">
            {BUCKET_ORDER.map((bucket) => {
              const list = grouped[bucket]
              if (list.length === 0) return null
              return (
                <Box key={bucket}>
                  <BucketHeader label={BUCKET_LABEL[bucket]} count={list.length} />
                  <Grid templateColumns="repeat(2, 1fr)" gap="3">
                    {list.map((card, i) => (
                      <GridCard
                        key={card.id}
                        card={card}
                        accent={i % 2 === 0}
                        isHero={card.id === upcoming?.id}
                        failed={!!failedImgs[card.id]}
                        onImgFail={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
                        onOpen={() => openDetail(card)}
                        onRemove={() => removeSaved(card.id)}
                        onCalendar={() => downloadIcs(card)}
                      />
                    ))}
                  </Grid>
                </Box>
              )
            })}
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
              style={{ animation: "p5-dialog-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
            >
              <Dialog.CloseTrigger />
              <Dialog.Header bg={K} px="5" py="3">
                <Dialog.Title>
                  <Text fontSize="12px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase" color={W}>
                    {selected ? firstLine(selected.title) || firstLine(selected.description) || "Событие" : ""}
                  </Text>
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body px="5" py="4" bg={W}>
                {selected && (() => {
                  const m = selected.media_urls?.find(isImg) ?? selected.media_urls?.[0]
                  const r = resolveMedia(m)
                  const src = r && isImg(r) && !failedImgs[selected.id] ? r : null
                  return (
                    <Flex direction="column" gap="3">
                      {src && (
                        <Box overflow="hidden">
                          <Image
                            src={src}
                            alt={selected.title}
                            width="100%"
                            height="auto"
                            maxH="min(480px, 70vh)"
                            objectFit="contain"
                            display="block"
                            onError={() => setFailedImgs((p) => ({ ...p, [selected.id]: true }))}
                          />
                        </Box>
                      )}
                      <Text fontSize="10px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase" color={B}>
                        {selected.channel}
                      </Text>
                      <Text fontSize="sm" color={K} whiteSpace="pre-wrap" lineHeight="1.5">
                        {selected.description ?? selected.title ?? ""}
                      </Text>
                    </Flex>
                  )
                })()}
              </Dialog.Body>
              <Dialog.Footer px="5" py="3" bg={W} borderTop={`1px solid ${K}12`} gap="2">
                {selected && (
                  <Flex
                    as="button"
                    onClick={() => downloadIcs(selected)}
                    bg={W}
                    color={K}
                    border={`2.5px solid ${K}`}
                    boxShadow={`3px 3px 0 ${K}`}
                    px="4"
                    py="2"
                    fontSize="11px"
                    fontWeight="800"
                    letterSpacing="0.15em"
                    textTransform="uppercase"
                    cursor="pointer"
                  >
                    В календарь
                  </Flex>
                )}
                <Flex
                  as="button"
                  onClick={() => setDetailOpen(false)}
                  bg={B}
                  color={W}
                  px="4"
                  py="2"
                  fontSize="11px"
                  fontWeight="800"
                  letterSpacing="0.15em"
                  textTransform="uppercase"
                  cursor="pointer"
                  _hover={{ opacity: 0.88 }}
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

function EmptyState({ onGo }: { onGo: () => void }) {
  return (
    <Flex direction="column" align="center" gap="3" py="14" textAlign="center">
      <Text fontSize="44px" lineHeight="1" color={B}>♥</Text>
      <Text fontSize="18px" fontWeight="900" textTransform="uppercase" letterSpacing="-0.01em" color={K}>
        Пока пусто
      </Text>
      <Text fontSize="11px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={G}>
        Свайпай вправо чтобы сохранить
      </Text>
      <Flex
        as="button"
        mt="3"
        onClick={onGo}
        px="5"
        py="2.5"
        bg={B}
        color={W}
        border={`2.5px solid ${K}`}
        boxShadow={`3px 3px 0 ${K}`}
        fontSize="11px"
        fontWeight="900"
        letterSpacing="0.16em"
        textTransform="uppercase"
        cursor="pointer"
        _hover={{ transform: "translate(-1px,-1px)", boxShadow: `4px 4px 0 ${K}` }}
        transition="all 0.12s"
      >
        К свайпу →
      </Flex>
    </Flex>
  )
}

function BucketHeader({ label, count }: { label: string; count: number }) {
  return (
    <Flex align="center" gap="2" mb="3" position="relative">
      <Box
        bg={K}
        color={W}
        px="3"
        py="1.5"
        fontSize="14px"
        fontWeight="900"
        letterSpacing="0.18em"
        textTransform="uppercase"
        boxShadow={`3px 3px 0 ${B}`}
        style={{ transform: "skewX(-6deg)" }}
      >
        <Box style={{ transform: "skewX(6deg)" }}>{label}</Box>
      </Box>
      <Text fontSize="11px" fontWeight="900" letterSpacing="0.16em" color={G} ml="2">
        × {count}
      </Text>
      <Box flex="1" h="2px" bg={K} ml="2" opacity={0.18} />
    </Flex>
  )
}

function NextUpHero({
  card,
  failed,
  onImgFail,
  onOpen,
  onCalendar,
}: {
  card: EventCard
  failed: boolean
  onImgFail: () => void
  onOpen: () => void
  onCalendar: () => void
}) {
  const m = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
  const r = resolveMedia(m)
  const src = r && isImg(r) && !failed ? r : null
  const title = firstLine(card.title) || firstLine(card.description) || "Событие"
  const soon = timeUntil(card.event_time)
  const { day, month, time } = getDayParts(card.event_time)

  return (
    <Box
      mb="2"
      border={`2.5px solid ${K}`}
      bg={K}
      color={W}
      boxShadow={`6px 6px 0 ${B}`}
      position="relative"
      overflow="hidden"
    >
      <Box position="relative" h="180px" overflow="hidden" borderBottom={`2.5px solid ${K}`}>
        {src ? (
          <Image
            src={src}
            alt={title}
            position="absolute"
            inset="0"
            width="100%"
            height="100%"
            objectFit="cover"
            display="block"
            onError={onImgFail}
            style={{ filter: "saturate(1.1)" }}
          />
        ) : (
          <Box position="absolute" inset="0" bg={`linear-gradient(135deg, ${B}, ${K})`} />
        )}
        <Box
          position="absolute"
          inset="0"
          bg={`linear-gradient(180deg, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.2) 40%, rgba(13,13,13,0.85) 100%)`}
          pointerEvents="none"
        />
        <Box
          position="absolute"
          top="12px"
          left="12px"
          bg={B}
          color={W}
          px="3"
          py="1.5"
          fontSize="11px"
          fontWeight="900"
          letterSpacing="0.2em"
          textTransform="uppercase"
          boxShadow={`3px 3px 0 ${W}`}
          style={{ transform: "rotate(-3deg)" }}
        >
          {soon ? `СКОРО · ${soon}` : "СЛЕДУЮЩЕЕ"}
        </Box>
        <Box position="absolute" bottom="12px" left="12px" right="12px">
          <Text fontSize="10px" fontWeight="800" letterSpacing="0.16em" textTransform="uppercase" color={W} opacity={0.75} mb="1">
            {card.channel.replace(/^@/, "")}
            {time ? ` · ${time}` : ""}
          </Text>
          <Text
            fontSize="22px"
            fontWeight="900"
            lineHeight="1.05"
            textTransform="uppercase"
            letterSpacing="-0.02em"
            color={W}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}
          >
            {title}
          </Text>
        </Box>
      </Box>
      <Flex>
        <Flex
          flexShrink={0}
          direction="column"
          align="center"
          justify="center"
          w="76px"
          py="3"
          bg={W}
          color={K}
          borderRight={`2.5px solid ${K}`}
        >
          <Text fontSize="32px" fontWeight="900" lineHeight="1" letterSpacing="-0.04em">
            {day}
          </Text>
          <Text fontSize="10px" fontWeight="900" letterSpacing="0.18em" mt="0.5">
            {month}
          </Text>
        </Flex>
        <Flex
          as="button"
          onClick={onOpen}
          flex="1"
          align="center"
          justify="center"
          py="3"
          fontSize="11px"
          fontWeight="900"
          letterSpacing="0.16em"
          textTransform="uppercase"
          color={W}
          bg={K}
          cursor="pointer"
          _hover={{ bg: "#1a1a1a" }}
          transition="background 0.12s"
        >
          Открыть →
        </Flex>
        <Flex
          as="button"
          onClick={onCalendar}
          flex="1"
          align="center"
          justify="center"
          py="3"
          fontSize="11px"
          fontWeight="900"
          letterSpacing="0.16em"
          textTransform="uppercase"
          color={W}
          bg={B}
          borderLeft={`2.5px solid ${K}`}
          cursor="pointer"
          _hover={{ opacity: 0.9 }}
          transition="opacity 0.12s"
        >
          В календарь
        </Flex>
      </Flex>
    </Box>
  )
}

function TicketCard({
  card,
  isHero,
  failed,
  onImgFail,
  onOpen,
  onRemove,
  onCalendar,
}: {
  card: EventCard
  isHero: boolean
  failed: boolean
  onImgFail: () => void
  onOpen: () => void
  onRemove: () => void
  onCalendar: () => void
}) {
  const m = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
  const r = resolveMedia(m)
  const src = r && isImg(r) && !failed ? r : null
  const title = firstLine(card.title) || firstLine(card.description) || "Событие"
  const { day, month, time } = getDayParts(card.event_time)
  const soon = timeUntil(card.event_time)

  return (
    <Box position="relative">
      {/* Timeline dot */}
      <Box
        position="absolute"
        left="-15px"
        top="32px"
        w="10px"
        h="10px"
        bg={isHero ? B : K}
        border={`2px solid ${K}`}
        zIndex={1}
      />

      <Box
        border={`2.5px solid ${K}`}
        bg={W}
        boxShadow={isHero ? `4px 4px 0 ${B}` : `3px 3px 0 ${K}`}
        transition="all 0.12s"
        _hover={{ transform: "translate(-1px,-1px)", boxShadow: isHero ? `5px 5px 0 ${B}` : `4px 4px 0 ${K}` }}
        position="relative"
        overflow="hidden"
      >
        <Flex>
          {/* Date stub */}
          <Flex
            flexShrink={0}
            direction="column"
            align="center"
            justify="center"
            w="62px"
            bg={K}
            color={W}
            py="3"
            px="1"
            position="relative"
          >
            <Text fontSize="26px" fontWeight="900" lineHeight="1" letterSpacing="-0.04em">
              {day}
            </Text>
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" mt="0.5">
              {month}
            </Text>
            {time && (
              <Box mt="1.5" px="1" py="0.5" bg={B} fontSize="9px" fontWeight="900" letterSpacing="0.08em">
                {time}
              </Box>
            )}
            {/* Perforation dots column on right edge */}
            <Box
              position="absolute"
              right="-6px"
              top="0"
              bottom="0"
              w="12px"
              style={{
                backgroundImage: `radial-gradient(circle, ${W} 3px, transparent 3.5px)`,
                backgroundSize: "12px 14px",
                backgroundRepeat: "repeat-y",
                backgroundPosition: "center top",
              }}
              pointerEvents="none"
            />
          </Flex>

          {/* Body — clickable to open */}
          <Flex
            as="button"
            onClick={onOpen}
            flex="1"
            minW="0"
            bg={W}
            cursor="pointer"
            textAlign="left"
          >
            <Box w="74px" h="auto" flexShrink={0} bg={`${B}10`} borderLeft={`2px dashed ${K}30`} overflow="hidden" alignSelf="stretch">
              {src ? (
                <Image
                  src={src}
                  alt={title}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                  display="block"
                  onError={onImgFail}
                />
              ) : null}
            </Box>
            <Flex direction="column" justify="center" px="3" py="2.5" minW="0" flex="1">
              <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={B} mb="1">
                {card.channel.replace(/^@/, "").slice(0, 22)}
              </Text>
              <Text
                fontSize="13px"
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
              {soon && (
                <Box
                  alignSelf="flex-start"
                  mt="1.5"
                  bg={B}
                  color={W}
                  px="1.5"
                  py="0.5"
                  fontSize="9px"
                  fontWeight="900"
                  letterSpacing="0.14em"
                  textTransform="uppercase"
                >
                  {soon}
                </Box>
              )}
            </Flex>
          </Flex>
        </Flex>

        {/* Action strip */}
        <Flex borderTop={`2px solid ${K}`}>
          <Flex
            as="button"
            onClick={onCalendar}
            flex="1"
            align="center"
            justify="center"
            py="2"
            fontSize="10px"
            fontWeight="900"
            letterSpacing="0.14em"
            textTransform="uppercase"
            color={K}
            bg={W}
            cursor="pointer"
            _hover={{ bg: `${B}10` }}
            transition="background 0.12s"
            gap="1.5"
          >
            <Box as="span" color={B}>📅</Box> В календарь
          </Flex>
          <Flex
            as="button"
            onClick={onRemove}
            align="center"
            justify="center"
            px="3.5"
            py="2"
            fontSize="14px"
            fontWeight="900"
            color={K}
            bg={W}
            borderLeft={`2px solid ${K}`}
            cursor="pointer"
            _hover={{ bg: K, color: W }}
            transition="all 0.12s"
          >
            ✕
          </Flex>
        </Flex>
      </Box>
    </Box>
  )
}

function GridCard({
  card,
  accent,
  isHero,
  failed,
  onImgFail,
  onOpen,
  onRemove,
  onCalendar,
}: {
  card: EventCard
  accent: boolean
  isHero: boolean
  failed: boolean
  onImgFail: () => void
  onOpen: () => void
  onRemove: () => void
  onCalendar: () => void
}) {
  const m = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
  const r = resolveMedia(m)
  const src = r && isImg(r) && !failed ? r : null
  const title = firstLine(card.title) || firstLine(card.description) || "Событие"
  const { day, month, time } = getDayParts(card.event_time)
  const soon = timeUntil(card.event_time)

  return (
    <Box
      position="relative"
      border={`2.5px solid ${K}`}
      boxShadow={isHero ? `4px 5px 0 ${B}` : accent ? `4px 5px 0 ${B}` : `4px 5px 0 ${K}`}
      bg={K}
      overflow="hidden"
      transition="all 0.14s"
      _hover={{ transform: "translate(-1px,-1px)", boxShadow: isHero || accent ? `5px 6px 0 ${B}` : `5px 6px 0 ${K}` }}
      style={{ aspectRatio: "4 / 5" }}
    >
      <Box
        as="button"
        onClick={onOpen}
        position="absolute"
        inset="0"
        bg="transparent"
        cursor="pointer"
        textAlign="left"
        w="100%"
        h="100%"
      >
        {src ? (
          <Image
            src={src}
            alt={title}
            position="absolute"
            inset="0"
            width="100%"
            height="100%"
            objectFit="cover"
            display="block"
            onError={onImgFail}
          />
        ) : (
          <Box position="absolute" inset="0" bg={`linear-gradient(135deg, ${B}, ${K})`} />
        )}
        <Box
          position="absolute"
          inset="0"
          bg={`linear-gradient(180deg, rgba(13,13,13,0.55) 0%, rgba(13,13,13,0) 30%, rgba(13,13,13,0) 50%, rgba(13,13,13,0.92) 100%)`}
          pointerEvents="none"
        />

        {/* Date stub corner */}
        <Box position="absolute" top="0" left="0" bg={W} color={K} borderRight={`2.5px solid ${K}`} borderBottom={`2.5px solid ${K}`} px="2" py="1.5" minW="46px" textAlign="center">
          <Text fontSize="20px" fontWeight="900" lineHeight="1" letterSpacing="-0.04em">
            {day}
          </Text>
          <Text fontSize="8px" fontWeight="900" letterSpacing="0.18em" mt="0.5">
            {month}
          </Text>
        </Box>

        {time && (
          <Box position="absolute" top="6px" right="6px" bg={B} color={W} px="1.5" py="0.5" fontSize="9px" fontWeight="900" letterSpacing="0.1em" border={`2px solid ${K}`}>
            {time}
          </Box>
        )}

        {soon && (
          <Box
            position="absolute"
            top="58px"
            left="6px"
            bg={B}
            color={W}
            px="1.5"
            py="0.5"
            fontSize="9px"
            fontWeight="900"
            letterSpacing="0.14em"
            textTransform="uppercase"
            border={`2px solid ${W}`}
            style={{ transform: "rotate(-4deg)" }}
          >
            {soon}
          </Box>
        )}

        <Box position="absolute" bottom="0" left="0" right="0" px="2.5" pb="2.5" pt="6">
          <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={W} opacity={0.75} mb="1">
            {card.channel.replace(/^@/, "").slice(0, 18)}
          </Text>
          <Text
            fontSize="13px"
            fontWeight="900"
            lineHeight="1.1"
            textTransform="uppercase"
            letterSpacing="-0.01em"
            color={W}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 2px 10px rgba(0,0,0,0.7)",
            }}
          >
            {title}
          </Text>
        </Box>
      </Box>

      {/* Floating action buttons */}
      <Flex
        position="absolute"
        bottom="6px"
        right="6px"
        gap="1"
        zIndex={2}
      >
        <Flex
          as="button"
          onClick={(e) => { e.stopPropagation(); onCalendar() }}
          align="center"
          justify="center"
          w="28px"
          h="28px"
          bg={W}
          border={`2px solid ${K}`}
          fontSize="13px"
          cursor="pointer"
          _hover={{ bg: B, color: W }}
          transition="all 0.12s"
          title="В календарь"
        >
          📅
        </Flex>
        <Flex
          as="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          align="center"
          justify="center"
          w="28px"
          h="28px"
          bg={W}
          border={`2px solid ${K}`}
          fontSize="11px"
          fontWeight="900"
          color={K}
          cursor="pointer"
          _hover={{ bg: K, color: W }}
          transition="all 0.12s"
          title="Удалить"
        >
          ✕
        </Flex>
      </Flex>
    </Box>
  )
}
