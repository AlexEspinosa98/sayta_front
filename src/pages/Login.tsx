import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Lock, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const from: string = (location.state as { from?: string } | null)?.from ?? '/'

  if (isAuthenticated) {
    navigate(from, { replace: true })
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true); setError('')
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Credenciales incorrectas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="eg-gate" style={{ minHeight: '70vh' }}>
      <div className="eg-gate-card">
        <div className="eg-gate-icon"><Lock size={28} /></div>
        <h1 className="eg-gate-title">Iniciar sesión</h1>
        <p className="eg-gate-sub">Ingresa con tu usuario y contraseña de SAYTA</p>

        <form onSubmit={handleSubmit} className="eg-gate-form" noValidate>
          <label htmlFor="login-user" className="sr-only">Usuario</label>
          <input
            id="login-user"
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setError('') }}
            placeholder="Usuario"
            className="eg-gate-input"
            autoFocus
            autoComplete="username"
          />

          <label htmlFor="login-pw" className="sr-only">Contraseña</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              id="login-pw"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Contraseña"
              className="eg-gate-input"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="gate-eye"
              onClick={() => setShowPw(p => !p)}
              tabIndex={-1}
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <p className="eg-gate-err" role="alert">
              <AlertCircle size={14} aria-hidden="true" /> {error}
            </p>
          )}

          <button type="submit" className="eg-gate-btn" disabled={loading}>
            <LogIn size={15} aria-hidden="true" /> {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="ent-hint" style={{ marginTop: 16, textAlign: 'center' }}>
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      </div>
    </div>
  )
}
