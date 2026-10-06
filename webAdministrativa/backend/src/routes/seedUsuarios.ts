import bcrypt from 'bcryptjs';
import { pool } from '../lib/post';

// Los 3 únicos usuarios del sistema. No hay CRUD de usuarios.
const usuarios = [
    { id: 1, nombre: 'Administrador', correo: 'admin@gymfit.mx', rol: 'Administrador', password: 'admin123' },
    { id: 2, nombre: 'Entrenador', correo: 'entrenador@gymfit.mx', rol: 'Entrenador', password: 'entrenador123' },
    { id: 3, nombre: 'Recepción', correo: 'recepcion@gymfit.mx', rol: 'Recepción', password: 'recepcion123' },
];

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query('CREATE SCHEMA IF NOT EXISTS webadministrativa');

        await client.query(`
      CREATE TABLE IF NOT EXISTS webadministrativa.usuarios (
        id             INTEGER PRIMARY KEY,
        nombre         TEXT NOT NULL,
        correo         TEXT NOT NULL UNIQUE,
        rol            TEXT NOT NULL CHECK (rol IN ('Administrador', 'Entrenador', 'Recepción')),
        estatus        TEXT NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'inactivo')),
        password_hash  TEXT NOT NULL,
        fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

        for (const u of usuarios) {
            await client.query(
                `INSERT INTO webadministrativa.usuarios (id, nombre, correo, rol, estatus, password_hash)
         VALUES ($1, $2, $3, $4, 'activo', $5)
         ON CONFLICT (id) DO NOTHING`,
                [u.id, u.nombre, u.correo.toLowerCase(), u.rol, bcrypt.hashSync(u.password, 10)]
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