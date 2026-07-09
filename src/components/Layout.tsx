import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Home, Library, Activity, Tag, Unlock, Languages, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ESCUDO = '/Assets/logos/unimagdalena-escudo.png'
const SAYTA_LOGO = '/Assets/logos/sayta-logo.svg'

export default function Layout() {
  const { isUnlocked, lock } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const closeMenu = () => setMenuOpen(false)

  // Cerrar el menú al cambiar de ruta
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Cerrar con Escape y bloquear scroll de fondo cuando está abierto
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [menuOpen])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' nav-link-active' : ''}`

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <header className="header" role="banner">
        <div className="header-inner">
          <div className="header-brand">
            <a
              href="https://www.unimagdalena.edu.co"
              target="_blank"
              rel="noreferrer"
              className="header-uni-link"
              aria-label="Sitio oficial de la Universidad del Magdalena (abre en nueva pestaña)"
            >
              <img
                src={ESCUDO}
                alt="Universidad del Magdalena"
                className="logo-escudo"
                width="42"
                height="42"
              />
            </a>
            <div className="logo-divider" aria-hidden="true" />
            <NavLink to="/" className="header-sayta-link" aria-label="Ir al Traductor SAYTA">
              <img
                src={SAYTA_LOGO}
                alt="SAYTA"
                className="logo-sayta"
                height="25"
              />
            </NavLink>
          </div>

          <nav
            id="primary-nav"
            className={`header-nav${menuOpen ? ' is-open' : ''}`}
            aria-label="Navegación principal"
          >
            <ul className="nav" role="list">
              <li>
                <NavLink to="/" end className={navLinkClass} onClick={closeMenu}>
                  <Home size={16} aria-hidden="true" /><span>Inicio</span>
                </NavLink>
              </li>
              {isUnlocked && (
                <>
                  <li>
                    <NavLink to="/traductor" className={navLinkClass} onClick={closeMenu}>
                      <Languages size={16} aria-hidden="true" /><span>Traductor</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/glosario" className={navLinkClass} onClick={closeMenu}>
                      <Library size={16} aria-hidden="true" /><span>Glosario</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/entrenamiento" className={navLinkClass} onClick={closeMenu}>
                      <Activity size={16} aria-hidden="true" /><span>Entrenamiento</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/etiquetado" className={navLinkClass} onClick={closeMenu}>
                      <Tag size={16} aria-hidden="true" /><span>Etiquetado</span>
                    </NavLink>
                  </li>
                </>
              )}
              <li>
                <NavLink to="/acerca" className={navLinkClass} onClick={closeMenu}>
                  <BookOpen size={16} aria-hidden="true" /><span>Acerca de</span>
                </NavLink>
              </li>
              {isUnlocked && (
                <li className="nav-lock-item">
                  <button className="nav-link nav-link-lock" onClick={() => { lock(); closeMenu() }} type="button">
                    <Unlock size={16} aria-hidden="true" /><span>Bloquear acceso</span>
                  </button>
                </li>
              )}
            </ul>
          </nav>

          <div className="header-actions">
            {isUnlocked && (
              <button className="header-lock-btn" onClick={lock} title="Bloquear acceso" aria-label="Bloquear acceso">
                <Unlock size={15} aria-hidden="true" /><span>Bloquear</span>
              </button>
            )}
            <button
              className="header-menu-btn"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              aria-controls="primary-nav"
            >
              {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <div className="header-backdrop" onClick={closeMenu} aria-hidden="true" />}

      <main id="main-content" className="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="footer" role="contentinfo">
        <div className="footer-inner">
          <div className="footer-logos" aria-label="Logos institucionales">
            <img src={SAYTA_LOGO} alt="SAYTA" className="footer-logo footer-logo-sayta" height="26" />
            <div className="logo-divider" aria-hidden="true" style={{ background: 'var(--gray-200)' }} />
            <img src={ESCUDO} alt="Universidad del Magdalena · Acreditada en Alta Calidad" className="footer-logo" width="44" height="44" />
          </div>
          <p className="footer-text">
            © {new Date().getFullYear()} Universidad del Magdalena · SAYTA – Sistema de Audio y Traducción Ancestral
          </p>
          <p className="footer-subtext">Facultad de Ingeniería · Santa Marta, Colombia</p>
        </div>
      </footer>
    </div>
  )
}
