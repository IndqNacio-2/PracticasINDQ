import bcrypt from 'bcryptjs';

export type UserRole = 'Administrador' | 'Entrenador' | 'Recepción';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: UserRole;
  estatus: 'activo' | 'inactivo';
  passwordHash: string;
}

const hash = (password: string) => bcrypt.hashSync(password, 10);

// Usuarios de demostración en memoria.
// TODO: reemplazar por consultas a tu base de datos.
export const usuarios: Usuario[] = [
  { id: 1, nombre: 'Administrador', correo: 'admin@gymfit.mx', rol: 'Administrador', estatus: 'activo', passwordHash: hash('admin123') },
  { id: 2, nombre: 'Entrenador', correo: 'entrenador@gymfit.mx', rol: 'Entrenador', estatus: 'activo', passwordHash: hash('entrenador123') },
  { id: 3, nombre: 'Recepción', correo: 'recepcion@gymfit.mx', rol: 'Recepción', estatus: 'activo', passwordHash: hash('recepcion123') },
];