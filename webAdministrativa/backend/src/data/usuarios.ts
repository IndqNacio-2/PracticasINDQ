import bcrypt from 'bcryptjs';
import { pool } from '../lib/post';

const usuarios = [
  { nombre: 'Admin', apellidos: 'GymFit', correo: 'admin@gymfit.mx', rol: 'administrador', password: 'admin123' },
  { nombre: 'Entrenador', apellidos: 'GymFit', correo: 'entrenador@gymfit.mx', rol: 'entrenador', password: 'entrenador123' },
  { nombre: 'Recepción', apellidos: 'GymFit', correo: 'recepcion@gymfit.mx', rol: 'recepcion', password: 'recepcion123' },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('CREATE SCHEMA IF NOT EXISTS webadministrativa');

    // Si la tabla existe pero no tiene el esquema nuevo completo, se recrea.
    const { rows } = await client.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'webadministrativa' AND table_name = 'usuarios') AS existe,
        (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'webadministrativa' AND table_name = 'usuarios'
            AND column_name IN ('id_usuario', 'apellidos', 'telefono', 'codigo_acceso')) = 4
        AND EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'webadministrativa' AND table_name = 'usuarios'
            AND column_name = 'estatus' AND data_type = 'boolean') AS es_nueva
    `);
    if (rows[0].existe && !rows[0].es_nueva) {
      console.log('Esquema viejo detectado: se recrea webadministrativa.usuarios');
      await client.query('DROP TABLE webadministrativa.usuarios');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS webadministrativa.usuarios (
        id_usuario     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        nombre         TEXT NOT NULL,
        apellidos      TEXT NOT NULL,
        correo         TEXT NOT NULL UNIQUE,
        telefono       TEXT,
        rol            TEXT NOT NULL CHECK (rol IN ('administrador', 'entrenador', 'recepcion', 'cliente')),
        estatus        BOOLEAN NOT NULL DEFAULT true,
        password_hash  TEXT NOT NULL,
        codigo_acceso  TEXT,
        fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const u of usuarios) {
      await client.query(
        `INSERT INTO webadministrativa.usuarios (nombre, apellidos, correo, rol, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (correo) DO NOTHING`,
        [u.nombre, u.apellidos, u.correo.toLowerCase(), u.rol, bcrypt.hashSync(u.password, 10)]
      );
    }

    await client.query('COMMIT');
    console.log('Seed de usuarios listo (schema webadministrativa).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en el seed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();