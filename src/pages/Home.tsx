import { useNavigate } from 'react-router-dom'
import { Lock, Languages, BookOpen, Cpu, Tag, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { isAuthenticated, permissions } = useAuth()
  const navigate = useNavigate()

  return (
    <section className="home-page" aria-labelledby="home-heading">
      <div className="home-inner">

        {/* ── Hero ─────────────────────────────────────────── */}
        <header className="home-hero">
          <div className="home-hero-logos">
            <img
              src="/Assets/logos/unimagdalena-escudo.png"
              alt="Universidad del Magdalena"
              className="home-logo-uni"
              height="66"
            />
            <div className="logo-divider" aria-hidden="true" style={{ height: 48, background: 'var(--gray-200)' }} />
            <img
              src="/Assets/logos/sayta-logo.svg"
              alt="SAYTA"
              className="home-logo-sayta"
              height="40"
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

          {isAuthenticated && permissions.traduccion ? (
            <button
              type="button"
              className="home-cta-btn"
              onClick={() => navigate('/traductor')}
            >
              <Languages size={18} aria-hidden="true" />
              Ir al Traductor
            </button>
          ) : isAuthenticated ? (
            <p className="ent-hint" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Clock size={15} aria-hidden="true" />
              Tu cuenta todavía no tiene acceso al Traductor. Un administrador debe asignarte un rol.
            </p>
          ) : (
            <button
              type="button"
              className="home-cta-btn"
              onClick={() => navigate('/login', { state: { from: '/traductor' } })}
            >
              <Lock size={18} aria-hidden="true" />
              Iniciar sesión
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
    </section>
  )
}
