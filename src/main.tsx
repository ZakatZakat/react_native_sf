// src/main.tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { Provider } from "./components/ui/provider"
import { router } from "./router"
import { analytics } from "./lib/analytics"
import { installGlobalTap } from "./lib/haptics"
// Self-hosted fonts (family names 'Inter' / 'JetBrains Mono' — matching the
// --cs-font-* tokens). Bundled by Vite from node_modules, served from our own
// domain — no Google-CDN dependency that could stall/fail in the Telegram iOS
// webview and drop the UI to Helvetica/SF. Only the weights actually used.
import "@fontsource/inter/400.css"
import "@fontsource/inter/500.css"
import "@fontsource/inter/700.css"
import "@fontsource/inter/800.css"
import "@fontsource/inter/900.css"
import "@fontsource/jetbrains-mono/400.css"
import "@fontsource/jetbrains-mono/500.css"
import "@fontsource/jetbrains-mono/700.css"
import "./styles/cs-tokens.css"
import "./index.css"

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

if (typeof window !== "undefined") {
  window.addEventListener("error", (ev) => {
    const err = (ev as ErrorEvent).error as Error | undefined
    reportClientError("window.error", err?.message || String((ev as ErrorEvent).message), err?.stack)
  })
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = (ev as PromiseRejectionEvent).reason as unknown
    const msg = reason instanceof Error ? reason.message : JSON.stringify(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    reportClientError("window.unhandledrejection", msg, stack)
  })
}

// Analytics: init the SDK, pull Telegram identity when present, and emit
// a page.view on every route resolve. Errors are already captured by the
// SDK's own window hooks — the legacy reportClientError() above lives
// in parallel for the curator-side debug log.
analytics.init()
// Light haptic tap on every button/link across the app (no-op outside TG).
installGlobalTap()
if (typeof window !== "undefined") {
  const tg = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number; language_code?: string } }; colorScheme?: string } } }).Telegram?.WebApp
  if (tg?.initDataUnsafe?.user?.id) {
    analytics.identify({
      user_id: String(tg.initDataUnsafe.user.id),
      tg: {
        id: tg.initDataUnsafe.user.id,
        lang: tg.initDataUnsafe.user.language_code,
        theme: tg.colorScheme,
      },
    })
  }
}
router.subscribe("onResolved", ({ toLocation }) => {
  analytics.page(toLocation.pathname)
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>
)
