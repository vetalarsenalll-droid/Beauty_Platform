# CRM Agent v2: подробный план реализации

## 1. Цель

CRM Agent v2 должен стать внутренним агентом управления аккаунтом, похожим по принципу работы на Codex: пользователь пишет обычным языком, агент понимает цель, смотрит данные аккаунта, строит план, выполняет инструменты, уточняет неоднозначности, готовит изменения, получает подтверждение и применяет действия.

Это не чат-бот и не набор фраз в коде. Код описывает модель CRM, разрешенные действия, инструменты, правила безопасности и состояние задачи. GigaChat используется как планировщик и помощник рассуждения: он переводит свободный русский текст в структурированную цель и слоты.

Пример:

```text
Пользователь: Запиши Анну на маникюр на ближайшее время.

Planner:
goal = appointment.create
slots.client.query = "Анна"
slots.service.query = "маникюр"
slots.time.preference = "nearest"

Runtime:
1. найти клиента Анну;
2. если Анн несколько - уточнить;
3. найти услуги по "маникюр";
4. если услуг несколько - уточнить;
5. найти ближайшие окна;
6. показать варианты;
7. после выбора подготовить запись;
8. после подтверждения создать запись.
```

## 2. Важное ограничение: Аишу не трогаем

CRM Agent v2 не должен ломать клиентского ассистента онлайн-записи Аишу. Это отдельная система.

Не удалять и не переписывать в рамках CRM Agent v2:

```text
apps/web/lib/aisha-*
apps/web/lib/booking-flow.ts
apps/web/lib/booking-tools.ts
apps/web/lib/client-account-flow.ts
apps/web/lib/client-account-tools.ts
apps/web/lib/public-booking*
AiBookingDraft
OnlineBookingSession
OnlineBookingStep
AiSetting с ключами aisha.*
публичные API онлайн-записи
```

Не удалять CRM-страницы и API, которые управляют Аишей, AI-биллингом, AI-настройками и аналитикой онлайн-записи, даже если они сейчас находятся внутри старого раздела `/crm/assistant`:

```text
apps/web/app/(crm)/crm/assistant/site/**
apps/web/app/(crm)/crm/assistant/settings/**
apps/web/app/(crm)/crm/assistant/billing/**
apps/web/app/(crm)/crm/assistant/dialogs/**
apps/web/app/(crm)/crm/assistant/analytics/**
apps/web/app/(crm)/crm/analytics/aisha/**
apps/web/app/api/v1/site-builder/aisha-*/**
apps/web/app/api/v1/public/**
apps/web/app/api/v1/client/**
```

Если при удалении старого CRM Agent встречается файл в `/crm/assistant`, сначала определить его ответственность:

```text
CRM Agent старый -> удалить или заменить на v2.
Аиша / онлайн-запись / AI-биллинг / AI-настройки -> оставить.
Общий AI shell или навигация -> аккуратно обновить ссылку на новый /crm/agent, не ломая разделы Аиши.
```

Общую AI-инфраструктуру тоже не удалять:

```text
apps/web/lib/gigachat.ts
apps/web/lib/ai-billing.ts
apps/web/lib/ai-usage.ts
apps/web/lib/ai-settings.ts

AiUsage
AiBalanceLedger
AiProviderPool
AiAccessPackage
AiAccessPurchase
AiAccountAccess
AiSetting
```

## 3. Что удалить из старого CRM Agent

Старую реализацию CRM Agent удалить полностью, чтобы не было смешивания архитектур.

Удалить старые файлы:

```text
apps/web/lib/crm-agent-action-executor.ts
apps/web/lib/crm-agent-analytics-tools.ts
apps/web/lib/crm-agent-appointment-tools.ts
apps/web/lib/crm-agent-autopilot.ts
apps/web/lib/crm-agent-campaigns.ts
apps/web/lib/crm-agent-client-tools.ts
apps/web/lib/crm-agent-context.ts
apps/web/lib/crm-agent-domain-tools.ts
apps/web/lib/crm-agent-draft-tools.ts
apps/web/lib/crm-agent-insights.ts
apps/web/lib/crm-agent-llm-contract.ts
apps/web/lib/crm-agent-location-tools.ts
apps/web/lib/crm-agent-memory-tools.ts
apps/web/lib/crm-agent-memory.ts
apps/web/lib/crm-agent-notification-tools.ts
apps/web/lib/crm-agent-orchestrator.ts
apps/web/lib/crm-agent-persistence.ts
apps/web/lib/crm-agent-promo-tools.ts
apps/web/lib/crm-agent-review-tools.ts
apps/web/lib/crm-agent-runtime.ts
apps/web/lib/crm-agent-schedule-tools.ts
apps/web/lib/crm-agent-service-tools.ts
apps/web/lib/crm-agent-site-preview.ts
apps/web/lib/crm-agent-site-tools.ts
apps/web/lib/crm-agent-specialist-tools.ts
apps/web/lib/crm-agent-structured-response.ts
apps/web/lib/crm-agent-thread-continuation.ts
apps/web/lib/crm-agent-tool-registry.ts
apps/web/lib/crm-agent-types.ts
```

Удалить только старый UI и API CRM Agent. Не удалять весь `/crm/assistant/**` вслепую, потому что там есть страницы Аиши, AI-биллинга и общих AI-настроек.

Удалять или заменить на v2:

```text
apps/web/app/api/v1/crm/assistant/chat/route.ts
apps/web/app/api/v1/crm/assistant/thread*/**
apps/web/app/api/v1/crm/assistant/actions/**
apps/web/app/api/v1/crm/assistant/tasks/route.ts
apps/web/app/api/v1/crm/assistant/insights/**
apps/web/app/api/v1/crm/assistant/campaigns/route.ts
apps/web/app/api/v1/crm/assistant/autopilot/route.ts
apps/web/app/api/v1/crm/assistant/memory/route.ts
apps/web/app/api/v1/crm/assistant/drafts/**
apps/web/app/(crm)/crm/assistant/page.tsx
apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx
```

Оставить, пока не будет отдельного плана переноса:

```text
apps/web/app/(crm)/crm/assistant/site/**
apps/web/app/(crm)/crm/assistant/settings/**
apps/web/app/(crm)/crm/assistant/billing/**
apps/web/app/(crm)/crm/assistant/dialogs/**
apps/web/app/(crm)/crm/assistant/analytics/**
```

Удалить старые тесты CRM Agent:

```text
scripts/crm-agent-smoke.mjs
scripts/crm-agent-regression.mjs
```

Из worker удалить старые ветки CRM Agent и позже заменить worker v2:

```text
processCrmAgentOutbox
processCrmAgentCampaignNotification
syncCrmAgentCampaignConversions
старые обработки aiAgentCampaign / aiAgentNotificationDraft
```

## 4. Изменения в Prisma

### 4.1 Старые CRM Agent модели удалить

Удалить старые модели, относящиеся именно к текущему CRM Agent:

```prisma
AiPendingAction
AiAccountMemory
AiAccountInsight
AiAgentTask
AiAgentCampaign
AiAgentCampaignConversion
AiAgentNotificationDraft
AiAgentReviewDraft
AiAgentSiteDraft
AiAgentRun
AiAgentToolCall
AiAgentAudit
```

Не удалять без отдельной проверки:

```prisma
AiThread
AiThreadGroup
AiThreadState
AiMessage
AiAction
AiLog
AiLimit
AiBookingDraft
```

Причина: часть этих моделей может использоваться Аишей, публичной онлайн-записью или общей AI-инфраструктурой.

### 4.2 Новые модели CRM Agent v2

Новые модели должны иметь явный префикс `CrmAgent`, чтобы не смешиваться с Аишей и старым AI-слоем.

#### CrmAgentSession

Рабочая сессия внутреннего агента.

```prisma
model CrmAgentSession {
  id        Int      @id @default(autoincrement())
  accountId Int
  userId    Int?
  status    String   @default("ACTIVE") // ACTIVE, CLOSED, FAILED
  mode      String   @default("chat")   // chat, task, autopilot, daily_brief
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  messages  CrmAgentMessage[]
  states    CrmAgentState[]
  plans     CrmAgentPlan[]
  artifacts CrmAgentArtifact[]

  @@index([accountId, userId, status, updatedAt])
}
```

#### CrmAgentMessage

Сообщения внутреннего агента.

```prisma
model CrmAgentMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  role      String   // user, assistant, tool, system
  content   String
  data      Json?
  createdAt DateTime @default(now())

  session CrmAgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}
```

#### CrmAgentState

Текущее состояние задачи: цель, слоты, кандидаты, выбранные сущности, недостающие данные.

```prisma
model CrmAgentState {
  id         Int      @id @default(autoincrement())
  sessionId  Int
  accountId  Int
  goalType   String
  status     String   // collecting, resolving, needs_clarification, ready, done, failed
  slots      Json
  candidates Json?
  selected   Json?
  missing    Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  session CrmAgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([accountId, goalType, status])
  @@index([sessionId, updatedAt])
}
```

Пример `slots` для записи:

```json
{
  "client": {
    "query": "Анна",
    "phone": null,
    "selectedId": null
  },
  "service": {
    "query": "маникюр",
    "selectedId": null
  },
  "specialist": {
    "query": null,
    "selectedId": null
  },
  "location": {
    "selectedId": null
  },
  "time": {
    "preference": "nearest",
    "date": null,
    "selectedStartAt": null
  }
}
```

#### CrmAgentPlan

План выполнения задачи.

```prisma
model CrmAgentPlan {
  id        Int      @id @default(autoincrement())
  sessionId Int
  accountId Int
  goalType  String
  goal      Json
  status    String   // planned, running, needs_user, completed, failed
  result    Json?
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  session CrmAgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  steps   CrmAgentPlanStep[]

  @@index([accountId, status, createdAt])
  @@index([goalType])
}
```

#### CrmAgentPlanStep

Шаг плана.

```prisma
model CrmAgentPlanStep {
  id         Int      @id @default(autoincrement())
  planId     Int
  order      Int
  type       String   // read, resolve, draft, execute, inspect, clarify, generate
  toolName   String?
  args       Json?
  result     Json?
  status     String   // pending, running, done, failed, skipped
  error      String?
  startedAt  DateTime?
  finishedAt DateTime?
  createdAt  DateTime @default(now())

  plan CrmAgentPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@index([planId, order])
  @@index([status])
}
```

#### CrmAgentAction

Действие на подтверждение или выполнение.

```prisma
model CrmAgentAction {
  id          Int      @id @default(autoincrement())
  accountId   Int
  userId      Int?
  sessionId   Int?
  actionType  String
  summary     String
  payload     Json
  status      String   @default("PENDING") // PENDING, CONFIRMED, EXECUTED, REJECTED, FAILED, EXPIRED
  riskLevel   String
  permission  String?
  result      Json?
  error       String?
  expiresAt   DateTime?
  confirmedAt DateTime?
  executedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([accountId, status, createdAt])
  @@index([sessionId, status])
  @@index([actionType])
}
```

#### CrmAgentToolCall

Лог вызовов инструментов.

```prisma
model CrmAgentToolCall {
  id         Int      @id @default(autoincrement())
  accountId  Int
  sessionId  Int?
  planStepId Int?
  toolName   String
  args       Json
  result     Json?
  error      String?
  status     String   @default("RUNNING")
  startedAt  DateTime @default(now())
  finishedAt DateTime?

  @@index([accountId, toolName, startedAt])
  @@index([sessionId])
  @@index([planStepId])
}
```

#### CrmAgentArtifact

Карточки, варианты выбора, preview, отчеты, графики.

```prisma
model CrmAgentArtifact {
  id        Int      @id @default(autoincrement())
  accountId Int
  sessionId Int?
  planId    Int?
  type      String   // card, selection, report, preview, draft, chart
  title     String?
  data      Json
  createdAt DateTime @default(now())

  @@index([accountId, type, createdAt])
  @@index([sessionId])
  @@index([planId])
}
```

#### CrmAgentMemory

Память внутреннего агента.

```prisma
model CrmAgentMemory {
  id         Int      @id @default(autoincrement())
  accountId  Int
  key        String
  value      Json
  source     String?
  confidence Decimal  @default(1) @db.Decimal(5, 4)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([accountId, key])
  @@index([accountId, updatedAt])
}
```

#### CrmAgentInsight

Рекомендации и выводы агента.

```prisma
model CrmAgentInsight {
  id        Int      @id @default(autoincrement())
  accountId Int
  type      String
  title     String
  summary   String
  data      Json
  priority  Int      @default(0)
  status    String   @default("NEW")
  expiresAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([accountId, status, priority, createdAt])
  @@index([accountId, type, status])
}
```

#### CrmAgentTask

Долгосрочные задачи агента.

```prisma
model CrmAgentTask {
  id          Int      @id @default(autoincrement())
  accountId   Int
  sessionId   Int?
  type        String
  title       String
  description String?
  payload     Json
  status      String   @default("OPEN") // OPEN, IN_PROGRESS, DONE, DISMISSED, FAILED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([accountId, status, createdAt])
  @@index([accountId, type, status])
}
```

#### CrmAgentPolicy

Правила безопасности и автопилота.

```prisma
model CrmAgentPolicy {
  id        Int      @id @default(autoincrement())
  accountId Int
  key       String
  value     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([accountId, key])
}
```

#### CrmAgentKnowledgeSnapshot

Кэшированный срез аккаунта.

```prisma
model CrmAgentKnowledgeSnapshot {
  id        Int      @id @default(autoincrement())
  accountId Int
  type      String   // account, catalog, staff, schedule, marketing, site, analytics
  data      Json
  version   Int      @default(1)
  expiresAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([accountId, type])
  @@index([expiresAt])
}
```

#### CrmAgentCampaign

Кампании CRM Agent v2.

```prisma
model CrmAgentCampaign {
  id          Int      @id @default(autoincrement())
  accountId   Int
  title       String
  goal        String
  audience    Json
  offer       Json?
  content     Json
  channels    String[]
  status      String   @default("DRAFT")
  scheduledAt DateTime?
  sentAt      DateTime?
  result      Json?
  error       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  recipients CrmAgentCampaignRecipient[]

  @@index([accountId, status, createdAt])
  @@index([scheduledAt])
}
```

#### CrmAgentCampaignRecipient

```prisma
model CrmAgentCampaignRecipient {
  id         Int      @id @default(autoincrement())
  campaignId Int
  accountId  Int
  clientId   Int
  channel    String
  status     String   @default("PENDING")
  target     String?
  message    String
  result     Json?
  error      String?
  sentAt     DateTime?
  createdAt  DateTime @default(now())

  campaign CrmAgentCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([accountId, status, createdAt])
  @@index([campaignId, status])
  @@index([clientId, createdAt])
}
```

#### CrmAgentAudit

```prisma
model CrmAgentAudit {
  id         Int      @id @default(autoincrement())
  accountId  Int
  userId     Int?
  sessionId  Int?
  action     String
  targetType String?
  targetId   String?
  data       Json?
  createdAt  DateTime @default(now())

  @@index([accountId, createdAt])
  @@index([sessionId])
}
```

## 4.3 Account scope и постоянный контекст аккаунта

CRM Agent v2 всегда работает внутри одного текущего CRM-аккаунта. Граница работы агента - `accountId`, полученный из авторизованной CRM-сессии/API context. Пользователь не передает `accountId` свободным текстом, и агент не выбирает аккаунт сам.

Принцип:

```text
1. Каждый turn агента имеет обязательный accountId.
2. Все session/message/state/plan/action/toolCall/artifact/memory/insight/task/audit записи создаются с этим accountId или связаны с session этого accountId.
3. Все read tools, resolvers, draft tools и execute tools обязаны фильтровать данные по accountId.
4. Нельзя читать, показывать, планировать, подготавливать или выполнять действие с данными другого accountId.
5. Нельзя использовать id сущности без проверки, что сущность принадлежит текущему accountId.
6. Нельзя доверять accountId из prompt, message, tool args или UI payload, если он отличается от серверного auth context.
7. Conversation router, conversational layer, planner, inspector и runtime получают account context только для текущего accountId.
8. Memory агента, policies, insights, pending actions и knowledge snapshots изолированы по accountId.
9. Audit и tool trace должны сохранять accountId, чтобы любое действие было проверяемым.
```

Агент должен быть "погружен" в аккаунт, но это не означает загрузку всей базы в prompt на каждый turn. Правильная модель:

```text
account context:
  компактная сводка аккаунта, прав, настроек, локаций, услуг, активных задач, pending actions, памяти и последних сообщений.

read tools:
  безопасный доступ к полным данным текущего accountId по необходимости: клиенты, записи, услуги, специалисты, расписание, отзывы, акции, сайт, аналитика, память.

workspace:
  показывает только найденные или релевантные данные текущего accountId.
```

Обязательные проверки:

```text
auth accountId -> runtime input accountId
runtime accountId -> context loader
runtime accountId -> router/conversation/planner request
runtime accountId -> every tool context
tool context accountId -> every Prisma where clause
entity id -> ownership check by accountId before use
action payload entity ids -> ownership check before preview/execute
sessionId -> must belong to accountId before loading history/state/actions/artifacts
```

Запрещено:

```text
1. Передавать в LLM данные нескольких аккаунтов.
2. Делать global search без accountId.
3. Использовать accountId из пользовательского текста.
4. Сохранять CrmAgent* записи без accountId, если модель требует account scope.
5. Показывать в UI карточки/таблицы/preview, полученные не через account-scoped tool/context.
6. Выполнять action по id, если action.accountId != текущему accountId.
```

## 5. Структура нового кода

Создать отдельную директорию:

```text
apps/web/lib/crm-agent-v2/
```

Структура:

```text
apps/web/lib/crm-agent-v2/
  core/
    planner.ts
    runtime.ts
    context-loader.ts
    state.ts
    inspector.ts
    executor.ts
    policy.ts
    response.ts
    types.ts

  registry/
    actions.ts
    tools.ts
    permissions.ts

  tools/
    read/
      account.ts
      users.ts
      clients.ts
      appointments.ts
      group-sessions.ts
      schedule.ts
      services.ts
      specialists.ts
      locations.ts
      reviews.ts
      site.ts
      media.ts
      promos.ts
      loyalty.ts
      finance.ts
      notifications.ts
      marketing.ts
      analytics.ts
      legal.ts
      integrations.ts

    draft/
      account.ts
      users.ts
      clients.ts
      appointments.ts
      group-sessions.ts
      schedule.ts
      services.ts
      specialists.ts
      locations.ts
      reviews.ts
      site.ts
      media.ts
      promos.ts
      loyalty.ts
      finance.ts
      notifications.ts
      marketing.ts
      legal.ts
      integrations.ts

    execute/
      actions.ts
      appointments.ts
      schedule.ts
      clients.ts
      services.ts
      specialists.ts
      locations.ts
      reviews.ts
      site.ts
      users.ts
      marketing.ts

  resolvers/
    client.ts
    user.ts
    specialist.ts
    service.ts
    location.ts
    appointment.ts
    group-session.ts
    schedule.ts
    review.ts
    promo.ts
    payment.ts
    site.ts
    media.ts
    time.ts

  skills/
    account.ts
    users.ts
    clients.ts
    appointments.ts
    group-sessions.ts
    schedule.ts
    services.ts
    specialists.ts
    locations.ts
    reviews.ts
    site.ts
    media.ts
    promos.ts
    loyalty.ts
    finance.ts
    notifications.ts
    marketing.ts
    analytics.ts
    legal.ts
    integrations.ts
    agent-settings.ts
```

## 6. TypeScript контракты

### 6.1 Goal

```ts
export type CrmAgentGoal = {
  type: string;
  intent: "read" | "create" | "update" | "delete" | "analyze" | "notify" | "execute";
  confidence: number;
  slots: Record<string, unknown>;
  userFacingSummary: string;
};
```

### 6.2 Task State

```ts
export type CrmAgentTaskState = {
  sessionId: number;
  accountId: number;
  goalType: string;
  status:
    | "collecting"
    | "resolving"
    | "needs_clarification"
    | "ready_to_plan"
    | "ready_for_confirmation"
    | "completed"
    | "failed";
  slots: Record<string, CrmAgentSlot>;
  candidates: Record<string, CrmAgentCandidate[]>;
  selected: Record<string, number | string>;
  missing: string[];
};
```

### 6.3 Slot

```ts
export type CrmAgentSlot = {
  query?: string;
  value?: unknown;
  selectedId?: number | string | null;
  candidates?: CrmAgentCandidate[];
  status?: "empty" | "resolving" | "ambiguous" | "resolved" | "not_found";
};
```

### 6.4 Candidate

```ts
export type CrmAgentCandidate = {
  type: string;
  id: number | string;
  title: string;
  subtitle?: string | null;
  data?: unknown;
};
```

### 6.5 Action Definition

```ts
export type CrmAgentActionDefinition = {
  name: string;
  domain: string;
  intent: CrmAgentGoal["intent"];
  requiredSlots: string[];
  optionalSlots: string[];
  risk: "low" | "medium" | "high" | "critical";
  permission: string;
  skill: string;
  confirmation: "never" | "medium_plus" | "always";
};
```

### 6.6 UI Card

Агент отвечает не только текстом. Любой resolver/tool может вернуть карточки, таблицы, tabs, формы, preview и команды для интерактивной рабочей области.

```ts
export type CrmAgentCard = {
  type:
    | "client"
    | "service"
    | "specialist"
    | "location"
    | "appointment"
    | "slot"
    | "review"
    | "promo"
    | "action"
    | "preview"
    | "form"
    | "report";
  id?: number | string;
  title: string;
  subtitle?: string | null;
  data?: Record<string, unknown>;
  actions?: CrmAgentUiCommand[];
};
```

### 6.7 UI Workspace

Рабочая область справа/снизу хранит интерактивное состояние текущей задачи: выбранные сущности, форму редактирования, preview изменений и доступные команды.

```ts
export type CrmAgentUiWorkspace = {
  mode: "empty" | "select" | "form" | "preview" | "confirm" | "report" | "table";
  title?: string;
  tabs?: CrmAgentUiTab[];
  activeTabId?: string;
  cards?: CrmAgentCard[];
  form?: CrmAgentUiForm;
  preview?: CrmAgentUiPreview;
  commands?: CrmAgentUiCommand[];
};

export type CrmAgentUiTab = {
  id: string;
  title: string;
  badge?: number | string;
  cards?: CrmAgentCard[];
  table?: CrmAgentUiTable;
};

export type CrmAgentUiForm = {
  id: string;
  entityType: string;
  entityId?: number | string;
  fields: CrmAgentUiField[];
  submitCommand: string;
};

export type CrmAgentUiField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "datetime" | "select" | "multiselect" | "toggle";
  value?: unknown;
  required?: boolean;
  readonly?: boolean;
  helpText?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
};

export type CrmAgentUiTable = {
  columns: Array<{ key: string; title: string; type?: "text" | "number" | "date" | "money" | "status" }>;
  rows: Array<Record<string, unknown>>;
  selectedRowIds?: Array<number | string>;
  rowCommands?: CrmAgentUiCommand[];
};

export type CrmAgentUiPreview = {
  before?: Record<string, unknown>;
  after: Record<string, unknown>;
  diff?: Array<{ field: string; before: unknown; after: unknown }>;
};

export type CrmAgentUiCommand = {
  id: string;
  label: string;
  kind: "select" | "edit" | "save_draft" | "confirm" | "reject" | "run_tool" | "open";
  payload?: Record<string, unknown>;
  risk?: "low" | "medium" | "high" | "critical";
};
```

### 6.8 Tool Definition

```ts
export type CrmAgentToolDefinition = {
  name: string;
  mode: "read" | "draft" | "execute";
  domain: string;
  permission?: string;
  risk: "low" | "medium" | "high" | "critical";
  inputSchema: unknown;
  handler: (args: Record<string, unknown>, ctx: CrmAgentToolContext) => Promise<unknown>;
};
```

## 7. Planner

Planner вызывает GigaChat и возвращает только JSON. Он не отвечает пользователю напрямую.

### 7.1 Контракт planner prompt

```ts
const system = `
Ты CRM Agent Planner.
Ты не отвечаешь пользователю текстом.
Ты переводишь сообщение пользователя в structured goal.
Используй только action names из каталога.

Верни JSON:
{
  "type": "appointment.create",
  "intent": "create",
  "confidence": 0.0,
  "slots": {},
  "userFacingSummary": ""
}

Если просьба не относится к CRM или не поддерживается, верни:
{
  "type": "unsupported",
  "intent": "read",
  "confidence": 0.0,
  "slots": {},
  "userFacingSummary": "..."
}
`;
```

### 7.2 Примеры planner

```text
Запиши Анну на маникюр на ближайшее время
```

```json
{
  "type": "appointment.create",
  "intent": "create",
  "confidence": 0.91,
  "slots": {
    "client": { "query": "Анна" },
    "service": { "query": "маникюр" },
    "time": { "preference": "nearest" }
  },
  "userFacingSummary": "Создать запись для Анны на маникюр на ближайшее время"
}
```

```text
Поставь Марии завтра выходной
```

```json
{
  "type": "schedule.set_day_off",
  "intent": "update",
  "confidence": 0.93,
  "slots": {
    "specialist": { "query": "Мария" },
    "date": { "relative": "tomorrow" }
  },
  "userFacingSummary": "Поставить сотруднику Марии выходной на завтра"
}
```

```text
Обнови описание услуги Детская стрижка
```

```json
{
  "type": "service.update_description",
  "intent": "update",
  "confidence": 0.9,
  "slots": {
    "service": { "query": "Детская стрижка" },
    "description": null
  },
  "userFacingSummary": "Обновить описание услуги Детская стрижка"
}
```

## 8. Runtime

Runtime ведет задачу до результата.

### 8.1 Алгоритм

```ts
export async function runCrmAgent(input: RunCrmAgentInput) {
  const session = await loadOrCreateSession(input);
  const previousState = await loadActiveState(session.id);
  const accountContext = await loadAccountContext(input.accountId);

  const goal = await planner.plan({
    message: input.message,
    previousState,
    accountContext,
  });

  let state = await mergeGoalIntoState(previousState, goal);

  for (let i = 0; i < 12; i += 1) {
    const inspection = await inspectState(state, accountContext);

    if (inspection.kind === "needs_clarification") {
      await saveState(state);
      return buildClarificationResponse(inspection);
    }

    if (inspection.kind === "ready_to_plan") {
      const plan = await buildPlan(state, accountContext);
      const result = await executePlan(plan, accountContext);
      state = await applyExecutionResult(state, result);
      continue;
    }

    if (inspection.kind === "ready_for_confirmation") {
      const action = await createActionFromState(state, accountContext);
      await saveState(state);
      return buildActionPreviewResponse(action);
    }

    if (inspection.kind === "completed") {
      await saveState(state);
      return buildCompletedResponse(state);
    }
  }

  return buildFailedResponse("Агент остановлен: слишком много шагов без результата.");
}
```

### 8.2 Что runtime обязан сохранять

```text
session
message
goal
state
plan
steps
tool calls
artifacts
actions
audit
```

## 9. Resolvers

Resolvers ищут сущности и возвращают один из статусов:

```ts
type ResolveResult =
  | { status: "resolved"; id: number | string; entity: unknown }
  | { status: "ambiguous"; question: string; candidates: CrmAgentCandidate[] }
  | { status: "not_found"; question: string; canCreate?: boolean; draft?: unknown }
  | { status: "missing"; question: string };
```

### 9.1 Client resolver

```ts
export async function resolveClient(slot, ctx): Promise<ResolveResult> {
  if (slot.selectedId) {
    const client = await findClientById(ctx.accountId, slot.selectedId);
    if (client) return { status: "resolved", id: client.id, entity: client };
  }

  const candidates = await searchClients({
    accountId: ctx.accountId,
    query: slot.query,
    phone: slot.phone,
    email: slot.email,
  });

  if (candidates.length === 0) {
    if (slot.phone) {
      return {
        status: "not_found",
        question: `Клиента с номером ${slot.phone} нет. Создать нового клиента?`,
        canCreate: true,
        draft: { firstName: slot.query, phone: slot.phone },
      };
    }

    return {
      status: "missing",
      question: "Какого клиента выбрать? Укажите имя или телефон.",
    };
  }

  if (candidates.length === 1) {
    return { status: "resolved", id: candidates[0].id, entity: candidates[0] };
  }

  return {
    status: "ambiguous",
    question: "Нашёл несколько клиентов. Кого выбрать?",
    candidates: candidates.map(clientToCandidate),
  };
}
```

### 9.2 Service resolver

```ts
if no services -> "Не нашёл услугу. Уточните название?"
if one service -> resolved
if many services -> "Какую именно услугу выбрать?"
```

### 9.3 Specialist resolver

```ts
Мария -> Мария Иванова / Мария Петрова -> уточнение.
```

### 9.4 Time resolver

Поддержать:

```text
сегодня
завтра
послезавтра
в пятницу
28 мая
после 16
до обеда
утром
вечером
ближайшее время
первое свободное
```

### 9.5 Appointment resolver

Ищет запись по:

```text
id
клиент
дата
услуга
специалист
последняя/следующая запись
выбранная карточка
```

## 10. Inspector

Inspector смотрит на state и решает следующий шаг.

```ts
export type Inspection =
  | { kind: "needs_clarification"; question: string; options?: CrmAgentCandidate[] }
  | { kind: "ready_to_plan" }
  | { kind: "ready_for_confirmation" }
  | { kind: "completed" }
  | { kind: "failed"; error: string };
```

Правила:

```text
обязательный slot пустой -> спросить
resolver вернул ambiguous -> показать варианты
resolver вернул not_found + canCreate -> предложить создать
все slots resolved -> строить план
draft создан -> ждать подтверждения
action executed -> completed
```

## 11. Policy

Каждое действие имеет риск и правило подтверждения.

```text
low: можно выполнять автоматически, если autopilot разрешен
medium: обычно draft + подтверждение
high: всегда подтверждение
critical: подтверждение + дополнительная проверка
```

Critical:

```text
user.change_own_password
user.reset_password
permission.assign
permission.revoke
finance.refund
campaign.send массовая
service.update_price
appointment.cancel
account.export_data
webhook.delete_endpoint
```

Пример:

```ts
export function canExecute(action, policy, user) {
  if (!user.permissions.includes(action.permission)) return deny("missing_permission");
  if (action.risk === "critical") return requireConfirmation("critical_action");
  if (action.risk === "high") return requireConfirmation("high_risk");
  if (policy.autopilot === "execute_safe" && action.risk === "low") return allow();
  return requireConfirmation("default");
}
```

## 12. Action Registry

Фразы бесконечны, действия конечны. Все разрешенные действия описываются здесь.

Пример:

```ts
export const ACTIONS = {
  "appointment.create": {
    domain: "appointments",
    intent: "create",
    requiredSlots: ["client", "service", "time"],
    optionalSlots: ["specialist", "location", "comment", "price"],
    risk: "high",
    permission: "crm.appointments.create",
    confirmation: "always",
    skill: "appointments",
  },

  "schedule.set_day_off": {
    domain: "schedule",
    intent: "update",
    requiredSlots: ["specialist", "date"],
    optionalSlots: ["reason"],
    risk: "high",
    permission: "crm.schedule.update",
    confirmation: "always",
    skill: "schedule",
  },

  "service.update_description": {
    domain: "services",
    intent: "update",
    requiredSlots: ["service", "description"],
    optionalSlots: [],
    risk: "medium",
    permission: "crm.services.update",
    confirmation: "medium_plus",
    skill: "services",
  },
};
```

## 13. Полный каталог действий

### 13.1 Аккаунт

```text
account.view
account.update_name
account.update_slug
account.update_status
account.update_business_type
account.update_profile
account.update_contacts
account.update_address
account.update_branding
account.update_logo
account.update_colors
account.update_public_description
account.update_booking_rules
account.update_cancellation_rules
account.update_reschedule_rules
account.update_deposit_rules
account.update_review_rules
account.view_audit
account.export_data
```

### 13.2 Пользователи, роли, пароль

```text
user.search
user.view
user.invite
user.create
user.update_profile
user.update_email
user.update_phone
user.change_role
user.activate
user.deactivate
user.reset_password
user.change_own_password
user.revoke_sessions
user.link_identity
user.unlink_identity

role.search
role.create
role.update
role.delete
permission.assign
permission.revoke
permission.view_matrix
```

Правило безопасности:

```text
Пароль нельзя менять молча.
user.change_own_password доступен только текущему пользователю.
user.reset_password отправляет reset-flow или требует отдельного подтверждения.
```

### 13.3 Клиенты

```text
client.search
client.view
client.resolve
client.create
client.update
client.archive
client.restore
client.add_contact
client.update_contact
client.delete_contact
client.add_note
client.update_note
client.delete_note
client.add_tag
client.remove_tag
client.create_tag
client.merge_duplicates
client.view_history
client.view_visits
client.view_payments
client.view_reviews
client.view_loyalty
client.update_consent
client.notify
client.create_segment
client.export_segment
```

### 13.4 Записи

```text
appointment.search
appointment.view
appointment.resolve
appointment.find_slots
appointment.hold_slot
appointment.release_hold
appointment.create
appointment.reschedule
appointment.cancel
appointment.confirm
appointment.mark_done
appointment.mark_no_show
appointment.change_client
appointment.change_service
appointment.change_specialist
appointment.change_location
appointment.change_time
appointment.change_price
appointment.change_duration
appointment.add_comment
appointment.update_comment
appointment.view_conflicts
appointment.view_history
```

### 13.5 Групповые записи

```text
group_session.search
group_session.view
group_session.create
group_session.update
group_session.cancel
group_session.change_capacity
group_session.change_price
group_session.add_participant
group_session.remove_participant
group_session.update_participant_status
group_session.mark_participant_done
group_session.mark_participant_no_show
```

### 13.6 График

```text
schedule.search
schedule.view_day
schedule.view_week
schedule.view_month
schedule.set_workday
schedule.set_day_off
schedule.set_vacation
schedule.add_break
schedule.update_break
schedule.remove_break
schedule.block_slot
schedule.unblock_slot
schedule.copy_day
schedule.copy_week
schedule.create_template
schedule.update_template
schedule.delete_template
schedule.apply_template
schedule.create_non_working_type
schedule.update_non_working_type
schedule.delete_non_working_type
schedule.find_empty_windows
schedule.find_overlaps
```

### 13.7 Услуги

```text
service.search
service.view
service.resolve
service.create
service.update
service.update_name
service.update_description
service.generate_description
service.update_price
service.update_duration
service.update_booking_type
service.activate
service.archive
service.restore
service.delete_if_empty
service.assign_specialist
service.unassign_specialist
service.assign_location
service.unassign_location
service.add_variant
service.update_variant
service.delete_variant
service.create_category
service.update_category
service.delete_category
service.move_to_category
service.update_level_config
service.attach_media
service.detach_media
```

### 13.8 Сотрудники

```text
specialist.search
specialist.view
specialist.resolve
specialist.create
specialist.update
specialist.update_bio
specialist.generate_bio
specialist.update_avatar
specialist.set_public
specialist.hide
specialist.assign_service
specialist.unassign_service
specialist.assign_location
specialist.unassign_location
specialist.assign_category
specialist.remove_category
specialist.set_level
specialist.view_workload
specialist.view_revenue
specialist.view_reviews
specialist.view_empty_slots
```

### 13.9 Локации

```text
location.search
location.view
location.resolve
location.create
location.update
location.update_name
location.update_address
location.update_phone
location.update_description
location.generate_description
location.activate
location.deactivate
location.update_hours
location.add_exception
location.remove_exception
location.assign_manager
location.remove_manager
location.attach_media
location.detach_media
location.view_schedule
location.view_workload
```

### 13.10 Отзывы

```text
review.search
review.view
review.resolve
review.find_negative
review.find_unanswered
review.reply
review.generate_reply
review.update_reply
review.delete_reply
review.change_status
review.bulk_update_status
review.attach_reply_media
review.remove_reply_media
review.analyze_complaints
review.suggest_process_fix
```

### 13.11 Сайт и SEO

```text
site.health
site.view_public_page
site.create_public_page
site.update_public_page
site.archive_public_page
site.create_section
site.update_section
site.delete_section
site.create_block
site.update_block
site.delete_block
site.update_home_copy
site.update_service_copy
site.update_specialist_copy
site.update_location_copy
site.update_contacts
site.update_booking_settings
site.update_seo_global
site.update_seo_page
site.generate_missing_descriptions
site.preview_changes
site.apply_changes
```

### 13.12 Домены

```text
domain.search
domain.add
domain.check
domain.set_primary
domain.remove
domain.view_dns_status
```

### 13.13 Медиа

```text
media.search
media.upload
media.update_alt
media.update_metadata
media.create_collection
media.update_collection
media.delete_collection
media.link_to_account
media.link_to_service
media.link_to_specialist
media.link_to_location
media.unlink
media.archive
```

### 13.14 Акции и промокоды

```text
promo.search
promo.view
promo.resolve
promo.create
promo.update
promo.activate
promo.deactivate
promo.archive
promo.restore
promo.create_code
promo.update_code
promo.disable_code
promo.view_redemptions
promo.suggest_for_retention
promo.suggest_for_empty_slots
promo.suggest_for_birthday
```

### 13.15 Лояльность, подарочные карты, абонементы

```text
loyalty.view_wallet
loyalty.adjust_balance
loyalty.create_rule
loyalty.update_rule
loyalty.disable_rule
loyalty.view_transactions

gift_card.search
gift_card.create
gift_card.update
gift_card.activate
gift_card.cancel

membership.search
membership.create
membership.update
membership.activate
membership.cancel
membership.redeem
```

### 13.16 Финансы

```text
finance.view_revenue
finance.view_payments
finance.view_refunds
finance.view_receipts
finance.find_unpaid
finance.view_client_balance
finance.revenue_by_service
finance.revenue_by_specialist
finance.revenue_by_location
finance.reconcile_appointment

payment_intent.search
payment_intent.create
payment_intent.cancel
refund.create
receipt.view
receipt.resend
```

### 13.17 Уведомления

```text
notification.search
notification.view
notification.send_client
notification.send_segment
notification.create_template
notification.update_template
notification.delete_template
notification.update_preferences
notification.preview
notification.retry_failed
outbox.search
outbox.retry
delivery.view_status
```

### 13.18 Маркетинг

```text
campaign.create_retention
campaign.create_reactivation
campaign.create_repeat_visit
campaign.create_empty_slots
campaign.create_birthday
campaign.create_seasonal
campaign.preview_audience
campaign.update_audience
campaign.update_offer
campaign.update_message
campaign.schedule
campaign.send
campaign.pause
campaign.cancel
campaign.view_results
campaign.analyze_conversions
```

### 13.19 Аналитика

```text
analytics.attention_review
analytics.daily_brief
analytics.weekly_brief
analytics.workload
analytics.revenue
analytics.retention
analytics.no_show_rate
analytics.cancellations
analytics.empty_windows
analytics.underloaded_specialists
analytics.declining_services
analytics.top_services
analytics.top_clients
analytics.review_themes
analytics.campaign_conversion
analytics.forecast
analytics.find_growth_opportunities
```

### 13.20 Юридические документы

```text
legal.view_documents
legal.create_document
legal.update_document
legal.publish_version
legal.archive_document
legal.view_acceptances
legal.check_missing_acceptances
```

### 13.21 Интеграции и webhooks

```text
webhook.create_endpoint
webhook.update_endpoint
webhook.disable_endpoint
webhook.delete_endpoint
webhook.view_events
webhook.retry_delivery
integration.delivery_status
integration.unsubscribe
```

### 13.22 Настройки агента

```text
agent.memory.view
agent.memory.update
agent.memory.delete
agent.policy.view
agent.policy.update
agent.autopilot.enable
agent.autopilot.disable
agent.autopilot.set_level
agent.view_runs
agent.view_trace
agent.cancel_task
agent.resume_task
```

## 14. Tools

Для каждого действия должны быть инструменты:

```text
read tool - безопасно читает
draft tool - готовит CrmAgentAction
execute tool - выполняет подтвержденное действие
```

Пример read:

```ts
export async function searchClients(args, ctx) {
  return prisma.client.findMany({
    where: {
      accountId: ctx.accountId,
      OR: [
        { firstName: { contains: args.query, mode: "insensitive" } },
        { lastName: { contains: args.query, mode: "insensitive" } },
        { phone: normalizePhone(args.phone) },
      ],
    },
    take: 20,
  });
}
```

Пример draft:

```ts
export async function draftAppointmentCreate(args, ctx) {
  return createCrmAgentAction({
    accountId: ctx.accountId,
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    actionType: "appointment.create",
    summary: `Создать запись: ${args.clientName}, ${args.serviceName}, ${args.startAt}`,
    payload: args,
    riskLevel: "high",
    permission: "crm.appointments.create",
  });
}
```

Пример execute:

```ts
export async function executeAppointmentCreate(action, ctx) {
  const payload = action.payload;
  return prisma.appointment.create({
    data: {
      accountId: ctx.accountId,
      clientId: payload.clientId,
      serviceId: payload.serviceId,
      specialistId: payload.specialistId,
      locationId: payload.locationId,
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt),
      priceTotal: payload.priceTotal,
      durationTotalMin: payload.durationTotalMin,
      source: "crm_agent",
    },
  });
}
```

## 15. Skills

Skills строят планы по доменам.

### appointment.create

```ts
export async function planAppointmentCreate(state) {
  return [
    { type: "resolve", resolver: "client", slot: "client" },
    { type: "resolve", resolver: "service", slot: "service" },
    { type: "resolve", resolver: "specialist", slot: "specialist", optional: true },
    { type: "resolve", resolver: "location", slot: "location", optional: true },
    { type: "read", tool: "schedule.find_slots" },
    { type: "clarify", when: "slot_not_selected" },
    { type: "draft", tool: "appointment.create" },
  ];
}
```

### schedule.set_day_off

```ts
export async function planSetDayOff() {
  return [
    { type: "resolve", resolver: "specialist", slot: "specialist" },
    { type: "resolve", resolver: "date", slot: "date" },
    { type: "draft", tool: "schedule.set_day_off" },
  ];
}
```

### service.update_description

```ts
export async function planUpdateServiceDescription(state) {
  return [
    { type: "resolve", resolver: "service", slot: "service" },
    { type: "generate", when: "description_requested_auto" },
    { type: "clarify", when: "description_missing" },
    { type: "preview" },
    { type: "draft", tool: "service.update_description" },
  ];
}
```

## 16. API v2

Создать новые route:

```text
apps/web/app/api/v1/crm/agent-v2/chat/route.ts
apps/web/app/api/v1/crm/agent-v2/actions/[id]/confirm/route.ts
apps/web/app/api/v1/crm/agent-v2/actions/[id]/reject/route.ts
apps/web/app/api/v1/crm/agent-v2/sessions/route.ts
apps/web/app/api/v1/crm/agent-v2/sessions/[id]/route.ts
apps/web/app/api/v1/crm/agent-v2/artifacts/route.ts
apps/web/app/api/v1/crm/agent-v2/policies/route.ts
apps/web/app/api/v1/crm/agent-v2/interactions/route.ts
```

Chat response:

```ts
{
  answer: string;
  sessionId: number;
  state: CrmAgentTaskState;
  cards: CrmAgentCard[];
  workspace: CrmAgentUiWorkspace;
  clarification?: {
    question: string;
    options: CrmAgentCard[];
  };
  actionPreview?: CrmAgentAction;
  planTrace: CrmAgentPlanStep[];
}
```

Interactive command request:

```ts
{
  sessionId: number;
  commandId: string;
  payload?: Record<string, unknown>;
}
```

Пример: пользователь кликом выбирает карточку услуги, переключает tab, правит поле формы, сохраняет draft или подтверждает действие. UI отправляет это как `command`, runtime обновляет state и возвращает новый `workspace`.

## 17. UI v2

Создать новый UI как рабочее место CRM Agent, а не только чат. Диалог нужен для свободного ввода, но основное взаимодействие должно быть интерактивным: карточки, tabs, формы, таблицы, preview, выбор вариантов кликом и подтверждение действий.

```text
apps/web/app/(crm)/crm/agent/page.tsx
apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx
```

Структура экрана:

```text
левая колонка: сессии и задачи
центр: диалог + рабочая область результата текущего шага
правая колонка: active task, selected entities, plan trace, action preview, audit
нижняя/встроенная зона: карточки, tabs, таблицы, формы и preview
```

UI должен показывать:

```text
карточки клиентов
карточки услуг
карточки сотрудников
карточки локаций
карточки свободных окон
карточки отзывов
preview изменений до/после
кнопки подтвердить/отклонить
trace плана
```

### 17.1 Принцип взаимодействия

Агент не должен ограничиваться текстовым ответом. Каждый ответ может включать `workspace`, который UI отображает как интерактивный интерфейс.

```text
Пользователь пишет свободным текстом -> conversation router определяет тип реплики.
Если это обычный диалог или общий CRM-вопрос -> conversational layer отвечает без planner.
Если это CRM-задача или продолжение активной задачи -> planner определяет цель -> runtime возвращает текст + workspace.
Пользователь кликает карточку / tab / кнопку / редактирует форму -> UI отправляет command.
Runtime применяет command к state -> возвращает обновленный workspace.
Опасное действие всегда проходит через action preview и подтверждение.
```

### 17.1.1 Conversation-first слой

CRM Agent v2 должен ощущаться как внутренний агент, погруженный в аккаунт CRM, по принципу Codex в VS Code: пользователь свободно пишет, агент понимает контекст, ведет нормальный диалог, сам решает когда нужно читать данные, когда строить план, когда уточнять, когда подготовить изменение и когда ждать подтверждения. Это не intent-bot, не scripted bot и не набор заранее прописанных фраз.

Planner является инструментом для задач, но не первым и не единственным режимом ответа. Основной входной слой должен быть conversation-first: сначала понять реплику и состояние диалога, затем выбрать режим работы.

Перед planner должен работать `conversation router`, который классифицирует входящее сообщение:

```text
smalltalk:
  приветствие, благодарность, короткие человеческие реплики, проверка "ты тут?"
  Ответ: живой короткий ответ без создания CrmAgentPlan.

crm_question:
  общий вопрос по CRM/аккаунту без намерения менять данные.
  Примеры: "что у нас сегодня?", "как дела с записями?", "что посоветуешь улучшить?"
  Ответ: conversational layer может читать account context и безопасные read tools, но не создает action draft.

crm_task:
  явная задача найти, создать, изменить, записать, отменить, подготовить, отправить, опубликовать.
  Ответ: planner строит goal/slots/steps, runtime выполняет read/draft steps и возвращает workspace.

task_continuation:
  пользователь продолжает активную задачу: выбирает вариант текстом, уточняет слот, просит поправить draft.
  Ответ: runtime использует latest CrmAgentState и решает, нужен ли command handler, planner или conversational clarification.

unsupported:
  запрос вне CRM, опасный или невозможный в текущих правах.
  Ответ: объяснить ограничение и предложить CRM-релевантный следующий шаг.
```

Требования к conversation layer:

```text
1. Не создавать CrmAgentPlan для smalltalk и простых общих ответов.
2. Не использовать hardcoded phrase lists, regex или keyword rules как основной механизм общения.
3. Router и conversational layer должны быть LLM-first: модель классифицирует реплику и генерирует естественный ответ на основе prompt, history, account context и state.
4. Regex/keyword fallback допустим только как аварийный degradation path при недоступности LLM, а не как продуктовая логика.
5. Использовать историю session и компактный account context, чтобы ответы были привязаны к текущему салону/аккаунту.
6. Для crm_question уметь вызывать только read tools или context-loader, без draft/execute.
7. Для crm_task передавать управление planner с явной причиной routing decision.
8. Для task_continuation учитывать latest CrmAgentState, выбранные слоты, pending actions и последний workspace.
9. Сохранять assistant messages так же, как task responses, но помечать data.mode = conversation|question|task.
10. UI должен показывать обычный диалог без пустого "Плана" и без технического workspace, если плана нет.
11. Запрещено расширять поведение добавлением новых if/else на фразы пользователя, кроме явно помеченного fallback слоя.
```

Новые модули:

```text
apps/web/lib/crm-agent-v2/core/conversation-router.ts
apps/web/lib/crm-agent-v2/core/conversation.ts
apps/web/lib/crm-agent-v2/core/conversation-prompts.ts
```

Минимальный контракт router:

```ts
type CrmAgentRouteKind =
  | "smalltalk"
  | "crm_question"
  | "crm_task"
  | "task_continuation"
  | "unsupported";

type CrmAgentRouteDecision = {
  kind: CrmAgentRouteKind;
  confidence: number;
  reason: string;
  suggestedGoalType?: string;
  needsAccountContext: boolean;
  allowedToolModes: Array<"read" | "draft" | "execute">;
};
```

Router должен вызываться через отдельный LLM prompt, а не через набор regex:

```text
System:
Ты входной router CRM Agent v2. Ты не отвечаешь пользователю и не строишь план.
Твоя задача - понять тип следующего шага в диалоге по сообщению, истории, state и CRM-контексту.
Верни строгий JSON CrmAgentRouteDecision.
Не классифицируй общую человеческую реплику как crm_task.
Не отправляй в planner вопрос, если пользователь не просит выполнить CRM-действие.
Если пользователь спрашивает о состоянии CRM, выбери crm_question и read-only mode.
Если пользователь продолжает текущую задачу короткой репликой, выбери task_continuation.
```

Минимальный контракт conversational ответа:

```ts
type CrmAgentConversationResponse = {
  answer: string;
  workspace?: CrmAgentUiWorkspace;
  usedTools?: Array<{ toolName: string; status: string }>;
  shouldEscalateToPlanner: boolean;
  plannerHint?: string;
};
```

Conversational layer должен вызываться через отдельный LLM prompt:

```text
System:
Ты CRM Agent v2 внутри аккаунта салона. Общайся естественно, как рабочий агент в CRM, похожий по роли на Codex в VS Code.
Ты можешь обсуждать CRM-контекст, объяснять возможности, задавать уточняющие вопросы и давать read-only сводки.
Не создавай план и не обещай изменение, если пользователь не попросил задачу.
Не выполняй и не готовь изменения без planner/action preview/confirmation.
Не говори шаблонными бот-фразами и не раскрывай внутренний routing.
```

Примеры ожидаемого поведения:

```text
User: Привет
Agent: Привет. Я на месте. Могу помочь с записями, клиентами, услугами, расписанием, отзывами или просто разобраться, что сейчас происходит в салоне.
Result: no CrmAgentPlan, workspace.mode = "conversation" или empty.

User: Что у нас сегодня по записям?
Agent: Смотрит context/read tools, отвечает сводкой, может показать таблицу записей. Не создает action draft.

User: Запиши Анну на маникюр завтра
Agent: route=crm_task -> planner -> runtime -> workspace с клиентами/услугами/окнами/preview.

User: Выбери вторую Анну
Agent: route=task_continuation -> применяет выбор к latest state или просит уточнить, если контекст потерян.
```

### 17.2 Интерактивные элементы

Поддержать в первом релизе:

```text
tabs: варианты, выбранное, история, preview, trace
cards: клиенты, услуги, сотрудники, локации, окна, записи, отзывы, акции
forms: редактирование услуги, клиента, записи, графика, сайта, уведомления
tables: списки клиентов, записей, отзывов, платежей, кампаний
diff preview: старое значение / новое значение / измененные поля
inline editor: textarea/input/select/toggle/date/datetime
commands: выбрать, открыть, изменить, сохранить draft, подтвердить, отклонить
```

### 17.3 Пример: обновление описания услуги

```text
User: Обнови описание услуги Детская стрижка.
Agent:
  answer: "Нашёл услугу. Можно отредактировать описание вручную или попросить меня предложить текст."
  workspace.mode = "form"
  workspace.form:
    entityType = "service"
    entityId = service.id
    fields:
      name: readonly text
      currentDescription: readonly textarea
      newDescription: textarea
    commands:
      generate_description
      save_draft
      confirm
```

Пользователь может:

```text
1. Напечатать новое описание сам.
2. Нажать "Предложить текст", агент заполнит поле.
3. Внести правки в предложенный текст.
4. Нажать "Сохранить draft".
5. Посмотреть preview до/после.
6. Подтвердить применение.
```

Фактическое изменение в БД выполняется только после `CrmAgentAction` и policy-check.

### 17.4 Пример: запись клиента

```text
User: Запиши Анну на маникюр на ближайшее время.
Agent:
  tab "Клиенты": карточки найденных Анн
  tab "Услуги": карточки услуг по маникюру
  tab "Окна": карточки свободных слотов
```

Пользователь выбирает клиента, услугу и окно кликами. После выбора всех обязательных слотов агент показывает preview записи и кнопку подтверждения.

### 17.5 Пример: массовая рассылка

```text
User: Сделай рассылку клиентам, которые не были 60 дней.
Agent:
  tab "Аудитория": таблица клиентов и фильтры
  tab "Сообщение": textarea с текстом
  tab "Preview": пример SMS/email/Telegram
  tab "Риски": лимиты, стоимость, размер аудитории
```

Отправка массовой кампании всегда `high` или `critical` и требует подтверждения.

### 17.6 Требования к UI-состоянию

```text
Диалог и workspace должны жить в одной session.
Любой клик должен сохраняться в state или artifact.
Форма не должна терять введенный пользователем текст при обновлении ответа агента.
Каждый draft должен иметь preview до/после.
Если пользователь пишет текстом вместо клика, runtime должен уметь применить это как command к текущему workspace.
Если пользователь кликает вместо ответа текстом, runtime должен продолжить тот же план.
```

### 17.7 Покрытие доменов интерактивом

Для каждого домена из action registry нужно определить стандартный UI-паттерн:

```text
read/search -> cards или table + filters + open/select commands
resolve ambiguous -> cards/table с select command
create/update -> form + save_draft + preview
delete/archive/cancel/send/refund -> risk preview + confirm/reject
generate text -> form textarea + generate command + ручная правка + preview
analytics/report -> tabs + table/chart cards + follow-up commands
campaign/bulk actions -> audience table + message editor + cost/risk preview + confirm
site/content edits -> before/after preview + editable fields + apply action
schedule edits -> calendar/slot cards + conflict preview + confirm
```

Если для действия нет интерактивного паттерна, оно считается не готовым для v2 UI, даже если текстовый runtime уже умеет его выполнить.

## 18. Worker v2

Добавить worker jobs:

```text
crm_agent_v2.expire_actions
crm_agent_v2.daily_brief
crm_agent_v2.weekly_brief
crm_agent_v2.refresh_knowledge_snapshots
crm_agent_v2.generate_insights
crm_agent_v2.send_campaigns
crm_agent_v2.sync_campaign_conversions
crm_agent_v2.retry_outbox
```

Worker v2 должен использовать только `CrmAgent*` таблицы.

## 19. Тесты

Новые тесты должны быть диалоговыми, а не regex-проверками.
Для UI дополнительно нужны сценарии интерактивного workspace: выбор карточек кликом, редактирование форм, переключение tabs, сохранение draft и подтверждение action.

### 19.1 Запись клиента

```text
User: Запиши Анну на маникюр на ближайшее время.
Expected:
planner -> appointment.create
client resolver -> ambiguous если несколько Анн
service resolver -> ambiguous если несколько маникюров
slot finder -> карточки окон
select slot -> draft action
confirm -> appointment created
```

### 19.2 Новый клиент

```text
User: Запиши Анну 89823458765 на маникюр.
Expected:
client search by phone -> not found
ask create client
create client action
continue appointment task
```

### 19.3 Выходной сотруднику

```text
User: Поставь Марии завтра выходной.
Expected:
planner -> schedule.set_day_off
specialist resolver -> ambiguous если две Марии
date resolver -> tomorrow
draft schedule action
confirm -> schedule updated
```

### 19.4 Описание услуги

```text
User: Обнови описание услуги Детская стрижка.
Agent: Что написать?
User: Придумай сам.
Agent: preview
User: Ок, обнови.
Expected:
service.update_description action executed after confirmation/policy
```

UI expected:

```text
workspace.mode -> form
form содержит старое описание и поле нового описания
generate_description заполняет новое описание
пользователь может вручную изменить textarea
save_draft показывает preview до/после
confirm выполняет CrmAgentAction
```

### 19.5 Пароль

```text
User: Поменяй мой пароль.
Expected:
planner -> user.change_own_password
policy -> critical
requires verification/reset flow
no silent password change
```

### 19.6 Ежедневный обзор

```text
User: Что сегодня требует внимания?
Expected:
planner -> analytics.attention_review
reads pending actions, insights, slots, reviews, retention
returns prioritized account-specific answer
```

### 19.7 Интерактивный выбор без текстового ответа

```text
User: Запиши Анну на маникюр на ближайшее время.
Expected:
workspace показывает tabs Клиенты / Услуги / Окна
user click client card -> state.selected.client
user click service card -> state.selected.service
user click slot card -> state.selected.time
agent shows appointment preview
confirm -> appointment created
```

### 19.8 Интерактивная правка draft

```text
User: Подготовь рассылку клиентам, которые давно не были.
Expected:
workspace показывает tab Аудитория, Сообщение, Preview, Риски
user edits message textarea
save_draft -> CrmAgentAction PENDING
preview shows final message and audience count
confirm -> campaign scheduled/sent according to selected command
```

## 20. Порядок реализации

Во время реализации этот список должен быть рабочим чеклистом. После каждого законченного шага обновлять статус прямо в этом файле: что выполнено, что проверено, какие файлы изменены и какой следующий шаг.

ВАЖНО ДЛЯ ЛЮБОГО АГЕНТА, КОТОРЫЙ ПРОДОЛЖАЕТ РАБОТУ:

Если пользователь говорит "посмотри план и продолжай", "продолжай выполнение плана", "мы остановились на плане" или похожую фразу, нельзя начинать заново и нельзя полагаться на память из прошлой сессии. Нужно восстановить контекст только из этого файла и текущего состояния репозитория.

Обязательный порядок возобновления:

```text
1. Прочитать разделы 20.1, 20.2 и 20.3.
2. Найти current_step, next_step, last_completed_step и последний пункт журнала.
3. Сверить чеклист с реальным состоянием файлов, миграций, API, UI и тестов.
4. Если чеклист говорит [x], но в коде результата нет, считать шаг не завершенным и поставить [!].
5. Если в коде шаг уже выполнен, но чеклист не обновлен, обновить чеклист и журнал.
6. Продолжать с первого шага со статусом [ ], [~] или [!], который блокирует дальнейшую реализацию.
7. Перед изменениями поставить выбранный шаг в [~].
8. После завершения обновить 20.1, 20.2 и 20.3.
```

Запрещено при возобновлении:

```text
начинать реализацию с шага 1, если есть выполненные шаги;
удалять старый код до проверки feature flag и references;
удалять страницы/API Аиши, AI-биллинга и AI-настроек;
считать шаг выполненным без проверки файлов и тестов;
оставлять current_step/next_step устаревшими после изменений.
```

Статусы:

```text
[ ] не начато
[~] в работе
[x] выполнено
[!] заблокировано или требует решения
```

Правило выполнения:

```text
1. Перед началом шага поставить ему [~].
2. После завершения поставить [x] и коротко указать результат.
3. Если шаг нельзя завершить, поставить [!] и описать причину.
4. В блоке "Текущий статус реализации" обновить current_step и next_step.
5. Не начинать следующий крупный шаг, пока в плане не отмечен результат предыдущего.
```

1. Зафиксировать этот план.
2. Создать миграцию добавления `CrmAgent*` моделей, не удаляя старые таблицы.
3. Создать `apps/web/lib/crm-agent-v2/core/types.ts`, включая `CrmAgentCard`, `CrmAgentUiWorkspace`, формы, tabs, preview и commands.
4. Создать action registry.
5. Создать tool registry.
6. Создать planner contract на GigaChat.
7. Создать session/state/artifact/action persistence.
8. Создать context-loader.
9. Создать resolvers.
10. Создать inspector.
11. Создать runtime loop.
12. Создать обработчик interactive commands.
13. Создать read tools.
14. Создать draft tools.
15. Создать execute tools.
16. Создать policy.
17. Создать skills.
18. Создать API v2.
19. Создать UI v2 `/crm/agent` как интерактивный cockpit: диалог, workspace, tabs, cards, forms, preview, confirm/reject.
20. Подключить permissions и feature flag. Использовать `AiAccountAccess.crmAgentEnabled` или явно описать новый отдельный флаг, но не плодить два источника правды.
21. Создать worker v2.
22. Создать dialog/e2e tests и UI tests интерактивного workspace.
23. Прогнать typecheck/lint/tests.
24. Включить CRM Agent v2 под feature flag для проверки.
25. Переключить навигацию CRM с устаревшего агентского UI на `/crm/agent`, не удаляя страницы Аиши, AI-биллинга и AI-настроек.
26. Удалить старые файлы `crm-agent-*`, старые API/UI именно CRM Agent и старые worker branches.
27. Создать миграцию удаления старых CRM Agent моделей и связанных enum после проверки отсутствия references.
28. После проверки удалить остатки старых references.

### 20.1 Рабочий чеклист реализации

Этот чеклист является источником правды во время выполнения плана.

```text
[x] 1. Зафиксировать этот план. Результат: план содержит архитектуру, ограничения по Аише, интерактивный UI, чеклист, журнал и протокол возобновления.
[x] 2. Создать миграцию добавления CrmAgent* моделей, не удаляя старые таблицы. Результат: добавлены модели в Prisma schema и миграция 20260526203000_crm_agent_v2_models.
[x] 3. Создать apps/web/lib/crm-agent-v2/core/types.ts, включая интерактивные UI-типы. Результат: добавлены базовые контракты goal/state/cards/workspace/forms/tools/chat response.
[x] 4. Создать action registry. Результат: добавлен контрактный реестр actions с action types, правами, рисками, confirmation policy, слотами и helper-функциями.
[x] 5. Создать tool registry. Результат: добавлен контрактный реестр tools с read/draft/execute режимами, правами, рисками и helper-функциями.
[x] 6. Создать planner contract на GigaChat. Результат: добавлен planner contract/parser для GigaChat со строгим JSON-планом.
[x] 7. Создать session/state/artifact/action persistence. Результат: добавлен account-scoped persistence слой для session/message/state/plan/artifact/action/toolCall/audit.
[x] 8. Создать context-loader. Результат: добавлен loader компактного CRM/AI/session context для planner/runtime.
[x] 9. Создать resolvers. Результат: добавлен resolver слой для account-scoped разрешения клиентов, услуг, специалистов, локаций, записей и памяти.
[x] 10. Создать inspector. Результат: добавлен inspector планов с проверкой tools/actions, прав, слотов и confirmation risk.
[x] 11. Создать runtime loop. Результат: добавлен runtime каркас session/message/context/planner/inspector/persistence/response.
[x] 12. Создать обработчик interactive commands. Результат: добавлен handler UI-команд select/confirm_action/reject_action.
[x] 13. Создать read tools. Результат: добавлены read handlers для search/get/analytics/site/memory/slots tools и привязка к registry.
[x] 14. Создать draft tools. Результат: добавлены actions.prepare/actions.preview handlers для создания и preview CrmAgentAction.
[x] 15. Создать execute tools. Результат: добавлены actions.confirm/actions.reject handlers и executor для базовых CRM mutations.
[x] 16. Создать policy. Результат: добавлен policy модуль для feature flag, permissions, risk и confirmation decisions.
[x] 17. Создать skills. Результат: добавлен registry доменных skills для planner/runtime.
[x] 18. Создать API v2. Результат: добавлены routes chat/interactions/actions confirm-reject/sessions/artifacts/policies/capabilities под /api/v1/crm/agent-v2.
[x] 19. Создать UI v2 /crm/agent как интерактивный cockpit. Результат: добавлен новый /crm/agent с диалогом, workspace, sessions, actions, artifacts, trace и capabilities.
[x] 20. Подключить permissions и feature flag. Результат: v2 UI/API используют crm.assistant.agent.use/write и общий AiAccountAccess.crmAgentEnabled feature policy.
[x] 21. Создать worker v2. Результат: добавлен background pass для crm_agent_v2 actions/briefs/snapshots/insights/campaigns/conversions/retry на CrmAgent* таблицах.
[x] 22. Создать dialog/e2e tests и UI tests интерактивного workspace. Результат: добавлены node-based v2 dialog scenario и UI workspace contract tests.
[x] 23. Прогнать typecheck/lint/tests. Результат: прошли typecheck, lint, test:crm-agent-v2, test:crm-agent и node --check worker.
[x] 24. Включить CRM Agent v2 под feature flag для проверки. Результат: dev/reseed аккаунты получают AiAccountAccess.crmAgentEnabled=true, production default остается false.
[x] 25. Переключить навигацию CRM на /crm/agent, не удаляя страницы Аиши. Результат: основной пункт "Агент" ведет на /crm/agent, "Аиша" ведет на /crm/assistant/site.
[x] 26. Удалить старые файлы crm-agent-*, старые API/UI именно CRM Agent и старые worker branches. Result: legacy crm-agent-* lib/API/UI/scripts removed; worker now runs only CrmAgent* v2 pass.
[x] 27. Создать миграцию удаления старых CRM Agent моделей и связанных enum после проверки references. Результат: из Prisma schema удалены legacy AiPendingAction/AiAccountMemory/AiAccountInsight/AiAgent* модели и enum, добавлена migration 20260526214500_drop_legacy_crm_agent_models.
[x] 28. После проверки удалить остатки старых references. Результат: runtime-код, scripts, package.json и Prisma schema проверены; старых references не осталось, кроме исторических migrations и самого плана.
[x] 29. Довести runtime loop до фактического выполнения плана. Результат: runtime выполняет allowed tool steps через registry handlers, пишет CrmAgentToolCall, обновляет CrmAgentPlanStep/CrmAgentPlan statuses и возвращает step results в workspace/trace; execute steps, требующие подтверждения, безопасно переводятся в needs_user/skipped.
[x] 30. Довести resolver/clarification pipeline. Результат: runtime извлекает resolver results и available slots из tool results, сохраняет candidates/selected/missing и slot statuses в CrmAgentState, отдаёт candidate cards с командами select:<slot>:<id> для client/service/specialist/location/appointment/time.
[x] 31. Синхронизировать action registry и executor. Результат: planner/UI capabilities получают только executable actions, draft prepare/preview явно отклоняют неподдержанные action types, canUseCrmAgentAction возвращает false для unsupported.
[x] 32. Довести draft/preview до production-контракта. Результат: draft actions имеют before/after/diff preview, runtime строит editable payload form, save_draft:<actionId> обновляет pending action payload и пересчитывает preview.
[x] 33. Довести UI workspace интерактивность. Результат: preview/workspace/card команды confirm_action:<id>/reject_action:<id> и kind confirm/reject вызывают /api/v1/crm/agent-v2/actions/[id]/confirm|reject execute API; UI обновляет action status/result/error, refresh sessions и снимает обработанные commands. select:<slot>:<value> сохраняет state и возвращает обновленный workspace с selected/remaining candidate cards и таблицей выбора; table row commands материализуются как row-level select:{slot}:{value}; command parser сохраняет encoded datetime/string values. save_draft сохраняет текущий session state, а runtime передает latest state planner при следующем текстовом turn. UX follow-up 2026-05-27: простые приветствия отвечаются без planner, prompt больше не содержит meta-answer "Коротко по-русски...", slot/date/status/table labels нормализованы для пользователя, duplicate React keys для slot cards устранены.
[x] 34. Создать LLM-first conversation router до planner. Результат: добавлен apps/web/lib/crm-agent-v2/core/conversation-router.ts с LLM-first routeCrmAgentConversationTurn, JSON parser, route kinds smalltalk/crm_question/crm_task/task_continuation/unsupported, server-side accountId в request, запрет execute из router и аварийный fallback без phrase-list UX.
[x] 35. Создать LLM-first conversational layer. Результат: добавлены apps/web/lib/crm-agent-v2/core/conversation.ts и conversation-prompts.ts; слой отвечает через LLM/context текущего accountId без CrmAgentPlan, поддерживает read-only tool usage для crm_question, запрещает draft/execute и может эскалировать к planner через shouldEscalateToPlanner/plannerHint.
[x] 36. Перестроить runCrmAgentTurn в conversation-first runtime. Результат: runCrmAgentTurn загружает account-scoped context/latest state, вызывает conversation router до planner, отправляет smalltalk/crm_question/unsupported в conversational layer без CrmAgentPlan/planTrace, planner вызывает только для crm_task/task_continuation или escalation, simpleConversationAnswer оставлен только fallback при degraded routing/conversation.
[x] 37. Довести task_continuation. Результат: добавлен task-continuation handler, который до planner применяет текстовый выбор кандидата по latest CrmAgentState, фиксирует текстовое время в state, правит latest pending action draft по тексту пользователя и передает plannerHint, если продолжение не удалось применить напрямую.
[x] 38. Обновить UI под обычный диалог. Результат: добавлен workspace.mode=conversation в core types/conversation runtime, обычные реплики возвращают conversation workspace без planTrace, стартовый cockpit больше не принуждает начинать с задачи и quick prompts включают CRM-вопросы и CRM-задачи.
[x] 39. Добавить CRM question read-only сценарии. Результат: conversation prompt содержит read-only сценарии для "что сегодня по записям", "сколько клиентов без визита/кого пора вернуть", "какие отзывы требуют внимания" и "что посоветуешь улучшить" с маппингом на appointments.search, analytics.workload, analytics.retention, reviews.search и site.health без draft/execute.
[x] 40. Добавить safety, permissions и account isolation для conversation layer. Результат: conversation read tools ограничены текущим списком permitted read tools, user-provided accountId/userId вычищаются из tool args, read-tool вызовы пишут CrmAgentToolCall trace и CrmAgentAudit, prompt запрещает брать accountId из текста/args.
[x] 41. Добавить conversation-first и account-scope тесты. Результат: scripts/crm-agent-v2-dialog-tests.mjs, scripts/crm-agent-v2-ui-tests.mjs и scripts/crm-agent-v2-integration-tests.mjs покрывают smalltalk/crm_question/unsupported no-plan path, crm_question read-only/no-action, crm_task planner persistence, task_continuation before planner, UI no empty planTrace, fallback-only hardcoded replies, Aisha smoke suite presence и account-scope/cross-account negative contracts для route/session/tool-call/context/execute ownership.
[x] 42. Добавить настоящие integration/e2e проверки после conversation-first перестройки. Выполнено: scripts/crm-agent-v2-integration-tests.mjs покрывает DB-сценарии conversation-first runtime, account isolation, confirm/reject execute, media/campaign worker limits, Aisha smoke regression и opt-in live API route checks. 2026-05-29 blocker "router fallback -> false mutation success" исправлен: fallback `unsupported` теперь восстанавливается через planner, natural conversation блокирует mutation-success без action/tool result, добавлены contract regression checks, DB suite прошел. Live API checks прошли против существующего `http://127.0.0.1:3000`.
[x] 43. Финальная readiness-сверка. Выполнено: typecheck, lint, prisma validate/generate, test:crm-agent-v2, DB integration, live API route checks, conversation-first tests, account-isolation checks и Aisha smoke прошли. Критерии раздела 21 сверены, current_step переведен в complete.
```

### 20.2 Текущий статус реализации

Этот блок обновлять после каждого шага. Это главный указатель для продолжения работы после потери контекста, смены агента или прерывания сессии.

```yaml
current_step: "complete"
current_status: "completed: CRM Agent v2 implementation readiness audit passed"
next_step: "Use CRM_AGENT_V2_FULL_ACTION_CATALOG_PLAN.md for post-readiness action catalog/product hardening work"
last_completed_step: "43. Final readiness audit completed"
last_update: "2026-05-29"
resume_instruction: "Если работа была прервана, прочитать 20.1-20.3, сверить чеклист с кодом и продолжить с current_step/next_step, не начиная заново."
notes:
  - "2026-05-29 blocker: чат #30 показал ложный ответ 'Записала...' без CrmAgentState, CrmAgentPlan, CrmAgentAction и без записи через agent flow. Message data: mode=conversation, route.kind=unsupported, routeFallback=true, usedTools=[]; значит задача не дошла до planner/action pipeline."
  - "2026-05-29 blocker fix: router fallback unsupported больше не идет в natural conversation; runtime восстанавливает такой turn через planner recovery, сохраняет routeDiagnostics/routerRaw, а natural conversation применяет invariant против mutation-success без action/tool result."
  - "2026-05-29 regression coverage: dialog/integration contract checks закрепляют planner recovery для router fallback и guard 'Данные в CRM не изменены' для ложных success-ответов."
  - "2026-05-29 live API checks: opt-in harness CRM_AGENT_V2_LIVE_API=1 проверяет реальные HTTP routes capabilities, sessions create/detail, action reject и unauthenticated guard через Bearer CRM session."
  - "2026-05-29 readiness complete: typecheck, lint, prisma validate, prisma generate, test:crm-agent-v2, DB integration, live API checks и Aisha smoke прошли."
  - "2026-05-26 audit: прежний статус complete был преждевременным. Выполнены foundation/removal/API/UI/worker/contract tests, но production-критерии раздела 21 еще не закрыты."
  - "Закрыто step 29: runtime loop теперь исполняет safe planner tool steps через registry и пишет CrmAgentToolCall trace; execute steps с required confirmation не автоисполняются из /chat."
  - "2026-05-29 doc cleanup: прежние строки `Невыполнено` по action registry, resolver/clarification, draft preview/edit и integration/e2e устарели; соответствующие требования закрыты steps 31, 32, 37, 41, 42 и 43."
  - "Шаг 2 выполнен: Prisma schema валидна, старые AiAgent* и Aisha модели не удалялись."
  - "Шаг 3 выполнен: typecheck прошел."
  - "Шаг 4 выполнен: добавлен apps/web/lib/crm-agent-v2/core/actions.ts, typecheck прошел."
  - "Шаг 5 выполнен: добавлен apps/web/lib/crm-agent-v2/core/tools.ts, typecheck прошел."
  - "Шаг 6 выполнен: добавлен apps/web/lib/crm-agent-v2/core/planner.ts, typecheck прошел."
  - "Шаг 7 выполнен: добавлен apps/web/lib/crm-agent-v2/core/persistence.ts, prisma generate и typecheck прошли."
  - "Шаг 8 выполнен: добавлен apps/web/lib/crm-agent-v2/core/context.ts, typecheck прошел."
  - "Шаг 9 выполнен: добавлен apps/web/lib/crm-agent-v2/core/resolvers.ts, typecheck прошел."
  - "Шаг 10 выполнен: добавлен apps/web/lib/crm-agent-v2/core/inspector.ts, typecheck прошел."
  - "Шаг 11 выполнен: добавлен apps/web/lib/crm-agent-v2/core/runtime.ts, typecheck прошел."
  - "Шаг 12 выполнен: добавлен apps/web/lib/crm-agent-v2/core/commands.ts, typecheck прошел."
  - "Шаг 13 выполнен: добавлен apps/web/lib/crm-agent-v2/core/read-tools.ts, tools registry подключает read handlers, typecheck прошел."
  - "Шаг 14 выполнен: добавлен apps/web/lib/crm-agent-v2/core/draft-tools.ts, tools registry подключает draft handlers, typecheck прошел."
  - "Шаг 15 выполнен: добавлен apps/web/lib/crm-agent-v2/core/execute-tools.ts, tools registry подключает execute handlers, typecheck прошел."
  - "Шаг 16 выполнен: добавлен apps/web/lib/crm-agent-v2/core/policy.ts, typecheck прошел."
  - "Шаг 17 выполнен: добавлен apps/web/lib/crm-agent-v2/core/skills.ts, typecheck прошел."
  - "Шаг 18 выполнен: добавлены routes chat/interactions/actions confirm-reject/sessions/artifacts/policies/capabilities, typecheck прошел."
  - "Шаг 19 выполнен: добавлен /crm/agent cockpit, typecheck прошел."
  - "Шаг 20 выполнен: v2 routes/nav/page переведены на crm.assistant.agent.use/write и feature policy AiAccountAccess.crmAgentEnabled, typecheck прошел."
  - "Шаг 21 выполнен: добавлен worker v2 background pass в apps/worker/src/index.mjs, node --check и typecheck прошли."
  - "Шаг 22 выполнен: добавлены scripts/crm-agent-v2-dialog-tests.mjs и scripts/crm-agent-v2-ui-tests.mjs, npm run test:crm-agent-v2 прошел."
  - "Шаг 23 выполнен: npm run typecheck, npm run lint, npm run test:crm-agent-v2, npm run test:crm-agent и node --check apps/worker/src/index.mjs прошли."
  - "Шаг 24 выполнен: scripts/reseed-russian-salon*.js включают crmAgentEnabled=true для dev/test аккаунтов, node --check, test:crm-agent-v2 и typecheck прошли."
  - "Шаг 25 выполнен: CRM nav переключен на /crm/agent, Аиша оставлена отдельным пунктом /crm/assistant/site, typecheck и UI test прошли."
  - "Шаг 26 выполнен: удалены legacy crm-agent-* lib файлы, старые CRM Agent API/UI, старые crm-agent smoke/regression scripts и старые worker branches; worker теперь выполняет только CrmAgent* v2 pass. Проверки прошли: node --check apps/worker/src/index.mjs, npm run typecheck, npm run lint, npm run test:crm-agent-v2."
  - "Шаг 27 выполнен: удалены legacy AiPendingAction, AiAccountMemory, AiAccountInsight, AiAgent* модели и связанные enum из Prisma schema; добавлена migration 20260526214500_drop_legacy_crm_agent_models. Проверки прошли: npm run prisma:validate, prisma generate, npm run typecheck, npm run lint, npm run test:crm-agent-v2, node --check apps/worker/src/index.mjs."
  - "Шаг 28 выполнен: rg-проверка по runtime-коду, scripts, package.json и Prisma schema не нашла legacy CRM Agent references; оставшиеся упоминания находятся только в исторических migrations и CRM_AGENT_V2_IMPLEMENTATION_PLAN.md как журнал/контекст выполненного удаления."
  - "Шаг 29 выполнен: apps/web/lib/crm-agent-v2/core/runtime.ts выполняет allowed read/draft/preview tool steps через registry handlers, пишет CrmAgentToolCall, обновляет CrmAgentPlanStep/CrmAgentPlan и возвращает актуальный trace/results. Execute steps с required confirmation остаются в needs_user/skipped, чтобы не обходить confirm API."
  - "Шаг 30 выполнен: runtime извлекает resolver results и appointments.findAvailableSlots из step results, сохраняет candidates/selected/missing/status в CrmAgentState и строит candidate cards с select:<slot>:<id> commands."
  - "Шаг 31 выполнен: listCrmAgentActionsForPermissions/listCrmAgentActionsByDomain/canUseCrmAgentAction фильтруют unsupported actions, draft prepare/preview отклоняют неподдержанные action types до execute."
  - "Шаг 32 выполнен: actions.prepare/actions.preview строят before/after preview, runtime выводит preview card/workspace.preview/editable form, save_draft:<actionId> обновляет pending action payload и пересчитывает preview. Integration/e2e остаются в step 34."
  - "Шаг 33 in progress: confirm/reject commands из workspace/card/preview UI теперь идут в /actions/[id]/confirm|reject execute API, а не в generic interactions; после ответа UI обновляет action status и снимает обработанные confirm/reject commands из текущего preview."
  - "Шаг 33 in progress: select commands теперь возвращают обновленный workspace по тому же session state; таблицы поддерживают row-level commands; parser select сохраняет encoded datetime/string values."
  - "Шаг 33 выполнен: save_draft сохраняет текущий session state, runtime передает latest CrmAgentState в planner на следующем текстовом turn, UI workspace interactivity закрыта контрактно. Реальные API/DB/e2e проверки идут в step 34."
  - "Шаг 33 UX follow-up: исправлен ответ на приветствие без planner, удален meta-answer из planner prompt, нормализованы русские labels/date/status в workspace и исправлены duplicate React keys для slot cards."
  - "Шаг 34 прежней версии был integration/e2e, но он перенесен в step 42, потому что сначала нужно исправить planner-first архитектуру."
  - "2026-05-27 audit: текущий runtime все еще planner-first. Для полноценного Codex-like агента добавлены обязательные steps 34-43: conversation router, conversational layer, conversation-first runtime, task_continuation, UI и тесты."
  - "2026-05-27 account-scope hardening: раздел 4.3 доведен в коде для текущего v2 каркаса; persistence/context/execute tools теперь дополнительно проверяют accountId ownership. Следующий функциональный шаг остается step 34 conversation router."
  - "Шаг 34 выполнен: добавлен LLM-first conversation router с route decision contract, account-scoped input и fallback только как degradation path."
  - "Шаг 35 выполнен: добавлен LLM-first conversational layer с read-only CRM question tools, account-scoped prompts и запретом draft/execute."
  - "Шаг 36 выполнен: runtime теперь conversation-first; обычные реплики и CRM-вопросы отвечают через router/conversation без CrmAgentPlan/planTrace, planner включается для задач/продолжений или escalation."
  - "Шаг 37 выполнен: task_continuation теперь сначала пытается применить текст к latest state/pending action: выбор варианта, время и правка draft; неприменимые продолжения уходят в planner с plannerHint."
  - "Шаг 38 выполнен: UI и core contract поддерживают workspace.mode=conversation; стартовый экран и quick prompts позволяют обычные вопросы и задачи без принуждения начинать с task."
  - "Шаг 39 выполнен: conversation prompt закрепляет read-only CRM question сценарии и маппит их на безопасные read tools без draft/execute."
  - "Шаг 40 выполнен: conversation read-tool calls теперь имеют permission allow-list, очищают account/user ids из args и пишут tool trace/audit."
  - "Шаг 41 выполнен: contract tests покрывают conversation-first routing, no-plan conversation/question paths, task continuation before planner, UI no empty planTrace, fallback-only hardcoded replies, Aisha smoke presence и account-scope/cross-account guards."
```

### 20.3 Журнал выполнения

Каждое изменение по плану добавлять новой записью сверху или снизу списка. Журнал нужен не для истории ради истории, а чтобы другой агент мог понять, что реально было сделано, какие проверки запускались и почему следующий шаг именно такой.

```text
2026-05-29 - step 43 completed
Что сделано:
- Повторен `npx prisma generate --schema packages/db/prisma/schema.prisma` после остановки локального Next dev server.
- `prisma generate` прошел, Windows lock на `query_engine-windows.dll.node` больше не блокирует readiness.
- Step 43 переведен в completed.
- Текущий статус реализации переведен в `complete`.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npx prisma generate --schema packages/db/prisma/schema.prisma
- Предыдущая readiness-сверка уже прошла: typecheck, lint, prisma validate, test:crm-agent-v2, DB integration, live API checks и Aisha smoke.
Следующий шаг:
- Продолжать только пост-readiness работу по `CRM_AGENT_V2_FULL_ACTION_CATALOG_PLAN.md`.
Блокеры:
- Нет.

2026-05-29 - step 42 completed, step 43 readiness started
Что сделано:
- `scripts/crm-agent-v2-integration-tests.mjs` расширен opt-in live API route checks.
- Live API harness создает реальную CRM user session через DB/auth helper и проверяет HTTP routes с Bearer token:
  - `GET /api/v1/crm/agent-v2/capabilities`;
  - `POST /api/v1/crm/agent-v2/sessions`;
  - `GET /api/v1/crm/agent-v2/sessions/:id`;
  - `POST /api/v1/crm/agent-v2/actions/:id/reject`;
  - unauthenticated capabilities guard.
- Live API route checks прошли против существующего `http://127.0.0.1:3000`.
- Step 42 переведен в completed.
- Step 43 readiness audit начат.
- Убраны lint warnings по неиспользуемым imports в finance/integrations action helpers.
Измененные файлы:
- scripts/crm-agent-v2-integration-tests.mjs
- apps/web/lib/crm-agent-v2/actions/finance/finance-write-helpers.ts
- apps/web/lib/crm-agent-v2/actions/integrations/integration-helpers.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
- CRM_AGENT_V2_INTEGRATION=1 npm run test:crm-agent-v2
- CRM_AGENT_V2_INTEGRATION=1 CRM_AGENT_V2_LIVE_API=1 CRM_AGENT_V2_LIVE_USE_EXISTING=1 CRM_AGENT_V2_LIVE_BASE_URL=http://127.0.0.1:3000 npm run test:crm-agent-v2:integration
- npm run lint
- npx prisma validate --schema packages/db/prisma/schema.prisma
Следующий шаг:
- Остановить/перезапустить локальный Next dev server, затем повторить `npx prisma generate --schema packages/db/prisma/schema.prisma`.
- Если `prisma generate` пройдет, завершить step 43 final readiness audit.
Блокеры:
- `npx prisma generate --schema packages/db/prisma/schema.prisma` сейчас падает с `EPERM rename ... query_engine-windows.dll.node.tmp -> query_engine-windows.dll.node`; активны node/Next dev процессы, которые держат Prisma query engine.

2026-05-29 - step 42 router fallback blocker fixed
Что сделано:
- Исправлен runtime recovery: если LLM-router падает/возвращает невалидный ответ и fallback был `unsupported`, turn больше не уходит в natural conversation, а переводится в planner recovery route `crm_task`.
- Planner recovery получает явную подсказку: классифицировать turn безопасно, вернуть `answer_only`/`unsupported`, если это не CRM-задача, и не утверждать CRM-мутацию без draft/action/tool result.
- Runtime теперь сохраняет `routeDiagnostics` (`routeFallback`, `routeError`, `routerRaw`) в task/conversation data для диагностики invalid router output.
- Natural conversation получил серверный invariant `enforceNoMutationSuccessWithoutToolResult`: ложные ответы вида "записала/создала/готово" без action/tool result заменяются на честное сообщение, что CRM-данные не изменены.
- Contract regression checks добавлены в dialog и integration suites, чтобы старый путь `router fallback -> unsupported natural conversation -> false success` не вернулся.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/lib/crm-agent-v2/core/conversation.ts
- scripts/crm-agent-v2-dialog-tests.mjs
- scripts/crm-agent-v2-integration-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
- CRM_AGENT_V2_INTEGRATION=1 npm run test:crm-agent-v2
Следующий шаг:
- Завершить оставшуюся часть step 42: live API route checks при наличии auth cookie/server, затем step 43 final readiness audit.
Блокеры:
- Нет blocker по false mutation success. Остается live API route coverage из step 42.

2026-05-29 - step 42 blocker documented
Что сделано:
- Проведена диагностика реального диалога `CrmAgentSession #30`, где агент ответил "Записала Анну...", но не создал запись.
- Подтверждено по БД: для session #30 нет `CrmAgentState`, `CrmAgentPlan`, `CrmAgentAction`; assistant messages сохранены как `mode=conversation`, `route.kind=unsupported`, `routeFallback=true`, `usedTools=[]`.
- Установлен корень проблемы: при сбое/невалидном JSON LLM-router возвращает fallback `unsupported`; runtime отправляет такой turn в natural conversation, где модель может сгенерировать ложный success без planner/action pipeline.
- Зафиксировано, что это blocker step 42/43, а не проблема полного action catalog.
Что нужно исправить:
- Router/planner recovery: router failure/invalid JSON для потенциально мутационной CRM-задачи не должен превращаться в natural conversation success; допустимые исходы - нормальный planner path или честный failure "действие не подготовлено, запись не создана".
- Серверный invariant: conversational layer не имеет права утверждать выполненную CRM-мутацию без persisted `CrmAgentAction`, tool result или execute result в текущем turn.
- Диагностика: сохранять router fallback reason/raw/error достаточно явно, чтобы следующий раз видеть причину invalid router response.
- Regression coverage: добавить тест на сценарий чата #30 и искусственный router fallback/invalid response: не должно быть текста "записала/готово" без pending action/confirm; appointment не должен создаваться без confirmation.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- Диагностика выполнена запросом к локальной DB по session #30.
Следующий шаг:
- Исправить step 42 blocker в runtime/router/conversation contract и добавить regression tests.
Блокеры:
- До исправления blocker step 43 final readiness начинать нельзя.

2026-05-27 - step 42 - partial DB harness expansion
Что сделано:
- scripts/crm-agent-v2-integration-tests.mjs расширен opt-in DB-сценариями под conversation-first runtime contracts: crm_question read-only/no-plan/no-action с CrmAgentToolCall без planStepId и CrmAgentAudit, task_continuation state/pending draft, cross-account negative updates для session/planStep/toolCall/action.
- Cleanup integration fixture теперь удаляет v2 audit/toolCall/plan/action/state/artifact данные по основному и secondary account.
- Follow-up fix: conversation layer больше не финализирует placeholder "посмотрю данные CRM" для вопросов о филиалах без чтения данных; добавлен required read fallback на locations.search all mode, prompt scenario для филиалов/локаций и read-tool режим all:true для списка филиалов текущего аккаунта.
- Architecture correction: сценарный fallback для филиалов заменен на общий repair-pass и generic resolver contract. Router/conversation prompts теперь восстанавливают короткие продолжения из history, final prompt запрещает раскрывать внутренние tools пользователю, а resolver layer поддерживает all/listAll для broad list запросов без per-domain костылей.
Измененные файлы:
- scripts/crm-agent-v2-integration-tests.mjs
- apps/web/lib/crm-agent-v2/core/conversation.ts
- apps/web/lib/crm-agent-v2/core/conversation-prompts.ts
- apps/web/lib/crm-agent-v2/core/read-tools.ts
- apps/web/lib/crm-agent-v2/core/resolvers.ts
- apps/web/lib/crm-agent-v2/core/tools.ts
- apps/web/lib/crm-agent-v2/core/conversation-router.ts
- scripts/crm-agent-v2-dialog-tests.mjs
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:crm-agent-v2
- npm run typecheck
Следующий шаг:
- step 42: run opt-in DB integration with CRM_AGENT_V2_INTEGRATION=1 and DATABASE_URL, then add live API route checks if auth/server are available.
Блокеры:
- DB integration остался пропущен без CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.

2026-05-27 - step 41 - completed
Что сделано:
- scripts/crm-agent-v2-dialog-tests.mjs расширен проверками conversation-first runtime: router до planner, smalltalk/crm_question/unsupported через conversation layer без planTrace, crm_task с planner persistence, task_continuation до planner, read-only/no-action для CRM questions и account-scoped route/session/tool-call/context contracts.
- scripts/crm-agent-v2-ui-tests.mjs проверяет conversation workspace и отсутствие пустого planTrace в обычном диалоге.
- scripts/crm-agent-v2-integration-tests.mjs теперь всегда выполняет static conversation-first/account-scope checks до DB skip, включая Aisha smoke suite presence; DB-сценарии остаются opt-in через CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.
Измененные файлы:
- scripts/crm-agent-v2-dialog-tests.mjs
- scripts/crm-agent-v2-ui-tests.mjs
- scripts/crm-agent-v2-integration-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:crm-agent-v2
Следующий шаг:
- step 42: Adapt and run real integration/e2e checks after conversation-first rewrite.
Блокеры:
- DB integration остался пропущен без CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.

2026-05-27 - step 40 - completed
Что сделано:
- conversation.ts ограничивает LLM readToolRequests списком currently permitted read tools.
- Перед вызовом read tool удаляются user-provided accountId/account_id/userId/user_id из args, включая nested objects.
- Каждый read-tool вызов из conversation создает CrmAgentToolCall без planStepId и закрывает его DONE/FAILED.
- Для successful/failed/denied read-tool вызовов пишется CrmAgentAudit с action conversation.read_tool/conversation.read_tool_failed/conversation.read_tool_denied.
- conversation prompt явно запрещает брать accountId/userId/entity ownership из текста пользователя или tool args.
- Contract tests расширены проверками trace, audit, arg stripping, allowedToolNames и prompt accountId запрета.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/conversation.ts
- apps/web/lib/crm-agent-v2/core/conversation-prompts.ts
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 41: Add conversation-first and account-scope tests.
Блокеры:
- DB integration остался пропущен без CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.

2026-05-27 - step 39 - completed
Что сделано:
- conversation-prompts.ts расширен read-only CRM question сценариями.
- "что сегодня по записям" мапится на appointments.search и analytics.workload.
- "сколько клиентов без визита" / "кого пора вернуть" мапится на analytics.retention.
- "какие отзывы требуют внимания" мапится на reviews.search.
- "что посоветуешь улучшить" мапится на analytics.workload, analytics.retention, reviews.search и site.health.
- Prompt явно фиксирует, что эти сценарии не создают draft/action/preview/execute и должны честно сообщать о недоступных по permissions данных.
- Contract tests расширены проверками read-only CRM question сценариев и tool mapping.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/conversation-prompts.ts
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 40: Add safety, permissions and account isolation for conversation layer.
Блокеры:
- DB integration остался пропущен без CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.

2026-05-27 - step 38 - completed
Что сделано:
- В core types добавлен CrmAgentWorkspaceMode "conversation".
- Conversational layer возвращает workspace.mode="conversation" для обычного диалога без read tools.
- Runtime fallback conversation workspace тоже переведен на mode="conversation".
- Стартовый экран /crm/agent больше не говорит "Начните с задачи"; quick prompts включают CRM-вопросы и CRM-задачи.
- UI workspace hint поддерживает conversation mode, а история говорит о первом сообщении, не только о первой задаче.
- Contract tests расширены проверками conversation mode, вопросных quick prompts и отсутствия принуждения начать с задачи.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/types.ts
- apps/web/lib/crm-agent-v2/core/conversation.ts
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 39: Add CRM question read-only scenarios.
Блокеры:
- DB integration остался пропущен без CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.

2026-05-27 - step 37 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/task-continuation.ts.
- Runtime для route.kind=task_continuation теперь до planner вызывает handleCrmAgentTaskContinuation.
- Text continuation "выбери вторую"/"2" применяет выбор к latest CrmAgentState candidates, сохраняет новый CrmAgentState и возвращает selection workspace без нового пустого planner.
- Text continuation с временем вроде "завтра на 15:00" выбирает matching time candidate или фиксирует time slot в latest state.
- Text continuation для draft вроде "измени текст: ..." использует latest pending CrmAgentAction текущей session/account, обновляет payload, пересчитывает preview и возвращает preview workspace с confirm/reject commands.
- Если continuation нельзя применить напрямую, runtime передает plannerHint с latest state summary, чтобы planner продолжал текущую задачу, а не начинал пустой сценарий.
- Persistence получил account-scoped getLatestPendingCrmAgentActionForSession.
- UI contract tests расширены проверками task-continuation handler, pending action lookup, selection/time/draft edit wiring.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/task-continuation.ts
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/lib/crm-agent-v2/core/persistence.ts
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 38: Update UI for ordinary dialog and conversation workspace.
Блокеры:
- DB integration остался пропущен без CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.

2026-05-27 - step 36 - completed
Что сделано:
- runCrmAgentTurn перестроен в conversation-first runtime: после сохранения user message загружается account-scoped context/latest state и вызывается routeCrmAgentConversationTurn.
- Для smalltalk/crm_question/unsupported вызывается runCrmAgentConversation; ответ сохраняется как assistant message с data.mode conversation/question, без CrmAgentPlan, CrmAgentArtifact runtime inspection и planTrace.
- Planner вызывается только для crm_task/task_continuation, при ошибке router без простого fallback или при shouldEscalateToPlanner из conversational layer; routing decision и plannerHint передаются в planner context.
- simpleConversationAnswer оставлен только как аварийный fallback при degraded router/conversation path, а не как основной механизм общения.
- Runtime продолжает прокидывать auth-derived accountId в context/router/conversation/planner/tool calls.
- UI contract tests обновлены: проверяют route-before-planner, подключение conversation layer и fallback-only simpleConversationAnswer.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/runtime.ts
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2:dialogs
- npm run test:crm-agent-v2:ui
- npm run test:crm-agent-v2:integration
- npm run test:crm-agent-v2
Следующий шаг:
- step 37: Finish task_continuation over latest state, pending actions and workspace.
Блокеры:
- DB integration остался пропущен без CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL.

2026-05-27 - step 35 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/conversation-prompts.ts.
- Создан apps/web/lib/crm-agent-v2/core/conversation.ts.
- runCrmAgentConversation вызывает LLM через crm_agent_v2_conversation / crm_agent_v2_conversation_final.
- Для crm_question поддержаны read-only tool requests через executeCrmAgentReadTool; доступные tools фильтруются по permissions и mode=read.
- Prompt запрещает готовить/выполнять изменения и ограничивает ответы contextSummary текущего accountId.
- Добавлены response contracts: answer, workspace/cards, usedTools, shouldEscalateToPlanner, plannerHint.
- Contract tests расширены проверками conversational layer, read-only tools, account-scoped prompt и отсутствия action prepare/confirm.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/conversation-prompts.ts
- apps/web/lib/crm-agent-v2/core/conversation.ts
- scripts/crm-agent-v2-dialog-tests.mjs
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 36: Wire router/conversation into runCrmAgentTurn before planner.
Блокеры:
- нет

2026-05-27 - step 34 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/conversation-router.ts.
- Добавлены CrmAgentRouteKind, CrmAgentRouteDecision, CrmAgentConversationRouterRequest/Result.
- routeCrmAgentConversationTurn вызывает GigaChat через отдельный purpose crm_agent_v2_conversation_router и crm_agent scope.
- Router prompt запрещает брать accountId из текста пользователя, не отправляет обычный диалог в planner, разрешает crm_question только read mode и запрещает execute из router.
- Добавлен parser strict JSON и normalize/enforce allowedToolModes.
- Добавлен fallbackRouteDecision только как аварийный degradation path при ошибке LLM.
- Contract tests расширены проверками LLM-first router, route kinds, server-side accountId, запрета phrase includes и запрета execute.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/conversation-router.ts
- scripts/crm-agent-v2-dialog-tests.mjs
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 35: Implement LLM-first conversational layer.
Блокеры:
- нет

2026-05-27 - account-scope hardening completed
Что сделано:
- Усилен persistence слой: addCrmAgentMessage/saveCrmAgentTaskState/createPlan/createArtifact/createAction/startToolCall/writeAudit проверяют, что session/plan/planStep принадлежит текущему accountId.
- updateCrmAgentPlanStep теперь обновляет шаг только через plan.accountId.
- finishCrmAgentToolCall теперь обновляет tool call только по текущему accountId.
- loadCrmAgentContext теперь грузит history сообщений только через session текущего accountId.
- appointment.create теперь проверяет ownership client/service/specialist/location и bindings service-specialist/service-location перед созданием записи.
- service.create/service.update теперь проверяют categoryId на принадлежность текущему accountId или глобальную категорию.
- UI contract test расширен проверками account scope/account isolation.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/persistence.ts
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/lib/crm-agent-v2/core/commands.ts
- apps/web/lib/crm-agent-v2/core/context.ts
- apps/web/lib/crm-agent-v2/core/execute-tools.ts
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 34: Implement LLM-first conversation router before planner.
Блокеры:
- нет

2026-05-27 - checklist reordered for conversation-first work
Что сделано:
- Прежний step 34 с integration/e2e проверками перенесен в step 42, потому что тестировать нужно уже conversation-first архитектуру, а не planner-first промежуточное состояние.
- Current step теперь 34: создать conversation router до planner.
- Финальная readiness остается step 43.
- Уточнено требование: router и conversational layer должны быть LLM-first, как у Codex-like агента; основной UX нельзя строить на hardcoded phrase lists/regex.
- Добавлен раздел 4.3: CRM Agent всегда работает только внутри auth-derived accountId, получает контекст только текущего аккаунта, а все tools/resolvers/actions обязаны проверять accountId ownership.
- Steps 34-43 усилены требованиями account context/account isolation и cross-account negative tests.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- Документ обновлен вручную; код не менялся.
Следующий шаг:
- step 34: Implement conversation router before planner.
Блокеры:
- нет

2026-05-27 - conversation-first roadmap added
Что сделано:
- Зафиксировано архитектурное требование: CRM Agent v2 должен сначала проходить через conversation router, а planner включается только для CRM-задач и продолжений активных задач.
- Добавлен раздел 17.1.1 Conversation-first слой с типами routing: smalltalk, crm_question, crm_task, task_continuation, unsupported.
- Добавлены новые обязательные steps 35-43: conversation-router, conversational layer, перестройка runtime, task_continuation, UI для обычного диалога, read-only CRM question scenarios, safety/permissions, conversation-first tests и финальная readiness-сверка.
- Текущий статус обновлен: step 34 остается in_progress, но production-ready теперь невозможен без steps 35-43.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- Документ обновлен вручную; код не менялся.
Следующий шаг:
- Закрыть step 34 DB/API integration, затем начать step 35 conversation router.
Блокеры:
- Для step 34 все еще нужен DATABASE_URL и CRM_AGENT_V2_INTEGRATION=1.

2026-05-27 - step 33 - UX follow-up completed
Что сделано:
- Убран источник пользовательского ответа "Коротко по-русски..." из planner prompt; example answer заменен на реальный пример ответа.
- Runtime отвечает на простые приветствия/благодарность без planner, чтобы агент мог нормально общаться.
- Candidate slot title форматируется как понятная дата/время, а не ISO timestamp.
- Selection workspace/table/card labels переведены на русский: варианты, выбрано, состояние, статус, выбрать.
- Cockpit форматирует ISO datetime, переводит slot/status labels, скрывает технические id-поля в карточках и не показывает #id для slot cards.
- Исправлены duplicate React keys для slot cards.
- UI smoke test расширен проверками simpleConversationAnswer, отсутствия meta-answer в prompt, русских selection labels и datetime formatting.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/planner.ts
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/lib/crm-agent-v2/core/commands.ts
- apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- current_step остается 34: DB/API integration run pending.
Блокеры:
- DB integration для step 34 все еще требует DATABASE_URL и CRM_AGENT_V2_INTEGRATION=1.

2026-05-27 - step 34 - in_progress
Что сделано:
- Добавлен scripts/crm-agent-v2-integration-tests.mjs.
- Integration harness при CRM_AGENT_V2_INTEGRATION=1 и DATABASE_URL создает изолированный account fixture через Prisma.
- Покрыты DB-сценарии: ambiguity selection state, draft payload edit, confirm execute appointment with service/status history, rejection reason, Aisha smoke regression.
- Добавлен package script test:crm-agent-v2:integration.
- npm run test:crm-agent-v2 теперь запускает dialog, UI и integration bundle; integration script без env явно skip.
- UI contract test обновлен под закрытый step 33 и наличие step 34 integration script.
Измененные файлы:
- scripts/crm-agent-v2-integration-tests.mjs
- scripts/crm-agent-v2-ui-tests.mjs
- package.json
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- node --check scripts/crm-agent-v2-integration-tests.mjs
- node scripts/crm-agent-v2-integration-tests.mjs (skipped: нет CRM_AGENT_V2_INTEGRATION=1/DATABASE_URL)
- npm run test:crm-agent-v2 (integration skipped по env)
- npm run typecheck
Следующий шаг:
- продолжить step 34: запустить CRM_AGENT_V2_INTEGRATION=1 с тестовой DATABASE_URL и добавить live API route checks при наличии тестовой auth-сессии.
Блокеры:
- В текущем окружении DATABASE_URL не задан, поэтому реальные DB integration сценарии не выполнены.

2026-05-27 - step 33 - completed
Что сделано:
- Runtime больше не отправляет planner state:null при продолжении той же session; latest CrmAgentState сериализуется и передается в planner request.
- saveDraftCommand сохраняет текущий session state со статусом ready_for_confirmation вместо возврата пустого command-state.
- UI contract test расширен проверками сохранения state при save_draft и передачи latest state в planner.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/lib/crm-agent-v2/core/commands.ts
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- node scripts/crm-agent-v2-ui-tests.mjs
Следующий шаг:
- step 34: Добавить настоящие integration/e2e проверки для appointment booking, ambiguity selection, draft edit, confirm execute, rejection и Aisha smoke regression.
Блокеры:
- нет

2026-05-27 - step 33 - in_progress
Что сделано:
- selectCommand теперь после выбора сохраняет CrmAgentState и возвращает непустой workspace с cards/tabs/table по текущим candidates/selected/missing.
- Selection workspace показывает выбранные карточки, оставшиеся варианты и таблицу с rowCommands select:{slot}:{value}.
- Cockpit Table теперь рендерит row-level command buttons и материализует command id из данных строки.
- parseCommand для select:<slot>:<value> теперь сохраняет значения с двоеточиями/URL encoding, включая datetime значения слотов времени.
- UI contract test расширен проверками parseActionCommand/materializeRowCommand/buildSelectionWorkspace/decodeCommandPart и частичного статуса [~] step 33 в плане.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/commands.ts
- apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- node scripts/crm-agent-v2-ui-tests.mjs
Следующий шаг:
- продолжить step 33: довести draft edit continuation после save_draft и проверить реальные API/DB сценарии перед step 34.
Блокеры:
- нет

2026-05-27 - step 33 - in_progress
Что сделано:
- В cockpit добавлен routing для command kind confirm/reject и command ids confirm_action:<id>/reject_action:<id>.
- Workspace/card/preview confirm/reject теперь вызывают /api/v1/crm/agent-v2/actions/[id]/confirm или /reject, то есть execute tool handlers, а не /interactions.
- После execute UI обновляет локальный action status/result/error, обновляет список sessions и убирает обработанные confirm/reject commands из текущего response workspace/cards/tabs.
Измененные файлы:
- apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- node scripts/crm-agent-v2-ui-tests.mjs
- npm run typecheck
Следующий шаг:
- продолжить step 33: проверить/довести выбор вариантов из card/table commands и обновление session state после интерактивных selection/edit flows.
Блокеры:
- нет

2026-05-26 - step 32 - completed
Что сделано:
- Добавлен editable draft form в runtime workspace для preview cards с actionId.
- Добавлен command save_draft:<actionId>.
- Добавлен persistence updateCrmAgentActionPayload для pending actions.
- Interactive command handler saveDraftCommand обновляет payload, пересчитывает before/after/diff preview и возвращает обновленный preview workspace.
- Cockpit form корректно отправляет text/textarea/number/toggle поля.
- UI contract test расширен проверками save_draft/buildDraftForm/updateCrmAgentActionPayload.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/persistence.ts
- apps/web/lib/crm-agent-v2/core/draft-tools.ts
- apps/web/lib/crm-agent-v2/core/commands.ts
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx
- scripts/crm-agent-v2-ui-tests.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 33: Довести UI workspace интерактивность.
Блокеры:
- нет

2026-05-26 - step 31 - completed
Что сделано:
- В actions registry добавлен явный список executable actions, соответствующий текущему executeActionMutation.
- listCrmAgentActionsForPermissions и listCrmAgentActionsByDomain теперь возвращают только actions, которые реально поддержаны executor.
- canUseCrmAgentAction возвращает false для unsupported actions.
- actions.prepare/actions.preview отклоняют unsupported action types до создания draft.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/actions.ts
- apps/web/lib/crm-agent-v2/core/draft-tools.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 32: Довести draft/preview до production-контракта.
Блокеры:
- нет

2026-05-26 - step 30 - completed
Что сделано:
- Runtime начал извлекать resolver results из read tool outputs и переносить их в CrmAgentState: candidates, selected, missing и slot statuses.
- Добавлена обработка appointments.findAvailableSlots как candidates для slot `time`.
- Candidate cards получают clickable commands формата select:<slot>:<id>, совместимые с interactive command handler.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/runtime.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 31: Синхронизировать action registry и executor.
Блокеры:
- нет

2026-05-26 - step 29 - completed
Что сделано:
- В apps/web/lib/crm-agent-v2/core/runtime.ts добавлен execution loop для allowed planner tool steps.
- Runtime теперь запускает tool handlers из registry, пишет CrmAgentToolCall через start/finish, обновляет CrmAgentPlanStep и CrmAgentPlan statuses.
- В workspace добавлена вкладка Results, cards и planTrace теперь получают фактические statuses/result/error выполненных steps.
- Execute steps, требующие подтверждения, не автоисполняются из chat route и переводятся в needs_user/skipped, чтобы не обходить отдельные confirm/reject API.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/runtime.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2
Следующий шаг:
- step 30: Довести resolver/clarification pipeline.
Блокеры:
- нет

2026-05-26 - readiness audit - status corrected to in_progress
Что сделано:
- Выполнена повторная сверка плана с кодом после step 28.
- Подтверждено: foundation v2, Prisma models, core registries, API/UI, worker v2, feature flag, удаление legacy CRM Agent и contract tests существуют.
- Выявлено: статус complete был преждевременным, потому что runtime не выполняет planner steps через tool registry, tool calls не пишутся общим loop, action registry шире фактического executor, resolver-driven clarification и draft edit/preview не закрыты end-to-end.
- В чеклист добавлены steps 29-35 как обязательные до production-ready статуса.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:crm-agent-v2
- npm run prisma:validate
- npm run typecheck
- rg legacy CRM Agent references вне migrations/plan
Следующий шаг:
- step 29: Довести runtime loop до фактического выполнения плана.
Блокеры:
- нет

2026-05-26 - step 28 - completed
Что сделано:
- Выполнена финальная rg-проверка legacy CRM Agent identifiers и путей: AiPendingAction/AiAccountMemory/AiAccountInsight/AiAgent*, связанные enum, crm-agent-* без v2, /api/v1/crm/assistant, crm-assistant-cockpit, старые test:crm-agent scripts и старые worker branch names.
- В runtime-коде, scripts, package.json и packages/db/prisma/schema.prisma старых references не найдено.
- Оставшиеся совпадения находятся только в исторических migrations и CRM_AGENT_V2_IMPLEMENTATION_PLAN.md, где они нужны как контекст удаления и журнал выполненных шагов.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- rg legacy CRM Agent references по repo без node_modules, .next и historical migrations
Следующий шаг:
- план выполнен
Блокеры:
- нет

2026-05-26 - step 27 - completed
Что сделано:
- Проверены references legacy AiPendingAction/AiAccountMemory/AiAccountInsight/AiAgent* и связанных enum: в runtime-коде, scripts, package.json и Prisma schema после удаления их нет.
- Из packages/db/prisma/schema.prisma удалены legacy CRM Agent модели: AiPendingAction, AiAccountMemory, AiAccountInsight, AiAgentTask, AiAgentCampaign, AiAgentCampaignConversion, AiAgentNotificationDraft, AiAgentReviewDraft, AiAgentSiteDraft, AiAgentRun, AiAgentToolCall, AiAgentAudit.
- Из packages/db/prisma/schema.prisma удалены enum: AiPendingActionStatus, AiAccountInsightStatus, AiAgentTaskStatus, AiAgentCampaignStatus, AiAgentDraftStatus, AiAgentRunStatus, AiAgentToolCallStatus.
- Добавлена migration packages/db/prisma/migrations/20260526214500_drop_legacy_crm_agent_models/migration.sql с DROP TABLE IF EXISTS и DROP TYPE IF EXISTS.
- Выполнен prisma generate после временной остановки процессов, которые держали Windows Prisma query engine; web dev server снова запущен на http://127.0.0.1:3000.
Измененные файлы:
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260526214500_drop_legacy_crm_agent_models/migration.sql
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run prisma:validate
- powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 generate
- npm run typecheck
- npm run lint
- npm run test:crm-agent-v2
- node --check apps/worker/src/index.mjs
Следующий шаг:
- step 28: После проверки удалить остатки старых references.
Блокеры:
- нет

2026-05-26 - step 26 - completed
Что сделано:
- Удалены legacy apps/web/lib/crm-agent-*.ts.
- Удалены старые CRM Agent API apps/web/app/api/v1/crm/assistant/**.
- Удален старый CRM Agent UI apps/web/app/(crm)/crm/assistant/page.tsx и crm-assistant-cockpit.tsx.
- Удалены старые scripts/crm-agent-smoke.mjs и scripts/crm-agent-regression.mjs, из package.json убраны старые test:crm-agent* scripts.
- apps/worker/src/index.mjs заменен на v2-only background pass, который работает с CrmAgent* таблицами и больше не выполняет старые AiAgent/AiPendingAction ветки.
- Страницы Аиши, AI billing/settings и Aisha analytics оставлены.
Измененные файлы:
- apps/web/app/(crm)/crm/assistant/page.tsx
- apps/web/app/(crm)/crm/assistant/crm-assistant-cockpit.tsx
- apps/web/app/api/v1/crm/assistant/**
- apps/web/lib/crm-agent-*.ts
- apps/worker/src/index.mjs
- package.json
- scripts/crm-agent-smoke.mjs
- scripts/crm-agent-regression.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- node --check apps/worker/src/index.mjs
- npm run typecheck
- npm run lint
- npm run test:crm-agent-v2
Следующий шаг:
- step 27: Создать миграцию удаления старых CRM Agent моделей и связанных enum после проверки references.
Блокеры:
- нет

2026-05-26 - step 25 - completed
Что сделано:
- Основной пункт CRM-навигации "Агент" теперь ведет на /crm/agent и требует crm.assistant.agent.use.
- Добавлен отдельный пункт "Аиша" на /crm/assistant/site с crm.assistant.site.read, страницы Аиши не удалялись.
Измененные файлы:
- apps/web/app/(crm)/crm/crm-shell.tsx
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run test:crm-agent-v2:ui
Следующий шаг:
- step 26: Удалить старые файлы crm-agent-*, старые API/UI именно CRM Agent и старые worker branches.
Блокеры:
- нет

2026-05-26 - step 24 - completed
Что сделано:
- В dev/reseed scripts для тестовых салонов создается AiAccountAccess с aiEnabled=true, siteAssistantEnabled=true, crmAgentEnabled=true.
- Production default в миграции AiAccountAccess.crmAgentEnabled=false не изменялся.
Измененные файлы:
- scripts/reseed-russian-salon.js
- scripts/reseed-russian-salon-2.js
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- node --check scripts/reseed-russian-salon.js
- node --check scripts/reseed-russian-salon-2.js
- npm run test:crm-agent-v2
- npm run typecheck
Следующий шаг:
- step 25: Переключить навигацию CRM на /crm/agent, не удаляя страницы Аиши.
Блокеры:
- нет

2026-05-26 - step 23 - completed
Что сделано:
- Прогнаны основные проверки после API/UI/worker/tests.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run lint
- npm run test:crm-agent-v2
- npm run test:crm-agent
- node --check apps/worker/src/index.mjs
Следующий шаг:
- step 24: Включить CRM Agent v2 под feature flag для проверки.
Блокеры:
- нет

2026-05-26 - step 22 - completed
Что сделано:
- Добавлен scripts/crm-agent-v2-dialog-tests.mjs со сценариями appointment booking, new client continuation, schedule day off, service copy update, daily attention overview.
- Добавлен scripts/crm-agent-v2-ui-tests.mjs для проверки интерактивного workspace contract: tabs/cards/forms/tables/preview/commands/trace/capabilities.
- В package.json добавлены scripts test:crm-agent-v2:dialogs, test:crm-agent-v2:ui, test:crm-agent-v2.
Измененные файлы:
- scripts/crm-agent-v2-dialog-tests.mjs
- scripts/crm-agent-v2-ui-tests.mjs
- package.json
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:crm-agent-v2
Следующий шаг:
- step 23: Прогнать typecheck/lint/tests.
Блокеры:
- нет

2026-05-26 - step 21 - completed
Что сделано:
- В apps/worker/src/index.mjs добавлен runCrmAgentV2BackgroundPass.
- Добавлены jobs: expire actions, daily/weekly brief tasks, refresh knowledge snapshots, generate insights, send campaigns, sync campaign conversions, retry failed campaign recipients.
- Worker v2 пишет состояние только в CrmAgent* таблицы; CRM-данные читает для аналитики, snapshots и conversions.
Измененные файлы:
- apps/worker/src/index.mjs
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- node --check apps/worker/src/index.mjs
- npm run typecheck
Следующий шаг:
- step 22: Создать dialog/e2e tests и UI tests интерактивного workspace.
Блокеры:
- нет

2026-05-26 - step 20 - completed
Что сделано:
- API v2 переведен на входные permissions crm.assistant.agent.use и crm.assistant.agent.write.
- Навигационный пункт Agent v2 скрывается без crm.assistant.agent.use.
- Страница /crm/agent проверяет общий feature policy на базе AiAccountAccess.crmAgentEnabled.
Измененные файлы:
- apps/web/app/api/v1/crm/agent-v2/chat/route.ts
- apps/web/app/api/v1/crm/agent-v2/interactions/route.ts
- apps/web/app/api/v1/crm/agent-v2/actions/[id]/confirm/route.ts
- apps/web/app/api/v1/crm/agent-v2/actions/[id]/reject/route.ts
- apps/web/app/api/v1/crm/agent-v2/sessions/route.ts
- apps/web/app/api/v1/crm/agent-v2/sessions/[id]/route.ts
- apps/web/app/api/v1/crm/agent-v2/artifacts/route.ts
- apps/web/app/api/v1/crm/agent-v2/policies/route.ts
- apps/web/app/api/v1/crm/agent-v2/capabilities/route.ts
- apps/web/app/(crm)/crm/agent/page.tsx
- apps/web/app/(crm)/crm/crm-shell.tsx
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 21: Создать worker v2.
Блокеры:
- нет

2026-05-26 - step 19 - completed
Что сделано:
- Создана страница apps/web/app/(crm)/crm/agent/page.tsx.
- Создан интерактивный cockpit apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx с диалогом, sessions, actions, artifacts, workspace tabs/cards/forms/tables/preview, plan trace и capabilities.
- Добавлен отдельный пункт навигации Agent v2, не заменяя /crm/assistant и не затрагивая страницы Аиши.
Измененные файлы:
- apps/web/app/(crm)/crm/agent/page.tsx
- apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx
- apps/web/app/(crm)/crm/crm-shell.tsx
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 20: Подключить permissions и feature flag.
Блокеры:
- нет

2026-05-26 - step 18 - completed
Что сделано:
- Создан общий helper apps/web/app/api/v1/crm/agent-v2/_shared.ts для auth, feature policy, cookies, id и pagination.
- Добавлены routes: chat, interactions, actions/[id]/confirm, actions/[id]/reject, sessions, sessions/[id], artifacts, policies, capabilities.
- Confirm/reject routes используют execute tool handlers actions.confirm/actions.reject; capabilities возвращает доступные skills/tools/actions по permissions.
Измененные файлы:
- apps/web/app/api/v1/crm/agent-v2/_shared.ts
- apps/web/app/api/v1/crm/agent-v2/chat/route.ts
- apps/web/app/api/v1/crm/agent-v2/interactions/route.ts
- apps/web/app/api/v1/crm/agent-v2/actions/[id]/confirm/route.ts
- apps/web/app/api/v1/crm/agent-v2/actions/[id]/reject/route.ts
- apps/web/app/api/v1/crm/agent-v2/sessions/route.ts
- apps/web/app/api/v1/crm/agent-v2/sessions/[id]/route.ts
- apps/web/app/api/v1/crm/agent-v2/artifacts/route.ts
- apps/web/app/api/v1/crm/agent-v2/policies/route.ts
- apps/web/app/api/v1/crm/agent-v2/capabilities/route.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 19: Создать UI v2 /crm/agent как интерактивный cockpit.
Блокеры:
- нет

2026-05-26 - step 17 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/skills.ts.
- Добавлены domain skills: appointment_booking, client_profile, service_catalog, specialist_profile, schedule_management, location_management, promotion_management, review_management, client_notifications, site_content, agent_memory, analytics_insights.
- Добавлены helper-функции get/list/find by permissions/goal.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/skills.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 18: Создать API v2.
Блокеры:
- нет

2026-05-26 - step 16 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/policy.ts.
- Добавлены проверки feature policy через AiAccountAccess, tool/action permission decisions, risk comparison и auto-execute policy.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/policy.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 17: Создать skills.
Блокеры:
- нет

2026-05-26 - step 15 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/execute-tools.ts.
- Добавлены handlers actions.confirm/actions.reject.
- actions.confirm подтверждает CrmAgentAction и выполняет поддерживаемые мутации: memory/autopilot memory, clients, appointment create/cancel, services, locations, review.reply.
- tools.ts теперь подключает execute handlers после draft/read handlers.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/execute-tools.ts
- apps/web/lib/crm-agent-v2/core/tools.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 16: Создать policy.
Блокеры:
- нет

2026-05-26 - step 14 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/draft-tools.ts.
- Добавлены handlers actions.prepare и actions.preview для CrmAgentAction.
- tools.ts теперь подключает draft handlers после read handlers.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/draft-tools.ts
- apps/web/lib/crm-agent-v2/core/tools.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 15: Создать execute tools.
Блокеры:
- нет

2026-05-26 - step 13 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/read-tools.ts.
- Добавлены handlers для clients/services/specialists/locations/appointments/reviews/promos/analytics/site/memory read tools.
- tools.ts теперь подключает read handlers через attachCrmAgentReadToolHandlers.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/read-tools.ts
- apps/web/lib/crm-agent-v2/core/tools.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 14: Создать draft tools.
Блокеры:
- нет

2026-05-26 - step 12 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/commands.ts.
- Добавлен handler interactive commands для select:<slot>:<value>, confirm_action:<id>, reject_action:<id>.
- Handler проверяет session/account, permission для action и сохраняет новое state/message.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/commands.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 13: Создать read tools.
Блокеры:
- нет

2026-05-26 - step 11 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/runtime.ts.
- Runtime создает/загружает session, пишет user/assistant messages, грузит context, вызывает planner, inspector, сохраняет plan/state/artifact и возвращает CrmAgentChatResponse.
- Исполнение tools/actions намеренно не включено: read/draft/execute tools идут отдельными шагами 13-15.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/runtime.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 12: Создать обработчик interactive commands.
Блокеры:
- нет

2026-05-26 - step 10 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/inspector.ts.
- Добавлена проверка unknown tool/action, permissions, required slots, tool mode mismatch и confirmation by risk.
- Inspector возвращает findings, allowedSteps, blockedSteps, общий risk и requiresConfirmation.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/inspector.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 11: Создать runtime loop.
Блокеры:
- нет

2026-05-26 - step 9 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/resolvers.ts.
- Добавлены account-scoped resolvers для client/service/specialist/location/appointment/memory.
- Добавлены статусы empty/resolved/ambiguous/not_found и единый resolveCrmAgentEntity/resolveCrmAgentSlot.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/resolvers.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 10: Создать inspector.
Блокеры:
- нет

2026-05-26 - step 8 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/context.ts.
- Добавлен loadCrmAgentContext с account summary, AI access, memory, insights, pending actions и session history.
- Добавлен compactCrmAgentContext для передачи компактной сводки planner/runtime.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/context.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 9: Создать resolvers.
Блокеры:
- нет

2026-05-26 - step 7 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/persistence.ts.
- Добавлены функции для session/message/state/plan/planStep/artifact/action/toolCall/audit.
- Для новых Prisma delegates выполнен prisma generate.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/persistence.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 generate
- npm run typecheck
Следующий шаг:
- step 8: Создать context-loader.
Блокеры:
- нет

2026-05-26 - step 6 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/planner.ts.
- Добавлены типы planner request/result/plan/steps и parser строгого JSON.
- Добавлен GigaChat wrapper requestCrmAgentPlannerPlan с crm_agent scope и purpose crm_agent_v2_planner.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/planner.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 7: Создать session/state/artifact/action persistence.
Блокеры:
- нет

2026-05-26 - step 5 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/tools.ts.
- Добавлен реестр инструментов read/draft/execute для клиентов, услуг, специалистов, локаций, записей, расписания, отзывов, акций, аналитики, сайта, памяти и actions.
- Добавлены helper-функции get/list/filter/canUse и ограничение по maxRisk.
- В CrmAgentToolDefinition handler сделан опциональным, чтобы registry мог существовать до реализации tool handlers.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/types.ts
- apps/web/lib/crm-agent-v2/core/tools.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 6: Создать planner contract на GigaChat.
Блокеры:
- нет

2026-05-26 - step 4 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/actions.ts.
- Добавлен реестр action types для записей, клиентов, услуг, специалистов, расписания, локаций, акций, отзывов, уведомлений, сайта, памяти и autopilot.
- Добавлены helper-функции get/list/filter/canUse и проверка недостающих обязательных слотов.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/actions.ts
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
Следующий шаг:
- step 5: Создать tool registry.
Блокеры:
- нет

2026-05-26 - step 3 - completed
Что сделано:
- Создан apps/web/lib/crm-agent-v2/core/types.ts.
- Добавлены типы goal, task state, slots, candidates, cards, workspace, tabs, forms, tables, preview, commands, action/tool definitions, chat response.
Измененные файлы:
- apps/web/lib/crm-agent-v2/core/types.ts
Проверка:
- npm run typecheck
Следующий шаг:
- step 4: Создать action registry.
Блокеры:
- нет

2026-05-26 - step 2 - completed
Что сделано:
- Добавлены модели CrmAgentSession, CrmAgentMessage, CrmAgentState, CrmAgentPlan, CrmAgentPlanStep, CrmAgentAction, CrmAgentToolCall, CrmAgentArtifact, CrmAgentMemory, CrmAgentInsight, CrmAgentTask, CrmAgentPolicy, CrmAgentKnowledgeSnapshot, CrmAgentCampaign, CrmAgentCampaignRecipient, CrmAgentAudit.
- Создана миграция добавления новых таблиц без удаления старых AiAgent* таблиц.
Измененные файлы:
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260526203000_crm_agent_v2_models/migration.sql
Проверка:
- npm run prisma:validate
Следующий шаг:
- step 3: Создать apps/web/lib/crm-agent-v2/core/types.ts.
Блокеры:
- нет

2026-05-26 - step 1 - completed
Что сделано:
- План зафиксирован как рабочий документ реализации CRM Agent v2.
- Добавлены ограничения по Аише, интерактивному UI, чеклисту, текущему статусу и протоколу возобновления.
Измененные файлы:
- CRM_AGENT_V2_IMPLEMENTATION_PLAN.md
Проверка:
- Проверена структура раздела 20 и наличие протокола продолжения.
Следующий шаг:
- step 2: Создать миграцию добавления CrmAgent* моделей.
Блокеры:
- нет

YYYY-MM-DD HH:mm - step N - status
Что сделано:
- ...
Измененные файлы:
- ...
Проверка:
- ...
Следующий шаг:
- ...
Блокеры:
- нет / описание
```

### 20.4 Протокол сверки перед продолжением

Перед продолжением после паузы выполнить короткую сверку и записать результат в журнал:

```text
Проверить:
- git status --short
- наличие новых CrmAgent* моделей в packages/db/prisma/schema.prisma
- наличие apps/web/lib/crm-agent-v2/**
- наличие API apps/web/app/api/v1/crm/agent-v2/**
- наличие UI apps/web/app/(crm)/crm/agent/**
- что страницы Аиши и AI-настроек не удалены
- что старые crm-agent-* удаляются только на позднем этапе
- какие тесты уже добавлены и какие запускались
```

Если реальность расходится с чеклистом, сначала исправить чеклист/статус/журнал, потом продолжать код.

## 21. Критерии готовности

CRM Agent v2 считается готовым, когда:

```text
1. Старый CRM Agent код удален, но страницы и API Аиши/AI-биллинга/AI-настроек сохранены.
2. Аиша работает как раньше.
3. Новый агент понимает свободный русский текст через planner.
4. Все действия идут через action registry.
5. Агент хранит state задачи.
6. Агент умеет уточнять 0/1/many/missing/conflict.
7. Агент показывает интерактивный workspace: tabs, cards, forms, tables, preview и commands.
8. Пользователь может выбирать варианты кликом, редактировать draft вручную и продолжать тот же сценарий текстом.
9. Каждый draft имеет preview до/после.
10. Опасные действия требуют подтверждения.
11. Есть trace плана и tool calls.
12. Есть worker для фоновых insights/campaigns.
13. Есть e2e диалоги и UI tests по ключевым интерактивным сценариям.
```

### 21.1 Текущая сверка готовности

Статус на 2026-05-26: `in_progress`, не production-ready.

```text
Выполнено:
1. Старый CRM Agent код удален; страницы Аиши/AI-биллинга/AI-настроек сохранены.
3. Planner contract на GigaChat есть.
4. Action registry есть.
5. State задачи сохраняется в CrmAgentState.
7. Базовый workspace contract и UI cockpit есть.
10. Confirm/reject flow для CrmAgentAction есть.
11. Plan trace частично есть через CrmAgentPlanStep; persistence для CrmAgentToolCall есть.
12. Worker v2 для фоновых insights/campaigns есть.
13. Быстрые dialog/UI contract tests есть.

Не выполнено / требует доработки:
2. Аиша не подтверждена свежим smoke/regression после удаления legacy CRM Agent.
3. Planner есть, но runtime не исполняет построенный план end-to-end.
4. Не все действия из action registry имеют execute implementation или безопасно скрыты как unsupported.
6. Уточнения 0/1/many/missing/conflict не доведены до resolver-driven end-to-end сценариев.
7. Workspace есть, но интерактивные controls требуют проверки реальными API/DB сценариями.
8. Выбор кликом, ручная правка draft и продолжение текстом не закрыты end-to-end.
9. Preview before/after есть только как общий draft preview contract, не гарантирован для каждого draft.
11. Tool calls не пишутся общим runtime loop при выполнении planner steps.
13. Нужны настоящие integration/e2e tests, текущие тесты в основном проверяют наличие контрактов и wiring.
```
