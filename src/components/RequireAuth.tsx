import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAuth() {
  const { isUnlocked } = useAuth()
  const location = useLocation()

  if (!isUnlocked) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
