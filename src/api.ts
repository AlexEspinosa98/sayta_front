export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export const TOKEN_KEY = 'sayta_token'

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Registrado por AuthProvider al montar — se dispara ante cualquier 401. */
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn
}

export async function apiFetch(path: string, opts?: RequestInit) {
  const isForm = opts?.body instanceof FormData
  const token = localStorage.getItem(TOKEN_KEY)

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...(opts?.headers as Record<string, string> ?? {}),
  }

  const res  = await fetch(`${API_BASE}${path}`, { ...opts, headers })

  if (res.status === 401) {
    onUnauthorized?.()
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw { status: res.status, data }
  return data
}

export function apiErr(e: unknown, fallback = 'Error desconocido.'): string {
  const d = (e as { data?: Record<string, unknown> })?.data
  if (!d) return fallback
  const firstFieldError = Object.values(d).find(v => Array.isArray(v) && v.length > 0) as string[] | undefined
  return (
    (d.error as string | undefined) ??
    (d.detail as string | undefined) ??
    (d.mensaje as string | undefined) ??
    (d.non_field_errors as string[] | undefined)?.[0] ??
    firstFieldError?.[0] ??
    fallback
  )
}
