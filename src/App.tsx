import { Routes, Route } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import About from './pages/About'
import Etiquetado from './pages/Etiquetado'
import Glosario from './pages/Glosario'
import Entrenamiento from './pages/Entrenamiento'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<Layout />}>
          {/* Rutas públicas */}
          <Route path="/"       element={<Home />} />
          <Route path="/acerca" element={<About />} />
          <Route path="/etiquetado" element={<Etiquetado />} />

          {/* Rutas protegidas — requieren login */}
          <Route element={<RequireAuth />}>
            <Route path="/glosario"      element={<Glosario />} />
            <Route path="/entrenamiento" element={<Entrenamiento />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
