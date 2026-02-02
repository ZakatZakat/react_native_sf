import * as React from "react"
import { Box, Flex, Image, Text } from "@chakra-ui/react"
import { projectBlueTheme } from "./theme"

type ProjectBlueEventCardProps = {
  imageSrc: string | null
  imageError?: boolean
  onImageError?: () => void
  title: string
  date: string
  onGetTicket?: () => void
  accentOverlay?: boolean
}

export function ProjectBlueEventCard({
  imageSrc,
  imageError,
  onImageError,
  title,
  date,
  onGetTicket,
  accentOverlay = false,
}: ProjectBlueEventCardProps) {
  const { ink, inkMuted, accent } = projectBlueTheme

  return (
    <Box>
      <Box
        width="100%"
        minH="200px"
        aspectRatio="16/10"
        overflow="hidden"
        bg={ink}
        mb="4"
        position="relative"
      >
        {imageSrc && !imageError ? (
          <>
            <Image
              src={imageSrc}
              alt={title}
              width="100%"
              height="100%"
              objectFit="contain"
              objectPosition="center"
              onError={onImageError}
            />
            {accentOverlay && (
              <Box
                position="absolute"
                inset="0"
                bg={`${accent}30`}
                mixBlendMode="multiply"
              />
            )}
          </>
        ) : (
          <Box width="100%" height="100%" bg={ink} />
        )}
      </Box>
      <Text
        fontSize="xl"
        fontWeight="bold"
        letterSpacing="-0.01em"
        textTransform="uppercase"
        lineHeight="1.2"
        noOfLines={2}
      >
        {title}
        <Text as="span" color={accent} fontSize="1.1em">
          &
        </Text>
      </Text>
      <Text fontSize="sm" color={inkMuted} mt="1">
        {date}
      </Text>
      <Flex
        align="center"
        gap="2"
        mt="3"
        color={accent}
        fontWeight="bold"
        fontSize="xs"
        letterSpacing="0.1em"
        textTransform="uppercase"
        cursor="pointer"
        _hover={{ textDecoration: "underline" }}
        onClick={onGetTicket}
      >
        Get ticket
        <Text as="span">→</Text>
      </Flex>
    </Box>
  )
}
