import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cockpitPath = "apps/web/app/(crm)/crm/agent/crm-agent-v2-cockpit.tsx";
const pagePath = "apps/web/app/(crm)/crm/agent/page.tsx";
const shellPath = "apps/web/app/(crm)/crm/crm-shell.tsx";
const runtimePath = "apps/web/lib/crm-agent-v2/core/runtime.ts";
const routerPath = "apps/web/lib/crm-agent-v2/core/conversation-router.ts";
const conversationPath = "apps/web/lib/crm-agent-v2/core/conversation.ts";
const conversationPromptsPath = "apps/web/lib/crm-agent-v2/core/conversation-prompts.ts";
const taskContinuationPath = "apps/web/lib/crm-agent-v2/core/task-continuation.ts";
const plannerPath = "apps/web/lib/crm-agent-v2/core/planner.ts";
const commandsPath = "apps/web/lib/crm-agent-v2/core/commands.ts";
const persistencePath = "apps/web/lib/crm-agent-v2/core/persistence.ts";
const contextPath = "apps/web/lib/crm-agent-v2/core/context.ts";
const executeToolsPath = "apps/web/lib/crm-agent-v2/core/execute-tools.ts";
const actionHelpersPath = "apps/web/lib/crm-agent-v2/actions/action-helpers.ts";
const chatRoutePath = "apps/web/app/api/v1/crm/agent-v2/chat/route.ts";
const planPath = "CRM_AGENT_V2_IMPLEMENTATION_PLAN.md";
const cockpit = read(cockpitPath);
const page = read(pagePath);
const shell = read(shellPath);
const runtime = read(runtimePath);
const router = read(routerPath);
const conversation = read(conversationPath);
const conversationPrompts = read(conversationPromptsPath);
const taskContinuation = read(taskContinuationPath);
const planner = read(plannerPath);
const commands = read(commandsPath);
const resolvers = read("apps/web/lib/crm-agent-v2/core/resolvers.ts");
const persistence = read(persistencePath);
const context = read(contextPath);
const executeTools = read(executeToolsPath);
const actionHelpers = read(actionHelpersPath);
const chatRoute = read(chatRoutePath);
const plan = read(planPath);

const requiredWorkspaceSurfaces = [
  "workspace.tabs",
  "workspace.preview",
  "workspace.form",
  "activeTab?.table",
  "CommandBar",
  "Card",
  "AgentForm",
  "Preview",
  "Table",
  "planTrace",
];

for (const surface of requiredWorkspaceSurfaces) {
  assert(cockpit.includes(surface), `CRM Agent v2 cockpit must render ${surface}`);
}

const requiredInteractions = [
  "/api/v1/crm/agent-v2/chat",
  "/api/v1/crm/agent-v2/interactions",
  "/api/v1/crm/agent-v2/actions/",
  "/api/v1/crm/agent-v2/sessions?take=12",
  "confirm",
  "reject",
  "submitCommand",
  "save_draft",
];

for (const interaction of requiredInteractions) {
  assert(cockpit.includes(interaction), `CRM Agent v2 cockpit must wire interaction: ${interaction}`);
}

for (const text of ["Диалог", "История", "Контекст", "На подтверждение", "Новый чат"]) {
  assert(cockpit.includes(text), `CRM Agent v2 UI misses visible text: ${text}`);
}
assert(cockpit.includes("onKeyDown={handleInputKeyDown}") && cockpit.includes("event.key !== \"Enter\""), "Composer must send on Enter and keep Shift+Enter for new lines");
assert(cockpit.includes("overflow-y-auto") && cockpit.includes("h-[calc(100vh-7rem)]"), "CRM Agent page must keep chat/history/context panes scrollable without stretching the page");
assert(cockpit.includes("openSession") && cockpit.includes("/api/v1/crm/agent-v2/sessions/${sessionId}"), "Session history must behave like chat history and restore messages");
assert(cockpit.includes("useState<number | null>(null)") && !cockpit.includes("initialData.sessions[0]?.id ?? null"), "Opening CRM Agent must start a visible new chat instead of silently continuing the latest saved session");
assert(cockpit.includes("credentials: \"same-origin\"") && cockpit.includes("Не удалось открыть чат."), "Session history API errors must not crash the UI");
assert(!cockpit.includes("Что умеет агент"), "CRM Agent page must not show a separate tutorial/capabilities panel in the main UI");

assert(page.includes("requireCrmPermission(\"crm.assistant.agent.use\")"), "CRM Agent v2 page must require agent.use permission");
assert(page.includes("checkCrmAgentFeaturePolicy"), "CRM Agent v2 page must check feature policy");
assert(page.includes("CRM-агент") && !page.includes("CRM Agent v2"), "CRM Agent page must use the public Russian assistant name");
assert(shell.includes("href: \"/crm/agent\""), "CRM shell must expose /crm/agent navigation item");
assert(shell.includes("permission: \"crm.assistant.agent.use\""), "CRM shell must guard /crm/agent navigation by agent.use permission");
assert(runtime.includes("buildDraftForm"), "Runtime must build editable draft forms");
assert(runtime.includes("save_draft:"), "Runtime draft forms must submit save_draft commands");
assert(commands.includes("saveDraftCommand"), "Interactive commands must support saving edited drafts");
assert(commands.includes("updateCrmAgentActionPayload"), "Saving a draft must update pending action payload");
assert(persistence.includes("updateCrmAgentActionPayload"), "Persistence must expose pending action payload update");
assert(cockpit.includes("parseActionCommand"), "Cockpit must route confirm/reject workspace commands to action execute APIs");
assert(cockpit.includes("materializeRowCommand"), "Cockpit tables must materialize row-level commands");
assert(commands.includes("buildSelectionWorkspace"), "Selecting a candidate must return an updated workspace");
assert(commands.includes("card.data?.slot === activeSlot"), "Selection workspace must show only the active slot, not mix client/service/time candidates");
assert(commands.includes("slotCandidateId(slot)"), "Available time candidates must use a compound id, not only startAt");
assert(taskContinuation.includes("card.data?.slot === activeSlot"), "Task continuation workspace must show only the active slot");
assert(taskContinuation.includes("slotCandidateId(slot)"), "Task continuation time candidates must use a compound id");
assert(runtime.includes("activeSelectionSlot(state)") && runtime.includes("buildSelectedSummaryCards(state)"), "Runtime workspace must separate current selection from selected summary");
assert(!runtime.includes('id: "plan"') && !runtime.includes('id: "results"'), "Runtime workspace must keep technical plan/results out of the main operator tabs");
assert(runtime.includes("slotCandidateId(slot)"), "Runtime available slot candidates must use a compound id");
assert(resolvers.includes("token.length >= 2") && resolvers.includes("candidate.length >= 4"), "Resolver ranking must not match query by one-letter candidate tokens");
assert(resolvers.includes("comparableToken") && resolvers.includes("\\u0439\\u044c\\u0430"), "Resolver ranking must normalize Russian name endings such as Vitaliy/Vitalya");
assert(runtime.includes("return state.missing[0] ?? Object.keys(state.candidates).find"), "Runtime selection workspace must keep the first missing slot active even when it has no candidates");
assert(runtime.includes("recoverAppointmentCreatePlanFromMessage"), "Runtime must recover appointment booking when planner JSON fails");
assert(runtime.includes("taskStateClarificationAnswer"), "Runtime must not show hallucinated planner answers while slots are unresolved");
assert(runtime.includes("shouldHandleActiveTaskContinuation"), "Runtime must continue active tasks even when router JSON fails");
assert(commands.includes("decodeCommandPart"), "Interactive select commands must preserve encoded values such as datetimes");
assert(commands.includes("loadCurrentStateOrEmpty"), "Saving a draft must preserve the current session task state");
assert(runtime.includes("serializePlannerState"), "Runtime must pass latest session state to the planner on continuation");
const routeIndex = runtime.indexOf("routeCrmAgentConversationTurn");
const plannerIndex = runtime.indexOf("requestCrmAgentPlannerPlan");
assert(routeIndex >= 0 && plannerIndex >= 0 && routeIndex < plannerIndex, "Runtime must route conversation before planner");
assert(runtime.includes("runCrmAgentConversation"), "Runtime must call conversational layer for non-task turns");
assert(runtime.includes("!conversation.shouldEscalateToPlanner"), "Runtime must only invoke planner after conversation escalation");
assert(runtime.includes("fallback: \"degradedConversationAnswer\""), "Runtime may keep only an explicit degraded LLM fallback");
assert(!runtime.includes("function simpleConversationAnswer"), "Runtime must not keep scripted phrase-list replies");
assert(runtime.includes("handleCrmAgentTaskContinuation"), "Runtime must try task continuation before starting a new planner path");
assert(taskContinuation.includes("selectCandidateFromText"), "Task continuation must support text candidate selection");
assert(taskContinuation.includes("parseTimeUpdate"), "Task continuation must support text time updates");
assert(taskContinuation.includes("updatePendingDraftFromText"), "Task continuation must support pending draft text edits");
assert(taskContinuation.includes("getLatestPendingCrmAgentActionForSession"), "Task continuation must use pending action context");
assert(!planner.includes("Коротко по-русски, что будет сделано"), "Planner prompt must not contain user-visible meta answer text");
assert(commands.includes("Выбор сохранен. Можно продолжить."), "Selection command responses must be user-facing Russian text");
assert(cockpit.includes("formatDateTime"), "Cockpit must format ISO datetime values for users");
assert(cockpit.includes("slotLabel"), "Cockpit must translate slot names");
assert(cockpit.includes('"answer"') && cockpit.includes("hiddenDataKeys"), "Cockpit must hide technical answer keys from visible data cards");
assert(read("apps/web/lib/crm-agent-v2/core/types.ts").includes("\"conversation\""), "UI type contract must support conversation workspace mode");
assert(cockpit.includes("mode: \"conversation\""), "Cockpit start workspace must be conversation-first");
assert(cockpit.includes("Что сегодня по записям?"), "Quick prompts must include CRM questions");
assert(cockpit.includes("Запиши Анну на маникюр"), "Quick prompts must include CRM tasks");
assert(!cockpit.includes("Начните с задачи"), "Cockpit must not force users to start with a task");
assert(cockpit.includes("response?.planTrace?.length"), "Cockpit must not render an empty plan trace for ordinary conversation");
assert(cockpit.includes("mode: \"conversation\"") && cockpit.includes("Контекст"), "Cockpit must show conversation workspace without requiring plan UI");
assert(conversation.includes("mode: \"conversation\""), "Conversational layer must return conversation workspace for ordinary dialog");
assert(conversationPrompts.includes("список, количество, детали, состояние или аналитику"), "Conversation prompt must cover generic CRM read-question shapes");
assert(conversationPrompts.includes("domain/name/description"), "Conversation prompt must map CRM questions through tool metadata, not phrase lists");
assert(conversationPrompts.includes("Repair-pass"), "Conversation prompt must support a generic missing-read-tool repair pass");
assert(read("apps/web/lib/crm-agent-v2/core/tools.ts").includes("list specialists") && read("apps/web/lib/crm-agent-v2/core/tools.ts").includes("list all branches"), "Search tool metadata must document generic list-all args");
assert(read("apps/web/lib/crm-agent-v2/core/resolvers.ts").includes("isListAllRequest"), "Resolvers must support generic all/listAll requests without per-domain fallbacks");
assert(conversationPrompts.includes("Не упоминай внутренние read tools"), "Conversation final prompt must not expose internal tools to users");
assert(!runtime.includes("state: null,"), "Runtime must not drop session state when asking the planner for the next turn");
assert(plan.includes("[x] 33."), "Plan checklist must mark step 33 as completed");
assert(plan.includes("current_step: \"complete\""), "Plan status must stay complete after final readiness");
assert(read("package.json").includes("test:crm-agent-v2:integration"), "Package scripts must expose CRM Agent v2 integration tests");
assert(plan.includes("## 4.3 Account scope"), "Plan must define CRM Agent account scope requirements");
assert(plan.includes("[ ] 34.") || plan.includes("[x] 34."), "Plan must contain step 34 conversation router");
assert(router.includes("CrmAgentRouteDecision"), "Conversation router must define route decision contract");
assert(router.includes("createGigaChatCompletion"), "Conversation router must call the LLM as the main path");
assert(router.includes("allowedToolModes"), "Conversation router must constrain allowed tool modes");
assert(router.includes("execute не разрешай из router"), "Conversation router prompt must forbid execute routing");
assert(!router.includes("message.includes("), "Conversation router must not use phrase includes as main behavior");
assert(conversation.includes("runCrmAgentConversation"), "Conversational layer must expose runCrmAgentConversation");
assert(conversation.includes("executeCrmAgentReadTool"), "Conversational layer must support read-only tools");
assert(conversation.includes("tool.mode === \"read\""), "Conversational layer must filter read tools");
assert(conversation.includes("startCrmAgentToolCall") && conversation.includes("finishCrmAgentToolCall"), "Conversation read tools must write tool call trace");
assert(conversation.includes("writeCrmAgentAudit"), "Conversation read tools must write audit records");
assert(conversation.includes("stripUnsafeToolArgs"), "Conversation read tools must strip user-provided account/user ids from args");
assert(conversation.includes("allowedToolNames"), "Conversation read tools must be constrained to currently permitted read tools");
assert(conversation.includes("shouldEscalateToPlanner"), "Conversational layer must be able to escalate to planner");
assert(conversationPrompts.includes("Не выполняй и не готовь изменения"), "Conversation prompts must forbid write behavior");
assert(conversationPrompts.includes("Используй только contextSummary текущего accountId"), "Conversation prompts must constrain account context");
assert(conversationPrompts.includes("Никогда не бери accountId"), "Conversation prompt must reject user-provided account ids");
assert(chatRoute.includes("accountId: auth.session.accountId"), "Chat route must derive accountId from auth session");
assert(!chatRoute.includes("body.accountId"), "Chat route must not accept accountId from request body");
assert(persistence.includes("assertCrmAgentSessionBelongsToAccount"), "Persistence must verify session ownership by accountId");
assert(persistence.includes("getLatestPendingCrmAgentActionForSession"), "Persistence must expose account-scoped pending session action lookup");
assert(persistence.includes("plan: { accountId: input.accountId }"), "Plan step updates must be scoped through plan.accountId");
assert(persistence.includes("where: { id: input.toolCallId, accountId: input.accountId }"), "Tool call finishing must be scoped by accountId");
assert(context.includes("session: { accountId: input.accountId }"), "Context history must load messages only for current account session");
for (const ownershipCheck of [
  "assertClientBelongsToAccount",
  "assertSpecialistBelongsToAccount",
  "assertLocationBelongsToAccount",
  "assertServiceCategoryBelongsToAccount",
  "assertServiceSpecialistBinding",
  "assertServiceLocationBinding",
]) {
  assert(
    executeTools.includes(ownershipCheck) || actionHelpers.includes(ownershipCheck),
    `Execute path must include ownership/binding check: ${ownershipCheck}`,
  );
}

console.log(JSON.stringify({ ok: true, checked: [cockpitPath, pagePath, shellPath, runtimePath, routerPath, conversationPath, conversationPromptsPath, taskContinuationPath, commandsPath, persistencePath, contextPath, executeToolsPath, actionHelpersPath] }));
