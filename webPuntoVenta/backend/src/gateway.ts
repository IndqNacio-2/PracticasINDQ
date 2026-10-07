/**
 * Gateway unificado de la aplicación.
 *
 * Levanta las tres API del proyecto en UN solo proceso y UN solo puerto (3000):
 *
 *   http://localhost:3000/pos/api/...    -> Punto de Venta   (backend/)
 *   http://localhost:3000/admin/api/...  -> Administrativa   (backend-administrativa/)
 *   http://localhost:3000/cobro/api/...  -> Cobro            (backend-cobro/)
 *
 * Cada servidor conserva su código y sus rutas internas (/api/...); solo se
 * monta bajo un prefijo para que no se pisen (los tres usan /api/clientes y
 * /api/health). Con GATEWAY_MODE definido, los servidores NO abren su propio
 * puerto: quien escucha es este gateway.
 *
 * Arranque: desde la carpeta backend -> npm run dev:unified
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import express from "express";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..", "..");

// Carga los .env de los tres backends ANTES de importarlos. dotenv no pisa
// variables ya definidas, así que cada variable gana la del primer archivo que
// la declare (los datos de conexión coinciden en los tres archivos).
loadEnv({ path: path.join(projectRoot, "backend", ".env") });
loadEnv({ path: path.join(projectRoot, "backend-administrativa", ".env") });
loadEnv({ path: path.join(projectRoot, "backend-cobro", ".env") });

// Avisa a los tres servidores que NO abran su propio puerto: lo hace el gateway.
process.env.GATEWAY_MODE = "1";

// Import dinámico: los .env de arriba ya quedaron cargados antes de que cada
// servidor lea sus variables (PORT, JWT_SECRET, MONGO_URI, POSTGRES_*...).
const { default: posApp } = await import("./server.js");
const { default: adminApp } = await import("../../backend-administrativa/src/server.js");
const { default: cobroApp } = await import("../../backend-cobro/serverWebCobro.js");

const app = express();
const port = 3000;

// Bienvenida del backend unificado.
app.get("/", (_request, response) => {
  response.json({
    message: "API unificada de la aplicacion",
    backends: {
      pos: "/pos/api/health",
      administrativa: "/admin/api/health",
      cobro: "/cobro/api/kpis",
    },
  });
});

// Las tres APIs montadas cada una bajo su prefijo.
app.use("/pos", posApp);
app.use("/admin", adminApp);
app.use("/cobro", cobroApp);

// Responde 404 para todo lo que no pertenezca a los tres prefijos.
app.use((_request, response) => {
  response.status(404).json({ status: "error", message: "Ruta no encontrada" });
});

app.listen(port, () => {
  console.log(`API unificada disponible en http://localhost:${port}`);
  console.log(`  Punto de Venta -> http://localhost:${port}/pos/api`);
  console.log(`  Administrativa -> http://localhost:${port}/admin/api`);
  console.log(`  Cobro          -> http://localhost:${port}/cobro/api`);
});
