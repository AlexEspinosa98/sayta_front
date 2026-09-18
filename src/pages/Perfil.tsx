import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Save, UserRound } from 'lucide-react'
import { apiErr, apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'

interface PerfilForm {
  username: string
  email: string
  first_name: string
  last_name: string
  etnia: string
  comunidad: string
  password_actual: string
  password_nueva: string
}

function emptyForm(): PerfilForm {
  return {
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    etnia: '',
    comunidad: '',
    password_actual: '',
    password_nueva: '',
  }
}

export default function Perfil() {
  const { user, refreshProfile } = useAuth()
  const [form, setForm] = useState<PerfilForm>(emptyForm())
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm({
      username: user.username ?? '',
      email: user.email ?? '',
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      etnia: user.etnia ?? '',
      comunidad: user.comunidad ?? '',
      password_actual: '',
      password_nueva: '',
    })
  }, [user])

  const requiresCurrentPassword = useMemo(() => {
    if (!user) return false
    return (
      form.username.trim() !== (user.username ?? '') ||
      form.email.trim() !== (user.email ?? '') ||
      form.password_nueva.length > 0
    )
  }, [form.email, form.password_nueva, form.username, user])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.username.trim() || !form.email.trim()) {
      setError('Usuario y correo son obligatorios.')
      return
    }
    if (form.password_nueva && form.password_nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (requiresCurrentPassword && !form.password_actual) {
      setError('Debes ingresar tu contraseña actual para cambiar usuario, correo o contraseña.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload: Record<string, string> = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        etnia: form.etnia,
        comunidad: form.comunidad.trim(),
      }
      if (requiresCurrentPassword) payload.password_actual = form.password_actual
      if (form.password_nueva) payload.password_nueva = form.password_nueva

      await apiFetch('/auth/perfil/', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      await refreshProfile()
      setForm(prev => ({ ...prev, password_actual: '', password_nueva: '' }))
      setSuccess('Perfil actualizado correctamente.')
    } catch (e) {
      setError(apiErr(e, 'No se pudo actualizar el perfil.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="eg-gate" style={{ minHeight: '70vh' }}>
      <div className="eg-gate-card" style={{ maxWidth: 560 }}>
        <div className="eg-gate-icon"><UserRound size={28} /></div>
        <h1 className="eg-gate-title">Mi perfil</h1>
        <p className="eg-gate-sub">
          {user?.rol_display ?? 'Usuario'}{user?.comunidad ? ` · ${user.comunidad}` : ''}
        </p>

        <form onSubmit={handleSubmit} className="eg-gate-form" noValidate>
          <input className="eg-gate-input" placeholder="Usuario *" autoComplete="username"
            value={form.username} onChange={e => { setForm({ ...form, username: e.target.value }); setError(''); setSuccess('') }} />
          <input className="eg-gate-input" placeholder="Correo *" type="email" autoComplete="email"
            value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); setError(''); setSuccess('') }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, width: '100%' }}>
            <input className="eg-gate-input" placeholder="Nombre" autoComplete="given-name"
              value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            <input className="eg-gate-input" placeholder="Apellido" autoComplete="family-name"
              value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, width: '100%' }}>
            <select className="eg-gate-input" value={form.etnia} onChange={e => setForm({ ...form, etnia: e.target.value })} aria-label="Etnia">
              <option value="">Sin etnia registrada</option>
              <option value="arhuaco">Arhuaco</option>
              <option value="kogui">Kogui</option>
            </select>
            <input className="eg-gate-input" placeholder="Comunidad" value={form.comunidad}
              onChange={e => setForm({ ...form, comunidad: e.target.value })} />
          </div>

          <div style={{ position: 'relative', width: '100%' }}>
            <input
              className="eg-gate-input"
              placeholder={requiresCurrentPassword ? 'Contraseña actual *' : 'Contraseña actual'}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password_actual}
              onChange={e => { setForm({ ...form, password_actual: e.target.value }); setError('') }}
            />
            <button
              type="button"
              className="gate-eye"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <input className="eg-gate-input" placeholder="Nueva contraseña (opcional)" type={showPassword ? 'text' : 'password'}
            autoComplete="new-password" value={form.password_nueva}
            onChange={e => { setForm({ ...form, password_nueva: e.target.value }); setError('') }} />

          {requiresCurrentPassword && (
            <p className="ent-hint">
              Para cambiar usuario, correo o contraseña debes confirmar tu contraseña actual.
            </p>
          )}

          {error && <p className="eg-gate-err" role="alert"><AlertCircle size={14} aria-hidden="true" /> {error}</p>}
          {success && <p className="ent-hint" role="status" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} color="var(--green, #16a34a)" /> {success}
          </p>}

          <button type="submit" className="eg-gate-btn" disabled={saving}>
            <Save size={15} aria-hidden="true" /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}
