/**
 * Defino las 5 rutas de productos y su respuesta JSON
 *
 * codigos de estado que uso en todas:
 * 200 correcto | 400 dato invalido | 404 no existe | 409 dato repetido
 * 422 no se puede operar (restar mas de lo que hay)
 */

import { Router, type Response } from "express";

import * as productRepository from "./product.repository.js";
import {
  validateProductInput,
  validateStockAdjustment,
  validateStatusChange,
} from "./product.validation.js";
import type { ValidationIssue } from "./product.types.js";

export const productRouter = Router();

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

// Convierto el parametro :id de la URL en numero. Devuelvo null si no lo es.
function parseId(rawId: string | undefined): number | null {
  const id = Number.parseInt(rawId ?? "", 10);

  return Number.isInteger(id) && id > 0 ? id : null;
}

// Reviso si el id de la URL es valido. Devuelvo el id o respondo 400.
function getValidId(request: { params: Record<string, string | undefined> }, response: Response): number | null {
  const id = parseId(request.params.id);

  if (id === null) {
    response.status(400).json({ status: "error", message: "El identificador del producto no es valido" });
  }

  return id;
}

// GET /api/products  listado para Inventario y tarjetas de Venta.
productRouter.get("/", async (_request, response) => {
  try {
    response.status(200).json(await productRepository.listProducts());
  } catch (error) {
    console.error("Error al consultar los productos:", error);
    response.status(500).json({ status: "error", message: "No fue posible consultar los productos" });
  }
});

// GET /api/products/:id  detalle del producto.
productRouter.get("/:id", async (request, response) => {
  const id = getValidId(request, response);
  if (id === null) return;

  try {
    const product = await productRepository.findProductById(id);

    if (!product) {
      response.status(404).json({ status: "error", message: `No existe un producto con el id ${id}` });
      return;
    }

    response.status(200).json(product);
  } catch (error) {
    console.error("Error al consultar el producto:", error);
    response.status(500).json({ status: "error", message: "No fue posible consultar el producto" });
  }
});

// POST /api/products  alta de un producto nuevo.
productRouter.post("/", async (request, response) => {
  const { issues, input } = validateProductInput(request.body);

  if (!input) {
    sendValidationErrors(response, issues);
    return;
  }

  try {
    const product = await productRepository.insertProduct(input);

    response.status(201).json({
      status: "ok",
      message: `Producto ${product.name} creado correctamente`,
      product,
    });
  } catch (error) {
    // 23505 es el codigo de "violation of unique" de PostgreSQL:
    // aqui significa que el codigo P-XXX ya esta registrado.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
      response.status(409).json({
        status: "error",
        message: `Ya existe un producto con el codigo ${input.code}`,
        errors: [{ field: "code", message: "El codigo ya esta registrado." }],
      });
      return;
    }

    console.error("Error al crear el producto:", error);
    response.status(500).json({ status: "error", message: "No fue posible crear el producto" });
  }
});


// PUT /api/products/:id  editar la informacion del producto.
productRouter.put("/:id", async (request, response) => {
  const id = getValidId(request, response);
  if (id === null) return;

  const { issues, input } = validateProductInput(request.body);

  if (!input) {
    sendValidationErrors(response, issues);
    return;
  }

  try {
    const product = await productRepository.updateProduct(id, input);

    if (!product) {
      response.status(404).json({ status: "error", message: `No existe un producto con el id ${id}` });
      return;
    }

    response.status(200).json({
      status: "ok",
      message: `Producto ${product.name} actualizado correctamente`,
      product,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
      response.status(409).json({
        status: "error",
        message: `Ya existe otro producto con el codigo ${input.code}`,
        errors: [{ field: "code", message: "El codigo ya esta registrado en otro producto." }],
      });
      return;
    }

    console.error("Error al actualizar el producto:", error);
    response.status(500).json({ status: "error", message: "No fue posible actualizar el producto" });
  }
});

// PATCH /api/products/:id/status  activar o desactivar el producto.
productRouter.patch("/:id/status", async (request, response) => {
  const id = getValidId(request, response);
  if (id === null) return;

  const { issues, status } = validateStatusChange(request.body);

  if (!status) {
    sendValidationErrors(response, issues);
    return;
  }

  try {
    const product = await productRepository.updateProductStatus(id, status);

    if (!product) {
      response.status(404).json({ status: "error", message: `No existe un producto con el id ${id}` });
      return;
    }

    response.status(200).json({
      status: "ok",
      message: status === "active"
        ? `Producto ${product.name} activado`
        : `Producto ${product.name} desactivado`,
      product,
    });
  } catch (error) {
    console.error("Error al cambiar el estado del producto:", error);
    response.status(500).json({ status: "error", message: "No fue posible cambiar el estado del producto" });
  }
});

/**
 * POST /api/products/:id/stock  entrada o salida de existencias.
 *
 * uso quantity positivo para entrada y negativo para salida, para que
 * en la Actividad 4 la merma reuse esta misma ruta.
 */
productRouter.post("/:id/stock", async (request, response) => {
  const id = getValidId(request, response);
  if (id === null) return;

  const { issues, quantity } = validateStockAdjustment(request.body);

  if (quantity === null) {
    sendValidationErrors(response, issues);
    return;
  }

  try {
    const product = await productRepository.adjustProductStock(id, quantity);

    if (!product) {
      // 422: el producto existe pero no se puede aplicar la operacion,
      // porque restar dejaria la existencia por debajo de cero.
      response.status(422).json({
        status: "error",
        message: "La operacion dejaria la existencia por debajo de cero. La cantidad a retirar es mayor a la existencia disponible",
        errors: [{ field: "quantity", message: "La cantidad supera la existencia disponible." }],
      });
      return;
    }

    response.status(200).json({
      status: "ok",
      message: `Existencia de ${product.name} actualizada a ${product.stock} unidades`,
      product,
    });
  } catch (error) {
    console.error("Error al ajustar la existencia:", error);
    response.status(500).json({ status: "error", message: "No fue posible ajustar la existencia" });
  }
});
