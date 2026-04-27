import {
  Mic2, FileText, BookMarked, Users, Globe, ShieldCheck,
  Smartphone, Cpu, GraduationCap, Lightbulb,
  Mail, MapPin, ExternalLink, Award,
} from 'lucide-react'

const CDN = 'https://cdn.unimagdalena.edu.co/images'

const features = [
  {
    icon: <Mic2 size={22} />,
    title: 'Reconocimiento de voz',
    desc: 'Captura audio en Arhuaco o Kogui y lo convierte en texto para su traducción automática.',
  },
  {
    icon: <FileText size={22} />,
    title: 'Traducción de texto',
    desc: 'Entrada directa de texto en lengua indígena con resultado instantáneo en español.',
  },
  {
    icon: <BookMarked size={22} />,
    title: 'Corpus lingüístico',
    desc: 'Entrenado con corpus certificados construidos junto a hablantes nativos y lingüistas.',
  },
  {
    icon: <Users size={22} />,
    title: 'Participación comunitaria',
    desc: 'Desarrollado en colaboración directa con las comunidades Arhuaco y Kogui de la Sierra Nevada.',
  },
  {
    icon: <Globe size={22} />,
    title: 'Acceso web',
    desc: 'Disponible desde cualquier dispositivo con navegador, sin necesidad de instalar apps.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Patrimonio protegido',
    desc: 'Las lenguas y sus datos son tratados con protocolos de soberanía cultural indígena.',
  },
]

const researchLines = [
  { icon: <Smartphone size={18} />, label: 'Aplicaciones Móviles' },
  { icon: <Cpu size={18} />, label: 'Desarrollo Electrónico' },
  { icon: <GraduationCap size={18} />, label: 'Docencia en Telecomunicaciones' },
  { icon: <Lightbulb size={18} />, label: 'Gestión e Innovación Tecnológica' },
]

const objectives = [
  'Fomentar la participación de nuevos integrantes de la comunidad académica Unimagdalena dentro del grupo, especialmente nuevos investigadores en proceso de formación.',
  'Generar productos de nuevo conocimiento que satisfagan requerimientos de la industria y la región en el ámbito de las telecomunicaciones y desarrollo de aplicaciones móviles, complementando los centros de investigación en el campo de la ingeniería electrónica.',
  'Afianzar alianzas con entidades del estado y del sector productivo para desarrollar proyectos de I+D+I en telecomunicaciones que solucionen necesidades de la comunidad científica, académica y la sociedad, comprometidos con el desarrollo sostenible de la región y el país.',
]

export default function About() {
  return (
    <>
      {/* ── Page hero ─────────────────────────────────────────── */}
      <section className="page-hero">
        <div className="page-hero-bg" aria-hidden="true" />
        <div className="container page-hero-content">
          <h1 className="page-hero-title">Acerca de SAYTA</h1>
          <p className="page-hero-sub">
            Sistema de Audio y Traducción Ancestral — Universidad del Magdalena
          </p>
        </div>
      </section>

      {/* ── What is SAYTA ─────────────────────────────────────── */}
      <section className="section about-intro-section">
        <div className="container about-intro">
          <div className="about-intro-text">
            <h2 className="section-title section-title-left">¿Qué es SAYTA?</h2>
            <p>
              SAYTA es una herramienta de inteligencia artificial desarrollada en la{' '}
              <strong>Universidad del Magdalena</strong> para facilitar la comunicación entre las
              comunidades indígenas de la Sierra Nevada de Santa Marta y el mundo hispanohablante.
            </p>
            <p>
              El proyecto nace de la necesidad de preservar y difundir el patrimonio lingüístico de los
              pueblos <strong>Arhuaco</strong> y <strong>Kogui</strong>, dos de las culturas indígenas más
              importantes de Colombia, cuyos idiomas corren riesgo de desaparecer ante la presión del
              español como lengua dominante.
            </p>
            <p>
              A través de modelos de procesamiento de lenguaje natural y reconocimiento automático de voz,
              SAYTA permite traducir —tanto texto como audio— desde el Arhuaco (Ika) y el Kogui (Kággaba)
              hacia el español, democratizando el acceso a estas lenguas ancestrales.
            </p>
          </div>
          <div className="about-intro-logo">
            <img
              src={`${CDN}/escudo/bg_light/384.png`}
              alt="Universidad del Magdalena"
              className="about-uni-logo"
            />
            <img src="/SAYTA LOGO.jpg" alt="SAYTA" className="about-sayta-logo" />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="section features-section">
        <div className="container">
          <h2 className="section-title">Capacidades del sistema</h2>
          <p className="section-sub">Tecnología al servicio de la preservación cultural.</p>
          <div className="features-grid">
            {features.map((f) => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GIDEAM ────────────────────────────────────────────── */}
      <section className="section gideam-section">
        <div className="container">
          <div className="gideam-header">
            <div className="gideam-logo-wrap">
              <img src="/gideam.png" alt="Grupo GIDEAM" className="gideam-logo" />
            </div>
            <div className="gideam-meta">
              <div className="gideam-badges">
                <span className="gideam-badge">Equipo técnico</span>
                <span className="gideam-badge gideam-badge--award">
                  <Award size={12} /> Categoría Colciencias: A
                </span>
              </div>
              <h2 className="section-title section-title-left">Grupo GIDEAM</h2>
              <p className="gideam-lead">
                SAYTA es desarrollado por el{' '}
                <strong>Grupo de Investigación en Ingeniería, Desarrollo Electrónico,
                Aplicaciones y Multimedia (GIDEAM)</strong> de la Universidad del Magdalena.
              </p>
              <a
                href="https://investigacion.unimagdalena.edu.co/unidadesOrganizativas/38"
                target="_blank"
                rel="noreferrer"
                className="gideam-link"
              >
                <ExternalLink size={14} />
                Ver grupo en portal de investigación
              </a>
            </div>
          </div>

          <div className="gideam-body">
            {/* Research lines */}
            <div className="gideam-block">
              <h3 className="gideam-block-title">Líneas de investigación</h3>
              <div className="research-lines">
                {researchLines.map((l) => (
                  <div key={l.label} className="research-line">
                    <span className="research-line-icon">{l.icon}</span>
                    {l.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Objectives */}
            <div className="gideam-block">
              <h3 className="gideam-block-title">Objetivos del grupo</h3>
              <ol className="objectives-list">
                {objectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── University ────────────────────────────────────────── */}
      <section className="section uni-section">
        <div className="container uni-section-inner">
          <div className="uni-logos">
            <img src={`${CDN}/escudo/bg_dark/192.png`} alt="Escudo Unimagdalena" className="uni-logo-dark" />
            <img src={`${CDN}/acreditacion/blue/192.png`} alt="Alta Calidad" className="uni-logo-dark" />
          </div>
          <div className="uni-text">
            <h2 className="section-title section-title-light">Universidad del Magdalena</h2>
            <p>
              Institución de Educación Superior con Acreditación de Alta Calidad, comprometida con la
              investigación, la innovación y el desarrollo regional. SAYTA es parte de los proyectos de
              investigación de la Facultad de Ingeniería orientados al bienestar de las comunidades
              indígenas del Caribe colombiano.
            </p>
            <a
              href="https://www.unimagdalena.edu.co"
              target="_blank"
              rel="noreferrer"
              className="uni-link"
            >
              Visitar sitio oficial →
            </a>
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────── */}
      <section className="section contact-section">
        <div className="container">
          <h2 className="section-title">Contacto</h2>
          <p className="section-sub">¿Tienes preguntas sobre SAYTA? Escríbenos.</p>
          <div className="contact-cards">
            <a href="mailto:sayta@unimagdalena.edu.co" className="contact-card">
              <div className="contact-card-icon">
                <Mail size={22} />
              </div>
              <div>
                <span className="contact-card-label">Correo electrónico</span>
                <span className="contact-card-value">sayta@unimagdalena.edu.co</span>
              </div>
            </a>
            <div className="contact-card">
              <div className="contact-card-icon">
                <MapPin size={22} />
              </div>
              <div>
                <span className="contact-card-label">Dirección</span>
                <span className="contact-card-value">
                  Calle 29H3 No 22-01, Santa Marta D.T.C.H.<br />
                  Colombia · Código Postal 470004
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
