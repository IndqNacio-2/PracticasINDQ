import { pool } from '../lib/post';
import { ZONA_HORARIA } from '../lib/edad';

// Ingresos del panel administrativo. Las ventas del punto de venta y los cobros de recepción viven en Postgres
// (webpontoventa.sales y webcobro.pagos); la colección de ventas de Mongo ya no se usa, por eso el dashboard
// mostraba $0. Cada ingreso se devuelve con la forma de una venta para que el dashboard lo pinte igual.

export interface IngresoDashboard {
    idVenta: string;
    idCliente: string;
    nombreCliente: string;
    fecha: string; // AAAA-MM-DD
    total: number;
    productos: { nombre: string; cantidad: number; precio: number }[];
    recepcionistaId: string;
    origen: 'punto_de_venta' | 'cobro';
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function ingresosDelPeriodo(desde: unknown, hasta: unknown): Promise<IngresoDashboard[]> {
    if (typeof desde !== 'string' || typeof hasta !== 'string' || !FECHA.test(desde) || !FECHA.test(hasta)) {
        throw Object.assign(new Error('Las fechas "desde" y "hasta" deben tener el formato AAAA-MM-DD'), { status: 400 });
    }

    // Ventas del punto de venta (completadas)
    const ventas = await pool.query(
        `SELECT s.id, to_char((s.sold_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha, s.total::float8 AS total,
                COALESCE(json_agg(json_build_object('nombre', i.product_name, 'cantidad', i.quantity,
                                                    'precio', i.unit_price::float8)) FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS productos
           FROM webpontoventa.sales s
           LEFT JOIN webpontoventa.sale_items i ON i.sale_id = s.id
          WHERE s.status = 'completed' AND (s.sold_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
          GROUP BY s.id`,
        [ZONA_HORARIA, desde, hasta],
    );

    // Cobros de recepción (reservaciones y membresías). Si cobro todavía no creó su esquema, solo se omiten.
    let cobros: { rows: any[] } = { rows: [] };
    try {
        cobros = await pool.query(
            `SELECT p.id, p.cliente_nombre, to_char((p.creado_en AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha, p.monto::float8 AS total
               FROM webcobro.pagos p
              WHERE (p.creado_en AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date`,
            [ZONA_HORARIA, desde, hasta],
        );
    } catch (error) {
        console.warn('[dashboard] No se pudieron leer los cobros de recepción:', (error as Error).message);
    }

    const lista: IngresoDashboard[] = [
        ...ventas.rows.map((v: any) => ({
            idVenta: `POS-${v.id}`, idCliente: '', nombreCliente: 'Venta de mostrador', fecha: v.fecha, total: v.total,
            productos: v.productos, recepcionistaId: '', origen: 'punto_de_venta' as const,
        })),
        ...cobros.rows.map((p: any) => ({
            idVenta: `COB-${p.id}`, idCliente: '', nombreCliente: p.cliente_nombre || 'Cliente', fecha: p.fecha, total: p.total,
            productos: [{ nombre: 'Cobro de recepción', cantidad: 1, precio: p.total }], recepcionistaId: '', origen: 'cobro' as const,
        })),
    ];
    return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
}