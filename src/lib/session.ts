// Sesión del personal. La crea la API administrativa (POST /admin/api/auth/login) y vale para todos los módulos.
export type Rol = 'administrador' | 'recepcion' | 'vendedor' | 'entrenador' | 'checador';

export interface Usuario {
  idUsuario: string;
  nombre: string;
  apellidos: string;
  correo: string;
  rol: Rol;
  estatus: 'activo' | 'inactivo';
  telefono?: string;
  codigoAcceso?: string;
  foto?: string;
  fechaCreacion?: string;
}

export const TOKEN_KEY = 'token';
export const SESSION_KEY = 'nuucleo_sesion';
export const LOGIN_PATH = '/login';

export const ROL_NOMBRE: Record<Rol, string> = {
  administrador: 'Administrador',
  recepcion: 'Recepción',
  vendedor: 'Vendedor',
  entrenador: 'Entrenador',
  checador: 'Checador',
};

export function guardarSesion(token: string, usuario: Usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
}

export function cerrarSesion(motivo?: 'inactividad') {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  if (motivo) sessionStorage.setItem('nuucleo_motivo_salida', motivo);
}

export function token(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function usuarioGuardado(): Usuario | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw || !token()) return null;
    return JSON.parse(raw) as Usuario;
  } catch {
    return null;
  }
}

/* ---------- Módulos por rol ----------
   Todos los registros son compartidos: el menú decide a qué módulos entra cada rol.
   Clientes            → administrador, recepción, vendedor (y el propio cliente en la app)
   Inventario          → administrador, recepción (consulta), vendedor
   Movimientos         → administrador, vendedor
   Usuarios            → administrador
   Clases y horarios   → administrador, recepción
   Membresías          → administrador, recepción (recepción vende membresías en el front desk)
   Reservaciones       → administrador, recepción
   Reportes            → administrador
   Recepción           → recepción
   Venta               → vendedor
   Merma               → administrador, vendedor
   Corte de caja       → administrador, vendedor
   Checador            → solo el usuario de tipo checador (no aparece en ningún menú) */
export type Modulo =
  | 'dashboard' | 'recepcion' | 'venta' | 'usuarios' | 'clientes' | 'clases' | 'membresias'
  | 'reservaciones' | 'inventario' | 'movimientos' | 'merma' | 'corte' | 'reportes' | 'checador';

export const MODULOS_POR_ROL: Record<Rol, Modulo[]> = {
  administrador: ['dashboard', 'usuarios', 'clientes', 'clases', 'membresias', 'reservaciones', 'inventario', 'movimientos', 'merma', 'corte', 'reportes'],
  recepcion: ['recepcion', 'clientes', 'clases', 'membresias', 'reservaciones', 'inventario'],
  vendedor: ['venta', 'clientes', 'inventario', 'movimientos', 'merma', 'corte'],
  checador: ['checador'],
  entrenador: [],
};

export const puede = (rol: Rol | undefined, modulo: Modulo) => !!rol && MODULOS_POR_ROL[rol].includes(modulo);
export const inicioDe = (rol: Rol) => `/${MODULOS_POR_ROL[rol][0] ?? 'login'}`;
