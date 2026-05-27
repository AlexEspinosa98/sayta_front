import { useState, useRef, useId, useEffect } from 'react'
import {
  Mic, MicOff, Upload, Languages,
  Loader2, Volume2, Copy, Check, AlertCircle,
  ArrowRight, ArrowLeft, ArrowRightLeft,
} from 'lucide-react'
import {
  useSpecialKeyboard, SpecialKeyboardPanel, SpecialKeyboardToggle,
} from '../components/SpecialKeyboard'

// ── Types ─────────────────────────────────────────────────────────────────────

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

interface Lengua {
  id: number; codigo: string; nombre: string; activa: boolean
  embedding_activo: object | null
}

interface ResultadoItem { termino: string; definicion: string; score: number }

interface TraduccionResponse {
  texto_entrada: string
  lengua: { id: number; codigo: string; nombre: string }
  embedding: { version_id: string; version: string; modelo: string; num_terminos: number }
  direccion: string
  resultados: ResultadoItem[]
}

type Direccion = 'es_a_lengua' | 'lengua_a_es'
type InputMode = 'text' | 'audio'

// ── Score helpers ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const cls = score >= 0.85 ? 'tc-score--high' : score >= 0.7 ? 'tc-score--mid' : 'tc-score--low'
  return (
    <div className={`tc-score-wrap ${cls}`}>
      <span className="tc-score-pct">{pct}%</span>
      <div className="tc-score-bar"><div className="tc-score-fill" style={{ width: `${pct}%` }} /></div>
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
  const [audioFile, setAudioFile]       = useState<File | null>(null)
  const [isRecording, setIsRecording]   = useState(false)

  // Result
  const [result, setResult]             = useState<TraduccionResponse | null>(null)
  const [apiError, setApiError]         = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [copied, setCopied]             = useState(false)

  // Refs / ids
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const textareaId   = useId()
  const resultId     = useId()
  const kb = useSpecialKeyboard(textareaRef, inputText, setInputText)

  // Load languages on mount
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

  const selectedLengua = lenguas.find(l => l.id === lenguaId)

  const canTranslate = lenguaId !== null && (
    inputMode === 'text' ? inputText.trim().length > 0 : audioFile !== null || isRecording
  )

  // ── Translate ───────────────────────────────────────────────────────────────
  const handleTranslate = async () => {
    if (!canTranslate || !lenguaId) return
    setIsLoading(true); setResult(null); setApiError('')
    try {
      const res = await fetch(`${API}/traduccion/traducir/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ texto: inputText.trim(), lengua_id: lenguaId, direccion }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApiError(
          data.error
          || data.direccion?.[0]
          || data.texto?.[0]
          || data.lengua_id?.[0]
          || `Error ${res.status}`
        )
      } else {
        setResult(data)
      }
    } catch {
      setApiError('No se pudo conectar con el servidor.')
    } finally { setIsLoading(false) }
  }

  const handleCopy = async () => {
    if (!result) return
    const text = result.resultados
      .map((r, i) => `${i + 1}. ${r.termino} — ${r.definicion} (${Math.round(r.score * 100)}%)`)
      .join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Input label / placeholder ───────────────────────────────────────────────
  const langName = selectedLengua?.nombre ?? 'lengua indígena'
  const inputLabel = direccion === 'es_a_lengua'
    ? 'Texto en español'
    : `Texto en ${langName}`
  const inputPlaceholder = direccion === 'es_a_lengua'
    ? 'Escribe en español…'
    : `Escribe en ${langName}…`
  const dirLabel = direccion === 'es_a_lengua'
    ? `Español → ${langName}`
    : `${langName} → Español`

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
                      onClick={() => { setLenguaId(l.id); setResult(null); setApiError('') }}
                      title={l.embedding_activo ? 'Embedding activo' : 'Sin embedding activo'}
                    >
                      {l.nombre}
                      {!l.embedding_activo && <span className="lang-pill-warn" aria-label="Sin embedding">·</span>}
                    </button>
                  ))
                )}
              </div>
            </fieldset>

            {/* Dirección */}
            <fieldset className="tc-fieldset">
              <legend className="tc-legend">Dirección</legend>
              <div className="mode-pills" role="group">
                <button
                  type="button"
                  className={`mode-pill ${direccion === 'es_a_lengua' ? 'mode-pill-active' : ''}`}
                  aria-pressed={direccion === 'es_a_lengua'}
                  onClick={() => { setDireccion('es_a_lengua'); setResult(null) }}
                >
                  <ArrowRight size={13} aria-hidden="true" />
                  ES → Lengua
                </button>
                <button
                  type="button"
                  className={`mode-pill ${direccion === 'lengua_a_es' ? 'mode-pill-active' : ''}`}
                  aria-pressed={direccion === 'lengua_a_es'}
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
                  onClick={() => setInputMode('text')}
                >
                  <Languages size={13} aria-hidden="true" />
                  Texto
                </button>
                <button
                  type="button"
                  className={`mode-pill ${inputMode === 'audio' ? 'mode-pill-active' : ''}`}
                  aria-pressed={inputMode === 'audio'}
                  onClick={() => setInputMode('audio')}
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
                className={`audio-record-btn ${isRecording ? 'audio-record-btn--active' : ''}`}
                aria-pressed={isRecording}
                aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación de voz'}
                onClick={() => { setIsRecording(r => !r); if (isRecording) setAudioFile(null) }}
              >
                {isRecording
                  ? <><MicOff size={20} aria-hidden="true" /> Detener <span className="rec-dot" aria-hidden="true" /></>
                  : <><Mic size={20} aria-hidden="true" /> Grabar</>}
              </button>
              <span className="audio-or" aria-hidden="true">o</span>
              <button type="button" className="audio-upload-btn"
                onClick={() => fileInputRef.current?.click()} aria-label="Subir archivo de audio">
                <Upload size={16} aria-hidden="true" /> Subir archivo
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*"
                aria-label="Seleccionar archivo de audio" className="visually-hidden"
                onChange={e => { setAudioFile(e.target.files?.[0] ?? null); setIsRecording(false) }} />
              {audioFile && (
                <span className="audio-file-tag" role="status">
                  <Volume2 size={12} aria-hidden="true" />
                  <span className="truncate">{audioFile.name}</span>
                </span>
              )}
            </div>
          )}

          {/* ── Botón traducir ─────────────────────────────── */}
          <button
            type="button"
            className="translate-btn"
            onClick={handleTranslate}
            disabled={isLoading || !canTranslate}
            aria-busy={isLoading}
            title="También puedes pulsar Ctrl+Enter"
          >
            {isLoading
              ? <><Loader2 size={18} className="spin" aria-hidden="true" /> Buscando…</>
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
              <span>Buscando términos similares…</span>
            </div>
          )}

          {/* ── Resultado ──────────────────────────────────── */}
          {result && !isLoading && (
            <div id={resultId} role="status" aria-live="polite" aria-label="Resultados">
              {/* Header */}
              <div className="tc-results-header">
                <div className="tc-results-dir">
                  <ArrowRightLeft size={13} aria-hidden="true" />
                  <strong>{result.direccion}</strong>
                  <span className="tc-results-sep">·</span>
                  <span className="tc-results-query">"{result.texto_entrada}"</span>
                </div>
                <button type="button" className="copy-btn" onClick={handleCopy}
                  aria-label={copied ? 'Copiado' : 'Copiar resultados'}>
                  {copied
                    ? <><Check size={13} aria-hidden="true" /> Copiado</>
                    : <><Copy size={13} aria-hidden="true" /> Copiar</>}
                </button>
              </div>

              {/* Result cards */}
              <div className="tc-results-list" aria-label="Términos más cercanos">
                {result.resultados.map((r, i) => (
                  <div key={i} className="tc-result-card">
                    <span className="tc-result-rank" aria-label={`Posición ${i + 1}`}>#{i + 1}</span>
                    <div className="tc-result-body">
                      <span className="tc-result-term">{r.termino}</span>
                      <span className="tc-result-def">{r.definicion}</span>
                    </div>
                    <ScoreBadge score={r.score} />
                  </div>
                ))}
              </div>

              {/* Embedding info */}
              <p className="tc-emb-info">
                Embedding {result.embedding.version} · {result.embedding.num_terminos.toLocaleString()} términos · {result.embedding.modelo}
              </p>
            </div>
          )}

        </div>
      </div>
    </section>
  )
}
