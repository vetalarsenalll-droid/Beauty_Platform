# Aisha Runbook

## Architecture
1. `aisha-orchestrator.ts`
- NLU + smalltalk generation.
- Возвращает структурированный JSON (`intent`, `entities`, `confidence`).

2. `dialog-policy.ts`
- Каталог интентов.
- Приоритеты.
- Маршрутизация: `chat-only`, `booking-flow`, `client-actions`.
- Анти-галлюцинационные правила.

3. `intent-action-matrix.ts`
- Явное соответствие `intent -> handler -> required -> nextState -> fallback`.

4. `booking-flow.ts`
- Детерминированная state-machine записи.
- Поддержка входа с любого шага.
- Guard-правила для create/consent/confirm.

5. `client-account-flow.ts` + `client-account-tools.ts`
- Операции личного кабинета клиента (мои записи, статистика, отмена, перенос, повтор, профиль).
- Все запросы строго ограничены `accountId + clientId`.

6. API orchestrator:
- `app/api/v1/public/ai/chat/route.ts`
- Тонкая маршрутизация между потоками + persistence (`AiMessage`, `AiBookingDraft`, `AiAction`, `AiLog`).

## Add new intent
1. Добавить intent в `dialog-policy.ts` (`AishaIntent`, `INTENT_PRIORITY`, `routeForIntent`).
2. Добавить строку в `intent-action-matrix.ts`.
3. Обновить `aisha-orchestrator.ts` (разрешенные intents и промпт NLU).
4. Добавить handler в соответствующий flow (`booking-flow` или `client-account-flow`).
5. Добавить E2E кейс в `docs/ai/aisha-e2e-scenarios.md`.

## New domain/account onboarding (without hardcode)
1. Убедиться, что в БД заполнены:
- `Location`, `Service`, `SpecialistProfile`, `ScheduleEntry`, `AccountProfile`.
2. Не добавлять доменные ключи вручную в код.
3. Всегда строить ответы из данных аккаунта (через запросы к БД/API).
4. Для пользовательской персонализации использовать `AiSetting` (`aisha.systemPrompt`).

## Guard rules
1. Критичное действие только с подтверждением:
- создание записи,
- отмена,
- перенос,
- изменение профиля.
2. Идемпотентность:
- повторный `да` после завершения не должен создавать дубликат.
3. После `COMPLETED`:
- без явного `новая запись` не перезапускать flow.

## Metrics
`AiLog` пишет метрики хода:
- `intent`,
- `route`,
- `intentConfidence`,
- `usedFallback`,
- `usedNluIntent`,
- `failedAction`,
- `actionType`.

Рекомендуемые KPI:
1. `% fallback` = доля ответов без валидного NLU.
2. `% failed actions` = доля неуспешных create/cancel/reschedule.
3. `% successful create/cancel/reschedule`.
4. Среднее число ходов до успешной записи.

