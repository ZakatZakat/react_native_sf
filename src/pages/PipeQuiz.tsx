/**
 * PipeQuiz — 4-step editorial photo quiz.
 *
 * Each step shows a question + 4 poster tiles (2x2 grid). User picks one;
 * each pick adds weights to 1–2 categories. After the last step, a receipt-
 * style result card shows the inferred top categories + estimated feed size.
 *
 * Port of /Users/askarembulatov/Downloads/alt2-quiz.jsx with our Curator-
 * backed event posters substituting for the original "01..08" poster ids.
 */

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Curator, type FeedItem } from "../lib/curator"
import { isImg, resolveMedia } from "./pipe/shared"
import { INTERESTS, type Interest, setInterests } from "./pipe/preferences"

const K = "#0D0D0D"
const W = "#FFFFFF"
const B = "#0055FF"
const G18 = "rgba(13,13,13,0.18)"
const G35 = "rgba(13,13,13,0.35)"
const G55 = "rgba(13,13,13,0.55)"

const INTEREST_BY_KEY: Record<string, Interest> =
  Object.fromEntries(INTERESTS.map((i) => [i.key, i]))

/** Original alt2-quiz used short cat keys (club/rave/art/...). Map them onto
 *  our actual interest keys from preferences.ts. */
const CAT_MAP: Record<string, string[]> = {
  art: ["contemporary"],
  contemporary: ["contemporary"],
  cinema: ["cinema"],
  theater: ["theatre"],
  theatre: ["theatre"],
  perf: ["performance"],
  performance: ["performance"],
  music: ["music"],
  rave: ["music"],
  club: ["music"],
  fest: ["music"],
  lit: ["literature"],
  literature: ["literature"],
  lect: ["talks"],
  talks: ["talks"],
  photo: ["photo"],
  dance: ["dance"],
  architecture: ["architecture"],
  design: ["design"],
  exhibition: ["exhibition"],
  strange: ["performance"],
}
const mapCats = (xs: string[]) =>
  Array.from(new Set(xs.flatMap((k) => CAT_MAP[k] ?? []))).filter((k) => INTEREST_BY_KEY[k])

type QuizOpt = { label: string; cats: string[] }
type QuizStep = { qShort: string; q: string; opts: QuizOpt[] }

const QUIZ: QuizStep[] = [
  {
    qShort: "Q1 / 4",
    q: "Вечер пятницы. Куда тебя тянет?",
    opts: [
      { label: "В подвал, где темно и громко",  cats: mapCats(["club", "rave"]) },
      { label: "В галерею, где можно молчать",  cats: mapCats(["art", "photo"]) },
      { label: "На сцену, где есть текст",      cats: mapCats(["theater", "lit"]) },
      { label: "В кино, желательно странное",   cats: mapCats(["cinema", "strange"]) },
    ],
  },
  {
    qShort: "Q2 / 4",
    q: "Кого хочется в твоём вечере?",
    opts: [
      { label: "Никого. Один, у стены",            cats: mapCats(["art", "photo", "lit"]) },
      { label: "Полная коробка незнакомцев",       cats: mapCats(["rave", "club"]) },
      { label: "Двое-трое и разговор до утра",     cats: mapCats(["lit", "lect"]) },
      { label: "Сцена, я в зале",                  cats: mapCats(["music", "perf", "theater"]) },
    ],
  },
  {
    qShort: "Q3 / 4",
    q: "Что для тебя «странное»?",
    opts: [
      { label: "Знакомое, поданное не так",        cats: mapCats(["art", "perf"]) },
      { label: "Эксперимент без правил",           cats: mapCats(["strange", "rave"]) },
      { label: "Большая идея в малой форме",       cats: mapCats(["theater", "lit", "lect"]) },
      { label: "Музыка, которой ещё не было",      cats: mapCats(["music", "rave"]) },
    ],
  },
  {
    qShort: "Q4 / 4",
    q: "Чтобы потом было что вспомнить:",
    opts: [
      { label: "Фестиваль на три дня",             cats: mapCats(["fest", "music"]) },
      { label: "Одна сильная картина",             cats: mapCats(["art", "photo"]) },
      { label: "Спектакль, который трясёт",        cats: mapCats(["theater", "perf"]) },
      { label: "Сет, после которого до 7 утра",    cats: mapCats(["rave", "club"]) },
    ],
  },
]

/* ─────────────────────────────────────────────────────────── */
/* Tiny atoms                                                  */
/* ─────────────────────────────────────────────────────────── */

function Mark({ children, color = K }: { children: React.ReactNode; color?: string }) {
  return (
    <Text
      as="span" fontWeight="900" fontSize="9px"
      letterSpacing="0.32em" textTransform="uppercase"
      color={color} lineHeight="1"
    >
      {children}
    </Text>
  )
}

/** Same poster recipe as PipeSwipeTrain — raw image, no duotone wash. */
function Poster({ src }: { src: string | null }) {
  if (!src) return <Box w="100%" h="100%" bg={K} />
  return (
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
    />
  )
}

/* ─────────────────────────────────────────────────────────── */
/* Quiz option tile — poster + letter chip + label             */
/* ─────────────────────────────────────────────────────────── */

const LETTERS = ["A", "B", "C", "D"] as const

function QuizOption({
  opt, idx, selected, posterUrl, onClick,
}: {
  opt: QuizOpt
  idx: number
  selected: boolean
  posterUrl: string | null
  onClick: () => void
}) {
  return (
    <Box
      as="button"
      onClick={onClick}
      position="relative"
      p={0}
      cursor="pointer"
      border={`2px solid ${K}`}
      bg={W}
      display="flex"
      flexDirection="column"
      textAlign="left"
      overflow="hidden"
      style={{
        transition: "all 0.15s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: selected ? `3px 3px 0 ${B}` : "none",
        transform: selected ? "translate(-1px,-1px)" : "translate(0,0)",
        fontFamily: "'Helvetica Neue', sans-serif",
      }}
    >
      <Box position="relative" w="100%" style={{ aspectRatio: "1 / 1", borderBottom: `1.5px solid ${K}` }} overflow="hidden">
        <Poster src={posterUrl} />
        {/* Letter chip — top-left */}
        <Flex
          position="absolute" top="6px" left="6px"
          w="22px" h="22px"
          align="center" justify="center"
          bg={selected ? B : W}
          color={selected ? W : K}
          border={`1.5px solid ${K}`}
          fontWeight="900" fontSize="12px" lineHeight="1"
        >
          {LETTERS[idx]}
        </Flex>
        {/* Selected outline */}
        {selected && (
          <Box
            position="absolute" inset="0"
            border={`4px solid ${B}`}
            pointerEvents="none"
          />
        )}
      </Box>
      <Box px="2.5" pt="2" pb="2.5">
        <Text
          fontWeight="900" fontSize="12.5px" lineHeight="1.15"
          letterSpacing="-0.015em" color={K}
          style={{ minHeight: "48px" }}
        >
          {opt.label}
        </Text>
      </Box>
    </Box>
  )
}

/* ─────────────────────────────────────────────────────────── */
/* Page                                                         */
/* ─────────────────────────────────────────────────────────── */

export default function PipeQuiz() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<(number | undefined)[]>([])
  const [pool, setPool] = useState<FeedItem[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const feed = await Curator.getFeed({ limit: 200 })
        if (cancelled) return
        setPool(feed.filter((e) => e.media_urls?.some(isImg)))
      } catch { /* offline */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Pick a deterministic poster per option: first pool event whose tags
  // include ANY of the option's cats, falling back to the first event.
  const posterFor = (cats: string[], stepIdx: number, optIdx: number): string | null => {
    if (pool.length === 0) return null
    const candidates = pool.filter((e) => (e.tags ?? []).some((t) => cats.includes(t)))
    const list = candidates.length > 0 ? candidates : pool
    // simple stable index per (step, opt) so different options show different posters
    const ev = list[(stepIdx * 7 + optIdx * 13) % list.length]
    const m = ev.media_urls?.find(isImg) ?? ev.media_urls?.[0]
    const r = resolveMedia(m ?? null)
    return r && isImg(r) ? r : null
  }

  const isDone = step >= QUIZ.length
  const current = isDone ? null : QUIZ[step]

  // Tally categories across answered questions
  const tally = useMemo(() => {
    const t: Record<string, number> = {}
    answers.forEach((aIdx, qIdx) => {
      if (aIdx == null) return
      const opt = QUIZ[qIdx].opts[aIdx]
      opt.cats.forEach((k) => { t[k] = (t[k] || 0) + 1 })
    })
    return t
  }, [answers])

  const inferred = useMemo(
    () =>
      Object.entries(tally)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, n]) => ({ cat: INTEREST_BY_KEY[k], n }))
        .filter((x) => x.cat),
    [tally],
  )

  // Estimated feed size — number of pool events tagged with any inferred category
  const estFeed = useMemo(() => {
    if (inferred.length === 0) return 0
    const keys = new Set(inferred.map((x) => x.cat.key))
    return pool.filter((e) => (e.tags ?? []).some((t) => keys.has(t))).length
  }, [inferred, pool])

  const pickOption = (oIdx: number) => {
    const next = [...answers]
    next[step] = oIdx
    setAnswers(next)
    setTimeout(() => setStep((s) => s + 1), 280)
  }

  const reset = () => { setStep(0); setAnswers([]) }

  const finish = async () => {
    const keys = inferred.map((x) => x.cat.key)
    setInterests(keys)
    try { await Curator.setInterests(keys) } catch { /* */ }
    navigate({ to: "/pipe-feed-swipe" })
  }

  const todayStamp = new Date()
    .toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })
    .replace(/\./g, ".")

  return (
    <Box
      bg={W} color={K}
      position="relative"
      h="100dvh"
      overflow="hidden"
      style={{ fontFamily: "'Helvetica Neue', 'Inter', system-ui, sans-serif" }}
    >
      {/* Dotted bauhaus bg — same recipe as Pipe Landing D / client-path pages */}
      <Box
        position="absolute" inset="0" pointerEvents="none"
        opacity={0.55} zIndex={0}
        style={{
          backgroundImage: "radial-gradient(rgba(13,13,13,0.18) 1px, transparent 1.4px)",
          backgroundSize: "12px 12px",
        }}
      />

      <style>{`
        @keyframes cs-card-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Scrollable content area (PageShell pattern) */}
      <Box
        position="relative" zIndex={1}
        h="100%"
        overflowY="auto"
        overflowX="hidden"
        px="4" pt="4" pb="110px"
        sx={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
        }}
      >
        {/* Editorial header */}
        <Flex justify="space-between" align="center" pb="2" mb="2" borderBottom={`2px solid ${K}`}>
          <Flex
            as="button"
            onClick={() => navigate({ to: "/pipe-landing-v1" })}
            align="center" gap="1.5" cursor="pointer"
            fontSize="11px" fontWeight="900" letterSpacing="0.1em" textTransform="uppercase" color={B}
            style={{ background: "none", border: "none", padding: 0 }}
          >
            <Text fontSize="14px" lineHeight="1">←</Text> Назад
          </Flex>
          <Box bg={K} color={W} px="2.5" py="1" fontSize="10px" fontWeight="900" letterSpacing="0.18em" textTransform="uppercase">
            Анкета
          </Box>
        </Flex>

        <Flex justify="space-between" align="flex-end" mb="2">
          <Mark color={G55}>Section / Анкета</Mark>
          <Mark color={G55}>{QUIZ.length} шага</Mark>
        </Flex>

        <Box pb="1">
          <Text fontWeight="900" fontSize="40px" lineHeight="0.86" letterSpacing="-0.045em" textTransform="uppercase" color={K}>
            {isDone ? "Готово." : "Анкета."}
          </Text>
          <Text fontWeight="900" fontSize="40px" lineHeight="0.86" letterSpacing="-0.045em" textTransform="uppercase" color={B} ml="3.5">
            {isDone ? "Лента" : "4 шага"}
          </Text>
        </Box>
        <Text fontWeight="700" fontSize="12.5px" lineHeight="1.4" color={G55} mt="2.5" mb="4">
          {isDone ? (
            <>Вот <Text as="span" color={K} fontWeight="900">что выходит</Text> из твоих ответов. Можно править.</>
          ) : (
            <>Выбери по одной карточке. Лента <Text as="span" color={K} fontWeight="900">соберётся сама</Text>.</>
          )}
        </Text>

        {!isDone && current ? (
          <>
            {/* Question header */}
            <Flex
              justify="space-between" align="center"
              pb="1.5" mb="3"
              borderBottom={`2px solid ${K}`}
            >
              <Mark>{current.qShort}</Mark>
              <Mark color={G55}>Выбери одно</Mark>
            </Flex>
            <Text
              fontWeight="900" fontSize="22px" lineHeight="1"
              letterSpacing="-0.025em" textTransform="uppercase" color={K} mb="3.5"
              style={{ animation: "cs-card-in 0.32s cubic-bezier(0.22,1,0.36,1) both" }}
            >
              {current.q}
            </Text>

            {/* 2x2 option grid */}
            <Box
              key={step}
              display="grid"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gap: "9px",
                animation: "cs-card-in 0.32s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              {current.opts.map((opt, i) => (
                <QuizOption
                  key={i}
                  opt={opt}
                  idx={i}
                  selected={answers[step] === i}
                  posterUrl={posterFor(opt.cats, step, i)}
                  onClick={() => pickOption(i)}
                />
              ))}
            </Box>
          </>
        ) : (
          /* Receipt-style result */
          <>
            <Box
              border={`2.5px solid ${K}`}
              bg={W}
              style={{ boxShadow: `4px 4px 0 ${B}` }}
              mt="1.5"
            >
              <Flex
                px="3.5" py="2.5"
                bg={K} color={W}
                justify="space-between" align="center"
              >
                <Text fontWeight="900" fontSize="11px" letterSpacing="0.18em" textTransform="uppercase" color={W} lineHeight="1">
                  Результат
                </Text>
                <Text
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  fontSize="10px" color={W}
                >
                  ID 0001 · {todayStamp}
                </Text>
              </Flex>
              <Box px="3.5" pt="3.5" pb="4">
                <Mark color={G55}>Твои сигналы</Mark>
                <Flex direction="column" gap="1.5" mt="2.5">
                  {inferred.length === 0 ? (
                    <Text fontWeight="700" fontSize="12px" color={G55}>
                      Ничего не зацепило. Можно пройти заново.
                    </Text>
                  ) : (
                    inferred.map((x, j) => (
                      <Box
                        key={x.cat.key}
                        display="grid"
                        alignItems="baseline"
                        pb="1.5"
                        style={{
                          gridTemplateColumns: "24px 1fr auto",
                          gap: "10px",
                          borderBottom: `1px dotted ${G35}`,
                        }}
                      >
                        <Text
                          fontFamily="'JetBrains Mono', ui-monospace, monospace"
                          fontSize="10px" color={G55}
                        >
                          {String(j + 1).padStart(2, "0")}
                        </Text>
                        <Text
                          fontWeight="900" fontSize="18px"
                          letterSpacing="-0.025em" textTransform="uppercase"
                        >
                          {x.cat.label}
                        </Text>
                        <Text
                          fontFamily="'JetBrains Mono', ui-monospace, monospace"
                          fontSize="10px" color={B}
                        >
                          ×{x.n}
                        </Text>
                      </Box>
                    ))
                  )}
                </Flex>
                <Flex
                  mt="3" pt="2"
                  borderTop={`2px solid ${K}`}
                  justify="space-between"
                  align="baseline"
                >
                  <Text fontWeight="900" fontSize="14px" textTransform="uppercase" letterSpacing="-0.02em">
                    В ленте
                  </Text>
                  <Text fontWeight="900" fontSize="22px" color={B} letterSpacing="-0.04em" lineHeight="1">
                    {estFeed} ивентов
                  </Text>
                </Flex>
              </Box>
            </Box>
            <Flex
              as="button" onClick={reset}
              mt="3" w="100%"
              cursor="pointer"
              fontWeight="900" fontSize="11px" letterSpacing="0.18em" textTransform="uppercase"
              p="2.5"
              border={`2px solid ${K}`}
              bg={W} color={K}
              align="center" justify="center"
            >
              ↻ Заново
            </Flex>
          </>
        )}
      </Box>

      {/* Footer — progress dots + back during quiz; finish CTA on result */}
      {!isDone ? (
        <Flex
          position="absolute" left="0" right="0" bottom="0"
          zIndex={20}
          bg={W} borderTop={`2.5px solid ${K}`}
          align="center" justify="space-between" gap="3"
          style={{
            paddingTop: "12px",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
          <Box>
            <Mark color={G55}>Анкета</Mark>
            <Flex gap="1" mt="1.5">
              {QUIZ.map((_, idx) => (
                <Box
                  key={idx}
                  w="22px" h="5px"
                  bg={idx < step ? K : idx === step ? B : G18}
                />
              ))}
            </Flex>
          </Box>
          <Flex
            as="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            cursor={step === 0 ? "not-allowed" : "pointer"}
            opacity={step === 0 ? 0.5 : 1}
            fontWeight="900" fontSize="11px" letterSpacing="0.16em" textTransform="uppercase"
            px="3.5" py="2.5"
            border={`2px solid ${K}`}
            bg={W} color={step === 0 ? G35 : K}
            align="center" justify="center"
            style={{ pointerEvents: step === 0 ? "none" : "auto" }}
          >
            ← Назад
          </Flex>
        </Flex>
      ) : (
        <Flex
          position="absolute" left="0" right="0" bottom="0"
          zIndex={20}
          bg={W} borderTop={`2.5px solid ${K}`}
          align="center" gap="3"
          style={{
            paddingTop: "12px",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
          <Box flex="1" minW="0">
            <Mark color={G55}>В твоей ленте</Mark>
            <Flex align="baseline" gap="1.5" mt="1">
              <Text fontWeight="900" fontSize="28px" color={K} lineHeight="1" letterSpacing="-0.03em">
                {inferred.length}
              </Text>
              <Text fontWeight="800" fontSize="11px" color={G55}>
                кат. · {estFeed} ивентов
              </Text>
            </Flex>
          </Box>
          <Flex
            as="button" onClick={finish}
            align="center" gap="2.5"
            cursor={inferred.length > 0 ? "pointer" : "not-allowed"}
            fontWeight="900" fontSize="14px" letterSpacing="0.05em" textTransform="uppercase"
            border={`3px solid ${K}`}
            bg={inferred.length > 0 ? K : W} color={inferred.length > 0 ? W : G55}
            px="4" py="3.25"
            opacity={inferred.length > 0 ? 1 : 0.6}
            style={{
              boxShadow: inferred.length > 0 ? `3px 3px 0 ${B}` : "none",
              pointerEvents: inferred.length > 0 ? "auto" : "none",
            }}
            _active={{ transform: "translate(2px, 2px)" }}
            transition="all 0.12s"
          >
            <Text as="span">Открыть</Text>
            <Text as="span" fontSize="18px" lineHeight="1">→</Text>
          </Flex>
        </Flex>
      )}
    </Box>
  )
}
