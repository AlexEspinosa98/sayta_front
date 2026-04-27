import { useState, useRef, useId } from 'react'
import {
  Mic, MicOff, Upload, Languages,
  ArrowRightLeft, Loader2, Volume2, Copy, Check,
} from 'lucide-react'

type Language = 'arhuaco' | 'kogui'
type InputMode = 'text' | 'audio'

const LANG_LABELS: Record<Language, string> = { arhuaco: 'Arhuaco', kogui: 'Kogui' }

export default function Home() {
  const [language, setLanguage]     = useState<Language>('arhuaco')
  const [inputMode, setInputMode]   = useState<InputMode>('text')
  const [inputText, setInputText]   = useState('')
  const [audioFile, setAudioFile]   = useState<File | null>(null)
  const [result, setResult]         = useState('')
  const [isLoading, setIsLoading]   = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [copied, setCopied]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaId   = useId()
  const resultId     = useId()

  const canTranslate =
    inputMode === 'text' ? inputText.trim().length > 0 : audioFile !== null || isRecording

  const handleTranslate = async () => {
    if (!canTranslate) return
    setIsLoading(true)
    setResult('')
    // TODO: conectar con el backend
    await new Promise((r) => setTimeout(r, 1400))
    setResult(
      inputMode === 'text'
        ? `Traducción de ${LANG_LABELS[language]} → Español:\n\n"${inputText}"`
        : `Traducción de audio (${LANG_LABELS[language]}) → Español:\n\n[resultado del modelo de audio]`,
    )
    setIsLoading(false)
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRecordToggle = () => {
    setIsRecording((r) => !r)
    if (isRecording) setAudioFile(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAudioFile(e.target.files?.[0] ?? null)
    setIsRecording(false)
  }

  return (
    <section className="translator-page" aria-labelledby="translator-heading">
      <div className="translator-page-inner">

        <header className="translator-page-header">
          <h1 id="translator-heading" className="tp-title">
            <span aria-hidden="true"><Languages size={28} /></span>
            Traductor SAYTA
          </h1>
          <p className="tp-subtitle">Arhuaco · Kogui → Español</p>
        </header>

        <div className="tc" role="region" aria-label="Panel de traducción">

          {/* ── Fila superior: lengua + modo ───────────────── */}
          <div className="tc-top">

            {/* Selector de lengua */}
            <fieldset className="tc-fieldset">
              <legend className="tc-legend">Lengua de origen</legend>
              <div className="lang-selector" role="group">
                {(['arhuaco', 'kogui'] as Language[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`lang-pill ${language === l ? 'lang-pill-active' : ''}`}
                    aria-pressed={language === l}
                    onClick={() => setLanguage(l)}
                  >
                    {LANG_LABELS[l]}
                  </button>
                ))}
                <span className="lang-arrow" aria-hidden="true">
                  <ArrowRightLeft size={14} />
                  Español
                </span>
              </div>
            </fieldset>

            {/* Modo de entrada */}
            <fieldset className="tc-fieldset">
              <legend className="tc-legend">Modo de entrada</legend>
              <div className="mode-pills" role="group">
                <button
                  type="button"
                  className={`mode-pill ${inputMode === 'text' ? 'mode-pill-active' : ''}`}
                  aria-pressed={inputMode === 'text'}
                  onClick={() => setInputMode('text')}
                >
                  <Languages size={14} aria-hidden="true" />
                  Texto
                </button>
                <button
                  type="button"
                  className={`mode-pill ${inputMode === 'audio' ? 'mode-pill-active' : ''}`}
                  aria-pressed={inputMode === 'audio'}
                  onClick={() => setInputMode('audio')}
                >
                  <Mic size={14} aria-hidden="true" />
                  Audio
                </button>
              </div>
            </fieldset>

          </div>

          {/* ── Área de entrada ────────────────────────────── */}
          {inputMode === 'text' ? (
            <div className="tc-input-wrap">
              <label htmlFor={textareaId} className="tc-label">
                Texto en {LANG_LABELS[language]}
              </label>
              <textarea
                id={textareaId}
                className="tc-textarea"
                placeholder={`Escribe en ${LANG_LABELS[language]}…`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={5}
                aria-required="true"
                aria-describedby={result ? resultId : undefined}
              />
              <span className="tc-char-count" aria-live="polite" aria-atomic="true">
                {inputText.length} {inputText.length === 1 ? 'carácter' : 'caracteres'}
              </span>
            </div>
          ) : (
            <div className="tc-audio" role="group" aria-label="Entrada de audio">
              <button
                type="button"
                className={`audio-record-btn ${isRecording ? 'audio-record-btn--active' : ''}`}
                aria-pressed={isRecording}
                aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación de voz'}
                onClick={handleRecordToggle}
              >
                {isRecording
                  ? <><MicOff size={20} aria-hidden="true" /> Detener <span className="rec-dot" aria-hidden="true" /></>
                  : <><Mic size={20} aria-hidden="true" /> Grabar</>
                }
              </button>

              <span className="audio-or" aria-hidden="true">o</span>

              <button
                type="button"
                className="audio-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Subir archivo de audio"
              >
                <Upload size={16} aria-hidden="true" />
                Subir archivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                aria-label="Seleccionar archivo de audio"
                className="visually-hidden"
                onChange={handleFileChange}
              />

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
            aria-disabled={!canTranslate}
          >
            {isLoading
              ? <><Loader2 size={18} className="spin" aria-hidden="true" /> Traduciendo…</>
              : <><Languages size={18} aria-hidden="true" /> Traducir</>
            }
          </button>

          {/* ── Resultado ──────────────────────────────────── */}
          <div
            id={resultId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Resultado de la traducción"
          >
            {isLoading && (
              <div className="tc-result tc-result--loading">
                <Loader2 size={20} className="spin" aria-hidden="true" />
                <span>Procesando traducción…</span>
              </div>
            )}
            {result && !isLoading && (
              <div className="tc-result">
                <div className="tc-result-header">
                  <span className="tc-result-label" id={`${resultId}-label`}>
                    Traducción al Español
                  </span>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={handleCopy}
                    aria-label={copied ? 'Texto copiado al portapapeles' : 'Copiar traducción'}
                  >
                    {copied
                      ? <><Check size={14} aria-hidden="true" /> Copiado</>
                      : <><Copy size={14} aria-hidden="true" /> Copiar</>
                    }
                  </button>
                </div>
                <p className="tc-result-text" aria-labelledby={`${resultId}-label`}>
                  {result}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  )
}
