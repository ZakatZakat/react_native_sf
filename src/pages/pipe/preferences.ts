import { useEffect, useState } from "react"
import type { EventCard } from "./shared"

const INTERESTS_KEY = "pipe.interests.v1"
const ONBOARDED_KEY = "pipe.onboarded.v1"
const CHANGE_EVENT = "pipe:interests-changed"

export type Interest = {
  key: string
  label: string
  symbol: string
  keywords: string[]
}

export const INTERESTS: Interest[] = [
  {
    key: "contemporary",
    label: "Современное искусство",
    symbol: "◤",
    keywords: [
      "совр", "contemporary", "художни", "художниц", "куратор",
      "арт-объект", "арт-проект", "видеоискусств",
      "авангард", "неоавангард", "концептуал", "минимализм",
      "резиденц", "мастерская художни",
    ],
  },
  {
    key: "cinema",
    label: "Кино",
    symbol: "▶",
    keywords: [
      "кино", "фильм", "кинопоказ", "кинопрограмм", "кинокритик", "киноцикл",
      "киновед", "видеоискусств", "показ", "просмотр", "screening", "режис",
      "cinema", "док", "q&a", "комеди", "триллер", "сценарист",
    ],
  },
  {
    key: "theatre",
    label: "Театр",
    symbol: "◐",
    keywords: ["театр", "спектакл", "пьес", "постановк", "сцена ", "сцены ", "режисс"],
  },
  {
    key: "performance",
    label: "Перформанс",
    symbol: "◆",
    keywords: [
      "перформ", "performance", "акци", "хеппенинг", "процесс",
      "перформанс-наблюден", "аудиальн", "звуков ландшафт", "хореограф",
    ],
  },
  {
    key: "exhibition",
    label: "Выставки",
    symbol: "▢",
    keywords: [
      "выстав", "галере", "экспоз", "биенналь", "вернисаж",
      "инсталляц", "экспонат", "архив", "медиаархив",
      "коллекци", "тур по экспозиции", "медиаци",
    ],
  },
  {
    key: "literature",
    label: "Литература",
    symbol: "▤",
    keywords: [
      "литер", "книг", "поэз", "поэт", "поэтес", "поэтическ", "поэтическ чтен",
      "стих", "проза", "чтени", "автор", "авторок", "самиздат",
      "лауреат", "роман", "эссе", "презентац книги",
    ],
  },
  {
    key: "music",
    label: "Музыка",
    symbol: "♪",
    keywords: [
      "концерт", "музык", "live", "gig", "оркест", "хор", "опер", "симфон",
      "панк-рок", "джаз", "электрон", "рейв", "rave", "dj", "саундтрек",
      "клуб", "вечеринк",
    ],
  },
  {
    key: "dance",
    label: "Танец",
    symbol: "※",
    keywords: [
      "танец", "танц", "балет", "хореогр", "contemporary dance",
      "перформанс-наблюден", "движени", "пластик",
    ],
  },
  {
    key: "photo",
    label: "Фотография",
    symbol: "◳",
    keywords: [
      "фото", "photo", "снимк", "репортаж", "фотовыставк", "фотограф",
    ],
  },
  {
    key: "architecture",
    label: "Архитектура",
    symbol: "▲",
    keywords: [
      "архитект", "урбан", "город", "здани", "пространств", "парк",
      "вднх", "наркомфин", "дом ", "квартир", "ленинград", "петербург",
    ],
  },
  {
    key: "design",
    label: "Дизайн",
    symbol: "◎",
    keywords: [
      "дизайн", "график", "плакат", "иллюстр", "design", "тип",
      "зин", "коллаж", "книга художни", "шрифт", "верстк",
    ],
  },
  {
    key: "talks",
    label: "Лекции",
    symbol: "¶",
    keywords: [
      "лекц", "лектор", "talk", "дискус", "круглый стол", "встреч",
      "обсужден", "беседа", "презентац", "разбор", "семинар",
      "мастер-класс", "воркшоп", "workshop", "медиаци", "конференц",
      "серия встреч", "куратор расскажет", "поговорят",
    ],
  },
  {
    // Games + community gatherings + markets — social events without an arts home.
    key: "community",
    label: "Игры и сообщество",
    symbol: "▦",
    keywords: [
      "настольн", "настолк", "мафия", "ролев", "квиз", "квест", "игротек",
      "board game", "нетворкинг", "networking", "спид-дейтинг",
      "разговорн клуб", "разговорный клуб", "сходка",
      "маркет", "барахолк", "фримаркет", "блошин", "своп ",
    ],
  },
]

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    /* ignore */
  }
}

export function getInterests(): string[] {
  return readJSON<string[]>(INTERESTS_KEY, [])
}

export function setInterests(keys: string[]) {
  writeJSON(INTERESTS_KEY, keys)
  try {
    localStorage.setItem(ONBOARDED_KEY, "1")
  } catch {
    /* */
  }
}

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1"
  } catch {
    return false
  }
}

export function useInterests() {
  const [interests, setInterestsState] = useState<string[]>(() => getInterests())
  useEffect(() => {
    const onChange = () => setInterestsState(getInterests())
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])
  return interests
}

export function scoreEvent(card: EventCard, interestKeys: string[]): number {
  if (interestKeys.length === 0) return 0
  const text = `${card.title ?? ""}\n${card.description ?? ""}\n${card.channel ?? ""}`.toLowerCase()
  let score = 0
  for (const key of interestKeys) {
    const interest = INTERESTS.find((i) => i.key === key)
    if (!interest) continue
    for (const kw of interest.keywords) {
      if (text.includes(kw.toLowerCase())) {
        score += 1
        break
      }
    }
  }
  return score
}

export function rankEvents(events: EventCard[], interestKeys: string[]): EventCard[] {
  if (interestKeys.length === 0) return events
  const scored = events.map((ev) => ({ ev, s: scoreEvent(ev, interestKeys), r: Math.random() }))
  scored.sort((a, b) => b.s - a.s || a.r - b.r)
  return scored.map((x) => x.ev)
}
