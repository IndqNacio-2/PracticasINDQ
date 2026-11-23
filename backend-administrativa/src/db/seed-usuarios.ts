/*
 * Seed de usuarios de la plataforma (staff).
 *
 * Crea el usuario administrador inicial para poder entrar al login y, desde el
 * módulo de Usuarios, ir dando de alta al resto del personal.
 *
 * Uso:  npm run db:seed   (desde backend-administrativa)
 */
import 'dotenv/config';
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
    password: '123',
  },
  {
    nombre: 'Vendedor',
    apellidos: 'Punto de Venta',
    correo: 'vendedor@gymfit.mx',
    telefono: '',
    codigoAcceso: 'VEN001',
    rol: 'vendedor' as const,
    estatus: 'activo' as const,
    password: '123',
  },
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('Falta MONGO_URI en el .env');
  await mongoose.connect(uri);

  for (const u of usuariosSeed) {
    const { password, ...datos } = u;
    // No sobreescribe si ya existe (evita perder la contraseña que se le puso).
    const existe = await Usuario.findOne({ correo: datos.correo });
    if (existe) {
      console.log(`Ya existe: ${datos.correo} (no se modifica)`);
      continue;
    }
    await Usuario.create({ ...datos, password: bcrypt.hashSync(password, 10) });
    console.log(`Creado: ${datos.correo} / ${password}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error en el seed de usuarios:', err);
  process.exit(1);
});
