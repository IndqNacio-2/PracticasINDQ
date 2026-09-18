import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { mockUsuarios as initial } from '../../data/mock';
import type { Usuario, Estatus } from '../../types';

// Roles de PLATAFORMA (staff). "Cliente" no aplica aqui:
// los clientes se gestionan en el modulo Clientes y no inician sesion en esta web.
type PlatformRole = 'administrador' | 'entrenador' | 'recepcion';
type FilterRole = 'todos' | PlatformRole;

const roleOptions = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'recepcion', label: 'Recepción' },
];

const filterTabs: { value: FilterRole; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'recepcion', label: 'Recepción' },
];

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(initial.filter(u => u.rol !== 'cliente'));
  const [filter, setFilter] = useState<FilterRole>('todos');
  const [modal, setModal] = useState<{ open: boolean; editing?: Usuario }>({ open: false });
  const [form, setForm] = useState({ nombre: '', apellidos: '', correo: '', telefono: '', codigoAcceso: '', rol: '' as PlatformRole | '', estatus: 'activo' as Estatus });
  const [confirmDelete, setConfirmDelete] = useState<Usuario | null>(null);

  const filtered = filter === 'todos' ? usuarios : usuarios.filter(u => u.rol === filter);

  const openNew = () => {
    setForm({ nombre: '', apellidos: '', correo: '', telefono: '', codigoAcceso: '', rol: '', estatus: 'activo' });
    setModal({ open: true });
  };
  const openEdit = (u: Usuario) => {
    setForm({ nombre: u.nombre, apellidos: u.apellidos, correo: u.correo, telefono: u.telefono, codigoAcceso: u.codigoAcceso, rol: u.rol as PlatformRole, estatus: u.estatus });
    setModal({ open: true, editing: u });
  };

  const save = () => {
    if (!form.nombre || !form.correo || !form.rol) return;
    if (modal.editing) {
      setUsuarios(prev => prev.map(u => u.idUsuario === modal.editing!.idUsuario ? { ...u, ...form, rol: form.rol as PlatformRole } : u));
    } else {
      const nu: Usuario = { idUsuario: `u${Date.now()}`, nombre: form.nombre, apellidos: form.apellidos, correo: form.correo, telefono: form.telefono, codigoAcceso: form.codigoAcceso, rol: form.rol as PlatformRole, estatus: form.estatus, fechaCreacion: new Date().toISOString().split('T')[0] };
      setUsuarios(prev => [...prev, nu]);
    }
    setModal({ open: false });
  };

  const toggleEstatus = (u: Usuario) => {
    setUsuarios(prev => prev.map(x => x.idUsuario === u.idUsuario ? { ...x, estatus: x.estatus === 'activo' ? 'inactivo' : 'activo' } : x));
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Usuarios de la Plataforma</h1>
          <p className="text-slate-500 text-sm mt-0.5">{usuarios.filter(u => u.estatus === 'activo').length} activos de {usuarios.length} totales</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo usuario
        </button>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {filterTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        searchKeys={['nombre', 'apellidos', 'correo'] as never[]}
        columns={[
          {
            key: 'nombre', header: 'Usuario',
            render: (row) => {
              const u = row as unknown as Usuario;
              return (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                    {u.nombre[0]}{u.apellidos[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{u.nombre} {u.apellidos}</p>
                    <p className="text-xs text-slate-400">{u.correo}</p>
                  </div>
                </div>
              );
            }
          },
          { key: 'telefono', header: 'Teléfono' },
          { key: 'codigoAcceso', header: 'Código' },
          {
            key: 'rol', header: 'Rol',
            render: (row) => <Badge variant={(row as unknown as Usuario).rol} />
          },
          {
            key: 'estatus', header: 'Estatus',
            render: (row) => <Badge variant={(row as unknown as Usuario).estatus} />
          },
          { key: 'fechaCreacion', header: 'Fecha Alta' },
        ]}
        actions={(row) => {
          const u = row as unknown as Usuario;
          return (
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Editar">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button onClick={() => setConfirmDelete(u)} className={`p-1.5 rounded-lg transition-colors ${u.estatus === 'activo' ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={u.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}>
                {u.estatus === 'activo'
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                }
              </button>
            </div>
          );
        }}
      />

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar usuario' : 'Nuevo usuario'}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nombre" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <InputField label="Apellidos" required value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} />
          <InputField label="Correo electrónico" required type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="col-span-2" />
          <InputField label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <InputField label="Código de Acceso" required value={form.codigoAcceso} onChange={e => setForm(f => ({ ...f, codigoAcceso: e.target.value }))} />
          <SelectField label="Rol" required value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value as PlatformRole }))} options={roleOptions} />
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal({ open: false })} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={save} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">
            {modal.editing ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={confirmDelete?.estatus === 'activo' ? 'Dar de baja usuario' : 'Reactivar usuario'} size="sm">
        <p className="text-slate-600 text-sm">
          {confirmDelete?.estatus === 'activo'
            ? `¿Estás seguro de dar de baja a ${confirmDelete?.nombre} ${confirmDelete?.apellidos}? El usuario no podrá acceder al sistema.`
            : `¿Reactivar la cuenta de ${confirmDelete?.nombre} ${confirmDelete?.apellidos}?`
          }
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={() => confirmDelete && toggleEstatus(confirmDelete)}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${confirmDelete?.estatus === 'activo' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {confirmDelete?.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}