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
Пользователь пишет свободным текстом -> planner определяет цель -> runtime возвращает текст + workspace.
Пользователь кликает карточку / tab / кнопку / редактирует форму -> UI отправляет command.
Runtime применяет command к state -> возвращает обновленный workspace.
Опасное действие всегда проходит через action preview и подтверждение.
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
[ ] 1. Зафиксировать этот план.
[ ] 2. Создать миграцию добавления CrmAgent* моделей, не удаляя старые таблицы.
[ ] 3. Создать apps/web/lib/crm-agent-v2/core/types.ts, включая интерактивные UI-типы.
[ ] 4. Создать action registry.
[ ] 5. Создать tool registry.
[ ] 6. Создать planner contract на GigaChat.
[ ] 7. Создать session/state/artifact/action persistence.
[ ] 8. Создать context-loader.
[ ] 9. Создать resolvers.
[ ] 10. Создать inspector.
[ ] 11. Создать runtime loop.
[ ] 12. Создать обработчик interactive commands.
[ ] 13. Создать read tools.
[ ] 14. Создать draft tools.
[ ] 15. Создать execute tools.
[ ] 16. Создать policy.
[ ] 17. Создать skills.
[ ] 18. Создать API v2.
[ ] 19. Создать UI v2 /crm/agent как интерактивный cockpit.
[ ] 20. Подключить permissions и feature flag.
[ ] 21. Создать worker v2.
[ ] 22. Создать dialog/e2e tests и UI tests интерактивного workspace.
[ ] 23. Прогнать typecheck/lint/tests.
[ ] 24. Включить CRM Agent v2 под feature flag для проверки.
[ ] 25. Переключить навигацию CRM на /crm/agent, не удаляя страницы Аиши.
[ ] 26. Удалить старые файлы crm-agent-*, старые API/UI именно CRM Agent и старые worker branches.
[ ] 27. Создать миграцию удаления старых CRM Agent моделей и связанных enum после проверки references.
[ ] 28. После проверки удалить остатки старых references.
```

### 20.2 Текущий статус реализации

Этот блок обновлять после каждого шага. Это главный указатель для продолжения работы после потери контекста, смены агента или прерывания сессии.

```yaml
current_step: "1. Зафиксировать этот план"
current_status: "not_started"
next_step: "2. Создать миграцию добавления CrmAgent* моделей"
last_completed_step: null
last_update: null
resume_instruction: "Если работа была прервана, прочитать 20.1-20.3, сверить чеклист с кодом и продолжить с current_step/next_step, не начиная заново."
notes:
  - "Перед началом реализации поставить шаг 1 в [~], после фиксации плана отметить [x]."
```

### 20.3 Журнал выполнения

Каждое изменение по плану добавлять новой записью сверху или снизу списка. Журнал нужен не для истории ради истории, а чтобы другой агент мог понять, что реально было сделано, какие проверки запускались и почему следующий шаг именно такой.

```text
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
