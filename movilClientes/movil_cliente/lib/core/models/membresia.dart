enum TipoMembresia { mensual, trimestral, anual } // Enumeración fija

class Membresia {
  final String id;
  final TipoMembresia tipo;
  final DateTime fechaInicio;
  final DateTime fechaVencimiento;
  final bool estaActiva;
  final double costoTotal;

  Membresia({
    required this.id,
    required this.tipo,
    required this.fechaInicio,
    required this.fechaVencimiento,
    required this.costoTotal,
    this.estaActiva = true,
  }) {
    // Validación de fechas coherentes
    if (fechaVencimiento.isBefore(fechaInicio)) {
      throw ArgumentError('La fecha de vencimiento no puede ser anterior al inicio');
    }

    if (costoTotal < 0) {
      throw ArgumentError('El costo no puede ser negativo');
    }
  }

  // Método útil para la UI: ¿Cuántos días quedan?
  int get diasRestantes {
    final ahora = DateTime.now();
    if (ahora.isAfter(fechaVencimiento)) return 0;
    return fechaVencimiento.difference(ahora).inDays;
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tipo': tipo.name, // Convierte el enum a string ('mensual')
      'fechaInicio': fechaInicio.toIso8601String(),
      'fechaVencimiento': fechaVencimiento.toIso8601String(),
      'estaActiva': estaActiva,
      'costoTotal': costoTotal,
    };
  }
}