import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField, TextareaField } from '../../components/FormField';
import { api } from '../../lib/api';
import type { Producto, Estatus, MovimientoInventario } from '../../types';

const categorias = ['Suplementos', 'Accesorios', 'Ropa', 'Equipamiento', 'Bebidas'];
const STOCK_BAJO = 5;

const EMPTY_FORM = {
  nombre: '',
  descripcion: '',
  precio: '',
  stock: '',
  categoria: 'Suplementos',
  estatus: 'activo' as Estatus,
};
const EMPTY_MOV_FORM = { idProducto: '', tipo: 'entrada', cantidad: '', motivo: '' };

// Respuesta de POST /movimientos: el movimiento creado y el producto con el stock ya actualizado.
interface RespuestaMovimiento {
  movimiento: MovimientoInventario;
  producto: Producto;
}

export function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; editing?: Producto }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState(EMPTY_MOV_FORM);
  const [movSaving, setMovSaving] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);

  // Trae productos y movimientos recientes en paralelo.
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ps, ms] = await Promise.all([
        api.get<Producto[]>('/productos'),
        api.get<MovimientoInventario[]>('/movimientos?limit=6'),
      ]);
      setProductos(ps);
      setMovimientos(ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModal({ open: true });
  };

  const openEdit = (p: Producto) => {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: String(p.precio),
      stock: String(p.stock),
      categoria: p.categoria,
      estatus: p.estatus,
    });
    setFormError(null);
    setModal({ open: true, editing: p });
  };

  const openMovimiento = () => {
    setMovForm(EMPTY_MOV_FORM);
    setMovError(null);
    setMovModal(true);
  };

  /*
   * Crea (POST) o actualiza (PATCH) el producto. El backend devuelve el producto
   * ya guardado (con su idProducto), que es el que se agrega/reemplaza en la lista.
   * Al editar NO se envía el stock: solo cambia mediante movimientos de inventario.
   */
  const save = async () => {
    const precio = Number(form.precio);
    const stock = form.stock === '' ? 0 : Number(form.stock);

    if (!form.nombre.trim()) { setFormError('El nombre del producto es obligatorio.'); return; }
    if (form.precio === '' || !Number.isFinite(precio) || precio < 0) {
      setFormError('El precio debe ser un número mayor o igual a 0.');
      return;
    }
    if (!modal.editing && (!Number.isInteger(stock) || stock < 0)) {
      setFormError('El stock inicial debe ser un entero mayor o igual a 0.');
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion,
      precio,
      categoria: form.categoria,
      estatus: form.estatus,
    };

    try {
      if (modal.editing) {
        const actualizado = await api.patch<Producto>(`/productos/${modal.editing.idProducto}`, payload);
        setProductos(prev => prev.map(p => (p.idProducto === actualizado.idProducto ? actualizado : p)));
      } else {
        const creado = await api.post<Producto>('/productos', { ...payload, stock });
        setProductos(prev => [...prev, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setModal({ open: false });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  /*
   * Registra el movimiento en el backend. Él valida el stock y descuenta de forma
   * atómica; aquí solo se refleja la respuesta (producto con stock nuevo + movimiento).
   */
  const saveMovimiento = async () => {
    const cantidad = Number(movForm.cantidad);
    const producto = productos.find(p => p.idProducto === movForm.idProducto);

    if (!producto) { setMovError('Selecciona un producto.'); return; }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setMovError('La cantidad debe ser un entero mayor a 0.');
      return;
    }
    if (movForm.tipo !== 'entrada' && cantidad > producto.stock) {
      setMovError(`Stock insuficiente: ${producto.nombre} solo tiene ${producto.stock} unidades.`);
      return;
    }

    setMovSaving(true);
    setMovError(null);
    try {
      const r = await api.post<RespuestaMovimiento>('/movimientos', {
        idProducto: movForm.idProducto,
        tipo: movForm.tipo,
        cantidad,
        motivo: movForm.motivo,
      });
      setProductos(prev => prev.map(p => (p.idProducto === r.producto.idProducto ? r.producto : p)));
      setMovimientos(prev => [r.movimiento, ...prev].slice(0, 6));
      setMovModal(false);
    } catch (e) {
      setMovError(e instanceof Error ? e.message : 'No se pudo registrar el movimiento.');
    } finally {
      setMovSaving(false);
    }
  };

  const productoOptions = productos
    .filter(p => p.estatus === 'activo')
    .map(p => ({ value: p.idProducto, label: `${p.nombre} (stock: ${p.stock})` }));

  const totalStock = productos.reduce((s, p) => s + p.stock, 0);
  const totalValor = productos.reduce((s, p) => s + p.stock * p.precio, 0);
  const stockBajo = productos.filter(p => p.stock <= STOCK_BAJO && p.estatus === 'activo');

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Inventario</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {productos.length} productos · {totalStock} unidades · Valor ${totalValor.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openMovimiento} className="rx-btn rx-btn--outline" disabled={loading || !!error}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Movimiento
          </button>
          <button onClick={openNew} className="rx-btn rx-btn--accent" disabled={loading || !!error}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo producto
          </button>
        </div>
      </div>

      <DataState loading={loading} error={error} onRetry={cargar}>
        {/* Aviso de stock bajo */}
        {stockBajo.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <p className="text-sm text-amber-700 font-medium">
              {stockBajo.map(p => p.nombre).join(', ')} con stock bajo (≤{STOCK_BAJO} unidades).
            </p>
          </div>
        )}

        <DataTable
          data={productos as unknown as Record<string, unknown>[]}
          searchKeys={['nombre', 'categoria'] as never[]}
          emptyMessage="Aún no hay productos registrados"
          columns={[
            {
              key: 'nombre', header: 'Producto',
              render: row => {
                const p = row as unknown as Producto;
                return (
                  <div>
                    <p className="font-medium text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{p.descripcion}</p>
                  </div>
                );
              }
            },
            { key: 'categoria', header: 'Categoría' },
            {
              key: 'precio', header: 'Precio',
              render: row => <span className="font-medium text-gray-800">${(row as unknown as Producto).precio.toLocaleString()}</span>
            },
            {
              key: 'stock', header: 'Stock',
              render: row => {
                const p = row as unknown as Producto;
                const low = p.stock <= STOCK_BAJO;
                return (
                  <span className={`font-semibold ${low ? 'text-red-500' : 'text-gray-800'}`}>
                    {p.stock} {low && <span className="text-xs font-normal text-red-400">(bajo)</span>}
                  </span>
                );
              }
            },
            {
              key: 'estatus', header: 'Estatus',
              render: row => <Badge variant={(row as unknown as Producto).estatus} />
            },
          ]}
          actions={row => {
            const p = row as unknown as Producto;
            return (
              <button onClick={() => openEdit(p)} className="rx-icon-btn" aria-label={`Editar ${p.nombre}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            );
          }}
        />

        {/* Movimientos recientes */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Movimientos Recientes</h3>
          {movimientos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aún no hay movimientos registrados</p>
          ) : (
            <div className="space-y-2">
              {movimientos.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${m.tipo === 'entrada' ? 'bg-emerald-50' : m.tipo === 'merma' ? 'bg-red-50' : 'bg-amber-50'}`}>
                      <svg className={`w-3.5 h-3.5 ${m.tipo === 'entrada' ? 'text-emerald-600' : m.tipo === 'merma' ? 'text-red-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.tipo === 'entrada' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.nombreProducto}</p>
                      <p className="text-xs text-gray-400">{m.motivo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                    </p>
                    <p className="text-xs text-gray-400">{m.fecha}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DataState>

      {/* Modal: crear / editar producto */}
      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar producto' : 'Nuevo producto'}>
        <div className="space-y-4">
          <InputField label="Nombre del producto" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <TextareaField label="Descripción" value={form.descripcion} onChange={v => setForm(f => ({ ...f, descripcion: v }))} rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Precio ($)" required type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
            <InputField
              label={modal.editing ? 'Stock actual' : 'Stock inicial'}
              type="number"
              min="0"
              step="1"
              value={form.stock}
              disabled={!!modal.editing}
              title={modal.editing ? 'Para cambiar el stock registra un movimiento de inventario' : undefined}
              onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
            />
          </div>
          {modal.editing && (
            <p className="text-xs text-gray-400 -mt-2">
              El stock solo se modifica con un movimiento de inventario (entrada, salida o merma).
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Categoría" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} options={categorias.map(c => ({ value: c, label: c }))} />
            <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setModal({ open: false })} className="rx-btn rx-btn--outline flex-1" disabled={saving}>Cancelar</button>
          <button onClick={save} className="rx-btn rx-btn--dark flex-1" disabled={saving}>
            {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Agregar producto'}
          </button>
        </div>
      </Modal>

      {/* Modal: movimiento de inventario */}
      <Modal open={movModal} onClose={() => setMovModal(false)} title="Registrar movimiento de inventario" size="sm">
        <div className="space-y-4">
          <SelectField label="Producto" required value={movForm.idProducto} onChange={e => setMovForm(f => ({ ...f, idProducto: e.target.value }))} options={productoOptions} />
          <SelectField label="Tipo de movimiento" required value={movForm.tipo} onChange={e => setMovForm(f => ({ ...f, tipo: e.target.value }))}
            options={[{ value: 'entrada', label: 'Entrada (compra/reposición)' }, { value: 'salida', label: 'Salida (venta/uso)' }, { value: 'merma', label: 'Merma (pérdida/daño)' }]} />
          <InputField label="Cantidad" required type="number" min="1" step="1" value={movForm.cantidad} onChange={e => setMovForm(f => ({ ...f, cantidad: e.target.value }))} />
          <TextareaField label="Motivo" value={movForm.motivo} onChange={v => setMovForm(f => ({ ...f, motivo: v }))} rows={2} />
          {movError && <p className="text-sm text-red-500">{movError}</p>}
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setMovModal(false)} className="rx-btn rx-btn--outline flex-1" disabled={movSaving}>Cancelar</button>
          <button onClick={saveMovimiento} className="rx-btn rx-btn--dark flex-1" disabled={movSaving}>
            {movSaving ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}