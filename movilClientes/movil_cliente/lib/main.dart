// lib/main.dart

import 'package:flutter/material.dart';
import 'features/auth/login_screen.dart';

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
      ),
      // Aquí definimos que la pantalla inicial sea el Login
      home: const LoginScreen(),
    );
  }
}