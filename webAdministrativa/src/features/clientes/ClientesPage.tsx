import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { mockClientes as initial } from '../../data/mock';
import type { Cliente, Estatus } from '../../types';

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>(initial);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellidos: '', correo: '', telefono: '', fechaNacimiento: '', direccion: '', estatus: 'activo' as Estatus });
  const navigate = useNavigate();

  const save = () => {
    if (!form.nombre || !form.correo) return;
    const nc: Cliente = {
      idUsuario: `c${Date.now()}`, nombre: form.nombre, apellidos: form.apellidos,
      correo: form.correo, telefono: form.telefono, codigoAcceso: `CLI${Date.now()}`,
      estatus: form.estatus, rol: 'cliente', fechaCreacion: new Date().toISOString().split('T')[0],
      fechaNacimiento: form.fechaNacimiento, direccion: form.direccion,
      fechaRegistro: new Date().toISOString().split('T')[0],
    };
    setClientes(prev => [...prev, nc]);
    setModal(false);
  };

  const toggleEstatus = (id: string) => {
    setClientes(prev => prev.map(c => c.idUsuario === id ? { ...c, estatus: c.estatus === 'activo' ? 'inactivo' : 'activo' } : c));
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Clientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{clientes.filter(c => c.estatus === 'activo').length} activos · {clientes.length} totales</p>
        </div>
        <button onClick={() => { setForm({ nombre: '', apellidos: '', correo: '', telefono: '', fechaNacimiento: '', direccion: '', estatus: 'activo' }); setModal(true); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo cliente
        </button>
      </div>

      <DataTable
        data={clientes as unknown as Record<string, unknown>[]}
        searchKeys={['nombre', 'apellidos', 'correo'] as never[]}
        columns={[
          {
            key: 'nombre', header: 'Cliente',
            render: row => {
              const c = row as unknown as Cliente;
              return (
                <div className="flex items-center gap-3">
                  {c.avatar
                    ? <img src={c.avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-slate-200" />
                    : <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">{c.nombre[0]}{c.apellidos[0]}</div>
                  }
                  <div>
                    <p className="font-medium text-slate-800">{c.nombre} {c.apellidos}</p>
                    <p className="text-xs text-slate-400">{c.correo}</p>
                  </div>
                </div>
              );
            }
          },
          { key: 'telefono', header: 'Teléfono' },
          { key: 'fechaRegistro', header: 'Registro' },
          {
            key: 'membresia', header: 'Membresía',
            render: row => {
              const c = row as unknown as Cliente;
              if (!c.membresia) return <span className="text-slate-400 text-sm">Sin membresía</span>;
              return (
                <div>
                  <p className="text-sm font-medium text-slate-700 capitalize">{c.membresia.tipo}</p>
                  <p className="text-xs text-slate-400">Vence {c.membresia.fechaFin}</p>
                </div>
              );
            }
          },
          {
            key: 'estatus', header: 'Estatus',
            render: row => <Badge variant={(row as unknown as Cliente).estatus} />
          },
        ]}
        actions={row => {
          const c = row as unknown as Cliente;
          return (
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => navigate(`/clientes/${c.idUsuario}`)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Ver expediente">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </button>
              <button onClick={() => toggleEstatus(c.idUsuario)}
                className={`p-1.5 rounded-lg transition-colors ${c.estatus === 'activo' ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                {c.estatus === 'activo'
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                }
              </button>
            </div>
          );
        }}
      />

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo cliente">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nombre" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <InputField label="Apellidos" required value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} />
          <InputField label="Correo" required type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="col-span-2" />
          <InputField label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <InputField label="Fecha de nacimiento" type="date" value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} />
          <InputField label="Dirección" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} className="col-span-2" />
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
          <button onClick={save} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">Registrar cliente</button>
        </div>
      </Modal>
    </div>
  );
}
