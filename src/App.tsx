// src/App.tsx
import * as React from "react"
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { Box, Container, Flex, Heading, Spacer } from "@chakra-ui/react"

declare global {
  interface Window { Telegram?: { WebApp?: any } }
}

const PIPE_ROUTES = [
  // Short path: Landing → Loading → Feed → Profile
  { label: "01 · Лендинг",  to: "/cs/landing" },
  { label: "02 · Загрузка", to: "/cs/loading" },
  { label: "03 · Лента",    to: "/cs/feed" },
  { label: "04 · Профиль",  to: "/cs/profile" },
] as const

const ALT_ROUTES = [
  // Снятые с основного пути v3-экраны (City Pass / свайп интересов /
  // суммаризация) — оставлены доступными для дизайн-ревью.
  { label: "CS · Пропуск (старый шаг 04)",       to: "/cs/pass" },
  { label: "CS · Интересы (старый шаг 05)",      to: "/cs/swipe" },
  { label: "CS · Суммаризация (старый шаг 06)",  to: "/cs/summary" },
  // Прежний клиентский путь (Triptych → Swipe → Result → Quiz)
  { label: "Pipe Landing V1 (Triptych)", to: "/pipe-landing-v1" },
  { label: "Pipe Swipe Train", to: "/pipe-swipe-train" },
  { label: "Pipe Swipe Result (B8 Cover Hero)", to: "/pipe-swipe-result" },
  { label: "Pipe Quiz (Alt 2)", to: "/pipe-quiz" },
  // Остальные альтернативы
  { label: "Pipe Landing Page", to: "/pipe-landing" },
  { label: "Pipe Onboarding", to: "/pipe-onboarding" },
  { label: "Pipe Feed Swipe", to: "/pipe-feed-swipe" },
  { label: "Pipe My Events", to: "/pipe-my-events" },
  { label: "Pipe Admin Moderation", to: "/pipe-admin-moderation" },
  { label: "Pipe Landing (bauhaus blocks)", to: "/pipe-landing-bauhaus" },
  { label: "Pipe Landing (classic)", to: "/pipe-landing-classic" },
  { label: "Pipe Onboarding (classic)", to: "/pipe-onboarding-classic" },
  { label: "Pipe Radar / Кино", to: "/pipe-radar/cinema" },
  { label: "Pipe Radar / Совр. иск.", to: "/pipe-radar/contemporary" },
  { label: "Pipe Example", to: "/pipe-example" },
  { label: "Pipe Rotate", to: "/pipe-rotate" },
  { label: "Pipe My Profile", to: "/pipe-personal" },
  { label: "Pipe Personal Feed", to: "/pipe-personal-feed" },
  { label: "Pipe Feed", to: "/pipe-feed" },
  { label: "Pipe Example Only Blue", to: "/pipe-example-only-blue" },
  { label: "Pipe Feed Only Blue", to: "/pipe-feed-only-blue" },
  { label: "Landing", to: "/" },
  { label: "Landing 2", to: "/landing-2" },
  { label: "Landing 3", to: "/landing-3" },
  { label: "Landing 4", to: "/landing-4" },
  { label: "Landing 5 project_blue", to: "/landing-5-project-blue" },
  { label: "Feed", to: "/feed" },
  { label: "Feed 2", to: "/feed-2" },
  { label: "About", to: "/about" },
  { label: "Profile", to: "/profile" },
] as const

const ALL_ROUTES = [...PIPE_ROUTES, ...ALT_ROUTES] as const

// Dev navigation chrome (AI-Picks heading + route selector). Hidden for
// now so the mini-app shows only the client-path journey. Flip to true to
// bring the route picker back for local design review.
const SHOW_DEV_NAV = false

export default function App() {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
  const navigate = useNavigate()
  const location = useLocation()

  React.useEffect(() => {
    if (!tg) return
    tg.ready()
    tg.expand?.()
  }, [tg])

  const fg = "#2D2A8C"
  const selectBg = "#FFFFFF"
  const selectBorder = "rgba(45,42,140,0.3)"

  const currentPath = React.useMemo(() => {
    const p = location.pathname
    const full = p + (location.search ?? "")
    if (ALL_ROUTES.some((r) => r.to === full)) return full
    return ALL_ROUTES.some((r) => r.to === p) ? p : ""
  }, [location.pathname, location.search])

  return (
    // bg transparent: на телефоне под рамкой белый #root, на широком экране —
    // тёмный сурраунд из media-query в index.css (иначе белый Box перекрыл бы его).
    <Box minH="100dvh" bg="transparent" color={fg}>
      {SHOW_DEV_NAV && (
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
              {PIPE_ROUTES.length > 0 && (
                <optgroup label="Клиентский Путь">
                  {PIPE_ROUTES.map((r) => (
                    <option key={r.to} value={r.to}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Альтернативные Варианты">
                {ALT_ROUTES.map((r) => (
                  <option key={r.to} value={r.to}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            </Box>
            <Spacer />
          </Flex>
        </Container>
      )}
      {/* Телефонная рамка: на широком экране — колонка телефонной ширины по
          центру (см. .cs-frame в index.css), на телефоне — всё как есть.
          Веб-версия (/web) рамку не берёт — идёт во всю ширину экрана. */}
      <div className={location.pathname.startsWith("/web") ? undefined : "cs-frame"}>
        <Outlet />
      </div>
    </Box>
  )
}


