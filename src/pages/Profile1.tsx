import * as React from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"

type Category = {
  key: string
  label: string
  icon: string
  description: string
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
const drift = keyframes`
  0% { transform: translateY(0) translateX(0); }
  50% { transform: translateY(-10px) translateX(6px); }
  100% { transform: translateY(0) translateX(0); }
`

const categories: Category[] = [
  { key: "concerts", label: "Концерты", icon: "🎸", description: "Живые выступления" },
  { key: "party", label: "Вечеринки", icon: "🎧", description: "Ночные события" },
  { key: "theatre", label: "Театр", icon: "🎭", description: "Спектакли и сцена" },
  { key: "exhibition", label: "Выставки", icon: "🖼️", description: "Галереи и музеи" },
  { key: "lecture", label: "Лекции", icon: "🎤", description: "Talks и встречи" },
  { key: "cinema", label: "Кино", icon: "🎬", description: "Показы и премьеры" },
  { key: "festival", label: "Фестивали", icon: "🎪", description: "Большие программы" },
  { key: "kids", label: "Детям", icon: "🧸", description: "Семейные события" },
  { key: "sport", label: "Спорт", icon: "🏃", description: "Активности и матчи" },
  { key: "food", label: "Еда", icon: "🍜", description: "Маркет и фуд-зоны" },
  { key: "travel", label: "Путешествия", icon: "✈️", description: "Поездки и туры" },
  { key: "art", label: "Арт", icon: "🎨", description: "Современное искусство" },
]

export default function Profile1() {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const orderedSelected = React.useMemo(
    () => categories.filter((c) => selected.has(c.key)),
    [selected],
  )
  const floatingPool = React.useMemo(
    () => categories.filter((c) => !selected.has(c.key)),
    [selected],
  )

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
    <Box minH="100dvh" bg="#FFFFFF" color={PRIMARY} position="relative" overflow="hidden">
      <Stack maxW="420px" mx="auto" px="4" pt="6" pb="10" gap="4" position="relative" zIndex={2}>
        {orderedSelected.length > 0 ? (
          <Box
            border={`1px solid ${PRIMARY_BORDER}`}
            borderRadius="xl"
            bg="white"
            px="4"
            py="3"
            boxShadow="0 10px 22px rgba(45,42,140,0.10)"
          >
            <Text fontSize="sm" fontWeight="semibold" mb="2">
              Вы выбрали
            </Text>
            <Flex wrap="wrap" gap="2">
              {orderedSelected.map((cat) => (
                <Box
                  key={`selected-${cat.key}`}
                  borderRadius="full"
                  border={`1px solid ${PRIMARY_BORDER}`}
                  bg="white"
                  px="3"
                  py="1.5"
                  display="flex"
                  alignItems="center"
                  gap="2"
                  cursor="pointer"
                  onClick={() => toggle(cat.key)}
                  role="button"
                  aria-pressed="true"
                >
                  <Box
                    width="20px"
                    height="20px"
                    borderRadius="full"
                    bg={PRIMARY_SOFT}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="11px"
                    border={`1px solid ${PRIMARY_BORDER}`}
                  >
                    {cat.icon}
                  </Box>
                  <Text fontSize="xs" fontWeight="semibold">
                    {cat.label}
                  </Text>
                </Box>
              ))}
            </Flex>
          </Box>
        ) : null}

      </Stack>

      <Box position="absolute" top="140px" left="0" right="0" bottom="0" opacity={0.85} zIndex={0}>
        {floatingPool.map((item, idx) => {
          const pos = floatingPositions[idx % floatingPositions.length]
          return (
          <Box
            key={`float-${item.key}-${idx}`}
            position="absolute"
            top={pos.top}
            left={pos.left}
            width={pos.width}
            bg="white"
            border={`1px solid ${PRIMARY_BORDER}`}
            borderRadius="2xl"
            px="3"
            py="2.5"
            animation={`${drift} ${pos.duration}s ease-in-out ${pos.delay}s infinite`}
            boxShadow="0 10px 22px rgba(45,42,140,0.10)"
            cursor="pointer"
            onClick={() => toggle(item.key)}
            role="button"
            aria-pressed={selected.has(item.key)}
          >
            <Stack gap="1">
              <Flex align="center" gap="2">
                <Box
                  width="26px"
                  height="26px"
                  borderRadius="full"
                  bg={PRIMARY_SOFT}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="14px"
                  border={`1px solid ${PRIMARY_BORDER}`}
                >
                  {item.icon}
                </Box>
                <Text fontSize="xs" fontWeight="semibold">
                  {item.label}
                </Text>
              </Flex>
              <Text fontSize="10px" color="rgba(45,42,140,0.7)">
                {item.description}
              </Text>
            </Stack>
          </Box>
          )
        })}
      </Box>
      <Stack maxW="420px" mx="auto" px="4" pt="6" pb="10" gap="5" position="relative" />
    </Box>
  )
}

const floatingPositions = [
  { top: "12%", left: "8%", width: "150px", duration: 7.2, delay: 0.3 },
  { top: "20%", left: "40%", width: "150px", duration: 8.4, delay: 0.6 },
  { top: "30%", left: "12%", width: "160px", duration: 6.8, delay: 0.1 },
  { top: "36%", left: "44%", width: "165px", duration: 9.1, delay: 0.4 },
  { top: "48%", left: "18%", width: "150px", duration: 7.6, delay: 0.2 },
  { top: "56%", left: "46%", width: "160px", duration: 8.8, delay: 0.5 },
  { top: "68%", left: "14%", width: "165px", duration: 7.4, delay: 0.7 },
  { top: "74%", left: "46%", width: "150px", duration: 6.9, delay: 0.3 },
]
