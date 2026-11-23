/**
 * Valido los datos de un producto antes de guardarlo en la base
 * 
 * replico las reglas del formulario del fronted (ProductFormModal):
 * nombre y codigo obligatorios, precio mayor a cero y sin negativos,
 * para que la API no acepte lo que la pantalla ya rechaza
 */

import  type { ProductInput, ProductStatus, ValidationIssue } from "./product.types.js"

// reviso si el valor es un texto no vacio despues de quitar espacios
function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Convierto a numero lo que llegue como texto ("25 -> 25")
 * devuelvo null cuando no es numero utilisable
 */
function toNumber(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * Valido el cuerpo recibido al crear o editar un producto
 * 
 * devuelvo la lista de errores por campo. Si la lista viene vacai,
 * los datos estan listos para guardarse
 */
export function validateProductInput(data: unknown): {
  issues: ValidationIssue[];
  input: ProductInput | null;
} {
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<
  string,
  unknown
 >;

  const issues: ValidationIssue[] = [];
  
  // codigo obligatorio, maximo 20 caracteres como en la base.
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!isNonEmptyText(code)) {
    issues.push({ field: "code", message: "El codigo es obligatorio." });
  } else if (code.length > 20) {
    issues.push({ field: "code", message: "El codigo no debe superar 20 caracteres."});
  }

  // Nombre obligatorio maximo 120 caracteres como en la base
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isNonEmptyText(name)) {
    issues.push({ field: "name", message: "El nombre es obligatorio." });
  } else if (name.length > 120) {
    issues.push({ field: "name", message: "El nombre no debe superar 120 caracteres." });
  }

  // categoria boligatoria para los filtros de Inventario y venta
  const category = typeof body.category === "string" ? body.category.trim() : "";
  if (!isNonEmptyText(category)) {
    issues.push({ field: "category", message: "La categoria es obligatoria." });
  } else if (category.length > 60) {
    issues.push({ field: "category", message: "La categoria no debe superar 60 caracteres." });
  }

  // precio: numero mayor a cero, igaul que en el formulario
  const price = toNumber(body.price);
  if(price === null) {
    issues.push({ field: "price", message: "El precio debe ser un numero." });
  } else if (price <= 0) {
    issues.push({ field: "price", message: "El precio debe ser mayor a cero."});
  }

  // costo: acepto cero pero nunca negativos
  const cost = toNumber(body.cost);
  if (cost === null) {
    issues.push({ field: "cost", message: "El costo debe ser un numero." });
  } else if (cost < 0) {
    issues.push({ field: "cost", message: "El costo no puede ser negativo." });
  }

  // Existencai: entero mayotr o igual a cero
  const stock = toNumber(body.stock);
  if (stock === null || !Number.isInteger(stock)) {
    issues.push({ field: "stock", message: "La existencia debe ser un numero entero."});
  } else if (stock < 0) {
    issues.push({ field: "stock", message: "La existencia no peude ser negativa." });
  }

  // Existencia minima: entero sin negativos.
  const minimumStock = toNumber(body.minimumStock);
  if (minimumStock === null || !Number.isInteger(minimumStock)) {
    issues.push({ field: "minimumStock", message: "La existencia minima debe ser un numero entero." });
  } else if (minimumStock < 0) {
    issues.push({ field: "minimumStock", message: "La existencia minima no puede ser negativa." });
  }

  // Estado: solo los dos valores que maneja el sistema
  const rawStatus = typeof body.status === "string" ? body.status.trim() : "active";
  const status: ProductStatus = rawStatus === "inactive" ? "inactive" : "active";
  if (rawStatus !== "active" && rawStatus !== "inactive") {
    issues.push({ field: "status", message: "El estado debe ser active o inactive." });
  }

  // si algo fallo, devuelvo los errores y ninugun dato limpio
  if (
    issues.length > 0 ||
    price === null ||
    cost === null ||
    stock === null ||
    minimumStock === null
  ) {
    return { issues, input: null };
  }

  // armo el objeto limpio con textos recortadso y numero convertidos
  return {
    issues,
    input: {
      code,
      name,
      description: typeof body.description === "string" ? body.description.trim() : "",
      category,
      price,
      cost,
      stock,
      minimumStock,
      status,
      icon: typeof body.icon === "string" && body.icon.trim().length > 0 ? body.icon.trim() : "inventory_2",
      bgColor: typeof body.bgColor === "string" && body.bgColor.trim().length > 0 ? body.bgColor.trim() : "#F3F4F6",
    },
  };
}

/**
 * Valido el cuerpo recibido al ajustar existencias
 *
 * solo acepto cantidades enteras distintas de cero, igual que el modal
 * "Agregar existencias" del Inventario
 */
export function validateStockAdjustment(data: unknown): {
  issues: ValidationIssue[];
  quantity: number | null;
} {
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<
    string,
    unknown
  >;

  const quantity = toNumber(body.quantity);

  if (quantity === null || !Number.isInteger(quantity)) {
    return {
      issues: [{ field: "quantity", message: "La cantidad debe ser un numero entero." }],
      quantity: null,
    };
  }

  if (quantity === 0) {
    return {
      issues: [{ field: "quantity", message: "La cantidad no puede ser cero." }],
      quantity: null,
    };
  }

  return { issues: [], quantity };
}

/**
 * Valido el cuerpo recibido al cambiar el estado de un producto
 *
 * es la misma regla del modal de activar/desactivar del Inventario
 */
export function validateStatusChange(data: unknown): {
  issues: ValidationIssue[];
  status: "active" | "inactive" | null;
} {
  const body = (typeof data === "object" && data !== null ? data : {}) as Record<
    string,
    unknown
  >;

  const status = typeof body.status === "string" ? body.status.trim() : "";

  if (status !== "active" && status !== "inactive") {
    return {
      issues: [{ field: "status", message: "El estado debe ser active o inactive." }],
      status: null,
    };
  }

  return { issues: [], status };
}