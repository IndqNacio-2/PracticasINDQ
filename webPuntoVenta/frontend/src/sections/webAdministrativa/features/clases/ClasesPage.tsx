import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { InputField, SelectField, TextareaField } from '../../components/FormField';
import { DataState } from '../../components/DataState';
import { api } from '../../lib/api';
import type { Clase, Usuario, Estatus } from '../../types';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0891b2', '#ef4444', '#8b5cf6', '#14b8a6'];

const EMPTY_FORM = { nombre: '', descripcion: '', capacidad: '12', color: '#10b981', estatus: 'activo' as Estatus, entrenadorId: '' };

export function ClasesPage() {
  /*
   * Las clases y los entrenadores viven en MongoDB (backend-administrativa).
   * El formulario del entrenador se llena con los usuarios reales de rol
   * "entrenador", no con datos de ejemplo.
   */
  const [clases, setClases] = useState<Clase[]>([]);
  const [entrenadores, setEntrenadores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; editing?: Clase }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Trae las clases del catálogo y, en paralelo, los entrenadores activos.
  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cs, ents] = await Promise.all([
        api.get<Clase[]>('/clases'),
        api.get<Usuario[]>('/usuarios'),
      ]);
      setClases(cs);
      setEntrenadores(ents.filter(u => u.rol === 'entrenador' && u.estatus === 'activo'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las clases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModal({ open: true });
  };
  const openEdit = (c: Clase) => {
    setForm({ nombre: c.nombre, descripcion: c.descripcion, capacidad: String(c.capacidad), color: c.color, estatus: c.estatus, entrenadorId: c.entrenadorId ?? '' });
    setFormError(null);
    setModal({ open: true, editing: c });
  };

  /*
   * Guarda la clase en el backend: crea con POST o actualiza con PATCH.
   * El backend responde con la clase ya guardada (con su idClase), que es la
   * que se agrega/reemplaza en el listado para reflejar la base al instante.
   */
  const save = async () => {
    const capacidad = Number(form.capacidad);
    if (!form.nombre.trim()) { setFormError('El nombre de la clase es obligatorio.'); return; }
    if (!Number.isFinite(capacidad) || capacidad < 1) { setFormError('La capacidad debe ser al menos 1.'); return; }

    setSaving(true);
    setFormError(null);
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion,
      capacidad,
      color: form.color,
      estatus: form.estatus,
      entrenadorId: form.entrenadorId,
    };

    try {
      if (modal.editing) {
        const actualizada = await api.patch<Clase>(`/clases/${modal.editing.idClase}`, payload);
        setClases(prev => prev.map(c => c.idClase === actualizada.idClase ? actualizada : c));
      } else {
        const creada = await api.post<Clase>('/clases', payload);
        setClases(prev => [...prev, creada]);
      }
      setModal({ open: false });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar la clase.');
    } finally {
      setSaving(false);
    }
  };

  // Cambia el estatus en el backend y actualiza la tarjeta con la respuesta.
  const toggleEstatus = async (id: string) => {
    const clase = clases.find(c => c.idClase === id);
    if (!clase) return;
    const nuevoEstatus: Estatus = clase.estatus === 'activo' ? 'inactivo' : 'activo';
    try {
      const actualizada = await api.patch<Clase>(`/clases/${id}`, { estatus: nuevoEstatus });
      setClases(prev => prev.map(c => c.idClase === id ? actualizada : c));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estatus.');
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Clases</h1>
          <p className="text-slate-500 text-sm mt-0.5">{clases.filter(c => c.estatus === 'activo').length} activas · {clases.length} totales</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nueva clase
        </button>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && clases.length === 0}
        emptyMessage="Aún no hay clases registradas. Crea la primera con el botón superior."
        onRetry={cargar}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clases.map(clase => {
            const entrenador = entrenadores.find(u => u.idUsuario === clase.entrenadorId);
          return (
            <div key={clase.idClase} className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow ${clase.estatus === 'inactivo' ? 'opacity-60' : ''}`}>
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
                      <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>{clase.nombre}</h3>
                      <Badge variant={clase.estatus} />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(clase)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => toggleEstatus(clase.idClase)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    </button>
                  </div>
                </div>

                <p className="text-sm text-slate-500 line-clamp-2 mb-4">{clase.descripcion}</p>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>{clase.capacidad} lugares</span>
                  </div>
                  {entrenador && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">{entrenador.nombre[0]}</div>
                      <span className="text-slate-500 text-xs">{entrenador.nombre} {entrenador.apellidos}</span>
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
              options={entrenadores.map(e => ({ value: e.idUsuario, label: `${e.nombre} ${e.apellidos}` }))} />
          </div>
          <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))}
            options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color identificador</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal({ open: false })} disabled={saving} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>}
            {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear clase'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
