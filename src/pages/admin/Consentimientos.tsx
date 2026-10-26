import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Download, FileSignature, Loader2, RefreshCw, Search, X, Eye, Trash2 } from 'lucide-react'
import { TOKEN_KEY } from '../../api'

/**
 * Consentimientos informados firmados (solo administradores).
 * Los datos viven en el módulo «consentimientos» (toma abierta con QR); aquí solo se consultan,
 * usando la misma sesión de SAYTA. El servidor valida que quien consulta sea administrador.
 */

const BASE = '/consentimientos/api/sayta'

interface Fila {
  id: number; codigo: string; plantilla: string; plantilla_nombre: string; estado: 'pendiente' | 'firmado' | 'cancelado'
  participante_nombre: string; tipo_doc: string | null; doc: string; comunidad: string | null
  creado_en: string; firmado_en: string | null; expirado: boolean; tiene_foto: boolean; tiene_firma: boolean
}

interface Detalle extends Fila {
  proyecto: string | null; unidad: string | null; responsable: string | null; responsable_cargo: string | null; lugar: string | null
  resguardo: string | null; edad: string | null; telefono: string | null; interprete: string | null
  datos_autorizados: string[]; usos_autorizados: string[]; otros_datos: string | null; otros_usos: string | null
  hash_documento: string | null; agente_firma: string | null; trazos: number
  eventos: { accion: string; usuario: string | null; creado_en: string }[]
}

interface Bloque { t: 'h' | 'p' | 'li' | 'kv' | 'tabla'; x?: string; k?: string; v?: string }
interface Documento {
  codigo: string; titulo: string; participante: string; firmado_txt: string; bloques: Bloque[]; datos: string[]; usos: string[]
  sel_datos: string[]; sel_usos: string[]; otros_datos: string; otros_usos: string; hash: string
}

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem(TOKEN_KEY)
  return t ? { Authorization: `Token ${t}`, Accept: 'application/json' } : {}
}

async function pedir(ruta: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${BASE}/${ruta}`, { ...init, headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) } })
  if (!r.ok) {
    const d = await r.json().catch(() => ({})) as { detail?: string }
    throw new Error(typeof d.detail === 'string' ? d.detail : `Error ${r.status}`)
  }
  return r
}

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }) : '—'

function Estado({ f }: { f: Fila }) {
  if (f.estado === 'firmado') return <span className="gl-badge gl-badge--green">Firmado</span>
  if (f.estado === 'cancelado') return <span className="gl-badge gl-badge--gray">Cancelado</span>
  return f.expirado ? <span className="gl-badge gl-badge--red">Enlace vencido</span> : <span className="gl-badge gl-badge--yellow">Pendiente de firma</span>
}

function useBlobUrl(ruta: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!ruta) { setUrl(null); return }
    let activo = true, objeto: string | null = null
    pedir(ruta).then(r => r.blob()).then(b => { if (activo) { objeto = URL.createObjectURL(b); setUrl(objeto) } }).catch(() => {})
    return () => { activo = false; if (objeto) URL.revokeObjectURL(objeto) }
  }, [ruta])
  return url
}

function DocumentoFirmado({ d, firmaUrl }: { d: Documento; firmaUrl: string | null }) {
  const marca = (lista: string[], marcados: string[], otros: string) => (
    <div>
      {lista.map(t => (
        <div key={t} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: '.9rem' }}>
          <strong style={{ color: marcados.includes(t) ? '#15803d' : '#9ca3af' }}>{marcados.includes(t) ? '☑' : '☐'}</strong><span>{t}</span>
        </div>
      ))}
      {otros && <div style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: '.9rem' }}><strong style={{ color: '#15803d' }}>☑</strong><span>Otros: {otros}</span></div>}
    </div>
  )
  const filas: React.ReactNode[] = []
  let items: string[] = []
  const volcar = (clave: string) => { if (items.length) { filas.push(<ul key={`ul${clave}`} style={{ margin: '6px 0', paddingLeft: 20 }}>{items.map((x, i) => <li key={i} style={{ margin: '4px 0' }}>{x}</li>)}</ul>); items = [] } }
  d.bloques.forEach((b, i) => {
    if (b.t !== 'li') volcar(String(i))
    if (b.t === 'h') filas.push(<h4 key={i} style={{ margin: '14px 0 4px', color: 'var(--blue, #0f5a8a)' }}>{b.x}</h4>)
    else if (b.t === 'p') filas.push(<p key={i} style={{ margin: '6px 0' }}>{b.x}</p>)
    else if (b.t === 'kv') filas.push(<p key={i} style={{ margin: '6px 0' }}><strong>{b.k}:</strong> {b.v}</p>)
    else if (b.t === 'li') items.push(b.x ?? '')
    else if (b.t === 'tabla' && d.datos.length) {
      filas.push(<div key={i} style={{ marginTop: 8 }}><h4 style={{ margin: '8px 0 4px' }}>Datos autorizados</h4>{marca(d.datos, d.sel_datos, d.otros_datos)}
        <h4 style={{ margin: '12px 0 4px' }}>Usos autorizados</h4>{marca(d.usos, d.sel_usos, d.otros_usos)}</div>)
    }
  })
  volcar('fin')
  return (
    <div style={{ fontSize: '.93rem', lineHeight: 1.5 }}>
      <p style={{ textAlign: 'center', fontWeight: 700 }}>{d.titulo}</p>
      <p style={{ textAlign: 'center', fontSize: '.8rem', opacity: .7 }}>Consentimiento {d.codigo}</p>
      {filas}
      <h4 style={{ margin: '16px 0 4px' }}>Firma</h4>
      {firmaUrl && <img src={firmaUrl} alt="Firma" style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, maxWidth: '100%', maxHeight: 150, display: 'block' }} />}
      <p style={{ marginTop: 6 }}><strong>{d.participante}</strong><br />Aceptó el {d.firmado_txt}.</p>
      <p style={{ fontSize: '.75rem', opacity: .7, wordBreak: 'break-all' }}>Huella SHA-256: {d.hash}</p>
    </div>
  )
}

const AVISO_BORRAR = 'Se eliminará DEFINITIVAMENTE el consentimiento con su foto, firma y datos personales. Solo quedará constancia del código y de quién lo borró. Esta acción no se puede deshacer.'

function DetalleModal({ id, onClose, onBorrado }: { id: number; onClose: () => void; onBorrado: () => void }) {
  const [d, setD] = useState<Detalle | null>(null)
  const [doc, setDoc] = useState<Documento | null>(null)
  const [verDoc, setVerDoc] = useState(false)
  const [error, setError] = useState('')
  const [descargando, setDescargando] = useState(false)
  const firma = useBlobUrl(d?.tiene_firma ? `consentimientos/${id}/firma` : null)
  const foto = useBlobUrl(d?.tiene_foto ? `consentimientos/${id}/foto` : null)

  useEffect(() => {
    pedir(`consentimientos/${id}`).then(r => r.json()).then(setD).catch(e => setError(e.message))
  }, [id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const borrar = async () => {
    if (!d || !window.confirm(`¿Eliminar el consentimiento ${d.codigo} de ${d.participante_nombre}?\n\n${AVISO_BORRAR}`)) return
    setError('')
    try { await pedir(`consentimientos/${id}`, { method: 'DELETE' }); onBorrado() } catch (e) { setError((e as Error).message) }
  }

  const mostrarDocumento = async () => {
    setError('')
    try { setDoc(await (await pedir(`consentimientos/${id}/documento`)).json()); setVerDoc(true) } catch (e) { setError((e as Error).message) }
  }

  const bajarPdf = async () => {
    setDescargando(true); setError('')
    try {
      const r = await pedir(`consentimientos/${id}/pdf`)
      const b = await r.blob(); const m = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = m?.[1] ?? 'consentimiento.pdf'
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch (e) { setError((e as Error).message) } finally { setDescargando(false) }
  }

  const kv = (k: string, v: string | null | undefined) => (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 8, padding: '3px 0', fontSize: '.9rem' }}><span style={{ opacity: .65 }}>{k}</span><span>{v || '—'}</span></div>
  )

  return (
    <div className="gl-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Detalle del consentimiento">
      <div className="gl-modal" style={{ maxWidth: 820 }} onClick={e => e.stopPropagation()}>
        <div className="gl-modal-header">
          <h2 className="gl-modal-title"><FileSignature size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} />{d ? d.participante_nombre : 'Consentimiento'}</h2>
          <button className="gl-modal-close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="gl-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {error && <div className="gl-alert"><AlertCircle size={16} />{error}</div>}
          {!d && !error && <div className="gl-loading"><Loader2 size={18} className="spin" /> Cargando…</div>}
          {d && !verDoc && (
            <>
              {kv('Código', d.codigo)}{kv('Formato', d.plantilla_nombre)}{kv('Estado', d.estado === 'firmado' ? 'Firmado' : d.estado === 'cancelado' ? 'Cancelado' : 'Pendiente de firma')}
              {kv('Persona', d.participante_nombre)}{kv('Documento', `${d.tipo_doc ?? ''} ${d.doc}`.trim())}{kv('Comunidad', d.comunidad)}
              {kv('Resguardo, vereda o sector', d.resguardo)}{kv('Edad', d.edad)}{kv('Teléfono', d.telefono)}
              {kv('Proyecto', d.proyecto)}{kv('Unidad gestora', d.unidad)}{kv('Responsable', d.responsable ? `${d.responsable}${d.responsable_cargo ? ` · ${d.responsable_cargo}` : ''}` : null)}
              {kv('Lugar', d.lugar)}{kv('Intérprete o facilitador', d.interprete)}{kv('Creado', fechaCorta(d.creado_en))}
              {d.estado === 'firmado' && (
                <>
                  {kv('Firmado el', fechaCorta(d.firmado_en))}
                  {kv('Datos autorizados', d.datos_autorizados.join('; ') + (d.otros_datos ? `; Otros: ${d.otros_datos}` : ''))}
                  {kv('Usos autorizados', d.usos_autorizados.join('; ') + (d.otros_usos ? `; Otros: ${d.otros_usos}` : ''))}
                  {kv('Trazos de la firma', String(d.trazos))}{kv('Huella SHA-256', d.hash_documento)}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
                    {foto && <div><div style={{ fontSize: '.8rem', opacity: .65 }}>Foto</div><img src={foto} alt="Foto de la persona" style={{ maxWidth: 200, borderRadius: 10, border: '1px solid #ddd' }} /></div>}
                    {firma && <div><div style={{ fontSize: '.8rem', opacity: .65 }}>Firma</div><img src={firma} alt="Firma" style={{ background: '#fff', maxWidth: 320, maxHeight: 140, borderRadius: 8, border: '1px solid #ddd' }} /></div>}
                  </div>
                </>
              )}
              {d.eventos?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem' }}>Registro</div>
                  {d.eventos.map((e, i) => <div key={i} style={{ fontSize: '.8rem', opacity: .75 }}>{fechaCorta(e.creado_en)} · {e.accion}{e.usuario ? ` · ${e.usuario}` : ''}</div>)}
                </div>
              )}
            </>
          )}
          {verDoc && doc && <DocumentoFirmado d={doc} firmaUrl={firma} />}
        </div>
        <div className="gl-modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', padding: '12px 16px' }}>
          {d?.estado === 'firmado' && !verDoc && <button className="eg-btn eg-btn--ghost" onClick={mostrarDocumento}><Eye size={14} /> Ver documento</button>}
          {verDoc && <button className="eg-btn eg-btn--ghost" onClick={() => setVerDoc(false)}>Volver a los datos</button>}
          {d?.estado === 'firmado' && <button className="eg-btn eg-btn--primary" onClick={bajarPdf} disabled={descargando}>{descargando ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Descargar PDF</button>}
          {d && <button className="eg-btn eg-btn--ghost" style={{ color: '#c0392b' }} onClick={borrar}><Trash2 size={14} /> Eliminar</button>}
          <button className="eg-btn eg-btn--ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export default function Consentimientos() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [resumen, setResumen] = useState<{ total: number; firmados: number; pendientes: number; cancelados: number } | null>(null)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [formato, setFormato] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState<number | null>(null)

  const borrarFila = async (f: Fila) => {
    if (!window.confirm(`¿Eliminar el consentimiento ${f.codigo} de ${f.participante_nombre}?\n\n${AVISO_BORRAR}`)) return
    try { await pedir(`consentimientos/${f.id}`, { method: 'DELETE' }); await cargar() } catch (e) { setError((e as Error).message) }
  }

  const cargar = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const p = new URLSearchParams({ q, estado, plantilla: formato })
      const [lista, res] = await Promise.all([pedir(`consentimientos?${p}`).then(r => r.json()), pedir('resumen').then(r => r.json())])
      setFilas(lista as Fila[]); setResumen(res)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [q, estado, formato])

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t) }, [cargar])

  return (
    <div className="gl-page">
      <div className="gl-page-header">
        <div>
          <h1 className="gl-page-title"><FileSignature size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Consentimientos informados</h1>
          <p className="gl-page-sub">Consentimientos tomados con el código QR. Solo los administradores pueden consultarlos.</p>
        </div>
      </div>

      <div className="gl-tab-content">
        {resumen && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {[['Total', resumen.total], ['Firmados', resumen.firmados], ['Pendientes de firma', resumen.pendientes], ['Cancelados', resumen.cancelados]].map(([t, n]) => (
              <div key={String(t)} className="gl-card" style={{ padding: '10px 16px', minWidth: 130 }}><div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{n}</div><div style={{ fontSize: '.8rem', opacity: .7 }}>{t}</div></div>
            ))}
          </div>
        )}
        <div className="gl-toolbar gl-toolbar--wrap">
          <div className="gl-search-wrap">
            <Search size={15} className="gl-search-icon" />
            <input className="gl-search-input" placeholder="Buscar por nombre, documento, comunidad o código…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="gl-select gl-select--sm" value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Todos los estados</option><option value="firmado">Firmados</option><option value="pendiente">Pendientes</option><option value="cancelado">Cancelados</option>
          </select>
          <select className="gl-select gl-select--sm" value={formato} onChange={e => setFormato(e.target.value)}>
            <option value="">Todos los formatos</option><option value="arhuaco">Arhuaco (IKU)</option><option value="kogui">Kogui (Kaggaba)</option><option value="grabaciones">Participación en grabaciones</option>
          </select>
          <button className="eg-btn eg-btn--ghost" onClick={cargar} disabled={loading}><RefreshCw size={13} className={loading ? 'spin' : ''} /> Actualizar</button>
        </div>

        {error && <div className="gl-alert"><AlertCircle size={16} />{error}</div>}
        {loading && filas.length === 0 && !error ? (
          <div className="gl-loading"><Loader2 size={20} className="spin" /> Cargando…</div>
        ) : filas.length === 0 && !error ? (
          <div className="gl-empty"><FileSignature size={32} /><p>Todavía no hay consentimientos con ese filtro.</p></div>
        ) : (
          <div className="gl-table-wrap">
            <table className="gl-table">
              <thead><tr><th>Código</th><th>Persona</th><th>Comunidad</th><th>Formato</th><th>Estado</th><th>Fecha</th><th /></tr></thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => setAbierto(f.id)}>
                    <td className="gl-td-bold">{f.codigo}</td>
                    <td>{f.participante_nombre}<div className="gl-td-gray">{f.tipo_doc ? `${f.tipo_doc} ` : ''}{f.doc}</div></td>
                    <td>{f.comunidad || '—'}</td>
                    <td className="gl-td-gray">{f.plantilla_nombre}</td>
                    <td><Estado f={f} /></td>
                    <td className="gl-td-gray">{fechaCorta(f.firmado_en ?? f.creado_en)}</td>
                    <td><button className="eg-btn eg-btn--ghost" onClick={e => { e.stopPropagation(); setAbierto(f.id) }}><Eye size={13} /> Ver</button> <button className="eg-btn eg-btn--ghost" style={{ color: '#c0392b' }} title="Eliminar" onClick={e => { e.stopPropagation(); borrarFila(f) }}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {abierto !== null && <DetalleModal id={abierto} onClose={() => setAbierto(null)} onBorrado={() => { setAbierto(null); cargar() }} />}
    </div>
  )
}
