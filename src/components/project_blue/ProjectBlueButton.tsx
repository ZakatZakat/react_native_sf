import * as React from "react"
import { Box, Flex, Text } from "@chakra-ui/react"
import { projectBlueTheme } from "./theme"

type ProjectBlueButtonProps = {
  children: React.ReactNode
  onClick?: () => void
  as?: "button" | "a"
  href?: string
  showFooter?: boolean
}

export function ProjectBlueButton({ children, onClick, as = "button", href, showFooter = true }: ProjectBlueButtonProps) {
  const { accent, inkMuted } = projectBlueTheme

  const content = (
    <>
      {children}
      <Text as="span" display="inline-block">
        →
      </Text>
    </>
  )

  return (
    <Box>
      <Flex
        as={as}
        href={href}
        align="center"
        justify="center"
        gap="4"
        bg={accent}
        color="white"
        px="8"
        py="6"
        fontWeight="bold"
        fontSize="md"
        letterSpacing="0.12em"
        textTransform="uppercase"
        cursor="pointer"
        borderRadius="0"
        _hover={{ opacity: 0.9 }}
        transition="opacity 0.2s"
        onClick={onClick}
      >
        {content}
      </Flex>
      {showFooter && (
        <Text fontSize="sm" color={inkMuted} textAlign="center" mt="4" letterSpacing="0.02em">
          Бесплатно · Без регистрации
        </Text>
      )}
    </Box>
  )
}
