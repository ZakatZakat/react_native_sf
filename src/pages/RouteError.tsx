import * as React from "react"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { Box, Button, Stack, Text } from "@chakra-ui/react"

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"

function reportClientError(tag: string, message: string, stack?: string) {
  try {
    fetch(`${apiUrl}/debug/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag,
        message,
        stack: stack || null,
        url: typeof window !== "undefined" ? window.location.href : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      }),
    }).catch(() => {})
  } catch {
    // ignore
  }
}

export default function RouteError(props: ErrorComponentProps) {
  const message = props.error instanceof Error ? props.error.message : String(props.error)
  const stack = props.error instanceof Error ? props.error.stack : undefined

  React.useEffect(() => {
    reportClientError("RouteError", message, stack)
  }, [message, stack])

  return (
    <Box p="4">
      <Stack gap="3">
        <Text fontSize="lg" fontWeight="bold">
          Something went wrong
        </Text>
        <Box border="1px solid" borderColor="red.500" bg="red.50" color="red.900" borderRadius="lg" p="3">
          <Text fontWeight="bold">Error</Text>
          <Text fontSize="sm">{message}</Text>
          {stack ? (
            <Box mt="2" p="2" bg="white" borderRadius="md" overflowX="auto">
              <Text as="pre" fontSize="xs" whiteSpace="pre-wrap">
                {stack}
              </Text>
            </Box>
          ) : null}
        </Box>
        <Button onClick={props.reset}>Reload</Button>
      </Stack>
    </Box>
  )
}



