import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MaterialIcon from '../../../components/MaterialIcon';
import { LOGIN_PATH } from '../../../auth/session';

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

export default function Dashboard() {
  const { user, logout } = useAuth();

  // ========== ESTADOS ==========
  const [reservations, setReservations] = useState([]);
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
        r.status !== 'cancelado'
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

  const esPremium = (socio) => socio?.membresia === 'Premium';

  // El socio puede reservar como "cliente" solo si está activo y su membresía
  // no está vencida (vigencia_hasta null = no expira).
  const membresiaVigente = (socio) => {
    if (!socio) return false;
    if (socio.activo === false) return false;
    if (socio.vigencia_hasta && socio.vigencia_hasta < hoyISO()) return false;
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
        r.status !== 'cancelado',
    );

  // Cuántas reservas activas tiene una persona (límite anti-acaparamiento).
  // Solo cuentan las reservas con fecha: las que no la tienen (registros
  // viejos, sin horario real) no ocupan cupo.
  const reservasActivasDeCliente = (nombre) =>
    reservations.filter(
      r => r.client === nombre && r.status !== 'cancelado' && r.fecha
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
        res.id === id ? { ...res, status: 'asistido' } : res
      ));
      // Si estaba pendiente ya no cuenta como cliente esperado en el KPI.
      await cargarKpis();
      showNotification(`Asistencia confirmada para ${reservation.client}.`, 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

     const handlePayment = (id) =>{
      const reservation = reservations.find(r => r.id === id);
      if(!reservation){
        showNotification('No se encontró la reservación.', 'error');
        return;
      }
      if (reservation.status === 'pagado'){
        showNotification('Esta clase ya fue cobrada.', 'error');
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

      const confirmed = window.confirm(
        `¿Cancelar la reservación de ${reservation.client} (${reservation.class})?`
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
  const totalPaid = reservations.filter(r => r.status === 'pagado').reduce((sum, r) => sum + r.price, 0);

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
      <p><strong>Reserva:</strong> #${escapeHtml(ticket.reservaId)}</p>
      <p><strong>Clase:</strong> ${escapeHtml(ticket.clase)}</p>
      <p><strong>Horario:</strong> ${escapeHtml(ticket.fechaClase)} ${escapeHtml(ticket.horaClase)}</p>
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
      res.class.toLowerCase().includes(term) ||
      res.time.toLowerCase().includes(term) ||
      String(res.id).includes(term)
    );
  });

  // ========== RETORNO DEL JSX ==========

  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans">

      {/* --- HEADER --- */}
      <nav className="bg-dark-800 border-b border-[#111827] px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-[#6B7280] p-2 rounded-lg">
            <MaterialIcon name="event" className="text-2xl text-white" filled />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">GymFit</h1>
            <p className="text-xs text-gray-400">Bienvenido a Recepción</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-sm text-gray-300">Hola, <span className="font-bold text-white">{user ? `${user.nombre} ${user.apellidos}` : ''}</span></p>
            <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center px-4 py-2 bg-[#4B5563] hover:bg-[#111827] rounded-lg text-white text-sm transition-colors">
            <MaterialIcon name="logout" className="text-lg mr-2" /> Salir
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">

        {/* --- NOTIFICACIÓN --- */}
        {notification && (
          <div className={`fixed top-20 right-6 px-6 py-3 rounded-lg shadow-xl flex items-center z-50 text-white ${
            notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}>
            {notification.type === 'error' ? <MaterialIcon name="cancel" className="text-xl mr-2" filled /> : <MaterialIcon name="check_circle" className="text-xl mr-2" filled />}
            {notification.message}
          </div>
        )}

        {/* --- TARJETAS KPI --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#111827]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Clientes Esperados</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{kpis.clientesEsperados}</h3>
              </div>
              <div className="bg-[#F3F4F6] p-3 rounded-full"><MaterialIcon name="person_add" className="text-2xl text-[#4B5563]" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#111827]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Ingresos del Día</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">${kpis.ingresosHoy} MXN</h3>
              </div>
              <div className="bg-[#F3F4F6] p-3 rounded-full"><MaterialIcon name="payments" className="text-2xl text-[#4B5563]" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#111827]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Reservaciones Activas</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{kpis.totalReservas}</h3>
              </div>
              <div className="bg-[#F3F4F6] p-3 rounded-full"><MaterialIcon name="schedule" className="text-2xl text-[#4B5563]" /></div>
            </div>
          </div>
        </div>

        {/* --- BÚSQUEDA --- */}
        <div className="flex items-center mb-4 gap-3">
          <div className="relative flex-1">
            <input type="text" placeholder="Buscar por ID, cliente, clase u hora..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-[#111827] rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors" title="Limpiar búsqueda">✕</button>
          )}
        </div>

        {/* --- ACCIONES --- */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Atención de Clientes</h2>
          <button onClick={openModal} className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center">
            <MaterialIcon name="person_add" className="text-lg mr-2" /> Nueva Reservación
          </button>
        </div>

        {/* --- TABLA --- */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-[#111827]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Hora</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Clase</th>
                <th className="px-6 py-4">Monto</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Cupo</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron resultados.' : 'No hay reservaciones para hoy.'}
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-[#E5E7EB] transition-colors">
                    <td className="px-6 py-4 text-gray-800 font-medium">{res.id}</td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {res.type === 'visitante' ? '🚪 Visitante' : '👤 Socio'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">{res.fecha || '—'}</td>
                    <td className="px-6 py-4 text-gray-800 font-medium">{res.time}</td>
                    <td className="px-6 py-4 text-gray-800">{res.client}</td>
                    <td className="px-6 py-4 text-gray-600">{res.class}</td>
                    <td className="px-6 py-4 text-gray-800 font-bold">${res.price}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        res.status === 'pagado' ? 'bg-[#111827] text-white' :
                        res.status === 'asistido' ? 'bg-[#6B7280] text-white' :
                        'bg-[#F3F4F6] text-[#4B5563]'
                      }`}>
                        {res.status === 'pagado' ? 'Pagado' : res.status === 'asistido' ? 'Asistió' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        res.capacityStatus === 'espera'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {res.capacityStatus === 'espera' ? 'En espera' : 'Confirmada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {res.status === 'pendiente' && res.capacityStatus !== 'espera' && (
                          <button onClick={() => handleConfirmAttendance(res.id)} className="p-2 text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg transition-colors" title="Confirmar Asistencia">
                            <MaterialIcon name="how_to_reg" className="text-xl" />
                          </button>
                        )}
                        {res.status !== 'pagado' && res.capacityStatus !== 'espera' && (
                          <button onClick={() => handlePayment(res.id)} className="p-2 text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg transition-colors" title="Cobrar">
                            <MaterialIcon name="credit_card" className="text-xl" />
                          </button>
                        )}
                        <button onClick={() => handleCancel(res.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancelar">
                          <MaterialIcon name="delete" className="text-xl" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ========== MODAL DE NUEVA RESERVACIÓN ========== */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-[#111827] w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="bg-dark-800 px-6 py-4 flex justify-between items-center sticky top-0">
                <h3 className="text-lg font-bold text-white">Nueva Reservación</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                  <MaterialIcon name="close" className="text-2xl" />
                </button>
              </div>

              <form onSubmit={handleCreateReservation} className="p-6 space-y-4">

                {/* TIPO DE RESERVA (Socio / Visitante) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de asistencia</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoReserva('cliente');
                        setSelectedClient(null);
                        setNewReservation(p => ({ ...p, client: '', price: '' }));
                        setShowClientList(false);
                      }}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                        tipoReserva === 'cliente' ? 'border-[#111827] bg-[#F3F4F6] text-[#111827]' : 'border-[#6B7280] text-gray-500'
                      }`}
                    >
                      👤 Socio registrado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoReserva('visitante');
                        setSelectedClient(null);
                        setNewReservation(p => ({ ...p, client: '', price: '' }));
                        setShowClientList(false);
                      }}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                        tipoReserva === 'visitante' ? 'border-[#111827] bg-[#F3F4F6] text-[#111827]' : 'border-[#6B7280] text-gray-500'
                      }`}
                    >
                      🚪 Visitante
                    </button>
                  </div>
                </div>

                {/*  CLIENTE (condicional) */}
                {tipoReserva === 'cliente' ? (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Buscar socio</label>
                    <input
                      type="text"
                      placeholder="Escribe ID o nombre..."
                      value={newReservation.client}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = clientes.find(c => String(c.id) === val || c.nombre === val);
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
                      className="w-full px-4 py-2 border border-[#111827] rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                    />

                    {/* Dropdown personalizado: al enfocar el campo se muestran
                        TODOS los socios registrados (servidos por el backend).
                        Al escribir, la lista se filtra por nombre o ID. */}
                    {showClientList && !selectedClient && (
                      <ul className="absolute z-20 w-full mt-1 bg-white border border-[#111827] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clientes
                          .filter(c =>
                            c.nombre.toLowerCase().includes(newReservation.client.toLowerCase()) ||
                            String(c.id).includes(newReservation.client)
                          )
                          .map(c => (
                            <li
                              key={c.id}
                              onMouseDown={() => {
                                setSelectedClient(c);
                                // Igual que arriba: recalcula el precio real de
                                // la clase elegida según la membresía del socio.
                                const claseSel = clases.find(cl => cl.nombre === newReservation.class);
                                setNewReservation(p => ({ ...p, client: c.nombre, price: precioDeClase(claseSel, c) }));
                                setShowClientList(false);
                              }}
                              className="px-4 py-2 hover:bg-[#E5E7EB] cursor-pointer text-gray-800 text-sm flex justify-between items-center"
                            >
                              <span>{c.nombre}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                c.membresia === 'Premium' ? 'bg-[#111827] text-white' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {c.membresia}
                              </span>
                            </li>
                          ))
                        }
                        {clientes.filter(c =>
                          c.nombre.toLowerCase().includes(newReservation.client.toLowerCase()) ||
                          String(c.id).includes(newReservation.client)
                        ).length === 0 && (
                          <li className="px-4 py-2 text-gray-400 text-sm">No se encontraron socios</li>
                        )}
                      </ul>
                    )}

                    {selectedClient && (
                      <div className="mt-1">
                        <p className="text-xs text-[#6B7280] font-medium">
                          {selectedClient.nombre} — Membresía: {selectedClient.membresia}
                        </p>
                        {/* Aviso cuando el socio no puede reservar como socio. */}
                        {!membresiaVigente(selectedClient) && (
                          <p className="text-xs text-red-600 font-medium">
                            {selectedClient.activo === false
                              ? 'Este socio está inactivo.'
                              : 'La membresía de este socio está vencida.'}{' '}
                            Regístralo como visitante para continuar.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del visitante</label>
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={newReservation.client}
                      onChange={(e) => setNewReservation(p => ({ ...p, client: e.target.value }))}
                      className="w-full px-4 py-2 border border-[#111827] rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                    />
                  </div>
                )}

                {/* ③ FECHA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de la clase</label>
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
                    className="w-full px-4 py-2 border border-[#111827] rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                  />
                </div>

                {/* ④ HORARIOS (los horarios reales del módulo administrativo para
                    la fecha elegida). Solo se puede reservar un horario activo. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Horarios disponibles del {fechaReserva}
                  </label>

                  {horarios.length === 0 ? (
                    <p className="text-xs text-gray-400 italic px-3 py-4 bg-[#F3F4F6] rounded-lg border border-dashed border-[#111827]">
                      No hay horarios registrados para esta fecha. Agrégalos en el módulo
                      administrativo (Horarios) para poder reservar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {horarios.map(h => {
                        const claseDelHorario = clases.find(c => c.nombre === h.nombreClase);
                        const disponibles = lugaresDisponibles(h);
                        const pasada = horarioPasado(h.fecha, h.horaInicio);
                        const duplicada =
                          tipoReserva === 'cliente' &&
                          newReservation.client &&
                          yaReservada(newReservation.client, h.nombreClase, h.fecha, h.horaInicio);
                        const noReservable = !claseReservable(claseDelHorario);
                        const aceptaEspera = disponibles <= 0 && h.listaEsperaHabilitada === true;
                        // Una sesión llena permanece seleccionable solo si admite
                        // lista de espera. Recepción también ve sesiones ocultas.
                        const bloqueada = (disponibles <= 0 && !aceptaEspera) || pasada || duplicada || noReservable;
                        const seleccionada =
                          newReservation.horarioId === h.idHorario;
                        return (
                          <button
                            key={h.idHorario ?? `${h.nombreClase}-${h.horaInicio}`}
                            type="button"
                            disabled={bloqueada}
                            onClick={() => {
                              setNewReservation(p => ({
                                ...p,
                                class: h.nombreClase,
                                time: h.horaInicio,
                                price: precioDeClase(claseDelHorario),
                                horarioId: h.idHorario,
                              }));
                            }}
                            className={`text-left p-3 rounded-lg border-2 transition-colors ${
                              bloqueada
                                ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                                : seleccionada
                                  ? 'border-[#111827] bg-[#F3F4F6]'
                                  : 'border-[#6B7280] hover:border-[#111827]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: claseDelHorario?.color || '#6B7280' }}
                              />
                              <span className="font-semibold text-gray-800 text-sm truncate">
                                {h.nombreClase}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <MaterialIcon name="schedule" className="text-sm" /> {h.horaInicio}
                              </span>
                              <span className="text-gray-300">·</span>
                              <span className="font-medium text-[#6B7280]">
                                ${claseDelHorario?.precio ?? 0}
                              </span>
                            </div>
                            <p className={`mt-1 text-xs font-medium ${bloqueada ? 'text-red-500' : 'text-gray-400'}`}>
                              {aceptaEspera
                                ? 'Lista de espera disponible'
                                : disponibles <= 0
                                  ? 'Sin cupo'
                                : pasada
                                  ? 'Horario ya pasó'
                                  : duplicada
                                    ? 'Ya la reservaste'
                                    : noReservable
                                      ? 'No disponible'
                                      : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* PRECIO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                  <input
                    type="text"
                    value={newReservation.price ? `$${newReservation.price}` : '$0.00'}
                    disabled
                    className="w-full px-4 py-2 bg-gray-100 border border-[#111827] rounded-lg text-gray-500 cursor-not-allowed font-semibold"
                  />
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-[#111827] rounded-lg text-gray-700 hover:bg-[#E5E7EB] transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!puedeGuardar}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      puedeGuardar
                        ? 'bg-primary hover:bg-primary-hover text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Guardar Reservación
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========== MODAL DE COBRO ========== */}
{isPaymentModalOpen && selectedReservationForPayment && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl border border-[#111827] w-full max-w-md overflow-hidden">
      <div className="bg-[#111827] px-6 py-4 flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">Confirmar Cobro</h3>
        <button
          onClick={closePaymentModal}
          className="text-gray-200 hover:text-white transition-colors"
        >
          <MaterialIcon name="close" className="text-2xl" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Resumen */}
        <div className="bg-[#F3F4F6] rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">Cliente:</span>
            <span className="font-semibold text-gray-800">{selectedReservationForPayment.client}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">Clase:</span>
            <span className="font-semibold text-gray-800">{selectedReservationForPayment.class}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">Hora:</span>
            <span className="font-semibold text-gray-800">{selectedReservationForPayment.time}</span>
          </div>
          <div className="border-t border-[#6B7280] pt-2 mt-2 flex justify-between">
            <span className="text-gray-600 font-medium">Monto a cobrar:</span>
            <span className="text-2xl font-bold text-[#111827]">${selectedReservationForPayment.price}</span>
          </div>
        </div>

        {/* --- MÉTODO DE PAGO (mismos que el POS) --- */}
        {!metodoPago && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Método de pago
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAY_METHODS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetodoPago(key)}
                  className="flex flex-col items-center gap-1.5 py-3 border-2 border-[#6B7280] rounded-lg hover:border-[#111827] hover:bg-[#F3F4F6] transition-colors"
                >
                  <MaterialIcon name={icon} className="text-2xl text-gray-600" />
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- PANEL: EFECTIVO (captura entregado y calcula cambio) --- */}
        {metodoPago === 'efectivo' && (
          <div>
            <button
              type="button"
              onClick={() => setMetodoPago(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#111827] mb-3 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-lg" /> Cambiar método
            </button>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Efectivo recibido
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={efectivoInput}
              onChange={(e) => setEfectivoInput(e.target.value)}
              placeholder={`Monto entregado (mín. $${payTotal})`}
              className="w-full px-4 py-2 border border-[#111827] rounded-lg text-gray-800 focus:ring-2 focus:ring-[#6B7280] focus:outline-none"
            />
            {efectivoInsuficiente && (
              <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                <MaterialIcon name="warning" className="text-base" filled /> Efectivo insuficiente
              </p>
            )}
            {efectivoInput !== '' && efectivoRecibido >= payTotal && (
              <div className="bg-[#F3F4F6] border border-[#6B7280] rounded-lg p-3 mt-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-[#111827]">Cambio a devolver</span>
                <span className="text-xl font-bold text-[#111827]">${cambio}</span>
              </div>
            )}
          </div>
        )}

        {/* --- PANEL: TARJETA (terminal física externa, sin datos) --- */}
        {metodoPago === 'tarjeta' && (
          <div>
            <button
              type="button"
              onClick={() => setMetodoPago(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#111827] mb-3 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-lg" /> Cambiar método
            </button>
            <div className="bg-[#F3F4F6] border border-[#6B7280] rounded-lg p-5 text-center">
              <MaterialIcon name="credit_card" className="text-5xl text-gray-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total a cobrar</p>
              <p className="text-2xl font-bold text-gray-800">${payTotal}</p>
              <p className="text-xs text-gray-500 mt-2">Presentar en terminal física</p>
            </div>
          </div>
        )}

        {/* --- PANEL: TRANSFERENCIA (referencia opcional) --- */}
        {metodoPago === 'transferencia' && (
          <div>
            <button
              type="button"
              onClick={() => setMetodoPago(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#111827] mb-3 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-lg" /> Cambiar método
            </button>
            <div className="bg-[#F3F4F6] border border-[#6B7280] rounded-lg p-3 mb-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">Total a cobrar</span>
              <span className="text-xl font-bold text-gray-800">${payTotal}</span>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia de transferencia <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={referenciaInput}
              onChange={(e) => setReferenciaInput(e.target.value)}
              placeholder="Ej. TRF-20261012-001"
              className="w-full px-4 py-2 border border-[#111827] rounded-lg text-gray-800 focus:ring-2 focus:ring-[#6B7280] focus:outline-none"
            />
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={closePaymentModal}
            disabled={paymentLoading}
            className="flex-1 px-4 py-2 border border-[#111827] rounded-lg text-gray-700 hover:bg-[#E5E7EB] transition-colors font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={paymentLoading || !canConfirmPayment}
            className="flex-1 px-4 py-2 bg-[#111827] hover:bg-[#6B7280] disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {paymentLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <MaterialIcon name="credit_card" className="text-lg" />
                Confirmar Cobro
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

        {/* ========== COMPROBANTE DEL COBRO ========== */}
        {ticket && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-[#111827] w-full max-w-md overflow-hidden text-gray-800">
              <div className="bg-[#111827] px-6 py-4 flex justify-between items-center">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-300">Cobro registrado</p>
                  <h3 className="text-lg font-bold text-white">Ticket {ticket.folio}</h3>
                </div>
                <button onClick={() => setTicket(null)} className="text-gray-200 hover:text-white" aria-label="Cerrar ticket">
                  <MaterialIcon name="close" className="text-2xl" />
                </button>
              </div>

              <div className="p-6">
                <div className="font-mono text-sm border border-dashed border-gray-400 rounded-lg p-5 bg-[#FAFAFA]">
                  <div className="text-center mb-4">
                    <p className="font-bold text-lg">NUUCLEO</p>
                    <p className="text-xs text-gray-500">Comprobante de cobro</p>
                  </div>
                  <div className="space-y-1 border-y border-dashed border-gray-400 py-3">
                    <p><span className="text-gray-500">Fecha:</span> {formatTicketDate(ticket.fecha)}</p>
                    <p><span className="text-gray-500">Cliente:</span> {ticket.cliente}</p>
                    <p><span className="text-gray-500">Reserva:</span> #{ticket.reservaId}</p>
                    <p><span className="text-gray-500">Clase:</span> {ticket.clase}</p>
                    <p><span className="text-gray-500">Horario:</span> {ticket.fechaClase} {ticket.horaClase}</p>
                    <p><span className="text-gray-500">Atendió:</span> {ticket.usuario || 'Recepción'}</p>
                  </div>
                  <div className="py-3 space-y-2">
                    {(ticket.items ?? []).map((item, index) => (
                      <div key={`${item.descripcion}-${index}`}>
                        <p className="font-semibold">{item.descripcion}</p>
                        <div className="flex justify-between text-gray-600">
                          <span>{item.cantidad} × {formatMoney(item.precioUnitario)}</span>
                          <span>{formatMoney(item.importe)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-dashed border-gray-400 pt-3 space-y-1">
                    <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>{formatMoney(ticket.total)}</span></div>
                    <p><span className="text-gray-500">Método:</span> {METHOD_LABELS[ticket.metodoPago] || ticket.metodoPago}</p>
                    {ticket.efectivoRecibido !== null && <p><span className="text-gray-500">Recibido:</span> {formatMoney(ticket.efectivoRecibido)}</p>}
                    {ticket.cambio !== null && <p><span className="text-gray-500">Cambio:</span> {formatMoney(ticket.cambio)}</p>}
                    {ticket.referencia && <p><span className="text-gray-500">Referencia:</span> {ticket.referencia}</p>}
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button type="button" onClick={() => setTicket(null)} className="flex-1 px-4 py-2 border border-[#111827] rounded-lg font-medium hover:bg-gray-100">
                    Cerrar
                  </button>
                  <button type="button" onClick={printTicket} className="flex-1 px-4 py-2 bg-[#111827] text-white rounded-lg font-medium hover:bg-[#374151] flex items-center justify-center gap-2">
                    <MaterialIcon name="print" className="text-lg" /> Imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
