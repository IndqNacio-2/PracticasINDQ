// Cliente HTTP centralizado para consumir la API real.
// Ajusta VITE_API_URL en tu archivo .env (por ejemplo: VITE_API_URL=http://localhost:3001/api)
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

const TOKEN_KEY = 'token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Se dispara cuando el servidor responde 401 con una sesión que ya no sirve (token vencido, usuario dado de baja).
// AuthContext lo escucha y regresa al login.
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
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
      // Las rutas de auth responden { message } y el resto { error }
      message = body?.message ?? body?.error ?? message;
    } catch {
      // el cuerpo no era JSON, se conserva el statusText
    }
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      clearToken();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
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
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Construye un query string a partir de un objeto, omitiendo valores vacíos.
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (usable.length === 0) return '';
  const qs = new URLSearchParams(usable.map(([k, v]) => [k, String(v)]));
  return `?${qs.toString()}`;
}

// Mensaje legible para mostrar al usuario a partir de cualquier error
export function mensajeDeError(err: unknown, porDefecto: string): string {
  return err instanceof ApiError && err.message ? err.message : porDefecto;
}
