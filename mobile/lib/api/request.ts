import { API_BASE_URL } from "../config"
import { getAccessToken } from "../storage/authStorage"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type RequestOptions = {
  method?: HttpMethod
  path: string
  body?: unknown
  headers?: Record<string, string>
  auth?: boolean
  signal?: AbortSignal
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`
}

async function parseJsonSafely(response: Response): Promise<unknown | null> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const { method = "GET", path, body, headers = {}, auth = false, signal } = options
  const nextHeaders: Record<string, string> = { ...headers }

  if (auth) {
    const token = await getAccessToken()
    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`
    }
  }

  if (body !== undefined) {
    nextHeaders["Content-Type"] = "application/json"
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: nextHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const payload = await parseJsonSafely(response)
    const message = typeof payload === "object" && payload !== null && "detail" in payload
      ? String((payload as { detail?: unknown }).detail)
      : `Request failed: ${response.status}`
    throw new ApiRequestError(message, response.status, payload ?? undefined)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
