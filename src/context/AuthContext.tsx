import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { apiFetch, apiErr, setForbiddenHandler, setUnauthorizedHandler, TOKEN_KEY } from '../api'
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
  etnia?: string | null
  etnia_display?: string | null
  comunidad?: string | null
  permisos?: DynamicPermissionInput
}

interface PermisosResponse {
  usuario: Usuario
  permisos: DynamicPermissionInput
}

interface AuthContextType {
  user: Usuario | null
  token: string | null
  loading: boolean
  permissions: Permissions
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<Usuario>
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
  const refreshInFlight = useRef<Promise<Usuario> | null>(null)

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

  const refreshProfile = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY)
    if (!currentToken) {
      clearSession()
      throw new Error('No hay sesión activa.')
    }

    if (refreshInFlight.current) return refreshInFlight.current

    const request = apiFetch('/auth/permisos/', { refreshOnForbidden: false })
      .then(data => {
        const permisosData = data as PermisosResponse
        const usuario = { ...permisosData.usuario, permisos: permisosData.permisos }
        localStorage.setItem(USER_KEY, JSON.stringify(usuario))
        setToken(currentToken)
        setUser(usuario)
        return usuario
      })
      .finally(() => {
        refreshInFlight.current = null
      })

    refreshInFlight.current = request
    return request
  }, [clearSession])

  useEffect(() => {
    setForbiddenHandler(() => {
      if (localStorage.getItem(TOKEN_KEY)) refreshProfile().catch(() => clearSession())
    })
    return () => setForbiddenHandler(null)
  }, [clearSession, refreshProfile])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!localStorage.getItem(TOKEN_KEY)) { setLoading(false); return }
      try {
        if (!cancelled) await refreshProfile()
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [clearSession, refreshProfile])

  useEffect(() => {
    if (!token) return

    const revalidate = () => {
      if (!localStorage.getItem(TOKEN_KEY)) {
        clearSession()
        return
      }
      refreshProfile().catch(() => clearSession())
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidate()
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY && !event.newValue) {
        clearSession()
        return
      }
      if (event.key === TOKEN_KEY || event.key === USER_KEY) revalidate()
    }

    window.addEventListener('focus', revalidate)
    window.addEventListener('pageshow', revalidate)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', revalidate)
      window.removeEventListener('pageshow', revalidate)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [clearSession, refreshProfile, token])

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
      await refreshProfile()
    } catch (e) {
      throw new Error(apiErr(e, 'Credenciales incorrectas.'))
    }
  }, [persistSession, refreshProfile])

  const logout = useCallback(async () => {
    try { await apiFetch('/auth/logout/', { method: 'POST' }) }
    catch { /* logout es idempotente — igual limpiamos la sesión local */ }
    finally { clearSession() }
  }, [clearSession])

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
