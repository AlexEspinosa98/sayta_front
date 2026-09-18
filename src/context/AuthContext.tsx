import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { apiFetch, apiErr, setUnauthorizedHandler, TOKEN_KEY } from '../api'
import { resolvePermissions, type DynamicPermissionInput, type Permissions } from '../permissions'

const USER_KEY = 'sayta_user'

export interface Usuario {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  rol: string
  rol_display: string
  date_joined: string
  permisos?: DynamicPermissionInput
}

interface AuthContextType {
  user: Usuario | null
  token: string | null
  loading: boolean
  permissions: Permissions
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function readStoredUser(): Usuario | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) as Usuario : null
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser]   = useState<Usuario | null>(() => readStoredUser())
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const persistSession = useCallback((newToken: string, usuario: Usuario) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(usuario))
    setToken(newToken)
    setUser(usuario)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession())
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!localStorage.getItem(TOKEN_KEY)) { setLoading(false); return }
      try {
        const perfil = await apiFetch('/auth/perfil/') as Usuario
        if (!cancelled) {
          localStorage.setItem(USER_KEY, JSON.stringify(perfil))
          setUser(perfil)
        }
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [clearSession])

  const login = useCallback(async (username: string, password: string) => {
    try {
      const identifier = username.trim()
      const loginPayload = identifier.includes('@')
        ? { email: identifier, password }
        : { username: identifier, password }
      const data = await apiFetch('/auth/login/', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(loginPayload),
      }) as { token: string; usuario: Usuario }
      persistSession(data.token, data.usuario)
    } catch (e) {
      throw new Error(apiErr(e, 'Credenciales incorrectas.'))
    }
  }, [persistSession])

  const logout = useCallback(async () => {
    try { await apiFetch('/auth/logout/', { method: 'POST' }) }
    catch { /* logout es idempotente — igual limpiamos la sesión local */ }
    finally { clearSession() }
  }, [clearSession])

  const refreshProfile = useCallback(async () => {
    const perfil = await apiFetch('/auth/perfil/') as Usuario
    localStorage.setItem(USER_KEY, JSON.stringify(perfil))
    setUser(perfil)
  }, [])

  const value: AuthContextType = {
    user, token, loading,
    permissions: resolvePermissions(user?.rol, user?.permisos),
    isAuthenticated: Boolean(user && token),
    login, logout, refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
