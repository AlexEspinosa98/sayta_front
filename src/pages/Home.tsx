import { useState, useRef, useId, useEffect } from 'react'
import {
  Mic, MicOff, Upload, Languages,
  Loader2, Volume2, Copy, Check, AlertCircle,
  ArrowRight, ArrowLeft, ArrowRightLeft, Star, XCircle,
} from 'lucide-react'
import {
  useSpecialKeyboard, SpecialKeyboardPanel, SpecialKeyboardToggle,
} from '../components/SpecialKeyboard'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { API_BASE, getToken } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

interface Lengua {
  id: number; codigo: string; nombre: string; activa: boolean
  embedding_activo: object | null
}

interface ResultadoItem {
  termino: string
  termino_es: string
  definicion: string
  score: number
  probabilidad: number
  mejor_coincidencia: boolean
  coincidencia: string
}

interface TraduccionResponse {
  texto_entrada: string
  lengua: { id: number; codigo: string; nombre: string }
  embedding: { version_id: string; version: string; modelo: string; num_terminos: number }
  direccion: string
  conclusion: {
    termino: string
    termino_es: string
    definicion: string
    probabilidad: number
  }
  resultados: ResultadoItem[]
}

interface TranscripcionResultado { termino: string; termino_es: string; definicion: string; probabilidad: number; mejor_coincidencia: boolean }
interface TranscripcionResponse {
  transcripcion?: string
  modelo?: string
  lengua?: string
  error?: string
  traduccion?: {
    conclusion?: { termino: string; termino_es: string; definicion: string; probabilidad: number }
    resultados?: TranscripcionResultado[]
    advertencia?: string
  }
}

type Direccion = 'es_a_lengua' | 'lengua_a_es'
type InputMode = 'text' | 'audio'

// ── Probability badge ─────────────────────────────────────────────────────────

function ProbBadge({ prob }: { prob: number }) {
  const cls = prob >= 50 ? 'tc-score--high' : prob >= 25 ? 'tc-score--mid' : 'tc-score--low'
  return (
    <div className={`tc-score-wrap ${cls}`}>
      <span className="tc-score-pct">{prob.toFixed(1)}%</span>
      <div className="tc-score-bar"><div className="tc-score-fill" style={{ width: `${prob}%` }} /></div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  // Lenguas
  const [lenguas, setLenguas]           = useState<Lengua[]>([])
  const [loadingLenguas, setLoadingL]   = useState(true)

  // Form
  const [lenguaId, setLenguaId]         = useState<number | null>(null)
  const [direccion, setDireccion]       = useState<Direccion>('es_a_lengua')
  const [inputMode, setInputMode]       = useState<InputMode>('text')
  const [inputText, setInputText]       = useState('')

  // Audio
  const rec         = useAudioRecorder()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Result
  const [result, setResult]             = useState<TraduccionResponse | null>(null)
  const [transcripcion, setTranscripcion] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx]   = useState<number>(0)
  const [apiError, setApiError]         = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [copied, setCopied]             = useState(false)

  // Refs / ids
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const textareaId   = useId()
  const resultId     = useId()
  const kb = useSpecialKeyboard(textareaRef, inputText, setInputText)

  useEffect(() => {
    fetch(`${API}/terminos/lenguas/?page_size=50`)
      .then(r => r.json())
      .then(d => {
        const list: Lengua[] = d.results ?? d
        setLenguas(list)
        if (list.length > 0) setLenguaId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingL(false))
  }, [])

  // Cuando se cambia a modo audio, fijar dirección a lengua→ES (transcripción)
  const handleSetInputMode = (mode: InputMode) => {
    setInputMode(mode)
    if (mode === 'audio') setDireccion('lengua_a_es')
    setResult(null); setTranscripcion(null); setApiError('')
  }

  const selectedLengua = lenguas.find(l => l.id === lenguaId)

  const canTranslate = lenguaId !== null && (
    inputMode === 'text' ? inputText.trim().length > 0 : rec.audioFile !== null
  )

  // ── Translate / Transcribir ─────────────────────────────────────────────────
  const handleTranslate = async () => {
    if (!canTranslate || !lenguaId) return
    setIsLoading(true); setResult(null); setTranscripcion(null); setApiError('')

    try {
      if (inputMode === 'text') {
        // Texto → POST /api/traduccion/traducir/
        const res = await fetch(`${API}/traduccion/traducir/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ texto: inputText.trim(), lengua_id: lenguaId, direccion }),
        })
        const data = await res.json()
        if (!res.ok) {
          setApiError(data.error || data.direccion?.[0] || data.texto?.[0] || data.lengua_id?.[0] || `Error ${res.status}`)
        } else {
          setResult(data)
          const best = (data.resultados as ResultadoItem[]).findIndex(r => r.mejor_coincidencia)
          setSelectedIdx(best >= 0 ? best : 0)
        }
      } else {
        // Audio → POST /api/entrenamiento/transcribir-y-traducir/
        const fd = new FormData()
        fd.append('lengua_id', String(lenguaId))
        fd.append('audio', rec.audioFile!)
        fd.append('direccion', 'lengua_a_es')
        const token = getToken()
        const res = await fetch(`${API_BASE}/entrenamiento/transcribir-y-traducir/`, {
          method: 'POST',
          headers: { Accept: 'application/json', ...(token ? { Authorization: `Token ${token}` } : {}) },
          body: fd,
        })
        const data: TranscripcionResponse = await res.json()
        if (!res.ok || data.error) {
          setApiError(data.error ?? `Error ${res.status}`)
        } else {
          setTranscripcion(data.transcripcion ?? null)
          if (data.traduccion?.resultados && data.traduccion.conclusion) {
            // Normalizar al formato de TraduccionResponse para reutilizar el mismo UI
            setResult({
              texto_entrada: data.transcripcion ?? '',
              lengua: selectedLengua as Lengua as TraduccionResponse['lengua'],
              embedding: { version_id: '', version: data.modelo ?? '', modelo: data.modelo ?? '', num_terminos: 0 },
              direccion: 'lengua_a_es',
              conclusion: data.traduccion.conclusion,
              resultados: data.traduccion.resultados.map(r => ({
                ...r, score: r.probabilidad, coincidencia: '',
              })),
            })
            const best = data.traduccion.resultados.findIndex(r => r.mejor_coincidencia)
            setSelectedIdx(best >= 0 ? best : 0)
          } else if (data.traduccion?.advertencia) {
            setApiError(data.traduccion.advertencia)
          }
        }
      }
    } catch {
      setApiError('No se pudo conectar con el servidor.')
    } finally { setIsLoading(false) }
  }

  const selected = result?.resultados[selectedIdx] ?? null

  const handleCopy = async () => {
    if (!selected) return
    const text = `${selected.termino} (${selected.termino_es}) — ${selected.definicion} · ${selected.probabilidad.toFixed(1)}%`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Labels ──────────────────────────────────────────────────────────────────
  const langName = selectedLengua?.nombre ?? 'lengua indígena'
  const inputLabel = direccion === 'es_a_lengua' ? 'Texto en español' : `Texto en ${langName}`
  const inputPlaceholder = direccion === 'es_a_lengua' ? 'Escribe en español…' : `Escribe en ${langName}…`
  const dirLabel = direccion === 'es_a_lengua' ? `Español → ${langName}` : `${langName} → Español`

  const bestIdx = result ? result.resultados.findIndex(r => r.mejor_coincidencia) : -1

  return (
    <section className="translator-page" aria-labelledby="translator-heading">
      <div className="translator-page-inner">

        <header className="translator-page-header">
          <h1 id="translator-heading" className="tp-title">
            <span aria-hidden="true"><Languages size={28} /></span>
            Traductor SAYTA
          </h1>
          <p className="tp-subtitle">Búsqueda semántica por embeddings · lenguas indígenas colombianas</p>
        </header>

        <div className="tc" role="region" aria-label="Panel de traducción">

          {/* ── Fila superior ──────────────────────────────── */}
          <div className="tc-top">

            {/* Lengua */}
            <fieldset className="tc-fieldset tc-fieldset--grow">
              <legend className="tc-legend">Lengua indígena</legend>
              <div className="lang-selector" role="group">
                {loadingLenguas ? (
                  <span className="lang-pill lang-pill-loading">
                    <Loader2 size={13} className="spin" /> Cargando…
                  </span>
                ) : lenguas.length === 0 ? (
                  <span className="lang-pill lang-pill-empty">Sin lenguas disponibles</span>
                ) : (
                  lenguas.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      className={`lang-pill ${lenguaId === l.id ? 'lang-pill-active' : ''}`}
                      aria-pressed={lenguaId === l.id}
                      onClick={() => { setLenguaId(l.id); setResult(null); setTranscripcion(null); setApiError('') }}
                      title={l.embedding_activo ? 'Embedding activo' : 'Sin embedding activo'}
                    >
                      {l.nombre}
                      {!l.embedding_activo && <span className="lang-pill-warn" aria-label="Sin embedding" />}
                    </button>
                  ))
                )}
              </div>
            </fieldset>

            {/* Dirección — deshabilitada en modo audio */}
            <fieldset className="tc-fieldset" aria-disabled={inputMode === 'audio'}>
              <legend className="tc-legend">Dirección</legend>
              <div className="mode-pills" role="group">
                <button
                  type="button"
                  className={`mode-pill ${direccion === 'es_a_lengua' ? 'mode-pill-active' : ''}`}
                  aria-pressed={direccion === 'es_a_lengua'}
                  disabled={inputMode === 'audio'}
                  onClick={() => { setDireccion('es_a_lengua'); setResult(null) }}
                >
                  <ArrowRight size={13} aria-hidden="true" />
                  ES → Lengua
                </button>
                <button
                  type="button"
                  className={`mode-pill ${direccion === 'lengua_a_es' ? 'mode-pill-active' : ''}`}
                  aria-pressed={direccion === 'lengua_a_es'}
                  disabled={inputMode === 'audio'}
                  onClick={() => { setDireccion('lengua_a_es'); setResult(null) }}
                >
                  <ArrowLeft size={13} aria-hidden="true" />
                  Lengua → ES
                </button>
              </div>
            </fieldset>

            {/* Modo */}
            <fieldset className="tc-fieldset">
              <legend className="tc-legend">Entrada</legend>
              <div className="mode-pills" role="group">
                <button
                  type="button"
                  className={`mode-pill ${inputMode === 'text' ? 'mode-pill-active' : ''}`}
                  aria-pressed={inputMode === 'text'}
                  onClick={() => handleSetInputMode('text')}
                >
                  <Languages size={13} aria-hidden="true" />
                  Texto
                </button>
                <button
                  type="button"
                  className={`mode-pill ${inputMode === 'audio' ? 'mode-pill-active' : ''}`}
                  aria-pressed={inputMode === 'audio'}
                  onClick={() => handleSetInputMode('audio')}
                >
                  <Mic size={13} aria-hidden="true" />
                  Audio
                </button>
              </div>
            </fieldset>

          </div>

          {/* ── Dirección visual ───────────────────────────── */}
          <div className="tc-dir-banner" aria-live="polite">
            <ArrowRightLeft size={13} aria-hidden="true" />
            <span>{dirLabel}</span>
          </div>

          {/* ── Área de entrada ────────────────────────────── */}
          {inputMode === 'text' ? (
            <div className="tc-input-wrap">
              <label htmlFor={textareaId} className="tc-label">{inputLabel}</label>
              <textarea
                ref={textareaRef}
                id={textareaId}
                className="tc-textarea"
                placeholder={inputPlaceholder}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                rows={4}
                aria-required="true"
                aria-describedby={result ? resultId : undefined}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleTranslate() }}
              />
              <span className="tc-char-count" aria-live="polite" aria-atomic="true">
                {inputText.length} {inputText.length === 1 ? 'carácter' : 'caracteres'}
              </span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
                <SpecialKeyboardToggle
                  open={kb.open}
                  onToggle={() => kb.open ? kb.setOpen(false) : kb.openKeyboard()}
                />
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
          ) : (
            <div className="tc-audio" role="group" aria-label="Entrada de audio">
              <button
                type="button"
                className={`audio-record-btn ${rec.isRecording ? 'audio-record-btn--active' : ''}`}
                aria-pressed={rec.isRecording}
                aria-label={rec.isRecording ? 'Detener grabación' : 'Iniciar grabación de voz'}
                onClick={rec.toggleRecording}
              >
                {rec.isRecording
                  ? <><MicOff size={20} aria-hidden="true" /> Detener <span className="rec-dot" aria-hidden="true" /></>
                  : <><Mic size={20} aria-hidden="true" /> Grabar</>}
              </button>
              <span className="audio-or" aria-hidden="true">o</span>
              <button type="button" className="audio-upload-btn"
                onClick={() => fileInputRef.current?.click()} aria-label="Subir archivo de audio">
                <Upload size={16} aria-hidden="true" /> Subir archivo
              </button>
              <input ref={fileInputRef} type="file" accept=".wav,.mp3,.ogg,.flac,.m4a,.mp4"
                aria-label="Seleccionar archivo de audio" className="visually-hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { rec.clearAudio(); rec.setFromFile(f) }
                  e.target.value = ''
                }} />
              {rec.audioFile && rec.audioUrl && (
                <div className="tc-audio-preview">
                  <audio controls src={rec.audioUrl} className="ent-audio-player" />
                  <div className="ent-audio-preview-info">
                    <Volume2 size={12} />
                    <span className="truncate">{rec.audioFile.name}</span>
                    <button className="ent-btn-icon" onClick={rec.clearAudio} type="button" aria-label="Quitar audio">
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              )}
              <p className="tc-audio-hint">Graba voz en lengua indígena — se transcribe y traduce al español</p>
            </div>
          )}

          {/* ── Botón principal ────────────────────────────── */}
          <button
            type="button"
            className="translate-btn"
            onClick={handleTranslate}
            disabled={isLoading || !canTranslate || rec.isRecording}
            aria-busy={isLoading}
            title={inputMode === 'text' ? 'También puedes pulsar Ctrl+Enter' : undefined}
          >
            {isLoading
              ? <><Loader2 size={18} className="spin" aria-hidden="true" /> {inputMode === 'audio' ? 'Transcribiendo…' : 'Buscando…'}</>
              : inputMode === 'audio'
                ? <><Mic size={18} aria-hidden="true" /> {rec.audioFile ? 'Transcribir y traducir' : 'Graba o sube un audio'}</>
                : <><Languages size={18} aria-hidden="true" /> Traducir</>}
          </button>

          {/* ── Error ──────────────────────────────────────── */}
          {apiError && (
            <div className="tc-api-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{apiError}</span>
            </div>
          )}

          {/* ── Loading ────────────────────────────────────── */}
          {isLoading && (
            <div className="tc-result tc-result--loading">
              <Loader2 size={20} className="spin" aria-hidden="true" />
              <span>{inputMode === 'audio' ? 'Transcribiendo audio…' : 'Buscando términos similares…'}</span>
            </div>
          )}

          {/* ── Transcripción (solo modo audio) ────────────── */}
          {transcripcion && !isLoading && (
            <div className="tc-transcripcion" role="status">
              <span className="tc-transcripcion-label"><Mic size={13} /> Transcripción</span>
              <span className="tc-transcripcion-text">{transcripcion}</span>
            </div>
          )}

          {/* ── Resultado ──────────────────────────────────── */}
          {result && !isLoading && selected && (
            <div id={resultId} role="status" aria-live="polite" aria-label="Resultados de traducción">

              {/* ── Conclusión ─────────────────────────────── */}
              <div className="tc-conclusion">
                <div className="tc-conclusion-head">
                  <span className="tc-conclusion-badge">
                    <Star size={11} aria-hidden="true" />
                    {selectedIdx === bestIdx ? 'Mejor coincidencia' : 'Opción seleccionada'}
                  </span>
                  <button type="button" className="copy-btn" onClick={handleCopy}
                    aria-label={copied ? 'Copiado' : 'Copiar traducción'}>
                    {copied
                      ? <><Check size={13} aria-hidden="true" /> Copiado</>
                      : <><Copy size={13} aria-hidden="true" /> Copiar</>}
                  </button>
                </div>
                <div className="tc-conclusion-body">
                  <div className="tc-conclusion-terms">
                    <span className="tc-conclusion-term">{selected.termino}</span>
                    <span className="tc-conclusion-sep" aria-hidden="true">·</span>
                    <span className="tc-conclusion-es">{selected.termino_es}</span>
                  </div>
                  <p className="tc-conclusion-def">{selected.definicion}</p>
                </div>
                <div className="tc-conclusion-foot">
                  <span className="tc-conclusion-prob-num">{selected.probabilidad.toFixed(1)}%</span>
                  <span className="tc-conclusion-prob-label">de probabilidad</span>
                  <div className="tc-conclusion-bar">
                    <div className="tc-conclusion-fill" style={{ width: `${selected.probabilidad}%` }} />
                  </div>
                </div>
              </div>

              {/* ── Opciones ───────────────────────────────── */}
              <p className="tc-opts-label">Elige una opción:</p>
              <div className="tc-results-list" role="radiogroup" aria-label="Opciones de traducción">
                {result.resultados.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={selectedIdx === i}
                    className={[
                      'tc-result-card',
                      selectedIdx === i ? 'tc-result-card--selected' : '',
                      r.mejor_coincidencia ? 'tc-result-card--best' : '',
                    ].join(' ').trim()}
                    onClick={() => setSelectedIdx(i)}
                  >
                    <span className="tc-result-rank" aria-label={`Opción ${i + 1}`}>#{i + 1}</span>
                    <div className="tc-result-body">
                      <span className="tc-result-term">
                        {r.termino}
                        {r.mejor_coincidencia && (
                          <span className="tc-result-best-tag" aria-label="Mejor coincidencia">★</span>
                        )}
                      </span>
                      <span className="tc-result-es">{r.termino_es}</span>
                      <span className="tc-result-def">{r.definicion}</span>
                    </div>
                    <ProbBadge prob={r.probabilidad} />
                  </button>
                ))}
              </div>

              {/* ── Info embedding ─────────────────────────── */}
              {result.embedding.modelo && (
                <p className="tc-emb-info">
                  {result.embedding.version
                    ? `Embedding ${result.embedding.version} · ${result.embedding.num_terminos.toLocaleString()} términos · `
                    : 'Modelo ASR: '}
                  {result.embedding.modelo}
                </p>
              )}

            </div>
          )}

        </div>
      </div>
    </section>
  )
}
