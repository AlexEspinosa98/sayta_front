import { useState, useRef } from 'react'
import './App.css'

type Language = 'arhuaco' | 'kogui'
type InputMode = 'text' | 'audio'

export default function App() {
  const [language, setLanguage] = useState<Language>('arhuaco')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [inputText, setInputText] = useState('')
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTranslate = async () => {
    if (!inputText.trim()) return
    setIsLoading(true)
    setResult('')
    // TODO: conectar con el backend
    await new Promise((r) => setTimeout(r, 1200))
    setResult(`[Traducción de ${language === 'arhuaco' ? 'Arhuaco' : 'Kogui'} → Español]\n\n${inputText}`)
    setIsLoading(false)
  }

  const handleRecordToggle = () => {
    setIsRecording((r) => !r)
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setInputText(`[Audio: ${file.name}]`)
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logos">
            <img src="/Universidad.png" alt="Universidad del Magdalena" className="logo-unimagdalena" />
            <div className="logo-divider" />
            <img src="/SAYTA-LOGO.svg" alt="SAYTA" className="logo-sayta" />
          </div>
          <nav className="nav">
            <a href="#about">Acerca de</a>
            <a href="#languages">Lenguas</a>
            <a href="#translator">Traductor</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-badge">Universidad del Magdalena</div>
          <h1 className="hero-title">
            <span className="hero-title-accent">SAYTA</span>
          </h1>
          <p className="hero-subtitle">
            Sistema de Audio y Traducción Ancestral
          </p>
          <p className="hero-desc">
            Preservando las voces de los pueblos <strong>Arhuaco</strong> y <strong>Kogui</strong> a través de tecnología de traducción inteligente.
          </p>
          <a href="#translator" className="hero-cta">
            Comenzar a traducir
          </a>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-circle hero-circle-1" />
          <div className="hero-circle hero-circle-2" />
          <div className="hero-circle hero-circle-3" />
        </div>
      </section>

      {/* About */}
      <section id="about" className="section about-section">
        <div className="container">
          <h2 className="section-title">¿Qué es SAYTA?</h2>
          <p className="section-desc">
            SAYTA es una herramienta desarrollada en la Universidad del Magdalena para facilitar la comunicación entre las comunidades indígenas de la Sierra Nevada de Santa Marta y el mundo hispanohablante, contribuyendo a la preservación y difusión de su patrimonio lingüístico.
          </p>
          <div className="cards">
            <div className="card">
              <div className="card-icon">🎙️</div>
              <h3>Entrada de audio</h3>
              <p>Graba o sube archivos de voz en lengua Arhuaco o Kogui para obtener la traducción al español.</p>
            </div>
            <div className="card">
              <div className="card-icon">✍️</div>
              <h3>Entrada de texto</h3>
              <p>Escribe directamente en Arhuaco o Kogui y obtén la traducción al instante.</p>
            </div>
            <div className="card">
              <div className="card-icon">🌿</div>
              <h3>Patrimonio vivo</h3>
              <p>Contribuye a la preservación de dos de las lenguas indígenas más importantes de Colombia.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Languages */}
      <section id="languages" className="section languages-section">
        <div className="container">
          <h2 className="section-title section-title-light">Lenguas disponibles</h2>
          <div className="lang-cards">
            <div className="lang-card">
              <h3>Arhuaco</h3>
              <p>
                También llamado Ika, es hablado por el pueblo Arhuaco en las laderas de la Sierra Nevada de Santa Marta. Es una lengua de la familia Chibcha con alrededor de 14.000 hablantes.
              </p>
            </div>
            <div className="lang-card">
              <h3>Kogui</h3>
              <p>
                Lengua del pueblo Kogui, guardianes ancestrales de la Sierra Nevada. Pertenece también a la familia Chibcha y es hablada por aproximadamente 10.000 personas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Translator */}
      <section id="translator" className="section translator-section">
        <div className="container">
          <h2 className="section-title">Traductor</h2>
          <p className="section-desc">Selecciona la lengua de origen, el modo de entrada y escribe o graba el texto a traducir.</p>

          <div className="translator-box">
            {/* Language selector */}
            <div className="lang-selector">
              <button
                className={`lang-btn ${language === 'arhuaco' ? 'lang-btn-active' : ''}`}
                onClick={() => setLanguage('arhuaco')}
              >
                Arhuaco → Español
              </button>
              <button
                className={`lang-btn ${language === 'kogui' ? 'lang-btn-active' : ''}`}
                onClick={() => setLanguage('kogui')}
              >
                Kogui → Español
              </button>
            </div>

            {/* Input mode toggle */}
            <div className="mode-toggle">
              <button
                className={`mode-btn ${inputMode === 'text' ? 'mode-btn-active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                <span>✍️</span> Texto
              </button>
              <button
                className={`mode-btn ${inputMode === 'audio' ? 'mode-btn-active' : ''}`}
                onClick={() => setInputMode('audio')}
              >
                <span>🎙️</span> Audio
              </button>
            </div>

            {/* Input area */}
            <div className="input-area">
              {inputMode === 'text' ? (
                <textarea
                  className="text-input"
                  placeholder={`Escribe en ${language === 'arhuaco' ? 'Arhuaco' : 'Kogui'}…`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={5}
                />
              ) : (
                <div className="audio-input">
                  <button
                    className={`record-btn ${isRecording ? 'record-btn-active' : ''}`}
                    onClick={handleRecordToggle}
                  >
                    {isRecording ? '⏹ Detener grabación' : '⏺ Iniciar grabación'}
                  </button>
                  <span className="audio-or">o</span>
                  <button className="upload-btn" onClick={handleFileUpload}>
                    📂 Subir archivo de audio
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  {inputText && <p className="audio-filename">{inputText}</p>}
                </div>
              )}
            </div>

            <button
              className="translate-btn"
              onClick={handleTranslate}
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? <span className="spinner" /> : 'Traducir'}
            </button>

            {/* Result */}
            {(result || isLoading) && (
              <div className="result-box">
                <h4 className="result-label">Traducción al Español</h4>
                {isLoading ? (
                  <div className="result-loading">Traduciendo…</div>
                ) : (
                  <p className="result-text">{result}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logos">
            <img src="/Universidad.png" alt="Unimagdalena" className="footer-logo" />
            <img src="/SAYTA-LOGO.svg" alt="SAYTA" className="footer-logo footer-logo-sayta" />
          </div>
          <p className="footer-text">
            © {new Date().getFullYear()} Universidad del Magdalena · SAYTA – Sistema de Audio y Traducción Ancestral
          </p>
          <p className="footer-subtext">
            Facultad de Ingeniería · Santa Marta, Colombia
          </p>
        </div>
      </footer>
    </div>
  )
}
