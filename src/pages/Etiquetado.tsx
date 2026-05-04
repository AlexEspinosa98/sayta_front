/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react'
import { Lock, Mic, FolderOpen, BarChart2, RefreshCw, ChevronRight, AlertCircle, Music } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const PASSWORD = 'Un1m4gd4l3n4'
const SESSION_KEY = 'etiquetado_auth'

/* ── Types ─────────────────────────────────────────────────────── */

interface CommunityStats {
  comunidad: string
  total_grabaciones: number
  total_archivos: number
}

interface Session {
  nombre: string
  fecha?: string
  total_archivos?: number
}

type Community = 'Arhuaco' | 'Kogui'

/* ── Password Gate ─────────────────────────────────────────────── */

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onAuth()
    } else {
      setError(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
  }

  return (
    <div className="eg-gate">
      <div className={`eg-gate-card${shaking ? ' eg-shake' : ''}`}>
        <div className="eg-gate-icon">
          <Lock size={28} />
        </div>
        <h1 className="eg-gate-title">Área de Etiquetado</h1>
        <p className="eg-gate-sub">Acceso restringido — ingresa la contraseña para continuar</p>
        <form onSubmit={handleSubmit} className="eg-gate-form" noValidate>
          <label htmlFor="eg-pwd" className="sr-only">Contraseña</label>
          <input
            id="eg-pwd"
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            placeholder="Contraseña"
            className={`eg-gate-input${error ? ' eg-gate-input--error' : ''}`}
            autoFocus
            autoComplete="current-password"
            aria-describedby={error ? 'eg-pwd-err' : undefined}
          />
          {error && (
            <p id="eg-pwd-err" className="eg-gate-err" role="alert">
              <AlertCircle size={14} aria-hidden="true" /> Contraseña incorrecta
            </p>
          )}
          <button type="submit" className="eg-gate-btn">
            <Lock size={15} aria-hidden="true" /> Ingresar
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Stat Card ─────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent?: 'blue' | 'red'
}) {
  return (
    <div className={`eg-stat-card${accent === 'red' ? ' eg-stat-card--red' : ''}`}>
      <div className="eg-stat-icon">{icon}</div>
      <div className="eg-stat-body">
        <span className="eg-stat-label">{label}</span>
        <span className="eg-stat-value">{value}</span>
        {sub && <span className="eg-stat-sub">{sub}</span>}
      </div>
    </div>
  )
}

/* ── Stats Dashboard ────────────────────────────────────────────── */

function StatsDashboard() {
  const [stats, setStats] = useState<CommunityStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/grabaciones/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStats(Array.isArray(data) ? data : data.comunidades ?? [])
    } catch {
      setError('No se pudieron cargar las estadísticas. Verifica que el servidor esté activo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const totalGrab = stats.reduce((s, c) => s + (c.total_grabaciones ?? 0), 0)
  const totalArch = stats.reduce((s, c) => s + (c.total_archivos ?? 0), 0)

  return (
    <section className="eg-section" aria-labelledby="eg-stats-title">
      <div className="eg-section-header">
        <h2 id="eg-stats-title" className="eg-section-title">
          <BarChart2 size={18} aria-hidden="true" /> Estadísticas del corpus
        </h2>
        <button
          onClick={fetchStats}
          className="eg-refresh-btn"
          aria-label="Actualizar estadísticas"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="eg-alert" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </div>
      )}

      {loading && !error && (
        <div className="eg-loading" aria-live="polite" aria-busy="true">
          <RefreshCw size={20} className="spin" aria-hidden="true" /> Cargando estadísticas…
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="eg-stats-grid">
            <StatCard
              label="Total sesiones"
              value={totalGrab}
              sub="todas las comunidades"
              icon={<FolderOpen size={20} />}
            />
            <StatCard
              label="Total archivos"
              value={totalArch}
              sub="archivos de audio"
              icon={<Music size={20} />}
              accent="red"
            />
          </div>

          {stats.length > 0 && (
            <div className="eg-community-grid">
              {stats.map(c => (
                <div key={c.comunidad} className="eg-community-card">
                  <div className="eg-community-name">
                    <Mic size={15} aria-hidden="true" />
                    {c.comunidad}
                  </div>
                  <div className="eg-community-row">
                    <span className="eg-community-key">Sesiones</span>
                    <span className="eg-community-val">{c.total_grabaciones ?? '—'}</span>
                  </div>
                  <div className="eg-community-row">
                    <span className="eg-community-key">Archivos</span>
                    <span className="eg-community-val">{c.total_archivos ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ── Audio List ─────────────────────────────────────────────────── */

function AudioList() {
  const [community, setCommunity] = useState<Community>('Arhuaco')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = useCallback(async (c: Community) => {
    setLoading(true)
    setError(null)
    setSessions([])
    try {
      const res = await fetch(`${API}/api/grabaciones/${c}/`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const list: Session[] = Array.isArray(data)
        ? data
        : data.sesiones ?? data.grabaciones ?? []
      setSessions(list)
    } catch {
      setError('No se pudieron cargar las sesiones. Verifica que el servidor esté activo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions(community) }, [community, fetchSessions])

  function handleCommunity(c: Community) {
    setCommunity(c)
  }

  return (
    <section className="eg-section" aria-labelledby="eg-audio-title">
      <div className="eg-section-header">
        <h2 id="eg-audio-title" className="eg-section-title">
          <FolderOpen size={18} aria-hidden="true" /> Sesiones de grabación
        </h2>
        <button
          onClick={() => fetchSessions(community)}
          className="eg-refresh-btn"
          aria-label="Actualizar listado"
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      <div className="eg-tabs" role="tablist" aria-label="Seleccionar comunidad">
        {(['Arhuaco', 'Kogui'] as Community[]).map(c => (
          <button
            key={c}
            role="tab"
            aria-selected={community === c}
            onClick={() => handleCommunity(c)}
            className={`eg-tab${community === c ? ' eg-tab--active' : ''}`}
          >
            <Mic size={14} aria-hidden="true" /> {c}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={`Sesiones de ${community}`} className="eg-tabpanel">
        {error && (
          <div className="eg-alert" role="alert">
            <AlertCircle size={16} aria-hidden="true" /> {error}
          </div>
        )}

        {loading && (
          <div className="eg-loading" aria-live="polite" aria-busy="true">
            <RefreshCw size={18} className="spin" aria-hidden="true" /> Cargando sesiones…
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="eg-empty">
            <FolderOpen size={32} aria-hidden="true" />
            <p>No se encontraron sesiones para {community}</p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <ul className="eg-session-list" aria-label={`Sesiones de ${community}`}>
            {sessions.map((s, i) => (
              <li key={s.nombre ?? i} className="eg-session-item">
                <FolderOpen size={16} className="eg-session-folder" aria-hidden="true" />
                <div className="eg-session-info">
                  <span className="eg-session-name">{s.nombre}</span>
                  {s.fecha && <span className="eg-session-meta">{s.fecha}</span>}
                </div>
                {s.total_archivos != null && (
                  <span className="eg-session-badge">{s.total_archivos} archivos</span>
                )}
                <ChevronRight size={14} className="eg-session-arrow" aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function Etiquetado() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  )

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />
  }

  return (
    <div className="eg-page">
      <div className="eg-page-header">
        <div className="container">
          <h1 className="eg-page-title">
            <Mic size={22} aria-hidden="true" /> Panel de Etiquetado
          </h1>
          <p className="eg-page-sub">Gestión y estadísticas del corpus de audio SAYTA</p>
        </div>
      </div>

      <div className="eg-page-body container">
        <StatsDashboard />
        <AudioList />
      </div>
    </div>
  )
}
