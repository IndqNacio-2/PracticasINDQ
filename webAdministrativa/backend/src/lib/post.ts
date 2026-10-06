import 'dotenv/config';
import pg from 'pg';

// Lee las variables PG_* que ya define el docker-compose.
// Dentro de Docker: host "postgres", puerto 5432.
// Desde tu PC (fuera de Docker): PG_HOST=localhost, PG_PORT=5434.
export const pool = new pg.Pool({
    host: process.env.PG_HOST ?? 'postgres',
    port: Number(process.env.PG_PORT ?? 5432),
    user: process.env.PG_USER ?? 'postgres',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB ?? 'sistema_reservacion_clases',
    max: 10,
});

pool.on('error', (err) => {
    console.error('Error inesperado en el pool de Postgres:', err);
});