# CRM Agent v2: продуктовый план реализации полного каталога действий

Дата создания: 2026-05-28
Статус документа: `in_progress`
Назначение: единый план для реализации полного каталога действий CRM Agent v2. Любой агент должен уметь открыть этот файл, понять текущий статус, архитектуру, порядок работ и продолжить с первого незавершенного шага.

## 1. Цель

Сделать CRM Agent v2 полноценным рабочим агентом управления CRM, где каждое действие из полного каталога описано как отдельный продуктовый action с понятными правилами:

- что действие означает для пользователя;
- какие данные нужны;
- какие права нужны;
- какой риск у действия;
- нужен ли preview;
- нужно ли подтверждение;
- где лежит код;
- как строится read/preview/execute;
- какие тесты должны покрывать действие.

Это не MVP и не список намерений. Это план доведения каталога до production-ready состояния.

## 2. Текущий статус

На 2026-05-28 полный каталог не реализован.

Сейчас есть частичная реализация в старой структуре:

- `apps/web/lib/crm-agent-v2/core/actions.ts` - небольшой registry действий.
- `apps/web/lib/crm-agent-v2/core/tools.ts` - общий registry read/draft/execute tools.
- `apps/web/lib/crm-agent-v2/core/draft-tools.ts` - общий preview/prepare для pending actions.
- `apps/web/lib/crm-agent-v2/core/execute-tools.ts` - общий execute для части действий.
- `apps/web/lib/crm-agent-v2/core/runtime.ts` - runtime planner/inspector/execution loop.
- `apps/web/lib/crm-agent-v2/core/inspector.ts` - проверка plan steps, permissions, required slots.
- `apps/web/lib/crm-agent-v2/core/read-tools.ts` - часть read tools.

Частично реализованные действия:

- `appointment.create`
- `appointment.cancel`
- `client.create`
- `client.update`
- `service.create`
- `service.update`
- `service.archive`
- `specialist.create`
- `location.create`
- `location.update`
- `review.reply`
- `site.service.copy.update`
- `memory.update`
- `autopilot.setting.update`

Проблема текущей структуры: action definition, preview, execute и доменные проверки разбросаны по разным файлам. Для полного каталога это станет трудно поддерживать.

## 3. Целевая архитектура

### 3.1 Главный принцип

Один action = один файл.

Каждый action должен быть самостоятельной единицей поведения и безопасности. В одном файле должны лежать definition, slots, preview, execute, локальные проверки и описание для planner.

Пример:

```text
apps/web/lib/crm-agent-v2/actions/specialists/specialist.create.ts
```

Файл должен экспортировать объект:

```ts
export const specialistCreateAction = defineCrmAgentAction({
  name: "specialist.create",
  domain: "specialists",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.create",
  confirmation: "medium_plus",
  requiredSlots: ["name"],
  optionalSlots: ["firstName", "lastName", "phone", "email", "bio", "levelId", "categoryIds", "isPublic"],
  description: "...",
  plannerHints: ["..."],
  resolve,
  preview,
  execute,
});
```

### 3.2 Новая структура файлов

Создать новую структуру:

```text
apps/web/lib/crm-agent-v2/actions/
  index.ts
  registry.ts
  types.ts
  define-action.ts
  action-errors.ts
  action-permissions.ts
  action-preview.ts
  action-audit.ts
  action-status.ts

  account/
    account.view.ts
    account.update-name.ts
    ...
    index.ts

  users/
    user.search.ts
    user.view.ts
    user.invite.ts
    ...
    role.search.ts
    permission.assign.ts
    index.ts

  clients/
    client.search.ts
    client.view.ts
    ...
    index.ts

  appointments/
    appointment.search.ts
    appointment.view.ts
    ...
    index.ts

  group-sessions/
    group-session.search.ts
    ...
    index.ts

  schedule/
    schedule.search.ts
    ...
    index.ts

  services/
    service.search.ts
    ...
    index.ts

  specialists/
    specialist.search.ts
    ...
    index.ts

  locations/
    location.search.ts
    ...
    index.ts

  reviews/
    review.search.ts
    ...
    index.ts

  site/
    site.health.ts
    ...
    index.ts

  domains/
  media/
  promos/
  loyalty/
  finance/
  notifications/
  marketing/
  analytics/
  legal/
  integrations/
  agent-settings/
```

### 3.3 Naming

В каталоге использовать имена из продуктового списка без переименования:

- `account.update_name`
- `specialist.assign_service`
- `appointment.find_slots`

В TypeScript-файлах дефисы допустимы для имени файла:

- `account.update-name.ts`
- `specialist.assign-service.ts`
- `appointment.find-slots.ts`

Но `name` внутри action должен совпадать с продуктовым каталогом:

```ts
name: "specialist.assign_service"
```

### 3.4 Типы action

В `actions/types.ts` определить:

```ts
export type CrmAgentActionStatus =
  | "implemented"
  | "draft_only"
  | "read_only"
  | "planned"
  | "blocked"
  | "unsupported";

export type CrmAgentActionKind = "read" | "write" | "generate" | "export" | "system";

export type CrmAgentActionRisk = "low" | "medium" | "high" | "critical";

export type CrmAgentConfirmationPolicy =
  | "never"
  | "medium_plus"
  | "always"
  | "separate_sensitive_confirm";
```

Каждое действие должно иметь:

- `name`
- `domain`
- `kind`
- `intent`
- `status`
- `risk`
- `permission`
- `requiredSlots`
- `optionalSlots`
- `description`
- `plannerHints`
- `preview`
- `execute`
- `read` или `resolve`, если действие read-only.

### 3.5 Контракт action handler

```ts
type CrmAgentActionContext = {
  accountId: number;
  userId: number | null;
  permissions: string[];
  sessionId: number | null;
  now: Date;
  timezone: string;
};

type CrmAgentActionPreview = {
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  diff: Array<{ field: string; before: unknown; after: unknown }>;
  warnings: string[];
};

type CrmAgentActionResult = {
  status: "DONE" | "NEEDS_USER" | "FAILED";
  data: Record<string, unknown>;
  message?: string;
};
```

### 3.6 Registry

`actions/registry.ts` должен собирать все action-файлы:

```ts
export const crmAgentActionCatalog = [
  accountViewAction,
  accountUpdateNameAction,
  specialistCreateAction,
  ...
];
```

Нельзя вручную дублировать action names в нескольких местах. Все derived maps строить из `crmAgentActionCatalog`:

- `actionsByName`
- `actionsByDomain`
- `implementedActions`
- `plannerVisibleActions`
- `readActions`
- `writeActions`

### 3.7 Интеграция с текущим runtime

Текущие файлы постепенно перевести на новый registry:

- `core/actions.ts` должен стать thin compatibility layer или быть удален после миграции.
- `core/draft-tools.ts` должен вызывать `action.preview`.
- `core/execute-tools.ts` должен вызывать `action.execute`.
- `core/inspector.ts` должен проверять action definition из нового catalog.
- `core/planner.ts` должен видеть только действия со статусом `implemented`, `draft_only`, `read_only`.
- `core/runtime.ts` не должен содержать special-case бизнес-логику отдельных действий, кроме временных migration guards с TODO.

### 3.8 Preview и confirmation

Все write/system/export actions должны проходить через pending action:

1. Planner выбирает action.
2. Runtime валидирует slots.
3. Runtime создает pending action.
4. Preview показывает before/after/diff/warnings.
5. Пользователь подтверждает.
6. Execute применяет изменение.
7. Audit фиксирует результат.

Read-only actions не требуют confirmation.

Generate actions создают черновик и требуют подтверждения, если результат будет опубликован или записан в CRM.

### 3.9 Audit

Каждый execute должен писать audit:

- `accountId`
- `userId`
- `sessionId`
- `actionName`
- `targetType`
- `targetId`
- `before`
- `after`
- `diff`
- `risk`
- `permission`
- `confirmedAt`
- `executedAt`

Использовать существующий `logAccountAudit` или расширить его, если не хватает полей.

### 3.10 Ошибки

Создать typed errors:

- `CrmAgentValidationError`
- `CrmAgentPermissionError`
- `CrmAgentConflictError`
- `CrmAgentNotFoundError`
- `CrmAgentPolicyError`
- `CrmAgentExecutionError`

Пользователь не должен видеть raw Prisma/SQL errors.

### 3.11 Тесты

На каждый implemented action:

- unit test для slot validation;
- unit test для preview;
- unit/integration test для execute;
- permission test;
- account isolation test;
- audit test;
- planner visibility test.

Добавить общий test:

```text
scripts/crm-agent-v2-action-catalog-tests.mjs
```

Он должен проверять:

- каждый action из документа есть в catalog;
- у каждого action есть status;
- implemented actions имеют handler;
- write actions имеют preview или явно documented exception;
- high/critical actions требуют confirmation;
- password/payment/legal/export actions имеют special policy.

## 4. Протокол работы по плану

После каждого шага агент обязан обновить раздел 5 "Журнал выполнения".

Формат записи:

```text
YYYY-MM-DD HH:mm - step N - status
Что сделано:
- ...
Измененные файлы:
- ...
Проверка:
- ...
Следующее:
- ...
Блокеры:
- нет / описание
```

Статусы:

- `pending` - не начато.
- `in_progress` - начато, не завершено.
- `completed` - завершено и проверено.
- `blocked` - невозможно продолжить без решения.

Перед началом работы другой агент должен:

1. Прочитать этот файл.
2. Найти последнюю запись в журнале.
3. Проверить `git status --short`.
4. Проверить текущие файлы каталога.
5. Продолжить с первого шага со статусом не `completed`.

## 5. Журнал выполнения

2026-05-28 00:00 - step 0 - completed
Что сделано:
- Создан план реализации полного каталога действий.
- Зафиксирована целевая архитектура one action = one file.
- Зафиксирован полный каталог и порядок реализации.
Измененные файлы:
- CRM_AGENT_V2_FULL_ACTION_CATALOG_PLAN.md
Проверка:
- Документ создан.
Следующее:
- step 1: создать новую инфраструктуру `apps/web/lib/crm-agent-v2/actions/**`.
Блокеры:
- нет

## 6. Порядок реализации

### Step 1. Создать инфраструктуру actions catalog

Статус: `pending`

Что сделать:

- Создать `apps/web/lib/crm-agent-v2/actions/types.ts`.
- Создать `define-action.ts`.
- Создать `registry.ts`.
- Создать `index.ts`.
- Создать `action-errors.ts`.
- Создать `action-preview.ts`.
- Создать `action-audit.ts`.
- Добавить базовые типы для definition, preview, execute, read, resolve.
- Добавить helper `assertActionPermission`.
- Добавить helper `requireSlots`.
- Добавить helper `inputJson`.
- Добавить helper `buildFlatDiff`.

Критерии готовности:

- `npm run typecheck` проходит.
- Новый registry может экспортировать пустой список без ломки текущего runtime.

### Step 2. Создать полный skeleton каталога

Статус: `pending`

Что сделать:

- Создать папки доменов из раздела 3.2.
- На каждое действие из полного каталога создать отдельный файл.
- В каждом файле временно поставить `status: "planned"` или `status: "unsupported"`.
- Для already implemented действий поставить временно `status: "implemented_legacy"` нельзя. Нужно использовать только статус из типов; для миграции использовать `status: "planned"` и поле `legacyImplemented: true` не вводить. Лучше сразу мигрировать доменами.
- Создать `index.ts` в каждой папке.
- `actions/registry.ts` должен импортировать все actions.

Критерии готовности:

- Все action names из этого документа есть в `crmAgentActionCatalog`.
- Добавлен test, который сравнивает список action names.

### Step 3. Подключить новый catalog к planner как read-only source

Статус: `pending`

Что сделать:

- В `core/planner.ts` заменить источник списка действий на новый catalog.
- Planner должен получать:
  - action name;
  - domain;
  - kind;
  - status;
  - requiredSlots;
  - optionalSlots;
  - risk;
  - permission;
  - description;
  - plannerHints.
- Planner не должен планировать `unsupported`.
- Planner может объяснить пользователю, что действие пока не поддержано, если оно есть в catalog со статусом `planned`.

Критерии готовности:

- `npm run test:crm-agent-v2` проходит.
- Unsupported/planned action не приводит к пустому workspace.

### Step 4. Подключить inspector к новому catalog

Статус: `pending`

Что сделать:

- `core/inspector.ts` должен брать action definition из `actions/registry.ts`.
- Проверять slots по `requiredSlots`.
- Проверять permission.
- Проверять status:
  - `implemented` можно выполнять;
  - `draft_only` можно готовить preview, но нельзя execute;
  - `read_only` нельзя использовать как write;
  - `planned`, `blocked`, `unsupported` должны возвращать понятную ошибку.
- Проверять confirmation policy.

Критерии готовности:

- Unit tests inspector покрывают все статусы.

### Step 5. Подключить draft-tools к action.preview

Статус: `pending`

Что сделать:

- `actions.prepare` должен создавать pending action только через action definition.
- `actions.preview` должен вызывать `action.preview`.
- Убрать action-specific preview logic из `core/draft-tools.ts`.
- Если action не имеет preview, а является write/system/export, вернуть typed error.

Критерии готовности:

- Старые сценарии `client.create`, `specialist.create`, `service.update` продолжают показывать preview.

### Step 6. Подключить execute-tools к action.execute

Статус: `pending`

Что сделать:

- `actions.confirm` должен после confirmation вызывать `action.execute`.
- Убрать action-specific mutation logic из `core/execute-tools.ts`.
- Execute должен возвращать typed result.
- Ошибки должны быть typed.

Критерии готовности:

- Старые implemented actions работают через новый action handler.

### Step 7. Мигрировать текущие implemented actions

Статус: `pending`

Порядок:

1. `specialist.create`
2. `client.create`
3. `client.update`
4. `appointment.create`
5. `appointment.cancel`
6. `service.create`
7. `service.update`
8. `service.archive`
9. `location.create`
10. `location.update`
11. `review.reply`
12. `site.service.copy.update` -> переименовать/смэппить в `site.update_service_copy`
13. `memory.update` -> `agent.memory.update`
14. `autopilot.setting.update` -> `agent.policy.update` или `agent.autopilot.set_level` по смыслу

Для каждого:

- Создать файл action.
- Перенести validation.
- Перенести preview.
- Перенести execute.
- Перенести audit.
- Добавить тесты.
- Удалить старую ветку из common files.

### Step 8. Реализовать read-only actions

Статус: `pending`

Реализовать read/search/view/resolve действия по доменам. Они не создают pending action, но должны логировать tool/action trace.

Приоритет:

1. `account.view`
2. `user.search`, `user.view`
3. `client.search`, `client.view`, `client.resolve`
4. `appointment.search`, `appointment.view`, `appointment.resolve`, `appointment.find_slots`, `appointment.view_conflicts`, `appointment.view_history`
5. `service.search`, `service.view`, `service.resolve`
6. `specialist.search`, `specialist.view`, `specialist.resolve`
7. `location.search`, `location.view`, `location.resolve`
8. `review.search`, `review.view`, `review.resolve`, `review.find_negative`, `review.find_unanswered`
9. `analytics.*`
10. `finance.view_*`

### Step 9. Реализовать write actions по доменам

Статус: `pending`

Порядок:

1. Сотрудники.
2. Услуги.
3. Локации.
4. Клиенты.
5. Записи.
6. График.
7. Отзывы.
8. Акции.
9. Уведомления.
10. Сайт/SEO.
11. Финансы.
12. Лояльность.
13. Пользователи/роли.
14. Юридические документы.
15. Интеграции.
16. Настройки агента.

### Step 10. Удалить legacy registry

Статус: `pending`

Что сделать:

- Удалить или превратить в re-export:
  - `core/actions.ts`
  - action-specific logic в `draft-tools.ts`
  - action-specific logic в `execute-tools.ts`
- Runtime должен использовать только новый catalog.

### Step 11. Production hardening

Статус: `pending`

Что сделать:

- Account isolation tests для всех implemented actions.
- Permission matrix tests.
- Confirmation policy tests.
- Audit completeness tests.
- Idempotency для опасных действий.
- Concurrency/conflict handling для appointment/schedule/payment.
- Rate limits для notification/campaign/webhook actions.

## 7. Глобальные политики безопасности

### 7.1 Read actions

Read actions:

- risk `low`, кроме export/audit/security-sensitive views;
- confirmation `never`;
- должны проверять permission;
- должны быть account-scoped;
- не должны возвращать чужие account/user/entity данные.

### 7.2 Write actions

Write actions:

- всегда требуют permission;
- всегда создают preview;
- medium/high/critical требуют confirmation;
- должны писать audit.

### 7.3 Password/security actions

Особые правила:

- Пароль нельзя менять молча.
- `user.change_own_password` доступен только текущему пользователю.
- `user.reset_password` не задает пароль напрямую; он создает reset-flow или отправляет reset-инструкцию.
- `user.revoke_sessions` требует отдельного подтверждения.
- `permission.assign`, `permission.revoke`, `role.delete` - high/critical.

### 7.4 Payments/refunds/finance

Особые правила:

- `refund.create` всегда high/critical.
- `payment_intent.create` требует preview суммы, клиента, назначения платежа.
- `finance.reconcile_appointment` требует before/after и audit.

### 7.5 Export/legal/data privacy

Особые правила:

- `account.export_data`, `client.export_segment`, legal export-like actions - high.
- Нужно логировать кто экспортировал и что.
- Для персональных данных нужен explicit confirmation.

### 7.6 Marketing/notifications

Особые правила:

- Проверять consent/preferences.
- Массовые отправки требуют audience preview.
- `campaign.send`, `notification.send_segment` - high.
- Нельзя отправлять без preview текста и аудитории.

## 8. Полный каталог действий: значение и реализация

Ниже перечислен весь каталог. Для каждого действия указаны смысл, где реализовать и базовая политика.

Легенда:

- Kind: `read`, `write`, `generate`, `export`, `system`.
- Risk: `low`, `medium`, `high`, `critical`.
- Confirm: `never`, `medium_plus`, `always`, `separate_sensitive_confirm`.
- File: целевой файл action.

### 8.1 Аккаунт

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| account.view | Показать профиль аккаунта, настройки и основные реквизиты. | read | low | never | crm.settings.read | actions/account/account.view.ts |
| account.update_name | Изменить публичное/внутреннее название аккаунта. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-name.ts |
| account.update_slug | Изменить slug аккаунта/публичного URL, проверить уникальность. | write | high | always | crm.settings.update | actions/account/account.update-slug.ts |
| account.update_status | Активировать/приостановить аккаунт. | system | critical | separate_sensitive_confirm | platform.accounts.update | actions/account/account.update-status.ts |
| account.update_business_type | Изменить тип бизнеса для настроек и шаблонов. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-business-type.ts |
| account.update_profile | Изменить общий профиль организации. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-profile.ts |
| account.update_contacts | Изменить телефон, email, сайт и контакты. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-contacts.ts |
| account.update_address | Изменить основной адрес организации. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-address.ts |
| account.update_branding | Изменить брендовые настройки. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-branding.ts |
| account.update_logo | Заменить логотип аккаунта. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-logo.ts |
| account.update_colors | Изменить фирменные цвета. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-colors.ts |
| account.update_public_description | Изменить публичное описание салона. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-public-description.ts |
| account.update_booking_rules | Изменить правила онлайн-записи. | write | high | always | crm.settings.update | actions/account/account.update-booking-rules.ts |
| account.update_cancellation_rules | Изменить правила отмены. | write | high | always | crm.settings.update | actions/account/account.update-cancellation-rules.ts |
| account.update_reschedule_rules | Изменить правила переноса. | write | high | always | crm.settings.update | actions/account/account.update-reschedule-rules.ts |
| account.update_deposit_rules | Изменить правила депозитов/предоплаты. | write | high | always | crm.settings.update | actions/account/account.update-deposit-rules.ts |
| account.update_review_rules | Изменить правила отзывов/публикации. | write | medium | medium_plus | crm.settings.update | actions/account/account.update-review-rules.ts |
| account.view_audit | Показать журнал действий аккаунта. | read | medium | never | crm.audit.read | actions/account/account.view-audit.ts |
| account.export_data | Экспортировать данные аккаунта. | export | high | always | crm.settings.export | actions/account/account.export-data.ts |

### 8.2 Пользователи, роли, пароль

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| user.search | Найти пользователей аккаунта. | read | low | never | crm.users.read | actions/users/user.search.ts |
| user.view | Показать пользователя, профиль, роли, статус. | read | low | never | crm.users.read | actions/users/user.view.ts |
| user.invite | Отправить приглашение сотруднику. | write | medium | medium_plus | crm.users.invite | actions/users/user.invite.ts |
| user.create | Создать пользователя без отправки пароля в открытую. | write | high | always | crm.users.create | actions/users/user.create.ts |
| user.update_profile | Изменить имя, аватар, профиль пользователя. | write | medium | medium_plus | crm.users.update | actions/users/user.update-profile.ts |
| user.update_email | Изменить email пользователя, проверить уникальность. | write | high | always | crm.users.update | actions/users/user.update-email.ts |
| user.update_phone | Изменить телефон пользователя. | write | medium | medium_plus | crm.users.update | actions/users/user.update-phone.ts |
| user.change_role | Изменить роль пользователя. | system | high | always | crm.users.roles.update | actions/users/user.change-role.ts |
| user.activate | Активировать пользователя. | write | medium | medium_plus | crm.users.update | actions/users/user.activate.ts |
| user.deactivate | Отключить пользователя. | system | high | always | crm.users.update | actions/users/user.deactivate.ts |
| user.reset_password | Запустить reset-flow, не задавать пароль напрямую. | system | high | separate_sensitive_confirm | crm.users.security.update | actions/users/user.reset-password.ts |
| user.change_own_password | Сменить пароль текущего пользователя. | system | critical | separate_sensitive_confirm | self | actions/users/user.change-own-password.ts |
| user.revoke_sessions | Отозвать активные сессии пользователя. | system | high | separate_sensitive_confirm | crm.users.security.update | actions/users/user.revoke-sessions.ts |
| user.link_identity | Привязать внешний identity provider. | system | high | always | crm.users.security.update | actions/users/user.link-identity.ts |
| user.unlink_identity | Отвязать внешний identity provider. | system | high | always | crm.users.security.update | actions/users/user.unlink-identity.ts |
| role.search | Найти роли аккаунта. | read | low | never | crm.roles.read | actions/users/role.search.ts |
| role.create | Создать роль. | write | high | always | crm.roles.manage | actions/users/role.create.ts |
| role.update | Изменить роль. | write | high | always | crm.roles.manage | actions/users/role.update.ts |
| role.delete | Удалить роль, если нет критичных привязок. | system | critical | separate_sensitive_confirm | crm.roles.manage | actions/users/role.delete.ts |
| permission.assign | Выдать permission роли/пользователю. | system | critical | separate_sensitive_confirm | crm.roles.manage | actions/users/permission.assign.ts |
| permission.revoke | Отозвать permission. | system | critical | separate_sensitive_confirm | crm.roles.manage | actions/users/permission.revoke.ts |
| permission.view_matrix | Показать матрицу permissions. | read | medium | never | crm.roles.read | actions/users/permission.view-matrix.ts |

### 8.3 Клиенты

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| client.search | Найти клиентов по имени, телефону, email, тегам. | read | low | never | crm.clients.read | actions/clients/client.search.ts |
| client.view | Показать карточку клиента. | read | low | never | crm.clients.read | actions/clients/client.view.ts |
| client.resolve | Разрешить неоднозначного клиента из candidates. | read | low | never | crm.clients.read | actions/clients/client.resolve.ts |
| client.create | Создать клиента. | write | medium | medium_plus | crm.clients.create | actions/clients/client.create.ts |
| client.update | Изменить карточку клиента. | write | medium | medium_plus | crm.clients.update | actions/clients/client.update.ts |
| client.archive | Архивировать клиента без удаления истории. | write | high | always | crm.clients.delete | actions/clients/client.archive.ts |
| client.restore | Восстановить клиента из архива. | write | medium | medium_plus | crm.clients.update | actions/clients/client.restore.ts |
| client.add_contact | Добавить контакт клиента. | write | medium | medium_plus | crm.clients.update | actions/clients/client.add-contact.ts |
| client.update_contact | Изменить контакт клиента. | write | medium | medium_plus | crm.clients.update | actions/clients/client.update-contact.ts |
| client.delete_contact | Удалить контакт клиента. | write | high | always | crm.clients.update | actions/clients/client.delete-contact.ts |
| client.add_note | Добавить заметку. | write | medium | medium_plus | crm.clients.update | actions/clients/client.add-note.ts |
| client.update_note | Изменить заметку. | write | medium | medium_plus | crm.clients.update | actions/clients/client.update-note.ts |
| client.delete_note | Удалить заметку. | write | high | always | crm.clients.update | actions/clients/client.delete-note.ts |
| client.add_tag | Добавить тег клиенту. | write | low | never | crm.clients.update | actions/clients/client.add-tag.ts |
| client.remove_tag | Убрать тег клиента. | write | low | never | crm.clients.update | actions/clients/client.remove-tag.ts |
| client.create_tag | Создать тег. | write | low | never | crm.clients.update | actions/clients/client.create-tag.ts |
| client.merge_duplicates | Объединить дубли клиентов. | system | high | always | crm.clients.merge | actions/clients/client.merge-duplicates.ts |
| client.view_history | Показать историю изменений/контактов клиента. | read | low | never | crm.clients.read | actions/clients/client.view-history.ts |
| client.view_visits | Показать визиты клиента. | read | low | never | crm.clients.read | actions/clients/client.view-visits.ts |
| client.view_payments | Показать платежи клиента. | read | medium | never | crm.finance.read | actions/clients/client.view-payments.ts |
| client.view_reviews | Показать отзывы клиента. | read | low | never | crm.reviews.read | actions/clients/client.view-reviews.ts |
| client.view_loyalty | Показать лояльность клиента. | read | low | never | crm.loyalty.read | actions/clients/client.view-loyalty.ts |
| client.update_consent | Изменить согласия на уведомления/персональные данные. | write | high | always | crm.clients.update | actions/clients/client.update-consent.ts |
| client.notify | Отправить уведомление одному клиенту. | write | high | always | crm.notifications.send | actions/clients/client.notify.ts |
| client.create_segment | Создать сегмент клиентов. | write | medium | medium_plus | crm.clients.segments.manage | actions/clients/client.create-segment.ts |
| client.export_segment | Экспортировать сегмент клиентов. | export | high | always | crm.clients.export | actions/clients/client.export-segment.ts |

### 8.4 Записи

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| appointment.search | Найти записи. | read | low | never | crm.calendar.read | actions/appointments/appointment.search.ts |
| appointment.view | Показать запись. | read | low | never | crm.calendar.read | actions/appointments/appointment.view.ts |
| appointment.resolve | Разрешить неоднозначную запись. | read | low | never | crm.calendar.read | actions/appointments/appointment.resolve.ts |
| appointment.find_slots | Найти свободные окна. | read | low | never | crm.schedule.read | actions/appointments/appointment.find-slots.ts |
| appointment.hold_slot | Поставить временный hold на слот. | write | medium | medium_plus | crm.appointments.create | actions/appointments/appointment.hold-slot.ts |
| appointment.release_hold | Снять hold. | write | low | never | crm.appointments.create | actions/appointments/appointment.release-hold.ts |
| appointment.create | Создать запись. | write | high | always | crm.appointments.create | actions/appointments/appointment.create.ts |
| appointment.reschedule | Перенести запись. | write | high | always | crm.appointments.reschedule | actions/appointments/appointment.reschedule.ts |
| appointment.cancel | Отменить запись. | write | high | always | crm.appointments.cancel | actions/appointments/appointment.cancel.ts |
| appointment.confirm | Подтвердить запись. | write | medium | medium_plus | crm.appointments.update | actions/appointments/appointment.confirm.ts |
| appointment.mark_done | Отметить выполненной. | write | medium | medium_plus | crm.appointments.update | actions/appointments/appointment.mark-done.ts |
| appointment.mark_no_show | Отметить неявку. | write | high | always | crm.appointments.update | actions/appointments/appointment.mark-no-show.ts |
| appointment.change_client | Сменить клиента записи. | write | high | always | crm.appointments.update | actions/appointments/appointment.change-client.ts |
| appointment.change_service | Сменить услугу записи. | write | high | always | crm.appointments.update | actions/appointments/appointment.change-service.ts |
| appointment.change_specialist | Сменить специалиста. | write | high | always | crm.appointments.update | actions/appointments/appointment.change-specialist.ts |
| appointment.change_location | Сменить филиал. | write | high | always | crm.appointments.update | actions/appointments/appointment.change-location.ts |
| appointment.change_time | Сменить время. | write | high | always | crm.appointments.reschedule | actions/appointments/appointment.change-time.ts |
| appointment.change_price | Сменить цену. | write | high | always | crm.appointments.update | actions/appointments/appointment.change-price.ts |
| appointment.change_duration | Сменить длительность. | write | medium | medium_plus | crm.appointments.update | actions/appointments/appointment.change-duration.ts |
| appointment.add_comment | Добавить комментарий. | write | low | never | crm.appointments.update | actions/appointments/appointment.add-comment.ts |
| appointment.update_comment | Изменить комментарий. | write | low | never | crm.appointments.update | actions/appointments/appointment.update-comment.ts |
| appointment.view_conflicts | Показать конфликты записи/слота. | read | low | never | crm.calendar.read | actions/appointments/appointment.view-conflicts.ts |
| appointment.view_history | Показать историю записи. | read | low | never | crm.calendar.read | actions/appointments/appointment.view-history.ts |

### 8.5 Групповые записи

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| group_session.search | Найти групповые занятия. | read | low | never | crm.group_sessions.read | actions/group-sessions/group-session.search.ts |
| group_session.view | Показать групповое занятие. | read | low | never | crm.group_sessions.read | actions/group-sessions/group-session.view.ts |
| group_session.create | Создать групповое занятие. | write | high | always | crm.group_sessions.create | actions/group-sessions/group-session.create.ts |
| group_session.update | Изменить групповое занятие. | write | high | always | crm.group_sessions.update | actions/group-sessions/group-session.update.ts |
| group_session.cancel | Отменить групповое занятие. | write | high | always | crm.group_sessions.cancel | actions/group-sessions/group-session.cancel.ts |
| group_session.change_capacity | Изменить вместимость. | write | medium | medium_plus | crm.group_sessions.update | actions/group-sessions/group-session.change-capacity.ts |
| group_session.change_price | Изменить цену. | write | high | always | crm.group_sessions.update | actions/group-sessions/group-session.change-price.ts |
| group_session.add_participant | Добавить участника. | write | medium | medium_plus | crm.group_sessions.update | actions/group-sessions/group-session.add-participant.ts |
| group_session.remove_participant | Убрать участника. | write | high | always | crm.group_sessions.update | actions/group-sessions/group-session.remove-participant.ts |
| group_session.update_participant_status | Изменить статус участника. | write | medium | medium_plus | crm.group_sessions.update | actions/group-sessions/group-session.update-participant-status.ts |
| group_session.mark_participant_done | Отметить участника пришедшим/выполненным. | write | medium | medium_plus | crm.group_sessions.update | actions/group-sessions/group-session.mark-participant-done.ts |
| group_session.mark_participant_no_show | Отметить неявку участника. | write | high | always | crm.group_sessions.update | actions/group-sessions/group-session.mark-participant-no-show.ts |

### 8.6 График

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| schedule.search | Найти графики/записи расписания. | read | low | never | crm.schedule.read | actions/schedule/schedule.search.ts |
| schedule.view_day | Показать день графика. | read | low | never | crm.schedule.read | actions/schedule/schedule.view-day.ts |
| schedule.view_week | Показать неделю графика. | read | low | never | crm.schedule.read | actions/schedule/schedule.view-week.ts |
| schedule.view_month | Показать месяц графика. | read | low | never | crm.schedule.read | actions/schedule/schedule.view-month.ts |
| schedule.set_workday | Поставить рабочий день. | write | high | always | crm.schedule.update | actions/schedule/schedule.set-workday.ts |
| schedule.set_day_off | Поставить выходной. | write | high | always | crm.schedule.update | actions/schedule/schedule.set-day-off.ts |
| schedule.set_vacation | Поставить отпуск. | write | high | always | crm.schedule.update | actions/schedule/schedule.set-vacation.ts |
| schedule.add_break | Добавить перерыв. | write | medium | medium_plus | crm.schedule.update | actions/schedule/schedule.add-break.ts |
| schedule.update_break | Изменить перерыв. | write | medium | medium_plus | crm.schedule.update | actions/schedule/schedule.update-break.ts |
| schedule.remove_break | Удалить перерыв. | write | medium | medium_plus | crm.schedule.update | actions/schedule/schedule.remove-break.ts |
| schedule.block_slot | Заблокировать слот. | write | high | always | crm.schedule.update | actions/schedule/schedule.block-slot.ts |
| schedule.unblock_slot | Разблокировать слот. | write | high | always | crm.schedule.update | actions/schedule/schedule.unblock-slot.ts |
| schedule.copy_day | Скопировать день графика. | write | high | always | crm.schedule.update | actions/schedule/schedule.copy-day.ts |
| schedule.copy_week | Скопировать неделю графика. | write | high | always | crm.schedule.update | actions/schedule/schedule.copy-week.ts |
| schedule.create_template | Создать шаблон графика. | write | medium | medium_plus | crm.schedule.update | actions/schedule/schedule.create-template.ts |
| schedule.update_template | Изменить шаблон графика. | write | medium | medium_plus | crm.schedule.update | actions/schedule/schedule.update-template.ts |
| schedule.delete_template | Удалить шаблон графика. | write | high | always | crm.schedule.update | actions/schedule/schedule.delete-template.ts |
| schedule.apply_template | Применить шаблон. | write | high | always | crm.schedule.update | actions/schedule/schedule.apply-template.ts |
| schedule.create_non_working_type | Создать тип нерабочего времени. | write | medium | medium_plus | crm.schedule.update | actions/schedule/schedule.create-non-working-type.ts |
| schedule.update_non_working_type | Изменить тип нерабочего времени. | write | medium | medium_plus | crm.schedule.update | actions/schedule/schedule.update-non-working-type.ts |
| schedule.delete_non_working_type | Удалить тип нерабочего времени. | write | high | always | crm.schedule.update | actions/schedule/schedule.delete-non-working-type.ts |
| schedule.find_empty_windows | Найти пустые окна. | read | low | never | crm.schedule.read | actions/schedule/schedule.find-empty-windows.ts |
| schedule.find_overlaps | Найти пересечения графика/записей. | read | low | never | crm.schedule.read | actions/schedule/schedule.find-overlaps.ts |

### 8.7 Услуги

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| service.search | Найти услуги. | read | low | never | crm.services.read | actions/services/service.search.ts |
| service.view | Показать услугу. | read | low | never | crm.services.read | actions/services/service.view.ts |
| service.resolve | Разрешить неоднозначную услугу. | read | low | never | crm.services.read | actions/services/service.resolve.ts |
| service.create | Создать услугу. | write | medium | medium_plus | crm.services.create | actions/services/service.create.ts |
| service.update | Изменить услугу. | write | medium | medium_plus | crm.services.update | actions/services/service.update.ts |
| service.update_name | Изменить название услуги. | write | medium | medium_plus | crm.services.update | actions/services/service.update-name.ts |
| service.update_description | Изменить описание услуги. | write | medium | medium_plus | crm.services.update | actions/services/service.update-description.ts |
| service.generate_description | Сгенерировать описание услуги как черновик. | generate | medium | medium_plus | crm.services.update | actions/services/service.generate-description.ts |
| service.update_price | Изменить цену. | write | high | always | crm.services.update | actions/services/service.update-price.ts |
| service.update_duration | Изменить длительность. | write | medium | medium_plus | crm.services.update | actions/services/service.update-duration.ts |
| service.update_booking_type | Изменить тип записи/бронирования. | write | high | always | crm.services.update | actions/services/service.update-booking-type.ts |
| service.activate | Активировать услугу. | write | medium | medium_plus | crm.services.update | actions/services/service.activate.ts |
| service.archive | Архивировать услугу. | write | high | always | crm.services.delete | actions/services/service.archive.ts |
| service.restore | Восстановить услугу. | write | medium | medium_plus | crm.services.update | actions/services/service.restore.ts |
| service.delete_if_empty | Удалить услугу, только если нет зависимостей. | system | critical | separate_sensitive_confirm | crm.services.delete | actions/services/service.delete-if-empty.ts |
| service.assign_specialist | Привязать специалиста к услуге. | write | medium | medium_plus | crm.services.update | actions/services/service.assign-specialist.ts |
| service.unassign_specialist | Отвязать специалиста от услуги. | write | high | always | crm.services.update | actions/services/service.unassign-specialist.ts |
| service.assign_location | Привязать филиал к услуге. | write | medium | medium_plus | crm.services.update | actions/services/service.assign-location.ts |
| service.unassign_location | Отвязать филиал от услуги. | write | high | always | crm.services.update | actions/services/service.unassign-location.ts |
| service.add_variant | Добавить вариант услуги. | write | medium | medium_plus | crm.services.update | actions/services/service.add-variant.ts |
| service.update_variant | Изменить вариант услуги. | write | medium | medium_plus | crm.services.update | actions/services/service.update-variant.ts |
| service.delete_variant | Удалить вариант услуги. | write | high | always | crm.services.update | actions/services/service.delete-variant.ts |
| service.create_category | Создать категорию услуг. | write | medium | medium_plus | crm.services.create | actions/services/service.create-category.ts |
| service.update_category | Изменить категорию услуг. | write | medium | medium_plus | crm.services.update | actions/services/service.update-category.ts |
| service.delete_category | Удалить категорию услуг. | write | high | always | crm.services.delete | actions/services/service.delete-category.ts |
| service.move_to_category | Переместить услугу в категорию. | write | medium | medium_plus | crm.services.update | actions/services/service.move-to-category.ts |
| service.update_level_config | Изменить настройки цены/длительности по уровню специалиста. | write | high | always | crm.services.update | actions/services/service.update-level-config.ts |
| service.attach_media | Прикрепить медиа к услуге. | write | medium | medium_plus | crm.services.update | actions/services/service.attach-media.ts |
| service.detach_media | Открепить медиа от услуги. | write | medium | medium_plus | crm.services.update | actions/services/service.detach-media.ts |

### 8.8 Сотрудники

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| specialist.search | Найти сотрудников/специалистов. | read | low | never | crm.specialists.read | actions/specialists/specialist.search.ts |
| specialist.view | Показать карточку специалиста. | read | low | never | crm.specialists.read | actions/specialists/specialist.view.ts |
| specialist.resolve | Разрешить неоднозначного специалиста. | read | low | never | crm.specialists.read | actions/specialists/specialist.resolve.ts |
| specialist.create | Зарегистрировать специалиста в CRM. Минимум: ФИО/имя. График и услуги не обязательны. | write | medium | medium_plus | crm.specialists.create | actions/specialists/specialist.create.ts |
| specialist.update | Изменить карточку специалиста. | write | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.update.ts |
| specialist.update_bio | Изменить био специалиста. | write | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.update-bio.ts |
| specialist.generate_bio | Сгенерировать био как черновик. | generate | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.generate-bio.ts |
| specialist.update_avatar | Изменить фото/аватар специалиста. | write | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.update-avatar.ts |
| specialist.set_public | Сделать специалиста публичным. | write | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.set-public.ts |
| specialist.hide | Скрыть специалиста с публичной страницы. | write | high | always | crm.specialists.update | actions/specialists/specialist.hide.ts |
| specialist.assign_service | Привязать услугу к специалисту. | write | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.assign-service.ts |
| specialist.unassign_service | Отвязать услугу от специалиста. | write | high | always | crm.specialists.update | actions/specialists/specialist.unassign-service.ts |
| specialist.assign_location | Привязать филиал к специалисту. | write | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.assign-location.ts |
| specialist.unassign_location | Отвязать филиал от специалиста. | write | high | always | crm.specialists.update | actions/specialists/specialist.unassign-location.ts |
| specialist.assign_category | Назначить категорию специалиста. | write | low | never | crm.specialists.update | actions/specialists/specialist.assign-category.ts |
| specialist.remove_category | Убрать категорию специалиста. | write | low | never | crm.specialists.update | actions/specialists/specialist.remove-category.ts |
| specialist.set_level | Назначить уровень специалиста. | write | medium | medium_plus | crm.specialists.update | actions/specialists/specialist.set-level.ts |
| specialist.view_workload | Показать загрузку специалиста. | read | low | never | crm.assistant.analytics.read | actions/specialists/specialist.view-workload.ts |
| specialist.view_revenue | Показать выручку специалиста. | read | medium | never | crm.finance.read | actions/specialists/specialist.view-revenue.ts |
| specialist.view_reviews | Показать отзывы специалиста. | read | low | never | crm.reviews.read | actions/specialists/specialist.view-reviews.ts |
| specialist.view_empty_slots | Показать свободные окна специалиста. | read | low | never | crm.schedule.read | actions/specialists/specialist.view-empty-slots.ts |

### 8.9 Локации

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| location.search | Найти филиалы/локации. | read | low | never | crm.locations.read | actions/locations/location.search.ts |
| location.view | Показать филиал. | read | low | never | crm.locations.read | actions/locations/location.view.ts |
| location.resolve | Разрешить неоднозначный филиал. | read | low | never | crm.locations.read | actions/locations/location.resolve.ts |
| location.create | Создать филиал. | write | medium | medium_plus | crm.locations.create | actions/locations/location.create.ts |
| location.update | Изменить филиал. | write | medium | medium_plus | crm.locations.update | actions/locations/location.update.ts |
| location.update_name | Изменить название филиала. | write | medium | medium_plus | crm.locations.update | actions/locations/location.update-name.ts |
| location.update_address | Изменить адрес филиала. | write | high | always | crm.locations.update | actions/locations/location.update-address.ts |
| location.update_phone | Изменить телефон филиала. | write | medium | medium_plus | crm.locations.update | actions/locations/location.update-phone.ts |
| location.update_description | Изменить описание филиала. | write | medium | medium_plus | crm.locations.update | actions/locations/location.update-description.ts |
| location.generate_description | Сгенерировать описание филиала. | generate | medium | medium_plus | crm.locations.update | actions/locations/location.generate-description.ts |
| location.activate | Активировать филиал. | write | medium | medium_plus | crm.locations.update | actions/locations/location.activate.ts |
| location.deactivate | Деактивировать филиал. | write | high | always | crm.locations.update | actions/locations/location.deactivate.ts |
| location.update_hours | Изменить часы работы филиала. | write | high | always | crm.locations.update | actions/locations/location.update-hours.ts |
| location.add_exception | Добавить исключение в часы работы. | write | high | always | crm.locations.update | actions/locations/location.add-exception.ts |
| location.remove_exception | Удалить исключение часов работы. | write | high | always | crm.locations.update | actions/locations/location.remove-exception.ts |
| location.assign_manager | Назначить менеджера филиала. | system | high | always | crm.locations.update | actions/locations/location.assign-manager.ts |
| location.remove_manager | Снять менеджера филиала. | system | high | always | crm.locations.update | actions/locations/location.remove-manager.ts |
| location.attach_media | Прикрепить медиа к филиалу. | write | medium | medium_plus | crm.locations.update | actions/locations/location.attach-media.ts |
| location.detach_media | Открепить медиа от филиала. | write | medium | medium_plus | crm.locations.update | actions/locations/location.detach-media.ts |
| location.view_schedule | Показать график филиала. | read | low | never | crm.schedule.read | actions/locations/location.view-schedule.ts |
| location.view_workload | Показать загрузку филиала. | read | low | never | crm.assistant.analytics.read | actions/locations/location.view-workload.ts |

### 8.10 Отзывы

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| review.search | Найти отзывы. | read | low | never | crm.reviews.read | actions/reviews/review.search.ts |
| review.view | Показать отзыв. | read | low | never | crm.reviews.read | actions/reviews/review.view.ts |
| review.resolve | Разрешить неоднозначный отзыв. | read | low | never | crm.reviews.read | actions/reviews/review.resolve.ts |
| review.find_negative | Найти негативные отзывы. | read | low | never | crm.reviews.read | actions/reviews/review.find-negative.ts |
| review.find_unanswered | Найти отзывы без ответа. | read | low | never | crm.reviews.read | actions/reviews/review.find-unanswered.ts |
| review.reply | Ответить на отзыв. | write | medium | medium_plus | crm.reviews.manage | actions/reviews/review.reply.ts |
| review.generate_reply | Сгенерировать черновик ответа. | generate | medium | medium_plus | crm.reviews.manage | actions/reviews/review.generate-reply.ts |
| review.update_reply | Изменить ответ на отзыв. | write | medium | medium_plus | crm.reviews.manage | actions/reviews/review.update-reply.ts |
| review.delete_reply | Удалить ответ на отзыв. | write | high | always | crm.reviews.manage | actions/reviews/review.delete-reply.ts |
| review.change_status | Изменить статус отзыва. | write | medium | medium_plus | crm.reviews.manage | actions/reviews/review.change-status.ts |
| review.bulk_update_status | Массово изменить статусы отзывов. | write | high | always | crm.reviews.manage | actions/reviews/review.bulk-update-status.ts |
| review.attach_reply_media | Прикрепить медиа к ответу. | write | medium | medium_plus | crm.reviews.manage | actions/reviews/review.attach-reply-media.ts |
| review.remove_reply_media | Убрать медиа из ответа. | write | medium | medium_plus | crm.reviews.manage | actions/reviews/review.remove-reply-media.ts |
| review.analyze_complaints | Проанализировать жалобы. | read | low | never | crm.assistant.analytics.read | actions/reviews/review.analyze-complaints.ts |
| review.suggest_process_fix | Предложить улучшения процесса по отзывам. | generate | low | never | crm.assistant.analytics.read | actions/reviews/review.suggest-process-fix.ts |

### 8.11 Сайт и SEO

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| site.health | Проверить полноту сайта/SEO/страниц. | read | low | never | crm.settings.read | actions/site/site.health.ts |
| site.view_public_page | Показать публичную страницу. | read | low | never | crm.settings.read | actions/site/site.view-public-page.ts |
| site.create_public_page | Создать публичную страницу. | write | high | always | crm.settings.update | actions/site/site.create-public-page.ts |
| site.update_public_page | Изменить публичную страницу. | write | high | always | crm.settings.update | actions/site/site.update-public-page.ts |
| site.archive_public_page | Архивировать публичную страницу. | write | high | always | crm.settings.update | actions/site/site.archive-public-page.ts |
| site.create_section | Создать секцию страницы. | write | medium | medium_plus | crm.settings.update | actions/site/site.create-section.ts |
| site.update_section | Изменить секцию. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-section.ts |
| site.delete_section | Удалить секцию. | write | high | always | crm.settings.update | actions/site/site.delete-section.ts |
| site.create_block | Создать блок. | write | medium | medium_plus | crm.settings.update | actions/site/site.create-block.ts |
| site.update_block | Изменить блок. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-block.ts |
| site.delete_block | Удалить блок. | write | high | always | crm.settings.update | actions/site/site.delete-block.ts |
| site.update_home_copy | Изменить текст главной. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-home-copy.ts |
| site.update_service_copy | Изменить текст услуги на сайте. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-service-copy.ts |
| site.update_specialist_copy | Изменить текст специалиста на сайте. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-specialist-copy.ts |
| site.update_location_copy | Изменить текст филиала на сайте. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-location-copy.ts |
| site.update_contacts | Изменить контакты сайта. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-contacts.ts |
| site.update_booking_settings | Изменить настройки онлайн-записи сайта. | write | high | always | crm.settings.update | actions/site/site.update-booking-settings.ts |
| site.update_seo_global | Изменить глобальное SEO. | write | high | always | crm.settings.update | actions/site/site.update-seo-global.ts |
| site.update_seo_page | Изменить SEO страницы. | write | medium | medium_plus | crm.settings.update | actions/site/site.update-seo-page.ts |
| site.generate_missing_descriptions | Сгенерировать недостающие описания как drafts. | generate | medium | medium_plus | crm.settings.update | actions/site/site.generate-missing-descriptions.ts |
| site.preview_changes | Показать preview изменений сайта. | read | low | never | crm.settings.read | actions/site/site.preview-changes.ts |
| site.apply_changes | Применить подготовленные изменения сайта. | write | high | always | crm.settings.update | actions/site/site.apply-changes.ts |

### 8.12 Домены

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| domain.search | Найти домены аккаунта. | read | low | never | crm.settings.read | actions/domains/domain.search.ts |
| domain.add | Добавить домен. | write | high | always | crm.settings.update | actions/domains/domain.add.ts |
| domain.check | Проверить DNS домена. | read | low | never | crm.settings.read | actions/domains/domain.check.ts |
| domain.set_primary | Сделать домен основным. | write | high | always | crm.settings.update | actions/domains/domain.set-primary.ts |
| domain.remove | Удалить домен. | write | high | always | crm.settings.update | actions/domains/domain.remove.ts |
| domain.view_dns_status | Показать DNS-статус. | read | low | never | crm.settings.read | actions/domains/domain.view-dns-status.ts |

### 8.13 Медиа

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| media.search | Найти медиа. | read | low | never | crm.media.read | actions/media/media.search.ts |
| media.upload | Загрузить медиа. | write | medium | medium_plus | crm.media.upload | actions/media/media.upload.ts |
| media.update_alt | Изменить alt-текст. | write | low | never | crm.media.update | actions/media/media.update-alt.ts |
| media.update_metadata | Изменить metadata. | write | medium | medium_plus | crm.media.update | actions/media/media.update-metadata.ts |
| media.create_collection | Создать коллекцию. | write | medium | medium_plus | crm.media.update | actions/media/media.create-collection.ts |
| media.update_collection | Изменить коллекцию. | write | medium | medium_plus | crm.media.update | actions/media/media.update-collection.ts |
| media.delete_collection | Удалить коллекцию. | write | high | always | crm.media.update | actions/media/media.delete-collection.ts |
| media.link_to_account | Привязать медиа к аккаунту. | write | medium | medium_plus | crm.media.update | actions/media/media.link-to-account.ts |
| media.link_to_service | Привязать медиа к услуге. | write | medium | medium_plus | crm.media.update | actions/media/media.link-to-service.ts |
| media.link_to_specialist | Привязать медиа к специалисту. | write | medium | medium_plus | crm.media.update | actions/media/media.link-to-specialist.ts |
| media.link_to_location | Привязать медиа к филиалу. | write | medium | medium_plus | crm.media.update | actions/media/media.link-to-location.ts |
| media.unlink | Отвязать медиа. | write | medium | medium_plus | crm.media.update | actions/media/media.unlink.ts |
| media.archive | Архивировать медиа. | write | high | always | crm.media.update | actions/media/media.archive.ts |

### 8.14 Акции и промокоды

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| promo.search | Найти акции. | read | low | never | crm.promos.read | actions/promos/promo.search.ts |
| promo.view | Показать акцию. | read | low | never | crm.promos.read | actions/promos/promo.view.ts |
| promo.resolve | Разрешить неоднозначную акцию. | read | low | never | crm.promos.read | actions/promos/promo.resolve.ts |
| promo.create | Создать акцию. | write | medium | medium_plus | crm.promos.create | actions/promos/promo.create.ts |
| promo.update | Изменить акцию. | write | medium | medium_plus | crm.promos.update | actions/promos/promo.update.ts |
| promo.activate | Активировать акцию. | write | medium | medium_plus | crm.promos.update | actions/promos/promo.activate.ts |
| promo.deactivate | Деактивировать акцию. | write | medium | medium_plus | crm.promos.update | actions/promos/promo.deactivate.ts |
| promo.archive | Архивировать акцию. | write | high | always | crm.promos.update | actions/promos/promo.archive.ts |
| promo.restore | Восстановить акцию. | write | medium | medium_plus | crm.promos.update | actions/promos/promo.restore.ts |
| promo.create_code | Создать промокод. | write | medium | medium_plus | crm.promos.update | actions/promos/promo.create-code.ts |
| promo.update_code | Изменить промокод. | write | medium | medium_plus | crm.promos.update | actions/promos/promo.update-code.ts |
| promo.disable_code | Отключить промокод. | write | medium | medium_plus | crm.promos.update | actions/promos/promo.disable-code.ts |
| promo.view_redemptions | Показать использования промокода. | read | low | never | crm.promos.read | actions/promos/promo.view-redemptions.ts |
| promo.suggest_for_retention | Предложить акцию для возврата клиентов. | generate | low | never | crm.assistant.analytics.read | actions/promos/promo.suggest-for-retention.ts |
| promo.suggest_for_empty_slots | Предложить акцию на пустые окна. | generate | low | never | crm.assistant.analytics.read | actions/promos/promo.suggest-for-empty-slots.ts |
| promo.suggest_for_birthday | Предложить birthday-акцию. | generate | low | never | crm.assistant.analytics.read | actions/promos/promo.suggest-for-birthday.ts |

### 8.15 Лояльность, подарочные карты, абонементы

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| loyalty.view_wallet | Показать кошелек лояльности клиента. | read | low | never | crm.loyalty.read | actions/loyalty/loyalty.view-wallet.ts |
| loyalty.adjust_balance | Изменить баланс лояльности. | write | high | always | crm.loyalty.manage | actions/loyalty/loyalty.adjust-balance.ts |
| loyalty.create_rule | Создать правило лояльности. | write | medium | medium_plus | crm.loyalty.manage | actions/loyalty/loyalty.create-rule.ts |
| loyalty.update_rule | Изменить правило лояльности. | write | medium | medium_plus | crm.loyalty.manage | actions/loyalty/loyalty.update-rule.ts |
| loyalty.disable_rule | Отключить правило лояльности. | write | medium | medium_plus | crm.loyalty.manage | actions/loyalty/loyalty.disable-rule.ts |
| loyalty.view_transactions | Показать транзакции лояльности. | read | low | never | crm.loyalty.read | actions/loyalty/loyalty.view-transactions.ts |
| gift_card.search | Найти подарочные карты. | read | low | never | crm.gift_cards.read | actions/loyalty/gift-card.search.ts |
| gift_card.create | Создать подарочную карту. | write | high | always | crm.gift_cards.manage | actions/loyalty/gift-card.create.ts |
| gift_card.update | Изменить подарочную карту. | write | high | always | crm.gift_cards.manage | actions/loyalty/gift-card.update.ts |
| gift_card.activate | Активировать подарочную карту. | write | high | always | crm.gift_cards.manage | actions/loyalty/gift-card.activate.ts |
| gift_card.cancel | Отменить подарочную карту. | write | high | always | crm.gift_cards.manage | actions/loyalty/gift-card.cancel.ts |
| membership.search | Найти абонементы. | read | low | never | crm.memberships.read | actions/loyalty/membership.search.ts |
| membership.create | Создать абонемент. | write | high | always | crm.memberships.manage | actions/loyalty/membership.create.ts |
| membership.update | Изменить абонемент. | write | high | always | crm.memberships.manage | actions/loyalty/membership.update.ts |
| membership.activate | Активировать абонемент. | write | high | always | crm.memberships.manage | actions/loyalty/membership.activate.ts |
| membership.cancel | Отменить абонемент. | write | high | always | crm.memberships.manage | actions/loyalty/membership.cancel.ts |
| membership.redeem | Списать посещение/услугу по абонементу. | write | high | always | crm.memberships.manage | actions/loyalty/membership.redeem.ts |

### 8.16 Финансы

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| finance.view_revenue | Показать выручку. | read | medium | never | crm.finance.read | actions/finance/finance.view-revenue.ts |
| finance.view_payments | Показать платежи. | read | medium | never | crm.finance.read | actions/finance/finance.view-payments.ts |
| finance.view_refunds | Показать возвраты. | read | medium | never | crm.finance.read | actions/finance/finance.view-refunds.ts |
| finance.view_receipts | Показать чеки. | read | medium | never | crm.finance.read | actions/finance/finance.view-receipts.ts |
| finance.find_unpaid | Найти неоплаченные записи. | read | medium | never | crm.finance.read | actions/finance/finance.find-unpaid.ts |
| finance.view_client_balance | Показать баланс клиента. | read | medium | never | crm.finance.read | actions/finance/finance.view-client-balance.ts |
| finance.revenue_by_service | Выручка по услугам. | read | medium | never | crm.finance.read | actions/finance/finance.revenue-by-service.ts |
| finance.revenue_by_specialist | Выручка по специалистам. | read | medium | never | crm.finance.read | actions/finance/finance.revenue-by-specialist.ts |
| finance.revenue_by_location | Выручка по филиалам. | read | medium | never | crm.finance.read | actions/finance/finance.revenue-by-location.ts |
| finance.reconcile_appointment | Сверить оплату записи. | write | high | always | crm.finance.manage | actions/finance/finance.reconcile-appointment.ts |
| payment_intent.search | Найти payment intents. | read | medium | never | crm.finance.read | actions/finance/payment-intent.search.ts |
| payment_intent.create | Создать намерение платежа. | write | high | always | crm.finance.manage | actions/finance/payment-intent.create.ts |
| payment_intent.cancel | Отменить намерение платежа. | write | high | always | crm.finance.manage | actions/finance/payment-intent.cancel.ts |
| refund.create | Создать возврат. | system | critical | separate_sensitive_confirm | crm.finance.refund | actions/finance/refund.create.ts |
| receipt.view | Показать чек. | read | medium | never | crm.finance.read | actions/finance/receipt.view.ts |
| receipt.resend | Переотправить чек. | write | medium | medium_plus | crm.finance.manage | actions/finance/receipt.resend.ts |

### 8.17 Уведомления

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| notification.search | Найти уведомления. | read | low | never | crm.notifications.read | actions/notifications/notification.search.ts |
| notification.view | Показать уведомление. | read | low | never | crm.notifications.read | actions/notifications/notification.view.ts |
| notification.send_client | Отправить клиенту уведомление. | write | high | always | crm.notifications.send | actions/notifications/notification.send-client.ts |
| notification.send_segment | Отправить сегменту. | write | high | always | crm.notifications.send | actions/notifications/notification.send-segment.ts |
| notification.create_template | Создать шаблон уведомления. | write | medium | medium_plus | crm.notifications.manage | actions/notifications/notification.create-template.ts |
| notification.update_template | Изменить шаблон. | write | medium | medium_plus | crm.notifications.manage | actions/notifications/notification.update-template.ts |
| notification.delete_template | Удалить шаблон. | write | high | always | crm.notifications.manage | actions/notifications/notification.delete-template.ts |
| notification.update_preferences | Изменить настройки уведомлений. | write | high | always | crm.notifications.manage | actions/notifications/notification.update-preferences.ts |
| notification.preview | Показать preview уведомления. | read | low | never | crm.notifications.read | actions/notifications/notification.preview.ts |
| notification.retry_failed | Повторить неудачное уведомление. | write | medium | medium_plus | crm.notifications.send | actions/notifications/notification.retry-failed.ts |
| outbox.search | Найти outbox items. | read | low | never | crm.notifications.read | actions/notifications/outbox.search.ts |
| outbox.retry | Повторить outbox item. | write | medium | medium_plus | crm.notifications.send | actions/notifications/outbox.retry.ts |
| delivery.view_status | Показать статус доставки. | read | low | never | crm.notifications.read | actions/notifications/delivery.view-status.ts |

### 8.18 Маркетинг

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| campaign.create_retention | Создать retention-кампанию. | write | high | always | crm.marketing.manage | actions/marketing/campaign.create-retention.ts |
| campaign.create_reactivation | Создать reactivation-кампанию. | write | high | always | crm.marketing.manage | actions/marketing/campaign.create-reactivation.ts |
| campaign.create_repeat_visit | Создать кампанию повторного визита. | write | high | always | crm.marketing.manage | actions/marketing/campaign.create-repeat-visit.ts |
| campaign.create_empty_slots | Создать кампанию на пустые окна. | write | high | always | crm.marketing.manage | actions/marketing/campaign.create-empty-slots.ts |
| campaign.create_birthday | Создать birthday-кампанию. | write | high | always | crm.marketing.manage | actions/marketing/campaign.create-birthday.ts |
| campaign.create_seasonal | Создать сезонную кампанию. | write | high | always | crm.marketing.manage | actions/marketing/campaign.create-seasonal.ts |
| campaign.preview_audience | Показать аудиторию кампании. | read | medium | never | crm.marketing.read | actions/marketing/campaign.preview-audience.ts |
| campaign.update_audience | Изменить аудиторию. | write | high | always | crm.marketing.manage | actions/marketing/campaign.update-audience.ts |
| campaign.update_offer | Изменить оффер. | write | medium | medium_plus | crm.marketing.manage | actions/marketing/campaign.update-offer.ts |
| campaign.update_message | Изменить сообщение. | write | medium | medium_plus | crm.marketing.manage | actions/marketing/campaign.update-message.ts |
| campaign.schedule | Запланировать отправку. | write | high | always | crm.marketing.manage | actions/marketing/campaign.schedule.ts |
| campaign.send | Отправить кампанию. | system | critical | separate_sensitive_confirm | crm.marketing.send | actions/marketing/campaign.send.ts |
| campaign.pause | Поставить кампанию на паузу. | write | medium | medium_plus | crm.marketing.manage | actions/marketing/campaign.pause.ts |
| campaign.cancel | Отменить кампанию. | write | high | always | crm.marketing.manage | actions/marketing/campaign.cancel.ts |
| campaign.view_results | Показать результаты. | read | low | never | crm.marketing.read | actions/marketing/campaign.view-results.ts |
| campaign.analyze_conversions | Проанализировать конверсии. | read | low | never | crm.assistant.analytics.read | actions/marketing/campaign.analyze-conversions.ts |

### 8.19 Аналитика

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| analytics.attention_review | Что требует внимания. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.attention-review.ts |
| analytics.daily_brief | Дневной бриф. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.daily-brief.ts |
| analytics.weekly_brief | Недельный бриф. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.weekly-brief.ts |
| analytics.workload | Анализ загрузки. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.workload.ts |
| analytics.revenue | Анализ выручки. | read | medium | never | crm.finance.read | actions/analytics/analytics.revenue.ts |
| analytics.retention | Анализ удержания. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.retention.ts |
| analytics.no_show_rate | Анализ неявок. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.no-show-rate.ts |
| analytics.cancellations | Анализ отмен. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.cancellations.ts |
| analytics.empty_windows | Анализ пустых окон. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.empty-windows.ts |
| analytics.underloaded_specialists | Найти недозагруженных специалистов. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.underloaded-specialists.ts |
| analytics.declining_services | Найти услуги с падением спроса. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.declining-services.ts |
| analytics.top_services | Топ услуг. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.top-services.ts |
| analytics.top_clients | Топ клиентов. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.top-clients.ts |
| analytics.review_themes | Темы отзывов. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.review-themes.ts |
| analytics.campaign_conversion | Конверсия кампаний. | read | low | never | crm.assistant.analytics.read | actions/analytics/analytics.campaign-conversion.ts |
| analytics.forecast | Прогноз. | generate | low | never | crm.assistant.analytics.read | actions/analytics/analytics.forecast.ts |
| analytics.find_growth_opportunities | Найти точки роста. | generate | low | never | crm.assistant.analytics.read | actions/analytics/analytics.find-growth-opportunities.ts |

### 8.20 Юридические документы

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| legal.view_documents | Показать юридические документы. | read | low | never | crm.legal.read | actions/legal/legal.view-documents.ts |
| legal.create_document | Создать юридический документ. | write | high | always | crm.legal.manage | actions/legal/legal.create-document.ts |
| legal.update_document | Изменить документ. | write | high | always | crm.legal.manage | actions/legal/legal.update-document.ts |
| legal.publish_version | Опубликовать версию документа. | system | critical | separate_sensitive_confirm | crm.legal.manage | actions/legal/legal.publish-version.ts |
| legal.archive_document | Архивировать документ. | write | high | always | crm.legal.manage | actions/legal/legal.archive-document.ts |
| legal.view_acceptances | Показать принятия документов. | read | medium | never | crm.legal.read | actions/legal/legal.view-acceptances.ts |
| legal.check_missing_acceptances | Проверить недостающие согласия. | read | medium | never | crm.legal.read | actions/legal/legal.check-missing-acceptances.ts |

### 8.21 Интеграции и webhooks

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| webhook.create_endpoint | Создать webhook endpoint. | system | high | always | crm.integrations.manage | actions/integrations/webhook.create-endpoint.ts |
| webhook.update_endpoint | Изменить webhook endpoint. | system | high | always | crm.integrations.manage | actions/integrations/webhook.update-endpoint.ts |
| webhook.disable_endpoint | Отключить webhook endpoint. | system | high | always | crm.integrations.manage | actions/integrations/webhook.disable-endpoint.ts |
| webhook.delete_endpoint | Удалить webhook endpoint. | system | critical | separate_sensitive_confirm | crm.integrations.manage | actions/integrations/webhook.delete-endpoint.ts |
| webhook.view_events | Показать события webhook. | read | low | never | crm.integrations.read | actions/integrations/webhook.view-events.ts |
| webhook.retry_delivery | Повторить доставку webhook. | write | medium | medium_plus | crm.integrations.manage | actions/integrations/webhook.retry-delivery.ts |
| integration.delivery_status | Показать статус доставки интеграции. | read | low | never | crm.integrations.read | actions/integrations/integration.delivery-status.ts |
| integration.unsubscribe | Отписать интеграцию/endpoint. | system | high | always | crm.integrations.manage | actions/integrations/integration.unsubscribe.ts |

### 8.22 Настройки агента

| Action | Meaning | Kind | Risk | Confirm | Permission | File |
|---|---|---:|---:|---:|---|---|
| agent.memory.view | Показать память агента. | read | medium | never | crm.assistant.memory.manage | actions/agent-settings/agent.memory-view.ts |
| agent.memory.update | Обновить память агента. | write | medium | medium_plus | crm.assistant.memory.manage | actions/agent-settings/agent.memory-update.ts |
| agent.memory.delete | Удалить запись памяти. | write | high | always | crm.assistant.memory.manage | actions/agent-settings/agent.memory-delete.ts |
| agent.policy.view | Показать политики агента. | read | medium | never | crm.assistant.autopilot.manage | actions/agent-settings/agent.policy-view.ts |
| agent.policy.update | Изменить политики агента. | system | high | always | crm.assistant.autopilot.manage | actions/agent-settings/agent.policy-update.ts |
| agent.autopilot.enable | Включить автопилот. | system | high | always | crm.assistant.autopilot.manage | actions/agent-settings/agent.autopilot-enable.ts |
| agent.autopilot.disable | Выключить автопилот. | system | high | always | crm.assistant.autopilot.manage | actions/agent-settings/agent.autopilot-disable.ts |
| agent.autopilot.set_level | Изменить уровень автопилота. | system | high | always | crm.assistant.autopilot.manage | actions/agent-settings/agent.autopilot-set-level.ts |
| agent.view_runs | Показать запуски агента. | read | medium | never | crm.assistant.runs.read | actions/agent-settings/agent.view-runs.ts |
| agent.view_trace | Показать trace запуска. | read | medium | never | crm.assistant.runs.read | actions/agent-settings/agent.view-trace.ts |
| agent.cancel_task | Отменить задачу агента. | system | high | always | crm.assistant.tasks.manage | actions/agent-settings/agent.cancel-task.ts |
| agent.resume_task | Продолжить задачу агента. | system | medium | medium_plus | crm.assistant.tasks.manage | actions/agent-settings/agent.resume-task.ts |

## 9. Definition checklist для каждого action

Каждый action-файл считается готовым только если:

- есть `name`;
- есть `domain`;
- есть `kind`;
- есть `status`;
- есть `risk`;
- есть `permission`;
- есть `description`;
- есть `requiredSlots`;
- есть `optionalSlots`;
- есть `plannerHints`;
- есть `preview` для write/system/export/generate, где применимо;
- есть `execute` для implemented write/system/export;
- есть account-scoped queries;
- есть typed errors;
- есть audit;
- есть тесты;
- действие добавлено в domain `index.ts`;
- действие попало в общий `crmAgentActionCatalog`.

## 10. Slot policy

Slot names должны быть стабильными и переиспользуемыми:

- entity ids: `clientId`, `appointmentId`, `serviceId`, `specialistId`, `locationId`, `reviewId`, `userId`.
- human queries: `clientQuery`, `serviceQuery`, `specialistQuery`, `locationQuery`.
- text fields: `name`, `description`, `bio`, `comment`, `replyText`, `bodyText`.
- time fields: `date`, `startAt`, `endAt`, `timezone`.
- money fields: `amount`, `currency`, `price`, `basePrice`.

Нельзя делать обязательными поля, которые не обязательны для минимального бизнес-действия. Пример:

- `specialist.create` требует только `name`.
- `specialist.assign_service` отдельно привязывает услугу.
- `schedule.set_workday` отдельно задает график.

## 11. Planner behavior

Planner должен:

- выбирать action из catalog;
- не придумывать action names;
- не требовать optional slots;
- если missing только optional slots, строить draft;
- если missing required slots, задавать один короткий уточняющий вопрос;
- не смешивать несколько write actions без необходимости;
- для сложной задачи строить план из нескольких actions, но подтверждать каждое опасное изменение.

## 12. UI behavior

Workspace должен показывать:

- context goal;
- pending actions;
- preview before/after;
- missing required slots;
- selectable candidates;
- plan trace;
- tool/action results;
- clear confirm/reject buttons.

Если action `planned` или `unsupported`, UI должен показывать понятное сообщение, а не пустые tabs.

## 13. Definition of Done для полного каталога

Каталог считается production-ready, когда:

1. Все actions из раздела 8 есть в `crmAgentActionCatalog`.
2. У каждого action есть корректный status.
3. Все read actions реализованы или явно marked `planned`.
4. Все write actions имеют preview policy.
5. Все implemented write actions имеют execute.
6. Все high/critical actions требуют confirmation.
7. Password/security/payment/legal/export actions имеют special policy.
8. Planner не планирует несуществующие actions.
9. Runtime не содержит action-specific бизнес-логики вне action files.
10. Inspector проверяет action status/permission/risk/slots.
11. Есть tests на catalog completeness.
12. Есть integration tests на ключевые end-to-end сценарии.
13. Старые `core/actions.ts`, action-specific sections в `draft-tools.ts` и `execute-tools.ts` удалены или стали compatibility exports.

