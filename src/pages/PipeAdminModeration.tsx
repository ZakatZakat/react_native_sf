import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text, Image } from "@chakra-ui/react"
import { Curator } from "../lib/curator"
import { isImg, resolveMedia } from "./pipe/shared"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G = "rgba(13,13,13,0.55)"

type ModItem = {
  event_id: number
  channel: string
  message_id: number
  text: string
  media_urls: string[]
  event_time: string | null
  location: string | null
  price: string | null
  filter_score: number
  filter_reasons: string[]
  created_at: string
}

export default function PipeAdminModeration() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ModItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ approved: number; review: number; rejected: number } | null>(null)
  const [working, setWorking] = useState<Record<number, "approve" | "reject" | null>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, st] = await Promise.all([
        Curator.modList({ limit: 50 }),
        Curator.adminStats().catch(() => null),
      ])
      setItems(list)
      if (st) {
        setStats({
          approved: st.events_by_status?.approved ?? 0,
          review: st.events_by_status?.manual_review ?? 0,
          rejected: st.events_by_status?.rejected ?? 0,
        })
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const decide = async (id: number, kind: "approve" | "reject", reason?: string) => {
    setWorking((w) => ({ ...w, [id]: kind }))
    try {
      if (kind === "approve") await Curator.modApprove(id)
      else await Curator.modReject(id, reason)
      // remove from local list
      setItems((arr) => arr.filter((x) => x.event_id !== id))
      // refresh stats
      Curator.adminStats().then((st) =>
        setStats({
          approved: st.events_by_status?.approved ?? 0,
          review: st.events_by_status?.manual_review ?? 0,
          rejected: st.events_by_status?.rejected ?? 0,
        })
      ).catch(() => {})
    } catch (e) {
      setError(String(e))
    } finally {
      setWorking((w) => ({ ...w, [id]: null }))
    }
  }

  return (
    <Box
      minH="100dvh"
      bg={W}
      color={K}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <Flex maxW="720px" mx="auto" px="5" pt="4" pb="6" direction="column" gap="4">
        <Flex align="center" justify="space-between">
          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-feed-swipe" })}
            align="center" gap="2" fontSize="11px" fontWeight="800"
            letterSpacing="0.1em" textTransform="uppercase" color={B} cursor="pointer"
          >
            <Text fontSize="16px">←</Text> К свайпу
          </Flex>
          <Box
            as="button"
            onClick={load}
            border={`2px solid ${K}`} bg={W} px="2.5" py="1"
            fontSize="10px" fontWeight="900" letterSpacing="0.16em" textTransform="uppercase" cursor="pointer"
          >
            Обновить
          </Box>
        </Flex>

        <Box>
          <Text fontSize="36px" fontWeight="900" lineHeight="0.92" letterSpacing="-0.03em" textTransform="uppercase">
            <Text as="span" color={K}>Модерация</Text>{" "}
            <Text as="span" color={B}>{items.length}</Text>
          </Text>
          <Text fontSize="11px" fontWeight="700" letterSpacing="0.1em" color={G} textTransform="uppercase" mt="2">
            Спорные ивенты — score 4-5. Approve = в ленту + push. Reject = в архив.
          </Text>
        </Box>

        {stats && (
          <Flex gap="3" wrap="wrap">
            <Pill label="Approved" value={stats.approved} bg={B} fg={W} />
            <Pill label="Review" value={stats.review} bg={K} fg={W} />
            <Pill label="Rejected" value={stats.rejected} bg={W} fg={K} bordered />
          </Flex>
        )}

        {error && (
          <Box bg={`${K}10`} border={`2px solid ${K}`} px="3" py="2">
            <Text fontSize="11px" fontWeight="700" color={K}>{error}</Text>
          </Box>
        )}

        {loading ? (
          <Text color={G} fontSize="sm" py="10" textAlign="center">Загрузка…</Text>
        ) : items.length === 0 ? (
          <Flex direction="column" align="center" gap="2" py="14" textAlign="center">
            <Text fontSize="44px" lineHeight="1" color={B}>✓</Text>
            <Text fontSize="16px" fontWeight="900" textTransform="uppercase">Очередь пуста</Text>
            <Text fontSize="11px" fontWeight="700" color={G} letterSpacing="0.1em">Все ивенты обработаны</Text>
          </Flex>
        ) : (
          <Flex direction="column" gap="4">
            {items.map((it) => (
              <ModerationCard
                key={it.event_id}
                item={it}
                working={working[it.event_id] ?? null}
                onApprove={() => decide(it.event_id, "approve")}
                onReject={() => {
                  const r = window.prompt("Причина отказа (необязательно):") ?? undefined
                  decide(it.event_id, "reject", r || undefined)
                }}
              />
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  )
}

function Pill({ label, value, bg, fg, bordered }: { label: string; value: number; bg: string; fg: string; bordered?: boolean }) {
  return (
    <Flex direction="column" px="3" py="2" bg={bg} color={fg} border={bordered ? `2px solid ${K}` : undefined}>
      <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" opacity={0.7}>
        {label}
      </Text>
      <Text fontSize="22px" fontWeight="900" lineHeight="1">{value}</Text>
    </Flex>
  )
}

function ModerationCard({
  item, working, onApprove, onReject,
}: {
  item: ModItem
  working: "approve" | "reject" | null
  onApprove: () => void
  onReject: () => void
}) {
  const m = item.media_urls.find(isImg) ?? item.media_urls[0]
  const r = resolveMedia(m)
  const src = r && isImg(r) ? r : null
  const date = item.event_time
    ? new Date(item.event_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <Box
      border={`2.5px solid ${K}`}
      bg={W}
      boxShadow={`5px 6px 0 ${B}`}
      overflow="hidden"
      style={{ opacity: working ? 0.55 : 1, transition: "opacity 0.2s" }}
    >
      <Flex direction={{ base: "column", sm: "row" }}>
        {src && (
          <Box w={{ base: "100%", sm: "200px" }} h={{ base: "180px", sm: "auto" }} flexShrink={0} bg={`${B}10`} overflow="hidden" borderRight={{ base: "none", sm: `2.5px solid ${K}` }} borderBottom={{ base: `2.5px solid ${K}`, sm: "none" }}>
            <Image src={src} alt="" width="100%" height="100%" objectFit="cover" />
          </Box>
        )}
        <Box flex="1" p="3" minW="0">
          <Flex align="center" gap="2" mb="2" wrap="wrap">
            <Text fontSize="9px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase" color={B}>
              {item.channel}
            </Text>
            <Box bg={K} color={W} px="1.5" py="0.5" fontSize="9px" fontWeight="900" letterSpacing="0.12em">
              SCORE {item.filter_score}
            </Box>
            {date && (
              <Text fontSize="9px" fontWeight="700" letterSpacing="0.08em" color={G}>
                · {date}
              </Text>
            )}
            {item.location && (
              <Text fontSize="9px" fontWeight="700" letterSpacing="0.08em" color={G}>
                · {item.location}
              </Text>
            )}
          </Flex>
          <Text fontSize="13px" lineHeight="1.4" color={K} whiteSpace="pre-wrap" style={{
            display: "-webkit-box",
            WebkitLineClamp: 6,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {item.text}
          </Text>
          <Flex align="center" gap="1.5" mt="2" wrap="wrap">
            {item.filter_reasons.map((r) => (
              <Box key={r} px="1.5" py="0.5" bg={`${K}10`} fontSize="9px" fontWeight="800" letterSpacing="0.08em" color={K}>
                {r}
              </Box>
            ))}
          </Flex>
        </Box>
      </Flex>
      <Flex borderTop={`2px solid ${K}`}>
        <Flex
          as="button"
          onClick={onReject}
          flex="1"
          align="center"
          justify="center"
          py="2.5"
          bg={W}
          color={K}
          fontSize="11px"
          fontWeight="900"
          letterSpacing="0.16em"
          textTransform="uppercase"
          cursor={working ? "wait" : "pointer"}
          pointerEvents={working ? "none" : "auto"}
          _hover={{ bg: `${K}10` }}
          transition="all 0.12s"
          gap="1.5"
        >
          ✕ Reject
        </Flex>
        <Flex
          as="button"
          onClick={onApprove}
          flex="1"
          align="center"
          justify="center"
          py="2.5"
          bg={B}
          color={W}
          borderLeft={`2px solid ${K}`}
          fontSize="11px"
          fontWeight="900"
          letterSpacing="0.16em"
          textTransform="uppercase"
          cursor={working ? "wait" : "pointer"}
          pointerEvents={working ? "none" : "auto"}
          _hover={{ opacity: 0.9 }}
          transition="all 0.12s"
          gap="1.5"
        >
          ✓ Approve
        </Flex>
      </Flex>
    </Box>
  )
}
