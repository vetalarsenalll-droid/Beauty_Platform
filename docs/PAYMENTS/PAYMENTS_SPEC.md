PAYMENTS — ЭТАЛОН

7.0. Принцип
Единая модель online/offline, идемпотентность и аудит.

7.1. Сущности
- payment_intents
- transactions
- refunds
- receipts
- payment_methods

7.2. Сценарии
- полная онлайн-оплата
- депозит
- офлайн оплата (CRM)
- возвраты

7.3. Привязка к booking
- intent может быть привязан к appointmentId
- политика подтверждения в account_settings

7.4. Webhooks
- HMAC + timestamp + replay protection
- idempotency по provider_event_id

7.5. Идемпотентность
- Idempotency-Key обязателен

7.6. CRM отчеты
- касса/выручка/возвраты/комиссии

7.7. Доступы
- owner: все
- manager: по настройке
- specialist/readonly: нет

7.8. SSE
- payments.changed

7.9. API каркас
- /payments/intents
- /payments/refunds
- /payments/webhooks/{provider}

7.10. Platform Billing (ручные оплаты)
- Platform Admin выставляет счет (PlatformInvoice) по аккаунту.
- Ручная отметка оплаты создает PlatformPayment и переводит счет в PAID.
- При оплате подписка аккаунта становится ACTIVE, nextBillingAt = +1 месяц (MVP).
- Статусы в UI показываются на русском.
