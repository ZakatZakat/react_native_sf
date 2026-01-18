// src/pages/About.tsx
import { Badge, Code, Heading, Stack, Text } from "@chakra-ui/react"

export default function About() {
  return (
    <Stack gap="3" py="6">
      <Heading size="lg">About</Heading>
      <Text>
        This page uses Chakra components. Try the <Badge>Toggle mode</Badge> button in the header.
      </Text>
      <Code>window.Telegram.WebApp</Code>
    </Stack>
  )
}
