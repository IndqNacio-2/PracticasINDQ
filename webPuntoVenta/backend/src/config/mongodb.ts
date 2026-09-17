// Asegurar que las variables del archivo .env esten disponibles
import "dotenv/config";

// MongoClient administra la conexion y el pool interno de MongoDB.
// Db representa la base de datos que utilizaras la aplicacion
import { Db, MongoClient} from "mongodb";

/*
 * Obtiene una variable de entorno obligatoria.
 *
 * si la variable nno existe o esta vacia, el servidor se detiene
 * mostrando exactamente cual configuracion hace falta.
 */
function getRequiredEnvironmentVariable(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
    }

    return value;
}

// Obtiene la direccion privada de conexion desde el archivo .env
const mongodbUri = getRequiredEnvironmentVariable("MONGODB_URI");

// Obtiene el nombre de la base de datos utilizada por punto de venta.
const mongodbDatabaseName = getRequiredEnvironmentVariable(
    "MONGO_DB_NAME",
);

// Crea un cliente de MongoDB
// MongoClient administra la conexion y el pool de conexiones reutilizables.
export const mongoClient = new MongoClient(mongodbUri);

// Guarda una referencai a la base de datos la conexion
let mongoDatabase: Db | null = null;

/**
 * Abre la conexion con MongoDB y devuelve la base de datos
 * 
 * La primera vez se conecta realmente. En las llamadas posteriores 
 * reutiliza la referencia y el pool ya existentes.
 */
export async function connectMongoDB(): Promise<Db> {
    if (mongoDatabase) {
        return mongoDatabase;
    }

    await mongoClient.connect();

    mongoDatabase = mongoClient.db(mongodbDatabaseName);

    return mongoDatabase;
}

/**
 * Envia un comanndo ping a MongoDB para comprobar:
 * 
 * - que elservidor esta disponible
 * - que el usuario y contraseña son corretas
 * - que el backend puede ejecutar comandos
 */
export async function checkMongoDBConnection(): Promise<void> {
    const database = await connectMongoDB();

    await database.command({ ping: 1 });
}