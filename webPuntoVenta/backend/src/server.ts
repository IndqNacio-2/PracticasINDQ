// Carga las variables escritas en el archivo .env dentro de process.env.
// Debe ejecutarse antes de consultar PORT, CORS_ORIGIN u otras variables.
import "dotenv/config";

// CORS permite que el frontend, que usa otro puerto, consuma esta API.
import cors from "cors";

// Express proporciona el servidor HTTP y el sistema de rutas de la API.
import express from "express";

// Importa la función que comprobará la conexión con MongoDB.
import { checkMongoDBConnection } from "./config/mongodb.js";

// Importa la funcion que comprobara la conexion con PostgreSQL.
import { checkPostgresConnection } from "./config/postgres.js";


// Crea una instancia de la aplicación Express.
const app = express();

// Usa el puerto configurado en .env. Si no existe, utiliza 3003 como respaldo.
const port = Number(process.env.PORT ?? 3003);

// Define qué origen puede realizar solicitudes desde un navegador.
// Durante el desarrollo será la dirección del frontend de Vite.
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:8443";

// Registra el middleware de CORS antes de las rutas.
app.use(
  cors({
    origin: corsOrigin,
  }),
);

// Convierte automáticamente los cuerpos JSON de las peticiones en objetos.
// Más adelante permitirá recibir productos, ventas y clientes desde React.
app.use(express.json());

// Ruta informativa para quien visite la dirección principal del backend.
app.get("/", (_request, response) => {
  response.status(200).json({
    message: "API del sistema de punto de venta",
    healthEndpoint: "/api/health",
  });
});

// Comprueba que la API y la conexion con PostgreSQL y MongoDB
app.get("/api/health", async (_request, response) => {
  /**
   * Inicia las dos comprobaciones al mismo tiempo.
   * 
   * Promise.allSettled espera a que ambas terminen, incluso si una falla.
   * Esto permite informar exactamente que servicio tiene problemas.
   */
  const [postgresResult, mongodbResult] = await Promise.allSettled([
    checkPostgresConnection(),
    checkMongoDBConnection(),
  ]);

  // Determina el estado individual de cada base de datos
  const postgresStatus = 
    postgresResult.status === "fulfilled" ? "ok" : "error";

  const mongodbStatus =
    mongodbResult.status === "fulfilled" ? "ok" : "error";

  // El sistema esta bien solamente si ambas conexiones funcionaa.
  const allServicesAreHealthy =
    postgresStatus === "ok" && mongodbStatus == "ok";

  // los errroes completos se muestran unicamente en la terminal
  if (postgresResult.status === "rejected") {
    console.error(
      "Error al comprobar la PostgreSQL:",
      postgresResult.reason,
    );
  }

  if (mongodbResult.status == "rejected") {
    console.error(
      "Error al comprobar MongoDB:",
      mongodbResult.reason,
    );
  }

  /**
   * Devuelve 200 cando todo funciona
   * Devuelve 503 cuando una base de datos no esta disponible
   */
  response.status(allServicesAreHealthy ? 200 : 503).json({
    status: allServicesAreHealthy ? "ok" : "error",
    message: allServicesAreHealthy
      ? "La API y las bases de datos estan funcionando"
      : "Uno o mas servicios no estan disponibles",
    services: {
      postgres: postgresStatus,
      mongodb: mongodbStatus,
    },
    timestamp: new Date().toISOString(),
  });
});


// Responde con 404 cuando ninguna de las rutas anteriores coincide.
app.use((_request, response) => {
  response.status(404).json({
    status: "error",
    message: "Ruta no encontrada",
  });
});

// Inicia el servidor y lo deja escuchando solicitudes en el puerto indicado.
app.listen(port, () => {
  console.log(`API disponible en http://localhost:${port}`);
});