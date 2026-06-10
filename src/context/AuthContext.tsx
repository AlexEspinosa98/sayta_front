import { createContext, useContext, useState, type ReactNode } from 'react'

const ADMIN_PW  = 'Un1m4gd4l3n4'
const SESS_KEY  = 'sayta_admin'

interface AuthContextType {
  isUnlocked: boolean
  unlock: (pw: string) => boolean
  lock: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(
    () => sessionStorage.getItem(SESS_KEY) === '1'
  )

  const unlock = (pw: string): boolean => {
    if (pw === ADMIN_PW) {
      sessionStorage.setItem(SESS_KEY, '1')
      setIsUnlocked(true)
      return true
    }
    return false
  }

  const lock = () => {
    sessionStorage.removeItem(SESS_KEY)
    setIsUnlocked(false)
  }

  return (
    <AuthContext.Provider value={{ isUnlocked, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
