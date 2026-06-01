# CRM Agent v2 Real E2E Implementation Plan

Дата фиксации: 2026-05-29

## Цель

Довести CRM Agent v2 до проверки реальными пользовательскими фразами:

1. Оператор пишет обычную фразу агенту.
2. Агент проходит через `runCrmAgentTurn`.
3. Router/conversation/planner/runtime выбирают read tools и actions без runtime keyword/regex recovery.
4. Для mutating actions тест подтверждает действие через `actions.confirm`.
5. Тест проверяет фактическое состояние БД.
6. Все отклонения пишутся в markdown-отчет.

Этот уровень не заменяет catalog/static/integration tests. Он проверяет реальный разговорный путь end-to-end.

## Текущий статус

Команда:

```bash
npm run test:crm-agent-v2:real-e2e:local
```

Последний локальный результат:

```text
Section 13 actions: 374
Real dialog scenarios: 36
Scenario passed: 36
Scenario failed: 0
Action passed: 30
Action failed: 0
Not covered yet: 344
```

Минимальный этап `Passed >= 3 / Failed = 0` закрыт.

Актуальный отчет:

```text
docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.md
```

Покрытые real-dialog сценарии:

- `client.search`: passed.
- `client.view`: passed.
- `client.resolve`: passed.
- `client.create`: passed, action prepared and executed.
- `client.update`: passed, action prepared and executed.
- `client.archive`: passed, action prepared and executed.
- `client.restore`: passed, action prepared and executed.
- `client.add_contact`: passed, action prepared and executed.
- `client.update_contact`: passed, action prepared and executed.
- `client.delete_contact`: passed, action prepared and executed.
- `client.add_note`: passed, action prepared and executed.
- `client.update_note`: passed, action prepared and executed.
- `client.delete_note`: passed, action prepared and executed.
- `client.add_tag`: passed, action prepared and executed.
- `client.remove_tag`: passed, action prepared and executed.
- `client.create_tag`: passed, action prepared and executed.
- `client.merge_duplicates`: passed, draft action prepared.
- `client.view_history`: passed.
- `client.view_visits`: passed.
- `client.view_payments`: passed.
- `client.view_reviews`: passed.
- `client.view_loyalty`: passed.
- `client.update_consent`: passed, action prepared and executed.
- `client.notify`: passed, draft action prepared.
- `client.create_segment`: passed, draft action prepared.
- `client.export_segment`: passed, draft action prepared.
- `client.search` phone paraphrase: passed.
- `client.view` short paraphrase: passed.
- `client.add_note` comment paraphrase: passed, action prepared and executed.
- `client.notify` paraphrase: passed, draft action prepared.
- `client.view_history` multi-turn: passed.
- `client.delete_note` ambiguous negative: passed, no unsafe action.
- `appointment.create`: passed, action prepared and executed.
- `service.update_description`: passed, action prepared and executed.
- `service.search`: passed.
- `service.update_price`: passed, action prepared and executed.

Architecture guard:

- runtime has no appointment keyword/regex recovery: passed.

## Что сделано

Добавлены и используются:

- `scripts/crm-agent-v2-real-agent-e2e-tests.mjs`
- `scripts/run-crm-agent-v2-real-e2e-local.ps1`
- `docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.md`
- npm script: `test:crm-agent-v2:real-e2e:local`

Runner:

- загружает `.env.local` / `.env`;
- требует `DATABASE_URL`;
- запускается с `CRM_AGENT_V2_REAL_E2E=1`;
- создает отдельный тестовый account;
- включает `AiAccountAccess`;
- добавляет тестовый AI-баланс через `AiBalanceLedger`;
- создает fixture: клиент, услуги, локация, специалист, связи service/location/specialist;
- вызывает реальный `runCrmAgentTurn`;
- для `conversation_execute` ищет подготовленный `CrmAgentAction`;
- подтверждает action через `getCrmAgentExecuteToolHandler("actions.confirm")`;
- проверяет БД;
- пишет матрицу по всем 374 actions из раздела 13;
- чистит тестовый fixture после запуска.

## Исправления по первым 3 сценариям

### `client.search`

Исправления:

- conversation contract усилен: поиск конкретной CRM-сущности должен вызывать read tool;
- parser принимает `readToolRequests` в tolerant shape, включая одиночный object и `{name,args}`;
- fallback read tool request оставлен как contract hardening, без keyword action recovery.

Результат:

- агент вызывает `clients.search`;
- сценарий passed.

### `appointment.create`

Исправления:

- удален runtime deterministic recovery, который парсил appointment-фразы из `message`;
- planner repair/normalization добавляет draft step для mutating goal;
- runtime подставляет resolved ids в placeholders вроде `#CLIENT_ID#`, `#SERVICE_ID#`;
- добавлена нормализация дат `15-01-2030 10:00` и `15 января 2030 10:00`;
- action payload проходит через `actions.prepare`, затем `actions.confirm`.

Результат:

- `appointment.create` prepared and executed;
- appointment появляется в БД с `source = CRM_AGENT_V2`;
- сценарий passed.

### `service.update_description`

Исправления:

- planner contract усилен для `service.update_description`;
- parser принимает `type:"prepare"` как `draft`;
- parser нормализует `args.actionName` / `args.actionType`;
- runtime подставляет resolved service id из `services.search`, включая `$services.search.result.serviceId`;
- exact description для `service.update_description` сохраняется из пользовательского `на: ...`.

Результат:

- `service.update_description` prepared and executed;
- описание услуги обновляется в БД;
- сценарий passed.

### `service.search`

Исправления:

- real-E2E runner расширен read-only сценарием для домена услуг;
- проверка подтверждает фактический вызов `services.search` и наличие fixture-услуги в результате.

Результат:

- `service.search` вызывает read tool;
- сценарий passed.

### `service.update_price`

Исправления:

- planner parser принимает нестабильный step shape `type:"prepare"` / `toolName:"actions.prepare"`;
- planner normalization мапит `priceTotal` в `basePrice`;
- `*Id` slots с query-объектами нормализуются в placeholders вроде `#SERVICE_ID#`, а не в текстовое имя сущности;
- runtime last-chance recovery повторно разбирает структурированный planner raw, если planner result ошибочно пришел как `invalid_planner_json`;
- real-E2E runner отключает `jiti` cache, чтобы проверять текущие TS-файлы.

Результат:

- `service.update_price` prepared and executed;
- цена услуги обновляется в БД;
- сценарий passed.

## Проверки

Последние успешные проверки:

```bash
npm run typecheck
npm run test:crm-agent-v2:canonicalizer
npm run test:crm-agent-v2:real-e2e:local
```

Real-E2E report показывает:

```text
Scenario passed: 36
Scenario failed: 0
Action passed: 30
Action failed: 0
```

## Важное различие тестов

`scripts/crm-agent-v2-action-catalog-tests.mjs` проверяет каталог:

- action есть в разделе 13;
- action есть в registry;
- есть файл;
- корректны `status`, `kind`, `intent`, `risk`, `confirmation`, `permission`;
- есть нужные handlers.

`scripts/crm-agent-v2-real-agent-e2e-tests.mjs` проверяет реальный разговор:

- вход: обычная фраза оператора;
- путь: router -> conversation/planner -> runtime -> tools/actions;
- результат: read behavior или реальное изменение БД.

## Стратегия полного покрытия раздела 13

Цель real-E2E этапа - не просто набрать несколько happy-path сценариев, а провести весь каталог действий раздела 13 через реальный разговорный путь агента.

Каждое действие из `## 13. Полный каталог действий` должно получить строку в real-E2E матрице с одним из проверенных статусов:

- `passed` - action покрыт real-dialog сценарием и прошел ожидаемую проверку.
- `not_covered_yet` - сценарий еще не добавлен.
- `failed` - сценарий добавлен, но агент/runner/fixture/handler не прошел проверку.
- `read_only_verified` - read-only action проверен через tool call, workspace/cards/answer data или результат чтения.
- `draft_only_verified` - draft-only action корректно создает draft/preview и не выполняется через confirm.
- `blocked_verified` - blocked action корректно отказывает или требует недоступное условие.
- `unsupported_verified` - unsupported/planned action корректно объясняет, что действие описано, но не подключено к выполнению.

`not_covered_yet = 0` остается финальной целью, но это не означает, что все 374 actions обязаны завершаться `EXECUTED`. Expected outcome зависит от catalog status, risk и confirmation policy.

Правила проверки по типам действий:

- `read_only`: обычная фраза оператора -> router/planner/runtime -> read tool -> проверка tool call, result, workspace/cards или answer data.
- `implemented`: обычная фраза оператора -> `actions.prepare` -> `actions.confirm` -> проверка статуса action и фактического состояния БД.
- `draft_only`: обычная фраза оператора -> draft/preview created -> confirm не ожидается, БД не должна изменяться как executed action.
- `planned`, `blocked`, `unsupported`: обычная фраза оператора -> корректный отказ, clarification или explanation без ложного execution.
- high/critical risk: runner может подтверждать action в `conversation_execute`, но тест должен явно проверять confirmation path, а не обходить policy.

Ожидаемые классы падений при расширении покрытия:

- router выбрал неверный `kind` или не распознал CRM-задачу;
- conversation path ответил текстом вместо read tool request;
- planner вернул нестабильный JSON shape;
- planner выбрал общий action вместо конкретного registry action;
- required slots не попали в payload;
- `*Id` slot остался текстом вместо resolved id;
- read/resolve step не был добавлен до draft;
- runtime не подставил placeholder из результата предыдущего tool call;
- fixture не содержит сущность, нужную сценарию;
- confirmation/risk ожидание теста не совпало с catalog policy;
- handler имеет настоящий дефект в payload validation или DB mutation.

Исправления должны усиливать contract, parser, planner normalization, resolver/runtime placeholder handling или fixture. Runtime keyword/regex recovery по пользовательским фразам не возвращать.

## Codex-like CRM agent loop

Цель следующего уровня - не заставить LLM "понимать все" одним prompt-ом, а построить вокруг него такой же проверяемый цикл, как у Codex вокруг кода:

```text
user phrase
  -> router
  -> retrieval/context selection
  -> planner LLM
  -> canonicalizer
  -> validator
  -> repair-pass or clarification
  -> runtime tools/actions
  -> verifier/report
  -> regression tests
```

Обязательные свойства этого цикла:

- Каталог возможностей: агент выбирает только из зарегистрированных `tools` и `actions`, не придумывает новые операции.
- Контекст по запросу: перед планированием и выполнением агент должен добирать только релевантные CRM-данные, правила, examples и session state, а не полагаться на память модели.
- Canonicalizer: типовые drift-shapes модели чинятся до runtime (`aliases`, malformed `actions.prepare`, `args.args`, строковые id, misplaced read/draft steps, tool/action names in `type`).
- Validator gate: невалидный план не должен частично выполняться. Ошибки должны уходить в repair-pass или `needs_clarification`.
- Structured repair-pass: если validator нашел ошибки, planner получает конкретный список ошибок, допустимые actions/tools и ожидаемый JSON contract.
- Clarification вместо угадывания: если required slots нельзя безопасно получить из сообщения, state или read tools, агент задает вопрос.
- Regression capture: каждый новый real-E2E failure class должен получать быстрый no-LLM тест, если это parser/canonicalizer/validator drift.
- Runtime остается доменным executor-ом, а не phrase parser-ом: keyword/regex recovery по пользовательским фразам в runtime не возвращать.

Текущий статус по этому циклу:

- Уже есть: action/tool registry, router, planner, canonicalizer, partial validator, runtime tools/actions, persistence/audit, real-E2E matrix, filtered runs, canonicalizer no-LLM tests.
- Не хватает: полноценного structured repair-pass после validator failure, retrieval по docs/schema/business rules/examples, paraphrase matrix, multi-turn matrix, автоматического превращения diagnostics в regression fixtures.

## Client hardening до уровня Codex-like

Текущий client catalog slice закрыт по одному основному real-dialog сценарию на action: 26 client scenarios passed в полном прогоне 30/30. Это означает verified happy-path coverage, но не "любые фразы и диалоги".

Перед переходом к широкому покрытию новых доменов нужно добить клиентов отдельным hardening этапом:

1. Добавить `client.*` paraphrase matrix:
   - 3-5 формулировок на каждый важный action;
   - варианты с id (`#123`), именем, телефоном/email, короткой разговорной фразой;
   - варианты с неполными данными, где ожидается clarification, а не неверное действие.
2. Добавить multi-turn client scenarios:
   - "найди Анну" -> "покажи историю" -> "добавь заметку";
   - "подготовь сообщение клиенту" -> уточнение канала/текста -> draft;
   - "создай сегмент" -> уточнение фильтра -> draft;
   - ambiguous client name -> candidate selection -> action.
3. Добавить negative/safety scenarios:
   - read-only request не уходит в mutation;
   - delete/update без конкретного id или resolvable entity уходит в clarification;
   - dangerous/bulk/export actions остаются draft/confirmation-only.
4. Добавить no-LLM regression tests для новых client drift cases:
   - parser/canonicalizer malformed JSON/steps;
   - aliases и plural action names;
   - non-concrete id strings;
   - read steps after draft;
   - invalid optional filters.
5. Ввести метрики client robustness:
   - `client_happy_path_passed`: текущие 26/26;
   - `client_paraphrase_passed`: новая матрица;
   - `client_multiturn_passed`: новая матрица;
   - `client_negative_passed`: safety/clarification matrix.

Client domain считать "добитым" только когда:

- текущие 26 happy-path client scenarios проходят;
- paraphrase matrix проходит без failed;
- multi-turn matrix проходит без failed;
- negative/safety matrix проходит без failed;
- новые drift classes перенесены в no-LLM regression tests.

## Обязательный handoff-протокол для следующего агента

Этот файл является основным источником контекста для агента, который продолжит работу без истории текущего чата. После каждой правки, каждого прогона тестов и каждой добавленной пачки сценариев обязательно обновлять этот документ.

Перед завершением своей сессии агент обязан оставить здесь актуальное состояние:

- обновить блок `Текущий статус`: `Real dialog scenarios`, `Passed`, `Failed`, `Not covered yet`;
- обновить список `Покрытые real-dialog сценарии`;
- обновить `Полный чеклист раздела 13`: поставить `[x]` для закрытых actions, фактический `Real-E2E status`, scenario id или bug class в `Notes`;
- если action упал, оставить `[ ]`, статус `failed` и короткую причину падения в `Notes`;
- если action проверен как `read_only_verified`, `draft_only_verified`, `blocked_verified` или `unsupported_verified`, поставить `[x]` и указать verified outcome;
- обновить `Что сделано в последней пачке`;
- обновить `Следующая пачка для продолжения`;
- обновить `Открытые проблемы / наблюдения`, если появились новые классы падений;
- обновить `Fixture requirements`, если добавлялись новые сущности или cleanup;
- убедиться, что `docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.md` соответствует последнему запуску real-E2E.

Нельзя завершать работу после code fix без записи в этот plan, даже если тесты прошли. Следующий агент должен иметь возможность продолжить только по этому файлу, report и git diff.

Минимальный порядок после каждой пачки:

```bash
npm run typecheck
npm run test:crm-agent-v2:real-e2e:local
```

После команд:

1. Перенести summary из `docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.md` в `Текущий статус`.
2. Перенести новые passed/failed statuses в `Полный чеклист раздела 13`.
3. Записать в `Что сделано в последней пачке`, какие файлы менялись и какой bug class закрыт.
4. Записать в `Следующая пачка для продолжения`, с какого action/domain начинать следующему агенту.
5. Если тест не запускался, явно написать причину в `Что сделано в последней пачке`.

## Что сделано в последней пачке

Update 2026-05-30, batch 13.6 Client Codex-like hardening slice 1:

- Extended the real-E2E runner with scenario-level reporting so paraphrase/multi-turn scenarios can validate robustness without overwriting the per-action matrix.
- Added 6 client robustness scenarios with `matrix: false`:
  - `client-search-by-phone-paraphrase`;
  - `client-view-short-paraphrase`;
  - `client-add-note-paraphrase`;
  - `client-notify-paraphrase`;
  - `client-history-multiturn`;
  - `client-delete-note-ambiguous-negative`.
- Added `no_action` scenario mode for negative/safety checks where the expected behavior is clarification/no draft.
- Hardened canonicalizer for new client drift cases: phone/email/q read args map to `query`; `client.update` + comment wording maps to `client.add_note`; planner path references like `.slots.note.query` are replaced with user text; unknown draft action names fall back to the known goal action when safe.
- Made `client.archive` fixture phrase deterministic by including the fixture phone, and scoped `service.search` verification to the current session to avoid cross-scenario tool-call bleed.
- Added no-LLM canonicalizer regressions for add-note path references, unknown draft action fallback, and phone lookup read args.
- Full real-E2E result after this batch: 36 scenarios, 36 scenario passed, 0 scenario failed, 30 actions passed, 0 actions failed, 344 not covered yet.

Client robustness counters after this slice:

```text
client_happy_path_passed: 26/26
client_paraphrase_passed: 4/4
client_multiturn_passed: 1/1
client_negative_passed: 1/1
```

Checks:

```bash
npm run test:crm-agent-v2:canonicalizer
node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client-search-by-phone-paraphrase,client-view-short-paraphrase,client-add-note-paraphrase,client-notify-paraphrase,client-history-multiturn,client-delete-note-ambiguous-negative"
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client.archive,client.create_tag,client-add-note-paraphrase,client-search-by-phone-paraphrase,client-view-short-paraphrase,client-notify-paraphrase,client-history-multiturn,client-delete-note-ambiguous-negative"
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client-search-by-phone-paraphrase"
npm run test:crm-agent-v2:real-e2e:local
```

Update 2026-05-30, batch 13.5 Client draft-only completion:

- Added and verified real-dialog scenarios for `client.notify`, `client.create_segment`, `client.export_segment`.
- Hardened planner canonicalizer for draft-only client exports/segments: `client.export` and `clients.export` aliases now map to `client.export_segment`; `filterTag`/`filterTags` map to `tagName`; redundant tag `query` and invalid date filters are removed.
- Hardened client notification canonicalization: invalid regex-like id payloads such as `".*"` are removed, synthetic client reads run before `actions.prepare`, and SMS channel is normalized to `sms`.
- Hardened planner parser for malformed step shapes observed in real E2E: missing final conversation JSON brace, `"args{}"` typo, read tool names used as step `type`, and action names used as step `type`.
- Hardened conversation read fallback so explicit client read questions still call read tools when the conversation model answers in future tense or omits `readToolRequests`.
- Full real-E2E result after this batch: 30 scenarios, 30 passed, 0 failed, 344 not covered yet.

Checks:

```bash
npm run test:crm-agent-v2:canonicalizer
node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client.notify,client.create_segment,client.export_segment"
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client.search,client.view,client.view_loyalty,client.notify,client.create_segment,client.export_segment"
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client.delete_note"
npm run test:crm-agent-v2:real-e2e:local
```

Update 2026-05-30, batch 13.4 Planner canonicalizer hardening:

- Added `apps/web/lib/crm-agent-v2/core/plan-canonicalizer.ts` as the single planner-output canonicalization layer.
- Kept `normalizePlannerPlanForRuntime()` in `planner.ts` as a thin compatibility wrapper over `canonicalizeCrmAgentPlan()`.
- Added declarative action rules for client mutation/read drift: direct contact/note id actions, `client.update` aliases, scoped client read tools, and numeric id slot coercion.
- Added canonical validation findings for model execute steps, unknown tools/actions, draft action mismatch, unresolved required slots and string numeric ids.
- Added fast no-LLM canonicalizer regression tests in `scripts/crm-agent-v2-plan-canonicalizer-tests.mjs` and wired `test:crm-agent-v2:canonicalizer` into `package.json`.
- Added regression coverage for `appointment.create` when planner payload has time-only `startAt`, restoring the full ISO datetime from goal/message slots.
- Full real-E2E was rerun after GigaChat tokens were replenished: 27 scenarios, 27 passed, 0 failed, 347 not covered yet.

Checks:

```bash
npm run test:crm-agent-v2:canonicalizer
node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
npm run test:crm-agent-v2:real-e2e:local
```

Update 2026-05-30, batch 13.3 Clients continued:

- Added and verified real-dialog scenarios for `client.merge_duplicates`, `client.view_visits`, `client.view_payments`, `client.view_reviews`, `client.view_loyalty`, `client.update_consent`.
- Added fixture data for appointment visit history, payment intent, review, loyalty wallet/transaction, duplicate client and consent update coverage, plus cleanup for payment/review/loyalty/consent entities.
- Added registered read tools and handlers for client-scoped visits, payments, reviews and loyalty, backed by existing client read helpers.
- Hardened conversation read-tool selection so client-scoped review/visit/payment/loyalty questions use scoped tools instead of generic `clients.search`.
- Hardened planner normalization for draft-only and client mutation cases: numeric `*Id` payload slots are coerced to numbers, unneeded client context reads are removed for direct contact/note id actions, and `client.update_consent` is selected from consent wording.
- Runner now supports `CRM_AGENT_V2_REAL_E2E_FILTER`, filtered reports/diagnostics, draft-only mode, compact failure diagnostics and dynamic scenario messages.
- Full real-E2E result after this batch: 27 scenarios, 27 passed, 0 failed, 347 not covered yet.

Checks:

```bash
npm run typecheck
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client.merge_duplicates,client.view_visits,client.view_payments,client.view_reviews,client.view_loyalty,client.update_consent"
powershell -ExecutionPolicy Bypass -File .\scripts\run-crm-agent-v2-real-e2e-local.ps1 -Filter "client.delete_contact,client.view_reviews"
npm run test:crm-agent-v2:real-e2e:local
```

Update 2026-05-29, batch 13.3 Clients continued:

- Added and verified real-dialog scenarios for `client.archive`, `client.restore`, `client.add_contact`, `client.update_contact`, `client.delete_contact`, `client.add_note`.
- Added independent fixture data for archived client restore and contact update/delete scenarios, plus cleanup for client contacts, notes, tags and assignments.
- Fixed appointment continuation UX bug where internal `specialistId`/`locationId` slots leaked to the user and typed candidate names were not resolved back into pending selections.
- Hardened planner/runtime contracts for observed LLM shapes: object slots like `{ value/query }`, non-numeric `*Id` placeholders, unsupported read/execute tools, extra step closing brace repair, and transliterated client search queries.
- Added router guard for explicit CRM write requests that were incorrectly classified as smalltalk/unsupported.
- Full real-E2E result after this batch: 15 scenarios, 15 passed, 0 failed, 359 not covered yet.

Checks:

```bash
node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
node --check scripts/crm-agent-v2-real-agent-e2e-tests.mjs
powershell -ExecutionPolicy Bypass -File ./scripts/run-crm-agent-v2-real-e2e-local.ps1
```

Дата: 2026-05-29.

Пачка: расширение real-E2E покрытия услуг.

Сделано:

- добавлены real-dialog сценарии `service.search` и `service.update_price`;
- real-E2E runner теперь отключает `jiti` cache;
- planner parser/normalization принимает нестабильный step shape `prepare` / `actions.prepare`;
- `priceTotal` нормализуется в `basePrice` для `service.update_price`;
- query-object в `*Id` slots нормализуется в placeholder вроде `#SERVICE_ID#`;
- runtime last-chance recovery повторно разбирает структурированный planner raw перед conversation fallback;
- обновлен report: 5 scenarios, 5 passed, 0 failed.

Проверки:

```bash
npm run typecheck
npm run test:crm-agent-v2:real-e2e:local
```

Результат:

```text
Real dialog scenarios: 9
Passed: 9
Failed: 0
Not covered yet: 365
```

Update 2026-05-29, batch 13.3 Clients:

- Added real-dialog scenarios for `client.view`, `client.resolve`, `client.create`, `client.update`.
- Fixed planner/runtime normalization for client id slots that arrive as text queries: non-numeric `*Id` values now go through read/resolve placeholders instead of being sent to actions as literal ids.
- Added runtime placeholder support for slash references like `/clients/search/result/clientId`.
- Hardened planner JSON repair for an extra `}` before `steps` array close, which was observed in `appointment.create`.
- Adjusted read-only client scenario verification to accept the actual registered read tools (`clients.get` / `clients.search`) as verified behavior for catalog read actions.
- Updated report: 9 scenarios, 9 passed, 0 failed.

Checks:

```bash
node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
node -e "process.env.CRM_AGENT_V2_REAL_E2E='1'; process.env.CRM_AGENT_V2_REAL_ACCOUNT_ID='2'; import('./scripts/crm-agent-v2-real-agent-e2e-tests.mjs')"
```

Token/limit-saving runner mode added after this batch:

- During development, run only the scenarios being changed with `CRM_AGENT_V2_REAL_E2E_FILTER`.
- Filter accepts comma-separated scenario ids or action names, for example `client.archive,client.restore` or `client-view-real-dialog`.
- Filtered runs write `docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.filtered.md` and do not overwrite the full report.
- Failure details in markdown stay compact; full payload diagnostics are written only on failures to `docs/CRM_AGENT_V2_REAL_AGENT_E2E_DIAGNOSTICS.json` or `.filtered.json`.
- Full unfiltered real-E2E still must be run once before marking a batch complete in this plan.

Filtered example:

```bash
node -e "process.env.CRM_AGENT_V2_REAL_E2E='1'; process.env.CRM_AGENT_V2_REAL_ACCOUNT_ID='2'; process.env.CRM_AGENT_V2_REAL_E2E_FILTER='client.view'; import('./scripts/crm-agent-v2-real-agent-e2e-tests.mjs')"
powershell -ExecutionPolicy Bypass -File ./scripts/run-crm-agent-v2-real-e2e-local.ps1 -Filter client.view
```

Result:

```text
Real dialog scenarios: 9
Passed: 9
Failed: 0
Not covered yet: 365
```

## Следующая пачка для продолжения

Update 2026-05-30: client domain has enough coverage for the current execution baseline: happy-path catalog slice plus the first Codex-like hardening slice are green. Это не означает "любые фразы"; broad paraphrase/multi-turn/safety coverage stays a quality milestone, but it should now be expanded regression-driven or in a dedicated hardening batch, not block progress on other domains.

Рекомендуемая следующая пачка: перейти к домену `13.4 Записи` и сначала закрыть read-only appointment actions. Это усилит способность агента собирать контекст по записям перед lifecycle mutations.

Минимальная следующая пачка:

- добавить real-dialog scenarios для `appointment.search`, `appointment.view`, `appointment.resolve`, `appointment.find_slots`;
- добавить только нужные fixture data для детерминированных read results, особенно `ScheduleEntry` для поиска свободных окон;
- держать client hardening backlog активным: расширять `client.paraphrase_matrix`, `client.multiturn_matrix`, `client.negative_matrix`, `client.regression_no_llm` при новых client regressions или в отдельной quality-пачке.

Если новый агент предпочтет продолжить услуги, ближайшие actions:

- `service.view`
- `service.resolve`
- `service.update_duration`
- `service.activate`
- `service.archive`
- `service.restore`

## Открытые проблемы / наблюдения

- 2026-05-29 client/contact batch observation: planner may emit object-shaped payload slots (`{value}`, `{query}`, `{selectedId}`), non-numeric `*Id` strings, unsupported read tools, or execute steps. Runtime/planner now normalizes these to selected ids/scalars and strips execute steps; keep this invariant for future mutation batches.
- 2026-05-29 resolver observation: planner can transliterate Russian client names to Latin (`anna testova` for `Анна Тестовая`). Client resolver now includes Latin transliteration labels to avoid selecting unrelated rows through weak email/domain token matches.
- 2026-05-29 appointment continuation bug fixed in code: active task continuation now normalizes internal `clientId`/`serviceId`/`specialistId`/`locationId`/`startAt` slots to UI slots (`client`, `service`, `specialist`, `location`, `time`) and can resolve a typed candidate name like a specialist name against real candidates. Add a dedicated multi-turn real-E2E scenario for this before expanding appointment coverage further.
- 2026-05-29 appointment continuation hotfix verified with targeted checks: `tsc --noEmit`, `node --check scripts/crm-agent-v2-real-agent-e2e-tests.mjs`, and filtered `appointment.create` real-E2E passed 1/1. Full real-E2E was intentionally not rerun to preserve LLM/test limits after the targeted hotfix.
- 2026-05-29 client batch observation: planner may emit non-numeric text in `clientId`/`*Id` slots; keep routing those through read/resolve placeholders before `actions.prepare`.
- 2026-05-29 parser observation: planner can append explanatory text after JSON or add one extra `}` before a steps array close; tolerant parser repair is required, but runtime phrase regex recovery remains forbidden.
- LLM planner часто возвращает почти правильный JSON, но с нестабильным shape. Нужна tolerant normalization вокруг registry contract.
- Нельзя возвращать runtime keyword/regex recovery по пользовательским фразам. Исправлять нужно router/conversation/planner/parser/resolver/runtime contracts.
- Основной риск следующих пачек: `*Id` slots, которые приходят как query object и должны проходить через read/resolve step + placeholder.
- Для новых доменов почти наверняка понадобится расширять fixture и cleanup.
- Для password/security actions обязательно проверять отдельные правила безопасности, а не просто successful execution.

## Полный чеклист раздела 13

Этот чеклист обновляется после каждой пачки real-E2E правок и после каждого успешного/падающего запуска `npm run test:crm-agent-v2:real-e2e:local`.

Правило обновления:

- после добавления сценария заменить `not_covered_yet` на фактический статус из report;
- после исправления падения указать `passed` или соответствующий verified outcome;
- в колонке `Notes` оставить короткую ссылку на scenario id, bug class или fixture requirement;
- не считать action закрытым, пока он не имеет verified outcome и `Failed = 0` после полного прогона;
- если меняется catalog status/action policy, синхронизировать expected outcome в этом чеклисте и `writeReport()`.

Легенда: `[x]` - закрыто verified статусом, `[ ]` - еще требует сценарий или исправление.

### 13.1 Аккаунт

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `account.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_name` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_slug` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_status` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_business_type` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_profile` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_contacts` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_address` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_branding` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_logo` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_colors` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_public_description` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_booking_rules` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_cancellation_rules` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_reschedule_rules` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_deposit_rules` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.update_review_rules` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `account.view_audit` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `account.export_data` | implemented | not_covered_yet | add real-dialog scenario |

### 13.2 Пользователи, роли, пароль

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `user.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `user.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `user.invite` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.update_profile` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.update_email` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.update_phone` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.change_role` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.activate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.deactivate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.reset_password` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.change_own_password` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.revoke_sessions` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.link_identity` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `user.unlink_identity` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `role.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `role.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `role.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `role.delete` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `permission.assign` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `permission.revoke` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `permission.view_matrix` | read_only | not_covered_yet | add real-dialog scenario |

### 13.3 Клиенты

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [x] | `client.search` | read_only | passed | passed: client-search-real-dialog |
| [x] | `client.view` | read_only | passed | passed: client-view-real-dialog |
| [x] | `client.resolve` | read_only | passed | passed: client-resolve-real-dialog |
| [x] | `client.create` | implemented | passed | passed: client-create-real-dialog |
| [x] | `client.update` | implemented | passed | passed: client-update-real-dialog |
| [x] | `client.archive` | implemented | passed | passed: client-archive-real-dialog |
| [x] | `client.restore` | implemented | passed | passed: client-restore-real-dialog |
| [x] | `client.add_contact` | implemented | passed | passed: client-add-contact-real-dialog |
| [x] | `client.update_contact` | implemented | passed | passed: client-update-contact-real-dialog |
| [x] | `client.delete_contact` | implemented | passed | passed: client-delete-contact-real-dialog |
| [x] | `client.add_note` | implemented | passed | passed: client-add-note-real-dialog |
| [x] | `client.update_note` | implemented | passed | passed: client-update-note-real-dialog |
| [x] | `client.delete_note` | implemented | passed | passed: client-delete-note-real-dialog |
| [x] | `client.add_tag` | implemented | passed | passed: client-add-tag-real-dialog |
| [x] | `client.remove_tag` | implemented | passed | passed: client-remove-tag-real-dialog |
| [x] | `client.create_tag` | implemented | passed | passed: client-create-tag-real-dialog |
| [x] | `client.merge_duplicates` | draft_only | passed | passed: client-merge-duplicates-real-dialog |
| [x] | `client.view_history` | read_only | passed | passed: client-view-history-real-dialog |
| [x] | `client.view_visits` | read_only | passed | passed: client-view-visits-real-dialog |
| [x] | `client.view_payments` | read_only | passed | passed: client-view-payments-real-dialog |
| [x] | `client.view_reviews` | read_only | passed | passed: client-view-reviews-real-dialog |
| [x] | `client.view_loyalty` | read_only | passed | passed: client-view-loyalty-real-dialog |
| [x] | `client.update_consent` | implemented | passed | passed: client-update-consent-real-dialog |
| [x] | `client.notify` | draft_only | passed | passed: client-notify-real-dialog |
| [x] | `client.create_segment` | draft_only | passed | passed: client-create-segment-real-dialog |
| [x] | `client.export_segment` | draft_only | passed | passed: client-export-segment-real-dialog |

### 13.4 Записи

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `appointment.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.resolve` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.find_slots` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.hold_slot` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.release_hold` | implemented | not_covered_yet | add real-dialog scenario |
| [x] | `appointment.create` | implemented | passed | passed: appointment-create-real-dialog |
| [ ] | `appointment.reschedule` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.cancel` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.confirm` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.mark_done` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.mark_no_show` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.change_client` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.change_service` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.change_specialist` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.change_location` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.change_time` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.change_price` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.change_duration` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.add_comment` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.update_comment` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.view_conflicts` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `appointment.view_history` | read_only | not_covered_yet | add real-dialog scenario |

### 13.5 Групповые записи

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `group_session.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.cancel` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.change_capacity` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.change_price` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.add_participant` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.remove_participant` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.update_participant_status` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.mark_participant_done` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `group_session.mark_participant_no_show` | implemented | not_covered_yet | add real-dialog scenario |

### 13.6 График

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `schedule.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.view_day` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.view_week` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.view_month` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.set_workday` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.set_day_off` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.set_vacation` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.add_break` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.update_break` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.remove_break` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.block_slot` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.unblock_slot` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.copy_day` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.copy_week` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.create_template` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.update_template` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.delete_template` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.apply_template` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.create_non_working_type` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.update_non_working_type` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.delete_non_working_type` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.find_empty_windows` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `schedule.find_overlaps` | read_only | not_covered_yet | add real-dialog scenario |

### 13.7 Услуги

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [x] | `service.search` | read_only | passed | passed: service-search-real-dialog |
| [ ] | `service.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `service.resolve` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `service.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.update_name` | implemented | not_covered_yet | add real-dialog scenario |
| [x] | `service.update_description` | implemented | passed | passed: service-update-description-real-dialog |
| [ ] | `service.generate_description` | draft_only | not_covered_yet | add real-dialog scenario |
| [x] | `service.update_price` | implemented | passed | passed: service-update-price-real-dialog |
| [ ] | `service.update_duration` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.update_booking_type` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.activate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.archive` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.restore` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.delete_if_empty` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.assign_specialist` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.unassign_specialist` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.assign_location` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.unassign_location` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.add_variant` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.update_variant` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.delete_variant` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.create_category` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.update_category` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.delete_category` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.move_to_category` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.update_level_config` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.attach_media` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `service.detach_media` | implemented | not_covered_yet | add real-dialog scenario |

### 13.8 Сотрудники

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `specialist.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.resolve` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.update_bio` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.generate_bio` | draft_only | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.update_avatar` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.set_public` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.hide` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.assign_service` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.unassign_service` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.assign_location` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.unassign_location` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.assign_category` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.remove_category` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.set_level` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.view_workload` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.view_revenue` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.view_reviews` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `specialist.view_empty_slots` | read_only | not_covered_yet | add real-dialog scenario |

### 13.9 Локации

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `location.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `location.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `location.resolve` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `location.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.update_name` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.update_address` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.update_phone` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.update_description` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.generate_description` | draft_only | not_covered_yet | add real-dialog scenario |
| [ ] | `location.activate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.deactivate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.update_hours` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.add_exception` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.remove_exception` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.assign_manager` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.remove_manager` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.attach_media` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.detach_media` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `location.view_schedule` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `location.view_workload` | read_only | not_covered_yet | add real-dialog scenario |

### 13.10 Отзывы

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `review.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `review.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `review.resolve` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `review.find_negative` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `review.find_unanswered` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `review.reply` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `review.generate_reply` | draft_only | not_covered_yet | add real-dialog scenario |
| [ ] | `review.update_reply` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `review.delete_reply` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `review.change_status` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `review.bulk_update_status` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `review.attach_reply_media` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `review.remove_reply_media` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `review.analyze_complaints` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `review.suggest_process_fix` | draft_only | not_covered_yet | add real-dialog scenario |

### 13.11 Сайт и SEO

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `site.health` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `site.view_public_page` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `site.create_public_page` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_public_page` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.archive_public_page` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.create_section` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_section` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.delete_section` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.create_block` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_block` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.delete_block` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_home_copy` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_service_copy` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_specialist_copy` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_location_copy` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_contacts` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_booking_settings` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_seo_global` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.update_seo_page` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `site.generate_missing_descriptions` | draft_only | not_covered_yet | add real-dialog scenario |
| [ ] | `site.preview_changes` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `site.apply_changes` | implemented | not_covered_yet | add real-dialog scenario |

### 13.12 Домены

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `domain.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `domain.add` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `domain.check` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `domain.set_primary` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `domain.remove` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `domain.view_dns_status` | read_only | not_covered_yet | add real-dialog scenario |

### 13.13 Медиа

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `media.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `media.upload` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.update_alt` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.update_metadata` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.create_collection` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.update_collection` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.delete_collection` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.link_to_account` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.link_to_service` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.link_to_specialist` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.link_to_location` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.unlink` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `media.archive` | implemented | not_covered_yet | add real-dialog scenario |

### 13.14 Акции и промокоды

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `promo.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.resolve` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.activate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.deactivate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.archive` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.restore` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.create_code` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.update_code` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.disable_code` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.view_redemptions` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.suggest_for_retention` | draft_only | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.suggest_for_empty_slots` | draft_only | not_covered_yet | add real-dialog scenario |
| [ ] | `promo.suggest_for_birthday` | draft_only | not_covered_yet | add real-dialog scenario |

### 13.15 Лояльность, подарочные карты, абонементы

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `loyalty.view_wallet` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `loyalty.adjust_balance` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `loyalty.create_rule` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `loyalty.update_rule` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `loyalty.disable_rule` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `loyalty.view_transactions` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `gift_card.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `gift_card.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `gift_card.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `gift_card.activate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `gift_card.cancel` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `membership.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `membership.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `membership.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `membership.activate` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `membership.cancel` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `membership.redeem` | implemented | not_covered_yet | add real-dialog scenario |

### 13.16 Финансы

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `finance.view_revenue` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.view_payments` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.view_refunds` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.view_receipts` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.find_unpaid` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.view_client_balance` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.revenue_by_service` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.revenue_by_specialist` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.revenue_by_location` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `finance.reconcile_appointment` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `payment_intent.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `payment_intent.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `payment_intent.cancel` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `refund.create` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `receipt.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `receipt.resend` | implemented | not_covered_yet | add real-dialog scenario |

### 13.17 Уведомления

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `notification.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.send_client` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.send_segment` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.create_template` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.update_template` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.delete_template` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.update_preferences` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.preview` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `notification.retry_failed` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `outbox.search` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `outbox.retry` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `delivery.view_status` | read_only | not_covered_yet | add real-dialog scenario |

### 13.18 Маркетинг

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `campaign.create_retention` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.create_reactivation` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.create_repeat_visit` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.create_empty_slots` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.create_birthday` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.create_seasonal` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.preview_audience` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.update_audience` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.update_offer` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.update_message` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.schedule` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.send` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.pause` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.cancel` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.view_results` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `campaign.analyze_conversions` | read_only | not_covered_yet | add real-dialog scenario |

### 13.19 Аналитика

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `analytics.attention_review` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.daily_brief` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.weekly_brief` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.workload` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.revenue` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.retention` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.no_show_rate` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.cancellations` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.empty_windows` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.underloaded_specialists` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.declining_services` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.top_services` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.top_clients` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.review_themes` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.campaign_conversion` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.forecast` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `analytics.find_growth_opportunities` | read_only | not_covered_yet | add real-dialog scenario |

### 13.20 Юридические документы

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `legal.view_documents` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `legal.create_document` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `legal.update_document` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `legal.publish_version` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `legal.archive_document` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `legal.view_acceptances` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `legal.check_missing_acceptances` | read_only | not_covered_yet | add real-dialog scenario |

### 13.21 Интеграции и webhooks

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `webhook.create_endpoint` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `webhook.update_endpoint` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `webhook.disable_endpoint` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `webhook.delete_endpoint` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `webhook.view_events` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `webhook.retry_delivery` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `integration.delivery_status` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `integration.unsubscribe` | implemented | not_covered_yet | add real-dialog scenario |

### 13.22 Настройки агента

| Done | Action | Catalog status | Real-E2E status | Notes |
| --- | --- | --- | --- | --- |
| [ ] | `agent.memory.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.memory.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.memory.delete` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.policy.view` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.policy.update` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.autopilot.enable` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.autopilot.disable` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.autopilot.set_level` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.view_runs` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.view_trace` | read_only | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.cancel_task` | implemented | not_covered_yet | add real-dialog scenario |
| [ ] | `agent.resume_task` | implemented | not_covered_yet | add real-dialog scenario |


## Следующий этап

Теперь покрытие расширяется пачками по доменам, пока весь раздел 13 не будет иметь verified status. После каждой пачки запускать:

```bash
npm run test:crm-agent-v2:real-e2e:local
```

Рекомендуемый порядок полного покрытия:

1. Записи: все `appointment.*`, начиная с `appointment.search/view/resolve/find_slots`, затем lifecycle mutations.
2. Клиенты: baseline + first Codex-like hardening slice done; продолжать hardening (`client.paraphrase_matrix`, `client.multiturn_matrix`, `client.negative_matrix`, `client.regression_no_llm`) отдельной quality-пачкой или по регрессиям.
3. Услуги: все `service.*`, продолжить с `service.view`, `service.resolve`, `service.update_duration`, lifecycle и bindings.
4. Сотрудники: все `specialist.*`, включая bindings, visibility, workload/revenue/reviews/empty slots.
5. Локации: все `location.*`, включая hours/exceptions/media/schedule/workload.
6. График: все `schedule.*`, включая templates, non-working types, empty windows и overlaps.
7. Групповые записи: все `group_session.*`.
8. Отзывы: все `review.*`.
9. Account/users/roles/permissions: все `account.*`, `user.*`, `role.*`, `permission.*`, с отдельными security assertions для password/reset/session actions.
10. Site/domains/media: все `site.*`, `domain.*`, `media.*`.
11. Promo/loyalty/finance: все `promo.*`, `loyalty.*`, `gift_card.*`, `membership.*`, `finance.*`, `payment_intent.*`, `refund.*`, `receipt.*`.
12. Notifications/marketing/analytics: все `notification.*`, `outbox.*`, `delivery.*`, `campaign.*`, `analytics.*`.
13. Legal/integrations/agent settings: все `legal.*`, `webhook.*`, `integration.*`, `agent.*`.

Для каждой пачки:

- добавить минимальные fixture entities и cleanup;
- добавить 3-10 сценариев, не больше, если домен впервые вскрывает новый class проблем;
- прогнать real-E2E;
- исправить общие contract/runtime проблемы до `Failed = 0`;
- обновить report и этот plan;
- только после этого переходить к следующей пачке.

## Как добавлять новый сценарий

Добавить объект в `scenarios`:

```js
{
  id: "service-update-price-real-dialog",
  action: "service.update_price",
  mode: "conversation_execute",
  message: "Поменяй цену услуги Маникюр на 3000 рублей.",
  verify: async ({ fixture }) => {
    const service = await prisma.service.findUnique({ where: { id: fixture.service.id } });
    if (String(service?.basePrice) !== "3000") {
      throw new Error(`Service price was not updated. Got: ${service?.basePrice ?? "null"}`);
    }
  },
}
```

Правила:

- каждый scenario проверяет не только ответ агента, но и БД;
- для mutating actions использовать `mode: "conversation_execute"`;
- для read-only actions использовать `mode: "conversation"` и проверять tool call / cards / workspace / answer data;
- для `draft_only` ожидать draft/preview, но не `EXECUTED`;
- новые fixture entities добавлять в `createFixture()` и cleanup.

## Fixture requirements

Текущий минимальный fixture:

- account;
- AI access + AI balance;
- client `Анна Тестовая`;
- location `Главный филиал`;
- service `Маникюр`;
- service `Мужская стрижка`;
- specialist user/profile `Мария Мастер`;
- service-location bindings;
- specialist-location bindings;
- specialist-service bindings.

По мере расширения нужны дополнительные fixture данные:

- роли и permissions для `user.*`, `role.*`, `permission.*`;
- appointment с историей для update/status/history actions;
- group session для `group_session.*`;
- schedule entries / breaks / vacations / blocked slots;
- service category, variant, level config;
- media asset и media link;
- review;
- promo и promo code;
- loyalty wallet, gift card, membership;
- payment/refund/receipt fixtures;
- notification template/outbox/delivery;
- campaign + recipients;
- legal document/version/acceptance;
- webhook endpoint/delivery;
- crm agent memory/policy/task.

## Критерий готовности

Минимальный этап:

```text
Passed >= 3
Failed = 0
Not covered yet <= 371
```

Статус: выполнено.

Финальная цель:

```text
Section 13 actions = 374
Failed = 0
Not covered yet = 0
```

Финальная цель считается выполненной, когда каждое действие раздела 13 имеет один из verified outcomes:

- `passed`
- `read_only_verified`
- `draft_only_verified`
- `blocked_verified`
- `unsupported_verified`

Для некоторых действий допустим отдельный verified-статус, если action по каталогу не должна исполняться:

- `draft_only_verified`
- `read_only_verified`
- `blocked_verified`
- `unsupported_verified`

Если добавлять такие статусы, нужно обновить summary и правила в `writeReport()`.
