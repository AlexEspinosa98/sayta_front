import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Lock, Database, Cpu, Play, Mic, MicOff, Upload, Volume2,
  Loader2, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, Download, HardDrive,
  Star, RefreshCw, BarChart2, Languages, Activity, Zap, FolderPlus,
  type LucideIcon,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const API      = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
const ADMIN_PW = 'Un1m4gd4l3n4'
const SESS_KEY = 'entrenamiento_auth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LenguaASR {
  id: number; codigo: string; nombre: string; activa: boolean
  embedding_activo: object | null
}

type ComunidadesUsadas =
  | { modo: 'todos' }
  | { modo: 'comunidades'; comunidades: string[] }
  | { modo: 'sesiones'; sesiones: { comunidad: string; jornada: string }[] }

function formatComunidades(cu: ComunidadesUsadas | null | undefined): string {
  if (!cu) return '—'
  if (cu.modo === 'todos') return 'Todos los datos'
  if (cu.modo === 'comunidades') return cu.comunidades.join(', ')
  const counts = cu.sesiones.reduce<Record<string, number>>((acc, s) => {
    acc[s.comunidad] = (acc[s.comunidad] ?? 0) + 1; return acc
  }, {})
  return Object.entries(counts).map(([c, n]) => `${n} jornada${n > 1 ? 's' : ''} de ${c}`).join(', ')
}

interface ComunidadStat {
  comunidad: string; total_jornadas: number; total_audios: number
  etiquetados: number; sin_etiquetar: number
  porcentaje_completado: number; apto_para_entrenamiento: boolean
}

interface JornadaStat { jornada: string; total_audios: number; etiquetados: number; porcentaje: number }

interface ComunidadDetalle {
  comunidad: string; total_audios: number; etiquetados: number
  apto_para_entrenamiento: boolean; jornadas: JornadaStat[]
}

interface Sesion {
  comunidad: string; jornada: string; total_audios: number
  etiquetados: number; sin_etiquetar: number; porcentaje: number; apta: boolean
}

interface ModeloHF {
  nombre_hf: string; tipo: string; descripcion: string
  tamaño_aprox: string; parametros: string
  recomendado: boolean; gpu_requerida: boolean; descargado: boolean; id_bd: number | null
}

interface ModeloLocal {
  id: number; nombre_hf: string; tipo: string; tipo_display: string
  descripcion: string; ruta_local: string; descargado: boolean; created_at: string
}

interface Experimento {
  id: string; nombre: string; lengua_codigo: string; lengua_nombre: string
  modelo_nombre: string; comunidades_usadas: ComunidadesUsadas
  estado: string; estado_display: string; is_active: boolean
  num_muestras_train: number; num_muestras_eval: number
  metricas: Record<string, number>; created_at: string; completed_at: string | null
}

interface ExperimentoDetalle extends Experimento {
  modelo_base_info: { id: number; nombre_hf: string; tipo: string; tipo_display: string; descargado: boolean }
  config_entrenamiento: Record<string, unknown>
  ruta_modelo_entrenado: string; mlflow_run_id: string
  mlflow_experiment_id: string; mlflow_experiment_name: string; mlflow_tracking_uri: string
  error_mensaje: string; task_id: string
  task_info: { experimento_id: string; started_at: string; estado: string } | null
}

interface ExperimentoEstado {
  id: string; nombre: string
  lengua: string; modelo: string  // campo corto del endpoint /estado/
  estado: string; is_active: boolean
  num_muestras_train: number; num_muestras_eval: number
  metricas: Record<string, number>
  mlflow_run_id: string; mlflow_experiment_name: string; mlflow_experiment_id?: string
  error_mensaje: string; created_at: string; completed_at: string | null
  task_info: { experimento_id: string; started_at: string; estado: string } | null
}

interface SesionKey { comunidad: string; jornada: string }

interface SubirResult {
  mensaje: string; comunidad: string; jornada: string
  archivo_audio: string; duracion_segundos: number
  transcripcion_guardada: string; ruta_relativa: string
  jornada_stats: { total_audios: number; etiquetados: number; sin_etiquetar: number; porcentaje: number }
}

type Expand = ComunidadDetalle | 'loading' | null
type Tab = 'datos' | 'modelos' | 'entrenar' | 'experimentos' | 'transcribir' | 'subir'
type DataMode = 'todos' | 'comunidades' | 'sesiones'

// ── API helper ────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const isForm = opts?.body instanceof FormData
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: isForm
      ? { Accept: 'application/json', ...(opts?.headers ?? {}) }
      : { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts?.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, data }
  return data
}

function apiErr(e: unknown, fallback = 'Error desconocido.') {
  return (e as { data?: { error?: string } })?.data?.error ?? fallback
}

// ── Mini components ───────────────────────────────────────────────────────────

function WerBadge({ wer }: { wer: number }) {
  const cls = wer < 0.3 ? 'ent-metric--good' : wer < 0.5 ? 'ent-metric--mid' : 'ent-metric--bad'
  return <span className={`ent-metric-badge ${cls}`}>{(wer * 100).toFixed(1)}%</span>
}

function EstadoBadge({ estado, isActive }: { estado: string; isActive: boolean }) {
  const map: Record<string, string> = {
    completado: 'ent-estado--completado', entrenando: 'ent-estado--entrenando',
    fallido: 'ent-estado--fallido', pendiente: 'ent-estado--pendiente',
  }
  if (isActive) return <span className="ent-estado ent-estado--activo">Activo</span>
  return <span className={`ent-estado ${map[estado] ?? ''}`}>{estado}</span>
}

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(false)

  const submit = () => {
    if (pw === ADMIN_PW) { sessionStorage.setItem(SESS_KEY, '1'); onAuth() }
    else { setErr(true); setShake(true); setTimeout(() => setShake(false), 500) }
  }

  return (
    <div className="ent-gate">
      <div className="ent-gate-icon"><Lock size={32} /></div>
      <h2 className="ent-gate-title">Módulo de Entrenamiento ASR</h2>
      <p className="ent-gate-sub">Uso exclusivo del equipo de investigación. Ingresa la contraseña para acceder.</p>
      <div className={`ent-gate-form${shake ? ' shake' : ''}`}>
        <input
          type="password" autoFocus
          className={`gl-input${err ? ' gl-input--error' : ''}`}
          placeholder="Contraseña de administrador"
          value={pw}
          onChange={e => { setPw(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <button className="ent-btn ent-btn--primary" onClick={submit} type="button">
          <Lock size={14} /> Ingresar
        </button>
      </div>
      {err && <p className="ent-gate-err">Contraseña incorrecta.</p>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DatosTab — HU-15 + HU-15b + HU-15c + HU-16
// ══════════════════════════════════════════════════════════════════════════════

function sesionId(s: SesionKey) { return `${s.comunidad}::${s.jornada}` }

function DatosTab({ onSelectSesiones }: { onSelectSesiones: (s: SesionKey[]) => void }) {
  const [lenguasASR, setLenguasASR] = useState<LenguaASR[]>([])
  const [dataset, setDataset]       = useState<{ base_path: string; existe: boolean; comunidades: ComunidadStat[] } | null>(null)
  const [sesiones, setSesiones]     = useState<Sesion[]>([])
  const [loading, setLoading]       = useState(true)
  const [dataView, setDataView]     = useState<'comunidad' | 'jornada'>('comunidad')
  const [expanded, setExpanded]     = useState<Record<string, Expand>>({})
  const [selSesiones, setSelSesiones] = useState<SesionKey[]>([])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [lang, dat, ses] = await Promise.all([
        apiFetch('/terminos/lenguas/?page_size=50'),
        apiFetch('/entrenamiento/dataset/'),
        apiFetch('/entrenamiento/dataset/sesiones/'),
      ])
      setLenguasASR(lang.results ?? lang)
      setDataset(dat)
      setSesiones(ses.sesiones ?? [])
    } catch { /* silencio */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const toggleExpand = async (com: string) => {
    if (expanded[com] !== undefined) {
      setExpanded(p => { const n = { ...p }; delete n[com]; return n })
      return
    }
    setExpanded(p => ({ ...p, [com]: 'loading' }))
    try {
      const d: ComunidadDetalle = await apiFetch(`/entrenamiento/dataset/${com}/`)
      setExpanded(p => ({ ...p, [com]: d }))
    } catch { setExpanded(p => ({ ...p, [com]: null })) }
  }

  // Session selection helpers
  const isSesionSel = (com: string, jor: string) =>
    selSesiones.some(s => s.comunidad === com && s.jornada === jor)

  const toggleSesion = (com: string, jor: string) => {
    const next = isSesionSel(com, jor)
      ? selSesiones.filter(s => !(s.comunidad === com && s.jornada === jor))
      : [...selSesiones, { comunidad: com, jornada: jor }]
    setSelSesiones(next); onSelectSesiones(next)
  }

  const comSesiones = (com: string) => sesiones.filter(s => s.comunidad === com && s.apta)
  const comAllSel   = (com: string) => comSesiones(com).every(s => isSesionSel(com, s.jornada))

  const toggleAllCom = (com: string) => {
    const all = comSesiones(com)
    let next: SesionKey[]
    if (comAllSel(com)) {
      next = selSesiones.filter(s => s.comunidad !== com)
    } else {
      const existing = selSesiones.filter(s => s.comunidad !== com)
      next = [...existing, ...all.map(s => ({ comunidad: com, jornada: s.jornada }))]
    }
    setSelSesiones(next); onSelectSesiones(next)
  }

  // Group sesiones by community
  const groups = sesiones.reduce<Record<string, Sesion[]>>((acc, s) => {
    if (!acc[s.comunidad]) acc[s.comunidad] = []
    acc[s.comunidad].push(s)
    return acc
  }, {})

  const totalSelEtiq = selSesiones.reduce((sum, sk) => {
    const s = sesiones.find(x => x.comunidad === sk.comunidad && x.jornada === sk.jornada)
    return sum + (s?.etiquetados ?? 0)
  }, 0)

  if (loading) return <div className="ent-loading"><Loader2 size={18} className="spin" /> Cargando datos…</div>

  return (
    <div className="ent-section">
      <div className="ent-section-head">
        <h2 className="ent-section-title">Estado del sistema</h2>
        <button className="ent-btn ent-btn--ghost" onClick={loadAll} type="button"><RefreshCw size={13} /> Actualizar</button>
      </div>

      {/* ── Lenguas (HU-15) ── */}
      <div className="ent-lenguas-grid">
        {lenguasASR.length === 0 ? (
          <p className="ent-hint">No hay lenguas registradas.</p>
        ) : lenguasASR.map(l => (
          <div key={l.id} className={`ent-lengua-card ${l.activa ? 'ent-lengua-card--active' : ''}`}>
            <div className="ent-lengua-head">
              <span className="ent-lengua-name">{l.nombre}</span>
              <span className="ent-lengua-code">{l.codigo}</span>
              {l.activa
                ? <span className="ent-badge ent-badge--ok"><CheckCircle2 size={10} /> Activa</span>
                : <span className="ent-badge ent-badge--warn"><AlertTriangle size={10} /> Inactiva</span>}
            </div>
            <p className="ent-hint">
              {l.embedding_activo ? 'Embedding disponible' : 'Sin embedding activo'}
            </p>
          </div>
        ))}
      </div>

      {/* ── Dataset (HU-15b / HU-15c) ── */}
      <div className="ent-section-head" style={{ marginTop: 8 }}>
        <h3 className="ent-subsection-title">Datos de entrenamiento</h3>
        <div className="ent-view-toggle">
          <button
            className={`ent-view-btn ${dataView === 'comunidad' ? 'ent-view-btn--active' : ''}`}
            onClick={() => setDataView('comunidad')} type="button"
          >Por comunidad</button>
          <button
            className={`ent-view-btn ${dataView === 'jornada' ? 'ent-view-btn--active' : ''}`}
            onClick={() => setDataView('jornada')} type="button"
          >Por jornada</button>
        </div>
      </div>

      {!dataset?.existe && (
        <div className="ent-empty"><AlertTriangle size={18} /> El directorio de grabaciones no existe en el servidor.</div>
      )}

      {dataset?.existe && dataView === 'comunidad' && (
        <div className="ent-comunidades">
          {dataset.comunidades.map(c => (
            <div key={c.comunidad} className="ent-com-card">
              <div className="ent-com-head">
                <span className="ent-com-name">{c.comunidad}</span>
                <div className="ent-badges-row">
                  {c.apto_para_entrenamiento
                    ? <span className="ent-badge ent-badge--ok"><CheckCircle2 size={10} /> Apto</span>
                    : <span className="ent-badge ent-badge--warn"><AlertTriangle size={10} /> Insuficiente</span>}
                </div>
                <button className="ent-btn-icon" onClick={() => toggleExpand(c.comunidad)} type="button"
                  aria-label={expanded[c.comunidad] !== undefined ? 'Colapsar' : 'Expandir'}>
                  {expanded[c.comunidad] !== undefined ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
              </div>
              <div className="ent-com-stats">
                <span><strong>{c.etiquetados}</strong> etiquetados</span>
                <span className="ent-sep">·</span>
                <span>{c.sin_etiquetar} sin etiquetar</span>
                <span className="ent-sep">·</span>
                <span>{c.total_audios} total · {c.total_jornadas} jornadas</span>
              </div>
              <div className="ent-prog-wrap">
                <div className="ent-prog-bar">
                  <div className={`ent-prog-fill ${c.porcentaje_completado >= 70 ? 'ent-prog--high' : c.porcentaje_completado >= 40 ? 'ent-prog--mid' : 'ent-prog--low'}`}
                    style={{ width: `${c.porcentaje_completado}%` }} />
                </div>
                <span className="ent-prog-pct">{c.porcentaje_completado.toFixed(1)}%</span>
              </div>
              {expanded[c.comunidad] !== undefined && (
                <div className="ent-jornadas">
                  {expanded[c.comunidad] === 'loading' ? (
                    <div className="ent-loading-sm"><Loader2 size={13} className="spin" /> Cargando jornadas…</div>
                  ) : expanded[c.comunidad] === null ? (
                    <p className="ent-err-sm">No se pudo cargar el detalle.</p>
                  ) : (
                    <table className="ent-table ent-table--sm">
                      <thead><tr><th>Jornada</th><th>Total</th><th>Etiquetados</th><th>%</th></tr></thead>
                      <tbody>
                        {(expanded[c.comunidad] as ComunidadDetalle).jornadas.map(j => (
                          <tr key={j.jornada}>
                            <td>
                              {j.porcentaje === 100 && <CheckCircle2 size={11} className="ent-check-icon" />}
                              <span className="ent-jornada-name">{j.jornada}</span>
                            </td>
                            <td>{j.total_audios}</td><td>{j.etiquetados}</td>
                            <td><span className={j.porcentaje === 100 ? 'ent-pct--full' : 'ent-pct'}>{j.porcentaje.toFixed(0)}%</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dataset?.existe && dataView === 'jornada' && (
        <div className="ent-sesiones-wrap">
          <p className="ent-hint" style={{ marginBottom: 8 }}>
            Marca las jornadas que quieres usar en el entrenamiento. Las selecciones se pre-cargarán en la pestaña <strong>Entrenar</strong>.
          </p>
          {Object.entries(groups).map(([com, sesList]) => {
            const aptasList = sesList.filter(s => s.apta)
            const allSel  = aptasList.length > 0 && aptasList.every(s => isSesionSel(com, s.jornada))
            const noneSel = aptasList.every(s => !isSesionSel(com, s.jornada))
            return (
              <div key={com} className="ent-ses-group">
                <div className="ent-ses-group-head">
                  <label className="ent-check-label">
                    <input
                      type="checkbox"
                      className="ent-checkbox"
                      checked={allSel}
                      ref={el => { if (el) el.indeterminate = !allSel && !noneSel }}
                      onChange={() => toggleAllCom(com)}
                    />
                    <span className="ent-com-name">{com}</span>
                  </label>
                  <span className="ent-hint">{aptasList.length} jornada{aptasList.length !== 1 ? 's' : ''} aptas</span>
                </div>
                <div className="ent-ses-list">
                  {sesList.map(s => (
                    <label
                      key={sesionId(s)}
                      className={`ent-ses-item ${!s.apta ? 'ent-ses-item--disabled' : ''} ${isSesionSel(s.comunidad, s.jornada) ? 'ent-ses-item--selected' : ''}`}
                    >
                      <input
                        type="checkbox" className="ent-checkbox"
                        disabled={!s.apta}
                        checked={isSesionSel(s.comunidad, s.jornada)}
                        onChange={() => toggleSesion(s.comunidad, s.jornada)}
                      />
                      <span className="ent-ses-name">{s.jornada}</span>
                      <span className="ent-ses-meta">{s.etiquetados} muestras · {s.porcentaje.toFixed(0)}%</span>
                      {s.porcentaje === 100 && <CheckCircle2 size={11} className="ent-check-icon" />}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}

          {selSesiones.length > 0 && (
            <div className="ent-selection-bar">
              <span><strong>{selSesiones.length}</strong> jornada{selSesiones.length !== 1 ? 's' : ''} seleccionada{selSesiones.length !== 1 ? 's' : ''}</span>
              <span>Total etiquetados: <strong>{totalSelEtiq}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ModelosTab — HU-17 + HU-18 + HU-19
// ══════════════════════════════════════════════════════════════════════════════

function ModelosTab() {
  const [catalogo, setCatalogo]     = useState<ModeloHF[]>([])
  const [descargados, setDescargados] = useState<ModeloLocal[]>([])
  const [loading, setLoading]       = useState(true)
  const [dlState, setDlState]       = useState<Record<string, boolean>>({})
  const [dlErr, setDlErr]           = useState<Record<string, string>>({})

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cat, desc] = await Promise.all([
        apiFetch('/entrenamiento/modelos-disponibles/'),
        apiFetch('/entrenamiento/modelos/'),
      ])
      setCatalogo(cat.modelos ?? [])
      setDescargados(desc.modelos ?? [])
    } catch { /* silencio */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const descargar = async (m: ModeloHF) => {
    setDlState(p => ({ ...p, [m.nombre_hf]: true }))
    setDlErr(p => { const n = { ...p }; delete n[m.nombre_hf]; return n })
    try {
      await apiFetch('/entrenamiento/modelos/descargar/', {
        method: 'POST',
        body: JSON.stringify({ nombre_hf: m.nombre_hf, tipo: m.tipo, descripcion: m.descripcion }),
      })
      await loadAll()
    } catch (e) {
      setDlErr(p => ({ ...p, [m.nombre_hf]: apiErr(e, 'Error al descargar.') }))
    } finally {
      setDlState(p => ({ ...p, [m.nombre_hf]: false }))
    }
  }

  if (loading) return <div className="ent-loading"><Loader2 size={18} className="spin" /> Cargando modelos…</div>

  return (
    <div className="ent-section">
      <div className="ent-section-head">
        <div>
          <h2 className="ent-section-title">Catálogo de modelos ASR</h2>
          <p className="ent-section-sub">Modelos curados para fine-tuning en lenguas indígenas</p>
        </div>
        <button className="ent-btn ent-btn--ghost" onClick={loadAll} type="button"><RefreshCw size={13} /> Actualizar</button>
      </div>

      <div className="ent-modelos-grid">
        {catalogo.map(m => (
          <div key={m.nombre_hf} className={`ent-modelo-card${m.descargado ? ' ent-modelo-card--downloaded' : ''}`}>
            <div className="ent-modelo-head">
              <span className="ent-modelo-name">{m.nombre_hf}</span>
              <div className="ent-badges-row">
                {m.recomendado   && <span className="ent-badge ent-badge--rec"><Star size={9} /> Recomendado</span>}
                {m.gpu_requerida && <span className="ent-badge ent-badge--gpu"><Cpu size={9} /> GPU</span>}
                {m.descargado    && <span className="ent-badge ent-badge--ok"><HardDrive size={9} /> Descargado</span>}
              </div>
            </div>
            <p className="ent-modelo-desc">{m.descripcion}</p>
            <div className="ent-modelo-meta">
              <span>{m.parametros}</span><span className="ent-sep">·</span>
              <span>{m.tamaño_aprox}</span><span className="ent-sep">·</span>
              <span className="ent-tipo-pill">{m.tipo}</span>
            </div>
            {dlErr[m.nombre_hf] && <p className="ent-err-sm">{dlErr[m.nombre_hf]}</p>}
            <button
              className={`ent-btn ${m.descargado ? 'ent-btn--ghost' : 'ent-btn--primary'}`}
              disabled={m.descargado || dlState[m.nombre_hf]}
              onClick={() => descargar(m)} type="button"
            >
              {dlState[m.nombre_hf]
                ? <><Loader2 size={13} className="spin" /> Descargando…</>
                : m.descargado
                  ? <><HardDrive size={13} /> Disponible</>
                  : <><Download size={13} /> Descargar</>}
            </button>
          </div>
        ))}
      </div>

      {descargados.length > 0 && (
        <>
          <h3 className="ent-subsection-title" style={{ marginTop: 8 }}>Modelos en servidor local ({descargados.length})</h3>
          <div className="ent-table-wrap">
            <table className="ent-table">
              <thead><tr><th>Modelo</th><th>Tipo</th><th>Ruta</th><th>Descargado</th></tr></thead>
              <tbody>
                {descargados.map(m => (
                  <tr key={m.id}>
                    <td className="ent-td-bold">{m.nombre_hf}</td>
                    <td><span className="ent-tipo-pill">{m.tipo_display}</span></td>
                    <td className="ent-td-mono">{m.ruta_local}</td>
                    <td>{new Date(m.created_at).toLocaleDateString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EntrenarTab — HU-20 (3 modos: todos / comunidades / sesiones)
// ══════════════════════════════════════════════════════════════════════════════

function EntrenarTab({
  preselectedSesiones,
  onStarted,
}: { preselectedSesiones: SesionKey[]; onStarted: (id: string) => void }) {
  const [lenguasASR, setLenguasASR] = useState<LenguaASR[]>([])
  const [modelos, setModelos]       = useState<ModeloLocal[]>([])
  const [sesiones, setSesiones]     = useState<Sesion[]>([])
  const [loading, setLoading]       = useState(true)

  const [nombre, setNombre]         = useState('')
  const [lenguaId, setLenguaId]     = useState<number | ''>('')
  const [modeloId, setModeloId]     = useState<number | ''>('')
  const [dataMode, setDataMode]     = useState<DataMode>('sesiones')

  // Comunidades mode
  const [selComunidades, setSelComunidades] = useState<string[]>([])
  // Sesiones mode
  const [selSesiones, setSelSesiones]       = useState<SesionKey[]>(preselectedSesiones)

  const [showAdv, setShowAdv]   = useState(false)
  const [cfg, setCfg] = useState({
    num_train_epochs: 20, per_device_train_batch_size: 4,
    gradient_accumulation_steps: 2, learning_rate: 1e-5,
    warmup_steps: 100, use_peft: false, whisper_language: 'es',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]   = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch('/terminos/lenguas/?page_size=50'),
      apiFetch('/entrenamiento/modelos/'),
      apiFetch('/entrenamiento/dataset/sesiones/'),
    ]).then(([lang, mod, ses]) => {
      setLenguasASR(lang.results ?? lang)
      setModelos(mod.modelos ?? [])
      setSesiones(ses.sesiones ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (preselectedSesiones.length > 0) {
      setSelSesiones(preselectedSesiones)
      setDataMode('sesiones')
    }
  }, [preselectedSesiones])

  // Group sesiones by community
  const groups = sesiones.reduce<Record<string, Sesion[]>>((acc, s) => {
    if (!acc[s.comunidad]) acc[s.comunidad] = []
    acc[s.comunidad].push(s)
    return acc
  }, {})
  const communities = Object.keys(groups)

  const isSesionSel = (com: string, jor: string) =>
    selSesiones.some(s => s.comunidad === com && s.jornada === jor)

  const toggleSesion = (com: string, jor: string) => {
    setSelSesiones(p =>
      isSesionSel(com, jor)
        ? p.filter(s => !(s.comunidad === com && s.jornada === jor))
        : [...p, { comunidad: com, jornada: jor }]
    )
  }

  const toggleAllCom = (com: string) => {
    const aptasList = (groups[com] ?? []).filter(s => s.apta)
    const allSel = aptasList.every(s => isSesionSel(com, s.jornada))
    if (allSel) {
      setSelSesiones(p => p.filter(s => s.comunidad !== com))
    } else {
      setSelSesiones(p => [
        ...p.filter(s => s.comunidad !== com),
        ...aptasList.map(s => ({ comunidad: com, jornada: s.jornada })),
      ])
    }
  }

  // Calculate total selected samples for each mode
  const totalEtiq = (() => {
    if (dataMode === 'todos') return sesiones.reduce((s, j) => s + j.etiquetados, 0)
    if (dataMode === 'comunidades') return sesiones
      .filter(s => selComunidades.includes(s.comunidad)).reduce((a, s) => a + s.etiquetados, 0)
    return selSesiones.reduce((sum, sk) => {
      const s = sesiones.find(x => x.comunidad === sk.comunidad && x.jornada === sk.jornada)
      return sum + (s?.etiquetados ?? 0)
    }, 0)
  })()

  const canSubmit = Boolean(
    nombre.trim() && lenguaId && modeloId && totalEtiq >= 5 &&
    (dataMode === 'todos' || (dataMode === 'comunidades' && selComunidades.length > 0) ||
     (dataMode === 'sesiones' && selSesiones.length > 0))
  )

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setSubmitErr('')
    try {
      const base = { nombre: nombre.trim(), lengua_id: lenguaId, modelo_audio_id: modeloId, config: cfg }
      const dataPayload =
        dataMode === 'todos' ? { todos: true }
        : dataMode === 'comunidades' ? { comunidades: selComunidades }
        : { sesiones: selSesiones.map(s => ({ comunidad: s.comunidad, jornada: s.jornada })) }
      const data = await apiFetch('/entrenamiento/entrenar/', {
        method: 'POST',
        body: JSON.stringify({ ...base, ...dataPayload }),
      })
      onStarted(data.experimento_id)
    } catch (e) { setSubmitErr(apiErr(e, 'Error al lanzar el entrenamiento.')) }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="ent-loading"><Loader2 size={18} className="spin" /> Cargando…</div>

  return (
    <div className="ent-section">
      <div className="ent-section-head">
        <div>
          <h2 className="ent-section-title">Lanzar fine-tuning</h2>
          <p className="ent-section-sub">Configura y lanza un entrenamiento ASR</p>
        </div>
      </div>

      <div className="ent-form">
        {/* Nombre */}
        <div className="ent-field">
          <label className="ent-label">Nombre del experimento <span className="ent-req">*</span></label>
          <input className="gl-input" placeholder="ej. whisper-small-iku-v1"
            value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>

        {/* Lengua + Modelo */}
        <div className="ent-form-row">
          <div className="ent-field">
            <label className="ent-label">Lengua <span className="ent-req">*</span></label>
            <select className="gl-input" value={lenguaId}
              onChange={e => setLenguaId(Number(e.target.value) as number | '')}>
              <option value="">— Selecciona una lengua —</option>
              {lenguasASR.map(l => (
                <option key={l.id} value={l.id}>{l.nombre} ({l.codigo})</option>
              ))}
            </select>
          </div>
          <div className="ent-field">
            <label className="ent-label">Modelo base <span className="ent-req">*</span></label>
            <select className="gl-input" value={modeloId}
              onChange={e => setModeloId(Number(e.target.value) as number | '')}>
              <option value="">— Selecciona un modelo —</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nombre_hf}</option>)}
            </select>
            {modelos.length === 0 && (
              <p className="ent-hint ent-hint-err">Sin modelos descargados. Ve a <strong>Modelos</strong>.</p>
            )}
          </div>
        </div>

        {/* Modo de selección de datos */}
        <div className="ent-field">
          <label className="ent-label">Datos de entrenamiento <span className="ent-req">*</span></label>
          <div className="ent-mode-radios">
            {([
              ['todos',      'Todos los audios del sistema',      'Usa todos los audios etiquetados disponibles'],
              ['comunidades','Por comunidades completas',          'Selecciona comunidades enteras'],
              ['sesiones',   'Selección de jornadas (granular)',   'Elige jornadas individuales con checkboxes'],
            ] as [DataMode, string, string][]).map(([mode, label, hint]) => (
              <label key={mode} className={`ent-radio-label ${dataMode === mode ? 'ent-radio-label--active' : ''}`}>
                <input type="radio" name="dataMode" value={mode} className="ent-radio"
                  checked={dataMode === mode} onChange={() => setDataMode(mode)} />
                <div>
                  <span className="ent-radio-title">{label}</span>
                  <span className="ent-radio-hint">{hint}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Modo: Todos */}
          {dataMode === 'todos' && (
            <div className="ent-data-preview">
              <p className="ent-hint">Total disponible: <strong>{sesiones.reduce((s, j) => s + j.etiquetados, 0)} muestras etiquetadas</strong> en {sesiones.filter(s => s.apta).length} jornadas.</p>
            </div>
          )}

          {/* Modo: Comunidades */}
          {dataMode === 'comunidades' && (
            <div className="ent-checkboxes ent-data-preview">
              {communities.map(com => {
                const etiq = (groups[com] ?? []).reduce((s, j) => s + j.etiquetados, 0)
                return (
                  <label key={com} className="ent-check-label">
                    <input type="checkbox" className="ent-checkbox"
                      checked={selComunidades.includes(com)}
                      onChange={() => setSelComunidades(p =>
                        p.includes(com) ? p.filter(c => c !== com) : [...p, com]
                      )}
                    />
                    <span>{com}</span>
                    <span className="ent-check-meta">{etiq} muestras</span>
                  </label>
                )
              })}
            </div>
          )}

          {/* Modo: Sesiones granulares */}
          {dataMode === 'sesiones' && (
            <div className="ent-sesiones-wrap ent-data-preview">
              {Object.entries(groups).map(([com, sesList]) => {
                const aptasList = sesList.filter(s => s.apta)
                const allSel  = aptasList.length > 0 && aptasList.every(s => isSesionSel(com, s.jornada))
                const noneSel = aptasList.every(s => !isSesionSel(com, s.jornada))
                return (
                  <div key={com} className="ent-ses-group">
                    <div className="ent-ses-group-head">
                      <label className="ent-check-label">
                        <input
                          type="checkbox" className="ent-checkbox"
                          checked={allSel}
                          ref={el => { if (el) el.indeterminate = !allSel && !noneSel }}
                          onChange={() => toggleAllCom(com)}
                        />
                        <span className="ent-com-name">{com}</span>
                      </label>
                      <span className="ent-hint">{aptasList.length} jornada{aptasList.length !== 1 ? 's' : ''} aptas</span>
                    </div>
                    <div className="ent-ses-list">
                      {sesList.map(s => (
                        <label key={`${s.comunidad}:${s.jornada}`}
                          className={`ent-ses-item ${!s.apta ? 'ent-ses-item--disabled' : ''} ${isSesionSel(s.comunidad, s.jornada) ? 'ent-ses-item--selected' : ''}`}>
                          <input type="checkbox" className="ent-checkbox" disabled={!s.apta}
                            checked={isSesionSel(s.comunidad, s.jornada)}
                            onChange={() => toggleSesion(s.comunidad, s.jornada)} />
                          <span className="ent-ses-name">{s.jornada}</span>
                          <span className="ent-ses-meta">{s.etiquetados} muestras · {s.porcentaje.toFixed(0)}%</span>
                          {s.porcentaje === 100 && <CheckCircle2 size={11} className="ent-check-icon" />}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Contador de muestras */}
          <div className="ent-sample-counter">
            <span className={`ent-sample-num ${totalEtiq >= 5 ? 'ent-sample-num--ok' : 'ent-sample-num--low'}`}>
              {totalEtiq}
            </span>
            <span className="ent-sample-label">muestras seleccionadas{totalEtiq < 5 ? ' (mínimo 5)' : ''}</span>
            {totalEtiq >= 5 && <CheckCircle2 size={14} style={{ color: '#16a34a' }} />}
          </div>
        </div>

        {/* Configuración avanzada */}
        <div className="ent-field">
          <button className="ent-btn ent-btn--ghost" onClick={() => setShowAdv(p => !p)} type="button">
            {showAdv ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Configuración avanzada
          </button>
          {showAdv && (
            <div className="ent-config-grid">
              {([
                ['num_train_epochs', 'Épocas', 'number'],
                ['per_device_train_batch_size', 'Batch size', 'number'],
                ['gradient_accumulation_steps', 'Gradient accum.', 'number'],
                ['learning_rate', 'Learning rate', 'number'],
                ['warmup_steps', 'Warmup steps', 'number'],
                ['whisper_language', 'Idioma Whisper', 'text'],
              ] as [keyof typeof cfg, string, string][]).map(([k, label, type]) => (
                <div className="ent-field" key={k}>
                  <label className="ent-label-sm">{label}</label>
                  <input type={type} step={k === 'learning_rate' ? '0.000001' : undefined}
                    className="gl-input" value={String(cfg[k])}
                    onChange={e => setCfg(p => ({ ...p, [k]: type === 'number' ? +e.target.value : e.target.value }))} />
                </div>
              ))}
              <div className="ent-field">
                <label className="ent-check-label">
                  <input type="checkbox" checked={cfg.use_peft}
                    onChange={e => setCfg(p => ({ ...p, use_peft: e.target.checked }))} />
                  <span>Usar LoRA (PEFT)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {submitErr && <div className="tc-api-error"><AlertTriangle size={14} /><span>{submitErr}</span></div>}

        <div className="ent-form-actions">
          <button className="ent-btn ent-btn--primary ent-btn--lg"
            disabled={!canSubmit || submitting} onClick={submit} type="button">
            {submitting
              ? <><Loader2 size={15} className="spin" /> Lanzando…</>
              : <><Play size={15} /> Lanzar entrenamiento</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Monitor — HU-21
// ══════════════════════════════════════════════════════════════════════════════

function Monitor({ id, onActivated }: { id: string; onActivated: () => void }) {
  const [estado, setEstado]     = useState<ExperimentoEstado | null>(null)
  const [activErr, setActivErr] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const d: ExperimentoEstado = await apiFetch(`/entrenamiento/experimentos/${id}/estado/`)
      setEstado(d)
      if (d.estado === 'completado' || d.estado === 'fallido' || d.is_active) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } catch { /* silencio */ }
  }, [id])

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [poll])

  const activar = async () => {
    setActivErr('')
    try { await apiFetch(`/entrenamiento/experimentos/${id}/activar/`, { method: 'POST' }); onActivated(); poll() }
    catch (e) { setActivErr(apiErr(e, 'Error al activar.')) }
  }

  if (!estado) return <div className="ent-loading-sm"><Loader2 size={14} className="spin" /> Conectando…</div>

  const isRunning = estado.estado === 'entrenando' || estado.estado === 'pendiente'
  const isDone    = estado.estado === 'completado'
  const isFailed  = estado.estado === 'fallido'

  return (
    <div className="ent-monitor">
      <div className="ent-monitor-head">
        <div>
          <span className="ent-monitor-name">{estado.nombre}</span>
          <span className="ent-sep">·</span>
          <span className="ent-monitor-sub">{estado.lengua} · {estado.modelo?.split('/')[1] ?? estado.modelo}</span>
        </div>
        <EstadoBadge estado={estado.estado} isActive={estado.is_active} />
      </div>

      {isRunning && (
        <div className="ent-monitor-running">
          <Loader2 size={18} className="spin" />
          <div>
            <p className="ent-monitor-msg">Entrenando… actualización cada 15 s</p>
            <p className="ent-monitor-sub2">Train: {estado.num_muestras_train} · Eval: {estado.num_muestras_eval} muestras</p>
          </div>
        </div>
      )}

      {isDone && (
        <div className="ent-monitor-done">
          {Object.keys(estado.metricas ?? {}).length > 0 && (
            <div className="ent-metrics-grid">
              {Object.entries(estado.metricas).map(([k, v]) => (
                <div key={k} className="ent-metric-cell">
                  <span className="ent-metric-key">{k.replace(/_/g, ' ')}</span>
                  <span className="ent-metric-val">
                    {k === 'eval_wer' || k === 'eval_cer'
                      ? <WerBadge wer={v} />
                      : typeof v === 'number' && v < 100 ? v.toFixed(4) : v}
                  </span>
                </div>
              ))}
            </div>
          )}
          {estado.mlflow_run_id && (
            <p className="ent-mlflow">
              MLflow: <a href={`http://localhost:5000/#/experiments/${estado.mlflow_experiment_id ?? '1'}/runs/${estado.mlflow_run_id}`}
                target="_blank" rel="noreferrer">{estado.mlflow_run_id.slice(0, 12)}…</a>
            </p>
          )}
          {!estado.is_active && (
            <button className="ent-btn ent-btn--primary" onClick={activar} type="button">
              <Zap size={13} /> Activar este modelo
            </button>
          )}
          {activErr && <p className="ent-err-sm">{activErr}</p>}
        </div>
      )}

      {isFailed && (
        <div className="ent-monitor-fail">
          <XCircle size={18} />
          <p>{estado.error_mensaje || 'El entrenamiento falló sin mensaje de error.'}</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ExperimentosTab — HU-22 + HU-23 + HU-24
// ══════════════════════════════════════════════════════════════════════════════

function ExperimentosTab({ monitorId, onClearMonitor }: { monitorId: string | null; onClearMonitor: () => void }) {
  const [exps, setExps]           = useState<Experimento[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterEstado, setFilter] = useState('')
  const [expandId, setExpandId]   = useState<string | null>(null)
  const [detail, setDetail]       = useState<ExperimentoDetalle | null>(null)
  const [activErr, setActivErr]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams(); if (filterEstado) p.set('estado', filterEstado)
    try { setExps((await apiFetch(`/entrenamiento/experimentos/?${p}`)).experimentos ?? []) }
    catch { /* silencio */ }
    finally { setLoading(false) }
  }, [filterEstado])

  useEffect(() => { load() }, [load])

  const expandDetalle = async (id: string) => {
    if (expandId === id) { setExpandId(null); setDetail(null); return }
    setExpandId(id); setDetail(null)
    try { setDetail(await apiFetch(`/entrenamiento/experimentos/${id}/`)) }
    catch { /* silencio */ }
  }

  const activar = async (id: string) => {
    setActivErr('')
    try { await apiFetch(`/entrenamiento/experimentos/${id}/activar/`, { method: 'POST' }); load() }
    catch (e) { setActivErr(apiErr(e, 'Error al activar.')) }
  }

  return (
    <div className="ent-section">
      {monitorId && (
        <div className="ent-monitor-box">
          <div className="ent-monitor-box-head">
            <span className="ent-subsection-title"><Activity size={13} /> Monitoreo en curso</span>
            <button className="ent-btn ent-btn--ghost ent-btn--sm" onClick={onClearMonitor} type="button">Ocultar</button>
          </div>
          <Monitor id={monitorId} onActivated={load} />
        </div>
      )}

      <div className="ent-section-head">
        <h2 className="ent-section-title">Historial de experimentos</h2>
        <div className="ent-filter-row">
          <select className="gl-input ent-filter-sel" value={filterEstado} onChange={e => setFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="entrenando">Entrenando</option>
            <option value="completado">Completado</option>
            <option value="activo">Activo</option>
            <option value="fallido">Fallido</option>
          </select>
          <button className="ent-btn ent-btn--ghost" onClick={load} type="button"><RefreshCw size={13} /></button>
        </div>
      </div>

      {activErr && <div className="tc-api-error" style={{ marginBottom: 10 }}><AlertTriangle size={14} /><span>{activErr}</span></div>}

      {loading ? (
        <div className="ent-loading"><Loader2 size={18} className="spin" /> Cargando experimentos…</div>
      ) : exps.length === 0 ? (
        <div className="ent-empty">Sin experimentos todavía. Lanza uno desde la pestaña <strong>Entrenar</strong>.</div>
      ) : (
        <div className="ent-table-wrap">
          <table className="ent-table">
            <thead>
              <tr><th /><th>Nombre</th><th>Lengua</th><th>Modelo</th><th>WER</th><th>Muestras</th><th>Estado</th><th>Fecha</th><th /></tr>
            </thead>
            <tbody>
              {exps.flatMap(exp => {
                const main = (
                  <tr key={exp.id} className={`ent-exp-row${exp.is_active ? ' ent-exp-row--active' : ''}`}>
                    <td>
                      <button className="ent-btn-icon" onClick={() => expandDetalle(exp.id)} type="button">
                        {expandId === exp.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    </td>
                    <td className="ent-td-bold">{exp.nombre}</td>
                    <td>{exp.lengua_nombre}</td>
                    <td><span className="ent-tipo-pill">{exp.modelo_nombre?.split('/')[1] ?? exp.modelo_nombre}</span></td>
                    <td>{exp.metricas?.eval_wer != null ? <WerBadge wer={exp.metricas.eval_wer} /> : '—'}</td>
                    <td>{exp.num_muestras_train + exp.num_muestras_eval}</td>
                    <td><EstadoBadge estado={exp.estado} isActive={exp.is_active} /></td>
                    <td>{new Date(exp.created_at).toLocaleDateString('es-CO')}</td>
                    <td>
                      {exp.estado === 'completado' && !exp.is_active && (
                        <button className="ent-btn ent-btn--sm ent-btn--primary" onClick={() => activar(exp.id)} type="button">
                          <Zap size={11} /> Activar
                        </button>
                      )}
                    </td>
                  </tr>
                )

                if (expandId !== exp.id) return [main]

                const detailRow = (
                  <tr key={`${exp.id}-d`} className="ent-exp-detail-row">
                    <td colSpan={9}>
                      {!detail ? (
                        <div className="ent-loading-sm"><Loader2 size={13} className="spin" /> Cargando detalle…</div>
                      ) : (
                        <div className="ent-exp-detail">
                          <div className="ent-detail-grid">
                            <div><p className="ent-detail-key">Datos usados</p><p className="ent-detail-val">{formatComunidades(exp.comunidades_usadas)}</p></div>
                            <div><p className="ent-detail-key">Train / Eval</p><p className="ent-detail-val">{detail.num_muestras_train} / {detail.num_muestras_eval}</p></div>
                            {detail.config_entrenamiento && Object.entries(detail.config_entrenamiento).map(([k, v]) => (
                              <div key={k}>
                                <p className="ent-detail-key">{k.replace(/_/g, ' ')}</p>
                                <p className="ent-detail-val">{String(v)}</p>
                              </div>
                            ))}
                          </div>
                          {Object.keys(detail.metricas ?? {}).length > 0 && (
                            <div className="ent-metrics-grid" style={{ marginTop: 12 }}>
                              {Object.entries(detail.metricas).map(([k, v]) => (
                                <div key={k} className="ent-metric-cell">
                                  <span className="ent-metric-key">{k.replace(/_/g, ' ')}</span>
                                  <span className="ent-metric-val">
                                    {k === 'eval_wer' || k === 'eval_cer'
                                      ? <WerBadge wer={v} />
                                      : typeof v === 'number' && v < 100 ? v.toFixed(4) : v}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {detail.mlflow_run_id && (
                            <p className="ent-mlflow" style={{ marginTop: 10 }}>
                              MLflow: <a href={`http://localhost:5000/#/experiments/${detail.mlflow_experiment_id ?? '1'}/runs/${detail.mlflow_run_id}`}
                                target="_blank" rel="noreferrer">{detail.mlflow_run_id}</a>
                            </p>
                          )}
                          {detail.error_mensaje && <p className="ent-err-sm" style={{ marginTop: 8 }}>{detail.error_mensaje}</p>}
                          {(exp.estado === 'entrenando' || exp.estado === 'pendiente') && (
                            <div style={{ marginTop: 12 }}><Monitor id={exp.id} onActivated={load} /></div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )

                return [main, detailRow]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// useAudioRecorder — hook compartido de grabación real con MediaRecorder
// ══════════════════════════════════════════════════════════════════════════════

function useAudioRecorder() {
  const [audioFile, setAudioFile]   = useState<File | null>(null)
  const [audioUrl, setAudioUrl]     = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const urlRef    = useRef<string | null>(null)

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const clearAudio = () => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    setAudioFile(null); setAudioUrl(null)
  }

  const setFromBlob = (blob: Blob, name: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    setAudioUrl(url)
    setAudioFile(new File([blob], name, { type: blob.type }))
  }

  const setFromFile = (f: File) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(f)
    urlRef.current = url
    setAudioUrl(url)
    setAudioFile(f)
  }

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRef.current?.stop()
      setIsRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const rec = new MediaRecorder(stream, { mimeType })
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext  = mimeType.includes('webm') ? 'webm' : 'ogg'
        setFromBlob(blob, `grabacion_${Date.now()}.${ext}`)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRef.current = rec
      rec.start()
      setIsRecording(true)
    } catch { /* micrófono denegado o no disponible */ }
  }

  return { audioFile, audioUrl, isRecording, clearAudio, setFromFile, toggleRecording }
}

// ── AudioRow — controles grabación/subida reutilizables ───────────────────────

function AudioRow({
  audioFile, audioUrl, isRecording,
  onToggleRecording, onFileChange, onClear,
}: {
  audioFile: File | null; audioUrl: string | null; isRecording: boolean
  onToggleRecording: () => void; onFileChange: (f: File) => void; onClear: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="ent-field">
      <label className="ent-label">Audio <span className="ent-req">*</span></label>
      <div className="ent-audio-row">
        <button
          className={`audio-record-btn${isRecording ? ' audio-record-btn--active' : ''}`}
          onClick={onToggleRecording} type="button"
        >
          {isRecording
            ? <><MicOff size={15} /> Detener <span className="rec-dot" /></>
            : <><Mic size={15} /> Grabar</>}
        </button>
        <span className="audio-or">o</span>
        <button className="audio-upload-btn" onClick={() => fileRef.current?.click()} type="button">
          <Upload size={13} /> Subir archivo
        </button>
        <input ref={fileRef} type="file" accept=".wav,.mp3,.ogg,.flac,.m4a,.mp4"
          className="visually-hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { onClear(); onFileChange(f) } }} />
      </div>

      {audioFile && audioUrl && (
        <div className="ent-audio-preview">
          <audio controls src={audioUrl} className="ent-audio-player" />
          <div className="ent-audio-preview-info">
            <Volume2 size={12} />
            <span className="truncate">{audioFile.name}</span>
            <button className="ent-btn-icon" onClick={onClear} type="button" aria-label="Quitar audio">
              <XCircle size={14} />
            </button>
          </div>
        </div>
      )}
      <p className="ent-hint">Formatos: .wav, .mp3, .ogg, .flac, .m4a, .mp4</p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TranscribirTab — HU-25 + HU-26
// ══════════════════════════════════════════════════════════════════════════════

interface TraduccionResultado { termino: string; termino_es: string; definicion: string; probabilidad: number; mejor_coincidencia: boolean }
interface TranscripcionResult {
  transcripcion?: string; modelo?: string; lengua?: string
  error?: string
  traduccion?: {
    conclusion?: { termino: string; termino_es: string; definicion: string; probabilidad: number }
    resultados?: TraduccionResultado[]
    advertencia?: string
  }
}

function TranscribirTab() {
  const [lenguasASR, setLenguasASR] = useState<LenguaASR[]>([])
  const [lenguaId, setLenguaId]     = useState<number | ''>('')
  const [pipeline, setPipeline]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<TranscripcionResult | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)

  const rec = useAudioRecorder()

  useEffect(() => {
    apiFetch('/terminos/lenguas/?page_size=50')
      .then(d => { const l: LenguaASR[] = d.results ?? d; setLenguasASR(l); if (l[0]) setLenguaId(l[0].id) })
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!lenguaId || !rec.audioFile) return
    setLoading(true); setResult(null)
    const fd = new FormData()
    fd.append('lengua_id', String(lenguaId))
    fd.append('audio', rec.audioFile)
    if (pipeline) fd.append('direccion', 'lengua_a_es')
    try {
      const ep = pipeline ? '/entrenamiento/transcribir-y-traducir/' : '/entrenamiento/transcribir/'
      const res = await fetch(`${API}${ep}`, { method: 'POST', body: fd })
      const data: TranscripcionResult = await res.json()
      if (res.ok) {
        setResult(data)
        const best = data.traduccion?.resultados?.findIndex(r => r.mejor_coincidencia) ?? 0
        setSelectedIdx(best >= 0 ? best : 0)
      } else {
        setResult({ error: (data as { error?: string }).error ?? `Error ${res.status}` })
      }
    } catch { setResult({ error: 'No se pudo conectar con el servidor.' }) }
    finally { setLoading(false) }
  }

  const sel     = result?.traduccion?.resultados?.[selectedIdx]
  const bestIdx = result?.traduccion?.resultados?.findIndex(r => r.mejor_coincidencia) ?? 0

  return (
    <div className="ent-section">
      <div className="ent-section-head">
        <div>
          <h2 className="ent-section-title">Transcripción de audio</h2>
          <p className="ent-section-sub">Usa el modelo ASR activo para convertir voz en texto</p>
        </div>
      </div>

      <div className="ent-form">
        <div className="ent-field">
          <label className="ent-label">Lengua <span className="ent-req">*</span></label>
          <select className="gl-input" value={lenguaId} onChange={e => setLenguaId(Number(e.target.value))}>
            <option value="">— Selecciona —</option>
            {lenguasASR.map(l => (
              <option key={l.id} value={l.id}>{l.nombre} ({l.codigo})</option>
            ))}
          </select>
        </div>

        <AudioRow
          audioFile={rec.audioFile} audioUrl={rec.audioUrl} isRecording={rec.isRecording}
          onToggleRecording={rec.toggleRecording}
          onFileChange={rec.setFromFile}
          onClear={rec.clearAudio}
        />

        <div className="ent-field">
          <label className="ent-check-label">
            <input type="checkbox" checked={pipeline} onChange={e => setPipeline(e.target.checked)} />
            <span>Pipeline completo: transcribir + traducir al español</span>
          </label>
        </div>

        {result?.error && <div className="tc-api-error"><AlertTriangle size={14} /><span>{result.error}</span></div>}

        <div className="ent-form-actions">
          <button className="ent-btn ent-btn--primary ent-btn--lg"
            disabled={!lenguaId || !rec.audioFile || loading} onClick={submit} type="button">
            {loading
              ? <><Loader2 size={15} className="spin" /> Procesando…</>
              : <><Mic size={15} /> {rec.audioFile ? 'Transcribir' : 'Graba o sube un audio'}</>}
          </button>
        </div>

        {result && !result.error && (
          <div className="ent-transc-result">
            <p className="ent-label" style={{ marginBottom: 6 }}>Transcripción</p>
            <div className="ent-transc-text">
              <Languages size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
              <span>{result.transcripcion}</span>
            </div>
            {result.modelo && <p className="tc-emb-info">Modelo: {result.modelo}</p>}

            {result.traduccion?.advertencia && (
              <div className="ent-warn"><AlertTriangle size={13} /> {result.traduccion.advertencia}</div>
            )}

            {result.traduccion?.conclusion && sel && (
              <div style={{ marginTop: 16 }}>
                <p className="ent-label" style={{ marginBottom: 6 }}>Traducción</p>
                <div className="tc-conclusion">
                  <div className="tc-conclusion-head">
                    <span className="tc-conclusion-badge">
                      <Star size={10} />
                      {selectedIdx === bestIdx ? 'Mejor coincidencia' : 'Opción seleccionada'}
                    </span>
                  </div>
                  <div className="tc-conclusion-body">
                    <div className="tc-conclusion-terms">
                      <span className="tc-conclusion-term">{sel.termino}</span>
                      <span className="tc-conclusion-sep">·</span>
                      <span className="tc-conclusion-es">{sel.termino_es}</span>
                    </div>
                    <p className="tc-conclusion-def">{sel.definicion}</p>
                  </div>
                  <div className="tc-conclusion-foot">
                    <span className="tc-conclusion-prob-num">{sel.probabilidad.toFixed(1)}%</span>
                    <span className="tc-conclusion-prob-label">de probabilidad</span>
                    <div className="tc-conclusion-bar">
                      <div className="tc-conclusion-fill" style={{ width: `${sel.probabilidad}%` }} />
                    </div>
                  </div>
                </div>
                {(result.traduccion.resultados?.length ?? 0) > 1 && (
                  <>
                    <p className="tc-opts-label">Elige una opción:</p>
                    <div className="tc-results-list" role="radiogroup">
                      {result.traduccion!.resultados!.map((r, i) => (
                        <button key={i} type="button" role="radio" aria-checked={selectedIdx === i}
                          className={['tc-result-card', selectedIdx === i ? 'tc-result-card--selected' : '', r.mejor_coincidencia ? 'tc-result-card--best' : ''].join(' ').trim()}
                          onClick={() => setSelectedIdx(i)}>
                          <span className="tc-result-rank">#{i + 1}</span>
                          <div className="tc-result-body">
                            <span className="tc-result-term">{r.termino}{r.mejor_coincidencia && <span className="tc-result-best-tag">★</span>}</span>
                            <span className="tc-result-es">{r.termino_es}</span>
                            <span className="tc-result-def">{r.definicion}</span>
                          </div>
                          <div className={`tc-score-wrap ${r.probabilidad >= 50 ? 'tc-score--high' : r.probabilidad >= 25 ? 'tc-score--mid' : 'tc-score--low'}`}>
                            <span className="tc-score-pct">{r.probabilidad.toFixed(1)}%</span>
                            <div className="tc-score-bar"><div className="tc-score-fill" style={{ width: `${r.probabilidad}%` }} /></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SubirTab — HU-21: Subir audio + transcripción al dataset
// ══════════════════════════════════════════════════════════════════════════════

function SubirTab() {
  const [comunidades, setComunidades] = useState<string[]>([])
  const [comunidad, setComunidad]     = useState('')
  const [jornada, setJornada]         = useState('')
  const [transcripcion, setTranscripcion] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<SubirResult | null>(null)

  const rec = useAudioRecorder()

  useEffect(() => {
    apiFetch('/entrenamiento/dataset/')
      .then(d => setComunidades((d.comunidades ?? []).map((c: ComunidadStat) => c.comunidad)))
      .catch(() => {})
  }, [])

  const canSubmit = Boolean(comunidad.trim() && jornada.trim() && rec.audioFile && transcripcion.trim())

  const submit = async () => {
    if (!canSubmit) return
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('comunidad',    comunidad.trim())
    fd.append('jornada',      jornada.trim())
    fd.append('audio',        rec.audioFile!)
    fd.append('transcripcion', transcripcion.trim())
    try {
      const res  = await fetch(`${API}/entrenamiento/dataset/subir/`, { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        rec.clearAudio()
        setTranscripcion('')
      } else {
        setError(data.error ?? data.detail ?? `Error ${res.status}`)
      }
    } catch { setError('No se pudo conectar con el servidor.') }
    finally { setLoading(false) }
  }

  const subirOtro = () => { setResult(null); setError('') }

  const stats = result?.jornada_stats

  return (
    <div className="ent-section">
      <div className="ent-section-head">
        <div>
          <h2 className="ent-section-title">Subir audio al dataset</h2>
          <p className="ent-section-sub">Graba o sube un audio junto con su transcripción para aumentar los datos de entrenamiento</p>
        </div>
      </div>

      {result ? (
        <div className="ent-upload-result">
          <div className="ent-upload-result-head">
            <CheckCircle2 size={22} color="#16a34a" />
            <div>
              <p className="ent-upload-result-title">Audio guardado exitosamente</p>
              <p className="ent-hint" style={{ marginTop: 2 }}>{result.ruta_relativa}</p>
            </div>
          </div>

          <div className="ent-upload-result-grid">
            <div>
              <p className="ent-detail-key">Comunidad</p>
              <p className="ent-detail-val">{result.comunidad}</p>
            </div>
            <div>
              <p className="ent-detail-key">Jornada</p>
              <p className="ent-detail-val">{result.jornada}</p>
            </div>
            <div>
              <p className="ent-detail-key">Archivo</p>
              <p className="ent-detail-val">{result.archivo_audio}</p>
            </div>
            <div>
              <p className="ent-detail-key">Duración</p>
              <p className="ent-detail-val">{result.duracion_segundos?.toFixed(1)} s</p>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <p className="ent-detail-key">Transcripción guardada</p>
              <p className="ent-detail-val" style={{ fontStyle: 'italic' }}>"{result.transcripcion_guardada}"</p>
            </div>
          </div>

          {stats && (
            <div style={{ marginTop: 12 }}>
              <p className="ent-label-sm">Estado de la jornada <strong>{result.jornada}</strong></p>
              <div className="ent-prog-wrap" style={{ marginTop: 6 }}>
                <div className="ent-prog-bar">
                  <div
                    className={`ent-prog-fill ${stats.porcentaje >= 70 ? 'ent-prog--high' : stats.porcentaje >= 40 ? 'ent-prog--mid' : 'ent-prog--low'}`}
                    style={{ width: `${stats.porcentaje}%` }}
                  />
                </div>
                <span className="ent-prog-pct">{stats.porcentaje.toFixed(0)}%</span>
              </div>
              <p className="ent-hint">{stats.etiquetados} / {stats.total_audios} etiquetados · {stats.sin_etiquetar} sin etiquetar</p>
            </div>
          )}

          <button className="ent-btn ent-btn--primary" onClick={subirOtro} type="button" style={{ marginTop: 16 }}>
            <FolderPlus size={14} /> Subir otro audio a <strong style={{ marginLeft: 3 }}>{result.jornada}</strong>
          </button>
        </div>
      ) : (
        <div className="ent-form">
          <div className="ent-form-row">
            <div className="ent-field">
              <label className="ent-label">Comunidad <span className="ent-req">*</span></label>
              <input className="gl-input" list="sub-comunidades-list"
                placeholder="arhuaco, kogui…"
                value={comunidad} onChange={e => setComunidad(e.target.value)} />
              <datalist id="sub-comunidades-list">
                {comunidades.map(c => <option key={c} value={c} />)}
              </datalist>
              <p className="ent-hint">Elige una existente o escribe una nueva</p>
            </div>
            <div className="ent-field">
              <label className="ent-label">Jornada <span className="ent-req">*</span></label>
              <input className="gl-input"
                placeholder="grabacion_junio_2026"
                value={jornada} onChange={e => setJornada(e.target.value)} />
              <p className="ent-hint">Se crea automáticamente si no existe</p>
            </div>
          </div>

          <AudioRow
            audioFile={rec.audioFile} audioUrl={rec.audioUrl} isRecording={rec.isRecording}
            onToggleRecording={rec.toggleRecording}
            onFileChange={rec.setFromFile}
            onClear={rec.clearAudio}
          />

          <div className="ent-field">
            <label className="ent-label">Transcripción <span className="ent-req">*</span></label>
            <textarea className="gl-input" rows={3}
              placeholder="Escribe aquí la transcripción en la lengua indígena…"
              value={transcripcion}
              onChange={e => setTranscripcion(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {error && <div className="tc-api-error"><AlertTriangle size={14} /><span>{error}</span></div>}

          <div className="ent-form-actions">
            <button className="ent-btn ent-btn--primary ent-btn--lg"
              disabled={!canSubmit || loading} onClick={submit} type="button">
              {loading
                ? <><Loader2 size={15} className="spin" /> Subiendo…</>
                : <><Upload size={15} /> Guardar en dataset</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════════════════════

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'datos',        label: 'Datos',        Icon: Database   },
  { id: 'modelos',      label: 'Modelos',      Icon: Cpu        },
  { id: 'entrenar',     label: 'Entrenar',     Icon: Play       },
  { id: 'experimentos', label: 'Experimentos', Icon: BarChart2  },
  { id: 'transcribir',  label: 'Transcribir',  Icon: Mic        },
  { id: 'subir',        label: 'Subir datos',  Icon: FolderPlus },
]

export default function Entrenamiento() {
  const [auth, setAuth]             = useState(() => sessionStorage.getItem(SESS_KEY) === '1')
  const [tab, setTab]               = useState<Tab>('datos')
  const [selSesiones, setSelSesiones] = useState<SesionKey[]>([])
  const [monitorId, setMonitorId]   = useState<string | null>(null)

  if (!auth) return (
    <div className="translator-page">
      <div className="translator-page-inner">
        <PasswordGate onAuth={() => setAuth(true)} />
      </div>
    </div>
  )

  return (
    <div className="gl-page">
      <div className="ent-hero">
        <Activity size={24} aria-hidden="true" />
        <div>
          <h1 className="ent-hero-title">Entrenamiento ASR</h1>
          <p className="ent-hero-sub">Fine-tuning de modelos de voz para lenguas indígenas colombianas</p>
        </div>
      </div>

      <div className="gl-tabs-bar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button"
            className={`gl-tab${tab === id ? ' gl-tab-active' : ''}`}
            onClick={() => setTab(id)}>
            <Icon size={13} />
            {label}
            {id === 'experimentos' && monitorId && <span className="ent-tab-dot" />}
          </button>
        ))}
      </div>

      <div className="ent-tab-content">
        {tab === 'datos' && <DatosTab onSelectSesiones={setSelSesiones} />}
        {tab === 'modelos' && <ModelosTab />}
        {tab === 'entrenar' && (
          <EntrenarTab
            preselectedSesiones={selSesiones}
            onStarted={id => { setMonitorId(id); setTab('experimentos') }}
          />
        )}
        {tab === 'experimentos' && (
          <ExperimentosTab monitorId={monitorId} onClearMonitor={() => setMonitorId(null)} />
        )}
        {tab === 'transcribir' && <TranscribirTab />}
        {tab === 'subir'       && <SubirTab />}
      </div>
    </div>
  )
}
