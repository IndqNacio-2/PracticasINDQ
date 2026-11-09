import { useCallback, useEffect, useRef, useState } from 'react';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { Icon } from '../../components/Icon';
import { reducirFoto } from '../../lib/fotoUsuario';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Usuario, Estatus, Formacion } from '../../types';

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

const MAX_RESUMEN = 1000;
const MAX_DOC_BYTES = 1_000_000; // 1 MB por documento
const TIPOS_DOC = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

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
  foto: string;
  // Datos del coach (solo se usan cuando rol === 'entrenador')
  resumen: string;
  capacitaciones: Formacion[];
  certificaciones: Formacion[];
}

const EMPTY_FORM: UsuarioForm = {
  nombre: '', apellidos: '', correo: '', telefono: '', codigoAcceso: '', rol: '', estatus: 'activo', password: '', foto: '',
  resumen: '', capacitaciones: [], certificaciones: [],
};

const FORMACION_VACIA: Formacion = { nombre: '', institucion: '', fecha: '', documento: '' };

const leerDocumento = (archivo: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsDataURL(archivo);
  });

// Lista editable de capacitaciones o certificaciones.
function FormacionEditor({ titulo, descripcion, items, onChange, onError, disabled }: {
  titulo: string;
  descripcion: string;
  items: Formacion[];
  onChange: (items: Formacion[]) => void;
  onError: (mensaje: string | null) => void;
  disabled: boolean;
}) {
  const actualizar = (i: number, cambios: Partial<Formacion>) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, ...cambios } : item)));

  const subirDocumento = async (i: number, archivo?: File) => {
    if (!archivo) return;
    if (!TIPOS_DOC.includes(archivo.type)) {
      onError('El documento debe ser PDF, JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > MAX_DOC_BYTES) {
      onError('Cada documento debe pesar menos de 1 MB.');
      return;
    }
    try {
      onError(null);
      actualizar(i, { documento: await leerDocumento(archivo) });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    }
  };

  return (
    <div className="col-span-2 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{titulo}</p>
        <p className="text-xs text-gray-500">{descripcion}</p>
      </div>

      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nombre" required value={item.nombre} className="col-span-2"
              onChange={e => actualizar(i, { nombre: e.target.value })} />
            <InputField label="Institución" value={item.institucion ?? ''}
              onChange={e => actualizar(i, { institucion: e.target.value })} />
            <InputField label="Fecha" type="date" value={item.fecha ?? ''}
              onChange={e => actualizar(i, { fecha: e.target.value })} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className={`rx-btn rx-btn--outline ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
              {item.documento ? 'Cambiar documento' : 'Adjuntar documento'}
              <input type="file" className="hidden" disabled={disabled}
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={e => { const archivo = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void subirDocumento(i, archivo); }} />
            </label>
            {item.documento && (
              <>
                <span className="text-xs text-green-600">Documento adjunto</span>
                <button type="button" disabled={disabled} className="rx-btn rx-btn--outline"
                  onClick={() => actualizar(i, { documento: '' })}>Quitar documento</button>
              </>
            )}
            <button type="button" disabled={disabled} className="rx-btn rx-btn--danger ml-auto"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}>Eliminar</button>
          </div>
        </div>
      ))}

      <button type="button" disabled={disabled} className="rx-btn rx-btn--outline"
        onClick={() => onChange([...items, { ...FORMACION_VACIA }])}>
        + Agregar {titulo.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  );
}

// Quita filas totalmente vacías y avisa si alguna tiene datos pero no nombre.
function limpiarFormaciones(lista: Formacion[], etiqueta: string): { ok: true; valor: Formacion[] } | { ok: false; error: string } {
  const valor: Formacion[] = [];
  for (const f of lista) {
    const nombre = f.nombre.trim();
    const tieneOtros = Boolean(f.institucion?.trim() || f.fecha || f.documento);
    if (!nombre && !tieneOtros) continue;
    if (!nombre) return { ok: false, error: `${etiqueta}: cada elemento necesita un nombre.` };
    valor.push({
      nombre,
      institucion: f.institucion?.trim() ?? '',
      fecha: f.fecha ?? '',
      documento: f.documento ?? '',
    });
  }
  return { ok: true, valor };
}

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
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const lecturaFoto = useRef(0);
  const inputFoto = useRef<HTMLInputElement>(null);
  useEffect(() => () => { lecturaFoto.current += 1; }, []);

  const cerrarModal = () => {
    if (saving) return;
    lecturaFoto.current += 1;
    setProcesandoFoto(false);
    setModal({ open: false });
  };

  const seleccionarFoto = async (archivo?: File) => {
    if (!archivo) return;
    const lectura = ++lecturaFoto.current;
    setProcesandoFoto(true);
    setFormError(null);
    try {
      const foto = await reducirFoto(archivo);
      if (lectura === lecturaFoto.current) setForm(f => ({ ...f, foto }));
    } catch (e) {
      if (lectura === lecturaFoto.current) setFormError(e instanceof Error ? e.message : 'No se pudo leer la foto.');
    } finally {
      if (lectura === lecturaFoto.current) setProcesandoFoto(false);
    }
  };
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
    setForm({
      nombre: u.nombre, apellidos: u.apellidos, correo: u.correo, telefono: u.telefono, codigoAcceso: u.codigoAcceso,
      rol: u.rol as PlatformRole, estatus: u.estatus, password: '', foto: u.foto || '',
      resumen: u.resumen ?? '',
      capacitaciones: u.capacitaciones ?? [],
      certificaciones: u.certificaciones ?? [],
    });
    setFormError(null);
    setModal({ open: true, editing: u });
  };

  const esEntrenador = form.rol === 'entrenador';

  // Crea (POST) o actualiza (PATCH) en el backend. La contraseña solo se envía
  // cuando se escribió una (al crear es obligatoria; al editar es opcional).
  const save = async () => {
    if (saving || procesandoFoto) return;
    if (!form.nombre || !form.apellidos || !form.correo || !form.rol || !form.codigoAcceso) {
      setFormError('Nombre, apellidos, correo, código de acceso y rol son obligatorios.');
      return;
    }
    if (!modal.editing && form.password.length < 3) {
      setFormError('La contraseña es obligatoria (mínimo 3 caracteres).');
      return;
    }

    // Datos del coach: solo se envían si el rol es entrenador.
    let perfil: Record<string, unknown> = {};
    if (esEntrenador) {
      if (form.resumen.length > MAX_RESUMEN) {
        setFormError(`El resumen admite máximo ${MAX_RESUMEN} caracteres.`);
        return;
      }
      const cap = limpiarFormaciones(form.capacitaciones, 'Capacitaciones');
      if (!cap.ok) { setFormError(cap.error); return; }
      const cert = limpiarFormaciones(form.certificaciones, 'Certificaciones');
      if (!cert.ok) { setFormError(cert.error); return; }
      perfil = { resumen: form.resumen.trim(), capacitaciones: cap.valor, certificaciones: cert.valor };
    }

    setSaving(true);
    setFormError(null);
    try {
      const base: Record<string, unknown> = {
        nombre: form.nombre, apellidos: form.apellidos, correo: form.correo,
        telefono: form.telefono, codigoAcceso: form.codigoAcceso, rol: form.rol, estatus: form.estatus,
        foto: form.foto,
        ...perfil,
      };
      if (modal.editing) {
        // Solo manda password si el usuario escribió una nueva.
        if (form.password) base.password = form.password;
        await api.patch(`/usuarios/${modal.editing.idUsuario}`, base);
      } else {
        await api.post('/usuarios', { ...base, password: form.password });
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
          <button onClick={openNew} className="rx-btn rx-btn--accent">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo usuario
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {filterTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`rx-tab ${filter === tab.value ? 'rx-tab--active' : ''}`}>
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
                    <UsuarioAvatar foto={u.foto} nombre={u.nombre} apellidos={u.apellidos} className="w-8 h-8 rounded-full bg-[#F3F4F6] text-[#6B7280] text-xs font-bold" />
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
                <button onClick={() => openEdit(u)} className="rx-icon-btn" title="Editar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => setConfirmToggle(u)} className={`rx-icon-btn ${u.estatus === 'activo' ? 'rx-btn--danger' : 'rx-btn--dark'}`} title={u.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}>
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

      <Modal open={modal.open} onClose={cerrarModal} title={modal.editing ? 'Editar usuario' : 'Nuevo usuario'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 p-4">
            <UsuarioAvatar foto={form.foto} nombre={form.nombre} apellidos={form.apellidos} className="w-16 h-16 rounded-full bg-gray-100 text-gray-500 text-lg font-bold" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800">Foto de perfil</p>
              <p className="text-xs text-gray-500 mt-1">Opcional · JPG, PNG o WEBP · máximo 10 MB. Se reduce automáticamente.</p>
              <input ref={inputFoto} aria-label="Seleccionar foto de perfil" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving || procesandoFoto}
                className="hidden"
                onChange={e => { const archivo = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void seleccionarFoto(archivo); }} />
              <button type="button" disabled={saving || procesandoFoto} className="rx-btn rx-btn--outline mt-3"
                onClick={() => inputFoto.current?.click()}>
                <Icon name="photo_camera" size={20} />
                {procesandoFoto ? 'Procesando foto...' : form.foto ? 'Cambiar foto' : 'Agregar foto'}
              </button>
              {procesandoFoto && <p role="status" className="mt-2 text-xs text-gray-500">Procesando foto...</p>}
              {form.foto && <button type="button" disabled={saving || procesandoFoto} className="rx-btn rx-btn--outline mt-2" onClick={() => setForm(f => ({ ...f, foto: '' }))}>Quitar foto</button>}
            </div>
          </div>
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

          {/* Datos del coach: solo aparecen cuando el rol es Entrenador. Se muestran en la app móvil. */}
          {esEntrenador && (
            <>
              <div className="col-span-2 border-t border-gray-100 pt-4">
                <p className="text-base font-semibold text-gray-900">Datos del coach</p>
                <p className="text-xs text-gray-500">Esta información se muestra en la aplicación móvil.</p>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-800 mb-1" htmlFor="resumen-coach">
                  Resumen de formación o historia
                </label>
                <textarea
                  id="resumen-coach"
                  rows={4}
                  maxLength={MAX_RESUMEN}
                  disabled={saving}
                  value={form.resumen}
                  onChange={e => setForm(f => ({ ...f, resumen: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Cuenta brevemente su formación, trayectoria o historia como coach."
                />
                <p className="text-xs text-gray-400 text-right">{form.resumen.length}/{MAX_RESUMEN}</p>
              </div>

              <FormacionEditor
                titulo="Capacitaciones"
                descripcion="Cursos y talleres que ha tomado."
                items={form.capacitaciones}
                onChange={capacitaciones => setForm(f => ({ ...f, capacitaciones }))}
                onError={setFormError}
                disabled={saving}
              />
              <FormacionEditor
                titulo="Certificaciones"
                descripcion="Certificaciones oficiales que respaldan al coach."
                items={form.certificaciones}
                onChange={certificaciones => setForm(f => ({ ...f, certificaciones }))}
                onError={setFormError}
                disabled={saving}
              />
            </>
          )}
        </div>
        {formError && <p role="alert" className="mt-3 text-sm text-red-500">{formError}</p>}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={cerrarModal} disabled={saving} className="rx-btn rx-btn--outline flex-1">Cancelar</button>
          <button onClick={save} disabled={saving || procesandoFoto} className="rx-btn rx-btn--dark flex-1">
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
          <button onClick={() => setConfirmToggle(null)} className="rx-btn rx-btn--outline flex-1">Cancelar</button>
          <button onClick={() => confirmToggle && toggleEstatus(confirmToggle)}
            className={`rx-btn flex-1 ${confirmToggle?.estatus === 'activo' ? 'rx-btn--danger' : 'rx-btn--dark'}`}>
            {confirmToggle?.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}