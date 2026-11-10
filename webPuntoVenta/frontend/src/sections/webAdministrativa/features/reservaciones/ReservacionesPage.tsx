import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { DataTable } from '../../components/DataTable';
import { DataState } from '../../components/DataState';
import { Modal } from '../../components/Modal';
import { SelectField } from '../../components/FormField';
import { api } from '../../lib/api';

// Una reservación tal como la devuelve GET /admin/api/reservaciones (MongoDB).
interface ReservacionMongo {
  idReservacion: string;
  codigo?: string;
  idCliente: string;
  nombreCliente: string;
  idHorario: string;
  clase: string;
  entrenador: string;
  horaClase: string;
  // Fecha de la clase, "AAAA-MM-DD".
  fechaReservacion: string;
  estatus: 'pendiente' | 'confirmada' | 'cancelada' | 'no_asistio';
  asistenciaConfirmada: boolean;
  reagendada?: boolean;
}

interface ClienteOpcion {
  idUsuario: string;
  nombre: string;
  apellidos: string;
  correo?: string;
}

// Horario ya adaptado a lo que necesita una reservación.
interface HorarioOpcion {
  id: string;
  clase: string;
  entrenador: string;
  horaClase: string;
  fecha: string;
  salon?: string;
}

type Filtro = 'todos' | ReservacionMongo['estatus'];

const filterTabs: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'cancelada', label: 'Canceladas' },
  { value: 'no_asistio', label: 'No asistió' },
];

// ---- Adaptador de horarios ----------------------------------------------------------------
// Convierte lo que devuelve GET /admin/api/horarios al formato de la reservación.
// Si en tu API los campos se llaman distinto (por ejemplo el nombre de la clase o del
// entrenador), este es el único lugar que hay que ajustar.
const texto = (v: unknown): string =>
  typeof v === 'string' ? v : v && typeof v === 'object' && 'nombre' in v ? String((v as { nombre: unknown }).nombre ?? '') : '';

function adaptarHorario(h: Record<string, unknown>): HorarioOpcion | null {
  const id = h.idHorario ?? h.id ?? h._id;
  const fecha = typeof h.fecha === 'string' ? h.fecha.slice(0, 10) : '';
  const hora = texto(h.horaInicio ?? h.hora);
  if (!id || !fecha || !hora) return null;
  const estatus = texto(h.estatus).toLowerCase();
  if (['cancelado', 'cancelada', 'inactivo'].includes(estatus)) return null;
  return {
    id: String(id),
    clase: texto(h.clase ?? h.nombreClase ?? h.nombre ?? h.titulo) || 'Clase',
    entrenador: texto(h.entrenador ?? h.nombreEntrenador) || 'Por asignar',
    horaClase: hora,
    fecha,
    salon: texto(h.salon) || undefined,
  };
}

// Fecha de hoy "AAAA-MM-DD" en la hora local del navegador.
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "AAAA-MM-DD" -> "DD/MM/AAAA" sin pasar por Date (evita desfases de zona horaria).
function formatearFecha(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

const etiquetaHorario = (h: HorarioOpcion) =>
  `${formatearFecha(h.fecha)} ${h.horaClase} · ${h.clase} · ${h.entrenador}${h.salon ? ` · ${h.salon}` : ''}`;

function badgeDe(r: ReservacionMongo): { variant: 'confirmada' | 'pendiente' | 'cancelada'; label: string } {
  if (r.estatus === 'cancelada') return { variant: 'cancelada', label: 'Cancelada' };
  if (r.estatus === 'no_asistio') return { variant: 'cancelada', label: 'No asistió' };
  if (r.asistenciaConfirmada) return { variant: 'confirmada', label: 'Asistió' };
  if (r.estatus === 'confirmada') return { variant: 'confirmada', label: 'Confirmada' };
  return { variant: 'pendiente', label: 'Pendiente' };
}

export function ReservacionesPage() {
  const [reservaciones, setReservaciones] = useState<ReservacionMongo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filtro>('todos');
  const [accionError, setAccionError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Catálogos para los formularios (se cargan al abrirlos).
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [horarios, setHorarios] = useState<HorarioOpcion[]>([]);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);

  // Nueva reservación.
  const [modalNueva, setModalNueva] = useState(false);
  const [idCliente, setIdCliente] = useState('');
  const [idHorario, setIdHorario] = useState('');
  // Reagendar.
  const [reagendando, setReagendando] = useState<ReservacionMongo | null>(null);
  const [nuevoHorario, setNuevoHorario] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReservaciones(await api.get<ReservacionMongo[]>('/reservaciones'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reservaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cargarHorarios = async () => {
    const lista = await api.get<Record<string, unknown>[]>('/horarios');
    const hoy = hoyISO();
    setHorarios(
      lista
        .map(adaptarHorario)
        .filter((h): h is HorarioOpcion => h !== null && h.fecha >= hoy)
        .sort((a, b) => (a.fecha + a.horaClase).localeCompare(b.fecha + b.horaClase)),
    );
  };

  const abrirNueva = async () => {
    setIdCliente('');
    setIdHorario('');
    setFormError(null);
    setCatalogoError(null);
    setModalNueva(true);
    try {
      const [c] = await Promise.all([api.get<ClienteOpcion[]>('/clientes?estatus=activo'), cargarHorarios()]);
      setClientes(c);
    } catch (err) {
      setCatalogoError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes u horarios.');
    }
  };

  const abrirReagendar = async (r: ReservacionMongo) => {
    setReagendando(r);
    setNuevoHorario('');
    setFormError(null);
    setCatalogoError(null);
    try {
      await cargarHorarios();
    } catch (err) {
      setCatalogoError(err instanceof Error ? err.message : 'No se pudieron cargar los horarios.');
    }
  };

  const reemplazar = (r: ReservacionMongo) =>
    setReservaciones(lista => lista.map(x => x.idReservacion === r.idReservacion ? r : x));

  const guardarNueva = async () => {
    if (guardando) return;
    setFormError(null);
    const h = horarios.find(x => x.id === idHorario);
    if (!idCliente) return setFormError('Selecciona un cliente.');
    if (!h) return setFormError('Selecciona un horario.');
    setGuardando(true);
    try {
      const creada = await api.post<ReservacionMongo>('/reservaciones', {
        idCliente,
        idHorario: h.id,
        clase: h.clase,
        entrenador: h.entrenador,
        horaClase: h.horaClase,
        fechaReservacion: h.fecha,
      });
      setReservaciones(lista => [creada, ...lista]);
      setAviso(`Reservación creada. Código: ${creada.codigo ?? 'sin código'}`);
      setAccionError(null);
      setModalNueva(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear la reservación.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarReagendar = async () => {
    if (guardando || !reagendando) return;
    setFormError(null);
    const h = horarios.find(x => x.id === nuevoHorario);
    if (!h) return setFormError('Selecciona el nuevo horario.');
    setGuardando(true);
    try {
      const actualizada = await api.patch<ReservacionMongo>(`/reservaciones/${reagendando.idReservacion}/reagendar`, {
        idHorario: h.id,
        clase: h.clase,
        entrenador: h.entrenador,
        horaClase: h.horaClase,
        fechaReservacion: h.fecha,
      });
      reemplazar(actualizada);
      setAviso(`Reservación ${actualizada.codigo ?? ''} reagendada. Ya no podrá reagendarse de nuevo.`);
      setAccionError(null);
      setReagendando(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo reagendar la reservación.');
    } finally {
      setGuardando(false);
    }
  };

  // Acciones directas de la tabla (cancelar, asistencia, inasistencia, confirmar).
  const ejecutar = async (r: ReservacionMongo, ruta: string, body: unknown, exito: string) => {
    if (procesando !== null) return;
    setAccionError(null);
    setAviso(null);
    setProcesando(r.idReservacion);
    try {
      reemplazar(await api.patch<ReservacionMongo>(`/reservaciones/${r.idReservacion}${ruta}`, body));
      setAviso(exito);
    } catch (err) {
      setAccionError(err instanceof Error ? err.message : 'No se pudo completar la acción.');
    } finally {
      setProcesando(null);
    }
  };

  const cancelar = (r: ReservacionMongo) => {
    const ok = window.confirm(
      `¿Cancelar la reservación ${r.codigo ?? ''} de ${r.nombreCliente}?\n\nSolo procede hasta 24 horas antes de la clase y no hay reembolso.`,
    );
    if (ok) void ejecutar(r, '/cancelar', {}, 'Reservación cancelada.');
  };

  const noAsistio = (r: ReservacionMongo) => {
    const ok = window.confirm(
      `¿Marcar que ${r.nombreCliente} no asistió?\n\nNo hay reembolso y ya no podrá reagendar.`,
    );
    if (ok) void ejecutar(r, '/inasistencia', {}, 'Inasistencia registrada.');
  };

  const filtered = filter === 'todos' ? reservaciones : reservaciones.filter(r => r.estatus === filter);
  const pendientes = reservaciones.filter(r => r.estatus === 'pendiente').length;

  const horariosReagendar = reagendando
    ? horarios.filter(h => !(h.id === reagendando.idHorario && h.fecha === reagendando.fechaReservacion))
    : [];

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Reservaciones</h1>
          <p className="text-gray-500 text-sm mt-0.5">{reservaciones.length} {reservaciones.length === 1 ? 'reservación' : 'reservaciones'} · {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void cargar()} disabled={loading || procesando !== null}
            className="rx-btn rx-btn--outline">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Actualizar
          </button>
          <button onClick={() => void abrirNueva()} className="rx-btn rx-btn--accent">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva reservación
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 -mt-3">
        Se puede reagendar una sola vez y sin costo. La cancelación procede hasta 24 horas antes de la clase y no tiene reembolso. Si el cliente no asiste, no hay reembolso ni reagendación.
      </p>

      {aviso && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{aviso}</div>
      )}
      {accionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{accionError}</div>
      )}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {filterTabs.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`rx-tab ${filter === tab.value ? 'rx-tab--active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <DataState loading={loading} error={error} empty={filtered.length === 0}
        emptyMessage="No hay reservaciones con este filtro" onRetry={() => void cargar()}>
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          searchKeys={['nombreCliente', 'clase', 'codigo'] as never[]}
          columns={[
            {
              key: 'nombreCliente', header: 'Cliente',
              render: row => {
                const r = row as unknown as ReservacionMongo;
                return (
                  <div>
                    <p className="font-medium text-gray-800">{r.nombreCliente}</p>
                    <p className="text-xs text-gray-400 font-mono">{r.codigo ?? 'Sin código'}</p>
                  </div>
                );
              }
            },
            {
              key: 'clase', header: 'Clase',
              render: row => {
                const r = row as unknown as ReservacionMongo;
                return (
                  <div>
                    <p className="font-medium text-gray-800">{r.clase}</p>
                    <p className="text-xs text-gray-400">{r.entrenador} · {formatearFecha(r.fechaReservacion)} · {r.horaClase}</p>
                  </div>
                );
              }
            },
            {
              key: 'estatus', header: 'Estatus',
              render: row => {
                const r = row as unknown as ReservacionMongo;
                const badge = badgeDe(r);
                return (
                  <div className="space-y-1">
                    <Badge variant={badge.variant} label={badge.label} />
                    {r.reagendada && <p className="text-xs text-gray-500">Reagendada</p>}
                  </div>
                );
              }
            },
          ]}
          actions={row => {
            const r = row as unknown as ReservacionMongo;
            const vigente = (r.estatus === 'pendiente' || r.estatus === 'confirmada') && !r.asistenciaConfirmada;
            const ocupado = procesando !== null || loading;
            return (
              <div className="flex items-center gap-2 justify-end flex-wrap">
                {r.estatus === 'pendiente' && !r.asistenciaConfirmada && (
                  <button type="button" disabled={ocupado} onClick={() => void ejecutar(r, '', { estatus: 'confirmada' }, 'Reservación confirmada.')} className="rx-icon-btn" title="Confirmar reservación">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                )}
                <button type="button" disabled={ocupado || !vigente || !!r.reagendada} onClick={() => void abrirReagendar(r)} className="rx-icon-btn" title={r.reagendada ? 'Ya se reagendó una vez' : 'Reagendar (una sola vez, sin costo)'}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
                <button type="button" disabled={ocupado || !vigente} onClick={() => void ejecutar(r, '/asistencia', {}, 'Asistencia registrada.')} className="rx-icon-btn" title="Registrar asistencia">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button type="button" disabled={ocupado || !vigente} onClick={() => noAsistio(r)} className="rx-icon-btn" title="Marcar inasistencia">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button type="button" disabled={ocupado || !vigente} onClick={() => cancelar(r)} className="rx-icon-btn rx-btn--danger" title="Cancelar reservación">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                </button>
              </div>
            );
          }}
        />
      </DataState>

      <Modal open={modalNueva} onClose={() => { if (!guardando) setModalNueva(false); }} title="Nueva reservación">
        <div className="grid grid-cols-1 gap-4">
          <SelectField label="Cliente" value={idCliente} onChange={e => setIdCliente(e.target.value)}
            options={[{ value: '', label: 'Selecciona un cliente' }, ...clientes.map(c => ({ value: c.idUsuario, label: `${c.nombre} ${c.apellidos}${c.correo ? ` · ${c.correo}` : ''}` }))]} />
          <SelectField label="Horario" value={idHorario} onChange={e => setIdHorario(e.target.value)}
            options={[{ value: '', label: 'Selecciona un horario' }, ...horarios.map(h => ({ value: h.id, label: etiquetaHorario(h) }))]} />
          <p className="text-sm text-gray-600">Al guardar se genera un código de reservación que el cliente también puede consultar en su aplicación móvil.</p>
        </div>
        {catalogoError && <p className="text-xs text-red-500 mt-3">{catalogoError}</p>}
        {formError && <p className="text-xs text-red-500 mt-3">{formError}</p>}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button disabled={guardando} onClick={() => setModalNueva(false)} className="rx-btn rx-btn--outline flex-1">Cancelar</button>
          <button onClick={() => void guardarNueva()} disabled={guardando} className="rx-btn rx-btn--dark flex-1">
            {guardando ? 'Guardando...' : 'Crear reservación'}
          </button>
        </div>
      </Modal>

      <Modal open={reagendando !== null} onClose={() => { if (!guardando) setReagendando(null); }} title="Reagendar reservación">
        {reagendando && (
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-medium">{reagendando.nombreCliente} · {reagendando.codigo}</p>
              <p className="text-xs text-gray-500">Actual: {formatearFecha(reagendando.fechaReservacion)} {reagendando.horaClase} · {reagendando.clase} · {reagendando.entrenador}</p>
            </div>
            <SelectField label="Nuevo horario" value={nuevoHorario} onChange={e => setNuevoHorario(e.target.value)}
              options={[{ value: '', label: 'Selecciona el nuevo horario' }, ...horariosReagendar.map(h => ({ value: h.id, label: etiquetaHorario(h) }))]} />
            <p className="text-sm text-gray-600">Solo se puede reagendar una vez y no tiene costo. Después de esto la reservación ya no podrá reagendarse.</p>
          </div>
        )}
        {catalogoError && <p className="text-xs text-red-500 mt-3">{catalogoError}</p>}
        {formError && <p className="text-xs text-red-500 mt-3">{formError}</p>}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button disabled={guardando} onClick={() => setReagendando(null)} className="rx-btn rx-btn--outline flex-1">Cancelar</button>
          <button onClick={() => void guardarReagendar()} disabled={guardando} className="rx-btn rx-btn--dark flex-1">
            {guardando ? 'Guardando...' : 'Reagendar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}