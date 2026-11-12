/*
 * Seed de usuarios de la plataforma (staff).
 *
 * Crea el usuario administrador inicial para poder entrar al login y, desde el
 * módulo de Usuarios, ir dando de alta al resto del personal.
 *
 * Uso:  npm run db:seed   (desde backend-administrativa)
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Usuario } from '../models/Usuarios/usuarios';

const usuariosSeed = [
  {
    nombre: 'Administrador',
    apellidos: 'General',
    correo: 'admin@gymfit.mx',
    telefono: '',
    codigoAcceso: 'ADM001',
    rol: 'administrador' as const,
    estatus: 'activo' as const,
  },
  {
    nombre: 'Vendedor',
    apellidos: 'Punto de Venta',
    correo: 'vendedor@gymfit.mx',
    telefono: '',
    codigoAcceso: 'VEN001',
    rol: 'vendedor' as const,
    estatus: 'activo' as const,
  },
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('Falta MONGO_URI en el .env');
  await mongoose.connect(uri);

  for (const datos of usuariosSeed) {
    // No sobreescribe si ya existe (evita perder la contraseña que se le puso).
    const existe = await Usuario.findOne({ correo: datos.correo });
    if (existe) {
      console.log(`Ya existe: ${datos.correo} (no se modifica)`);
      continue;
    }
    // Contraseña temporal al azar: solo se muestra aquí y se pide cambiarla al
    // primer inicio de sesión.
    const password = crypto.randomBytes(9).toString('base64url');
    await (Usuario as any).create({ ...datos, password: bcrypt.hashSync(password, 10), debeCambiarPassword: true });
    console.log(`Creado: ${datos.correo} / contraseña temporal: ${password}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error en el seed de usuarios:', err);
  process.exit(1);
});
