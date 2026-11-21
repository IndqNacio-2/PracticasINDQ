// Cliente HTTP centralizado para consumir la API real.
// El backend unificado (gateway, puerto 3000) monta cada módulo bajo su prefijo:
//   /admin/api -> API administrativa (MongoDB): clientes, reservaciones, horarios, ventas, etc.
//   /cobro/api -> API de cobro (PostgreSQL): pagos, kpis, asistencias, etc.
// Vite reenvía ambos prefijos al gateway.
const API_BASE_URL = '/admin/api';
// Base del módulo de Cobro (front desk). Los clientes y las reservaciones viven
// en MongoDB (API administrativa); cobro conserva pagos, KPIs y asistencias.
const COBRO_BASE_URL = '/cobro/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, baseUrl: string = API_BASE_URL): Promise<T> {
  const token = localStorage.getItem('token');

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      // La administrativa responde con { message } en auth y con { error } en
      // las demás rutas, así que reviso las dos llaves antes de caer al statusText.
      message = body?.message ?? body?.error ?? message;
    } catch {
      // el cuerpo no era JSON, se conserva el statusText
    }
    // 401 = token vencido o inválido: se limpia la sesión local y se regresa al
    // login para que, al volver a iniciar sesión, el backend emita un token
    // nuevo. (El 401 del propio /auth/login son credenciales incorrectas: se
    // muestra en la pantalla de login y ahí NO se cierra la sesión.)
    if (res.status === 401 && path !== '/auth/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('administrativa_sesion');
      if (!window.location.pathname.startsWith('/administrativa/login')) {
        window.location.assign('/administrativa/login');
      }
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined }),
};

// Cliente para hablar con el módulo de Cobro (front desk) desde la
// administrativa: KPIs, pagos y demás datos que siguen en PostgreSQL.
// NO usar para /clientes: los clientes ahora se consultan con `api`.
export const apiCobro = {
  get: <T>(path: string) => request<T>(path, {}, COBRO_BASE_URL),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }, COBRO_BASE_URL),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }, COBRO_BASE_URL),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }, COBRO_BASE_URL),
};

// Construye un query string a partir de un objeto, omitiendo valores vacíos.
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (usable.length === 0) return '';
  const qs = new URLSearchParams(usable.map(([k, v]) => [k, String(v)]));
  return `?${qs.toString()}`;
}