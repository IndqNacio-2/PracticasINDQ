import { useState,useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Clock, DollarSign, UserPlus, AlertCircle, CheckCircle, CreditCard, X } from 'lucide-react';

// ==========  DATOS DE PRUEBA ==========
const MOCK_RESERVATIONS = [
  { id: 1, client: "Ana García", class: "Yoga Vinyasa", time: "10:00", status: "pendiente", price: 150 },
  { id: 2, client: "Carlos López", class: "CrossFit", time: "10:30", status: "pagado", price: 200 },
  { id: 3, client: "Sofía Martínez", class: "Pilates", time: "11:00", status: "pendiente", price: 180 },
  { id: 4, client: "Jorge Ruiz", class: "Spinning", time: "11:30", status: "asistido", price: 120 },
  { id: 5, client: "Lucía Méndez", class: "Yoga Vinyasa", time: "12:00", status: "pendiente", price: 150 },
];

// ========== LISTA DE CLASES DISPONIBLES ==========
 let nextId = 6;
const MOCK_CLASSES = [
   
  { id: 1, name: 'Yoga Vinyasa', price: 150 },
  { id: 2, name: 'CrossFit', price: 200 },
  { id: 3, name: 'Pilates', price: 180 },
  { id: 4, name: 'Spinning', price: 120 },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ========== ESTADOS ==========
  const [reservations, setReservations] = useState(MOCK_RESERVATIONS);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReservation, setNewReservation] = useState({
    client: '',
    class: '',
    time: '',
    price: ''
  });

  //CARGA DE DATOS DESDE EL BACKEND
  const API = 'http://localhost:3001';
 
      useEffect(() => {
      fetch(`${API}/api/reservas`)
      .then(res => res.json())
      .then(data => setReservations(data))
      .catch(() => console.warn('Backend no disponible, usando datos locales.'));
      }, []);

  // ========== FUNCIONES DE ACCIONES PRINCIPALES ==========
  
  const handleConfirmAttendance = (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) {
        throw new Error('La reservación no existe.');
      }
      if (reservation.status === 'asistido') {
        throw new Error('Este cliente ya tiene asistencia confirmada.');
      }

      setReservations(prev => prev.map(res =>
        res.id === id ? { ...res, status: 'asistido' } : res
      ));
      showNotification(`Asistencia confirmada para ${reservation.client}.`, 'success');

    } catch (error) {
      showNotification(`${error.message}`, 'error');
    }
  };

  const handlePayment = (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) {
        throw new Error('No se encontró la reservación a cobrar.');
      }
      if (reservation.status === 'pagado') {
        throw new Error('Esta clase ya fue cobrada anteriormente.');
      }
      if (!reservation.price || reservation.price <= 0) {
        throw new Error('El monto de esta clase no es válido.');
      }

      setReservations(prev => prev.map(res =>
        res.id === id ? { ...res, status: 'pagado' } : res
      ));
      showNotification(`Cobro de $${reservation.price} registrado.`, 'success');

    } catch (error) {
      showNotification(` ${error.message}`, 'error');
    }
  };

  const handleCancel = (id) => {
    try {
      const reservation = reservations.find(r => r.id === id);
      if (!reservation) {
        throw new Error('La reservación ya no existe.');
      }

      const confirmed = window.confirm(
        `¿Cancelar la reservación de ${reservation.client} (${reservation.class})?`
      );
      if (!confirmed) return;

      setReservations(prev => prev.filter(res => res.id !== id));
      showNotification(' Reservación cancelada.', 'success');

    } catch (error) {
      showNotification(` ${error.message}`, 'error');
    }
  };

  // ==========  FUNCIONES DEL MODAL ==========
  
  const openModal = () => {
    setNewReservation({ client: '', class: '', time: '', price: '' });
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

      const exists = reservations.some(
        r => r.class === newReservation.class && r.time === newReservation.time
      );
      if (exists) {
        throw new Error('Ya existe una reservación en ese horario para esa clase.');
      }

     const reservation = {
        id: nextId++, // pura: sube de 1 en 1
        client: newReservation.client,
        class: newReservation.class,
         time: newReservation.time,
        price: Number(newReservation.price),
        status: 'pendiente'};
        
      setReservations(prev => [...prev, reservation]);
      showNotification(`Reservación creada para ${reservation.client}.`, 'success');
      closeModal();

    } catch (error) {
      showNotification(`${error.message}`, 'error');
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

  // ==========CÁLCULOS DE RESUMEN Y FILTRADO ==========
  
  const totalPending = reservations.filter(r => r.status === 'pendiente').length;
  const totalPaid = reservations.filter(r => r.status === 'pagado').reduce((sum, r) => sum + r.price, 0);

  // FILTRADO CON BÚSQUEDA POR CLIENTE, CLASE Y HORA
  const filteredReservations = reservations.filter(res => {
    const term = searchTerm.toLowerCase();
    return (
      res.client.toLowerCase().includes(term) ||
      res.class.toLowerCase().includes(term) ||
      res.time.toLowerCase().includes(term) 
    );
  });

  // ==========RETORNO DEL JSX (UI) ==========
  
  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans">

      {/* --- HEADER (Barra superior) --- */}
      <nav className="bg-dark-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">GymFit</h1>
            <p className="text-xs text-gray-400">Bienvenido a Recepcion</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <p className="text-sm text-gray-300">Hola, <span className="font-bold text-white">{user?.name}</span></p>
            <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </button>
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">

        {/* --- NOTIFICACIÓN FLOTANTE --- */}
        {notification && (
          <div className={`fixed top-20 right-6 px-6 py-3 rounded-lg shadow-xl flex items-center z-50 text-white ${
            notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}>
            {notification.type === 'error'
              ? <AlertCircle className="h-5 w-5 mr-2" />
              : <CheckCircle className="h-5 w-5 mr-2" />}
            {notification.message}
          </div>
        )}

        {/* --- TARJETAS DE RESUMEN (KPIs) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Clientes Esperados</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{totalPending}</h3>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <UserPlus className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Ingresos del Día</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">$ {totalPaid} MXN</h3>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Reservaciones Activas</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">{reservations.length}</h3>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* --- BARRA DE BÚSQUEDA --- */}
        <div className="flex items-center mb-4 gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por cliente, clase u hora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* --- SECCIÓN DE ACCIONES RÁPIDAS --- */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Atención de Clientes</h2>
          <button
            onClick={openModal}
            className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Nueva Reservación
          </button>
        </div>

        {/* --- TABLA DE CLIENTES --- */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className = "px-6 py-4">ID CLIENTE</th>
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
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'No hay reservaciones para hoy.'}
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-800 font-medium">{res.id}</td>
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
                          <button
                            onClick={() => handleConfirmAttendance(res.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Confirmar Asistencia"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}

                        {res.status !== 'pagado' && (
                          <button
                            onClick={() => handlePayment(res.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Cobrar Clase"
                          >
                            <CreditCard className="h-5 w-5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleCancel(res.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Cancelar"
                        >
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Encabezado del Modal */}
              <div className="bg-dark-800 px-6 py-4 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Nueva Reservación</h3>
                <button 
                  onClick={closeModal} 
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Formulario */}
              <form onSubmit={handleCreateReservation} className="p-6 space-y-4">
                {/* Campo: Cliente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={newReservation.client}
                    onChange={(e) => setNewReservation({...newReservation, client: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                  />
                </div>

                {/* Campo: Clase */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clase</label>
                  <select
                    value={newReservation.class}
                    onChange={(e) => {
                      const selected = MOCK_CLASSES.find(c => c.name === e.target.value);
                      setNewReservation({
                        ...newReservation,
                        class: e.target.value,
                        price: selected ? selected.price : ''
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                  >
                    <option value="">Selecciona una clase...</option>
                    {MOCK_CLASSES.map(c => (
                      <option key={c.id} value={c.name}>{c.name} - ${c.price}</option>
                    ))}
                  </select>
                </div>

                {/* Campo: Horario */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario</label>
                  <input
                    type="text"
                    placeholder="Ej: 14:00"
                    value={newReservation.time}
                    onChange={(e) => setNewReservation({...newReservation, time: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-gray-800"
                  />
                </div>

                {/* Campo: Precio (solo lectura) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                  <input
                    type="text"
                    value={newReservation.price ? `$${newReservation.price}` : ''}
                    disabled
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-2">
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
