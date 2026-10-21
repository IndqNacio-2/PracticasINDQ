// Genera el diagrama entidad-relacion de un esquema leyendo la base de datos.
//
// Lo uso con el comando:  npm run db:diagrama
//
// No dibujo nada a mano: leo las tablas, sus columnas, sus llaves primarias
// y sus llaves foraneas directamente del catalogo de PostgreSQL, y con eso
// escribo el diagrama en formato Mermaid, que se puede pegar en cualquier
// visor (por ejemplo mermaid.live).
//
// Lee las credenciales desde backend/.env, igual que el servidor.

import "dotenv/config";

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// Carpeta donde esta este script (backend/src/db).
const currentDir = dirname(fileURLToPath(import.meta.url));

// Carpeta backend/db, donde dejo el diagrama generado.
const dbDir = join(currentDir, "..", "..", "db");

// Esquema del que quiero el diagrama. Se puede cambiar con una variable de
// entorno:  $env:ESQUEMA="webpontoventa"; npm run db:diagrama
//
// Si se pone "todos", junto los tres esquemas de la aplicacion en un solo
// diagrama (util para la entrega del proyecto completo).
const esquemaPedido = process.env.ESQUEMA ?? "webadministrativa";

// Los tres esquemas que forman la aplicacion, en el orden en que conviene
// leerlos.
const esquemasDeLaAplicacion = ["webadministrativa", "webpontoventa", "webcobro"];

// Cuando pido "todos" recorro los tres; en cualquier otro caso solo uno.
const esquemasAEscribir =
  esquemaPedido === "todos" ? esquemasDeLaAplicacion : [esquemaPedido];

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

const pool = new Pool({
  host: getRequiredEnvironmentVariable("POSTGRES_HOST"),
  port: Number(getRequiredEnvironmentVariable("POSTGRES_PORT")),
  database: getRequiredEnvironmentVariable("POSTGRES_DB"),
  user: getRequiredEnvironmentVariable("POSTGRES_USER"),
  password: getRequiredEnvironmentVariable("POSTGRES_PASSWORD"),
});

interface Columna {
  tabla: string;
  columna: string;
  tipo: string;
  esLlave: boolean;
}

interface Relacion {
  origen: string;
  destino: string;
  columna: string;
  borrado: string;
}

// Limpia el tipo para que Mermaid no se confunda con los parentesis.
function limpiarTipo(tipo: string): string {
  return tipo.replace(/\(/g, "[").replace(/\)/g, "]");
}

async function obtenerColumnas(esquema: string, prefijo: string): Promise<Columna[]> {
  const resultado = await pool.query<
    { tabla: string; columna: string; tipo: string; es_llave: boolean }
  >(
    `
    SELECT
      c.table_name            AS tabla,
      c.column_name           AS columna,
      -- Armo el tipo completo: varchar(80), numeric(10,2), text[], etc.
      CASE
        WHEN c.data_type = 'character varying' THEN 'varchar(' || c.character_maximum_length || ')'
        WHEN c.data_type = 'numeric' THEN 'numeric(' || c.numeric_precision || ',' || c.numeric_scale || ')'
        WHEN c.data_type = 'ARRAY' THEN 'text[]'
        ELSE c.data_type
      END                     AS tipo,
      (pk.column_name IS NOT NULL) AS es_llave
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.table_schema, kcu.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON  tc.constraint_name = kcu.constraint_name
        AND tc.table_schema    = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
    ) pk
      ON  pk.table_schema = c.table_schema
      AND pk.table_name   = c.table_name
      AND pk.column_name  = c.column_name
    WHERE c.table_schema = $1
    ORDER BY c.table_name, c.ordinal_position
    `,
    [esquema],
  );

  return resultado.rows.map((fila) => ({
    // Cuando junto varios esquemas les pongo el nombre del esquema adelante
    // ("webadministrativa_usuarios") para que dos tablas que se llaman igual
    // en esquemas distintos no se mezclen en el diagrama.
    tabla: `${prefijo}${fila.tabla}`,
    columna: fila.columna,
    tipo: fila.tipo,
    esLlave: fila.es_llave,
  }));
}

async function obtenerRelaciones(esquema: string, prefijo: string): Promise<Relacion[]> {
  const resultado = await pool.query<
    { origen: string; destino: string; columna: string; borrado: string }
  >(
    `
    SELECT
      tc.table_name       AS origen,
      ccu.table_name      AS destino,
      kcu.column_name     AS columna,
      rc.delete_rule      AS borrado
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON  tc.constraint_name = kcu.constraint_name
      AND tc.table_schema    = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON  ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc
      ON  rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1
    ORDER BY tc.table_name, kcu.column_name
    `,
    [esquema],
  );

  return resultado.rows.map((fila) => ({
    origen: `${prefijo}${fila.origen}`,
    destino: `${prefijo}${fila.destino}`,
    columna: fila.columna,
    borrado: fila.borrado,
  }));
}

// Arma el texto del diagrama en formato Mermaid.
function construirMermaid(
  columnas: Columna[],
  relaciones: Relacion[],
  titulo: string,
): string {
  const tablas = [...new Set(columnas.map((c) => c.tabla))];

  const lineas: string[] = [];
  lineas.push("erDiagram");

  // Una linea de comentario con el esquema y cuantas tablas tiene.
  lineas.push(`    %% ${titulo} (${tablas.length} tablas)`);
  lineas.push("");

  // Primero las tablas con sus columnas.
  for (const tabla of tablas) {
    lineas.push(`    ${tabla} {`);
    for (const columna of columnas.filter((c) => c.tabla === tabla)) {
      // Mermaid marca la llave primaria con las letras "PK".
      const marca = columna.esLlave ? " PK" : "";
      lineas.push(
        `        ${limpiarTipo(columna.tipo)} ${columna.columna}${marca}`,
      );
    }
    lineas.push("    }");
    lineas.push("");
  }

  // Despues las relaciones entre tablas.
  for (const relacion of relaciones) {
    // "||--o{" significa uno a muchos: una fila de la tabla destino puede
    // tener varias filas en la tabla origen. Lo separo con comillas para
    // poder poner la etiqueta con la columna y la regla de borrado.
    lineas.push(
      `    ${relacion.destino} ||--o{ ${relacion.origen} : "${relacion.columna} (${relacion.borrado})"`,
    );
  }

  lineas.push("");
  return lineas.join("\n");
}

async function main(): Promise<void> {
  // Cuando genero un solo esquema no le pongo prefijo a los nombres de las
  // tablas. Cuando junto varios, si lo pongo, para que no choquen.
  const esCombinado = esquemasAEscribir.length > 1;

  const todasLasColumnas: Columna[] = [];
  const todasLasRelaciones: Relacion[] = [];

  for (const esquema of esquemasAEscribir) {
    const prefijo = esCombinado ? `${esquema}_` : "";

    const columnas = await obtenerColumnas(esquema, prefijo);

    if (columnas.length === 0) {
      throw new Error(`El esquema "${esquema}" no existe o no tiene tablas.`);
    }

    todasLasColumnas.push(...columnas);
    todasLasRelaciones.push(...(await obtenerRelaciones(esquema, prefijo)));
  }

  const titulo = esCombinado
    ? `Aplicacion completa (${esquemasAEscribir.join(", ")})`
    : `Esquema: ${esquemasAEscribir[0]}`;

  const mermaid = construirMermaid(
    todasLasColumnas,
    todasLasRelaciones,
    titulo,
  );

  // Escribo el diagrama junto con un encabezado explicativo.
  const tablas = [...new Set(todasLasColumnas.map((c) => c.tabla))];
  const nombreArchivo = esCombinado
    ? "diagrama-er-completo.md"
    : `diagrama-er-${esquemasAEscribir[0]}.md`;

  const contenido = [
    `# ${esCombinado ? "Diagrama entidad-relacion de la aplicacion completa" : `Diagrama entidad-relacion del esquema ${esquemasAEscribir[0]}`}`,
    "",
    "Generado automaticamente con el comando `npm run db:diagrama` a partir de",
    "la base de datos real, no dibujado a mano.",
    "",
    `- Tablas: ${tablas.length}`,
    `- Relaciones: ${todasLasRelaciones.length}`,
    "",
    "Para verlo: pega el bloque de abajo en https://mermaid.live, o abrelo con",
    "una extension de Mermaid en el editor.",
    "",
    "```mermaid",
    mermaid,
    "```",
    "",
  ].join("\n");

  const archivo = join(dbDir, nombreArchivo);
  await writeFile(archivo, contenido, "utf8");

  console.log(`Diagrama generado: ${archivo}`);
  console.log(`Tablas: ${tablas.length}, relaciones: ${todasLasRelaciones.length}.`);
}

try {
  await main();
} catch (error) {
  console.error("No se pudo generar el diagrama:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}