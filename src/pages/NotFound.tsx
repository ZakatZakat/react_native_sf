import * as React from "react"
import { Box, Button, Stack, Text } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"

export default function NotFound() {
  return (
    <Box p="4">
      <Stack gap="4">
        <Text fontSize="xl" fontWeight="bold">
          404 — страница не найдена
        </Text>
        <Button asChild>
          <Link to="/">На главную</Link>
        </Button>
      </Stack>
    </Box>
  )
}
