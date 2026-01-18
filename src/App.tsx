// src/App.tsx
import * as React from "react"
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { Box, Container, Flex, Heading, Spacer } from "@chakra-ui/react"
import { ColorModeButton, useColorMode, useColorModeValue } from "./components/ui/color-mode"

declare global {
  interface Window { Telegram?: { WebApp?: any } }
}

const ROUTES = [
  { label: "Landing", to: "/" },
  { label: "Landing 2", to: "/landing-2" },
  { label: "Landing 3", to: "/landing-3" },
  { label: "Landing 5", to: "/landing-5" },
  { label: "Landing 6", to: "/landing-6" },
  { label: "Feed", to: "/feed" },
  { label: "About", to: "/about" },
  { label: "Profile", to: "/profile" },
] as const

export default function App() {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
  const { setColorMode } = useColorMode()
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    if (!tg) return
    tg.ready()
    tg.expand?.()
    // Sync Chakra color mode with Telegram’s scheme if provided
    if (tg.colorScheme === "dark" || tg.colorScheme === "light") {
      setColorMode(tg.colorScheme)
    }
  }, [tg, setColorMode])

  const bg = useColorModeValue("gray.50", "gray.900")
  const fg = useColorModeValue("gray.800", "gray.100")
  const selectBg = useColorModeValue("white", "gray.800")
  const selectBorder = useColorModeValue("gray.200", "gray.700")

  const currentPath = React.useMemo(() => {
    const p = location.pathname
    return ROUTES.some((r) => r.to === p) ? p : ""
  }, [location.pathname])

  return (
    <Box minH="100dvh" bg={bg} color={fg}>
      <Container maxW="container.md" py="4">
        <Flex align="center" gap="4">
          <Heading size="md">Telegram Mini App</Heading>
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
          <ColorModeButton />
        </Flex>
      </Container>
      <Container maxW="container.md" pb="8">
        <Outlet />
      </Container>
    </Box>
  )
}


