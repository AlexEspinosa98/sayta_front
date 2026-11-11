import { useState } from 'react'
import { BarChart2, ExternalLink, Loader2 } from 'lucide-react'
import { apiErr } from '../api'
import { useAuth } from '../context/AuthContext'
import { CONFIG, METRICAS, abrirMlflow, type EntradaGlosario } from './entrenamientoUi'

/** Guía del módulo de entrenamiento: flujo, valores de configuración, métricas y MLflow. */

function Tabla({ filas }: { filas: [string, EntradaGlosario][] }) {
  return (
    <div className="ent-table-wrap">
      <table className="ent-table ent-table--sm guia-tabla">
        <thead><tr><th>Valor</th><th>Qué es</th><th>Cómo leerlo / qué poner</th></tr></thead>
        <tbody>
          {filas.map(([k, e]) => (
            <tr key={k}>
              <td className="ent-td-bold">{e.nombre}<div className="ent-hint"><code>{k}</code></div></td>
              <td>{e.desc}</td>
              <td>{e.lectura ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function EntrenamientoGuia() {
  const { permissions } = useAuth()
  const esAdmin = permissions.usuarios.gestionar
  const [abriendo, setAbriendo] = useState(false)
  const [err, setErr] = useState('')

  const abrir = async () => {
    setAbriendo(true); setErr('')
    try { await abrirMlflow() } catch (e) { setErr(apiErr(e, 'No se pudo abrir MLflow.')) }
    finally { setAbriendo(false) }
  }

  const config = ['num_train_epochs', 'per_device_train_batch_size', 'gradient_accumulation_steps', 'learning_rate',
    'warmup_steps', 'weight_decay', 'use_peft', 'peft_r', 'peft_alpha', 'fp16', 'gradient_checkpointing',
    'whisper_language', 'augmentation', 'use_cv', 'cv_folds'].map(k => [k, CONFIG[k]] as [string, EntradaGlosario])
  const progreso = ['fase', 'epoca', 'paso', 'loss', 'learning_rate', 'grad_norm', 'restante', 'latido']
    .map(k => [k, METRICAS[k]] as [string, EntradaGlosario])
  const resultado = ['eval_wer', 'eval_cer', 'eval_per', 'eval_loss', 'train_loss', 'total_steps', 'runtime_segundos',
    'eval_runtime_segundos', 'estrategia', 'eval_wer_std', 'best_fold_wer', 'num_muestras_train', 'num_muestras_eval']
    .map(k => [k, METRICAS[k]] as [string, EntradaGlosario])

  return (
    <div className="ent-section guia">
      <div className="ent-section-head">
        <div>
          <h2 className="ent-section-title">Guía del entrenamiento</h2>
          <p className="ent-section-sub">Qué hace cada pestaña y qué significa cada valor. En cualquier pantalla, el botón <strong>ⓘ</strong> junto a un valor muestra su explicación.</p>
        </div>
      </div>

      <section className="guia-bloque">
        <h3>1. Flujo de trabajo</h3>
        <ol className="guia-lista">
          <li><strong>Datos</strong>: revisa cuántos audios están transcritos (etiquetados) por comunidad y jornada. Solo los audios con transcripción sirven para entrenar.</li>
          <li><strong>Modelos</strong>: descarga el modelo base de HuggingFace (por ejemplo <em>whisper-small</em>).</li>
          <li><strong>Entrenar</strong>: elige la lengua, el <em>modelo base</em> (o un modelo ya entrenado de cualquier lengua como punto de partida), los datos y, si quieres, la configuración avanzada y el aumento de datos. Solo se puede entrenar uno a la vez.</li>
          <li><strong>Experimentos</strong>: sigue el entrenamiento en vivo (época, pérdida, tiempo restante) y, al terminar, compara los resultados WER / CER / PER de todos los entrenamientos. Desde ahí se <em>activa</em> el modelo que usará la transcripción.</li>
          <li><strong>Procesos</strong>: muestra los entrenamientos activos y si siguen vivos o se colgaron.</li>
          {esAdmin && <li><strong>Almacenamiento</strong>: libera disco borrando checkpoints o modelos viejos sin perder el registro ni las estadísticas.</li>}
        </ol>
      </section>

      <section className="guia-bloque">
        <h3>2. Configuración: lo que tú eliges antes de entrenar</h3>
        <p className="ent-hint">Estos son los valores de «Configuración avanzada». Los valores por defecto están pensados para la GPU del servidor (8 GB): rara vez hace falta tocarlos.</p>
        <Tabla filas={config} />
      </section>

      <section className="guia-bloque">
        <h3>3. Durante el entrenamiento: lo que ves en el monitor</h3>
        <Tabla filas={progreso} />
      </section>

      <section className="guia-bloque">
        <h3>4. Al terminar: las métricas del resultado</h3>
        <div className="guia-nota">
          <p><strong>WER, CER y PER miden lo mismo con distinta lupa.</strong> Se calculan sobre los audios de evaluación, que el modelo no vio al aprender:</p>
          <ul className="guia-lista">
            <li><strong>WER</strong> cuenta palabras. Es la más estricta: una letra mal y la palabra entera cuenta como error.</li>
            <li><strong>CER</strong> cuenta letras. Dice «qué tan cerca» estuvo; es la más útil cuando las palabras son largas o la ortografía varía.</li>
            <li><strong>PER</strong> cuenta sonidos. Aquí es <em>aproximado</em>: se obtiene de la escritura, tratando los dígrafos (<code>ch</code>, <code>ll</code>, <code>rr</code>, <code>ts</code>, <code>ng</code>, <code>kw</code>…) como un solo sonido y sin contar espacios ni signos. Úsalo para comparar modelos de la misma lengua, no con otros estudios.</li>
          </ul>
          <p>Un buen modelo tiene WER, CER y PER bajos <em>y</em> una pérdida de validación que dejó de bajar sin empezar a subir. Si el CER es bajo pero el WER es alto, el modelo suena bien pero se equivoca en detalles de escritura de cada palabra.</p>
        </div>
        <Tabla filas={resultado} />
      </section>

      <section className="guia-bloque">
        <h3>5. MLflow: ¿qué es y cómo se ve?</h3>
        <div className="guia-nota">
          <p><strong>MLflow es el «cuaderno de laboratorio» automático del entrenamiento.</strong> Cada vez que se entrena, SAYTA le entrega a MLflow lo que se usó y lo que pasó, y MLflow lo guarda para siempre, incluso si después se borra el modelo para liberar disco.</p>
          <p>Por cada entrenamiento (cada <em>run</em>) guarda:</p>
          <ul className="guia-lista">
            <li><strong>Parámetros</strong>: modelo base, lengua, épocas, tasa de aprendizaje, lote, LoRA, aumento de datos, de qué modelo se partió…</li>
            <li><strong>Métricas con su historia</strong>: pérdida de validación, WER, CER y PER <em>al final de cada época</em>, para ver la curva de aprendizaje completa.</li>
            <li><strong>Artefactos</strong>: el archivo con la configuración usada (y el resumen de folds en validación cruzada).</li>
          </ul>
          <p><strong>Para qué sirve:</strong> comparar entrenamientos entre sí (¿mejoró el kogui v4 respecto al v3?), ver si un modelo empezó a memorizar, y entender qué se cambió entre un intento bueno y uno malo.</p>
          <p><strong>Cómo verlo:</strong></p>
          <ol className="guia-lista">
            <li>Es solo para administradores. {esAdmin ? 'Pulsa el botón de abajo (también está en la pestaña Almacenamiento y, por experimento, en Experimentos → detalle).' : 'Si lo necesitas, pide a un administrador que te lo muestre.'}</li>
            <li>A la izquierda aparecen los <strong>experimentos de MLflow</strong>, uno por lengua: <code>sayta-asr-&lt;código de la lengua&gt;</code>.</li>
            <li>Dentro verás una tabla con un run por entrenamiento. Marca varios y pulsa <strong>Compare</strong> para ver sus métricas lado a lado.</li>
            <li>Abre un run y entra a <strong>Model metrics</strong> para ver las curvas de <code>eval_wer</code>, <code>eval_cer</code>, <code>eval_per</code> y <code>eval_loss</code> por paso.</li>
          </ol>
          {esAdmin && (
            <button type="button" className="ent-btn ent-btn--primary" onClick={abrir} disabled={abriendo}>
              {abriendo ? <Loader2 size={13} className="spin" /> : <BarChart2 size={13} />} Abrir MLflow <ExternalLink size={11} />
            </button>
          )}
          {err && <p className="ent-err-sm">{err}</p>}
        </div>
      </section>

      <section className="guia-bloque">
        <h3>6. Borrar modelos sin perder la historia</h3>
        <p className="ent-hint">
          Un entrenamiento ocupa mucho disco (checkpoints y modelo final). {esAdmin ? 'En la pestaña Almacenamiento' : 'Un administrador, desde la pestaña Almacenamiento,'} puede
          borrar solo los checkpoints o el modelo completo. El experimento y todas sus métricas (WER/CER/PER, MLflow) se conservan; lo único que se pierde al borrar
          el modelo completo es la posibilidad de activarlo, usarlo para transcribir o reentrenarlo.
        </p>
      </section>
    </div>
  )
}
