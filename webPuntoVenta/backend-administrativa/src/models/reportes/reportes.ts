import { Pool } from 'pg';
import { isValidObjectId } from 'mongoose';
import { Horario } from '../Horarios/horarios';

// =====================================================================
// Reportes de la administrativa (sección 3.1.6).
//
// Todas las cifras salen de PostgreSQL, que es la fuente operativa:
//   - Ventas e inventario  -> esquema webpontoventa (sales, sale_items, products, waste_records)
//   - Visitas y personal   -> webcobro.asistencias / webcobro.empleados (reloj checador)
//   - Asistencia a clases  -> webcobro.reservas (+ el entrenador, que vive en MongoDB, en
//                             webadministrativa_horarios, enlazado por reservas.horario_id)
//
// Los días y las horas se calculan en la zona horaria REPORTES_TZ (por defecto
// America/Mexico_City) para que "por horario" coincida con la hora local del gimnasio.
// =====================================================================

export const ZONA_HORARIA = process.env.REPORTES_TZ || 'America/Mexico_City';
const SIN_ENTRENADOR = 'Sin asignar';
const MAX_DIAS = 366;
const MAX_TICKETS = 500;
const MAX_REGISTROS_PERSONAL = 500;

// ---------------------------------------------------------------------
// Conexión
// ---------------------------------------------------------------------

// Pool propio y perezoso. Usa las mismas variables POSTGRES_* que cobro y POS (con el
// gateway ya vienen cargadas); como respaldo acepta las PG_* del .env de esta sección.
let pool: Pool | null = null;
function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            host: process.env.POSTGRES_HOST ?? process.env.PG_HOST,
            port: Number(process.env.POSTGRES_PORT ?? process.env.PG_PORT ?? 5432),
            database: process.env.POSTGRES_DB ?? process.env.PG_DB,
            user: process.env.POSTGRES_USER ?? process.env.PG_USER,
            password: process.env.POSTGRES_PASSWORD ?? process.env.PG_PASSWORD,
        });
        pool.on('error', (err) => console.error('[reportes] Error inesperado en el pool de Postgres:', err));
    }
    return pool;
}

async function consulta<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const resultado = await getPool().query(sql, params);
    return resultado.rows as T[];
}

// ---------------------------------------------------------------------
// Filtros (rango de fechas + horario) y utilidades de fechas
// ---------------------------------------------------------------------

export interface Filtros {
    desde: string;      // YYYY-MM-DD
    hasta: string;      // YYYY-MM-DD
    horaDesde: number;  // 0-23
    horaHasta: number;  // 0-23
}

export type ResultadoFiltros = { ok: true; filtros: Filtros } | { ok: false; error: string };

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 86_400_000;
const aMs = (fecha: string) => Date.parse(`${fecha}T00:00:00Z`);
const deMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fechaValida = (fecha: string) => {
    const ms = aMs(fecha);
    return RE_FECHA.test(fecha) && Number.isFinite(ms) && deMs(ms) === fecha;
};
const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');

function hoyEnZona(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
}

function leerHora(valor: unknown, porDefecto: number): number | null {
    const t = texto(valor);
    if (!t) return porDefecto;
    if (!/^\d{1,2}$/.test(t)) return null;
    const n = Number(t);
    return n >= 0 && n <= 23 ? n : null;
}

/** Lee y valida ?desde=&hasta=&horaDesde=&horaHasta=. Por defecto: últimos 30 días, todo el día. */
export function leerFiltros(query: Record<string, unknown>): ResultadoFiltros {
    const hasta = texto(query.hasta) || hoyEnZona();
    if (!fechaValida(hasta)) return { ok: false, error: 'La fecha "hasta" debe tener el formato AAAA-MM-DD' };

    const desde = texto(query.desde) || deMs(aMs(hasta) - 29 * MS_DIA);
    if (!fechaValida(desde)) return { ok: false, error: 'La fecha "desde" debe tener el formato AAAA-MM-DD' };
    if (desde > hasta) return { ok: false, error: 'La fecha "desde" no puede ser posterior a "hasta"' };
    if ((aMs(hasta) - aMs(desde)) / MS_DIA + 1 > MAX_DIAS) {
        return { ok: false, error: `El rango máximo es de ${MAX_DIAS} días` };
    }

    const horaDesde = leerHora(query.horaDesde, 0);
    const horaHasta = leerHora(query.horaHasta, 23);
    if (horaDesde === null || horaHasta === null) return { ok: false, error: 'Las horas deben ser enteros entre 0 y 23' };
    if (horaDesde > horaHasta) return { ok: false, error: 'La hora inicial no puede ser posterior a la final' };

    return { ok: true, filtros: { desde, hasta, horaDesde, horaHasta } };
}

function rangoDeDias(desde: string, hasta: string): string[] {
    const dias: string[] = [];
    for (let ms = aMs(desde); ms <= aMs(hasta); ms += MS_DIA) dias.push(deMs(ms));
    return dias;
}

function rangoDeHoras(f: Filtros): number[] {
    return Array.from({ length: f.horaHasta - f.horaDesde + 1 }, (_, i) => f.horaDesde + i);
}

const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const porcentaje = (parte: number, total: number) => (total > 0 ? redondear((parte / total) * 100) : null);

// Condición de fecha + horario sobre una columna timestamptz. Usa $1..$5:
// [zona, desde, hasta, horaDesde, horaHasta] (ver paramsTiempo).
const tiempo = (col: string) =>
    `(${col} AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date ` +
    `AND EXTRACT(HOUR FROM ${col} AT TIME ZONE $1) BETWEEN $4::int AND $5::int`;
const paramsTiempo = (f: Filtros) => [ZONA_HORARIA, f.desde, f.hasta, f.horaDesde, f.horaHasta];

const filtrosRespuesta = (f: Filtros) => ({ ...f, zonaHoraria: ZONA_HORARIA });

// ---------------------------------------------------------------------
// 1. VENTAS — por día y/u horario, por tipo de producto, precio y ticket promedio
// ---------------------------------------------------------------------

interface FilaProductoVendido { categoria: string; nombre: string; precio: number; unidades: number; importe: number }

export async function reporteVentas(f: Filtros) {
    const params = paramsTiempo(f);
    const base = `FROM webpontoventa.sales s WHERE s.status = 'completed' AND ${tiempo('s.sold_at')}`;

    const [resumenFilas, dias, horas, productos, tickets] = await Promise.all([
        consulta<{ transacciones: number; total: number; promedio: number }>(
            `SELECT COUNT(*)::int AS transacciones,
                    COALESCE(SUM(s.total), 0)::float8 AS total,
                    COALESCE(AVG(s.total), 0)::float8 AS promedio ${base}`, params),
        consulta<{ fecha: string; transacciones: number; ventas: number }>(
            `SELECT to_char((s.sold_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha,
                    COUNT(*)::int AS transacciones, SUM(s.total)::float8 AS ventas
               ${base} GROUP BY 1 ORDER BY 1`, params),
        consulta<{ hora: number; transacciones: number; ventas: number }>(
            `SELECT EXTRACT(HOUR FROM s.sold_at AT TIME ZONE $1)::int AS hora,
                    COUNT(*)::int AS transacciones, SUM(s.total)::float8 AS ventas
               ${base} GROUP BY 1 ORDER BY 1`, params),
        consulta<FilaProductoVendido>(
            `SELECT COALESCE(p.category, 'Sin categoría') AS categoria, i.product_name AS nombre,
                    ROUND(AVG(i.unit_price), 2)::float8 AS precio,
                    SUM(i.quantity)::int AS unidades, SUM(i.line_total)::float8 AS importe
               FROM webpontoventa.sale_items i
               JOIN webpontoventa.sales s ON s.id = i.sale_id
               LEFT JOIN webpontoventa.products p ON p.id = i.product_id
              WHERE s.status = 'completed' AND ${tiempo('s.sold_at')}
              GROUP BY 1, 2 ORDER BY importe DESC`, params),
        consulta<{ folio: string; fecha: string; hora: string; total: number; formaPago: string; articulos: number }>(
            `SELECT s.folio,
                    to_char((s.sold_at AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha,
                    to_char(s.sold_at AT TIME ZONE $1, 'HH24:MI') AS hora,
                    s.total::float8 AS total, s.payment_method AS "formaPago",
                    (SELECT COALESCE(SUM(i.quantity), 0)::int FROM webpontoventa.sale_items i WHERE i.sale_id = s.id) AS articulos
               ${base} ORDER BY s.sold_at DESC LIMIT ${MAX_TICKETS + 1}`, params),
    ]);

    const resumen = resumenFilas[0];
    const ventasPorDia = new Map(dias.map((d) => [d.fecha, d]));
    const ventasPorHora = new Map(horas.map((h) => [h.hora, h]));

    const categorias = new Map<string, { categoria: string; total: number; unidades: number }>();
    for (const p of productos) {
        const actual = categorias.get(p.categoria) ?? { categoria: p.categoria, total: 0, unidades: 0 };
        actual.total += p.importe;
        actual.unidades += p.unidades;
        categorias.set(p.categoria, actual);
    }

    return {
        filtros: filtrosRespuesta(f),
        resumen: {
            totalVentas: redondear(resumen.total),
            transacciones: resumen.transacciones,
            ticketPromedio: redondear(resumen.promedio),
            unidadesVendidas: productos.reduce((s, p) => s + p.unidades, 0),
            productoTop: productos[0]?.nombre ?? null,
        },
        porDia: rangoDeDias(f.desde, f.hasta).map((fecha) => ({
            fecha,
            ventas: redondear(ventasPorDia.get(fecha)?.ventas ?? 0),
            transacciones: ventasPorDia.get(fecha)?.transacciones ?? 0,
        })),
        porHora: rangoDeHoras(f).map((hora) => ({
            hora,
            ventas: redondear(ventasPorHora.get(hora)?.ventas ?? 0),
            transacciones: ventasPorHora.get(hora)?.transacciones ?? 0,
        })),
        porCategoria: [...categorias.values()]
            .map((c) => ({ ...c, total: redondear(c.total) }))
            .sort((a, b) => b.total - a.total),
        productos,
        tickets: tickets.slice(0, MAX_TICKETS),
        ticketsTruncados: tickets.length > MAX_TICKETS,
    };
}

// ---------------------------------------------------------------------
// 2. VISITAS — entradas de socios (CLI-n) en el reloj checador, por día y/u horario
// ---------------------------------------------------------------------

export async function reporteVisitas(f: Filtros) {
    const params = paramsTiempo(f);
    const base = `FROM webcobro.asistencias a
                   WHERE a.codigo LIKE 'CLI-%' AND a.tipo = 'entrada' AND ${tiempo('a.creado_en')}`;

    const [resumenFilas, dias, horas] = await Promise.all([
        consulta<{ visitas: number; unicos: number }>(
            `SELECT COUNT(*)::int AS visitas, COUNT(DISTINCT a.codigo)::int AS unicos ${base}`, params),
        consulta<{ fecha: string; visitas: number; unicos: number }>(
            `SELECT to_char((a.creado_en AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha,
                    COUNT(*)::int AS visitas, COUNT(DISTINCT a.codigo)::int AS unicos
               ${base} GROUP BY 1 ORDER BY 1`, params),
        consulta<{ hora: number; visitas: number }>(
            `SELECT EXTRACT(HOUR FROM a.creado_en AT TIME ZONE $1)::int AS hora, COUNT(*)::int AS visitas
               ${base} GROUP BY 1 ORDER BY 1`, params),
    ]);

    const visitasPorDia = new Map(dias.map((d) => [d.fecha, d]));
    const visitasPorHora = new Map(horas.map((h) => [h.hora, h.visitas]));
    const porDia = rangoDeDias(f.desde, f.hasta).map((fecha) => ({
        fecha,
        visitas: visitasPorDia.get(fecha)?.visitas ?? 0,
        unicos: visitasPorDia.get(fecha)?.unicos ?? 0,
    }));
    const porHora = rangoDeHoras(f).map((hora) => ({ hora, visitas: visitasPorHora.get(hora) ?? 0 }));

    const { visitas, unicos } = resumenFilas[0];
    const diaPico = porDia.reduce<(typeof porDia)[number] | null>((m, d) => (d.visitas > (m?.visitas ?? 0) ? d : m), null);
    const horaPico = porHora.reduce<(typeof porHora)[number] | null>((m, h) => (h.visitas > (m?.visitas ?? 0) ? h : m), null);

    return {
        filtros: filtrosRespuesta(f),
        resumen: {
            totalVisitas: visitas,
            visitantesUnicos: unicos,
            promedioDiario: porDia.length ? redondear(visitas / porDia.length) : 0,
            diaPico: diaPico ? { fecha: diaPico.fecha, visitas: diaPico.visitas } : null,
            horaPico: horaPico ? { hora: horaPico.hora, visitas: horaPico.visitas } : null,
        },
        porDia,
        porHora,
    };
}

// ---------------------------------------------------------------------
// 3. ASISTENCIA A CLASES — por clase y por entrenador
// ---------------------------------------------------------------------

interface FilaReservas {
    clase: string;
    horarioId: string;
    reservadas: number;
    asistieron: number;
    noAsistieron: number;
    canceladas: number;
}

// El entrenador no está en webcobro.reservas: se toma del horario (Mongo) al que apunta horario_id.
async function entrenadoresPorHorario(ids: string[]): Promise<{ mapa: Map<string, string>; disponible: boolean }> {
    const validos = [...new Set(ids.filter((id) => isValidObjectId(id)))];
    if (validos.length === 0) return { mapa: new Map(), disponible: true };
    try {
        const horarios = await Horario.find({ _id: { $in: validos } }).select('nombreEntrenador').lean();
        return {
            mapa: new Map(horarios.map((h) => [String(h._id), h.nombreEntrenador || SIN_ENTRENADOR])),
            disponible: true,
        };
    } catch (err) {
        console.error('[reportes] No se pudieron consultar los entrenadores en MongoDB:', err);
        return { mapa: new Map(), disponible: false };
    }
}

interface Acumulado { reservadas: number; asistieron: number; noAsistieron: number; canceladas: number }
const vacio = (): Acumulado => ({ reservadas: 0, asistieron: 0, noAsistieron: 0, canceladas: 0 });
const sumar = (a: Acumulado, r: Acumulado) => {
    a.reservadas += r.reservadas;
    a.asistieron += r.asistieron;
    a.noAsistieron += r.noAsistieron;
    a.canceladas += r.canceladas;
};
// La tasa solo cuenta clases que ya ocurrieron (asistió o no asistió); las pendientes no pesan.
const conTasa = <T extends Acumulado>(fila: T) => ({
    ...fila,
    tasaAsistencia: porcentaje(fila.asistieron, fila.asistieron + fila.noAsistieron),
});

export async function reporteAsistenciaClases(f: Filtros) {
    // La hora de la reserva es texto "HH:MM". Con el horario completo (0-23) no se filtra por hora.
    const filas = await consulta<FilaReservas>(
        `SELECT r.clase, r.horario_id AS "horarioId",
                COUNT(*) FILTER (WHERE r.estado <> 'cancelado')::int AS reservadas,
                COUNT(*) FILTER (WHERE r.estado = 'asistido')::int AS asistieron,
                COUNT(*) FILTER (WHERE r.estado = 'no_asistio')::int AS "noAsistieron",
                COUNT(*) FILTER (WHERE r.estado = 'cancelado')::int AS canceladas
           FROM webcobro.reservas r
          WHERE r.estado_cupo = 'confirmada'
            AND r.fecha ~ '^\\d{4}-\\d{2}-\\d{2}$' AND r.fecha BETWEEN $1 AND $2
            AND ($3::int = 0 AND $4::int = 23
                 OR (CASE WHEN r.hora ~ '^\\d{1,2}:\\d{2}' THEN split_part(r.hora, ':', 1)::int END) BETWEEN $3::int AND $4::int)
          GROUP BY r.clase, r.horario_id`,
        [f.desde, f.hasta, f.horaDesde, f.horaHasta],
    );

    const { mapa, disponible } = await entrenadoresPorHorario(filas.map((x) => x.horarioId));

    const detalle = new Map<string, Acumulado & { clase: string; entrenador: string }>();
    const porClase = new Map<string, Acumulado & { clase: string }>();
    const porEntrenador = new Map<string, Acumulado & { entrenador: string }>();
    const total = vacio();

    for (const fila of filas) {
        const entrenador = mapa.get(fila.horarioId) ?? SIN_ENTRENADOR;
        const claveDetalle = `${fila.clase}\u0000${entrenador}`;
        const d = detalle.get(claveDetalle) ?? { ...vacio(), clase: fila.clase, entrenador };
        const c = porClase.get(fila.clase) ?? { ...vacio(), clase: fila.clase };
        const e = porEntrenador.get(entrenador) ?? { ...vacio(), entrenador };
        sumar(d, fila); sumar(c, fila); sumar(e, fila); sumar(total, fila);
        detalle.set(claveDetalle, d); porClase.set(fila.clase, c); porEntrenador.set(entrenador, e);
    }

    const ordenar = <T extends Acumulado>(valores: Iterable<T>) =>
        [...valores].map(conTasa).sort((a, b) => b.asistieron - a.asistieron || b.reservadas - a.reservadas);

    return {
        filtros: filtrosRespuesta(f),
        entrenadoresDisponibles: disponible,
        resumen: conTasa(total),
        porClase: ordenar(porClase.values()),
        porEntrenador: ordenar(porEntrenador.values()),
        detalle: ordenar(detalle.values()),
    };
}

// ---------------------------------------------------------------------
// 4. INVENTARIO — existencias actuales y mermas del periodo
// ---------------------------------------------------------------------

export async function reporteInventario(f: Filtros) {
    const [productos, mermas] = await Promise.all([
        consulta<{
            id: number; codigo: string; nombre: string; categoria: string; precio: number; costo: number;
            stock: number; stockMinimo: number; estatus: 'active' | 'inactive';
        }>(
            `SELECT id, code AS codigo, name AS nombre, category AS categoria,
                    price::float8 AS precio, cost::float8 AS costo,
                    stock::int AS stock, minimum_stock::int AS "stockMinimo", status AS estatus
               FROM webpontoventa.products ORDER BY name`),
        consulta<{
            id: number; folio: string; producto: string; cantidad: number; motivo: string;
            observaciones: string; costoUnitario: number; perdida: number; fecha: string; registradoPor: string;
        }>(
            `SELECT w.id, w.folio, p.name AS producto, w.quantity::int AS cantidad, w.reason AS motivo,
                    w.observations AS observaciones, w.unit_cost::float8 AS "costoUnitario",
                    (w.quantity * w.unit_cost)::float8 AS perdida,
                    to_char(w.created_at AT TIME ZONE $1, 'YYYY-MM-DD HH24:MI') AS fecha,
                    w.registered_by AS "registradoPor"
               FROM webpontoventa.waste_records w
               JOIN webpontoventa.products p ON p.id = w.product_id
              WHERE (w.created_at AT TIME ZONE $1)::date BETWEEN $2::date AND $3::date
              ORDER BY w.created_at DESC`,
            [ZONA_HORARIA, f.desde, f.hasta]),
    ]);

    const activos = productos.filter((p) => p.estatus === 'active');
    const porMotivo = new Map<string, { motivo: string; registros: number; unidades: number; perdida: number }>();
    for (const m of mermas) {
        const actual = porMotivo.get(m.motivo) ?? { motivo: m.motivo, registros: 0, unidades: 0, perdida: 0 };
        actual.registros += 1;
        actual.unidades += m.cantidad;
        actual.perdida += m.perdida;
        porMotivo.set(m.motivo, actual);
    }

    return {
        // Las existencias son las de hoy; solo las mermas respetan el rango de fechas.
        filtros: filtrosRespuesta(f),
        resumen: {
            productosActivos: activos.length,
            totalUnidades: productos.reduce((s, p) => s + p.stock, 0),
            valorAlCosto: redondear(productos.reduce((s, p) => s + p.stock * p.costo, 0)),
            valorAlPrecio: redondear(productos.reduce((s, p) => s + p.stock * p.precio, 0)),
            conPocoStock: activos.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo).length,
            agotados: activos.filter((p) => p.stock === 0).length,
            mermasUnidades: mermas.reduce((s, m) => s + m.cantidad, 0),
            mermasPerdida: redondear(mermas.reduce((s, m) => s + m.perdida, 0)),
        },
        productos,
        mermas: mermas.map((m) => ({ ...m, perdida: redondear(m.perdida) })),
        mermasPorMotivo: [...porMotivo.values()]
            .map((m) => ({ ...m, perdida: redondear(m.perdida) }))
            .sort((a, b) => b.perdida - a.perdida),
    };
}

// ---------------------------------------------------------------------
// 5. PERSONAL — asistencia, ausentismo y retardos (empleados EMP-n)
// ---------------------------------------------------------------------

// Las columnas estado/automatica las agrega la migración db/asistencia-turnos.sql. Si todavía no
// se aplicó, el reporte sigue funcionando con las entradas y avisa que no hay clasificación.
let tieneClasificacion = false;
async function clasificacionDisponible(): Promise<boolean> {
    if (tieneClasificacion) return true;
    const [fila] = await consulta<{ ok: boolean }>(
        `SELECT COUNT(*) = 2 AS ok FROM information_schema.columns
          WHERE table_schema = 'webcobro' AND table_name = 'asistencias'
            AND column_name IN ('estado', 'automatica')`);
    tieneClasificacion = fila?.ok === true;
    return tieneClasificacion;
}

export async function reportePersonal(f: Filtros) {
    const params = paramsTiempo(f);
    const clasificado = await clasificacionDisponible();
    const estado = clasificado ? 'a.estado' : 'NULL::text';
    const automatica = clasificado ? 'a.automatica' : 'false';

    const [empleados, registros] = await Promise.all([
        consulta<{
            codigo: string; nombre: string; rol: string; entradas: number; puntuales: number;
            retardos: number; faltas: number; sinTurno: number;
        }>(
            `SELECT e.codigo, e.nombre, e.rol,
                    COUNT(a.id)::int AS entradas,
                    COUNT(a.id) FILTER (WHERE ${estado} = 'puntual')::int AS puntuales,
                    COUNT(a.id) FILTER (WHERE ${estado} = 'retardo')::int AS retardos,
                    COUNT(a.id) FILTER (WHERE ${estado} = 'inasistencia')::int AS faltas,
                    COUNT(a.id) FILTER (WHERE ${estado} = 'sin_turno')::int AS "sinTurno"
               FROM webcobro.empleados e
               LEFT JOIN webcobro.asistencias a
                      ON a.codigo = e.codigo AND a.tipo = 'entrada' AND ${tiempo('a.creado_en')}
              GROUP BY e.codigo, e.nombre, e.rol
              ORDER BY e.nombre`, params),
        consulta<{
            codigo: string; nombre: string; fecha: string; entrada: string | null;
            salida: string | null; estado: string | null; automatica: boolean;
        }>(
            `SELECT a.codigo, a.nombre,
                    to_char((a.creado_en AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS fecha,
                    to_char((MIN(a.creado_en) FILTER (WHERE a.tipo = 'entrada' AND NOT ${automatica})) AT TIME ZONE $1, 'HH24:MI') AS entrada,
                    to_char((MAX(a.creado_en) FILTER (WHERE a.tipo = 'salida')) AT TIME ZONE $1, 'HH24:MI') AS salida,
                    (ARRAY_AGG(${estado} ORDER BY a.creado_en) FILTER (WHERE a.tipo = 'entrada'))[1] AS estado,
                    BOOL_OR(${automatica}) AS automatica
               FROM webcobro.asistencias a
              WHERE a.codigo LIKE 'EMP-%' AND ${tiempo('a.creado_en')}
              GROUP BY a.codigo, a.nombre, 3
              ORDER BY 3 DESC, a.nombre
              LIMIT ${MAX_REGISTROS_PERSONAL + 1}`, params),
    ]);

    const porEmpleado = empleados.map((e) => {
        // Días con turno evaluado: puntual + retardo + falta (sin_turno no cuenta para los porcentajes).
        const evaluados = e.puntuales + e.retardos + e.faltas;
        return {
            ...e,
            sinClasificar: clasificado ? 0 : e.entradas,
            diasEvaluados: evaluados,
            asistenciaPct: porcentaje(e.puntuales + e.retardos, evaluados),
            retardoPct: porcentaje(e.retardos, evaluados),
            ausentismoPct: porcentaje(e.faltas, evaluados),
        };
    });

    const totales = porEmpleado.reduce(
        (t, e) => ({
            puntuales: t.puntuales + e.puntuales, retardos: t.retardos + e.retardos,
            faltas: t.faltas + e.faltas, evaluados: t.evaluados + e.diasEvaluados,
        }),
        { puntuales: 0, retardos: 0, faltas: 0, evaluados: 0 },
    );

    return {
        filtros: filtrosRespuesta(f),
        clasificacionDisponible: clasificado,
        resumen: {
            empleados: porEmpleado.length,
            puntuales: totales.puntuales,
            retardos: totales.retardos,
            faltas: totales.faltas,
            asistenciaPct: porcentaje(totales.puntuales + totales.retardos, totales.evaluados),
            retardoPct: porcentaje(totales.retardos, totales.evaluados),
            ausentismoPct: porcentaje(totales.faltas, totales.evaluados),
        },
        porEmpleado,
        registros: registros.slice(0, MAX_REGISTROS_PERSONAL),
        registrosTruncados: registros.length > MAX_REGISTROS_PERSONAL,
    };
}