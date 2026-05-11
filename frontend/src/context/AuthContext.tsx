import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { setTokens, clearTokens, getAccessToken, setOnAuthFailure, apiFetch } from '../api'

interface AuthContextType {
  token: string | null
  login: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAccessToken())

  const login = (accessToken: string, refreshToken: string) => {
    setTokens(accessToken, refreshToken)
    setToken(accessToken)
  }

  const logout = () => {
    apiFetch('/logout', { method: 'POST' }).catch(() => {})
    clearTokens()
    setToken(null)
  }

  // When the API layer detects an expired session, force logout
  useEffect(() => {
    setOnAuthFailure(() => setToken(null))
  }, [])

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
