import { useState, useEffect, useCallback, useRef } from "react"
import { Box, Flex, Text } from "@chakra-ui/react"

/* ── PageWipe ── */
export function PageWipe({ primary, secondary }: { primary: string; secondary: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 900)
    return () => clearTimeout(t)
  }, [])
  if (done) return null
  return (
    <Box position="fixed" inset="0" zIndex={100} pointerEvents="none" overflow="hidden">
      <Box position="absolute" inset="-20% -40%" bg={primary}
        style={{ animation: "p5-wipe 0.8s cubic-bezier(0.77,0,0.175,1) forwards" }} />
      <Box position="absolute" inset="-20% -40%" bg={secondary}
        style={{ animation: "p5-wipe-black 0.8s cubic-bezier(0.77,0,0.175,1) 0.08s forwards" }} />
    </Box>
  )
}

/* ── Footer ── */
export function PipeFooter({ muted, accent, hoverColor }: {
  muted: string; accent: string; hoverColor?: string
}) {
  return (
    <Flex justify="space-between" align="center" pt="8">
      <Text fontSize="10px" color={muted} fontWeight="600" letterSpacing="0.06em">© 2026 Pipe</Text>
      <Flex gap="4">
        {["TG", "IG", "X"].map(s => (
          <Text key={s} fontSize="10px" fontWeight="800" letterSpacing="0.12em"
            color={accent} cursor="pointer" _hover={{ color: hoverColor ?? accent, opacity: 0.6 }}
            transition="all 0.15s">{s}</Text>
        ))}
      </Flex>
    </Flex>
  )
}

/* ── useScrollReveal ── */
export function useScrollReveal() {
  const observer = useRef<IntersectionObserver | null>(null)
  const register = useCallback((el: HTMLElement | null, idx: number) => {
    if (!el) return
    el.dataset.cardIdx = String(idx)
    el.classList.add("p5-reveal")
    if (!observer.current) {
      observer.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const target = entry.target as HTMLElement
              const i = parseInt(target.dataset.cardIdx ?? "0", 10)
              const dir = i % 2 === 0 ? "p5-visible-left" : "p5-visible-right"
              target.style.animationDelay = `${i * 0.08}s`
              target.classList.add(dir)
              observer.current?.unobserve(target)
            }
          })
        },
        { threshold: 0.15 },
      )
    }
    observer.current.observe(el)
  }, [])

  useEffect(() => { return () => { observer.current?.disconnect() } }, [])
  return register
}

/* ── useCountUp ── */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    const diff = target - from
    if (diff === 0) return
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + diff * ease))
      if (t < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

/* ── Feed types & utilities ── */
export const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

export type EventCard = {
  id: string
  title: string
  description?: string | null
  channel: string
  message_id: number
  event_time?: string | null
  media_urls?: string[]
  created_at: string
}

export type Filter = { key: string; label: string; keywords: string[] }

export const FILTERS: Filter[] = [
  { key: "all", label: "Все", keywords: [] },
  { key: "concerts", label: "Концерты", keywords: ["концерт", "gig", "live", "выступ", "музы"] },
  { key: "theatre", label: "Театр", keywords: ["театр", "спектакл", "пьеса", "постановк"] },
  { key: "party", label: "Вечеринки", keywords: ["вечерин", "rave", "dj", "техно", "house"] },
  { key: "exhibition", label: "Выставки", keywords: ["выстав", "экспоз", "галере", "арт", "art"] },
  { key: "lecture", label: "Лекции", keywords: ["лекц", "talk", "meetup", "воркшоп", "workshop"] },
]

export function isImg(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
}

export function resolveMedia(media: string | undefined): string | null {
  if (!media) return null
  if (media.startsWith("http")) return media
  try {
    const base = new URL(API)
    return media.startsWith("/") ? `${base.origin}${media}` : `${API}/${media}`
  } catch {
    return media
  }
}

export function firstLine(text: string | null | undefined): string {
  if (!text) return ""
  return text.split("\n").find((l) => l.trim())?.trim() ?? ""
}

export function matchFilter(ev: EventCard, f: Filter): boolean {
  if (f.key === "all") return true
  const t = `${ev.title ?? ""}\n${ev.description ?? ""}\n${ev.channel}`.toLowerCase()
  return f.keywords.some((k) => t.includes(k))
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "")
  } catch {
    return ""
  }
}
