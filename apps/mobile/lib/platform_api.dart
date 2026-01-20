import 'api_client.dart';
import 'auth_service.dart';

class PlatformApi {
  PlatformApi(this.auth);

  final AuthService auth;

  Map<String, dynamic> _unauthenticated() {
    return {
      'error': {
        'code': 'UNAUTHENTICATED',
        'message': 'Auth required',
      },
    };
  }

  Future<ApiClient?> _client() async {
    final token = await auth.getValidAccessToken();
    if (token == null || token.isEmpty) return null;
    return ApiClient(token: token);
  }

  Future<Map<String, dynamic>> fetchAccounts() async {
    final client = await _client();
    if (client == null) return _unauthenticated();
    return client.get('/platform/accounts');
  }

  Future<Map<String, dynamic>> createAccount({
    required String name,
    required String slug,
    required String timeZone,
    int? planId,
  }) async {
    final client = await _client();
    if (client == null) return _unauthenticated();
    return client.post('/platform/accounts', {
      'name': name,
      'slug': slug,
      'timeZone': timeZone,
      'planId': planId,
    });
  }

  Future<Map<String, dynamic>> updateAccountPlan({
    required int accountId,
    required int? planId,
  }) async {
    final client = await _client();
    if (client == null) return _unauthenticated();
    return client.patch('/platform/accounts/$accountId', {
      'planId': planId,
    });
  }

  Future<Map<String, dynamic>> fetchPlans() async {
    final client = await _client();
    if (client == null) return _unauthenticated();
    return client.get('/platform/plans');
  }

  Future<Map<String, dynamic>> fetchOutbox() async {
    final client = await _client();
    if (client == null) return _unauthenticated();
    return client.get('/platform/monitoring/outbox');
  }

  Future<Map<String, dynamic>> createPlan({
    required String name,
    required String code,
    required String priceMonthly,
    required String currency,
    bool isActive = true,
  }) async {
    final client = await _client();
    if (client == null) return _unauthenticated();
    return client.post('/platform/plans', {
      'name': name,
      'code': code,
      'priceMonthly': priceMonthly,
      'currency': currency,
      'isActive': isActive,
    });
  }
}
