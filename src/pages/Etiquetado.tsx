/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react'
import {
  Lock, Mic, FolderOpen, BarChart2, RefreshCw, AlertCircle,
  Music, BookOpen, Tag, Check, Trash2, Edit2, X, ArrowLeft,
  ChevronDown, Clock,
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
  sin_metadata?: number
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
  total_items?: number
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

function StatCard({
  label, value, sub, icon, accent,
}: {
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
   GLOSSARY MODAL  (HU-17)
   Terms display as clickable cards: traduccion (espanol)
   Clicking a term calls onSelectTerm → auto-fills label input
═══════════════════════════════════════════════════════ */

function GlossaryModal({ community, session, onClose, onSelectTerm }: {
  community: string
  session: string
  onClose: () => void
  onSelectTerm: (term: string) => void
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
  const filtered: GlosarioCategoria[] = !data
    ? []
    : q === ''
    ? data.categorias
    : data.categorias
        .map(cat => ({
          ...cat,
          terminos: cat.terminos.filter(
            t => t.espanol.toLowerCase().includes(q) || t.traduccion.toLowerCase().includes(q)
          ),
        }))
        .filter(cat => cat.terminos.length > 0)

  function handleSelect(traduccion: string) {
    onSelectTerm(traduccion)
    onClose()
  }

  return (
    <div className="eg-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Glosario de referencia">
      <div className="eg-modal" onClick={e => e.stopPropagation()}>
        <div className="eg-modal-header">
          <div className="eg-modal-title-row">
            <BookOpen size={18} aria-hidden="true" />
            <h2 className="eg-modal-title">Glosario de referencia</h2>
          </div>
          {data?.metadata?.titulo && <p className="eg-modal-sub">{data.metadata.titulo}</p>}
          <p className="eg-modal-hint">Haz clic en un término para usarlo como etiqueta</p>
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
          {loading && <div className="eg-loading"><RefreshCw size={18} className="spin" aria-hidden="true" /> Cargando glosario…</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="eg-empty"><BookOpen size={28} aria-hidden="true" /><p>No se encontraron términos</p></div>
          )}
          {!loading && filtered.map(cat => (
            <div key={cat.nombre} className="eg-glosario-cat">
              <h3 className="eg-glosario-cat-title">{cat.nombre}</h3>
              <div className="eg-glosario-terms" role="list" aria-label={cat.nombre}>
                {cat.terminos.map((t, i) => (
                  <button
                    key={i}
                    role="listitem"
                    className="eg-glosario-term"
                    onClick={() => handleSelect(t.traduccion)}
                    aria-label={`Usar "${t.traduccion}" (${t.espanol}) como etiqueta`}
                  >
                    {/* Primary: word in indigenous language */}
                    <span className="eg-glosario-term-traduccion">{t.traduccion}</span>
                    {/* Secondary: Spanish meaning in parens */}
                    <span className="eg-glosario-term-espanol">({t.espanol})</span>
                    {/* Optional note on next line */}
                    {t.nota && <span className="eg-glosario-term-nota">{t.nota}</span>}
                  </button>
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
   Receives pendingTerm from workspace: if a term was selected
   from the glossary and this row is expanded, auto-fills input.
═══════════════════════════════════════════════════════ */

function AudioRow({ audio, community, session, onLabelChange, isExpanded, onToggle, pendingTerm, onClearPendingTerm }: {
  audio: AudioItem
  community: string
  session: string
  onLabelChange: () => void
  isExpanded: boolean
  onToggle: () => void
  pendingTerm: string | null
  onClearPendingTerm: () => void
}) {
  const [mode, setMode]         = useState<LabelMode>('idle')
  const [inputVal, setInputVal] = useState(audio.etiqueta ?? '')
  const [apiError, setApiError] = useState<string | null>(null)

  // When this row opens AND there's a glossary term waiting → auto-fill
  useEffect(() => {
    if (isExpanded && pendingTerm) {
      setInputVal(pendingTerm)
      // If already labeled, switch to editing mode so the input is visible
      if (audio.etiquetado && mode === 'idle') setMode('editing')
      onClearPendingTerm()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, pendingTerm])

  const audioUrl = `${API}/api/grabaciones/${community}/${session}/audios/${encodeURIComponent(audio.nombre)}`
  const isLabeled = audio.etiquetado
  const isBusy    = mode === 'saving' || mode === 'deleting'

  function startEdit()  { setInputVal(audio.etiqueta ?? ''); setApiError(null); setMode('editing') }
  function cancelEdit() { setInputVal(audio.etiqueta ?? ''); setApiError(null); setMode('idle') }

  async function handleSave() {
    if (!inputVal.trim()) return
    setMode('saving'); setApiError(null)
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
      {/* Row header */}
      <button
        className="eg-audio-row-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`audio-body-${audio.nombre}`}
      >
        <span className={`eg-audio-status${isLabeled ? ' eg-audio-status--done' : ''}`}>
          {isLabeled
            ? <><Check  size={11} aria-hidden="true" /> Etiquetado</>
            : <><Tag    size={11} aria-hidden="true" /> Pendiente</>}
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
          {/* HU-16: audio player */}
          <audio controls src={audioUrl} className="eg-audio-player" aria-label={`Reproducir ${audio.nombre}`}>
            Tu navegador no soporta el elemento audio.
          </audio>

          {/* Label form */}
          <div className="eg-label-form">
            <p className="eg-label-form-title">
              <Tag size={14} aria-hidden="true" /> Etiqueta en lengua indígena
            </p>

            {showDisplay && (
              <div className="eg-label-display">
                <span className="eg-label-value">{audio.etiqueta}</span>
                <div className="eg-label-actions">
                  <button onClick={startEdit} disabled={isBusy} className="eg-btn eg-btn--ghost" aria-label="Editar etiqueta">
                    <Edit2 size={14} aria-hidden="true" /> Editar
                  </button>
                  <button onClick={handleDelete} disabled={isBusy} className="eg-btn eg-btn--danger" aria-label="Eliminar etiqueta">
                    {mode === 'deleting'
                      ? <><RefreshCw size={14} className="spin" aria-hidden="true" /> Eliminando…</>
                      : <><Trash2 size={14} aria-hidden="true" /> Eliminar</>}
                  </button>
                </div>
              </div>
            )}

            {showInput && (
              <div className="eg-label-input-row">
                <label htmlFor={`lbl-${audio.nombre}`} className="sr-only">Etiqueta para {audio.nombre}</label>
                <input
                  id={`lbl-${audio.nombre}`}
                  type="text"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder="Ej: Muñzek gue"
                  className="eg-gate-input eg-label-input"
                  disabled={isBusy}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                  autoFocus
                  autoComplete="off"
                />
                <div className="eg-label-input-btns">
                  <button
                    onClick={handleSave}
                    disabled={isBusy || !inputVal.trim()}
                    className="eg-btn eg-btn--primary"
                    aria-label={isLabeled ? 'Actualizar etiqueta' : 'Guardar etiqueta'}
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
═══════════════════════════════════════════════════════ */

function SessionWorkspace({ community, session, onBack }: {
  community: string; session: string; onBack: () => void
}) {
  const [audios, setAudios]         = useState<AudioItem[]>([])
  const [estado, setEstado]         = useState<EstadoResponse | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showGlosario, setShowGlosario] = useState(false)
  // Accordion: only one row open at a time
  const [expandedAudio, setExpandedAudio] = useState<string | null>(null)
  // Pending term from glossary selection
  const [pendingTerm, setPendingTerm] = useState<string | null>(null)

  const clearPendingTerm = useCallback(() => setPendingTerm(null), [])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const audiosRes = await fetch(`${API}/api/grabaciones/${community}/${session}/audios/`)
      if (!audiosRes.ok) throw new Error(`HTTP ${audiosRes.status}`)
      const audiosData = await audiosRes.json()

      const estadoRes = await fetch(`${API}/api/grabaciones/${community}/${session}/estado/`)
      let estadoData: EstadoResponse | null = null
      if (estadoRes.ok) estadoData = await estadoRes.json()

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

  function handleToggle(nombre: string) {
    setExpandedAudio(prev => prev === nombre ? null : nombre)
  }

  // When a glossary term is selected, close modal and store term.
  // If there's already an open row, the AudioRow useEffect will pick it up immediately.
  function handleSelectTerm(term: string) {
    setPendingTerm(term)
    setShowGlosario(false)
  }

  const pct     = estado?.porcentaje_completado ?? 0
  const labeled = estado?.total_etiquetados ?? 0
  const total   = estado?.total_audios ?? audios.length

  return (
    <div className="eg-workspace">
      {/* Sticky workspace header */}
      <div className="eg-ws-header">
        <div className="container">
          <div className="eg-ws-nav">
            <button onClick={onBack} className="eg-btn eg-btn--ghost-light" aria-label="Volver a jornadas">
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
            <button onClick={() => setShowGlosario(true)} className="eg-btn eg-btn--ghost-light" aria-label="Abrir glosario">
              <BookOpen size={15} aria-hidden="true" /> Glosario
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
        {/* Pending term banner */}
        {pendingTerm && (
          <div className="eg-pending-term" role="status" aria-live="polite">
            <Tag size={14} aria-hidden="true" />
            <span>Término seleccionado: <strong>{pendingTerm}</strong></span>
            <span className="eg-pending-term-hint">— expande un audio para aplicarlo</span>
            <button onClick={clearPendingTerm} className="eg-pending-term-dismiss" aria-label="Descartar término">
              <X size={14} />
            </button>
          </div>
        )}

        {error && (
          <div className="eg-section">
            <div className="eg-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /> {error}</div>
          </div>
        )}
        {loading && (
          <div className="eg-section">
            <div className="eg-loading"><RefreshCw size={20} className="spin" aria-hidden="true" /> Cargando audios…</div>
          </div>
        )}

        {!loading && !error && (
          <section className="eg-section" aria-label="Lista de audios de la jornada">
            <div className="eg-section-header">
              <h2 className="eg-section-title">
                <Music size={18} aria-hidden="true" /> Audios · {session}
              </h2>
              <button onClick={fetchData} className="eg-refresh-btn" aria-label="Recargar">
                <RefreshCw size={15} aria-hidden="true" /> Actualizar
              </button>
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
                    onToggle={() => handleToggle(a.nombre)}
                    pendingTerm={pendingTerm}
                    onClearPendingTerm={clearPendingTerm}
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
          onSelectTerm={handleSelectTerm}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   MAIN APP — navigation state
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

/* ═══════════════════════════════════════════════════════
   ENTRY POINT
═══════════════════════════════════════════════════════ */

export default function Etiquetado() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  return authed
    ? <EtiquetadoApp />
    : <PasswordGate onAuth={() => setAuthed(true)} />
}
