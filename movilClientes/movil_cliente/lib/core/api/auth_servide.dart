
import '../api/mock_data.dart';
import '../models/cliente.dart';
import 'api_client.dart';


class LoginResult {
  final String token;
  final Cliente cliente;

  const LoginResult({required this.token, required this.cliente});
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
}