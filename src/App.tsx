import { Routes, Route } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Etiquetado from './pages/Etiquetado'
import Glosario from './pages/Glosario'
import Entrenamiento from './pages/Entrenamiento'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          {/* Rutas públicas */}
          <Route path="/"       element={<Home />} />
          <Route path="/acerca" element={<About />} />

          {/* Rutas protegidas — requieren contraseña */}
          <Route element={<RequireAuth />}>
            <Route path="/glosario"      element={<Glosario />} />
            <Route path="/entrenamiento" element={<Entrenamiento />} />
            <Route path="/etiquetado"    element={<Etiquetado />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
