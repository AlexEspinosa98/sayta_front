import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { apiFetch, apiErr, TOKEN_KEY } from '../api'
import { useAuth } from '../context/AuthContext'

interface RegistroForm {
  username: string; email: string; password: string; first_name: string; last_name: string
}

const emptyForm = (): RegistroForm =>
  ({ username: '', email: '', password: '', first_name: '', last_name: '' })

export default function Registro() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [form, setForm]       = useState<RegistroForm>(emptyForm())
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
      const data = await apiFetch('/auth/registro-publico/', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(form),
      }) as { token?: string }
      setDone(true)
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token)
        await refreshProfile()
        setTimeout(() => navigate('/', { replace: true }), 1800)
      }
    } catch (e) {
      setError(apiErr(e, 'No se pudo crear la cuenta.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="eg-gate" style={{ minHeight: '70vh' }}>
      <div className="eg-gate-card" style={{ maxWidth: 440 }}>
        <div className="eg-gate-icon"><UserPlus size={28} /></div>
        <h1 className="eg-gate-title">Crear una cuenta</h1>
        <p className="eg-gate-sub">
          Tu cuenta queda con rol <strong>pendiente</strong> hasta que un administrador te asigne
          los permisos correspondientes.
        </p>

        {done ? (
          <p className="ent-hint" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', textAlign: 'center' }}>
            <CheckCircle2 size={16} color="var(--green, #16a34a)" />
            Cuenta creada. Un administrador debe asignarte un rol antes de que puedas usar el sistema.
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

            <p className="ent-hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} aria-hidden="true" /> Podrás iniciar sesión de inmediato, pero sin permisos hasta la revisión.
            </p>

            <button type="submit" className="eg-gate-btn" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}

        <p className="ent-hint" style={{ marginTop: 16, textAlign: 'center' }}>
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
