import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Usuario, UserRole } from '../types';

interface AuthContextType {
  user: Usuario | null;
  login: (correo: string, password: string) => boolean;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Usuarios de demostración: uno por rol.
// TODO: reemplazar por la autenticación real con tu API.
const USUARIOS: (Usuario & { password: string })[] = [
  {
    idUsuario: 'u1',
    nombre: 'Administrador',
    apellidos: 'Demo',
    correo: 'admin@gymfit.mx',
    telefono: '',
    codigoAcceso: 'ADM-001',
    rol: 'administrador',
    estatus: 'activo',
    fechaCreacion: '2026-01-01',
    password: 'admin123',
  },
  {
    idUsuario: 'u2',
    nombre: 'Entrenador',
    apellidos: 'Demo',
    correo: 'entrenador@gymfit.mx',
    telefono: '',
    codigoAcceso: 'ENT-001',
    rol: 'entrenador',
    estatus: 'activo',
    fechaCreacion: '2026-01-01',
    password: 'entrenador123',
  },
  {
    idUsuario: 'u3',
    nombre: 'Recepción',
    apellidos: 'Demo',
    correo: 'recepcion@gymfit.mx',
    telefono: '',
    codigoAcceso: 'REC-001',
    rol: 'recepcion',
    estatus: 'activo',
    fechaCreacion: '2026-01-01',
    password: 'recepcion123',
  },
];

// Clave donde el navegador guarda la sesión administrativa.
const CLAVE_SESION = 'administrativa_sesion';

/**
 * Restaura la sesión guardada al volver a cargar la aplicación.
 *
 * Al navegar entre módulos (por ejemplo desde el login de cobro) la
 * aplicación se recarga y el estado en memoria se pierde; con esta función
 * el usuario sigue quedando puesto en el dashboard sin volver a iniciar
 * sesión. Si el usuario ya no existe o está inactivo, se limpia la sesión.
 */
function restaurarSesion(): Usuario | null {
  try {
    const crudo = localStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const guardado = JSON.parse(crudo) as Pick<Usuario, 'correo'>;
    const actual = USUARIOS.find(u => u.correo === guardado.correo && u.estatus === 'activo');
    if (!actual) {
      localStorage.removeItem(CLAVE_SESION);
      return null;
    }
    const { password: _password, ...usuario } = actual;
    return usuario;
  } catch {
    localStorage.removeItem(CLAVE_SESION);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(restaurarSesion);

  const login = (correo: string, password: string) => {
    const found = USUARIOS.find(
      u => u.correo === correo && u.password === password && u.estatus === 'activo'
    );
    if (!found) return false;
    const { password: _password, ...usuario } = found;
    setUser(usuario);
    // Guarda la sesión en el navegador para que sobreviva a los cambios de módulo.
    localStorage.setItem(CLAVE_SESION, JSON.stringify(usuario));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CLAVE_SESION);
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