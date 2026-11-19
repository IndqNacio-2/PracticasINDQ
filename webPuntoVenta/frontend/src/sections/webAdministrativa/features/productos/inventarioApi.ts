import type { Product } from '../../../../types';
import { api } from '../../lib/api';

interface ProductoRespuesta {
  idProducto: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  costo: number;
  stock: number;
  stockMinimo: number;
  estatus: 'activo' | 'inactivo';
  icon: string;
  bgColor: string;
}

function aProducto(producto: ProductoRespuesta): Product {
  return {
    id: Number(producto.idProducto), code: producto.codigo,
    name: producto.nombre, description: producto.descripcion,
    category: producto.categoria, price: producto.precio, cost: producto.costo,
    stock: producto.stock, minimumStock: producto.stockMinimo,
    status: producto.estatus === 'activo' ? 'active' : 'inactive',
    icon: producto.icon, bgColor: producto.bgColor,
  };
}

export async function listarProductos(): Promise<Product[]> {
  return (await api.get<ProductoRespuesta[]>('/productos')).map(aProducto);
}

export async function crearProducto(producto: Omit<Product, 'id'>): Promise<Product> {
  return aProducto(await api.post<ProductoRespuesta>('/productos', producto));
}

export async function editarProducto(producto: Product): Promise<Product> {
  // Nunca reenviar stock al editar: puede haber cambiado por una venta.
  const { id, stock: _stock, ...datos } = producto;
  return aProducto(await api.patch<ProductoRespuesta>(`/productos/${id}`, datos));
}

export async function cambiarEstado(id: number, status: Product['status']): Promise<Product> {
  return aProducto(await api.patch<ProductoRespuesta>(`/productos/${id}`, { status }));
}

export async function agregarExistencias(id: number, cantidad: number): Promise<Product> {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad debe ser un entero mayor a cero.');
  }
  const respuesta = await api.post<{ producto: ProductoRespuesta }>('/movimientos', {
    idProducto: String(id), tipo: 'entrada', cantidad, motivo: 'Agregar existencias',
  });
  return aProducto(respuesta.producto);
}