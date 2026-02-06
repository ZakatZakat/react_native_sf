import { useState, useEffect, useMemo, useCallback } from "react"
import { Box, Flex, Stack, Text, Image, Dialog, Portal } from "@chakra-ui/react"
import {
  PageWipe, PipeFooter, useScrollReveal,
  API, FILTERS, isImg, resolveMedia, firstLine, matchFilter, formatDate,
  type EventCard,
} from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.35)"

export default function PipeFeed() {
  const [items, setItems] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState("all")
  const [failedImgs, setFailedImgs] = useState<Record<string, true>>({})
  const [selected, setSelected] = useState<EventCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [filterKey, setFilterKey] = useState(0)

  const reveal = useScrollReveal()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/events?limit=30`, { cache: "no-store" })
      if (res.ok) setItems(await res.json())
    } catch { /* */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === activeFilter) ?? FILTERS[0]
    return items.filter((e) => matchFilter(e, f))
  }, [items, activeFilter])

  const handleFilter = useCallback((key: string) => {
    setActiveFilter(key)
    setFilterKey((k) => k + 1)
  }, [])

  const openDetail = useCallback((card: EventCard) => {
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

  return (
    <Box minH="100dvh" bg={W} color={K} position="relative">
      <PageWipe primary={B} secondary={K} />

      <Stack maxW="430px" mx="auto" px="5" pt="8" pb="20" gap="0">

        {/* HEADER */}
        <Flex
          align="center" justify="space-between" pb="6"
          className="p5-drop" style={{ animationDelay: "0.3s" }}
        >
          <Flex align="center" gap="3">
            <Box w="28px" h="28px" borderRadius="full" bg={B} />
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.25em" textTransform="uppercase">
              Pipe
            </Text>
          </Flex>
          <Flex
            as="button"
            onClick={load}
            px="3" py="1.5"
            border={`2px solid ${K}`}
            fontSize="10px" fontWeight="800" letterSpacing="0.12em" textTransform="uppercase"
            cursor="pointer" _hover={{ bg: K, color: W }} transition="all 0.15s"
          >
            {loading ? "..." : "Обновить"}
          </Flex>
        </Flex>

        {/* TITLE */}
        <Text
          fontSize="36px" fontWeight="900" lineHeight="0.92"
          letterSpacing="-0.03em" textTransform="uppercase" pb="6"
          className="p5-drop" style={{ animationDelay: "0.45s" }}
        >
          Лента
          <Text as="span" color={B}> событий</Text>
        </Text>

        {/* FILTERS */}
        <Box pb="6" className="p5-drop" style={{ animationDelay: "0.55s" }}>
          <Box h="1px" bg={`${K}12`} mb="4" />
          <Flex gap="0" flexWrap="wrap">
            {FILTERS.map((f) => (
              <Flex
                key={f.key}
                onClick={() => handleFilter(f.key)}
                cursor="pointer"
                px="3" py="1.5"
                border={`2px solid ${f.key === activeFilter ? K : `${K}12`}`}
                bg={f.key === activeFilter ? K : "transparent"}
                color={f.key === activeFilter ? W : K}
                fontSize="10px" fontWeight="800"
                letterSpacing="0.12em" textTransform="uppercase"
                transition="all 0.15s"
                mr="-2px" mb="-2px"
                className={f.key === activeFilter ? "p5-tab-pop" : undefined}
              >
                {f.label}
              </Flex>
            ))}
          </Flex>
          <Box h="1px" bg={`${K}12`} mt="4" />
        </Box>

        {/* COUNT */}
        <Text
          fontSize="10px" fontWeight="700" letterSpacing="0.15em"
          textTransform="uppercase" color={G} pb="4"
          className="p5-drop" style={{ animationDelay: "0.6s" }}
        >
          {filtered.length} {filtered.length === 1 ? "событие" : "событий"}
        </Text>

        {/* EVENT LIST */}
        {loading && items.length === 0 ? (
          <Text color={G} fontSize="sm" py="10" textAlign="center">Загружаем...</Text>
        ) : (
          <Stack gap="5" key={filterKey}>
            {filtered.map((card, idx) => {
              const media = card.media_urls?.find(isImg) ?? card.media_urls?.[0]
              const rawSrc = resolveMedia(media)
              const imgSrc = rawSrc && isImg(rawSrc) && !failedImgs[card.id] ? rawSrc : null
              const title = firstLine(card.title) || firstLine(card.description) || "Событие"
              const date = formatDate(card.event_time || card.created_at)
              const tilt = idx % 3 === 0 ? -0.6 : idx % 3 === 1 ? 0.5 : 0

              return (
                <Box
                  key={card.id}
                  ref={(el) => reveal(el, idx)}
                >
                <Box
                  border={`2.5px solid ${K}`}
                  position="relative"
                  cursor="pointer"
                  onClick={() => openDetail(card)}
                  style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}
                  _hover={{ boxShadow: `4px 4px 0 ${B}` }}
                  transition="box-shadow 0.15s"
                >
                  {imgSrc && (
                    <Box overflow="hidden" borderBottom={`2px solid ${K}`}>
                      <Image
                        src={imgSrc}
                        alt={title}
                        width="100%"
                        height="auto"
                        maxH="260px"
                        objectFit="cover"
                        display="block"
                        onError={() => setFailedImgs((p) => ({ ...p, [card.id]: true }))}
                      />
                    </Box>
                  )}
                  <Box px="4" py="3">
                    <Flex justify="space-between" align="center" mb="2">
                      <Text fontSize="10px" fontWeight="700" letterSpacing="0.15em" textTransform="uppercase" color={B}>
                        {card.channel}
                      </Text>
                      {date && (
                        <Text fontSize="10px" fontWeight="600" letterSpacing="0.08em" color={G} textTransform="uppercase">
                          {date}
                        </Text>
                      )}
                    </Flex>
                    <Text
                      fontSize="16px" fontWeight="900" lineHeight="1.15"
                      textTransform="uppercase" letterSpacing="-0.01em"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {title}
                    </Text>
                    <Flex
                      mt="3" align="center" justify="space-between"
                      borderTop={`1px solid ${K}12`} pt="2"
                    >
                      <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={G}>
                        Подробнее
                      </Text>
                      <Text fontSize="14px" fontWeight="900" color={B}>→</Text>
                    </Flex>
                  </Box>

                  {idx === 0 && (
                    <Box position="absolute" top="-8px" right="-8px" w="16px" h="16px" borderRadius="full" bg={B} />
                  )}
                </Box>
                </Box>
              )
            })}
          </Stack>
        )}

        {/* FOOTER */}
        <Box pt="2">
          <PipeFooter muted={G} accent={K} hoverColor={B} />
        </Box>
      </Stack>

      {/* DETAIL DIALOG */}
      <Dialog.Root open={detailOpen} onOpenChange={(d) => setDetailOpen(d.open)}>
        <Portal>
          <Dialog.Backdrop
            style={{ animation: "p5-backdrop 0.35s ease-out forwards" }}
          />
          <Dialog.Positioner>
            <Dialog.Content
              maxW="min(92vw, 420px)" mx="auto"
              border={`3px solid ${K}`} borderRadius="0"
              overflow="hidden" boxShadow={`6px 6px 0 ${B}`}
              style={{ animation: "p5-dialog-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
            >
              <Dialog.CloseTrigger />

              <Dialog.Header bg={K} px="5" py="3" position="relative" overflow="hidden">
                <Box
                  position="absolute" top="0" right="-20px" bottom="0" w="60px"
                  bg={B} style={{ transform: "skewX(-12deg)" }} opacity={0.2}
                />
                <Dialog.Title>
                  <Text fontSize="12px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase" color={W} position="relative">
                    {selTitle}
                  </Text>
                </Dialog.Title>
              </Dialog.Header>

              <Dialog.Body px="5" py="4" bg={W}>
                <Stack gap="3">
                  {selImg && selected && !failedImgs[selected.id] && (
                    <Box border={`2px solid ${K}`} overflow="hidden">
                      <Image
                        src={selImg} alt={selTitle}
                        width="100%" height="auto" maxH="300px"
                        objectFit="cover" display="block"
                        onError={() => {
                          if (selected) setFailedImgs((p) => ({ ...p, [selected.id]: true }))
                        }}
                      />
                    </Box>
                  )}
                  {selected?.channel && (
                    <Text fontSize="10px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase" color={B}>
                      {selected.channel}
                    </Text>
                  )}
                  <Text fontSize="sm" color={K} whiteSpace="pre-wrap" lineHeight="1.5">
                    {selected?.description ?? selected?.title ?? ""}
                  </Text>
                </Stack>
              </Dialog.Body>

              <Dialog.Footer px="5" py="3" bg={W} borderTop={`1px solid ${K}12`}>
                <Flex
                  as="button"
                  onClick={() => setDetailOpen(false)}
                  bg={B} color={W}
                  px="5" py="2.5"
                  fontSize="11px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase"
                  cursor="pointer" _hover={{ opacity: 0.88 }} transition="opacity 0.15s"
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
