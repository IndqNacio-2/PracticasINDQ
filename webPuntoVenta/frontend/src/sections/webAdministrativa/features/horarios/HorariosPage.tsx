import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataState } from '../../components/DataState';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { api } from '../../lib/api';
import { horariosApi } from './horarios.api';
import { programacionApi } from './programacion.api';
import './horarios-ui.css';
import type {
  HorarioClase,
  EditarExcepcionSesion,
  Clase,
  Usuario,
  Estatus,
  PlantillaHorario,
  CrearProgramacionSemanal,
  EditarProgramacionSemanal,
} from '../../types';

const salonOptions = [{ value: 'Force Room', label: 'Force Room' }, { value: 'Reset Room', label: 'Reset Room' }, { value: 'Sala A', label: 'Sala A' }, { value: 'Sala B', label: 'Sala B' }, { value: 'Sala Principal', label: 'Sala Principal' }, { value: 'Sala Outdoor', label: 'Sala Outdoor' }];

const EMPTY_FORM = {
  idClase: '', entrenadorId: '', fecha: '', horaInicio: '', horaFin: '', capacidadTotal: '15', salon: 'Sala A',
  estatus: 'activo' as Estatus, visibleReservas: true, listaEsperaHabilitada: false,
};
const EMPTY_EXCEPTION_FORM: EditarExcepcionSesion = {
  entrenadorId: '', salon: 'Force Room', horaInicio: '', horaFin: '', estatus: 'activo', visibleReservas: true, listaEsperaHabilitada: false,
};
const EMPTY_WEEKLY_FORM: EditarProgramacionSemanal = {
  idClase: '', entrenadorId: '', horaInicio: '', horaFin: '', salon: 'Force Room', diasSemana: [],
  aplicarDesde: '', visibleReservas: true, listaEsperaHabilitada: false,
};
const EMPTY_CREATE_WEEKLY_FORM: CrearProgramacionSemanal = {
  idClase: '',
  entrenadorId: '',
  salon: 'Force Room',
  fechaInicio: '',
  horaInicio: '',
  horaFin: '',
  diasSemana: [],
  fechaFin: '',
  visibleReservas: true,
  listaEsperaHabilitada: false,
  estatus: 'activo',
};

/* Duracion minima de la sesion, en minutos (la misma regla del backend). */
const DURACION_MINIMA_MINUTOS = 30;
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/* En pantalla los días empiezan en lunes (igual que el calendario); el valor sigue siendo 0 = domingo. */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const DIAS_ABREVIADOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SIN_ASIGNAR = 'sin-asignar';
const DIAS_CALENDARIO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
type VistaCalendario = 'mes' | 'semana' | 'dia' | 'lista';

/*
 * Convierte "HH:MM" a minutos desde medianoche; devuelve null si el formato
 * no es valido o si la hora no existe.
 */
function minutosDeHora(hora: string): number | null {
  const coincidencia = /^(\d{2}):(\d{2})$/.exec(hora ?? '');
  if (!coincidencia) return null;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

/* La fecha local evita que UTC nos cambie de dia en algunas computadoras. */
function obtenerFechaLocal(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function diasEntreFechas(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00.000Z`).getTime();
  const fin = new Date(`${hasta}T00:00:00.000Z`).getTime();
  return Math.floor((fin - inicio) / (24 * 60 * 60 * 1000)) + 1;
}

function fechaDesdeISO(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 12);
}

function fechaAISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function sumarDiasLocal(fecha: string, dias: number): string {
  const resultado = fechaDesdeISO(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return fechaAISO(resultado);
}

function inicioSemana(fecha: string): string {
  const actual = fechaDesdeISO(fecha);
  const desplazamiento = (actual.getDay() + 6) % 7;
  actual.setDate(actual.getDate() - desplazamiento);
  return fechaAISO(actual);
}

function sumarMeses(fecha: string, meses: number): string {
  const actual = fechaDesdeISO(fecha);
  const dia = actual.getDate();
  actual.setDate(1);
  actual.setMonth(actual.getMonth() + meses);
  const ultimoDia = new Date(actual.getFullYear(), actual.getMonth() + 1, 0).getDate();
  actual.setDate(Math.min(dia, ultimoDia));
  return fechaAISO(actual);
}

function tituloFecha(fecha: string): string {
  const actual = fechaDesdeISO(fecha);
  return `${actual.getDate()} de ${MESES[actual.getMonth()]} de ${actual.getFullYear()}`;
}

function tituloPeriodo(vista: VistaCalendario, fecha: string): string {
  const actual = fechaDesdeISO(fecha);
  if (vista === 'mes') return `${MESES[actual.getMonth()]} de ${actual.getFullYear()}`;
  if (vista === 'dia') return tituloFecha(fecha);
  if (vista === 'lista') return `Agenda desde el ${tituloFecha(fecha)}`;
  const inicio = inicioSemana(fecha);
  const fin = sumarDiasLocal(inicio, 6);
  const inicioDate = fechaDesdeISO(inicio);
  const finDate = fechaDesdeISO(fin);
  if (inicioDate.getMonth() === finDate.getMonth()) {
    return `${inicioDate.getDate()}–${finDate.getDate()} de ${MESES[finDate.getMonth()]} de ${finDate.getFullYear()}`;
  }
  return `${inicioDate.getDate()} ${MESES[inicioDate.getMonth()]} – ${finDate.getDate()} ${MESES[finDate.getMonth()]} ${finDate.getFullYear()}`;
}

function colorClaseHorario(horario: HorarioClase, clases: Clase[]): string {
  return clases.find(clase => clase.idClase === horario.idClase)?.color || '#9298a3';
}

const TOTAL_TONOS_INSTRUCTOR = 10;

/*
 * El tono se deriva del id persistente del instructor. No depende del orden de
 * respuesta, por lo que se conserva entre cargas sin requerir datos locales.
 */
function tonoInstructor(entrenadorId?: string): number | null {
  if (!entrenadorId?.trim()) return null;
  let hash = 0;
  for (let indice = 0; indice < entrenadorId.length; indice += 1) {
    hash = ((hash << 5) - hash + entrenadorId.charCodeAt(indice)) | 0;
  }
  return (hash >>> 0) % TOTAL_TONOS_INSTRUCTOR;
}

function claseTonoInstructor(entrenadorId?: string): string {
  const tono = tonoInstructor(entrenadorId);
  return tono === null ? 'rx-instructor-tone--unassigned' : `rx-instructor-tone--${tono}`;
}

interface FiltrosHorario {
  entrenadores: string[];
  salon: string;
  idClase: string;
}

const FILTROS_VACIOS: FiltrosHorario = { entrenadores: [], salon: '', idClase: '' };

function hayFiltrosActivos(filtros: FiltrosHorario): boolean {
  return filtros.entrenadores.length > 0 || Boolean(filtros.salon) || Boolean(filtros.idClase);
}

/* Sirve para sesiones y para reglas semanales: ambas tienen sala, clase e instructor. */
function coincideConFiltros(item: { entrenadorId?: string; salon: string; idClase: string }, filtros: FiltrosHorario): boolean {
  if (filtros.salon && item.salon !== filtros.salon) return false;
  if (filtros.idClase && item.idClase !== filtros.idClase) return false;
  if (filtros.entrenadores.length > 0 && !filtros.entrenadores.includes(item.entrenadorId || SIN_ASIGNAR)) return false;
  return true;
}

/* Reloj que se actualiza cada minuto para dibujar la línea de "ahora" en la semana. */
function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const temporizador = window.setInterval(() => setAhora(new Date()), 60_000);
    return () => window.clearInterval(temporizador);
  }, []);
  return ahora;
}

function MarcaClase({ color }: { color: string }) {
  return <i className="rx-calendar-class-color" style={{ backgroundColor: color }} aria-hidden="true" />;
}

function BarraFiltros({ entrenadores, horarios, plantillas, clases, filtros, onChange, conteo }: {
  entrenadores: Usuario[];
  horarios: HorarioClase[];
  plantillas: PlantillaHorario[];
  clases: Clase[];
  filtros: FiltrosHorario;
  onChange: (filtros: FiltrosHorario) => void;
  conteo: string | null;
}) {
  const idsEnUso = new Set([...horarios.map(h => h.entrenadorId), ...plantillas.map(p => p.entrenadorId)].filter(Boolean));
  const instructores = entrenadores
    .filter(entrenador => entrenador.rol === 'entrenador' && (entrenador.estatus === 'activo' || idsEnUso.has(entrenador.idUsuario)))
    .sort((a, b) => `${a.nombre} ${a.apellidos}`.localeCompare(`${b.nombre} ${b.apellidos}`, 'es'));
  const haySinAsignar = horarios.some(h => !h.entrenadorId) || plantillas.some(p => !p.entrenadorId);
  const salones = Array.from(new Set([...horarios.map(h => h.salon), ...plantillas.map(p => p.salon)].filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'));
  const clasesOrdenadas = [...clases].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const activos = hayFiltrosActivos(filtros);

  if (instructores.length === 0 && !haySinAsignar && salones.length === 0) return null;

  const alternarInstructor = (id: string) => onChange({
    ...filtros,
    entrenadores: filtros.entrenadores.includes(id)
      ? filtros.entrenadores.filter(actual => actual !== id)
      : [...filtros.entrenadores, id],
  });

  return (
    <div className="hz-filters">
      <div className="hz-filters-row">
        <div className="hz-chips" role="group" aria-label="Filtrar por instructor">
          {instructores.map(entrenador => (
            <button
              type="button"
              key={entrenador.idUsuario}
              className={`rx-calendar-legend-item hz-chip ${claseTonoInstructor(entrenador.idUsuario)}`}
              aria-pressed={filtros.entrenadores.includes(entrenador.idUsuario)}
              onClick={() => alternarInstructor(entrenador.idUsuario)}
            >
              <i aria-hidden="true" />
              {entrenador.nombre} {entrenador.apellidos}
            </button>
          ))}
          {haySinAsignar && (
            <button
              type="button"
              className="rx-calendar-legend-item hz-chip rx-instructor-tone--unassigned"
              aria-pressed={filtros.entrenadores.includes(SIN_ASIGNAR)}
              onClick={() => alternarInstructor(SIN_ASIGNAR)}
            >
              <i aria-hidden="true" />
              Sin asignar
            </button>
          )}
        </div>
        <div className="hz-filter-selects">
          <select className="rx-select hz-select" aria-label="Filtrar por sala" value={filtros.salon}
            onChange={e => onChange({ ...filtros, salon: e.target.value })}>
            <option value="">Todas las salas</option>
            {salones.map(salon => <option key={salon} value={salon}>{salon}</option>)}
          </select>
          <select className="rx-select hz-select" aria-label="Filtrar por clase" value={filtros.idClase}
            onChange={e => onChange({ ...filtros, idClase: e.target.value })}>
            <option value="">Todas las clases</option>
            {clasesOrdenadas.map(clase => <option key={clase.idClase} value={clase.idClase}>{clase.nombre}</option>)}
          </select>
          {activos && (
            <button type="button" className="hz-link-btn" onClick={() => onChange(FILTROS_VACIOS)}>Limpiar filtros</button>
          )}
        </div>
      </div>
      <div className="hz-filters-foot">
        <span className="rx-calendar-legend-help"><i aria-hidden="true" /> El punto pequeño es el color de la clase.</span>
        {activos && conteo && <span className="hz-filters-count" aria-live="polite">{conteo}</span>}
      </div>
    </div>
  );
}

function ocupacionHorario(horario: HorarioClase): number {
  return Math.max(0, horario.capacidadTotal - horario.capacidadDisponible);
}

function porcentajeOcupacion(horario: HorarioClase): number {
  if (horario.capacidadTotal <= 0) return 0;
  return Math.min(100, Math.round((ocupacionHorario(horario) / horario.capacidadTotal) * 100));
}

function estaLlena(horario: HorarioClase): boolean {
  return horario.estatus === 'activo' && horario.capacidadTotal > 0 && horario.capacidadDisponible <= 0;
}

/* Barra de lugares ocupados: neutra, ámbar desde 80 % y roja cuando la sesión se llena. */
function MedidorOcupacion({ horario, variante }: { horario: HorarioClase; variante: 'evento' | 'tarjeta' | 'lista' }) {
  const porcentaje = porcentajeOcupacion(horario);
  const nivel = estaLlena(horario) ? 'full' : porcentaje >= 80 ? 'high' : 'ok';
  return (
    <i
      className={`hz-meter hz-meter--${variante} hz-meter--${nivel}`}
      role="img"
      aria-label={`${ocupacionHorario(horario)} de ${horario.capacidadTotal} lugares ocupados`}
    >
      <b style={{ width: `${porcentaje}%` }} />
    </i>
  );
}

function IndicadoresSesion({ horario }: { horario: HorarioClase }) {
  return (
    <span className="rx-calendar-indicators">
      {estaLlena(horario) && <span className="rx-calendar-tag hz-tag--full">Llena</span>}
      {horario.esExcepcionPlantilla && <span className="rx-calendar-tag rx-calendar-tag--exception">Modificada</span>}
      {horario.estatus === 'inactivo' && <span className="rx-calendar-tag rx-calendar-tag--cancelled">Cancelada</span>}
    </span>
  );
}

function BotonEditarSesion({ horario, onEdit }: { horario: HorarioClase; onEdit: (horario: HorarioClase) => void }) {
  return (
    <button type="button" className="rx-icon-btn" onClick={evento => { evento.stopPropagation(); onEdit(horario); }} aria-label={`Editar ${horario.nombreClase}`} title="Editar sesión">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11.8 15H9v-2.8l8.6-8.6z" /></svg>
    </button>
  );
}

function CalendarioSesiones({ horarios, clases, vista, fechaReferencia, onSelectDay, onEdit }: {
  horarios: HorarioClase[];
  clases: Clase[];
  vista: VistaCalendario;
  fechaReferencia: string;
  onSelectDay: (fecha: string) => void;
  onEdit: (horario: HorarioClase) => void;
}) {
  const ordenados = [...horarios].sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`));
  const ahora = useAhora();
  const hoyISO = fechaAISO(ahora);
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  if (vista === 'semana') {
    const inicio = inicioSemana(fechaReferencia);
    const dias = Array.from({ length: 7 }, (_, indice) => sumarDiasLocal(inicio, indice));
    const sesiones = ordenados.filter(horario => horario.fecha >= inicio && horario.fecha <= dias[6]);
    const inicios = sesiones.map(sesion => minutosDeHora(sesion.horaInicio)).filter((valor): valor is number => valor !== null);
    const finales = sesiones.map(sesion => minutosDeHora(sesion.horaFin)).filter((valor): valor is number => valor !== null);
    /* El rango se ajusta a las clases de la semana (con 1 h de margen); sin clases usa 7:00–21:00. */
    const primeraHora = inicios.length ? Math.floor(Math.min(...inicios) / 60) - 1 : 7;
    const ultimaHora = finales.length ? Math.ceil(Math.max(...finales) / 60) + 1 : 21;
    const horaMinima = Math.max(0, primeraHora);
    const horaMaxima = Math.min(24, Math.max(ultimaHora, horaMinima + 4));
    const horas = Array.from({ length: horaMaxima - horaMinima + 1 }, (_, indice) => horaMinima + indice);
    const altoHora = 60;

    return (
      <div className="rx-calendar-week-scroll">
        <div className="rx-calendar-week" style={{ '--calendar-hours': String(horaMaxima - horaMinima) } as React.CSSProperties}>
          <div className="rx-calendar-week-corner" />
          {dias.map((dia, indice) => (
            <button type="button" key={dia} className={`rx-calendar-week-head${dia === obtenerFechaLocal() ? ' is-today' : ''}`} onClick={() => onSelectDay(dia)}>
              <span>{DIAS_CALENDARIO[indice]}</span><strong>{fechaDesdeISO(dia).getDate()}</strong>
            </button>
          ))}
          <div className="rx-calendar-hours" style={{ height: `${(horaMaxima - horaMinima) * altoHora}px` }}>
            {horas.slice(0, -1).map(hora => <span key={hora} style={{ top: `${(hora - horaMinima) * altoHora}px` }}>{String(hora).padStart(2, '0')}:00</span>)}
          </div>
          {dias.map(dia => (
            <div key={dia} className={`rx-calendar-day-track${dia === obtenerFechaLocal() ? ' is-today' : ''}`} style={{ height: `${(horaMaxima - horaMinima) * altoHora}px` }}>
              {horas.slice(0, -1).map(hora => <i key={hora} className="rx-calendar-hour-line" style={{ top: `${(hora - horaMinima) * altoHora}px` }} />)}
              {dia === hoyISO && minutosAhora >= horaMinima * 60 && minutosAhora <= horaMaxima * 60 && (
                <i className="hz-now-line" style={{ top: `${((minutosAhora - horaMinima * 60) / 60) * altoHora}px` }} aria-hidden="true" />
              )}
              {sesiones.filter(sesion => sesion.fecha === dia).map(sesion => {
                const inicioMinutos = minutosDeHora(sesion.horaInicio) ?? horaMinima * 60;
                const finMinutos = minutosDeHora(sesion.horaFin) ?? inicioMinutos + 30;
                const top = ((inicioMinutos - horaMinima * 60) / 60) * altoHora;
                const height = Math.max(38, ((finMinutos - inicioMinutos) / 60) * altoHora);
                return (
                  <button type="button" key={sesion.idHorario} className={`rx-calendar-event ${claseTonoInstructor(sesion.entrenadorId)}${sesion.estatus === 'inactivo' ? ' is-cancelled' : ''}`} style={{ top, height }} onClick={() => onEdit(sesion)}>
                    <strong><MarcaClase color={colorClaseHorario(sesion, clases)} />{sesion.nombreClase}</strong>
                    <span>{sesion.horaInicio}–{sesion.horaFin}</span>
                    {height >= 58 && <span>{sesion.nombreEntrenador}</span>}
                    {height >= 78 && <span>{sesion.salon} · {ocupacionHorario(sesion)}/{sesion.capacidadTotal}</span>}
                    <IndicadoresSesion horario={sesion} />
                    <MedidorOcupacion horario={sesion} variante="evento" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {sesiones.length === 0 && <p className="rx-calendar-empty-overlay">No hay clases programadas esta semana.</p>}
      </div>
    );
  }

  if (vista === 'mes') {
    const actual = fechaDesdeISO(fechaReferencia);
    const primerDiaMes = fechaAISO(new Date(actual.getFullYear(), actual.getMonth(), 1, 12));
    const inicio = inicioSemana(primerDiaMes);
    const dias = Array.from({ length: 42 }, (_, indice) => sumarDiasLocal(inicio, indice));
    return (
      <div className="rx-calendar-month">
        {DIAS_CALENDARIO.map(dia => <div key={dia} className="rx-calendar-month-label">{dia}</div>)}
        {dias.map(dia => {
          const sesiones = ordenados.filter(horario => horario.fecha === dia);
          const dentroMes = fechaDesdeISO(dia).getMonth() === actual.getMonth();
          return (
            <button type="button" key={dia} className={`rx-calendar-month-day${dentroMes ? '' : ' is-outside'}${dia === obtenerFechaLocal() ? ' is-today' : ''}`} onClick={() => onSelectDay(dia)}>
              <span className="rx-calendar-month-number">{fechaDesdeISO(dia).getDate()}</span>
              {sesiones.length > 0 && <span className="rx-calendar-month-count">{sesiones.length} {sesiones.length === 1 ? 'clase' : 'clases'}</span>}
              <span className="rx-calendar-month-events">
                {sesiones.slice(0, 3).map(sesion => <span key={sesion.idHorario} className={claseTonoInstructor(sesion.entrenadorId)}><i /><small style={{ backgroundColor: colorClaseHorario(sesion, clases) }} />{sesion.horaInicio} {sesion.nombreClase}</span>)}
                {sesiones.length > 3 && <small>+{sesiones.length - 3} más</small>}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const inicioLista = fechaReferencia;
  const finLista = sumarDiasLocal(fechaReferencia, 30);
  const sesiones = vista === 'dia'
    ? ordenados.filter(horario => horario.fecha === fechaReferencia)
    : ordenados.filter(horario => horario.fecha >= inicioLista && horario.fecha <= finLista);

  if (sesiones.length === 0) return <p className="rx-calendar-empty">No hay clases programadas en este periodo.</p>;

  if (vista === 'dia') {
    return (
      <div className="rx-calendar-daily-list">
        {sesiones.map(sesion => (
          <article key={sesion.idHorario} className={`rx-calendar-daily-card ${claseTonoInstructor(sesion.entrenadorId)}${sesion.estatus === 'inactivo' ? ' is-cancelled' : ''}`}>
            <div className="rx-calendar-daily-time"><strong>{sesion.horaInicio}</strong><span>{sesion.horaFin}</span></div>
            <div className="rx-calendar-daily-copy">
              <div className="rx-calendar-title-row"><h4><MarcaClase color={colorClaseHorario(sesion, clases)} />{sesion.nombreClase}</h4><IndicadoresSesion horario={sesion} /></div>
              <p>{sesion.nombreEntrenador} · {sesion.salon}</p>
              <MedidorOcupacion horario={sesion} variante="tarjeta" />
              <div className="rx-calendar-detail-grid">
                <span><small>Reservaciones</small><strong>{ocupacionHorario(sesion)} de {sesion.capacidadTotal}</strong></span>
                <span><small>Disponibles</small><strong>{sesion.capacidadDisponible}</strong></span>
                <span><small>Lista de espera</small><strong>{sesion.listaEsperaHabilitada ? 'Habilitada' : 'Desactivada'}</strong></span>
                <span><small>Visibilidad</small><strong>{sesion.visibleReservas === false ? 'Oculta' : 'Visible'}</strong></span>
              </div>
            </div>
            <BotonEditarSesion horario={sesion} onEdit={onEdit} />
          </article>
        ))}
      </div>
    );
  }

  let fechaAnterior = '';
  return (
    <div className="rx-calendar-list">
      {sesiones.map(sesion => {
        const mostrarFecha = fechaAnterior !== sesion.fecha;
        fechaAnterior = sesion.fecha;
        return (
          <div key={sesion.idHorario}>
            {mostrarFecha && <h4 className="rx-calendar-list-date">{tituloFecha(sesion.fecha)}</h4>}
            <article className={`rx-calendar-list-item ${claseTonoInstructor(sesion.entrenadorId)}${sesion.estatus === 'inactivo' ? ' is-cancelled' : ''}`}>
              <i className="rx-calendar-list-color" />
              <div className="rx-calendar-list-time"><strong>{sesion.horaInicio}</strong><span>{sesion.horaFin}</span></div>
              <div className="rx-calendar-list-copy"><strong><MarcaClase color={colorClaseHorario(sesion, clases)} />{sesion.nombreClase}</strong><span>{sesion.nombreEntrenador} · {sesion.salon}</span></div>
              <span className="rx-calendar-list-capacity hz-capacity"><MedidorOcupacion horario={sesion} variante="lista" />{ocupacionHorario(sesion)}/{sesion.capacidadTotal} lugares</span>
              <IndicadoresSesion horario={sesion} />
              <BotonEditarSesion horario={sesion} onEdit={onEdit} />
            </article>
          </div>
        );
      })}
    </div>
  );
}

/* Selector de días compartido por "Programar clase" y "Editar programación". */
function SelectorDias({ value, onChange, etiqueta }: { value: number[]; onChange: (dias: number[]) => void; etiqueta: string }) {
  const ordenar = (dias: number[]) => [...dias].sort((a, b) => a - b);
  const alternar = (dia: number) => onChange(ordenar(value.includes(dia) ? value.filter(actual => actual !== dia) : [...value, dia]));
  const igual = (dias: number[]) => dias.length === value.length && dias.every(dia => value.includes(dia));
  const ENTRE_SEMANA = [1, 2, 3, 4, 5];
  const TODOS = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div>
      <div className="rx-day-picker" role="group" aria-label={etiqueta}>
        {ORDEN_DIAS.map(dia => (
          <button key={dia} type="button" className="rx-day-button" aria-pressed={value.includes(dia)}
            aria-label={DIAS_SEMANA[dia]} title={DIAS_SEMANA[dia]} onClick={() => alternar(dia)}>
            {DIAS_ABREVIADOS[dia]}
          </button>
        ))}
      </div>
      <div className="hz-day-presets">
        <button type="button" className="hz-link-btn" aria-pressed={igual(ENTRE_SEMANA)} onClick={() => onChange(ENTRE_SEMANA)}>Lunes a viernes</button>
        <button type="button" className="hz-link-btn" aria-pressed={igual(TODOS)} onClick={() => onChange(TODOS)}>Todos los días</button>
        <button type="button" className="hz-link-btn" disabled={value.length === 0} onClick={() => onChange([])}>Quitar todos</button>
      </div>
      <p className="rx-help-text">
        {value.length > 0
          ? ORDEN_DIAS.filter(dia => value.includes(dia)).map(dia => DIAS_SEMANA[dia]).join(', ')
          : 'Selecciona uno o varios días.'}
      </p>
    </div>
  );
}

/*
 * Tablero de la semana fija: un solo tablero con los días en columnas (lunes primero).
 * La sala aparece en cada regla, así no hay que recorrer un tablero por sala.
 */
function ProgramacionSemanal({ plantillas, clases, hayFiltros, onCreate, onEdit, onLimpiarFiltros }: {
  plantillas: PlantillaHorario[];
  clases: Clase[];
  hayFiltros: boolean;
  onCreate: () => void;
  onEdit: (plantilla: PlantillaHorario) => void;
  onLimpiarFiltros: () => void;
}) {
  const reglas = plantillas.filter(p => p.estatus === 'activo');

  return (
    <section aria-label="Programación semanal">
      <p className="hz-board-note">
        Cada regla se repite todas las semanas y crea sus sesiones automáticamente. Al editar una regla, las sesiones que ya tienen reservaciones no cambian.
      </p>

      {reglas.length === 0 ? (
        <div className="hz-empty">
          <strong>{hayFiltros ? 'Ninguna regla coincide con los filtros' : 'Todavía no hay clases programadas cada semana'}</strong>
          <p>{hayFiltros ? 'Prueba con otro instructor, sala o clase.' : 'Programa una clase y sus sesiones se crearán solas para las próximas semanas.'}</p>
          {hayFiltros
            ? <button type="button" className="rx-btn rx-btn--outline" onClick={onLimpiarFiltros}>Limpiar filtros</button>
            : <button type="button" className="rx-btn rx-btn--accent" onClick={onCreate}>Programar clase</button>}
        </div>
      ) : (
        <div className="hz-board-scroll">
          <div className="hz-board-grid">
            {ORDEN_DIAS.map(dia => {
              const delDia = reglas.filter(p => p.diaSemana === dia).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
              return (
                <div key={dia} className="hz-board-day">
                  <h4>{DIAS_SEMANA[dia]}<span>{delDia.length}</span></h4>
                  {delDia.length === 0 && <p className="hz-board-empty">Sin clases</p>}
                  {delDia.map(regla => {
                    const clase = clases.find(c => c.idClase === regla.idClase);
                    return (
                      <button
                        type="button"
                        key={regla.idPlantilla}
                        className={`hz-rule ${claseTonoInstructor(regla.entrenadorId)}`}
                        onClick={() => onEdit(regla)}
                        aria-label={`Editar programación de ${regla.nombreClase}, ${DIAS_SEMANA[dia]} de ${regla.horaInicio} a ${regla.horaFin}`}
                      >
                        <strong className="hz-rule-time">{regla.horaInicio}–{regla.horaFin}</strong>
                        <span className="hz-rule-name"><MarcaClase color={clase?.color ?? '#9298a3'} />{regla.nombreClase}</span>
                        <span className="hz-rule-meta">{regla.nombreEntrenador || 'Sin instructor'}</span>
                        <span className="hz-rule-room">{regla.salon}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function HorariosPage() {
  /*
   * Los horarios, las clases y los entrenadores viven en el backend de la
   * administrativa (MongoDB). Los tres se cargan juntos: los horarios alimentan
   * la tabla y las clases/entrenadores rellenan los selects del formulario.
   */
  const [horarios, setHorarios] = useState<HorarioClase[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [entrenadores, setEntrenadores] = useState<Usuario[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaHorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; editing?: HorarioClase }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [scopeModal, setScopeModal] = useState<{ open: boolean; session?: HorarioClase }>({ open: false });
  const [exceptionModal, setExceptionModal] = useState<{ open: boolean; session?: HorarioClase }>({ open: false });
  const [exceptionForm, setExceptionForm] = useState<EditarExcepcionSesion>(EMPTY_EXCEPTION_FORM);
  const [exceptionSaving, setExceptionSaving] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<VistaCalendario>('semana');
  const [calendarDate, setCalendarDate] = useState(obtenerFechaLocal);
  const [vistaPagina, setVistaPagina] = useState<'calendario' | 'semana'>('calendario');
  const [filtros, setFiltros] = useState<FiltrosHorario>(FILTROS_VACIOS);
  const [weeklyModal, setWeeklyModal] = useState<{ open: boolean; editing?: PlantillaHorario }>({ open: false });
  const [weeklyForm, setWeeklyForm] = useState(EMPTY_WEEKLY_FORM);
  const [weeklyView, setWeeklyView] = useState<'actions' | 'edit' | 'deactivate' | 'delete'>('actions');
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [weeklyResult, setWeeklyResult] = useState<string | null>(null);
  const [createWeeklyModal, setCreateWeeklyModal] = useState(false);
  const [createWeeklyForm, setCreateWeeklyForm] = useState<CrearProgramacionSemanal>(EMPTY_CREATE_WEEKLY_FORM);
  const [createWeeklySaving, setCreateWeeklySaving] = useState(false);
  const [createWeeklyError, setCreateWeeklyError] = useState<string | null>(null);
  const [createWeeklyResult, setCreateWeeklyResult] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hs, cs, us, ps] = await Promise.all([
        horariosApi.listar(),
        api.get<Clase[]>('/clases'),
        api.get<Usuario[]>('/usuarios'),
        programacionApi.listar(),
      ]);
      setHorarios(hs);
      setClases(cs);
      setEntrenadores(us.filter(u => u.rol === 'entrenador' && u.estatus === 'activo'));
      setPlantillas(ps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los horarios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const filtrosActivos = hayFiltrosActivos(filtros);
  const horariosVisibles = useMemo(() => horarios.filter(h => coincideConFiltros(h, filtros)), [horarios, filtros]);
  const reglasActivas = useMemo(() => plantillas.filter(p => p.estatus === 'activo'), [plantillas]);
  const reglasVisibles = useMemo(() => reglasActivas.filter(p => coincideConFiltros(p, filtros)), [reglasActivas, filtros]);

  /* Resumen en lenguaje natural para el encabezado: lo que importa hoy y esta semana. */
  const resumen = useMemo(() => {
    const hoy = obtenerFechaLocal();
    const inicio = inicioSemana(hoy);
    const fin = sumarDiasLocal(inicio, 6);
    const activas = horarios.filter(h => h.estatus === 'activo');
    const deHoy = activas.filter(h => h.fecha === hoy);
    return {
      hoy: deHoy.length,
      llenasHoy: deHoy.filter(estaLlena).length,
      semana: activas.filter(h => h.fecha >= inicio && h.fecha <= fin).length,
    };
  }, [horarios]);

  const conteoFiltros = vistaPagina === 'calendario'
    ? `Mostrando ${horariosVisibles.length} de ${horarios.length} ${horarios.length === 1 ? 'sesión' : 'sesiones'}`
    : `Mostrando ${reglasVisibles.length} de ${reglasActivas.length} ${reglasActivas.length === 1 ? 'regla' : 'reglas'}`;

  const claseOptions = clases.filter(c => c.estatus === 'activo').map(c => ({ value: c.idClase, label: c.nombre }));
  const entrenadorOptions = entrenadores.map(u => ({ value: u.idUsuario, label: `${u.nombre} ${u.apellidos}` }));

  const selectedCreateClass = clases.find(clase => clase.idClase === createWeeklyForm.idClase);
  const inicioCreateWeekly = minutosDeHora(createWeeklyForm.horaInicio);
  const finCreateWeekly = minutosDeHora(createWeeklyForm.horaFin);
  const createWeeklyDuration = inicioCreateWeekly !== null && finCreateWeekly !== null && finCreateWeekly > inicioCreateWeekly
    ? finCreateWeekly - inicioCreateWeekly
    : null;

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModal({ open: true });
  };

  const moveCalendar = (direction: -1 | 1) => {
    setCalendarDate(actual => {
      if (calendarView === 'mes') return sumarMeses(actual, direction);
      if (calendarView === 'semana') return sumarDiasLocal(actual, direction * 7);
      return sumarDiasLocal(actual, direction);
    });
  };

  const selectCalendarDay = (fecha: string) => {
    setCalendarDate(fecha);
    setCalendarView('dia');
  };

  const openCreateWeekly = () => {
    setCreateWeeklyForm({ ...EMPTY_CREATE_WEEKLY_FORM, fechaInicio: obtenerFechaLocal() });
    setCreateWeeklyError(null);
    setCreateWeeklyResult(null);
    setCreateWeeklyModal(true);
  };

  const saveCreateWeekly = async () => {
    const hoy = obtenerFechaLocal();
    if (!createWeeklyForm.idClase) { setCreateWeeklyError('Selecciona la clase.'); return; }
    if (!createWeeklyForm.entrenadorId) { setCreateWeeklyError('Selecciona el instructor.'); return; }
    if (!createWeeklyForm.salon.trim()) { setCreateWeeklyError('Selecciona la sala.'); return; }
    if (!createWeeklyForm.fechaInicio) { setCreateWeeklyError('Selecciona la fecha de inicio.'); return; }
    if (createWeeklyForm.fechaInicio < hoy) { setCreateWeeklyError('La fecha de inicio no puede estar en el pasado.'); return; }
    if (createWeeklyForm.fechaFin && createWeeklyForm.fechaFin < createWeeklyForm.fechaInicio) {
      setCreateWeeklyError('La fecha final no puede ser anterior a la fecha de inicio.');
      return;
    }
    if (createWeeklyForm.fechaFin && diasEntreFechas(createWeeklyForm.fechaInicio, createWeeklyForm.fechaFin) > 366) {
      setCreateWeeklyError('La programación no puede superar 366 días.');
      return;
    }
    if (!createWeeklyForm.horaInicio || !createWeeklyForm.horaFin) {
      setCreateWeeklyError('Las horas de inicio y fin son obligatorias.');
      return;
    }
    if (inicioCreateWeekly === null || finCreateWeekly === null) {
      setCreateWeeklyError('Las horas deben tener formato HH:MM.');
      return;
    }
    if (finCreateWeekly <= inicioCreateWeekly) {
      setCreateWeeklyError('La hora final debe ser posterior a la hora inicial.');
      return;
    }
    if (finCreateWeekly - inicioCreateWeekly < DURACION_MINIMA_MINUTOS) {
      setCreateWeeklyError(`La duración debe ser de al menos ${DURACION_MINIMA_MINUTOS} minutos.`);
      return;
    }
    if (createWeeklyForm.diasSemana.length === 0) {
      setCreateWeeklyError('Selecciona al menos un día de la semana.');
      return;
    }

    setCreateWeeklySaving(true);
    setCreateWeeklyError(null);
    setCreateWeeklyResult(null);
    try {
      const payload: CrearProgramacionSemanal = {
        ...createWeeklyForm,
        salon: createWeeklyForm.salon.trim(),
        diasSemana: [...createWeeklyForm.diasSemana].sort((a, b) => a - b),
      };
      if (!payload.fechaFin) delete payload.fechaFin;
      const resultado = await programacionApi.crear(payload);
      setCreateWeeklyResult(
        `${resultado.mensaje} Se crearon ${resultado.plantillas.length} reglas y ${resultado.generacion.sesionesCreadas} sesiones; ${resultado.generacion.sesionesExistentes} ya existían.`,
      );
      await cargar();
    } catch (e) {
      setCreateWeeklyError(e instanceof Error ? e.message : 'No se pudo crear la programación semanal.');
    } finally {
      setCreateWeeklySaving(false);
    }
  };

  /* Copiamos la regla elegida para que el usuario solo cambie lo necesario. */
  const openWeeklyEdit = (plantilla: PlantillaHorario, aplicarDesde = obtenerFechaLocal(), abrirEditor = false) => {
    const identificadorSerie = plantilla.serieId || plantilla.idPlantilla;
    const plantillasSerie = plantillas.filter(item => (
      (item.serieId || item.idPlantilla) === identificadorSerie && item.estatus === 'activo'
    ));
    const plantillaBase = plantillasSerie[0] ?? plantilla;
    setWeeklyForm({
      idClase: plantillaBase.idClase,
      entrenadorId: plantillaBase.entrenadorId ?? '',
      horaInicio: plantillaBase.horaInicio,
      horaFin: plantillaBase.horaFin,
      salon: plantillaBase.salon,
      diasSemana: [...new Set((plantillasSerie.length ? plantillasSerie : [plantilla]).map(item => item.diaSemana))].sort((a, b) => a - b),
      aplicarDesde,
      visibleReservas: plantillaBase.visibleReservas ?? true,
      listaEsperaHabilitada: plantillaBase.listaEsperaHabilitada ?? false,
    });
    setWeeklyView(abrirEditor ? 'edit' : 'actions');
    setWeeklyError(null);
    setWeeklyResult(null);
    setWeeklyModal({ open: true, editing: plantilla });
  };

  const plantillaDeSesion = (sesion: HorarioClase) => plantillas.find(item => item.idPlantilla === sesion.idPlantilla);

  const openSessionEdit = (sesion: HorarioClase) => {
    if (sesion.origen !== 'plantilla' || !sesion.idPlantilla) {
      setForm({
        idClase: sesion.idClase, entrenadorId: sesion.entrenadorId, fecha: sesion.fecha,
        horaInicio: sesion.horaInicio, horaFin: sesion.horaFin, capacidadTotal: String(sesion.capacidadTotal),
        salon: sesion.salon, estatus: sesion.estatus, visibleReservas: sesion.visibleReservas ?? true,
        listaEsperaHabilitada: sesion.listaEsperaHabilitada ?? false,
      });
      setFormError(null);
      setModal({ open: true, editing: sesion });
      return;
    }
    setScopeModal({ open: true, session: sesion });
  };

  const openExceptionEdit = (sesion: HorarioClase) => {
    setExceptionForm({
      entrenadorId: sesion.entrenadorId,
      salon: sesion.salon,
      horaInicio: sesion.horaInicio,
      horaFin: sesion.horaFin,
      estatus: sesion.estatus,
      visibleReservas: sesion.visibleReservas ?? true,
      listaEsperaHabilitada: sesion.listaEsperaHabilitada ?? false,
    });
    setExceptionError(null);
    setScopeModal({ open: false });
    setExceptionModal({ open: true, session: sesion });
  };

  const openSeriesFromSession = (sesion: HorarioClase, aplicarDesde: string) => {
    const plantilla = plantillaDeSesion(sesion);
    if (!plantilla) {
      setScopeModal({ open: false });
      setError('No se encontró la programación semanal de esta sesión.');
      return;
    }
    setScopeModal({ open: false });
    openWeeklyEdit(plantilla, aplicarDesde, true);
  };

  const fechaInicioCompletaDeSesion = (sesion: HorarioClase) => {
    const plantilla = plantillaDeSesion(sesion);
    if (!plantilla) return obtenerFechaLocal();
    const identificadorSerie = plantilla.serieId || plantilla.idPlantilla;
    const inicios = plantillas
      .filter(item => (item.serieId || item.idPlantilla) === identificadorSerie)
      .map(item => item.vigenteDesde)
      .filter(Boolean)
      .sort();
    const inicioSerie = inicios[0] ?? obtenerFechaLocal();
    return inicioSerie > obtenerFechaLocal() ? inicioSerie : obtenerFechaLocal();
  };

  const saveException = async () => {
    const sesion = exceptionModal.session;
    if (!sesion) return;
    if (!exceptionForm.entrenadorId) { setExceptionError('Selecciona el instructor.'); return; }
    if (!exceptionForm.salon.trim()) { setExceptionError('Selecciona la sala.'); return; }
    const inicio = minutosDeHora(exceptionForm.horaInicio);
    const fin = minutosDeHora(exceptionForm.horaFin);
    if (inicio === null || fin === null) { setExceptionError('Las horas deben tener formato HH:MM.'); return; }
    if (fin <= inicio) { setExceptionError('La hora de fin debe ser posterior a la hora de inicio.'); return; }
    if (fin - inicio < DURACION_MINIMA_MINUTOS) {
      setExceptionError(`La duración debe ser de al menos ${DURACION_MINIMA_MINUTOS} minutos.`);
      return;
    }
    setExceptionSaving(true);
    setExceptionError(null);
    try {
      const resultado = await horariosApi.editarExcepcion(sesion.idHorario, {
        ...exceptionForm,
        salon: exceptionForm.salon.trim(),
      });
      setHorarios(prev => prev.map(item => item.idHorario === resultado.horario.idHorario ? resultado.horario : item));
      setExceptionModal({ open: false });
    } catch (e) {
      setExceptionError(e instanceof Error ? e.message : 'No se pudo editar esta sesión.');
    } finally {
      setExceptionSaving(false);
    }
  };

  /*
   * La ruta semanal actualiza las sesiones libres y deja quietas las reservadas.
   * Al final recargamos todo para mostrar exactamente lo que quedo en la base.
   */
  const saveWeekly = async () => {
    const plantilla = weeklyModal.editing;
    if (!plantilla) return;

    if (!weeklyForm.idClase) { setWeeklyError('Selecciona la clase.'); return; }
    if (!weeklyForm.entrenadorId) { setWeeklyError('Selecciona el instructor.'); return; }
    if (!weeklyForm.aplicarDesde) { setWeeklyError('Selecciona desde que fecha se aplicara el cambio.'); return; }
    if (!weeklyForm.horaInicio || !weeklyForm.horaFin) { setWeeklyError('Las horas de inicio y fin son obligatorias.'); return; }
    const inicio = minutosDeHora(weeklyForm.horaInicio);
    const fin = minutosDeHora(weeklyForm.horaFin);
    if (inicio === null || fin === null) { setWeeklyError('Las horas deben tener formato HH:MM.'); return; }
    if (fin <= inicio) { setWeeklyError('La hora de fin debe ser posterior a la hora de inicio.'); return; }
    if (fin - inicio < DURACION_MINIMA_MINUTOS) {
      setWeeklyError(`La duracion del horario debe ser de al menos ${DURACION_MINIMA_MINUTOS} minutos.`);
      return;
    }
    if (!weeklyForm.diasSemana.length) { setWeeklyError('Selecciona al menos un día de la semana.'); return; }

    setWeeklySaving(true);
    setWeeklyError(null);
    setWeeklyResult(null);
    try {
      const identificadorSerie = plantilla.serieId || plantilla.idPlantilla;
      const resultado = await programacionApi.editarSerie(identificadorSerie, weeklyForm);
      setWeeklyResult(`${resultado.mensaje} ${resultado.sesionesCreadas ?? 0} sesiones creadas, ${resultado.sesionesEliminadas} reemplazadas y ${resultado.sesionesProtegidas} protegidas.`);
      await cargar();
    } catch (e) {
      setWeeklyError(e instanceof Error ? e.message : 'No se pudo editar la semana.');
    } finally {
      setWeeklySaving(false);
    }
  };

  const applyWeeklyAction = async (action: 'deactivate' | 'delete') => {
    const plantilla = weeklyModal.editing;
    if (!plantilla) return;
    if (!weeklyForm.aplicarDesde) { setWeeklyError('Selecciona desde qué fecha aplicar la operación.'); return; }
    if (weeklyForm.aplicarDesde < obtenerFechaLocal()) { setWeeklyError('La fecha de aplicación no puede estar en el pasado.'); return; }
    const identificadorSerie = plantilla.serieId || plantilla.idPlantilla;
    setWeeklySaving(true);
    setWeeklyError(null);
    setWeeklyResult(null);
    try {
      const resultado = action === 'deactivate'
        ? await programacionApi.desactivarSerie(identificadorSerie, weeklyForm.aplicarDesde)
        : await programacionApi.eliminarFuturoSerie(identificadorSerie, weeklyForm.aplicarDesde);
      const afectadas = action === 'deactivate' ? resultado.sesionesDesactivadas ?? 0 : resultado.sesionesEliminadas;
      setWeeklyResult(`${resultado.mensaje} ${afectadas} sesiones afectadas y ${resultado.sesionesProtegidas} protegidas.`);
      await cargar();
    } catch (e) {
      setWeeklyError(e instanceof Error ? e.message : 'No se pudo actualizar la programación semanal.');
    } finally {
      setWeeklySaving(false);
    }
  };

  /*
   * Guarda el horario en el backend: crea con POST o actualiza con PATCH. El
   * nombre de la clase y el del entrenador se resuelven aquí con las listas
   * reales y viajan en el payload porque la tabla los muestra directamente.
   */
  const save = async () => {
    const capacidad = Number(form.capacidadTotal);
    if (!form.idClase) { setFormError('Selecciona la clase.'); return; }
    if (!form.fecha) { setFormError('La fecha es obligatoria.'); return; }
    if (!form.horaInicio || !form.horaFin) { setFormError('Las horas de inicio y fin son obligatorias.'); return; }
    // El intervalo debe ser valido y durar al menos 30 minutos.
    const inicio = minutosDeHora(form.horaInicio);
    const fin = minutosDeHora(form.horaFin);
    if (inicio === null || fin === null) { setFormError('Las horas deben tener formato HH:MM.'); return; }
    if (fin <= inicio) { setFormError('La hora de fin debe ser posterior a la hora de inicio.'); return; }
    if (fin - inicio < DURACION_MINIMA_MINUTOS) {
      setFormError(`La duracion del horario debe ser de al menos ${DURACION_MINIMA_MINUTOS} minutos.`);
      return;
    }
    if (!Number.isFinite(capacidad) || capacidad < 1) { setFormError('La capacidad debe ser al menos 1.'); return; }

    const clase = clases.find(c => c.idClase === form.idClase);
    const ent = entrenadores.find(u => u.idUsuario === form.entrenadorId);
    const payload = {
      idClase: form.idClase,
      nombreClase: clase?.nombre ?? '',
      entrenadorId: form.entrenadorId,
      nombreEntrenador: ent ? `${ent.nombre} ${ent.apellidos}` : '',
      fecha: form.fecha,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
      capacidadTotal: capacidad,
      salon: form.salon,
      estatus: form.estatus,
      visibleReservas: form.visibleReservas,
      listaEsperaHabilitada: form.listaEsperaHabilitada,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (modal.editing) {
        const guardado = await horariosApi.editar(modal.editing.idHorario, payload);
        setHorarios(prev => prev.map(h => h.idHorario === guardado.idHorario ? guardado : h));
      } else {
        const creado = await horariosApi.crear(payload);
        setHorarios(prev => [...prev, creado]);
      }
      setModal({ open: false });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el horario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rx-admin-page rx-schedule-page hz-page">
      <div className="hz-head">
        <div className="rx-calendar-view-switch hz-modes" role="tablist" aria-label="Vista de horarios">
          <button type="button" role="tab" aria-selected={vistaPagina === 'calendario'} onClick={() => setVistaPagina('calendario')}>
            Calendario
          </button>
          <button type="button" role="tab" aria-selected={vistaPagina === 'semana'} onClick={() => setVistaPagina('semana')}>
            Semana fija
            {!loading && <span className="hz-count">{reglasActivas.length}</span>}
          </button>
        </div>

        {!loading && !error && (
          <p className="hz-today" aria-live="polite">
            {resumen.hoy === 0
              ? 'Hoy no hay clases.'
              : <><strong>{resumen.hoy}</strong> {resumen.hoy === 1 ? 'clase' : 'clases'} hoy{resumen.llenasHoy > 0 && <>, <strong>{resumen.llenasHoy}</strong> {resumen.llenasHoy === 1 ? 'llena' : 'llenas'}</>}.</>}
            {' '}<strong>{resumen.semana}</strong> en la semana.
          </p>
        )}

        <div className="rx-page-actions">
          <button type="button" onClick={openNew} className="rx-btn rx-btn--outline">Sesión única</button>
          <button type="button" onClick={openCreateWeekly} className="rx-btn rx-btn--accent">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Programar clase
          </button>
        </div>
      </div>

      {!loading && !error && (
        <BarraFiltros entrenadores={entrenadores} horarios={horarios} plantillas={reglasActivas} clases={clases}
          filtros={filtros} onChange={setFiltros} conteo={conteoFiltros} />
      )}

      {vistaPagina === 'calendario' ? (
        <section className="rx-calendar-card">
          <div className="rx-calendar-toolbar">
            <div className="rx-calendar-navigation" aria-label="Navegación del calendario">
              <button type="button" onClick={() => moveCalendar(-1)} aria-label="Periodo anterior">‹</button>
              <button type="button" className="rx-calendar-today" onClick={() => setCalendarDate(obtenerFechaLocal())}>Hoy</button>
              <button type="button" onClick={() => moveCalendar(1)} aria-label="Periodo siguiente">›</button>
            </div>
            <h3>{tituloPeriodo(calendarView, calendarDate)}</h3>
            <div className="rx-calendar-view-switch" role="tablist" aria-label="Vista del calendario">
              {(['mes', 'semana', 'dia', 'lista'] as VistaCalendario[]).map(vista => (
                <button type="button" role="tab" aria-selected={calendarView === vista} key={vista} onClick={() => setCalendarView(vista)}>
                  {vista === 'dia' ? 'Día' : vista[0].toUpperCase() + vista.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <DataState loading={loading} error={error} empty={false} onRetry={() => void cargar()}>
            {filtrosActivos && horariosVisibles.length === 0 ? (
              <div className="hz-empty">
                <strong>Ninguna sesión coincide con los filtros</strong>
                <p>Prueba con otro instructor, sala o clase.</p>
                <button type="button" className="rx-btn rx-btn--outline" onClick={() => setFiltros(FILTROS_VACIOS)}>Limpiar filtros</button>
              </div>
            ) : (
              <CalendarioSesiones horarios={horariosVisibles} clases={clases} vista={calendarView} fechaReferencia={calendarDate}
                onSelectDay={selectCalendarDay} onEdit={openSessionEdit} />
            )}
          </DataState>
        </section>
      ) : (
        <section className="rx-admin-card hz-board-card">
          <DataState loading={loading} error={error} empty={false} onRetry={() => void cargar()}>
            <ProgramacionSemanal plantillas={reglasVisibles} clases={clases} hayFiltros={filtrosActivos}
              onCreate={openCreateWeekly} onEdit={openWeeklyEdit} onLimpiarFiltros={() => setFiltros(FILTROS_VACIOS)} />
          </DataState>
        </section>
      )}

      <Modal open={createWeeklyModal} onClose={() => !createWeeklySaving && setCreateWeeklyModal(false)} title="Programar clase" size="lg">
        <div className="rx-schedule-form">
          <div className="rx-schedule-form-grid">
            <label className="rx-field rx-schedule-span-2">
              <span className="rx-label">Clase *</span>
              <select className="rx-select" required value={createWeeklyForm.idClase}
                onChange={e => setCreateWeeklyForm(actual => ({ ...actual, idClase: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {claseOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {selectedCreateClass && (
              <div className="rx-class-summary rx-schedule-span-2" aria-live="polite">
                <span className="rx-class-summary-color" style={{ backgroundColor: selectedCreateClass.color }} aria-hidden="true" />
                <div>
                  <strong>{selectedCreateClass.nombre}</strong>
                  <p>Capacidad de la clase: {selectedCreateClass.capacidad} personas</p>
                </div>
                <div className="rx-class-summary-meta">
                  <span>Precio: ${Number(selectedCreateClass.precio).toFixed(2)}</span>
                  <span className={`rx-badge ${selectedCreateClass.estatus === 'activo' ? 'rx-badge--success' : 'rx-badge--neutral'}`}>
                    {selectedCreateClass.estatus === 'activo' ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
            )}

            <label className="rx-field">
              <span className="rx-label">Instructor *</span>
              <select className="rx-select" required value={createWeeklyForm.entrenadorId}
                onChange={e => setCreateWeeklyForm(actual => ({ ...actual, entrenadorId: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {entrenadorOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="rx-field">
              <span className="rx-label">Sala *</span>
              <select className="rx-select" required value={createWeeklyForm.salon}
                onChange={e => setCreateWeeklyForm(actual => ({ ...actual, salon: e.target.value }))}>
                {salonOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="rx-field rx-schedule-span-2">
              <span className="rx-label">Empieza el *</span>
              <input className="rx-input" type="date" min={obtenerFechaLocal()} required value={createWeeklyForm.fechaInicio}
                onChange={e => setCreateWeeklyForm(actual => ({ ...actual, fechaInicio: e.target.value }))} />
            </label>

            <label className="rx-field">
              <span className="rx-label">Hora inicial *</span>
              <input className="rx-input" type="time" required value={createWeeklyForm.horaInicio}
                onChange={e => setCreateWeeklyForm(actual => ({ ...actual, horaInicio: e.target.value }))} />
            </label>

            <label className="rx-field">
              <span className="rx-label">Hora final *</span>
              <input className="rx-input" type="time" required value={createWeeklyForm.horaFin}
                onChange={e => setCreateWeeklyForm(actual => ({ ...actual, horaFin: e.target.value }))} />
            </label>

            <div className="rx-duration-box rx-schedule-span-2" aria-live="polite">
              <span>Duración</span>
              <strong>{createWeeklyDuration === null ? 'Selecciona un horario válido' : `${createWeeklyDuration} minutos`}</strong>
            </div>

            <fieldset className="rx-schedule-span-2">
              <legend className="rx-label">Se repite los *</legend>
              <SelectorDias value={createWeeklyForm.diasSemana} etiqueta="Días en que se repite la clase"
                onChange={dias => setCreateWeeklyForm(actual => ({ ...actual, diasSemana: dias }))} />
            </fieldset>

            <label className="rx-field rx-schedule-span-2">
              <span className="rx-label">Termina el (opcional)</span>
              <input className="rx-input" type="date" min={createWeeklyForm.fechaInicio || obtenerFechaLocal()}
                value={createWeeklyForm.fechaFin ?? ''}
                onChange={e => setCreateWeeklyForm(actual => ({ ...actual, fechaFin: e.target.value }))} />
              <span className="rx-help-text">
                {createWeeklyForm.fechaFin ? 'Se generarán sesiones hasta la fecha seleccionada.' : 'Sin fecha final: se generarán sesiones para los próximos 56 días.'}
              </span>
            </label>
          </div>

          <section className="rx-schedule-options" aria-labelledby="schedule-reservations-title">
            <h3 id="schedule-reservations-title">Reservaciones</h3>
            <div className="rx-switch-row">
              <div>
                <strong>Visible para reservaciones públicas</strong>
                <p>Guarda si estas sesiones podrán mostrarse al público.</p>
              </div>
              <button type="button" role="switch" aria-checked={createWeeklyForm.visibleReservas}
                className="rx-switch" onClick={() => setCreateWeeklyForm(actual => ({ ...actual, visibleReservas: !actual.visibleReservas }))}>
                <span />
              </button>
            </div>
            <div className="rx-switch-row">
              <div>
                <strong>Lista de espera</strong>
                <p>Guarda si esta serie tendrá habilitada la lista de espera.</p>
              </div>
              <button type="button" role="switch" aria-checked={createWeeklyForm.listaEsperaHabilitada}
                className="rx-switch" onClick={() => setCreateWeeklyForm(actual => ({ ...actual, listaEsperaHabilitada: !actual.listaEsperaHabilitada }))}>
                <span />
              </button>
            </div>
          </section>

          {createWeeklyError && <p className="rx-schedule-message rx-schedule-message--error" role="alert">{createWeeklyError}</p>}
          {createWeeklyResult && <p className="rx-schedule-message rx-schedule-message--success" role="status">{createWeeklyResult}</p>}
          <div className="rx-schedule-actions">
            {createWeeklyResult ? (
              <button type="button" onClick={() => setCreateWeeklyModal(false)} className="rx-btn rx-btn--accent">Listo</button>
            ) : (
              <>
                <button type="button" onClick={() => setCreateWeeklyModal(false)} disabled={createWeeklySaving} className="rx-btn rx-btn--outline">
                  Cancelar
                </button>
                <button type="button" onClick={() => void saveCreateWeekly()} disabled={createWeeklySaving} className="rx-btn rx-btn--accent">
                  {createWeeklySaving ? 'Programando...' : 'Programar clase'}
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={weeklyModal.open} onClose={() => !weeklySaving && setWeeklyModal({ open: false })}
        title={weeklyView === 'actions' ? 'Programación semanal' : weeklyView === 'edit' ? 'Editar programación semanal' : weeklyView === 'deactivate' ? 'Desactivar programación' : 'Eliminar programación futura'} size="lg">
        {weeklyModal.editing && weeklyView === 'actions' && (
          <div className="space-y-3">
            <div className="rx-context-card">
              <p className="rx-context-title">{weeklyModal.editing.nombreClase}</p>
              <p className="rx-context-copy">
                {weeklyForm.diasSemana.map(dia => DIAS_SEMANA[dia]).join(', ')} · {weeklyModal.editing.horaInicio}–{weeklyModal.editing.horaFin}
              </p>
              <p className="rx-context-meta">{weeklyModal.editing.salon} · {weeklyModal.editing.nombreEntrenador}</p>
            </div>
            <button type="button" onClick={() => { setWeeklyView('edit'); setWeeklyError(null); setWeeklyResult(null); }}
              className="rx-choice-card">
              <span className="block text-sm font-semibold text-gray-900">Editar programación semanal</span>
              <span className="mt-1 block text-xs text-gray-500">Cambiar clase, instructor, sala, horario, días o reservaciones.</span>
            </button>
            <button type="button" onClick={() => { setWeeklyView('deactivate'); setWeeklyError(null); setWeeklyResult(null); }}
              className="rx-choice-card rx-choice-card--warning">
              <span className="block text-sm font-semibold text-amber-900">Desactivar programación</span>
              <span className="mt-1 block text-xs text-amber-700">Las sesiones futuras libres quedarán inactivas.</span>
            </button>
            <button type="button" onClick={() => { setWeeklyView('delete'); setWeeklyError(null); setWeeklyResult(null); }}
              className="rx-choice-card rx-choice-card--danger">
              <span className="block text-sm font-semibold text-red-900">Eliminar programación futura</span>
              <span className="mt-1 block text-xs text-red-700">Las sesiones futuras libres se eliminarán definitivamente.</span>
            </button>
          </div>
        )}

        {weeklyView === 'edit' && (
          <div className="rx-schedule-form">
            <div className="rx-schedule-form-grid">
              <SelectField label="Clase" required value={weeklyForm.idClase}
                onChange={e => setWeeklyForm(f => ({ ...f, idClase: e.target.value }))}
                options={claseOptions} className="rx-schedule-span-2" />
              <SelectField label="Instructor" required value={weeklyForm.entrenadorId}
                onChange={e => setWeeklyForm(f => ({ ...f, entrenadorId: e.target.value }))}
                options={entrenadorOptions} className="rx-schedule-span-2" />
              <SelectField label="Sala" value={weeklyForm.salon}
                onChange={e => setWeeklyForm(f => ({ ...f, salon: e.target.value }))}
                options={salonOptions} />
              <div className="rx-duration-box rx-capacity-box">
                <span>Capacidad de la clase</span>
                <strong>{clases.find(clase => clase.idClase === weeklyForm.idClase)?.capacidad ?? '—'} personas</strong>
              </div>
              <InputField label="Hora inicio" required type="time" value={weeklyForm.horaInicio}
                onChange={e => setWeeklyForm(f => ({ ...f, horaInicio: e.target.value }))} />
              <InputField label="Hora fin" required type="time" value={weeklyForm.horaFin}
                onChange={e => setWeeklyForm(f => ({ ...f, horaFin: e.target.value }))} />
              <fieldset className="rx-schedule-span-2">
                <legend className="rx-label">Días de la semana <span className="rx-required-mark">*</span></legend>
                <SelectorDias value={weeklyForm.diasSemana} etiqueta="Días de la programación semanal"
                  onChange={dias => setWeeklyForm(f => ({ ...f, diasSemana: dias }))} />
              </fieldset>
              <InputField label="Aplicar cambios desde" required type="date" min={obtenerFechaLocal()} value={weeklyForm.aplicarDesde}
                onChange={e => setWeeklyForm(f => ({ ...f, aplicarDesde: e.target.value }))} className="rx-schedule-span-2" />
            </div>
            <section className="rx-schedule-options" aria-labelledby="weekly-reservations-title">
              <h3 id="weekly-reservations-title">Reservaciones</h3>
              <div className="rx-switch-row">
                <div><strong>Visible para reservaciones públicas</strong><p>Mostrar las nuevas sesiones en reservaciones.</p></div>
                <button type="button" role="switch" aria-checked={weeklyForm.visibleReservas} className="rx-switch"
                  onClick={() => setWeeklyForm(actual => ({ ...actual, visibleReservas: !actual.visibleReservas }))}><span /></button>
              </div>
              <div className="rx-switch-row">
                <div><strong>Lista de espera</strong><p>Habilitarla cuando la clase alcance su capacidad.</p></div>
                <button type="button" role="switch" aria-checked={weeklyForm.listaEsperaHabilitada} className="rx-switch"
                  onClick={() => setWeeklyForm(actual => ({ ...actual, listaEsperaHabilitada: !actual.listaEsperaHabilitada }))}><span /></button>
              </div>
            </section>
          </div>
        )}

        {(weeklyView === 'deactivate' || weeklyView === 'delete') && (
          <div>
            <InputField label="Aplicar cambios desde" required type="date" min={obtenerFechaLocal()} value={weeklyForm.aplicarDesde}
              onChange={e => setWeeklyForm(f => ({ ...f, aplicarDesde: e.target.value }))} />
            <div className={`mt-4 rounded-xl border p-4 ${weeklyView === 'delete' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-sm font-semibold ${weeklyView === 'delete' ? 'text-red-900' : 'text-amber-900'}`}>
                {weeklyView === 'delete' ? 'Se eliminarán las sesiones futuras libres.' : 'Las sesiones futuras libres quedarán inactivas.'}
              </p>
              <p className={`mt-1 text-xs ${weeklyView === 'delete' ? 'text-red-700' : 'text-amber-700'}`}>
                Las sesiones pasadas no cambiarán. Las sesiones con reservaciones vigentes permanecerán protegidas.
              </p>
            </div>
          </div>
        )}

        {weeklyView !== 'actions' && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800">Las reservaciones canceladas no bloquean el cambio.</p>
          </div>
        )}
        {weeklyError && <p className="rx-schedule-message rx-schedule-message--error">{weeklyError}</p>}
        {weeklyResult && <p className="rx-schedule-message rx-schedule-message--success">{weeklyResult}</p>}

        <div className="rx-schedule-actions">
          <button onClick={() => weeklyView === 'actions' ? setWeeklyModal({ open: false }) : setWeeklyView('actions')} disabled={weeklySaving}
            className="rx-btn rx-btn--outline">
            {weeklyView === 'actions' ? 'Cerrar' : 'Volver'}
          </button>
          {weeklyView === 'edit' && <button onClick={() => void saveWeekly()} disabled={weeklySaving}
            className="rx-btn rx-btn--dark">
            {weeklySaving ? 'Guardando...' : 'Guardar cambios'}
          </button>}
          {weeklyView === 'deactivate' && <button onClick={() => void applyWeeklyAction('deactivate')} disabled={weeklySaving}
            className="rx-btn rx-btn--danger">
            {weeklySaving ? 'Desactivando...' : 'Desactivar programación'}
          </button>}
          {weeklyView === 'delete' && <button onClick={() => void applyWeeklyAction('delete')} disabled={weeklySaving}
            className="rx-btn rx-btn--danger">
            {weeklySaving ? 'Eliminando...' : 'Eliminar programación futura'}
          </button>}
        </div>
      </Modal>

      <Modal open={scopeModal.open} onClose={() => setScopeModal({ open: false })} title="¿Qué deseas editar?" size="sm">
        {scopeModal.session && (
          <div>
            <div className="rx-context-card">
              <p className="rx-context-title">{scopeModal.session.nombreClase}</p>
              <p className="rx-context-copy">{scopeModal.session.fecha} · {scopeModal.session.horaInicio}–{scopeModal.session.horaFin}</p>
              <p className="rx-context-meta">{scopeModal.session.salon} · {scopeModal.session.nombreEntrenador}</p>
            </div>
            <div className="space-y-3" role="radiogroup" aria-label="Alcance de la edición">
              <button type="button" role="radio" aria-checked="false" onClick={() => openExceptionEdit(scopeModal.session!)}
                className="rx-choice-card">
                <span className="rx-choice-title">Solo esta sesión</span>
                <span className="rx-choice-copy">Se guardará como una excepción de la programación semanal.</span>
              </button>
              <button type="button" role="radio" aria-checked="false" onClick={() => openSeriesFromSession(scopeModal.session!, scopeModal.session!.fecha)}
                className="rx-choice-card">
                <span className="rx-choice-title">Esta sesión y las siguientes</span>
                <span className="rx-choice-copy">La serie cambiará desde el {scopeModal.session.fecha}.</span>
              </button>
              <button type="button" role="radio" aria-checked="false" onClick={() => openSeriesFromSession(scopeModal.session!, fechaInicioCompletaDeSesion(scopeModal.session!))}
                className="rx-choice-card">
                <span className="rx-choice-title">Toda la programación</span>
                <span className="rx-choice-copy">Se editará la programación futura completa; las sesiones pasadas permanecerán intactas.</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={exceptionModal.open} onClose={() => !exceptionSaving && setExceptionModal({ open: false })} title="Editar solo esta sesión" size="lg">
        {exceptionModal.session && (
          <div className="rx-schedule-form">
            <div className="rx-context-card">
              <p className="rx-context-title">{exceptionModal.session.nombreClase} · {exceptionModal.session.fecha}</p>
              <p className="rx-context-copy">Esta ocurrencia quedará marcada como excepción. La plantilla continuará generando las demás fechas normalmente.</p>
            </div>
            <div className="rx-schedule-form-grid">
              <SelectField label="Instructor" required value={exceptionForm.entrenadorId}
                onChange={e => setExceptionForm(actual => ({ ...actual, entrenadorId: e.target.value }))}
                options={entrenadorOptions} className="rx-schedule-span-2" />
              <SelectField label="Sala" value={exceptionForm.salon}
                onChange={e => setExceptionForm(actual => ({ ...actual, salon: e.target.value }))}
                options={salonOptions} />
              <SelectField label="Estatus" value={exceptionForm.estatus}
                onChange={e => setExceptionForm(actual => ({ ...actual, estatus: e.target.value as Estatus }))}
                options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
              <InputField label="Hora inicio" required type="time" value={exceptionForm.horaInicio}
                onChange={e => setExceptionForm(actual => ({ ...actual, horaInicio: e.target.value }))} />
              <InputField label="Hora fin" required type="time" value={exceptionForm.horaFin}
                onChange={e => setExceptionForm(actual => ({ ...actual, horaFin: e.target.value }))} />
            </div>
            <section className="rx-schedule-options" aria-labelledby="exception-reservations-title">
              <h3 id="exception-reservations-title">Reservaciones</h3>
              <div className="rx-switch-row">
                <div><strong>Visible para reservaciones</strong><p>Permitir que esta sesión específica aparezca en reservaciones.</p></div>
                <button type="button" role="switch" aria-checked={exceptionForm.visibleReservas} className="rx-switch"
                  onClick={() => setExceptionForm(actual => ({ ...actual, visibleReservas: !actual.visibleReservas }))}><span /></button>
              </div>
              <div className="rx-switch-row">
                <div><strong>Lista de espera</strong><p>Agregar clientes en espera cuando esta sesión alcance su capacidad.</p></div>
                <button type="button" role="switch" aria-checked={exceptionForm.listaEsperaHabilitada} className="rx-switch"
                  onClick={() => setExceptionForm(actual => ({ ...actual, listaEsperaHabilitada: !actual.listaEsperaHabilitada }))}><span /></button>
              </div>
            </section>
            {exceptionError && <p className="rx-schedule-message rx-schedule-message--error" role="alert">{exceptionError}</p>}
            <div className="rx-schedule-actions">
              <button type="button" onClick={() => setExceptionModal({ open: false })} disabled={exceptionSaving}
                className="rx-btn rx-btn--outline">Cancelar</button>
              <button type="button" onClick={() => void saveException()} disabled={exceptionSaving}
                className="rx-btn rx-btn--dark">
                {exceptionSaving ? 'Guardando...' : 'Guardar excepción'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.editing ? 'Editar horario' : 'Nuevo horario'}>
        <div className="rx-schedule-form">
          <div className="rx-schedule-form-grid">
            <SelectField label="Clase" required value={form.idClase} onChange={e => setForm(f => ({ ...f, idClase: e.target.value }))} options={claseOptions} className="rx-schedule-span-2" />
            <SelectField label="Entrenador (opcional)" value={form.entrenadorId} onChange={e => setForm(f => ({ ...f, entrenadorId: e.target.value }))} options={entrenadorOptions} className="rx-schedule-span-2" />
            <InputField label="Fecha" required type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            <SelectField label="Sala" value={form.salon} onChange={e => setForm(f => ({ ...f, salon: e.target.value }))} options={salonOptions} />
            <InputField label="Hora inicio" required type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
            <InputField label="Hora fin" required type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} />
            <InputField label="Capacidad" required type="number" min="1" value={form.capacidadTotal} onChange={e => setForm(f => ({ ...f, capacidadTotal: e.target.value }))} />
            <SelectField label="Estatus" value={form.estatus} onChange={e => setForm(f => ({ ...f, estatus: e.target.value as Estatus }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          </div>
          <section className="rx-schedule-options" aria-labelledby="manual-reservations-title">
            <h3 id="manual-reservations-title">Reservaciones</h3>
            <div className="rx-switch-row">
              <div><strong>Visible para reservaciones</strong><p>Ocultarla de la consulta pública sin quitarla de Administración o Recepción.</p></div>
              <button type="button" role="switch" aria-checked={form.visibleReservas} className="rx-switch"
                onClick={() => setForm(f => ({ ...f, visibleReservas: !f.visibleReservas }))}><span /></button>
            </div>
            <div className="rx-switch-row">
              <div><strong>Lista de espera</strong><p>Permitir reservas en espera cuando esta sesión se llene.</p></div>
              <button type="button" role="switch" aria-checked={form.listaEsperaHabilitada} className="rx-switch"
                onClick={() => setForm(f => ({ ...f, listaEsperaHabilitada: !f.listaEsperaHabilitada }))}><span /></button>
            </div>
          </section>
          {formError && <p className="rx-schedule-message rx-schedule-message--error">{formError}</p>}
          <div className="rx-schedule-actions">
            <button onClick={() => setModal({ open: false })} disabled={saving} className="rx-btn rx-btn--outline">Cancelar</button>
            <button onClick={() => void save()} disabled={saving} className="rx-btn rx-btn--dark">
              {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>}
              {saving ? 'Guardando...' : modal.editing ? 'Guardar cambios' : 'Crear horario'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}