// Ejecuta los archivos SQL (esquema y datos iniciales) contra el PostgreSQL
// compartido de la carpeta de punto de venta.
//
// Se ejecuta con:  npm run db:setup
require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

/*
 * Obtiene una variable de entorno obligatoria.
 *
 * Si la variable no existe o está vacía, detiene la ejecución mostrando
 * exactamente cuál configuración hace falta.
 */
function getRequiredEnvironmentVariable(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }

  return value;
}

const client = new Client({
  host: getRequiredEnvironmentVariable('POSTGRES_HOST'),
  port: Number(getRequiredEnvironmentVariable('POSTGRES_PORT')),
  database: getRequiredEnvironmentVariable('POSTGRES_DB'),
  user: getRequiredEnvironmentVariable('POSTGRES_USER'),
  password: getRequiredEnvironmentVariable('POSTGRES_PASSWORD'),
});

async function main() {
  await client.connect();

  try {
    // Los archivos se ejecutan en orden: primero las tablas y después los
    // datos de ejemplo.
    const sqlFiles = ['schema.sql', 'seed.sql'];

    for (const fileName of sqlFiles) {
      const filePath = path.join(__dirname, '..', '..', 'db', fileName);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query(sql);
      console.log(`Listo: ${fileName}`);
    }

    console.log('Base de datos de webCobro preparada.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('No se pudo preparar la base de datos:', error.message);
  process.exit(1);
});
