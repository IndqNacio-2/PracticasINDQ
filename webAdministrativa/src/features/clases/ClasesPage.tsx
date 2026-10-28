import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { InputField, SelectField, TextareaField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api, mensajeDeError } from '../../lib/api';
import type { Clase, Estatus, Usuario } from '../../types';

const COLORS = ['#2E9E5B', '#16181D', '#E8803A', '#5B3FB0', '#2459A3', '#D64545', '#9298A3', '#C6F24E'];

export function ClasesPage() {
  const [clases, setClases] = useState<Clase[]>([]);
  // Todos los entrenadores (para mostrar el nombre en cada tarjeta); solo los activos se pueden elegir
  const [entrenadores, setEntrenadores] = useState<Usuario[]>([]);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState<{ open: boolean; editing?: Clase }>({ open: false });
  const [form, setForm] = useState({ nombre: '', descripcion: '', capacidad: '12', color: '#2E9E5B', estatus: 'activo' as Estatus, entrenadorId: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, ents] = await Promise.all([
        api.get<Clase[]>('/clases'),
        api.get<Usuario[]>('/usuarios?rol=entrenador'),
      ]);
      setClases(data);
      setEntrenadores(ents);
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudieron cargar las clases.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const entrenadoresActivos = entrenadores.filter(u => u.estatus === 'activo');

  const openNew = () => {
    setForm({ nombre: '', descripcion: '', capacidad: '12', color: '#2E9E5B', estatus: 'activo', entrenadorId: '' });
    setFormError('');
    setModal({ open: true });
  };
  const openEdit = (c: Clase) => {
    setForm({ nombre: c.nombre, descripcion: c.descripcion, capacidad: String(c.capacidad), color: c.color, estatus: c.estatus, entrenadorId: c.entrenadorId ?? '' });
    setFormError('');
    setModal({ open: true, editing: c });
  };

  const save = async () => {
    if (!form.nombre.trim()) { setFormError('El nombre de la clase es obligatorio.'); return; }
    const capacidad = Number(form.capacidad);
    if (!Number.isInteger(capacidad) || capacidad < 1) { setFormError('La capacidad debe ser un entero mayor a 0.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (modal.editing) {
        const actualizada = await api.patch<Clase>(`/clases/${modal.editing.idClase}`, {
          ...form,
          capacidad,
        });
        setClases(prev => prev.map(c => c.idClase === actualizada.idClase ? actualizada : c));
      } else {
        const nueva = await api.post<Clase>('/clases', {
          nombre: form.nombre,
          descripcion: form.descripcion,
          capacidad,
          color: form.color,
          estatus: form.estatus,
          entrenadorId: form.entrenadorId,
        });
        setClases(prev => [...prev, nueva]);
      }
      setModal({ open: false });
    } catch (err) {
      setFormError(mensajeDeError(err, modal.editing ? 'No se pudo actualizar la clase.' : 'No se pudo crear la clase.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEstatus = async (clase: Clase) => {
    const nuevoEstatus: Estatus = clase.estatus === 'activo' ? 'inactivo' : 'activo';
    setClases(prev => prev.map(c => c.idClase === clase.idClase ? { ...c, estatus: nuevoEstatus } : c));
    try {
      await api.patch(`/clases/${clase.idClase}`, { estatus: nuevoEstatus });
    } catch (err) {
      setClases(prev => prev.map(c => c.idClase === clase.idClase ? { ...c, estatus: clase.estatus } : c));
      setError(mensajeDeError(err, 'No se pudo actualizar el estatus de la clase.'));
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--ink)]">Clases</h1>
          <p className="text-[color:var(--ink2)] text-sm mt-0.5">{clases.filter(c => c.estatus === 'activo').length} activas</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[color:var(--accent)] hover:brightness-95 text-[color:var(--ink)] px-4 py-2 rounded-xl text-sm font-bold transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva clase
        </button>
      </div>

      <DataState loading={loading} error={error} onRetry={load} empty={!loading && !error && clases.length === 0} emptyMessage="Sin clases registradas todavía">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clases.map(clase => {
            const entrenador = entrenadores.find(u => u.idUsuario === clase.entrenadorId);
            return (
              <div key={clase.idClase} className={`bg-white rounded-2xl border border-[color:var(--line)] overflow-hidden hover:shadow-md transition-shadow ${clase.estatus === 'inactivo' ? 'opacity-60' : ''}`}>
                <div className="h-1.5" style={{ backgroundColor: clase.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${clase.color}20` }}>
                        <svg className="w-5 h-5" style={{ color: clase.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[color:var(--ink)]">{clase.nombre}</h3>
                        <Badge variant={clase.estatus} />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(clase)} className="p-1.5 rounded-lg text-[color:var(--ink3)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)] transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => toggleEstatus(clase)} className="p-1.5 rounded-lg text-[color:var(--ink3)] hover:text-[color:var(--bad)] hover:bg-[color:var(--bad-bg)] transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-[color:var(--ink2)] line-clamp-2 mb-4">{clase.descripcion}</p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-[color:var(--ink2)]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span>{clase.capacidad} lugares</span>
                    </div>
                    {entrenador && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[color:var(--avatar)] flex items-center justify-center text-[color:var(--ink)] text-xs font-bold">{entrenador.nombre?.[0]}</div>
                        <span className="text-[color:var(--ink2)] text-xs">{entrenador.nombre} {entrenador.apellidos}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DataState>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar clase' : 'Nueva clase'}>
        <div className="space-y-4">
          <InputField label="Nombre de la clase" required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          <TextareaField label="Descripción" value={form.descripcion} onChange={v => setForm(f => ({ ...f, descripcion: v }))} rows={2} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Capacidad" required type="number" min="1" value={form.capacidad} onChange={e => setForm(f => ({ ...f, capacidad: e.target.value }))} />
            <SelectField label="Entrenador" value={form.entrenadorId} onChange={e => setForm(f => ({ ...f, entrenadorId: e.target.value }))}
              options={entrenadoresActivos.map(e => ({ value: e.idUsuario, label: `${e.nombre} ${e.apellidos}` }))} />
          </div>
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))}
            options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          <div>
            <label className="block text-sm font-medium text-[color:var(--ink)] mb-2">Color identificador</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-[color:var(--ink)] scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-[color:var(--bad)] bg-[color:var(--bad-bg)] border border-[color:var(--bad-bg)] px-3 py-2 rounded-xl">{formError}</p>
          )}
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-[color:var(--line)]">
          <button onClick={() => setModal({ open: false })} className="flex-1 px-4 py-2.5 border border-[color:var(--line)] text-[color:var(--ink)] rounded-xl text-sm font-medium hover:bg-[color:var(--soft)]">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-[color:var(--dark)] hover:bg-[color:var(--dark2)] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
            {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear clase'}
          </button>
        </div>
      </Modal>
    </div>
  );
}