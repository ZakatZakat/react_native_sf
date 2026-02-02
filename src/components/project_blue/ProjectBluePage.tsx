import * as React from "react"
import { Box, Stack } from "@chakra-ui/react"
import { projectBlueTheme } from "./theme"

type ProjectBluePageProps = {
  children: React.ReactNode
  maxW?: string
  px?: string | number
  pt?: string | number
  pb?: string | number
  gap?: string | number
  showDecor?: boolean
}

export function ProjectBluePage({ children, maxW = "430px", px = "5", pt = "10", pb = "16", gap = "10", showDecor = true }: ProjectBluePageProps) {
  const { ink, bg, accent } = projectBlueTheme

  return (
    <Box minH="100dvh" bg={bg} color={ink} position="relative" overflow="hidden">
      <Box position="fixed" inset="0" bg={bg} zIndex={-1} />
      {showDecor && (
        <Box
          position="absolute"
          top="-100px"
          right="-100px"
          width="260px"
          height="260px"
          borderRadius="full"
          bg={`${accent}08`}
          border={`50px solid ${accent}12`}
        />
      )}
      <Stack maxW={maxW} mx="auto" px={px} pt={pt} pb={pb} gap={gap}>
        {children}
      </Stack>
    </Box>
  )
}
