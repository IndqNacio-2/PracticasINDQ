import { useEffect, useState } from 'react';
import { EVENTO_CAMBIO_APLICACION, CLAVE_CAMBIO_APLICACION } from '../../../../services/cambiosAplicacion';
import { DataState } from '../../components/DataState';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { InputField, SelectField } from '../../components/FormField';
import { apiCobro } from '../../lib/api';
import { useNavigate } from 'react-router';
import { MembresiasCliente, type MembresiaComprada } from './MembresiasCliente';

// Un cliente tal como lo devuelve GET /cobro/api/clientes. Estos registros
// viven en la tabla webcobro.clientes (PostgreSQL): son los mismos socios que
// usa el módulo de Cobro (front desk) para reservar clases.
interface SocioCobro {
  id: number;
  nombre: string;
  membresiasCompradas?: MembresiaComprada[];
  telefono: string;
  correo: string | null;
  activo: boolean;
}

interface SocioForm {
  nombre: string;
  correo: string;
  telefono: string;
  activo: boolean;
}

const FORM_VACIO: SocioForm = {
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

export function ClientesPage({ soloRegistro = false }: { soloRegistro?: boolean } = {}) {
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
      activo: s.activo !== false,
    });
    setFormError(null);
    setModal(true);
  };

  // Usar la fila devuelta por PostgreSQL evita desmontar la tabla y perder
  // su búsqueda/página. No se actualiza la UI si el servidor rechaza el cambio.
  const save = async () => {
    if (guardando) return;
    setFormError(null);
    if (form.nombre.trim().length < 3) {
      setFormError('El nombre del cliente es obligatorio (mínimo 3 letras).');
      return;
    }
    if (form.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) {
      setFormError('Introduce un correo electrónico válido.');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = {
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

  return (
    <section className="rx-admin-dashboard rx-clientes w-full min-w-0">
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
          searchPlaceholder="Buscar por nombre, correo o teléfono…"
          searchKeys={['nombre', 'correo', 'telefono']}
          data={clientes as unknown as Record<string, unknown>[]}
          emptyMessage="No hay clientes que mostrar"
          columns={[
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
                <button type="button" onClick={() => navigate(`/clientes/${s.id}`)} className="rx-btn rx-btn--outline" title="Ver perfil e historial">Ver perfil</button>
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
          <button type="submit" form="form-cliente" disabled={guardando} className="rx-btn rx-btn--dark">
            <span className="material-symbols-rounded text-xl" aria-hidden="true">{editando ? 'save' : 'person_add'}</span>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cliente'}
          </button>
        </>}>
        <form id="form-cliente" className="rx-modal-body rx-form-stack" onSubmit={async e => { e.preventDefault(); await save(); }}>
        <fieldset disabled={guardando} className="rx-form-stack rx-membership-fields">
          <InputField label="Nombre completo" required autoComplete="name" aria-label="Nombre completo" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Juan Pérez" />
          <InputField label="Correo" type="email" autoComplete="email" aria-label="Correo" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} placeholder="Opcional, debe ser único" />
          <InputField label="Teléfono" type="tel" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <SelectField label="Estatus" value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))} options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]} />
          <span className="rx-help-text">Las membresías se venden desde Recepción. Las compras y sus vigencias se consultan en la tabla de clientes.</span>
        </fieldset>
        {formError && <p className="rx-alert rx-alert--danger" role="alert">{formError}</p>}
        </form>
      </Modal>
    </section>
  );
}
