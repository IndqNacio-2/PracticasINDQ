import { useCallback, useEffect, useRef, useState } from 'react';
import InventoryPage from '../../../../components/InventoryPage';
import ToastContainer from '../../../../components/Toast';
import type { Product, ToastMessage } from '../../../../types';
import { DataState } from '../../components/DataState';
import { agregarExistencias, cambiarEstado, crearProducto, editarProducto, listarProductos } from './inventarioApi';

export function ProductosPage() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    const id = String(++toastId.current);
    setToasts(actuales => [...actuales, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts(actuales => actuales.filter(toast => toast.id !== id));
      timers.current = timers.current.filter(actual => actual !== timer);
    }, 4000);
    timers.current.push(timer);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProductos(await listarProductos());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  // Actualiza únicamente con el producto confirmado por el servidor.
  const guardar = async (operacion: () => Promise<Product>): Promise<boolean> => {
    try {
      const guardado = await operacion();
      setProductos(actuales => actuales.some(p => p.id === guardado.id)
        ? actuales.map(p => p.id === guardado.id ? guardado : p)
        : [...actuales, guardado]);
      return true;
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'No se pudo guardar el producto.', 'error');
      return false;
    }
  };

  return (
    <div className="rx-admin-inventory">
      <DataState loading={loading} error={error} onRetry={cargar}>
        <InventoryPage products={productos} addToast={addToast}
          onAddProduct={producto => guardar(() => crearProducto(producto))}
          onUpdateProduct={producto => guardar(() => editarProducto(producto))}
          onAdjustStock={(id, cantidad) => guardar(() => agregarExistencias(id, cantidad))}
          onToggleStatus={(id, status) => guardar(() => cambiarEstado(id, status))} />
      </DataState>
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default ProductosPage;