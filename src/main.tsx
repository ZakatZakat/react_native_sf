// src/main.tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"
import { Provider } from "./components/ui/provider"
import { router } from "./router"
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>
)
