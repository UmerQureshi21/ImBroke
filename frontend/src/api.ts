const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── In-memory access token (not localStorage — prevents XSS token theft) ──
// The refresh token lives in an HttpOnly cookie set by the server.
let accessToken: string | null = null

export function setTokens(access: string) {
  accessToken = access
}

export function clearTokens() {
  accessToken = null
}

export function getAccessToken() {
  return accessToken
}

// Callback invoked when token refresh fails (session expired)
let onAuthFailure: (() => void) | null = null

export function setOnAuthFailure(cb: () => void) {
  onAuthFailure = cb
}

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

export async function tryRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API}/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return false
      const data = await res.json()
      accessToken = data.access_token
      return true
    } catch {
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'

  let res = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  })

  // If 401, try to refresh via the HttpOnly cookie and retry once
  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`
      res = await fetch(`${API}${path}`, {
        ...options,
        credentials: 'include',
        headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
      })
    } else {
      clearTokens()
      onAuthFailure?.()
    }
  }

  return res
}
