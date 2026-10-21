export type UserRole = 'administrador' | 'entrenador' | 'recepcion' | 'cliente';
export type Estatus = 'activo' | 'inactivo';
export type ReservaEstatus = 'confirmada' | 'pendiente' | 'cancelada';

export interface Usuario {
  idUsuario: string;
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  codigoAcceso: string;
  estatus: Estatus;
  rol: UserRole;
  avatar?: string;
  fechaCreacion: string;
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
  idCliente: string;
  nombreCliente: string;
  fecha: string;
  total: number;
  productos: { nombre: string; cantidad: number; precio: number }[];
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
  idEmpleado: string;
  nombreEmpleado: string;
  rol: 'entrenador' | 'recepcion';
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
