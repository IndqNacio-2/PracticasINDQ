import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MaterialIcon from '../../../components/MaterialIcon';
import BrandLogo from '../../../components/BrandLogo';
import { LOGIN_PATH } from '../../../auth/session';
import MembresiasRecepcion, { membresiasRequest, SaldosMembresias } from './MembresiasRecepcion';
import { EVENTO_CAMBIO_APLICACION, CLAVE_CAMBIO_APLICACION } from '../../../services/cambiosAplicacion';
import RecepcionDetalle from './RecepcionDetalle';
import RecepcionTabla from './RecepcionTabla';
import { ClientesPage } from '../../webAdministrativa/features/clientes/ClientesPage';
import '../../../styles/recepcion-workspace.css';

/*
 * Diseño: sistema visual compartido rx- (src/styles/pos-ui.css), el mismo que
 * usan el Punto de Venta y el módulo administrativo. La estructura (barra
 * lateral, topbar y tarjeta de página) es la de administrativa y los modales
 * de cobro son los del Punto de Venta, para que los módulos se vean iguales.
 */

/*
 * Las reservaciones se cargan desde el backend (esquema webcobro). Ya no hay
 * datos de ejemplo: la tabla inicia vacía y se llena con la respuesta de la API.
 */

/*
 * Las mismas formas de pago que maneja el Punto de Venta: efectivo, tarjeta
 * y transferencia. Los iconos son Material Symbols, iguales a los del POS.
 */
const PAY_METHODS = [
  { key: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { key: 'tarjeta', label: 'Tarjeta', icon: 'credit_card' },
  { key: 'transferencia', label: 'Transferencia', icon: 'account_balance' },
];

const METHOD_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

const formatMoney = (value) =>
  Number(value ?? 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });

const formatTicketDate = (value) =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

/*
 * Fecha de hoy en YYYY-MM-DD (zona local). Vive fuera del componente porque
 * la usan el estado inicial del formulario y los helpers de validacion.
 */
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/*
 * Código de reserva que da el cliente en recepción (lo genera el backend al
 * reservar, también desde la app móvil): RSV-7K2M9Q o solo 7K2M9Q.
 */
const pareceCodigoReserva = (valor) => /^(RSV-)?[A-Z0-9]{6}$/i.test((valor || '').trim());

// Estados que ya no apartan lugar ni cuentan como reservación activa.
const ESTADOS_INACTIVOS = ['cancelado', 'no_asistio'];

// Iconos del toast, los mismos que usa el Punto de Venta.
const ICONOS_TOAST = {
  success: 'check_circle',
  error: 'cancel',
  warning: 'warning',
  info: 'info',
};

// Cada estado con su badge semántico del sistema rx- (texto + color).
const ESTADO_BADGE = {
  pendiente: { tono: 'warning', etiqueta: 'Pendiente' },
  asistido: { tono: 'info', etiqueta: 'Asistió' },
  pagado: { tono: 'success', etiqueta: 'Pagado' },
  no_asistio: { tono: 'danger', etiqueta: 'No asistió' },
  cancelado: { tono: 'neutral', etiqueta: 'Cancelado' },
};

// Pestañas de filtro de la tabla (mismo componente rx-tab que el Punto de Venta).
const FILTROS_ESTADO = [
  { key: 'todas', etiqueta: 'Todos', coincide: () => true },
  { key: 'por_llegar', etiqueta: 'Por llegar', coincide: r => ['pendiente', 'pagado'].includes(r.status) && r.capacityStatus !== 'espera' },
  {
    key: 'por_cobrar',
    etiqueta: 'Por cobrar',
    coincide: r => r.paymentStatus !== 'pagado' && (r.status === 'pendiente' || r.status === 'asistido') && r.capacityStatus !== 'espera',
  },
  { key: 'pagado', etiqueta: 'Pagadas', coincide: r => r.paymentStatus === 'pagado' },
  { key: 'asistido', etiqueta: 'Asistieron', coincide: r => r.status === 'asistido' },
  { key: 'reagendada', etiqueta: 'Reagendadas', coincide: r => r.reagendada === true },
  { key: 'no_asistio', etiqueta: 'No asistió', coincide: r => r.status === 'no_asistio' },
  {
    key: 'espera',
    etiqueta: 'Lista de espera',
    coincide: r => r.capacityStatus === 'espera' && !ESTADOS_INACTIVOS.includes(r.status),
  },
];

// Iniciales para los avatares: "Ana García" -> "AG".
const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map(parte => parte[0] || '').join('').toUpperCase() || '?';

// 'YYYY-MM-DD' -> "Hoy" o "mié, 5 nov".
const formatFechaCorta = (fecha) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return 'Sin fecha';
  if (fecha === hoyISO()) return 'Hoy';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const fechaDeHoyLarga = () => {
  const texto = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Botón "Cambiar método" igual al del modal de cobro del Punto de Venta.
function BotonCambiarMetodo({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="rx-back-button">
      <MaterialIcon name="arrow_back" className="text-lg" />
      Cambiar método
    </button>
  );
}

export default function Dashboard({ vista = 'recepcion' }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // ========== ESTADOS ==========
  const [reservations, setReservations] = useState([]);
  const [horarioVistaId, setHorarioVistaId] = useState(null);
  const [reservaVistaId, setReservaVistaId] = useState(null);
  const [comprasDetalle, setComprasDetalle] = useState([]);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const reservaDetalle = reservations.find(r => r.id === reservaVistaId);
  useEffect(() => {
    let vigente = true;
    setComprasDetalle([]);
    setErrorDetalle('');
    if (!reservaDetalle?.clienteId || !reservaDetalle?.membresiaCompraId) {
      setCargandoDetalle(false);
      return;
    }
    setCargandoDetalle(true);
    membresiasRequest(`/clientes/${encodeURIComponent(reservaDetalle.clienteId)}/membresias`)
      .then(datos => { if (vigente) setComprasDetalle(Array.isArray(datos) ? datos : []); })
      .catch(error => { if (vigente) setErrorDetalle(error.message); })
      .finally(() => { if (vigente) setCargandoDetalle(false); });
    return () => { vigente = false; };
  }, [reservaDetalle]);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [clases, setClases] = useState([]);
  /*
   * Horarios reales del modulo administrativo (MongoDB). Son la unica fuente
   * de verdad: una reserva solo es valida si su (clase, fecha, hora) coincide
   * con un horario activo de esa fecha.
   */
  const [horarios, setHorarios] = useState([]);
  const [fechaReserva, setFechaReserva] = useState(hoyISO());
  const [tipoReserva, setTipoReserva] = useState('cliente');
  const [selectedClient, setSelectedClient] = useState(null);
  const [verMembresias, setVerMembresias] = useState(false);
  const [comprasSocio, setComprasSocio] = useState([]);
  const [saldoError, setSaldoError] = useState('');
  const [saldoCargando, setSaldoCargando] = useState(false);
  useEffect(() => {
    let vigente = true;
    setComprasSocio([]); setSaldoError('');
    if (!selectedClient) { setSaldoCargando(false); return; }
    setSaldoCargando(true);
    membresiasRequest(`/clientes/${selectedClient.id}/membresias`).then(datos => { if (vigente) setComprasSocio(datos); })
      .catch(e => { if (vigente) setSaldoError(e.message); })
      .finally(() => { if (vigente) setSaldoCargando(false); });
    return () => { vigente = false; };
  }, [selectedClient, reservations]);
  const [showClientList, setShowClientList] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedReservationForPayment, setSelectedReservationForPayment] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  /*
   * Forma de pago del cobro (las mismas opciones que el Punto de Venta):
   * efectivo, tarjeta o transferencia, con sus datos extra según el método.
   */
  const [metodoPago, setMetodoPago] = useState(null);
  const [efectivoInput, setEfectivoInput] = useState('');
  const [referenciaInput, setReferenciaInput] = useState('');
  /**
   * Tarjetas superiores del dashboard: las KPIs los calcula el backend
   * ingresos reales del dia desde PostgreSQL, clientes esperados y
   * total de reservas, no se calculan del listado en memoria
   */
  const [kpis, setKpis] = useState({ ingresosHoy: 0, clientesEsperados: 0, totalReservas: 0 });
  const [newReservation, setNewReservation] = useState({
    client: '',
    class: '',
    time: '',
    price: '',
    horarioId: '',
  });
  /*
   * Reagendar: la reservación elegida, la fecha nueva, los horarios de esa
   * fecha (solo de la misma clase) y el horario seleccionado.
   */
  const [reservaAReagendar, setReservaAReagendar] = useState(null);
  const [fechaReagendar, setFechaReagendar] = useState(hoyISO());
  const [horariosReagendar, setHorariosReagendar] = useState([]);
  const [horarioReagendarId, setHorarioReagendarId] = useState('');
  const [reagendando, setReagendando] = useState(false);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  // Presentación: pestaña de estado activa y menú lateral.
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [menuColapsado, setMenuColapsado] = useState(false);
  // pide los KPIs al backend unificado (vite los reenvia al gateway).
  const cargarKpis = async () => {
    try {
      const res = await fetch(`${API}/api/kpis`);
      if (res.ok) setKpis(await res.json());
    } catch (err) {
      console.warn(`No se pudieron cargar los KPIs:`, err);
    }
  };

  // ========== CARGA DE DATOS DESDE EL BACKEND ==========
  // Backend unificado: la sección de cobro se monta bajo /cobro en el mismo
  // puerto del frontend (Vite lo reenvía al gateway en el 3000).
  const API = '/cobro';

  useEffect(() => {
    /**
     * primero cargamos las reservaciones guardadas en PostgreSQL
     * las reservaciones canceladas no se muestran en el tablero principal,
     * pero siguen guardadas para que administrativa pueda consultarlas.
     */
    fetch(`${API}/api/reservas`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`No se pudieron cargar las reservaciones. HTTP ${res.status}`);
        }

        return res.json();
      })
      .then(data => {
        const reservacionesActivas = (Array.isArray(data) ? data : [])
          .filter(reservaciones => reservaciones.status !== 'cancelado');

        setReservations(reservacionesActivas);
      })
      .catch(error => {
        console.warn('No se pudieron cargar las reservaciones:', error);
        setReservations([]);
      });

    /**
     * cargamos los socios registrados desde el backend de cobro
     * estos clientes se utilizan para validar su estado, membresia y vigencia.
     */
    fetch(`${API}/api/clientes`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`No se pudieron consultar los clientes. HTTP ${res.status}`);
        }

        return res.json();
      })
      .then(data => {
        setClientes(Array.isArray(data) ? data : []);
      })
      .catch(error => {
        console.warn('No se pudieron cargar los clientes:', error);
        setClientes([]);
      });

    /**
     * las clases se crean en el modulo de administrativa y se guardan en MongoDB
     * desde cobro consultamos esas mismas clases para obtener su nombre,
     * precio, capacidad, color y estatus.
     *
     * el error anterior estaba aqui: se usaba serclasses, pero el estado
     * fue declarado como setClases,no existia las clases
     * nunca se guardaban en el estado y cobro mostraba el preciio como $0
     */
    fetch('/admin/api/clases')
      .then(res => {
        if(!res.ok) {
          throw new Error(`No se pudieron consulat las clases. HTTP ${res.status}`);
        }

        return res.json();
      })
      .then(data => {
        /**
         * solo conservamos las clases activas
         * la funcion correcta es serClases porque asi se declaro el estado
         *
         * const [clases, setClases] = useState([]);
         */
        const clasesActivas = (Array.isArray(data) ? data : [])
          .filter(clase => clase.estatus !== 'inactivo');

        setClases(clasesActivas);
      })
      .catch(error => {
        /**
         * si administrativa no responde o devuelve un error, impiamos la lista
         * tambien imprimimos el error real para facilitar el diagnostico
         */
        console.warn('No se pudieron cargar las calses de Administrativa:', error);
        setClases([]);
      });

    /**
     * Por ultimo cargamos los indicadores superiores del dashboard:
     * ingresos del dia, clientes esperados y total de reservaciones.
     */
    fetch(`${API}/api/kpis`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`No se pudieron cargar los indicadores. HTTP ${res.status}`);
        }

        return res.json();
      })
      .then(data => {
        setKpis(data);
      })
      .catch(error => {
        console.warn('No se pudieron cargar los indicadores:', error);
      });
  }, []);

  /*
   * Los horarios se piden al módulo administrativo por la fecha elegida en el
   * formulario. Cambiar de fecha vuelve a cargarlos: son los que definen
   * qué clases se pueden reservar y a qué hora.
   */
  useEffect(() => {
    if (!fechaReserva) return;
    fetch(`/admin/api/horarios?fecha=${encodeURIComponent(fechaReserva)}&estatus=activo`)
      .then(res => res.json())
      .then(data => setHorarios(Array.isArray(data) ? data : []))
      .catch(() => {
        setHorarios([]);
        console.warn('No se pudieron cargar los horarios de la fecha seleccionada.');
      });
  }, [fechaReserva]);

  /*
   * Horarios para reagendar: solo de la misma clase que la reservación, porque
   * reagendar no tiene costo y el precio se conserva.
   */
  useEffect(() => {
    if (!reservaAReagendar || !fechaReagendar) return;
    setHorarioReagendarId('');
    fetch(`/admin/api/horarios?fecha=${encodeURIComponent(fechaReagendar)}&estatus=activo`)
      .then(res => res.json())
      .then(data => setHorariosReagendar(
        (Array.isArray(data) ? data : []).filter(h => h.nombreClase === reservaAReagendar.class)
      ))
      .catch(() => setHorariosReagendar([]));
  }, [reservaAReagendar, fechaReagendar]);

  /*
   * Vuelve a pedir las reservaciones al backend. Sirve para ver las que el
   * cliente acaba de hacer desde la app móvil y las inasistencias que el
   * servidor marca cuando la clase ya pasó.
   */
  const recargarReservas = async () => {
    const res = await fetch(`${API}/api/reservas`);
    if (!res.ok) throw new Error(`No se pudieron cargar las reservaciones. HTTP ${res.status}`);
    const data = await res.json();
    const activas = (Array.isArray(data) ? data : []).filter(r => r.status !== 'cancelado');
    setReservations(activas);
    return activas;
  };

  // Refresco automático: conserva filtros y formularios; nunca recarga la página.
  useEffect(() => {
    if (isModalOpen || isPaymentModalOpen || verMembresias || reservaAReagendar || ticket || buscandoCodigo) return;
    const controller = new AbortController();
    let consultando = false;
    let cambioPendiente = false;
    const actualizar = async () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine || controller.signal.aborted) return;
      if (consultando) { cambioPendiente = true; return; }
      consultando = true;
      const consultar = async (url, aplicar) => {
        try {
          const respuesta = await fetch(url, { signal: controller.signal, cache: 'no-store' });
          if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
          const datos = await respuesta.json();
          if (!controller.signal.aborted) aplicar(datos);
        } catch (error) {
          // Mantener los últimos datos válidos si falla la conexión.
          if (!controller.signal.aborted) console.warn('No se pudo actualizar Recepción:', error);
        }
      };
      try {
        await Promise.all([
          consultar(`${API}/api/reservas`, datos => setReservations((Array.isArray(datos) ? datos : []).filter(r => r.status !== 'cancelado'))),
          consultar(`${API}/api/kpis`, setKpis),
          consultar(`${API}/api/clientes`, datos => setClientes(Array.isArray(datos) ? datos : [])),
          consultar('/admin/api/clases', datos => setClases((Array.isArray(datos) ? datos : []).filter(c => c.estatus !== 'inactivo'))),
          consultar(`/admin/api/horarios?fecha=${encodeURIComponent(fechaReserva)}&estatus=activo`, datos => setHorarios(Array.isArray(datos) ? datos : [])),
        ]);
      } finally {
        consultando = false;
        if (cambioPendiente && !controller.signal.aborted) {
          cambioPendiente = false;
          void actualizar();
        }
      }
    };
    const cambioEnOtraPestana = event => {
      if (event.key === CLAVE_CAMBIO_APLICACION) void actualizar();
    };
    void actualizar();
    window.addEventListener(EVENTO_CAMBIO_APLICACION, actualizar);
    window.addEventListener('storage', cambioEnOtraPestana);
    window.addEventListener('focus', actualizar);
    window.addEventListener('online', actualizar);
    document.addEventListener('visibilitychange', actualizar);
    return () => {
      controller.abort();
      window.removeEventListener(EVENTO_CAMBIO_APLICACION, actualizar);
      window.removeEventListener('storage', cambioEnOtraPestana);
      window.removeEventListener('focus', actualizar);
      window.removeEventListener('online', actualizar);
      document.removeEventListener('visibilitychange', actualizar);
    };
  }, [isModalOpen, isPaymentModalOpen, verMembresias, reservaAReagendar, ticket, buscandoCodigo, fechaReserva]);

  // ========== FUNCIONES DE VALIDACIÓN ==========

  /*
   * Cuenta las reservaciones que ocupan lugar en un horario concreto. Una
   * reserva "ocupa" lugar mientras no esté cancelada (pendiente, pagado o
   * asistido cuentan). Las clases y los horarios viven en administrativa; las
   * reservas, en webcobro.
   */
  const reservasActivasDe = (nombreClase, fecha, hora) =>
    reservations.filter(
      r =>
        r.class === nombreClase &&
        r.fecha === fecha &&
        r.time === hora &&
        r.capacityStatus !== 'espera' &&
        !ESTADOS_INACTIVOS.includes(r.status)
    ).length;

  /*
   * Lugares que le quedan a un horario = capacidad del horario − reservas
   * activas de ese (clase, fecha, hora). La capacidad la fija el horario
   * registrado en el módulo administrativo.
   */
  const lugaresDisponibles = (horario) => {
    if (!horario) return 0;
    const reservadas = reservasActivasDe(horario.nombreClase, horario.fecha, horario.horaInicio);
    return Math.max(0, Number(horario.capacidadTotal ?? 0) - reservadas);
  };

  // ========== HELPERS DE VALIDACIÓN DE MEMBRESÍA / DUPLICADOS / HORARIO ==========

  const esPremium = (socio) => !socio?.tieneCompras && socio?.membresia === 'Premium';

  // El socio puede reservar como "cliente" solo si está activo y su membresía
  // no está vencida (vigencia_hasta null = no expira).
  const membresiaVigente = (socio) => {
    if (!socio) return false;
    if (socio.activo === false) return false;
    if (!socio.tieneCompras && socio.vigencia_hasta && socio.vigencia_hasta < hoyISO()) return false;
    return true;
  };

  /*
   * Precio de una clase según quién reserva. Regla única (evita el bug donde
   * el socio quedaba en $0): solo un socio Premium y vigente paga 0; cualquier
   * otro caso (visitante o socio no premium / por definir) paga la tarifa.
   * Se pasa el socio explícitamente para poder calcularlo al momento de
   * elegirlo.
   */
  const precioDeClase = (clase, socio = selectedClient) => {
    if (!clase) return 0;
    if (tipoReserva === 'cliente' && socio?.id === selectedClient?.id && comprasSocio.some(c =>
      c.fechaInicio <= fechaReserva && c.fechaFin >= fechaReserva && c.clasesIds.includes(clase.idClase)
      && c.saldos.some(s => (!s.claseId || s.claseId === clase.idClase) && (s.disponibles === null || s.disponibles > 0)))) return 0;
    if (tipoReserva === 'cliente' && socio && esPremium(socio) && membresiaVigente(socio)) {
      return 0;
    }
    return Number(clase.precio ?? 0);
  };

  /*
   * ¿La persona ya reservó esta clase en este horario (y no la canceló)?
   * La comparación incluye la fecha: el mismo horario puede repetirse otro día.
   */
  const yaReservada = (nombre, nombreClase, fecha, hora) =>
    reservations.some(
      r =>
        r.client === nombre &&
        r.class === nombreClase &&
        r.fecha === fecha &&
        r.time === hora &&
        !ESTADOS_INACTIVOS.includes(r.status),
    );

  // Cuántas reservas activas tiene una persona (límite anti-acaparamiento).
  // Solo cuentan las reservas con fecha: las que no la tienen (registros
  // viejos, sin horario real) no ocupan cupo. Las inasistencias tampoco.
  const reservasActivasDeCliente = (nombre) =>
    reservations.filter(
      r => r.client === nombre && !ESTADOS_INACTIVOS.includes(r.status) && r.fecha
    ).length;

  /*
   * ¿El horario ya pasó? Solo aplica a la fecha de hoy: un horario de una
   * fecha futura todavía se puede reservar.
   */
  const horarioPasado = (fecha, hora) => {
    if (!/^\d{2}:\d{2}$/.test(hora || '')) return false;
    if (!fecha || fecha !== hoyISO()) return false;
    const [h, m] = hora.split(':').map(Number);
    const ahora = new Date();
    const claseHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), h, m);
    return claseHoy.getTime() < ahora.getTime();
  };

  // La clase de administrativa debe tener precio > 0 y capacidad > 0 para poderse reservar.
  const claseReservable = (clase) =>
    Number(clase?.precio ?? 0) > 0 && Number(clase?.capacidad ?? 0) > 0;

  /*
   * ¿El formulario del modal está listo para guardar? El botón se deshabilita
   * hasta cumplir TODO: nombre válido, tipo seleccionado, horario elegido,
   * socio vigente (si es "cliente"), que no sea duplicado y que haya cupo.
   */
  const horarioSelModal = horarios.find(
    h => h.idHorario === newReservation.horarioId
  );
  const claseSelModal = clases.find(c => c.nombre === newReservation.class);
  const nombreValido = (newReservation.client || '').trim().length >= 3;
  const socioOk = tipoReserva === 'visitante' || (selectedClient && membresiaVigente(selectedClient));
  const puedeGuardar =
    nombreValido &&
    !!horarioSelModal &&
    !!claseSelModal &&
    claseReservable(claseSelModal) &&
    (lugaresDisponibles(horarioSelModal) > 0 || horarioSelModal.listaEsperaHabilitada === true) &&
    !horarioPasado(horarioSelModal.fecha, horarioSelModal.horaInicio) &&
    socioOk &&
    !yaReservada(newReservation.client, newReservation.class, fechaReserva, newReservation.time) &&
    reservasActivasDeCliente(newReservation.client) < 3;

  // ========== FUNCIONES DE ACCIONES PRINCIPALES ==========

  /*
   * Confirmar asistencia marca la reservación como "asistido" en el backend
   * (PostgreSQL, esquema webcobro) para que también se refleje en el módulo
   * administrativo (filtro "Asistidas"). NO se borra el registro.
   */
  const handleConfirmAttendance = async (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) throw new Error('La reservación no existe.');
      if (reservation.paymentStatus !== 'pagado') throw new Error('Primero registra el pago o la cobertura de la reserva.');
      if (reservation.status === 'asistido') throw new Error('Este cliente ya tiene asistencia confirmada.');
      if (reservation.capacityStatus === 'espera') throw new Error('El cliente sigue en lista de espera.');

      const response = await fetch(`${API}/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'asistido' }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'No se pudo confirmar la asistencia.');
      }

      setReservations(prev => prev.map(res =>
        res.id === id ? { ...res, status: 'asistido', attendanceStatus: 'asistido' } : res
      ));
      // Si estaba pendiente ya no cuenta como cliente esperado en el KPI.
      await cargarKpis();
      showNotification(`Asistencia confirmada para ${reservation.client}.`, 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  /*
   * Abre el modal de cobro de una reservación. Lo usan el botón "Cobrar" de
   * la tabla y la búsqueda por nombre o código de reserva (reservas de la app).
   */
  const abrirCobro = (reservation) => {
    if (!reservation) {
      showNotification('No se encontró la reservación.', 'error');
      return;
    }
    if (reservation.paymentStatus === 'pagado') {
      showNotification('Esta clase ya fue cobrada.', 'error');
      return;
    }
    if (reservation.status === 'cancelado') {
      showNotification(`La reservación ${reservation.codigo || ''} está cancelada.`, 'error');
      return;
    }
    if (reservation.status === 'no_asistio') {
      showNotification(`${reservation.client} no asistió a esta clase: no se puede cobrar ni reagendar.`, 'error');
      return;
    }
    if (reservation.capacityStatus === 'espera') {
      showNotification('No se puede cobrar mientras el cliente siga en lista de espera.', 'error');
      return;
    }
    setSelectedReservationForPayment(reservation);
    // Se limpia la forma de pago para que cada cobro empiece de cero.
    setMetodoPago(null);
    setEfectivoInput('');
    setReferenciaInput('');
    setIsPaymentModalOpen(true);
  };

  const handlePayment = (id) => abrirCobro(reservations.find(r => r.id === id));

  const handleConfirmPayment = async () => {
    if (!selectedReservationForPayment) return;

    setPaymentLoading(true);
    try {
      // El cobro se guarda en el backend: marca la reservación como pagada y
      // registra el pago en PostgreSQL (esquema webcobro) con su forma de pago.
      // El monto lo toma el servidor del precio real de la reservación.
      const response = await fetch(`${API}/api/cobros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservaId: selectedReservationForPayment.id,
          metodoPago,
          // El efectivo recibido solo aplica cuando se cobra en efectivo.
          efectivoRecibido: metodoPago === 'efectivo' ? efectivoRecibido : undefined,
          // La referencia solo aplica cuando se cobra por transferencia.
          referencia: metodoPago === 'transferencia' ? referenciaInput.trim() : undefined,
          usuario: user?.nombre || user?.name || user?.username || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar el cobro');
      }

      // Se reemplaza la fila con la reservación que devolvió el backend.
      setReservations(prev => prev.map(res =>
        res.id === data.reserva.id ? data.reserva : res
      ));
      setTicket(data.ticket ?? null);

      /*
       * Aviso con el método cobrado y, si hubo cambio en efectivo, se muestra
       * para que el recepcionista sepa cuánto devolver.
       */
      const cambioTexto =
        metodoPago === 'efectivo' && data.pago.cambio > 0 ? ` Cambio: $${data.pago.cambio}.` : '';
      showNotification(
        `Cobro en ${METHOD_LABELS[metodoPago]} de $${data.pago.monto} registrado.${cambioTexto}`,
        'success'
      );

      /**
       * Recalcula los KPIs: el cobro acaba de guardarse en PostgreSQL
       * y la tarjeta de ingresos del día debe reflejarlo al instante.
       */
      await cargarKpis();
      closePaymentModal();
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setPaymentLoading(false);
    }
  };

  /*
   * Cancelar una reservación la marca como "cancelado" en el backend
   * (PostgreSQL, esquema webcobro). NO se borra el registro: se conserva como
   * historial y el módulo administrativo la muestra en su filtro "Canceladas".
   */
  const handleCancel = async (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) throw new Error('La reservación ya no existe.');
      // Regla de 24 horas y estados: la decide el backend y la manda en la fila.
      if (reservation.puedeCancelar === false) {
        throw new Error(reservation.motivoNoCancelar || 'Esta reservación ya no se puede cancelar.');
      }

      const confirmed = window.confirm(
        `¿Cancelar la reservación de ${reservation.client} (${reservation.class})?\n\n` +
        'La cancelación NO tiene reembolso.'
      );
      if (!confirmed) return;

      const response = await fetch(`${API}/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelado' }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo cancelar la reservación.');
      }

      // Se quita la cancelada y, si el backend promovió la primera reserva en
      // espera, se refleja de inmediato como confirmada en la tabla.
      setReservations(prev => prev
        .filter(res => res.id !== id)
        .map(res => body?.promovida?.id === res.id ? body.promovida : res));
      await cargarKpis();
      showNotification(body?.mensaje || 'Reservación cancelada.', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  // ========== REAGENDAR (solo una vez, sin costo) ==========

  const openReagendar = (reservation) => {
    if (reservation.puedeReagendar === false) {
      showNotification(reservation.motivoNoReagendar || 'Esta reservación ya no se puede reagendar.', 'error');
      return;
    }
    setHorariosReagendar([]);
    setHorarioReagendarId('');
    setFechaReagendar(reservation.fecha && reservation.fecha >= hoyISO() ? reservation.fecha : hoyISO());
    setReservaAReagendar(reservation);
  };

  const closeReagendar = () => {
    setReservaAReagendar(null);
    setHorariosReagendar([]);
    setHorarioReagendarId('');
  };

  const handleConfirmReagendar = async () => {
    if (!reservaAReagendar || !horarioReagendarId) return;
    setReagendando(true);
    try {
      const response = await fetch(`${API}/api/reservas/${reservaAReagendar.id}/reagendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horarioId: horarioReagendarId, fecha: fechaReagendar }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || 'No se pudo reagendar la reservación.');
      }
      setReservations(prev => prev.map(res => {
        if (res.id === body.reservacion.id) return body.reservacion;
        if (body.promovida && res.id === body.promovida.id) return body.promovida;
        return res;
      }));
      await cargarKpis();
      showNotification(body.mensaje || 'Reservación reagendada.', 'success');
      closeReagendar();
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setReagendando(false);
    }
  };

  // ========== BÚSQUEDA POR CÓDIGO O NOMBRE (reservas de la app móvil) ==========

  /*
   * Con Enter (o el botón Buscar) en el buscador:
   *  - Código de reserva: se busca directo en el backend (puede ser una reserva
   *    recién hecha en la app) y, si se puede cobrar, se abre el cobro.
   *  - Nombre: se recarga la lista para incluir las reservas nuevas de la app;
   *    si el cliente tiene una sola reservación por cobrar, se abre el cobro.
   */
  const handleBuscarReserva = async () => {
    const termino = searchTerm.trim();
    if (!termino) return;
    setBuscandoCodigo(true);
    try {
      if (pareceCodigoReserva(termino)) {
        const response = await fetch(`${API}/api/reservas/codigo/${encodeURIComponent(termino)}`);
        const body = await response.json().catch(() => null);
        if (response.ok) {
          const encontrada = body;
          setReservations(prev => {
            if (encontrada.status === 'cancelado') return prev.filter(r => r.id !== encontrada.id);
            return prev.some(r => r.id === encontrada.id)
              ? prev.map(r => (r.id === encontrada.id ? encontrada : r))
              : [...prev, encontrada];
          });
          if (encontrada.paymentStatus === 'pagado') {
            showNotification(`La reservación ${encontrada.codigo} de ${encontrada.client} ya está pagada.`, 'success');
            return;
          }
          abrirCobro(encontrada);
          return;
        }
        // Sin el prefijo RSV- también puede ser un nombre de 6 letras
        // ("Carlos"): en ese caso se sigue con la búsqueda por nombre.
        if (response.status !== 404 || /^RSV-/i.test(termino)) {
          throw new Error(body?.error || 'No se encontró la reservación.');
        }
      }

      const lista = await recargarReservas();
      const nombre = termino.toLowerCase();
      const delCliente = lista.filter(r => r.client.toLowerCase().includes(nombre));
      const porCobrar = delCliente.filter(
        r => r.paymentStatus !== 'pagado' && (r.status === 'pendiente' || r.status === 'asistido') && r.capacityStatus !== 'espera'
      );
      if (delCliente.length === 0) {
        throw new Error(`No hay reservaciones con el nombre o código "${termino}".`);
      }
      if (porCobrar.length === 1) {
        abrirCobro(porCobrar[0]);
      } else if (porCobrar.length === 0) {
        showNotification(`"${termino}" no tiene reservaciones pendientes de cobro.`, 'success');
      } else {
        showNotification(`"${termino}" tiene ${porCobrar.length} reservaciones por cobrar: elige cuál en la tabla.`, 'success');
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setBuscandoCodigo(false);
    }
  };

  // ========== FUNCIONES DEL MODAL ==========

  const openModal = () => {
    setNewReservation({ client: '', class: '', time: '', price: '', horarioId: '' });
    setTipoReserva('cliente');
    setSelectedClient(null);
    setShowClientList(false);
    // El formulario siempre arranca en el día de hoy.
    setFechaReserva(hoyISO());
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    try {
      const nombreLimpio = (newReservation.client || '').trim();
      if (!nombreLimpio || !newReservation.class || !newReservation.time) {
        throw new Error('Selecciona un cliente y un horario disponible.');
      }
      if (nombreLimpio.length < 3) {
        throw new Error('El nombre del cliente es demasiado corto.');
      }

      // El horario elegido tiene que existir en la fecha seleccionada: es lo
      // que valida el backend contra el módulo de horarios.
      const horarioSel = horarios.find(
        h => h.idHorario === newReservation.horarioId
      );
      if (!horarioSel) {
        throw new Error('Elige un horario disponible de la fecha seleccionada.');
      }

      const claseSel = clases.find(c => c.nombre === newReservation.class);
      if (!claseSel) {
        throw new Error('Selecciona una clase disponible.');
      }
      if (!claseReservable(claseSel)) {
        throw new Error(`La clase "${claseSel.nombre}" no tiene un precio/capacidad válidos.`);
      }

      // Un socio solo reserva como "cliente" si está activo y vigente; si no,
      // debe registrarse como visitante (el backend vuelve a validarlo).
      if (tipoReserva === 'cliente' && selectedClient && !membresiaVigente(selectedClient)) {
        throw new Error('La membresía del socio no está vigente. Regístralo como visitante.');
      }

      if (lugaresDisponibles(horarioSel) <= 0 && horarioSel.listaEsperaHabilitada !== true) {
        throw new Error(`La clase "${horarioSel.nombreClase}" a las ${horarioSel.horaInicio} ya no tiene cupo disponible.`);
      }
      if (horarioPasado(horarioSel.fecha, horarioSel.horaInicio)) {
        throw new Error(`La clase de las ${horarioSel.horaInicio} ya pasó, elige otro horario.`);
      }
      if (yaReservada(nombreLimpio, horarioSel.nombreClase, horarioSel.fecha, horarioSel.horaInicio)) {
        throw new Error(`"${nombreLimpio}" ya reservó "${horarioSel.nombreClase}" a las ${horarioSel.horaInicio}.`);
      }
      if (reservasActivasDeCliente(nombreLimpio) >= 3) {
        throw new Error(`"${nombreLimpio}" ya tiene 3 reservaciones activas. Cancela una para crear otra.`);
      }

      if (tipoReserva === 'visitante' && Number(claseSel.precio ?? 0) <= 0) {
        throw new Error('El visitante debe pagar la tarifa de la clase.');
      }

      /*
       * Se guarda la reservación en el backend (PostgreSQL, esquema webcobro).
       * El precio NO se manda: el servidor lo calcula con la tarifa de la clase
       * y la membresía del socio, para que el navegador no pueda inventarse
       * un monto.
       */
      const response = await fetch(`${API}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: nombreLimpio,
          clienteId: tipoReserva === 'cliente' ? selectedClient?.id : null,
          type: tipoReserva,
          class: horarioSel.nombreClase,
          time: horarioSel.horaInicio,
          fecha: horarioSel.fecha,
          horarioId: horarioSel.idHorario,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la reservación.');
      }

      // Se agrega a la tabla la reservación que devolvió el backend.
      setReservations(prev => [...prev, data.reservacion]);
      showNotification(data.mensaje || `Reservación creada para ${data.reservacion.client}.`, 'success');
      closeModal();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  // ========== FUNCIÓN DE NOTIFICACIONES ==========

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = () => {
    logout();
    window.location.assign(LOGIN_PATH);
  };

  // ========== CÁLCULOS DE RESUMEN Y FILTRADO ==========

  const totalPending = reservations.filter(r => r.status === 'pendiente').length;
  const totalPaid = reservations.filter(r => r.paymentStatus === 'pagado').reduce((sum, r) => sum + r.price, 0);

  /*
   * Valores derivados del modal de cobro: se calculan con el monto real de la
   * reservación seleccionada y lo que el recepcionista captura en efectivo,
   * para habilitar el botón y mostrar el cambio (misma lógica que el POS).
   */
  const payTotal = selectedReservationForPayment ? selectedReservationForPayment.price : 0;
  const efectivoRecibido = parseFloat(efectivoInput) || 0;
  const cambio = efectivoRecibido - payTotal;
  const efectivoInsuficiente = efectivoInput !== '' && efectivoRecibido < payTotal;
  const canConfirmPayment =
    metodoPago === 'tarjeta' ||
    metodoPago === 'transferencia' ||
    (metodoPago === 'efectivo' && efectivoRecibido >= payTotal);

  // Cierra el modal de cobro y limpia la forma de pago seleccionada.
  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedReservationForPayment(null);
    setMetodoPago(null);
    setEfectivoInput('');
    setReferenciaInput('');
  };

  const printTicket = () => {
    if (!ticket) return;

    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) {
      showNotification('El navegador bloqueó la ventana de impresión.', 'error');
      return;
    }

    const escapeHtml = (value) =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const items = (ticket.items ?? []).map(item => `
      <div class="item">
        <strong>${escapeHtml(item.descripcion)}</strong>
        <div class="row"><span>${item.cantidad} × ${escapeHtml(formatMoney(item.precioUnitario))}</span><span>${escapeHtml(formatMoney(item.importe))}</span></div>
      </div>
    `).join('');

    popup.document.write(`<!doctype html>
      <html lang="es"><head><meta charset="utf-8"><title>Ticket ${escapeHtml(ticket.folio)}</title>
      <style>
        @page { size: 80mm auto; margin: 6mm; }
        body { width: 68mm; margin: 0 auto; color: #111; font: 12px/1.4 monospace; }
        h1, p { margin: 0; } h1 { font-size: 18px; text-align: center; }
        .center { text-align: center; } .line { border-top: 1px dashed #555; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; gap: 12px; }
        .item { margin: 8px 0; } .total { font-size: 15px; font-weight: 700; }
      </style></head><body>
      <h1>NUUCLEO</h1><p class="center">Comprobante de cobro</p><div class="line"></div>
      <p><strong>Folio:</strong> ${escapeHtml(ticket.folio)}</p>
      <p><strong>Fecha:</strong> ${escapeHtml(formatTicketDate(ticket.fecha))}</p>
      <p><strong>Cliente:</strong> ${escapeHtml(ticket.cliente)}</p>
      ${ticket.contexto === 'membresia' ? `
      <p><strong>Membresía:</strong> ${escapeHtml(ticket.membresia)}</p>
      <p><strong>Vigencia:</strong> ${escapeHtml(ticket.fechaInicio)} al ${escapeHtml(ticket.fechaFin)}</p>` : `
      <p><strong>Reserva:</strong> #${escapeHtml(ticket.reservaId)}</p>
      <p><strong>Clase:</strong> ${escapeHtml(ticket.clase)}</p>
      <p><strong>Horario:</strong> ${escapeHtml(ticket.fechaClase)} ${escapeHtml(ticket.horaClase)}</p>`}
      <p><strong>Atendió:</strong> ${escapeHtml(ticket.usuario || 'Recepción')}</p>
      <div class="line"></div>${items}<div class="line"></div>
      <div class="row total"><span>TOTAL</span><span>${escapeHtml(formatMoney(ticket.total))}</span></div>
      <p><strong>Método:</strong> ${escapeHtml(METHOD_LABELS[ticket.metodoPago] || ticket.metodoPago)}</p>
      ${ticket.efectivoRecibido !== null ? `<p><strong>Recibido:</strong> ${escapeHtml(formatMoney(ticket.efectivoRecibido))}</p>` : ''}
      ${ticket.cambio !== null ? `<p><strong>Cambio:</strong> ${escapeHtml(formatMoney(ticket.cambio))}</p>` : ''}
      ${ticket.referencia ? `<p><strong>Referencia:</strong> ${escapeHtml(ticket.referencia)}</p>` : ''}
      <div class="line"></div><p class="center">Gracias por su visita.</p>
      <script>window.addEventListener('load', () => { window.print(); });<\/script>
      </body></html>`);
    popup.document.close();
  };

  const filteredReservations = reservations.filter(res => {
    const term = searchTerm.toLowerCase();
    return (
      res.client.toLowerCase().includes(term) ||
      (res.codigo || '').toLowerCase().includes(term) ||
      res.class.toLowerCase().includes(term) ||
      res.time.toLowerCase().includes(term) ||
      String(res.id).includes(term)
    );
  });

  // ========== VALORES DE PRESENTACIÓN ==========

  const filtroActivo = FILTROS_ESTADO.find(f => f.key === filtroEstado) ?? FILTROS_ESTADO[0];
  const horarioVista = horarios.find(h => h.idHorario === horarioVistaId);
  const coincideHorarioVista = res => !horarioVista || (
    res.class === horarioVista.nombreClase && res.fecha === horarioVista.fecha && res.time === horarioVista.horaInicio
  );
  const reservasDeVista = filteredReservations.filter(coincideHorarioVista);
  const reservasVisibles = reservasDeVista.filter(filtroActivo.coincide);
  const reservaVista = reservations.find(res => res.id === reservaVistaId);
  const clienteVista = reservaVista && clientes.find(c => String(c.id) === String(reservaVista.clienteId));
  const conteoPorFiltro = Object.fromEntries(
    FILTROS_ESTADO.map(f => [f.key, reservasDeVista.filter(f.coincide).length])
  );
  const hayFiltros = searchTerm.trim() !== '' || filtroEstado !== 'todas';
  const nombreUsuario = user ? `${user.nombre ?? ''} ${user.apellidos ?? ''}`.trim() : '';
  const inicialesUsuario = iniciales(nombreUsuario);

  // Socios que coinciden con lo escrito en "Buscar socio" (por nombre o ID).
  const textoSocio = newReservation.client || '';
  const sociosFiltrados = clientes.filter(
    c => c.nombre.toLowerCase().includes(textoSocio.toLowerCase()) || String(c.id).includes(textoSocio)
  );

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFiltroEstado('todas');
    setHorarioVistaId(null);
  };

  // ========== RETORNO DEL JSX ==========

  return (
    <div className="rx-admin-shell rx-reception">

      {/* ========== MENÚ LATERAL (igual que administrativa y Punto de Venta) ========== */}
      <aside className={`rx-sidebar ${menuColapsado ? 'rx-sidebar--collapsed' : 'rx-sidebar--expanded'}`}>
        <div className={`rx-sidebar-header ${menuColapsado ? 'rx-sidebar-header--collapsed' : ''}`}>
          {menuColapsado ? (
            <button
              type="button"
              onClick={() => setMenuColapsado(false)}
              title="Expandir menú"
              aria-label="Expandir menú"
              aria-expanded={false}
              className="rx-sidebar-toggle"
            >
              <BrandLogo variant="symbol" className="h-8 w-8" />
            </button>
          ) : (
            <>
              <div className="rx-brand-content">
                <BrandLogo className="w-40" />
              </div>
              <button
                type="button"
                onClick={() => setMenuColapsado(true)}
                title="Contraer menú"
                aria-label="Contraer menú"
                aria-expanded={true}
                className="rx-sidebar-toggle"
              >
                <MaterialIcon name="chevron_left" className="text-xl" />
              </button>
            </>
          )}
        </div>

        <nav className="rx-sidebar-nav" aria-label="Navegación de recepción">
          <NavLink
            to="/front-desk/dashboard"
            title={menuColapsado ? 'Recepción' : undefined}
            className={({ isActive }) =>
              `rx-nav-item ${menuColapsado ? 'rx-nav-item--collapsed' : ''} ${isActive ? 'rx-nav-item--active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <MaterialIcon name="event_available" className="flex-shrink-0 text-xl" filled={isActive} />
                {!menuColapsado && <span className="truncate">Recepción</span>}
                {kpis.clientesEsperados > 0 && (
                  <span className="rx-nav-count" title="Clientes esperados hoy">
                    {kpis.clientesEsperados}
                  </span>
                )}
              </>
            )}
          </NavLink>
          <NavLink
            to="/front-desk/clientes"
            title={menuColapsado ? 'Clientes' : undefined}
            className={({ isActive }) =>
              `rx-nav-item ${menuColapsado ? 'rx-nav-item--collapsed' : ''} ${isActive ? 'rx-nav-item--active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <MaterialIcon name="group" className="flex-shrink-0 text-xl" filled={isActive} />
                {!menuColapsado && <span className="truncate">Clientes</span>}
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={() => { navigate('/front-desk/dashboard'); setVerMembresias(true); }}
            aria-label="Vender paquetes"
            aria-pressed={verMembresias}
            title={menuColapsado ? 'Vender paquetes' : undefined}
            className={`rx-nav-item ${menuColapsado ? 'rx-nav-item--collapsed' : ''} ${verMembresias ? 'rx-nav-item--active' : ''}`}
          >
            <MaterialIcon name="sell" className="flex-shrink-0 text-xl" filled />
            {!menuColapsado && <span className="truncate">Vender paquetes</span>}
          </button>
          {/* El checador es un kiosco aparte: se abre en otra pestaña. */}
          <Link
            to="/asistencia"
            target="_blank"
            rel="noreferrer"
            title={menuColapsado ? 'Reloj checador' : 'Abre el reloj checador en otra pestaña'}
            className={`rx-nav-item ${menuColapsado ? 'rx-nav-item--collapsed' : ''}`}
          >
            <MaterialIcon name="badge" className="flex-shrink-0 text-xl" />
            {!menuColapsado && <span className="truncate">Reloj checador</span>}
          </Link>
        </nav>

        <div className="rx-sidebar-footer">
          <div className={`rx-user-card ${menuColapsado ? 'rx-user-card--collapsed' : ''}`}>
            <div className="rx-user-avatar">{inicialesUsuario}</div>
            {!menuColapsado && user && (
              <div className="rx-user-copy">
                <p className="rx-user-name">{nombreUsuario}</p>
                <p className="rx-user-role">Recepción</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title={menuColapsado ? 'Cerrar sesión' : undefined}
            className={`rx-nav-item rx-nav-item--danger ${menuColapsado ? 'rx-nav-item--collapsed' : ''}`}
          >
            <MaterialIcon name="logout" className="flex-shrink-0 text-xl" />
            {!menuColapsado && <span className="truncate">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="rx-admin-main">
        {/* ========== BARRA SUPERIOR ========== */}
        <header className="rx-admin-topbar">
          <div className="rx-admin-topbar-context">
            <span className="rx-admin-topbar-kicker">Front desk</span>
            <strong>Recepción y cobro</strong>
          </div>
          <div className="rx-admin-topbar-user">
            <div className="rx-admin-presence" aria-label="Sesión activa">
              <span className="rx-admin-presence-dot" />
              <span className="rx-admin-user-name">{nombreUsuario}</span>
              <span className="rx-admin-user-role">Recepción</span>
            </div>
            <div className="rx-user-avatar rx-user-avatar--topbar">{inicialesUsuario}</div>
          </div>
        </header>

        <main className="rx-admin-content">
          {vista === 'clientes' ? <ClientesPage soloRegistro /> : (
          <section className="rx-admin-dashboard">
            <header className="rx-page-header rx-admin-dashboard-header">
              <div className="rx-page-heading rx-page-heading--stacked">
                <span className="rx-section-eyebrow">Atención de clientes</span>
                <h1 className="rx-page-title">Recepción</h1>
                <p className="rx-page-subtitle">{fechaDeHoyLarga()}</p>
              </div>
            </header>


          

        <div className="rx-page-content"></div>

            <div className="rx-page-content">
              {verMembresias && <MembresiasRecepcion clientes={clientes} clases={clases} onClose={() => setVerMembresias(false)} onTicket={nuevoTicket => { setVerMembresias(false); setTicket(nuevoTicket); }}
                onVenta={() => {
                  cargarKpis();
                  fetch(`${API}/api/clientes`).then(r => { if (!r.ok) throw Error('No se pudieron actualizar los clientes.'); return r.json(); })
                    .then(datos => { setClientes(datos); setSelectedClient(null); })
                    .catch(e => showNotification(e.message, 'error'));
                }} />}


              <div className="rx-reception-workspace">
                <section className="rx-reception-schedule" aria-labelledby="reception-schedule-title">
                  <div className="rx-reception-section-heading">
                    <h2 id="reception-schedule-title">Clases programadas</h2>
                    <span className="rx-badge rx-badge--special">{fechaReserva === hoyISO() ? 'Hoy' : formatFechaCorta(fechaReserva)}</span>
                  </div>
                  {/*  Tarjetas kpi clases programadas y cobros del dia */}
                    <div className="rx-kpi-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                   {/* KPI: Clases programadas */}
                  <div className="rx-kpi-card" style={{
                    background: '#fff',
                      borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                     border: '1px solid #e5e7eb'
                      }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                       <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                           <MaterialIcon name="event_available" className="text-2xl" style={{ color: '#0284c7' }} />
                        </div>
                        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Clases programadas</span>
                     </div>
                       <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>
                     {horarios.length}
                  </p>
                </div>

                    {/* KPI: Ingresos del día */}
                      <div className="rx-kpi-card" style={{
              background: '#fff',
                  borderRadius: '12px',
                    padding: '20px',
                     boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                   border: '1px solid #e5e7eb'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                  <div style={{
                                 width: '40px', height: '40px', borderRadius: '10px',
                             background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                        <MaterialIcon name="payments" className="text-2xl" style={{ color: '#16a34a' }} />
                          </div>
                        <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>Ingresos del día</span>
                    </div>
                   <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>
                      {formatMoney(kpis.ingresosHoy)}
                         </p>
                    </div>
            </div>
                  <label className="rx-field">
                    <span className="rx-label">Fecha de clases</span>
                    
                    <input type="date" className="rx-input" value={fechaReserva}
                      onChange={event => { setFechaReserva(event.target.value); setHorarioVistaId(null); setReservaVistaId(null); }} />
                  </label>
                  <button type="button" className="rx-reception-all" aria-pressed={!horarioVista}
                    onClick={() => { setHorarioVistaId(null); setReservaVistaId(null); }}>
                    Todas las reservaciones <MaterialIcon name="arrow_forward" className="text-lg" />
                  </button>
                  <div className="rx-reception-schedule-list" tabIndex={0} role="region" aria-label="Lista de clases programadas">
                    {[...horarios].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)).map(horario => {
                      const libres = lugaresDisponibles(horario);
                      const ocupados = reservasActivasDe(horario.nombreClase, horario.fecha, horario.horaInicio);
                      const ahora = new Date();
                      const inicio = new Date(`${horario.fecha}T${horario.horaInicio}`);
                      const fin = horario.horaFin ? new Date(`${horario.fecha}T${horario.horaFin}`) : inicio;
                      const pasada = fin <= ahora;
                      const enCurso = inicio <= ahora && fin > ahora;
                      const llegaron = reservations.filter(r => r.class === horario.nombreClase && r.fecha === horario.fecha && r.time === horario.horaInicio && r.status === 'asistido').length;
                      return (
                        <button type="button" key={horario.idHorario}
                          aria-pressed={horarioVistaId === horario.idHorario}
                          className={`rx-reception-class ${pasada ? 'rx-reception-class--past' : ''}`}
                          onClick={() => { setHorarioVistaId(horario.idHorario); setReservaVistaId(null); }}>
                          <span className="rx-reception-class-top"><strong>{horario.horaInicio}</strong>
                            <span className={`rx-badge rx-badge--${pasada ? 'neutral' : enCurso ? 'success' : 'warning'}`}>
                              {pasada ? 'Terminó' : enCurso ? 'En curso' : libres ? 'Próxima' : 'Sin cupo'}
                            </span>
                          </span>
                          <span className="rx-reception-class-name">{horario.nombreClase}</span>
                          <span className="rx-reception-class-coach">{horario.entrenador || horario.nombreEntrenador || 'Entrenador sin asignar'}</span>
                          <span className="rx-reception-capacity"><span style={{ width: `${Math.min(100, llegaron / Math.max(1, Number(horario.capacidadTotal)) * 100)}%` }} /><span className="rx-reception-capacity-reserved" style={{ width: `${Math.min(100, Math.max(0, ocupados - llegaron) / Math.max(1, Number(horario.capacidadTotal)) * 100)}%` }} /></span>
                          <span className="rx-reception-class-meta">{llegaron} llegaron · {ocupados} de {horario.capacidadTotal} reservados</span>
                        </button>
                      );
                    })}
                    {!horarios.length && <p className="rx-reception-hint">No hay clases programadas para esta fecha.</p>}
                  </div>
                </section>

                <section className="rx-reception-reservations" aria-labelledby="reception-reservations-title">
                  <div className="rx-reception-list-heading">
                    <div><h2 id="reception-reservations-title">{horarioVista ? `${horarioVista.nombreClase} · ${horarioVista.horaInicio} h` : 'Reservaciones'}</h2>
                      <p>{horarioVista ? `${horarioVista.nombreEntrenador || 'Entrenador sin asignar'} · ${reservasActivasDe(horarioVista.nombreClase, horarioVista.fecha, horarioVista.horaInicio)} de ${horarioVista.capacidadTotal} lugares reservados` : 'Selecciona una clase o consulta todas las reservaciones.'}</p>
                    </div>
                    <button type="button" onClick={openModal} className="rx-btn rx-btn--accent rx-btn--small"><MaterialIcon name="add" className="text-lg" />Nuevo registro</button>
                  </div>
              {/* ========== BÚSQUEDA (CÓDIGO O NOMBRE) Y FILTROS ========== */}
              <div className="rx-filter-bar rx-filter-stack">
                <div className="rx-filter-row">
                  <div className="rx-search">
                    <MaterialIcon name="search" className="rx-search-icon text-lg" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarReserva(); }}
                      placeholder="Código de reserva (RSV-XXXXXX) o nombre del cliente"
                      aria-label="Buscar reservación por código de reserva o nombre del cliente"
                      className="rx-input rx-input--search"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        aria-label="Limpiar búsqueda"
                        className="rx-search-clear"
                      >
                        <MaterialIcon name="close" className="text-lg" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarReserva}
                    disabled={!searchTerm.trim() || buscandoCodigo}
                    title="Busca por código o nombre y abre el cobro"
                    className="rx-btn rx-btn--dark"
                  >
                    <MaterialIcon name="qr_code_scanner" className="text-lg" />
                    {buscandoCodigo ? 'Buscando…' : 'Buscar y cobrar'}
                  </button>
                  <span className="rx-results-count">
                    {reservasVisibles.length} de {reservations.length} reservaciones
                  </span>
                </div>

                <div className="rx-tabs" role="tablist" aria-label="Filtrar reservaciones por estado">
                  {FILTROS_ESTADO.map(filtro => (
                    <button
                      key={filtro.key}
                      type="button"
                      role="tab"
                      aria-selected={filtroEstado === filtro.key}
                      onClick={() => setFiltroEstado(filtro.key)}
                      className="rx-tab"
                    >
                      {filtro.etiqueta}
                      <span className="rx-tab-count">{conteoPorFiltro[filtro.key]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ========== TABLA DE RESERVACIONES ========== */}
              <div className="rx-table-card">
                {reservasVisibles.length === 0 ? (
                  <div className="rx-table-empty">
                    <div className="rx-table-empty-icon">
                      <MaterialIcon name={hayFiltros ? 'search_off' : 'event_busy'} className="text-3xl" />
                    </div>
                    <p className="rx-table-empty-title">
                      {hayFiltros ? 'No hay reservaciones con este filtro.' : 'Aún no hay reservaciones.'}
                    </p>
                    {hayFiltros && (
                      <button type="button" onClick={limpiarFiltros} className="rx-table-empty-action">
                        Ver todas las reservaciones
                      </button>
                    )}
                  </div>
                ) : (
                  <RecepcionTabla reservas={reservasVisibles} clientes={clientes} seleccion={reservaVistaId} onSeleccionar={setReservaVistaId} hoy={hoyISO()} />
                )}
              </div>
                </section>
                <RecepcionDetalle reserva={reservaVista} cliente={clienteVista}
                  compra={comprasDetalle.find(c => String(c.id) === String(reservaVista?.membresiaCompraId))}
                  cargando={cargandoDetalle} error={errorDetalle}
                  claseId={clases.find(c => c.nombre === reservaVista?.class)?.idClase}
                  horario={horarios.find(h => h.nombreClase === reservaVista?.class && h.fecha === reservaVista?.fecha && h.horaInicio === reservaVista?.time)}
                  onCobrar={handlePayment} onAsistencia={handleConfirmAttendance}
                  onReagendar={openReagendar} onCancelar={handleCancel} hoy={hoyISO()} />
              </div>
            </div>
          </section>
          )}
        </main>
      </div>

      {/* ========== NOTIFICACIONES (mismo toast que el Punto de Venta) ========== */}
      <div className="rx-toast-container" aria-live="polite" aria-atomic="false">
        {notification && (
          <div
            key={notification.message}
            className={`rx-toast rx-toast--${notification.type} toast-enter`}
            role={notification.type === 'error' ? 'alert' : 'status'}
          >
            <span className="rx-toast-icon">
              <MaterialIcon name={ICONOS_TOAST[notification.type] || 'info'} className="text-xl" filled />
            </span>
            <p className="rx-toast-message">{notification.message}</p>
          </div>
        )}
      </div>

      {/* ========== MODAL DE NUEVA RESERVACIÓN ========== */}
      {isModalOpen && (
        <div className="rx-modal-overlay" role="presentation">
          <section
            className="rx-modal rx-modal--scroll modal-enter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nueva-reserva-titulo"
          >
            <header className="rx-modal-header">
              <div>
                <h2 id="nueva-reserva-titulo" className="rx-modal-title">Nueva reservación</h2>
                <p className="rx-modal-subtitle rx-modal-subtitle--plain">
                  Se genera un código de reserva para el cliente.
                </p>
              </div>
              <button type="button" onClick={closeModal} aria-label="Cerrar" className="rx-modal-close">
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </header>

            <form
              id="form-nueva-reserva"
              onSubmit={handleCreateReservation}
              className="rx-modal-body rx-form-stack"
            >
              {/* TIPO DE RESERVA (Socio / Visitante) */}
              <div className="rx-field">
                <span className="rx-label">Tipo de asistencia</span>
                <div className="rx-toggle-group" role="group" aria-label="Tipo de asistencia">
                  <button
                    type="button"
                    aria-pressed={tipoReserva === 'cliente'}
                    onClick={() => {
                      setTipoReserva('cliente');
                      setSelectedClient(null);
                      setNewReservation(p => ({ ...p, client: '', price: '' }));
                      setShowClientList(false);
                    }}
                    className="rx-toggle-option"
                  >
                    <MaterialIcon name="badge" className="text-lg" />
                    Socio registrado
                  </button>
                  <button
                    type="button"
                    aria-pressed={tipoReserva === 'visitante'}
                    onClick={() => {
                      setTipoReserva('visitante');
                      setSelectedClient(null);
                      setNewReservation(p => ({ ...p, client: '', price: '' }));
                      setShowClientList(false);
                    }}
                    className="rx-toggle-option"
                  >
                    <MaterialIcon name="directions_walk" className="text-lg" />
                    Visitante
                  </button>
                </div>
              </div>

              {/* CLIENTE (socio con buscador o nombre del visitante) */}
              {tipoReserva === 'cliente' ? (
                <div className="rx-field">
                  <label className="rx-label" htmlFor="buscar-socio">Buscar socio</label>
                  <div className="rx-autocomplete">
                    <input
                      id="buscar-socio"
                      type="text"
                      autoComplete="off"
                      placeholder="Escribe ID o nombre..."
                      value={newReservation.client}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = clientes.find(c => String(c.id) === val);
                        if (match) {
                          setSelectedClient(match);
                          // El precio depende de la clase ya elegida y de si el
                          // socio es Premium vigente; ya NO se fuerza a 0.
                          const claseSel = clases.find(c => c.nombre === newReservation.class);
                          setNewReservation(p => ({ ...p, client: match.nombre, price: precioDeClase(claseSel, match) }));
                          setShowClientList(false);
                        } else {
                          setSelectedClient(null);
                          setNewReservation(p => ({ ...p, client: val }));
                        }
                      }}
                      onFocus={() => setShowClientList(true)}
                      onBlur={() => setTimeout(() => setShowClientList(false), 200)}
                      className="rx-input"
                    />

                    {/* Al enfocar se muestran todos los socios; al escribir se
                        filtran por nombre o ID. */}
                    {showClientList && !selectedClient && (
                      <ul className="rx-suggestions" role="listbox" aria-label="Socios registrados">
                        {sociosFiltrados.map(c => (
                          <li
                            key={c.id}
                            role="option"
                            aria-selected={false}
                            onMouseDown={() => {
                              setSelectedClient(c);
                              // Recalcula el precio real de la clase elegida
                              // según la membresía del socio.
                              const claseSel = clases.find(cl => cl.nombre === newReservation.class);
                              setNewReservation(p => ({ ...p, client: c.nombre, price: precioDeClase(claseSel, c) }));
                              setShowClientList(false);
                            }}
                            className="rx-suggestion"
                          >
                            <span>
                              {c.nombre} <span className="rx-cell-subtle">#{c.id}</span>
                            </span>
                            <span className={`rx-badge ${c.tieneCompras ? 'rx-badge--accent' : 'rx-badge--neutral'}`}>
                              {c.membresiasCompradas?.map(compra => compra.nombre).join(' · ') || 'Sin membresías compradas'}
                            </span>
                          </li>
                        ))}
                        {sociosFiltrados.length === 0 && (
                          <li className="rx-suggestion rx-suggestion--empty">No se encontraron socios</li>
                        )}
                      </ul>
                    )}
                  </div>

                  {selectedClient && (
                    <div className="rx-stack">
                      <span className="rx-help-text">{selectedClient.nombre} · {selectedClient.tieneCompras ? 'Membresías compradas' : 'Sin membresías compradas'}</span>
                      {saldoCargando ? <p role="status">Consultando cobertura…</p> : <SaldosMembresias compras={comprasSocio} clases={clases} />}
                      {saldoError && <p className="rx-error-text" role="alert">{saldoError}</p>}
                      <span className="rx-help-text">El servidor valida la cobertura al guardar. Sin saldo o fuera de las clases incluidas se cobra la tarifa individual.</span>
                    </div>
                  )}
                  {/* Aviso cuando el socio no puede reservar como socio. */}
                  {selectedClient && !membresiaVigente(selectedClient) && (
                    <span className="rx-error-text" role="alert">
                      <MaterialIcon name="warning" className="text-base" filled />
                      {selectedClient.activo === false
                        ? 'Este socio está inactivo.'
                        : 'La membresía de este socio está vencida.'}{' '}
                      Regístralo como visitante para continuar.
                    </span>
                  )}
                </div>
              ) : (
                <label className="rx-field">
                  <span className="rx-label">Nombre del visitante</span>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={newReservation.client}
                    onChange={(e) => setNewReservation(p => ({ ...p, client: e.target.value }))}
                    className="rx-input"
                  />
                </label>
              )}

              {/* FECHA */}
              <label className="rx-field">
                <span className="rx-label">Fecha de la clase</span>
                <input
                  type="date"
                  value={fechaReserva}
                  min={hoyISO()}
                  onChange={(e) => {
                    const nuevaFecha = e.target.value;
                    setFechaReserva(nuevaFecha);
                    // Al cambiar de fecha se limpian clase y hora: el horario
                    // elegido era de la fecha anterior.
                    setNewReservation(p => ({ ...p, class: '', time: '', price: '', horarioId: '' }));
                  }}
                  className="rx-input"
                />
              </label>

              {/* HORARIOS reales del módulo administrativo para la fecha elegida.
                  Solo se puede reservar un horario activo. */}
              <div className="rx-field">
                <span className="rx-label">Horarios · {formatFechaCorta(fechaReserva)}</span>
                {horarios.length === 0 ? (
                  <p className="rx-inline-note rx-inline-note--info">
                    No hay horarios registrados para esta fecha. Agrégalos en el módulo
                    administrativo (Horarios) para poder reservar.
                  </p>
                ) : (
                  <div className="rx-slot-grid">
                    {horarios.map(h => {
                      const claseDelHorario = clases.find(c => c.nombre === h.nombreClase);
                      const disponibles = lugaresDisponibles(h);
                      const pasada = horarioPasado(h.fecha, h.horaInicio);
                      const duplicada = Boolean(
                        tipoReserva === 'cliente' &&
                        newReservation.client &&
                        yaReservada(newReservation.client, h.nombreClase, h.fecha, h.horaInicio)
                      );
                      const noReservable = !claseReservable(claseDelHorario);
                      const aceptaEspera = disponibles <= 0 && h.listaEsperaHabilitada === true;
                      // Una sesión llena permanece seleccionable solo si admite
                      // lista de espera. Recepción también ve sesiones ocultas.
                      const bloqueada = (disponibles <= 0 && !aceptaEspera) || pasada || duplicada || noReservable;
                      const seleccionada = newReservation.horarioId === h.idHorario;
                      const estadoTexto = aceptaEspera
                        ? 'Lista de espera disponible'
                        : disponibles <= 0
                          ? 'Sin cupo'
                          : pasada
                            ? 'Horario ya pasó'
                            : duplicada
                              ? 'Ya la reservaste'
                              : noReservable
                                ? 'No disponible'
                                : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`;
                      return (
                        <button
                          key={h.idHorario ?? `${h.nombreClase}-${h.horaInicio}`}
                          type="button"
                          disabled={bloqueada}
                          aria-pressed={seleccionada}
                          onClick={() => {
                            setNewReservation(p => ({
                              ...p,
                              class: h.nombreClase,
                              time: h.horaInicio,
                              price: precioDeClase(claseDelHorario),
                              horarioId: h.idHorario,
                            }));
                          }}
                          className="rx-slot"
                        >
                          <span className="rx-slot-title">
                            <span
                              className="rx-class-dot"
                              style={claseDelHorario?.color ? { '--class-color': claseDelHorario.color } : undefined}
                            />
                            {h.nombreClase}
                          </span>
                          <span className="rx-slot-meta">
                            {h.horaInicio} · {formatMoney(claseDelHorario?.precio ?? 0)}
                          </span>
                          <span
                            className={`rx-slot-status ${
                              bloqueada ? 'rx-slot-status--blocked' : aceptaEspera ? 'rx-slot-status--warning' : ''
                            }`}
                          >
                            {estadoTexto}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PRECIO (lo vuelve a calcular el servidor al guardar) */}
              <div className="rx-context-card rx-summary-row">
                <span>Precio</span>
                <strong className="rx-summary-total-value">{formatMoney(precioDeClase(claseSelModal))}</strong>
              </div>
            </form>

            <footer className="rx-modal-footer">
              <button type="button" onClick={closeModal} className="rx-btn rx-btn--outline">
                Cancelar
              </button>
              <button
                type="submit"
                form="form-nueva-reserva"
                disabled={!puedeGuardar}
                className="rx-btn rx-btn--dark"
              >
                <MaterialIcon name="event_available" className="text-lg" />
                Guardar reservación
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* ========== MODAL DE REAGENDAR (una vez, sin costo) ========== */}
      {reservaAReagendar && (
        <div className="rx-modal-overlay" role="presentation">
          <section
            className="rx-modal rx-modal--scroll modal-enter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reagendar-titulo"
          >
            <header className="rx-modal-header">
              <div>
                <h2 id="reagendar-titulo" className="rx-modal-title">Reagendar reservación</h2>
                <p className="rx-modal-subtitle rx-modal-subtitle--plain">Una sola vez y sin costo</p>
              </div>
              <button
                type="button"
                onClick={closeReagendar}
                disabled={reagendando}
                aria-label="Cerrar"
                className="rx-modal-close"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </header>

            <div className="rx-modal-body rx-form-stack">
              <div className="rx-context-card">
                <div className="rx-table-product">
                  <span className="rx-avatar rx-avatar--large">{iniciales(reservaAReagendar.client)}</span>
                  <div>
                    <p className="rx-context-title">{reservaAReagendar.client}</p>
                    <p className="rx-context-copy">
                      {reservaAReagendar.class} · {formatFechaCorta(reservaAReagendar.fecha)} · {reservaAReagendar.time}
                    </p>
                    <p className="rx-context-meta">Código {reservaAReagendar.codigo || '—'}</p>
                  </div>
                </div>
              </div>

              <p className="rx-inline-note rx-inline-note--warning">
                Reagendar no tiene costo, pero solo se puede hacer una vez. Después ya no se podrá
                volver a cambiar.
              </p>

              <label className="rx-field">
                <span className="rx-label">Nueva fecha</span>
                <input
                  type="date"
                  value={fechaReagendar}
                  min={hoyISO()}
                  onChange={(e) => setFechaReagendar(e.target.value)}
                  className="rx-input"
                />
              </label>

              <div className="rx-field">
                <span className="rx-label">
                  Horarios de {reservaAReagendar.class} · {formatFechaCorta(fechaReagendar)}
                </span>
                {horariosReagendar.length === 0 ? (
                  <p className="rx-inline-note rx-inline-note--info">
                    No hay horarios de esta clase en la fecha elegida.
                  </p>
                ) : (
                  <div className="rx-slot-grid">
                    {horariosReagendar.map(h => {
                      const disponibles = lugaresDisponibles(h);
                      const pasada = horarioPasado(h.fecha, h.horaInicio);
                      const esActual = h.idHorario === reservaAReagendar.horarioId;
                      const duplicada = !esActual &&
                        yaReservada(reservaAReagendar.client, h.nombreClase, h.fecha, h.horaInicio);
                      const bloqueada = esActual || pasada || duplicada || disponibles <= 0;
                      const seleccionada = horarioReagendarId === h.idHorario;
                      const estadoTexto = esActual
                        ? 'Horario actual'
                        : pasada
                          ? 'Horario ya pasó'
                          : duplicada
                            ? 'Ya tiene reserva aquí'
                            : disponibles <= 0
                              ? 'Sin cupo'
                              : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`;
                      return (
                        <button
                          key={h.idHorario}
                          type="button"
                          disabled={bloqueada}
                          aria-pressed={seleccionada}
                          onClick={() => setHorarioReagendarId(h.idHorario)}
                          className="rx-slot"
                        >
                          <span className="rx-slot-title">{h.horaInicio}</span>
                          <span className={`rx-slot-status ${bloqueada ? 'rx-slot-status--blocked' : ''}`}>
                            {estadoTexto}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <footer className="rx-modal-footer">
              <button
                type="button"
                onClick={closeReagendar}
                disabled={reagendando}
                className="rx-btn rx-btn--outline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReagendar}
                disabled={!horarioReagendarId || reagendando}
                className="rx-btn rx-btn--dark"
              >
                {reagendando ? (
                  <>
                    <span className="rx-btn-spinner" aria-hidden="true" />
                    Reagendando…
                  </>
                ) : (
                  <>
                    <MaterialIcon name="event_repeat" className="text-lg" />
                    Confirmar cambio
                  </>
                )}
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* ========== MODAL DE COBRO ========== */}
      {isPaymentModalOpen && selectedReservationForPayment && (
        <div className="rx-modal-overlay" role="presentation">
          <section
            className="rx-modal rx-modal--scroll modal-enter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cobro-titulo"
          >
            <header className="rx-modal-header">
              <div>
                <h2 id="cobro-titulo" className="rx-modal-title">Cobro</h2>
                <p className="rx-modal-subtitle rx-modal-subtitle--plain">
                  {metodoPago ? `Pago con ${METHOD_LABELS[metodoPago].toLowerCase()}` : 'Elige el método de pago'}
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paymentLoading}
                aria-label="Cerrar ventana de cobro"
                className="rx-modal-close"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </header>

            <div className="rx-payment-total-banner">
              <p className="rx-payment-total-label">Total a cobrar</p>
              <p className="rx-payment-total-value">{formatMoney(payTotal)}</p>
            </div>

            <div className="rx-modal-body rx-form-stack">
              {/* Resumen de la reservación */}
              <div className="rx-context-card">
                <div className="rx-table-product">
                  <span className="rx-avatar rx-avatar--large">
                    {iniciales(selectedReservationForPayment.client)}
                  </span>
                  <div>
                    <p className="rx-context-title">{selectedReservationForPayment.client}</p>
                    <p className="rx-context-copy">
                      {selectedReservationForPayment.class} · {formatFechaCorta(selectedReservationForPayment.fecha)} · {selectedReservationForPayment.time}
                    </p>
                    <p className="rx-context-meta">
                      {selectedReservationForPayment.codigo
                        ? `Código ${selectedReservationForPayment.codigo}`
                        : `Reserva #${selectedReservationForPayment.id}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* --- MÉTODO DE PAGO (mismos que el POS) --- */}
              {!metodoPago && (
                <div className="rx-field">
                  <span className="rx-label">Método de pago</span>
                  <div className="rx-payment-methods">
                    {PAY_METHODS.map(({ key, label, icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMetodoPago(key)}
                        className="rx-payment-method"
                      >
                        <MaterialIcon name={icon} className="text-2xl" filled />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* --- PANEL: EFECTIVO (captura entregado y calcula cambio) --- */}
              {metodoPago === 'efectivo' && (
                <div className="rx-form-stack">
                  <BotonCambiarMetodo onClick={() => setMetodoPago(null)} />
                  <label className="rx-field">
                    <span className="rx-label">Efectivo recibido</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={efectivoInput}
                      onChange={(e) => setEfectivoInput(e.target.value)}
                      placeholder={`Mínimo ${formatMoney(payTotal)}`}
                      autoFocus
                      className={`rx-input rx-input--amount ${efectivoInsuficiente ? 'rx-input--error' : ''}`}
                    />
                    {efectivoInsuficiente && (
                      <span className="rx-error-text" role="alert">
                        <MaterialIcon name="warning" className="text-base" filled />
                        El efectivo es insuficiente
                      </span>
                    )}
                  </label>
                  {efectivoInput !== '' && efectivoRecibido >= payTotal && (
                    <div className="rx-change-box">
                      <div className="rx-change-row">
                        <span className="rx-change-label">Cambio a devolver</span>
                        <strong className="rx-change-value">{formatMoney(cambio)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- PANEL: TARJETA (terminal física externa, sin datos) --- */}
              {metodoPago === 'tarjeta' && (
                <div className="rx-form-stack">
                  <BotonCambiarMetodo onClick={() => setMetodoPago(null)} />
                  <div className="rx-payment-information">
                    <MaterialIcon name="credit_card" className="rx-payment-information-icon text-5xl" />
                    <p className="rx-payment-information-label">Total a cobrar</p>
                    <p className="rx-payment-information-value">{formatMoney(payTotal)}</p>
                    <p className="rx-payment-information-help">Presenta la tarjeta en la terminal física.</p>
                  </div>
                </div>
              )}

              {/* --- PANEL: TRANSFERENCIA (referencia opcional) --- */}
              {metodoPago === 'transferencia' && (
                <div className="rx-form-stack">
                  <BotonCambiarMetodo onClick={() => setMetodoPago(null)} />
                  <div className="rx-payment-information">
                    <MaterialIcon name="account_balance" className="rx-payment-information-icon text-4xl" />
                    <p className="rx-payment-information-label">Total a transferir</p>
                    <p className="rx-payment-information-value">{formatMoney(payTotal)}</p>
                  </div>
                  <label className="rx-field">
                    <span className="rx-label">Referencia de transferencia</span>
                    <input
                      type="text"
                      value={referenciaInput}
                      onChange={(e) => setReferenciaInput(e.target.value)}
                      placeholder="Ej. TRF-20261012-001"
                      className="rx-input"
                    />
                    <span className="rx-help-text">La referencia es opcional.</span>
                  </label>
                </div>
              )}
            </div>

            <footer className="rx-modal-footer">
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={paymentLoading}
                className="rx-btn rx-btn--outline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={paymentLoading || !canConfirmPayment}
                className="rx-btn rx-btn--dark"
              >
                {paymentLoading ? (
                  <>
                    <span className="rx-btn-spinner" aria-hidden="true" />
                    Procesando…
                  </>
                ) : (
                  <>
                    <MaterialIcon name="check_circle" className="text-xl" />
                    Confirmar cobro
                  </>
                )}
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* ========== COMPROBANTE DEL COBRO ========== */}
      {ticket && (
        <div className="rx-modal-overlay" role="presentation">
          <section
            className="rx-modal rx-modal--scroll modal-enter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-titulo"
          >
            <header className="rx-modal-header">
              <div>
                <h2 id="ticket-titulo" className="rx-modal-title">Cobro registrado</h2>
                <p className="rx-modal-subtitle rx-modal-subtitle--plain">Ticket {ticket.folio}</p>
              </div>
              <button
                type="button"
                onClick={() => setTicket(null)}
                aria-label="Cerrar ticket"
                className="rx-modal-close"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </header>

            <div className="rx-modal-body">
              <div className="rx-receipt">
                <div className="rx-receipt-head">
                  <p className="rx-receipt-brand">NUUCLEO</p>
                  <p className="rx-receipt-label">Comprobante de cobro</p>
                </div>
                <div className="rx-receipt-section">
                  <p><span className="rx-receipt-label">Fecha:</span> {formatTicketDate(ticket.fecha)}</p>
                  <p><span className="rx-receipt-label">Cliente:</span> {ticket.cliente}</p>
                  {ticket.contexto === 'membresia' ? <>
                    <p><span className="rx-receipt-label">Membresía:</span> {ticket.membresia}</p>
                    <p><span className="rx-receipt-label">Vigencia:</span> {ticket.fechaInicio} al {ticket.fechaFin}</p>
                  </> : <>
                    <p><span className="rx-receipt-label">Reserva:</span> #{ticket.reservaId}</p>
                    <p><span className="rx-receipt-label">Clase:</span> {ticket.clase}</p>
                    <p><span className="rx-receipt-label">Horario:</span> {ticket.fechaClase} {ticket.horaClase}</p>
                  </>}
                  <p><span className="rx-receipt-label">Atendió:</span> {ticket.usuario || 'Recepción'}</p>
                </div>
                <div className="rx-receipt-section">
                  {(ticket.items ?? []).map((item, index) => (
                    <div key={`${item.descripcion}-${index}`} className="rx-receipt-item">
                      <p className="rx-cell-strong">{item.descripcion}</p>
                      <div className="rx-receipt-row">
                        <span>{item.cantidad} × {formatMoney(item.precioUnitario)}</span>
                        <span>{formatMoney(item.importe)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rx-receipt-section">
                  <div className="rx-receipt-row rx-receipt-total">
                    <span>TOTAL</span>
                    <span>{formatMoney(ticket.total)}</span>
                  </div>
                  <p><span className="rx-receipt-label">Método:</span> {METHOD_LABELS[ticket.metodoPago] || ticket.metodoPago}</p>
                  {ticket.efectivoRecibido !== null && (
                    <p><span className="rx-receipt-label">Recibido:</span> {formatMoney(ticket.efectivoRecibido)}</p>
                  )}
                  {ticket.cambio !== null && (
                    <p><span className="rx-receipt-label">Cambio:</span> {formatMoney(ticket.cambio)}</p>
                  )}
                  {ticket.referencia && (
                    <p><span className="rx-receipt-label">Referencia:</span> {ticket.referencia}</p>
                  )}
                </div>
              </div>
            </div>

            <footer className="rx-modal-footer">
              <button type="button" onClick={() => setTicket(null)} className="rx-btn rx-btn--outline">
                Cerrar
              </button>
              <button type="button" onClick={printTicket} className="rx-btn rx-btn--dark">
                <MaterialIcon name="print" className="text-lg" />
                Imprimir
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
