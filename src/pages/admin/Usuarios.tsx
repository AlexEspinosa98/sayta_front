import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Edit2, Ban, RotateCcw, X, Loader2, AlertCircle, ShieldCheck,
} from 'lucide-react'
import { apiFetch, apiErr } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { ROLES_REGISTRABLES } from '../../permissions'

interface Usuario {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  rol: string
  rol_display: string
  date_joined: string
}

type RegistroForm = {
  username: string; email: string; password: string
  first_name: string; last_name: string; rol: string
}

const emptyRegistro = (): RegistroForm =>
  ({ username: '', email: '', password: '', first_name: '', last_name: '', rol: 'consultor' })

type EditForm = { email: string; first_name: string; last_name: string; rol: string; password: string }

function roleBadgeClass(rol: string) {
  if (rol === 'admin') return 'gl-badge--red'
  if (rol === 'desarrollador' || rol === 'investigador') return 'gl-badge--blue'
  if (rol === 'anotador' || rol === 'colaborador_lengua') return 'gl-badge--yellow'
  return 'gl-badge--gray'
}

export default function Usuarios() {
  const { user: currentUser } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<RegistroForm>(emptyRegistro())
  const [createErr, setCreateErr]   = useState('')
  const [saving, setSaving]         = useState(false)

  const [editing, setEditing]   = useState<Usuario | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ email: '', first_name: '', last_name: '', rol: '', password: '' })
  const [editErr, setEditErr]   = useState('')

  const [confirmDeactivate, setConfirmDeactivate] = useState<Usuario | null>(null)
  const [deactivateErr, setDeactivateErr]         = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/auth/usuarios/') as { total: number; usuarios: Usuario[] }
      setUsuarios(data.usuarios ?? [])
    } catch (e) {
      setError(apiErr(e, 'No se pudo cargar la lista de usuarios.'))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setCreateForm(emptyRegistro()); setCreateErr(''); setShowCreate(true) }
  const closeCreate = () => setShowCreate(false)

  const handleCreate = async () => {
    if (!createForm.username.trim() || !createForm.email.trim() || createForm.password.length < 8) {
      setCreateErr('Usuario, correo y una contraseña de al menos 8 caracteres son requeridos.')
      return
    }
    setSaving(true); setCreateErr('')
    try {
      await apiFetch('/auth/registro/', { method: 'POST', body: JSON.stringify(createForm) })
      closeCreate(); load()
    } catch (e) {
      setCreateErr(apiErr(e, 'Error al registrar el usuario.'))
    } finally { setSaving(false) }
  }

  const openEdit = (u: Usuario) => {
    setEditForm({ email: u.email, first_name: u.first_name, last_name: u.last_name, rol: u.rol, password: '' })
    setEditErr(''); setEditing(u)
  }
  const closeEdit = () => setEditing(null)

  const handleEdit = async () => {
    if (!editing) return
    setSaving(true); setEditErr('')
    try {
      const body: Record<string, unknown> = {
        email: editForm.email, first_name: editForm.first_name,
        last_name: editForm.last_name, rol: editForm.rol,
      }
      if (editForm.password.trim()) body.password = editForm.password.trim()
      await apiFetch(`/auth/usuarios/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
      closeEdit(); load()
    } catch (e) {
      setEditErr(apiErr(e, 'Error al actualizar el usuario.'))
    } finally { setSaving(false) }
  }

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return
    setSaving(true); setDeactivateErr('')
    try {
      await apiFetch(`/auth/usuarios/${confirmDeactivate.id}/`, { method: 'DELETE' })
      setConfirmDeactivate(null); load()
    } catch (e) {
      setDeactivateErr(apiErr(e, 'Error al desactivar el usuario.'))
    } finally { setSaving(false) }
  }

  const handleReactivate = async (u: Usuario) => {
    try {
      await apiFetch(`/auth/usuarios/${u.id}/`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) })
      load()
    } catch (e) { setError(apiErr(e, 'Error al reactivar el usuario.')) }
  }

  return (
    <div className="gl-page">
      <div className="gl-page-header">
        <div className="container">
          <h1 className="gl-page-title"><Users size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Administración de usuarios</h1>
          <p className="gl-page-sub">Registro y gestión de cuentas y roles del sistema SAYTA</p>
        </div>
      </div>

      <div className="container">
        <div className="gl-tab-content">
          <div className="gl-toolbar">
            <span className="ent-hint">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrados</span>
            <button className="eg-btn eg-btn--primary" onClick={openCreate}>
              <Plus size={15} /> Nuevo usuario
            </button>
            <button className="eg-btn eg-btn--ghost" onClick={load} disabled={loading}>
              Actualizar
            </button>
          </div>

          {error && <div className="gl-alert"><AlertCircle size={16} />{error}</div>}

          {loading ? (
            <div className="gl-loading"><Loader2 size={20} className="spin" /> Cargando…</div>
          ) : usuarios.length === 0 ? (
            <div className="gl-empty"><Users size={32} /><p>No hay usuarios registrados.</p></div>
          ) : (
            <div className="gl-table-wrap">
              <table className="gl-table">
                <thead>
                  <tr>
                    <th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} className={!u.is_active ? 'gl-tr--inactive' : ''}>
                      <td className="gl-td-bold">{u.username}</td>
                      <td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td className="gl-td-gray">{u.email}</td>
                      <td><span className={`gl-badge ${roleBadgeClass(u.rol)}`}>{u.rol_display}</span></td>
                      <td>
                        <span className={`gl-badge ${u.is_active ? 'gl-badge--green' : 'gl-badge--gray'}`}>
                          {u.is_active ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td>
                        <div className="gl-row-actions">
                          <button className="eg-btn eg-btn--ghost" onClick={() => openEdit(u)}><Edit2 size={13} /> Editar</button>
                          {u.is_active ? (
                            <button
                              className="eg-btn eg-btn--danger"
                              disabled={u.id === currentUser?.id}
                              title={u.id === currentUser?.id ? 'No puedes desactivar tu propia cuenta' : undefined}
                              onClick={() => { setConfirmDeactivate(u); setDeactivateErr('') }}
                            >
                              <Ban size={13} /> Desactivar
                            </button>
                          ) : (
                            <button className="eg-btn eg-btn--ghost" onClick={() => handleReactivate(u)}>
                              <RotateCcw size={13} /> Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Crear usuario */}
      {showCreate && (
        <div className="gl-modal-overlay" onClick={closeCreate}>
          <div className="gl-modal" onClick={e => e.stopPropagation()}>
            <div className="gl-modal-header">
              <h2 className="gl-modal-title"><ShieldCheck size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} />Nuevo usuario</h2>
              <button className="vk-floating-close" onClick={closeCreate} type="button"><X size={18} /></button>
            </div>
            <div className="gl-modal-body">
              <div className="gl-field"><label className="gl-field-label">Usuario *</label>
                <input className="gl-input" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} /></div>
              <div className="gl-field"><label className="gl-field-label">Correo *</label>
                <input className="gl-input" type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
              <div className="gl-field"><label className="gl-field-label">Contraseña *</label>
                <input className="gl-input" type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="mínimo 8 caracteres" /></div>
              <div className="gl-form-row">
                <div className="gl-field"><label className="gl-field-label">Nombre</label>
                  <input className="gl-input" value={createForm.first_name} onChange={e => setCreateForm({ ...createForm, first_name: e.target.value })} /></div>
                <div className="gl-field"><label className="gl-field-label">Apellido</label>
                  <input className="gl-input" value={createForm.last_name} onChange={e => setCreateForm({ ...createForm, last_name: e.target.value })} /></div>
              </div>
              <div className="gl-field"><label className="gl-field-label">Rol *</label>
                <select className="gl-select gl-input" value={createForm.rol} onChange={e => setCreateForm({ ...createForm, rol: e.target.value })}>
                  {ROLES_REGISTRABLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {createErr && <div className="gl-form-err"><AlertCircle size={14} />{createErr}</div>}
            </div>
            <div className="gl-modal-footer">
              <button className="eg-btn eg-btn--ghost" onClick={closeCreate}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={handleCreate} disabled={saving}>
                {saving ? <><Loader2 size={14} className="spin" /> Guardando…</> : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editar usuario */}
      {editing && (
        <div className="gl-modal-overlay" onClick={closeEdit}>
          <div className="gl-modal" onClick={e => e.stopPropagation()}>
            <div className="gl-modal-header">
              <h2 className="gl-modal-title">Editar: {editing.username}</h2>
              <button className="vk-floating-close" onClick={closeEdit} type="button"><X size={18} /></button>
            </div>
            <div className="gl-modal-body">
              <div className="gl-field"><label className="gl-field-label">Correo</label>
                <input className="gl-input" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="gl-form-row">
                <div className="gl-field"><label className="gl-field-label">Nombre</label>
                  <input className="gl-input" value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
                <div className="gl-field"><label className="gl-field-label">Apellido</label>
                  <input className="gl-input" value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
              </div>
              <div className="gl-field"><label className="gl-field-label">Rol</label>
                <select className="gl-select gl-input" value={editForm.rol} onChange={e => setEditForm({ ...editForm, rol: e.target.value })}>
                  {ROLES_REGISTRABLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="gl-field"><label className="gl-field-label" >Nueva contraseña</label>
                <input className="gl-input" type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="dejar vacío para no cambiar" /></div>
              {editErr && <div className="gl-form-err"><AlertCircle size={14} />{editErr}</div>}
            </div>
            <div className="gl-modal-footer">
              <button className="eg-btn eg-btn--ghost" onClick={closeEdit}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={handleEdit} disabled={saving}>
                {saving ? <><Loader2 size={14} className="spin" /> Guardando…</> : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar desactivación */}
      {confirmDeactivate && (
        <div className="gl-modal-overlay" onClick={() => setConfirmDeactivate(null)}>
          <div className="gl-modal" onClick={e => e.stopPropagation()}>
            <div className="gl-modal-header">
              <h2 className="gl-modal-title">Desactivar usuario</h2>
              <button className="vk-floating-close" onClick={() => setConfirmDeactivate(null)} type="button"><X size={18} /></button>
            </div>
            <div className="gl-modal-body">
              <p style={{ fontSize: '.93rem', color: 'var(--gray-700)', lineHeight: 1.6 }}>
                ¿Desactivar a <strong>{confirmDeactivate.username}</strong>? No podrá iniciar sesión, pero su historial se conserva.
              </p>
              {deactivateErr && <div className="gl-form-err"><AlertCircle size={14} />{deactivateErr}</div>}
            </div>
            <div className="gl-modal-footer">
              <button className="eg-btn eg-btn--ghost" onClick={() => setConfirmDeactivate(null)}>Cancelar</button>
              <button className="eg-btn eg-btn--danger" onClick={handleDeactivate} disabled={saving} style={{ background: 'var(--red)', color: '#fff' }}>
                {saving ? <><Loader2 size={14} className="spin" /> …</> : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
