import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataState } from '../../components/DataState';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { apiCobro, ApiError } from '../../lib/api';

// Un cliente tal como lo devuelve GET /cobro/api/clientes. Estos registros
// viven en la tabla webcobro.clientes (PostgreSQL): son los mismos socios que
// usa el módulo de Cobro (front desk) para reservar clases.
interface SocioCobro {
  id: number;
  nombre: string;
  membresia: string;
  telefono: string;
  correo: string | null;
  activo: boolean;
  vigencia_hasta: string | null;
}

interface SocioForm {
  nombre: string;
  correo: string;
  telefono: string;
  membresia: string;
  activo: boolean;
  vigencia_hasta: string;
}

const FORM_VACIO: SocioForm = {
  nombre: '',
  correo: '',
  telefono: '',
  membresia: 'Básica',
  activo: true,
  vigencia_hasta: '',
};

// La vigencia se compara en fecha local (YYYY-MM-DD) para no depender de la
// zona horaria del navegador.
function hoyLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Estatus calculado igual que en cobro: inactivo manual o vigencia vencida.
function estatusDe(s: SocioCobro): 'activo' | 'inactivo' {
  if (s.activo === false) return 'inactivo';
  if (s.vigencia_hasta && s.vigencia_hasta < hoyLocal()) return 'inactivo';
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

  // Carga los socios registrados en el módulo de cobro.
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClientes(await apiCobro.get<SocioCobro[]>('/clientes'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
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
      membresia: s.membresia,
      activo: s.activo !== false,
      vigencia_hasta: s.vigencia_hasta ?? '',
    });
    setFormError(null);
    setModal(true);
  };

  // Guarda un cliente nuevo o los cambios de uno existente. Al terminar, la
  // lista se recarga del backend para mostrar lo que realmente quedó guardado.
  const save = async () => {
    setFormError(null);
    if (form.nombre.trim().length < 3) {
      setFormError('El nombre del cliente es obligatorio (mínimo 3 letras).');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        nombre: form.nombre.trim(),
        correo: form.correo.trim() || undefined,
        telefono: form.telefono.trim(),
        membresia: form.membresia,
        activo: form.activo,
        // '' = sin vencimiento (no expira).
        vigencia_hasta: form.vigencia_hasta || null,
      };
      if (editando) {
        await apiCobro.patch(`/clientes/${editando.id}`, cuerpo);
      } else {
        await apiCobro.post('/clientes', cuerpo);
      }
      setModal(false);
      await cargar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  const toggleEstatus = async (s: SocioCobro) => {
    try {
      await apiCobro.patch(`/clientes/${s.id}`, { activo: !(s.activo !== false) });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estatus.');
    }
  };

  // Borrar es definitivo en la base de datos. Si el socio tiene reservaciones
  // o pagos, el backend lo rechaza (409) para no dejar historial huérfano.
  const eliminar = async (s: SocioCobro) => {
    const confirmado = window.confirm(`¿Eliminar a ${s.nombre}? Esta acción no se puede deshacer.`);
    if (!confirmado) return;
    try {
      await apiCobro.del(`/clientes/${s.id}`);
      await cargar();
    } catch (err) {
      const mensaje = err instanceof ApiError && err.status === 409
        ? 'No se puede eliminar: el cliente tiene reservaciones o pagos registrados.'
        : err instanceof Error ? err.message : 'No se pudo eliminar el cliente.';
      setError(mensaje);
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
          <button onClick={() => void cargar()} disabled={loading}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Actualizar
          </button>
          <button onClick={abrirNuevo}
            className="flex items-center gap-2 bg-[#111827] hover:bg-[#6B7280] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo cliente
          </button>
        </div>
      </div>

      <DataState loading={loading} error={error} empty={clientes.length === 0}
        emptyMessage="No hay clientes registrados" onRetry={() => void cargar()}>
        <DataTable
          data={clientes as unknown as Record<string, unknown>[]}
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
              key: 'membresia', header: 'Membresia',
              render: row => {
                const s = row as unknown as SocioCobro;
                const premium = s.membresia === 'Premium';
                const cls = premium ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-200';
                return (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${cls}`}>
                    {s.membresia}
                  </span>
                );
              }
            },
            {
              key: 'vigencia_hasta', header: 'Vigencia',
              render: row => {
                const s = row as unknown as SocioCobro;
                return <span className="text-gray-600">{s.vigencia_hasta || 'Sin vencimiento'}</span>;
              }
            },
            {
              key: 'activo', header: 'Estatus',
              render: row => <Badge variant={estatusDe(row as unknown as SocioCobro)} />
            },
          ]}
          actions={row => {
            const s = row as unknown as SocioCobro;
            const est = estatusDe(s);
            const clsToggle = est === 'activo' ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-[#6B7280] hover:bg-[#F3F4F6]';
            return (
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => abrirEditar(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" title="Editar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => void toggleEstatus(s)} className={`p-1.5 rounded-lg transition-colors ${clsToggle}`} title={est === 'activo' ? 'Desactivar' : 'Activar'}>
                  {est === 'activo'
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                </button>
                <button onClick={() => void eliminar(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            );
          }}
        />
        </DataState>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar cliente' : 'Nuevo cliente'}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nombre completo" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="col-span-2" placeholder="Ej. Juan Perez" />
          <InputField label="Correo" type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} className="col-span-2" placeholder="Opcional, debe ser unico" />
          <InputField label="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <SelectField label="Membresia" required value={form.membresia} onChange={e => setForm(f => ({ ...f, membresia: e.target.value }))} options={[{ value: 'Básica', label: 'Basica (paga tarifa)' }, { value: 'Premium', label: 'Premium (no paga)' }]} />
          <InputField label="Vigencia de membresia" type="date" value={form.vigencia_hasta} onChange={e => setForm(f => ({ ...f, vigencia_hasta: e.target.value }))} />
          <SelectField label="Estatus" value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
        </div>
        {formError && <p className="text-xs text-red-500 mt-3">{formError}</p>}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={() => void save()} disabled={guardando} className="flex-1 px-4 py-2.5 bg-[#111827] hover:bg-[#6B7280] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cliente'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
