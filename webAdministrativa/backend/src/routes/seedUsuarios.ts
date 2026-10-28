import bcrypt from 'bcryptjs';
import { pool } from '../lib/post';

// Prepara la tabla webadministrativa.usuarios y crea los usuarios iniciales.
// Es idempotente: se puede correr varias veces (npm run db:seed) sin duplicar nada.
// Si la tabla ya existía, solo agrega las columnas que falten.
const usuariosIniciales = [
  { nombre: 'Administrador', apellidos: 'GymFit', correo: 'admin@gymfit.mx', rol: 'Administrador', password: 'admin123' },
  { nombre: 'Entrenador', apellidos: 'GymFit', correo: 'entrenador@gymfit.mx', rol: 'Entrenador', password: 'entrenador123' },
  { nombre: 'Recepción', apellidos: 'GymFit', correo: 'recepcion@gymfit.mx', rol: 'Recepción', password: 'recepcion123' },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('CREATE SCHEMA IF NOT EXISTS webadministrativa');

    await client.query(`
      CREATE TABLE IF NOT EXISTS webadministrativa.usuarios (
        id_usuario     SERIAL PRIMARY KEY,
        nombre         TEXT NOT NULL,
        apellidos      TEXT NOT NULL DEFAULT '',
        correo         TEXT NOT NULL UNIQUE,
        telefono       TEXT,
        rol            TEXT NOT NULL,
        estatus        BOOLEAN NOT NULL DEFAULT true,
        password_hash  TEXT NOT NULL
      )
    `);

    // Columnas que necesita el módulo de usuarios y los reportes de personal
    await client.query(`
      ALTER TABLE webadministrativa.usuarios
        ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
        ADD COLUMN IF NOT EXISTS especialidad   TEXT,
        ADD COLUMN IF NOT EXISTS turno_entrada  TEXT,
        ADD COLUMN IF NOT EXISTS turno_salida   TEXT,
        ADD COLUMN IF NOT EXISTS foto            TEXT,
        ADD COLUMN IF NOT EXISTS resumen         TEXT,
        ADD COLUMN IF NOT EXISTS capacitaciones  JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS certificaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    // Si id_usuario no tenía valor automático, se lo damos para poder dar de alta usuarios
    await client.query(`
      DO $$
      BEGIN
        IF (SELECT column_default IS NULL AND is_identity = 'NO'
              FROM information_schema.columns
             WHERE table_schema = 'webadministrativa' AND table_name = 'usuarios' AND column_name = 'id_usuario') THEN
          CREATE SEQUENCE IF NOT EXISTS webadministrativa.usuarios_id_usuario_seq
            OWNED BY webadministrativa.usuarios.id_usuario;
          PERFORM setval('webadministrativa.usuarios_id_usuario_seq',
                         COALESCE((SELECT MAX(id_usuario) FROM webadministrativa.usuarios), 0) + 1, false);
          ALTER TABLE webadministrativa.usuarios
            ALTER COLUMN id_usuario SET DEFAULT nextval('webadministrativa.usuarios_id_usuario_seq');
        END IF;
      END $$;
    `);

    // El código de acceso ya no existe: el usuario entra con su correo
    await client.query('DROP INDEX IF EXISTS webadministrativa.usuarios_codigo_acceso_uq');
    await client.query('ALTER TABLE webadministrativa.usuarios DROP COLUMN IF EXISTS codigo_acceso');

    for (const u of usuariosIniciales) {
      await client.query(
        `INSERT INTO webadministrativa.usuarios (nombre, apellidos, correo, rol, estatus, password_hash)
         SELECT $1, $2, $3, $4, true, $5
          WHERE NOT EXISTS (SELECT 1 FROM webadministrativa.usuarios WHERE correo = $3)`,
        [u.nombre, u.apellidos, u.correo, u.rol, bcrypt.hashSync(u.password, 10)]
      );
    }

    await client.query('COMMIT');
    console.log('Tabla de usuarios lista y usuarios iniciales creados (schema webadministrativa).');
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