// src/App.tsx
import * as React from "react"
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { Box, Container, Flex, Heading, Spacer } from "@chakra-ui/react"

declare global {
  interface Window { Telegram?: { WebApp?: any } }
}

const ROUTES = [
  { label: "Landing", to: "/" },
  { label: "Feed", to: "/feed" },
  { label: "Feed 2", to: "/feed-2" },
  { label: "Bauhaus", to: "/bauhaus" },
  { label: "Bauhaus 2", to: "/bauhaus-2" },
  { label: "Profile 1", to: "/profile-1" },
  { label: "Profile 2", to: "/profile-2" },
  { label: "About", to: "/about" },
  { label: "Profile", to: "/profile" },
] as const

export default function App() {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    if (!tg) return
    tg.ready()
    tg.expand?.()
  }, [tg])

  const bg = "#FFFFFF"
  const fg = "#2D2A8C"
  const selectBg = "#FFFFFF"
  const selectBorder = "rgba(45,42,140,0.3)"

  const currentPath = React.useMemo(() => {
    const p = location.pathname
    return ROUTES.some((r) => r.to === p) ? p : ""
  }, [location.pathname])

  return (
    <Box minH="100dvh" bg={bg} color={fg}>
      <Container maxW="container.md" py="4">
        <Flex align="center" gap="4">
          <Heading size="md">AI-Picks</Heading>
          <Box
            as="select"
            value={currentPath}
            onChange={(e) => navigate({ to: e.target.value })}
            bg={selectBg}
            borderWidth="1px"
            borderColor={selectBorder}
            borderRadius="md"
            px="2"
            py="1"
            fontSize="sm"
            maxW="220px"
          >
            {ROUTES.map((r) => (
              <option key={r.to} value={r.to}>
                {r.label}
              </option>
            ))}
          </Box>
          <Spacer />
        </Flex>
      </Container>
      <Container maxW="container.md" pb="8">
        <Outlet />
      </Container>
    </Box>
  )
}


