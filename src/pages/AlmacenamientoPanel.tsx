import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BarChart2, CheckCircle2, ExternalLink, HardDrive, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { apiErr, apiFetch } from '../api'

/**
 * Almacenamiento de modelos entrenados (solo administrador).
 * Permite liberar disco borrando checkpoints o modelos completos SIN perder el registro del
 * experimento ni sus estadísticas (MLflow), y abrir MLflow para revisar qué se hizo mal.
 */

interface ExpAlmacen {
  id: string; nombre: string; lengua: string; estado: string; is_active: boolean
  created_at: string; modelo_eliminado_en: string | null; bytes_liberados: number
  existe: boolean; bytes: number; checkpoints: number; bytes_liberables: number; tiene_modelo_final: boolean
  metricas: Record<string, number>
}

interface Resumen {
  raiz: string; total_bytes: number; liberable_bytes: number
  disco: { total: number; libre: number }
  experimentos: ExpAlmacen[]
  huerfanas: { carpeta: string; bytes: number }[]
}

function fmt(bytes: number): string {
  if (!bytes) return '0 MB'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = bytes
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v >= 100 || i < 2 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`
}

const ESTADO_TXT: Record<string, string> = {
  activo: 'Activo', completado: 'Completado', fallido: 'Fallido', entrenando: 'Entrenando', pendiente: 'Pendiente',
}

export default function AlmacenamientoPanel() {
  const [data, setData] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [mlflowBusy, setMlflowBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await apiFetch('/entrenamiento/almacenamiento/') as Resumen) }
    catch (e) { setError(apiErr(e, 'No se pudo calcular el almacenamiento.')) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function ejecutar(clave: string, url: string, modo: string, confirmacion: string) {
    if (!window.confirm(confirmacion)) return
    setBusy(clave); setMsg(''); setError('')
    try {
      const r = await apiFetch(url, { method: 'POST', body: JSON.stringify({ modo }) }) as { liberado_bytes: number; omitidos?: { nombre: string; motivo: string }[] }
      setMsg(`Se liberaron ${fmt(r.liberado_bytes)}. Las estadísticas se conservan.` +
        (r.omitidos?.length ? ` Se omitieron ${r.omitidos.length}: ${r.omitidos.map(o => `${o.nombre} (${o.motivo})`).join('; ')}` : ''))
      await load()
    } catch (e) { setError(apiErr(e, 'No se pudo completar la limpieza.')) }
    finally { setBusy(null) }
  }

  async function abrirMlflow() {
    setMlflowBusy(true); setError('')
    try {
      await apiFetch('/entrenamiento/mlflow/acceso/', { method: 'POST', body: '{}' })
      window.open('/mlflow/', '_blank', 'noopener')
    } catch (e) { setError(apiErr(e, 'No se pudo abrir MLflow.')) }
    finally { setMlflowBusy(false) }
  }

  const nuncaVisto = (e: ExpAlmacen) => e.existe && e.bytes > 0

  return (
    <div className="ent-monitor-box" style={{ marginBottom: 20 }}>
      <div className="ent-monitor-box-head">
        <span className="ent-subsection-title"><HardDrive size={13} /> Almacenamiento de modelos (administrador)</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="ent-btn ent-btn--ghost ent-btn--sm" onClick={abrirMlflow} disabled={mlflowBusy} type="button"
            title="Abre MLflow con las métricas de todos los entrenamientos">
            {mlflowBusy ? <Loader2 size={13} className="spin" /> : <BarChart2 size={13} />} Abrir MLflow <ExternalLink size={11} />
          </button>
          <button className="ent-btn ent-btn--ghost ent-btn--sm" onClick={load} disabled={loading} type="button" aria-label="Recalcular">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="tc-api-error" style={{ marginBottom: 10 }}><AlertTriangle size={14} /><span>{error}</span></div>}
      {msg && <div className="ent-hint" style={{ color: '#15803d', fontWeight: 600, marginBottom: 10 }}><CheckCircle2 size={13} style={{ verticalAlign: 'middle' }} /> {msg}</div>}

      {loading && !data && <div className="ent-loading"><Loader2 size={18} className="spin" /> Calculando el tamaño de cada experimento… (puede tardar unos segundos)</div>}

      {data && (
        <>
          <p className="ent-hint" style={{ marginBottom: 10 }}>
            Los modelos ocupan <strong>{fmt(data.total_bytes)}</strong>; <strong>{fmt(data.liberable_bytes)}</strong> son checkpoints
            y archivos temporales que se pueden borrar sin tocar los modelos finales. Disco libre: {fmt(data.disco.libre)} de {fmt(data.disco.total)}.
            Borrar archivos <strong>nunca</strong> elimina el experimento ni sus estadísticas (MLflow).
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="ent-btn ent-btn--primary ent-btn--sm" type="button" disabled={!!busy || data.liberable_bytes === 0}
              onClick={() => ejecutar('masivo-ckpt', '/entrenamiento/almacenamiento/limpiar/', 'checkpoints',
                `¿Borrar los checkpoints y archivos temporales de TODOS los experimentos?\n\nSe liberan ${fmt(data.liberable_bytes)}. Los modelos finales y las estadísticas se conservan.`)}>
              {busy === 'masivo-ckpt' ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Liberar checkpoints de todos ({fmt(data.liberable_bytes)})
            </button>
            <button className="ent-btn ent-btn--danger ent-btn--sm" type="button" disabled={!!busy}
              onClick={() => ejecutar('masivo-fallidos', '/entrenamiento/almacenamiento/limpiar/', 'fallidos',
                '¿Borrar los archivos de TODOS los experimentos fallidos?\n\nNo tienen modelo utilizable. Se conserva su registro y sus estadísticas para analizar qué falló.')}>
              {busy === 'masivo-fallidos' ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Borrar archivos de fallidos
            </button>
            {data.huerfanas.length > 0 && (
              <button className="ent-btn ent-btn--danger ent-btn--sm" type="button" disabled={!!busy}
                onClick={() => ejecutar('masivo-huerf', '/entrenamiento/almacenamiento/limpiar/', 'huerfanas',
                  `¿Borrar ${data.huerfanas.length} carpeta(s) que no pertenecen a ningún experimento (${fmt(data.huerfanas.reduce((s, h) => s + h.bytes, 0))})?`)}>
                {busy === 'masivo-huerf' ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Borrar carpetas sin experimento
              </button>
            )}
          </div>

          <div className="ent-table-wrap">
            <table className="ent-table ent-table--sm">
              <thead>
                <tr><th>Experimento</th><th>Lengua</th><th>Estado</th><th>Ocupa</th><th>Checkpoints</th><th>Modelo final</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {data.experimentos.map(e => (
                  <tr key={e.id}>
                    <td><strong>{e.nombre}</strong><div className="ent-hint">{new Date(e.created_at).toLocaleDateString('es-CO')}</div></td>
                    <td>{e.lengua}</td>
                    <td><span className={`ent-badge ${e.is_active ? 'ent-badge--ok' : ''}`}>{ESTADO_TXT[e.estado] ?? e.estado}</span></td>
                    <td>
                      {e.modelo_eliminado_en
                        ? <span className="ent-hint">Eliminado ({fmt(e.bytes_liberados)} liberados)</span>
                        : nuncaVisto(e) ? fmt(e.bytes) : <span className="ent-hint">—</span>}
                    </td>
                    <td>{e.checkpoints > 0 ? `${e.checkpoints} · ${fmt(e.bytes_liberables)}` : '—'}</td>
                    <td>{e.modelo_eliminado_en ? 'Eliminado' : e.tiene_modelo_final ? 'Sí' : 'No'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="ent-btn ent-btn--ghost ent-btn--sm" type="button" disabled={!!busy || e.bytes_liberables === 0 || e.estado === 'entrenando'}
                          onClick={() => ejecutar(`c-${e.id}`, `/entrenamiento/experimentos/${e.id}/limpiar/`, 'checkpoints',
                            `¿Borrar los checkpoints de "${e.nombre}" (${fmt(e.bytes_liberables)})?\nSe conserva el modelo final y las estadísticas.`)}>
                          {busy === `c-${e.id}` ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />} Checkpoints
                        </button>
                        <button className="ent-btn ent-btn--danger ent-btn--sm" type="button"
                          disabled={!!busy || e.is_active || e.estado === 'activo' || e.estado === 'entrenando' || !!e.modelo_eliminado_en || !e.existe}
                          title={e.is_active ? 'Es el modelo activo de su lengua: activa otro antes de borrarlo' : undefined}
                          onClick={() => ejecutar(`m-${e.id}`, `/entrenamiento/experimentos/${e.id}/limpiar/`, 'modelo',
                            `¿Borrar TODO el modelo de "${e.nombre}" (${fmt(e.bytes)})?\n\nSe elimina el modelo y sus checkpoints. El experimento y sus estadísticas (MLflow) se conservan, pero ya no se podrá activar ni usar para transcribir.`)}>
                          {busy === `m-${e.id}` ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />} Modelo completo
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.huerfanas.length > 0 && (
            <p className="ent-hint" style={{ marginTop: 8 }}>
              Carpetas sin experimento en la base de datos: {data.huerfanas.map(h => `${h.carpeta.slice(0, 8)}… (${fmt(h.bytes)})`).join(', ')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
