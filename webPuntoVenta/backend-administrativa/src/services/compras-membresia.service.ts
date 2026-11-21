import { isValidObjectId, type Model } from 'mongoose';
import { CompraMembresia } from '../membresias-core/compra.model';
import { Reservacion } from '../models/Reservaciones/reservacion';
import { Membresia } from '../models/Membresia/membresia.model';
import { ClienteModel } from '../models/Clientes/clienteTipado';
import { ZONA_HORARIA } from '../lib/edad';
import { normalizarCodigo } from '../clientes-core/codigos';
import {
    cargarCartera, condicionesDe, finVigencia, insertarCompra, ReglaMembresia, saldoEnMemoria, saldoTotalEnMemoria,
} from '../membresias-core/compras';

// Compras de membresía (única fuente para cobro, administrativa y la app móvil).
//  - 'apartada': la apartó el cliente desde la app. Tiene código PQ-XXXXX y se paga al llegar al local.
//  - 'activa'  : ya pagada y en vigencia.
// Cobro registra el pago (folio, método, ticket) en Postgres y después llama aquí para activar la compra.
// Los errores de regla son ReglaMembresia (membresias-core) y salen con `manejarReglas`.

const Compras = CompraMembresia as unknown as Model<any>;
const Reservaciones = Reservacion as unknown as Model<any>;

const hoyLocal = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Agrega a la compra si está vigente, vencida o por iniciar (se calcula con la fecha de hoy). */
function conVigencia(compra: any) {
    const salida = compra.toJSON();
    if (compra.estado !== 'activa') {
        salida.vigencia = compra.estado === 'apartada' ? 'por_pagar' : 'cancelada';
    } else {
        const hoy = hoyLocal();
        salida.vigencia = hoy < compra.fechaInicio ? 'por_iniciar' : hoy > compra.fechaFin ? 'vencida' : 'vigente';
    }
    return salida;
}

async function buscar(id: string): Promise<any> {
    if (!isValidObjectId(id)) throw new ReglaMembresia('ID de compra inválido', 400);
    const compra = await Compras.findById(id);
    if (!compra) throw new ReglaMembresia('Compra de membresía no encontrada', 404);
    return compra;
}

const textoCorto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------- Consulta ----------

export async function listarCompras(query: Record<string, unknown> = {}) {
    const filtro: Record<string, any> = {};
    const cadena = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    if (cadena(query.idCliente)) filtro.idCliente = cadena(query.idCliente);
    if (cadena(query.solicitudId)) filtro.solicitudId = cadena(query.solicitudId);
    const estado = cadena(query.estado);
    if (estado === 'apartada' || estado === 'activa' || estado === 'cancelada') filtro.estado = estado;
    const codigo = cadena(query.codigo);
    if (codigo) filtro.codigo = codigo.toUpperCase();
    const lista = await Compras.find(filtro).sort({ fechaCreacion: -1 }).limit(1000);
    return lista.map(conVigencia);
}

/**
 * Compras de un cliente con su saldo de entradas. `saldos` trae una fila por clase (distribución por clase) o una
 * sola fila compartida; `saldo` es el total de la compra (para la app móvil). Solo las pagadas tienen saldo.
 */
export async function comprasDeCliente(idCliente: string) {
    const lista = await Compras.find({ idCliente }).sort({ fechaCreacion: -1 });
    const { usos } = await cargarCartera(Compras, Reservaciones, idCliente);
    return lista.map((compra: any) => {
        const salida = conVigencia(compra);
        if (compra.estado !== 'activa') return { ...salida, saldo: null, saldos: [] };
        const usosCompra = usos.get(String(compra._id)) ?? [];
        const porClase = compra.condiciones.opcion.distribucion === 'por_clase';
        return {
            ...salida,
            saldo: saldoTotalEnMemoria(compra, usosCompra),
            saldos: (porClase ? compra.condiciones.clasesIds : [null]).map((claseId: string | null) => ({
                claseId,
                ...saldoEnMemoria(compra, usosCompra, claseId ?? ''),
            })),
        };
    });
}

/**
 * Precio y vigencia de una compra ANTES de cobrarla: cobro lo necesita para validar el efectivo y registrar el pago.
 * Body: idCliente, idMembresia, idOpcion, fechaInicio (opcional, por defecto hoy).
 */
export async function cotizarCompra(body: any) {
    const idCliente = String(body?.idCliente ?? '');
    if (!isValidObjectId(idCliente)) throw new ReglaMembresia('ID de cliente inválido', 400);
    const cliente: any = await ClienteModel.findById(idCliente);
    if (!cliente) throw new ReglaMembresia('Cliente no encontrado', 404);
    if (cliente.estatus !== 'activo') throw new ReglaMembresia('El cliente está dado de baja', 403);
    const idMembresia = String(body?.idMembresia ?? '');
    if (!isValidObjectId(idMembresia)) throw new ReglaMembresia('La membresía es obligatoria', 400);
    const catalogo = await Membresia.findById(idMembresia);
    if (!catalogo) throw new ReglaMembresia('La membresía u opción ya no está disponible.');
    const condiciones = condicionesDe(catalogo.toJSON(), String(body?.idOpcion ?? ''));
    const fechaInicio = typeof body?.fechaInicio === 'string' && body.fechaInicio ? body.fechaInicio : hoyLocal();
    if (!FECHA.test(fechaInicio)) throw new ReglaMembresia('Fecha de inicio inválida.', 400);
    if (fechaInicio < hoyLocal()) throw new ReglaMembresia('La compra no puede comenzar en el pasado.', 400);
    return {
        membresia: condiciones.nombre,
        precio: Number(condiciones.opcion.costo),
        fechaInicio,
        fechaFin: finVigencia(fechaInicio, condiciones.opcion),
        nombreCliente: `${cliente.nombre} ${cliente.apellidos}`.trim(),
    };
}

export async function buscarPorId(id: string) { return conVigencia(await buscar(id)); }

export async function buscarPorCodigo(codigo: string) {
    const limpio = normalizarCodigo(codigo);
    const compra = limpio ? await Compras.findOne({ codigo: limpio }) : null;
    if (!compra) throw new ReglaMembresia('No existe una membresía con ese código', 404);
    return conVigencia(compra);
}

/** { <idCliente>: { tieneCompras, membresiasCompradas: [...] } } para la lista de clientes de cobro. */
export async function resumenPorCliente() {
    const activas = await Compras.find({ estado: 'activa' }).sort({ fechaFin: -1 }).select('idCliente condiciones.nombre fechaInicio fechaFin').lean();
    const resumen: Record<string, { tieneCompras: boolean; membresiasCompradas: unknown[] }> = {};
    for (const c of activas as any[]) {
        (resumen[c.idCliente] ??= { tieneCompras: true, membresiasCompradas: [] }).membresiasCompradas.push({
            id: String(c._id), nombre: c.condiciones?.nombre, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin,
        });
    }
    return resumen;
}

// ---------- Alta ----------

/**
 * Crea una compra.
 *  - estado 'apartada' (app móvil): sin pago; genera el código PQ-XXXXX para pagar al llegar.
 *  - estado 'activa' (recepción): ya pagada; exige metodoPago y folioPago, y fechaInicio (por defecto hoy).
 * Body: idCliente, idMembresia, idOpcion, estado, origen, solicitudId (idempotencia),
 *       fechaInicio, metodoPago, folioPago.
 * Devuelve { compra, repetida }: repetida = true si la misma solicitudId ya había creado la compra.
 */
export async function crearCompra(body: any) {
    const solicitudId = textoCorto(body?.solicitudId, 80);
    if (solicitudId) {
        const previa = await Compras.findOne({ solicitudId });
        if (previa) return { compra: conVigencia(previa), repetida: true };
    }

    const idCliente = String(body?.idCliente ?? '');
    if (!isValidObjectId(idCliente)) throw new ReglaMembresia('ID de cliente inválido', 400);
    const cliente: any = await ClienteModel.findById(idCliente);
    if (!cliente) throw new ReglaMembresia('Cliente no encontrado', 404);
    if (cliente.estatus !== 'activo') throw new ReglaMembresia('El cliente está dado de baja', 403);

    const idMembresia = String(body?.idMembresia ?? '');
    if (!isValidObjectId(idMembresia)) throw new ReglaMembresia('La membresía es obligatoria', 400);
    const catalogo = await Membresia.findById(idMembresia);
    if (!catalogo) throw new ReglaMembresia('La membresía u opción ya no está disponible.');
    const condiciones = condicionesDe(catalogo.toJSON(), String(body?.idOpcion ?? ''));

    const estado: 'apartada' | 'activa' = body?.estado === 'activa' ? 'activa' : 'apartada';
    const origen = body?.origen === 'app' ? 'app' : 'recepcion';

    let fechaInicio: string | null = null;
    let fechaFin: string | null = null;
    let metodoPago = '';
    let folioPago = '';
    if (estado === 'activa') {
        metodoPago = textoCorto(body?.metodoPago, 40);
        folioPago = textoCorto(body?.folioPago, 60);
        if (!metodoPago || !folioPago) throw new ReglaMembresia('Una compra pagada necesita el método y el folio del pago', 400);
        fechaInicio = typeof body?.fechaInicio === 'string' && body.fechaInicio ? body.fechaInicio : hoyLocal();
        if (!fechaInicio || !FECHA.test(fechaInicio)) throw new ReglaMembresia('Fecha de inicio inválida.', 400);
        if (fechaInicio < hoyLocal()) throw new ReglaMembresia('El inicio de vigencia no puede ser anterior a hoy.', 400);
        fechaFin = finVigencia(fechaInicio, condiciones.opcion);
    } else {
        // Una misma persona no aparta dos veces lo mismo mientras no la pague o cancele.
        const yaApartada = await Compras.exists({ idCliente, estado: 'apartada', idMembresia, idOpcion: String(body.idOpcion) });
        if (yaApartada) throw new ReglaMembresia('Ya tienes apartada esta membresía. Págala en el local o cancélala para apartar otra.');
    }

    const { compra, repetida } = await insertarCompra(Compras, {
        idCliente,
        nombreCliente: `${cliente.nombre} ${cliente.apellidos}`.trim(),
        idMembresia,
        idOpcion: String(body.idOpcion),
        condiciones,
        estado,
        fechaInicio,
        fechaFin,
        precio: Number(condiciones.opcion.costo),
        estadoPago: estado === 'activa' ? 'pagado' : 'pendiente',
        fechaPago: estado === 'activa' ? new Date() : null,
        metodoPago,
        folioPago,
        origen,
        ...(solicitudId ? { solicitudId } : {}),
    });
    return { compra: conVigencia(compra), repetida };
}

// ---------- Cobro del apartado ----------

/** Convierte una compra apartada en activa cuando recepción cobra su código PQ. */
export async function activarCompra(id: string, body: any) {
    const actual = await buscar(id);
    if (actual.estado === 'activa') throw new ReglaMembresia('Esta membresía ya fue pagada');
    if (actual.estado === 'cancelada') throw new ReglaMembresia('Esta membresía apartada fue cancelada');
    const metodoPago = textoCorto(body?.metodoPago, 40);
    const folioPago = textoCorto(body?.folioPago, 60);
    if (!metodoPago || !folioPago) throw new ReglaMembresia('Se necesita el método y el folio del pago', 400);
    const fechaInicio = typeof body?.fechaInicio === 'string' && body.fechaInicio ? body.fechaInicio : hoyLocal();
    if (!FECHA.test(fechaInicio)) throw new ReglaMembresia('Fecha de inicio inválida.', 400);
    if (fechaInicio < hoyLocal()) throw new ReglaMembresia('El inicio de vigencia no puede ser anterior a hoy.', 400);

    const cliente: any = await ClienteModel.findById(actual.idCliente);
    if (!cliente || cliente.estatus !== 'activo') throw new ReglaMembresia('El cliente está dado de baja', 403);

    const fechaFin = finVigencia(fechaInicio, actual.condiciones.opcion);
    const activada = await Compras.findOneAndUpdate(
        { _id: actual._id, estado: 'apartada' },
        { estado: 'activa', estadoPago: 'pagado', fechaPago: new Date(), metodoPago, folioPago, fechaInicio, fechaFin },
        { new: true },
    );
    if (!activada) throw new ReglaMembresia('La membresía cambió mientras se procesaba. Vuelve a consultarla.');
    return conVigencia(activada);
}

/** Cancela una membresía apartada que no se pagó. Una compra ya pagada no se cancela (no hay reembolso). */
export async function cancelarCompra(id: string, opciones: { idCliente?: string } = {}) {
    const actual = await buscar(id);
    if (opciones.idCliente && actual.idCliente !== opciones.idCliente) throw new ReglaMembresia('Compra de membresía no encontrada', 404);
    if (actual.estado === 'cancelada') throw new ReglaMembresia('La membresía apartada ya estaba cancelada');
    if (actual.estado === 'activa') throw new ReglaMembresia('Una membresía ya pagada no se cancela: no hay reembolso');
    const cancelada = await Compras.findOneAndUpdate(
        { _id: actual._id, estado: 'apartada' },
        { estado: 'cancelada', fechaCancelacion: new Date() },
        { new: true },
    );
    if (!cancelada) throw new ReglaMembresia('La membresía cambió mientras se procesaba. Vuelve a consultarla.');
    return conVigencia(cancelada);
}