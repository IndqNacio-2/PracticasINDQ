// src/lib/post.ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Carga backend-administrativa/.env (dos niveles arriba de src/lib)
const aqui = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(aqui, '../../.env') });

if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en backend-administrativa/.env');
}

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
    console.error('Error inesperado en el pool de Postgres:', err);
});