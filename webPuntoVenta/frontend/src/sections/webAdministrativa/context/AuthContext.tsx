import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Usuario, UserRole } from '../types';

interface AuthContextType {
  user: Usuario | null;
  // Devuelve true si el login fue correcto; lanza el mensaje de error si no.
  login: (correo: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Clave donde el navegador guarda la sesión administrativa.
const CLAVE_SESION = 'administrativa_sesion';
// Clave del token JWT que usa el cliente HTTP (lib/api.ts) para autorizar.
const CLAVE_TOKEN = 'token';

/**
 * Restaura la sesión guardada al volver a cargar la aplicación.
 *
 * Al navegar entre módulos la aplicación se recarga y el estado en memoria se
 * pierde; con esto el usuario sigue puesto en el dashboard sin volver a iniciar
 * sesión. El token se restaura en localStorage para que las llamadas al backend
 * sigan autorizadas.
 */
function restaurarSesion(): Usuario | null {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const guardado = JSON.parse(crudo) as Pick<Usuario, 'idUsuario' | 'estatus'>;
    // Si la sesión guardada es de un usuario inactivo, se descarta.
    if (!guardado?.idUsuario || guardado.estatus !== 'activo') {
      localStorage.removeItem(CLAVE_SESION);
      return null;
    }
    return guardado as Usuario;
  } catch {
    localStorage.removeItem(CLAVE_SESION);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(restaurarSesion);

  const login = async (correo: string, password: string) => {
    // Autenticación real contra el backend (MongoDB + JWT).
    const data = await api.post<{ token: string; user: Usuario }>('/auth/login', { correo, password });
    // Guarda el token (lo lee lib/api.ts) y la sesión para sobrevivir a recargas.
    localStorage.setItem(CLAVE_TOKEN, data.token);
    localStorage.setItem(CLAVE_SESION, JSON.stringify(data.user));
    setUser(data.user);
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_TOKEN);
  };

  const hasRole = (roles: UserRole[]) => (user ? roles.includes(user.rol) : false);

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