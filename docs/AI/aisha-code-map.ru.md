# Карта Кода Aisha

## Назначение
Этот документ фиксирует текущую архитектуру чата Aisha и связи между модулями, чтобы при рефакторинге не ломались соседние домены.

## Точки Входа
1. `apps/web/app/api/v1/public/ai/chat/route.ts`
- Тонкий API-слой.
- Делегирует:
  - `GET`/`DELETE` -> `aisha-chat-http-handlers.ts`
  - `POST` -> `aisha-chat-post-handler.ts`

2. `apps/web/lib/aisha-chat-http-handlers.ts`
- Обработчики чтения/сброса публичного треда.
- Ответственность:
  - проверка доступа к треду
  - rate-limit для GET/DELETE
  - возврат `thread/messages/draft/threadKey`

3. `apps/web/lib/aisha-chat-post-handler.ts`
- Главный оркестратор POST.
- Запускает turn-pipeline и доменные обработчики.

## POST Pipeline (Канонический)
1. `preparePostTurn` (`aisha-turn-persistence.ts`)
- resolve аккаунта + rate-limit + валидация body
- resolve session/client/thread/draft
- сохранение user message + started action

2. `buildTurnContext` (`aisha-chat-turn-context.ts`)
- загрузка публичного AI-контекста (`aisha-chat-preload.ts`)
- расчет `nowYmd/nowHm` и нормализация текста
- запуск NLU (`runAishaNlu`)
- построение intent/route context (`aisha-chat-intent-context.ts`)

3. `computeBookingDecisions` (`aisha-booking-decisions.ts`)
- расчет флагов управления booking (`shouldRunBookingFlow`, `shouldEnrichDraftForBooking` и т.д.)

4. `applyDraftMutations` (`aisha-draft-mutations.ts`)
- изменения слотов draft с guard-проверками совместимости:
  - `locationId`, `serviceId`, `specialistId`, `date`, `time`, `mode`, `consent`

5. `handleUnknownServiceResolution` (`aisha-fuzzy-resolver.ts`)
- обработка неизвестной услуги + typo/fuzzy
- может завершить ход ранним ответом с quick-replies

6. Выполнение доменной ветки
- `handleClientActionsDomain` (`aisha-handle-client-actions.ts`)
- `handleBookingDomain` (`aisha-handle-booking.ts`)
- `handleChatOnlyDomain` (`aisha-handle-chat-only.ts`)
- сборщики ответов: `aisha-chat-reply-builder.ts`

7. `postProcessReply` (`aisha-chat-postprocess.ts`)
- санитизация стиля/тона
- anti-hallucination guard
- dedupe/repair CTA

8. `saveTurn` (`aisha-turn-persistence.ts`)
- сохранение assistant message
- сохранение draft/action/log
- запись routing/debug metadata

9. `createFailSoftHandler` (`aisha-turn-persistence.ts`)
- единый fail-soft fallback на ошибках хода

## Ответственность Маршрутизации
1. `aisha-chat-router.ts`
- обертка принятия route-решения
- делегирует в route-contract

2. `aisha-route-contract.ts`
- контракт приоритетов маршрутизации и route reason constants
- центральный источник route reason флагов

3. `dialog-policy.ts`
- каталог интентов + базовый `routeForIntent`

## Ответственность Модели / LLM
1. `aisha-orchestrator.ts`
- NLU extraction
- smalltalk/action generation
- bridge/naturalize helpers

2. `aisha-chat-postprocess.ts`
- guard/санитизация модельного ответа после генерации

## Парсинг / Эвристики / Лексикон
1. `aisha-chat-parsers.ts`
- парсеры даты/времени/телефона/имени
- `draftView`, date helpers

2. `aisha-routing-helpers.ts`
- эвристики интентов, fuzzy helpers, slot utility logic, UI builders
- guard-функции, переиспользуемые между доменами

3. `aisha-lexicon.ts`
- канонический словарь regex/phrases для decision-слоя

## Ответственность Thread/Auth/Session
1. `aisha-chat-thread.ts`
- build/validate thread key
- проверки доступа к треду
- resolve клиента и привязка к треду
- resolve system prompt

## Типы (Единый Контракт)
1. `aisha-chat-types.ts`
- `Body`, `Action`, `PreparedPostTurn`, `TurnContext`, `DraftDecision`, `TurnResult`

## Доменные Модули
1. Booking:
- `aisha-handle-booking.ts`
- `booking-flow.ts` (state machine)

2. Client account actions:
- `aisha-handle-client-actions.ts`
- `client-account-flow.ts`

3. Chat-only/info:
- `aisha-handle-chat-only.ts`
- `aisha-chat-reply-builder.ts` helpers

## Data Touchpoints (DB Writes)
1. `AiMessage`
- user/assistant сообщения в каждом ходу

2. `AiBookingDraft`
- персистентное состояние слотов

3. `AiAction`
- статус хода + routing payload + diagnostics

4. `AiLog`
- метрики и decision-сигналы

## Инварианты (Нельзя Ломать)
1. Активный draft нельзя тихо уронить в generic chat-only.
2. Если услуга выбрана, нельзя снова открывать полный каталог без явного запроса.
3. Смена локации не должна без причины сбрасывать валидные service/date/time.
4. При low-confidence/unknown-service нужно уточнение с вариантами, а не уход в общий smalltalk.
5. Client actions (`cancel/reschedule/my bookings/stats/profile`) всегда выше по приоритету, чем casual chat.
6. Финальная запись результата хода должна идти через `saveTurn` (единый write-контракт).

## Где Менять Что
1. Парсинг: `aisha-chat-parsers.ts`
2. Эвристики интентов: `aisha-routing-helpers.ts` (+ `dialog-policy.ts`, если новый intent)
3. Приоритеты route: `aisha-route-contract.ts`
4. Поведение booking-слотов: `aisha-draft-mutations.ts` и `aisha-booking-decisions.ts`
5. Стиль/guard ответа: `aisha-chat-postprocess.ts` и `aisha-orchestrator.ts`
6. Поведение личного кабинета: `aisha-handle-client-actions.ts` / `client-account-flow.ts`

## Quick Safe-Refactor Checklist
1. `npx tsc --noEmit -p apps/web/tsconfig.json`
2. Smoke-сценарии:
- greeting -> chat-only
- typo booking intent -> booking-flow
- service picked -> без reset каталога
- client cancel/reschedule -> client-actions
3. Проверить, что `AiAction.payload` содержит route reason и ожидаемый intent.
4. Проверить сохранение UTF-8 в русских литералах.
