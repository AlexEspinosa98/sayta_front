import { useState, useRef, useId, useEffect } from 'react'
import {
  Mic, MicOff, Upload, Languages,
  Loader2, Volume2, Copy, Check, AlertCircle,
  ArrowRightLeft, Star, XCircle, ChevronDown, Sparkles, Type,
  Keyboard, X, AlertTriangle,
} from 'lucide-react'
import {
  useSpecialKeyboard, SpecialKeyboardPanel, SpecialKeyboardToggle,
} from '../components/SpecialKeyboard'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { apiErr, apiFetch } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lengua {
  id: number; codigo: string; nombre: string; activa: boolean
  embedding_activo: object | null
}

interface ResultadoItem {
  termino: string
  termino_es: string
  definicion: string
  score: number
  probabilidad: number
  confianza?: number
  nivel?: string
  fuente?: string
  nota?: string
  hipotesis?: boolean
  verificado?: boolean
  mejor_coincidencia: boolean
  coincidencia: string
}

interface TraduccionResponse {
  texto_entrada: string
  lengua: { id: number; codigo: string; nombre: string }
  embedding: { version_id: string; version: string; modelo: string; num_terminos: number }
  direccion: string
  conclusion: {
    termino: string
    termino_es: string
    definicion: string
    probabilidad: number
  }
  resultados: ResultadoItem[]
  en_glosario?: boolean
  aviso?: string | null
  verificacion?: Verificacion | null
  consulta_id?: string | null
}

interface Verificacion {
  estado: 'confirmada' | 'ajustada' | 'compuesta' | 'sin_coincidencia' | 'rechazada' | 'no_concluyente' | 'no_disponible' | 'omitida'
  eleccion: number | null
  traduccion_final: string | null
  explicacion: string
  confianza: number | null
  sin_traducir: string[]
  modelo: string | null
  ms: number
  piezas: { fragmento: string; equivalente: string; inicio?: number; fin?: number }[]
}

interface TranscripcionResultado { termino: string; termino_es: string; definicion: string; probabilidad: number; confianza?: number; nivel?: string; fuente?: string; nota?: string; hipotesis?: boolean; mejor_coincidencia: boolean }
interface TranscripcionResponse {
  transcripcion?: string
  transcripciones_alternativas?: string[]
  transcripcion_reordenada?: boolean
  modelo?: string
  lengua?: string
  error?: string
  traduccion?: {
    conclusion?: { termino: string; termino_es: string; definicion: string; probabilidad: number }
    resultados?: TranscripcionResultado[]
    advertencia?: string
    en_glosario?: boolean
    aviso?: string | null
    verificacion?: Verificacion | null
    consulta_id?: string | null
  }
}

type Direccion = 'es_a_lengua' | 'lengua_a_es'
type InputMode = 'text' | 'audio'

// ── Probability badge ─────────────────────────────────────────────────────────

const NIVEL_TXT: Record<string, string> = {
  exacta: 'Coincidencia exacta', aproximada: 'Coincidencia aproximada', parcial: 'Coincidencia parcial',
  alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja',
}
const FUENTE_TXT: Record<string, string> = { glosario: 'glosario', 'patrón': 'patrón de la lengua', 'semántica': 'búsqueda semántica', verificador: 'compuesta por el verificador' }
const VERIF_TXT: Record<Verificacion['estado'], { titulo: string; tono: 'ok' | 'info' | 'warn' | 'off' }> = {
  confirmada: { titulo: 'El verificador confirma la mejor opción', tono: 'ok' },
  ajustada: { titulo: 'El verificador eligió otra opción más adecuada', tono: 'info' },
  compuesta: { titulo: 'Traducción compuesta a partir de piezas del glosario', tono: 'info' },
  sin_coincidencia: { titulo: 'El verificador no encontró una traducción válida', tono: 'warn' },
  rechazada: { titulo: 'El verificador propuso algo fuera del glosario y se descartó', tono: 'warn' },
  no_concluyente: { titulo: 'Verificación no concluyente', tono: 'warn' },
  no_disponible: { titulo: 'Verificador no disponible: resultado sin verificar', tono: 'off' },
  omitida: { titulo: 'Verificación desactivada', tono: 'off' },
}

function Troceado({ texto, piezas, sinTraducir }: { texto: string; piezas: Verificacion['piezas']; sinTraducir: string[] }) {
  const tokens = texto.trim().split(/\s+/)
  const cubierto = new Map<number, { equivalente: string; primero: boolean }>()
  piezas.forEach(p => {
    if (p.inicio == null || p.fin == null) return
    for (let i = p.inicio; i < p.fin; i++) cubierto.set(i, { equivalente: p.equivalente, primero: i === p.inicio })
  })
  const conPos = piezas.some(p => p.inicio != null)
  return (
    <div className="trx-troceado" aria-label="Texto por partes">
      <p className="trx-troceado-title">Texto por partes <span>verde = está en el glosario · gris = sin traducir</span></p>
      {conPos ? (
        <div className="trx-troceado-row">
          {tokens.map((t, i) => {
            const c = cubierto.get(i)
            return (
              <span key={i} className={`trx-trozo ${c ? 'trx-trozo--ok' : 'trx-trozo--no'}`} title={c ? c.equivalente : 'sin traducir'}>
                {t}{c?.primero && <small>{c.equivalente}</small>}
              </span>
            )
          })}
        </div>
      ) : (
        <ul className="trx-troceado-list">{piezas.map((p, i) => <li key={i}><b>{p.fragmento}</b> → {p.equivalente}</li>)}</ul>
      )}
      {sinTraducir?.length > 0 && <p className="trx-verif-exp">Sin traducir: {sinTraducir.join(', ')}</p>}
    </div>
  )
}

function VerificacionPanel({ v, texto }: { v: Verificacion; texto: string }) {
  const meta = VERIF_TXT[v.estado] ?? { titulo: v.estado, tono: 'off' as const }
  return (
    <section className={`trx-verif trx-verif--${meta.tono}`} aria-label="Verificación por agente">
      <div className="trx-verif-head">
        <span className="trx-verif-chip"><Sparkles size={12} aria-hidden="true" /> Agente verificador</span>
        <strong>{meta.titulo}</strong>
        {v.confianza != null && <span className="trx-verif-conf">confianza {v.confianza}/100</span>}
      </div>
      {v.traduccion_final && v.estado === 'compuesta' && <p className="trx-verif-final">{v.traduccion_final}</p>}
      {v.explicacion && <p className="trx-verif-exp">{v.explicacion}</p>}
      {v.sin_traducir?.length > 0 && <p className="trx-verif-exp">Sin traducir: {v.sin_traducir.join(', ')}</p>}
      {v.piezas?.length > 0 && <Troceado texto={texto} piezas={v.piezas} sinTraducir={v.sin_traducir} />}
      {v.modelo && <p className="trx-verif-meta">{v.modelo} · {(v.ms / 1000).toFixed(1)} s</p>}
    </section>
  )
}

function ProbBadge({ item }: { item: { probabilidad: number; confianza?: number; nivel?: string; fuente?: string; hipotesis?: boolean } }) {
  const conf = item.confianza ?? item.probabilidad
  const cls = conf >= 70 ? 'tc-score--high' : conf >= 45 ? 'tc-score--mid' : 'tc-score--low'
  const nivel = item.nivel ? NIVEL_TXT[item.nivel] ?? item.nivel : undefined
  const fuente = item.fuente ? FUENTE_TXT[item.fuente] ?? item.fuente : undefined
  const titulo = [nivel, fuente && `vía ${fuente}`, item.hipotesis && 'hipótesis sin validar'].filter(Boolean).join(' · ')
  return (
    <div className={`tc-score-wrap ${cls}`} title={titulo} aria-label={`${titulo}: ${Math.round(conf)} de 100`}>
      <span className="tc-score-pct">{Math.round(conf)}<small>/100</small></span>
      <div className="tc-score-bar"><div className="tc-score-fill" style={{ width: `${conf}%` }} /></div>
      {nivel && <span className="tc-score-nivel">{nivel}{item.hipotesis ? ' · hipótesis' : ''}</span>}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Traductor() {
  const [lenguas, setLenguas]           = useState<Lengua[]>([])
  const [loadingLenguas, setLoadingL]   = useState(true)
  const [lenguaId, setLenguaId]         = useState<number | null>(null)
  const [direccion, setDireccion]       = useState<Direccion>('es_a_lengua')
  const [inputMode, setInputMode]       = useState<InputMode>('text')
  const [inputText, setInputText]       = useState('')
  const [langMenuOpen, setLangMenuOpen] = useState(false)

  const rec         = useAudioRecorder()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [result, setResult]             = useState<TraduccionResponse | null>(null)
  const [transcripcion, setTranscripcion] = useState<string | null>(null)
  const [altsAsr, setAltsAsr] = useState<{ lista: string[]; reordenada: boolean } | null>(null)
  const [selectedIdx, setSelectedIdx]   = useState<number>(0)
  const [apiError, setApiError]         = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [copied, setCopied]             = useState(false)
  const [corrOpen, setCorrOpen]         = useState(false)
  const [corrTexto, setCorrTexto]       = useState('')
  const [corrComent, setCorrComent]     = useState('')
  const [corrEstado, setCorrEstado]     = useState<'' | 'enviando' | 'ok' | 'error'>('')

  const elegirOpcion = (i: number) => {
    setSelectedIdx(i)
    if (result?.consulta_id) {
      apiFetch(`/traduccion/consultas/${result.consulta_id}/eleccion/`, { method: 'POST', body: JSON.stringify({ indice: i }) }).catch(() => {})
    }
  }

  const enviarCorreccion = async () => {
    if (!result || !lenguaId || !corrTexto.trim()) return
    setCorrEstado('enviando')
    try {
      const sel = result.resultados[selectedIdx]
      await apiFetch('/traduccion/correcciones/', {
        method: 'POST',
        body: JSON.stringify({
          tipo: sel?.fuente === 'verificador' ? 'validacion_compuesta' : 'correccion',
          consulta_id: result.consulta_id ?? null, lengua_id: lenguaId, direccion,
          texto_origen: result.texto_entrada, propuesta_sistema: sel ? (direccion === 'es_a_lengua' ? sel.termino : sel.termino_es) : '',
          correccion: corrTexto.trim(), comentario: corrComent.trim(),
        }),
      })
      setCorrEstado('ok'); setCorrTexto(''); setCorrComent('')
    } catch { setCorrEstado('error') }
  }

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const textareaId   = useId()
  const resultId     = useId()
  const kb = useSpecialKeyboard(textareaRef, inputText, setInputText)

  useEffect(() => {
    apiFetch('/terminos/lenguas/?page_size=50')
      .then(d => {
        const raw = Array.isArray(d) ? d : (d as { results?: unknown }).results ?? d
        const list: Lengua[] = Array.isArray(raw) ? raw : []
        setLenguas(list)
        if (list.length > 0) setLenguaId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingL(false))
  }, [])

  const resetResults = () => { setResult(null); setTranscripcion(null); setAltsAsr(null); setApiError('') }

  const handleSetInputMode = (mode: InputMode) => {
    setInputMode(mode)
    if (mode === 'audio') setDireccion('lengua_a_es')
    resetResults()
  }

  const swapDireccion = () => {
    if (inputMode === 'audio') return
    // Como los buenos traductores: el texto traducido pasa a la caja de entrada
    if (selected) {
      const translated = sourceIsEs ? selected.termino : selected.termino_es
      setInputText(translated)
    }
    setDireccion(d => (d === 'es_a_lengua' ? 'lengua_a_es' : 'es_a_lengua'))
    resetResults()
  }

  const selectedLengua = lenguas.find(l => l.id === lenguaId)

  const canTranslate = lenguaId !== null && (
    inputMode === 'text' ? inputText.trim().length > 0 : rec.audioFile !== null
  )

  const handleTranslate = async () => {
    if (!canTranslate || !lenguaId) return
    setIsLoading(true); setResult(null); setTranscripcion(null); setApiError(''); setCorrOpen(false); setCorrEstado('')

    try {
      if (inputMode === 'text') {
        const data = await apiFetch('/traduccion/traducir/', {
          method: 'POST',
          body: JSON.stringify({ texto: inputText.trim(), lengua_id: lenguaId, direccion }),
        }) as TraduccionResponse
        const resultados: ResultadoItem[] = Array.isArray(data.resultados) ? data.resultados : []
        setResult({ ...data, resultados })
        const best = resultados.findIndex(r => r.mejor_coincidencia)
        setSelectedIdx(best >= 0 ? best : 0)
      } else {
        const fd = new FormData()
        fd.append('lengua_id', String(lenguaId))
        fd.append('audio', rec.audioFile!)
        fd.append('direccion', 'lengua_a_es')
        const data = await apiFetch('/entrenamiento/transcribir-y-traducir/', {
          method: 'POST',
          body: fd,
        }) as TranscripcionResponse
        if (data.error) {
          setApiError(data.error)
        } else {
          setTranscripcion(data.transcripcion ?? null)
          setAltsAsr(data.transcripciones_alternativas && data.transcripciones_alternativas.length > 1 ? { lista: data.transcripciones_alternativas, reordenada: !!data.transcripcion_reordenada } : null)
          if (data.traduccion?.resultados && data.traduccion.conclusion) {
            setResult({
              en_glosario: data.traduccion.en_glosario,
              aviso: data.traduccion.aviso ?? null,
              verificacion: data.traduccion.verificacion ?? null,
              consulta_id: data.traduccion.consulta_id ?? null,
              texto_entrada: data.transcripcion ?? '',
              lengua: selectedLengua as Lengua as TraduccionResponse['lengua'],
              embedding: { version_id: '', version: data.modelo ?? '', modelo: data.modelo ?? '', num_terminos: 0 },
              direccion: 'lengua_a_es',
              conclusion: data.traduccion.conclusion,
              resultados: data.traduccion.resultados.map(r => ({
                ...r, score: (r.confianza ?? r.probabilidad) / 100, coincidencia: '',
              })),
            })
            const best = data.traduccion.resultados.findIndex(r => r.mejor_coincidencia)
            setSelectedIdx(best >= 0 ? best : 0)
          } else if (data.traduccion?.advertencia) {
            setApiError(data.traduccion.advertencia)
          }
        }
      }
    } catch (e) {
      setApiError(apiErr(e, 'No se pudo conectar con el servidor.'))
    } finally { setIsLoading(false) }
  }

  const selected = result?.resultados[selectedIdx] ?? null

  const handleCopy = async () => {
    if (!selected) return
    const text = `${selected.termino} (${selected.termino_es}) — ${selected.definicion} · confianza ${Math.round(selected.confianza ?? selected.probabilidad)}/100`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const langName    = selectedLengua?.nombre ?? 'Lengua indígena'
  const sourceIsEs  = direccion === 'es_a_lengua'
  const sourceLabel = sourceIsEs ? 'Español' : langName
  const targetLabel = sourceIsEs ? langName : 'Español'
  const inputPlaceholder = sourceIsEs ? 'Escribe en español…' : `Escribe en ${langName}…`
  const bestIdx = result ? result.resultados.findIndex(r => r.mejor_coincidencia) : -1

  // Texto traducido según la dirección (lo que se muestra grande y lo que viaja al invertir)
  const targetPrimary   = selected ? (sourceIsEs ? selected.termino : selected.termino_es) : ''
  const targetSecondary = selected ? (sourceIsEs ? selected.termino_es : selected.termino) : ''

  // ── Chip renderer for the language bar ──────────────────────────────────────
  const LangChip = ({ side }: { side: 'source' | 'target' }) => {
    const isEs = side === 'source' ? sourceIsEs : !sourceIsEs
    if (isEs) {
      return (
        <div className="trx-chip trx-chip--static">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
          </svg>
          <span>Español</span>
        </div>
      )
    }
    // Lengua chip = dropdown
    return (
      <div className="trx-chip-wrap">
        <button
          type="button"
          className="trx-chip trx-chip--select"
          aria-haspopup="listbox"
          aria-expanded={langMenuOpen}
          disabled={loadingLenguas || lenguas.length === 0}
          onClick={() => setLangMenuOpen(o => !o)}
        >
          <span className="trx-chip-dot" aria-hidden="true" />
          <span className="truncate">
            {loadingLenguas ? 'Cargando…' : lenguas.length === 0 ? 'Sin lenguas' : langName}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {langMenuOpen && (
          <>
            <div className="trx-menu-backdrop" onClick={() => setLangMenuOpen(false)} />
            <ul className="trx-menu" role="listbox" aria-label="Selecciona una lengua indígena">
              {lenguas.map(l => (
                <li key={l.id} role="option" aria-selected={l.id === lenguaId}>
                  <button
                    type="button"
                    className={`trx-menu-item ${l.id === lenguaId ? 'trx-menu-item--active' : ''}`}
                    onClick={() => { setLenguaId(l.id); setLangMenuOpen(false); resetResults() }}
                  >
                    <span className="trx-menu-avatar" aria-hidden="true">{l.nombre.slice(0, 2)}</span>
                    <span className="trx-menu-body">
                      <span className="trx-menu-name">{l.nombre}</span>
                      {!l.embedding_activo && <span className="trx-menu-note">Sin embedding activo</span>}
                    </span>
                    {l.id === lenguaId && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  return (
    <section className="translator-page" aria-labelledby="translator-heading">
      <div className="translator-page-inner">

        <header className="translator-page-header">
          <h1 id="translator-heading" className="tp-title">Traductor SAYTA</h1>
          <p className="tp-subtitle">Escribe o habla · traducción semántica para lenguas indígenas colombianas</p>
        </header>

        <div className="trx-card" role="region" aria-label="Panel de traducción">

          {/* ── Barra de idioma ─────────────────────────────── */}
          <div className="trx-langbar">
            <LangChip side="source" />
            <button
              type="button"
              className="trx-swap"
              onClick={swapDireccion}
              disabled={inputMode === 'audio'}
              aria-label="Invertir dirección de traducción"
              title={inputMode === 'audio' ? 'El audio siempre traduce a español' : 'Invertir'}
            >
              <ArrowRightLeft size={18} aria-hidden="true" />
            </button>
            <LangChip side="target" />
          </div>

          {/* ── Selector de entrada ─────────────────────────── */}
          <div className="trx-modebar" role="group" aria-label="Tipo de entrada">
            <button
              type="button"
              className={`trx-mode ${inputMode === 'text' ? 'trx-mode--active' : ''}`}
              aria-pressed={inputMode === 'text'}
              onClick={() => handleSetInputMode('text')}
            >
              <Type size={15} aria-hidden="true" /> Texto
            </button>
            <button
              type="button"
              className={`trx-mode ${inputMode === 'audio' ? 'trx-mode--active' : ''}`}
              aria-pressed={inputMode === 'audio'}
              onClick={() => handleSetInputMode('audio')}
            >
              <Mic size={15} aria-hidden="true" /> Audio
            </button>
          </div>

          {/* ── Paneles origen → destino ────────────────────── */}
          <div className="trx-panels">

            {/* Origen */}
            <div className="trx-panel">
              <div className="trx-panel-head">
                <span className="trx-panel-label">{sourceLabel}</span>
                <Volume2 size={18} className="trx-panel-mute" aria-hidden="true" />
              </div>

              {inputMode === 'text' ? (
                <>
                  <label htmlFor={textareaId} className="visually-hidden">Texto en {sourceLabel}</label>
                  <textarea
                    ref={textareaRef}
                    id={textareaId}
                    className="trx-textarea"
                    placeholder={inputPlaceholder}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    aria-required="true"
                    aria-describedby={result ? resultId : undefined}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleTranslate() }}
                  />
                  <div className="trx-panel-foot">
                    <SpecialKeyboardToggle
                      open={kb.open}
                      onToggle={() => kb.open ? kb.setOpen(false) : kb.openKeyboard()}
                    />
                    <span className="trx-count">{inputText.length} / 5000</span>
                  </div>
                </>
              ) : (
                <div className="trx-audio">
                  {rec.isRecording ? (
                    <div className="trx-live" aria-live="polite">
                      <div className="trx-live-orb">
                        <span className="trx-live-ring" /><span className="trx-live-ring trx-live-ring--2" />
                        <div className="trx-live-core"><Mic size={30} aria-hidden="true" /></div>
                      </div>
                      <div className="trx-wave" aria-hidden="true">
                        {[16, 30, 44, 26, 50, 34, 22, 46, 38, 28, 42, 20].map((h, i) => (
                          <span key={i} style={{ height: h, animationDelay: `${(i % 6) * 0.08}s` }} />
                        ))}
                      </div>
                      <span className="trx-live-label">Escuchando…</span>
                    </div>
                  ) : rec.audioFile && rec.audioUrl ? (
                    <div className="trx-audio-preview">
                      <audio controls src={rec.audioUrl} className="trx-audio-player" />
                      <div className="trx-audio-meta">
                        <Volume2 size={13} aria-hidden="true" />
                        <span className="truncate">{rec.audioFile.name}</span>
                        <button className="trx-icon-btn" onClick={rec.clearAudio} type="button" aria-label="Quitar audio">
                          <XCircle size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="trx-audio-hint">Graba tu voz en {langName} o sube un archivo — se transcribe y traduce al español.</p>
                  )}

                  <div className="trx-audio-actions">
                    <button
                      type="button"
                      className={`trx-rec-btn ${rec.isRecording ? 'trx-rec-btn--active' : ''}`}
                      aria-pressed={rec.isRecording}
                      onClick={rec.toggleRecording}
                    >
                      {rec.isRecording
                        ? <><MicOff size={18} aria-hidden="true" /> Detener</>
                        : <><Mic size={18} aria-hidden="true" /> Grabar</>}
                    </button>
                    <button type="button" className="trx-upload-btn"
                      onClick={() => fileInputRef.current?.click()} aria-label="Subir archivo de audio">
                      <Upload size={16} aria-hidden="true" /> Subir
                    </button>
                    <input ref={fileInputRef} type="file" accept=".wav,.mp3,.ogg,.flac,.m4a,.mp4"
                      aria-label="Seleccionar archivo de audio" className="visually-hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) { rec.clearAudio(); rec.setFromFile(f) }
                        e.target.value = ''
                      }} />
                  </div>
                </div>
              )}
            </div>

            {/* Destino */}
            <div className="trx-panel trx-panel--target">
              <div className="trx-panel-head">
                <span className="trx-panel-label trx-panel-label--target">{targetLabel}</span>
                {result && !isLoading && (
                  <span className="trx-ai-badge"><Sparkles size={12} aria-hidden="true" /> Traducido por IA</span>
                )}
              </div>

              <div className="trx-target-body" id={resultId} aria-live="polite">
                {isLoading ? (
                  <div className="trx-target-loading">
                    <Loader2 size={22} className="spin" aria-hidden="true" />
                    <span>{inputMode === 'audio' ? 'Transcribiendo audio…' : 'Buscando en el glosario y verificando…'}</span>
                  </div>
                ) : selected ? (
                  <>
                    <p className="trx-target-term">{targetPrimary}</p>
                    {targetSecondary && <p className="trx-target-es">{targetSecondary}</p>}
                    {selected.definicion && <p className="trx-target-def">{selected.definicion}</p>}
                  </>
                ) : (
                  <p className="trx-target-placeholder">La traducción aparecerá aquí.</p>
                )}
              </div>

              {result && !isLoading && result.aviso && (
                <p className={`trx-aviso ${result.en_glosario === false ? 'trx-aviso--fuera' : ''}`} role="status">
                  <AlertTriangle size={14} aria-hidden="true" /> {result.aviso}
                </p>
              )}
              {selected && !isLoading && (
                <div className="trx-panel-foot trx-panel-foot--target">
                  <span className={`trx-badge-flag ${selectedIdx === bestIdx ? 'is-best' : ''}`}>
                    <Star size={12} aria-hidden="true" />
                    {selectedIdx === bestIdx ? 'Mejor coincidencia' : 'Opción elegida'}
                  </span>
                  <div className="trx-foot-right">
                    <ProbBadge item={selected} />
                    <button type="button" className="trx-icon-btn trx-icon-btn--bordered" onClick={handleCopy}
                      aria-label={copied ? 'Copiado' : 'Copiar traducción'}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Teclado de caracteres especiales (full width) ── */}
          {inputMode === 'text' && kb.open && (
            <div className="trx-kb" role="group" aria-label="Teclado de caracteres especiales">
              <div className="trx-kb-head">
                <span className="trx-kb-title">
                  <span className="trx-kb-badge" aria-hidden="true"><Keyboard size={15} /></span>
                  Caracteres de lenguas indígenas
                  <span className="trx-kb-hint">toca para insertar en el cursor</span>
                </span>
                <button type="button" className="trx-kb-close" onClick={() => kb.setOpen(false)} aria-label="Cerrar teclado">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <SpecialKeyboardPanel
                open={kb.open}
                onClose={() => kb.setOpen(false)}
                onInsert={kb.insertAtCursor}
                onDelete={kb.deleteChar}
                onSpace={() => kb.insertAtCursor(' ')}
                onEnter={() => kb.insertAtCursor('\n')}
                onAccent={kb.acentuar}
                aviso={kb.aviso}
                valor={inputText}
                onReplace={setInputText}
              />
            </div>
          )}

          {/* ── Botón traducir ──────────────────────────────── */}
          <button
            type="button"
            className="trx-translate-btn"
            onClick={handleTranslate}
            disabled={isLoading || !canTranslate || rec.isRecording}
            aria-busy={isLoading}
            title={inputMode === 'text' ? 'También puedes pulsar Ctrl+Enter' : undefined}
          >
            {isLoading
              ? <><Loader2 size={19} className="spin" aria-hidden="true" /> {inputMode === 'audio' ? 'Transcribiendo…' : 'Traduciendo…'}</>
              : inputMode === 'audio'
                ? <><Mic size={19} aria-hidden="true" /> {rec.audioFile ? 'Transcribir y traducir' : 'Graba o sube un audio'}</>
                : <><Languages size={19} aria-hidden="true" /> Traducir</>}
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────── */}
        {apiError && (
          <div className="tc-api-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{apiError}</span>
          </div>
        )}

        {/* ── Transcripción (audio) ───────────────────────── */}
        {transcripcion && !isLoading && (
          <div className="trx-transcripcion" role="status">
            <span className="trx-transcripcion-label"><Mic size={13} aria-hidden="true" /> Transcripción</span>
            <span className="trx-transcripcion-text">{transcripcion}</span>
            {altsAsr && (
              <details className="trx-alts-asr">
                <summary>{altsAsr.reordenada ? 'El glosario eligió otra transcripción que la más probable del reconocedor' : 'Otras transcripciones posibles'} ({altsAsr.lista.length})</summary>
                <ol>{altsAsr.lista.map((a, i) => <li key={i} className={a === transcripcion ? 'is-elegida' : ''}>{a}{a === transcripcion ? ' ✓' : ''}</li>)}</ol>
              </details>
            )}
          </div>
        )}

        {result && !isLoading && result.verificacion && <VerificacionPanel v={result.verificacion} texto={result.texto_entrada} />}

        {/* ── Otras coincidencias ─────────────────────────── */}
        {result && !isLoading && result.resultados.length > 1 && (
          <div className="trx-alts" role="status" aria-label="Otras coincidencias">
            <p className="tc-opts-label">Otras coincidencias — elige una opción</p>
            <div className="tc-results-list" role="radiogroup" aria-label="Opciones de traducción">
              {result.resultados.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selectedIdx === i}
                  className={[
                    'tc-result-card',
                    selectedIdx === i ? 'tc-result-card--selected' : '',
                    r.mejor_coincidencia ? 'tc-result-card--best' : '',
                  ].join(' ').trim()}
                  onClick={() => elegirOpcion(i)}
                >
                  <span className="tc-result-rank" aria-label={`Opción ${i + 1}`}>#{i + 1}</span>
                  <div className="tc-result-body">
                    <span className="tc-result-term">
                      {r.termino}
                      {r.mejor_coincidencia && (
                        <span className="tc-result-best-tag" aria-label="Mejor coincidencia">★</span>
                      )}
                      {r.verificado && <span className="tc-result-verif" title="Elegida por el verificador">✓ verificada</span>}
                    </span>
                    <span className="tc-result-es">{r.termino_es}</span>
                    <span className="tc-result-def">{r.definicion}</span>
                  </div>
                  <ProbBadge item={r} />
                </button>
              ))}
            </div>
          </div>
        )}

        {result && !isLoading && result.resultados.length > 0 && (
          <div className="trx-corr">
            {!corrOpen ? (
              <button type="button" className="trx-corr-btn" onClick={() => setCorrOpen(true)}>
                <AlertTriangle size={14} aria-hidden="true" /> ¿La traducción está mal? Proponer la correcta
              </button>
            ) : (
              <form className="trx-corr-form" onSubmit={e => { e.preventDefault(); enviarCorreccion() }} aria-label="Proponer corrección">
                <label>Traducción correcta en {targetLabel}
                  <input className="gl-input" value={corrTexto} onChange={e => setCorrTexto(e.target.value)} required maxLength={500} />
                </label>
                <label>Comentario (opcional)
                  <input className="gl-input" value={corrComent} onChange={e => setCorrComent(e.target.value)} maxLength={500} placeholder="quién lo confirmó, contexto, variante regional…" />
                </label>
                <div className="trx-corr-actions">
                  <button type="submit" className="gl-btn gl-btn--primary" disabled={corrEstado === 'enviando' || !corrTexto.trim()}>Enviar a revisión</button>
                  <button type="button" className="gl-btn gl-btn--ghost" onClick={() => setCorrOpen(false)}>Cancelar</button>
                  {corrEstado === 'ok' && <span className="trx-corr-ok" role="status">Gracias. Quedó pendiente de revisión por el equipo del glosario.</span>}
                  {corrEstado === 'error' && <span className="trx-corr-err" role="alert">No se pudo enviar. Intenta de nuevo.</span>}
                </div>
              </form>
            )}
          </div>
        )}

        {result && result.embedding.modelo && !isLoading && (
          <p className="tc-emb-info">
            {result.embedding.version
              ? `Embedding ${result.embedding.version} · ${result.embedding.num_terminos.toLocaleString()} términos · `
              : 'Modelo ASR: '}
            {result.embedding.modelo}
          </p>
        )}

      </div>
    </section>
  )
}
