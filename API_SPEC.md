API_SPEC (v1)

1) Базовые правила
- Base path: /api/v1/...
- DTO стабильные (OpenAPI)
- Ошибки: { error: { code, message, details } }
- Пагинация: cursor/limit
- Стандарты фильтров/сортировки

2) Доменные модули
- Marketplace: list/map/search/profiles
- Booking: availability/slots/create/reschedule/cancel
- Client: me/appointments/favorites/loyalty/notifications/payments/settings
- CRM: calendar/schedule/services/specialists/clients/promos/analytics/media/settings
- Platform: accounts/plans/billing/audit/monitoring/templates/settings
- Integrations: webhooks endpoints/deliveries
- AI: threads/messages/actions/logs/limits/settings

3) Контракт
- Source of truth: packages/contracts (OpenAPI)
- Генерация клиентов: TS + Dart
