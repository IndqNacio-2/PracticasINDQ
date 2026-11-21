import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { CatalogoMembresia } from '../models/membresia-catalogo';
import { Clase } from '../models/clase';
import { fechaLocal } from '../lib/fecha';
import { Compras, carteraDe, nombresDeClases } from '../lib/membresia';
import { condicionesDe, insertarCompra, ReglaMembresia, saldoEnMemoria, saldoTotalEnMemoria } from '../membresias-core/compras';

// Membresías desde la app: ver el catálogo, APARTAR una (se genera un código PQ-XXXXX y se paga al llegar al
// local), ver las propias con sus accesos usados y pendientes, y cancelar un apartado que no se pagó.
// Son las mismas compras que cobra recepción en la web de cobro: el pago se hace allá.
const router = Router();

const opcionVista = (o: any) => ({
    idOpcion: o.id,
    precio: o.costo,
    entradas: o.entradas ?? null, // null = ilimitadas
    distribucion: o.distribucion ?? 'compartida',
    entradasPorClase: o.entradasPorClase ?? null,
    vigencia: { duracion: o.duracion ?? o.vigenciaDias ?? null, unidad: o.unidadDuracion ?? 'dias' },
});

// GET /api/membresias — catálogo disponible para comprar
router.get('/', async (_req, res) => {
    const catalogo: any[] = await CatalogoMembresia.find({ estatus: 'activo' }).sort({ fechaCreacion: 1, nombre: 1 }).lean();
    const nombres = await nombresDeClases(catalogo.flatMap((m) => m.clasesIds ?? []));
    res.json(
        catalogo
            .filter((m) => Array.isArray(m.clasesIds) && m.clasesIds.length)
            .map((m) => ({
                idMembresia: String(m._id),
                nombre: m.nombre,
                descripcion: m.descripcion ?? '',
                clases: m.clasesIds.map((id: string) => ({ idClase: id, nombre: nombres.get(id) ?? '' })),
                // Solo las presentaciones con precio definido se pueden comprar
                opciones: (m.opciones ?? []).filter((o: any) => o.costo !== null && o.costo !== undefined).map(opcionVista),
                complementos: m.complementos ?? null,
            }))
            .filter((m) => m.opciones.length),
    );
});

// Vista de una compra para la app
async function vistaCompra(compra: any, cartera: Awaited<ReturnType<typeof carteraDe>>, hoy: string) {
    const usos = cartera.usos.get(String(compra._id)) ?? [];
    const nombres = await nombresDeClases(compra.condiciones.clasesIds);
    const activa = compra.estado === 'activa';
    const vigencia = !activa
        ? (compra.estado === 'apartada' ? 'por_pagar' : 'cancelada')
        : hoy < compra.fechaInicio ? 'por_iniciar' : hoy > compra.fechaFin ? 'vencida' : 'vigente';
    const total = activa ? saldoTotalEnMemoria(compra, usos) : null;

    return {
        idCompra: String(compra._id),
        codigo: compra.codigo,
        estado: compra.estado, // apartada | activa | cancelada
        vigencia, // por_pagar | por_iniciar | vigente | vencida | cancelada
        membresia: compra.condiciones.nombre,
        idOpcion: compra.idOpcion,
        precio: compra.precio,
        pagada: compra.estadoPago === 'pagado',
        fechaInicio: compra.fechaInicio,
        fechaFin: compra.fechaFin,
        // Accesos a clases: usados (asistió, no asistió o canceló), pendientes (reservados por venir) y restantes
        accesos: total && {
            total: total.total,
            usados: total.consumidas,
            pendientes: total.apartadas,
            restantes: total.disponibles,
        },
        porClase: activa && compra.condiciones.opcion.distribucion === 'por_clase'
            ? compra.condiciones.clasesIds.map((id: string) => {
                const s = saldoEnMemoria(compra, usos, id);
                return { idClase: id, clase: nombres.get(id) ?? '', total: s.total, usados: s.consumidas, pendientes: s.apartadas, restantes: s.disponibles };
            })
            : null,
    };
}

// GET /api/membresias/mias — las membresías del cliente (apartadas, activas y canceladas)
router.get('/mias', async (_req, res) => {
    const idCliente = String(res.locals.cliente._id);
    const hoy = fechaLocal();
    const [compras, cartera] = await Promise.all([
        Compras.find({ idCliente }).sort({ fechaCreacion: -1 }),
        carteraDe(idCliente),
    ]);
    // La cartera trae las compras como objetos planos y sus usos: se vuelve a buscar cada una ahí si está activa.
    const planas = new Map(cartera.compras.map((c) => [String(c._id), c]));
    res.json(await Promise.all(compras.map((c) => vistaCompra(planas.get(String(c._id)) ?? c.toObject(), cartera, hoy))));
});

// POST /api/membresias/apartar  { idMembresia, idOpcion }
// Aparta la membresía: genera el código PQ-XXXXX y se paga al llegar al local.
router.post('/apartar', async (req, res) => {
    const cliente = res.locals.cliente;
    const idMembresia = String(req.body?.idMembresia ?? '');
    const idOpcion = String(req.body?.idOpcion ?? '');
    if (!isValidObjectId(idMembresia) || !idOpcion) {
        return res.status(400).json({ error: 'Elige la membresía y su presentación' });
    }
    try {
        const catalogo = await CatalogoMembresia.findById(idMembresia).lean();
        if (!catalogo) throw new ReglaMembresia('La membresía u opción ya no está disponible.');
        const condiciones = condicionesDe(catalogo, idOpcion);

        const idCliente = String(cliente._id);
        if (await Compras.exists({ idCliente, estado: 'apartada', idMembresia, idOpcion })) {
            throw new ReglaMembresia('Ya tienes apartada esta membresía. Págala en el local o cancélala para apartar otra.');
        }
        const { compra } = await insertarCompra(Compras, {
            idCliente,
            nombreCliente: `${cliente.nombre} ${cliente.apellidos}`.trim(),
            idMembresia,
            idOpcion,
            condiciones,
            estado: 'apartada',
            precio: Number(condiciones.opcion.costo),
            estadoPago: 'pendiente',
            origen: 'app',
        });
        res.status(201).json(await vistaCompra(compra, { compras: [], usos: new Map() }, fechaLocal()));
    } catch (err) {
        if (err instanceof ReglaMembresia) return res.status(err.status).json({ error: err.message });
        throw err;
    }
});

// POST /api/membresias/:id/cancelar — cancela una membresía apartada que todavía no se paga
router.post('/:id/cancelar', async (req, res) => {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Id de membresía inválido' });
    const idCliente = String(res.locals.cliente._id);
    const actual = await Compras.findOne({ _id: req.params.id, idCliente });
    if (!actual) return res.status(404).json({ error: 'Membresía no encontrada' });
    if (actual.estado === 'activa') return res.status(409).json({ error: 'Una membresía ya pagada no se cancela: no hay reembolso' });
    if (actual.estado === 'cancelada') return res.status(409).json({ error: 'Esa membresía ya estaba cancelada' });

    const cancelada = await Compras.findOneAndUpdate(
        { _id: actual._id, estado: 'apartada' },
        { estado: 'cancelada', fechaCancelacion: new Date() },
        { new: true },
    );
    if (!cancelada) return res.status(409).json({ error: 'La membresía cambió mientras se procesaba. Vuelve a consultarla' });
    res.json(await vistaCompra(cancelada, { compras: [], usos: new Map() }, fechaLocal()));
});

export default router;
