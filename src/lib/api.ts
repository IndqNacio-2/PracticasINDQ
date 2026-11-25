// Llamadas al backend unificado (gateway, puerto 3000). Vite reenvía /admin/api, /cobro/api y /pos/api.
//   admin → clientes, usuarios, clases, horarios, membresías, reservaciones, inventario, reportes (MongoDB + Postgres)
//   cobro → cobros de recepción, compras de membresía, KPIs, checador (PostgreSQL)
//   pos   → ventas, mermas y cortes de caja del punto de venta (PostgreSQL)
import { cerrarSesion, LOGIN_PATH, token } from './session';

export class ApiError extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
  }
}

export const EVENTO_DATOS = 'nu:datos-actualizados';

async function pedir<T>(base: string, ruta: string, opciones: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisa que el backend esté encendido.', 0);
  }
  if (!res.ok) {
    let mensaje = `El servidor respondió con el estado ${res.status}.`;
    try {
      const cuerpo = await res.json();
      mensaje = cuerpo?.errors?.[0]?.message ?? cuerpo?.error ?? cuerpo?.message ?? mensaje;
    } catch { /* sin cuerpo JSON */ }
    // Sesión vencida: se limpia y se regresa al login (salvo en el propio login).
    if (res.status === 401 && !ruta.startsWith('/auth/') && window.location.pathname !== LOGIN_PATH) {
      cerrarSesion();
      window.location.assign(LOGIN_PATH);
    }
    throw new ApiError(mensaje, res.status);
  }
  const metodo = (opciones.method ?? 'GET').toUpperCase();
  if (metodo !== 'GET') window.dispatchEvent(new Event(EVENTO_DATOS));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function cliente(base: string) {
  const cuerpo = (b: unknown) => (b === undefined ? undefined : JSON.stringify(b));
  return {
    get: <T>(r: string) => pedir<T>(base, r),
    post: <T>(r: string, b?: unknown) => pedir<T>(base, r, { method: 'POST', body: cuerpo(b) }),
    put: <T>(r: string, b?: unknown) => pedir<T>(base, r, { method: 'PUT', body: cuerpo(b) }),
    patch: <T>(r: string, b?: unknown) => pedir<T>(base, r, { method: 'PATCH', body: cuerpo(b) }),
    del: <T>(r: string, b?: unknown) => pedir<T>(base, r, { method: 'DELETE', body: cuerpo(b) }),
  };
}

export const admin = cliente('/admin/api');
export const cobro = cliente('/cobro/api');
export const pos = cliente('/pos');

export const mensajeError = (e: unknown, porDefecto = 'No se pudo completar la operación.') =>
  e instanceof Error && e.message ? e.message : porDefecto;
