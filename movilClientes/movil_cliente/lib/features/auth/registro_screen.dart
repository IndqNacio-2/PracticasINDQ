import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/api/api_client.dart';
import '../../core/api/auth_servide.dart';
import 'login_screen.dart';

class RegistroScreen extends StatefulWidget {
  const RegistroScreen({super.key});

  @override
  State<RegistroScreen> createState() => _RegistroScreenState();
}

class _RegistroScreenState extends State<RegistroScreen> {
  // Controladores de texto para capturar lo que el usuario escribe en cada campo
  final _formKey = GlobalKey<FormState>();
  final _nombreController = TextEditingController();
  final _apellidoController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _telefonoController = TextEditingController();
  final _pesoController = TextEditingController();
  final _alturaController = TextEditingController();
  final _condicionesMedicasController = TextEditingController();
  final _alergiasController = TextEditingController();
  final _hobbiesController = TextEditingController();

  // Variables para elementos especiales que no son campos de texto simples
  String _nivelActividad = 'Bajo'; // Valor inicial del dropdown
  DateTime? _fechaNacimiento; // Puede ser null si no ha seleccionado fecha

  // Instancias de servicios para manejar datos
  final AuthService _authService = AuthService(ApiClient());
  final _storage = const FlutterSecureStorage();
  
  // Controla si la pantalla está cargando (muestra spinner)
  bool _isLoading = false;

  @override
  void dispose() {
    // Liberar recursos cuando la pantalla se cierra
    // Esto evita que los controladores sigan usando memoria (memory leaks)
    _nombreController.dispose();
    _apellidoController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _telefonoController.dispose();
    _pesoController.dispose();
    _alturaController.dispose();
    _condicionesMedicasController.dispose();
    _alergiasController.dispose();
    _hobbiesController.dispose();
    super.dispose();
  }

  // Metodo principal que se ejecuta cuando el usuario hace clic en "Crear Cuenta"
  Future<void> _handleRegistro() async {
    // Paso 1: Validar que el formulario sea correcto
    // validate() revisa todos los campos con sus validadores
    if (!_formKey.currentState!.validate()) {
      return; // Si hay errores, detener aqui
    }

    // Paso 2: Validar que las contraseñas coincidan
    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Las contraseñas no coinciden'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Paso 3: Validar que haya seleccionado una fecha de nacimiento
    if (_fechaNacimiento == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Debe seleccionar una fecha de nacimiento'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Paso 4: Validar que el peso sea un numero valido
    try {
      double.parse(_pesoController.text);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('El peso debe ser un numero valido'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Paso 5: Validar que la altura sea un numero valido
    try {
      double.parse(_alturaController.text);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('La altura debe ser un numero valido'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // Paso 6: Mostrar el spinner de carga mientras se procesa el registro
    setState(() => _isLoading = true);

    try {
      // Paso 7: Llamar al servicio de registro con todos los datos
      // El servicio hoy simula el registro, manana hara la llamada a la API
      final resultado = await _authService.register(
        nombre: _nombreController.text.trim(),
        apellido: _apellidoController.text.trim(),
        email: _emailController.text.trim(),
        password: _passwordController.text,
        telefono: _telefonoController.text.trim(),
        fechaNacimiento: _fechaNacimiento!,
        peso: double.parse(_pesoController.text),
        altura: double.parse(_alturaController.text),
        condicionesMedicas: _condicionesMedicasController.text.trim(),
        alergias: _alergiasController.text.trim(),
        hobbies: _hobbiesController.text.trim(),
        nivelActividad: _nivelActividad,
      );

      // Verificar que la pantalla aun existe (el usuario no la cerro mientras se procesaba)
      if (!mounted) return;

      // Paso 8: Si el registro fue exitoso, redirigir al Login
      if (resultado) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registro exitoso. Por favor, inicia sesion.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        // Redirigir al Login y eliminar el historial de navegacion
        Navigator.of(context).pushReplacementNamed('/');
      } else {
        // Paso 9: Si falla, mostrar error
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error en el registro. Intenta de nuevo.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      // Paso 10: Capturar cualquier error inesperado
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      // Paso 11: Siempre ocultar el spinner cuando termine (exitoso o no)
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A2332), // Fondo oscuro del tema
      appBar: AppBar(
        title: const Text('Crear Cuenta'),
        backgroundColor: const Color(0xFF1A2332),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        // SingleChildScrollView permite desplazarse si hay mucho contenido
        padding: const EdgeInsets.all(24.0),
        child: Form(
          // Form permite validar todos los campos juntos
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // SECCION 1: DATOS PERSONALES
              // Esta seccion agrupa los campos basicos del cliente
              const Text(
                'Datos Personales',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 16),

              // Campo de Nombre
              // Validacion: obligatorio, minimo 2 caracteres
              _buildTextField(
                controller: _nombreController,
                label: 'Nombre',
                hint: 'Juan',
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'El nombre es obligatorio';
                  }
                  if (value.length < 2) {
                    return 'El nombre debe tener al menos 2 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Apellido
              // Validacion: obligatorio, minimo 2 caracteres
              _buildTextField(
                controller: _apellidoController,
                label: 'Apellido',
                hint: 'Perez',
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'El apellido es obligatorio';
                  }
                  if (value.length < 2) {
                    return 'El apellido debe tener al menos 2 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Email
              // Validacion: obligatorio, debe contener @, debe contener .
              _buildTextField(
                controller: _emailController,
                label: 'Correo electronico',
                hint: 'juan@email.com',
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'El correo es obligatorio';
                  }
                  if (!value.contains('@')) {
                    return 'El correo debe contener @';
                  }
                  if (!value.contains('.')) {
                    return 'El correo debe contener un dominio valido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Telefono
              // Validacion: obligatorio, minimo 7 digitos
              _buildTextField(
                controller: _telefonoController,
                label: 'Telefono',
                hint: '+57 300 123 4567',
                keyboardType: TextInputType.phone,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'El telefono es obligatorio';
                  }
                  // Contar solo los digitos (ignorar caracteres especiales)
                  final digitos = value.replaceAll(RegExp(r'[^0-9]'), '');
                  if (digitos.length < 7) {
                    return 'El telefono debe tener al menos 7 digitos';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Fecha de Nacimiento
              // Validacion: obligatorio, se valida en _handleRegistro
              _buildDateField(),
              const SizedBox(height: 24),

              // SECCION 2: CONTRASENA
              // Esta seccion agrupa los campos de seguridad
              const Text(
                'Contrasena',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 16),

              // Campo de Contrasena
              // Validacion: obligatorio, minimo 6 caracteres
              _buildTextField(
                controller: _passwordController,
                label: 'Contrasena',
                hint: '••••••••',
                obscureText: true, // Oculta el texto con puntos
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'La contrasena es obligatoria';
                  }
                  if (value.length < 6) {
                    return 'La contrasena debe tener al menos 6 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Confirmar Contrasena
              // Validacion: obligatorio, se compara con la contrasena en _handleRegistro
              _buildTextField(
                controller: _confirmPasswordController,
                label: 'Confirmar Contrasena',
                hint: '••••••••',
                obscureText: true,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Confirma tu contrasena';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // SECCION 3: DATOS DE SALUD
              // Esta seccion agrupa los datos medicos del cliente
              const Text(
                'Datos de Salud',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 16),

              // Campo de Peso
              // Validacion: obligatorio, debe ser numero, mayor a 0
              _buildTextField(
                controller: _pesoController,
                label: 'Peso (kg)',
                hint: '70.5',
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'El peso es obligatorio';
                  }
                  try {
                    final peso = double.parse(value);
                    if (peso <= 0) {
                      return 'El peso debe ser mayor a 0';
                    }
                    if (peso > 500) {
                      return 'El peso no puede ser mayor a 500 kg';
                    }
                  } catch (e) {
                    return 'El peso debe ser un numero valido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Altura
              // Validacion: obligatorio, debe ser numero, entre 0.5 y 2.5 metros
              _buildTextField(
                controller: _alturaController,
                label: 'Altura (m)',
                hint: '1.75',
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'La altura es obligatoria';
                  }
                  try {
                    final altura = double.parse(value);
                    if (altura <= 0.5 || altura > 2.5) {
                      return 'La altura debe estar entre 0.5 y 2.5 metros';
                    }
                  } catch (e) {
                    return 'La altura debe ser un numero valido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Condiciones Medicas (Opcional)
              // Validacion: opcional, maximo 200 caracteres
              _buildTextField(
                controller: _condicionesMedicasController,
                label: 'Condiciones Medicas (opcional)',
                hint: 'Asma leve, Hipertension...',
                maxLines: 2,
                validator: (value) {
                  if (value != null && value.length > 200) {
                    return 'Maximo 200 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Campo de Alergias (Opcional)
              // Validacion: opcional, maximo 200 caracteres
              _buildTextField(
                controller: _alergiasController,
                label: 'Alergias (opcional)',
                hint: 'Mariscos, Lactosa...',
                maxLines: 2,
                validator: (value) {
                  if (value != null && value.length > 200) {
                    return 'Maximo 200 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // SECCION 4: ACTIVIDAD Y HOBBIES
              // Esta seccion agrupa la informacion sobre el nivel de actividad del cliente
              const Text(
                'Actividad y Hobbies',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 16),

              // Dropdown de Nivel de Actividad
              // Validacion: siempre tiene un valor seleccionado
              _buildDropdown(),
              const SizedBox(height: 12),

              // Campo de Hobbies (Opcional)
              // Validacion: opcional, maximo 300 caracteres
              _buildTextField(
                controller: _hobbiesController,
                label: 'Hobbies (opcional)',
                hint: 'Lectura, Senderismo, Videojuegos...',
                maxLines: 2,
                validator: (value) {
                  if (value != null && value.length > 300) {
                    return 'Maximo 300 caracteres';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 32),

              // BOTON DE REGISTRO
              // Este boton ejecuta _handleRegistro cuando se hace clic
              SizedBox(
                width: double.infinity, // Ocupa todo el ancho disponible
                height: 50,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleRegistro,
                  // Si isLoading es true, el boton se desactiva (no se puede hacer clic)
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      // Si esta cargando, muestra un spinner
                      : const Text(
                          'Crear Cuenta',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                  // Si no esta cargando, muestra el texto
                ),
              ),
              const SizedBox(height: 16),

              // LINK PARA IR AL LOGIN
              // Si el usuario ya tiene cuenta, puede ir al login desde aqui
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Ya tienes cuenta? ',
                      style: TextStyle(color: Colors.white70),
                    ),
                    GestureDetector(
                      onTap: () {
                        // Al hacer clic, redirige al login
                        Navigator.of(context).pushReplacementNamed('/');
                      },
                      child: const Text(
                        'Inicia sesion',
                        style: TextStyle(
                          color: Color(0xFF10B981),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // WIDGET AUXILIAR: Campo de Texto Reutilizable
  // Este widget se usa para crear campos de texto consistentes en toda la pantalla
  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
    bool obscureText = false,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Etiqueta del campo (label)
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        // Campo de texto con validacion
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText, // Oculta el texto si es contrasena
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.grey),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(
                color: Color(0xFF10B981),
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
          validator: validator, // Funcion que valida el campo
        ),
      ],
    );
  }

  // WIDGET AUXILIAR: Selector de Fecha
  // Permite al usuario seleccionar su fecha de nacimiento desde un calendario
  Widget _buildDateField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Fecha de Nacimiento',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () async {
            // Abre el calendario cuando el usuario toca el campo
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime(2000), // Fecha inicial sugerida
              firstDate: DateTime(1960), // Fecha minima permitida
              lastDate: DateTime.now(), // Fecha maxima permitida (hoy)
            );
            if (picked != null) {
              // Si el usuario selecciono una fecha, guardarla
              setState(() => _fechaNacimiento = picked);
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Muestra la fecha seleccionada o un texto por defecto
                Text(
                  _fechaNacimiento == null
                      ? 'Selecciona una fecha'
                      : '${_fechaNacimiento!.day}/${_fechaNacimiento!.month}/${_fechaNacimiento!.year}',
                  style: TextStyle(
                    color: _fechaNacimiento == null ? Colors.grey : Colors.black,
                  ),
                ),
                const Icon(Icons.calendar_today, color: Color(0xFF10B981)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // WIDGET AUXILIAR: Dropdown (Menu Desplegable)
  // Permite al usuario seleccionar el nivel de actividad fisica
  Widget _buildDropdown() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Nivel de Actividad',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: DropdownButton<String>(
            value: _nivelActividad, // Valor actualmente seleccionado
            isExpanded: true, // Ocupa todo el ancho disponible
            underline: const SizedBox(), // Elimina la linea por defecto
            items: const [
              // Opciones disponibles
              DropdownMenuItem(value: 'Bajo', child: Text('Bajo')),
              DropdownMenuItem(value: 'Medio', child: Text('Medio')),
              DropdownMenuItem(value: 'Alto', child: Text('Alto')),
            ],
            onChanged: (value) {
              // Cuando el usuario selecciona una opcion
              if (value != null) {
                setState(() => _nivelActividad = value);
              }
            },
          ),
        ),
      ],
    );
  }
}