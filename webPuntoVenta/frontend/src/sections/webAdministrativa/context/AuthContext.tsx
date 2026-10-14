import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
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
    // Sin token no hay sesión utilizable: si solo queda un resto de sesión vieja
    // (por ejemplo del logout de otro módulo o de un token ya borrado), se
    // descarta para no arrancar con llamadas que van a fallar con 401.
    if (!localStorage.getItem(CLAVE_TOKEN)) {
      localStorage.removeItem(CLAVE_SESION);
      return null;
    }
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

  // Valida la sesión restaurada contra el backend: si el token ya venció o es
  // inválido, se cierra la sesión aquí mismo en lugar de fallar con
  // "Token inválido o expirado" en cada pantalla. De paso refresca el usuario
  // (rol/estatus vigentes) por si cambió en la base de datos.
  useEffect(() => {
    if (!user) return;
    let vigente = true;
    api
      .get<{ user: Usuario }>('/auth/me')
      .then((data) => {
        if (vigente) setUser(data.user);
      })
      .catch((err) => {
        // Solo cierra sesión ante un 401 real; un fallo de red o del backend
        // no debe tirar la sesión del usuario.
        if (vigente && err instanceof ApiError && err.status === 401) setUser(null);
      });
    return () => {
      vigente = false;
    };
    // Se ejecuta solo al montar el proveedor (una vez por recarga de la app).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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