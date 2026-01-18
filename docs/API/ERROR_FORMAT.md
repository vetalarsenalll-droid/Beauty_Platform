API: Error Format

Единый формат ошибок
{ "error": { "code": "STRING_CODE", "message": "Human readable message", "details": { } } }

Ошибки валидации
{ "error": { "code": "VALIDATION_FAILED", "message": "Validation failed", "details": { "fields": [ { "path": "phone", "issue": "invalid_format" } ] } } }
