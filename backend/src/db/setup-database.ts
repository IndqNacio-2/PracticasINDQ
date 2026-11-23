// Ejecuta los scripts SQL de la base de datos en orden: esquemas y datos.
//
// Lo uso para levantar la base con un solo comando (npm run db:setup),
// sin tener que pegar cada archivo en pgAdmin a mano.
//
// Lee las credenciales desde backend/.env, igual que el servidor.

import "dotenv/config";

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// Carpeta donde esta este script (backend/src/db).
const currentDir = dirname(fileURLToPath(import.meta.url));

// Carpeta backend/db, donde viven schema.sql y seed.sql.
const dbDir = join(currentDir, "..", "..", "db");

/*
 * Obtiene una variable de entorno obligatoria.
 *
 * Le quito espacios alrededor porque un espacio al final del .env
 * tambien cuenta como parte del valor y romperia la conexion.
 */
function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }

  return value;
}

// Crea el pool con los mismos datos que usa el servidor.
const pool = new Pool({
  host: getRequiredEnvironmentVariable("POSTGRES_HOST"),
  port: Number(getRequiredEnvironmentVariable("POSTGRES_PORT")),
  database: getRequiredEnvironmentVariable("POSTGRES_DB"),
  user: getRequiredEnvironmentVariable("POSTGRES_USER"),
  password: getRequiredEnvironmentVariable("POSTGRES_PASSWORD"),
});

// Ejecuta los archivos SQL en orden, uno por uno.
async function ejecutarArchivo(nombre: string): Promise<void> {
  const sql = await readFile(join(dbDir, nombre), "utf8");

  console.log(`Aplicando ${nombre}...`);
  await pool.query(sql);
  console.log(`${nombre} listo.`);
}

// Ejecuta todos los esquemas y luego los datos iniciales, y comprueba el
// resultado.
async function main(): Promise<void> {
  // 1. Esquema del Punto de Venta: crea "webpontoventa" y sus cinco tablas
  //    (se puede repetir sin borrar datos).
  await ejecutarArchivo("schema.sql");

  // 2. Esquema completo de la aplicacion: crea "webadministrativa" con las
  //    tablas de usuarios, clientes, membresias, clases, horarios,
  //    reservaciones, productos, movimientos, ventas y venta_detalle.
  await ejecutarArchivo("esquema-completo.sql");

  // 3. Datos iniciales de productos (se puede repetir sin duplicarlos).
  await ejecutarArchivo("seed.sql");

  // 4. Compruebo cuantos productos quedaron cargados.
  const result = await pool.query(
    "SELECT COUNT(*)::int AS total FROM webpontoventa.products",
  );
  const total = (result.rows[0] as { total: number }).total;

  console.log(`Productos en la base de datos: ${total}.`);
}

// Ejecuto el proceso y cierro la conexion al terminar.
try {
  await main();
} catch (error) {
  console.error("No se pudo preparar la base de datos:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
