import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Lock, Database, Cpu, Play, Mic, MicOff, Upload, Volume2,
  Loader2, CheckCircle2, AlertTriangle, XCircle,
  ChevronDown, ChevronRight, Download, HardDrive,
  Star, RefreshCw, BarChart2, Languages, Activity, Zap,
  type LucideIcon,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const API        = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
const ADMIN_PW   = 'Un1m4gd4l3n4'
const SESS_KEY   = 'entrenamiento_auth'

// ── Types ─────────────────────────────────────────────────────────────────────

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
interface ModeloHF {
  nombre_hf: string; tipo: string; descripcion: string
  tamaño_aprox: string; parametros: string
  recomendado: boolean; gpu_requerida: boolean; descargado: boolean; id_bd: number | null
}
interface ModeloLocal {
  id: number; nombre_hf: string; tipo: string; tipo_display: string
  descripcion: string; ruta_local: string; descargado: boolean; created_at: string
}
interface Lengua { id: number; codigo: string; nombre: string; activa: boolean }

interface Experimento {
  id: string; nombre: string; lengua_codigo: string; lengua_nombre: string
  modelo_nombre: string; comunidades_usadas: string[]
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

type Expand = ComunidadDetalle | 'loading' | null
type Tab = 'datos' | 'modelos' | 'entrenar' | 'experimentos' | 'transcribir'

// ── API helper ────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const isFormData = opts?.body instanceof FormData
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: isFormData ? { Accept: 'application/json', ...(opts?.headers ?? {}) }
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
// DatosTab — HU-15 + HU-16
// ══════════════════════════════════════════════════════════════════════════════

function DatosTab({ onSelect }: { onSelect: (c: string[]) => void }) {
  const [dataset, setDataset] = useState<{
    base_path: string; existe: boolean; total_comunidades: number; comunidades: ComunidadStat[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, Expand>>({})
  const [selected, setSelected] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try { setDataset(await apiFetch('/entrenamiento/dataset/')) }
    catch { setDataset(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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

  const toggleSelect = (com: string, apto: boolean) => {
    if (!apto) return
    const next = selected.includes(com) ? selected.filter(c => c !== com) : [...selected, com]
    setSelected(next); onSelect(next)
  }

  if (loading) return <div className="ent-loading"><Loader2 size={18} className="spin" /> Cargando dataset…</div>
  if (!dataset) return <div className="ent-empty"><AlertTriangle size={18} /> No se pudo cargar el dataset.</div>
  if (!dataset.existe) return <div className="ent-empty"><AlertTriangle size={18} /> El directorio de grabaciones no existe en el servidor.</div>

  return (
    <div className="ent-section">
      <div className="ent-section-head">
        <div>
          <h2 className="ent-section-title">Datos disponibles</h2>
          <p className="ent-section-sub">{dataset.total_comunidades} comunidad{dataset.total_comunidades !== 1 ? 'es' : ''} · <code>{dataset.base_path}</code></p>
        </div>
        <button className="ent-btn ent-btn--ghost" onClick={load} type="button"><RefreshCw size={13} /> Actualizar</button>
      </div>

      <div className="ent-comunidades">
        {dataset.comunidades.map(c => (
          <div key={c.comunidad} className={`ent-com-card${selected.includes(c.comunidad) ? ' ent-com-card--selected' : ''}`}>
            <div className="ent-com-head">
              <label className="ent-com-check-label">
                <input
                  type="checkbox" className="ent-checkbox"
                  checked={selected.includes(c.comunidad)}
                  disabled={!c.apto_para_entrenamiento}
                  onChange={() => toggleSelect(c.comunidad, c.apto_para_entrenamiento)}
                />
                <span className="ent-com-name">{c.comunidad}</span>
              </label>
              <div className="ent-badges-row">
                {c.apto_para_entrenamiento
                  ? <span className="ent-badge ent-badge--ok"><CheckCircle2 size={10} /> Apto</span>
                  : <span className="ent-badge ent-badge--warn"><AlertTriangle size={10} /> Insuficiente</span>}
              </div>
              <button className="ent-btn-icon" onClick={() => toggleExpand(c.comunidad)} type="button"
                aria-label={expanded[c.comunidad] !== undefined ? 'Colapsar' : 'Expandir jornadas'}>
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
                <div
                  className={`ent-prog-fill ${c.porcentaje_completado >= 70 ? 'ent-prog--high' : c.porcentaje_completado >= 40 ? 'ent-prog--mid' : 'ent-prog--low'}`}
                  style={{ width: `${c.porcentaje_completado}%` }}
                />
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
                          <td>{j.total_audios}</td>
                          <td>{j.etiquetados}</td>
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

      {selected.length > 0 && (
        <div className="ent-selection-bar">
          <span><strong>{selected.join(', ')}</strong> seleccionada{selected.length !== 1 ? 's' : ''}</span>
          <span>
            Total etiquetados: <strong>
              {dataset.comunidades.filter(c => selected.includes(c.comunidad)).reduce((s, c) => s + c.etiquetados, 0)}
            </strong>
          </span>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ModelosTab — HU-17 + HU-18 + HU-19
// ══════════════════════════════════════════════════════════════════════════════

function ModelosTab() {
  const [catalogo, setCatalogo] = useState<ModeloHF[]>([])
  const [descargados, setDescargados] = useState<ModeloLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [dlState, setDlState] = useState<Record<string, 'loading' | 'err'>>({})
  const [dlErr, setDlErr] = useState<Record<string, string>>({})

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
    setDlState(p => ({ ...p, [m.nombre_hf]: 'loading' }))
    setDlErr(p => { const n = { ...p }; delete n[m.nombre_hf]; return n })
    try {
      await apiFetch('/entrenamiento/modelos/descargar/', {
        method: 'POST',
        body: JSON.stringify({ nombre_hf: m.nombre_hf, tipo: m.tipo, descripcion: m.descripcion }),
      })
      await loadAll()
    } catch (e) {
      setDlState(p => ({ ...p, [m.nombre_hf]: 'err' }))
      setDlErr(p => ({ ...p, [m.nombre_hf]: apiErr(e, 'Error al descargar.') }))
    } finally {
      setDlState(p => { const n = { ...p }; delete n[m.nombre_hf]; return n })
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
              disabled={m.descargado || dlState[m.nombre_hf] === 'loading'}
              onClick={() => descargar(m)} type="button"
            >
              {dlState[m.nombre_hf] === 'loading'
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
          <h3 className="ent-subsection-title">Modelos en servidor local ({descargados.length})</h3>
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
// EntrenarTab — HU-20
// ══════════════════════════════════════════════════════════════════════════════

function EntrenarTab({
  preselectedComunidades,
  onStarted,
}: { preselectedComunidades: string[]; onStarted: (id: string) => void }) {
  const [lenguas, setLenguas]     = useState<Lengua[]>([])
  const [modelos, setModelos]     = useState<ModeloLocal[]>([])
  const [dataset, setDataset]     = useState<ComunidadStat[]>([])
  const [loading, setLoading]     = useState(true)

  const [nombre, setNombre]       = useState('')
  const [lenguaId, setLenguaId]   = useState<number | ''>('')
  const [modeloId, setModeloId]   = useState<number | ''>('')
  const [comunidades, setComunidades] = useState<string[]>([])
  const [showAdv, setShowAdv]     = useState(false)
  const [cfg, setCfg] = useState({
    num_train_epochs: 20, per_device_train_batch_size: 4,
    gradient_accumulation_steps: 2, learning_rate: 1e-5,
    warmup_steps: 100, use_peft: false, whisper_language: 'es',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]   = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/terminos/lenguas/?page_size=50`).then(r => r.json()),
      apiFetch('/entrenamiento/modelos/'),
      apiFetch('/entrenamiento/dataset/'),
    ]).then(([lang, mod, dat]) => {
      setLenguas(lang.results ?? lang)
      setModelos(mod.modelos ?? [])
      setDataset(dat.comunidades ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (preselectedComunidades.length > 0) setComunidades(preselectedComunidades)
  }, [preselectedComunidades])

  const totalEtiq = dataset.filter(c => comunidades.includes(c.comunidad)).reduce((s, c) => s + c.etiquetados, 0)
  const canSubmit = nombre.trim() && lenguaId && modeloId && comunidades.length > 0 && totalEtiq >= 5

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setSubmitErr('')
    try {
      const data = await apiFetch('/entrenamiento/entrenar/', {
        method: 'POST',
        body: JSON.stringify({ nombre: nombre.trim(), lengua_id: lenguaId, modelo_audio_id: modeloId, comunidades, config: cfg }),
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
        <div className="ent-field">
          <label className="ent-label">Nombre del experimento <span className="ent-req">*</span></label>
          <input className="gl-input" placeholder="ej. whisper-small-iku-v1"
            value={nombre} onChange={e => setNombre(e.target.value)} />
        </div>

        <div className="ent-form-row">
          <div className="ent-field">
            <label className="ent-label">Lengua <span className="ent-req">*</span></label>
            <select className="gl-input" value={lenguaId} onChange={e => setLenguaId(Number(e.target.value) as number | '')}>
              <option value="">— Selecciona —</option>
              {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre} ({l.codigo})</option>)}
            </select>
          </div>
          <div className="ent-field">
            <label className="ent-label">Modelo base <span className="ent-req">*</span></label>
            <select className="gl-input" value={modeloId} onChange={e => setModeloId(Number(e.target.value) as number | '')}>
              <option value="">— Selecciona —</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nombre_hf}</option>)}
            </select>
            {modelos.length === 0 && <p className="ent-hint">Sin modelos descargados. Ve a <strong>Modelos</strong> para descargar uno.</p>}
          </div>
        </div>

        <div className="ent-field">
          <label className="ent-label">Comunidades <span className="ent-req">*</span></label>
          <div className="ent-checkboxes">
            {dataset.map(c => (
              <label key={c.comunidad} className={`ent-check-label${!c.apto_para_entrenamiento ? ' ent-check-label--disabled' : ''}`}>
                <input type="checkbox" className="ent-checkbox"
                  checked={comunidades.includes(c.comunidad)}
                  disabled={!c.apto_para_entrenamiento}
                  onChange={() => setComunidades(p =>
                    p.includes(c.comunidad) ? p.filter(x => x !== c.comunidad) : [...p, c.comunidad]
                  )}
                />
                <span>{c.comunidad}</span>
                <span className="ent-check-meta">{c.etiquetados} muestras</span>
                {!c.apto_para_entrenamiento && <span className="ent-badge ent-badge--warn" style={{ fontSize: '.66rem' }}>Insuficiente</span>}
              </label>
            ))}
          </div>
          {comunidades.length > 0 && (
            <p className="ent-hint">
              Total estimado: <strong>{totalEtiq} muestras etiquetadas</strong>
              {totalEtiq < 5 && <span className="ent-hint-err"> · mínimo 5</span>}
            </p>
          )}
        </div>

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
                  <span>Usar LoRA (PEFT) — ahorra memoria</span>
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
// Monitor widget — HU-21
// ══════════════════════════════════════════════════════════════════════════════

function Monitor({ id, onActivated }: { id: string; onActivated: () => void }) {
  const [estado, setEstado] = useState<ExperimentoDetalle | null>(null)
  const [activErr, setActivErr] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const d: ExperimentoDetalle = await apiFetch(`/entrenamiento/experimentos/${id}/estado/`)
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

  if (!estado) return <div className="ent-loading-sm"><Loader2 size={14} className="spin" /> Conectando con el experimento…</div>

  const isRunning = estado.estado === 'entrenando' || estado.estado === 'pendiente'
  const isDone    = estado.estado === 'completado'
  const isFailed  = estado.estado === 'fallido'

  return (
    <div className="ent-monitor">
      <div className="ent-monitor-head">
        <div>
          <span className="ent-monitor-name">{estado.nombre}</span>
          <span className="ent-sep">·</span>
          <span className="ent-monitor-sub">{estado.lengua_codigo} · {estado.modelo_nombre?.split('/')[1] ?? estado.modelo_nombre}</span>
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
                    {k === 'eval_wer' ? <WerBadge wer={v} />
                      : k === 'eval_cer' ? <WerBadge wer={v} />
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
              <tr>
                <th />
                <th>Nombre</th><th>Lengua</th><th>Modelo</th>
                <th>WER</th><th>Muestras</th><th>Estado</th><th>Fecha</th>
                <th />
              </tr>
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
                            <div><p className="ent-detail-key">Comunidades</p><p className="ent-detail-val">{(exp.comunidades_usadas ?? []).join(', ') || '—'}</p></div>
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
                                    {k === 'eval_wer' || k === 'eval_cer' ? <WerBadge wer={v} />
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
                          {detail.error_mensaje && (
                            <p className="ent-err-sm" style={{ marginTop: 8 }}>{detail.error_mensaje}</p>
                          )}
                          {(exp.estado === 'entrenando' || exp.estado === 'pendiente') && (
                            <div style={{ marginTop: 12 }}>
                              <Monitor id={exp.id} onActivated={load} />
                            </div>
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
  const [lenguas, setLenguas]       = useState<Lengua[]>([])
  const [lenguaId, setLenguaId]     = useState<number | ''>('')
  const [audioFile, setAudioFile]   = useState<File | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [pipeline, setPipeline]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<TranscripcionResult | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API}/terminos/lenguas/?page_size=50`).then(r => r.json())
      .then(d => { const l: Lengua[] = d.results ?? d; setLenguas(l); if (l[0]) setLenguaId(l[0].id) })
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!lenguaId || !audioFile) return
    setLoading(true); setResult(null)
    const fd = new FormData()
    fd.append('lengua_id', String(lenguaId))
    fd.append('audio', audioFile)
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

  const sel = result?.traduccion?.resultados?.[selectedIdx]
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
            {lenguas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>

        <div className="ent-field">
          <label className="ent-label">Audio <span className="ent-req">*</span></label>
          <div className="ent-audio-row">
            <button
              className={`audio-record-btn${isRecording ? ' audio-record-btn--active' : ''}`}
              onClick={() => setIsRecording(r => !r)} type="button"
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
              onChange={e => { setAudioFile(e.target.files?.[0] ?? null); setIsRecording(false) }} />
            {audioFile && (
              <span className="audio-file-tag">
                <Volume2 size={11} /><span className="truncate">{audioFile.name}</span>
              </span>
            )}
          </div>
          <p className="ent-hint">Formatos: .wav, .mp3, .ogg, .flac, .m4a, .mp4</p>
        </div>

        <div className="ent-field">
          <label className="ent-check-label">
            <input type="checkbox" checked={pipeline} onChange={e => setPipeline(e.target.checked)} />
            <span>Pipeline completo: transcribir + traducir al español</span>
          </label>
        </div>

        {result?.error && <div className="tc-api-error"><AlertTriangle size={14} /><span>{result.error}</span></div>}

        <div className="ent-form-actions">
          <button className="ent-btn ent-btn--primary ent-btn--lg"
            disabled={!lenguaId || !audioFile || loading} onClick={submit} type="button">
            {loading
              ? <><Loader2 size={15} className="spin" /> Procesando…</>
              : <><Mic size={15} /> Transcribir</>}
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
                        <button
                          key={i} type="button" role="radio" aria-checked={selectedIdx === i}
                          className={[
                            'tc-result-card',
                            selectedIdx === i ? 'tc-result-card--selected' : '',
                            r.mejor_coincidencia ? 'tc-result-card--best' : '',
                          ].join(' ').trim()}
                          onClick={() => setSelectedIdx(i)}
                        >
                          <span className="tc-result-rank">#{i + 1}</span>
                          <div className="tc-result-body">
                            <span className="tc-result-term">
                              {r.termino}
                              {r.mejor_coincidencia && <span className="tc-result-best-tag">★</span>}
                            </span>
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
// Page
// ══════════════════════════════════════════════════════════════════════════════

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'datos',        label: 'Datos',         Icon: Database   },
  { id: 'modelos',      label: 'Modelos',        Icon: Cpu        },
  { id: 'entrenar',     label: 'Entrenar',       Icon: Play       },
  { id: 'experimentos', label: 'Experimentos',   Icon: BarChart2  },
  { id: 'transcribir',  label: 'Transcribir',    Icon: Mic        },
]

export default function Entrenamiento() {
  const [auth, setAuth]           = useState(() => sessionStorage.getItem(SESS_KEY) === '1')
  const [tab, setTab]             = useState<Tab>('datos')
  const [selComunidades, setSelC] = useState<string[]>([])
  const [monitorId, setMonitorId] = useState<string | null>(null)

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
          <button
            key={id} type="button"
            className={`gl-tab${tab === id ? ' gl-tab-active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={13} />
            {label}
            {id === 'experimentos' && monitorId && <span className="ent-tab-dot" aria-label="Entrenamiento activo" />}
          </button>
        ))}
      </div>

      <div className="ent-tab-content">
        {tab === 'datos' && <DatosTab onSelect={setSelC} />}
        {tab === 'modelos' && <ModelosTab />}
        {tab === 'entrenar' && (
          <EntrenarTab
            preselectedComunidades={selComunidades}
            onStarted={id => { setMonitorId(id); setTab('experimentos') }}
          />
        )}
        {tab === 'experimentos' && (
          <ExperimentosTab monitorId={monitorId} onClearMonitor={() => setMonitorId(null)} />
        )}
        {tab === 'transcribir' && <TranscribirTab />}
      </div>
    </div>
  )
}
