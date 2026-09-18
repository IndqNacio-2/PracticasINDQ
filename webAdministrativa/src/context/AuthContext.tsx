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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);

  const login = (correo: string, password: string) => {
    const found = USUARIOS.find(
      u => u.correo === correo && u.password === password && u.estatus === 'activo'
    );
    if (!found) return false;
    const { password: _password, ...usuario } = found;
    setUser(usuario);
    return true;
  };

  const logout = () => setUser(null);

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