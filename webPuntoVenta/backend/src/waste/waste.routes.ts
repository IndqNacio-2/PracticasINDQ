/**
 * Defino las rutas de mermas y su respuesta JSON
 *
 * codigos de estado que uso:
 * 200 correcto | 201 registrada | 400 dato invalido | 404 no existe
 * 422 no se puede operar (mas unidades de las que hay en existencia)
 */

import { Router, type Response } from "express";

import * as wasteRepository from "./waste.repository.js";
import { validateWasteInput } from "./waste.validation.js";
import type { ValidationIssue } from "./waste.types.js";

export const wasteRouter = Router();

/**
 * Respondo los errores de validacion con el mismo formato siempre,
 * para que el frontend pueda pintar el error debajo de cada campo.
 */
function sendValidationErrors(response: Response, issues: ValidationIssue[]): void {
  response.status(400).json({
    status: "error",
    message: "Los datos enviados no son validos",
    errors: issues,
  });
}

// GET /api/waste  historial de mermas para la pantalla de Mermas.
wasteRouter.get("/", async (_request, response) => {
  try {
    response.status(200).json(await wasteRepository.listWasteRecords());
  } catch (error) {
    console.error("Error al consultar las mermas:", error);
    response.status(500).json({ status: "error", message: "No fue posible consultar las mermas" });
  }
});

// POST /api/waste  registro de una merma nueva.
wasteRouter.post("/", async (request, response) => {
  const { issues, input } = validateWasteInput(request.body);

  if (!input) {
    sendValidationErrors(response, issues);
    return;
  }

  try {
    const result = await wasteRepository.insertWasteRecord(input);

    // El producto ya no existe en el catalogo.
    if (result.outcome === "product-not-found") {
      response.status(404).json({
        status: "error",
        message: `No existe un producto con el id ${input.productId}`,
      });
      return;
    }

    // 422: la merma es mayor que la existencia disponible.
    if (result.outcome === "insufficient-stock") {
      response.status(422).json({
        status: "error",
        message: `Solamente hay ${result.available} unidades disponibles`,
        errors: [{ field: "quantity", message: "La cantidad supera la existencia disponible." }],
      });
      return;
    }

    response.status(201).json({
      status: "ok",
      message: `Merma ${result.record.folio} registrada correctamente`,
      wasteRecord: result.record,
    });
  } catch (error) {
    console.error("Error al registrar la merma:", error);
    response.status(500).json({ status: "error", message: "No fue posible registrar la merma" });
  }
});