import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, Home } from 'lucide-react'

const CDN = 'https://cdn.unimagdalena.edu.co/images'

export default function Layout() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <a href="https://www.unimagdalena.edu.co" target="_blank" rel="noreferrer" className="header-uni-link">
              <img
                src={`${CDN}/escudo/bg_dark/192.png`}
                alt="Universidad del Magdalena"
                className="logo-escudo"
              />
            </a>
            <div className="logo-divider" />
            <NavLink to="/" className="header-sayta-link">
              <img src="/SAYTA-LOGO.svg" alt="SAYTA" className="logo-sayta" />
              <span className="header-sayta-name">SAYTA</span>
            </NavLink>
          </div>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <Home size={15} />
              Inicio
            </NavLink>
            <NavLink to="/acerca" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <BookOpen size={15} />
              Acerca de
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logos">
            <img src={`${CDN}/escudo/bg_dark/128.png`} alt="Unimagdalena" className="footer-logo" />
            <img src={`${CDN}/acreditacion/blue/128.png`} alt="Alta Calidad" className="footer-logo" />
            <img src="/SAYTA-LOGO.svg" alt="SAYTA" className="footer-logo footer-logo-sayta" />
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
