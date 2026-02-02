import * as React from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { projectBlueTheme } from "./theme"
import { ProjectBlueButton } from "./ProjectBlueButton"

export const PROFILE_CATEGORIES = [
  { key: "concerts", label: "Концерты", icon: "🎸" },
  { key: "theatre", label: "Театр", icon: "🎭" },
  { key: "party", label: "Вечеринки", icon: "🎧" },
  { key: "exhibition", label: "Выставки", icon: "🖼️" },
  { key: "lecture", label: "Лекции", icon: "🎤" },
  { key: "kids", label: "Детям", icon: "🧸" },
] as const

export type ProfileCreateData = {
  interests: string[]
  city?: string
}

type ProjectBlueProfileCreateProps = {
  onSubmit?: (data: ProfileCreateData) => void
  initialInterests?: string[]
  showCity?: boolean
}

export function ProjectBlueProfileCreate({
  onSubmit,
  initialInterests = [],
  showCity = false,
}: ProjectBlueProfileCreateProps) {
  const { ink, inkMuted, accent } = projectBlueTheme
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(initialInterests))
  const [city, setCity] = React.useState("")

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

  const handleSubmit = () => {
    onSubmit?.({ interests: Array.from(selected), city: showCity && city.trim() ? city.trim() : undefined })
  }

  return (
    <Stack gap="8">
      <Box>
        <Text
          fontSize="xs"
          fontWeight="bold"
          letterSpacing="0.15em"
          textTransform="uppercase"
          color={accent}
          mb="4"
        >
          Выберите категории
        </Text>
        <Text fontSize="sm" color={inkMuted} lineHeight="1.5" mb="4">
          Отметьте ивенты, которые вам интересны
        </Text>
        <Flex gap="3" wrap="wrap">
          {PROFILE_CATEGORIES.map(({ key, label, icon }) => {
            const isActive = selected.has(key)
            return (
              <Box
                key={key}
                as="button"
                type="button"
                px="4"
                py="3"
                border={`2px solid ${isActive ? accent : ink}`}
                borderRadius="xl"
                bg={isActive ? accent : "transparent"}
                color={isActive ? "white" : ink}
                fontWeight="bold"
                fontSize="sm"
                letterSpacing="0.05em"
                cursor="pointer"
                _hover={{ opacity: 0.9 }}
                transition="all 0.2s"
                onClick={() => toggle(key)}
              >
                {icon} {label}
              </Box>
            )
          })}
        </Flex>
      </Box>

      {showCity && (
        <Box>
          <Text
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="0.15em"
            textTransform="uppercase"
            color={accent}
            mb="3"
          >
            Город
          </Text>
          <Box
            as="input"
            type="text"
            placeholder="Москва"
            value={city}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
            width="100%"
            px="4"
            py="3"
            border={`2px solid ${ink}`}
            borderRadius="xl"
            bg="transparent"
            color={ink}
            fontSize="sm"
            _placeholder={{ color: inkMuted }}
            _focus={{ outline: "none", borderColor: accent }}
          />
        </Box>
      )}

      <ProjectBlueButton onClick={handleSubmit} showFooter={false}>
        Сохранить профиль
      </ProjectBlueButton>
    </Stack>
  )
}
