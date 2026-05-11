const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── In-memory token store (not localStorage — prevents XSS token theft) ──
let accessToken: string | null = null
let refreshToken: string | null = null

export function setTokens(access: string, refresh: string) {
  accessToken = access
  refreshToken = refresh
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
}

export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  return refreshToken
}

// Callback invoked when token refresh fails (session expired)
let onAuthFailure: (() => void) | null = null

export function setOnAuthFailure(cb: () => void) {
  onAuthFailure = cb
}

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false
  if (isRefreshing && refreshPromise) return refreshPromise

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
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
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  })

  // If 401 and we have a refresh token, try to refresh and retry once
  if (res.status === 401 && refreshToken) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`
      res = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
      })
    } else {
      // Refresh failed — session is dead, force logout
      clearTokens()
      onAuthFailure?.()
    }
  }

  return res
}
