import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { SelectField } from '../../components/FormField';
import { mockReservaciones as initial, mockClientes, mockHorarios } from '../../data/mock';
import type { Reservacion, ReservaEstatus } from '../../types';

type FilterEstatus = 'todos' | ReservaEstatus;

const filterTabs: { value: FilterEstatus; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'cancelada', label: 'Canceladas' },
];

export function ReservacionesPage() {
  const [reservaciones, setReservaciones] = useState<Reservacion[]>(initial);
  const [filter, setFilter] = useState<FilterEstatus>('todos');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ idCliente: '', idHorario: '' });

  const filtered = filter === 'todos' ? reservaciones : reservaciones.filter(r => r.estatus === filter);

  const confirmarAsistencia = (id: string) => {
    setReservaciones(prev => prev.map(r => r.idReservacion === id ? { ...r, asistenciaConfirmada: true, estatus: 'confirmada' } : r));
  };

  const cambiarEstatus = (id: string, estatus: ReservaEstatus) => {
    setReservaciones(prev => prev.map(r => r.idReservacion === id ? { ...r, estatus } : r));
  };

  const save = () => {
    if (!form.idCliente || !form.idHorario) return;
    const cliente = mockClientes.find(c => c.idUsuario === form.idCliente);
    const horario = mockHorarios.find(h => h.idHorario === form.idHorario);
    if (!cliente || !horario) return;
    const nr: Reservacion = {
      idReservacion: `r${Date.now()}`, idCliente: form.idCliente,
      nombreCliente: `${cliente.nombre} ${cliente.apellidos}`,
      idHorario: form.idHorario, clase: horario.nombreClase,
      entrenador: horario.nombreEntrenador,
      horaClase: `${horario.horaInicio} - ${horario.horaFin}`,
      fechaReservacion: horario.fecha, estatus: 'pendiente', asistenciaConfirmada: false,
    };
    setReservaciones(prev => [...prev, nr]);
    setModal(false);
  };

  const clienteOptions = mockClientes.filter(c => c.estatus === 'activo').map(c => ({ value: c.idUsuario, label: `${c.nombre} ${c.apellidos}` }));
  const horarioOptions = mockHorarios.filter(h => h.estatus === 'activo' && h.capacidadDisponible > 0).map(h => ({ value: h.idHorario, label: `${h.nombreClase} · ${h.fecha} ${h.horaInicio}` }));

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Reservaciones</h1>
          <p className="text-slate-500 text-sm mt-0.5">{reservaciones.filter(r => r.estatus === 'confirmada').length} confirmadas · {reservaciones.filter(r => r.estatus === 'pendiente').length} pendientes</p>
        </div>
        <button onClick={() => { setForm({ idCliente: '', idHorario: '' }); setModal(true); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva reservación
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
        searchKeys={['nombreCliente', 'clase'] as never[]}
        columns={[
          {
            key: 'nombreCliente', header: 'Cliente',
            render: row => {
              const r = row as unknown as Reservacion;
              return (
                <div>
                  <p className="font-medium text-slate-800">{r.nombreCliente}</p>
                  <p className="text-xs text-slate-400">Reserv. {r.fechaReservacion}</p>
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
                  <p className="font-medium text-slate-800">{r.clase}</p>
                  <p className="text-xs text-slate-400">{r.entrenador} · {r.horaClase}</p>
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
                ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Confirmada</span>
                : <span className="text-xs text-slate-400">Pendiente</span>;
            }
          },
        ]}
        actions={row => {
          const r = row as unknown as Reservacion;
          return (
            <div className="flex items-center gap-1 justify-end">
              {!r.asistenciaConfirmada && r.estatus !== 'cancelada' && (
                <button onClick={() => confirmarAsistencia(r.idReservacion)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                  Confirmar asistencia
                </button>
              )}
              {r.estatus === 'pendiente' && (
                <button onClick={() => cambiarEstatus(r.idReservacion, 'confirmada')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                  Confirmar
                </button>
              )}
              {r.estatus !== 'cancelada' && (
                <button onClick={() => cambiarEstatus(r.idReservacion, 'cancelada')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                  Cancelar
                </button>
              )}
            </div>
          );
        }}
      />

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva reservación">
        <div className="space-y-4">
          <SelectField label="Cliente" required value={form.idCliente} onChange={e => setForm(f => ({ ...f, idCliente: e.target.value }))} options={clienteOptions} />
          <SelectField label="Horario de clase" required value={form.idHorario} onChange={e => setForm(f => ({ ...f, idHorario: e.target.value }))} options={horarioOptions} />
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
          <button onClick={save} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">Crear reservación</button>
        </div>
      </Modal>
    </div>
  );
}
