import { useCallback, useEffect, useState } from 'react';
import InventoryPage from '../../../components/InventoryPage';
import type { Product, ToastMessage } from '../../../types';
import { listarProductos } from '../../webAdministrativa/features/productos/inventarioApi';
import { EVENTO_CAMBIO_APLICACION, CLAVE_CAMBIO_APLICACION } from '../../../services/cambiosAplicacion';

// No se vinculan servicios de escritura en la vista de consulta.
const sinEscritura = async () => false;

export default function InventarioRecepcion() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [intento, setIntento] = useState(0);
  const addToast = useCallback((mensaje: string, _tipo?: ToastMessage['type']) => setAviso(mensaje), []);

  useEffect(() => {
    let activo = true;
    let consultando = false;
    const cargar = async () => {
      if (!activo || consultando) return;
      consultando = true;
      try {
        const datos = await listarProductos();
        if (activo) { setProductos(datos); setError(null); }
      } catch (e) {
        if (activo) setError(e instanceof Error ? e.message : 'No se pudo consultar el inventario.');
      } finally {
        consultando = false;
        if (activo) setLoading(false);
      }
    };
    const refrescar = () => { if (document.visibilityState === 'visible') void cargar(); };
    const cambioEnOtraPestana = (evento: StorageEvent) => {
      if (evento.key === CLAVE_CAMBIO_APLICACION) refrescar();
    };
    void cargar();
    const intervalo = window.setInterval(refrescar, 30000);
    window.addEventListener('focus', refrescar);
    document.addEventListener('visibilitychange', refrescar);
    window.addEventListener(EVENTO_CAMBIO_APLICACION, refrescar);
    window.addEventListener('storage', cambioEnOtraPestana);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
      window.removeEventListener('focus', refrescar);
      document.removeEventListener('visibilitychange', refrescar);
      window.removeEventListener(EVENTO_CAMBIO_APLICACION, refrescar);
      window.removeEventListener('storage', cambioEnOtraPestana);
    };
  }, [intento]);

  if (loading) return <p role="status">Cargando inventario…</p>;
  return <div className="rx-admin-inventory">
    {error && <div role="alert"><p>{error} Se reintentará automáticamente.</p><button type="button" className="rx-btn rx-btn--outline" onClick={() => setIntento(n => n + 1)}>Reintentar</button></div>}
    {aviso && <p role="status">{aviso}</p>}
    <InventoryPage readOnly products={productos} addToast={addToast}
      onAddProduct={sinEscritura} onUpdateProduct={sinEscritura}
      onAdjustStock={sinEscritura} onToggleStatus={sinEscritura} />
  </div>;
}