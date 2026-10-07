// Importa Pool desde la biblioteca pg.
// Un Pool administra varias conexiones reutilizables con PostgreSQL.
import { Pool } from "pg";

/*
 * Obtiene una variable de entorno obligatoria.
 *
 * Si la variable no existe o está vacía, detiene el inicio del programa
 * con un mensaje que indica cuál configuración hace falta.
 */
function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }

  return value;
}

/*
 * Crea el pool de conexiones con los datos almacenados en .env.
 *
 * No colocamos usuarios ni contraseñas directamente en el código
 * para evitar publicar información privada en GitHub.
 */
export const postgresPool = new Pool({
  host: getRequiredEnvironmentVariable("POSTGRES_HOST"),
  port: Number(getRequiredEnvironmentVariable("POSTGRES_PORT")),
  database: getRequiredEnvironmentVariable("POSTGRES_DB"),
  user: getRequiredEnvironmentVariable("POSTGRES_USER"),
  password: getRequiredEnvironmentVariable("POSTGRES_PASSWORD"),
});

/*
 * Bitácora de consultas: imprime cada SQL que sale hacia PostgreSQL con la
 * hora exacta, para que la terminal del backend funcione como registro de la
 * base de datos (se ve cada SELECT, INSERT, UPDATE o DELETE que dispara la API).
 */
const consultaOriginal = postgresPool.query.bind(postgresPool) as unknown as (
  texto: string,
  parametros?: unknown[],
) => Promise<unknown>;

(postgresPool as unknown as { query: typeof consultaOriginal }).query = (
  texto,
  parametros,
) => {
  if (typeof texto === "string") {
    const sql = texto.replace(/\s+/g, " ").trim();
    const hora = new Date().toLocaleTimeString("es-MX");
    const datos = parametros && parametros.length
      ? ` -- datos: ${JSON.stringify(parametros)}`
      : "";
    console.log(`[SQL ${hora}] ${sql}${datos}`);
  }
  return consultaOriginal(texto, parametros);
};

/*
 * Ejecuta una consulta pequeña para comprobar la conexión.
 *
 * Si PostgreSQL funciona, la promesa termina correctamente.
 * Si no funciona, pg lanza un error que podrá manejar el servidor.
 */
export async function checkPostgresConnection(): Promise<void> {
  await postgresPool.query("SELECT 1");
}
