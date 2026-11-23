/**
 * Defino las rutas de cortes de caja y su respuesta JSON
 *
 * codigos de estado que uso:
 * 200 correcto | 201 corte registrado | 400 dato invalido
 */

import { Router, type Response } from "express";
import { requirePosUser, type PosUser } from '../auth.js';

import * as cashClosingRepository from "./cash-closing.repository.js";
import {
  validateCashClosingInput,
  type ValidationIssue,
} from "./cash-closing.types.js";

export const cashClosingRouter = Router();
cashClosingRouter.use(requirePosUser);

// Respondo los errores de validacion siempre con el mismo formato.
function sendValidationErrors(response: Response, issues: ValidationIssue[]): void {
  response.status(400).json({
    status: "error",
    message: "Los datos enviados no son validos",
    errors: issues,
  });
}

// GET /api/cash-closings  historial de cortes para la pantalla de Corte de caja.
cashClosingRouter.get("/", async (_request, response) => {
  try {
    response.status(200).json(await cashClosingRepository.listCashClosings((response.locals.posUser as PosUser).id));
  } catch (error) {
    console.error("Error al consultar los cortes de caja:", error);
    response.status(500).json({ status: "error", message: "No fue posible consultar los cortes de caja" });
  }
});

// POST /api/cash-closings  registro del cierre de un turno.
cashClosingRouter.post("/", async (request, response) => {
  const { issues, input } = validateCashClosingInput(request.body);

  if (!input) {
    sendValidationErrors(response, issues);
    return;
  }

  try {
    const ids = request.body.saleIds;
    if (!Array.isArray(ids) || ids.some(id => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length || ids.length !== input.salesCount) {
      response.status(400).json({ message: 'La lista de ventas del corte no es válida.' });
      return;
    }
    const sellerId = (response.locals.posUser as PosUser).id;
    const closing = await cashClosingRepository.insertCashClosing({ ...input, registeredBy: sellerId }, sellerId, ids);

    response.status(201).json({
      status: "ok",
      message: `Corte ${closing.folio} registrado correctamente`,
      cashClosing: closing,
    });
  } catch (error) {
    console.error("Error al registrar el corte de caja:", error);
    response.status(500).json({ status: "error", message: "No fue posible registrar el corte de caja" });
  }
});