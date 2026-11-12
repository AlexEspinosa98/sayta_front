import { useState, useCallback, useEffect, useMemo, useRef, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Delete, Keyboard, ChevronDown, CaseUpper, AlertTriangle, Wand2 } from 'lucide-react'

/**
 * Teclado inclusivo para escribir lenguas indígenas (Arhuaco/Ikʉn y Kogui).
 *
 * Diseñado con datos reales: las teclas de «Más usados» salen de los caracteres que de verdad aparecen en las
 * transcripciones etiquetadas de cada comunidad (ʉ, ɉ, ñ, ɨ, ’, ¿…).
 *
 * Accesibilidad:
 *  - Objetivos táctiles de 44 px, contraste alto y foco visible.
 *  - Con ratón/táctil, el campo de texto NO pierde el foco ni la selección (onMouseDown.preventDefault).
 *  - Con teclado, se navega entre teclas con las flechas, Inicio/Fin; Enter/Espacio inserta y el foco se queda en la tecla.
 *  - Cada tecla tiene nombre hablado en español («u con barra, ʉ») y un aviso `aria-live` confirma cada inserción.
 *  - Atajos físicos con Alt (u otro modificador) para escribir sin abrir el panel.
 *  - Aviso (con corrección en un clic) de caracteres que conviene normalizar, p. ej. «´» suelto en vez de tilde combinada.
 */

// ── Datos del alfabeto ───────────────────────────────────────────────────────

export type LenguaTeclado = 'arhuaco' | 'kogui' | 'todas'

interface Tecla { c: string; nombre: string; mayus?: string; atajo?: string }
interface Seccion { id: string; titulo: string; teclas: Tecla[] }

const T = (c: string, nombre: string, mayus?: string, atajo?: string): Tecla => ({ c, nombre, mayus, atajo })

const VOCALES: Tecla[] = [
  T('a', 'a', 'A'), T('e', 'e', 'E'), T('i', 'i', 'I'), T('o', 'o', 'O'), T('u', 'u', 'U'),
  T('ʉ', 'u con barra', 'Ʉ', 'Alt+U'), T('ɨ', 'i con barra', 'Ɨ', 'Alt+I'),
  T('á', 'a con tilde', 'Á'), T('é', 'e con tilde', 'É'), T('í', 'i con tilde', 'Í'), T('ó', 'o con tilde', 'Ó'), T('ú', 'u con tilde', 'Ú'),
  T('y', 'y griega', 'Y'),
]

const CONSONANTES: Tecla[] = [
  T('b', 'b', 'B'), T('ch', 'ch', 'Ch'), T('d', 'd', 'D'), T('g', 'g', 'G'), T('j', 'j', 'J'),
  T('ɉ', 'j cortada, j con barra', 'Ɉ', 'Alt+J'), T('k', 'k', 'K'), T('m', 'm', 'M'), T('n', 'n', 'N'),
  T('ñ', 'eñe', 'Ñ', 'Alt+N'), T('p', 'p', 'P'), T('r', 'r', 'R'), T('s', 's', 'S'), T('t', 't', 'T'),
  T('w', 'w', 'W'), T('z', 'z', 'Z'), T('zh', 'zh', 'Zh'),
  T('’', 'apóstrofo, saltillo o glotal', undefined, 'Alt+\''),
]

const SIGNOS: Tecla[] = [
  T('¿', 'abrir interrogación'), T('?', 'cerrar interrogación'), T('¡', 'abrir exclamación'), T('!', 'cerrar exclamación'),
  T(',', 'coma'), T('.', 'punto'), T(';', 'punto y coma'), T(':', 'dos puntos'),
  T('-', 'guion'), T('–', 'raya'), T('“', 'abrir comillas'), T('”', 'cerrar comillas'), T('…', 'puntos suspensivos'),
]

// Los más usados según el corpus etiquetado de SAYTA (orden por frecuencia)
const MAS_USADOS: Record<LenguaTeclado, Tecla[]> = {
  arhuaco: [T('ʉ', 'u con barra', 'Ʉ', 'Alt+U'), T('ɉ', 'j cortada', 'Ɉ', 'Alt+J'), T('’', 'apóstrofo glotal', undefined, 'Alt+\''),
            T('á', 'a con tilde', 'Á'), T('í', 'i con tilde', 'Í'), T('ú', 'u con tilde', 'Ú'), T('é', 'e con tilde', 'É'), T('ó', 'o con tilde', 'Ó')],
  kogui:   [T('ñ', 'eñe', 'Ñ', 'Alt+N'), T('ɨ', 'i con barra', 'Ɨ', 'Alt+I'), T('ʉ', 'u con barra', 'Ʉ', 'Alt+U'),
            T('á', 'a con tilde', 'Á'), T('í', 'i con tilde', 'Í'), T('é', 'e con tilde', 'É'), T('ú', 'u con tilde', 'Ú'), T('ó', 'o con tilde', 'Ó'),
            T('¿', 'abrir interrogación'), T('¡', 'abrir exclamación')],
  todas:   [T('ʉ', 'u con barra', 'Ʉ', 'Alt+U'), T('ɉ', 'j cortada', 'Ɉ', 'Alt+J'), T('ñ', 'eñe', 'Ñ', 'Alt+N'), T('ɨ', 'i con barra', 'Ɨ', 'Alt+I'),
            T('’', 'apóstrofo glotal', undefined, 'Alt+\''), T('á', 'a con tilde', 'Á'), T('í', 'i con tilde', 'Í'), T('é', 'e con tilde', 'É'),
            T('ú', 'u con tilde', 'Ú'), T('ó', 'o con tilde', 'Ó')],
}

const NOMBRE_LENGUA: Record<LenguaTeclado, string> = { arhuaco: 'Arhuaco (Ikʉn)', kogui: 'Kogui', todas: 'Todas' }

/** Se conserva por compatibilidad: lista plana de grupos como la versión anterior. */
export const ALPHABET = [
  { title: 'Vocales', groups: VOCALES.map(t => ({ label: t.nombre, chars: [{ char: t.c }, ...(t.mayus ? [{ char: t.mayus }] : [])] })) },
  { title: 'Consonantes', groups: CONSONANTES.map(t => ({ label: t.nombre, chars: [{ char: t.c }, ...(t.mayus ? [{ char: t.mayus }] : [])] })) },
  { title: 'Signos', groups: SIGNOS.map(t => ({ label: t.nombre, chars: [{ char: t.c }] })) },
]

// ── Atajos físicos ───────────────────────────────────────────────────────────

const ATAJOS: Record<string, { c: string; mayus?: string }> = {
  KeyU: { c: 'ʉ', mayus: 'Ʉ' },
  KeyJ: { c: 'ɉ', mayus: 'Ɉ' },
  KeyN: { c: 'ñ', mayus: 'Ñ' },
  KeyI: { c: 'ɨ', mayus: 'Ɨ' },
  Quote: { c: '’' },
}
const ATAJO_TILDE = 'KeyT'   // Alt+T → tilde sobre la letra anterior

// ── Normalización ────────────────────────────────────────────────────────────

const ACENTO_COMBINANTE = '́'

export interface Problema { id: string; texto: string; cantidad: number }

/** Detecta caracteres que conviene normalizar (no cambia nada por sí sola). */
export function detectarProblemas(valor: string): Problema[] {
  const out: Problema[] = []
  const sueltas = (valor.match(/\p{L}´/gu) ?? []).length
  if (sueltas) out.push({ id: 'tilde-suelta', cantidad: sueltas, texto: 'Tilde escrita como carácter aparte («´» después de una letra). Se puede unir a la letra.' })
  const jBarra = (valor.match(/ɟ/g) ?? []).length
  if (jBarra) out.push({ id: 'j-barra', cantidad: jBarra, texto: 'Se usó «ɟ»; en el corpus la j cortada es «ɉ».' })
  const comillas = (valor.match(/[‘`]/g) ?? []).length
  if (comillas) out.push({ id: 'apostrofo', cantidad: comillas, texto: 'Apóstrofo distinto del glotal «’».' })
  return out
}

/** Aplica las correcciones de `detectarProblemas`. */
export function normalizarTexto(valor: string): string {
  return valor
    .replace(/(\p{L})´/gu, (_m, letra: string) => (letra + ACENTO_COMBINANTE).normalize('NFC'))
    .replace(/ɟ/g, 'ɉ')
    .replace(/[‘`]/g, '’')
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpecialKeyboard(
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  value: string,
  onChange: (v: string) => void,
) {
  const [open, setOpen] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const colocarCursor = useCallback((el: HTMLInputElement | HTMLTextAreaElement, pos: number, mantenerFoco?: boolean) => {
    requestAnimationFrame(() => {
      if (!mantenerFoco) el.focus()
      try { el.setSelectionRange(pos, pos) } catch { /* algunos tipos de input no admiten selección */ }
    })
  }, [])

  const insertAtCursor = useCallback((chars: string, mantenerFoco?: boolean) => {
    const el = inputRef.current
    if (!el) { onChange(value + chars); setAviso(`Insertado ${chars}`); return }
    const start = el.selectionStart ?? value.length
    const end   = el.selectionEnd   ?? value.length
    onChange(value.slice(0, start) + chars + value.slice(end))
    colocarCursor(el, start + chars.length, mantenerFoco)
    setAviso(`Insertado ${chars}`)
  }, [inputRef, value, onChange, colocarCursor])

  const deleteChar = useCallback((mantenerFoco?: boolean) => {
    const el = inputRef.current
    if (!el) { onChange(value.slice(0, -1)); return }
    const start = el.selectionStart ?? value.length
    const end   = el.selectionEnd   ?? value.length
    let next: string, pos: number
    if (start !== end) {
      next = value.slice(0, start) + value.slice(end); pos = start
    } else if (start > 0) {
      const arr = [...value.slice(0, start)]
      const len = arr[arr.length - 1]?.length ?? 1
      next = value.slice(0, start - len) + value.slice(end); pos = start - len
    } else { return }
    onChange(next)
    colocarCursor(el, pos, mantenerFoco)
    setAviso('Carácter borrado')
  }, [inputRef, value, onChange, colocarCursor])

  /** Pone (o quita) la tilde sobre la letra que está justo antes del cursor. */
  const acentuar = useCallback((mantenerFoco?: boolean) => {
    const el = inputRef.current
    const pos = el?.selectionStart ?? value.length
    const antes = [...value.slice(0, pos)]
    const ultima = antes[antes.length - 1]
    if (!ultima) { setAviso('No hay una letra antes del cursor'); return }
    // Si ya termina en tilde combinante, la quita
    let nuevo: string
    let largo = ultima.length
    if (ultima === ACENTO_COMBINANTE) {
      const base = antes[antes.length - 2] ?? ''
      nuevo = base.normalize('NFD').replace(ACENTO_COMBINANTE, '').normalize('NFC')
      largo = base.length + ultima.length
      setAviso('Tilde quitada')
    } else if (!/\p{L}/u.test(ultima)) {
      setAviso('La tilde solo va sobre una letra'); return
    } else {
      nuevo = (ultima + ACENTO_COMBINANTE).normalize('NFC')
      setAviso('Tilde puesta')
    }
    const prefijo = value.slice(0, pos - largo)
    onChange(prefijo + nuevo + value.slice(pos))
    if (el) colocarCursor(el, prefijo.length + nuevo.length, mantenerFoco)
  }, [inputRef, value, onChange, colocarCursor])

  const openKeyboard = useCallback(() => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [inputRef])

  // Atajos físicos (Alt + tecla) directamente en el campo, con o sin panel abierto
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      if (e.code === ATAJO_TILDE) { e.preventDefault(); acentuar(); return }
      const a = ATAJOS[e.code]
      if (!a) return
      e.preventDefault()
      insertAtCursor(e.shiftKey && a.mayus ? a.mayus : a.c)
    }
    el.addEventListener('keydown', onKey as EventListener)
    return () => el.removeEventListener('keydown', onKey as EventListener)
  }, [inputRef, insertAtCursor, acentuar, value])

  return { open, setOpen, openKeyboard, insertAtCursor, deleteChar, acentuar, aviso, setAviso }
}

// ── Panel ────────────────────────────────────────────────────────────────────

interface SpecialKeyboardPanelProps {
  open: boolean
  onClose: () => void
  onInsert: (c: string, mantenerFoco?: boolean) => void
  onDelete: (mantenerFoco?: boolean) => void
  onSpace: () => void
  onEnter?: () => void
  /** Pone/quita la tilde sobre la letra anterior (hook.acentuar). Si no se pasa, la tecla no se muestra. */
  onAccent?: (mantenerFoco?: boolean) => void
  /** Mensaje para el lector de pantalla (hook.aviso). */
  aviso?: string
  /** Texto actual y reemplazo: activan el aviso de normalización con botón «Corregir». */
  valor?: string
  onReplace?: (v: string) => void
  /** Lengua preseleccionada (p. ej. la comunidad de la jornada que se está etiquetando). */
  lengua?: LenguaTeclado
  title?: string
}

const CLAVE_LENGUA = 'sayta_kb_lengua'

function lenguaGuardada(): LenguaTeclado | null {
  try {
    const v = localStorage.getItem(CLAVE_LENGUA)
    return v === 'arhuaco' || v === 'kogui' || v === 'todas' ? v : null
  } catch { return null }
}

export function SpecialKeyboardPanel({
  open, onInsert, onDelete, onSpace, onEnter, onAccent, aviso, valor, onReplace, lengua: lenguaInicial,
}: SpecialKeyboardPanelProps) {
  const [lengua, setLengua] = useState<LenguaTeclado>(() => lenguaInicial ?? lenguaGuardada() ?? 'todas')
  const [mayus, setMayus] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => { if (lenguaInicial) setLengua(lenguaInicial) }, [lenguaInicial])

  const elegirLengua = (l: LenguaTeclado) => {
    setLengua(l)
    try { localStorage.setItem(CLAVE_LENGUA, l) } catch { /* sin almacenamiento */ }
  }

  const problemas = useMemo(() => (valor ? detectarProblemas(valor) : []), [valor])

  const secciones: Seccion[] = useMemo(() => [
    { id: 'mas', titulo: `Más usados · ${NOMBRE_LENGUA[lengua]}`, teclas: MAS_USADOS[lengua] },
    { id: 'vocales', titulo: 'Vocales', teclas: VOCALES },
    { id: 'consonantes', titulo: 'Consonantes', teclas: CONSONANTES },
    { id: 'signos', titulo: 'Signos', teclas: SIGNOS },
  ], [lengua])

  // Navegación con flechas entre teclas
  const onKeyDownPanel = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const teclas = Array.from(raiz.current?.querySelectorAll<HTMLButtonElement>('button[data-kb-key]') ?? [])
    const i = teclas.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    let destino: HTMLButtonElement | undefined
    if (e.key === 'ArrowRight') destino = teclas[Math.min(teclas.length - 1, i + 1)]
    else if (e.key === 'ArrowLeft') destino = teclas[Math.max(0, i - 1)]
    else if (e.key === 'Home') destino = teclas[0]
    else if (e.key === 'End') destino = teclas[teclas.length - 1]
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const r = teclas[i].getBoundingClientRect()
      const sentido = e.key === 'ArrowDown' ? 1 : -1
      let mejor = Infinity
      for (const t of teclas) {
        const q = t.getBoundingClientRect()
        const dy = (q.top - r.top) * sentido
        if (dy < 8) continue
        const dist = dy * 4 + Math.abs(q.left - r.left)
        if (dist < mejor) { mejor = dist; destino = t }
      }
    }
    if (destino) { e.preventDefault(); destino.focus() }
  }

  if (!open) return null

  // Con ratón/táctil se evita que la tecla robe el foco; con teclado (detail === 0) se mantiene en la tecla
  const sinRobarFoco = (e: React.MouseEvent) => e.preventDefault()
  const desdeTeclado = (e: React.MouseEvent) => e.detail === 0

  return (
    <div className="vk-inline" role="group" aria-label="Teclado de caracteres especiales" ref={raiz} onKeyDown={onKeyDownPanel}>
      <div className="vk-toolbar">
        <div className="vk-seg" role="radiogroup" aria-label="Lengua del teclado">
          {(['arhuaco', 'kogui', 'todas'] as LenguaTeclado[]).map(l => (
            <button key={l} type="button" role="radio" aria-checked={lengua === l}
              className={`vk-seg-btn${lengua === l ? ' vk-seg-btn--on' : ''}`}
              onMouseDown={sinRobarFoco} onClick={() => elegirLengua(l)}>
              {NOMBRE_LENGUA[l]}
            </button>
          ))}
        </div>
        <div className="vk-quick-actions">
          <button className={`vk-action-btn${mayus ? ' vk-action-btn--on' : ''}`} type="button" aria-pressed={mayus}
            onMouseDown={sinRobarFoco} onClick={() => setMayus(m => !m)} title="Mostrar las letras en mayúscula">
            <CaseUpper size={15} aria-hidden="true" /> Mayúsculas
          </button>
          {onAccent && (
            <button className="vk-action-btn" type="button" onMouseDown={sinRobarFoco}
              onClick={e => onAccent(desdeTeclado(e))} aria-keyshortcuts="Alt+T"
              title="Pone o quita la tilde sobre la letra que está antes del cursor (Alt+T)">
              ´ Tilde
            </button>
          )}
          <button className="vk-action-btn" onMouseDown={sinRobarFoco} onClick={e => onDelete(desdeTeclado(e))} type="button">
            <Delete size={15} aria-hidden="true" /> Borrar
          </button>
          <button className="vk-action-btn vk-action-btn--wide" onMouseDown={sinRobarFoco} onClick={onSpace} type="button">
            Espacio
          </button>
          {onEnter && (
            <button className="vk-action-btn" onMouseDown={sinRobarFoco} onClick={onEnter} type="button">
              ↵ Nueva línea
            </button>
          )}
        </div>
      </div>

      {problemas.length > 0 && onReplace && valor && (
        <div className="vk-warn" role="status">
          <AlertTriangle size={15} aria-hidden="true" />
          <div className="vk-warn-text">
            <strong>Conviene revisar el texto:</strong>
            <ul>{problemas.map(p => <li key={p.id}>{p.texto} <span className="vk-warn-n">({p.cantidad})</span></li>)}</ul>
          </div>
          <button type="button" className="vk-action-btn" onMouseDown={sinRobarFoco} onClick={() => onReplace(normalizarTexto(valor))}>
            <Wand2 size={14} aria-hidden="true" /> Corregir
          </button>
        </div>
      )}

      <div className="vk-inline-body">
        {secciones.map(sec => (
          <div key={sec.id} className="vk-section">
            <p className="vk-section-label" id={`vk-sec-${sec.id}`}>{sec.titulo}</p>
            <div className="vk-keys" role="group" aria-labelledby={`vk-sec-${sec.id}`}>
              {sec.teclas.map(t => {
                const c = mayus && t.mayus ? t.mayus : t.c
                return (
                  <button key={`${sec.id}-${t.c}`} type="button" data-kb-key className="vk-char-btn"
                    onMouseDown={sinRobarFoco}
                    onClick={e => onInsert(c, desdeTeclado(e))}
                    aria-label={`Insertar ${t.nombre}${mayus && t.mayus ? ' en mayúscula' : ''}`}
                    aria-keyshortcuts={t.atajo}
                    title={t.atajo ? `${t.nombre} (${t.atajo})` : t.nombre}>
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <p className="vk-hint">
          Atajos en el campo de texto: <kbd>Alt</kbd>+<kbd>U</kbd> ʉ · <kbd>Alt</kbd>+<kbd>J</kbd> ɉ · <kbd>Alt</kbd>+<kbd>N</kbd> ñ · <kbd>Alt</kbd>+<kbd>I</kbd> ɨ · <kbd>Alt</kbd>+<kbd>'</kbd> ’ · <kbd>Alt</kbd>+<kbd>T</kbd> tilde (con <kbd>Mayús</kbd> salen en mayúscula).
          Con el teclado, muévete entre teclas con las flechas.
        </p>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{aviso}</p>
    </div>
  )
}

// ── Botón para abrir/cerrar ──────────────────────────────────────────────────

interface SpecialKeyboardToggleProps {
  open: boolean
  onToggle: () => void
  className?: string
}

export function SpecialKeyboardToggle({ open, onToggle, className = '' }: SpecialKeyboardToggleProps) {
  return (
    <button
      className={`glosario-kb-toggle${open ? ' glosario-kb-toggle-active' : ''} ${className}`}
      onClick={onToggle}
      aria-label={open ? 'Cerrar teclado de caracteres especiales' : 'Abrir teclado de caracteres especiales'}
      aria-expanded={open}
      type="button"
    >
      <Keyboard size={16} aria-hidden="true" />
      <span>Caracteres especiales</span>
      <ChevronDown
        size={14}
        aria-hidden="true"
        style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
      />
    </button>
  )
}
