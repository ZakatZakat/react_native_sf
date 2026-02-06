import { useState } from "react"
import { Box, Flex, Stack, Text } from "@chakra-ui/react"
import { PageWipe, OpusFooter } from "./opus/shared"

const W = "#FFFFFF"
const B = "#0055FF"
const BM = "rgba(0,85,255,0.45)"
const BL = "rgba(0,85,255,0.12)"
const BD = "#003ACC"

function Dots({ n, size, gap, color, opacity }: { n: number; size: number; gap: number; color: string; opacity: number }) {
  return (
    <Flex gap={`${gap}px`} opacity={opacity}>
      {Array.from({ length: n }).map((_, i) => (
        <Box key={i} w={`${size}px`} h={`${size}px`} borderRadius="full" bg={color} />
      ))}
    </Flex>
  )
}

const CATEGORIES = ["Концерты", "Искусство", "Кино", "DJ Сеты", "Лекции"] as const

export default function OpusExampleOnlyBlue() {
  const [active, setActive] = useState(0)

  return (
    <Box minH="100dvh" bg={W} color={B} position="relative" overflow="hidden">
      <PageWipe primary={B} secondary={BD} />

      <Stack maxW="430px" mx="auto" px="6" pt="14" pb="20" gap="0" position="relative" zIndex={1}>

        {/* — HEADER — */}
        <Flex
          align="center" justify="space-between" pb="16"
          className="p5-drop" style={{ animationDelay: "0.3s" }}
        >
          <Flex align="center" gap="3">
            <Box w="32px" h="32px" borderRadius="full" bg={B} />
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.25em" textTransform="uppercase">
              Opus
            </Text>
          </Flex>
          <Flex direction="column" gap="2px" cursor="pointer">
            <Box w="20px" h="2px" bg={B} />
            <Box w="14px" h="2px" bg={B} />
          </Flex>
        </Flex>

        {/* — HERO — */}
        <Box pb="14" position="relative">
          <Text
            fontSize="72px"
            fontWeight="900"
            lineHeight="0.88"
            letterSpacing="-0.04em"
            textTransform="uppercase"
            className="p5-drop" style={{ animationDelay: "0.4s" }}
          >
            Отк
            <br />
            рой
            <Text as="span" color={BD}>!</Text>
          </Text>

          <Box
            position="absolute" top="0" right="0"
            className="p5-drop" style={{ animationDelay: "0.55s" }}
          >
            <Box
              w="90px" h="90px" borderRadius="full"
              border={`3px solid ${B}`}
              position="relative"
            >
              <Box position="absolute" inset="12px" borderRadius="full" bg={B} />
              <Box position="absolute" inset="24px" borderRadius="full" bg={W} />
              <Box position="absolute" inset="32px" borderRadius="full" bg={BD} />
            </Box>
          </Box>

          <Text
            fontSize="11px"
            fontWeight="600"
            letterSpacing="0.14em"
            textTransform="uppercase"
            color={BM}
            mt="6"
            maxW="220px"
            lineHeight="1.6"
            className="p5-drop" style={{ animationDelay: "0.5s" }}
          >
            Лучшие события в твоём городе.
            <br />
            Каждую неделю. Без шума.
          </Text>
        </Box>

        {/* — FEATURED BLOCK — */}
        <Box
          className="p5-reveal p5-visible-left"
          style={{ animationDelay: "0.6s" }}
        >
          <Box
            border={`3px solid ${B}`}
            position="relative"
            mb="10"
            style={{ transform: "rotate(-0.8deg)" }}
          >
            <Box bg={B} px="5" py="4" position="relative" overflow="hidden">
              <Box
                position="absolute" top="-20px" right="-20px"
                w="80px" h="80px" borderRadius="full" bg={`${W}20`}
              />
              <Flex direction="column" gap="6px" position="absolute" top="14px" right="14px">
                <Dots n={4} size={3} gap={5} color={`${W}40`} opacity={1} />
                <Dots n={4} size={3} gap={5} color={`${W}40`} opacity={1} />
                <Dots n={4} size={3} gap={5} color={`${W}40`} opacity={1} />
              </Flex>
              <Text fontSize="10px" fontWeight="700" letterSpacing="0.2em" textTransform="uppercase" color={`${W}90`}>
                Рекомендуем
              </Text>
              <Text fontSize="28px" fontWeight="900" color={W} lineHeight="1.05" mt="2" textTransform="uppercase" maxW="240px">
                Белая
                <br />
                Ночь
                <Text as="span" color={`${W}70`}> ′26</Text>
              </Text>
            </Box>

            <Flex bg={W} px="5" py="4" justify="space-between" align="center">
              <Stack gap="0">
                <Text fontSize="10px" fontWeight="700" letterSpacing="0.15em" textTransform="uppercase" color={BM}>
                  14 — 15 фев
                </Text>
                <Text fontSize="10px" fontWeight="600" letterSpacing="0.08em" color={BM} mt="1px">
                  Москва · Разные площадки
                </Text>
              </Stack>
              <Flex
                bg={B} color={W} px="4" py="2"
                fontSize="10px" fontWeight="800" letterSpacing="0.15em" textTransform="uppercase"
                cursor="pointer" _hover={{ opacity: 0.85 }} transition="opacity 0.15s"
              >
                Пойду →
              </Flex>
            </Flex>

            <Box
              position="absolute" bottom="-8px" left="20px"
              w="16px" h="16px" borderRadius="full"
              border={`2px solid ${B}`}
            />
          </Box>
        </Box>

        {/* — CATEGORIES — */}
        <Box pb="10" className="p5-drop" style={{ animationDelay: "0.7s" }}>
          <Box h="1px" bg={BL} mb="5" />
          <Flex gap="0" flexWrap="wrap">
            {CATEGORIES.map((c, i) => (
              <Flex
                key={c}
                onClick={() => setActive(i)}
                cursor="pointer"
                px="4" py="2"
                border={`2px solid ${i === active ? B : BL}`}
                bg={i === active ? B : "transparent"}
                color={i === active ? W : B}
                fontSize="10px"
                fontWeight="800"
                letterSpacing="0.15em"
                textTransform="uppercase"
                transition="all 0.15s"
                mr="-2px"
                mb="-2px"
                className={i === active ? "p5-tab-pop" : undefined}
              >
                {c}
              </Flex>
            ))}
          </Flex>
          <Box h="1px" bg={BL} mt="5" />
        </Box>

        {/* — STAT CARDS — */}
        <Flex gap="4" pb="10">
          {[
            { label: "События", value: "127", sub: "в этом месяце" },
            { label: "Площадки", value: "34", sub: "в Москве" },
          ].map((card, i) => (
            <Box
              key={card.label}
              flex="1"
              className={`p5-reveal ${i === 0 ? "p5-visible-left" : "p5-visible-right"}`}
              style={{ animationDelay: `${0.8 + i * 0.12}s` }}
            >
              <Box
                border={`2.5px solid ${B}`}
                p="5"
                position="relative"
                style={{ transform: `rotate(${i === 0 ? -1.2 : 1.5}deg)` }}
              >
                <Text fontSize="10px" fontWeight="800" letterSpacing="0.18em" textTransform="uppercase" color={BD}>
                  {card.label}
                </Text>
                <Text fontSize="42px" fontWeight="900" lineHeight="1" mt="1" letterSpacing="-0.03em" color={B}>
                  {card.value}
                </Text>
                <Text fontSize="10px" color={BM} fontWeight="600" mt="1" letterSpacing="0.04em">
                  {card.sub}
                </Text>
                {i === 0 && (
                  <Box position="absolute" top="-7px" right="-7px" w="14px" h="14px" borderRadius="full" bg={B} />
                )}
              </Box>
            </Box>
          ))}
        </Flex>

        {/* — CTA — */}
        <Box
          className="p5-reveal p5-visible-left"
          style={{ animationDelay: "1s" }}
        >
          <Flex
            as="button"
            align="center"
            justify="center"
            gap="3"
            bg={B}
            color={W}
            py="5"
            fontWeight="900"
            fontSize="13px"
            letterSpacing="0.18em"
            textTransform="uppercase"
            cursor="pointer"
            width="100%"
            _hover={{ opacity: 0.88 }}
            transition="opacity 0.15s"
            position="relative"
            overflow="hidden"
          >
            <Box position="absolute" left="-10px" top="-10px" w="50px" h="50px" borderRadius="full" bg={`${W}10`} />
            Смотреть все события
            <Text as="span" fontSize="16px">→</Text>
          </Flex>
        </Box>

        {/* — FOOTER — */}
        <Box className="p5-drop" style={{ animationDelay: "1.1s" }}>
          <OpusFooter muted={BM} accent={B} hoverColor={BD} />
        </Box>

      </Stack>
    </Box>
  )
}
