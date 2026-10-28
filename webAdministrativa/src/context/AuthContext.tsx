import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, setToken, AUTH_EXPIRED_EVENT } from '../lib/api';
import type { Usuario, UserRole } from '../types';

interface AuthContextType {
  user: Usuario | null;
  /** Lanza ApiError si las credenciales son incorrectas o el servidor no responde */
  login: (correo: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  // No se pinta la app hasta saber si el token guardado sigue siendo válido,
  // así al recargar la página no se rebota al login por un instante.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelado = false;

    if (!getToken()) {
      setReady(true);
      return;
    }

    api
      .get<{ user: Usuario }>('/auth/me')
      .then(r => { if (!cancelado) setUser(r.user); })
      .catch(() => clearToken())
      .finally(() => { if (!cancelado) setReady(true); });

    return () => { cancelado = true; };
  }, []);

  // Token vencido o usuario dado de baja mientras usaba la app
  useEffect(() => {
    const alExpirar = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, alExpirar);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, alExpirar);
  }, []);

  const login = async (correo: string, password: string) => {
    const r = await api.post<{ token: string; user: Usuario }>('/auth/login', { correo: correo.trim(), password });
    setToken(r.token);
    setUser(r.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const hasRole = (roles: UserRole[]) => (user ? roles.includes(user.rol) : false);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Cargando…</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
