import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { Permissions } from '../permissions'

/** Ruta protegida — exige sesión iniciada y, opcionalmente, un permiso puntual. */
export default function RequireAuth({ check }: { check?: (p: Permissions) => boolean }) {
  const { isAuthenticated, loading, permissions } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="gl-loading" style={{ marginTop: 60 }}>
        <Loader2 size={20} className="spin" /> Verificando sesión…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (check && !check(permissions)) {
    return (
      <div className="gl-empty" style={{ marginTop: 60 }}>
        <ShieldAlert size={32} />
        <p>No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  return <Outlet />
}
