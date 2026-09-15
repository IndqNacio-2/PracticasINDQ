import 'package:dio/dio.dart'; //dio es la libreria que hace peticiones http como fetch en JS
import 'package:flutter_secure_storage/flutter_secure_storage.dart';// guarda el token en un lugar seguro que no se puede leer en un archivo plano

class ApiClient {
  static const  _baseURL = 'http://localhost:3000'; // "_"siginifica en dart "Privado" solo se usa en este archivo

  final Dio _dio; //esta linea es la conexion a la API 
  final _storage =  const FlutterSecureStorage();//aqui se guarda el token del usuario de forma segura

  //metodo apicliente
  ApiClient()
      : _dio = Dio(BaseOptions(
        baseUrl: _baseURL,
        connectTimeout: const Duration(seconds : 10),// si el servidor tarda más de 10seg. en llegar marca error
        receiveTimeout: const Duration(seconds : 10),// si no recibe respuesta en 10 seg. marca error

      )) {
        _dio.interceptors.add(_AuthInterceptor(this));//agrega un filtro que se ejectuta antes de cada peticion  para agregar el token
      }

    Dio get dio => _dio;


    //atajo para leer datos
    Future<Response> get(String path,{Map<String, dynamic>?params}) =>
      _dio.get(path, queryParameters: params);

      //atajo para crear algo nuevo
    Future<Response> post(String path, {dynamic data}) =>
      _dio.post(path, data: data);

     //atajo para actualizar
    Future<Response> put(String path, {dynamic data}) =>
    _dio.put(path, data: data);

      //atajo par borrar
    Future<Response> delete(String path) => _dio.delete(path);

      //el savetoken es para guardar seguro el token despues de loguearse 
    Future<void> saveToken(String token) =>
      _storage.write(key: 'token', value: token);
     
     //getToken es para leer el token guardado antes de cada peticion
    Future<String?> getToken() => _storage.read(key: 'token');

    //clearToken es para borrar el token al hacer un logout
    Future<void> clearToken() => _storage.delete(key: 'token');

}

//Agrega el token automaticamente a cada peticion
class _AuthInterceptor extends Interceptor {
  final ApiClient _client;
  _AuthInterceptor(this._client);

    //
  @override
  Future<void> onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _client.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

    //si el servirt responde con codigo 401 borra el token de autenticacion
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      _client.clearToken();
    }
    handler.next(err);
  }
}

  

          


      
    