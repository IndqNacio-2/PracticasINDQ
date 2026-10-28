export type UserRole = 'administrador' | 'entrenador' | 'recepcion' | 'cliente';
export type Estatus = 'activo' | 'inactivo';
export type ReservaEstatus = 'confirmada' | 'pendiente' | 'cancelada';

/** Documento de respaldo (PDF o imagen) como data URL; en listados viene sin contenido (data vacío) */
export interface DocumentoFormacion {
  nombre: string;
  data: string;
}

/** Capacitación o certificación de un entrenador */
export interface Formacion {
  nombre: string;
  fecha: string; // AAAA-MM-DD
  vigencia: string; // AAAA-MM-DD, vacío si no tiene
  documento: DocumentoFormacion | null;
}

export interface Usuario {
  idUsuario: string;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  fechaNacimiento?: string; // AAAA-MM-DD
  estatus: Estatus;
  rol: UserRole;
  avatar?: string;
  fechaCreacion: string;
  // Solo personal (entrenador / recepción)
  especialidad?: string;
  turnoEntrada?: string; // HH:MM, sirve para calcular retardos
  turnoSalida?: string;
  /** Imagen como data URL (base64); vacío si no tiene foto */
  foto?: string;
  // Solo entrenadores: perfil profesional
  resumen?: string;
  capacitaciones?: Formacion[];
  certificaciones?: Formacion[];
}

export interface PerfilSalud {
  peso: number; // kg
  altura: number; // cm
  tipoSangre: string;
  alergias: string[];
  enfermedades: string[];
  lesiones: string[];
  observaciones: string;
}

export interface PerfilActividad {
  nivelActividad: 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy activo';
  objetivo: string;
  hobbies: string[];
  frecuenciaEjercicio: string;
}

export interface Membresia {
  idMembresia: string;
  tipo: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  fechaInicio: string;
  fechaFin: string;
  precio: number;
  estatus: Estatus;
}

export interface Cliente extends Usuario {
  codigoAcceso?: string;
  fechaNacimiento: string;
  direccion: string;
  fechaRegistro: string;
  membresia?: Membresia;
  perfilSalud?: PerfilSalud;
  perfilActividad?: PerfilActividad;
}

export interface Clase {
  idClase: string;
  nombre: string;
  descripcion: string;
  capacidad: number;
  color: string;
  estatus: Estatus;
  entrenadorId?: string;
}

export interface HorarioClase {
  idHorario: string;
  idClase: string;
  nombreClase: string;
  entrenadorId: string;
  nombreEntrenador: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  capacidadTotal: number;
  capacidadDisponible: number;
  estatus: Estatus;
  salon: string;
}

export interface Reservacion {
  idReservacion: string;
  idCliente: string;
  nombreCliente: string;
  idHorario: string;
  clase: string;
  entrenador: string;
  horaClase: string;
  /** Día en que se imparte la clase */
  fechaClase: string;
  /** Día en que se hizo la reservación */
  fechaReservacion: string;
  estatus: ReservaEstatus;
  asistenciaConfirmada: boolean;
}

export interface Producto {
  idProducto: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  categoria: string;
  estatus: Estatus;
}

export interface Venta {
  idVenta: string;
  idCliente: string | null;
  nombreCliente: string;
  fecha: string;
  hora: string;
  total: number;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia';
  estatus: 'completada' | 'cancelada';
  productos: { idProducto: string; nombre: string; categoria: string; cantidad: number; precio: number }[];
  recepcionistaId: string;
}

export interface MovimientoInventario {
  id: string;
  idProducto: string;
  nombreProducto: string;
  tipo: 'entrada' | 'salida' | 'merma';
  cantidad: number;
  fecha: string;
  motivo: string;
}

export interface RegistroAsistencia {
  id: string;
  tipoPersona: 'cliente' | 'personal';
  idPersona: string;
  nombrePersona: string;
  rol?: 'administrador' | 'entrenador' | 'recepcion';
  fecha: string;
  horaEntrada: string;
  horaSalida?: string;
  tipoRegistro: 'asistencia' | 'retardo' | 'falta';
}

export interface AsistenciaClase {
  id: string;
  idHorario: string;
  idCliente: string;
  nombreCliente: string;
  clase: string;
  entrenador: string;
  fecha: string;
  asistio: boolean;
}

export interface CorteCaja {
  id: string;
  recepcionistaId: string;
  nombreRecepcionista: string;
  fecha: string;
  montoInicial: number;
  totalVentas: number;
  montoFinal: number;
  observaciones: string;
}

/* ───────────── Respuestas de /api/reportes/* ───────────── */

export interface ReporteVentas {
  resumen: { total: number; transacciones: number; ticketPromedio: number; productoTop: string };
  porDia: { fecha: string; total: number; transacciones: number }[];
  porHorario: { hora: string; total: number; transacciones: number }[];
  porCategoria: { categoria: string; total: number; unidades: number }[];
  /** Ordenado de menor a mayor precio */
  productosPorPrecio: { idProducto: string; nombre: string; categoria: string; precio: number; unidades: number; total: number }[];
}

export interface ReporteVisitas {
  resumen: { total: number; promedioDiario: number; diaTop: string };
  porDia: { fecha: string; visitas: number }[];
  porHorario: { hora: string; visitas: number }[];
}

export interface ReporteAsistenciaClases {
  por: 'clase' | 'entrenador';
  resumen: { reservaciones: number; asistencias: number; porcentaje: number };
  filas: { nombre: string; reservaciones: number; asistencias: number; ausencias: number; porcentaje: number }[];
}

export interface ReporteInventario {
  resumen: { productosActivos: number; totalUnidades: number; valorTotal: number; mermasUnidades: number };
  productos: { idProducto: string; nombre: string; categoria: string; precio: number; stock: number; estatus: Estatus; valor: number }[];
  mermas: { id: string; idProducto: string; nombreProducto: string; cantidad: number; motivo: string; fecha: string }[];
}

export interface ReportePersonal {
  resumen: { idPersona: string; nombre: string; rol?: string; asistencias: number; retardos: number; faltas: number; porcentaje: number }[];
  detalle: { id: string; idPersona: string; nombrePersona: string; rol?: string; fecha: string; horaEntrada: string; horaSalida: string; tipoRegistro: 'asistencia' | 'retardo' | 'falta' }[];
}