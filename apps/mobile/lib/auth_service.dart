import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_client.dart';

class AuthService {
  static const _storage = FlutterSecureStorage();
  static const _accessTokenKey = 'bp_access_token';
  static const _refreshTokenKey = 'bp_refresh_token';
  static const _accessExpiresKey = 'bp_access_expires_at';
  static const _refreshExpiresKey = 'bp_refresh_expires_at';

  Future<String?> getAccessToken() async {
    return _storage.read(key: _accessTokenKey);
  }

  Future<String?> getRefreshToken() async {
    return _storage.read(key: _refreshTokenKey);
  }

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required String accessExpiresAt,
    required String refreshExpiresAt,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await _storage.write(key: _accessExpiresKey, value: accessExpiresAt);
    await _storage.write(key: _refreshExpiresKey, value: refreshExpiresAt);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _accessExpiresKey);
    await _storage.delete(key: _refreshExpiresKey);
  }

  bool _isExpired(String? expiresAt) {
    if (expiresAt == null || expiresAt.isEmpty) return true;
    final parsed = DateTime.tryParse(expiresAt);
    if (parsed == null) return true;
    return DateTime.now().isAfter(parsed);
  }

  Future<String?> getValidAccessToken() async {
    final accessToken = await getAccessToken();
    final accessExpiresAt = await _storage.read(key: _accessExpiresKey);
    if (accessToken != null &&
        accessToken.isNotEmpty &&
        !_isExpired(accessExpiresAt)) {
      return accessToken;
    }

    final refreshToken = await getRefreshToken();
    final refreshExpiresAt = await _storage.read(key: _refreshExpiresKey);
    if (refreshToken == null ||
        refreshToken.isEmpty ||
        _isExpired(refreshExpiresAt)) {
      await clearTokens();
      return null;
    }

    final client = ApiClient();
    final response = await client.post('/auth/refresh', {}, tokenOverride: refreshToken);
    if (response['error'] != null) {
      await clearTokens();
      return null;
    }

    final data = response['data'] as Map<String, dynamic>? ?? {};
    final newAccessToken = data['accessToken']?.toString() ?? '';
    final newRefreshToken = data['refreshToken']?.toString() ?? '';
    final newAccessExpiresAt = data['accessExpiresAt']?.toString() ?? '';
    final newRefreshExpiresAt = data['refreshExpiresAt']?.toString() ?? '';

    if (newAccessToken.isEmpty || newRefreshToken.isEmpty) {
      await clearTokens();
      return null;
    }

    await saveTokens(
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessExpiresAt: newAccessExpiresAt,
      refreshExpiresAt: newRefreshExpiresAt,
    );

    return newAccessToken;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final client = ApiClient();
    return client.post('/auth/login', {
      'email': email,
      'password': password,
    });
  }
}
