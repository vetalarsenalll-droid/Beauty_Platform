1) Стек (единый для Web + Mobile + API) — ЭТАЛОН

1.0. Принцип
Один стек = одна доменная логика на сервере.
Web/Mobile — только клиенты. Все правила (booking/оплаты/уведомления/права/настройки) живут в API + доменных сервисах.

1.1. База и данные
1.1.1. PostgreSQL 16+
- Единственная основная БД.
- Multi-tenant: большинство доменных таблиц имеют account_id (кроме platform-scope).
- Времена/слоты: хранение в UTC, отображение в TZ аккаунта.

1.1.2. Prisma ORM
- Truth: packages/db/prisma/schema.prisma
- Миграции: packages/db/prisma/migrations/*
- Seeds: packages/db/prisma/seed/*

Обязательные правила:
- Все связи и уникальности фиксируем в Prisma.
- Индексы: на account_id, created_at, status, и ключевые поля поиска.
- Любые “enum статусы” фиксируем либо как Prisma enum, либо как справочники (если нужен runtime-edit).

1.1.3. Prisma Studio (dev-only)
- Разрешено только в dev.
- В prod — доступ закрыт.

1.2. Сервер и API (единый слой)
1.2.1. Node.js 20+ + TypeScript
- Единый runtime.
- Строгий TS (noImplicitAny, strict).
- Любые интеграции (SMTP/Telegram/MAX/платежи/вебхуки) — через адаптеры в packages/shared или apps/worker.

1.2.2. Next.js App Router
- Единый проект apps/web:
  - Web UI
  - API Routes: /app/api/v1/... (Route Handlers)

Правило:
- API не смешиваем с UI логикой.
- В API лежит “transport layer”, а вся доменная логика — в сервисах.

1.2.3. Валидация DTO
- Zod (или Valibot) как стандарт.
- Валидация входа на границе API.
- Ошибки приводим к единому формату { error: { code, message, details } }.

1.2.4. OpenAPI (Swagger) — контракт
- Truth: packages/contracts/openapi.yaml
- Каждый endpoint описан в OpenAPI.
- Каждое DTO имеет схему + примеры.
- Генерация клиентов:
  - packages/contracts/generated/ts
  - packages/contracts/generated/dart

1.3. Web UI
1.3.1. Next.js + React + TS
Один UI-проект, но 4 “зоны” внутри:
- Marketplace
- Client
- CRM Business
- Platform Admin

Маршрутизация (пример принципа):
- / marketplace
- /c/* client
- /crm/* business
- /platform/* platform admin

1.3.2. UI stack
- Tailwind CSS
- shadcn/ui
- Design Tokens (CSS variables)

Правило:
- Компоненты завязаны на tokens, а не на “случайные цвета”.

1.4. Mobile
1.4.1. Flutter (Dart)
Единое приложение, внутри 4 зоны:
- Marketplace
- Client
- CRM Business
- Platform Admin

1.4.2. Generated API client (из OpenAPI)
- Никаких ручных DTO “на глаз”.
- Клиент генерируется и используется напрямую.

1.4.3. Design Tokens -> Flutter ThemeData
- tokens — источник истины
- генерация темы и базовых стилей

1.4.4. Mobile lock
- После первичной авторизации включается PIN.
- Secure storage для refresh/access токенов.

1.5. Реалтайм, очереди, кэш
1.5.1. SSE realtime
- Каналы доменных событий (см. пункт 9 для каталога).
- SSE используется для обновления календаря/записей, статусов оплат, availability, in-app notifications.
- SSE не “истина”, а доставка обновлений. Истина — БД.

1.5.2. Outbox pattern (Postgres) + Worker (Node)
- Любое событие домена записывается в outbox_items.
- Worker доставляет уведомления и webhooks.
- delivery_logs, retries + backoff, дедупликация, dead-letter.

1.5.3. Redis
Использование:
- rate limiting
- дедупликация deliveries
- кэш (поиск/слоты/карта)
- short-lived locks (идемпотентность)

Правило:
- Redis — не источник правды. При потере Redis система восстанавливается из БД.

1.6. Наблюдаемость
1.6.1. JSON-логи
- единый формат
- correlation id / request id
- маскирование PII

1.6.2. Sentry (web+api+mobile)
- ошибки клиента и сервера в одном месте
- релизы/версии фиксируются

1.6.3. Healthchecks и мониторинг
- health endpoints
- мониторинг outbox lag
- мониторинг deliveries retries/dead-letter
- отображение статуса в Platform Admin

1.7. Инфраструктура (Reg.ru)
1.7.1. Docker + docker-compose (dev/prod)
Сервисы в проде:
- web (Next.js)
- worker
- postgres
- redis
- nginx
- backup jobs (cron контейнер или host cron)

1.7.2. Nginx + SSL
- SSL сертификаты
- проксирование на web/api
- rate limiting на edge (дополнительно к Redis)

1.7.3. SMTP Reg.ru для email
- один провайдер на старте
- шаблоны писем управляются через platform templates

1.7.4. Бэкапы
- PostgreSQL daily + retention
- restore-проверки (регламент)
- хранение в РФ

1.8. Стандарты папок в репо (привязка к пункту 13)
apps/web — Next.js UI + API /app/api/v1
apps/worker — outbox/webhooks/notifications worker
apps/mobile — Flutter
packages/db — Prisma schema/migrations/seeds
packages/contracts — OpenAPI + generated clients
packages/tokens — design tokens + generators
packages/shared — общие типы/утилиты/клиенты/адаптеры

1.9. Что обязательно отражаем в документации по стеку
- docs/ARCHITECTURE/STACK.md
- docs/ARCHITECTURE/ENV_DEV_PROD.md
- docs/API/OPENAPI_RULES.md
- docs/DB/PRISMA_RULES.md
