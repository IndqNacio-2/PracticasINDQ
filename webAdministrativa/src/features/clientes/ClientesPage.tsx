import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api } from '../../lib/api';
import type { Cliente, Estatus } from '../../types';

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellidos: '', correo: '', telefono: '', fechaNacimiento: '', direccion: '', estatus: 'activo' as Estatus });
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Cliente[]>('/clientes');
      setClientes(data);
    } catch {
      setError('No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.nombre || !form.correo) return;
    setSaving(true);
    try {
      const nuevo = await api.post<Cliente>('/clientes', {
        ...form,
        rol: 'cliente',
      });
      setClientes(prev => [...prev, nuevo]);
      setModal(false);
    } catch {
      setError('No se pudo registrar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEstatus = async (id: string) => {
    const cliente = clientes.find(c => c.idUsuario === id);
    if (!cliente) return;
    const nuevoEstatus: Estatus = cliente.estatus === 'activo' ? 'inactivo' : 'activo';
    setClientes(prev => prev.map(c => c.idUsuario === id ? { ...c, estatus: nuevoEstatus } : c));
    try {
      await api.patch(`/clientes/${id}`, { estatus: nuevoEstatus });
    } catch {
      // revertir si falla
      setClientes(prev => prev.map(c => c.idUsuario === id ? { ...c, estatus: cliente.estatus } : c));
      setError('No se pudo actualizar el estatus del cliente.');
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">Clientes</h1>
          <p className="text-[color:var(--ink2)] text-sm mt-0.5">{clientes.filter(c => c.estatus === 'activo').length} activos · {clientes.length} totales</p>
        </div>
        <button onClick={() => { setForm({ nombre: '', apellidos: '', correo: '', telefono: '', fechaNacimiento: '', direccion: '', estatus: 'activo' }); setModal(true); }}
          className="flex items-center gap-2 bg-[color:var(--accent)] hover:brightness-95 text-[color:var(--ink)] px-4 py-2 rounded-xl text-sm font-bold transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo cliente
        </button>
      </div>

      <DataState loading={loading} error={error} onRetry={load} empty={!loading && !error && clientes.length === 0} emptyMessage="Sin clientes registrados todavía">
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
                      ? <img src={c.avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-[color:var(--line)]" />
                      : <div className="w-8 h-8 rounded-full bg-[color:var(--avatar)] flex items-center justify-center text-[color:var(--ink)] text-xs font-bold">{c.nombre[0]}{c.apellidos[0]}</div>
                    }
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">{c.nombre} {c.apellidos}</p>
                      <p className="text-xs text-[color:var(--ink3)]">{c.correo}</p>
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
                if (!c.membresia) return <span className="text-[color:var(--ink3)] text-sm">Sin membresía</span>;
                return (
                  <div>
                    <p className="text-sm font-medium text-[color:var(--ink)] capitalize">{c.membresia.tipo}</p>
                    <p className="text-xs text-[color:var(--ink3)]">Vence {c.membresia.fechaFin}</p>
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
                  className="p-1.5 rounded-lg text-[color:var(--ink3)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)] transition-colors" title="Ver expediente">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                <button onClick={() => toggleEstatus(c.idUsuario)}
                  className={`p-1.5 rounded-lg transition-colors ${c.estatus === 'activo' ? 'text-[color:var(--ink3)] hover:text-[color:var(--bad)] hover:bg-[color:var(--bad-bg)]' : 'text-[color:var(--ink3)] hover:text-[color:var(--ok)] hover:bg-[color:var(--ok-bg)]'}`}>
                  {c.estatus === 'activo'
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                </button>
              </div>
            );
          }}
        />
      </DataState>

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
        <div className="flex gap-3 mt-6 pt-4 border-t border-[color:var(--line)]">
          <button onClick={() => setModal(false)} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)]">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[color:var(--dark)] hover:bg-[color:var(--dark2)] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
            {saving ? 'Guardando...' : 'Registrar cliente'}
          </button>
        </div>
      </Modal>
    </div>
  );
}