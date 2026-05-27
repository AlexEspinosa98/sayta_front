import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Edit2, Trash2, RefreshCw, Upload, Search, X,
  Loader2, CheckCircle2, AlertCircle,
  Zap, BookOpen, Globe, Cpu, RotateCcw, FileJson,
} from 'lucide-react'

import {
  useSpecialKeyboard, SpecialKeyboardPanel, SpecialKeyboardToggle,
} from '../components/SpecialKeyboard'

// ── API base ──────────────────────────────────────────────────────────────────

const API = 'http://localhost:8000/api'

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...opts,
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

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

const POS_OPTIONS = ['NOM', 'VRB', 'ADJ', 'ADV', 'NOM_PR', 'PRON', 'PREP', 'NOM_MASA']

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'lenguas' | 'terminos' | 'embeddings'

// ─────────────────────────────────────────────────────────────────────────────
// LENGUAS TAB
// ─────────────────────────────────────────────────────────────────────────────

function LenguasTab() {
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
    } catch (e: any) {
      const msg = e?.codigo?.[0] || e?.nombre?.[0] || e?.detail || 'Error al guardar.'
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
      {/* Toolbar */}
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
        <button className="eg-btn eg-btn--primary" onClick={openCreate}>
          <Plus size={15} /> Nueva lengua
        </button>
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
                <th>Términos</th><th>Embedding</th><th>Estado</th><th>Acciones</th>
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
                  <td>
                    <div className="gl-row-actions">
                      <button className="eg-btn eg-btn--ghost" onClick={() => openEdit(l)}><Edit2 size={13} /> Editar</button>
                      <button className="eg-btn eg-btn--danger" onClick={() => setDeleting(l)}><Trash2 size={13} /> Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {modal && (
        <LenguaModal
          title={modal === 'create' ? 'Nueva lengua' : 'Editar lengua'}
          form={form} setForm={setForm}
          error={formErr} saving={saving}
          onSave={handleSave} onClose={closeModal}
        />
      )}

      {/* Delete confirm */}
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

function TerminosTab({ lenguas }: { lenguas: Lengua[] }) {
  const [terminos, setTerminos]     = useState<Termino[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [filterLengua, setFilterLengua] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterPos, setFilterPos]   = useState('')
  const [filterActivo, setFilterActivo] = useState('true')
  const [count, setCount]           = useState(0)
  const [page, setPage]             = useState(1)

  const [modal, setModal]       = useState<'create' | 'edit' | 'bulk' | null>(null)
  const [editing, setEditing]   = useState<Termino | null>(null)
  const [deleting, setDeleting] = useState<Termino | null>(null)
  const [restoring, setRestoring] = useState<Termino | null>(null)
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')

  const emptyForm = {
    termino: '', lengua: filterLengua || (lenguas[0]?.id.toString() ?? ''),
    termino_es_texto: '', definicion: '', pos: 'NOM',
    sinonimos: '', ejemplos: '', activo: true,
  }
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    if (!filterLengua) { setTerminos([]); setCount(0); return }
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ lengua: filterLengua, page: String(page) })
      if (filterSearch) params.set('search', filterSearch)
      if (filterPos) params.set('pos', filterPos)
      if (filterActivo) params.set('activo', filterActivo)
      const data = await apiFetch(`/terminos/terminos/?${params}`)
      setTerminos(data.results ?? [])
      setCount(data.count ?? 0)
    } catch { setError('Error al cargar términos.') }
    finally { setLoading(false) }
  }, [filterLengua, filterSearch, filterPos, filterActivo, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm({ ...emptyForm, lengua: filterLengua || (lenguas[0]?.id.toString() ?? '') })
    setFormErr(''); setModal('create')
  }
  const openEdit = (t: Termino) => {
    setForm({
      termino: t.termino,
      lengua: String(t.lengua),
      termino_es_texto: t.termino_es_detail?.termino ?? '',
      definicion: t.definicion,
      pos: t.pos,
      sinonimos: t.sinonimos.join(', '),
      ejemplos: t.ejemplos.join('\n'),
      activo: t.activo,
    })
    setEditing(t); setFormErr(''); setModal('edit')
  }

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
      // Resolve termino_es by text if provided
      if (form.termino_es_texto.trim()) {
        const es = await apiFetch(`/terminos/terminos-es/?search=${encodeURIComponent(form.termino_es_texto.trim())}`)
        const exact = (es.results ?? []).find((r: TerminoEs) => r.termino === form.termino_es_texto.trim())
        if (exact) {
          body.termino_es = exact.id
        } else {
          const created = await apiFetch('/terminos/terminos-es/', { method: 'POST', body: JSON.stringify({ termino: form.termino_es_texto.trim() }) })
          body.termino_es = created.id
        }
      }
      if (modal === 'create') {
        await apiFetch('/terminos/terminos/', { method: 'POST', body: JSON.stringify(body) })
      } else if (editing) {
        await apiFetch(`/terminos/terminos/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      setModal(null); setEditing(null); load()
    } catch (e: any) {
      setFormErr(e?.termino?.[0] || e?.lengua?.[0] || e?.detail || 'Error al guardar.')
    } finally { setSaving(false) }
  }

  const handleSoftDelete = async () => {
    if (!deleting) return
    setSaving(true)
    try {
      await apiFetch(`/terminos/terminos/${deleting.id}/`, { method: 'DELETE' })
      setDeleting(null); load()
    } catch { } finally { setSaving(false) }
  }

  const handleRestore = async () => {
    if (!restoring) return
    setSaving(true)
    try {
      await apiFetch(`/terminos/terminos/${restoring.id}/restaurar/`, { method: 'POST' })
      setRestoring(null); load()
    } catch { } finally { setSaving(false) }
  }

  return (
    <div className="gl-tab-content">
      {/* Filters */}
      <div className="gl-toolbar gl-toolbar--wrap">
        <select className="gl-select" value={filterLengua} onChange={e => { setFilterLengua(e.target.value); setPage(1) }}>
          <option value="">— Seleccionar lengua —</option>
          {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <div className="gl-search-wrap">
          <Search size={15} className="gl-search-icon" />
          <input className="gl-search-input" placeholder="Buscar término…" value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="gl-select gl-select--sm" value={filterPos} onChange={e => { setFilterPos(e.target.value); setPage(1) }}>
          <option value="">Todos los POS</option>
          {POS_OPTIONS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="gl-select gl-select--sm" value={filterActivo} onChange={e => { setFilterActivo(e.target.value); setPage(1) }}>
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button className="eg-btn eg-btn--primary" onClick={openCreate} disabled={!filterLengua}><Plus size={14} /> Nuevo</button>
          <button className="eg-btn eg-btn--ghost" onClick={() => setModal('bulk')} disabled={!filterLengua}><FileJson size={14} /> Carga masiva</button>
          <button className="eg-btn eg-btn--ghost" onClick={load} disabled={loading}><RefreshCw size={13} className={loading ? 'spin' : ''} /></button>
        </div>
      </div>

      {!filterLengua && <div className="gl-empty"><BookOpen size={32} /><p>Selecciona una lengua para ver sus términos.</p></div>}
      {error && <div className="gl-alert"><AlertCircle size={16} />{error}</div>}

      {filterLengua && loading ? (
        <div className="gl-loading"><Loader2 size={20} className="spin" /> Cargando términos…</div>
      ) : filterLengua && terminos.length === 0 && !loading ? (
        <div className="gl-empty"><BookOpen size={32} /><p>No se encontraron términos.</p></div>
      ) : terminos.length > 0 ? (
        <>
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead>
                <tr><th>Término</th><th>Español</th><th>Definición</th><th>POS</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {terminos.map(t => (
                  <tr key={t.id} className={!t.activo ? 'gl-tr--inactive' : ''}>
                    <td className="gl-td-bold gl-td-ika">{t.termino}</td>
                    <td>{t.termino_es_detail?.termino ?? '—'}</td>
                    <td className="gl-td-gray gl-td-clamp">{t.definicion || '—'}</td>
                    <td><span className="gl-badge gl-badge--blue">{t.pos || '—'}</span></td>
                    <td><span className={`gl-badge ${t.activo ? 'gl-badge--green' : 'gl-badge--gray'}`}>{t.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div className="gl-row-actions">
                        <button className="eg-btn eg-btn--ghost" onClick={() => openEdit(t)}><Edit2 size={13} /></button>
                        {t.activo
                          ? <button className="eg-btn eg-btn--danger" onClick={() => setDeleting(t)}><Trash2 size={13} /></button>
                          : <button className="eg-btn eg-btn--ghost" onClick={() => setRestoring(t)}><RotateCcw size={13} /></button>}
                      </div>
                    </td>
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

      {modal && modal !== 'bulk' && (
        <TerminoModal
          title={modal === 'create' ? 'Nuevo término' : 'Editar término'}
          form={form} setForm={setForm}
          lenguas={lenguas} error={formErr} saving={saving}
          onSave={handleSave} onClose={() => { setModal(null); setEditing(null) }}
        />
      )}
      {modal === 'bulk' && filterLengua && (
        <BulkModal lenguaId={filterLengua} onClose={() => { setModal(null); load() }} />
      )}
      {deleting && (
        <ConfirmModal
          title="Desactivar término"
          message={`¿Desactivar "${deleting.termino}"? Se ocultará del motor de búsqueda pero se conservará el registro.`}
          saving={saving}
          onConfirm={handleSoftDelete}
          onClose={() => setDeleting(null)}
        />
      )}
      {restoring && (
        <ConfirmModal
          title="Restaurar término"
          message={`¿Restaurar "${restoring.termino}" y devolverlo al diccionario activo?`}
          saving={saving}
          onConfirm={handleRestore}
          onClose={() => setRestoring(null)}
        />
      )}
    </div>
  )
}

// ── Término modal with special keyboard ───────────────────────────────────────

type TerminoFormState = {
  termino: string; lengua: string; termino_es_texto: string;
  definicion: string; pos: string; sinonimos: string; ejemplos: string; activo: boolean
}

function TerminoModal({ title, form, setForm, lenguas, error, saving, onSave, onClose }: {
  title: string
  form: TerminoFormState
  setForm: (f: TerminoFormState) => void
  lenguas: Lengua[]; error: string; saving: boolean
  onSave: () => void; onClose: () => void
}) {
  const terminoRef  = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const definRef    = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const sinonRef    = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const ejemplosRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  // One shared keyboard that targets whichever field has focus
  const [activeField, setActiveField] = useState<'termino' | 'definicion' | 'sinonimos' | 'ejemplos'>('termino')
  const activeRef = activeField === 'termino' ? terminoRef
    : activeField === 'definicion' ? definRef
    : activeField === 'sinonimos' ? sinonRef
    : ejemplosRef
  const activeValue = activeField === 'termino' ? form.termino
    : activeField === 'definicion' ? form.definicion
    : activeField === 'sinonimos' ? form.sinonimos
    : form.ejemplos
  const activeOnChange = (v: string) => setForm({ ...form, [activeField]: v })

  const kb = useSpecialKeyboard(activeRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, activeValue, activeOnChange)

  return (
    <div className="gl-modal-overlay" onClick={onClose}>
      <div className="gl-modal gl-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="gl-modal-header">
          <h2 className="gl-modal-title">{title}</h2>
          <button className="vk-floating-close" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="gl-modal-body">
          <div className="gl-form-row">
            <Field label="Lengua *">
              <select className="gl-select gl-input" value={form.lengua} onChange={e => setForm({ ...form, lengua: e.target.value })}>
                {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </Field>
            <Field label="POS">
              <select className="gl-select gl-input" value={form.pos} onChange={e => setForm({ ...form, pos: e.target.value })}>
                {POS_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Término en lengua indígena *" hint="Foco en este campo para usar el teclado">
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

          <Field label="Sinónimos" hint="Separados por comas">
            <input
              ref={sinonRef as React.RefObject<HTMLInputElement>}
              className="gl-input gl-input--ika"
              value={form.sinonimos}
              onChange={e => setForm({ ...form, sinonimos: e.target.value })}
              onFocus={() => setActiveField('sinonimos')}
              placeholder="niriaa, niri"
            />
          </Field>

          <Field label="Ejemplos" hint="Un ejemplo por línea">
            <textarea
              ref={ejemplosRef as React.RefObject<HTMLTextAreaElement>}
              className="gl-input gl-textarea gl-input--ika"
              value={form.ejemplos}
              onChange={e => setForm({ ...form, ejemplos: e.target.value })}
              onFocus={() => setActiveField('ejemplos')}
              rows={3}
              placeholder="niria naka mutu"
            />
          </Field>

          <label className="gl-checkbox-row">
            <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
            <span>Término activo</span>
          </label>

          {/* Keyboard toggle */}
          <div className="gl-kb-row">
            <SpecialKeyboardToggle open={kb.open} onToggle={() => kb.open ? kb.setOpen(false) : kb.openKeyboard()} />
            {kb.open && <span className="gl-kb-hint">Campo activo: <strong>{activeField}</strong></span>}
          </div>

          {error && <div className="gl-form-err"><AlertCircle size={14} />{error}</div>}
        </div>
        <div className="gl-modal-footer">
          <button className="eg-btn eg-btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="eg-btn eg-btn--primary" onClick={onSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="spin" /> Guardando…</> : 'Guardar'}
          </button>
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
    </div>
  )
}

// ── Bulk upload modal ─────────────────────────────────────────────────────────

function BulkModal({ lenguaId, onClose }: { lenguaId: string; onClose: () => void }) {
  const [mode, setMode]       = useState<'upsert' | 'crear' | 'actualizar'>('upsert')
  const [json, setJson]       = useState('')
  const [file, setFile]       = useState<File | null>(null)
  const [result, setResult]   = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      let data: any
      if (file) {
        const fd = new FormData()
        fd.append('archivo', file)
        fd.append('lengua_id', lenguaId)
        fd.append('modo', mode)
        const res = await fetch(`${API}/terminos/terminos/carga-masiva/`, { method: 'POST', body: fd })
        data = await res.json()
      } else {
        let parsed
        try { parsed = JSON.parse(json) } catch { setError('JSON inválido.'); setLoading(false); return }
        data = await apiFetch('/terminos/terminos/carga-masiva/', {
          method: 'POST',
          body: JSON.stringify({ lengua_id: Number(lenguaId), modo: mode, terminos: parsed }),
        })
      }
      setResult(data)
    } catch (e: any) {
      setError(e?.error || 'Error en la carga.')
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
            <select className="gl-select gl-input" value={mode} onChange={e => setMode(e.target.value as any)}>
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
            <div className={`gl-bulk-result ${result.errores > 0 ? 'gl-bulk-result--warn' : 'gl-bulk-result--ok'}`}>
              <p><strong>Total:</strong> {result.total} &nbsp; <strong>Creados:</strong> {result.creados} &nbsp; <strong>Actualizados:</strong> {result.actualizados} &nbsp; <strong>Sin cambios:</strong> {result.sin_cambios} &nbsp; <strong>Errores:</strong> {result.errores}</p>
              {result.detalle_errores?.length > 0 && (
                <ul className="gl-bulk-errors">
                  {result.detalle_errores.map((e: any, i: number) => (
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

function EmbeddingsTab({ lenguas }: { lenguas: Lengua[] }) {
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

  // Poll generating task
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
    } catch (e: any) {
      setGenErr(e?.error || e?.task_id ? `Ya hay una generación en curso (task: ${e.task_id})` : 'Error al generar.')
    } finally { setGenerating(false) }
  }

  const handleActivate = async (v: EmbeddingVersion) => {
    try {
      await apiFetch(`/terminos/embeddings/${v.id}/activar/`, { method: 'POST' })
      load()
    } catch (e: any) { setError(e?.error || 'Error al activar.') }
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
        <select className="gl-select" value={filterLengua} onChange={e => { setFilterLengua(e.target.value) }}>
          <option value="">— Seleccionar lengua —</option>
          {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <button className="eg-btn eg-btn--primary" onClick={handleGenerate} disabled={!filterLengua || generating || !!pollingId}>
          {generating || pollingId ? <><Loader2 size={14} className="spin" /> Generando…</> : <><Zap size={14} /> Generar embeddings</>}
        </button>
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
                      : v.status === 'ready'
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
  const [activeTab, setActiveTab] = useState<Tab>('lenguas')
  const [lenguas, setLenguas]     = useState<Lengua[]>([])
  const [loadingL, setLoadingL]   = useState(true)

  useEffect(() => {
    apiFetch('/terminos/lenguas/?page_size=100')
      .then(d => setLenguas(d.results ?? d))
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
      {/* Header */}
      <div className="gl-page-header">
        <div className="container">
          <h1 className="gl-page-title">Glosario — Administración de Terminología</h1>
          <p className="gl-page-sub">Gestión de lenguas, términos y motores de búsqueda semántica · API Sayta</p>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Content */}
      <div className="container">
        {loadingL ? (
          <div className="gl-loading" style={{ marginTop: 40 }}><Loader2 size={20} className="spin" /> Conectando con el servidor…</div>
        ) : (
          <>
            {activeTab === 'lenguas'    && <LenguasTab />}
            {activeTab === 'terminos'   && <TerminosTab lenguas={lenguas} />}
            {activeTab === 'embeddings' && <EmbeddingsTab lenguas={lenguas} />}
          </>
        )}
      </div>
    </div>
  )
}
