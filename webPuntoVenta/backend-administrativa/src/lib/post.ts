import { Pool } from 'pg';

// Usa la configuración del POS, sin cargar otro .env ni conectar al importar.
export const pool = new Pool(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.POSTGRES_HOST ?? process.env.PG_HOST,
        port: Number(process.env.POSTGRES_PORT ?? process.env.PG_PORT ?? 5432),
        database: process.env.POSTGRES_DB ?? process.env.PG_DB,
        user: process.env.POSTGRES_USER ?? process.env.PG_USER,
        password: process.env.POSTGRES_PASSWORD ?? process.env.PG_PASSWORD,
    });

pool.on('error', (err) => {
    console.error('Error inesperado en el pool de Postgres:', err);
});