import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, Calendar, Clock, DollarSign, UserPlus,
  AlertCircle, CheckCircle, CreditCard, X
} from 'lucide-react';

const MOCK_RESERVATIONS = [
  { id: 1, client: "Ana García", class: "Yoga", time: "10:00", status: "pendiente", price: 150, type: 'cliente' },
  { id: 2, client: "Carlos López", class: "CrossFit", time: "10:30", status: "pagado", price: 200, type: 'cliente' },
  { id: 3, client: "Sofía Martínez", class: "Pilates", time: "11:00", status: "pendiente", price: 180, type: 'visitante' },
  { id: 4, client: "Jorge Ruiz", class: "Spinning", time: "11:30", status: "asistido", price: 120, type: 'cliente' },
  { id: 5, client: "Lucía Méndez", class: "Yoga", time: "12:00", status: "pendiente", price: 150, type: 'cliente' },
];

let nextId = 6;

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
  const [newReservation, setNewReservation] = useState({
    client: '',
    class: '',
    time: '',
    price: ''
  });

  // ========== CARGA DE DATOS DESDE EL BACKEND ==========
  const API = 'http://localhost:3001';

  useEffect(() => {
    fetch(`${API}/api/reservas`)
      .then(res => res.json())
      .then(data => setReservations(data))
      .catch(() => console.warn('Backend no disponible, usando datos locales.'));

    fetch(`${API}/api/clientes`)
      .then(res => res.json())
      .then(data => setClientes(data))
      .catch(() => console.warn('No se pudieron cargar los clientes.'));

    fetch(`${API}/api/clases`)
      .then(res => res.json())
      .then(data => setClasses(data))
      .catch(() => console.warn('No se pudieron cargar las clases.'));
  }, []);

  // ========== FUNCIONES DE VALIDACIÓN ==========

  const getAvailableSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 22; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
  };

  const validateTime = (time) => {
    if (!time) throw new Error('Selecciona un horario.');
    const [hours, minutes] = time.split(':').map(Number);

    if (hours < 6 || hours >= 22) {
      throw new Error('El gym abre de 6:00 AM a 10:00 PM.');
    }

    if (minutes !== 0 && minutes !== 30) {
      throw new Error('Las clases son en punto o a media hora.');
    }

    return true;
  };

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

  const handlePayment = (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) throw new Error('No se encontró la reservación a cobrar.');
      if (reservation.status === 'pagado') throw new Error('Esta clase ya fue cobrada.');
      if (!reservation.price || reservation.price <= 0) throw new Error('El monto no es válido.');

      setReservations(prev => prev.map(res =>
        res.id === id ? { ...res, status: 'pagado' } : res
      ));
      showNotification(`Cobro de $${reservation.price} registrado.`, 'success');
    } catch (error) {
      showNotification(error.message, 'error');
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

  const handleCreateReservation = (e) => {
    e.preventDefault();
    try {
      if (!newReservation.client || !newReservation.class || !newReservation.time) {
        throw new Error('Completa cliente, clase y horario.');
      }
      if (newReservation.client.trim().length < 3) {
        throw new Error('El nombre del cliente es demasiado corto.');
      }

      validateTime(newReservation.time);

      const exists = reservations.some(
        r => r.class === newReservation.class && r.time === newReservation.time
      );
      if (exists) {
        throw new Error('Ya existe una reservación en ese horario.');
      }

      if (tipoReserva === 'visitante' && Number(newReservation.price) <= 0) {
        throw new Error('El visitante debe pagar la tarifa de la clase.');
      }

      const reservation = {
        id: nextId++,
        client: newReservation.client,
        type: tipoReserva,
        class: newReservation.class,
        time: newReservation.time,
        price: Number(newReservation.price),
        status: 'pendiente'
      };

      setReservations(prev => [...prev, reservation]);
      showNotification(`Reservación creada para ${reservation.client}.`, 'success');
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
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{totalPending}</h3>
              </div>
              <div className="bg-blue-100 p-3 rounded-full"><UserPlus className="h-6 w-6 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Ingresos del Día</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">${totalPaid} MXN</h3>
              </div>
              <div className="bg-green-100 p-3 rounded-full"><DollarSign className="h-6 w-6 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Reservaciones Activas</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{reservations.length}</h3>
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
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
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

                    {/* Dropdown personalizado */}
                    {showClientList && !selectedClient && newReservation.client && (
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

                {/* ③ CLASE (dropdown conectado al backend) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clase</label>
                  <select
                    value={newReservation.class}
                    onChange={(e) => {
                      const selected = classes.find(c => c.nombre === e.target.value);
                      const isPremium = selectedClient?.membresia === 'Premium';
                      const price = isPremium ? 0 : (selected ? selected.precio : '');
                      setNewReservation(p => ({ ...p, class: e.target.value, price }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                  >
                    <option value="">Selecciona una clase...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre} — ${c.precio}</option>
                    ))}
                  </select>
                </div>

                {/* HORARIO (grid de botones :00 y :30) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Horario</label>

                  {!newReservation.class ? (
                    <p className="text-xs text-gray-400 italic">Primero selecciona una clase</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {getAvailableSlots().map(slot => {
                          const isTaken = reservations.some(
                            r => r.class === newReservation.class && r.time === slot && r.status !== 'cancelada'
                          );
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={isTaken}
                              onClick={() => setNewReservation(p => ({ ...p, time: slot }))}
                              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                isTaken
                                  ? 'border-red-200 bg-red-50 text-red-400 cursor-not-allowed line-through'
                                  : newReservation.time === slot
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>

                      {newReservation.time && (
                        <p className="mt-2 text-xs text-emerald-600 font-medium">
                          Horario seleccionado: {newReservation.time}
                        </p>
                      )}
                    </>
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

      </main>
    </div>
  );
}