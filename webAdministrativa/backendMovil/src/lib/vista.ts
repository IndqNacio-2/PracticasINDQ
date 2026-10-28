// Convierte documentos de Mongo en las respuestas que consume la app.
import { fechaLocal } from './fecha';
import {
    duracionMin, estadoReserva, iniciales, claseIniciada, membresiaVigente, nivelCupo, paqueteCubre,
    precioClase, puedeCancelar, puedeReagendar, resumenMembresia, separarHoras,
    type MembresiaDoc,
} from './reglas';

export const precioPorDefecto = () => Number(process.env.PRECIO_CLASE_SUELTA ?? 180);

// ---------- Perfil ----------
interface ClienteLike {
    _id: unknown;
    nombre: string;
    apellidos: string;
    correo: string;
    telefono?: string | null;
    fechaNacimiento?: string | null;
    avatar?: string | null;
    direccion?: string | null;
    membresia?: unknown;
}

export function perfilPublico(c: ClienteLike, hoy: string = fechaLocal()) {
    return {
        idCliente: String(c._id),
        nombre: c.nombre,
        apellidos: c.apellidos,
        nombreCompleto: `${c.nombre} ${c.apellidos}`,
        iniciales: iniciales(`${c.nombre} ${c.apellidos}`),
        correo: c.correo,
        telefono: c.telefono ?? '',
        fechaNacimiento: c.fechaNacimiento ?? '',
        direccion: c.direccion ?? '',
        foto: c.avatar ?? '',
        membresia: resumenMembresia(c.membresia as MembresiaDoc | null, hoy),
    };
}

// ---------- Horarios ----------
interface HorarioLike {
    _id: unknown;
    idClase: string;
    nombreClase: string;
    nombreEntrenador: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    salon: string;
    capacidadTotal: number;
    capacidadDisponible: number;
}

export interface ContextoHorarios {
    ahora: Date;
    hoy: string;
    membresia: MembresiaDoc | null;
    /** idClase → precio propio de la clase */
    precios: Map<string, number>;
    /** idHorario → idReservacion vigente del cliente */
    reservadas: Map<string, string>;
}

export function itemHorario(h: HorarioLike, ctx: ContextoHorarios) {
    const id = String(h._id);
    const disponibles = Math.max(0, h.capacidadDisponible);
    const iniciada = claseIniciada(h.fecha, h.horaInicio, ctx.ahora);
    const estado = iniciada ? 'finalizada' : disponibles <= 0 ? 'llena' : 'disponible';
    const incluida = paqueteCubre(ctx.membresia, h.nombreClase, ctx.hoy);
    const precio = precioClase(ctx.precios.get(h.idClase), precioPorDefecto());
    const idReservacion = ctx.reservadas.get(id) ?? null;

    return {
        idHorario: id,
        idClase: h.idClase,
        clase: h.nombreClase,
        fecha: h.fecha,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        duracionMin: duracionMin(h.horaInicio, h.horaFin),
        entrenador: h.nombreEntrenador,
        entrenadorIniciales: iniciales(h.nombreEntrenador),
        salon: h.salon,
        capacidad: h.capacidadTotal,
        ocupados: h.capacidadTotal - disponibles,
        disponibles,
        nivelCupo: nivelCupo(disponibles),
        estado, // disponible | llena | finalizada
        incluidaEnPaquete: incluida,
        precio,
        pagoTipo: incluida ? ('paquete' as const) : ('recepcion' as const),
        yaReservada: idReservacion !== null,
        idReservacion,
        reservable: estado === 'disponible' && idReservacion === null,
    };
}

/** Lo que verá el cliente en la hoja de confirmación antes de reservar */
export function detallePago(item: ReturnType<typeof itemHorario>, membresia: MembresiaDoc | null, hoy: string) {
    if (item.incluidaEnPaquete) {
        const restantes = Math.max(0, Number(membresia?.clasesTotal ?? 0) - Number(membresia?.clasesUsadas ?? 0));
        return { tipo: 'paquete' as const, monto: 0, accesosRestantesDespues: restantes - 1, paqueteVigente: membresiaVigente(membresia, hoy) };
    }
    return { tipo: 'recepcion' as const, monto: item.precio, accesosRestantesDespues: null, paqueteVigente: membresiaVigente(membresia, hoy) };
}

// ---------- Reservaciones ----------
interface ReservaLike {
    _id: unknown;
    idHorario: string;
    clase: string;
    entrenador?: string | null;
    horaClase: string;
    fechaClase: string;
    fechaReservacion?: string | null;
    estatus: string;
    asistenciaConfirmada?: boolean | null;
    codigo?: string | null;
    pagoTipo?: string | null;
    monto?: number | null;
    reagendada?: boolean | null;
}

export function itemReserva(r: ReservaLike, ahora: Date) {
    const { inicio, fin } = separarHoras(r.horaClase);
    const estado = estadoReserva(r, ahora);
    return {
        idReservacion: String(r._id),
        idHorario: r.idHorario,
        codigo: r.codigo ?? null, // el QR contiene este texto
        clase: r.clase,
        entrenador: r.entrenador ?? '',
        entrenadorIniciales: iniciales(r.entrenador ?? ''),
        fechaClase: r.fechaClase,
        horaInicio: inicio,
        horaFin: fin,
        fechaReservacion: r.fechaReservacion ?? '',
        estado, // proxima | asistio | no_asistio | cancelada
        reagendada: !!r.reagendada,
        pago: r.pagoTipo ? { tipo: r.pagoTipo, monto: r.monto ?? 0 } : null,
        puedeCancelar: puedeCancelar(r, ahora),
        puedeReagendar: puedeReagendar(r, ahora),
        penalizacion: estado === 'no_asistio',
    };
}
