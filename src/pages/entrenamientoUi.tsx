import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { apiFetch } from '../api'

/**
 * Piezas compartidas del módulo de entrenamiento: glosario en español, botón «i» con la explicación
 * de cada valor, formato de métricas y apertura de MLflow.
 */

export type TipoValor = 'pct' | 'num' | 'seg' | 'texto' | 'bool'

export interface EntradaGlosario {
  nombre: string
  desc: string
  /** Cómo leerlo / valores de referencia */
  lectura?: string
  tipo?: TipoValor
}

// ── Configuración del entrenamiento (lo que TÚ eliges) ───────────────────────

export const CONFIG: Record<string, EntradaGlosario> = {
  num_train_epochs: {
    nombre: 'Épocas',
    desc: 'Cuántas veces el modelo recorre TODOS los audios de entrenamiento.',
    lectura: 'Pocas épocas → no alcanza a aprender. Demasiadas → memoriza los audios (sobreajuste). Con pocos datos suele ir bien entre 10 y 30; vigila que la pérdida de validación no empiece a subir.',
  },
  per_device_train_batch_size: {
    nombre: 'Tamaño de lote',
    desc: 'Cuántos audios procesa a la vez antes de calcular el error.',
    lectura: 'En la GPU del servidor Whisper se limita a 1 para no quedarse sin memoria; se compensa con la acumulación de gradiente.',
  },
  per_device_eval_batch_size: {
    nombre: 'Tamaño de lote en evaluación',
    desc: 'Cuántos audios procesa a la vez cuando mide el WER/CER/PER.',
  },
  gradient_accumulation_steps: {
    nombre: 'Acumulación de gradiente',
    desc: 'Junta el error de varios lotes antes de actualizar el modelo. Lote efectivo = tamaño de lote × acumulación.',
    lectura: 'Con lote 1 y acumulación 8, el modelo aprende como si usara 8 audios a la vez, con la memoria de 1.',
  },
  learning_rate: {
    nombre: 'Tasa de aprendizaje',
    desc: 'El tamaño del paso con que se corrige el modelo en cada actualización.',
    lectura: 'Muy alta → el entrenamiento se vuelve inestable (la pérdida salta o no baja). Muy baja → casi no aprende. Referencia: 1e-5 para ajustar todo Whisper; entre 1e-4 y 5e-4 con LoRA. Un valor de 1e-3 con LoRA suele ser demasiado agresivo.',
  },
  warmup_steps: {
    nombre: 'Pasos de calentamiento',
    desc: 'Durante estos primeros pasos la tasa de aprendizaje sube poco a poco desde 0 hasta su valor, para no «golpear» al modelo al inicio.',
  },
  weight_decay: {
    nombre: 'Decaimiento de pesos',
    desc: 'Penalización suave a los pesos grandes (regularización). Ayuda a evitar el sobreajuste.',
  },
  use_peft: {
    nombre: 'LoRA (PEFT)',
    desc: 'En lugar de reajustar todo el modelo, entrena un «adaptador» pequeño encima de él.',
    lectura: 'Usa mucha menos memoria y el resultado es un archivo ligero. Es lo que se usa con Whisper small/medium en este servidor.',
  },
  peft_r: {
    nombre: 'Rango de LoRA (r)',
    desc: 'Tamaño del adaptador LoRA: a mayor r, más capacidad de aprender y más memoria.',
    lectura: 'Valores habituales: 8, 16 o 32.',
  },
  peft_alpha: {
    nombre: 'Alfa de LoRA',
    desc: 'Cuánto pesa el adaptador sobre el modelo original. Suele ser el doble de r.',
  },
  fp16: {
    nombre: 'Precisión mixta (fp16)',
    desc: 'Hace los cálculos con números de 16 bits: va más rápido y gasta menos memoria de GPU casi sin perder calidad.',
  },
  gradient_checkpointing: {
    nombre: 'Checkpointing de gradientes',
    desc: 'Recalcula parte de los datos intermedios en vez de guardarlos: ahorra memoria de GPU a cambio de un poco más de tiempo.',
  },
  whisper_language: {
    nombre: 'Idioma de Whisper',
    desc: 'Idioma con el que Whisper arranca el decodificador. Las lenguas indígenas no existen en Whisper, por eso se usa el idioma más cercano (normalmente «es», español).',
  },
  augmentation: {
    nombre: 'Aumento de datos',
    desc: 'Genera copias de los audios con pequeñas alteraciones (ruido, velocidad, volumen…) para que el modelo se vuelva más robusto cuando hay pocos datos.',
  },
  reentrenado_de: {
    nombre: 'Reentrenado de',
    desc: 'Experimento del que se tomaron los pesos de partida. Si está vacío, se partió del modelo base de HuggingFace.',
  },
  base_lengua: {
    nombre: 'Lengua del modelo de partida',
    desc: 'Aparece cuando el modelo de partida se entrenó con OTRA lengua (transferencia entre lenguas).',
  },
  modelo_inicial_ruta: { nombre: 'Carpeta del modelo de partida', desc: 'Dónde está en el servidor el modelo desde el que se continuó.' },
  depende_de_ruta: { nombre: 'Depende de', desc: 'Carpeta que este modelo necesita para funcionar; no se puede borrar mientras exista este experimento.' },
  clear_asr_cache_before_training: { nombre: 'Limpiar caché antes de entrenar', desc: 'Libera memoria de GPU y modelos cargados antes de empezar.' },
  allow_full_finetune: { nombre: 'Permitir ajuste completo', desc: 'Desactiva la protección que fuerza LoRA y lote 1 en modelos Whisper grandes.' },
  use_cv: { nombre: 'Validación cruzada', desc: 'En vez de una sola separación entrenamiento/evaluación, repite el entrenamiento en varios «folds». Es más fiable pero tarda varias veces más.' },
  cv_folds: { nombre: 'Número de folds', desc: 'En cuántas partes se divide el conjunto en la validación cruzada.' },
  mlflow_tracking_uri: { nombre: 'Ubicación de MLflow', desc: 'Base de datos donde MLflow guarda las métricas de este entrenamiento.' },
}

// ── Valores que se miden (lo que el entrenamiento TE DICE) ───────────────────

export const METRICAS: Record<string, EntradaGlosario> = {
  eval_wer: {
    nombre: 'WER · error de palabras',
    tipo: 'pct',
    desc: 'Porcentaje de palabras que el modelo transcribió mal en los audios de evaluación (los que NO vio al entrenar). Cuenta palabras sustituidas, omitidas e insertadas.',
    lectura: '0 % = perfecto. Menos de 30 % es bueno, entre 30 y 50 % es aceptable y más de 50 % es pobre. Puede pasar de 100 %. Es una medida estricta: una letra mal en una palabra la cuenta como palabra entera mal.',
  },
  eval_cer: {
    nombre: 'CER · error de caracteres',
    tipo: 'pct',
    desc: 'Igual que el WER pero contando letras en vez de palabras: cuántos caracteres hay que cambiar, borrar o añadir para igualar el texto correcto.',
    lectura: 'Siempre es menor o igual que el WER. Es más justo en lenguas con palabras largas o ortografía poco fija, porque «casi acertó» cuenta como casi. Referencia: menos de 15 % muy bueno, 15–30 % útil, más de 30 % pobre.',
  },
  eval_per: {
    nombre: 'PER · error de fonemas (aprox.)',
    tipo: 'pct',
    desc: 'Mide errores a nivel de sonidos. Como estas lenguas no tienen un conversor de texto a fonemas, se calcula de forma aproximada sobre las unidades de la escritura: «ch», «ll», «rr», «ts», «ng», «kw»… cuentan como UN solo sonido y las tildes se pegan a su letra; no se cuentan espacios ni signos.',
    lectura: 'Se lee como el CER pero sin penalizar de más los dígrafos. Sirve para comparar modelos de la misma lengua entre sí; no es comparable con el PER de otros estudios.',
  },
  eval_loss: {
    nombre: 'Pérdida de validación',
    tipo: 'num',
    desc: 'El error interno del modelo medido sobre audios que no vio al entrenar. Es el número que de verdad dice si está generalizando.',
    lectura: 'Debe bajar. Si la pérdida de entrenamiento sigue bajando pero esta empieza a subir, el modelo está memorizando (sobreajuste): conviene parar antes o usar menos épocas.',
  },
  train_loss: {
    nombre: 'Pérdida media de entrenamiento',
    tipo: 'num',
    desc: 'Promedio del error del modelo sobre los audios con los que aprende, a lo largo de todo el entrenamiento.',
    lectura: 'Sirve para comparar entrenamientos con la misma configuración; no es un porcentaje.',
  },
  loss: {
    nombre: 'Pérdida de entrenamiento (actual)',
    tipo: 'num',
    desc: 'El error del modelo en los últimos pasos. Es lo que el entrenamiento intenta hacer más pequeño.',
    lectura: 'Al inicio es alta y debe descender con las épocas. Si sube y baja a saltos o se queda en un valor alto, revisa la tasa de aprendizaje.',
  },
  grad_norm: {
    nombre: 'Norma del gradiente',
    tipo: 'num',
    desc: 'Qué tan fuerte es la corrección que recibe el modelo en cada paso.',
    lectura: 'Valores estables y pequeños son buena señal. Picos muy grandes y repetidos indican inestabilidad (tasa de aprendizaje alta).',
  },
  learning_rate: CONFIG.learning_rate,
  total_steps: {
    nombre: 'Pasos totales',
    tipo: 'num',
    desc: 'Cuántas veces se actualizaron los pesos del modelo. Pasos = audios de entrenamiento × épocas ÷ lote efectivo.',
  },
  epochs: { nombre: 'Épocas', tipo: 'num', desc: CONFIG.num_train_epochs.desc },
  runtime_segundos: {
    nombre: 'Tiempo de entrenamiento',
    tipo: 'seg',
    desc: 'Cuánto tardó el entrenamiento propiamente dicho (sin contar la preparación de datos ni la evaluación final).',
    lectura: 'En entrenamientos anteriores a este cambio, este valor era en realidad el tiempo de la evaluación final.',
  },
  eval_runtime_segundos: { nombre: 'Tiempo de evaluación final', tipo: 'seg', desc: 'Cuánto tardó la medición final del WER/CER/PER sobre los audios de evaluación.' },
  estrategia: {
    nombre: 'Estrategia de validación',
    tipo: 'texto',
    desc: '«split_simple» separa una parte de los audios para evaluar y entrena con el resto. «cross_validation» repite el proceso en varios folds y promedia: es más fiable y mucho más lento.',
  },
  eval_wer_std: { nombre: 'WER · variación entre folds', tipo: 'pct', desc: 'Desviación estándar del WER entre folds (solo validación cruzada). Si es alta, el resultado depende mucho de qué audios cayeron en evaluación.' },
  eval_cer_std: { nombre: 'CER · variación entre folds', tipo: 'pct', desc: 'Desviación estándar del CER entre folds (solo validación cruzada).' },
  best_fold_wer: { nombre: 'WER del mejor fold', tipo: 'pct', desc: 'El WER más bajo conseguido en uno de los folds (solo validación cruzada).' },
  num_muestras_train: { nombre: 'Audios de entrenamiento', tipo: 'num', desc: 'Con cuántos audios aprende el modelo (incluye los fragmentos en que se cortan los audios largos y los generados por aumento de datos).' },
  num_muestras_eval: { nombre: 'Audios de evaluación', tipo: 'num', desc: 'Con cuántos audios se mide el WER/CER/PER. El modelo no los ve durante el entrenamiento.' },
  epoca: { nombre: 'Época', tipo: 'num', desc: 'Vuelta actual sobre el conjunto de entrenamiento. 0.5 = a la mitad de la primera vuelta.' },
  paso: { nombre: 'Paso', tipo: 'num', desc: 'Actualización actual del modelo sobre el total de pasos previstos.' },
  fase: { nombre: 'Fase', tipo: 'texto', desc: 'Preparando = leyendo audios y cargando el modelo. Entrenando = aprendiendo. Evaluando = midiendo WER/CER/PER al final de cada época. Finalizando = guardando el modelo.' },
  restante: { nombre: 'Tiempo restante estimado', tipo: 'seg', desc: 'Estimado a partir de la velocidad de los pasos ya hechos. Es aproximado: las evaluaciones al final de cada época añaden tiempo.' },
  latido: { nombre: 'Último latido', tipo: 'texto', desc: 'Cada pocos segundos el entrenamiento «avisa» que sigue vivo. Si pasan más de 10 minutos sin latido, se considera colgado.' },
}

export function nombreValor(clave: string): string {
  return (METRICAS[clave] ?? CONFIG[clave])?.nombre ?? clave.replace(/_/g, ' ')
}

export function esPorcentaje(clave: string): boolean {
  return METRICAS[clave]?.tipo === 'pct'
}

export function fmtDuracion(seg: number | null | undefined): string {
  if (seg == null || !isFinite(seg)) return '—'
  const s = Math.max(0, Math.round(seg))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min ${r} s`
  return `${r} s`
}

export function fmtNumero(v: unknown, tipo?: TipoValor): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v !== 'number') return String(v ?? '—')
  if (tipo === 'seg') return fmtDuracion(v)
  if (tipo === 'pct') return `${(v * 100).toFixed(1)} %`
  if (Number.isInteger(v)) return v.toLocaleString('es-CO')
  if (Math.abs(v) < 0.001 && v !== 0) return v.toExponential(2)
  return v.toFixed(4)
}

// ── Botón «i» ────────────────────────────────────────────────────────────────

export function InfoTip({ entrada, clave, children }: { entrada?: EntradaGlosario; clave?: string; children?: ReactNode }) {
  const e = entrada ?? (clave ? (METRICAS[clave] ?? CONFIG[clave]) : undefined)
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!abierto || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const ancho = Math.min(320, window.innerWidth - 24)
    let left = r.left + r.width / 2 - ancho / 2
    left = Math.max(12, Math.min(left, window.innerWidth - ancho - 12))
    let top = r.bottom + 8
    const alto = pop.current?.offsetHeight ?? 0
    if (alto && top + alto > window.innerHeight - 12) top = Math.max(12, r.top - alto - 8)
    setPos({ top, left })
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const cerrar = () => setAbierto(false)
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node
      if (!btn.current?.contains(t) && !pop.current?.contains(t)) cerrar()
    }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cerrar() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto])

  if (!e && !children) return null
  return (
    <>
      <button ref={btn} type="button" className={`info-tip${abierto ? ' info-tip--open' : ''}`}
        aria-label={`¿Qué es «${e?.nombre ?? 'este valor'}»?`} aria-expanded={abierto}
        onClick={ev => { ev.stopPropagation(); setAbierto(a => !a) }}>
        <Info size={13} />
      </button>
      {abierto && (
        <div ref={pop} className="info-tip-pop" role="dialog" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
          {e && <p className="info-tip-title">{e.nombre}</p>}
          {e && <p className="info-tip-text">{e.desc}</p>}
          {e?.lectura && <p className="info-tip-text info-tip-read"><strong>Cómo leerlo:</strong> {e.lectura}</p>}
          {children}
        </div>
      )}
    </>
  )
}

/** Etiqueta con su botón «i» */
export function Etiqueta({ clave, className }: { clave: string; className?: string }) {
  return <span className={className}>{nombreValor(clave)} <InfoTip clave={clave} /></span>
}

// ── Gráfico de línea mínimo (pérdida) ────────────────────────────────────────

export function Sparkline({ puntos, alto = 56 }: { puntos: [number, number][]; alto?: number }) {
  if (puntos.length < 2) return <p className="ent-hint">Aún no hay suficientes pasos para dibujar la curva.</p>
  const w = 280
  const xs = puntos.map(p => p[0]), ys = puntos.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  const sx = (x: number) => 4 + ((x - x0) / Math.max(1e-9, x1 - x0)) * (w - 8)
  const sy = (y: number) => 4 + (1 - (y - y0) / Math.max(1e-9, y1 - y0)) * (alto - 8)
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ')
  return (
    <svg className="ent-spark" viewBox={`0 0 ${w} ${alto}`} role="img"
      aria-label={`Curva de pérdida: de ${ys[0].toFixed(2)} a ${ys[ys.length - 1].toFixed(2)}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <text x="4" y="11" className="ent-spark-lbl">{y1.toFixed(2)}</text>
      <text x="4" y={alto - 2} className="ent-spark-lbl">{y0.toFixed(2)}</text>
    </svg>
  )
}

// ── MLflow ───────────────────────────────────────────────────────────────────

/** Pide la cookie de acceso (solo administradores) y abre MLflow, opcionalmente en un experimento/run concreto. */
export async function abrirMlflow(experimentId?: string, runId?: string): Promise<void> {
  await apiFetch('/entrenamiento/mlflow/acceso/', { method: 'POST', body: '{}' })
  const hash = experimentId ? `#/experiments/${experimentId}${runId ? `/runs/${runId}` : ''}` : ''
  window.open(`/mlflow/${hash}`, '_blank', 'noopener')
}
