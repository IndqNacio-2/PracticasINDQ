// ============================================================================
// MATRIZ DE PERMISOS POR ROL  (correcciones del 17 de noviembre de 2026)
//
// Todos los registros son de uso compartido: ningún usuario tiene registros privados.
// Aquí vive, en un solo lugar, qué rol de la plataforma puede entrar a cada módulo.
// El cliente de la app móvil NO aparece aquí: entra por sus propias rutas (authCliente)
// y solo ve sus propios datos (su perfil, sus reservaciones, sus membresías, el catálogo de clases).
//
//   Módulo              | administrador | recepcion | vendedor
//   --------------------|---------------|-----------|---------
//   Clientes            |      ✔        |    ✔      |    ✔
//   Inventario          |      ✔        |    ✔*     |    ✔        (* recepción: solo consulta)
//   Usuarios            |      ✔        |           |
//   Clases y horarios   |      ✔        |    ✔*     |             (* recepción: solo consulta)
//   Membresías          |      ✔        |    ✔*     |             (* recepción: solo consulta)
//   Reservaciones       |      ✔        |    ✔      |
//   Reportes            |      ✔        |           |
//   Recepción (cobro)   |               |    ✔      |             (backend de cobro)
//   Venta               |      ✔ (leer) |           |    ✔
//   Merma               |      ✔        |           |    ✔        (backend del punto de venta)
//   Corte de caja       |      ✔        |           |    ✔        (backend del punto de venta)
//
// Solo existen tres roles de acceso: administrador, recepcion (cobro) y vendedor (punto de venta).
// ============================================================================
import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../models/Usuarios/usuarios';
import { requireAuth } from './auth';

const METODOS_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

interface Regla {
    /** Roles que pueden consultar (GET). */
    lectura: UserRole[];
    /** Roles que pueden crear, editar o cancelar. Si se omite, son los mismos de lectura. */
    escritura?: UserRole[];
}

/** Exige sesión válida y que el rol esté permitido para el método de la petición. */
export function permitir({ lectura, escritura = lectura }: Regla) {
    return [
        requireAuth,
        (req: Request, res: Response, next: NextFunction) => {
            const permitidos = METODOS_LECTURA.has(req.method) ? lectura : escritura;
            if (!req.auth || !permitidos.includes(req.auth.rol)) {
                return res.status(403).json({ message: 'No tienes permiso para esta acción.' });
            }
            next();
        },
    ];
}

export const PERMISOS = {
    clientes: { lectura: ['administrador', 'recepcion', 'vendedor'] },
    reservaciones: { lectura: ['administrador', 'recepcion'] },
    clasesYHorarios: { lectura: ['administrador', 'recepcion'], escritura: ['administrador'] },
    reportes: { lectura: ['administrador'] },
    // Compras de membresía: la venta y el cobro del apartado los hace recepción (la app móvil entra por sus propias rutas).
    // Catálogos de enfermedades y lesiones: los consultan quienes registran clientes; solo el administrador los edita.
    catalogoSalud: { lectura: ['administrador', 'recepcion', 'vendedor'], escritura: ['administrador'] },
    membresiasCompras: { lectura: ['administrador', 'recepcion'] },
    ventas: { lectura: ['administrador', 'vendedor'], escritura: ['vendedor'] },
} satisfies Record<string, Regla>;
