import * as React from "react"

type TelegramWebApp = {
  initData?: string
  ready?: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

type InitDataSource =
  | "telegram"
  | "hash"
  | "query"
  | "cache"
  | "env"
  | "none"

export function useTelegramInitData() {
  const [initData, setInitData] = React.useState<string>("")
  const [source, setSource] = React.useState<InitDataSource>("none")
  const [search, setSearch] = React.useState<string>("")
  const [hash, setHash] = React.useState<string>("")
  const [debug, setDebug] = React.useState<Record<string, unknown>>({})

  React.useEffect(() => {
    if (typeof window === "undefined") return

    setSearch(window.location.search || "")
    setHash(window.location.hash || "")

    // Telegram may put init data into hash OR provide it via WebApp initData.
    // Also, tg parameter can be named "tgWebAppData" or "tgwebappdata".
    const fromEnv = import.meta.env.VITE_TG_INIT_DATA || ""
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""))

    const fromQuery = params.get("tgWebAppData") || params.get("tgwebappdata") || ""
    const fromHash = hashParams.get("tgWebAppData") || hashParams.get("tgwebappdata") || ""
    const cached = sessionStorage.getItem("tg_init_data") || ""
    const webApp = window.Telegram?.WebApp
    webApp?.ready?.()
    const fromTelegram = webApp?.initData || ""
    const fromUnsafe = webApp?.initDataUnsafe ? JSON.stringify(webApp.initDataUnsafe) : ""
    // Some clients expose initDataUnsafe.user even if initData string is empty
    // We still need the raw string for signature, so keep priority as-is.

    const pickSource = (): { value: string; src: InitDataSource } => {
      if (fromTelegram) return { value: fromTelegram, src: "telegram" }
      if (fromHash) return { value: fromHash, src: "hash" }
      if (fromQuery) return { value: fromQuery, src: "query" }
      // When Telegram bridge is present, avoid using cached/env initData
      // to prevent signature mismatch due to stale data.
      if (!webApp && cached) return { value: cached, src: "cache" }
      if (!webApp && fromEnv) return { value: fromEnv, src: "env" }
      return { value: "", src: "none" }
    }

    const picked = pickSource()
    if (picked.value) {
      setInitData(picked.value)
      setSource(picked.src)
      sessionStorage.setItem("tg_init_data", picked.value)
    } else {
      setSource("none")
    }

    const maybeExternal = window as unknown as {
      TelegramWebviewProxy?: unknown
      external?: { notify?: unknown }
      webkit?: { messageHandlers?: { telegram?: { postMessage?: unknown } } }
    }
    const proxy_present =
      Boolean(maybeExternal.TelegramWebviewProxy) ||
      Boolean(maybeExternal.external?.notify) ||
      Boolean(maybeExternal.webkit?.messageHandlers?.telegram?.postMessage)
    const in_telegram_env =
      proxy_present || (webApp?.platform && webApp.platform !== "unknown") || Boolean(webApp?.initDataUnsafe?.user)

    const debugInfo = {
      tg_present: Boolean(webApp),
      tg_bridge_loaded: Boolean(window.Telegram),
      proxy_present,
      in_telegram_env,
      tg_version: webApp?.version,
      tg_platform: webApp?.platform,
      tg_colorScheme: webApp?.colorScheme,
      tg_themeParams: webApp?.themeParams,
      initData_len: fromTelegram.length,
      initDataUnsafe: fromUnsafe,
      fromHash_len: fromHash.length,
      fromQuery_len: fromQuery.length,
      cached_len: cached.length,
      env_len: fromEnv.length,
      search: window.location.search,
      hash: window.location.hash,
    }
    setDebug(debugInfo)
    // eslint-disable-next-line no-console
    console.log("TG initData debug", debugInfo)
  }, [])

  return { initData, source, search, hash, debug }
}

