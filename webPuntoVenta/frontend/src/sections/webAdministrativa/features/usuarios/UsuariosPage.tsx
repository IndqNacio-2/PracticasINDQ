import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Usuario, Estatus } from '../../types';

// Roles de PLATAFORMA (staff). "Cliente" no aplica aquí:
// los clientes se gestionan en el módulo Clientes y no inician sesión en esta web.
type PlatformRole = 'administrador' | 'entrenador' | 'recepcion' | 'vendedor';
type FilterRole = 'todos' | PlatformRole;

const roleOptions = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'recepcion', label: 'Recepción' },
  { value: 'vendedor', label: 'Vendedor' },
];

const filterTabs: { value: FilterRole; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'entrenador', label: 'Entrenador' },
  { value: 'recepcion', label: 'Recepción' },
  { value: 'vendedor', label: 'Vendedor' },
];

// Formulario: incluye password (solo al crear; al editar es opcional).
interface UsuarioForm {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  codigoAcceso: string;
  rol: PlatformRole | '';
  estatus: Estatus;
  password: string;
}

const EMPTY_FORM: UsuarioForm = { nombre: '', apellidos: '', correo: '', telefono: '', codigoAcceso: '', rol: '', estatus: 'activo', password: '' };

export function UsuariosPage() {
  // Solo el administrador puede crear o editar usuarios.
  const { hasRole } = useAuth();
  const puedeGestionar = hasRole(['administrador']);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterRole>('todos');
  const [modal, setModal] = useState<{ open: boolean; editing?: Usuario }>({ open: false });
  const [form, setForm] = useState<UsuarioForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<Usuario | null>(null);

  // Carga los usuarios reales desde el backend (MongoDB).
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Usuario[]>('/usuarios');
      setUsuarios(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtered = filter === 'todos' ? usuarios : usuarios.filter(u => u.rol === filter);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModal({ open: true });
  };
  const openEdit = (u: Usuario) => {
    setForm({ nombre: u.nombre, apellidos: u.apellidos, correo: u.correo, telefono: u.telefono, codigoAcceso: u.codigoAcceso, rol: u.rol as PlatformRole, estatus: u.estatus, password: '' });
    setFormError(null);
    setModal({ open: true, editing: u });
  };

  // Crea (POST) o actualiza (PATCH) en el backend. La contraseña solo se envía
  // cuando se escribió una (al crear es obligatoria; al editar es opcional).
  const save = async () => {
    if (!form.nombre || !form.apellidos || !form.correo || !form.rol || !form.codigoAcceso) {
      setFormError('Nombre, apellidos, correo, código de acceso y rol son obligatorios.');
      return;
    }
    if (!modal.editing && form.password.length < 3) {
      setFormError('La contraseña es obligatoria (mínimo 3 caracteres).');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (modal.editing) {
        const body: Record<string, unknown> = {
          nombre: form.nombre, apellidos: form.apellidos, correo: form.correo,
          telefono: form.telefono, codigoAcceso: form.codigoAcceso, rol: form.rol, estatus: form.estatus,
        };
        // Solo manda password si el usuario escribió una nueva.
        if (form.password) body.password = form.password;
        await api.patch(`/usuarios/${modal.editing.idUsuario}`, body);
      } else {
        await api.post('/usuarios', form);
      }
      await cargar();
      setModal({ open: false });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  // Da de baja / reactiva (PATCH del estatus).
  const toggleEstatus = async (u: Usuario) => {
    try {
      await api.patch(`/usuarios/${u.idUsuario}`, { estatus: u.estatus === 'activo' ? 'inactivo' : 'activo' });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estatus.');
    } finally {
      setConfirmToggle(null);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Usuarios de la Plataforma</h1>
          <p className="text-gray-500 text-sm mt-0.5">{usuarios.filter(u => u.estatus === 'activo').length} activos de {usuarios.length} totales</p>
        </div>
        {puedeGestionar && (
          <button onClick={openNew} className="flex items-center gap-2 bg-[#111827] hover:bg-[#6B7280] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo usuario
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {filterTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        emptyMessage="Aún no hay usuarios registrados."
        onRetry={cargar}
      >
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
                  <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] text-xs font-bold flex-shrink-0">
                    {u.nombre[0]}{u.apellidos[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{u.nombre} {u.apellidos}</p>
                    <p className="text-xs text-gray-400">{u.correo}</p>
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
          // Sin permiso (entrenador) no se muestran acciones de edición/baja.
          if (!puedeGestionar) return <span className="text-gray-300 text-xs">Solo lectura</span>;
          return (
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" title="Editar">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button onClick={() => setConfirmToggle(u)} className={`p-1.5 rounded-lg transition-colors ${u.estatus === 'activo' ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-[#6B7280] hover:bg-[#F3F4F6]'}`} title={u.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}>
                {u.estatus === 'activo'
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                }
              </button>
            </div>
          );
        }}
      />
      </DataState>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar usuario' : 'Nuevo usuario'}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nombre" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <InputField label="Apellidos" required value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} />
          <InputField label="Correo electrónico" required type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="col-span-2" />
          <InputField label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <InputField label="Código de Acceso" required value={form.codigoAcceso} onChange={e => setForm(f => ({ ...f, codigoAcceso: e.target.value }))} />
          <SelectField label="Rol" required value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value as PlatformRole }))} options={roleOptions} />
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          {/* Contraseña: obligatoria al crear; al editar, si se deja en blanco no se cambia. */}
          <InputField
            label={modal.editing ? 'Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}
            required={!modal.editing}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="col-span-2"
          />
        </div>
        {formError && <p className="mt-3 text-sm text-red-500">{formError}</p>}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setModal({ open: false })} disabled={saving} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[#111827] hover:bg-[#6B7280] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>}
            {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmToggle} onClose={() => setConfirmToggle(null)} title={confirmToggle?.estatus === 'activo' ? 'Dar de baja usuario' : 'Reactivar usuario'} size="sm">
        <p className="text-gray-600 text-sm">
          {confirmToggle?.estatus === 'activo'
            ? `¿Estás seguro de dar de baja a ${confirmToggle?.nombre} ${confirmToggle?.apellidos}? El usuario no podrá acceder al sistema.`
            : `¿Reactivar la cuenta de ${confirmToggle?.nombre} ${confirmToggle?.apellidos}?`
          }
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setConfirmToggle(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={() => confirmToggle && toggleEstatus(confirmToggle)}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${confirmToggle?.estatus === 'activo' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#111827] hover:bg-[#6B7280]'}`}>
            {confirmToggle?.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}