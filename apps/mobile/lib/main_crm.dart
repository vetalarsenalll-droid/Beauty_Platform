import 'package:flutter/material.dart';
import 'app_theme.dart';
import 'screens/crm_home.dart';

void main() {
  runApp(const CrmApp());
}

class CrmApp extends StatelessWidget {
  const CrmApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Beauty CRM',
      theme: buildAppTheme(),
      home: const CrmScaffold(),
    );
  }
}

class CrmScaffold extends StatelessWidget {
  const CrmScaffold({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('CRM Business'),
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
      body: const CrmHome(),
    );
  }
}
