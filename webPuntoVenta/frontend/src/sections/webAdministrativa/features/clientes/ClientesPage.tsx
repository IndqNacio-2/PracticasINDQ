import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField } from '../../components/FormField';
import { api } from '../../lib/api';
import { MembresiasCliente, type MembresiaComprada } from './MembresiasCliente';

// Un cliente tal como lo devuelve GET /admin/api/clientes (MongoDB).
// Aquí viven los clientes de la app móvil y los que registra el staff, y de aquí
// salen los correos de cumpleaños.
interface ClienteMongo {
  idUsuario: string;
  nombre: string;
  apellidos: string;
  correo: string;
  // Celular (en la BD el campo sigue llamándose "telefono").
  telefono?: string;
  codigoAcceso?: string;
  estatus: 'activo' | 'inactivo';
  // "AAAA-MM-DD"
  fechaNacimiento?: string | null;
  edad?: number | null;
  perfilSalud?: {
    enfermedades?: string[];
    lesiones?: string[];
  } | null;
  membresia?: {
    idMembresia: string;
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    estatus: string;
  } | null;
}

interface ClienteForm {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  fechaNacimiento: string;
  enfermedades: string[];
  lesiones: string[];
}

const FORM_VACIO: ClienteForm = {
  nombre: '',
  apellidos: '',
  correo: '',
  telefono: '',
  fechaNacimiento: '',
  enfermedades: [],
  lesiones: [],
};

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EDAD_MIN = 12;
const EDAD_MAX = 99;

// Fecha de hoy "AAAA-MM-DD" en la hora local del navegador.
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Edad exacta: compara mes y día para que el cumpleaños cuente el día correcto.
function calcularEdad(iso: string, hoy = hoyISO()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  let edad = hy - y;
  if (hm < m || (hm === m && hd < d)) edad--;
  return edad;
}

// Fecha máxima permitida en el input (la persona cumple 12 años hoy).
function maxNacimiento(): string {
  const [y, m, d] = hoyISO().split('-');
  return `${Number(y) - EDAD_MIN}-${m}-${d}`;
}

// Devuelve el mensaje de error o null si la fecha es válida (edad de 12 a 99 años, ambos incluidos).
function errorFecha(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'La fecha de nacimiento es obligatoria.';
  const [y, m, d] = valor.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  if (f.getFullYear() !== y || f.getMonth() !== m - 1 || f.getDate() !== d) {
    return 'La fecha de nacimiento no es válida.';
  }
  if (valor > hoyISO()) return 'La fecha de nacimiento no puede ser futura.';
  const edad = calcularEdad(valor);
  if (edad < EDAD_MIN) return `El cliente debe tener al menos ${EDAD_MIN} años.`;
  if (edad > EDAD_MAX) return `El cliente no puede tener más de ${EDAD_MAX} años.`;
  return null;
}

// "AAAA-MM-DD" -> "DD/MM/AAAA" sin pasar por Date (evita desfases de zona horaria).
function formatearFecha(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

// Adapta la membresía única del cliente al formato que muestra MembresiasCliente.
function comprasDe(c: ClienteMongo): MembresiaComprada[] {
  const m = c.membresia;
  if (!m) return [];
  return [{ id: m.idMembresia, nombre: `Membresía ${m.tipo}`, fechaInicio: m.fechaInicio, fechaFin: m.fechaFin }];
}

// Campo de lista: se escribe un elemento, se agrega con Enter o con el botón "+" y se quita con la ×.
// Las sugerencias son atajos de un clic (opcionales).
const TONOS = {
  rojo: 'bg-red-50 text-red-700 border-red-100',
  ambar: 'bg-amber-50 text-amber-700 border-amber-100',
} as const;

function ListaEtiquetas({ label, items, onChange, placeholder, sugerencias = [], tono }: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  sugerencias?: string[];
  tono: keyof typeof TONOS;
}) {
  const [texto, setTexto] = useState('');

  const existe = (t: string) => items.some(i => i.toLowerCase() === t.toLowerCase());

  const agregar = (valor = texto) => {
    const t = valor.trim();
    if (!t) return;
    if (!existe(t)) onChange([...items, t]);
    setTexto('');
  };

  const sugeridas = sugerencias.filter(s => !existe(s));

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <span className="text-xs text-gray-400">{items.length === 0 ? 'Opcional' : `${items.length} ${items.length === 1 ? 'agregado' : 'agregados'}`}</span>
      </div>

      <div className="relative">
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          placeholder={placeholder}
          maxLength={60}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-11 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
        <button
          type="button"
          onClick={() => agregar()}
          disabled={!texto.trim()}
          aria-label={`Agregar a ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white transition-opacity disabled:opacity-30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 min-h-[1.75rem]">
        {items.length === 0 && <span className="text-xs text-gray-400">Aún no hay elementos. Escribe uno y presiona Enter.</span>}
        {items.map(i => (
          <span key={i} className={`inline-flex items-center gap-1 rounded-full border py-1 pl-2.5 pr-1.5 text-xs font-medium ${TONOS[tono]}`}>
            {i}
            <button
              type="button"
              aria-label={`Quitar ${i}`}
              onClick={() => onChange(items.filter(x => x !== i))}
              className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
      </div>

      {sugeridas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400">Sugeridas:</span>
          {sugeridas.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => agregar(s)}
              className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-500 hover:border-gray-400 hover:bg-white"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Celda de la tabla: etiquetas en una sola línea (hasta 2) y "+N" si hay más.
// El texto largo se corta con "…" y la lista completa se ve al pasar el cursor.
function CeldaLista({ items = [], tono }: { items?: string[]; tono: keyof typeof TONOS }) {
  if (!items.length) return <span className="text-gray-300">—</span>;
  const visibles = items.slice(0, 2);
  const resto = items.length - visibles.length;
  return (
    <div className="flex items-center gap-1 whitespace-nowrap" title={items.join(', ')}>
      {visibles.map(i => (
        <span key={i} className={`max-w-[8rem] truncate rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONOS[tono]}`}>{i}</span>
      ))}
      {resto > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">+{resto}</span>}
    </div>
  );
}

export function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteMongo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  // Cliente en edición (null = registrando uno nuevo).
  const [editando, setEditando] = useState<ClienteMongo | null>(null);
  const [form, setForm] = useState<ClienteForm>(FORM_VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [accionError, setAccionError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);

  const cargar = useCallback(async () => {
    setActualizando(true);
    setError(null);
    try {
      setClientes(await api.get<ClienteMongo[]>('/clientes'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setFormError(null);
    setModal(true);
  };

  const abrirEditar = (c: ClienteMongo) => {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      apellidos: c.apellidos,
      correo: c.correo ?? '',
      telefono: c.telefono ?? '',
      fechaNacimiento: c.fechaNacimiento ? c.fechaNacimiento.slice(0, 10) : '',
      enfermedades: c.perfilSalud?.enfermedades ?? [],
      lesiones: c.perfilSalud?.lesiones ?? [],
    });
    setFormError(null);
    setModal(true);
  };

  // Se usa la fila que devuelve el servidor para no perder la búsqueda/página de la tabla.
  // La UI no cambia si el servidor rechaza el cambio.
  const save = async () => {
    if (guardando) return;
    setFormError(null);
    setAccionError(null);
    if (form.nombre.trim().length < 2) {
      setFormError('El nombre es obligatorio (mínimo 2 letras).');
      return;
    }
    if (form.apellidos.trim().length < 2) {
      setFormError('Los apellidos son obligatorios (mínimo 2 letras).');
      return;
    }
    const correo = form.correo.trim().toLowerCase();
    if (!correo) {
      setFormError('El correo es obligatorio: ahí se enviará la felicitación de cumpleaños.');
      return;
    }
    if (!REGEX_CORREO.test(correo)) {
      setFormError('Escribe un correo válido.');
      return;
    }
    const errFecha = errorFecha(form.fechaNacimiento);
    if (errFecha) {
      setFormError(errFecha);
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        correo,
        telefono: form.telefono.trim(),
        fechaNacimiento: form.fechaNacimiento,
      };
      let cliente = editando
        ? await api.patch<ClienteMongo>(`/clientes/${editando.idUsuario}`, cuerpo)
        : await api.post<ClienteMongo>('/clientes', cuerpo);

      // El perfil de salud se guarda aparte (PATCH /:id/salud): solo enfermedades y lesiones.
      try {
        cliente = await api.patch<ClienteMongo>(`/clientes/${cliente.idUsuario}/salud`, {
          enfermedades: form.enfermedades,
          lesiones: form.lesiones,
        });
      } catch {
        // El cliente ya quedó guardado; solo falló el perfil de salud.
        setAccionError('El cliente se guardó, pero no se pudo guardar su perfil de salud. Ábrelo con Editar y vuelve a intentarlo.');
      }

      const guardado = cliente;
      setClientes(lista => editando
        ? lista.map(c => c.idUsuario === guardado.idUsuario ? { ...c, ...guardado } : c)
        : [guardado, ...lista]);
      setModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  // Baja lógica: el cliente conserva su historial y se cierran sus sesiones en la app.
  // Los clientes no se eliminan.
  const toggleEstatus = async (c: ClienteMongo) => {
    if (procesando !== null) return;
    setAccionError(null);
    setProcesando(c.idUsuario);
    try {
      const accion = c.estatus === 'activo' ? 'baja' : 'reactivar';
      const cliente = await api.patch<ClienteMongo>(`/clientes/${c.idUsuario}/${accion}`);
      setClientes(lista => lista.map(x => x.idUsuario === cliente.idUsuario ? { ...x, ...cliente } : x));
    } catch (err) {
      setAccionError(err instanceof Error ? err.message : 'No se pudo cambiar el estatus.');
    } finally {
      setProcesando(null);
    }
  };

  const activos = clientes.filter(c => c.estatus === 'activo').length;

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Clientes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{activos} {activos === 1 ? 'cliente activo' : 'clientes activos'} · {clientes.length} {clientes.length === 1 ? 'cliente en total' : 'clientes en total'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void cargar()} disabled={loading || actualizando || procesando !== null || guardando}
            className="rx-btn rx-btn--outline">
            <svg className={`w-4 h-4 ${actualizando ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Actualizar
          </button>
          <button onClick={abrirNuevo}
            className="rx-btn rx-btn--accent">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo cliente
          </button>
        </div>
      </div>

      {(accionError || (!loading && error)) && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {accionError || error}
        </div>
      )}
      <DataState loading={loading}>
        <DataTable
          data={clientes as unknown as Record<string, unknown>[]}
          emptyMessage="No hay clientes que mostrar"
          columns={[
            {
              key: 'nombre', header: 'Cliente',
              render: row => {
                const c = row as unknown as ClienteMongo;
                const ini = `${c.nombre?.[0] ?? ''}${c.apellidos?.[0] ?? ''}`.toUpperCase();
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] text-xs font-bold">{ini}</div>
                    <div>
                      <p className="font-medium text-gray-800 whitespace-nowrap">{c.nombre} {c.apellidos}</p>
                      <p className="max-w-[16rem] truncate text-xs text-gray-400" title={c.correo}>{c.correo || 'Sin correo'}</p>
                    </div>
                  </div>
                );
              }
            },
            {
              key: 'telefono', header: 'Celular',
              render: row => {
                const t = (row as unknown as ClienteMongo).telefono;
                return t ? <span className="whitespace-nowrap text-gray-700">{t}</span> : <span className="text-gray-300">—</span>;
              }
            },
            {
              key: 'fechaNacimiento', header: 'Cumpleaños',
              render: row => {
                const c = row as unknown as ClienteMongo;
                const texto = formatearFecha(c.fechaNacimiento);
                return texto
                  ? (
                    <div className="whitespace-nowrap">
                      <p className="text-gray-700">{texto}</p>
                      {typeof c.edad === 'number' && <p className="text-xs text-gray-400">{c.edad} años</p>}
                    </div>
                  )
                  : <span className="text-gray-300">—</span>;
              }
            },
            {
              key: 'enfermedades', header: 'Enfermedades',
              render: row => <CeldaLista tono="rojo" items={(row as unknown as ClienteMongo).perfilSalud?.enfermedades} />
            },
            {
              key: 'lesiones', header: 'Lesiones',
              render: row => <CeldaLista tono="ambar" items={(row as unknown as ClienteMongo).perfilSalud?.lesiones} />
            },
            {
              key: 'membresia', header: 'Membresía',
              render: row => {
                const compras = comprasDe(row as unknown as ClienteMongo);
                return compras.length
                  ? <MembresiasCliente compras={compras} />
                  : <span className="whitespace-nowrap text-gray-400">Sin membresía</span>;
              }
            },
            {
              key: 'estatus', header: 'Estatus',
              render: row => <Badge variant={(row as unknown as ClienteMongo).estatus} />
            },
          ]}
          actions={row => {
            const c = row as unknown as ClienteMongo;
            const activo = c.estatus === 'activo';
            return (
              <div className="flex items-center gap-2 justify-end">
                <button type="button" disabled={procesando !== null || actualizando} onClick={() => abrirEditar(c)} className="rx-icon-btn" title="Editar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button type="button" disabled={procesando !== null || actualizando} onClick={() => void toggleEstatus(c)} className={`rx-icon-btn ${activo ? 'rx-btn--danger' : 'rx-btn--dark'}`} title={activo ? 'Dar de baja (conserva su historial)' : 'Reactivar'}>
                  {activo
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                </button>
              </div>
            );
          }}
        />
      </DataState>

      <Modal open={modal} onClose={() => { if (!guardando) setModal(false); }} title={editando ? 'Editar cliente' : 'Nuevo cliente'}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nombre" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Juan" />
          <InputField label="Apellidos" required value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} placeholder="Ej. Perez Lopez" />
          <InputField label="Correo" type="email" required value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="col-span-2" placeholder="Debe ser unico. Se usa para la felicitacion de cumpleaños" />
          <InputField label="Fecha de nacimiento" type="date" required max={maxNacimiento()} value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} />
          <InputField label="Celular" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <div className="col-span-2 pt-2">
            <h4 className="text-sm font-semibold text-gray-900 mb-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>Perfil de salud</h4>
            <p className="text-xs text-gray-500 mb-3">Solo se registran enfermedades y lesiones. Las dos listas son opcionales.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ListaEtiquetas label="Enfermedades" tono="rojo" items={form.enfermedades} placeholder="Ej. Asma"
                sugerencias={['Asma', 'Diabetes', 'Hipertensión']}
                onChange={enfermedades => setForm(f => ({ ...f, enfermedades }))} />
              <ListaEtiquetas label="Lesiones" tono="ambar" items={form.lesiones} placeholder="Ej. Esguince de tobillo"
                sugerencias={['Rodilla', 'Hombro', 'Espalda baja']}
                onChange={lesiones => setForm(f => ({ ...f, lesiones }))} />
            </div>
          </div>
          <p className="col-span-2 text-sm text-gray-600">El cliente debe tener entre {EDAD_MIN} y {EDAD_MAX} años. Para dar de baja o reactivar a un cliente usa el botón de la tabla. Las membresías se consultan en la tabla y no se modifican desde este formulario.</p>
        </div>
        {formError && <p className="text-xs text-red-500 mt-3">{formError}</p>}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button disabled={guardando} onClick={() => setModal(false)} className="rx-btn rx-btn--outline flex-1">Cancelar</button>
          <button onClick={() => void save()} disabled={guardando} className="rx-btn rx-btn--dark flex-1">
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cliente'}
          </button>
        </div>
      </Modal>
    </div>
  );
}