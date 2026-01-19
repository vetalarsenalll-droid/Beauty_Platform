import 'api_client.dart';

class PlatformApi {
  PlatformApi(this.client);

  final ApiClient client;

  Future<Map<String, dynamic>> fetchAccounts() async {
    return client.get('/platform/accounts');
  }

  Future<Map<String, dynamic>> createAccount({
    required String name,
    required String slug,
    required String timeZone,
    int? planId,
  }) async {
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
    return client.patch('/platform/accounts/$accountId', {
      'planId': planId,
    });
  }

  Future<Map<String, dynamic>> fetchPlans() async {
    return client.get('/platform/plans');
  }

  Future<Map<String, dynamic>> fetchOutbox() async {
    return client.get('/platform/monitoring/outbox');
  }

  Future<Map<String, dynamic>> createPlan({
    required String name,
    required String code,
    required String priceMonthly,
    required String currency,
    bool isActive = true,
  }) async {
    return client.post('/platform/plans', {
      'name': name,
      'code': code,
      'priceMonthly': priceMonthly,
      'currency': currency,
      'isActive': isActive,
    });
  }
}
