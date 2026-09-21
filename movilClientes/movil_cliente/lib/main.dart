// lib/main.dart

import 'package:flutter/material.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';
import 'features/auth/registro_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GymFit App',
      debugShowCheckedModeBanner: false, // Oculta el banner "Flutter Debug"
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
        
        scaffoldBackgroundColor: const Color(0xFF1A2332),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1A2332),
          foregroundColor: Colors.white,
        ),
      ),
      // Aquí definimos que la pantalla inicial sea el Login
      initialRoute: '/', // Ruta inicial: Login
      routes: {
        '/': (context) => const LoginScreen(),  // Ruta raíz
        '/home': (context) => const HomeScreen(), // Ruta de inicio
        '/register': (_) => const RegistroScreen(),//ruta de registro
      },
    ); 
  } 
} 