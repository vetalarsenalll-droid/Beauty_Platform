import 'package:flutter/material.dart';
import 'auth_service.dart';

class PlatformLogin extends StatefulWidget {
  const PlatformLogin({super.key, required this.onLoggedIn});

  final ValueChanged<String> onLoggedIn;

  @override
  State<PlatformLogin> createState() => _PlatformLoginState();
}

class _PlatformLoginState extends State<PlatformLogin> {
  final _emailController = TextEditingController(text: 'admin@beauty.local');
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = AuthService();
    final response = await auth.login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );
    if (response['error'] != null) {
      setState(() {
        _loading = false;
        _error = response['error']['message']?.toString() ?? 'Ошибка входа';
      });
      return;
    }

    final token = response['data']?['token']?.toString();
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Не получен токен';
      });
      return;
    }

    await auth.saveToken(token);
    if (!mounted) return;
    widget.onLoggedIn(token);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Вход в Platform Admin')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Пароль'),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.red),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Войти'),
            ),
          ],
        ),
      ),
    );
  }
}
