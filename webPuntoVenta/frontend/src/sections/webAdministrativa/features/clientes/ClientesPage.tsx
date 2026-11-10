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
  telefono?: string;
  codigoAcceso?: string;
  estatus: 'activo' | 'inactivo';
  // "AAAA-MM-DD"
  fechaNacimiento?: string | null;
  edad?: number | null;
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
}

const FORM_VACIO: ClienteForm = {
  nombre: '',
  apellidos: '',
  correo: '',
  telefono: '',
  fechaNacimiento: '',
};

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fecha de hoy "AAAA-MM-DD" en la hora local del navegador.
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Devuelve el mensaje de error o null si la fecha es válida.
function errorFecha(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'La fecha de nacimiento es obligatoria.';
  const [y, m, d] = valor.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  if (f.getFullYear() !== y || f.getMonth() !== m - 1 || f.getDate() !== d) {
    return 'La fecha de nacimiento no es válida.';
  }
  const hoy = hoyISO();
  if (valor > hoy) return 'La fecha de nacimiento no puede ser futura.';
  if (Number(hoy.slice(0, 4)) - y > 120) return 'La fecha de nacimiento no es válida.';
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
    });
    setFormError(null);
    setModal(true);
  };

  // Se usa la fila que devuelve el servidor para no perder la búsqueda/página de la tabla.
  // La UI no cambia si el servidor rechaza el cambio.
  const save = async () => {
    if (guardando) return;
    setFormError(null);
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
      if (editando) {
        const cliente = await api.patch<ClienteMongo>(`/clientes/${editando.idUsuario}`, cuerpo);
        setClientes(lista => lista.map(c => c.idUsuario === cliente.idUsuario ? { ...c, ...cliente } : c));
      } else {
        const cliente = await api.post<ClienteMongo>('/clientes', cuerpo);
        setClientes(lista => [cliente, ...lista]);
      }
      setAccionError(null);
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
                    <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] text-xs font-bold">{ini}</div>
                    <div>
                      <p className="font-medium text-gray-800">{c.nombre} {c.apellidos}</p>
                      <p className="text-xs text-gray-400">{c.correo || 'Sin correo'}</p>
                    </div>
                  </div>
                );
              }
            },
            { key: 'telefono', header: 'Telefono' },
            {
              key: 'fechaNacimiento', header: 'Cumpleaños',
              render: row => {
                const c = row as unknown as ClienteMongo;
                const texto = formatearFecha(c.fechaNacimiento);
                return texto
                  ? (
                    <div>
                      <p className="text-gray-700">{texto}</p>
                      {typeof c.edad === 'number' && <p className="text-xs text-gray-400">{c.edad} años</p>}
                    </div>
                  )
                  : <span className="text-gray-400">Sin registrar</span>;
              }
            },
            {
              key: 'membresia', header: 'Membresías compradas',
              render: row => <MembresiasCliente compras={comprasDe(row as unknown as ClienteMongo)} />
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
          <InputField label="Fecha de nacimiento" type="date" required max={hoyISO()} value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} />
          <InputField label="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <p className="col-span-2 text-sm text-gray-600">Para dar de baja o reactivar a un cliente usa el botón de la tabla. Las membresías se consultan en la tabla y no se modifican desde este formulario.</p>
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