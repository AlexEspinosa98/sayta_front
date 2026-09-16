import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiFetch, apiErr } from '../api'
import { useAuth } from '../context/AuthContext'

interface SetupForm {
  username: string; email: string; password: string; first_name: string; last_name: string
}

export default function Setup() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [form, setForm] = useState<SetupForm>({ username: '', email: '', password: '', first_name: '', last_name: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.username.trim() || !form.email.trim() || form.password.length < 8) {
      setError('Usuario, correo y una contraseña de al menos 8 caracteres son requeridos.')
      return
    }
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/auth/setup/', {
        method: 'POST',
        body: JSON.stringify(form),
      }) as { token: string }
      localStorage.setItem('sayta_token', data.token)
      await refreshProfile()
      setDone(true)
      setTimeout(() => navigate('/', { replace: true }), 1200)
    } catch (e) {
      setError(apiErr(e, 'No se pudo crear el administrador.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="eg-gate" style={{ minHeight: '70vh' }}>
      <div className="eg-gate-card" style={{ maxWidth: 440 }}>
        <div className="eg-gate-icon"><ShieldCheck size={28} /></div>
        <h1 className="eg-gate-title">Configuración inicial</h1>
        <p className="eg-gate-sub">Crea el usuario administrador — solo funciona si aún no existe ninguno.</p>

        {done ? (
          <p className="ent-hint" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <CheckCircle2 size={16} color="var(--green, #16a34a)" /> Administrador creado. Redirigiendo…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="eg-gate-form" noValidate>
            <input className="eg-gate-input" placeholder="Usuario *" autoComplete="username"
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            <input className="eg-gate-input" placeholder="Correo *" type="email" autoComplete="email"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input className="eg-gate-input" placeholder="Contraseña * (mínimo 8 caracteres)" type="password" autoComplete="new-password"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <input className="eg-gate-input" placeholder="Nombre" autoComplete="given-name"
              value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            <input className="eg-gate-input" placeholder="Apellido" autoComplete="family-name"
              value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />

            {error && <p className="eg-gate-err" role="alert"><AlertCircle size={14} aria-hidden="true" /> {error}</p>}

            <button type="submit" className="eg-gate-btn" disabled={loading}>
              {loading ? 'Creando…' : 'Crear administrador'}
            </button>
          </form>
        )}

        <p className="ent-hint" style={{ marginTop: 16, textAlign: 'center' }}>
          ¿Ya existe un administrador? <Link to="/login">Ir a iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
