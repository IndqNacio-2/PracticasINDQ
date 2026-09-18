import '../api/mock_data.dart';
import '../models/membresia.dart';
import 'api_client.dart';

class MembresiaService {
  const MembresiaService(this._client);

  final ApiClient _client;
  static const bool _usarMock = true;

  //obtiene la membresia del cliente
  Future<Membresia?> obtenerMembresia(String clienteId) async {
    if (_usarMock){
      await Future.delayed(const Duration(milliseconds: 300));
      return MockDatabase.obtenerMembresia(clienteId);
    } 
    // CONSUMO DE LA API con posible codigo
    /*
    final response = await _client.get('/cliente/membresia');
    return Membresia.fromJson(response.data);
    */
    throw UnimplementedError('Esperando API administrativa');
  }

  /// Calcula cuántos días faltan para vencer (lógica de negocio en cliente).
    int diasRestantes(Membresia m) =>
      m.fechaVencimiento.difference(DateTime.now()).inDays;

}