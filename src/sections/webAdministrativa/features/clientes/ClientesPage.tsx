import { useEffect, useState } from 'react';
import { EVENTO_CAMBIO_APLICACION, CLAVE_CAMBIO_APLICACION } from '../../../../services/cambiosAplicacion';
import { DataState } from '../../components/DataState';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { api, apiCobro } from '../../lib/api';
import { useNavigate } from 'react-router';
import { MembresiasCliente, type MembresiaComprada } from './MembresiasCliente';
import ListaSalud, { ListaLesiones, SaludEtiquetas } from './SaludEtiquetas';
import { esNombreValido, esTelefonoValido, esCorreoValido, errorCodigoCliente } from './validacionCliente';

// Un cliente tal como lo devuelve GET /cobro/api/clientes. Estos registros
// viven en la tabla webcobro.clientes (PostgreSQL): son los mismos socios que
// usa el módulo de Cobro (front desk) para reservar clases.
interface SocioCobro {
  fechaNacimiento?: string;
  nombreTutor?: string;
  claveElectorTutor?: string;
  estadoDocumentacion?: 'pendiente' | 'validada';
  enfermedades?: string[];
  lesiones?: string[];
  id: number;
  codigo?: string | null;
  nombre: string;
  membresiasCompradas?: MembresiaComprada[];
  telefono: string;
  correo: string | null;
  activo: boolean;
}

interface SocioForm {
  fechaNacimiento: string;
  nombreTutor: string;
  claveElectorTutor: string;
  estadoDocumentacion: 'pendiente' | 'validada';
  codigo?: string;
  enfermedades: string[];
  lesiones: string[];
  nombre: string;
  correo: string;
  telefono: string;
  activo: boolean;
}

const FORM_VACIO: SocioForm = {
  fechaNacimiento: '', nombreTutor: '', claveElectorTutor: '', estadoDocumentacion: 'pendiente',
  codigo: '',
  enfermedades: [],
  lesiones: [],
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

export function ClientesPage({ soloRegistro = false, rutaClientes = '/clientes', permiteActivacion = true }: { soloRegistro?: boolean; rutaClientes?: string; permiteActivacion?: boolean } = {}) {
  const navigate = useNavigate();
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
  const [activacion, setActivacion] = useState<{ nombre: string; codigo: string } | null>(null);
  const [tocados, setTocados] = useState<Partial<Record<'nombre' | 'correo' | 'telefono' | 'codigo', boolean>>>({});
  const [avisos, setAvisos] = useState<Partial<Record<'nombre' | 'telefono', string>>>({});
  const [consultaCodigo, setConsultaCodigo] = useState<{ valor: string; error: string; pendiente: boolean } | null>(null);
  const codigoLimpio = (form.codigo ?? '').trim().toUpperCase();
  const codigoLocalError = errorCodigoCliente(codigoLimpio, editando?.id)
    || (codigoLimpio && clientes.some(s => s.id !== editando?.id && (s.codigo || `CLI-${s.id}`).toUpperCase() === codigoLimpio)
      ? 'Ese código de usuario ya está en uso por otro cliente.' : '');
  const necesitaConsultaCodigo = Boolean(codigoLimpio && codigoLimpio !== (editando?.codigo || (editando ? `CLI-${editando.id}` : '')));
  const codigoPendiente = modal && necesitaConsultaCodigo && !codigoLocalError
    && (consultaCodigo?.valor !== codigoLimpio || consultaCodigo.pendiente);

  useEffect(() => {
    if (!modal || !necesitaConsultaCodigo || codigoLocalError || typeof window === 'undefined') return;
    let vigente = true;
    setConsultaCodigo({ valor: codigoLimpio, error: '', pendiente: true });
    const timer = window.setTimeout(async () => {
      try {
        const resultado = await apiCobro.get<{ disponible: boolean }>(`/clientes/codigo-disponible?codigo=${encodeURIComponent(codigoLimpio)}${editando ? `&excluirId=${editando.id}` : ''}`);
        if (vigente) setConsultaCodigo({ valor: codigoLimpio, error: resultado.disponible ? '' : 'Ese código de usuario ya está en uso por otro cliente.', pendiente: false });
      } catch (err) {
        if (vigente) setConsultaCodigo({ valor: codigoLimpio, error: err instanceof Error ? err.message : 'No se pudo comprobar el código. Intenta de nuevo.', pendiente: false });
      }
    }, 300);
    return () => { vigente = false; window.clearTimeout(timer); };
  }, [modal, codigoLimpio, editando?.id, necesitaConsultaCodigo, codigoLocalError]);

  const errores = {
    codigo: codigoLocalError || (necesitaConsultaCodigo && consultaCodigo?.valor === codigoLimpio ? consultaCodigo.error : ''),
    nombre: avisos.nombre || (!esNombreValido(form.nombre) ? 'El nombre debe contener al menos 3 letras y solo admite letras y espacios.' : ''),
    correo: !form.correo.trim() ? 'El correo es obligatorio.'
      : !esCorreoValido(form.correo) ? 'Introduce un correo electrónico válido.'
      : clientes.some(s => s.id !== editando?.id && s.correo?.trim().toLowerCase() === form.correo.trim().toLowerCase())
        ? 'Ese correo ya está en uso por otro cliente.' : '',
    telefono: avisos.telefono || (!esTelefonoValido(form.telefono) ? 'El teléfono solo admite números y un máximo de 10 dígitos.' : ''),
  };

  const tocar = (campo: 'nombre' | 'correo' | 'telefono' | 'codigo') => setTocados(prev => ({ ...prev, [campo]: true }));

  // Recarga en segundo plano sin desmontar la tabla ni perder sus filtros.
  useEffect(() => {
    let cancelado = false;
    let enCurso = false;
    let pendiente = false;
    const cargar = async () => {
      if (cancelado) return;
      if (enCurso) { pendiente = true; return; }
      enCurso = true;
      setActualizando(true);
      try {
        const datos = await apiCobro.get<SocioCobro[]>('/clientes');
        if (!cancelado) { setClientes(datos); setError(null); }
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
      } finally {
        enCurso = false;
        if (!cancelado) {
          setLoading(false);
          setActualizando(false);
          if (pendiente) { pendiente = false; void cargar(); }
        }
      }
    };
    void cargar();
    if (typeof window === 'undefined') return () => { cancelado = true; };
    const actualizar = () => { void cargar(); };
    const alVolver = () => { if (document.visibilityState === 'visible') actualizar(); };
    const otraPestana = (event: StorageEvent) => {
      if (event.key === CLAVE_CAMBIO_APLICACION) actualizar();
    };
    window.addEventListener(EVENTO_CAMBIO_APLICACION, actualizar);
    window.addEventListener('storage', otraPestana);
    window.addEventListener('focus', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    const intervalo = window.setInterval(alVolver, 10000);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      window.removeEventListener(EVENTO_CAMBIO_APLICACION, actualizar);
      window.removeEventListener('storage', otraPestana);
      window.removeEventListener('focus', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
  const abrirNuevo = () => {
    setConsultaCodigo(null);
    setTocados({});
    setAvisos({});
    setEditando(null);
    setForm(FORM_VACIO);
    setFormError(null);
    setModal(true);
  };

  const abrirEditar = (s: SocioCobro) => {
    setConsultaCodigo(null);
    setTocados({ nombre: true, correo: true, telefono: true });
    setAvisos({});
    setEditando(s);
    setForm({
      fechaNacimiento: s.fechaNacimiento ?? '', nombreTutor: s.nombreTutor ?? '',
      claveElectorTutor: s.claveElectorTutor ?? '', estadoDocumentacion: s.estadoDocumentacion ?? 'pendiente',
      codigo: s.codigo || `CLI-${s.id}`,
      enfermedades: s.enfermedades ?? [],
      lesiones: s.lesiones ?? [],
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
    if (!editando && !form.fechaNacimiento) { setFormError('La fecha de nacimiento es obligatoria para determinar si requiere tutor.'); return; }
    if (requiereTutor && (!esNombreValido(form.nombreTutor) || form.nombreTutor.trim().split(/\s+/).length < 2 || !/^[A-Z0-9]{18}$/i.test(form.claveElectorTutor.trim()))) {
      setFormError('Para menores, captura el nombre completo del tutor y su clave de elector de 18 caracteres.'); return;
    }
    if (errores.codigo || codigoPendiente) {
      tocar('codigo');
      setFormError(errores.codigo || 'Espera a que termine la comprobación del código.');
      return;
    }
    setFormError(null);
    setTocados({ nombre: true, correo: true, telefono: true });
    if (!esNombreValido(form.nombre)) {
      setFormError('El nombre debe contener al menos 3 letras y solo admite letras y espacios.');
      return;
    }
    if (!esTelefonoValido(form.telefono)) {
      setFormError('El teléfono solo admite números y un máximo de 10 dígitos.');
      return;
    }
    if (!esCorreoValido(form.correo)) {
      setFormError(form.correo.trim() ? 'Introduce un correo electrónico válido.' : 'El correo es obligatorio.');
      return;
    }
    if (errores.correo) {
      setFormError(errores.correo);
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
        fechaNacimiento: form.fechaNacimiento, nombreTutor: form.nombreTutor,
        claveElectorTutor: form.claveElectorTutor, estadoDocumentacion: form.estadoDocumentacion,
        ...(form.codigo !== undefined && (!editando || codigoLimpio !== (editando.codigo || `CLI-${editando.id}`)) ? { codigo: codigoLimpio } : {}),
        enfermedades: form.enfermedades,
        lesiones: form.lesiones,
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

  // Baja lógica: la fila y todo el historial permanecen disponibles.
  const eliminar = async (s: SocioCobro) => {
    if (procesando !== null) return;
    const confirmado = window.confirm(`¿Dar de baja a ${s.nombre}? Su información e historial se conservarán.`);
    if (!confirmado) return;
    setAccionError(null);
    setProcesando(s.id);
    try {
      const { cliente } = await apiCobro.patch<{ cliente: SocioCobro }>(`/clientes/${s.id}`, { activo: false });
      setClientes(lista => lista.map(c => c.id === cliente.id ? { ...c, ...cliente } : c));
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo dar de baja al cliente.';
      setAccionError(mensaje);
    } finally {
      setProcesando(null);
    }
  };

  const activos = clientes.filter(c => estatusDe(c) === 'activo').length;
  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const edad = form.fechaNacimiento ? hoy.getFullYear() - Number(form.fechaNacimiento.slice(0, 4)) - (hoyISO.slice(5) < form.fechaNacimiento.slice(5) ? 1 : 0) : null;
  const requiereTutor = edad !== null && edad < 18;

  const habilitarMovil = async (s: SocioCobro) => {
    if (procesando !== null) return;
    setProcesando(s.id);
    setAccionError(null);
    setActivacion(null);
    try {
      const respuesta = await api.post<{ codigoActivacion: string }>(`/movil/clientes/${s.id}/activacion`);
      setActivacion({ nombre: s.nombre, codigo: respuesta.codigoActivacion });
    } catch (err) {
      setAccionError(err instanceof Error ? err.message : 'No se pudo habilitar el acceso móvil.');
    } finally { setProcesando(null); }
  };

  return (
    <section className="rx-admin-dashboard rx-clientes w-full min-w-0">
      {activacion && (
        <Modal open title="Activar cuenta móvil" onClose={() => setActivacion(null)} size="sm">
          <p>Entrega este código únicamente a {activacion.nombre} después de comprobar su identidad.</p>
          <p className="my-4 break-all font-mono select-all">{activacion.codigo}</p>
          <p>Vence en 15 minutos y solo se puede utilizar una vez. No es el código del checador. Generar otro invalida el anterior.</p>
          <button type="button" className="rx-btn rx-btn--outline mt-4" onClick={() => setActivacion(null)}>Cerrar</button>
        </Modal>
      )}
      <header className="rx-page-header rx-admin-dashboard-header">
        <div className="rx-page-heading rx-page-heading--stacked">
          <span className="rx-section-eyebrow">Atención de clientes</span>
          <h1 className="rx-page-title">Clientes</h1>
          <p className="rx-page-subtitle">{activos} {activos === 1 ? 'cliente activo' : 'clientes activos'} · {clientes.length} {clientes.length === 1 ? 'cliente en total' : 'clientes en total'}</p>
        </div>
      </header>

      <div className="rx-page-content rx-clientes-content">
      <div className="rx-clientes-list-heading">
        <div>
          <h2>Clientes registrados</h2>
          <p>Consulta los datos de contacto, las membresías compradas y el estatus de cada cliente.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={abrirNuevo}
            className="rx-btn rx-btn--accent">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo cliente
          </button>
        </div>
      </div>

      {(accionError || (!loading && error)) && (
        <div role="alert" className="rx-alert rx-alert--danger">
          {accionError || error}
        </div>
      )}
      <DataState loading={loading}>
        <DataTable
          variant="spaced"
          searchPlaceholder="Buscar por nombre o apellido…"
          searchKeys={['nombre']}
          normalizeSearch
          data={clientes.map(s => ({ ...s, codigo: s.codigo || `CLI-${s.id}` })) as unknown as Record<string, unknown>[]}
          emptyMessage="No hay clientes que mostrar"
          columns={[
            {
              key: 'codigo', header: 'Código Usuario',
              render: row => <span className="rx-code">{String(row.codigo ?? '—')}</span>,
            },
            {
              key: 'nombre', header: 'Cliente',
              render: row => {
                const s = row as unknown as SocioCobro;
                const ini = s.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div className="flex items-center gap-3">
                    <div className="rx-clientes-avatar" aria-hidden="true">{ini}</div>
                    <div>
                      <p className="rx-clientes-name">{s.nombre}</p>
                      <p className="rx-clientes-meta">{s.correo || 'Sin correo'}</p>
                    </div>
                  </div>
                );
              }
            },
            { key: 'telefono', header: 'Teléfono' },
            { key: 'estadoDocumentacion', header: 'Documentación', render: row => !row.fechaNacimiento ? 'Sin fecha de nacimiento' : String(row.fechaNacimiento) > `${hoy.getFullYear() - 18}${hoyISO.slice(4)}` ? <span className={`rx-badge rx-badge--${row.estadoDocumentacion === 'validada' ? 'success' : 'warning'}`}>{row.estadoDocumentacion === 'validada' ? 'Validada' : 'Pendiente'}</span> : 'No aplica' },
            { key: 'enfermedades', header: 'Enfermedades', render: row => <SaludEtiquetas items={(row as unknown as SocioCobro).enfermedades} /> },
            { key: 'lesiones', header: 'Lesiones', render: row => <SaludEtiquetas items={(row as unknown as SocioCobro).lesiones} /> },
            {
              key: 'membresiasCompradas', header: 'Membresías compradas',
              render: row => <MembresiasCliente compras={(row as unknown as SocioCobro).membresiasCompradas} />
            },
            {
              key: 'activo', header: 'Estatus',
              render: row => <span className={`rx-badge ${estatusDe(row as unknown as SocioCobro) === 'activo' ? 'rx-badge--success' : 'rx-badge--neutral'}`}>{estatusDe(row as unknown as SocioCobro) === 'activo' ? 'Activo' : 'Inactivo'}</span>
            },
          ]}
          actions={soloRegistro ? undefined : row => {
            const s = row as unknown as SocioCobro;
            const activoManual = s.activo !== false;
            return (
              <div className="flex items-center gap-2 justify-end">
                <button type="button" onClick={() => navigate(`${rutaClientes}/${s.id}`)} className="rx-btn rx-btn--outline" title="Ver perfil e historial">Ver perfil</button>
              {permiteActivacion && <button type="button" disabled={procesando !== null || actualizando || !s.activo || !s.correo} onClick={() => void habilitarMovil(s)} className="rx-btn rx-btn--outline" title="Generar código temporal para activar la cuenta móvil">Acceso móvil</button>}
                <button type="button" disabled={procesando !== null || actualizando} onClick={() => abrirEditar(s)} className="rx-icon-btn" title="Editar" aria-label={`Editar a ${s.nombre}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button type="button" disabled={procesando !== null || actualizando} onClick={() => void toggleEstatus(s)} className={`rx-icon-btn ${activoManual ? 'rx-btn--danger' : 'rx-btn--dark'}`} aria-label={`${activoManual ? 'Desactivar' : 'Activar'} a ${s.nombre}`} title={activoManual ? 'Desactivar (dar de baja)' : 'Activar (no renueva la membresía)'}>
                  {activoManual
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  }
                </button>
                <button type="button" disabled={procesando !== null || actualizando || !activoManual} onClick={() => void eliminar(s)} className="rx-icon-btn rx-btn--danger" title="Dar de baja conservando historial" aria-label={`Dar de baja a ${s.nombre} conservando historial`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            );
          }}
        />
        </DataState>
      </div>

      <Modal open={modal} variant="reception" onClose={() => { if (!guardando) setModal(false); }} title={editando ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle={editando ? 'Actualiza los datos del cliente.' : 'Registra los datos del cliente para comenzar su atención.'}
        footer={<>
          <button type="button" disabled={guardando} onClick={() => setModal(false)} className="rx-btn rx-btn--outline">Cancelar</button>
          <button type="submit" form="form-cliente" disabled={guardando || Boolean(errores.codigo) || codigoPendiente} className="rx-btn rx-btn--dark">
            <span className="material-symbols-rounded text-xl" aria-hidden="true">{editando ? 'save' : 'person_add'}</span>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cliente'}
          </button>
        </>}>
        <form id="form-cliente" noValidate className="rx-modal-body rx-form-stack" onSubmit={async e => { e.preventDefault(); await save(); }}>
        <fieldset disabled={guardando} className="rx-form-stack rx-membership-fields">
          <InputField label="Fecha de nacimiento" type="date" required={!editando} max={hoyISO} value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} />
          {requiereTutor && <>
            <InputField label="Nombre completo del tutor" required maxLength={200} value={form.nombreTutor} onChange={e => setForm(f => ({ ...f, nombreTutor: e.target.value }))} />
            <InputField label="Clave de elector del tutor" required maxLength={18} value={form.claveElectorTutor} onChange={e => setForm(f => ({ ...f, claveElectorTutor: e.target.value.toUpperCase() }))} />
            <SelectField label="Validación documental" value={form.estadoDocumentacion} onChange={e => setForm(f => ({ ...f, estadoDocumentacion: e.target.value as 'pendiente' | 'validada' }))} options={[{ value: 'pendiente', label: 'Documentos pendientes' }, { value: 'validada', label: 'Documentación validada' }]} />
            <p className="rx-help-text">Se permite registrar con documentos pendientes. El expediente se conserva en las renovaciones. La lista de cuatro documentos está pendiente de confirmación; este estado no sustituye su revisión.</p>
          </>}
          <InputField label="Código Usuario" aria-label="Código Usuario" autoComplete="off" maxLength={30}
            value={form.codigo ?? ''} placeholder="Automático si se deja vacío (CLI-ID)"
            error={tocados.codigo ? errores.codigo : undefined} onBlur={() => tocar('codigo')}
            onChange={e => { tocar('codigo'); setConsultaCodigo(null); setFormError(null); setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() })); }} />
          <span className="rx-help-text" role="status" aria-live="polite">{codigoPendiente ? 'Comprobando disponibilidad del código…' : 'De 3 a 30 letras, números o guiones. Vacío conserva el código automático. No cambia el ID ni el historial.'}</span>
          <InputField label="Nombre completo" required autoComplete="name" aria-label="Nombre completo" error={tocados.nombre ? errores.nombre : undefined} onBlur={() => tocar('nombre')} value={form.nombre} onChange={e => {
            const texto = e.target.value.normalize('NFC');
            const nombre = texto.replace(/[^\p{L}\p{M} ]/gu, '');
            tocar('nombre'); setFormError(null);
            setAvisos(prev => ({ ...prev, nombre: texto !== nombre ? 'Solo se permiten letras y espacios; se eliminaron los caracteres no válidos.' : '' }));
            setForm(f => ({ ...f, nombre }));
          }} placeholder="Ej. Juan Pérez" />
          <InputField label="Correo" required type="email" maxLength={254} autoComplete="email" aria-label="Correo" error={tocados.correo ? errores.correo : undefined} onBlur={() => tocar('correo')} value={form.correo} onChange={e => {
            tocar('correo'); setFormError(null);
            setForm(f => ({ ...f, correo: e.target.value }));
          }} placeholder="Ej. nombre@ejemplo.com" />
          <InputField label="Teléfono" type="tel" inputMode="numeric" autoComplete="tel-national" aria-label="Teléfono" maxLength={10} pattern="[0-9]{0,10}" title="Solo números, máximo 10 dígitos" error={tocados.telefono ? errores.telefono : undefined} onBlur={() => tocar('telefono')} value={form.telefono} onChange={e => {
            const texto = e.target.value;
            const telefono = texto.replace(/[^0-9]/g, '').slice(0, 10);
            tocar('telefono'); setFormError(null);
            setAvisos(prev => ({ ...prev, telefono: texto !== telefono ? 'Solo se permiten números y un máximo de 10 dígitos; se ajustó el valor ingresado.' : '' }));
            setForm(f => ({ ...f, telefono }));
          }} />
          <SelectField label="Estatus" value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          <ListaSalud key={`enfermedades-${editando?.id ?? 'nuevo'}-${modal}`} label="Enfermedades" items={form.enfermedades} onChange={enfermedades => setForm(f => ({ ...f, enfermedades }))} />
          <ListaLesiones key={`lesiones-${editando?.id ?? 'nuevo'}-${modal}`} items={form.lesiones} onChange={lesiones => setForm(f => ({ ...f, lesiones }))} />
          <span className="rx-help-text">Las membresías se venden desde Recepción. Las compras y sus vigencias se consultan en la tabla de clientes.</span>
        </fieldset>
        {formError && <p className="rx-alert rx-alert--danger" role="alert">{formError}</p>}
        </form>
      </Modal>
    </section>
  );
}
