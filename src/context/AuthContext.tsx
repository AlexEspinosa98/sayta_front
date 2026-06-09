import { createContext, useContext, useState, type ReactNode } from 'react'
import { API_BASE } from '../api'

export interface AuthUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  rol: string
  rol_display: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  canManage: boolean   // admin | desarrollador | investigador
  canUpload: boolean   // + anotador
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'sayta_token'
const USER_KEY  = 'sayta_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser]   = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  })

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw data
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    setToken(data.token as string)
    setUser(data.usuario as AuthUser)
  }

  const logout = async () => {
    const t = token
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    // fire-and-forget — invalidate on the server
    if (t) {
      fetch(`${API_BASE}/auth/logout/`, {
        method: 'POST',
        headers: { Authorization: `Token ${t}`, Accept: 'application/json' },
      }).catch(() => {})
    }
  }

  const rol      = user?.rol ?? ''
  const canManage = ['admin', 'desarrollador', 'investigador'].includes(rol)
  const canUpload = ['admin', 'desarrollador', 'investigador', 'anotador'].includes(rol)

  return (
    <AuthContext.Provider value={{
      user, token,
      login, logout,
      isAuthenticated: !!(token && user),
      canManage, canUpload,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
