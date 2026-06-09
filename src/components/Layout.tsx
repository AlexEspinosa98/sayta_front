import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import { BookOpen, Home, Library, Activity, LogOut, User, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CDN = 'https://cdn.unimagdalena.edu.co/images'

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

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
                src={`${CDN}/escudo/bg_dark/192.png`}
                alt="Universidad del Magdalena"
                className="logo-escudo"
                width="46"
                height="46"
              />
            </a>
            <div className="logo-divider" aria-hidden="true" />
            <NavLink to="/" className="header-sayta-link" aria-label="Ir al Traductor SAYTA">
              <img
                src="/SAYTA LOGO.jpg"
                alt="SAYTA"
                className="logo-sayta"
                width="34"
                height="34"
              />
              <span className="header-sayta-name" aria-hidden="true">SAYTA</span>
            </NavLink>
          </div>

          <nav aria-label="Navegación principal">
            <ul className="nav" role="list">
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                >
                  <Home size={15} aria-hidden="true" />
                  <span>Traductor</span>
                </NavLink>
              </li>
              {isAuthenticated && (
                <>
                  <li>
                    <NavLink
                      to="/glosario"
                      className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                    >
                      <Library size={15} aria-hidden="true" />
                      <span>Glosario</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/entrenamiento"
                      className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                    >
                      <Activity size={15} aria-hidden="true" />
                      <span>Entrenamiento</span>
                    </NavLink>
                  </li>
                </>
              )}
              <li>
                <NavLink
                  to="/acerca"
                  className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                >
                  <BookOpen size={15} aria-hidden="true" />
                  <span>Acerca de</span>
                </NavLink>
              </li>
            </ul>
          </nav>

          {isAuthenticated && user ? (
            <div className="header-user">
              <div className="header-user-chip">
                <User size={13} aria-hidden="true" />
                <span className="header-user-name">{user.username}</span>
                <span className="header-user-rol">{user.rol_display}</span>
              </div>
              <button
                className="header-logout-btn"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="header-login-btn">
              <LogIn size={14} aria-hidden="true" />
              <span>Iniciar sesión</span>
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" className="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="footer" role="contentinfo">
        <div className="footer-inner">
          <div className="footer-logos" aria-label="Logos institucionales">
            <img
              src={`${CDN}/escudo/bg_dark/128.png`}
              alt="Universidad del Magdalena"
              className="footer-logo"
              width="42"
              height="42"
            />
            <img
              src={`${CDN}/acreditacion/blue/128.png`}
              alt="Acreditación de Alta Calidad"
              className="footer-logo"
              width="42"
              height="42"
            />
            <img
              src="/SAYTA LOGO.jpg"
              alt="SAYTA"
              className="footer-logo footer-logo-sayta"
              width="42"
              height="36"
            />
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
