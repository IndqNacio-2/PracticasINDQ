/**
 * Aqui viven todas las llamadas al backend.
 *
 * Dejo las peticiones en un solo archivo para que las pantallas no tengan
 * que saber la direccion del servidor ni como se arma cada peticion: cada
 * funcion recibe los datos, llama a la API y devuelve la respuesta ya
 * convertida al tipo que usa el frontend.
 */

import type {
  Product,
  WasteRecord,
  WasteReason,
  SaleRecord,
  CashClosingRecord,
} from '../types';
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
/**
 * Representa un error de validacion por campo.
 *
 * El backend responde 400 con esta lista, y la reviso para poder mostrar
 * el mensaje exacto que manda la API.
 */
interface ApiErrorBody {
    status?: string;
    message?: string;
    errors?: Array<{ field: string; message: string }>;
}

/**
 * Error de la API con el mensaje ya listo para mostrar.
 *
 * Cuando el backend manda varios errores por campo, uso el primero para
 * que el aviso del toast no salga larguisimo.
 */
export class ApiError extends Error {
    constructor(body: ApiErrorBody, status: number) {
        const primero = body.errors?.[0]?.message;
        super(primero ?? body.message ?? `La API respondio con el estado ${status}`);
        this.name = "ApiError";
    }
}

/**
 * Hace la peticion, revisa la respuesta y devuelve el JSON.
 *
 * fetch no lanza error cuando el servidor responde 400, 404 o 500, por eso
 * reviso response.ok a mano y convierto la respuesta en un ApiError.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    if (!response.ok) {
        let body: ApiErrorBody = {};

        try {
            body = (await response.json()) as ApiErrorBody;
        } catch {
            // Si la respuesta no era JSON, dejo el cuerpo vacio y uso el estado.
        }

        throw new ApiError(body, response.status);
    }

    return (await response.json()) as T;
}

// =====================================================================
// Productos
// =====================================================================

// Listar el catalogo completo, que alimenta Inventario y Punto de Venta.
export async function getProducts(): Promise<Product[]> {
    return request<Product[]>("/api/products");
}

// Datos que se envian al crear o editar un producto.
export type ProductPayload = Omit<Product, "id">;

// Crear un producto nuevo. El backend le asigna el id.
export async function createProduct(payload: ProductPayload): Promise<Product> {
    const body = await request<{ product: Product }>("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return body.product;
}

/**
 * Editar un producto.
 *
 * No mando la existencia: la existencia solo cambia con el ajuste de
 * existencias o con una merma, asi al corregir un precio o un nombre no
 * piso el inventario.
 */
export async function updateProduct(
    id: number,
    payload: Omit<ProductPayload, "stock">,
): Promise<Product> {
    const body = await request<{ product: Product }>(`/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });

    return body.product;
}

// Activar o desactivar un producto sin borrarlo del inventario.
export async function changeProductStatus(
    id: number,
    status: Product["status"],
): Promise<Product> {
    const body = await request<{ product: Product }>(`/api/products/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });

    return body.product;
}

/**
 * Ajustar existencias.
 *
 * Envio la cantidad en positivo para una entrada y en negativo para una
 * salida, igual que espera la ruta del backend.
 */
export async function adjustProductStock(
    id: number,
    quantity: number,
): Promise<Product> {
    const body = await request<{ product: Product }>(`/api/products/${id}/stock`, {
        method: "POST",
        body: JSON.stringify({ quantity }),
    });

    return body.product;
}
// =====================================================================
// Mermas
// =====================================================================

// Listar el historial de mermas.
export async function getWasteRecords(): Promise<WasteRecord[]> {
    return request<WasteRecord[]>("/api/waste");
}

// Datos que envia el formulario de merma.
export interface WastePayload {
    productId: number;
    quantity: number;
    reason: WasteReason;
    observations: string;
}

/**
 * Registrar una merma.
 *
 * El backend genera el folio y descuenta la existencia en la misma
 * transaccion, y me regresa la merma con su folio nuevo.
 */
export async function createWasteRecord(
    payload: WastePayload,
): Promise<WasteRecord> {
    const body = await request<{ wasteRecord: WasteRecord }>("/api/waste", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return body.wasteRecord;
}

// =====================================================================
// Ventas
// =====================================================================

// Listar las ventas registradas, que alimentan el Corte de caja
// y el modulo de Reportes.
export async function getSales(): Promise<SaleRecord[]> {
    return request<SaleRecord[]>("/api/sales");
}

// Datos que envia la pantalla al cobrar.
export interface SalePayload {
    items: Array<{ productId: number; quantity: number }>;
    discount: number;
    paymentMethod: SaleRecord["paymentMethod"];
    cashReceived?: number;
    transferRef?: string;
}

/**
 * Registrar una venta.
 *
 * No mando precios ni totales: el backend los calcula con el precio que
 * tiene el producto en la base, para que nadie pueda cobrar un precio
 * distinto al registrado.
 */
export async function createSale(payload: SalePayload): Promise<SaleRecord> {
    const body = await request<{ sale: SaleRecord }>("/api/sales", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return body.sale;
}

// =====================================================================
// Cortes de caja
// =====================================================================

// Listar el historial de cortes.
export async function getCashClosings(): Promise<CashClosingRecord[]> {
    return request<CashClosingRecord[]>("/api/cash-closings");
}

// Datos del cierre de turno que arma la pantalla de Corte de caja.
export type CashClosingPayload = Omit<CashClosingRecord, "folio" | "date" | "time">;

// Registrar el cierre de un turno.
export async function createCashClosing(
    payload: CashClosingPayload,
): Promise<CashClosingRecord> {
    const body = await request<{ cashClosing: CashClosingRecord }>(
        "/api/cash-closings",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
    );

    return body.cashClosing;
}