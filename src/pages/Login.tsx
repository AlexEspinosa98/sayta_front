import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2, AlertCircle, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CDN = 'https://cdn.unimagdalena.edu.co/images'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = (location.state as { from?: string })?.from ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const d = err as Record<string, unknown>
      const msg =
        (d?.non_field_errors as string[] | undefined)?.[0] ??
        (d?.detail as string | undefined) ??
        'No se pudo iniciar sesión. Verifica tus credenciales.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <a href="https://www.unimagdalena.edu.co" target="_blank" rel="noreferrer" aria-label="Universidad del Magdalena">
            <img src={`${CDN}/escudo/bg_dark/128.png`} alt="Universidad del Magdalena" className="login-logo-uni" width="52" height="52" />
          </a>
          <div className="login-divider" aria-hidden="true" />
          <img src="/SAYTA LOGO.jpg" alt="SAYTA" className="login-logo-sayta" width="46" height="46" />
          <div className="login-brand-text">
            <span className="login-brand-name">SAYTA</span>
            <span className="login-brand-sub">Sistema de Audio y Traducción Ancestral</span>
          </div>
        </div>

        <h1 className="login-title">Iniciar sesión</h1>
        <p className="login-subtitle">Ingresa tus credenciales para acceder al sistema</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="login-username">Usuario</label>
            <input
              id="login-username"
              type="text"
              className="gl-input"
              autoComplete="username"
              autoFocus
              placeholder="tu_usuario"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              className="gl-input"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={loading || !username.trim() || !password}
          >
            {loading
              ? <><Loader2 size={16} className="spin" /> Ingresando…</>
              : <><LogIn size={16} /> Entrar</>}
          </button>
        </form>

        <p className="login-footer-note">
          Universidad del Magdalena · GIDEAM
        </p>
      </div>
    </div>
  )
}
