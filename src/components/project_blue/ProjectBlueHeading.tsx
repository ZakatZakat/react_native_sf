import * as React from "react"
import { Box, Flex, Text } from "@chakra-ui/react"
import { projectBlueTheme } from "./theme"

type ProjectBlueHeadingProps = {
  children: React.ReactNode
  stats?: React.ReactNode
}

export function ProjectBlueHeading({ children, stats }: ProjectBlueHeadingProps) {
  const { ink, inkMuted, accent } = projectBlueTheme

  return (
    <Box>
      <Text
        fontSize={{ base: "3xl", sm: "4xl" }}
        fontWeight="bold"
        letterSpacing="-0.02em"
        lineHeight="1.1"
        textTransform="uppercase"
      >
        {children}
        <Text as="span" color={accent}>
          &
        </Text>
      </Text>
      <Box width="16" height="1" bg={accent} mt="5" />
      {stats && (
        <Flex gap="4" mt="4" fontSize="sm" color={inkMuted} letterSpacing="0.05em">
          {stats}
        </Flex>
      )}
    </Box>
  )
}
