import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { mockHorarios as initial, mockClases, mockUsuarios } from '../../data/mock';
import type { HorarioClase, Estatus } from '../../types';

const claseOptions = mockClases.filter(c => c.estatus === 'activo').map(c => ({ value: c.idClase, label: c.nombre }));
const entrenadorOptions = mockUsuarios.filter(u => u.rol === 'entrenador' && u.estatus === 'activo').map(u => ({ value: u.idUsuario, label: `${u.nombre} ${u.apellidos}` }));
const salonOptions = [{ value: 'Sala A', label: 'Sala A' }, { value: 'Sala B', label: 'Sala B' }, { value: 'Sala Principal', label: 'Sala Principal' }, { value: 'Sala Outdoor', label: 'Sala Outdoor' }];

export function HorariosPage() {
  const [horarios, setHorarios] = useState<HorarioClase[]>(initial);
  const [modal, setModal] = useState<{ open: boolean; editing?: HorarioClase }>({ open: false });
  const [form, setForm] = useState({ idClase: '', entrenadorId: '', fecha: '', horaInicio: '', horaFin: '', capacidadTotal: '15', salon: 'Sala A', estatus: 'activo' as Estatus });
  const [dateFilter, setDateFilter] = useState('');

  const filtered = dateFilter ? horarios.filter(h => h.fecha === dateFilter) : horarios;

  const openNew = () => {
    setForm({ idClase: '', entrenadorId: '', fecha: '', horaInicio: '', horaFin: '', capacidadTotal: '15', salon: 'Sala A', estatus: 'activo' });
    setModal({ open: true });
  };

  const save = () => {
    if (!form.idClase || !form.fecha) return;
    const clase = mockClases.find(c => c.idClase === form.idClase);
    const ent = mockUsuarios.find(u => u.idUsuario === form.entrenadorId);
    if (modal.editing) {
      setHorarios(prev => prev.map(h => h.idHorario === modal.editing!.idHorario ? {
        ...h, ...form, nombreClase: clase?.nombre ?? h.nombreClase,
        nombreEntrenador: ent ? `${ent.nombre} ${ent.apellidos}` : h.nombreEntrenador,
        capacidadTotal: Number(form.capacidadTotal), capacidadDisponible: Number(form.capacidadTotal)
      } : h));
    } else {
      const nh: HorarioClase = {
        idHorario: `h${Date.now()}`, idClase: form.idClase,
        nombreClase: clase?.nombre ?? '', entrenadorId: form.entrenadorId,
        nombreEntrenador: ent ? `${ent.nombre} ${ent.apellidos}` : '',
        fecha: form.fecha, horaInicio: form.horaInicio, horaFin: form.horaFin,
        capacidadTotal: Number(form.capacidadTotal), capacidadDisponible: Number(form.capacidadTotal),
        estatus: form.estatus, salon: form.salon
      };
      setHorarios(prev => [...prev, nh]);
    }
    setModal({ open: false });
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Horarios de Clases</h1>
          <p className="text-slate-500 text-sm mt-0.5">{horarios.length} horarios programados</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          {dateFilter && <button onClick={() => setDateFilter('')} className="text-sm text-slate-500 hover:text-slate-700">Limpiar</button>}
          <button onClick={openNew} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo horario
          </button>
        </div>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        searchKeys={['nombreClase', 'nombreEntrenador', 'salon'] as never[]}
        columns={[
          {
            key: 'fecha', header: 'Fecha / Hora',
            render: row => {
              const h = row as unknown as HorarioClase;
              return (
                <div>
                  <p className="font-medium text-slate-800">{h.fecha}</p>
                  <p className="text-xs text-slate-400">{h.horaInicio} — {h.horaFin}</p>
                </div>
              );
            }
          },
          {
            key: 'nombreClase', header: 'Clase',
            render: row => {
              const h = row as unknown as HorarioClase;
              const clase = mockClases.find(c => c.idClase === h.idClase);
              return (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: clase?.color ?? '#94a3b8' }} />
                  <span className="font-medium text-slate-800">{h.nombreClase}</span>
                </div>
              );
            }
          },
          { key: 'nombreEntrenador', header: 'Entrenador' },
          { key: 'salon', header: 'Sala' },
          {
            key: 'capacidad', header: 'Ocupación',
            render: row => {
              const h = row as unknown as HorarioClase;
              const ocupados = h.capacidadTotal - h.capacidadDisponible;
              const pct = Math.round((ocupados / h.capacidadTotal) * 100);
              return (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-slate-100 rounded-full">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981' }} />
                  </div>
                  <span className="text-xs text-slate-500">{ocupados}/{h.capacidadTotal}</span>
                </div>
              );
            }
          },
          {
            key: 'estatus', header: 'Estatus',
            render: row => <Badge variant={(row as unknown as HorarioClase).estatus} />
          },
        ]}
        actions={row => {
          const h = row as unknown as HorarioClase;
          return (
            <button onClick={() => { setForm({ idClase: h.idClase, entrenadorId: h.entrenadorId, fecha: h.fecha, horaInicio: h.horaInicio, horaFin: h.horaFin, capacidadTotal: String(h.capacidadTotal), salon: h.salon, estatus: h.estatus }); setModal({ open: true, editing: h }); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          );
        }}
      />

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar horario' : 'Nuevo horario'}>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Clase" required value={form.idClase} onChange={e => setForm(f => ({ ...f, idClase: e.target.value }))} options={claseOptions} className="col-span-2" />
          <SelectField label="Entrenador" required value={form.entrenadorId} onChange={e => setForm(f => ({ ...f, entrenadorId: e.target.value }))} options={entrenadorOptions} className="col-span-2" />
          <InputField label="Fecha" required type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <SelectField label="Sala" value={form.salon} onChange={e => setForm(f => ({ ...f, salon: e.target.value }))} options={salonOptions} />
          <InputField label="Hora inicio" required type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
          <InputField label="Hora fin" required type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} />
          <InputField label="Capacidad" required type="number" min="1" value={form.capacidadTotal} onChange={e => setForm(f => ({ ...f, capacidadTotal: e.target.value }))} />
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal({ open: false })} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">Cancelar</button>
          <button onClick={save} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">
            {modal.editing ? 'Guardar cambios' : 'Crear horario'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
