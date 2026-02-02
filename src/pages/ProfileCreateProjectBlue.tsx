import * as React from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { ProjectBluePage, projectBlueTheme } from "../components/project_blue"

const FUNNY_NAMES = [
  "Космический Огурец",
  "Сэр Пельмень",
  "Доктор Котлета",
  "Граф Бутерброд",
  "Капитан Подушка",
  "Барон Сырник",
  "Принцесса Вафля",
  "Рыцарь Пельмешка",
  "Лорд Пирожок",
  "Магистр Пончик",
  "Герцог Блинович",
  "Король Кофе",
]

function randomFunnyName(): string {
  return FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)]
}

export default function ProfileCreateProjectBlue() {
  const { ink, inkMuted, accent } = projectBlueTheme
  const [name, setName] = React.useState("")

  const generateName = () => {
    setName(randomFunnyName())
  }

  return (
    <ProjectBluePage pt="6" pb="8" gap="0">
      <Flex
        direction="column"
        minH="85dvh"
        justify="space-between"
      >
        <Box position="relative">
          <Flex justify="center" align="center" py="8">
            <Box position="relative">
              <Box
                width="140px"
                height="140px"
                borderRadius="full"
                position="relative"
                overflow="hidden"
                border={`3px solid ${ink}`}
                boxShadow={`0 0 0 1px ${accent}40, inset 0 0 40px ${accent}30`}
                style={{
                  background: `radial-gradient(circle at 30% 30%, #3399FF, ${accent} 40%, #0044AA 100%)`,
                }}
              >
                <Box
                  position="absolute"
                  inset="12px"
                  borderRadius="full"
                  border={`1px solid ${accent}60`}
                />
                <Box
                  position="absolute"
                  inset="24px"
                  borderRadius="full"
                  border={`1px solid ${ink}20`}
                />
                <Flex
                  position="absolute"
                  inset="0"
                  align="center"
                  justify="center"
                  gap="4px"
                  opacity={0.4}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Box
                      key={i}
                      width="3px"
                      height="3px"
                      borderRadius="full"
                      bg={ink}
                    />
                  ))}
                </Flex>
              </Box>
              <Box
                position="absolute"
                top="-8px"
                right="-8px"
                width="24px"
                height="24px"
                borderRadius="full"
                bg={accent}
                border={`2px solid ${ink}`}
                opacity={0.8}
              />
              <Box
                position="absolute"
                bottom="-4px"
                left="-4px"
                width="16px"
                height="16px"
                borderRadius="full"
                bg={ink}
                opacity={0.3}
              />
            </Box>
          </Flex>

          <Box
            position="absolute"
            top="40px"
            left="-20px"
            width="80px"
            height="80px"
            borderRadius="full"
            bg={`${accent}15`}
            border={`20px solid ${accent}20`}
          />
          <Box
            position="absolute"
            bottom="80px"
            right="-30px"
            width="100px"
            height="100px"
            borderRadius="full"
            bg={`${accent}10`}
            border={`25px solid ${accent}15`}
          />
        </Box>

        <Stack gap="6" flex="1" justify="center" py="8">
          <Text
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="0.15em"
            textTransform="uppercase"
            color={accent}
          >
            Укажи имя
          </Text>
          <Box
            as="input"
            type="text"
            placeholder="Введите имя"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            width="100%"
            px="4"
            py="4"
            border={`2px solid ${ink}`}
            borderRadius="xl"
            bg="transparent"
            color={ink}
            fontSize="md"
            fontWeight="semibold"
            _placeholder={{ color: inkMuted }}
            _focus={{ outline: "none", borderColor: accent }}
          />
          <Flex
            as="button"
            align="center"
            justify="center"
            gap="2"
            px="4"
            py="3"
            border={`2px solid ${ink}`}
            borderRadius="xl"
            bg="transparent"
            color={ink}
            fontWeight="bold"
            fontSize="sm"
            letterSpacing="0.05em"
            cursor="pointer"
            _hover={{ bg: ink, color: "white" }}
            transition="all 0.2s"
            onClick={generateName}
          >
            Сгенерировать смешное имя
          </Flex>
        </Stack>
      </Flex>
    </ProjectBluePage>
  )
}
