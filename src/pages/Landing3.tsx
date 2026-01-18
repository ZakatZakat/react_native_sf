import * as React from "react"
import { Box, Button, Image, Stack, Text } from "@chakra-ui/react"

type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  message_id: number
  media_urls?: string[]
  created_at: string
}

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"

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

function firstLine(text: string | null | undefined): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
}

function normalizeText(text: string | null | undefined): string {
  return (text ?? "").toLowerCase()
}

export default function Landing3() {
  const [images, setImages] = React.useState<string[]>([])
  const [idx, setIdx] = React.useState(0)
  const [visible, setVisible] = React.useState(true)
  const [imgFailed, setImgFailed] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiUrl}/events?limit=120`, { cache: "no-store" })
        if (!res.ok) throw new Error(`events status ${res.status}`)
        const data: EventCard[] = await res.json()

        const targetNeedleA = "агата кристи"
        const targetNeedleB = "красим ресницы"
        const target = data.find((e) => {
          const t = `${normalizeText(e.title)}\n${normalizeText(e.description)}`
          return t.includes(targetNeedleA) && t.includes(targetNeedleB)
        })
        const targetSoft = target
          ? null
          : data.find((e) => {
              const t = `${normalizeText(e.title)}\n${normalizeText(e.description)}`
              return t.includes(targetNeedleA)
            })

        const candidates = data
          .filter((e) => (e.media_urls ?? []).some((u) => isLikelyImageUrl(u)))
          .sort(
            (a, b) =>
              firstLine(b.title).length +
              (b.description ?? "").length -
              (firstLine(a.title).length + (a.description ?? "").length),
          )
          .slice(0, 60)

        const preferred = target ?? targetSoft
        const preferredUrl = (() => {
          const media =
            preferred?.media_urls?.find((u) => isLikelyImageUrl(u)) ?? preferred?.media_urls?.[0] ?? null
          return media ? resolveMediaUrl(media, apiUrl) : null
        })()

        const urls = ([
          ...(preferredUrl ? [preferredUrl] : []),
          ...candidates
            .map((e) => e.media_urls?.find((u) => isLikelyImageUrl(u)) ?? e.media_urls?.[0] ?? null)
            .map((u) => (u ? resolveMediaUrl(u, apiUrl) : null)),
        ] as Array<string | null>)
          .filter((u): u is string => Boolean(u) && isLikelyImageUrl(u!))
          .filter((u, i, arr) => arr.indexOf(u) === i)
          .slice(0, 12)

        setImages(urls)
        setIdx(0)
        setVisible(true)
        setImgFailed(false)
      } catch (e) {
        console.error("landing3 load", e)
        setImages([])
        setIdx(0)
        setImgFailed(false)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const reduceMotion = React.useMemo(() => {
    if (typeof window === "undefined") return false
    try {
      return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    if (reduceMotion) return
    if (loading) return
    if (images.length <= 1) return

    let t: number | null = null
    const interval = window.setInterval(() => {
      setVisible(false)
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => {
        setIdx((prev) => (prev + 1) % images.length)
        setVisible(true)
      }, 350)
    }, 5200)

    return () => {
      window.clearInterval(interval)
      if (t) window.clearTimeout(t)
    }
  }, [images.length, loading, reduceMotion])

  const imgSrc = images.length ? images[idx % images.length] : null

  return (
    <Box minH="100dvh" bg="#C9D36A" display="grid" placeItems="center" py="8">
      <Box
        width="320px"
        height="640px"
        borderRadius="44px"
        bg="#0C0C0C"
        p="10px"
        boxShadow="0 30px 70px rgba(0,0,0,0.35)"
      >
        <Box
          width="100%"
          height="100%"
          borderRadius="36px"
          overflow="hidden"
          bg="#111"
          position="relative"
        >
          <Box position="absolute" top="10px" left="50%" transform="translateX(-50%)" width="150px" height="26px" borderRadius="20px" bg="#0B0B0B" opacity={0.85} />

          {loading ? (
            <Box position="absolute" inset="0" display="grid" placeItems="center">
              <Text color="rgba(255,255,255,0.75)" fontSize="sm">
                Loading…
              </Text>
            </Box>
          ) : imgSrc && !imgFailed ? (
            <Image
              src={imgSrc}
              alt="preview"
              width="100%"
              height="100%"
              objectFit="contain"
              objectPosition="50% 20%"
              position="absolute"
              inset="0"
              opacity={visible ? 1 : 0}
              transition={reduceMotion ? "none" : "opacity 280ms ease"}
              onError={() => {
                setImgFailed(true)
                if (images.length > 1) {
                  setIdx((prev) => (prev + 1) % images.length)
                  setVisible(true)
                  setImgFailed(false)
                }
              }}
            />
          ) : (
            <Box position="absolute" inset="0" display="grid" placeItems="center">
              <Text color="rgba(255,255,255,0.75)" fontSize="sm" textAlign="center" px="8">
                Нет изображения.
                <br />
                Сначала забери посты в ленте.
              </Text>
            </Box>
          )}

          <Box
            position="absolute"
            left="0"
            right="0"
            bottom="0"
            bg="#A9C9F3"
            borderTopLeftRadius="28px"
            borderTopRightRadius="28px"
            px="18px"
            pt="18px"
            pb="18px"
            boxShadow="0 -18px 35px rgba(0,0,0,0.25)"
          >
            <Text fontWeight="black" fontSize="xl" lineHeight="1.05" letterSpacing="-0.4px" color="#0F0F0F">
              ИИ подбирает для тебя
              <br />
              лучшие события из 500+
              <br />
              ивентов — под твой вкус
            </Text>

            <Stack gap="2" mt="4">
              <Button bg="#1A1A1A" color="white" borderRadius="full">
                Начать подбор
              </Button>
              <Button variant="ghost" borderRadius="full">
                Войти
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

