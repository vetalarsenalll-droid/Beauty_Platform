0) Принципы работы и фиксации (как мы ведем проект) — ЭТАЛОН

0.1. Один источник правды (Single Source of Truth)
Источники истины (обязательные)

- База данных = Prisma schema
  - Путь: packages/db/prisma/schema.prisma
  - Все, что существует в домене — должно быть отражено в Prisma (включая settings/notifications/constructor).

- API контракт = OpenAPI
  - Путь: packages/contracts/openapi.yaml (или /openapi.json)
  - Генерация клиентов: TS + Dart.
  - Любой endpoint/DTO без OpenAPI — “не существует”.

- Дизайн = Design Tokens
  - Путь: packages/tokens/
  - Истина: JSON tokens -> генерация:
    - Web: CSS variables + Tailwind config
    - Mobile: Flutter ThemeData

- Документация изменений = журналы
  - DEVLOG.md — что сделали, какие файлы, почему.
  - MIGRATIONS.md — все миграции (цель, таблицы, ссылки).
  - API_CHANGELOG.md — изменения API (versioning).
  - SETTINGS_SPEC.md (в docs/SETTINGS/) — единая спецификация настроек.

Правило трассировки (самое важное)

Любая фича обязана иметь связь:
Док -> Таблицы (Prisma) -> Endpoints (OpenAPI) -> UI экраны -> Events (outbox/sse/webhooks) -> Логи/аудит.

0.2. Строгая фиксация (что считается “сделано”)
0.2.1. Definition of Done для любой задачи

Задача считается завершенной только когда есть:

Док-спека (или обновление существующей)
- docs/<MODULE>/<SPEC>.md
- Включает: scope, сущности, API, UI, события, настройки, безопасность, тест-сценарии.

БД
- Обновлена schema.prisma
- Если изменение структуры: Prisma migration (packages/db/prisma/migrations/...)
- При необходимости: seed/fixtures

API
- Добавлено/изменено в OpenAPI:
  - endpoint
  - request/response DTO
  - error format
  - примеры запросов/ответов

События/уведомления (если релевантно)
- Событие в outbox_items
- Обработчик worker
- Логи доставок + ретраи + дедуп

Безопасность/аудит (если релевантно)
- Проверка доступа (RBAC + tenancy boundary)
- Аудит действий (кто/что/когда/IP + diff)

DEVLOG запись
- что сделано
- какие файлы тронуты
- какие решения приняты

0.3. Правила изменений: что куда записывать
0.3.1. Если тронул БД

Обязательно:
- Миграция Prisma (если менялась структура)
- Запись в MIGRATIONS.md:
  - имя миграции
  - цель
  - список таблиц/полей/индексов
  - особые данные/бэкфилл (если был)

0.3.2. Если тронул API

Обязательно:
- Изменение openapi.yaml
- Запись в API_CHANGELOG.md:
  - версия
  - breaking/non-breaking
  - что поменялось и как мигрировать

0.3.3. Если тронул настройки/уведомления/конструктор

Обязательно:
- Обновление docs/NOTIFICATIONS/SETTINGS_SPEC.md или docs/SETTINGS/...
- Запись в SETTINGS_CHANGELOG.md (если влияет на поведение или UI)

0.3.4. Если тронул права доступа

Обязательно:
- Обновить docs/RBAC/PERMISSIONS_CATALOG.md
- Зафиксировать в DEVLOG, какие роли/права затронуты

0.4. Версионирование и совместимость

API Versioning
- Базовый префикс: /api/v1/...
- Breaking изменения: только через правила:
  - либо новый endpoint/DTO, старый помечается deprecated
  - либо новая v2 (когда реально надо)

Ошибки всегда единого формата:
{ "error": { "code": "STRING", "message": "STRING", "details": {} } }

Миграции
- Только вперед, аккуратно.
- Если нужен бэкфилл данных — описывается в MIGRATIONS.md + отдельный скрипт/seed.

0.5. Репозиторий и среда: локально -> VPS Reg.ru (единый стандарт)
Dev (локально)
- Docker Compose: web, worker, postgres, redis, nginx (опционально локально)
- Prisma Studio только в dev

Prod (VPS Reg.ru)
- Docker Compose prod + Nginx + SSL
- Backups: БД + медиа + конфиги
- Healthchecks: web/worker/redis/postgres
- Данные: хранение РФ

Важно: любые “секреты” только через env и менеджмент на VPS (не в репо).

0.6. Стандарты документации (чтобы дальше все было одинаково)
Единый шаблон спеки (для каждого пункта/модуля)
- Цель / scope / границы
- Сущности и связи (Prisma)
- API (OpenAPI)
- UI (экраны + состояния)
- Events (outbox/SSE/webhooks)
- Settings (platform/account/user)
- Security/RBAC/Audit/Idempotency
- Тест-сценарии (список)
- Файлы/папки (где лежит реализация)

0.7. Что мы создаем в корне прямо как “каркас правды”

Файлы-эталоны (обязательные):
- docs/MASTER_PROJECT.md — финал-эталон
- docs/INDEX.md — оглавление всех спеки
- DEVLOG.md
- MIGRATIONS.md
- API_CHANGELOG.md
- SETTINGS_CHANGELOG.md
