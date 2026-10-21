/**
 * Defino las rutas de ventas y su respuesta JSON
 *
 * codigos de estado que uso:
 * 200 correcto | 201 venta registrada | 400 dato invalido
 * 404 producto no existe | 422 no alcanzan las existencias
 */

import { Router, type Response } from "express";

import * as saleRepository from "./sale.repository.js";
import { validateSaleInput } from "./sale.validation.js";
import type { ValidationIssue } from "./sale.types.js";

export const saleRouter = Router();

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

// GET /api/sales  historial de ventas para el corte de caja y los reportes.
saleRouter.get("/", async (_request, response) => {
  try {
    response.status(200).json(await saleRepository.listSales());
  } catch (error) {
    console.error("Error al consultar las ventas:", error);
    response.status(500).json({ status: "error", message: "No fue posible consultar las ventas" });
  }
});

// POST /api/sales  registro de una venta cobrada en el punto de venta.
saleRouter.post("/", async (request, response) => {
  const { issues, input } = validateSaleInput(request.body);

  if (!input) {
    sendValidationErrors(response, issues);
    return;
  }

  try {
    const result = await saleRepository.insertSale(input);

    // Algun producto del carrito ya no existe en el catalogo.
    if (result.outcome === "product-not-found") {
      response.status(404).json({
        status: "error",
        message: `No existe un producto con el id ${result.productId}`,
      });
      return;
    }

    // 422: se intento vender mas de lo que hay en existencia.
    if (result.outcome === "insufficient-stock") {
      response.status(422).json({
        status: "error",
        message: `No hay existencias suficientes de ${result.productName}. Solamente quedan ${result.available} unidades`,
        errors: [{ field: "items", message: "La cantidad supera la existencia disponible." }],
      });
      return;
    }

    response.status(201).json({
      status: "ok",
      message: `Venta ${result.sale.folio} registrada correctamente`,
      sale: result.sale,
    });
  } catch (error) {
    console.error("Error al registrar la venta:", error);
    response.status(500).json({ status: "error", message: "No fue posible registrar la venta" });
  }
});