import '../api/mock_data.dart';
import '../models/cliente.dart';
import 'api_client.dart';

class PerfilService {
  PerfilService(this._client);

  final ApiClient _client;
  static const bool _usarMock = true;

  /// Obtiene el perfil del cliente autenticado.
  /// [clienteId] identifica a quién buscar (en la API real esto 
  /// lo resuelve el backend leyendo el token JWT).
  Future<Cliente?> obtenerPerfil(String clienteId) async {
    if (_usarMock) {
      await Future.delayed(const Duration(milliseconds: 300));

      // Simula la búsqueda real: busca por ID, no tome el primero.
      // Devuelve null si no existe (comportamiento realista de una API).
      try {
        return MockDatabase.obtenerClientes()
            .firstWhere((c) => c.id == clienteId);
      } catch (_) {
        return null; // firstWhere lanza StateError si no encuentra nada
      }
    }

    // posible codigo a utilizar para el consumo de la api
    /*
    final response = await _client.dio.get('/cliente/perfil');
    return Cliente.fromJson(response.data);
    */

    throw UnimplementedError('Esperando API administrativa');
  }
}