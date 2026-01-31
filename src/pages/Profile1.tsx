import * as React from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"

type Category = {
  key: string
  label: string
  icon: string
}

const PRIMARY = "#2D2A8C"
const PRIMARY_SOFT = "rgba(45,42,140,0.12)"
const PRIMARY_BORDER = "rgba(45,42,140,0.28)"
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
`
const float = keyframes`
  0% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
  100% { transform: translateY(0); }
`
const wobble = keyframes`
  0% { transform: rotate(0deg) scale(1); }
  25% { transform: rotate(-6deg) scale(1.05); }
  50% { transform: rotate(6deg) scale(1.08); }
  75% { transform: rotate(-4deg) scale(1.04); }
  100% { transform: rotate(0deg) scale(1); }
`
const pop = keyframes`
  0% { transform: scale(1); }
  40% { transform: scale(1.18); }
  100% { transform: scale(1); }
`

const categories: Category[] = [
  { key: "concerts", label: "Концерты", icon: "🎸" },
  { key: "party", label: "Вечеринки", icon: "🎧" },
  { key: "theatre", label: "Театр", icon: "🎭" },
  { key: "exhibition", label: "Выставки", icon: "🖼️" },
  { key: "lecture", label: "Лекции", icon: "🎤" },
  { key: "cinema", label: "Кино", icon: "🎬" },
  { key: "festival", label: "Фестивали", icon: "🎪" },
  { key: "kids", label: "Детям", icon: "🧸" },
  { key: "sport", label: "Спорт", icon: "🏃" },
  { key: "food", label: "Еда", icon: "🍜" },
  { key: "travel", label: "Путешествия", icon: "✈️" },
  { key: "art", label: "Арт", icon: "🎨" },
]

export default function Profile1() {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <Box minH="100dvh" bg="#FFFFFF" color={PRIMARY}>
      <Stack maxW="420px" mx="auto" px="4" pt="6" pb="10" gap="5">
        <Stack gap="2">
          <Text fontSize="2xl" fontWeight="semibold" letterSpacing="-0.2px">
            Выберите категории
          </Text>
          <Text fontSize="sm" color="rgba(45,42,140,0.7)">
            Отметьте темы, которые хотите видеть в ленте.
          </Text>
        </Stack>

        <Flex wrap="wrap" gap="3">
          {categories.map((cat) => {
            const active = selected.has(cat.key)
            const floatDelay = `${(cat.key.length % 5) * 0.12}s`
            const wobbleDelay = `${(cat.key.length % 7) * 0.18}s`
            return (
              <Box
                key={cat.key}
                borderRadius="2xl"
                border={`2px solid ${active ? PRIMARY : PRIMARY_BORDER}`}
                bg={active ? PRIMARY_SOFT : "white"}
                px="3"
                py="3"
                minW="120px"
                flex="1 1 120px"
                cursor="pointer"
                onClick={() => toggle(cat.key)}
                role="button"
                aria-pressed={active}
                transition="transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease"
                _hover={{ transform: "translateY(-4px) scale(1.03)", boxShadow: "0 12px 26px rgba(45,42,140,0.14)" }}
                _active={{ transform: "scale(0.98)" }}
              >
                <Stack gap="2" align="center">
                  <Box
                    width="44px"
                    height="44px"
                    borderRadius="full"
                    bg={active ? "white" : PRIMARY_SOFT}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="22px"
                    border={`1px solid ${PRIMARY_BORDER}`}
                    animation={`${float} 3.6s ease-in-out ${floatDelay} infinite, ${wobble} 4.8s ease-in-out ${wobbleDelay} infinite`}
                    _groupHover={{ animation: `${wobble} 700ms ease-in-out` }}
                  >
                    {cat.icon}
                  </Box>
                  <Text fontSize="xs" fontWeight="semibold" textAlign="center">
                    {cat.label}
                  </Text>
                  {active ? (
                    <Box
                      width="6px"
                      height="6px"
                      borderRadius="full"
                      bg={PRIMARY}
                      animation={`${pulse} 900ms ease-in-out infinite, ${pop} 1.6s ease-in-out infinite`}
                    />
                  ) : null}
                </Stack>
              </Box>
            )
          })}
        </Flex>
      </Stack>
    </Box>
  )
}
