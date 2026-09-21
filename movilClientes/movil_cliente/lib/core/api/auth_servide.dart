
import '../api/mock_data.dart';
import '../models/cliente.dart';
import 'api_client.dart';


class LoginResult {
  final String token;
  final Cliente cliente;

  const LoginResult({required this.token, required this.cliente});
}

class RegistroResult{
  final String token;
  final Cliente cliente;

  const RegistroResult({required this.token, required this.cliente});
}

class AuthService {
  const AuthService(this._client);

  final ApiClient _client;
  static const bool _usarMock = true;

  
  Future<LoginResult?> login(String email, String password) async {
    if (_usarMock) {
      // Simulamos latencia de red
      await Future.delayed(const Duration(milliseconds: 600));

      // Buscamos al cliente por email (como lo haría el backend)
      try {
        final cliente = MockDatabase.obtenerClientes()
            .firstWhere((c) => c.email == email.trim());

        
        const contrasenaSimulada = '123456';

        if (password != contrasenaSimulada) {
          return null; // Contraseña incorrecta
        }

        return LoginResult(
          token: 'mock_token_${cliente.id}',
          cliente: cliente,
        );
      } catch (_) {
        // firstWhere lanza StateError si el email no existe
        return null;
      }
    }

    // consumo cuando la api este lista
    /*
    try {
      final response = await _client.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      return LoginResult(
        token: response.data['token'],
        cliente: Cliente.fromJson(response.data['cliente']),
      );
    } catch (e) {
      throw Exception('Error de autenticación: $e');
    }  

    (esto no esta probado investigue (vi tutoriales de youtube jeje) y lo escribir como yo creo que va, pero lo probare ya que los services esten listos)
    */ 

    throw UnimplementedError('Esperando API administrativa');
  }

    //metodo para el registro del cliente
    Future<bool> register({
      required String nombre,
      required String apellido,
      required String email,
      required String password,
      required String telefono,
      required DateTime fechaNacimiento,
      required double peso,
      required double altura,
      required String condicionesMedicas,
      required String alergias,
      required String hobbies,
      required String nivelActividad,
    })async{
      if(_usarMock){
        //simulamos latencia de red
        await Future.delayed(const Duration(milliseconds: 800));

        try{
          //validamos que el email no este registrado ya
          final emailExiste = MockDatabase.obtenerClientes().any((c) => c.email == email.trim());

          if(emailExiste){
            //el email ya esta registrado
            return false;
          }

          if(nombre.trim().length < 2 || apellido.trim().length < 2) {
          return false;
          }

          if (!email.contains('@') || !email.contains('.')) {
          return false;
          }

          if (password.length < 6) {
          return false;
          }

          // Validacion 5: Verificar que el peso este en rango valido
          if (peso <= 0 || peso > 500) {
          return false;
          }

          // Validacion 6: Verificar que la altura este en rango valido
          if (altura <= 0.5 || altura > 2.5) {
          return false;
          }
           // Si todas las validaciones pasaron, el registro es exitoso
        // Aqui podriamos guardar el nuevo cliente en la lista de mock
        // pero por ahora solo devolvemos true indicando que fue exitoso
        return true;
      } catch (e) {
        // Si ocurre cualquier error inesperado, retornar false
        return false;
      }
      }
        // CODIGO FUTURO (API REAL)
    // Cuando la API este lista, descomentar esto y cambiar _usarMock a false
    /*
    try {
      final response = await _client.post(
        '/auth/register',
        data: {
          'nombre': nombre,
          'apellido': apellido,
          'email': email,
          'password': password,
          'telefono': telefono,
          'fecha_nacimiento': fechaNacimiento.toIso8601String(),
          'peso': peso,
          'altura': altura,
          'condiciones_medicas': condicionesMedicas,
          'alergias': alergias,
          'hobbies': hobbies,
          'nivel_actividad': nivelActividad,
        },
      );

      // Si el servidor devuelve codigo 201 (Created), el registro fue exitoso
      return response.statusCode == 201;
    } catch (e) {
      throw Exception('Error en el registro: $e');
    }
    */

    throw UnimplementedError('Esperando API administrativa');
  }

  // METODO 3: LOGOUT (Cierre de Sesion)
  // Elimina el token guardado para terminar la sesion
  Future<void> logout() async {
    if (_usarMock) {
      // En modo mock, solo eliminamos el token local
      await _client.clearToken();
      return;
    }

    // CODIGO FUTURO (API REAL)
    /*
    try {
      await _client.post('/auth/logout');
      await _client.clearToken();
    } catch (e) {
      throw Exception('Error al cerrar sesion: $e');
    }
    */

    throw UnimplementedError('Esperando API administrativa');
  }
}


        

      
    


