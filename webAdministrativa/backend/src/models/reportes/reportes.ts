import type { PipelineStage } from 'mongoose';
import { Venta } from '../Ventas/ventas';
import { Producto } from '../Productos/productos';
import { Movimiento } from '../Movimientos/movimientos';
import { Reservacion } from '../Reservaciones/reservacion';
import { RegistroAsistencia } from '../Asistencia/asistencia';

// Los reportes no se guardan: se calculan con consultas de agregación sobre las colecciones.
// Todas las fechas son strings YYYY-MM-DD, así que la comparación $gte/$lte funciona directo.

export interface Rango {
    desde?: string;
    hasta?: string;
}

function filtroFecha(campo: string, { desde, hasta }: Rango): Record<string, unknown> {
    if (!desde && !hasta) return {};
    return { [campo]: { ...(desde ? { $gte: desde } : {}), ...(hasta ? { $lte: hasta } : {}) } };
}

const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ───────────── Ventas ───────────── */

export async function reporteVentas(rango: Rango) {
    const match = { ...filtroFecha('fecha', rango), estatus: { $ne: 'cancelada' } };

    const [resumen, porDia, porHorario, porCategoria, porProducto] = await Promise.all([
        Venta.aggregate<{ total: number; transacciones: number }>([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$total' }, transacciones: { $sum: 1 } } },
        ]),
        Venta.aggregate<{ fecha: string; total: number; transacciones: number }>([
            { $match: match },
            { $group: { _id: '$fecha', total: { $sum: '$total' }, transacciones: { $sum: 1 } } },
            { $project: { _id: 0, fecha: '$_id', total: 1, transacciones: 1 } },
            { $sort: { fecha: 1 } },
        ]),
        Venta.aggregate<{ hora: string; total: number; transacciones: number }>([
            { $match: match },
            {
                $group: {
                    _id: { $substrBytes: [{ $ifNull: ['$hora', '00'] }, 0, 2] },
                    total: { $sum: '$total' },
                    transacciones: { $sum: 1 },
                },
            },
            { $project: { _id: 0, hora: { $concat: ['$_id', ':00'] }, total: 1, transacciones: 1 } },
            { $sort: { hora: 1 } },
        ]),
        Venta.aggregate<{ categoria: string; total: number; unidades: number }>([
            { $match: match },
            { $unwind: '$productos' },
            {
                $group: {
                    _id: { $ifNull: ['$productos.categoria', 'Sin categoría'] },
                    total: { $sum: { $multiply: ['$productos.precio', '$productos.cantidad'] } },
                    unidades: { $sum: '$productos.cantidad' },
                },
            },
            { $project: { _id: 0, categoria: '$_id', total: 1, unidades: 1 } },
            { $sort: { total: -1 } },
        ]),
        Venta.aggregate<{ idProducto: string; nombre: string; categoria: string; precio: number; unidades: number; total: number }>([
            { $match: match },
            { $unwind: '$productos' },
            {
                $group: {
                    _id: '$productos.idProducto',
                    nombre: { $first: '$productos.nombre' },
                    categoria: { $first: '$productos.categoria' },
                    precio: { $max: '$productos.precio' },
                    unidades: { $sum: '$productos.cantidad' },
                    total: { $sum: { $multiply: ['$productos.precio', '$productos.cantidad'] } },
                },
            },
            { $project: { _id: 0, idProducto: '$_id', nombre: 1, categoria: 1, precio: 1, unidades: 1, total: 1 } },
            { $sort: { precio: 1, nombre: 1 } }, // de menor a mayor precio; el frontend invierte para el otro orden
        ]),
    ]);

    const total = resumen[0]?.total ?? 0;
    const transacciones = resumen[0]?.transacciones ?? 0;
    const topProducto = [...porProducto].sort((a, b) => b.total - a.total)[0];

    return {
        resumen: {
            total: redondear(total),
            transacciones,
            ticketPromedio: transacciones ? redondear(total / transacciones) : 0,
            productoTop: topProducto?.nombre ?? '',
        },
        porDia,
        porHorario,
        porCategoria,
        productosPorPrecio: porProducto,
    };
}

/* ───────────── Visitas ───────────── */

export async function reporteVisitas(rango: Rango) {
    const match = { tipoPersona: 'cliente' as const, ...filtroFecha('fecha', rango) };

    const [porDia, porHorario] = await Promise.all([
        RegistroAsistencia.aggregate<{ fecha: string; visitas: number }>([
            { $match: match },
            { $group: { _id: '$fecha', visitas: { $sum: 1 } } },
            { $project: { _id: 0, fecha: '$_id', visitas: 1 } },
            { $sort: { fecha: 1 } },
        ]),
        RegistroAsistencia.aggregate<{ hora: string; visitas: number }>([
            { $match: { ...match, horaEntrada: { $ne: '' } } },
            { $group: { _id: { $substrBytes: ['$horaEntrada', 0, 2] }, visitas: { $sum: 1 } } },
            { $project: { _id: 0, hora: { $concat: ['$_id', ':00'] }, visitas: 1 } },
            { $sort: { hora: 1 } },
        ]),
    ]);

    const total = porDia.reduce((s, d) => s + d.visitas, 0);
    const diaTop = porDia.reduce<{ fecha: string; visitas: number } | null>(
        (m, d) => (!m || d.visitas > m.visitas ? d : m),
        null
    );

    return {
        resumen: {
            total,
            promedioDiario: porDia.length ? Math.round(total / porDia.length) : 0,
            diaTop: diaTop?.fecha ?? '',
        },
        porDia,
        porHorario,
    };
}

/* ───────────── Asistencia a clases ───────────── */

export async function reporteAsistenciaClases(rango: Rango, por: 'clase' | 'entrenador') {
    const match = { ...filtroFecha('fechaClase', rango), estatus: { $ne: 'cancelada' } };
    const campo = por === 'entrenador' ? '$entrenador' : '$clase';

    const pipeline: PipelineStage[] = [
        { $match: match },
        {
            $group: {
                _id: campo,
                reservaciones: { $sum: 1 },
                asistencias: { $sum: { $cond: ['$asistenciaConfirmada', 1, 0] } },
            },
        },
        {
            $project: {
                _id: 0,
                nombre: '$_id',
                reservaciones: 1,
                asistencias: 1,
                ausencias: { $subtract: ['$reservaciones', '$asistencias'] },
                porcentaje: {
                    $round: [{ $multiply: [{ $divide: ['$asistencias', '$reservaciones'] }, 100] }, 0],
                },
            },
        },
        { $sort: { asistencias: -1, nombre: 1 } },
    ];

    const filas = await Reservacion.aggregate<{
        nombre: string;
        reservaciones: number;
        asistencias: number;
        ausencias: number;
        porcentaje: number;
    }>(pipeline);

    const reservaciones = filas.reduce((s, f) => s + f.reservaciones, 0);
    const asistencias = filas.reduce((s, f) => s + f.asistencias, 0);

    return {
        por,
        resumen: {
            reservaciones,
            asistencias,
            porcentaje: reservaciones ? Math.round((asistencias / reservaciones) * 100) : 0,
        },
        filas,
    };
}

/* ───────────── Inventario ───────────── */

export async function reporteInventario(rango: Rango) {
    const [productos, mermas] = await Promise.all([
        Producto.find().sort({ nombre: 1 }).lean(),
        Movimiento.find({ tipo: 'merma', ...filtroFecha('fecha', rango) })
            .sort({ _id: -1 })
            .lean(),
    ]);

    const filas = productos.map((p) => ({
        idProducto: String(p._id),
        nombre: p.nombre,
        categoria: p.categoria,
        precio: p.precio,
        stock: p.stock,
        estatus: p.estatus,
        valor: redondear(p.stock * p.precio),
    }));

    return {
        resumen: {
            productosActivos: filas.filter((f) => f.estatus === 'activo').length,
            totalUnidades: filas.reduce((s, f) => s + f.stock, 0),
            valorTotal: redondear(filas.reduce((s, f) => s + f.valor, 0)),
            mermasUnidades: mermas.reduce((s, m) => s + m.cantidad, 0),
        },
        productos: filas,
        mermas: mermas.map((m) => ({
            id: String(m._id),
            idProducto: m.idProducto,
            nombreProducto: m.nombreProducto,
            cantidad: m.cantidad,
            motivo: m.motivo,
            fecha: m.fecha,
        })),
    };
}

/* ───────────── Personal ───────────── */

export async function reportePersonal(rango: Rango) {
    const match = { tipoPersona: 'personal' as const, ...filtroFecha('fecha', rango) };

    const [resumen, detalle] = await Promise.all([
        RegistroAsistencia.aggregate<{
            idPersona: string;
            nombre: string;
            rol: string;
            asistencias: number;
            retardos: number;
            faltas: number;
            porcentaje: number;
        }>([
            { $match: match },
            {
                $group: {
                    _id: '$idPersona',
                    nombre: { $first: '$nombrePersona' },
                    rol: { $first: '$rol' },
                    asistencias: { $sum: { $cond: [{ $eq: ['$tipoRegistro', 'asistencia'] }, 1, 0] } },
                    retardos: { $sum: { $cond: [{ $eq: ['$tipoRegistro', 'retardo'] }, 1, 0] } },
                    faltas: { $sum: { $cond: [{ $eq: ['$tipoRegistro', 'falta'] }, 1, 0] } },
                },
            },
            {
                $project: {
                    _id: 0,
                    idPersona: '$_id',
                    nombre: 1,
                    rol: 1,
                    asistencias: 1,
                    retardos: 1,
                    faltas: 1,
                    // Un retardo cuenta como asistencia (la persona llegó); el porcentaje mide no faltar
                    porcentaje: {
                        $round: [
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            { $add: ['$asistencias', '$retardos'] },
                                            { $add: ['$asistencias', '$retardos', '$faltas'] },
                                        ],
                                    },
                                    100,
                                ],
                            },
                            0,
                        ],
                    },
                },
            },
            { $sort: { nombre: 1 } },
        ]),
        RegistroAsistencia.find(match).sort({ fecha: -1, horaEntrada: -1 }).limit(200).lean(),
    ]);

    return {
        resumen,
        detalle: detalle.map((d) => ({
            id: String(d._id),
            idPersona: d.idPersona,
            nombrePersona: d.nombrePersona,
            rol: d.rol,
            fecha: d.fecha,
            horaEntrada: d.horaEntrada,
            horaSalida: d.horaSalida,
            tipoRegistro: d.tipoRegistro,
        })),
    };
}
