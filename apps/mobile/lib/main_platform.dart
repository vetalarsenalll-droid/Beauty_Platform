import 'package:flutter/material.dart';
import 'app_theme.dart';
import 'screens/platform_home.dart';

void main() {
  runApp(const PlatformApp());
}

class PlatformApp extends StatelessWidget {
  const PlatformApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Beauty Platform Admin',
      theme: buildAppTheme(),
      home: const PlatformScaffold(),
    );
  }
}

class PlatformScaffold extends StatelessWidget {
  const PlatformScaffold({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Platform Admin'),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
      body: const PlatformAdminHome(),
    );
  }
}
