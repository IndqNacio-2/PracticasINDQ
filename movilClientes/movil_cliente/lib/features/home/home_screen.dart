import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../auth/login_screen.dart';
import '../../core/api/clases_service.dart';
import '../../core/api/entrenador_service.dart';
import '../../core/api/perfil_service.dart';
import '../../core/api/api_client.dart';
import '../../core/models/clases.dart';
import '../../core/models/entrenador.dart';
import '../../core/models/cliente.dart';
import '../../core/api/membresia_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  
  // Instancias de los Servicios
final PerfilService _perfilService = PerfilService(ApiClient());
final ClasesService _clasesService = ClasesService(ApiClient());
final EntrenadorService _entrenadorService = EntrenadorService(ApiClient());

  // Estado de datos
  Cliente? _cliente;
  List<Clase> _clases = [];
  List<Entrenador> _entrenadores = [];
  bool _isLoading = true;
  String? _errorMessaje;

  @override
  void initState() {
    super.initState();
    _cargarDatos();
  }

  Future<void> _cargarDatos() async {
    try {
      final resultados = await Future.wait([
        _perfilService.obtenerPerfil('1'),
        _clasesService.obtenerClases(),
        _entrenadorService.obtenerEntrenadores(),
      ]);

      if (!mounted) return;

      setState(() {
        _cliente = resultados[0] as Cliente;
        _clases = resultados[1] as List<Clase>;
        _entrenadores = resultados[2] as List<Entrenador>;
        _isLoading = false;
        _errorMessaje = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessaje = 'Error al cargar datos: ${e.toString()}';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_errorMessaje!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _cerrarSesion() async {
    try {
      await _storage.delete(key: 'auth_token');
      if (mounted) {
        // Limpia el historial de navegación y va al Login
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
          (route) => false,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al cerrar sesión: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A2332), // Fondo oscuro GymFit //color antiguo 0xFF1A2332
      appBar: AppBar(
        title: const Text('GYMFIT'),
        backgroundColor: const Color(0xFF1A2332),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            onPressed: _cerrarSesion,
            tooltip: 'Cerrar Sesión',
          ),
        ],
      ), 
      // Si hay error, mostrar mensaje
      body: _errorMessaje != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Text(
                  _errorMessaje!,
                  style: const TextStyle(color: Colors.white70),
                  textAlign: TextAlign.center,
                ),
              ),
            )  
            
          : _isLoading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF10B981)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 1. Tarjeta de Bienvenida con Datos del Usuario
                      _buildPerfilCard(),
                      const SizedBox(height: 24),

                      // 2. Sección de Clases
                      _buildSeccionClases(),

                      const SizedBox(height: 32),

                      // 3. Sección de Entrenadores
                      _buildSeccionEntrenadores(),

                      const SizedBox(height: 32),

                      // 4. Botón Cerrar Sesión (al final)
                      Center(
                        child: OutlinedButton.icon(
                          onPressed: _cerrarSesion,
                          icon: const Icon(Icons.logout, color: Colors.white),
                          label: const Text(
                            'Cerrar Sesión',
                            style: TextStyle(color: Colors.white),
                          ),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                            side: const BorderSide(color: Colors.red, width: 1.5),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
    );
  }

  Widget _buildPerfilCard() {
    final nombre = _cliente?.nombre ?? 'Visitante';
    final apellido = _cliente?.apellido??'';
    final nombreCompleto = "$nombre $apellido";
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: const Color(0xFF10B981),
            child: Text(
              nombre.isNotEmpty ? nombre[0].toUpperCase() : '?',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '¡Hola!' ,
                  style: TextStyle(fontSize: 16, color: Colors.grey),
                ),
                Text(
                  nombreCompleto,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A2332),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Revisa tu agenda de clases.',
                  style: TextStyle(fontSize: 14, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSeccionClases() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Mis Clases',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        if (_clases.isEmpty)
          const Text(
            'No hay clases disponibles este momento.',
            style: TextStyle(color: Colors.white70),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _clases.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              return _buildClaseCard(_clases[index]);
            },
          ),
      ],
    );
  }

 Widget _buildClaseCard(Clase clase) {
  return Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF2C3E50),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFF10B981), width: 1),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Título
        Row(
          children: [
            const Icon(Icons.fitness_center, color: Color(0xFF10B981)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                clase.nombre,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Detalles
        _buildDetalleRow(Icons.access_time, 'Fecha: ${_formatearFecha(clase.fechaHora)}'),
        _buildDetalleRow(Icons.timer, 'Duración: ${clase.duracionMinutos} min'),
        _buildDetalleRow(Icons.person, 'Instructor: ${clase.entrenadores.nombre} ${clase.entrenadores.apellido}'),
        _buildDetalleRow(Icons.group, 'Cupo máximo: ${clase.capacidadMaxima} personas'),
        _buildDetalleRow(Icons.attach_money, 'Precio: \$${clase.precio.toStringAsFixed(2)}'),

        const SizedBox(height: 16),

        // BOTÓN DE RESERVA (Aquí agregamos la lógica)
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () async {
              // 1. Obtener el ID del usuario logueado
              final userId = await _storage.read(key: 'user_id') ?? '';

              // 2. Llamar al servicio
              final exito = await _clasesService.reservarClase(clase.id, userId);

              // 3. Mostrar resultado
              if (!mounted) return;
              
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    exito 
                      ? '¡Clase reservada con éxito!' 
                      : 'No fue posible reservar (clase cancelada o error)',
                  ),
                  backgroundColor: exito ? const Color(0xFF10B981) : Colors.red,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            icon: const Icon(Icons.event_available),
            label: const Text('Reservar Clase'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
      ],
    ),
  );
}

// Helper para formatear la fecha (si no lo tienes ya, agrégalo aquí o en el State)
String _formatearFecha(DateTime fecha) {
  const dias = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  final diaSemana = dias[fecha.weekday - 1];
  final mes = meses[fecha.month - 1];
  final hora = fecha.hour.toString().padLeft(2, '0');
  final minuto = fecha.minute.toString().padLeft(2, '0');
  return '$diaSemana ${fecha.day} $mes · $hora:$minuto';
}

  Widget _buildSeccionEntrenadores() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Entrenadores',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        if (_entrenadores.isEmpty)
          const Text(
            'No hay entrenadores disponibles.',
            style: TextStyle(color: Colors.white70),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _entrenadores.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              return _buildEntrenadorCard(_entrenadores[index]);
            },
          ),
      ],
    );
  }

  Widget _buildEntrenadorCard(Entrenador entrenador) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 5,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 25,
            backgroundColor: const Color(0xFF10B981),
            child: Text(
              entrenador.nombre.isNotEmpty ? entrenador.nombre[0].toUpperCase() : '?',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entrenador.nombre,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A2332),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  entrenador.especialidades.isNotEmpty
                      ? entrenador.especialidades.join(', ')
                      : 'Sin especialidades',
                  style: const TextStyle(
                    color: Colors.grey,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetalleRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF10B981)),
          const SizedBox(width: 8),
          Text(
            text,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}