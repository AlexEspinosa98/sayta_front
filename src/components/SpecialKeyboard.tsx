import { useState, useCallback, useEffect, RefObject } from 'react'
import { Delete, Keyboard, ChevronDown } from 'lucide-react'

// ── Alphabet data ─────────────────────────────────────────────────────────────

interface CharGroup { label: string; chars: { char: string }[] }
interface Section   { title: string; groups: CharGroup[] }

export const ALPHABET: Section[] = [
  {
    title: 'Vocales',
    groups: [
      { label: 'a', chars: [{ char: 'a' }, { char: 'A' }, { char: 'á' }, { char: 'Á' }] },
      { label: 'e', chars: [{ char: 'e' }, { char: 'E' }, { char: 'é' }, { char: 'É' }] },
      { label: 'i', chars: [{ char: 'i' }, { char: 'I' }, { char: 'í' }, { char: 'Í' }] },
      { label: 'o', chars: [{ char: 'o' }, { char: 'O' }, { char: 'ó' }, { char: 'Ó' }] },
      {
        label: 'u / ʉ',
        chars: [
          { char: 'u' }, { char: 'U' }, { char: 'ú' }, { char: 'Ú' },
          { char: 'ʉ' }, { char: 'Ʉ' }, { char: 'ʉ́' },
        ],
      },
      { label: 'y', chars: [{ char: 'y' }, { char: 'Y' }] },
    ],
  },
  {
    title: 'Consonantes',
    groups: [
      { label: 'b',         chars: [{ char: 'b' },  { char: 'B' }] },
      { label: 'ch',        chars: [{ char: 'ch' }, { char: 'Ch' }, { char: 'CH' }] },
      { label: 'd',         chars: [{ char: 'd' },  { char: 'D' }] },
      { label: 'g',         chars: [{ char: 'g' },  { char: 'G' }] },
      { label: 'j',         chars: [{ char: 'j' },  { char: 'J' }] },
      { label: 'ɟ cortada', chars: [{ char: 'ɟ' }, { char: 'Ɉ' }] },
      { label: 'k',         chars: [{ char: 'k' },  { char: 'K' }] },
      { label: 'm',         chars: [{ char: 'm' },  { char: 'M' }] },
      { label: 'n',         chars: [{ char: 'n' },  { char: 'N' }] },
      { label: 'p',         chars: [{ char: 'p' },  { char: 'P' }] },
      { label: 'r',         chars: [{ char: 'r' },  { char: 'R' }] },
      { label: 's',         chars: [{ char: 's' },  { char: 'S' }] },
      { label: 't',         chars: [{ char: 't' },  { char: 'T' }] },
      { label: 'w',         chars: [{ char: 'w' },  { char: 'W' }] },
      { label: 'z',         chars: [{ char: 'z' },  { char: 'Z' }] },
      { label: 'zh',        chars: [{ char: 'zh' }, { char: 'Zh' }, { char: 'ZH' }] },
      { label: "' glotal",  chars: [{ char: "'" }] },
    ],
  },
  {
    title: 'Puntuación',
    groups: [
      { label: 'guión', chars: [{ char: '-' }, { char: '–' }] },
      { label: 'coma',  chars: [{ char: ',' }, { char: ';' }] },
      { label: 'punto', chars: [{ char: '.' }, { char: ':' }] },
    ],
  },
]

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpecialKeyboard(
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  value: string,
  onChange: (v: string) => void,
) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const insertAtCursor = useCallback((chars: string) => {
    const el = inputRef.current
    if (!el) { onChange(value + chars); return }
    const start = el.selectionStart ?? 0
    const end   = el.selectionEnd   ?? 0
    const next  = value.slice(0, start) + chars + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + chars.length, start + chars.length)
    })
  }, [inputRef, value, onChange])

  const deleteChar = useCallback(() => {
    const el = inputRef.current
    if (!el) { onChange(value.slice(0, -1)); return }
    const start = el.selectionStart ?? 0
    const end   = el.selectionEnd   ?? 0
    let next: string, pos: number
    if (start !== end) {
      next = value.slice(0, start) + value.slice(end); pos = start
    } else if (start > 0) {
      const arr = [...value.slice(0, start)]
      const len = arr[arr.length - 1]?.length ?? 1
      next = value.slice(0, start - len) + value.slice(end); pos = start - len
    } else { return }
    onChange(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos) })
  }, [inputRef, value, onChange])

  const openKeyboard = useCallback(() => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [inputRef])

  return { open, setOpen, openKeyboard, insertAtCursor, deleteChar }
}

// ── Inline panel ─────────────────────────────────────────────────────────────

interface SpecialKeyboardPanelProps {
  open: boolean
  onClose: () => void
  onInsert: (c: string) => void
  onDelete: () => void
  onSpace: () => void
  onEnter?: () => void
  title?: string
}

export function SpecialKeyboardPanel({
  open, onInsert, onDelete, onSpace, onEnter,
}: SpecialKeyboardPanelProps) {
  if (!open) return null
  return (
    <div className="vk-inline" role="group" aria-label="Teclado de caracteres especiales">
      <div className="vk-quick-actions">
        <button className="vk-action-btn" onClick={onDelete} type="button" aria-label="Borrar">
          <Delete size={13} aria-hidden="true" /> Borrar
        </button>
        <button className="vk-action-btn" onClick={onSpace} type="button" aria-label="Espacio">
          Espacio
        </button>
        {onEnter && (
          <button className="vk-action-btn" onClick={onEnter} type="button" aria-label="Nueva línea">
            ↵ Enter
          </button>
        )}
      </div>
      <div className="vk-inline-body">
        {ALPHABET.map(section => (
          <div key={section.title} className="vk-section">
            <p className="vk-section-label">{section.title}</p>
            <div className="vk-groups">
              {section.groups.map(group => (
                <div key={group.label} className="vk-group">
                  <span className="vk-group-label">{group.label}</span>
                  <div className="vk-group-chars">
                    {group.chars.map((c, i) => (
                      <button
                        key={i}
                        className="vk-char-btn"
                        onClick={() => onInsert(c.char)}
                        aria-label={`Insertar ${c.char}`}
                        type="button"
                      >
                        {c.char}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Toggle button ─────────────────────────────────────────────────────────────

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
      aria-label={open ? 'Cerrar teclado' : 'Abrir teclado de caracteres especiales'}
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
