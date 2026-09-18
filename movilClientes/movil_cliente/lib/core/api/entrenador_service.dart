
import '../api/mock_data.dart';
import '../models/entrenador.dart';
import 'api_client.dart';

//acceso al servicio de entrenadores
class EntrenadorService {
  EntrenadorService(this._client);

  final ApiClient _client;

  static const bool _usarMock = true;

  //obtenemos los entrenadores
  Future<List<Entrenador>> obtenerEntrenadores() async{
    if(_usarMock){
      await Future.delayed(const Duration(milliseconds: 350));
      return MockDatabase.obtenerEntrenadores();
    }

      // -posible codigo para el consumo de la api aun no lo pruebo
    /*
    try {
      final response = await _client.dio.get('/entrenadores');
      final data = response.data as List;
      return data.map((json) => Entrenador.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Error al cargar entrenadores: $e');
    }
    */
    throw UnimplementedError('Esperando API administrativa');
  }

    //FILTRAMOS SOLO LOS ENTRENADORES DISPONIBLES
     Future<List<Entrenador>> obtenerEntreadoresActivos() async{
      final todos = await obtenerEntrenadores();
      return todos.where((e)=>e.activo).toList();
     }

     //Buscar entrenador por ID
     Future<Entrenador?> obtenerEntrenadorPorId(String id) async {
      if (_usarMock){
        await Future.delayed(const Duration(milliseconds: 250));
        try{
          return MockDatabase.obtenerEntrenadores().firstWhere((e)=> e.id ==id);
        } catch(_){
          return null;
        }
      }
      // --- CÓDIGO FUTURO (API REAL) ---
    /*
    final response = await _client.dio.get('/entrenadores/$id');
    return Entrenador.fromJson(response.data);
    */

    throw UnimplementedError('Esperando API administrativa');
  }
     }

