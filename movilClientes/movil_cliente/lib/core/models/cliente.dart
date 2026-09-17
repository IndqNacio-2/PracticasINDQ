class Cliente {

  final String? id;

  // Datos Personales
  final String nombre;
  final String apellido;
  final String email;
  final String telefono;
  final DateTime fechaNacimiento;

  // Perfil de Salud 
  final double? peso;
  final double? altura;
  final String? condicionesMedicas; 
  final String? alergias;           

  // Perfil de Actividad
  final String? hobbies;
  final String? nivelActividad;

  // Constructor con validaciones
  Cliente({
    this.id,
    required this.nombre,
    required this.apellido,
    required this.email,
    required this.telefono,
    required this.fechaNacimiento,
    this.peso,
    this.altura,
    this.condicionesMedicas,
    this.alergias,
    this.hobbies,
    this.nivelActividad,
  }) {
    // Validaciones de campos obligatorios
    _validateString('Nombre', nombre, minLength: 1, maxLength: 50);
    _validateString('Apellido', apellido, minLength: 1, maxLength: 50);
    _validateEmail(email);
    _validatePhone(telefono);
    _validateAge(fechaNacimiento);

    // Validaciones numéricas
    if (peso != null && peso! <= 0) {
      throw ArgumentError('El peso debe ser un número mayor a 0');
    }

    if (altura != null && altura! <= 0) {
      throw ArgumentError('La altura debe ser un número mayor a 0');
    }

    // Validaciones de rangos
    if (nivelActividad != null) {
      const nivelesValidos = {'Bajo', 'Medio', 'Alto'};

      if (!nivelesValidos.contains(nivelActividad)) {
        throw ArgumentError('El nivel de actividad debe ser "Bajo", "Medio" o "Alto"');
      }
    }
  }

  // Funciones de validación reutilizables 

  void _validateString(
    String nombreCampo,
    String valor, {
    int? minLength,
    int? maxLength,
  }) {
    if (valor.trim().isEmpty) {
      throw ArgumentError('El campo $nombreCampo no puede estar vacío');
    }
    if (minLength != null && valor.length < minLength) {
      throw ArgumentError(
        'El campo $nombreCampo debe tener al menos $minLength caracteres',
      );
    }
    if (maxLength != null && valor.length > maxLength) {
      throw ArgumentError(
        'El campo $nombreCampo no puede tener más de $maxLength caracteres',
      );
    }
  }

  void _validateEmail(String email) {
    final emailRegex = RegExp(r'^[^@]+@[^@]+\.[^@]+');
    if (!emailRegex.hasMatch(email)) {
      throw ArgumentError(
        'El email debe tener un formato válido (ejemplo@dominio.com)',
      );
    }
  }

  void _validatePhone(String telefono) {
    final phoneRegex = RegExp(r'^\d{10,15}$');
    if (!phoneRegex.hasMatch(telefono)) {
      throw ArgumentError('El teléfono debe tener entre 10 y 15 dígitos'); 
    }
  }

  void _validateAge(DateTime fechaNacimiento) {
    final now = DateTime.now();
    final edad = now.year - fechaNacimiento.year;

    if (edad < 0) {
      throw ArgumentError('La fecha de nacimiento no puede ser futura');
    }
    if (edad > 120) {
      throw ArgumentError(
        'La fecha de nacimiento parece incorrecta (edad mayor a 120 años)',
      );
    }
  }

  // Método para convertir a JSON 
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nombre': nombre,
      'apellido': apellido,
      'email': email,
      'telefono': telefono,
      'fechaNacimiento': fechaNacimiento.toIso8601String(),
      'peso': peso,
      'altura': altura,
      'condicionesMedicas': condicionesMedicas,
      'alergias': alergias,
      'hobbies': hobbies,
      'nivelActividad': nivelActividad,
    };
  }
}