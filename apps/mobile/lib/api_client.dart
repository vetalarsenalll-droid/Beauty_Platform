import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

class ApiClient {
  ApiClient({this.token});

  final String? token;

  Uri _uri(String path) => Uri.parse('${ApiConfig.baseUrl}$path');

  Map<String, String> _headers({String? overrideToken}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    final authToken = overrideToken ?? token;
    if (authToken != null && authToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer ${authToken.trim()}';
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(String path, {String? tokenOverride}) async {
    final response =
        await http.get(_uri(path), headers: _headers(overrideToken: tokenOverride));
    return _decode(response);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body,
      {String? tokenOverride}) async {
    final response = await http.post(_uri(path),
        headers: _headers(overrideToken: tokenOverride),
        body: jsonEncode(body));
    return _decode(response);
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body,
      {String? tokenOverride}) async {
    final response = await http.patch(_uri(path),
        headers: _headers(overrideToken: tokenOverride),
        body: jsonEncode(body));
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      return payload;
    }
    return payload;
  }
}
