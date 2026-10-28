import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField, TextareaField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api, mensajeDeError } from '../../lib/api';
import type { Usuario, Estatus, Formacion, DocumentoFormacion } from '../../types';

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

// Capacitación o certificación dentro del formulario
interface FormacionForm { nombre: string; fecha: string; vigencia: string; documento: DocumentoFormacion | null }
const FORMACION_VACIA: FormacionForm = { nombre: '', fecha: '', vigencia: '', documento: null };
const aForm = (l?: Formacion[]): FormacionForm[] =>
  (l ?? []).map(f => ({ nombre: f.nombre, fecha: f.fecha ?? '', vigencia: f.vigencia ?? '', documento: f.documento ?? null }));

// Fecha de hoy (local) como AAAA-MM-DD, para limitar el campo de fecha de nacimiento
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FOTO_LADO_MAX = 320; // px; la foto se reduce en el navegador antes de enviarla
const DOC_MAX_BYTES = 500_000; // PDF máximo (el servidor acepta ~500 KB por documento)
const DOC_MAX_CHARS = 700_000;

// Lee una imagen PNG/JPG/WEBP, la reduce a `lado` px como máximo y la devuelve como data URL JPEG
function reducirImagen(archivo: File, lado: number, calidad: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(archivo.type)) {
      reject(new Error('Elige una imagen PNG, JPG o WEBP.'));
      return;
    }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}

const reducirFoto = (archivo: File) => reducirImagen(archivo, FOTO_LADO_MAX, 0.85);

// Documento de una capacitación o certificación: PDF (hasta 500 KB) o imagen (se reduce sola)
async function leerDocumento(archivo: File): Promise<DocumentoFormacion> {
  if (archivo.type === 'application/pdf') {
    if (archivo.size > DOC_MAX_BYTES) {
      throw new Error('El PDF pesa más de 500 KB. Comprímelo o sube una foto del documento.');
    }
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      r.readAsDataURL(archivo);
    });
    return { nombre: archivo.name, data };
  }
  // Imagen: se prueba con calidad/tamaño decrecientes hasta que quepa
  for (const [lado, calidad] of [[1400, 0.8], [1000, 0.7], [800, 0.55]] as const) {
    const data = await reducirImagen(archivo, lado, calidad);
    if (data.length <= DOC_MAX_CHARS) return { nombre: archivo.name, data };
  }
  throw new Error('La imagen es demasiado pesada. Usa una de menor resolución.');
}

function Avatar({ usuario, size = 'w-8 h-8' }: { usuario: Pick<Usuario, 'nombre' | 'apellidos' | 'foto'>; size?: string }) {
  return usuario.foto ? (
    <img src={usuario.foto} alt="" className={`${size} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-[color:var(--avatar)] flex items-center justify-center text-[color:var(--ink)] text-xs font-bold flex-shrink-0`}>
      {usuario.nombre?.[0]}{usuario.apellidos?.[0]}
    </div>
  );
}

const inputMini =
  'w-full px-3 py-2 text-sm text-[color:var(--ink)] border border-[color:var(--line)] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]';

// Lista editable de capacitaciones o certificaciones (nombre, fecha, vigencia opcional y documento)
function ListaFormacion({ titulo, items, onChange, onError }: {
  titulo: string;
  items: FormacionForm[];
  onChange: (items: FormacionForm[]) => void;
  onError: (mensaje: string) => void;
}) {
  const cambiar = (i: number, cambios: Partial<FormacionForm>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...cambios } : it)));

  const subirDocumento = async (i: number, archivo?: File) => {
    if (!archivo) return;
    try {
      cambiar(i, { documento: await leerDocumento(archivo) });
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo cargar el documento.');
    }
  };

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-[color:var(--ink)]">
          {titulo} <span className="text-[color:var(--ink3)] font-normal">(opcional)</span>
        </label>
        <button type="button" onClick={() => onChange([...items, { ...FORMACION_VACIA }])}
          className="text-xs font-medium text-[color:var(--ink)] hover:underline">+ Agregar</button>
      </div>
      {items.length === 0 && <p className="text-xs text-[color:var(--ink3)]">Sin registros todavía</p>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="bg-white border border-[color:var(--line)] rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input value={it.nombre} onChange={e => cambiar(i, { nombre: e.target.value })} placeholder={`Nombre de la ${titulo.toLowerCase().replace(/s$/, '')}`}
                className={inputMini} />
              <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} title="Quitar"
                className="text-[color:var(--ink3)] hover:text-[color:var(--bad)] text-xl leading-none px-1">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-[color:var(--ink2)] space-y-1">
                <span>Fecha</span>
                <input type="date" max={hoy()} value={it.fecha} onChange={e => cambiar(i, { fecha: e.target.value })} className={inputMini} />
              </label>
              <label className="block text-xs text-[color:var(--ink2)] space-y-1">
                <span>Vigencia (si tiene)</span>
                <input type="date" min={it.fecha || undefined} value={it.vigencia} onChange={e => cambiar(i, { vigencia: e.target.value })} className={inputMini} />
              </label>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="cursor-pointer font-medium text-[color:var(--ink)] hover:underline">
                {it.documento ? 'Cambiar documento' : 'Subir documento'}
                <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; subirDocumento(i, f); }} />
              </label>
              {it.documento ? (
                <>
                  {it.documento.data
                    ? <a href={it.documento.data} download={it.documento.nombre} className="text-[color:var(--info)] hover:underline truncate">{it.documento.nombre}</a>
                    : <span className="text-[color:var(--ink2)] truncate">{it.documento.nombre}</span>}
                  <button type="button" onClick={() => cambiar(i, { documento: null })} className="text-[color:var(--ink3)] hover:text-[color:var(--bad)]">Quitar</button>
                </>
              ) : (
                <span className="text-[color:var(--ink3)]">PDF (máx. 500 KB), PNG, JPG o WEBP</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FormUsuario {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  fechaNacimiento: string;
  rol: PlatformRole | '';
  estatus: Estatus;
  password: string;
  confirmarPassword: string;
  especialidad: string;
  turnoEntrada: string;
  turnoSalida: string;
  foto: string;
  // Perfil de entrenador
  resumen: string;
  capacitaciones: FormacionForm[];
  certificaciones: FormacionForm[];
}

const FORM_VACIO: FormUsuario = {
  nombre: '', apellidos: '', correo: '', telefono: '', fechaNacimiento: '', rol: '', estatus: 'activo',
  password: '', confirmarPassword: '', especialidad: '', turnoEntrada: '', turnoSalida: '',
  foto: '', resumen: '', capacitaciones: [], certificaciones: [],
};

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [filter, setFilter] = useState<FilterRole>('todos');
  const [modal, setModal] = useState<{ open: boolean; editing?: Usuario }>({ open: false });
  const [form, setForm] = useState<FormUsuario>(FORM_VACIO);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Usuario | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Usuario[]>('/usuarios');
      setUsuarios(data);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudieron cargar los usuarios.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'todos' ? usuarios : usuarios.filter(u => u.rol === filter);

  const openNew = () => {
    setForm(FORM_VACIO);
    setFormError('');
    setModal({ open: true });
  };
  const openEdit = async (resumido: Usuario) => {
    // El listado no trae el contenido de los documentos; para entrenadores se pide el perfil completo
    let u = resumido;
    if (resumido.rol === 'entrenador') {
      try {
        u = await api.get<Usuario>(`/usuarios/${resumido.idUsuario}`);
      } catch (err) {
        setError(mensajeDeError(err, 'No se pudo cargar el usuario.'));
        return;
      }
    }
    setForm({
      nombre: u.nombre, apellidos: u.apellidos, correo: u.correo, telefono: u.telefono ?? '', fechaNacimiento: u.fechaNacimiento ?? '',
      rol: u.rol as PlatformRole, estatus: u.estatus,
      password: '', confirmarPassword: '', especialidad: u.especialidad ?? '', turnoEntrada: u.turnoEntrada ?? '', turnoSalida: u.turnoSalida ?? '',
      foto: u.foto ?? '', resumen: u.resumen ?? '',
      capacitaciones: aForm(u.capacitaciones), certificaciones: aForm(u.certificaciones),
    });
    setFormError('');
    setModal({ open: true, editing: u });
  };

  const save = async () => {
    if (!form.nombre.trim() || !form.apellidos.trim() || !form.correo.trim() || !form.rol) {
      setFormError('Nombre(s), apellido(s), correo y rol son obligatorios.');
      return;
    }
    if (!form.fechaNacimiento) {
      setFormError('La fecha de nacimiento es obligatoria.');
      return;
    }
    if (form.fechaNacimiento > hoy()) {
      setFormError('La fecha de nacimiento no puede ser futura.');
      return;
    }
    if (!/^\+?\d{10,15}$/.test(form.telefono.replace(/[\s\-().]/g, ''))) {
      setFormError('El celular debe tener entre 10 y 15 dígitos.');
      return;
    }
    if (!modal.editing && form.password.length < 8) {
      setFormError('La contraseña es obligatoria y debe tener al menos 8 caracteres.');
      return;
    }
    if (modal.editing && form.password && form.password.length < 8) {
      setFormError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (form.password !== form.confirmarPassword) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }

    // Solo cuentan las filas con nombre; cada una necesita fecha y documento (la vigencia es opcional)
    const aApi = (l: FormacionForm[]) => l.filter(f => f.nombre.trim()).map(f => ({ ...f, nombre: f.nombre.trim() }));
    if (form.rol === 'entrenador') {
      for (const [titulo, lista] of [['capacitación', form.capacitaciones], ['certificación', form.certificaciones]] as const) {
        const incompleta = aApi(lista).find(f => !f.fecha || !f.documento);
        if (incompleta) {
          setFormError(`La ${titulo} "${incompleta.nombre}" necesita fecha y documento.`);
          return;
        }
      }
    }

    // La contraseña vacía al editar significa "no cambiarla".
    // El perfil profesional (resumen, capacitaciones, certificaciones) solo se manda a entrenadores.
    const { password, confirmarPassword, resumen, capacitaciones, certificaciones, ...resto } = form;
    const payload = {
      ...resto,
      ...(password ? { password, confirmarPassword } : {}),
      ...(form.rol === 'entrenador'
        ? { resumen, capacitaciones: aApi(capacitaciones), certificaciones: aApi(certificaciones) }
        : {}),
    };

    setSaving(true);
    setFormError('');
    try {
      if (modal.editing) {
        const actualizado = await api.patch<Usuario>(`/usuarios/${modal.editing.idUsuario}`, payload);
        setUsuarios(prev => prev.map(u => u.idUsuario === actualizado.idUsuario ? actualizado : u));
      } else {
        const nuevo = await api.post<Usuario>('/usuarios', payload);
        setUsuarios(prev => [...prev, nuevo]);
      }
      setModal({ open: false });
    } catch (err) {
      setFormError(mensajeDeError(err, modal.editing ? 'No se pudo actualizar el usuario.' : 'No se pudo crear el usuario.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEstatus = async (u: Usuario) => {
    const nuevoEstatus: Estatus = u.estatus === 'activo' ? 'inactivo' : 'activo';
    setUsuarios(prev => prev.map(x => x.idUsuario === u.idUsuario ? { ...x, estatus: nuevoEstatus } : x));
    setConfirmDelete(null);
    try {
      await api.patch(`/usuarios/${u.idUsuario}`, { estatus: nuevoEstatus });
    } catch (err) {
      setUsuarios(prev => prev.map(x => x.idUsuario === u.idUsuario ? { ...x, estatus: u.estatus } : x));
      setError(mensajeDeError(err, 'No se pudo actualizar el estatus del usuario.'));
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">Usuarios de la Plataforma</h1>
          <p className="text-[color:var(--ink2)] text-sm mt-0.5">{usuarios.filter(u => u.estatus === 'activo').length} activos de {usuarios.length} totales</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[color:var(--accent)] hover:brightness-95 text-[color:var(--ink)] px-4 py-2 rounded-xl text-sm font-bold transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo usuario
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {filterTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${filter === tab.value ? 'bg-[color:var(--dark)] text-white border-[color:var(--dark)]' : 'bg-white text-[color:var(--ink)] border-[color:var(--line)] hover:border-[color:var(--ink3)]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <DataState loading={loading} error={error} onRetry={load} empty={!loading && !error && filtered.length === 0} emptyMessage="Sin usuarios registrados todavía">
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
                    <Avatar usuario={u} />
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">{u.nombre} {u.apellidos}</p>
                      <p className="text-xs text-[color:var(--ink3)]">{u.correo}</p>
                    </div>
                  </div>
                );
              }
            },
            { key: 'telefono', header: 'Celular' },
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
                <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-[color:var(--ink3)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)] transition-colors" title="Editar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => setConfirmDelete(u)} className={`p-1.5 rounded-lg transition-colors ${u.estatus === 'activo' ? 'text-[color:var(--ink3)] hover:text-[color:var(--bad)] hover:bg-[color:var(--bad-bg)]' : 'text-[color:var(--ink3)] hover:text-[color:var(--ok)] hover:bg-[color:var(--ok-bg)]'}`} title={u.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}>
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
          {/* Foto (todos los usuarios) */}
          <div className="col-span-2 flex items-center gap-4">
            <Avatar usuario={{ nombre: form.nombre, apellidos: form.apellidos, foto: form.foto }} size="w-16 h-16" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[color:var(--ink)]">Foto</label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer text-xs font-medium text-[color:var(--ink)] hover:underline">
                  {form.foto ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={async e => {
                      const archivo = e.target.files?.[0];
                      e.target.value = '';
                      if (!archivo) return;
                      try {
                        const foto = await reducirFoto(archivo);
                        setForm(f => ({ ...f, foto }));
                        setFormError('');
                      } catch (err) {
                        setFormError(err instanceof Error ? err.message : 'No se pudo cargar la foto.');
                      }
                    }} />
                </label>
                {form.foto && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, foto: '' }))} className="text-xs text-[color:var(--ink3)] hover:text-[color:var(--bad)]">Quitar</button>
                )}
              </div>
              <p className="text-xs text-[color:var(--ink3)]">PNG, JPG o WEBP. Se reduce automáticamente.</p>
            </div>
          </div>

          <InputField label="Nombre(s)" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <InputField label="Apellido(s)" required value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} />
          <InputField label="Fecha de nacimiento" required type="date" max={hoy()} value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} />
          <InputField label="Celular" required type="tel" inputMode="tel" placeholder="10 dígitos" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <InputField label="Correo electrónico" required type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="col-span-2" />
          <p className="col-span-2 -mt-2 text-xs text-[color:var(--ink3)]">Con este correo el usuario inicia sesión.</p>
          <InputField
            label={modal.editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            required={!modal.editing}
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
          <InputField
            label="Confirmar contraseña"
            required={!modal.editing || !!form.password}
            type="password"
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            value={form.confirmarPassword}
            onChange={e => setForm(f => ({ ...f, confirmarPassword: e.target.value }))}
            error={form.confirmarPassword && form.password !== form.confirmarPassword ? 'Las contraseñas no coinciden' : undefined}
          />
          <SelectField label="Rol" required value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value as PlatformRole }))} options={roleOptions} />
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          {form.rol && form.rol !== 'administrador' && (
            <>
              {form.rol === 'entrenador' && (
                <InputField label="Especialidad" value={form.especialidad} onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))} className="col-span-2" />
              )}
              <InputField label="Entrada del turno" type="time" value={form.turnoEntrada} onChange={e => setForm(f => ({ ...f, turnoEntrada: e.target.value }))} />
              <InputField label="Salida del turno" type="time" value={form.turnoSalida} onChange={e => setForm(f => ({ ...f, turnoSalida: e.target.value }))} />
            </>
          )}

          {form.rol === 'entrenador' && (
            <>
              <div className="col-span-2">
                <TextareaField label="Breve resumen de formación o historia" value={form.resumen} onChange={v => setForm(f => ({ ...f, resumen: v }))} rows={4} />
              </div>
              <ListaFormacion titulo="Capacitaciones" items={form.capacitaciones} onChange={capacitaciones => setForm(f => ({ ...f, capacitaciones }))} onError={setFormError} />
              <ListaFormacion titulo="Certificaciones" items={form.certificaciones} onChange={certificaciones => setForm(f => ({ ...f, certificaciones }))} onError={setFormError} />
            </>
          )}
        </div>
        {formError && (
          <p role="alert" className="mt-4 text-sm text-[color:var(--bad)] bg-[color:var(--bad-bg)] border border-[color:var(--bad-bg)] px-3 py-2 rounded-xl">{formError}</p>
        )}
        <div className="flex gap-3 mt-6 pt-4 border-t border-[color:var(--line)]">
          <button onClick={() => setModal({ open: false })} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)] transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[color:var(--dark)] hover:bg-[color:var(--dark2)] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
            {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={confirmDelete?.estatus === 'activo' ? 'Dar de baja usuario' : 'Reactivar usuario'} size="sm">
        <p className="text-[color:var(--ink2)] text-sm">
          {confirmDelete?.estatus === 'activo'
            ? `¿Estás seguro de dar de baja a ${confirmDelete?.nombre} ${confirmDelete?.apellidos}? El usuario no podrá acceder al sistema.`
            : `¿Reactivar la cuenta de ${confirmDelete?.nombre} ${confirmDelete?.apellidos}?`
          }
        </p>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)] transition-colors">Cancelar</button>
          <button onClick={() => confirmDelete && toggleEstatus(confirmDelete)}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${confirmDelete?.estatus === 'activo' ? 'bg-[color:var(--bad)] hover:brightness-95' : 'bg-[color:var(--dark)] hover:bg-[color:var(--dark2)]'}`}>
            {confirmDelete?.estatus === 'activo' ? 'Dar de baja' : 'Reactivar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}