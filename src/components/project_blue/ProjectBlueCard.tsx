import * as React from "react"
import { Badge, Box, Text } from "@chakra-ui/react"
import { projectBlueTheme } from "./theme"

type ProjectBlueCardProps = {
  title: string
  children: React.ReactNode
  tilt?: "left" | "right"
  width?: string | number
  floatClass?: string
}

export function ProjectBlueCard({ title, children, tilt = "left", width = "340px", floatClass }: ProjectBlueCardProps) {
  const { ink, inkMuted, bg, accent } = projectBlueTheme
  const rotate = tilt === "left" ? "-2.4deg" : "2.8deg"
  const animDuration = tilt === "left" ? "6.4s" : "7.2s"
  const animDelay = tilt === "left" ? "-0.8s" : "-1.1s"

  return (
    <Box
      className={floatClass}
      style={{ animationDuration: animDuration, animationDelay: animDelay }}
      alignSelf={tilt === "left" ? "flex-start" : "flex-end"}
    >
      <Box
        width={width}
        maxW="100%"
        border={`2px solid ${ink}`}
        borderRadius="2xl"
        p="5"
        bg={bg}
        boxShadow="0 8px 24px rgba(0,0,0,0.06)"
        style={{ transform: `rotate(${rotate})` }}
      >
        <Text fontSize="sm" fontWeight="bold" letterSpacing="0.15em" textTransform="uppercase" color={accent}>
          {title}
        </Text>
        {children}
      </Box>
    </Box>
  )
}

type ProjectBlueCardBadgeProps = {
  children: React.ReactNode
}

export function ProjectBlueCardBadge({ children }: ProjectBlueCardBadgeProps) {
  const { accent } = projectBlueTheme

  return (
    <Badge
      mt="4"
      fontSize="10px"
      borderRadius="full"
      px="4"
      py="1.5"
      bg={accent}
      color="white"
      fontWeight="bold"
      letterSpacing="0.08em"
    >
      {children}
    </Badge>
  )
}
