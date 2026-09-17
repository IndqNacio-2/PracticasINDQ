
class Entrenador {
  final String id;
  final String nombre;
  final String apellido;
  final String email;
  final String telefono;
  final List<String> especialidades;
  final bool activo; //esta variable determina si puede dar clases actualmente

  Entrenador({
    required this.id,
    required this.nombre,
    required this.apellido,
    required this.telefono,
    required this.email,
    required this.especialidades,
    this.activo = true, //Se queda en defecto en activo si no se especifica
  }) {
    if (nombre.trim().isEmpty || apellido.trim().isEmpty) {
      throw ArgumentError('Nombre y apellido del entrenador no pueden estar vacíos');
    }

    //validacion para la especialidad donde debe tener almenos 1
    if (especialidades.isEmpty) {
      throw ArgumentError('El entrenador debe tener al menos una especialidad asignada');
    }

    // Validación de email simple (reutilizable en producción con un helper)
    if (!email.contains('@')) {
      throw ArgumentError('Email del entrenador inválido');
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nombre': nombre,
      'apellido': apellido,
      'email': email,
      'telefono': telefono,
      'especialidades': especialidades,
      'activo': activo,
    };
  }
}