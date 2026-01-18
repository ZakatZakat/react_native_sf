import * as React from "react"
import { AvatarFallback, AvatarImage, AvatarRoot, Badge, Box, Button, Input, Stack, Text, Textarea } from "@chakra-ui/react"

import { useTelegramInitData } from "../hooks/useTelegramInitData"

type UserProfile = {
  telegram_id: number
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  photo_url?: string | null
  language_code?: string | null
  city?: string | null
  interests: string[]
  created_at: string
  updated_at: string
}

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000"

function normalizeInterests(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function Profile() {
  const { initData, source, search, hash, debug } = useTelegramInitData()
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [city, setCity] = React.useState("")
  const [interests, setInterests] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [savedAt, setSavedAt] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const hasInitData = Boolean(initData)
  const initializedRef = React.useRef(false)
  const lastSavedRef = React.useRef<{ city: string | null; interests: string[] } | null>(null)

  // Log sources for debugging in Telegram WebView
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("initData source", { source, search, hash, len: initData.length })
      // eslint-disable-next-line no-console
      console.log("Telegram WebApp present", Boolean(window.Telegram?.WebApp), window.Telegram?.WebApp)
    }
  }, [hash, initData.length, search, source])

  const loadProfile = React.useCallback(async () => {
    if (!hasInitData) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/me/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_data: initData }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { detail?: unknown } | null
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null
        throw new Error(detail ? `status ${res.status}: ${detail}` : `status ${res.status}`)
      }
      const data: UserProfile = await res.json()
      setProfile(data)
      setCity(data.city || "")
      setInterests(data.interests.join(", "))
      lastSavedRef.current = { city: data.city ?? null, interests: data.interests }
      initializedRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить профиль")
    } finally {
      setLoading(false)
    }
  }, [hasInitData, initData])

  React.useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const saveProfile = React.useCallback(async () => {
    if (!hasInitData || !profile) return
    setSaving(true)
    setError(null)
    try {
      const nextCity = city.trim() ? city.trim() : null
      const nextInterests = normalizeInterests(interests)

      const body = {
        init_data: initData,
        city: nextCity,
        interests: nextInterests,
      }
      const res = await fetch(`${apiUrl}/me/auth`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { detail?: unknown } | null
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null
        throw new Error(detail ? `status ${res.status}: ${detail}` : `status ${res.status}`)
      }
      const data: UserProfile = await res.json()
      setProfile(data)
      setCity(data.city || "")
      setInterests(data.interests.join(", "))
      lastSavedRef.current = { city: data.city ?? null, interests: data.interests }
      setSavedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }, [city, hasInitData, initData, interests, profile])

  const onSave = async () => {
    await saveProfile()
  }

  // Autosave draft + debounced save after the profile is loaded
  React.useEffect(() => {
    if (!profile || !hasInitData || !initializedRef.current) return

    const nextCity = city.trim() ? city.trim() : null
    const nextInterests = normalizeInterests(interests)
    const last = lastSavedRef.current
    const changed =
      !last || last.city !== nextCity || JSON.stringify(last.interests) !== JSON.stringify(nextInterests)

    if (!changed) return

    const draftKey = `profile_draft:${profile.telegram_id}`
    try {
      localStorage.setItem(draftKey, JSON.stringify({ city: nextCity, interests: nextInterests }))
    } catch {
      // ignore
    }

    const t = window.setTimeout(() => {
      saveProfile()
    }, 900)
    return () => window.clearTimeout(t)
  }, [city, hasInitData, interests, profile, saveProfile])

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")

  return (
    <Box
      minH="100vh"
      bg="linear-gradient(180deg, #E8ECF5 0%, #F6F3EF 60%, #F6F3EF 100%)"
      color="#0F0F0F"
      fontFamily="system-ui"
      pb="10"
    >
      <Stack gap="5" px="3" pt="5" maxW="430px" mx="auto">
        <Text fontSize="lg" fontWeight="bold">
          Мой кабинет
        </Text>

        {!hasInitData && (
          <Box borderRadius="lg" border="1px solid" borderColor="yellow.500" bg="yellow.50" p="3" color="yellow.900">
            <Text fontWeight="bold" mb="1">
              Нет initData
            </Text>
            <Text fontSize="sm">
              Telegram-мост может быть загружен, но initData приходит только если страница открыта внутри Telegram WebApp (через кнопку web_app).
            </Text>
            <Stack fontSize="xs" mt="2" spacing="1" color="yellow.800">
              <Text>source={source} search={search || "—"} hash={hash || "—"}</Text>
              <Text>
                tg_bridge_loaded={String(debug.tg_bridge_loaded)} tg_present={String(debug.tg_present)} in_telegram_env=
                {String(debug.in_telegram_env)} proxy_present={String(debug.proxy_present)}
              </Text>
              <Text>version={debug.tg_version as string} platform={debug.tg_platform as string} scheme={debug.tg_colorScheme as string}</Text>
              <Text>initData_len={debug.initData_len as number} hash_len={debug.fromHash_len as number} query_len={debug.fromQuery_len as number}</Text>
            </Stack>
          </Box>
        )}

        {error && (
          <Box borderRadius="lg" border="1px solid" borderColor="red.500" bg="red.50" p="3" color="red.900">
            <Text fontWeight="bold" mb="1">
              Ошибка
            </Text>
            <Text fontSize="sm">{error}</Text>
            <Text fontSize="xs" mt="2" color="red.800">
              initData_len={initData.length} has_hash={String(initData.includes("hash="))}
            </Text>
            <Text fontSize="xs" color="red.800">
              source={source} tg_present={String(debug.tg_present)} initData_fromTelegram_len={debug.initData_len as number}
            </Text>
            <Text fontSize="xs" color="red.800">
              keys=
              {(() => {
                try {
                  const keys = Array.from(new URLSearchParams(initData).keys())
                  return keys.join(", ") || "—"
                } catch {
                  return "parse_error"
                }
              })()}
            </Text>
          </Box>
        )}

        {profile && (
          <Box border="2px solid #0F0F0F" borderRadius="xl" bg="#FFF9E8" p="4" boxShadow="sm">
            <Stack gap="3">
              <Stack direction="row" align="center" gap="3">
                <AvatarRoot>
                  {profile.photo_url ? <AvatarImage src={profile.photo_url} /> : null}
                  <AvatarFallback>{(fullName || profile.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                </AvatarRoot>
                <Stack gap="1">
                  <Text fontWeight="bold">{fullName || profile.username || "Без имени"}</Text>
                  <Text fontSize="sm" color="#444">
                    ID: {profile.telegram_id}
                  </Text>
                </Stack>
              </Stack>
              <Box>
                <Stack direction="row" gap="2">
                  {profile.username && <Badge>@{profile.username}</Badge>}
                  {profile.language_code && <Badge>{profile.language_code}</Badge>}
                </Stack>
              </Box>
              <Stack gap="2">
                <Text fontWeight="medium">Город</Text>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" />
              </Stack>
              <Stack gap="2">
                <Text fontWeight="medium">Интересы (через запятую)</Text>
                <Textarea
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder="концерты, театры, стартапы"
                />
              </Stack>
              <Button onClick={onSave} isLoading={loading} colorScheme="blue">
                Сохранить
              </Button>
              <Text fontSize="xs" color="#555">
                {saving ? "Сохраняем…" : savedAt ? `Сохранено: ${new Date(savedAt).toLocaleString()}` : "Автосейв включен"}
              </Text>
              <Text fontSize="xs" color="#555">
                Данные берутся из Telegram initData, подпись проверяется на бэкенде.
              </Text>
            </Stack>
          </Box>
        )}

        {!profile && hasInitData && (
          <Button onClick={loadProfile} isLoading={loading} colorScheme="blue">
            Загрузить профиль
          </Button>
        )}
      </Stack>
    </Box>
  )
}

