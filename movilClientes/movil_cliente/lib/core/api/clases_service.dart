import '../api/mock_data.dart'; 
import '../models/clases.dart';  
import 'api_client.dart';
import '../api/membresia_service.dart';

class ClasesService {
   ClasesService(this._client);

  final ApiClient _client;

  static const bool _usarMock = true;

  //obtenemos todas las clases disponibles
  Future<List<Clase>> obtenerClases() async{
    if (_usarMock){
      //simulamos latencia para probar el estado de carga
      await Future.delayed(const Duration(milliseconds: 200));

      return MockDatabase.obtenerClases();
    }
       
    //codigo para el consumo de la api 
    /*
    try {
      final response = await _client.dio.get('/clases');
      final data = response.data as List;
      // Convierte cada JSON en un objeto Clase usando fromJson del modelo.
      return data.map((json) => Clase.fromJson(json)).toList();
    } catch (e) {
      throw Exception('Error al cargar clases: $e');
    }
    */
    throw UnimplementedError('Esperando API administrativa');
  }


     Future<bool> reservarClase(String claseId,String clienteId) async{
        if (_usarMock){
          await Future.delayed(const Duration(milliseconds: 500));

          try{

            //simulacion de validaciones reales del backend
            final clase = MockDatabase.obtenerClases()
            .firstWhere((c)=>c.id == claseId);

            if(clase.cancelada)return false; //no se puede reservar cancelada

            return true;
            }  catch(_){
                return false;
                  }
                  }

                throw UnimplementedError('Esperando API administrativa');
              }







      //busca la clase especifica por ID
      //sirve para la patanlla de detalle/reservacion de clases
      Future<Clase?> ObtenerClasePorId(String id) async{
        if(_usarMock){
          await Future.delayed(const Duration(milliseconds: 250));

          try{
            return MockDatabase.obtenerClases().firstWhere((c) => c.id==id);
          }catch (_){
              // firstWhere lanza StateError si no encuentra coincidencia.
                // Devolvemos null para replicar el 404 de una API real.
              return null;
          }
        }

        // --- posible codigo de consumo para la api (aun no lo pruebo)
    /*
    final response = await _client.dio.get('/clases/$id');
    return Clase.fromJson(response.data);
    */

      throw UnimplementedError('Esperando API administrativa');
      } 
}