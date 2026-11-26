import { useCallback, useEffect, useState } from 'react'
import { Check, X, Loader2, RefreshCw, AlertTriangle, MessageSquareWarning, FlaskConical, BarChart3, History, ListPlus } from 'lucide-react'
import { apiErr, apiFetch } from '../api'

interface Correccion {
  id: string; tipo: string; veredicto: string; aplicada: boolean
  lengua: { id: number; codigo: string; nombre: string }
  termino: { id: number; termino: string; termino_es: string; definicion: string; tipo_morfema: string | null } | null
  direccion: string; texto_origen: string; propuesta_sistema: string; correccion: string
  es_correcta: boolean | null; comentario: string; usuario: string; creado_en: string
}
interface Hipotesis { id: number; lengua: string; termino: string; termino_es: string; definicion: string; pos: string; con_validacion_pendiente: boolean }
interface CambioGlosario { id: number; termino_id: number | null; termino: string; lengua: string; accion: string; cambios: Record<string, { antes: unknown; despues: unknown }>; usuario: string; origen: string; creado_en: string }
interface Estadisticas {
  dias: number; total_consultas: number; pct_en_glosario: number | null; pct_usuario_cambio_opcion: number | null
  por_lengua_direccion: { lengua__codigo: string; lengua__nombre: string; direccion: string; n: number; en_glosario: number }[]
  por_fuente: { fuente: string; n: number }[]
  por_estado_verificacion: { verificacion_estado: string; n: number }[]
  sin_coincidencia_frecuentes: { texto: string; lengua: string; direccion: string; veces: number }[]
  correcciones: { pendiente: number; aprobada: number; rechazada: number }
  hipotesis_sin_validar: number
  faltantes_pendientes?: number
  corpus_paralelo?: { total: number; por_comunidad: Record<string, number>; meta: number }
}
interface Faltante { id: number; lengua: string; lengua_nombre: string; direccion: string; texto: string; ejemplo_frase: string; veces: number; estado: string; nota: string; ultima_vez: string }

const LENGUA_NOMBRE: Record<string, string> = { '1': 'Ikʉn', Kogui: 'Kogui' }
const DIR_TXT: Record<string, string> = { es_a_lengua: 'español → lengua', lengua_a_es: 'lengua → español' }

export default function ValidacionTab({ canEdit }: { canEdit: boolean }) {
  const [stats, setStats] = useState<Estadisticas | null>(null)
  const [pend, setPend] = useState<Correccion[]>([])
  const [hip, setHip] = useState<Hipotesis[]>([])
  const [falt, setFalt] = useState<Faltante[]>([])
  const [cambios, setCambios] = useState<CambioGlosario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [edits, setEdits] = useState<Record<string, { termino?: string; termino_es?: string; nota?: string }>>({})
  const [corrHip, setCorrHip] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [s, c, h, g] = await Promise.all([
        apiFetch('/traduccion/estadisticas/?dias=30'),
        apiFetch('/traduccion/correcciones/?veredicto=pendiente&limite=200'),
        apiFetch('/traduccion/pendientes-validacion/'),
        apiFetch('/traduccion/historial-glosario/?limite=60').catch(() => ({ resultados: [] })),
      ])
      setCambios((g as { resultados: CambioGlosario[] }).resultados ?? [])
      setStats(s as Estadisticas)
      setPend((c as { resultados: Correccion[] }).resultados)
      setHip((h as { hipotesis: Hipotesis[] }).hipotesis)
      setFalt((h as { faltantes?: Faltante[] }).faltantes ?? [])
    } catch (e) { setError(apiErr(e, 'No se pudo cargar la validación.')) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const descartarFaltante = async (f: Faltante) => {
    setBusy(`f${f.id}`); setMsg('')
    try {
      await apiFetch(`/traduccion/faltantes/${f.id}/`, { method: 'PATCH', body: JSON.stringify({ estado: 'descartado' }) })
      setFalt(x => x.filter(y => y.id !== f.id)); setMsg(`«${f.texto}» descartado de la lista de recolección.`)
    } catch (e) { setMsg(apiErr(e, 'No se pudo descartar.')) }
    finally { setBusy(null) }
  }

  const revisar = async (c: Correccion, veredicto: 'aprobada' | 'rechazada') => {
    setBusy(c.id); setMsg('')
    try {
      const e = edits[c.id] ?? {}
      const r = await apiFetch(`/traduccion/correcciones/${c.id}/revisar/`, {
        method: 'POST', body: JSON.stringify({ veredicto, aplicar: veredicto === 'aprobada' || c.tipo === 'validacion_hipotesis', ...e }),
      }) as { detalle?: { accion?: string } }
      setMsg(veredicto === 'aprobada'
        ? `Aprobada${r.detalle?.accion ? ` · ${r.detalle.accion.replace('_', ' ')}` : ''}.`
        : 'Rechazada.')
      await load()
    } catch (e) { setMsg(apiErr(e, 'No se pudo revisar.')) }
    finally { setBusy(null) }
  }

  const validarHipotesis = async (h: Hipotesis, esCorrecta: boolean) => {
    setBusy(String(h.id)); setMsg('')
    try {
      const lenguaId = h.lengua === '1' ? 1 : 2
      const creada = await apiFetch('/traduccion/correcciones/', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'validacion_hipotesis', lengua_id: lenguaId, termino_id: h.id, direccion: 'lengua_a_es',
          texto_origen: h.termino, propuesta_sistema: h.termino_es, es_correcta: esCorrecta, correccion: corrHip[h.id] ?? '',
        }),
      }) as Correccion
      if (canEdit) {
        await apiFetch(`/traduccion/correcciones/${creada.id}/revisar/`, {
          method: 'POST', body: JSON.stringify({ veredicto: esCorrecta || corrHip[h.id] ? 'aprobada' : 'rechazada', aplicar: true }),
        })
        setMsg(esCorrecta || corrHip[h.id] ? `«${h.termino}» validado: deja de ser hipótesis.` : `«${h.termino}» marcado como incorrecto y desactivado.`)
      } else {
        setMsg('Gracias: tu validación quedó pendiente de revisión.')
      }
      await load()
    } catch (e) { setMsg(apiErr(e, 'No se pudo validar.')) }
    finally { setBusy(null) }
  }

  if (loading) return <div className="gl-loading" style={{ marginTop: 30 }}><Loader2 size={20} className="spin" /> Cargando…</div>
  if (error) return <div className="gl-error" role="alert"><AlertTriangle size={16} /> {error} <button className="gl-btn gl-btn--ghost" onClick={load}>Reintentar</button></div>

  return (
    <div className="val-wrap">
      {msg && <p className="val-msg" role="status">{msg}</p>}

      <section className="gl-card val-sec" aria-labelledby="val-stats">
        <div className="val-sec-head">
          <h2 id="val-stats"><BarChart3 size={18} aria-hidden="true" /> Uso del traductor (últimos {stats?.dias} días)</h2>
          <button className="gl-btn gl-btn--ghost" onClick={load} aria-label="Actualizar"><RefreshCw size={14} /></button>
        </div>
        {stats && (
          <>
            <div className="val-kpis">
              <div className="val-kpi"><b>{stats.total_consultas}</b><span>consultas</span></div>
              <div className="val-kpi"><b>{stats.pct_en_glosario ?? '—'}{stats.pct_en_glosario != null && '%'}</b><span>con coincidencia en glosario</span></div>
              <div className="val-kpi"><b>{stats.pct_usuario_cambio_opcion ?? '—'}{stats.pct_usuario_cambio_opcion != null && '%'}</b><span>el usuario eligió otra opción</span></div>
              <div className="val-kpi"><b>{stats.correcciones.pendiente}</b><span>correcciones pendientes</span></div>
              <div className="val-kpi"><b>{stats.hipotesis_sin_validar}</b><span>hipótesis sin validar</span></div>
              <div className="val-kpi"><b>{stats.faltantes_pendientes ?? 0}</b><span>palabras que faltan en el glosario</span></div>
            </div>
            {stats.corpus_paralelo && (
              <div className="val-paralelo" title="Audios etiquetados que además tienen traducción al español (pestaña Etiquetado). Es la base para un traductor de oraciones completas.">
                <span>Corpus paralelo lengua ↔ español: <b>{stats.corpus_paralelo.total}</b> / {stats.corpus_paralelo.meta} frases</span>
                <div className="val-paralelo-bar" aria-hidden="true"><div style={{ width: `${Math.min(100, 100 * stats.corpus_paralelo.total / stats.corpus_paralelo.meta)}%` }} /></div>
                {Object.entries(stats.corpus_paralelo.por_comunidad).map(([c, n]) => <span key={c} className="gl-badge gl-badge--soft">{c}: {n}</span>)}
              </div>
            )}
            {stats.sin_coincidencia_frecuentes.length > 0 ? (
              <>
                <h3>Lo que más se consulta y no está en el glosario</h3>
                <p className="gl-help">Esta es la lista de recolección para la próxima jornada de campo.</p>
                <table className="gl-table val-table">
                  <thead><tr><th>Texto consultado</th><th>Lengua</th><th>Dirección</th><th>Veces</th></tr></thead>
                  <tbody>{stats.sin_coincidencia_frecuentes.map((s, i) => (
                    <tr key={i}><td>{s.texto}</td><td>{LENGUA_NOMBRE[s.lengua] ?? s.lengua}</td><td>{DIR_TXT[s.direccion] ?? s.direccion}</td><td>{s.veces}</td></tr>
                  ))}</tbody>
                </table>
              </>
            ) : <p className="gl-help">Todavía no hay consultas sin coincidencia registradas.</p>}
          </>
        )}
      </section>

      <section className="gl-card val-sec" aria-labelledby="val-corr">
        <h2 id="val-corr"><MessageSquareWarning size={18} aria-hidden="true" /> Correcciones propuestas por usuarios ({pend.length})</h2>
        {pend.length === 0 ? <p className="gl-help">No hay correcciones pendientes.</p> : pend.map(c => (
          <article key={c.id} className="val-item">
            <div className="val-item-head">
              <span className="gl-badge">{c.tipo === 'correccion' ? 'Corrección' : c.tipo === 'validacion_compuesta' ? 'Traducción compuesta' : 'Hipótesis'}</span>
              <span className="gl-badge gl-badge--soft">{c.lengua.nombre} · {DIR_TXT[c.direccion] ?? c.direccion}</span>
              <span className="val-item-meta">{c.usuario || 'usuario'} · {new Date(c.creado_en).toLocaleString('es-CO')}</span>
            </div>
            <dl className="val-dl">
              <dt>Texto</dt><dd>{c.texto_origen}</dd>
              <dt>El sistema dijo</dt><dd>{c.propuesta_sistema || '—'}</dd>
              {c.es_correcta != null && <><dt>Veredicto del usuario</dt><dd>{c.es_correcta ? 'correcta' : 'incorrecta'}</dd></>}
              {c.correccion && <><dt>Debe ser</dt><dd><b>{c.correccion}</b></dd></>}
              {c.comentario && <><dt>Comentario</dt><dd>{c.comentario}</dd></>}
            </dl>
            {canEdit && (
              <div className="val-actions">
                {c.tipo !== 'validacion_hipotesis' && (
                  <div className="val-edit">
                    <label>Término en lengua <input className="gl-input" defaultValue={c.direccion === 'es_a_lengua' ? c.correccion : c.texto_origen}
                      onChange={e => setEdits(x => ({ ...x, [c.id]: { ...x[c.id], termino: e.target.value } }))} /></label>
                    <label>Español <input className="gl-input" defaultValue={c.direccion === 'es_a_lengua' ? c.texto_origen : c.correccion}
                      onChange={e => setEdits(x => ({ ...x, [c.id]: { ...x[c.id], termino_es: e.target.value } }))} /></label>
                  </div>
                )}
                <button className="gl-btn gl-btn--primary" disabled={busy === c.id} onClick={() => revisar(c, 'aprobada')}><Check size={14} /> Aprobar y aplicar al glosario</button>
                <button className="gl-btn gl-btn--ghost" disabled={busy === c.id} onClick={() => revisar(c, 'rechazada')}><X size={14} /> Rechazar</button>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="gl-card val-sec" aria-labelledby="val-falt">
        <h2 id="val-falt"><ListPlus size={18} aria-hidden="true" /> Palabras que la gente pide y no están en el glosario ({falt.length})</h2>
        <p className="gl-help">Huecos de frases que el traductor armó por piezas. Cuando un hablante aporta el término (pestaña Glosario → agregar), la frase sale completa y el pendiente se cierra solo.</p>
        {falt.length === 0 ? <p className="gl-help">No hay palabras faltantes registradas.</p> : (
          <table className="gl-table val-table">
            <thead><tr><th>Palabra</th><th>Lengua</th><th>Veces</th><th>Ejemplo de frase</th>{canEdit && <th></th>}</tr></thead>
            <tbody>{falt.map(f => (
              <tr key={f.id}>
                <td><b>{f.texto}</b></td>
                <td>{LENGUA_NOMBRE[f.lengua] ?? f.lengua_nombre}</td>
                <td>{f.veces}</td>
                <td className="val-falt-frase">{f.ejemplo_frase}</td>
                {canEdit && <td className="val-td-actions"><button className="gl-btn gl-btn--ghost gl-btn--sm" disabled={busy === `f${f.id}`} onClick={() => descartarFaltante(f)} title="No es vocabulario que haga falta (descartar)"><X size={14} /></button></td>}
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="gl-card val-sec" aria-labelledby="val-hip">
        <h2 id="val-hip"><FlaskConical size={18} aria-hidden="true" /> Hipótesis por validar con hablantes ({hip.length})</h2>
        <p className="gl-help">Términos deducidos del análisis de frases. Un hablante confirma, corrige el español o los descarta.</p>
        {hip.length === 0 ? <p className="gl-help">No quedan hipótesis pendientes.</p> : (
          <table className="gl-table val-table">
            <thead><tr><th>Lengua</th><th>Término</th><th>Significado propuesto</th><th>Corrección (opcional)</th><th>Validar</th></tr></thead>
            <tbody>{hip.map(h => (
              <tr key={h.id}>
                <td>{LENGUA_NOMBRE[h.lengua] ?? h.lengua}</td>
                <td><b>{h.termino}</b></td>
                <td>{h.termino_es}</td>
                <td><input className="gl-input" placeholder="si el español correcto es otro…" aria-label={`Corrección para ${h.termino}`}
                  value={corrHip[h.id] ?? ''} onChange={e => setCorrHip(x => ({ ...x, [h.id]: e.target.value }))} /></td>
                <td className="val-td-actions">
                  <button className="gl-btn gl-btn--primary gl-btn--sm" disabled={busy === String(h.id)} onClick={() => validarHipotesis(h, true)} title="Correcta"><Check size={14} /></button>
                  <button className="gl-btn gl-btn--ghost gl-btn--sm" disabled={busy === String(h.id)} onClick={() => validarHipotesis(h, false)} title="Incorrecta"><X size={14} /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <section className="gl-card val-sec" aria-labelledby="val-hist">
        <h2 id="val-hist"><History size={18} aria-hidden="true" /> Últimos cambios del glosario</h2>
        {cambios.length === 0 ? <p className="gl-help">Aún no hay cambios registrados (el historial empieza a contar desde el 25/11/2026).</p> : (
          <table className="gl-table val-table">
            <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Término</th><th>Cambios</th></tr></thead>
            <tbody>{cambios.map(c => (
              <tr key={c.id}>
                <td>{new Date(c.creado_en).toLocaleString('es-CO')}</td>
                <td>{c.usuario}{c.origen && c.origen !== 'api' ? ` (${c.origen})` : ''}</td>
                <td><span className="gl-badge gl-badge--soft">{c.accion}</span></td>
                <td><b>{c.termino}</b> <small>{LENGUA_NOMBRE[c.lengua] ?? c.lengua}</small></td>
                <td className="val-cambios">{Object.entries(c.cambios).filter(([k]) => k !== 'termino_es_id').map(([k, v]) => (
                  <div key={k}><span className="val-campo">{k}:</span> {c.accion === 'crear' ? String(v.despues ?? '') : <><s>{String(v.antes ?? '—')}</s> → {String(v.despues ?? '—')}</>}</div>
                ))}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  )
}
