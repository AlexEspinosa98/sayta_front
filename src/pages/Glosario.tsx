import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Edit2, Trash2, RefreshCw, Upload, Search, X,
  Loader2, CheckCircle2, AlertCircle,
  Zap, BookOpen, Globe, Cpu, RotateCcw, FileJson,
} from 'lucide-react'
import { apiFetch, API_BASE, getToken } from '../api'
import { useAuth } from '../context/AuthContext'

import {
  useSpecialKeyboard, SpecialKeyboardPanel, SpecialKeyboardToggle,
} from '../components/SpecialKeyboard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lengua {
  id: number
  codigo: string
  nombre: string
  descripcion: string
  activa: boolean
  total_terminos: number
  embedding_activo: { id: string; version: string; num_terminos: number } | null
  created_at: string
  updated_at: string
}

interface TerminoEs {
  id: number
  termino: string
  traducciones_count: number
}

interface Termino {
  id: number
  termino: string
  termino_es: number | null
  termino_es_detail: { id: number; termino: string } | null
  lengua: number
  lengua_detail: { id: number; codigo: string; nombre: string }
  definicion: string
  pos: string
  sinonimos: string[]
  ejemplos: string[]
  tipo_morfema: string | null
  activo: boolean
}

interface EmbeddingVersion {
  id: string
  lengua: number
  lengua_detail: { id: number; codigo: string; nombre: string }
  version: string
  model_name: string
  status: string
  status_display: string
  is_active: boolean
  num_terminos: number
  error_message: string
  task_id: string
  created_at: string
  completed_at: string | null
}

const POS_OPTIONS = [
  { value: '',         label: 'Sin definir' },
  { value: 'NOM',      label: 'NOM — Nombre' },
  { value: 'VRB',      label: 'VRB — Verbo' },
  { value: 'ADJ',      label: 'ADJ — Adjetivo' },
  { value: 'ADV',      label: 'ADV — Adverbio' },
  { value: 'NOM_PR',   label: 'NOM_PR — Nombre propio' },
  { value: 'PRON',     label: 'PRON — Pronombre' },
  { value: 'PREP',     label: 'PREP — Preposición' },
  { value: 'NOM_MASA', label: 'NOM_MASA — Nombre de masa' },
]

type Tab = 'lenguas' | 'terminos' | 'embeddings'

// ─────────────────────────────────────────────────────────────────────────────
// LENGUAS TAB
// ─────────────────────────────────────────────────────────────────────────────

function LenguasTab({ canManage }: { canManage: boolean }) {
  const [lenguas, setLenguas]   = useState<Lengua[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing]   = useState<Lengua | null>(null)
  const [deleting, setDeleting] = useState<Lengua | null>(null)
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')

  const [form, setForm] = useState({ codigo: '', nombre: '', descripcion: '', activa: true })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const data = await apiFetch(`/terminos/lenguas/${params}`)
      setLenguas(data.results ?? data)
    } catch { setError('No se pudo conectar con el servidor.') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm({ codigo: '', nombre: '', descripcion: '', activa: true })
    setFormErr(''); setModal('create')
  }
  const openEdit = (l: Lengua) => {
    setForm({ codigo: l.codigo, nombre: l.nombre, descripcion: l.descripcion, activa: l.activa })
    setEditing(l); setFormErr(''); setModal('edit')
  }
  const openDelete = (l: Lengua) => setDeleting(l)
  const closeModal = () => { setModal(null); setEditing(null) }

  const handleSave = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) { setFormErr('Código y nombre son requeridos.'); return }
    setSaving(true); setFormErr('')
    try {
      if (modal === 'create') {
        await apiFetch('/terminos/lenguas/', { method: 'POST', body: JSON.stringify(form) })
      } else if (editing) {
        await apiFetch(`/terminos/lenguas/${editing.id}/`, { method: 'PUT', body: JSON.stringify(form) })
      }
      closeModal(); load()
    } catch (e: unknown) {
      const d = (e as { data?: Record<string, unknown> })?.data
      const msg = (d?.codigo as string[] | undefined)?.[0] || (d?.nombre as string[] | undefined)?.[0] || (d?.detail as string | undefined) || 'Error al guardar.'
      setFormErr(msg)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setSaving(true)
    try {
      await apiFetch(`/terminos/lenguas/${deleting.id}/`, { method: 'DELETE' })
      setDeleting(null); load()
    } catch { setFormErr('Error al eliminar.') }
    finally { setSaving(false) }
  }

  return (
    <div className="gl-tab-content">
      <div className="gl-toolbar">
        <div className="gl-search-wrap">
          <Search size={15} className="gl-search-icon" />
          <input
            className="gl-search-input"
            placeholder="Buscar por nombre, código…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canManage && (
          <button className="eg-btn eg-btn--primary" onClick={openCreate}>
            <Plus size={15} /> Nueva lengua
          </button>
        )}
        <button className="eg-btn eg-btn--ghost" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      {error && <div className="gl-alert"><AlertCircle size={16} />{error}</div>}

      {loading ? (
        <div className="gl-loading"><Loader2 size={20} className="spin" /> Cargando…</div>
      ) : lenguas.length === 0 ? (
        <div className="gl-empty"><Globe size={32} /><p>No hay lenguas registradas.</p></div>
      ) : (
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead>
              <tr>
                <th>Código</th><th>Nombre</th><th>Descripción</th>
                <th>Términos</th><th>Embedding</th><th>Estado</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {lenguas.map(l => (
                <tr key={l.id}>
                  <td><span className="gl-badge gl-badge--blue">{l.codigo}</span></td>
                  <td className="gl-td-bold">{l.nombre}</td>
                  <td className="gl-td-gray gl-td-clamp">{l.descripcion || '—'}</td>
                  <td>{l.total_terminos.toLocaleString()}</td>
                  <td>
                    {l.embedding_activo
                      ? <span className="gl-badge gl-badge--green">{l.embedding_activo.version} · {l.embedding_activo.num_terminos.toLocaleString()}</span>
                      : <span className="gl-badge gl-badge--gray">Sin embedding</span>}
                  </td>
                  <td>
                    <span className={`gl-badge ${l.activa ? 'gl-badge--green' : 'gl-badge--gray'}`}>
                      {l.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="gl-row-actions">
                        <button className="eg-btn eg-btn--ghost" onClick={() => openEdit(l)}><Edit2 size={13} /> Editar</button>
                        <button className="eg-btn eg-btn--danger" onClick={() => openDelete(l)}><Trash2 size={13} /> Eliminar</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <LenguaModal
          title={modal === 'create' ? 'Nueva lengua' : 'Editar lengua'}
          form={form} setForm={setForm}
          error={formErr} saving={saving}
          onSave={handleSave} onClose={closeModal}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Eliminar lengua"
          message={`¿Eliminar permanentemente "${deleting.nombre}"? Se borrarán todos sus términos y embeddings.`}
          danger
          saving={saving}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

interface LenguaForm { codigo: string; nombre: string; descripcion: string; activa: boolean }
function LenguaModal({ title, form, setForm, error, saving, onSave, onClose }: {
  title: string
  form: LenguaForm
  setForm: (f: LenguaForm) => void
  error: string; saving: boolean
  onSave: () => void; onClose: () => void
}) {
  return (
    <div className="gl-modal-overlay" onClick={onClose}>
      <div className="gl-modal" onClick={e => e.stopPropagation()}>
        <div className="gl-modal-header">
          <h2 className="gl-modal-title">{title}</h2>
          <button className="vk-floating-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="gl-modal-body">
          <Field label="Código *" hint="Identificador único (ej: ette, iku)">
            <input className="gl-input" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="ette" />
          </Field>
          <Field label="Nombre *">
            <input className="gl-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ette Taara" />
          </Field>
          <Field label="Descripción">
            <textarea className="gl-input gl-textarea" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={3} placeholder="Descripción opcional…" />
          </Field>
          <label className="gl-checkbox-row">
            <input type="checkbox" checked={form.activa} onChange={e => setForm({ ...form, activa: e.target.checked })} />
            <span>Lengua activa</span>
          </label>
          {error && <div className="gl-form-err"><AlertCircle size={14} />{error}</div>}
        </div>
        <div className="gl-modal-footer">
          <button className="eg-btn eg-btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="eg-btn eg-btn--primary" onClick={onSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="spin" /> Guardando…</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TÉRMINOS TAB
// ─────────────────────────────────────────────────────────────────────────────

type TerminoFormState = {
  termino: string; lengua: string; termino_es_texto: string;
  definicion: string; pos: string; sinonimos: string; ejemplos: string; activo: boolean
}

function makeEmptyForm(lenguaId: string): TerminoFormState {
  return { termino: '', lengua: lenguaId, termino_es_texto: '', definicion: '', pos: '', sinonimos: '', ejemplos: '', activo: true }
}

function TerminosTab({ lenguas, canManage }: { lenguas: Lengua[]; canManage: boolean }) {
  const [terminos, setTerminos]         = useState<Termino[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [filterLengua, setFilterLengua] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterPos, setFilterPos]       = useState('')
  const [filterActivo, setFilterActivo] = useState('true')
  const [count, setCount]               = useState(0)
  const [page, setPage]                 = useState(1)

  const [formMode, setFormMode]   = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing]     = useState<Termino | null>(null)
  const [form, setForm]           = useState<TerminoFormState>(makeEmptyForm(''))
  const [saving, setSaving]       = useState(false)
  const [formErr, setFormErr]     = useState('')

  const [showBulk, setShowBulk]           = useState(false)
  const [deleting, setDeleting]           = useState<Termino | null>(null)
  const [restoring, setRestoring]         = useState<Termino | null>(null)
  const [confirmSaving, setConfirmSaving] = useState(false)

  const load = useCallback(async () => {
    if (!filterLengua) { setTerminos([]); setCount(0); return }
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ lengua: filterLengua, page: String(page) })
      if (filterSearch) params.set('search', filterSearch)
      if (filterPos)    params.set('pos', filterPos)
      if (filterActivo) params.set('activo', filterActivo)
      const data = await apiFetch(`/terminos/terminos/?${params}`)
      setTerminos(data.results ?? [])
      setCount(data.count ?? 0)
    } catch { setError('Error al cargar términos.') }
    finally { setLoading(false) }
  }, [filterLengua, filterSearch, filterPos, filterActivo, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm(makeEmptyForm(filterLengua || (lenguas[0]?.id.toString() ?? '')))
    setEditing(null); setFormErr(''); setFormMode('create')
  }
  const openEdit = (t: Termino) => {
    setForm({
      termino: t.termino, lengua: String(t.lengua),
      termino_es_texto: t.termino_es_detail?.termino ?? '',
      definicion: t.definicion, pos: t.pos,
      sinonimos: t.sinonimos.join(', '),
      ejemplos: t.ejemplos.join('\n'),
      activo: t.activo,
    })
    setEditing(t); setFormErr(''); setFormMode('edit')
  }
  const closeForm = () => { setFormMode(null); setEditing(null) }

  const handleSave = async () => {
    if (!form.termino.trim() || !form.lengua) { setFormErr('Término y lengua son requeridos.'); return }
    setSaving(true); setFormErr('')
    try {
      const body: Record<string, unknown> = {
        termino: form.termino.trim(),
        lengua: Number(form.lengua),
        definicion: form.definicion,
        pos: form.pos,
        sinonimos: form.sinonimos.split(',').map(s => s.trim()).filter(Boolean),
        ejemplos: form.ejemplos.split('\n').map(s => s.trim()).filter(Boolean),
        activo: form.activo,
      }
      if (form.termino_es_texto.trim()) {
        const es = await apiFetch(`/terminos/terminos-es/?search=${encodeURIComponent(form.termino_es_texto.trim())}`)
        const exact = (es.results ?? []).find((r: TerminoEs) => r.termino === form.termino_es_texto.trim())
        body.termino_es = exact
          ? exact.id
          : (await apiFetch('/terminos/terminos-es/', { method: 'POST', body: JSON.stringify({ termino: form.termino_es_texto.trim() }) })).id
      }
      if (formMode === 'create') {
        await apiFetch('/terminos/terminos/', { method: 'POST', body: JSON.stringify(body) })
      } else if (editing) {
        await apiFetch(`/terminos/terminos/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      closeForm(); load()
    } catch (e: unknown) {
      const d = (e as { data?: Record<string, unknown> })?.data
      const msg = (d?.termino as string[] | undefined)?.[0] || (d?.lengua as string[] | undefined)?.[0] || (d?.detail as string | undefined) || 'Error al guardar.'
      setFormErr(msg)
    } finally { setSaving(false) }
  }

  const handleSoftDelete = async () => {
    if (!deleting) return
    setConfirmSaving(true)
    try { await apiFetch(`/terminos/terminos/${deleting.id}/`, { method: 'DELETE' }); setDeleting(null); load() }
    catch { } finally { setConfirmSaving(false) }
  }
  const handleRestore = async () => {
    if (!restoring) return
    setConfirmSaving(true)
    try { await apiFetch(`/terminos/terminos/${restoring.id}/restaurar/`, { method: 'POST' }); setRestoring(null); load() }
    catch { } finally { setConfirmSaving(false) }
  }

  return (
    <div className="gl-tab-content">
      <div className="gl-toolbar gl-toolbar--wrap">
        <select className="gl-select" value={filterLengua} onChange={e => { setFilterLengua(e.target.value); setPage(1); setFormMode(null) }}>
          <option value="">— Seleccionar lengua —</option>
          {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <div className="gl-search-wrap">
          <Search size={15} className="gl-search-icon" />
          <input className="gl-search-input" placeholder="Buscar término…" value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="gl-select gl-select--sm" value={filterPos} onChange={e => { setFilterPos(e.target.value); setPage(1) }}>
          <option value="">Todos los POS</option>
          {POS_OPTIONS.filter(p => p.value).map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
        </select>
        <select className="gl-select gl-select--sm" value={filterActivo} onChange={e => { setFilterActivo(e.target.value); setPage(1) }}>
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        {canManage && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button className="eg-btn eg-btn--primary" onClick={formMode === 'create' ? closeForm : openCreate} disabled={!filterLengua}>
              {formMode === 'create' ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Nuevo</>}
            </button>
            <button className="eg-btn eg-btn--ghost" onClick={() => setShowBulk(true)} disabled={!filterLengua}><FileJson size={14} /> Carga masiva</button>
            <button className="eg-btn eg-btn--ghost" onClick={load} disabled={loading} title="Actualizar lista">
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Actualizar
            </button>
          </div>
        )}
        {!canManage && (
          <button className="eg-btn eg-btn--ghost" onClick={load} disabled={loading} style={{ marginLeft: 'auto' }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Actualizar
          </button>
        )}
      </div>

      {!filterLengua && <div className="gl-empty"><BookOpen size={32} /><p>Selecciona una lengua para ver sus términos.</p></div>}
      {error && <div className="gl-alert"><AlertCircle size={16} />{error}</div>}

      {canManage && formMode && (
        <TerminoInlineForm
          title={formMode === 'create' ? 'Nuevo término' : `Editando: ${editing?.termino}`}
          form={form} setForm={setForm}
          lenguas={lenguas} error={formErr} saving={saving}
          onSave={handleSave} onCancel={closeForm}
        />
      )}

      {filterLengua && loading ? (
        <div className="gl-loading"><Loader2 size={20} className="spin" /> Cargando términos…</div>
      ) : filterLengua && terminos.length === 0 && !loading ? (
        <div className="gl-empty"><BookOpen size={32} /><p>No se encontraron términos.</p></div>
      ) : terminos.length > 0 ? (
        <>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead>
                <tr>
                  <th>Término</th><th>Español</th><th>Definición</th><th>POS</th><th>Estado</th>
                  {canManage && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {terminos.map(t => (
                  <tr key={t.id} className={`${!t.activo ? 'gl-tr--inactive' : ''} ${editing?.id === t.id ? 'gl-tr--editing' : ''}`}>
                    <td className="gl-td-bold gl-td-ika">{t.termino}</td>
                    <td>{t.termino_es_detail?.termino ?? '—'}</td>
                    <td className="gl-td-gray gl-td-clamp">{t.definicion || '—'}</td>
                    <td><span className="gl-badge gl-badge--blue">{t.pos || 'Sin definir'}</span></td>
                    <td><span className={`gl-badge ${t.activo ? 'gl-badge--green' : 'gl-badge--gray'}`}>{t.activo ? 'Activo' : 'Inactivo'}</span></td>
                    {canManage && (
                      <td>
                        <div className="gl-row-actions">
                          <button className="eg-btn eg-btn--ghost" onClick={() => editing?.id === t.id ? closeForm() : openEdit(t)}>
                            {editing?.id === t.id ? <><X size={13} /></> : <><Edit2 size={13} /></>}
                          </button>
                          {t.activo
                            ? <button className="eg-btn eg-btn--danger" onClick={() => setDeleting(t)}><Trash2 size={13} /></button>
                            : <button className="eg-btn eg-btn--ghost" onClick={() => setRestoring(t)}><RotateCcw size={13} /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="gl-pagination">
            <span className="gl-pag-info">{count} términos</span>
            <button className="eg-btn eg-btn--ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Anterior</button>
            <span className="gl-pag-page">Página {page}</span>
            <button className="eg-btn eg-btn--ghost" disabled={terminos.length < 20} onClick={() => setPage(p => p + 1)}>Siguiente ›</button>
          </div>
        </>
      ) : null}

      {showBulk && filterLengua && canManage && (
        <BulkModal lenguaId={filterLengua} onClose={() => { setShowBulk(false); load() }} />
      )}
      {deleting && (
        <ConfirmModal
          title="Desactivar término"
          message={`¿Desactivar "${deleting.termino}"? Se ocultará del motor de búsqueda pero se conservará el registro.`}
          saving={confirmSaving} onConfirm={handleSoftDelete} onClose={() => setDeleting(null)}
        />
      )}
      {restoring && (
        <ConfirmModal
          title="Restaurar término"
          message={`¿Restaurar "${restoring.termino}" y devolverlo al diccionario activo?`}
          saving={confirmSaving} onConfirm={handleRestore} onClose={() => setRestoring(null)}
        />
      )}
    </div>
  )
}

// ── Término inline form with special keyboard ─────────────────────────────────

function TerminoInlineForm({ title, form, setForm, lenguas, error, saving, onSave, onCancel }: {
  title: string
  form: TerminoFormState
  setForm: (f: TerminoFormState) => void
  lenguas: Lengua[]; error: string; saving: boolean
  onSave: () => void; onCancel: () => void
}) {
  const terminoRef  = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const definRef    = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const sinonRef    = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const ejemplosRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const [activeField, setActiveField] = useState<'termino' | 'definicion' | 'sinonimos' | 'ejemplos'>('termino')
  const activeRef = activeField === 'termino' ? terminoRef
    : activeField === 'definicion' ? definRef
    : activeField === 'sinonimos' ? sinonRef
    : ejemplosRef
  const activeValue = form[activeField]
  const activeOnChange = (v: string) => setForm({ ...form, [activeField]: v })
  const kb = useSpecialKeyboard(activeRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, activeValue, activeOnChange)

  return (
    <>
      <div className="gl-inline-form">
        <div className="gl-inline-form-header">
          <span className="gl-inline-form-title">{title}</span>
          <button className="eg-btn eg-btn--ghost" onClick={onCancel} type="button"><X size={14} /> Cancelar</button>
        </div>

        <div className="gl-inline-form-body">
          <div className="gl-form-row">
            <Field label="Lengua *">
              <select className="gl-select gl-input" value={form.lengua} onChange={e => setForm({ ...form, lengua: e.target.value })}>
                {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </Field>
            <Field label="POS">
              <select className="gl-select gl-input" value={form.pos} onChange={e => setForm({ ...form, pos: e.target.value })}>
                {POS_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="gl-form-row">
            <Field label="Término en lengua indígena *">
              <input
                ref={terminoRef as React.RefObject<HTMLInputElement>}
                className="gl-input gl-input--ika"
                value={form.termino}
                onChange={e => setForm({ ...form, termino: e.target.value })}
                onFocus={() => setActiveField('termino')}
                placeholder="ej: niria"
              />
            </Field>
            <Field label="Equivalente en español">
              <input
                className="gl-input"
                value={form.termino_es_texto}
                onChange={e => setForm({ ...form, termino_es_texto: e.target.value })}
                placeholder="ej: agua"
              />
            </Field>
          </div>

          <Field label="Definición">
            <textarea
              ref={definRef as React.RefObject<HTMLTextAreaElement>}
              className="gl-input gl-textarea"
              value={form.definicion}
              onChange={e => setForm({ ...form, definicion: e.target.value })}
              onFocus={() => setActiveField('definicion')}
              rows={2}
              placeholder="Definición del término…"
            />
          </Field>

          <div className="gl-form-row">
            <Field label="Sinónimos" hint="separados por comas">
              <input
                ref={sinonRef as React.RefObject<HTMLInputElement>}
                className="gl-input gl-input--ika"
                value={form.sinonimos}
                onChange={e => setForm({ ...form, sinonimos: e.target.value })}
                onFocus={() => setActiveField('sinonimos')}
                placeholder="niriaa, niri"
              />
            </Field>
            <Field label="Ejemplos" hint="uno por línea">
              <textarea
                ref={ejemplosRef as React.RefObject<HTMLTextAreaElement>}
                className="gl-input gl-textarea gl-input--ika"
                value={form.ejemplos}
                onChange={e => setForm({ ...form, ejemplos: e.target.value })}
                onFocus={() => setActiveField('ejemplos')}
                rows={2}
                placeholder="niria naka mutu"
              />
            </Field>
          </div>

          <div className="gl-inline-form-footer">
            <label className="gl-checkbox-row">
              <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
              <span>Término activo</span>
            </label>

            <div className="gl-kb-row">
              <SpecialKeyboardToggle open={kb.open} onToggle={() => kb.open ? kb.setOpen(false) : kb.openKeyboard()} />
              {kb.open && <span className="gl-kb-hint">Campo: <strong>{activeField}</strong></span>}
            </div>

            {error && <div className="gl-form-err"><AlertCircle size={14} />{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="eg-btn eg-btn--ghost" onClick={onCancel}>Cancelar</button>
              <button className="eg-btn eg-btn--primary" onClick={onSave} disabled={saving}>
                {saving ? <><Loader2 size={14} className="spin" /> Guardando…</> : 'Guardar término'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SpecialKeyboardPanel
        open={kb.open}
        onClose={() => kb.setOpen(false)}
        onInsert={kb.insertAtCursor}
        onDelete={kb.deleteChar}
        onSpace={() => kb.insertAtCursor(' ')}
        onEnter={() => kb.insertAtCursor('\n')}
      />
    </>
  )
}

// ── Bulk upload modal ─────────────────────────────────────────────────────────

function BulkModal({ lenguaId, onClose }: { lenguaId: string; onClose: () => void }) {
  const [mode, setMode]       = useState<'upsert' | 'crear' | 'actualizar'>('upsert')
  const [json, setJson]       = useState('')
  const [file, setFile]       = useState<File | null>(null)
  const [result, setResult]   = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      let data: Record<string, unknown>
      if (file) {
        const fd = new FormData()
        fd.append('archivo', file)
        fd.append('lengua_id', lenguaId)
        fd.append('modo', mode)
        const token = getToken()
        const res = await fetch(`${API_BASE}/terminos/terminos/carga-masiva/`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Token ${token ?? ''}` },
          body: fd,
        })
        if (res.status === 401) { window.location.href = '/login'; return }
        data = await res.json() as Record<string, unknown>
      } else {
        let parsed
        try { parsed = JSON.parse(json) } catch { setError('JSON inválido.'); setLoading(false); return }
        data = await apiFetch('/terminos/terminos/carga-masiva/', {
          method: 'POST',
          body: JSON.stringify({ lengua_id: Number(lenguaId), modo: mode, terminos: parsed }),
        }) as Record<string, unknown>
      }
      setResult(data)
    } catch (e: unknown) {
      const d = (e as { data?: Record<string, unknown> })?.data
      setError((d?.error as string | undefined) || 'Error en la carga.')
    } finally { setLoading(false) }
  }

  return (
    <div className="gl-modal-overlay" onClick={onClose}>
      <div className="gl-modal gl-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="gl-modal-header">
          <h2 className="gl-modal-title">Carga masiva de términos</h2>
          <button className="vk-floating-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="gl-modal-body">
          <Field label="Modo">
            <select className="gl-select gl-input" value={mode} onChange={e => setMode(e.target.value as 'upsert' | 'crear' | 'actualizar')}>
              <option value="upsert">Upsert — crea y actualiza</option>
              <option value="crear">Crear — solo nuevos</option>
              <option value="actualizar">Actualizar — solo existentes</option>
            </select>
          </Field>
          <div className="gl-bulk-options">
            <div className="gl-bulk-option">
              <p className="gl-bulk-label"><Upload size={13} /> Subir archivo JSON</p>
              <button className="eg-btn eg-btn--ghost" onClick={() => fileRef.current?.click()}>
                {file ? file.name : 'Seleccionar archivo…'}
              </button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="visually-hidden"
                onChange={e => { setFile(e.target.files?.[0] ?? null); setJson('') }} />
            </div>
            <div className="gl-bulk-or">o</div>
            <Field label="Pegar JSON (array de términos)">
              <textarea
                className="gl-input gl-textarea gl-textarea--mono"
                value={json}
                onChange={e => { setJson(e.target.value); setFile(null) }}
                rows={6}
                placeholder={'[\n  {"termino": "niria", "termino_es": "agua", "pos": "NOM"},\n  ...\n]'}
              />
            </Field>
          </div>
          {error && <div className="gl-form-err"><AlertCircle size={14} />{error}</div>}
          {result && (
            <div className={`gl-bulk-result ${(result.errores as number) > 0 ? 'gl-bulk-result--warn' : 'gl-bulk-result--ok'}`}>
              <p><strong>Total:</strong> {result.total as number} &nbsp; <strong>Creados:</strong> {result.creados as number} &nbsp; <strong>Actualizados:</strong> {result.actualizados as number} &nbsp; <strong>Sin cambios:</strong> {result.sin_cambios as number} &nbsp; <strong>Errores:</strong> {result.errores as number}</p>
              {(result.detalle_errores as { indice: number; error: string }[] | undefined)?.length && (
                <ul className="gl-bulk-errors">
                  {(result.detalle_errores as { indice: number; error: string }[]).map((e, i) => (
                    <li key={i}><span className="gl-badge gl-badge--red">#{e.indice}</span> {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="gl-modal-footer">
          <button className="eg-btn eg-btn--ghost" onClick={onClose}>Cerrar</button>
          <button className="eg-btn eg-btn--primary" onClick={handleSubmit} disabled={loading || (!file && !json.trim())}>
            {loading ? <><Loader2 size={14} className="spin" /> Cargando…</> : <><Upload size={14} /> Cargar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDINGS TAB
// ─────────────────────────────────────────────────────────────────────────────

function EmbeddingsTab({ lenguas, canManage }: { lenguas: Lengua[]; canManage: boolean }) {
  const [filterLengua, setFilterLengua] = useState('')
  const [versions, setVersions]         = useState<EmbeddingVersion[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [generating, setGenerating]     = useState(false)
  const [genErr, setGenErr]             = useState('')
  const [pollingId, setPollingId]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!filterLengua) { setVersions([]); return }
    setLoading(true); setError('')
    try {
      const data = await apiFetch(`/terminos/embeddings/?lengua=${filterLengua}&ordering=-created_at`)
      setVersions(data.results ?? data)
    } catch { setError('Error al cargar embeddings.') }
    finally { setLoading(false) }
  }, [filterLengua])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!pollingId) return
    const iv = setInterval(async () => {
      try {
        const data = await apiFetch(`/terminos/embeddings/estado/${pollingId}/`)
        if (data.status === 'ready' || data.status === 'active' || data.status === 'failed') {
          setPollingId(null); load()
        }
      } catch { setPollingId(null) }
    }, 4000)
    return () => clearInterval(iv)
  }, [pollingId, load])

  const handleGenerate = async () => {
    if (!filterLengua) return
    setGenerating(true); setGenErr('')
    try {
      const data = await apiFetch('/terminos/embeddings/generar/', {
        method: 'POST',
        body: JSON.stringify({ lengua_id: Number(filterLengua) }),
      })
      setPollingId(data.task_id); load()
    } catch (e: unknown) {
      const d = (e as { data?: Record<string, unknown> })?.data
      setGenErr((d?.error as string | undefined) || 'Error al generar.')
    } finally { setGenerating(false) }
  }

  const handleActivate = async (v: EmbeddingVersion) => {
    try {
      await apiFetch(`/terminos/embeddings/${v.id}/activar/`, { method: 'POST' })
      load()
    } catch (e: unknown) {
      const d = (e as { data?: Record<string, unknown> })?.data
      setError((d?.error as string | undefined) || 'Error al activar.')
    }
  }

  const statusBadge = (v: EmbeddingVersion) => {
    if (v.status === 'active')     return <span className="gl-badge gl-badge--green">{v.status_display}</span>
    if (v.status === 'ready')      return <span className="gl-badge gl-badge--blue">{v.status_display}</span>
    if (v.status === 'failed')     return <span className="gl-badge gl-badge--red">{v.status_display}</span>
    if (v.status === 'generating') return <span className="gl-badge gl-badge--yellow"><Loader2 size={11} className="spin" /> {v.status_display}</span>
    return <span className="gl-badge gl-badge--gray">{v.status_display}</span>
  }

  return (
    <div className="gl-tab-content">
      <div className="gl-toolbar">
        <select className="gl-select" value={filterLengua} onChange={e => setFilterLengua(e.target.value)}>
          <option value="">— Seleccionar lengua —</option>
          {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        {canManage && (
          <button className="eg-btn eg-btn--primary" onClick={handleGenerate} disabled={!filterLengua || generating || !!pollingId}>
            {generating || pollingId ? <><Loader2 size={14} className="spin" /> Generando…</> : <><Zap size={14} /> Generar embeddings</>}
          </button>
        )}
        <button className="eg-btn eg-btn--ghost" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? 'spin' : ''} /></button>
      </div>

      {pollingId && (
        <div className="gl-alert gl-alert--info">
          <Loader2 size={16} className="spin" />
          Generación en progreso (task: {pollingId}). Actualizando cada 4 s…
        </div>
      )}
      {genErr && <div className="gl-alert"><AlertCircle size={16} />{genErr}</div>}
      {error  && <div className="gl-alert"><AlertCircle size={16} />{error}</div>}

      {!filterLengua && <div className="gl-empty"><Cpu size={32} /><p>Selecciona una lengua para ver sus embeddings.</p></div>}
      {filterLengua && loading && <div className="gl-loading"><Loader2 size={20} className="spin" /> Cargando…</div>}
      {filterLengua && !loading && versions.length === 0 && (
        <div className="gl-empty"><Cpu size={32} /><p>No hay versiones de embedding para esta lengua.</p></div>
      )}

      {versions.length > 0 && (
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead>
              <tr><th>Versión</th><th>Modelo</th><th>Estado</th><th>Términos</th><th>Creado</th><th>Completado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr key={v.id} className={v.is_active ? 'gl-tr--active' : ''}>
                  <td><span className="gl-badge gl-badge--blue">{v.version}</span></td>
                  <td className="gl-td-gray" style={{ fontSize: '.78rem' }}>{v.model_name}</td>
                  <td>{statusBadge(v)}</td>
                  <td>{v.num_terminos > 0 ? v.num_terminos.toLocaleString() : '—'}</td>
                  <td className="gl-td-gray">{new Date(v.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="gl-td-gray">{v.completed_at ? new Date(v.completed_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td>
                    {v.is_active
                      ? <span className="gl-badge gl-badge--green"><CheckCircle2 size={11} /> Activo</span>
                      : v.status === 'ready' && canManage
                        ? <button className="eg-btn eg-btn--primary" onClick={() => handleActivate(v)}><Zap size={13} /> Activar</button>
                        : null}
                    {v.error_message && <span className="gl-badge gl-badge--red" title={v.error_message}>Error</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="gl-field">
      <label className="gl-field-label">{label}{hint && <span className="gl-field-hint"> — {hint}</span>}</label>
      {children}
    </div>
  )
}

function ConfirmModal({ title, message, danger, saving, onConfirm, onClose }: {
  title: string; message: string; danger?: boolean; saving: boolean
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <div className="gl-modal-overlay" onClick={onClose}>
      <div className="gl-modal" onClick={e => e.stopPropagation()}>
        <div className="gl-modal-header">
          <h2 className="gl-modal-title">{title}</h2>
          <button className="vk-floating-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="gl-modal-body">
          <p style={{ fontSize: '.93rem', color: 'var(--gray-700)', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="gl-modal-footer">
          <button className="eg-btn eg-btn--ghost" onClick={onClose}>Cancelar</button>
          <button
            className={`eg-btn ${danger ? 'eg-btn--danger' : 'eg-btn--primary'}`}
            onClick={onConfirm} disabled={saving}
            style={danger ? { background: 'var(--red)', color: '#fff' } : undefined}
          >
            {saving ? <><Loader2 size={14} className="spin" /> …</> : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function Glosario() {
  const { canManage } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('lenguas')
  const [lenguas, setLenguas]     = useState<Lengua[]>([])
  const [loadingL, setLoadingL]   = useState(true)

  useEffect(() => {
    apiFetch('/terminos/lenguas/?page_size=100')
      .then(d => setLenguas((d as { results?: Lengua[] }).results ?? (d as Lengua[])))
      .catch(() => {})
      .finally(() => setLoadingL(false))
  }, [])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'lenguas',    label: 'Lenguas',    icon: <Globe size={15} /> },
    { id: 'terminos',  label: 'Términos',   icon: <BookOpen size={15} /> },
    { id: 'embeddings',label: 'Embeddings', icon: <Cpu size={15} /> },
  ]

  return (
    <div className="gl-page">
      <div className="gl-page-header">
        <div className="container">
          <h1 className="gl-page-title">Glosario — Administración de Terminología</h1>
          <p className="gl-page-sub">Gestión de lenguas, términos y motores de búsqueda semántica · API Sayta</p>
        </div>
      </div>

      <div className="gl-tabs-bar">
        <div className="container">
          <div className="gl-tabs">
            {tabs.map(t => (
              <button
                key={t.id}
                className={`gl-tab${activeTab === t.id ? ' gl-tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        {loadingL ? (
          <div className="gl-loading" style={{ marginTop: 40 }}><Loader2 size={20} className="spin" /> Conectando con el servidor…</div>
        ) : (
          <>
            {activeTab === 'lenguas'    && <LenguasTab canManage={canManage} />}
            {activeTab === 'terminos'   && <TerminosTab lenguas={lenguas} canManage={canManage} />}
            {activeTab === 'embeddings' && <EmbeddingsTab lenguas={lenguas} canManage={canManage} />}
          </>
        )}
      </div>
    </div>
  )
}
