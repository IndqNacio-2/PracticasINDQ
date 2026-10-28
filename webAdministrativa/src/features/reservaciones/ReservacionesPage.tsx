import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { SelectField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api, mensajeDeError } from '../../lib/api';
import type { Reservacion, ReservaEstatus, Cliente, HorarioClase } from '../../types';

type FilterEstatus = 'todos' | ReservaEstatus;

const filterTabs: { value: FilterEstatus; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'cancelada', label: 'Canceladas' },
];

export function ReservacionesPage() {
  const [reservaciones, setReservaciones] = useState<Reservacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [horarios, setHorarios] = useState<HorarioClase[]>([]);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [filter, setFilter] = useState<FilterEstatus>('todos');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ idCliente: '', idHorario: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, cls, hrs] = await Promise.all([
        api.get<Reservacion[]>('/reservaciones'),
        api.get<Cliente[]>('/clientes'),
        api.get<HorarioClase[]>('/horarios?estatus=activo'),
      ]);
      setReservaciones(data);
      setClientes(cls);
      setHorarios(hrs);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudieron cargar las reservaciones.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'todos' ? reservaciones : reservaciones.filter(r => r.estatus === filter);

  const confirmarAsistencia = async (id: string) => {
    const anterior = reservaciones;
    setReservaciones(prev => prev.map(r => r.idReservacion === id ? { ...r, asistenciaConfirmada: true, estatus: 'confirmada' } : r));
    try {
      await api.patch(`/reservaciones/${id}`, { asistenciaConfirmada: true, estatus: 'confirmada' });
    } catch (err) {
      setReservaciones(anterior);
      setError(mensajeDeError(err, 'No se pudo confirmar la asistencia.'));
    }
  };

  const cambiarEstatus = async (id: string, estatus: ReservaEstatus) => {
    const anterior = reservaciones;
    setReservaciones(prev => prev.map(r => r.idReservacion === id ? { ...r, estatus } : r));
    try {
      await api.patch(`/reservaciones/${id}`, { estatus });
      if (estatus === 'cancelada') recargarHorarios();
    } catch (err) {
      setReservaciones(anterior);
      setError(mensajeDeError(err, 'No se pudo actualizar el estatus de la reservación.'));
    }
  };

  // Crear o cancelar cambia los lugares disponibles; se vuelve a pedir la lista de horarios
  const recargarHorarios = async () => {
    try {
      setHorarios(await api.get<HorarioClase[]>('/horarios?estatus=activo'));
    } catch {
      // si falla, la lista se actualiza en la siguiente carga
    }
  };

  const save = async () => {
    if (!form.idCliente || !form.idHorario) {
      setFormError('Selecciona un cliente y un horario.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      // El servidor arma el nombre del cliente, la clase, el entrenador y las fechas a partir de los ids.
      const nueva = await api.post<Reservacion>('/reservaciones', {
        idCliente: form.idCliente,
        idHorario: form.idHorario,
      });
      setReservaciones(prev => [...prev, nueva]);
      setModal(false);
      recargarHorarios();
    } catch (err) {
      setFormError(mensajeDeError(err, 'No se pudo crear la reservación.'));
    } finally {
      setSaving(false);
    }
  };

  const clienteOptions = clientes
    .filter(c => c.estatus === 'activo')
    .map(c => ({ value: c.idUsuario, label: `${c.nombre} ${c.apellidos}` }));
  const horarioOptions = horarios
    .filter(h => h.estatus === 'activo' && h.capacidadDisponible > 0)
    .map(h => ({ value: h.idHorario, label: `${h.nombreClase} · ${h.fecha} ${h.horaInicio} (${h.capacidadDisponible} lugares)` }));

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">Reservaciones</h1>
          <p className="text-[color:var(--ink2)] text-sm mt-0.5">{reservaciones.filter(r => r.estatus === 'confirmada').length} confirmadas · {reservaciones.filter(r => r.estatus === 'pendiente').length} pendientes</p>
        </div>
        <button onClick={() => { setForm({ idCliente: '', idHorario: '' }); setFormError(''); setModal(true); }}
          className="flex items-center gap-2 bg-[color:var(--accent)] hover:brightness-95 text-[color:var(--ink)] px-4 py-2 rounded-xl text-sm font-bold transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva reservación
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

      <DataState loading={loading} error={error} onRetry={load} empty={!loading && !error && filtered.length === 0} emptyMessage="Sin reservaciones registradas todavía">
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          searchKeys={['nombreCliente', 'clase'] as never[]}
          columns={[
            {
              key: 'nombreCliente', header: 'Cliente',
              render: row => {
                const r = row as unknown as Reservacion;
                return (
                  <div>
                    <p className="font-medium text-[color:var(--ink)]">{r.nombreCliente}</p>
                    <p className="text-xs text-[color:var(--ink3)]">Reserv. {r.fechaReservacion}</p>
                  </div>
                );
              }
            },
            {
              key: 'clase', header: 'Clase',
              render: row => {
                const r = row as unknown as Reservacion;
                return (
                  <div>
                    <p className="font-medium text-[color:var(--ink)]">{r.clase}</p>
                    <p className="text-xs text-[color:var(--ink3)]">{r.fechaClase} · {r.horaClase} · {r.entrenador}</p>
                  </div>
                );
              }
            },
            {
              key: 'estatus', header: 'Estatus',
              render: row => <Badge variant={(row as unknown as Reservacion).estatus} />
            },
            {
              key: 'asistenciaConfirmada', header: 'Asistencia',
              render: row => {
                const r = row as unknown as Reservacion;
                return r.asistenciaConfirmada
                  ? <span className="flex items-center gap-1 text-xs text-[color:var(--ok)] font-medium"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Confirmada</span>
                  : <span className="text-xs text-[color:var(--ink3)]">Pendiente</span>;
              }
            },
          ]}
          actions={row => {
            const r = row as unknown as Reservacion;
            return (
              <div className="flex items-center gap-1 justify-end">
                {!r.asistenciaConfirmada && r.estatus !== 'cancelada' && (
                  <button onClick={() => confirmarAsistencia(r.idReservacion)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-[color:var(--ok-ink)] bg-[color:var(--ok-bg)] hover:brightness-95 transition-colors">
                    Confirmar asistencia
                  </button>
                )}
                {r.estatus === 'pendiente' && (
                  <button onClick={() => cambiarEstatus(r.idReservacion, 'confirmada')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-[color:var(--info)] bg-[color:var(--info-bg)] hover:brightness-95 transition-colors">
                    Confirmar
                  </button>
                )}
                {r.estatus !== 'cancelada' && (
                  <button onClick={() => cambiarEstatus(r.idReservacion, 'cancelada')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-[color:var(--bad)] bg-[color:var(--bad-bg)] hover:brightness-95 transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            );
          }}
        />
      </DataState>

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva reservación">
        <div className="space-y-4">
          <SelectField label="Cliente" required value={form.idCliente} onChange={e => setForm(f => ({ ...f, idCliente: e.target.value }))} options={clienteOptions} />
          <SelectField label="Horario de clase" required value={form.idHorario} onChange={e => setForm(f => ({ ...f, idHorario: e.target.value }))} options={horarioOptions} />
          {formError && (
            <p role="alert" className="text-sm text-[color:var(--bad)] bg-[color:var(--bad-bg)] border border-[color:var(--bad-bg)] px-3 py-2 rounded-xl">{formError}</p>
          )}
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-[color:var(--line)]">
          <button onClick={() => setModal(false)} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)]">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[color:var(--dark)] hover:bg-[color:var(--dark2)] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
            {saving ? 'Guardando...' : 'Crear reservación'}
          </button>
        </div>
      </Modal>
    </div>
  );
}