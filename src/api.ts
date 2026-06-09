export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

const TOKEN_KEY = 'sayta_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export async function apiFetch(path: string, opts?: RequestInit) {
  const token  = getToken()
  const isForm = opts?.body instanceof FormData

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...(opts?.headers as Record<string, string> ?? {}),
  }

  const res  = await fetch(`${API_BASE}${path}`, { ...opts, headers })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw { status: res.status, data }
  return data
}

export function apiErr(e: unknown, fallback = 'Error desconocido.'): string {
  const d = (e as { data?: Record<string, unknown> })?.data
  if (!d) return fallback
  return (
    (d.error as string | undefined) ??
    (d.detail as string | undefined) ??
    (d.non_field_errors as string[] | undefined)?.[0] ??
    fallback
  )
}
