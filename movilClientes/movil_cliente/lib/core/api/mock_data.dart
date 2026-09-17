
import '../models/cliente.dart';
import '../models/entrenador.dart';
import '../models/clases.dart';
import '../models/membresia.dart';

// --- Instancias de Datos Falsos (MOCK) ---

// 1. Mock de Clientes
final List<Cliente> mockClientes = [
  Cliente(
    id: '1',
    nombre: 'Ana',
    apellido: 'García',
    email: 'ana.garcia@email.com',
    telefono: '5512345678',
    fechaNacimiento: DateTime(1995, 8, 15),
    peso: 65.5,
    altura: 1.65,
    condicionesMedicas: 'Asma leve',
    alergias: 'Ninguna',
    hobbies: 'Lectura, Senderismo',
    nivelActividad: 'Medio',
  ),
  Cliente(
    id: '2',
    nombre: 'Carlos',
    apellido: 'López',
    email: 'carlos.lopez@email.com',
    telefono: '5598765432',
    fechaNacimiento: DateTime(1990, 3, 22),
    peso: 80.0,
    altura: 1.80,
    condicionesMedicas: null,
    alergias: 'Alergia a mariscos',
    hobbies: 'Fútbol, Videojuegos',
    nivelActividad: 'Alto',
  ),
];

// 2. Mock de Entrenadores
final List<Entrenador> mockEntrenadores = [
  Entrenador(
    id: 'e1',
    nombre: 'Roberto',
    apellido: 'Méndez',
    email: 'roberto@fitgym.com',
    telefono: '5511111111',
    especialidades: ['Crossfit', 'Boxeo'],
    activo: true,
  ),
  Entrenador(
    id: 'e2',
    nombre: 'Lucía',
    apellido: 'Fernández',
    email: 'lucia@fitgym.com',
    telefono: '5522222222',
    especialidades: ['Yoga', 'Pilates'],
    activo: true,
  ),
];

// 3. Mock de Clases (Asociadas a entrenadores de arriba)
final List<Clase> mockClases = [
  Clase(
    id: 'c1',
    nombre: 'Crossfit Intenso',
    capacidadMaxima: 15,
    entrenadores: mockEntrenadores[0], // Roberto
    fechaHora: DateTime.now().add(const Duration(days: 2, hours: 1)), // Mañana a las 18:00
    duracionMinutos: 60,
    precio: 250.00,
    cancelada: false,
  ),
  Clase(
    id: 'c2',
    nombre: 'Yoga Relaxante',
    capacidadMaxima: 20,
    entrenadores: mockEntrenadores[1], // Lucía
    fechaHora: DateTime.now().add(const Duration(days: 3, hours: 6)), // En 3 días a las 20:00
    duracionMinutos: 45,
    precio: 150.00,
    cancelada: false,
  ),
];

// 4. Mock de Membresías
final List<Membresia> mockMembresias = [
  Membresia(
    id: 'm1',
    tipo: TipoMembresia.anual,
    fechaInicio: DateTime.now().subtract(const Duration(days: 30)),
    fechaVencimiento: DateTime.now().add(const Duration(days: 335)),
    costoTotal: 3000.00,
    estaActiva: true,
  ),
];

// --- Función Utilitaria para Simular una "Base de Datos" ---
// Esto te permite simular que la API devuelve datos específicos
class MockDatabase {
  // Simula obtener todos los clientes
  static List<Cliente> obtenerClientes() => mockClientes;
  
  // Simula obtener todos los entrenadores
  static List<Entrenador> obtenerEntrenadores() => mockEntrenadores;
  
  // Simula obtener todas las clases
  static List<Clase> obtenerClases() => mockClases;
  
  // Simula obtener la membresía de un cliente por ID (ejemplo simple)
  static Membresia? obtenerMembresia(String clienteId) {
    // En una app real, esto buscaría en la lista, aquí devolvemos el ejemplo fijo
    return mockMembresias.isNotEmpty ? mockMembresias.first : null;
  }
}