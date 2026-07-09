import { useState, useRef, useId, useEffect } from 'react'
import {
  Mic, MicOff, Upload, Languages,
  Loader2, Volume2, Copy, Check, AlertCircle,
  ArrowRightLeft, Star, XCircle, ChevronDown, Sparkles, Type,
  Keyboard, X,
} from 'lucide-react'
import {
  useSpecialKeyboard, SpecialKeyboardPanel, SpecialKeyboardToggle,
} from '../components/SpecialKeyboard'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { API_BASE } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────

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

export default function Traductor() {
  const [lenguas, setLenguas]           = useState<Lengua[]>([])
  const [loadingLenguas, setLoadingL]   = useState(true)
  const [lenguaId, setLenguaId]         = useState<number | null>(null)
  const [direccion, setDireccion]       = useState<Direccion>('es_a_lengua')
  const [inputMode, setInputMode]       = useState<InputMode>('text')
  const [inputText, setInputText]       = useState('')
  const [langMenuOpen, setLangMenuOpen] = useState(false)

  const rec         = useAudioRecorder()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [result, setResult]             = useState<TraduccionResponse | null>(null)
  const [transcripcion, setTranscripcion] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx]   = useState<number>(0)
  const [apiError, setApiError]         = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [copied, setCopied]             = useState(false)

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const textareaId   = useId()
  const resultId     = useId()
  const kb = useSpecialKeyboard(textareaRef, inputText, setInputText)

  useEffect(() => {
    fetch(`${API_BASE}/terminos/lenguas/?page_size=50`, {
      headers: { Accept: 'application/json' },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        const raw = d.results ?? d
        const list: Lengua[] = Array.isArray(raw) ? raw : []
        setLenguas(list)
        if (list.length > 0) setLenguaId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingL(false))
  }, [])

  const resetResults = () => { setResult(null); setTranscripcion(null); setApiError('') }

  const handleSetInputMode = (mode: InputMode) => {
    setInputMode(mode)
    if (mode === 'audio') setDireccion('lengua_a_es')
    resetResults()
  }

  const swapDireccion = () => {
    if (inputMode === 'audio') return
    // Como los buenos traductores: el texto traducido pasa a la caja de entrada
    if (selected) {
      const translated = sourceIsEs ? selected.termino : selected.termino_es
      setInputText(translated)
    }
    setDireccion(d => (d === 'es_a_lengua' ? 'lengua_a_es' : 'es_a_lengua'))
    resetResults()
  }

  const selectedLengua = lenguas.find(l => l.id === lenguaId)

  const canTranslate = lenguaId !== null && (
    inputMode === 'text' ? inputText.trim().length > 0 : rec.audioFile !== null
  )

  const handleTranslate = async () => {
    if (!canTranslate || !lenguaId) return
    setIsLoading(true); setResult(null); setTranscripcion(null); setApiError('')

    try {
      if (inputMode === 'text') {
        const res = await fetch(`${API_BASE}/traduccion/traducir/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ texto: inputText.trim(), lengua_id: lenguaId, direccion }),
        })
        const data = await res.json()
        if (!res.ok) {
          setApiError(data.error || data.direccion?.[0] || data.texto?.[0] || data.lengua_id?.[0] || `Error ${res.status}`)
        } else {
          const resultados: ResultadoItem[] = Array.isArray(data.resultados) ? data.resultados : []
          setResult({ ...data, resultados })
          const best = resultados.findIndex(r => r.mejor_coincidencia)
          setSelectedIdx(best >= 0 ? best : 0)
        }
      } else {
        const fd = new FormData()
        fd.append('lengua_id', String(lenguaId))
        fd.append('audio', rec.audioFile!)
        fd.append('direccion', 'lengua_a_es')
        const res = await fetch(`${API_BASE}/entrenamiento/transcribir-y-traducir/`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: fd,
        })
        const data: TranscripcionResponse = await res.json()
        if (!res.ok || data.error) {
          setApiError(data.error ?? `Error ${res.status}`)
        } else {
          setTranscripcion(data.transcripcion ?? null)
          if (data.traduccion?.resultados && data.traduccion.conclusion) {
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

  const langName    = selectedLengua?.nombre ?? 'Lengua indígena'
  const sourceIsEs  = direccion === 'es_a_lengua'
  const sourceLabel = sourceIsEs ? 'Español' : langName
  const targetLabel = sourceIsEs ? langName : 'Español'
  const inputPlaceholder = sourceIsEs ? 'Escribe en español…' : `Escribe en ${langName}…`
  const bestIdx = result ? result.resultados.findIndex(r => r.mejor_coincidencia) : -1

  // Texto traducido según la dirección (lo que se muestra grande y lo que viaja al invertir)
  const targetPrimary   = selected ? (sourceIsEs ? selected.termino : selected.termino_es) : ''
  const targetSecondary = selected ? (sourceIsEs ? selected.termino_es : selected.termino) : ''

  // ── Chip renderer for the language bar ──────────────────────────────────────
  const LangChip = ({ side }: { side: 'source' | 'target' }) => {
    const isEs = side === 'source' ? sourceIsEs : !sourceIsEs
    if (isEs) {
      return (
        <div className="trx-chip trx-chip--static">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
          </svg>
          <span>Español</span>
        </div>
      )
    }
    // Lengua chip = dropdown
    return (
      <div className="trx-chip-wrap">
        <button
          type="button"
          className="trx-chip trx-chip--select"
          aria-haspopup="listbox"
          aria-expanded={langMenuOpen}
          disabled={loadingLenguas || lenguas.length === 0}
          onClick={() => setLangMenuOpen(o => !o)}
        >
          <span className="trx-chip-dot" aria-hidden="true" />
          <span className="truncate">
            {loadingLenguas ? 'Cargando…' : lenguas.length === 0 ? 'Sin lenguas' : langName}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {langMenuOpen && (
          <>
            <div className="trx-menu-backdrop" onClick={() => setLangMenuOpen(false)} />
            <ul className="trx-menu" role="listbox" aria-label="Selecciona una lengua indígena">
              {lenguas.map(l => (
                <li key={l.id} role="option" aria-selected={l.id === lenguaId}>
                  <button
                    type="button"
                    className={`trx-menu-item ${l.id === lenguaId ? 'trx-menu-item--active' : ''}`}
                    onClick={() => { setLenguaId(l.id); setLangMenuOpen(false); resetResults() }}
                  >
                    <span className="trx-menu-avatar" aria-hidden="true">{l.nombre.slice(0, 2)}</span>
                    <span className="trx-menu-body">
                      <span className="trx-menu-name">{l.nombre}</span>
                      {!l.embedding_activo && <span className="trx-menu-note">Sin embedding activo</span>}
                    </span>
                    {l.id === lenguaId && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  return (
    <section className="translator-page" aria-labelledby="translator-heading">
      <div className="translator-page-inner">

        <header className="translator-page-header">
          <h1 id="translator-heading" className="tp-title">Traductor SAYTA</h1>
          <p className="tp-subtitle">Escribe o habla · traducción semántica para lenguas indígenas colombianas</p>
        </header>

        <div className="trx-card" role="region" aria-label="Panel de traducción">

          {/* ── Barra de idioma ─────────────────────────────── */}
          <div className="trx-langbar">
            <LangChip side="source" />
            <button
              type="button"
              className="trx-swap"
              onClick={swapDireccion}
              disabled={inputMode === 'audio'}
              aria-label="Invertir dirección de traducción"
              title={inputMode === 'audio' ? 'El audio siempre traduce a español' : 'Invertir'}
            >
              <ArrowRightLeft size={18} aria-hidden="true" />
            </button>
            <LangChip side="target" />
          </div>

          {/* ── Selector de entrada ─────────────────────────── */}
          <div className="trx-modebar" role="group" aria-label="Tipo de entrada">
            <button
              type="button"
              className={`trx-mode ${inputMode === 'text' ? 'trx-mode--active' : ''}`}
              aria-pressed={inputMode === 'text'}
              onClick={() => handleSetInputMode('text')}
            >
              <Type size={15} aria-hidden="true" /> Texto
            </button>
            <button
              type="button"
              className={`trx-mode ${inputMode === 'audio' ? 'trx-mode--active' : ''}`}
              aria-pressed={inputMode === 'audio'}
              onClick={() => handleSetInputMode('audio')}
            >
              <Mic size={15} aria-hidden="true" /> Audio
            </button>
          </div>

          {/* ── Paneles origen → destino ────────────────────── */}
          <div className="trx-panels">

            {/* Origen */}
            <div className="trx-panel">
              <div className="trx-panel-head">
                <span className="trx-panel-label">{sourceLabel}</span>
                <Volume2 size={18} className="trx-panel-mute" aria-hidden="true" />
              </div>

              {inputMode === 'text' ? (
                <>
                  <label htmlFor={textareaId} className="visually-hidden">Texto en {sourceLabel}</label>
                  <textarea
                    ref={textareaRef}
                    id={textareaId}
                    className="trx-textarea"
                    placeholder={inputPlaceholder}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    aria-required="true"
                    aria-describedby={result ? resultId : undefined}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleTranslate() }}
                  />
                  <div className="trx-panel-foot">
                    <SpecialKeyboardToggle
                      open={kb.open}
                      onToggle={() => kb.open ? kb.setOpen(false) : kb.openKeyboard()}
                    />
                    <span className="trx-count">{inputText.length} / 5000</span>
                  </div>
                </>
              ) : (
                <div className="trx-audio">
                  {rec.isRecording ? (
                    <div className="trx-live" aria-live="polite">
                      <div className="trx-live-orb">
                        <span className="trx-live-ring" /><span className="trx-live-ring trx-live-ring--2" />
                        <div className="trx-live-core"><Mic size={30} aria-hidden="true" /></div>
                      </div>
                      <div className="trx-wave" aria-hidden="true">
                        {[16, 30, 44, 26, 50, 34, 22, 46, 38, 28, 42, 20].map((h, i) => (
                          <span key={i} style={{ height: h, animationDelay: `${(i % 6) * 0.08}s` }} />
                        ))}
                      </div>
                      <span className="trx-live-label">Escuchando…</span>
                    </div>
                  ) : rec.audioFile && rec.audioUrl ? (
                    <div className="trx-audio-preview">
                      <audio controls src={rec.audioUrl} className="trx-audio-player" />
                      <div className="trx-audio-meta">
                        <Volume2 size={13} aria-hidden="true" />
                        <span className="truncate">{rec.audioFile.name}</span>
                        <button className="trx-icon-btn" onClick={rec.clearAudio} type="button" aria-label="Quitar audio">
                          <XCircle size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="trx-audio-hint">Graba tu voz en {langName} o sube un archivo — se transcribe y traduce al español.</p>
                  )}

                  <div className="trx-audio-actions">
                    <button
                      type="button"
                      className={`trx-rec-btn ${rec.isRecording ? 'trx-rec-btn--active' : ''}`}
                      aria-pressed={rec.isRecording}
                      onClick={rec.toggleRecording}
                    >
                      {rec.isRecording
                        ? <><MicOff size={18} aria-hidden="true" /> Detener</>
                        : <><Mic size={18} aria-hidden="true" /> Grabar</>}
                    </button>
                    <button type="button" className="trx-upload-btn"
                      onClick={() => fileInputRef.current?.click()} aria-label="Subir archivo de audio">
                      <Upload size={16} aria-hidden="true" /> Subir
                    </button>
                    <input ref={fileInputRef} type="file" accept=".wav,.mp3,.ogg,.flac,.m4a,.mp4"
                      aria-label="Seleccionar archivo de audio" className="visually-hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) { rec.clearAudio(); rec.setFromFile(f) }
                        e.target.value = ''
                      }} />
                  </div>
                </div>
              )}
            </div>

            {/* Destino */}
            <div className="trx-panel trx-panel--target">
              <div className="trx-panel-head">
                <span className="trx-panel-label trx-panel-label--target">{targetLabel}</span>
                {result && !isLoading && (
                  <span className="trx-ai-badge"><Sparkles size={12} aria-hidden="true" /> Traducido por IA</span>
                )}
              </div>

              <div className="trx-target-body" id={resultId} aria-live="polite">
                {isLoading ? (
                  <div className="trx-target-loading">
                    <Loader2 size={22} className="spin" aria-hidden="true" />
                    <span>{inputMode === 'audio' ? 'Transcribiendo audio…' : 'Buscando términos similares…'}</span>
                  </div>
                ) : selected ? (
                  <>
                    <p className="trx-target-term">{targetPrimary}</p>
                    {targetSecondary && <p className="trx-target-es">{targetSecondary}</p>}
                    {selected.definicion && <p className="trx-target-def">{selected.definicion}</p>}
                  </>
                ) : (
                  <p className="trx-target-placeholder">La traducción aparecerá aquí.</p>
                )}
              </div>

              {selected && !isLoading && (
                <div className="trx-panel-foot trx-panel-foot--target">
                  <span className={`trx-badge-flag ${selectedIdx === bestIdx ? 'is-best' : ''}`}>
                    <Star size={12} aria-hidden="true" />
                    {selectedIdx === bestIdx ? 'Mejor coincidencia' : 'Opción elegida'}
                  </span>
                  <div className="trx-foot-right">
                    <ProbBadge prob={selected.probabilidad} />
                    <button type="button" className="trx-icon-btn trx-icon-btn--bordered" onClick={handleCopy}
                      aria-label={copied ? 'Copiado' : 'Copiar traducción'}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Teclado de caracteres especiales (full width) ── */}
          {inputMode === 'text' && kb.open && (
            <div className="trx-kb" role="group" aria-label="Teclado de caracteres especiales">
              <div className="trx-kb-head">
                <span className="trx-kb-title">
                  <span className="trx-kb-badge" aria-hidden="true"><Keyboard size={15} /></span>
                  Caracteres de lenguas indígenas
                  <span className="trx-kb-hint">toca para insertar en el cursor</span>
                </span>
                <button type="button" className="trx-kb-close" onClick={() => kb.setOpen(false)} aria-label="Cerrar teclado">
                  <X size={16} aria-hidden="true" />
                </button>
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
          )}

          {/* ── Botón traducir ──────────────────────────────── */}
          <button
            type="button"
            className="trx-translate-btn"
            onClick={handleTranslate}
            disabled={isLoading || !canTranslate || rec.isRecording}
            aria-busy={isLoading}
            title={inputMode === 'text' ? 'También puedes pulsar Ctrl+Enter' : undefined}
          >
            {isLoading
              ? <><Loader2 size={19} className="spin" aria-hidden="true" /> {inputMode === 'audio' ? 'Transcribiendo…' : 'Traduciendo…'}</>
              : inputMode === 'audio'
                ? <><Mic size={19} aria-hidden="true" /> {rec.audioFile ? 'Transcribir y traducir' : 'Graba o sube un audio'}</>
                : <><Languages size={19} aria-hidden="true" /> Traducir</>}
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────── */}
        {apiError && (
          <div className="tc-api-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{apiError}</span>
          </div>
        )}

        {/* ── Transcripción (audio) ───────────────────────── */}
        {transcripcion && !isLoading && (
          <div className="trx-transcripcion" role="status">
            <span className="trx-transcripcion-label"><Mic size={13} aria-hidden="true" /> Transcripción</span>
            <span className="trx-transcripcion-text">{transcripcion}</span>
          </div>
        )}

        {/* ── Otras coincidencias ─────────────────────────── */}
        {result && !isLoading && result.resultados.length > 1 && (
          <div className="trx-alts" role="status" aria-label="Otras coincidencias">
            <p className="tc-opts-label">Otras coincidencias — elige una opción</p>
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
          </div>
        )}

        {result && result.embedding.modelo && !isLoading && (
          <p className="tc-emb-info">
            {result.embedding.version
              ? `Embedding ${result.embedding.version} · ${result.embedding.num_terminos.toLocaleString()} términos · `
              : 'Modelo ASR: '}
            {result.embedding.modelo}
          </p>
        )}

      </div>
    </section>
  )
}
