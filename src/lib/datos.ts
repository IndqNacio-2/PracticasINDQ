// Adaptadores entre las pantallas y los contratos de la API.
// Clientes, reservaciones y compras de membresía viven en Cobro (PostgreSQL, esquema webcobro);
// los horarios, clases y catálogos siguen en Administrativa (MongoDB). Aquí se traducen los
// nombres de Cobro (client, class, time, status…) a los que usan las pantallas.
import { admin, cobro } from './api';
import type { Opcion } from '../ui/VentaMembresia';

/* ============================ Clientes ============================ */

export const DOCS_MENOR: [string, string][] = [
  ['actaNacimiento', 'Acta de nacimiento del menor'],
  ['ineTutor', 'INE del padre, madre o tutor'],
  ['curpMenor', 'CURP del menor'],
  ['credencialEscolar', 'Credencial escolar del menor'],
];

export interface MembresiaComprada { id: string; nombre: string; fechaInicio: string; fechaFin: string }

export interface Cliente {
  idUsuario: string;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono?: string;
  codigoAcceso: string;
  estatus: 'activo' | 'inactivo';
  fechaNacimiento?: string;
  tutor?: { nombreCompleto: string; claveElector: string } | null;
  documentosMenor?: Record<string, boolean> | null;
  menorValidado?: boolean;
  enfermedades: string[];
  lesiones: string[];
  membresias: MembresiaComprada[];
  // Campos que esta versión de la API todavía no registra (se muestran solo si llegan).
  origenRegistro?: 'web' | 'movil';
  registroPendiente?: boolean;
  bloqueoApp?: { activo?: boolean; desde?: string; motivo?: string; codigoReservacion?: string } | null;
}

interface ClienteCobro {
  id: number; nombre: string; membresia?: string; telefono?: string | null; correo?: string | null; activo: boolean;
  enfermedades?: string[] | null; lesiones?: string[] | null; fechaNacimiento?: string | null;
  nombreTutor?: string | null; claveElectorTutor?: string | null; estadoDocumentacion?: 'pendiente' | 'validada' | null;
  documentosMenor?: Record<string, boolean> | null;
  membresiasCompradas?: { id: number | string; nombre: string; fechaInicio: string; fechaFin: string }[];
  codigo?: string | null;
}

/** Cobro guarda el nombre completo en una sola columna: se separa en nombre(s) y apellidos para el formulario. */
export function partirNombre(completo: string): [string, string] {
  const p = completo.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return [p[0] ?? '', ''];
  if (p.length === 2) return [p[0], p[1]];
  return [p.slice(0, p.length - 2).join(' '), p.slice(-2).join(' ')];
}

export function aCliente(c: ClienteCobro): Cliente {
  const [nombre, apellidos] = partirNombre(c.nombre ?? '');
  const tutor = c.nombreTutor ? { nombreCompleto: c.nombreTutor, claveElector: c.claveElectorTutor ?? '' } : null;
  return {
    idUsuario: String(c.id),
    nombre, apellidos,
    correo: c.correo ?? '',
    telefono: c.telefono ?? '',
    codigoAcceso: c.codigo ?? `CLI-${c.id}`,
    estatus: c.activo === false ? 'inactivo' : 'activo',
    fechaNacimiento: c.fechaNacimiento ?? '',
    tutor,
    documentosMenor: c.documentosMenor ?? null,
    menorValidado: c.estadoDocumentacion === 'validada',
    enfermedades: c.enfermedades ?? [],
    lesiones: c.lesiones ?? [],
    membresias: (c.membresiasCompradas ?? []).map((m) => ({ ...m, id: String(m.id) })),
  };
}

export interface DatosCliente {
  nombre: string; apellidos: string; correo: string; telefono: string; fechaNacimiento: string; activo: boolean;
  enfermedades: string[]; lesiones: string[];
  menor: { nombreTutor: string; claveElectorTutor: string; validado: boolean; documentos: Record<string, boolean> } | null;
}

function cuerpoCliente(d: DatosCliente) {
  return {
    nombre: `${d.nombre.trim()} ${d.apellidos.trim()}`.trim().replace(/\s+/g, ' '),
    correo: d.correo.trim().toLowerCase(),
    telefono: d.telefono,
    fechaNacimiento: d.fechaNacimiento,
    activo: d.activo,
    enfermedades: d.enfermedades,
    lesiones: d.lesiones,
    nombreTutor: d.menor?.nombreTutor ?? '',
    claveElectorTutor: d.menor?.claveElectorTutor ?? '',
    estadoDocumentacion: d.menor?.validado ? 'validada' : 'pendiente',
    ...(d.menor ? { documentosMenor: d.menor.documentos } : {}),
  };
}

export const clientes = {
  listar: async () => (await cobro.get<ClienteCobro[]>('/clientes')).map(aCliente),
  crear: async (d: DatosCliente) => aCliente((await cobro.post<{ cliente: ClienteCobro }>('/clientes', cuerpoCliente(d))).cliente),
  actualizar: async (id: string, d: DatosCliente) => aCliente((await cobro.patch<{ cliente: ClienteCobro }>(`/clientes/${id}`, cuerpoCliente(d))).cliente),
  activo: async (id: string, activo: boolean) => aCliente((await cobro.patch<{ cliente: ClienteCobro }>(`/clientes/${id}`, { activo })).cliente),
};

/** Catálogos de enfermedades y lesiones (solo lectura): lo que no esté aquí se guarda como adicional del cliente. */
export interface ItemCatalogo { id: string; nombre: string }
export const catalogoSalud = (tipo: 'enfermedades' | 'lesiones') => admin.get<ItemCatalogo[]>(`/salud/${tipo}`).catch(() => [] as ItemCatalogo[]);

/** Membresía con la vigencia más lejana del cliente (o null). */
export function membresiaDe(c: Cliente) {
  if (!c.membresias.length) return null;
  return [...c.membresias].sort((a, b) => b.fechaFin.localeCompare(a.fechaFin))[0];
}

/* ========================= Reservaciones ========================= */

export interface Reservacion {
  idReservacion: string; codigo?: string; tipo: 'cliente' | 'visitante'; idCliente: string; nombreCliente: string; idHorario: string;
  clase: string; claseId?: string; entrenador: string; horaClase: string; fechaClase: string;
  estatus: 'pendiente' | 'confirmada' | 'cancelada' | 'no_asistio';
  asistenciaConfirmada: boolean; estadoCupo: 'confirmada' | 'espera'; origen: 'recepcion' | 'app'; precio: number; estadoPago: 'pendiente' | 'pagado';
  reagendada: boolean; membresiaCompraId?: string; fechaCreacion?: string;
  puedeCancelar?: boolean; puedeReagendar?: boolean; motivoNoCancelar?: string | null; motivoNoReagendar?: string | null;
}

interface ReservaCobro {
  id: number; client: string; type: 'cliente' | 'visitante'; class: string; membresiaCompraId?: number | null; claseId?: string | null;
  clienteId?: number | null; paymentStatus?: string | null; horaFin?: string | null; attendanceStatus?: string; time: string; status: string;
  price: number; fecha: string; horarioId?: string | null; capacityStatus?: 'confirmada' | 'espera' | null; codigo?: string | null; origen?: string | null;
  reagendada?: boolean | null; creadoEn?: string | null;
  puedeCancelar?: boolean; puedeReagendar?: boolean; motivoNoCancelar?: string | null; motivoNoReagendar?: string | null;
}

/** Horario mínimo para completar coach y clase de cada reservación. */
interface HorarioRef { idHorario: string; idClase: string; nombreEntrenador: string }

export function aReservacion(r: ReservaCobro, horarios: HorarioRef[] = []): Reservacion {
  const h = horarios.find((x) => x.idHorario === r.horarioId);
  const cupo = r.capacityStatus === 'espera' ? 'espera' : 'confirmada';
  return {
    idReservacion: String(r.id),
    codigo: r.codigo ?? undefined,
    tipo: r.type,
    idCliente: r.clienteId ? String(r.clienteId) : '',
    nombreCliente: r.client,
    idHorario: r.horarioId ?? '',
    clase: r.class,
    claseId: r.claseId ?? h?.idClase,
    entrenador: h?.nombreEntrenador ?? '',
    horaClase: r.horaFin ? `${r.time} - ${r.horaFin}` : r.time,
    fechaClase: r.fecha,
    estatus: r.status === 'cancelado' ? 'cancelada' : r.status === 'no_asistio' ? 'no_asistio' : cupo === 'confirmada' ? 'confirmada' : 'pendiente',
    asistenciaConfirmada: r.status === 'asistido',
    estadoCupo: cupo,
    origen: r.origen === 'app' ? 'app' : 'recepcion',
    precio: Number(r.price ?? 0),
    estadoPago: r.paymentStatus === 'pagado' || r.status === 'pagado' ? 'pagado' : 'pendiente',
    reagendada: !!r.reagendada,
    membresiaCompraId: r.membresiaCompraId ? String(r.membresiaCompraId) : undefined,
    fechaCreacion: r.creadoEn ?? undefined,
    puedeCancelar: r.puedeCancelar, puedeReagendar: r.puedeReagendar,
    motivoNoCancelar: r.motivoNoCancelar, motivoNoReagendar: r.motivoNoReagendar,
  };
}

interface RespuestaReserva { mensaje?: string; reservacion: ReservaCobro; promovida?: ReservaCobro | null }
const conPromovida = (r: RespuestaReserva, horarios: HorarioRef[]) => ({
  reservacion: aReservacion(r.reservacion, horarios),
  promovida: r.promovida ? aReservacion(r.promovida, horarios) : null,
  mensaje: r.mensaje ?? '',
});

export const reservaciones = {
  listar: async (horarios: HorarioRef[] = []) => (await cobro.get<ReservaCobro[]>('/reservas')).map((r) => aReservacion(r, horarios)),
  porCodigo: async (codigo: string, horarios: HorarioRef[] = []) => aReservacion(await cobro.get<ReservaCobro>(`/reservas/codigo/${encodeURIComponent(codigo)}`), horarios),
  crear: async (d: { horario: { idHorario: string; nombreClase: string; horaInicio: string; fecha: string }; cliente?: { id: string; nombre: string }; visitante?: string }, horarios: HorarioRef[] = []) =>
    conPromovida({ reservacion: (await cobro.post<RespuestaReserva>('/reservas', {
      client: d.cliente ? d.cliente.nombre : d.visitante,
      type: d.cliente ? 'cliente' : 'visitante',
      ...(d.cliente ? { clienteId: Number(d.cliente.id) } : {}),
      class: d.horario.nombreClase, time: d.horario.horaInicio, fecha: d.horario.fecha, horarioId: d.horario.idHorario, origen: 'recepcion',
    })).reservacion }, horarios),
  asistencia: async (id: string, horarios: HorarioRef[] = []) => conPromovida(await cobro.patch<RespuestaReserva>(`/reservas/${id}`, { status: 'asistido' }), horarios),
  cancelar: async (id: string, horarios: HorarioRef[] = []) => conPromovida(await cobro.patch<RespuestaReserva>(`/reservas/${id}`, { status: 'cancelado' }), horarios),
  reagendar: async (id: string, horario: { idHorario: string; fecha: string }, horarios: HorarioRef[] = []) =>
    conPromovida(await cobro.post<RespuestaReserva>(`/reservas/${id}/reagendar`, { horarioId: horario.idHorario, fecha: horario.fecha }), horarios),
};

/* ===================== Compras de membresía ===================== */

export interface Compra {
  idCompra: string; folio: string; idCliente: string; nombreCliente: string; idMembresia: string;
  vigencia: 'por_iniciar' | 'vigente' | 'vencida'; fechaInicio: string; fechaFin: string; precio: number; metodoPago: string;
  condiciones: { nombre: string; opcion: Opcion }; fechaCreacion: string;
}

export const compras = {
  listar: () => cobro.get<Compra[]>('/membresias/compras'),
  ticket: (id: string) => cobro.get<import('../ui/Cobro').Ticket>(`/membresias/compras/${id}/ticket`),
};
