/**
 * obtiene la direccion base del backend desde las variables de Vite
 * 
 * replace (/\, "") elimina una diagonal final para evitar URLs
 * como http://localhost:3003//api/health.
 */
const API_URL = import.meta.env.VITE_API_URL.replace(/\$/, "");

/**
 * representa el posible de cada servicio revisado
 * por el endpoint de salud
 */
type ServiceStatus = "ok" | "error";

/**
 * Describe exactamente la respuesta JSON que devuelve
 * GET /api/health desde el backend
 */
export interface HealthResponse {
    status: ServiceStatus;
    services: {
        postgres: ServiceStatus;
        mongodb: ServiceStatus;
    };
    timestamp: string;
}

/**
 * consulta el endpoint del backend
 * 
 * la funcionn devuelve una promesa porque fetch realiza
 * una opcion operacion HTTP asincrona
 */
export async function getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_URL}/api/health`);

    /**
     * fetch no lanza automaticamente un error cuando el servidor
     * responde con codigos como 404, 500 0 503
     * 
     * por eso revisamos manualmente response.ok.
     */
    if (!response.ok) {
        throw new Error(
            `El backedn respondio con el estado ${response.status}`,
        );
    }

    /**
     * convierte el cuerpo JSON de la respuesta en un objeto
     * y lo devuelve utilizando el tipo HealthResponse.
     */
    return response.json() as Promise<HealthResponse>;
};