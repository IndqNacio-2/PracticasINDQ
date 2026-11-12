export type StaffRole = "administrador" | "recepcion" | "vendedor" | "entrenador"

export interface SessionUser {
  idUsuario: string
  nombre: string
  apellidos: string
  correo: string
  rol: StaffRole
  estatus: "activo" | "inactivo"
  telefono?: string
  codigoAcceso?: string
  fechaCreacion?: string
}

export const SESSION_KEY = "administrativa_sesion"
export const TOKEN_KEY = "token"
export const LOGIN_PATH = "/administrativa/login"

export const MODULE_BY_ROLE: Partial<Record<StaffRole, string>> = {
  administrador: "/administrativa/dashboard",
  recepcion: "/cobro/front-desk/dashboard",
  vendedor: "/",
}

export function getModulePath(role: StaffRole): string | null {
  return MODULE_BY_ROLE[role] ?? null
}

export function saveSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export function getStoredUser(): SessionUser | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const rawUser = localStorage.getItem(SESSION_KEY)

    if (!token || !rawUser) {
      clearSession()
      return null
    }

    const user = JSON.parse(rawUser) as SessionUser
    if (!user.idUsuario || user.estatus !== "activo" || !user.rol) {
      clearSession()
      return null
    }

    return user
  } catch {
    clearSession()
    return null
  }
}