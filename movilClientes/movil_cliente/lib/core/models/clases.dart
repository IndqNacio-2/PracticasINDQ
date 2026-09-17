
import 'entrenador.dart';

class Clase {
  final String id;
  final String nombre;       // Ej: "Spinning", "Box"
  final int capacidadMaxima; // Cuántos cupos hay
  final Entrenador entrenadores; // Relación directa con el modelo anterior
  final DateTime fechaHora;  // Fecha y hora exacta de la clase
  final int duracionMinutos; // Duración estimada
  final double precio;       // Costo de la clase individual
  
  // Estado de la clase 
  final bool cancelada; 

  Clase({
    required this.id,
    required this.nombre,
    required this.capacidadMaxima,
    required this.entrenadores,
    required this.fechaHora,
    required this.duracionMinutos,
    required this.precio,
    this.cancelada = false,
  }) {
    // Validaciones Lógicas
    if (capacidadMaxima <= 0) {
      throw ArgumentError('La capacidad máxima debe ser mayor a 0');
    }
    
    if (precio < 0) {
      throw ArgumentError('El precio no puede ser negativo');
    }

    if (duracionMinutos <= 0) {
      throw ArgumentError('La duración debe ser mayor a 0 minutos');
    }

    // No permitir clases en el pasado (para reservas nuevas)
    if (fechaHora.isBefore(DateTime.now())) {
      throw ArgumentError('No se pueden registrar clases pasadas');
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nombre': nombre,
      'capacidadMaxima': capacidadMaxima,
      'entrenadorId': entrenadores.id, 
      'fechaHora': fechaHora.toIso8601String(),
      'duracionMinutos': duracionMinutos,
      'precio': precio,
      'cancelada': cancelada,
    };
  }
}