/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react'
import {
  Lock, Mic, FolderOpen, BarChart2, RefreshCw, AlertCircle,
  Music, BookOpen, Tag, Check, Trash2, Edit2, X, ArrowLeft,
  ChevronDown, ChevronUp, Clock,
} from 'lucide-react'

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const PASSWORD = 'Un1m4gd4l3n4'
const SESSION_KEY = 'etiquetado_auth'

/* ═══════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════ */

interface AudioStats {
  total_audios: number
  duracion_segundos?: number
  duracion_formateada?: string
}

interface CommunityStats {
  comunidad: string
  total_jornadas?: number
  total_grabaciones?: number
  total_archivos?: number
  audios_sin_procesar?: AudioStats
}

interface Jornada {
  nombre: string
  fecha_texto?: string
  tematica?: string
  audios_sin_procesar?: AudioStats
}

interface AudioItem {
  nombre: string
  duracion_formateada?: string
  etiquetado: boolean
  etiqueta?: string
}

interface GlosarioTermino {
  espanol: string
  traduccion: string
  nota?: string | null
}

interface GlosarioCategoria {
  nombre: string
  terminos: GlosarioTermino[]
}

interface GlosarioResponse {
  metadata?: { titulo?: string; lengua_indigena?: string }
  categorias: GlosarioCategoria[]
}

interface EtiquetadoItem {
  audio: string
  etiqueta: string
}

interface EstadoResponse {
  total_audios: number
  total_etiquetados: number
  porcentaje_completado: number
  etiquetados: EtiquetadoItem[]
  sin_etiquetar: string[]
}

type NavState =
  | { view: 'dashboard' }
  | { view: 'session'; community: string; session: string }

type LabelMode = 'idle' | 'editing' | 'saving' | 'deleting'

/* ═══════════════════════════════════════════════════════
   PASSWORD GATE
═══════════════════════════════════════════════════════ */

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onAuth()
    } else {
      setError(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
  }

  return (
    <div className="eg-gate">
      <div className={`eg-gate-card${shaking ? ' eg-shake' : ''}`}>
        <div className="eg-gate-icon"><Lock size={28} /></div>
        <h1 className="eg-gate-title">Área de Etiquetado</h1>
        <p className="eg-gate-sub">Acceso restringido — ingresa la contraseña para continuar</p>
        <form onSubmit={handleSubmit} className="eg-gate-form" noValidate>
          <label htmlFor="eg-pwd" className="sr-only">Contraseña</label>
          <input
            id="eg-pwd"
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            placeholder="Contraseña"
            className={`eg-gate-input${error ? ' eg-gate-input--error' : ''}`}
            autoFocus
            autoComplete="current-password"
            aria-describedby={error ? 'eg-pwd-err' : undefined}
          />
          {error && (
            <p id="eg-pwd-err" className="eg-gate-err" role="alert">
              <AlertCircle size={14} aria-hidden="true" /> Contraseña incorrecta
            </p>
          )}
          <button type="submit" className="eg-gate-btn">
            <Lock size={15} aria-hidden="true" /> Ingresar
          </button>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════════════ */

function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; accent?: 'red'
}) {
  return (
    <div className={`eg-stat-card${accent === 'red' ? ' eg-stat-card--red' : ''}`}>
      <div className="eg-stat-icon">{icon}</div>
      <div className="eg-stat-body">
        <span className="eg-stat-label">{label}</span>
        <span className="eg-stat-value">{value}</span>
        {sub && <span className="eg-stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   STATS DASHBOARD
═══════════════════════════════════════════════════════ */

function StatsDashboard() {
  const [stats, setStats] = useState<CommunityStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/api/grabaciones/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list: CommunityStats[] = Array.isArray(data)
        ? data
        : Array.isArray(data.comunidades) ? data.comunidades : []
      setStats(list)
    } catch {
      setError('No se pudieron cargar las estadísticas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const totalJornadas = stats.reduce((s, c) => s + (c.total_jornadas ?? c.total_grabaciones ?? 0), 0)
  const totalAudios   = stats.reduce((s, c) => s + (c.audios_sin_procesar?.total_audios ?? c.total_archivos ?? 0), 0)

  return (
    <section className="eg-section" aria-labelledby="eg-stats-title">
      <div className="eg-section-header">
        <h2 id="eg-stats-title" className="eg-section-title">
          <BarChart2 size={18} aria-hidden="true" /> Estadísticas del corpus
        </h2>
        <button onClick={fetchStats} className="eg-refresh-btn" disabled={loading} aria-label="Actualizar">
          <RefreshCw size={15} className={loading ? 'spin' : ''} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {error && <div className="eg-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</div>}
      {loading && !error && (
        <div className="eg-loading" aria-live="polite"><RefreshCw size={20} className="spin" aria-hidden="true" /> Cargando…</div>
      )}
      {!loading && !error && (
        <>
          <div className="eg-stats-grid">
            <StatCard label="Total jornadas" value={totalJornadas} sub="todas las comunidades" icon={<FolderOpen size={20} />} />
            <StatCard label="Audios sin procesar" value={totalAudios} sub="en corpus" icon={<Music size={20} />} accent="red" />
          </div>
          {stats.length > 0 && (
            <div className="eg-community-grid">
              {stats.map(c => (
                <div key={c.comunidad} className="eg-community-card">
                  <div className="eg-community-name"><Mic size={15} aria-hidden="true" /> {c.comunidad}</div>
                  <div className="eg-community-row">
                    <span className="eg-community-key">Jornadas</span>
                    <span className="eg-community-val">{c.total_jornadas ?? c.total_grabaciones ?? '—'}</span>
                  </div>
                  <div className="eg-community-row">
                    <span className="eg-community-key">Audios</span>
                    <span className="eg-community-val">{c.audios_sin_procesar?.total_audios ?? c.total_archivos ?? '—'}</span>
                  </div>
                  {c.audios_sin_procesar?.duracion_formateada && (
                    <div className="eg-community-row">
                      <span className="eg-community-key">Duración</span>
                      <span className="eg-community-val">{c.audios_sin_procesar.duracion_formateada}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   SESSION LIST
═══════════════════════════════════════════════════════ */

const COMMUNITIES = ['Arhuaco', 'Kogui'] as const
type Community = typeof COMMUNITIES[number]

function SessionList({ onSelect }: { onSelect: (community: string, session: string) => void }) {
  const [community, setCommunity] = useState<Community>('Arhuaco')
  const [jornadas, setJornadas] = useState<Jornada[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJornadas = useCallback(async (c: Community) => {
    setLoading(true); setError(null); setJornadas([])
    try {
      const res = await fetch(`${API}/api/grabaciones/${c}/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list: Jornada[] = data.jornadas ?? data.sesiones ?? (Array.isArray(data) ? data : [])
      setJornadas(list)
    } catch {
      setError(`No se pudieron cargar las jornadas de ${c}.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJornadas(community) }, [community, fetchJornadas])

  return (
    <section className="eg-section" aria-labelledby="eg-sessions-title">
      <div className="eg-section-header">
        <h2 id="eg-sessions-title" className="eg-section-title">
          <FolderOpen size={18} aria-hidden="true" /> Jornadas de grabación
        </h2>
        <button onClick={() => fetchJornadas(community)} className="eg-refresh-btn" disabled={loading} aria-label="Actualizar">
          <RefreshCw size={15} className={loading ? 'spin' : ''} aria-hidden="true" /> Actualizar
        </button>
      </div>
      <div className="eg-tabs" role="tablist" aria-label="Seleccionar comunidad">
        {COMMUNITIES.map(c => (
          <button key={c} role="tab" aria-selected={community === c}
            onClick={() => setCommunity(c)}
            className={`eg-tab${community === c ? ' eg-tab--active' : ''}`}
          >
            <Mic size={14} aria-hidden="true" /> {c}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="eg-tabpanel">
        {error && <div className="eg-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</div>}
        {loading && <div className="eg-loading"><RefreshCw size={18} className="spin" aria-hidden="true" /> Cargando jornadas…</div>}
        {!loading && !error && jornadas.length === 0 && (
          <div className="eg-empty"><FolderOpen size={32} aria-hidden="true" /><p>No se encontraron jornadas para {community}</p></div>
        )}
        {!loading && jornadas.length > 0 && (
          <ul className="eg-session-list" aria-label={`Jornadas de ${community}`}>
            {jornadas.map(j => (
              <li key={j.nombre}>
                <button
                  className="eg-session-item eg-session-btn"
                  onClick={() => onSelect(community, j.nombre)}
                  aria-label={`Abrir jornada ${j.nombre}`}
                >
                  <FolderOpen size={16} className="eg-session-folder" aria-hidden="true" />
                  <div className="eg-session-info">
                    <span className="eg-session-name">{j.nombre}</span>
                    <span className="eg-session-meta">
                      {j.fecha_texto && <><Clock size={11} aria-hidden="true" /> {j.fecha_texto}</>}
                      {j.tematica && <span className="eg-session-tag">{j.tematica}</span>}
                    </span>
                  </div>
                  {j.audios_sin_procesar && (
                    <span className="eg-session-badge">
                      {j.audios_sin_procesar.total_audios} audios
                      {j.audios_sin_procesar.duracion_formateada ? ` · ${j.audios_sin_procesar.duracion_formateada}` : ''}
                    </span>
                  )}
                  <span className="eg-session-arrow" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   GLOSSARY PANEL
   Inline expandable panel inside AudioRow.
   Shows all terms from the session glossary organized by
   category. Format: traduccion (español).
   Clicking a term fills the label input and closes the panel.
═══════════════════════════════════════════════════════ */

function GlossaryPanel({ categories, onSelect }: {
  categories: GlosarioCategoria[]
  onSelect: (traduccion: string) => void
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()

  const filtered = q === ''
    ? categories
    : categories
        .map(cat => ({
          ...cat,
          terminos: cat.terminos.filter(
            t => t.traduccion.toLowerCase().includes(q) || t.espanol.toLowerCase().includes(q)
          ),
        }))
        .filter(cat => cat.terminos.length > 0)

  const totalTerms = categories.reduce((s, c) => s + c.terminos.length, 0)

  return (
    <div className="eg-glos-panel" role="region" aria-label="Glosario de términos">
      <div className="eg-glos-panel-header">
        <BookOpen size={13} aria-hidden="true" />
        <span>Seleccionar del glosario</span>
        <span className="eg-glos-panel-count">{totalTerms} términos · {categories.length} categorías</span>
      </div>
      <div className="eg-glos-panel-search">
        <input
          type="search"
          placeholder="Buscar en lengua indígena o español…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="eg-gate-input"
          aria-label="Buscar término en el glosario"
        />
      </div>
      <div className="eg-glos-panel-body">
        {filtered.length === 0 && (
          <p className="eg-glos-panel-empty">No se encontraron términos para "{search}"</p>
        )}
        {filtered.map(cat => (
          <div key={cat.nombre} className="eg-glos-cat">
            <h4 className="eg-glos-cat-title">
              {cat.nombre}
              <span className="eg-glos-cat-count">{cat.terminos.length}</span>
            </h4>
            <ul className="eg-glos-terms" role="list">
              {cat.terminos.map((t, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="eg-glos-term-btn"
                    onClick={() => onSelect(t.traduccion)}
                    title={`Seleccionar: ${t.traduccion}`}
                  >
                    <span className="eg-glos-term-traduccion">{t.traduccion}</span>
                    <span className="eg-glos-term-espanol">({t.espanol})</span>
                    {t.nota && <span className="eg-glos-term-nota">{t.nota}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   GLOSSARY MODAL  (reference viewer — HU-17)
   Full-screen reference view with all metadata and notes.
═══════════════════════════════════════════════════════ */

function GlossaryModal({ community, session, onClose }: {
  community: string; session: string; onClose: () => void
}) {
  const [data, setData] = useState<GlosarioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    fetch(`${API}/api/grabaciones/${community}/${session}/glosario/`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: GlosarioResponse) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError('No se pudo cargar el glosario.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [community, session])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const q = search.trim().toLowerCase()
  const filtered: GlosarioCategoria[] = !data ? [] : q === ''
    ? data.categorias
    : data.categorias
        .map(cat => ({
          ...cat,
          terminos: cat.terminos.filter(
            t => t.espanol.toLowerCase().includes(q) || t.traduccion.toLowerCase().includes(q)
          ),
        }))
        .filter(cat => cat.terminos.length > 0)

  return (
    <div className="eg-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Glosario de referencia">
      <div className="eg-modal" onClick={e => e.stopPropagation()}>
        <div className="eg-modal-header">
          <div className="eg-modal-title-row">
            <BookOpen size={18} aria-hidden="true" />
            <h2 className="eg-modal-title">Glosario completo</h2>
          </div>
          {data?.metadata?.titulo && <p className="eg-modal-sub">{data.metadata.titulo}</p>}
          <button onClick={onClose} className="eg-modal-close" aria-label="Cerrar glosario">
            <X size={18} />
          </button>
        </div>
        <div className="eg-modal-search">
          <input
            type="search"
            placeholder="Buscar en español o lengua indígena…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="eg-gate-input"
            aria-label="Buscar en el glosario"
            autoFocus
          />
        </div>
        <div className="eg-modal-body">
          {error && <div className="eg-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</div>}
          {loading && <div className="eg-loading"><RefreshCw size={18} className="spin" aria-hidden="true" /> Cargando…</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="eg-empty"><BookOpen size={28} aria-hidden="true" /><p>No se encontraron términos</p></div>
          )}
          {!loading && filtered.map(cat => (
            <div key={cat.nombre} className="eg-glosario-cat">
              <h3 className="eg-glosario-cat-title">{cat.nombre}</h3>
              <div className="eg-glosario-terms">
                {cat.terminos.map((t, i) => (
                  <div key={i} className="eg-glosario-ref">
                    <span className="eg-glosario-term-traduccion">{t.traduccion}</span>
                    <span className="eg-glosario-term-espanol">({t.espanol})</span>
                    {t.nota && <span className="eg-glosario-term-nota">{t.nota}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   AUDIO ROW  (HU-16 · HU-18 · HU-19 · HU-20)
═══════════════════════════════════════════════════════ */

function AudioRow({ audio, community, session, onLabelChange, isExpanded, onToggle, glossaryCategories }: {
  audio: AudioItem
  community: string
  session: string
  onLabelChange: () => void
  isExpanded: boolean
  onToggle: () => void
  glossaryCategories: GlosarioCategoria[]
}) {
  const [mode, setMode]               = useState<LabelMode>('idle')
  const [inputVal, setInputVal]       = useState(audio.etiqueta ?? '')
  const [apiError, setApiError]       = useState<string | null>(null)
  const [showGlosPanel, setShowGlosPanel] = useState(false)

  const audioUrl  = `${API}/api/grabaciones/${community}/${session}/audios/${encodeURIComponent(audio.nombre)}`
  const isLabeled = audio.etiquetado
  const isBusy    = mode === 'saving' || mode === 'deleting'
  const inputId   = `lbl-${audio.nombre.replace(/[^a-z0-9]/gi, '-')}`

  function startEdit()  { setInputVal(audio.etiqueta ?? ''); setApiError(null); setMode('editing') }
  function cancelEdit() { setInputVal(audio.etiqueta ?? ''); setApiError(null); setShowGlosPanel(false); setMode('idle') }

  async function handleSave() {
    if (!inputVal.trim()) return
    setMode('saving'); setApiError(null); setShowGlosPanel(false)
    try {
      let res: Response
      if (isLabeled) {
        res = await fetch(
          `${API}/api/grabaciones/${community}/${session}/etiqueta/${encodeURIComponent(audio.nombre)}/`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etiqueta: inputVal.trim() }) }
        )
      } else {
        res = await fetch(
          `${API}/api/grabaciones/${community}/${session}/etiquetar/`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre_audio: audio.nombre, etiqueta: inputVal.trim() }) }
        )
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      setMode('idle')
      onLabelChange()
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Error al guardar')
      setMode(isLabeled ? 'editing' : 'idle')
    }
  }

  async function handleDelete() {
    setMode('deleting'); setApiError(null)
    try {
      const res = await fetch(
        `${API}/api/grabaciones/${community}/${session}/etiqueta/${encodeURIComponent(audio.nombre)}/`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setInputVal('')
      setMode('idle')
      onLabelChange()
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Error al eliminar')
      setMode('idle')
    }
  }

  const showDisplay = isLabeled && (mode === 'idle' || mode === 'deleting')
  const showInput   = (!isLabeled && mode === 'idle') || mode === 'editing' || mode === 'saving'

  return (
    <li className={`eg-audio-row${isExpanded ? ' eg-audio-row--open' : ''}`}>
      {/* Row header — accordion toggle */}
      <button
        className="eg-audio-row-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`audio-body-${audio.nombre}`}
      >
        <span className={`eg-audio-status${isLabeled ? ' eg-audio-status--done' : ''}`}>
          {isLabeled
            ? <><Check size={11} aria-hidden="true" /> Etiquetado</>
            : <><Tag   size={11} aria-hidden="true" /> Pendiente</>}
        </span>
        <span className="eg-audio-name" title={audio.nombre}>{audio.nombre}</span>
        {audio.duracion_formateada && (
          <span className="eg-audio-duration"><Clock size={11} aria-hidden="true" /> {audio.duracion_formateada}</span>
        )}
        <ChevronDown size={15} className={`eg-audio-chevron${isExpanded ? ' eg-audio-chevron--up' : ''}`} aria-hidden="true" />
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div id={`audio-body-${audio.nombre}`} className="eg-audio-body">
          {/* HU-16: native audio player */}
          <audio controls src={audioUrl} className="eg-audio-player" aria-label={`Reproducir ${audio.nombre}`}>
            Tu navegador no soporta el elemento audio.
          </audio>

          {/* Label form */}
          <div className="eg-label-form">
            <p className="eg-label-form-title">
              <Tag size={14} aria-hidden="true" /> Etiqueta en lengua indígena
            </p>

            {/* Display mode: show label + edit/delete buttons */}
            {showDisplay && (
              <div className="eg-label-display">
                <span className="eg-label-value">{audio.etiqueta}</span>
                <div className="eg-label-actions">
                  <button onClick={startEdit} disabled={isBusy} className="eg-btn eg-btn--ghost">
                    <Edit2 size={14} aria-hidden="true" /> Editar
                  </button>
                  <button onClick={handleDelete} disabled={isBusy} className="eg-btn eg-btn--danger">
                    {mode === 'deleting'
                      ? <><RefreshCw size={14} className="spin" aria-hidden="true" /> Eliminando…</>
                      : <><Trash2 size={14} aria-hidden="true" /> Eliminar</>}
                  </button>
                </div>
              </div>
            )}

            {/* Input mode: free text + optional glossary panel */}
            {showInput && (
              <>
                <div className="eg-label-input-row">
                  <label htmlFor={inputId} className="sr-only">Etiqueta para {audio.nombre}</label>
                  <input
                    id={inputId}
                    type="text"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !isBusy && inputVal.trim()) handleSave() }}
                    placeholder="Escribir en lengua indígena…"
                    className="eg-gate-input eg-label-input"
                    disabled={isBusy}
                    autoComplete="off"
                    autoFocus
                  />
                  <div className="eg-label-input-btns">
                    {glossaryCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowGlosPanel(p => !p)}
                        className={`eg-btn eg-btn--ghost${showGlosPanel ? ' eg-btn--active' : ''}`}
                        aria-expanded={showGlosPanel}
                        aria-label={showGlosPanel ? 'Ocultar glosario' : 'Ver glosario'}
                      >
                        <BookOpen size={14} aria-hidden="true" />
                        Glosario
                        {showGlosPanel
                          ? <ChevronUp size={13} aria-hidden="true" />
                          : <ChevronDown size={13} aria-hidden="true" />}
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={isBusy || !inputVal.trim()}
                      className="eg-btn eg-btn--primary"
                    >
                      {mode === 'saving'
                        ? <><RefreshCw size={14} className="spin" aria-hidden="true" /> Guardando…</>
                        : <><Check size={14} aria-hidden="true" /> {isLabeled ? 'Actualizar' : 'Guardar'}</>}
                    </button>
                    {mode === 'editing' && (
                      <button onClick={cancelEdit} className="eg-btn eg-btn--ghost">
                        <X size={14} aria-hidden="true" /> Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline glossary panel: browse categories, click to fill input */}
                {showGlosPanel && glossaryCategories.length > 0 && (
                  <GlossaryPanel
                    categories={glossaryCategories}
                    onSelect={t => { setInputVal(t); setShowGlosPanel(false) }}
                  />
                )}
              </>
            )}

            {apiError && (
              <p className="eg-label-error" role="alert">
                <AlertCircle size={13} aria-hidden="true" /> {apiError}
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/* ═══════════════════════════════════════════════════════
   SESSION WORKSPACE  (HU-15 → HU-21)
   Fetches audios, estado and glossary on mount (parallel).
   Glossary categories are passed into every AudioRow.
═══════════════════════════════════════════════════════ */

function SessionWorkspace({ community, session, onBack }: {
  community: string; session: string; onBack: () => void
}) {
  const [audios, setAudios]                         = useState<AudioItem[]>([])
  const [estado, setEstado]                         = useState<EstadoResponse | null>(null)
  const [glossaryCategories, setGlossaryCategories] = useState<GlosarioCategoria[]>([])
  const [loading, setLoading]                       = useState(true)
  const [error, setError]                           = useState<string | null>(null)
  const [showGlosario, setShowGlosario]             = useState(false)
  const [expandedAudio, setExpandedAudio]           = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Required: audio list
      const audiosRes = await fetch(`${API}/api/grabaciones/${community}/${session}/audios/`)
      if (!audiosRes.ok) throw new Error(`HTTP ${audiosRes.status}`)
      const audiosData = await audiosRes.json()

      // Optional: estado + glosario in parallel
      const [estadoRes, glosRes] = await Promise.all([
        fetch(`${API}/api/grabaciones/${community}/${session}/estado/`).catch(() => null),
        fetch(`${API}/api/grabaciones/${community}/${session}/glosario/`).catch(() => null),
      ])

      let estadoData: EstadoResponse | null = null
      if (estadoRes?.ok) estadoData = await estadoRes.json()

      if (glosRes?.ok) {
        const glosData: GlosarioResponse = await glosRes.json()
        setGlossaryCategories(glosData.categorias ?? [])
      }

      const labelMap = new Map<string, string>()
      for (const e of (estadoData?.etiquetados ?? [])) labelMap.set(e.audio, e.etiqueta)

      const rawAudios: AudioItem[] = Array.isArray(audiosData.audios)
        ? audiosData.audios
        : Array.isArray(audiosData) ? audiosData : []

      setAudios(rawAudios.map(a => ({ ...a, etiqueta: labelMap.get(a.nombre) })))
      setEstado(estadoData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la sesión.')
    } finally {
      setLoading(false)
    }
  }, [community, session])

  // Silent refresh after label change — only re-fetches estado, no spinner
  const refreshEstado = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/grabaciones/${community}/${session}/estado/`)
      if (!res.ok) return
      const data: EstadoResponse = await res.json()
      setEstado(data)
      const labelMap = new Map<string, string>()
      for (const e of (data.etiquetados ?? [])) labelMap.set(e.audio, e.etiqueta)
      setAudios(prev => prev.map(a => ({
        ...a,
        etiquetado: labelMap.has(a.nombre),
        etiqueta:   labelMap.get(a.nombre),
      })))
    } catch { /* ignore */ }
  }, [community, session])

  useEffect(() => { fetchData() }, [fetchData])

  const pct       = estado?.porcentaje_completado ?? 0
  const labeled   = estado?.total_etiquetados ?? 0
  const total     = estado?.total_audios ?? audios.length
  const termCount = glossaryCategories.reduce((s, c) => s + c.terminos.length, 0)

  return (
    <div className="eg-workspace">
      {/* Sticky header */}
      <div className="eg-ws-header">
        <div className="container">
          <div className="eg-ws-nav">
            <button onClick={onBack} className="eg-btn eg-btn--ghost-light" aria-label="Volver">
              <ArrowLeft size={15} aria-hidden="true" /> Volver
            </button>
            <nav aria-label="Ubicación actual" className="eg-breadcrumb-nav">
              <span className="eg-breadcrumb-link" onClick={onBack} role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onBack()}>
                Etiquetado
              </span>
              <span aria-hidden="true"> › </span>
              <span>{community}</span>
              <span aria-hidden="true"> › </span>
              <span className="eg-breadcrumb-current" aria-current="page">{session}</span>
            </nav>
            <button onClick={() => setShowGlosario(true)} className="eg-btn eg-btn--ghost-light" aria-label="Ver glosario completo">
              <BookOpen size={15} aria-hidden="true" />
              Glosario
              {termCount > 0 && (
                <span className="eg-glos-badge">{termCount}</span>
              )}
            </button>
          </div>

          {/* HU-21: progress bar */}
          <div className="eg-ws-progress" aria-label={`${labeled} de ${total} etiquetados`}>
            <div className="eg-ws-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="eg-ws-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="eg-ws-progress-text">
              {estado
                ? <>{labeled} / {total} etiquetados · <strong>{pct.toFixed(0)} %</strong></>
                : 'Calculando…'}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="eg-ws-body container">
        {error && (
          <div className="eg-section">
            <div className="eg-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</div>
          </div>
        )}
        {loading && (
          <div className="eg-section">
            <div className="eg-loading"><RefreshCw size={20} className="spin" aria-hidden="true" /> Cargando audios y glosario…</div>
          </div>
        )}

        {!loading && !error && (
          <section className="eg-section" aria-label="Lista de audios de la jornada">
            <div className="eg-section-header">
              <h2 className="eg-section-title">
                <Music size={18} aria-hidden="true" /> Audios · {session}
              </h2>
              <div className="eg-section-header-right">
                {termCount > 0 && (
                  <span className="eg-glos-info">
                    <BookOpen size={13} aria-hidden="true" /> {termCount} términos en glosario
                  </span>
                )}
                <button onClick={fetchData} className="eg-refresh-btn" aria-label="Recargar">
                  <RefreshCw size={15} aria-hidden="true" /> Actualizar
                </button>
              </div>
            </div>

            {audios.length === 0 && (
              <div className="eg-empty"><Music size={32} aria-hidden="true" /><p>No se encontraron audios en esta jornada</p></div>
            )}

            {audios.length > 0 && (
              <ul className="eg-audio-list" aria-label="Audios de la jornada">
                {audios.map(a => (
                  <AudioRow
                    key={a.nombre}
                    audio={a}
                    community={community}
                    session={session}
                    onLabelChange={refreshEstado}
                    isExpanded={expandedAudio === a.nombre}
                    onToggle={() => setExpandedAudio(prev => prev === a.nombre ? null : a.nombre)}
                    glossaryCategories={glossaryCategories}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {showGlosario && (
        <GlossaryModal
          community={community}
          session={session}
          onClose={() => setShowGlosario(false)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════ */

function EtiquetadoApp() {
  const [nav, setNav] = useState<NavState>({ view: 'dashboard' })

  if (nav.view === 'session') {
    return (
      <SessionWorkspace
        community={nav.community}
        session={nav.session}
        onBack={() => setNav({ view: 'dashboard' })}
      />
    )
  }

  return (
    <div className="eg-page">
      <div className="eg-page-header">
        <div className="container">
          <h1 className="eg-page-title"><Mic size={22} aria-hidden="true" /> Panel de Etiquetado</h1>
          <p className="eg-page-sub">Gestión y estadísticas del corpus de audio SAYTA</p>
        </div>
      </div>
      <div className="eg-page-body container">
        <StatsDashboard />
        <SessionList onSelect={(c, s) => setNav({ view: 'session', community: c, session: s })} />
      </div>
    </div>
  )
}

export default function Etiquetado() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  return authed ? <EtiquetadoApp /> : <PasswordGate onAuth={() => setAuthed(true)} />
}
