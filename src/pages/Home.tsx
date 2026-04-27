import { useState, useRef } from 'react'
import {
  Mic,
  MicOff,
  Upload,
  Languages,
  ArrowRightLeft,
  Loader2,
  Volume2,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react'

type Language = 'arhuaco' | 'kogui'
type InputMode = 'text' | 'audio'

const LANG_LABELS: Record<Language, string> = {
  arhuaco: 'Arhuaco',
  kogui: 'Kogui',
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('arhuaco')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [inputText, setInputText] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canTranslate = inputMode === 'text' ? inputText.trim().length > 0 : audioFile !== null || isRecording

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
    const file = e.target.files?.[0] ?? null
    setAudioFile(file)
    setIsRecording(false)
  }

  return (
    <>
      {/* ── Hero + Translator ─────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-eyebrow">
            <Languages size={14} />
            Sistema de Audio y Traducción Ancestral
          </div>
          <h1 className="hero-title">
            <span className="hero-title-accent">SAYTA</span>
          </h1>
          <p className="hero-desc">
            Traduce lenguas indígenas de la Sierra Nevada —<br />
            Arhuaco y Kogui al español, por texto o audio.
          </p>
        </div>

        {/* Translator card */}
        <div className="translator-card">
          {/* Language + mode row */}
          <div className="tc-top">
            <div className="lang-selector">
              {(['arhuaco', 'kogui'] as Language[]).map((l) => (
                <button
                  key={l}
                  className={`lang-pill ${language === l ? 'lang-pill-active' : ''}`}
                  onClick={() => setLanguage(l)}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
              <div className="lang-arrow">
                <ArrowRightLeft size={14} />
                <span>Español</span>
              </div>
            </div>

            <div className="mode-pills">
              <button
                className={`mode-pill ${inputMode === 'text' ? 'mode-pill-active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                <Languages size={14} />
                Texto
              </button>
              <button
                className={`mode-pill ${inputMode === 'audio' ? 'mode-pill-active' : ''}`}
                onClick={() => setInputMode('audio')}
              >
                <Mic size={14} />
                Audio
              </button>
            </div>
          </div>

          {/* Input */}
          {inputMode === 'text' ? (
            <div className="tc-input-wrap">
              <textarea
                className="tc-textarea"
                placeholder={`Escribe en ${LANG_LABELS[language]}…`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={4}
              />
              <span className="tc-char-count">{inputText.length}</span>
            </div>
          ) : (
            <div className="tc-audio">
              <button
                className={`audio-record-btn ${isRecording ? 'audio-record-btn--active' : ''}`}
                onClick={handleRecordToggle}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                {isRecording ? 'Detener' : 'Grabar'}
                {isRecording && <span className="rec-dot" />}
              </button>
              <span className="audio-or">o</span>
              <button className="audio-upload-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                Subir archivo
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
              {audioFile && (
                <span className="audio-file-tag">
                  <Volume2 size={12} />
                  {audioFile.name}
                </span>
              )}
            </div>
          )}

          {/* Translate button */}
          <button className="translate-btn" onClick={handleTranslate} disabled={isLoading || !canTranslate}>
            {isLoading ? <Loader2 size={18} className="spin" /> : <Languages size={18} />}
            {isLoading ? 'Traduciendo…' : 'Traducir'}
          </button>

          {/* Result */}
          {result && !isLoading && (
            <div className="tc-result">
              <div className="tc-result-header">
                <span className="tc-result-label">Español</span>
                <button className="copy-btn" onClick={handleCopy} title="Copiar">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="tc-result-text">{result}</p>
            </div>
          )}
          {isLoading && (
            <div className="tc-result tc-result--loading">
              <Loader2 size={20} className="spin" />
              <span>Procesando traducción…</span>
            </div>
          )}
        </div>

        <a href="#lenguas" className="hero-scroll-hint" aria-label="Ver más">
          <ChevronDown size={20} />
        </a>
      </section>

      {/* ── Languages ─────────────────────────────────────────── */}
      <section id="lenguas" className="section lang-section">
        <div className="container">
          <h2 className="section-title">Lenguas disponibles</h2>
          <p className="section-sub">
            Dos de las lenguas indígenas más importantes de la Sierra Nevada de Santa Marta.
          </p>
          <div className="lang-cards">
            <div className="lang-card">
              <div className="lang-card-badge">Familia Chibcha</div>
              <h3>Arhuaco <span className="lang-card-native">Ika</span></h3>
              <p>
                Hablado por el pueblo Arhuaco en las laderas de la Sierra Nevada. Cuenta con aproximadamente
                14.000 hablantes activos.
              </p>
            </div>
            <div className="lang-card">
              <div className="lang-card-badge">Familia Chibcha</div>
              <h3>Kogui <span className="lang-card-native">Kággaba</span></h3>
              <p>
                Lengua del pueblo Kogui, guardianes ancestrales de la Sierra Nevada, con alrededor de
                10.000 hablantes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
