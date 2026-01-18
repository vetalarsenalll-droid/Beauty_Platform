API CONTRACT (v1) — ЭТАЛОН

5.0. Принцип
API — единственная точка доменной логики.
Base: /api/v1/...
Source of truth: packages/contracts/openapi.yaml
Генерация клиентов: packages/contracts/generated/{ts,dart}

5.1. Стандарты ответа и ошибок
- success: { "data": { } }
- list: { "data": [ ], "page": { "cursor": null, "nextCursor": null, "limit": 20 } }
- empty: { "data": [] }

5.1.2. Единый формат ошибок
{ "error": { "code": "STRING_CODE", "message": "Human readable message", "details": { } } }

5.1.3. Ошибки валидации
{ "error": { "code": "VALIDATION_FAILED", "message": "Validation failed", "details": { "fields": [ { "path": "phone", "issue": "invalid_format" } ] } } }

5.2. Аутентификация и контекст
- actor type: client | staff(owner/manager/specialist/readonly) | platform_admin
- scope: platform | account | public
- accountId (для business scope) обязателен

Auth headers
- Web: httpOnly cookies (access/refresh)
- Mobile: Authorization: Bearer <access>
- X-Request-Id
- Idempotency-Key
- X-Client-Version

5.3. Версионирование API
- /api/v1 — стабильная версия
- breaking: deprecate или /api/v2

5.4. Пагинация
- cursor-based (limit/cursor)

5.5. Фильтры и сортировки
- query параметры: q, city, district, categoryId, serviceId, specialistId, locationId, priceFrom, priceTo, ratingFrom, availableOn, availableToday, availableTomorrow, hasOnlinePayment, hasPromo, tags
- sort=field:asc|desc

5.6. Идемпотентность
- Idempotency-Key обязателен
- IDEMPOTENCY_CONFLICT при конфликте

5.7. Каркас модулей
- Marketplace, Booking, Client, CRM, Platform, Integrations, AI

5.8. SSE
- GET /api/v1/realtime/sse?channels=...

5.9. OpenAPI правила
- summary + tags + security + requestBody + responses
- examples
- components/schemas/ErrorResponse
