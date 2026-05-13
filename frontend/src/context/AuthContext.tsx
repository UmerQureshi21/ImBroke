import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { setTokens, clearTokens, getAccessToken, setOnAuthFailure, apiFetch } from '../api'

interface AuthContextType {
  token: string | null
  userName: string | null
  login: (accessToken: string, refreshToken: string, name: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAccessToken())
  const [userName, setUserName] = useState<string | null>(null)

  const login = (accessToken: string, refreshToken: string, name: string) => {
    setTokens(accessToken, refreshToken)
    setToken(accessToken)
    setUserName(name)
  }

  const logout = () => {
    apiFetch('/logout', { method: 'POST' }).catch(() => {})
    clearTokens()
    setToken(null)
    setUserName(null)
  }

  // When the API layer detects an expired session, force logout
  useEffect(() => {
    setOnAuthFailure(() => {
      setToken(null)
      setUserName(null)
    })
  }, [])

  return <AuthContext.Provider value={{ token, userName, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
