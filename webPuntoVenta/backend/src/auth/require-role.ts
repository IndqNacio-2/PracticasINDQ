/**
 * Autorización por rol para el punto de venta.
 *
 * Este backend no emite tokens: la sesión del personal la crea la API administrativa
 * (POST /admin/api/auth/login). Aquí se valida el mismo token preguntándole a /auth/me
 * (igual que hace backend-cobro/autorizacion.js) y se revisa que el rol esté permitido.
 *
 * Solo existen tres roles de acceso: administrador, recepcion (cobro) y vendedor (punto de venta).
 */

import type { NextFunction, Request, Response } from "express";

export type StaffRole = "administrador" | "recepcion" | "vendedor";

// Dirección de la API administrativa. En el gateway unificado es esta misma app bajo /admin/api.
const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000/admin/api";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

interface RoleRule {
  /** Roles que pueden consultar (GET). */
  read: StaffRole[];
  /** Roles que pueden crear o modificar. Si se omite, son los mismos de lectura. */
  write?: StaffRole[];
}

/** Exige sesión válida y que el rol esté permitido para el método de la petición. */
export function requireRoles({ read, write = read }: RoleRule) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      response.status(401).json({ status: "error", message: "Inicia sesión para continuar" });
      return;
    }

    try {
      const check = await fetch(`${ADMIN_API_URL}/auth/me`, {
        headers: { Authorization: authorization },
        signal: AbortSignal.timeout(8000),
      });

      if (!check.ok) {
        response
          .status(check.status === 401 ? 401 : 503)
          .json({ status: "error", message: "No se pudo validar tu sesión" });
        return;
      }

      const { user } = (await check.json()) as { user?: { rol?: StaffRole; estatus?: string } };
      const allowed = READ_METHODS.has(request.method) ? read : write;

      if (!user?.rol || user.estatus !== "activo" || !allowed.includes(user.rol)) {
        response.status(403).json({ status: "error", message: "No tienes permiso para esta acción" });
        return;
      }

      next();
    } catch {
      response
        .status(503)
        .json({ status: "error", message: "Administración no está disponible para validar la sesión" });
    }
  };
}
