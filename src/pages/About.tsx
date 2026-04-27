import {
  Mic2, FileText, BookMarked, Users, Globe, ShieldCheck,
  Smartphone, Cpu, GraduationCap, Lightbulb,
  Mail, MapPin, ExternalLink, Award,
} from 'lucide-react'

const CDN = 'https://cdn.unimagdalena.edu.co/images'

const features = [
  { icon: <Mic2 size={22} aria-hidden="true" />,       title: 'Reconocimiento de voz',    desc: 'Captura audio en Arhuaco o Kogui y lo convierte en texto para su traducción automática.' },
  { icon: <FileText size={22} aria-hidden="true" />,   title: 'Traducción de texto',       desc: 'Entrada directa de texto en lengua indígena con resultado instantáneo en español.' },
  { icon: <BookMarked size={22} aria-hidden="true" />, title: 'Corpus lingüístico',        desc: 'Entrenado con corpus certificados construidos junto a hablantes nativos y lingüistas.' },
  { icon: <Users size={22} aria-hidden="true" />,      title: 'Participación comunitaria', desc: 'Desarrollado en colaboración directa con las comunidades Arhuaco y Kogui de la Sierra Nevada.' },
  { icon: <Globe size={22} aria-hidden="true" />,      title: 'Acceso web',                desc: 'Disponible desde cualquier dispositivo con navegador, sin necesidad de instalar apps.' },
  { icon: <ShieldCheck size={22} aria-hidden="true" />,title: 'Patrimonio protegido',      desc: 'Las lenguas y sus datos son tratados con protocolos de soberanía cultural indígena.' },
]

const researchLines = [
  { icon: <Smartphone size={18} aria-hidden="true" />,    label: 'Aplicaciones Móviles' },
  { icon: <Cpu size={18} aria-hidden="true" />,           label: 'Desarrollo Electrónico' },
  { icon: <GraduationCap size={18} aria-hidden="true" />, label: 'Docencia en Telecomunicaciones' },
  { icon: <Lightbulb size={18} aria-hidden="true" />,     label: 'Gestión e Innovación Tecnológica' },
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
      <section className="page-hero" aria-labelledby="about-heading">
        <div className="page-hero-bg" aria-hidden="true" />
        <div className="container page-hero-content">
          <h1 id="about-heading" className="page-hero-title">Acerca de SAYTA</h1>
          <p className="page-hero-sub">
            Sistema de Audio y Traducción Ancestral — Universidad del Magdalena
          </p>
        </div>
      </section>

      {/* ── What is SAYTA ─────────────────────────────────────── */}
      <section className="section about-intro-section" aria-labelledby="sayta-heading">
        <div className="container about-intro">
          <div className="about-intro-text">
            <h2 id="sayta-heading" className="section-title section-title-left">¿Qué es SAYTA?</h2>
            <p>
              SAYTA es una herramienta de inteligencia artificial desarrollada en la{' '}
              <strong>Universidad del Magdalena</strong> para facilitar la comunicación entre las
              comunidades indígenas de la Sierra Nevada de Santa Marta y el mundo hispanohablante.
            </p>
            <p>
              El proyecto nace de la necesidad de preservar y difundir el patrimonio lingüístico de los
              pueblos <strong>Arhuaco</strong> y <strong>Kogui</strong>, dos de las culturas indígenas
              más importantes de Colombia, cuyos idiomas corren riesgo de desaparecer ante la presión
              del español como lengua dominante.
            </p>
            <p>
              A través de modelos de procesamiento de lenguaje natural y reconocimiento automático de
              voz, SAYTA permite traducir —tanto texto como audio— desde el Arhuaco (Ika) y el Kogui
              (Kággaba) hacia el español, democratizando el acceso a estas lenguas ancestrales.
            </p>
          </div>
          <div className="about-intro-logo" aria-hidden="true">
            <img
              src={`${CDN}/escudo/bg_light/384.png`}
              alt=""
              className="about-uni-logo"
            />
            <img src="/SAYTA LOGO.jpg" alt="" className="about-sayta-logo" />
          </div>
        </div>
      </section>

      {/* ── Languages ─────────────────────────────────────────── */}
      <section className="section lang-section" aria-labelledby="lang-heading">
        <div className="container">
          <h2 id="lang-heading" className="section-title">Lenguas disponibles</h2>
          <p className="section-sub">
            Dos de las lenguas indígenas más importantes de la Sierra Nevada de Santa Marta.
          </p>
          <div className="lang-cards">
            <article className="lang-card">
              <h3>Arhuaco <span className="lang-card-native">Ika</span></h3>
              <p>
                Hablado por el pueblo Arhuaco en las laderas de la Sierra Nevada. Cuenta con
                aproximadamente 14.000 hablantes activos.
              </p>
            </article>
            <article className="lang-card">
              <h3>Kogui <span className="lang-card-native">Kággaba</span></h3>
              <p>
                Lengua del pueblo Kogui, guardianes ancestrales de la Sierra Nevada, con alrededor
                de 10.000 hablantes.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="section features-section" aria-labelledby="features-heading">
        <div className="container">
          <h2 id="features-heading" className="section-title">Capacidades del sistema</h2>
          <p className="section-sub">Tecnología al servicio de la preservación cultural.</p>
          <ul className="features-grid" role="list">
            {features.map((f) => (
              <li key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── GIDEAM ────────────────────────────────────────────── */}
      <section className="section gideam-section" aria-labelledby="gideam-heading">
        <div className="container">
          <div className="gideam-header">
            <div className="gideam-logo-wrap">
              <img src="/gideam.png" alt="Logo del Grupo de Investigación GIDEAM" className="gideam-logo" />
            </div>
            <div className="gideam-meta">
              <div className="gideam-badges" aria-label="Categorías del grupo">
                <span className="gideam-badge">Equipo técnico</span>
                <span className="gideam-badge gideam-badge--award">
                  <Award size={12} aria-hidden="true" /> Categoría Colciencias: A
                </span>
              </div>
              <h2 id="gideam-heading" className="section-title section-title-left">Grupo GIDEAM</h2>
              <p className="gideam-lead">
                SAYTA es desarrollado por el{' '}
                <strong>
                  Grupo de Investigación en Ingeniería, Desarrollo Electrónico,
                  Aplicaciones y Multimedia (GIDEAM)
                </strong>{' '}
                de la Universidad del Magdalena.
              </p>
              <a
                href="https://investigacion.unimagdalena.edu.co/unidadesOrganizativas/38"
                target="_blank"
                rel="noreferrer"
                className="gideam-link"
                aria-label="Ver grupo GIDEAM en el portal de investigación de Unimagdalena (abre en nueva pestaña)"
              >
                <ExternalLink size={14} aria-hidden="true" />
                Ver en portal de investigación
              </a>
            </div>
          </div>

          <div className="gideam-body">
            <div className="gideam-block">
              <h3 className="gideam-block-title">Líneas de investigación</h3>
              <ul className="research-lines" role="list">
                {researchLines.map((l) => (
                  <li key={l.label} className="research-line">
                    <span className="research-line-icon">{l.icon}</span>
                    {l.label}
                  </li>
                ))}
              </ul>
            </div>

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
      <section className="section uni-section" aria-labelledby="uni-heading">
        <div className="container uni-section-inner">
          <div className="uni-logos" aria-hidden="true">
            <img src={`${CDN}/escudo/bg_dark/192.png`} alt="" className="uni-logo-dark" />
            <img src={`${CDN}/acreditacion/blue/192.png`} alt="" className="uni-logo-dark" />
          </div>
          <div className="uni-text">
            <h2 id="uni-heading" className="section-title section-title-light">
              Universidad del Magdalena
            </h2>
            <p>
              Institución de Educación Superior con Acreditación de Alta Calidad, comprometida con la
              investigación, la innovación y el desarrollo regional. SAYTA es parte de los proyectos
              de investigación de la Facultad de Ingeniería orientados al bienestar de las comunidades
              indígenas del Caribe colombiano.
            </p>
            <a
              href="https://www.unimagdalena.edu.co"
              target="_blank"
              rel="noreferrer"
              className="uni-link"
              aria-label="Visitar el sitio oficial de la Universidad del Magdalena (abre en nueva pestaña)"
            >
              Visitar sitio oficial →
            </a>
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────── */}
      <section className="section contact-section" aria-labelledby="contact-heading">
        <div className="container">
          <h2 id="contact-heading" className="section-title">Contacto</h2>
          <p className="section-sub">¿Tienes preguntas sobre SAYTA? Escríbenos.</p>
          <div className="contact-cards">
            <a
              href="mailto:sayta@unimagdalena.edu.co"
              className="contact-card"
              aria-label="Enviar correo a sayta@unimagdalena.edu.co"
            >
              <div className="contact-card-icon" aria-hidden="true">
                <Mail size={22} />
              </div>
              <div>
                <span className="contact-card-label">Correo electrónico</span>
                <span className="contact-card-value">sayta@unimagdalena.edu.co</span>
              </div>
            </a>
            <address className="contact-card contact-card--address">
              <div className="contact-card-icon" aria-hidden="true">
                <MapPin size={22} />
              </div>
              <div>
                <span className="contact-card-label">Dirección</span>
                <span className="contact-card-value">
                  Calle 29H3 No 22-01<br />
                  Santa Marta D.T.C.H., Colombia<br />
                  Código Postal 470004
                </span>
              </div>
            </address>
          </div>
        </div>
      </section>
    </>
  )
}
