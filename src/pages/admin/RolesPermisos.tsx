import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AlertCircle, Ban, Boxes, CheckCircle2, Edit2, KeyRound, Layers3, Loader2,
  Plus, RefreshCw, RotateCcw, Save, ShieldCheck, Trash2, X,
  Users, Table2,
} from 'lucide-react'
import { apiErr, apiFetch } from '../../api'
import { useAuth } from '../../context/AuthContext'

type Tab = 'roles' | 'modulos' | 'submodulos' | 'permisos' | 'matriz'

interface Rol {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  es_sistema?: boolean
  activo: boolean
  total_usuarios?: number
  total_permisos?: number
}

interface Permiso {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  activo?: boolean
  modulo_codigo?: string
  submodulo_codigo?: string | null
}

interface Submodulo {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  orden?: number
  activo: boolean
  permisos?: Permiso[]
}

interface Modulo {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  orden?: number
  activo: boolean
  permisos?: Permiso[]
  submodulos?: Submodulo[]
}

interface MatrizResponse {
  roles: Pick<Rol, 'id' | 'codigo' | 'nombre'>[]
  modulos: Array<{
    modulo: string
    nombre: string
    permisos: Array<{
      permiso: string
      permiso_id: number
      submodulo?: string | null
      roles: Record<string, boolean>
    }>
  }>
}

type EntityKind = 'rol' | 'modulo' | 'submodulo' | 'permiso'
type EntityForm = {
  codigo: string
  nombre: string
  descripcion: string
  orden: string
  activo: boolean
}

const blankForm = (): EntityForm => ({
  codigo: '',
  nombre: '',
  descripcion: '',
  orden: '0',
  activo: true,
})

function activeBadge(active: boolean) {
  return <span className={`gl-badge ${active ? 'gl-badge--green' : 'gl-badge--gray'}`}>{active ? 'Activo' : 'Inactivo'}</span>
}

function systemBadge(system?: boolean) {
  return system ? <span className="gl-badge gl-badge--blue">Sistema</span> : <span className="gl-badge gl-badge--gray">Personalizado</span>
}

function listFromResponse<T>(data: T[] | Record<string, unknown>, key: string): T[] {
  if (Array.isArray(data)) return data
  const value = data[key]
  return Array.isArray(value) ? value as T[] : []
}

export default function RolesPermisos() {
  const { refreshProfile } = useAuth()
  const [tab, setTab] = useState<Tab>('roles')
  const [roles, setRoles] = useState<Rol[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [matriz, setMatriz] = useState<MatrizResponse | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [selectedPermIds, setSelectedPermIds] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [modal, setModal] = useState<{
    kind: EntityKind
    parentId?: number
    item?: Rol | Modulo | Submodulo | Permiso
    form: EntityForm
  } | null>(null)

  const allPermissions = useMemo(() => {
    const list: Array<Permiso & { scope: string }> = []
    modulos.forEach(m => {
      m.permisos?.forEach(p => list.push({ ...p, modulo_codigo: m.codigo, scope: m.nombre }))
      m.submodulos?.forEach(s => {
        s.permisos?.forEach(p => list.push({
          ...p,
          modulo_codigo: m.codigo,
          submodulo_codigo: s.codigo,
          scope: `${m.nombre} / ${s.nombre}`,
        }))
      })
    })
    return list
  }, [modulos])

  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? null
  const allSubmodules = useMemo(() => (
    modulos.flatMap(m => (m.submodulos ?? []).map(s => ({
      ...s,
      modulo_id: m.id,
      modulo_nombre: m.nombre,
      modulo_codigo: m.codigo,
    })))
  ), [modulos])

  const loadCatalogs = useCallback(async () => {
    setLoading(true); setError(''); setNotice('')
    try {
      const [rolesData, modulosData, matrizData] = await Promise.all([
        apiFetch('/admin/roles/') as Promise<Rol[] | { roles?: Rol[] }>,
        apiFetch('/admin/modulos/') as Promise<Modulo[] | { modulos?: Modulo[] }>,
        apiFetch('/admin/matriz/') as Promise<MatrizResponse>,
      ])
      const rolesList = listFromResponse<Rol>(rolesData, 'roles')
      const baseModulos = listFromResponse<Modulo>(modulosData, 'modulos')
      const modulosList = await Promise.all(baseModulos.map(async m => {
        try {
          const subData = await apiFetch(`/admin/modulos/${m.id}/submodulos/`) as Submodulo[] | { submodulos?: Submodulo[]; results?: Submodulo[] }
          return {
            ...m,
            submodulos: Array.isArray(subData)
              ? subData
              : subData.submodulos ?? subData.results ?? m.submodulos ?? [],
          }
        } catch {
          return { ...m, submodulos: m.submodulos ?? [] }
        }
      }))
      setRoles(rolesList)
      setModulos(modulosList)
      setMatriz(matrizData)
      setSelectedRoleId(current => current ?? rolesList[0]?.id ?? null)
    } catch (e) {
      setError(apiErr(e, 'No se pudo cargar la administración de roles y permisos.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCatalogs() }, [loadCatalogs])

  useEffect(() => {
    if (!selectedRole || !matriz) {
      setSelectedPermIds(new Set())
      return
    }
    const next = new Set<number>()
    matriz.modulos.forEach(m => {
      m.permisos.forEach(p => {
        if (p.roles[selectedRole.codigo]) next.add(p.permiso_id)
      })
    })
    setSelectedPermIds(next)
  }, [matriz, selectedRole])

  const openCreate = (kind: EntityKind, parentId?: number) => {
    setModal({ kind, parentId, form: blankForm() })
  }

  const openEdit = (kind: EntityKind, item: Rol | Modulo | Submodulo | Permiso, parentId?: number) => {
    setModal({
      kind,
      parentId,
      item,
      form: {
        codigo: item.codigo,
        nombre: item.nombre,
        descripcion: item.descripcion ?? '',
        orden: 'orden' in item && item.orden !== undefined ? String(item.orden) : '0',
        activo: item.activo ?? true,
      },
    })
  }

  const closeModal = () => setModal(null)

  const modalTitle = () => {
    if (!modal) return ''
    const action = modal.item ? 'Editar' : 'Crear'
    const labels: Record<EntityKind, string> = {
      rol: 'rol',
      modulo: 'módulo',
      submodulo: 'submódulo',
      permiso: 'permiso',
    }
    return `${action} ${labels[modal.kind]}`
  }

  const saveEntity = async () => {
    if (!modal) return
    if (!modal.form.codigo.trim() || !modal.form.nombre.trim()) {
      setError('Código y nombre son obligatorios.')
      return
    }

    const payload: Record<string, unknown> = {
      codigo: modal.form.codigo.trim(),
      nombre: modal.form.nombre.trim(),
      descripcion: modal.form.descripcion.trim(),
      activo: modal.form.activo,
    }
    if (modal.kind === 'modulo' || modal.kind === 'submodulo') {
      payload.orden = Number(modal.form.orden) || 0
    }

    const isEdit = Boolean(modal.item)
    const id = modal.item?.id
    let path = ''

    if (modal.kind === 'rol') path = isEdit ? `/admin/roles/${id}/` : '/admin/roles/'
    if (modal.kind === 'modulo') path = isEdit ? `/admin/modulos/${id}/` : '/admin/modulos/'
    if (modal.kind === 'submodulo') path = isEdit ? `/admin/submodulos/${id}/` : `/admin/modulos/${modal.parentId}/submodulos/`
    if (modal.kind === 'permiso') {
      path = isEdit
        ? `/admin/permisos/${id}/`
        : modal.parentId && modal.parentId < 0
          ? `/admin/modulos/${Math.abs(modal.parentId)}/permisos/`
          : `/admin/submodulos/${modal.parentId}/permisos/`
    }

    setSaving(true); setError(''); setNotice('')
    try {
      await apiFetch(path, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
      closeModal()
      setNotice('Cambios guardados.')
      await loadCatalogs()
      await refreshProfile()
    } catch (e) {
      setError(apiErr(e, 'No se pudo guardar.'))
    } finally {
      setSaving(false)
    }
  }

  const deleteEntity = async (kind: EntityKind, id: number, hard = false) => {
    const paths: Record<EntityKind, string> = {
      rol: `/admin/roles/${id}/`,
      modulo: `/admin/modulos/${id}/`,
      submodulo: `/admin/submodulos/${id}/`,
      permiso: `/admin/permisos/${id}/`,
    }
    setSaving(true); setError(''); setNotice('')
    try {
      await apiFetch(`${paths[kind]}${hard ? '?hard=true' : ''}`, { method: 'DELETE' })
      setNotice(hard ? 'Registro borrado definitivamente.' : 'Registro desactivado.')
      await loadCatalogs()
      await refreshProfile()
    } catch (e) {
      setError(apiErr(e, 'No se pudo eliminar o desactivar.'))
    } finally {
      setSaving(false)
    }
  }

  const saveRolePermissions = async () => {
    if (!selectedRole) return
    setSaving(true); setError(''); setNotice('')
    try {
      await apiFetch(`/admin/roles/${selectedRole.id}/permisos/`, {
        method: 'PUT',
        body: JSON.stringify({ permiso_ids: Array.from(selectedPermIds) }),
      })
      setNotice(`Permisos actualizados para ${selectedRole.nombre}.`)
      await loadCatalogs()
      await refreshProfile()
    } catch (e) {
      setError(apiErr(e, 'No se pudo actualizar la matriz del rol.'))
    } finally {
      setSaving(false)
    }
  }

  const togglePermission = (id: number) => {
    setSelectedPermIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="gl-page">
      <div className="gl-page-header">
        <div className="container">
          <h1 className="gl-page-title"><ShieldCheck size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Roles, módulos y permisos</h1>
          <p className="gl-page-sub">Catálogo administrable para decidir qué puede usar cada rol en SAYTA</p>
        </div>
      </div>

      <div className="gl-tabs-bar">
        <div className="container">
          <div className="gl-tabs rmp-admin-tabs" role="tablist" aria-label="Administración">
            <NavLink to="/admin/usuarios" className={({ isActive }) => `gl-tab ${isActive ? 'gl-tab--active' : ''}`}>
              <Users size={15} /> Usuarios
            </NavLink>
            <NavLink to="/admin/roles" className={({ isActive }) => `gl-tab ${isActive ? 'gl-tab--active' : ''}`}>
              <KeyRound size={15} /> Roles y permisos
            </NavLink>
          </div>
          <div className="gl-tabs" role="tablist" aria-label="Administración de permisos">
            <button className={`gl-tab ${tab === 'roles' ? 'gl-tab--active' : ''}`} onClick={() => setTab('roles')}><KeyRound size={15} /> Roles</button>
            <button className={`gl-tab ${tab === 'modulos' ? 'gl-tab--active' : ''}`} onClick={() => setTab('modulos')}><Boxes size={15} /> Módulos</button>
            <button className={`gl-tab ${tab === 'submodulos' ? 'gl-tab--active' : ''}`} onClick={() => setTab('submodulos')}><Layers3 size={15} /> Submódulos</button>
            <button className={`gl-tab ${tab === 'permisos' ? 'gl-tab--active' : ''}`} onClick={() => setTab('permisos')}><ShieldCheck size={15} /> Permisos</button>
            <button className={`gl-tab ${tab === 'matriz' ? 'gl-tab--active' : ''}`} onClick={() => setTab('matriz')}><Table2 size={15} /> Matriz</button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="gl-tab-content">
          <div className="gl-toolbar">
            <button className="eg-btn eg-btn--ghost" onClick={loadCatalogs} disabled={loading || saving}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
            </button>
            {tab === 'roles' && <button className="eg-btn eg-btn--primary" onClick={() => openCreate('rol')}><Plus size={14} /> Nuevo rol</button>}
            {tab === 'modulos' && <button className="eg-btn eg-btn--primary" onClick={() => openCreate('modulo')}><Plus size={14} /> Nuevo módulo</button>}
          </div>

          {error && <div className="gl-alert" role="alert"><AlertCircle size={16} /> {error}</div>}
          {notice && <div className="gl-alert gl-alert--info" role="status"><CheckCircle2 size={16} /> {notice}</div>}

          {loading ? (
            <div className="gl-loading"><Loader2 size={20} className="spin" /> Cargando administración…</div>
          ) : tab === 'roles' ? (
            <RolesTable
              roles={roles}
              saving={saving}
              onEdit={r => openEdit('rol', r)}
              onDelete={(id, hard) => deleteEntity('rol', id, hard)}
            />
          ) : tab === 'modulos' ? (
            <ModulesTable
              modulos={modulos}
              saving={saving}
              onEditModulo={m => openEdit('modulo', m)}
              onEditSubmodulo={s => openEdit('submodulo', s)}
              onEditPermiso={p => openEdit('permiso', p)}
              onCreateSubmodulo={moduleId => openCreate('submodulo', moduleId)}
              onCreateModuloPermiso={moduleId => openCreate('permiso', -moduleId)}
              onCreateSubmoduloPermiso={submoduleId => openCreate('permiso', submoduleId)}
              onDelete={deleteEntity}
            />
          ) : tab === 'submodulos' ? (
            <SubmodulesTable
              submodulos={allSubmodules}
              modulos={modulos}
              saving={saving}
              onCreateSubmodulo={moduleId => openCreate('submodulo', moduleId)}
              onEditSubmodulo={s => openEdit('submodulo', s)}
              onCreateSubmoduloPermiso={submoduleId => openCreate('permiso', submoduleId)}
              onDelete={deleteEntity}
            />
          ) : tab === 'permisos' ? (
            <PermissionsTable
              permissions={allPermissions}
              modulos={modulos}
              saving={saving}
              onCreateModuloPermiso={moduleId => openCreate('permiso', -moduleId)}
              onCreateSubmoduloPermiso={submoduleId => openCreate('permiso', submoduleId)}
              onEditPermiso={p => openEdit('permiso', p)}
              onDelete={deleteEntity}
            />
          ) : (
            <MatrixEditor
              roles={roles}
              selectedRoleId={selectedRoleId}
              selectedPermIds={selectedPermIds}
              permissions={allPermissions}
              matriz={matriz}
              saving={saving}
              onSelectRole={setSelectedRoleId}
              onTogglePermission={togglePermission}
              onSave={saveRolePermissions}
            />
          )}
        </div>
      </div>

      {modal && (
        <div className="gl-modal-overlay" onClick={closeModal}>
          <div className="gl-modal" onClick={e => e.stopPropagation()}>
            <div className="gl-modal-header">
              <h2 className="gl-modal-title">{modalTitle()}</h2>
              <button className="vk-floating-close" onClick={closeModal} type="button"><X size={18} /></button>
            </div>
            <div className="gl-modal-body">
              <div className="gl-field">
                <label className="gl-field-label">Código *</label>
                <input className="gl-input" value={modal.form.codigo} onChange={e => setModal({ ...modal, form: { ...modal.form, codigo: e.target.value } })} placeholder="ej. reportes" />
              </div>
              <div className="gl-field">
                <label className="gl-field-label">Nombre *</label>
                <input className="gl-input" value={modal.form.nombre} onChange={e => setModal({ ...modal, form: { ...modal.form, nombre: e.target.value } })} placeholder="Nombre visible" />
              </div>
              <div className="gl-field">
                <label className="gl-field-label">Descripción</label>
                <textarea className="gl-input gl-textarea" value={modal.form.descripcion} onChange={e => setModal({ ...modal, form: { ...modal.form, descripcion: e.target.value } })} />
              </div>
              {(modal.kind === 'modulo' || modal.kind === 'submodulo') && (
                <div className="gl-field">
                  <label className="gl-field-label">Orden</label>
                  <input className="gl-input" type="number" value={modal.form.orden} onChange={e => setModal({ ...modal, form: { ...modal.form, orden: e.target.value } })} />
                </div>
              )}
              <label className="gl-checkbox-row">
                <input type="checkbox" checked={modal.form.activo} onChange={e => setModal({ ...modal, form: { ...modal.form, activo: e.target.checked } })} />
                Activo
              </label>
            </div>
            <div className="gl-modal-footer">
              <button className="eg-btn eg-btn--ghost" onClick={closeModal} type="button">Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={saveEntity} disabled={saving} type="button">
                {saving ? <><Loader2 size={14} className="spin" /> Guardando…</> : <><Save size={14} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RolesTable({
  roles, saving, onEdit, onDelete,
}: {
  roles: Rol[]
  saving: boolean
  onEdit: (role: Rol) => void
  onDelete: (id: number, hard?: boolean) => void
}) {
  if (roles.length === 0) return <div className="gl-empty"><KeyRound size={32} /><p>No hay roles registrados.</p></div>

  return (
    <div className="gl-table-wrap">
      <table className="gl-table">
        <thead><tr><th>Rol</th><th>Estado</th><th>Tipo</th><th>Usuarios</th><th>Permisos</th><th>Descripción</th><th>Acciones</th></tr></thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id} className={!r.activo ? 'gl-tr--inactive' : ''}>
              <td><strong>{r.nombre}</strong><br /><span className="gl-td-gray">{r.codigo}</span></td>
              <td>{activeBadge(r.activo)}</td>
              <td>{systemBadge(r.es_sistema)}</td>
              <td>{r.total_usuarios ?? 0}</td>
              <td>{r.total_permisos ?? 0}</td>
              <td className="gl-td-clamp" title={r.descripcion}>{r.descripcion || '—'}</td>
              <td>
                <div className="gl-row-actions">
                  <button className="eg-btn eg-btn--ghost" onClick={() => onEdit(r)}><Edit2 size={13} /> Editar</button>
                  <button className="eg-btn eg-btn--danger" disabled={saving || r.es_sistema} onClick={() => onDelete(r.id)} title={r.es_sistema ? 'Un rol de sistema no se borra; puedes desactivarlo editándolo.' : undefined}>
                    <Trash2 size={13} /> Borrar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ModulesTable({
  modulos, saving, onEditModulo, onEditSubmodulo, onEditPermiso,
  onCreateSubmodulo, onCreateModuloPermiso, onCreateSubmoduloPermiso, onDelete,
}: {
  modulos: Modulo[]
  saving: boolean
  onEditModulo: (modulo: Modulo) => void
  onEditSubmodulo: (submodulo: Submodulo) => void
  onEditPermiso: (permiso: Permiso) => void
  onCreateSubmodulo: (moduleId: number) => void
  onCreateModuloPermiso: (moduleId: number) => void
  onCreateSubmoduloPermiso: (submoduleId: number) => void
  onDelete: (kind: EntityKind, id: number, hard?: boolean) => void
}) {
  if (modulos.length === 0) return <div className="gl-empty"><Boxes size={32} /><p>No hay módulos registrados.</p></div>

  return (
    <div className="rmp-module-list">
      {modulos.map(m => (
        <section key={m.id} className="rmp-module">
          <div className="rmp-module-head">
            <div>
              <h2 className="rmp-module-title"><Layers3 size={17} /> {m.nombre}</h2>
              <p className="rmp-module-meta">{m.codigo} · orden {m.orden ?? 0} · {m.descripcion || 'Sin descripción'}</p>
            </div>
            <div className="gl-row-actions">
              {activeBadge(m.activo)}
              <button className="eg-btn eg-btn--ghost" onClick={() => onEditModulo(m)}><Edit2 size={13} /> Editar</button>
              <button className="eg-btn eg-btn--ghost" onClick={() => onCreateModuloPermiso(m.id)}><Plus size={13} /> Permiso</button>
              <button className="eg-btn eg-btn--ghost" onClick={() => onCreateSubmodulo(m.id)}><Plus size={13} /> Submódulo</button>
              <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('modulo', m.id)}><Ban size={13} /> Desactivar</button>
              <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('modulo', m.id, true)}><Trash2 size={13} /> Borrar definitivo</button>
            </div>
          </div>

          <PermissionChips permissions={m.permisos ?? []} onEdit={onEditPermiso} onDelete={(id, hard) => onDelete('permiso', id, hard)} />

          <div className="rmp-submodule-list">
            {(m.submodulos ?? []).map(s => (
              <div key={s.id} className="rmp-submodule">
                <div className="rmp-submodule-head">
                  <div>
                    <strong>{s.nombre}</strong>
                    <span className="gl-td-gray"> · {s.codigo} · orden {s.orden ?? 0}</span>
                  </div>
                  <div className="gl-row-actions">
                    {activeBadge(s.activo)}
                    <button className="eg-btn eg-btn--ghost" onClick={() => onEditSubmodulo(s)}><Edit2 size={13} /> Editar</button>
                    <button className="eg-btn eg-btn--ghost" onClick={() => onCreateSubmoduloPermiso(s.id)}><Plus size={13} /> Permiso</button>
                    <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('submodulo', s.id)}><Ban size={13} /> Desactivar</button>
                    <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('submodulo', s.id, true)}><Trash2 size={13} /> Borrar definitivo</button>
                  </div>
                </div>
                <p className="rmp-submodule-desc">{s.descripcion || 'Sin descripción'}</p>
                <PermissionChips permissions={s.permisos ?? []} onEdit={onEditPermiso} onDelete={(id, hard) => onDelete('permiso', id, hard)} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SubmodulesTable({
  submodulos, modulos, saving, onCreateSubmodulo, onEditSubmodulo, onCreateSubmoduloPermiso, onDelete,
}: {
  submodulos: Array<Submodulo & { modulo_id: number; modulo_nombre: string; modulo_codigo: string }>
  modulos: Modulo[]
  saving: boolean
  onCreateSubmodulo: (moduleId: number) => void
  onEditSubmodulo: (submodulo: Submodulo) => void
  onCreateSubmoduloPermiso: (submoduleId: number) => void
  onDelete: (kind: EntityKind, id: number, hard?: boolean) => void
}) {
  return (
    <>
      <div className="gl-toolbar">
        <label className="gl-field" style={{ minWidth: 260 }}>
          <span className="gl-field-label">Crear submódulo en</span>
          <select className="gl-select" onChange={e => e.target.value && onCreateSubmodulo(Number(e.target.value))} value="">
            <option value="">Selecciona un módulo</option>
            {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
      </div>
      {submodulos.length === 0 ? (
        <div className="gl-empty"><Layers3 size={32} /><p>No hay submódulos registrados.</p></div>
      ) : (
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead><tr><th>Submódulo</th><th>Módulo</th><th>Estado</th><th>Orden</th><th>Descripción</th><th>Acciones</th></tr></thead>
            <tbody>
              {submodulos.map(s => (
                <tr key={s.id} className={!s.activo ? 'gl-tr--inactive' : ''}>
                  <td><strong>{s.nombre}</strong><br /><span className="gl-td-gray">{s.codigo}</span></td>
                  <td>{s.modulo_nombre}<br /><span className="gl-td-gray">{s.modulo_codigo}</span></td>
                  <td>{activeBadge(s.activo)}</td>
                  <td>{s.orden ?? 0}</td>
                  <td className="gl-td-clamp" title={s.descripcion}>{s.descripcion || '—'}</td>
                  <td>
                    <div className="gl-row-actions">
                      <button className="eg-btn eg-btn--ghost" onClick={() => onEditSubmodulo(s)}><Edit2 size={13} /> Editar</button>
                      <button className="eg-btn eg-btn--ghost" onClick={() => onCreateSubmoduloPermiso(s.id)}><Plus size={13} /> Permiso</button>
                      <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('submodulo', s.id)}><Ban size={13} /> Desactivar</button>
                      <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('submodulo', s.id, true)}><Trash2 size={13} /> Borrar definitivo</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function PermissionsTable({
  permissions, modulos, saving, onCreateModuloPermiso, onCreateSubmoduloPermiso, onEditPermiso, onDelete,
}: {
  permissions: Array<Permiso & { scope: string }>
  modulos: Modulo[]
  saving: boolean
  onCreateModuloPermiso: (moduleId: number) => void
  onCreateSubmoduloPermiso: (submoduleId: number) => void
  onEditPermiso: (permiso: Permiso) => void
  onDelete: (kind: EntityKind, id: number, hard?: boolean) => void
}) {
  const submodulos = modulos.flatMap(m => (m.submodulos ?? []).map(s => ({ ...s, modulo_nombre: m.nombre })))
  return (
    <>
      <div className="gl-toolbar">
        <label className="gl-field" style={{ minWidth: 240 }}>
          <span className="gl-field-label">Permiso de módulo</span>
          <select className="gl-select" onChange={e => e.target.value && onCreateModuloPermiso(Number(e.target.value))} value="">
            <option value="">Selecciona módulo</option>
            {modulos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <label className="gl-field" style={{ minWidth: 260 }}>
          <span className="gl-field-label">Permiso de submódulo</span>
          <select className="gl-select" onChange={e => e.target.value && onCreateSubmoduloPermiso(Number(e.target.value))} value="">
            <option value="">Selecciona submódulo</option>
            {submodulos.map(s => <option key={s.id} value={s.id}>{s.modulo_nombre} / {s.nombre}</option>)}
          </select>
        </label>
      </div>
      {permissions.length === 0 ? (
        <div className="gl-empty"><ShieldCheck size={32} /><p>No hay permisos registrados.</p></div>
      ) : (
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead><tr><th>Permiso</th><th>Ámbito</th><th>Estado</th><th>Descripción</th><th>Acciones</th></tr></thead>
            <tbody>
              {permissions.map(p => (
                <tr key={p.id} className={p.activo === false ? 'gl-tr--inactive' : ''}>
                  <td><strong>{p.nombre}</strong><br /><span className="gl-td-gray">{p.codigo}</span></td>
                  <td>{p.scope}</td>
                  <td>{activeBadge(p.activo !== false)}</td>
                  <td className="gl-td-clamp" title={p.descripcion}>{p.descripcion || '—'}</td>
                  <td>
                    <div className="gl-row-actions">
                      <button className="eg-btn eg-btn--ghost" onClick={() => onEditPermiso(p)}><Edit2 size={13} /> Editar</button>
                      <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('permiso', p.id)}><Ban size={13} /> Desactivar</button>
                      <button className="eg-btn eg-btn--danger" disabled={saving} onClick={() => onDelete('permiso', p.id, true)}><Trash2 size={13} /> Borrar definitivo</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function PermissionChips({
  permissions, onEdit, onDelete,
}: {
  permissions: Permiso[]
  onEdit: (permiso: Permiso) => void
  onDelete: (id: number, hard?: boolean) => void
}) {
  if (permissions.length === 0) return <p className="rmp-empty-line">Sin permisos directos.</p>
  return (
    <div className="rmp-permission-chips">
      {permissions.map(p => (
        <span key={p.id} className={`rmp-permission-chip ${p.activo === false ? 'is-inactive' : ''}`}>
          <KeyRound size={12} />
          {p.codigo}
          <button type="button" onClick={() => onEdit(p)} aria-label={`Editar permiso ${p.codigo}`}><Edit2 size={11} /></button>
          <button type="button" onClick={() => onDelete(p.id)} aria-label={`Desactivar permiso ${p.codigo}`}><Ban size={11} /></button>
          <button type="button" onClick={() => onDelete(p.id, true)} aria-label={`Borrar definitivamente permiso ${p.codigo}`}><Trash2 size={11} /></button>
        </span>
      ))}
    </div>
  )
}

function MatrixEditor({
  roles, selectedRoleId, selectedPermIds, permissions, matriz, saving,
  onSelectRole, onTogglePermission, onSave,
}: {
  roles: Rol[]
  selectedRoleId: number | null
  selectedPermIds: Set<number>
  permissions: Array<Permiso & { scope: string }>
  matriz: MatrizResponse | null
  saving: boolean
  onSelectRole: (id: number) => void
  onTogglePermission: (id: number) => void
  onSave: () => void
}) {
  const grouped = permissions.reduce<Record<string, Array<Permiso & { scope: string }>>>((acc, p) => {
    acc[p.scope] ??= []
    acc[p.scope].push(p)
    return acc
  }, {})

  return (
    <>
      <div className="gl-toolbar">
        <label className="gl-field" style={{ minWidth: 260 }}>
          <span className="gl-field-label">Rol a configurar</span>
          <select className="gl-select" value={selectedRoleId ?? ''} onChange={e => onSelectRole(Number(e.target.value))}>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre} ({r.codigo})</option>)}
          </select>
        </label>
        <button className="eg-btn eg-btn--primary" onClick={onSave} disabled={!selectedRoleId || saving}>
          {saving ? <><Loader2 size={14} className="spin" /> Guardando…</> : <><Save size={14} /> Reemplazar permisos del rol</>}
        </button>
        <span className="ent-hint">{selectedPermIds.size} permiso{selectedPermIds.size !== 1 ? 's' : ''} seleccionado{selectedPermIds.size !== 1 ? 's' : ''}</span>
      </div>

      {matriz && (
        <div className="gl-table-wrap">
          <table className="gl-table rmp-matrix-table">
            <thead>
              <tr>
                <th>Módulo / permiso</th>
                {matriz.roles.map(r => <th key={r.codigo}>{r.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {matriz.modulos.flatMap(m => m.permisos.map(p => (
                <tr key={`${m.modulo}-${p.permiso_id}`}>
                  <td>
                    <strong>{m.nombre}</strong><br />
                    <span className="gl-td-gray">{p.submodulo ? `${p.submodulo} / ` : ''}{p.permiso}</span>
                  </td>
                  {matriz.roles.map(r => (
                    <td key={`${p.permiso_id}-${r.codigo}`}>
                      <span className={`gl-badge ${p.roles[r.codigo] ? 'gl-badge--green' : 'gl-badge--gray'}`}>
                        {p.roles[r.codigo] ? 'Sí' : 'No'}
                      </span>
                    </td>
                  ))}
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rmp-matrix">
        {Object.entries(grouped).map(([scope, list]) => (
          <section key={scope} className="rmp-matrix-group">
            <h2 className="rmp-matrix-title">{scope}</h2>
            <div className="rmp-matrix-checks">
              {list.map(p => (
                <label key={p.id} className={`rmp-permission-check ${selectedPermIds.has(p.id) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={selectedPermIds.has(p.id)} onChange={() => onTogglePermission(p.id)} />
                  <span>
                    <strong>{p.codigo}</strong>
                    <small>{p.nombre}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
        {permissions.length === 0 && <div className="gl-empty"><RotateCcw size={32} /><p>No hay permisos disponibles para asignar.</p></div>}
      </div>
    </>
  )
}
