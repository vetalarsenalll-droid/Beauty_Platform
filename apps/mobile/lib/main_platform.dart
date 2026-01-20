import 'package:flutter/material.dart';
import 'app_theme.dart';
import 'auth_service.dart';
import 'platform_login.dart';
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

class PlatformScaffold extends StatefulWidget {
  const PlatformScaffold({super.key});

  @override
  State<PlatformScaffold> createState() => _PlatformScaffoldState();
}

class _PlatformScaffoldState extends State<PlatformScaffold> {
  PlatformSection _section = PlatformSection.overview;
  String? _token;

  @override
  void initState() {
    super.initState();
    _restoreToken();
  }

  Future<void> _restoreToken() async {
    final token = await AuthService().getValidAccessToken();
    if (!mounted) return;
    setState(() => _token = token);
  }

  void _selectSection(PlatformSection section) {
    setState(() => _section = section);
    Navigator.of(context).maybePop();
  }

  PlatformSectionItem get _currentItem =>
      platformSections.firstWhere((item) => item.section == _section);

  @override
  Widget build(BuildContext context) {
    if (_token == null) {
      return PlatformLogin(
        onLoggedIn: (token) => setState(() => _token = token),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_currentItem.label),
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
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              const ListTile(
                title: Text(
                  'Beauty Platform',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text('admin@beauty.local'),
                trailing: Icon(Icons.shield_outlined),
              ),
              const Divider(),
              Expanded(
                child: ListView(
                  children: [
                    for (final item in platformSections)
                      ListTile(
                        leading: Icon(item.icon),
                        title: Text(item.label),
                        selected: item.section == _section,
                        onTap: () => _selectSection(item.section),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: PlatformSectionView(
        section: _section,
        onNavigate: _selectSection,
        token: _token ?? '',
      ),
    );
  }
}
