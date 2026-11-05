import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { apiCobro, ApiError } from '../../lib/api';
import { MembresiasCliente, type MembresiaComprada } from './MembresiasCliente';

// Un cliente tal como lo devuelve GET /cobro/api/clientes. Estos registros
// viven en la tabla webcobro.clientes (PostgreSQL): son los mismos socios que
// usa el módulo de Cobro (front desk) para reservar clases.
interface SocioCobro {
  id: number;
  nombre: string;
  membresiasCompradas?: MembresiaComprada[];
  telefono: string;
  correo: string | null;
  activo: boolean;
}

interface SocioForm {
  nombre: string;
  correo: string;
  telefono: string;
  activo: boolean;
}

const FORM_VACIO: SocioForm = {
  nombre: '',
  correo: '',
  telefono: '',
  activo: true,
};

// La baja del cliente es independiente de las vigencias de sus compras.
function estatusDe(s: SocioCobro): 'activo' | 'inactivo' {
  if (s.activo === false) return 'inactivo';
  return 'activo';
}

export function ClientesPage() {
  const [clientes, setClientes] = useState<SocioCobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  // Socio en edición (null = registrando uno nuevo).
  const [editando, setEditando] = useState<SocioCobro | null>(null);
  const [form, setForm] = useState<SocioForm>(FORM_VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [accionError, setAccionError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [actualizando, setActualizando] = useState(false);

  // Carga los socios registrados en el módulo de cobro.
  const cargar = useCallback(async () => {
    setActualizando(true);
    setError(null);
    try {
      setClientes(await apiCobro.get<SocioCobro[]>('/clientes'));
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

  const abrirEditar = (s: SocioCobro) => {
    setEditando(s);
    setForm({
      nombre: s.nombre,
      correo: s.correo ?? '',
      telefono: s.telefono ?? '',
      activo: s.activo !== false,
    });
    setFormError(null);
    setModal(true);
  };

  // Usar la fila devuelta por PostgreSQL evita desmontar la tabla y perder
  // su búsqueda/página. No se actualiza la UI si el servidor rechaza el cambio.
  const save = async () => {
    if (guardando) return;
    setFormError(null);
    if (form.nombre.trim().length < 3) {
      setFormError('El nombre del cliente es obligatorio (mínimo 3 letras).');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        telefono: form.telefono.trim(),
        activo: form.activo,
      };
      if (editando) {
        const { cliente } = await apiCobro.patch<{ cliente: SocioCobro }>(`/clientes/${editando.id}`, cuerpo);
        setClientes(lista => lista.map(s => s.id === cliente.id ? { ...s, ...cliente } : s));
      } else {
        const { cliente } = await apiCobro.post<{ cliente: SocioCobro }>('/clientes', cuerpo);
        setClientes(lista => [...lista, cliente]);
      }
      setAccionError(null);
      setModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  const toggleEstatus = async (s: SocioCobro) => {
    if (procesando !== null) return;
    setAccionError(null);
    setProcesando(s.id);
    try {
      const { cliente } = await apiCobro.patch<{ cliente: SocioCobro }>(`/clientes/${s.id}`, { activo: s.activo === false });
      setClientes(lista => lista.map(c => c.id === cliente.id ? { ...c, ...cliente } : c));
    } catch (err) {
      setAccionError(err instanceof Error ? err.message : 'No se pudo cambiar el estatus.');
    } finally {
      setProcesando(null);
    }
  };

  // Borrar es definitivo en la base de datos. Si el socio tiene reservaciones
  // o pagos, el backend lo rechaza (409) para no dejar historial huérfano.
  const eliminar = async (s: SocioCobro) => {
    if (procesando !== null) return;
    const confirmado = window.confirm(`¿Eliminar a ${s.nombre}? Esta acción no se puede deshacer.`);
    if (!confirmado) return;
    setAccionError(null);
    setProcesando(s.id);
    try {
      await apiCobro.del(`/clientes/${s.id}`);
      setClientes(lista => lista.filter(c => c.id !== s.id));
    } catch (err) {
      const mensaje = err instanceof ApiError && err.status === 409
        ? 'No se puede eliminar: el cliente tiene historial asociado. Usa Desactivar para darlo de baja sin borrar su historial.'
        : err instanceof Error ? err.message : 'No se pudo eliminar el cliente.';
      setAccionError(mensaje);
    } finally {
      setProcesando(null);
    }
  };

  const activos = clientes.filter(c => estatusDe(c) === 'activo').length;

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
                const s = row as unknown as SocioCobro;
                const ini = s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] text-xs font-bold">{ini}</div>
                    <div>
                      <p className="font-medium text-gray-800">{s.nombre}</p>
                      <p className="text-xs text-gray-400">{s.correo || 'Sin correo'}</p>
                    </div>
                  </div>
                );
              }
            },
            { key: 'telefono', header: 'Telefono' },
            {
              key: 'membresiasCompradas', header: 'Membresías compradas',
              render: row => <MembresiasCliente compras={(row as unknown as SocioCobro).membresiasCompradas} />
            },
            {
              key: 'activo', header: 'Estatus',
              render: row => <Badge variant={estatusDe(row as unknown as SocioCobro)} />
            },
          ]}
          actions={row => {
            const s = row as unknown as SocioCobro;
            const activoManual = s.activo !== false;
            return (
              <div className="flex items-center gap-2 justify-end">
                <button type="button" disabled={procesando !== null || actualizando} onClick={() => abrirEditar(s)} className="rx-icon-btn" title="Editar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button type="button" disabled={procesando !== null || actualizando} onClick={() => void toggleEstatus(s)} className={`rx-icon-btn ${activoManual ? 'rx-btn--danger' : 'rx-btn--dark'}`} title={activoManual ? 'Desactivar (dar de baja)' : 'Activar (no renueva la membresía)'}>
                  {activoManual
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                </button>
                <button type="button" disabled={procesando !== null || actualizando} onClick={() => void eliminar(s)} className="rx-icon-btn rx-btn--danger" title="Eliminar definitivamente">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            );
          }}
        />
        </DataState>

      <Modal open={modal} onClose={() => { if (!guardando) setModal(false); }} title={editando ? 'Editar cliente' : 'Nuevo cliente'}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nombre completo" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="col-span-2" placeholder="Ej. Juan Perez" />
          <InputField label="Correo" type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="col-span-2" placeholder="Opcional, debe ser unico" />
          <InputField label="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <p className="col-span-2 text-sm text-gray-600">Las membresías se venden desde Recepción. Las compras y sus vigencias se consultan en la tabla de clientes y no se modifican desde este formulario.</p>
          <SelectField label="Estatus" value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
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
