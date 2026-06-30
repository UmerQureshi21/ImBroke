import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { setTokens, clearTokens, getAccessToken, setOnAuthFailure, apiFetch, tryRefresh } from '../api'

interface AuthContextType {
  token: string | null
  userName: string | null
  loading: boolean
  login: (accessToken: string, name: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAccessToken())
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const login = (accessToken: string, name: string) => {
    setTokens(accessToken)
    setToken(accessToken)
    setUserName(name)
  }

  const logout = () => {
    apiFetch('/logout', { method: 'POST' }).catch(() => {})
    clearTokens()
    setToken(null)
    setUserName(null)
  }

  useEffect(() => {
    setOnAuthFailure(() => {
      setToken(null)
      setUserName(null)
    })

    // Attempt to restore session from the HttpOnly refresh token cookie
    tryRefresh().then(ok => {
      if (ok) setToken(getAccessToken())
      setLoading(false)
    })
  }, [])

  return (
    <AuthContext.Provider value={{ token, userName, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
