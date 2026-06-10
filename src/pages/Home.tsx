import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, Eye, EyeOff, AlertCircle, Languages, BookOpen, Cpu, Tag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { isUnlocked, unlock } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [showGate, setShowGate] = useState(false)
  const [gateInput, setGateInput] = useState('')
  const [gateError, setGateError] = useState(false)
  const [showPw, setShowPw] = useState(false)

  // Si RequireAuth redirigió aquí, abrir el gate automáticamente
  const from: string = (location.state as { from?: string } | null)?.from ?? '/traductor'
  useEffect(() => {
    if (location.state && (location.state as { from?: string }).from) {
      setShowGate(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openGate = (dest = '/traductor') => {
    setShowGate(true)
    setGateInput('')
    setGateError(false)
    setShowPw(false)
    // guardar destino en state para el submit
    navigate('.', { state: { from: dest }, replace: true })
  }

  const submitGate = () => {
    if (unlock(gateInput)) {
      setShowGate(false)
      navigate(from, { replace: true })
    } else {
      setGateError(true)
    }
  }

  return (
    <section className="home-page" aria-labelledby="home-heading">
      <div className="home-inner">

        {/* ── Hero ─────────────────────────────────────────── */}
        <header className="home-hero">
          <div className="home-hero-logos">
            <img
              src="https://cdn.unimagdalena.edu.co/images/escudo/bg_dark/192.png"
              alt="Universidad del Magdalena"
              className="home-logo-uni"
              width="64" height="64"
            />
            <img
              src="/SAYTA LOGO.jpg"
              alt="SAYTA"
              className="home-logo-sayta"
              width="64" height="64"
            />
          </div>
          <h1 id="home-heading" className="home-title">SAYTA</h1>
          <p className="home-subtitle">
            Sistema de Audio y Traducción Ancestral
          </p>
          <p className="home-desc">
            Plataforma de traducción semántica para lenguas indígenas colombianas,
            desarrollada por la Universidad del Magdalena. Usa modelos de embeddings
            y reconocimiento de voz para preservar y difundir el patrimonio lingüístico ancestral.
          </p>

          {isUnlocked ? (
            <button
              type="button"
              className="home-cta-btn"
              onClick={() => navigate('/traductor')}
            >
              <Languages size={18} aria-hidden="true" />
              Ir al Traductor
            </button>
          ) : (
            <button
              type="button"
              className="home-cta-btn"
              onClick={() => openGate('/traductor')}
            >
              <Lock size={18} aria-hidden="true" />
              Acceder al Traductor
            </button>
          )}
        </header>

        {/* ── Características ──────────────────────────────── */}
        <div className="home-features" role="list">
          <div className="home-feature" role="listitem">
            <span className="home-feature-icon" aria-hidden="true"><Languages size={22} /></span>
            <h2 className="home-feature-title">Traducción semántica</h2>
            <p className="home-feature-desc">
              Búsqueda por similitud usando embeddings entrenados con vocabulario de lenguas
              indígenas como el Chimila y otras del Caribe colombiano.
            </p>
          </div>
          <div className="home-feature" role="listitem">
            <span className="home-feature-icon" aria-hidden="true"><Cpu size={22} /></span>
            <h2 className="home-feature-title">Reconocimiento de voz</h2>
            <p className="home-feature-desc">
              Transcripción automática de audio en lengua indígena mediante modelos
              de habla entrenados con datos de campo recopilados por investigadores.
            </p>
          </div>
          <div className="home-feature" role="listitem">
            <span className="home-feature-icon" aria-hidden="true"><BookOpen size={22} /></span>
            <h2 className="home-feature-title">Glosario digital</h2>
            <p className="home-feature-desc">
              Base de datos terminológica bilingüe con términos, definiciones y
              equivalencias español–lengua indígena, gestionada en línea.
            </p>
          </div>
          <div className="home-feature" role="listitem">
            <span className="home-feature-icon" aria-hidden="true"><Tag size={22} /></span>
            <h2 className="home-feature-title">Etiquetado colaborativo</h2>
            <p className="home-feature-desc">
              Herramienta para que investigadores y hablantes nativos etiqueten
              y validen corpus de audio, mejorando continuamente los modelos.
            </p>
          </div>
        </div>

        {/* ── Pie informativo ──────────────────────────────── */}
        <p className="home-footer-note">
          Proyecto GIDEAM · Facultad de Ingeniería · Universidad del Magdalena · Santa Marta, Colombia
        </p>

      </div>

      {/* ── Modal contraseña ─────────────────────────────────── */}
      {showGate && (
        <div className="gate-overlay" role="dialog" aria-modal="true" aria-label="Acceso al sistema">
          <div className="gate-card">
            <h2 className="gate-title"><Lock size={16} /> Acceso al sistema</h2>
            <p className="gate-sub">Ingresa la contraseña para acceder al sistema.</p>
            <div className="gate-field">
              <input
                type={showPw ? 'text' : 'password'}
                className="gl-input"
                placeholder="Contraseña"
                value={gateInput}
                autoFocus
                onChange={e => { setGateInput(e.target.value); setGateError(false) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitGate()
                  if (e.key === 'Escape') setShowGate(false)
                }}
              />
              <button type="button" className="gate-eye" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {gateError && <p className="gate-error"><AlertCircle size={13} /> Contraseña incorrecta.</p>}
            <div className="gate-actions">
              <button type="button" className="ent-btn ent-btn--secondary" onClick={() => setShowGate(false)}>Cancelar</button>
              <button type="button" className="ent-btn ent-btn--primary" onClick={submitGate}>Entrar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
