// Matriz de permisos por rol — refleja la tabla documentada en las Historias de
// Usuario del sistema de autenticación (Épica 7) y de monitoreo (Épica 9). El
// backend es la autoridad real (todo se re-valida ahí y responde 403 si
// corresponde); esta matriz solo controla qué ve/puede intentar el usuario
// en la interfaz.

export interface Permissions {
  glosario: { leer: boolean; crear: boolean; editar: boolean; eliminar: boolean; cargaMasiva: boolean }
  embeddings: { leer: boolean; generarActivar: boolean }
  datasetAudio: { leer: boolean; subir: boolean; etiquetar: boolean }
  modelosAsr: {
    leer: boolean; descargar: boolean; entrenar: boolean; activarCancelar: boolean
    liberarMemoria: boolean; verProgreso: boolean; reiniciarBackend: boolean
  }
  transcripcion: boolean
  traduccion: boolean
  usuarios: { gestionar: boolean }
}

export type DynamicPermissionInput =
  | string[]
  | Array<{ modulo?: string; modulo_codigo?: string; accion?: string; codigo?: string; permiso?: string }>
  | Record<string, unknown>

function emptyPermissions(): Permissions {
  return {
  glosario: { leer: false, crear: false, editar: false, eliminar: false, cargaMasiva: false },
  embeddings: { leer: false, generarActivar: false },
  datasetAudio: { leer: false, subir: false, etiquetar: false },
  modelosAsr: {
    leer: false, descargar: false, entrenar: false, activarCancelar: false,
    liberarMemoria: false, verProgreso: false, reiniciarBackend: false,
  },
  transcripcion: false,
  traduccion: false,
  usuarios: { gestionar: false },
  }
}

const NONE: Permissions = emptyPermissions()

const GESTOR: Permissions = {
  glosario: { leer: true, crear: true, editar: true, eliminar: true, cargaMasiva: true },
  embeddings: { leer: true, generarActivar: true },
  datasetAudio: { leer: true, subir: true, etiquetar: true },
  modelosAsr: {
    leer: true, descargar: true, entrenar: true, activarCancelar: true,
    liberarMemoria: true, verProgreso: true, reiniciarBackend: false,
  },
  transcripcion: true,
  traduccion: true,
  usuarios: { gestionar: false },
}

const ANOTADOR: Permissions = {
  ...GESTOR,
  glosario: { leer: true, crear: false, editar: false, eliminar: false, cargaMasiva: false },
  embeddings: { leer: true, generarActivar: false },
  modelosAsr: {
    leer: true, descargar: false, entrenar: false, activarCancelar: false,
    liberarMemoria: false, verProgreso: true, reiniciarBackend: false,
  },
}

const CONSULTOR: Permissions = {
  ...NONE,
  glosario: { ...NONE.glosario, leer: true },
  embeddings: { ...NONE.embeddings, leer: true },
  datasetAudio: { ...NONE.datasetAudio, leer: true },
  modelosAsr: { ...NONE.modelosAsr, leer: true },
  transcripcion: true,
  traduccion: true,
}

// Colaborador de comunidad (kogui/arhuaco): solo ver/etiquetar audios y
// editar el glosario — nunca crear, eliminar, ni acceder a ASR/traducción.
const COLABORADOR_LENGUA: Permissions = {
  ...NONE,
  glosario: { leer: true, crear: false, editar: true, eliminar: false, cargaMasiva: false },
  datasetAudio: { leer: true, subir: false, etiquetar: true },
}

// Rol por defecto del auto-registro público (`POST /api/auth/registro-publico/`).
// Cero permisos — solo puede loguearse y ver su propio perfil, hasta que un
// admin le asigne un rol real.
const PENDIENTE: Permissions = { ...NONE }

export const ROLE_MATRIX: Record<string, Permissions> = {
  admin: GESTOR,
  desarrollador: GESTOR,
  investigador: GESTOR,
  anotador: ANOTADOR,
  consultor: CONSULTOR,
  colaborador_lengua: COLABORADOR_LENGUA,
  pendiente: PENDIENTE,
}

// admin es el único con gestión de usuarios/roles y con permiso de reiniciar el backend.
export const ROLE_MATRIX_RESOLVED: Record<string, Permissions> = {
  ...ROLE_MATRIX,
  admin: {
    ...GESTOR,
    modelosAsr: { ...GESTOR.modelosAsr, reiniciarBackend: true },
    usuarios: { gestionar: true },
  },
}

export const ROLES_REGISTRABLES: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'desarrollador', label: 'Desarrollador' },
  { value: 'investigador', label: 'Investigador' },
  { value: 'anotador', label: 'Anotador' },
  { value: 'consultor', label: 'Consultor' },
  { value: 'colaborador_lengua', label: 'Colaborador de lengua' },
  { value: 'pendiente', label: 'Pendiente (sin permisos)' },
]

/**
 * Devuelve la matriz de permisos para un rol. Un rol desconocido (creado
 * dinámicamente por un admin, o legado) recibe el nivel más bajo — el
 * backend es quien decide de verdad qué se le permite hacer.
 */
export function getPermissions(rol: string | null | undefined): Permissions {
  if (!rol) return NONE
  return ROLE_MATRIX_RESOLVED[rol] ?? NONE
}

function normalizeModulo(modulo: string) {
  return modulo.replace(/-/g, '_')
}

function applyPermission(target: Permissions, moduloRaw: string, actionRaw: string) {
  const modulo = normalizeModulo(moduloRaw)
  const action = actionRaw.replace(/-/g, '_')

  if (modulo === 'glosario') {
    if (action === 'ver' || action === 'leer') target.glosario.leer = true
    if (action === 'crear') target.glosario.crear = true
    if (action === 'editar') target.glosario.editar = true
    if (action === 'eliminar') target.glosario.eliminar = true
    if (action === 'carga_masiva') target.glosario.cargaMasiva = true
  }

  if (modulo === 'embeddings') {
    if (action === 'ver' || action === 'leer') target.embeddings.leer = true
    if (['generar_activar', 'generar', 'activar'].includes(action)) target.embeddings.generarActivar = true
  }

  if (modulo === 'dataset_audio') {
    if (action === 'ver' || action === 'leer') target.datasetAudio.leer = true
    if (action === 'subir') target.datasetAudio.subir = true
    if (action === 'etiquetar') target.datasetAudio.etiquetar = true
  }

  if (modulo === 'modelos_asr') {
    if (action === 'ver' || action === 'leer') target.modelosAsr.leer = true
    if (action === 'descargar') target.modelosAsr.descargar = true
    if (action === 'entrenar') target.modelosAsr.entrenar = true
    if (['activar_cancelar', 'activar', 'cancelar'].includes(action)) target.modelosAsr.activarCancelar = true
    if (action === 'liberar_memoria') target.modelosAsr.liberarMemoria = true
    if (action === 'ver_progreso') target.modelosAsr.verProgreso = true
    if (action === 'reiniciar_backend') target.modelosAsr.reiniciarBackend = true
  }

  if (modulo === 'transcripcion' && ['ejecutar', 'ver', 'leer'].includes(action)) {
    target.transcripcion = true
  }

  if (modulo === 'traduccion' && ['ejecutar', 'ver', 'leer'].includes(action)) {
    target.traduccion = true
  }

  if (modulo === 'usuarios' && ['gestionar_roles', 'gestionar', 'ver', 'leer'].includes(action)) {
    target.usuarios.gestionar = true
  }
}

function permissionsFromList(permisos: DynamicPermissionInput): Permissions | null {
  if (!Array.isArray(permisos)) return null

  const parsed = emptyPermissions()
  let found = false

  for (const item of permisos) {
    if (typeof item === 'string') {
      const [modulo, action] = item.split('.')
      if (modulo && action) {
        applyPermission(parsed, modulo, action)
        found = true
      }
      continue
    }

    const modulo = item.modulo_codigo ?? item.modulo
    const action = item.codigo ?? item.accion ?? item.permiso
    if (modulo && action) {
      applyPermission(parsed, modulo, action)
      found = true
    }
  }

  return found ? parsed : null
}

function permissionsFromObject(permisos: DynamicPermissionInput): Permissions | null {
  if (Array.isArray(permisos) || typeof permisos !== 'object' || permisos === null) return null

  const parsed = emptyPermissions()
  let found = false

  Object.entries(permisos).forEach(([modulo, actions]) => {
    if (Array.isArray(actions)) {
      actions.forEach(action => {
        if (typeof action === 'string') {
          applyPermission(parsed, modulo, action)
          found = true
        }
      })
      return
    }

    if (typeof actions === 'object' && actions !== null) {
      Object.entries(actions as Record<string, unknown>).forEach(([action, enabled]) => {
        if (enabled) {
          applyPermission(parsed, modulo, action)
          found = true
        }
      })
    }
  })

  return found ? parsed : null
}

export function resolvePermissions(
  rol: string | null | undefined,
  permisos?: DynamicPermissionInput,
): Permissions {
  if (permisos) {
    return permissionsFromList(permisos) ?? permissionsFromObject(permisos) ?? getPermissions(rol)
  }
  return getPermissions(rol)
}
