import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api, mensajeDeError } from '../../lib/api';
import type { HorarioClase, Estatus, Clase, Usuario } from '../../types';

const salonOptions = [{ value: 'Sala A', label: 'Sala A' }, { value: 'Sala B', label: 'Sala B' }, { value: 'Sala Principal', label: 'Sala Principal' }, { value: 'Sala Outdoor', label: 'Sala Outdoor' }];

export function HorariosPage() {
  const [horarios, setHorarios] = useState<HorarioClase[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [entrenadores, setEntrenadores] = useState<Usuario[]>([]);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState<{ open: boolean; editing?: HorarioClase }>({ open: false });
  const [form, setForm] = useState({ idClase: '', entrenadorId: '', fecha: '', horaInicio: '', horaFin: '', capacidadTotal: '15', salon: 'Sala A', estatus: 'activo' as Estatus });
  const [dateFilter, setDateFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, cls, ents] = await Promise.all([
        api.get<HorarioClase[]>('/horarios'),
        api.get<Clase[]>('/clases'),
        api.get<Usuario[]>('/usuarios?rol=entrenador&estatus=activo'),
      ]);
      setHorarios(data);
      setClases(cls);
      setEntrenadores(ents);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudieron cargar los horarios.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const claseOptions = clases.filter(c => c.estatus === 'activo').map(c => ({ value: c.idClase, label: c.nombre }));
  const entrenadorOptions = entrenadores.map(u => ({ value: u.idUsuario, label: `${u.nombre} ${u.apellidos}` }));

  // Al elegir una clase nueva se propone su capacidad por defecto (se puede cambiar)
  const elegirClase = (idClase: string) => {
    const clase = clases.find(c => c.idClase === idClase);
    setForm(f => ({
      ...f,
      idClase,
      entrenadorId: !modal.editing && !f.entrenadorId && clase?.entrenadorId ? clase.entrenadorId : f.entrenadorId,
      capacidadTotal: !modal.editing && clase ? String(clase.capacidad) : f.capacidadTotal,
    }));
  };

  const filtered = dateFilter ? horarios.filter(h => h.fecha === dateFilter) : horarios;

  const openNew = () => {
    setForm({ idClase: '', entrenadorId: '', fecha: '', horaInicio: '', horaFin: '', capacidadTotal: '15', salon: 'Sala A', estatus: 'activo' });
    setFormError('');
    setModal({ open: true });
  };

  const save = async () => {
    if (!form.idClase || !form.entrenadorId || !form.fecha || !form.horaInicio || !form.horaFin) {
      setFormError('Clase, entrenador, fecha y horas son obligatorios.');
      return;
    }
    if (form.horaFin <= form.horaInicio) {
      setFormError('La hora fin debe ser mayor a la hora de inicio.');
      return;
    }
    const capacidadTotal = Number(form.capacidadTotal);
    if (!Number.isInteger(capacidadTotal) || capacidadTotal < 1) {
      setFormError('La capacidad debe ser un entero mayor a 0.');
      return;
    }

    // Solo se mandan ids y datos del horario: el servidor pone el nombre de la clase y del entrenador.
    const payload = {
      idClase: form.idClase,
      entrenadorId: form.entrenadorId,
      fecha: form.fecha,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
      capacidadTotal,
      salon: form.salon,
      estatus: form.estatus,
    };

    setSaving(true);
    setFormError('');
    try {
      if (modal.editing) {
        const actualizado = await api.patch<HorarioClase>(`/horarios/${modal.editing.idHorario}`, payload);
        setHorarios(prev => prev.map(h => h.idHorario === actualizado.idHorario ? actualizado : h));
      } else {
        const nuevo = await api.post<HorarioClase>('/horarios', payload);
        setHorarios(prev => [...prev, nuevo]);
      }
      setModal({ open: false });
    } catch (err) {
      setFormError(mensajeDeError(err, modal.editing ? 'No se pudo actualizar el horario.' : 'No se pudo crear el horario.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">Horarios de Clases</h1>
          <p className="text-[color:var(--ink2)] text-sm mt-0.5">{horarios.length} horarios programados</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[color:var(--line)] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ink)]" />
          {dateFilter && <button onClick={() => setDateFilter('')} className="text-sm text-[color:var(--ink2)] hover:text-[color:var(--ink)]">Limpiar</button>}
          <button onClick={openNew} className="flex items-center gap-2 bg-[color:var(--accent)] hover:brightness-95 text-[color:var(--ink)] px-4 py-2 rounded-xl text-sm font-bold transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo horario
          </button>
        </div>
      </div>

      <DataState loading={loading} error={error} onRetry={load} empty={!loading && !error && filtered.length === 0} emptyMessage="Sin horarios registrados todavía">
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
                    <p className="font-medium text-[color:var(--ink)]">{h.fecha}</p>
                    <p className="text-xs text-[color:var(--ink3)]">{h.horaInicio} — {h.horaFin}</p>
                  </div>
                );
              }
            },
            {
              key: 'nombreClase', header: 'Clase',
              render: row => {
                const h = row as unknown as HorarioClase;
                const clase = clases.find(c => c.idClase === h.idClase);
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: clase?.color ?? '#9298A3' }} />
                    <span className="font-medium text-[color:var(--ink)]">{h.nombreClase}</span>
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
                const pct = h.capacidadTotal > 0 ? Math.round((ocupados / h.capacidadTotal) * 100) : 0;
                return (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-[color:var(--soft)] rounded-full">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? '#D64545' : pct >= 70 ? '#E8803A' : '#2E9E5B' }} />
                    </div>
                    <span className="text-xs text-[color:var(--ink2)]">{ocupados}/{h.capacidadTotal}</span>
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
              <button onClick={() => { setForm({ idClase: h.idClase, entrenadorId: h.entrenadorId, fecha: h.fecha, horaInicio: h.horaInicio, horaFin: h.horaFin, capacidadTotal: String(h.capacidadTotal), salon: h.salon, estatus: h.estatus }); setFormError(''); setModal({ open: true, editing: h }); }}
                className="p-1.5 rounded-lg text-[color:var(--ink3)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            );
          }}
        />
      </DataState>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar horario' : 'Nuevo horario'}>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Clase" required value={form.idClase} onChange={e => elegirClase(e.target.value)} options={claseOptions} className="col-span-2" />
          <SelectField label="Entrenador" required value={form.entrenadorId} onChange={e => setForm(f => ({ ...f, entrenadorId: e.target.value }))} options={entrenadorOptions} className="col-span-2" />
          <InputField label="Fecha" required type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          <SelectField label="Sala" value={form.salon} onChange={e => setForm(f => ({ ...f, salon: e.target.value }))} options={salonOptions} />
          <InputField label="Hora inicio" required type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
          <InputField label="Hora fin" required type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} />
          <InputField label="Capacidad" required type="number" min="1" value={form.capacidadTotal} onChange={e => setForm(f => ({ ...f, capacidadTotal: e.target.value }))} />
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
        </div>
        {formError && (
          <p role="alert" className="mt-4 text-sm text-[color:var(--bad)] bg-[color:var(--bad-bg)] border border-[color:var(--bad-bg)] px-3 py-2 rounded-xl">{formError}</p>
        )}
        <div className="flex gap-3 mt-6 pt-4 border-t border-[color:var(--line)]">
          <button onClick={() => setModal({ open: false })} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)]">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[color:var(--dark)] hover:bg-[color:var(--dark2)] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
            {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear horario'}
          </button>
        </div>
      </Modal>
    </div>
  );
}