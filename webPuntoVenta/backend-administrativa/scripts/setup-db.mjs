// scripts/setup-db.mjs
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL en el .env');
    process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ADMIN_CORREO = 'admin@correo.com';
const ADMIN_PASSWORD = 'Admin12345'; // cámbiala después

try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS webadministrativa`);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS webadministrativa.usuarios (
      id_usuario       SERIAL PRIMARY KEY,
      nombre           VARCHAR(100) NOT NULL,
      apellidos        VARCHAR(100) NOT NULL,
      correo           VARCHAR(150) NOT NULL UNIQUE,
      telefono         VARCHAR(10),
      fecha_nacimiento DATE,
      rol              VARCHAR(20) NOT NULL
                       CHECK (rol IN ('administrador', 'entrenador', 'recepcionista')),
      estatus          BOOLEAN NOT NULL DEFAULT TRUE,
      especialidad     VARCHAR(100),
      turno_entrada    VARCHAR(5),
      turno_salida     VARCHAR(5),
      foto             TEXT,
      resumen          TEXT,
      capacitaciones   JSONB NOT NULL DEFAULT '[]'::jsonb,
      certificaciones  JSONB NOT NULL DEFAULT '[]'::jsonb,
      password_hash    TEXT NOT NULL
    )
  `);

    await pool.query(
        `INSERT INTO webadministrativa.usuarios
       (nombre, apellidos, correo, rol, estatus, password_hash)
     VALUES ('Admin', 'Principal', $1, 'administrador', true, $2)
     ON CONFLICT (correo) DO NOTHING`,
        [ADMIN_CORREO, bcrypt.hashSync(ADMIN_PASSWORD, 10)]
    );

    console.log('Listo: esquema, tabla y administrador creados.');
    console.log(`Login: ${ADMIN_CORREO} / ${ADMIN_PASSWORD}`);
} catch (err) {
    console.error('Error:', err);
} finally {
    await pool.end();
}