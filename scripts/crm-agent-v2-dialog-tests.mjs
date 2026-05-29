import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(file, text, message) {
  assert(read(file).includes(text), `${message} (${file})`);
}

function assertOrder(source, earlier, later, message) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert(earlierIndex >= 0, `${message}: missing earlier marker ${earlier}`);
  assert(laterIndex >= 0, `${message}: missing later marker ${later}`);
  assert(earlierIndex < laterIndex, message);
}

const runtimeSource = read("apps/web/lib/crm-agent-v2/core/runtime.ts");
const plannerSource = read("apps/web/lib/crm-agent-v2/core/planner.ts");
const routerSource = read("apps/web/lib/crm-agent-v2/core/conversation-router.ts");
const conversationSource = read("apps/web/lib/crm-agent-v2/core/conversation.ts");
const conversationPromptsSource = read("apps/web/lib/crm-agent-v2/core/conversation-prompts.ts");
const persistenceSource = read("apps/web/lib/crm-agent-v2/core/persistence.ts");
const contextSource = read("apps/web/lib/crm-agent-v2/core/context.ts");
const chatRouteSource = read("apps/web/app/api/v1/crm/agent-v2/chat/route.ts");
const inspectorSource = read("apps/web/lib/crm-agent-v2/core/inspector.ts");
const commandsSource = read("apps/web/lib/crm-agent-v2/core/commands.ts");
const toolsSource = read("apps/web/lib/crm-agent-v2/core/tools.ts");
const actionsSource = [
  read("apps/web/lib/crm-agent-v2/actions/registry.ts"),
  ...fs
    .readdirSync(path.join(root, "apps/web/lib/crm-agent-v2/actions"), { recursive: true })
    .filter((file) => String(file).endsWith(".ts"))
    .map((file) => read(path.join("apps/web/lib/crm-agent-v2/actions", String(file)))),
].join("\n");
const skillsSource = read("apps/web/lib/crm-agent-v2/core/skills.ts");
const workerSource = read("apps/worker/src/index.mjs");

const scenarios = [
  {
    name: "appointment booking",
    user: "Запиши Анну на маникюр на ближайшее время.",
    goal: "appointment.create",
    tools: ["clients.search", "services.search", "appointments.findAvailableSlots", "actions.prepare", "actions.preview"],
    actions: ["appointment.create"],
    expectedUi: ["select", "preview", "confirm"],
  },
  {
    name: "new client continuation",
    user: "Запиши Анну 89823458765 на маникюр.",
    goal: "client.create",
    tools: ["clients.search", "actions.prepare", "actions.preview"],
    actions: ["client.create", "appointment.create"],
    expectedUi: ["form", "preview", "confirm"],
  },
  {
    name: "schedule day off",
    user: "Поставь Марии завтра выходной.",
    goal: "schedule.update",
    tools: ["specialists.search", "actions.prepare", "actions.preview"],
    actions: ["schedule.set_day_off"],
    expectedUi: ["select", "preview", "confirm"],
  },
  {
    name: "specialist create",
    user: "Create specialist Elizaveta Fedunkina, manicure master, phone 89000000000.",
    goal: "specialist.create",
    tools: ["specialists.search", "actions.prepare", "actions.preview"],
    actions: ["specialist.create"],
    expectedUi: ["form", "preview", "confirm"],
  },
  {
    name: "service copy update",
    user: "Обнови описание услуги Детская стрижка.",
    goal: "service.update",
    tools: ["services.search", "actions.prepare", "actions.preview"],
    actions: ["service.update", "site.update_service_copy"],
    expectedUi: ["form", "preview", "confirm"],
  },
  {
    name: "daily attention overview",
    user: "Что сегодня требует внимания?",
    goal: "analytics.workload",
    tools: ["analytics.workload", "analytics.retention", "reviews.search", "site.health"],
    actions: [],
    expectedUi: ["report", "table"],
  },
];

for (const scenario of scenarios) {
  assert(skillsSource.includes(`"${scenario.goal}"`) || actionsSource.includes(`"${scenario.goal}"`), `Registry does not mention goal for scenario: ${scenario.name}`);
  for (const tool of scenario.tools) {
    assert(toolsSource.includes(`name: "${tool}"`) || toolsSource.includes(`"${tool}"`), `Tool registry misses ${tool} for scenario: ${scenario.name}`);
  }
  for (const action of scenario.actions) {
    assert(actionsSource.includes(`name: "${action}"`) || actionsSource.includes(`"${action}"`), `Action registry misses ${action} for scenario: ${scenario.name}`);
  }
  for (const mode of scenario.expectedUi) {
    assert(read("apps/web/lib/crm-agent-v2/core/types.ts").includes(`"${mode}"`), `UI type contract misses workspace mode ${mode} for scenario: ${scenario.name}`);
  }
}

assertIncludes("apps/web/lib/crm-agent-v2/core/runtime.ts", "requestCrmAgentPlannerPlan", "Runtime must call the planner");
assertOrder(runtimeSource, "routeCrmAgentConversationTurn", "requestCrmAgentPlannerPlan", "Runtime must classify the turn before planner");
assert(runtimeSource.includes("historyBeforeCurrentTurn") && runtimeSource.includes("priorHistory"), "Runtime must not duplicate the current user message inside model history");
assert(runtimeSource.includes("recoverSpecialistCreatePlan") && runtimeSource.includes('"specialist.create"'), "Runtime must recover specialist.create drafts from dialog history when planner over-clarifies");
assert(runtimeSource.includes("Кого зарегистрировать? Напишите ФИО специалиста."), "Specialist create clarification must ask only for the name, not schedule or services");
assertOrder(runtimeSource, "routeDecision.kind === \"task_continuation\"", "const plannerResult = await requestCrmAgentPlannerPlan", "Task continuation must use latest state before planner fallback");
assert(runtimeSource.includes("route.kind === \"smalltalk\" || route.kind === \"crm_question\" || route.kind === \"unsupported\""), "Smalltalk, CRM questions and unsupported turns must stay in conversation layer");
assert(runtimeSource.includes("shouldRecoverRouterFallbackWithPlanner"), "Runtime must recover router fallback through planner instead of unsafe natural conversation");
assert(runtimeSource.includes("Router fallback could not classify the turn safely") && runtimeSource.includes("Escalate to planner recovery instead of natural conversation"), "Router fallback recovery must explicitly avoid natural conversation for unclassified turns");
assert(runtimeSource.includes("Do not claim that a CRM mutation was completed unless a draft/action/tool result exists"), "Planner recovery hint must forbid false mutation success");
assert(runtimeSource.includes("routeDiagnostics") && runtimeSource.includes("routerRaw"), "Runtime must persist router fallback diagnostics for debugging invalid router output");
assert(runtimeSource.includes("conversationModeForRoute(routeDecision)") && runtimeSource.includes("planTrace: []"), "Conversation responses must be persisted without a task plan trace");
assert(runtimeSource.includes("mode: \"task\"") && runtimeSource.includes("planId: persistedPlan.id"), "CRM tasks must still invoke and persist planner output");
assert(runtimeSource.includes("fallback: \"degradedConversationAnswer\""), "Degraded LLM fallback must be explicit and non-scripted");
assert(!runtimeSource.includes("function simpleConversationAnswer"), "Runtime must not use scripted phrase-list replies");
assert(!runtimeSource.includes("function looksLikeCrmTask"), "Runtime must not classify user text with keyword lists");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation-router.ts", "createGigaChatCompletion", "Conversation router must be LLM-first");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation-router.ts", "crm_agent_v2_conversation_router", "Conversation router must use its own AI purpose");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation-router.ts", "accountId: input.accountId", "Conversation router must use server-side accountId");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation-router.ts", "Никогда не используй accountId из текста пользователя", "Conversation router prompt must reject user-provided accountId");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation-router.ts", "Приветствия", "Conversation router prompt must classify greetings as smalltalk");
assert(!routerSource.includes("Пользователь спрашивает read-only сводку по текущему аккаунту"), "Router prompt must not include a crm_question example that the model can copy");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation-router.ts", "fallbackRouteDecision", "Conversation router may only use fallback as degraded path");
assert(routerSource.includes("readOnlyCrmQuestionDecision") && routerSource.includes("analytics.retention"), "Router fallback must keep retention/list CRM questions in read-only mode");
assert(routerSource.includes("smalltalk") && routerSource.includes("crm_question") && routerSource.includes("crm_task") && routerSource.includes("task_continuation") && routerSource.includes("unsupported"), "Conversation router must support all route kinds");
assert(!routerSource.includes("message.includes("), "Conversation router must not be implemented as phrase includes checks");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation.ts", "createGigaChatCompletion", "Conversational layer must be LLM-first");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation.ts", "crm_agent_v2_conversation", "Conversational layer must use its own AI purpose");
assert(conversationSource.includes("chatHistoryMessages") && conversationSource.includes("...chatHistoryMessages(input.history ?? [])"), "Conversation layer must pass recent session history as chat messages, not only as JSON payload");
assert(conversationSource.includes("runNaturalCrmAgentConversation") && conversationSource.includes('input.route.kind !== "crm_question"'), "Ordinary conversation must bypass the JSON draft parser");
assert(conversationSource.includes("enforceNoMutationSuccessWithoutToolResult") && conversationSource.includes("containsMutationSuccessClaim"), "Natural conversation must guard against mutation success claims without tool/action results");
assert(conversationSource.includes("Данные в CRM не изменены"), "False mutation-success guard must explicitly tell the user that CRM data was not changed");
assert(conversationPromptsSource.includes("Отвечай обычным текстом на русском языке, не JSON"), "Natural conversation prompt must not require JSON for smalltalk");
assert(conversationPromptsSource.includes("Публичное имя: CRM-агент"), "Conversation prompts must define the public assistant name");
assert(conversationPromptsSource.includes("внутренним техническим названием") && conversationPromptsSource.includes("названием LLM-провайдера"), "Conversation prompts must hide internal version and model/provider identity");
assert(!conversationPromptsSource.includes("CRM Agent v2"), "Conversation prompts must not expose the internal v2 name to the model");
assert(!conversationPromptsSource.includes("С чем конкретно помогу?"), "Conversation prompts must not contain copyable disliked stock phrases");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation.ts", "executeCrmAgentReadTool", "Conversational layer must support read-only CRM questions");
assertIncludes("apps/web/lib/crm-agent-v2/core/conversation.ts", "tool.mode === \"read\"", "Conversational layer must list only read tools");
assert(!read("apps/web/lib/crm-agent-v2/core/read-tools.ts").includes("getCrmAgentTool"), "Read tools must not import tools registry at runtime; it creates a Next.js circular initialization crash");
assert(conversationSource.includes("input.route.kind === \"crm_question\" && !draft.shouldEscalateToPlanner"), "CRM questions must use read tools only when they stay in the conversation layer");
assert(conversationSource.includes("allowedToolNames") && conversationSource.includes("conversation.read_tool_denied"), "CRM question read tools must enforce current permissions");
assert(conversationSource.includes("planStepId: null"), "Conversation read-tool traces must not be attached to planner steps");
assert(conversationSource.includes("shouldRepairMissingReadTools"), "CRM questions must not finalize placeholder answers when read tools are missing");
assert(conversationSource.includes("shouldRepairEmptyConversationDraft") && conversationSource.includes("invalid_conversation_json"), "Conversation layer must repair invalid or empty model drafts before using a fallback answer");
assert(conversationSource.includes("isSchemaPlaceholderAnswer"), "Conversation layer must reject copied schema placeholders as user answers");
assert(!conversationPromptsSource.includes("Короткий естественный ответ пользователю или предварительная фраза."), "Conversation prompt must not contain copyable user-answer placeholders");
assert(!conversationPromptsSource.includes("Сводка по данным CRM и следующий полезный шаг."), "Conversation final prompt must not contain copyable user-answer placeholders");
assert(!conversationSource.includes("Для этого лучше перейти к задаче CRM"), "Conversation fallback must not push ordinary dialog into CRM task wording");
assert(conversationSource.includes("crm_question_without_read_tools"), "CRM question repair must be generic, not scenario-specific");
assert(conversationSource.includes("withFallbackReadToolRequest") && conversationSource.includes("readToolForSuggestedGoal"), "CRM questions must have a backend fallback read-tool selection from suggestedGoalType");
assert(!conversationSource.includes("филиал|филиалы"), "Conversation runtime must not hardcode branch phrase lists");
assert(!conversationSource.includes("actions.prepare"), "Conversational layer must not prepare actions");
assert(!conversationSource.includes("actions.confirm"), "Conversational layer must not confirm actions");
assert(conversationPromptsSource.includes("Не выполняй и не готовь изменения"), "Conversation prompt must forbid changes");
assert(conversationPromptsSource.includes("Используй только contextSummary текущего accountId"), "Conversation prompt must be account-scoped");
assert(conversationPromptsSource.includes("route.kind выглядит неверным"), "Conversation layer must be able to recover from an incorrect LLM route without phrase lists");
assert(chatRouteSource.includes("accountId: auth.session.accountId"), "Chat route must derive accountId from auth session");
assert(conversationPromptsSource.includes("выбери ближайший read tool по domain/name/description"), "Conversation prompt must use generic read-tool selection");
assert(conversationPromptsSource.includes("Repair-pass"), "Conversation prompt must support generic repair for missing read tools");
assert(conversationPromptsSource.includes("Учитывай контекст диалога") && conversationPromptsSource.includes("эллиптическая"), "Conversation prompt must resolve short follow-ups from dialog history");
assert(conversationPromptsSource.includes("Не упоминай внутренние read tools"), "Conversation final prompt must not expose internal tools to users");
assert(read("apps/web/lib/crm-agent-v2/core/resolvers.ts").includes("isListAllRequest"), "Resolver layer must support generic all/listAll requests");
assert(!chatRouteSource.includes("body.accountId"), "Chat route must reject body-provided accountId");
assert(persistenceSource.includes("assertCrmAgentSessionBelongsToAccount"), "Persistence must verify session ownership before session-bound writes");
assert(persistenceSource.includes("where: { id: input.sessionId, accountId: input.accountId }"), "Session lookup must be account-scoped");
assert(persistenceSource.includes("where: { id: input.planStepId, plan: { accountId: input.accountId } }"), "Plan step updates must be account-scoped");
assert(persistenceSource.includes("where: { id: input.toolCallId, accountId: input.accountId }"), "Tool-call finishing must be account-scoped");
assert(contextSource.includes("session: { accountId: input.accountId }"), "History/context loading must not cross account boundaries");
assert(contextSource.includes('orderBy: { createdAt: "desc" }') && contextSource.includes("messages.reverse().map"), "Context loading must use the latest messages and restore chronological order");
assert(plannerSource.includes("fallbackGoalForStatus") && plannerSource.includes('"conversation.answer"'), "Planner parser must accept answer_only/unsupported responses without requiring a task goal");
assert(plannerSource.includes("chatHistoryMessages") && plannerSource.includes("...chatHistoryMessages(input.history ?? [])"), "Planner must receive recent session history as chat messages");
assert(routerSource.includes("chatHistoryMessages") && routerSource.includes("...chatHistoryMessages(input.history ?? [])"), "Router must receive recent session history as chat messages");
assertIncludes("apps/web/lib/crm-agent-v2/core/runtime.ts", "inspectCrmAgentPlan", "Runtime must inspect plans before returning UI state");
assert(runtimeSource.includes("hasMissingActionSlots") && runtimeSource.includes("missingActionSlotsAnswer"), "Runtime must convert missing action slots into user-facing clarification");
assert(runtimeSource.includes("userFacingInspectionMessage"), "Runtime must localize inspector messages before showing them to users");
assertIncludes("apps/web/lib/crm-agent-v2/core/runtime.ts", "createCrmAgentPlan", "Runtime must persist plans");
assertIncludes("apps/web/lib/crm-agent-v2/core/runtime.ts", "saveCrmAgentTaskState", "Runtime must persist task state");
assertIncludes("apps/web/lib/crm-agent-v2/core/runtime.ts", "createCrmAgentArtifact", "Runtime must persist workspace artifacts");
assertIncludes("apps/web/lib/crm-agent-v2/core/commands.ts", "kind === \"select\"", "Interactive commands must support card selection");
assertIncludes("apps/web/lib/crm-agent-v2/core/commands.ts", "kind === \"confirm_action\"", "Interactive commands must support confirmation");
assertIncludes("apps/web/lib/crm-agent-v2/core/commands.ts", "kind === \"reject_action\"", "Interactive commands must support rejection");
assertIncludes("apps/web/lib/crm-agent-v2/core/inspector.ts", "missing_tool_permission", "Inspector must report missing tool permissions");
assertIncludes("apps/web/lib/crm-agent-v2/core/inspector.ts", "missing_action_permission", "Inspector must report missing action permissions");
assertIncludes("apps/web/lib/crm-agent-v2/core/inspector.ts", "missing_action_slots", "Inspector must report missing slots");

for (const route of [
  "apps/web/app/api/v1/crm/agent-v2/chat/route.ts",
  "apps/web/app/api/v1/crm/agent-v2/interactions/route.ts",
  "apps/web/app/api/v1/crm/agent-v2/actions/[id]/confirm/route.ts",
  "apps/web/app/api/v1/crm/agent-v2/actions/[id]/reject/route.ts",
  "apps/web/app/api/v1/crm/agent-v2/capabilities/route.ts",
]) {
  assert(fs.existsSync(path.join(root, route)), `Missing API route: ${route}`);
  assertIncludes(route, "requireCrmAgentApi", `Route must use CRM Agent v2 auth and feature policy: ${route}`);
}

for (const job of [
  "expireCrmAgentV2Actions",
  "createCrmAgentV2BriefTask",
  "refreshCrmAgentV2KnowledgeSnapshot",
  "generateCrmAgentV2Insights",
  "sendCrmAgentV2Campaigns",
  "syncCrmAgentV2CampaignConversions",
  "retryCrmAgentV2Outbox",
]) {
  assert(workerSource.includes(job), `Worker v2 job is missing: ${job}`);
}

console.log(JSON.stringify({ ok: true, scenarios: scenarios.map((scenario) => scenario.name) }));
