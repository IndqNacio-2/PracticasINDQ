import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, Calendar, Clock, DollarSign, UserPlus,
  AlertCircle, CheckCircle, CreditCard, X,
  Banknote, Landmark, ArrowLeft
} from 'lucide-react';

const MOCK_RESERVATIONS = [
  { id: 1, client: "Ana García", class: "Yoga", time: "10:00", status: "pendiente", price: 150, type: 'cliente' },
  { id: 2, client: "Carlos López", class: "CrossFit", time: "10:30", status: "pagado", price: 200, type: 'cliente' },
  { id: 3, client: "Sofía Martínez", class: "Pilates", time: "11:00", status: "pendiente", price: 180, type: 'visitante' },
  { id: 4, client: "Jorge Ruiz", class: "Spinning", time: "11:30", status: "asistido", price: 120, type: 'cliente' },
  { id: 5, client: "Lucía Méndez", class: "Yoga", time: "12:00", status: "pendiente", price: 150, type: 'cliente' },
];

let nextId = 6; // (ya no se usa: el identificador lo asigna la base de datos)

/*
 * Las mismas formas de pago que maneja el Punto de Venta: efectivo, tarjeta
 * y transferencia. Los iconos son de lucide-react (equivalentes a los del POS).
 */
const PAY_METHODS = [
  { key: 'efectivo', label: 'Efectivo', Icon: Banknote },
  { key: 'tarjeta', label: 'Tarjeta', Icon: CreditCard },
  { key: 'transferencia', label: 'Transferencia', Icon: Landmark },
];

const METHOD_LABELS = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ========== ESTADOS ==========
  const [reservations, setReservations] = useState(MOCK_RESERVATIONS);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [tipoReserva, setTipoReserva] = useState('cliente');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientList, setShowClientList] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedReservationForPayment, setSelectedReservationForPayment] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
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
    price: ''
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
    fetch(`${API}/api/reservas`)
      .then(res => res.json())
      .then(data => setReservations(data))
      .catch(() => console.warn('Backend no disponible, usando datos locales.'));

    fetch(`${API}/api/clientes`)
      .then(res => res.json())
      .then(data => setClientes(data))
      .catch(() => console.warn('No se pudieron cargar los clientes.'));

    // Las clases ahora se registran en el módulo administrativo (MongoDB) y se
    // leen de /admin/api/clases (ruta pública del gateway). Ya no se usa el
    // catálogo local de webcobro; solo se ofrecen las clases activas.
    fetch('/admin/api/clases')
      .then(res => res.json())
      .then(data => setClasses((Array.isArray(data) ? data : []).filter(c => c.estatus !== 'inactivo')))
      .catch(() => console.warn('No se pudieron cargar las clases de administrativa.'));
    fetch(`${API}/api/kpis`)
      .then(res => res.json())
      .then(data => setKpis(data))
      .catch(() => console.warn('No se puedieron cargar los KPIs.'));
  }, []);

  // ========== FUNCIONES DE VALIDACIÓN ==========

  /*
   * Cuenta las reservaciones que ocupan lugar en una clase. Una reserva "ocupa"
   * lugar mientras no esté cancelada (pendiente, pagado o asistido cuentan).
   * Las clases y su capacidad viven en administrativa; las reservas, en webcobro.
   */
  const reservasActivasDe = (nombreClase) =>
    reservations.filter(r => r.class === nombreClase && r.status !== 'cancelado').length;

  // Lugares que le quedan a una clase = capacidad − reservas activas.
  const lugaresDisponibles = (clase) =>
    Math.max(0, Number(clase.capacidad ?? 0) - reservasActivasDe(clase.nombre));

  // ========== FUNCIONES DE ACCIONES PRINCIPALES ==========

  const handleConfirmAttendance = (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) throw new Error('La reservación no existe.');
      if (reservation.status === 'asistido') throw new Error('Este cliente ya tiene asistencia confirmada.');

      setReservations(prev => prev.map(res =>
        res.id === id ? { ...res, status: 'asistido' } : res
      ));
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

  const handleCancel = (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) throw new Error('La reservación ya no existe.');

      const confirmed = window.confirm(
        `¿Cancelar la reservación de ${reservation.client} (${reservation.class})?`
      );
      if (!confirmed) return;

      setReservations(prev => prev.filter(res => res.id !== id));
      showNotification('Reservación cancelada.', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  // ========== FUNCIONES DEL MODAL ==========

  const openModal = () => {
    setNewReservation({ client: '', class: '', time: '', price: '' });
    setTipoReserva('cliente');
    setSelectedClient(null);
    setShowClientList(false);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    try {
      if (!newReservation.client || !newReservation.class || !newReservation.time) {
        throw new Error('Selecciona un cliente y una clase disponible.');
      }
      if (newReservation.client.trim().length < 3) {
        throw new Error('El nombre del cliente es demasiado corto.');
      }

      // La clase trae su hora y precio desde administrativa. Se valida el cupo
      // disponible antes de enviar (el backend cobro vuelve a validarlo).
      const claseSel = classes.find(c => c.nombre === newReservation.class);
      if (claseSel && lugaresDisponibles(claseSel) <= 0) {
        throw new Error(`La clase "${claseSel.nombre}" ya no tiene cupo disponible.`);
      }

      if (tipoReserva === 'visitante' && Number(newReservation.price) <= 0) {
        throw new Error('El visitante debe pagar la tarifa de la clase.');
      }

      // Se guarda la reservación en el backend (PostgreSQL, esquema webcobro)
      const response = await fetch(`${API}/api/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: newReservation.client,
          type: tipoReserva,
          class: newReservation.class,
          time: newReservation.time,
          price: Number(newReservation.price),
          // Capacidad de la clase: el backend cobro la usa para validar el cupo.
          capacity: claseSel ? Number(claseSel.capacidad) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la reservación.');
      }

      // Se agrega a la tabla la reservación que devolvió el backend.
      setReservations(prev => [...prev, data.reservacion]);
      showNotification(`Reservación creada para ${data.reservacion.client}.`, 'success');
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
    navigate('/front-desk/login');
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
      <nav className="bg-dark-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">GymFit</h1>
            <p className="text-xs text-gray-400">Bienvenido a Recepción</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-sm text-gray-300">Hola, <span className="font-bold text-white">{user?.name}</span></p>
            <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm transition-colors">
            <LogOut className="h-4 w-4 mr-2" /> Salir
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">

        {/* --- NOTIFICACIÓN --- */}
        {notification && (
          <div className={`fixed top-20 right-6 px-6 py-3 rounded-lg shadow-xl flex items-center z-50 text-white ${
            notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}>
            {notification.type === 'error' ? <AlertCircle className="h-5 w-5 mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
            {notification.message}
          </div>
        )}

        {/* --- TARJETAS KPI --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Clientes Esperados</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{kpis.clientesEsperados}</h3>
              </div>
              <div className="bg-blue-100 p-3 rounded-full"><UserPlus className="h-6 w-6 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Ingresos del Día</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">${kpis.ingresosHoy} MXN</h3>
              </div>
              <div className="bg-green-100 p-3 rounded-full"><DollarSign className="h-6 w-6 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Reservaciones Activas</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{kpis.totalReservas}</h3>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full"><Clock className="h-6 w-6 text-yellow-600" /></div>
            </div>
          </div>
        </div>

        {/* --- BÚSQUEDA --- */}
        <div className="flex items-center mb-4 gap-3">
          <div className="relative flex-1">
            <input type="text" placeholder="Buscar por ID, cliente, clase u hora..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors" title="Limpiar búsqueda">✕</button>
          )}
        </div>

        {/* --- ACCIONES --- */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Atención de Clientes</h2>
          <button onClick={openModal} className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center">
            <UserPlus className="h-4 w-4 mr-2" /> Nueva Reservación
          </button>
        </div>

        {/* --- TABLA --- */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Hora</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Clase</th>
                <th className="px-6 py-4">Monto</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron resultados.' : 'No hay reservaciones para hoy.'}
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-800 font-medium">{res.id}</td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {res.type === 'visitante' ? '🚪 Visitante' : '👤 Socio'}
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-medium">{res.time}</td>
                    <td className="px-6 py-4 text-gray-800">{res.client}</td>
                    <td className="px-6 py-4 text-gray-600">{res.class}</td>
                    <td className="px-6 py-4 text-gray-800 font-bold">${res.price}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        res.status === 'pagado' ? 'bg-green-100 text-green-700' :
                        res.status === 'asistido' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {res.status === 'pagado' ? 'Pagado' : res.status === 'asistido' ? 'Asistió' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {res.status === 'pendiente' && (
                          <button onClick={() => handleConfirmAttendance(res.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Confirmar Asistencia">
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        {res.status !== 'pagado' && (
                          <button onClick={() => handlePayment(res.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Cobrar">
                            <CreditCard className="h-5 w-5" />
                          </button>
                        )}
                        <button onClick={() => handleCancel(res.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancelar">
                          <AlertCircle className="h-5 w-5" />
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="bg-dark-800 px-6 py-4 flex justify-between items-center sticky top-0">
                <h3 className="text-lg font-bold text-white">Nueva Reservación</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                  <X className="h-6 w-6" />
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
                        tipoReserva === 'cliente' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
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
                        tipoReserva === 'visitante' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
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
                          setNewReservation(p => ({ ...p, client: match.nombre, price: 0 }));
                          setShowClientList(false);
                        } else {
                          setSelectedClient(null);
                          setNewReservation(p => ({ ...p, client: val }));
                        }
                      }}
                      onFocus={() => setShowClientList(true)}
                      onBlur={() => setTimeout(() => setShowClientList(false), 200)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                    />

                    {/* Dropdown personalizado: al enfocar el campo se muestran
                        TODOS los socios registrados (servidos por el backend).
                        Al escribir, la lista se filtra por nombre o ID. */}
                    {showClientList && !selectedClient && (
                      <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
                                setNewReservation(p => ({ ...p, client: c.nombre, price: 0 }));
                                setShowClientList(false);
                              }}
                              className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-gray-800 text-sm flex justify-between items-center"
                            >
                              <span>{c.nombre}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                c.membresia === 'Premium' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
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
                      <p className="mt-1 text-xs text-emerald-600 font-medium">
                        {selectedClient.nombre} — Membresía: {selectedClient.membresia}
                      </p>
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                    />
                  </div>
                )}

                {/* ③ CLASE (tarjetas de las clases registradas en administrativa).
                    Ya no hay dropdown ni selector de horario: cada clase trae su
                    propia hora, precio y cupo. Al elegir una se autocompletan. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Clase disponible</label>

                  {classes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic px-3 py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      No hay clases registradas. Crea clases en el módulo administrativo
                      (Clases) para poder reservar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {classes.map(c => {
                        const disponibles = lugaresDisponibles(c);
                        const sinCupo = disponibles <= 0;
                        const seleccionada = newReservation.class === c.nombre;
                        return (
                          <button
                            key={c.idClase ?? c.id}
                            type="button"
                            disabled={sinCupo}
                            onClick={() => {
                              const isPremium = selectedClient?.membresia === 'Premium';
                              const price = isPremium ? 0 : (c.precio ?? 0);
                              setNewReservation(p => ({
                                ...p,
                                class: c.nombre,
                                time: c.hora || '',
                                price,
                              }));
                            }}
                            className={`text-left p-3 rounded-lg border-2 transition-colors ${
                              sinCupo
                                ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                                : seleccionada
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: c.color || '#10b981' }}
                              />
                              <span className="font-semibold text-gray-800 text-sm truncate">
                                {c.nombre}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {c.hora || '—'}
                              </span>
                              <span className="text-gray-300">·</span>
                              <span className="font-medium text-emerald-600">${c.precio ?? 0}</span>
                            </div>
                            <p className={`mt-1 text-xs font-medium ${sinCupo ? 'text-red-500' : 'text-gray-400'}`}>
                              {sinCupo ? 'Sin cupo' : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`}
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
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed font-semibold"
                  />
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
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
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
      <div className="bg-green-600 px-6 py-4 flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">Confirmar Cobro</h3>
        <button
          onClick={closePaymentModal}
          className="text-gray-200 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Resumen */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
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
          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
            <span className="text-gray-600 font-medium">Monto a cobrar:</span>
            <span className="text-2xl font-bold text-green-600">${selectedReservationForPayment.price}</span>
          </div>
        </div>

        {/* --- MÉTODO DE PAGO (mismos que el POS) --- */}
        {!metodoPago && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Método de pago
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAY_METHODS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetodoPago(key)}
                  className="flex flex-col items-center gap-1.5 py-3 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                >
                  <Icon className="h-6 w-6 text-gray-600" />
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
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 mb-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Cambiar método
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            {efectivoInsuficiente && (
              <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Efectivo insuficiente
              </p>
            )}
            {efectivoInput !== '' && efectivoRecibido >= payTotal && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-green-700">Cambio a devolver</span>
                <span className="text-xl font-bold text-green-700">${cambio}</span>
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
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 mb-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Cambiar método
            </button>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-center">
              <CreditCard className="h-10 w-10 text-gray-500 mx-auto mb-2" />
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
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 mb-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Cambiar método
            </button>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 flex justify-between items-center">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={closePaymentModal}
            disabled={paymentLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={paymentLoading || !canConfirmPayment}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {paymentLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Confirmar Cobro
              </>
            )}
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