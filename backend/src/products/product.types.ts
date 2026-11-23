/**
 * Defino como se ve un producto dentro del backend
 * 
 * uso camelCase (minimunStock, bgColor) igual que el fronted en
 * src/types.ts, aunque en la base de comulmnas van en snake_case
 * asi el inventario y el punto de venta usan la respuesta sin covertir. 
 */

export type ProductStatus = "active" | "inactive";

export interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minimumStock: number;
  status: ProductStatus;
  icon: string;
  bgColor: string;
}

/**
 * Describo lo que acepto al cerar o editar un producto
 * no incluyo el id porque la base lo genera sola
 */
export interface ProductInput {
  code: string;
  name: string;
  description: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minimumStock: number;
  status: ProductStatus;
  icon: string;
  bgColor: string;
}

/**
 * Representa un error de validacion por campo
 * lo uso para responderle al cliente exactamente que dato viene mal
 */
export interface ValidationIssue {
  field: string;
  message: string;
}

