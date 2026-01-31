import * as React from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"

type Interest = {
  key: string
  label: string
  icon: string
}

const PRIMARY = "#2D2A8C"
const PRIMARY_BORDER = "rgba(45,42,140,0.2)"
const CHIP_BG = "rgba(45,42,140,0.08)"
const POP = keyframes`
  0% { transform: scale(1); }
  40% { transform: scale(1.12); }
  100% { transform: scale(1); }
`
const FLY_TO_SELECTED = keyframes`
  0% { transform: translateY(0) scale(1); opacity: 1; }
  60% { transform: translateY(-22px) scale(1.06); opacity: 0.7; }
  100% { transform: translateY(-36px) scale(0.92); opacity: 0.2; }
`

const interests: Interest[] = [
  { key: "cooking", label: "Cooking", icon: "🍳" },
  { key: "running", label: "Running", icon: "🏃" },
  { key: "meditation", label: "Meditation", icon: "🧘" },
  { key: "dancing", label: "Dancing", icon: "💃" },
  { key: "museums", label: "Museums", icon: "🏛️" },
  { key: "crafting", label: "Crafting", icon: "🧵" },
  { key: "flying", label: "Flying", icon: "✈️" },
  { key: "blogging", label: "Blogging", icon: "📝" },
  { key: "arcade", label: "Arcade", icon: "🕹️" },
  { key: "kites", label: "Kites", icon: "🪁" },
  { key: "concerts", label: "Concerts", icon: "🎸" },
  { key: "shopping", label: "Shopping", icon: "🛒" },
  { key: "knitting", label: "Knitting", icon: "🧶" },
  { key: "desserts", label: "Desserts", icon: "🍰" },
  { key: "organizing", label: "Organizing", icon: "🗂️" },
  { key: "telescopes", label: "Telescopes", icon: "🔭" },
  { key: "science", label: "Science", icon: "🔬" },
]

export default function Profile2() {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [justSelected, setJustSelected] = React.useState<string | null>(null)

  const select = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    setJustSelected(key)
  }

  const clearAll = () => {
    setSelected(new Set())
    setJustSelected(null)
  }

  return (
    <Box minH="100dvh" bg="#FFFFFF" color={PRIMARY}>
      <Stack maxW="440px" mx="auto" px="4" pt="6" pb="12" gap="6">
        <Text fontSize="2xl" fontWeight="semibold" letterSpacing="-0.2px">
          Interests
        </Text>

        <Box overflowX="auto" pb="2">
          <Flex
            wrap="wrap"
            gap="10px"
            minW="560px"
            pr="6"
          >
            {interests
              .filter((i) => !selected.has(i.key) || justSelected === i.key)
              .map((item) => {
              const active = selected.has(item.key)
              const isFlying = justSelected === item.key
              return (
                <Box
                  key={item.key}
                  borderRadius="full"
                  border={`1px solid ${PRIMARY_BORDER}`}
                  bg={active ? "white" : CHIP_BG}
                  px="3"
                  py="2"
                  display="flex"
                  alignItems="center"
                  gap="2"
                  cursor="pointer"
                  onClick={() => select(item.key)}
                  role="button"
                  aria-pressed={active}
                  boxShadow={active ? "0 10px 22px rgba(45,42,140,0.12)" : "none"}
                  animation={
                    isFlying ? `${FLY_TO_SELECTED} 520ms ease-out` : active ? `${POP} 420ms ease-out` : undefined
                  }
                  onAnimationEnd={() => {
                    if (isFlying) {
                      setJustSelected(null)
                    }
                  }}
                >
                  <Text fontSize="sm">{item.icon}</Text>
                  <Text fontSize="sm" fontWeight="semibold" color="#2B2B2B">
                    {item.label}
                  </Text>
                </Box>
              )
            })}
          </Flex>
        </Box>

        <Flex align="center" justify="center" gap="3">
          <Box
            borderRadius="full"
            border={`1px solid ${PRIMARY_BORDER}`}
            bg="white"
            px="6"
            py="2.5"
            boxShadow="0 12px 26px rgba(45,42,140,0.12)"
          >
            <Text fontSize="sm" fontWeight="semibold" color="#5A5A5A">
              {selected.size} Interests
            </Text>
          </Box>
          <Box
            borderRadius="full"
            border={`1px solid ${PRIMARY_BORDER}`}
            bg="white"
            px="5"
            py="2.5"
            cursor="pointer"
            onClick={clearAll}
            boxShadow="0 12px 26px rgba(45,42,140,0.12)"
          >
            <Text fontSize="sm" fontWeight="semibold" color={PRIMARY}>
              Clean
            </Text>
          </Box>
        </Flex>
      </Stack>
    </Box>
  )
}
