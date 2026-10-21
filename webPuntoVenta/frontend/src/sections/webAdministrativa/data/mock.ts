import type {
  Usuario, Cliente, Clase, HorarioClase, Reservacion,
  Producto, Venta, MovimientoInventario, RegistroAsistencia,
  AsistenciaClase, CorteCaja
} from '../types';

export const mockUsuarios: Usuario[] = [
  { idUsuario: 'u1', nombre: 'Carlos', apellidos: 'Mendoza Ruiz', correo: 'admin@gymfit.mx', telefono: '5512345678', codigoAcceso: 'ADM001', estatus: 'activo', rol: 'administrador', fechaCreacion: '2023-01-15', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&auto=format' },
  { idUsuario: 'u2', nombre: 'Sofía', apellidos: 'Torres Vega', correo: 'sofia.torres@gymfit.mx', telefono: '5598765432', codigoAcceso: 'ENT001', estatus: 'activo', rol: 'entrenador', fechaCreacion: '2023-02-20', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b58c?w=40&h=40&fit=crop&auto=format' },
  { idUsuario: 'u3', nombre: 'Diego', apellidos: 'Ramírez Luna', correo: 'diego.ramirez@gymfit.mx', telefono: '5523456789', codigoAcceso: 'ENT002', estatus: 'activo', rol: 'entrenador', fechaCreacion: '2023-03-10', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&auto=format' },
  { idUsuario: 'u4', nombre: 'Valeria', apellidos: 'Guzmán Pérez', correo: 'valeria.guzman@gymfit.mx', telefono: '5534567890', codigoAcceso: 'REC001', estatus: 'activo', rol: 'recepcion', fechaCreacion: '2023-04-05', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&auto=format' },
  { idUsuario: 'u5', nombre: 'Marco', apellidos: 'Flores Soto', correo: 'marco.flores@gymfit.mx', telefono: '5545678901', codigoAcceso: 'ENT003', estatus: 'inactivo', rol: 'entrenador', fechaCreacion: '2023-05-12' },
  { idUsuario: 'u6', nombre: 'Ana', apellidos: 'Jiménez Cruz', correo: 'ana.jimenez@gymfit.mx', telefono: '5556789012', codigoAcceso: 'REC002', estatus: 'activo', rol: 'recepcion', fechaCreacion: '2023-06-01' },
];

export const mockClientes: Cliente[] = [
  {
    idUsuario: 'c1', nombre: 'Fernando', apellidos: 'López Herrera', correo: 'fernando.lopez@mail.com', telefono: '5561234567', codigoAcceso: 'CLI001', estatus: 'activo', rol: 'cliente', fechaCreacion: '2024-01-10',
    fechaNacimiento: '1990-06-15', direccion: 'Av. Insurgentes Sur 1234, CDMX', fechaRegistro: '2024-01-10',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&auto=format',
    membresia: { idMembresia: 'm1', tipo: 'mensual', fechaInicio: '2024-09-01', fechaFin: '2024-09-30', precio: 850, estatus: 'activo' },
    perfilSalud: { peso: 82, altura: 178, tipoSangre: 'O+', alergias: ['Lactosa'], enfermedades: [], lesiones: ['Rodilla derecha (2022)'], observaciones: 'Evitar impacto alto en rodilla' },
    perfilActividad: { nivelActividad: 'moderado', objetivo: 'Pérdida de peso', hobbies: ['Ciclismo', 'Natación'], frecuenciaEjercicio: '3 veces por semana' },
  },
  {
    idUsuario: 'c2', nombre: 'Gabriela', apellidos: 'Morales Díaz', correo: 'gaby.morales@mail.com', telefono: '5572345678', codigoAcceso: 'CLI002', estatus: 'activo', rol: 'cliente', fechaCreacion: '2024-02-14',
    fechaNacimiento: '1995-11-22', direccion: 'Calle Reforma 456, CDMX', fechaRegistro: '2024-02-14',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=40&h=40&fit=crop&auto=format',
    membresia: { idMembresia: 'm2', tipo: 'trimestral', fechaInicio: '2024-07-01', fechaFin: '2024-09-30', precio: 2200, estatus: 'activo' },
    perfilSalud: { peso: 62, altura: 165, tipoSangre: 'A+', alergias: [], enfermedades: ['Hipotiroidismo'], lesiones: [], observaciones: 'Monitoreo de frecuencia cardíaca recomendado' },
    perfilActividad: { nivelActividad: 'activo', objetivo: 'Tonificación muscular', hobbies: ['Yoga', 'Baile'], frecuenciaEjercicio: '5 veces por semana' },
  },
  {
    idUsuario: 'c3', nombre: 'Roberto', apellidos: 'Sánchez Vidal', correo: 'roberto.sanchez@mail.com', telefono: '5583456789', codigoAcceso: 'CLI003', estatus: 'activo', rol: 'cliente', fechaCreacion: '2024-03-05',
    fechaNacimiento: '1988-03-08', direccion: 'Blvd. Díaz Ordaz 789, Monterrey', fechaRegistro: '2024-03-05',
    membresia: { idMembresia: 'm3', tipo: 'semestral', fechaInicio: '2024-04-01', fechaFin: '2024-09-30', precio: 3800, estatus: 'activo' },
    perfilSalud: { peso: 90, altura: 182, tipoSangre: 'B+', alergias: ['Penicilina'], enfermedades: ['Hipertensión'], lesiones: [], observaciones: 'Presión controlada con medicamento' },
    perfilActividad: { nivelActividad: 'ligero', objetivo: 'Ganancia de masa muscular', hobbies: ['Fútbol'], frecuenciaEjercicio: '2 veces por semana' },
  },
  {
    idUsuario: 'c4', nombre: 'Daniela', apellidos: 'Reyes Acosta', correo: 'dani.reyes@mail.com', telefono: '5594567890', codigoAcceso: 'CLI004', estatus: 'activo', rol: 'cliente', fechaCreacion: '2024-04-18',
    fechaNacimiento: '2000-09-30', direccion: 'Calle Juárez 321, Guadalajara', fechaRegistro: '2024-04-18',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&auto=format',
    membresia: { idMembresia: 'm4', tipo: 'mensual', fechaInicio: '2024-09-01', fechaFin: '2024-09-30', precio: 850, estatus: 'activo' },
    perfilSalud: { peso: 57, altura: 162, tipoSangre: 'AB-', alergias: [], enfermedades: [], lesiones: [], observaciones: '' },
    perfilActividad: { nivelActividad: 'muy activo', objetivo: 'Rendimiento deportivo', hobbies: ['Running', 'CrossFit', 'Escalada'], frecuenciaEjercicio: 'Diario' },
  },
  {
    idUsuario: 'c5', nombre: 'Eduardo', apellidos: 'Castro Mejía', correo: 'edu.castro@mail.com', telefono: '5505678901', codigoAcceso: 'CLI005', estatus: 'inactivo', rol: 'cliente', fechaCreacion: '2023-11-20',
    fechaNacimiento: '1985-01-12', direccion: 'Av. Universidad 654, CDMX', fechaRegistro: '2023-11-20',
    membresia: { idMembresia: 'm5', tipo: 'mensual', fechaInicio: '2024-08-01', fechaFin: '2024-08-31', precio: 850, estatus: 'inactivo' },
    perfilSalud: { peso: 78, altura: 175, tipoSangre: 'O-', alergias: [], enfermedades: [], lesiones: [], observaciones: '' },
    perfilActividad: { nivelActividad: 'moderado', objetivo: 'Mejorar condición física', hobbies: ['Tennis'], frecuenciaEjercicio: '3 veces por semana' },
  },
  {
    idUsuario: 'c6', nombre: 'Lucía', apellidos: 'Vargas Méndez', correo: 'lucia.vargas@mail.com', telefono: '5516789012', codigoAcceso: 'CLI006', estatus: 'activo', rol: 'cliente', fechaCreacion: '2024-05-01',
    fechaNacimiento: '1993-07-25', direccion: 'Paseo del Moral 987, León', fechaRegistro: '2024-05-01',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop&auto=format',
    membresia: { idMembresia: 'm6', tipo: 'anual', fechaInicio: '2024-01-01', fechaFin: '2024-12-31', precio: 7200, estatus: 'activo' },
    perfilSalud: { peso: 68, altura: 170, tipoSangre: 'A-', alergias: ['Polen'], enfermedades: [], lesiones: [], observaciones: '' },
    perfilActividad: { nivelActividad: 'activo', objetivo: 'Mantener peso y mejorar flexibilidad', hobbies: ['Pilates', 'Senderismo'], frecuenciaEjercicio: '4 veces por semana' },
  },
];

export const mockClases: Clase[] = [
  { idClase: 'cl1', nombre: 'Spinning', descripcion: 'Clase de ciclismo indoor de alta intensidad con música motivadora', capacidad: 20, color: '#f59e0b', estatus: 'activo', entrenadorId: 'u2' },
  { idClase: 'cl2', nombre: 'Yoga Flow', descripcion: 'Yoga dinámico para mejorar flexibilidad, fuerza y equilibrio mental', capacidad: 15, color: '#8b5cf6', estatus: 'activo', entrenadorId: 'u3' },
  { idClase: 'cl3', nombre: 'CrossFit', descripcion: 'Entrenamiento funcional de alta intensidad con movimientos compuestos', capacidad: 12, color: '#ef4444', estatus: 'activo', entrenadorId: 'u2' },
  { idClase: 'cl4', nombre: 'Pilates Mat', descripcion: 'Ejercicios de control corporal y fortalecimiento del núcleo', capacidad: 10, color: '#ec4899', estatus: 'activo', entrenadorId: 'u3' },
  { idClase: 'cl5', nombre: 'Box Fitness', descripcion: 'Técnicas de boxeo aplicadas al fitness sin contacto', capacidad: 16, color: '#0891b2', estatus: 'activo', entrenadorId: 'u2' },
  { idClase: 'cl6', nombre: 'Zumba', descripcion: 'Baile fitness con ritmos latinos y caribeños', capacidad: 25, color: '#10b981', estatus: 'inactivo', entrenadorId: 'u3' },
];

export const mockHorarios: HorarioClase[] = [
  { idHorario: 'h1', idClase: 'cl1', nombreClase: 'Spinning', entrenadorId: 'u2', nombreEntrenador: 'Sofía Torres', fecha: '2024-09-16', horaInicio: '07:00', horaFin: '08:00', capacidadTotal: 20, capacidadDisponible: 5, estatus: 'activo', salon: 'Sala A' },
  { idHorario: 'h2', idClase: 'cl2', nombreClase: 'Yoga Flow', entrenadorId: 'u3', nombreEntrenador: 'Diego Ramírez', fecha: '2024-09-16', horaInicio: '09:00', horaFin: '10:00', capacidadTotal: 15, capacidadDisponible: 8, estatus: 'activo', salon: 'Sala B' },
  { idHorario: 'h3', idClase: 'cl3', nombreClase: 'CrossFit', entrenadorId: 'u2', nombreEntrenador: 'Sofía Torres', fecha: '2024-09-16', horaInicio: '18:00', horaFin: '19:00', capacidadTotal: 12, capacidadDisponible: 3, estatus: 'activo', salon: 'Sala Principal' },
  { idHorario: 'h4', idClase: 'cl4', nombreClase: 'Pilates Mat', entrenadorId: 'u3', nombreEntrenador: 'Diego Ramírez', fecha: '2024-09-17', horaInicio: '10:00', horaFin: '11:00', capacidadTotal: 10, capacidadDisponible: 10, estatus: 'activo', salon: 'Sala B' },
  { idHorario: 'h5', idClase: 'cl5', nombreClase: 'Box Fitness', entrenadorId: 'u2', nombreEntrenador: 'Sofía Torres', fecha: '2024-09-17', horaInicio: '19:00', horaFin: '20:00', capacidadTotal: 16, capacidadDisponible: 9, estatus: 'activo', salon: 'Sala A' },
  { idHorario: 'h6', idClase: 'cl1', nombreClase: 'Spinning', entrenadorId: 'u2', nombreEntrenador: 'Sofía Torres', fecha: '2024-09-18', horaInicio: '07:00', horaFin: '08:00', capacidadTotal: 20, capacidadDisponible: 12, estatus: 'activo', salon: 'Sala A' },
  { idHorario: 'h7', idClase: 'cl2', nombreClase: 'Yoga Flow', entrenadorId: 'u3', nombreEntrenador: 'Diego Ramírez', fecha: '2024-09-18', horaInicio: '11:00', horaFin: '12:00', capacidadTotal: 15, capacidadDisponible: 0, estatus: 'activo', salon: 'Sala B' },
  { idHorario: 'h8', idClase: 'cl3', nombreClase: 'CrossFit', entrenadorId: 'u2', nombreEntrenador: 'Sofía Torres', fecha: '2024-09-19', horaInicio: '06:30', horaFin: '07:30', capacidadTotal: 12, capacidadDisponible: 7, estatus: 'activo', salon: 'Sala Principal' },
];

export const mockReservaciones: Reservacion[] = [
  { idReservacion: 'r1', idCliente: 'c1', nombreCliente: 'Fernando López', idHorario: 'h1', clase: 'Spinning', entrenador: 'Sofía Torres', horaClase: '07:00 - 08:00', fechaReservacion: '2024-09-16', estatus: 'confirmada', asistenciaConfirmada: true },
  { idReservacion: 'r2', idCliente: 'c2', nombreCliente: 'Gabriela Morales', idHorario: 'h2', clase: 'Yoga Flow', entrenador: 'Diego Ramírez', horaClase: '09:00 - 10:00', fechaReservacion: '2024-09-16', estatus: 'confirmada', asistenciaConfirmada: false },
  { idReservacion: 'r3', idCliente: 'c3', nombreCliente: 'Roberto Sánchez', idHorario: 'h3', clase: 'CrossFit', entrenador: 'Sofía Torres', horaClase: '18:00 - 19:00', fechaReservacion: '2024-09-16', estatus: 'pendiente', asistenciaConfirmada: false },
  { idReservacion: 'r4', idCliente: 'c4', nombreCliente: 'Daniela Reyes', idHorario: 'h1', clase: 'Spinning', entrenador: 'Sofía Torres', horaClase: '07:00 - 08:00', fechaReservacion: '2024-09-16', estatus: 'confirmada', asistenciaConfirmada: true },
  { idReservacion: 'r5', idCliente: 'c6', nombreCliente: 'Lucía Vargas', idHorario: 'h2', clase: 'Yoga Flow', entrenador: 'Diego Ramírez', horaClase: '09:00 - 10:00', fechaReservacion: '2024-09-16', estatus: 'cancelada', asistenciaConfirmada: false },
  { idReservacion: 'r6', idCliente: 'c1', nombreCliente: 'Fernando López', idHorario: 'h5', clase: 'Box Fitness', entrenador: 'Sofía Torres', horaClase: '19:00 - 20:00', fechaReservacion: '2024-09-17', estatus: 'confirmada', asistenciaConfirmada: false },
  { idReservacion: 'r7', idCliente: 'c2', nombreCliente: 'Gabriela Morales', idHorario: 'h4', clase: 'Pilates Mat', entrenador: 'Diego Ramírez', horaClase: '10:00 - 11:00', fechaReservacion: '2024-09-17', estatus: 'pendiente', asistenciaConfirmada: false },
  { idReservacion: 'r8', idCliente: 'c4', nombreCliente: 'Daniela Reyes', idHorario: 'h8', clase: 'CrossFit', entrenador: 'Sofía Torres', horaClase: '06:30 - 07:30', fechaReservacion: '2024-09-19', estatus: 'confirmada', asistenciaConfirmada: false },
];

export const mockProductos: Producto[] = [
  { idProducto: 'p1', nombre: 'Proteína Whey Gold', descripcion: 'Proteína de suero 2.27kg sabor chocolate', precio: 1350, stock: 24, categoria: 'Suplementos', estatus: 'activo' },
  { idProducto: 'p2', nombre: 'Creatina Monohidrato', descripcion: 'Creatina pura 500g sin sabor', precio: 480, stock: 18, categoria: 'Suplementos', estatus: 'activo' },
  { idProducto: 'p3', nombre: 'Botella Acero 1L', descripcion: 'Botella de acero inoxidable con logo GymFit', precio: 320, stock: 35, categoria: 'Accesorios', estatus: 'activo' },
  { idProducto: 'p4', nombre: 'Guantes de Entrenamiento', descripcion: 'Guantes de cuero reforzado talla M/L', precio: 280, stock: 12, categoria: 'Accesorios', estatus: 'activo' },
  { idProducto: 'p5', nombre: 'BCAA Instantáneo', descripcion: 'Aminoácidos ramificados 300g sabor sandía', precio: 620, stock: 8, categoria: 'Suplementos', estatus: 'activo' },
  { idProducto: 'p6', nombre: 'Camiseta GymFit', descripcion: 'Camiseta técnica dryfit con logo', precio: 250, stock: 0, categoria: 'Ropa', estatus: 'inactivo' },
  { idProducto: 'p7', nombre: 'Rodillo Foam', descripcion: 'Rodillo para liberación miofascial 45cm', precio: 390, stock: 6, categoria: 'Equipamiento', estatus: 'activo' },
  { idProducto: 'p8', nombre: 'Pre-Workout Explosion', descripcion: 'Pre-entreno con cafeína y beta-alanina 250g', precio: 780, stock: 15, categoria: 'Suplementos', estatus: 'activo' },
];

export const mockVentas: Venta[] = [
  { idVenta: 'v1', idCliente: 'c1', nombreCliente: 'Fernando López', fecha: '2024-09-01', total: 1350, productos: [{ nombre: 'Proteína Whey Gold', cantidad: 1, precio: 1350 }], recepcionistaId: 'u4' },
  { idVenta: 'v2', idCliente: 'c2', nombreCliente: 'Gabriela Morales', fecha: '2024-09-02', total: 1100, productos: [{ nombre: 'BCAA Instantáneo', cantidad: 1, precio: 620 }, { nombre: 'Botella Acero 1L', cantidad: 1, precio: 320 }, { nombre: 'Guantes de Entrenamiento', cantidad: 0.5, precio: 280 }], recepcionistaId: 'u4' },
  { idVenta: 'v3', idCliente: 'c4', nombreCliente: 'Daniela Reyes', fecha: '2024-09-05', total: 780, productos: [{ nombre: 'Pre-Workout Explosion', cantidad: 1, precio: 780 }], recepcionistaId: 'u6' },
  { idVenta: 'v4', idCliente: 'c3', nombreCliente: 'Roberto Sánchez', fecha: '2024-09-08', total: 760, productos: [{ nombre: 'Creatina Monohidrato', cantidad: 1, precio: 480 }, { nombre: 'Guantes de Entrenamiento', cantidad: 1, precio: 280 }], recepcionistaId: 'u4' },
  { idVenta: 'v5', idCliente: 'c6', nombreCliente: 'Lucía Vargas', fecha: '2024-09-10', total: 390, productos: [{ nombre: 'Rodillo Foam', cantidad: 1, precio: 390 }], recepcionistaId: 'u6' },
  { idVenta: 'v6', idCliente: 'c1', nombreCliente: 'Fernando López', fecha: '2024-09-12', total: 480, productos: [{ nombre: 'Creatina Monohidrato', cantidad: 1, precio: 480 }], recepcionistaId: 'u4' },
  { idVenta: 'v7', idCliente: 'c2', nombreCliente: 'Gabriela Morales', fecha: '2024-09-15', total: 1350, productos: [{ nombre: 'Proteína Whey Gold', cantidad: 1, precio: 1350 }], recepcionistaId: 'u4' },
  { idVenta: 'v8', idCliente: 'c4', nombreCliente: 'Daniela Reyes', fecha: '2024-09-15', total: 320, productos: [{ nombre: 'Botella Acero 1L', cantidad: 1, precio: 320 }], recepcionistaId: 'u6' },
];

export const mockMovimientos: MovimientoInventario[] = [
  { id: 'mi1', idProducto: 'p1', nombreProducto: 'Proteína Whey Gold', tipo: 'entrada', cantidad: 30, fecha: '2024-09-01', motivo: 'Compra a proveedor Optimum Nutrition' },
  { id: 'mi2', idProducto: 'p1', nombreProducto: 'Proteína Whey Gold', tipo: 'salida', cantidad: 6, fecha: '2024-09-10', motivo: 'Ventas del período' },
  { id: 'mi3', idProducto: 'p2', nombreProducto: 'Creatina Monohidrato', tipo: 'entrada', cantidad: 20, fecha: '2024-09-01', motivo: 'Compra a proveedor' },
  { id: 'mi4', idProducto: 'p2', nombreProducto: 'Creatina Monohidrato', tipo: 'salida', cantidad: 2, fecha: '2024-09-14', motivo: 'Ventas del período' },
  { id: 'mi5', idProducto: 'p5', nombreProducto: 'BCAA Instantáneo', tipo: 'entrada', cantidad: 10, fecha: '2024-09-01', motivo: 'Compra a proveedor' },
  { id: 'mi6', idProducto: 'p5', nombreProducto: 'BCAA Instantáneo', tipo: 'merma', cantidad: 2, fecha: '2024-09-09', motivo: 'Producto dañado (empaque roto)' },
  { id: 'mi7', idProducto: 'p6', nombreProducto: 'Camiseta GymFit', tipo: 'merma', cantidad: 5, fecha: '2024-09-11', motivo: 'Defecto de fabricación' },
  { id: 'mi8', idProducto: 'p8', nombreProducto: 'Pre-Workout Explosion', tipo: 'entrada', cantidad: 20, fecha: '2024-09-01', motivo: 'Compra a proveedor' },
];

export const mockAsistencias: RegistroAsistencia[] = [
  { id: 'a1', idEmpleado: 'u2', nombreEmpleado: 'Sofía Torres', rol: 'entrenador', fecha: '2024-09-16', horaEntrada: '06:45', horaSalida: '14:30', tipoRegistro: 'asistencia' },
  { id: 'a2', idEmpleado: 'u3', nombreEmpleado: 'Diego Ramírez', rol: 'entrenador', fecha: '2024-09-16', horaEntrada: '08:50', horaSalida: '15:00', tipoRegistro: 'retardo' },
  { id: 'a3', idEmpleado: 'u4', nombreEmpleado: 'Valeria Guzmán', rol: 'recepcion', fecha: '2024-09-16', horaEntrada: '06:55', horaSalida: '15:00', tipoRegistro: 'asistencia' },
  { id: 'a4', idEmpleado: 'u6', nombreEmpleado: 'Ana Jiménez', rol: 'recepcion', fecha: '2024-09-16', horaEntrada: '14:00', horaSalida: '22:00', tipoRegistro: 'asistencia' },
  { id: 'a5', idEmpleado: 'u2', nombreEmpleado: 'Sofía Torres', rol: 'entrenador', fecha: '2024-09-15', horaEntrada: '06:50', horaSalida: '14:30', tipoRegistro: 'asistencia' },
  { id: 'a6', idEmpleado: 'u3', nombreEmpleado: 'Diego Ramírez', rol: 'entrenador', fecha: '2024-09-15', horaEntrada: '', horaSalida: '', tipoRegistro: 'falta' },
  { id: 'a7', idEmpleado: 'u4', nombreEmpleado: 'Valeria Guzmán', rol: 'recepcion', fecha: '2024-09-15', horaEntrada: '07:02', horaSalida: '15:00', tipoRegistro: 'asistencia' },
  { id: 'a8', idEmpleado: 'u6', nombreEmpleado: 'Ana Jiménez', rol: 'recepcion', fecha: '2024-09-15', horaEntrada: '14:15', horaSalida: '22:00', tipoRegistro: 'retardo' },
];

export const mockAsistenciaClases: AsistenciaClase[] = [
  { id: 'ac1', idHorario: 'h1', idCliente: 'c1', nombreCliente: 'Fernando López', clase: 'Spinning', entrenador: 'Sofía Torres', fecha: '2024-09-16', asistio: true },
  { id: 'ac2', idHorario: 'h1', idCliente: 'c4', nombreCliente: 'Daniela Reyes', clase: 'Spinning', entrenador: 'Sofía Torres', fecha: '2024-09-16', asistio: true },
  { id: 'ac3', idHorario: 'h2', idCliente: 'c2', nombreCliente: 'Gabriela Morales', clase: 'Yoga Flow', entrenador: 'Diego Ramírez', fecha: '2024-09-16', asistio: false },
  { id: 'ac4', idHorario: 'h2', idCliente: 'c6', nombreCliente: 'Lucía Vargas', clase: 'Yoga Flow', entrenador: 'Diego Ramírez', fecha: '2024-09-16', asistio: true },
  { id: 'ac5', idHorario: 'h3', idCliente: 'c3', nombreCliente: 'Roberto Sánchez', clase: 'CrossFit', entrenador: 'Sofía Torres', fecha: '2024-09-16', asistio: true },
];

export const mockCorteCaja: CorteCaja[] = [
  { id: 'cc1', recepcionistaId: 'u4', nombreRecepcionista: 'Valeria Guzmán', fecha: '2024-09-15', montoInicial: 2000, totalVentas: 3710, montoFinal: 5710, observaciones: 'Sin incidencias' },
  { id: 'cc2', recepcionistaId: 'u6', nombreRecepcionista: 'Ana Jiménez', fecha: '2024-09-15', montoInicial: 1500, totalVentas: 2480, montoFinal: 3980, observaciones: 'Faltó billete de $200, revisado' },
  { id: 'cc3', recepcionistaId: 'u4', nombreRecepcionista: 'Valeria Guzmán', fecha: '2024-09-16', montoInicial: 2000, totalVentas: 1670, montoFinal: 3670, observaciones: '' },
];

export const ventasPorDia = [
  { dia: 'Sep 1', ventas: 1350, visitas: 42 },
  { dia: 'Sep 2', ventas: 1100, visitas: 38 },
  { dia: 'Sep 3', ventas: 0, visitas: 35 },
  { dia: 'Sep 4', ventas: 0, visitas: 40 },
  { dia: 'Sep 5', ventas: 780, visitas: 44 },
  { dia: 'Sep 6', ventas: 0, visitas: 50 },
  { dia: 'Sep 7', ventas: 0, visitas: 30 },
  { dia: 'Sep 8', ventas: 760, visitas: 45 },
  { dia: 'Sep 9', ventas: 0, visitas: 41 },
  { dia: 'Sep 10', ventas: 390, visitas: 48 },
  { dia: 'Sep 11', ventas: 0, visitas: 43 },
  { dia: 'Sep 12', ventas: 480, visitas: 46 },
  { dia: 'Sep 13', ventas: 0, visitas: 37 },
  { dia: 'Sep 14', ventas: 0, visitas: 33 },
  { dia: 'Sep 15', ventas: 1670, visitas: 52 },
  { dia: 'Sep 16', ventas: 320, visitas: 47 },
];

export const asistenciaPorClase = [
  { clase: 'Spinning', asistencias: 145, capacidadPromedio: 18 },
  { clase: 'Yoga Flow', asistencias: 98, capacidadPromedio: 12 },
  { clase: 'CrossFit', asistencias: 87, capacidadPromedio: 10 },
  { clase: 'Pilates Mat', asistencias: 72, capacidadPromedio: 9 },
  { clase: 'Box Fitness', asistencias: 65, capacidadPromedio: 11 },
];
