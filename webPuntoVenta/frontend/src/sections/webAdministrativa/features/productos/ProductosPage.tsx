import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField, TextareaField } from '../../components/FormField';
import { mockProductos as initial, mockMovimientos } from '../../data/mock';
import type { Producto, Estatus } from '../../types';

const categorias = ['Suplementos', 'Accesorios', 'Ropa', 'Equipamiento', 'Bebidas'];

export function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>(initial);
  const [modal, setModal] = useState<{ open: boolean; editing?: Producto }>({ open: false });
  const [movModal, setMovModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', stock: '', categoria: 'Suplementos', estatus: 'activo' as Estatus });
  const [movForm, setMovForm] = useState({ idProducto: '', tipo: 'entrada', cantidad: '', motivo: '' });

  const openNew = () => {
    setForm({ nombre: '', descripcion: '', precio: '', stock: '', categoria: 'Suplementos', estatus: 'activo' });
    setModal({ open: true });
  };

  const save = () => {
    if (!form.nombre) return;
    if (modal.editing) {
      setProductos(prev => prev.map(p => p.idProducto === modal.editing!.idProducto ? { ...p, ...form, precio: Number(form.precio), stock: Number(form.stock) } : p));
    } else {
      setProductos(prev => [...prev, { idProducto: `p${Date.now()}`, nombre: form.nombre, descripcion: form.descripcion, precio: Number(form.precio), stock: Number(form.stock), categoria: form.categoria, estatus: form.estatus }]);
    }
    setModal({ open: false });
  };

  const saveMovimiento = () => {
    const { idProducto, tipo, cantidad } = movForm;
    if (!idProducto || !cantidad) return;
    const delta = tipo === 'entrada' ? Number(cantidad) : -Number(cantidad);
    setProductos(prev => prev.map(p => p.idProducto === idProducto ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
    setMovModal(false);
  };

  const productoOptions = productos.map(p => ({ value: p.idProducto, label: p.nombre }));

  const totalStock = productos.reduce((s, p) => s + p.stock, 0);
  const totalValor = productos.reduce((s, p) => s + p.stock * p.precio, 0);

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Inventario</h1>
          <p className="text-slate-500 text-sm mt-0.5">{productos.length} productos · {totalStock} unidades · Valor ${totalValor.toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setMovForm({ idProducto: '', tipo: 'entrada', cantidad: '', motivo: '' }); setMovModal(true); }}
            className="flex items-center gap-2 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Movimiento
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo producto
          </button>
        </div>
      </div>

      {/* Low stock warning */}
      {productos.some(p => p.stock <= 5 && p.estatus === 'activo') && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-sm text-amber-700 font-medium">
            {productos.filter(p => p.stock <= 5 && p.estatus === 'activo').map(p => p.nombre).join(', ')} con stock bajo (≤5 unidades).
          </p>
        </div>
      )}

      <DataTable
        data={productos as unknown as Record<string, unknown>[]}
        searchKeys={['nombre', 'categoria'] as never[]}
        columns={[
          {
            key: 'nombre', header: 'Producto',
            render: row => {
              const p = row as unknown as Producto;
              return (
                <div>
                  <p className="font-medium text-slate-800">{p.nombre}</p>
                  <p className="text-xs text-slate-400">{p.descripcion}</p>
                </div>
              );
            }
          },
          { key: 'categoria', header: 'Categoría' },
          {
            key: 'precio', header: 'Precio',
            render: row => <span className="font-medium text-slate-800">${(row as unknown as Producto).precio.toLocaleString()}</span>
          },
          {
            key: 'stock', header: 'Stock',
            render: row => {
              const p = row as unknown as Producto;
              const low = p.stock <= 5;
              return (
                <span className={`font-semibold ${low ? 'text-red-500' : 'text-slate-800'}`}>
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
            <button onClick={() => { setForm({ nombre: p.nombre, descripcion: p.descripcion, precio: String(p.precio), stock: String(p.stock), categoria: p.categoria, estatus: p.estatus }); setModal({ open: true, editing: p }); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          );
        }}
      />

      {/* Recent movements */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>Movimientos Recientes</h3>
        <div className="space-y-2">
          {mockMovimientos.slice(0, 6).map(m => (
            <div key={m.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${m.tipo === 'entrada' ? 'bg-emerald-50' : m.tipo === 'merma' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <svg className={`w-3.5 h-3.5 ${m.tipo === 'entrada' ? 'text-emerald-600' : m.tipo === 'merma' ? 'text-red-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={m.tipo === 'entrada' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.nombreProducto}</p>
                  <p className="text-xs text-slate-400">{m.motivo}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                </p>
                <p className="text-xs text-slate-400">{m.fecha}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar producto' : 'Nuevo producto'}>
        <div className="space-y-4">
          <InputField label="Nombre del producto" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <TextareaField label="Descripción" value={form.descripcion} onChange={v => setForm(f => ({ ...f, descripcion: v }))} rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Precio ($)" required type="number" min="0" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
            <InputField label="Stock inicial" type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Categoría" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} options={categorias.map(c => ({ value: c, label: c }))} />
            <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal({ open: false })} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
          <button onClick={save} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">
            {modal.editing ? 'Guardar cambios' : 'Agregar producto'}
          </button>
        </div>
      </Modal>

      <Modal open={movModal} onClose={() => setMovModal(false)} title="Registrar movimiento de inventario" size="sm">
        <div className="space-y-4">
          <SelectField label="Producto" required value={movForm.idProducto} onChange={e => setMovForm(f => ({ ...f, idProducto: e.target.value }))} options={productoOptions} />
          <SelectField label="Tipo de movimiento" required value={movForm.tipo} onChange={e => setMovForm(f => ({ ...f, tipo: e.target.value }))}
            options={[{ value: 'entrada', label: 'Entrada (compra/reposición)' }, { value: 'salida', label: 'Salida (venta/uso)' }, { value: 'merma', label: 'Merma (pérdida/daño)' }]} />
          <InputField label="Cantidad" required type="number" min="1" value={movForm.cantidad} onChange={e => setMovForm(f => ({ ...f, cantidad: e.target.value }))} />
          <TextareaField label="Motivo" value={movForm.motivo} onChange={v => setMovForm(f => ({ ...f, motivo: v }))} rows={2} />
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setMovModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
          <button onClick={saveMovimiento} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">Registrar</button>
        </div>
      </Modal>
    </div>
  );
}
