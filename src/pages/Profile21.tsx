import * as React from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"

type Tag = {
  key: string
  label: string
}

const BLUE = "#1D4ED8"
const BLUE_BORDER = "#1D4ED8"
const BG = "#FFFFFF"
const POP = keyframes`
  0% { transform: scale(1); }
  45% { transform: scale(1.08); }
  100% { transform: scale(1); }
`
const FLY_TO_SELECTED = keyframes`
  0% { transform: translateY(0) scale(1); opacity: 1; }
  60% { transform: translateY(-22px) scale(1.06); opacity: 0.7; }
  100% { transform: translateY(-36px) scale(0.92); opacity: 0.2; }
`

const tags: Tag[] = [
  { key: "mplus-stories", label: "Истории M+" },
  { key: "hong-kong", label: "Гонконг" },
  { key: "installation-art", label: "Инсталляции" },
  { key: "emoji-wave", label: "😀👋" },
  { key: "essay", label: "Эссе" },
  { key: "pearl-river-delta", label: "Дельта Жемчужной реки" },
  { key: "analysis", label: "Аналитика" },
  { key: "plants-city", label: "🌿🌳🏢" },
  { key: "venice-biennale", label: "Венецианская биеннале" },
  { key: "conceptual-art", label: "Концептуальное искусство" },
  { key: "curation", label: "Кураторство" },
  { key: "guangdong", label: "Гуандун" },
  { key: "painting", label: "Живопись" },
  { key: "mask-foot", label: "👹🦶" },
  { key: "mplus-building", label: "Здание M+" },
  { key: "animation", label: "Анимация" },
  { key: "conservation", label: "Консервация" },
  { key: "chickens", label: "🐔🐔🐔" },
  { key: "chat", label: "Чат" },
  { key: "interview", label: "Интервью" },
  { key: "canton-express", label: "Кантон Экспресс" },
  { key: "film-palette", label: "🎥🎨" },
  { key: "article", label: "Статья" },
  { key: "mplus-pavilion", label: "Павильон M+" },
  { key: "exhibition-making", label: "Подготовка выставки" },
  { key: "drawing", label: "Рисунок" },
]

export default function Profile21() {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [justSelected, setJustSelected] = React.useState<string | null>(null)

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        setJustSelected(key)
      }
      return next
    })
  }

  const clearAll = () => {
    setSelected(new Set())
    setJustSelected(null)
  }

  return (
    <Box minH="100dvh" bg={BG} color={BLUE}>
      <Flex direction="column" minH="100dvh" px="5" pt="6" pb="10" gap="3">
        <Stack gap="4">
          <Text fontSize="xl" fontWeight="semibold" color="black">
            Интересы
          </Text>
          <Flex wrap="wrap" gap="3">
            {tags
              .filter((t) => !selected.has(t.key) || justSelected === t.key)
              .map((tag) => {
                const active = selected.has(tag.key)
                const isFlying = justSelected === tag.key
                return (
                  <Box
                    key={tag.key}
                    border={`2px solid ${BLUE_BORDER}`}
                    borderRadius="md"
                    px="3"
                    py="2.5"
                    lineHeight="1.2"
                    color={active ? "white" : BLUE}
                    bg={active ? BLUE : "white"}
                    cursor="pointer"
                    onClick={() => toggle(tag.key)}
                    role="button"
                    aria-pressed={active}
                    boxShadow={active ? "0 6px 0 rgba(29,78,216,0.25)" : "0 3px 0 rgba(29,78,216,0.2)"}
                    animation={
                      isFlying ? `${FLY_TO_SELECTED} 520ms ease-out` : active ? `${POP} 420ms ease-out` : undefined
                    }
                    onAnimationEnd={() => {
                      if (isFlying) setJustSelected(null)
                    }}
                  >
                    <Text fontSize="xl" fontWeight="semibold">
                      {tag.label}
                    </Text>
                  </Box>
                )
              })}
          </Flex>
        </Stack>

        <Flex align="center" justify="center" gap="3" mt="2">
          <Box
            borderRadius="full"
            border={`1px solid ${BLUE_BORDER}`}
            bg="white"
            px="6"
            py="2.5"
            boxShadow="0 12px 26px rgba(29,78,216,0.12)"
          >
            <Text fontSize="sm" fontWeight="semibold" color="#5A5A5A">
              Выбрано: {selected.size}
            </Text>
          </Box>
          <Box
            borderRadius="full"
            border={`1px solid ${BLUE_BORDER}`}
            bg="white"
            px="5"
            py="2.5"
            cursor="pointer"
            onClick={clearAll}
            boxShadow="0 12px 26px rgba(29,78,216,0.12)"
          >
            <Text fontSize="sm" fontWeight="semibold" color={BLUE}>
              Очистить
            </Text>
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}
