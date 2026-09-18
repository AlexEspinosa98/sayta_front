import { Routes, Route } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Registro from './pages/Registro'
import Perfil from './pages/Perfil'
import Traductor from './pages/Traductor'
import Etiquetado from './pages/Etiquetado'
import Glosario from './pages/Glosario'
import Entrenamiento from './pages/Entrenamiento'
import Usuarios from './pages/admin/Usuarios'
import RolesPermisos from './pages/admin/RolesPermisos'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          {/* Rutas públicas */}
          <Route path="/"       element={<Home />} />
          <Route path="/acerca" element={<About />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/setup"    element={<Setup />} />
          <Route path="/registro" element={<Registro />} />

          {/* Rutas protegidas — requieren sesión iniciada */}
          <Route element={<RequireAuth />}>
            <Route path="/perfil" element={<Perfil />} />
          </Route>
          <Route element={<RequireAuth check={p => p.traduccion} />}>
            <Route path="/traductor" element={<Traductor />} />
          </Route>
          <Route element={<RequireAuth check={p => p.glosario.leer} />}>
            <Route path="/glosario" element={<Glosario />} />
          </Route>
          <Route element={<RequireAuth check={p => p.modelosAsr.leer} />}>
            <Route path="/entrenamiento" element={<Entrenamiento />} />
          </Route>
          <Route element={<RequireAuth check={p => p.datasetAudio.leer} />}>
            <Route path="/dataset-audios" element={<Etiquetado />} />
            <Route path="/dataset_audio" element={<Etiquetado />} />
            <Route path="/etiquetado" element={<Etiquetado />} />
          </Route>
          <Route element={<RequireAuth check={p => p.usuarios.gestionar} />}>
            <Route path="/admin/usuarios" element={<Usuarios />} />
            <Route path="/admin/roles" element={<RolesPermisos />} />
            <Route path="/admin/permisos" element={<RolesPermisos />} />
            <Route path="/admin/roles-permisos" element={<RolesPermisos />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
