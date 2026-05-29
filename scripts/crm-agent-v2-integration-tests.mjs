import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { createJiti } from "jiti";

const root = process.cwd();
const enabled = process.env.CRM_AGENT_V2_INTEGRATION === "1";

runStaticContractChecks();

if (!enabled) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "Set CRM_AGENT_V2_INTEGRATION=1 and DATABASE_URL to run DB integration tests." }));
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("[crm-agent-v2-integration] DATABASE_URL is required.");
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["error"] });
const jiti = createJiti(path.join(root, "apps/web/test-entry.js"), {
  alias: { "@": path.join(root, "apps/web") },
});
const { getCrmAgentExecuteToolHandler } = jiti("./lib/crm-agent-v2/core/execute-tools.ts");
const { resolveCrmAgentClient, resolveCrmAgentService } = jiti("./lib/crm-agent-v2/core/resolvers.ts");
const { createSession } = jiti("@/lib/auth.ts");
const workerModulePromise = import("../apps/worker/src/index.mjs");
const runId = `crm-agent-v2-it-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const created = {
  accountId: null,
  otherAccountId: null,
  userId: null,
  specialistUserId: null,
  liveUserIds: [],
  liveRoleIds: [],
  clientIds: [],
  appointmentIds: [],
  mediaAssetIds: [],
  campaignIds: [],
  outboxItemIds: [],
  webhookEndpointIds: [],
  webhookDeliveryIds: [],
  actionIds: [],
  sessionIds: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function runStaticContractChecks() {
  const runtime = read("apps/web/lib/crm-agent-v2/core/runtime.ts");
  const conversation = read("apps/web/lib/crm-agent-v2/core/conversation.ts");
  const persistence = read("apps/web/lib/crm-agent-v2/core/persistence.ts");
  const executeTools = read("apps/web/lib/crm-agent-v2/core/execute-tools.ts");
  const actionHelpers = read("apps/web/lib/crm-agent-v2/actions/action-helpers.ts");
  const hardening = read("scripts/crm-agent-v2-hardening-tests.mjs");
  const chatRoute = read("apps/web/app/api/v1/crm/agent-v2/chat/route.ts");
  const aishaSmoke = read("scripts/aisha-smoke-scenarios.mjs");

  assert(runtime.indexOf("routeCrmAgentConversationTurn") < runtime.indexOf("requestCrmAgentPlannerPlan"), "Runtime must stay conversation-first before planner.");
  assert(runtime.includes("route.kind === \"smalltalk\" || route.kind === \"crm_question\" || route.kind === \"unsupported\""), "Smalltalk/crm_question/unsupported must avoid planner unless escalated.");
  assert(runtime.includes("shouldRecoverRouterFallbackWithPlanner") && runtime.includes("Escalate to planner recovery instead of natural conversation"), "Router fallback must recover through planner instead of unsafe natural conversation.");
  assert(runtime.includes("recoverAppointmentCreatePlan") && runtime.includes('"clients.search"') && runtime.includes('"services.search"'), "Empty appointment.create plans must recover into client/service searches.");
  assert(runtime.includes("recoverAppointmentCreatePlanFromMessage"), "Planner failure for appointment.create must recover into real read steps instead of conversation fallback.");
  assert(runtime.includes("taskStateClarificationAnswer"), "Runtime must not reuse hallucinated planner answers when read results leave unresolved slots.");
  assert(runtime.includes("shouldHandleActiveTaskContinuation"), "Active appointment task continuations must not depend only on router JSON.");
  assert(runtime.includes("routeDiagnostics") && runtime.includes("routerRaw"), "Router fallback diagnostics must be persisted with runtime output.");
  assert(read("apps/web/lib/crm-agent-v2/core/conversation-router.ts").includes("readOnlyCrmQuestionDecision"), "Router fallback must preserve read-only CRM questions when the LLM route degrades.");
  assert(runtime.includes("handleCrmAgentTaskContinuation") && runtime.indexOf("routeDecision.kind === \"task_continuation\"") < runtime.indexOf("const plannerResult = await requestCrmAgentPlannerPlan"), "Task continuation must use latest state before planner.");
  assert(conversation.includes("input.route.kind === \"crm_question\" && !draft.shouldEscalateToPlanner"), "CRM questions must run only read-only conversation tools.");
  assert(conversation.includes("withFallbackReadToolRequest") && conversation.includes("readToolForSuggestedGoal"), "CRM questions must fall back to router-suggested read tools when draft tools are missing.");
  assert(!conversation.includes("actions.prepare") && !conversation.includes("actions.confirm"), "Conversation layer must not draft or execute actions.");
  assert(conversation.includes("enforceNoMutationSuccessWithoutToolResult") && conversation.includes("Данные в CRM не изменены"), "Conversation layer must block false mutation-success answers without action/tool results.");
  assert(conversation.includes("stripUnsafeToolArgs") && conversation.includes("allowedToolNames"), "Conversation read tools must strip unsafe ids and enforce permissions.");
  assert(chatRoute.includes("accountId: auth.session.accountId") && !chatRoute.includes("body.accountId"), "Chat API must derive accountId from auth only.");
  assert(chatRoute.includes("enforceRateLimit") && chatRoute.includes("crm-agent-v2-chat"), "Chat API must rate-limit CRM Agent turns.");
  assert(persistence.includes("where: { id: input.sessionId, accountId: input.accountId }"), "Session persistence must be account scoped.");
  assert(persistence.includes("where: { id: input.toolCallId, accountId: input.accountId }"), "Tool-call updates must be account scoped.");
  assert(persistence.includes("where: { id: input.actionId, accountId: input.accountId, status: \"PENDING\" }"), "Action confirmation must be account scoped and pending-only.");
  assert(executeTools.includes('if (action.status === "EXECUTED") return'), "Action confirmation must be idempotent for already executed actions.");
  assert(executeTools.includes("const preview = definition.preview ? await definition.preview") && executeTools.includes("writeCrmAgentAudit"), "Execute path must write audit with preview context.");
  assert(executeTools.indexOf("const result = await definition.execute") < executeTools.lastIndexOf("writeCrmAgentAudit"), "Execute path must audit after successful handler execution.");
  assert(hardening.includes("mutating action must define preview") && hardening.includes("critical action must require separate sensitive confirmation"), "Hardening suite must enforce preview and critical confirmation policy.");
  assert(
    (executeTools.includes("assertClientBelongsToAccount") || actionHelpers.includes("assertClientBelongsToAccount")) &&
      (executeTools.includes("assertServiceLocationBinding") || actionHelpers.includes("assertServiceLocationBinding")),
    "Execute path must enforce ownership and binding checks.",
  );
  assert(aishaSmoke.includes("const checks = []") && aishaSmoke.includes("function check("), "Aisha smoke regression suite must remain present.");
}

async function main() {
  await testRealAccountNorthernOrchid();
  const fixture = await createFixture();
  await testAmbiguitySelection(fixture);
  await testDraftEdit(fixture);
  await testCrmQuestionReadOnly(fixture);
  await testTaskContinuationStateAndDraft(fixture);
  await testCrossAccountDenial(fixture);
  await testConfirmExecuteAppointment(fixture);
  await testMediaExecutePath(fixture);
  await testCampaignExecutePath(fixture);
  await testWorkerJobRateLimits(fixture);
  await testLiveApiRoutes(fixture);
  await testRejection(fixture);
  await testAishaSmokeRegression();
  console.log(JSON.stringify({ ok: true, runId }));
}

async function testRealAccountNorthernOrchid() {
  const accountId = Number(process.env.CRM_AGENT_V2_REAL_ACCOUNT_ID ?? 0);
  if (!Number.isInteger(accountId) || accountId <= 0) return;

  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, name: true, slug: true } });
  assert(account?.slug === "severnaya-orhideya", `Real CRM Agent account must be severnaya-orhideya, got ${account?.slug ?? "missing"}.`);

  const vitalByFormal = await resolveCrmAgentClient({ accountId }, { query: "Виталий", take: 8 });
  const vitalByUserText = await resolveCrmAgentClient({ accountId }, { query: "виталю", take: 8 });
  const formalTitles = vitalByFormal.candidates.map((candidate) => candidate.title);
  const userTextTitles = vitalByUserText.candidates.map((candidate) => candidate.title);
  assert(formalTitles.some((title) => title.includes("Виталя")), "Real account client search must match Виталий to stored Виталя.");
  assert(userTextTitles.some((title) => title.includes("Виталя")), "Real account client search must match user text виталю to stored Виталя.");
  assert(vitalByFormal.status === "ambiguous", "Real account has multiple Виталя clients, so client slot must be ambiguous, not not_found.");

  const haircut = await resolveCrmAgentService({ accountId }, { query: "стрижка", take: 8 });
  const serviceTitles = haircut.candidates.map((candidate) => candidate.title);
  assert(serviceTitles.includes("Мужская стрижка"), "Real account service search must include Мужская стрижка for стрижка.");
  assert(haircut.status === "ambiguous", "Real account haircut query should stay ambiguous until the operator picks a service.");
}

async function createFixture() {
  const [account, otherAccount] = await Promise.all([
    prisma.account.create({
      data: {
        name: `CRM Agent v2 Integration ${runId}`,
        slug: runId,
        status: "ACTIVE",
        timeZone: "Europe/Moscow",
      },
    }),
    prisma.account.create({
      data: {
        name: `CRM Agent v2 Other ${runId}`,
        slug: `${runId}-other`,
        status: "ACTIVE",
        timeZone: "Europe/Moscow",
      },
    }),
  ]);
  created.accountId = account.id;
  created.otherAccountId = otherAccount.id;

  await prisma.aiAccountAccess.createMany({
    data: [
      {
        accountId: account.id,
        aiEnabled: true,
        siteAssistantEnabled: true,
        crmAgentEnabled: true,
      },
      {
        accountId: otherAccount.id,
        aiEnabled: true,
        siteAssistantEnabled: true,
        crmAgentEnabled: true,
      },
    ],
  });

  const [clientA, clientB, specialistUser] = await Promise.all([
    prisma.client.create({ data: { accountId: account.id, firstName: "Anna", phone: `+7900${Date.now().toString().slice(-7)}` } }),
    prisma.client.create({ data: { accountId: account.id, firstName: "Anna Maria", phone: `+7901${Date.now().toString().slice(-7)}` } }),
    prisma.user.create({ data: { email: `${runId}-specialist@example.test`, status: "ACTIVE", type: "STAFF" } }),
  ]);
  created.clientIds.push(clientA.id, clientB.id);
  created.specialistUserId = specialistUser.id;

  const [location, service, specialist] = await Promise.all([
    prisma.location.create({ data: { accountId: account.id, name: "Main", address: "Test street", status: "ACTIVE" } }),
    prisma.service.create({ data: { accountId: account.id, name: "Manicure", baseDurationMin: 60, basePrice: "2500", isActive: true } }),
    prisma.specialistProfile.create({ data: { accountId: account.id, userId: specialistUser.id, isPublic: true } }),
  ]);

  await Promise.all([
    prisma.serviceLocation.create({ data: { serviceId: service.id, locationId: location.id } }),
    prisma.specialistLocation.create({ data: { specialistId: specialist.id, locationId: location.id } }),
    prisma.specialistService.create({ data: { specialistId: specialist.id, serviceId: service.id } }),
  ]);

  const session = await prisma.crmAgentSession.create({
    data: { accountId: account.id, userId: null, mode: "chat", title: "Integration scenario" },
  });
  created.sessionIds.push(session.id);

  return { account, otherAccount, clientA, clientB, location, service, specialist, session };
}

async function testAmbiguitySelection({ account, clientA, clientB, session }) {
  await prisma.crmAgentState.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      goalType: "appointment.create",
      status: "needs_clarification",
      slots: { client: { query: "Anna", status: "ambiguous" } },
      candidates: {
        client: [
          { type: "client", id: clientA.id, title: "Anna" },
          { type: "client", id: clientB.id, title: "Anna Maria" },
        ],
      },
      selected: {},
      missing: ["client"],
    },
  });

  await prisma.crmAgentState.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      goalType: "appointment.create",
      status: "ready_to_plan",
      slots: { client: { query: "Anna", selectedId: clientA.id, status: "resolved" } },
      candidates: {
        client: [
          { type: "client", id: clientA.id, title: "Anna" },
          { type: "client", id: clientB.id, title: "Anna Maria" },
        ],
      },
      selected: { client: clientA.id },
      missing: [],
    },
  });

  const latest = await prisma.crmAgentState.findFirst({ where: { accountId: account.id, sessionId: session.id }, orderBy: { updatedAt: "desc" } });
  assert(latest?.status === "ready_to_plan", "Selection should advance state to ready_to_plan.");
  assert(latest?.selected?.client === clientA.id, "Selection should persist selected client id.");
}

async function testDraftEdit({ account, session, clientA, service, specialist, location }) {
  const action = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "appointment.create",
      summary: "Create appointment draft",
      riskLevel: "medium",
      permission: "crm.appointments.write",
      payload: {
        clientId: clientA.id,
        serviceId: service.id,
        specialistId: specialist.id,
        locationId: location.id,
        startAt: "2030-01-15T10:00:00.000Z",
        comment: "Initial",
      },
    },
  });
  created.actionIds.push(action.id);

  await prisma.crmAgentAction.updateMany({
    where: { id: action.id, accountId: account.id, status: "PENDING" },
    data: { payload: { ...(action.payload ?? {}), comment: "Edited draft" } },
  });

  const updated = await prisma.crmAgentAction.findUnique({ where: { id: action.id } });
  assert(updated?.payload?.comment === "Edited draft", "Draft edit should update pending action payload.");
  return updated;
}

async function testCrmQuestionReadOnly({ account, session }) {
  await prisma.crmAgentMessage.create({
    data: {
      sessionId: session.id,
      role: "user",
      content: "What is on the appointment schedule today?",
      data: { mode: "question" },
    },
  });

  const toolCall = await prisma.crmAgentToolCall.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      planStepId: null,
      toolName: "appointments.search",
      args: { dateFrom: "2030-01-15", dateTo: "2030-01-15" },
      status: "DONE",
      result: { appointments: [] },
      finishedAt: new Date(),
    },
  });

  await prisma.crmAgentAudit.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      action: "conversation.read_tool",
      targetType: "tool",
      targetId: "appointments.search",
      data: { toolCallId: toolCall.id, reason: "today schedule question" },
    },
  });

  await prisma.crmAgentMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: "No appointments found.",
      data: { mode: "question", usedTools: [{ toolName: "appointments.search", status: "done" }] },
    },
  });

  const [plans, actions, storedToolCall, audit] = await Promise.all([
    prisma.crmAgentPlan.count({ where: { accountId: account.id, sessionId: session.id, goalType: "crm_question" } }),
    prisma.crmAgentAction.count({ where: { accountId: account.id, sessionId: session.id, actionType: { in: ["actions.prepare", "actions.confirm"] } } }),
    prisma.crmAgentToolCall.findUnique({ where: { id: toolCall.id } }),
    prisma.crmAgentAudit.findFirst({ where: { accountId: account.id, sessionId: session.id, action: "conversation.read_tool", targetId: "appointments.search" } }),
  ]);

  assert(plans === 0, "CRM question read-only path must not create a plan.");
  assert(actions === 0, "CRM question read-only path must not create an action draft.");
  assert(storedToolCall?.planStepId === null && storedToolCall.status === "DONE", "CRM question read tool should be traced without a plan step.");
  assert(audit?.accountId === account.id, "CRM question read tool should write account-scoped audit.");
}

async function testTaskContinuationStateAndDraft({ account, session, clientA, clientB, service, specialist, location }) {
  await prisma.crmAgentState.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      goalType: "task_continuation",
      status: "ready_to_plan",
      slots: {
        client: { query: "Anna", selectedId: clientB.id, status: "resolved" },
        time: { value: "2030-01-15T15:00:00.000Z", status: "resolved" },
      },
      candidates: {
        client: [
          { type: "client", id: clientA.id, title: "Anna" },
          { type: "client", id: clientB.id, title: "Anna Maria" },
        ],
      },
      selected: { client: clientB.id, time: "2030-01-15T15:00:00.000Z" },
      missing: [],
    },
  });

  const action = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "appointment.create",
      summary: "Continuation draft",
      riskLevel: "medium",
      permission: "crm.appointments.write",
      payload: {
        clientId: clientB.id,
        serviceId: service.id,
        specialistId: specialist.id,
        locationId: location.id,
        startAt: "2030-01-15T15:00:00.000Z",
        comment: "Continuation",
      },
    },
  });
  created.actionIds.push(action.id);

  await prisma.crmAgentAction.updateMany({
    where: { id: action.id, accountId: account.id, status: "PENDING" },
    data: { payload: { ...(action.payload ?? {}), comment: "Continuation edited" } },
  });

  const [latestState, latestPending] = await Promise.all([
    prisma.crmAgentState.findFirst({ where: { accountId: account.id, sessionId: session.id }, orderBy: { updatedAt: "desc" } }),
    prisma.crmAgentAction.findFirst({ where: { accountId: account.id, sessionId: session.id, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
  ]);

  assert(latestState?.selected?.client === clientB.id, "Task continuation should persist text-selected client in state.");
  assert(latestState?.selected?.time === "2030-01-15T15:00:00.000Z", "Task continuation should persist text-selected time in state.");
  assert(latestPending?.payload?.comment === "Continuation edited", "Task continuation should preserve editable pending draft context.");
}

async function testCrossAccountDenial({ account, otherAccount, session }) {
  const otherSessionLookup = await prisma.crmAgentSession.findFirst({
    where: { id: session.id, accountId: otherAccount.id },
  });
  assert(!otherSessionLookup, "Session lookup with another account must return nothing.");

  const plan = await prisma.crmAgentPlan.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      goalType: "cross_account_negative",
      goal: { type: "cross_account_negative" },
      status: "planned",
      steps: { create: { order: 1, type: "tool", toolName: "appointments.search", args: {}, status: "pending" } },
    },
    include: { steps: true },
  });

  const wrongPlanStepUpdate = await prisma.crmAgentPlanStep.updateMany({
    where: { id: plan.steps[0].id, plan: { accountId: otherAccount.id } },
    data: { status: "done" },
  });
  assert(wrongPlanStepUpdate.count === 0, "Plan step update with another account must not affect rows.");

  const toolCall = await prisma.crmAgentToolCall.create({
    data: { accountId: account.id, sessionId: session.id, planStepId: plan.steps[0].id, toolName: "appointments.search", args: {} },
  });
  const wrongToolCallUpdate = await prisma.crmAgentToolCall.updateMany({
    where: { id: toolCall.id, accountId: otherAccount.id },
    data: { status: "DONE", finishedAt: new Date() },
  });
  const storedToolCall = await prisma.crmAgentToolCall.findUnique({ where: { id: toolCall.id } });
  assert(wrongToolCallUpdate.count === 0 && storedToolCall?.status === "RUNNING", "Tool-call update with another account must not affect rows.");

  const action = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "client.update",
      summary: "Cross-account negative action",
      riskLevel: "low",
      permission: "crm.clients.write",
      payload: { clientId: 1, firstName: "Blocked" },
    },
  });
  created.actionIds.push(action.id);

  const wrongActionUpdate = await prisma.crmAgentAction.updateMany({
    where: { id: action.id, accountId: otherAccount.id, status: "PENDING" },
    data: { status: "CONFIRMED" },
  });
  const storedAction = await prisma.crmAgentAction.findUnique({ where: { id: action.id } });
  assert(wrongActionUpdate.count === 0 && storedAction?.status === "PENDING", "Action update with another account must not affect rows.");
}

async function testConfirmExecuteAppointment({ account, session, clientA, service, specialist, location }) {
  const startAt = new Date("2030-01-15T12:00:00.000Z");
  const endAt = new Date("2030-01-15T13:00:00.000Z");
  const action = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "appointment.create",
      summary: "Create appointment",
      riskLevel: "medium",
      permission: "crm.appointments.create",
      payload: {
        clientId: clientA.id,
        serviceId: service.id,
        specialistId: specialist.id,
        locationId: location.id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
    },
  });
  created.actionIds.push(action.id);

  const confirmHandler = getCrmAgentExecuteToolHandler("actions.confirm");
  assert(typeof confirmHandler === "function", "actions.confirm handler must be importable for DB-backed execution tests.");

  const wrongAccountDenied = await confirmHandler(
    { actionId: action.id },
    {
      accountId: account.id + 999_999,
      userId: null,
      sessionId: session.id,
      permissions: ["crm.appointments.create"],
    },
  )
    .then(() => false)
    .catch((error) => error instanceof Error && error.message === "Action not found.");
  assert(wrongAccountDenied, "Real actions.confirm must deny cross-account action execution.");

  const confirmResult = await confirmHandler({
    actionId: action.id,
  }, {
    accountId: account.id,
    userId: null,
    sessionId: session.id,
    permissions: ["crm.appointments.create"],
  });
  assert(confirmResult?.status === "EXECUTED", "Real actions.confirm should execute the appointment action.");
  const appointmentId = confirmResult?.result?.data?.appointmentId;
  assert(Number.isInteger(appointmentId), "Real actions.confirm should return an appointment id.");
  created.appointmentIds.push(appointmentId);

  const repeatedConfirm = await confirmHandler({
    actionId: action.id,
  }, {
    accountId: account.id,
    userId: null,
    sessionId: session.id,
    permissions: ["crm.appointments.create"],
  });
  assert(repeatedConfirm?.status === "EXECUTED", "Repeated actions.confirm should be idempotent.");
  assert(repeatedConfirm?.result?.data?.appointmentId === appointmentId, "Repeated actions.confirm must not create a second appointment.");

  const conflictAction = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "appointment.create",
      summary: "Create conflicting appointment",
      riskLevel: "medium",
      permission: "crm.appointments.create",
      payload: {
        clientId: clientA.id,
        serviceId: service.id,
        specialistId: specialist.id,
        locationId: location.id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      },
    },
  });
  created.actionIds.push(conflictAction.id);

  const conflictResult = await confirmHandler({
    actionId: conflictAction.id,
  }, {
    accountId: account.id,
    userId: null,
    sessionId: session.id,
    permissions: ["crm.appointments.create"],
  });
  assert(conflictResult?.status === "FAILED", "Conflicting appointment execution should fail through the real execute path.");
  assert(String(conflictResult?.error ?? "").includes("conflicts"), "Conflicting appointment failure should explain the slot conflict.");

  const [storedAction, storedAppointment, audit, appointmentCount, failedConflict] = await Promise.all([
    prisma.crmAgentAction.findUnique({ where: { id: action.id } }),
    prisma.appointment.findUnique({ where: { id: appointmentId }, include: { services: true, statusHistory: true } }),
    prisma.crmAgentAudit.findFirst({ where: { accountId: account.id, sessionId: session.id, action: "appointment.create", targetId: String(action.id) } }),
    prisma.appointment.count({ where: { accountId: account.id, specialistId: specialist.id, locationId: location.id, startAt, endAt } }),
    prisma.crmAgentAction.findUnique({ where: { id: conflictAction.id } }),
  ]);
  assert(storedAction?.status === "EXECUTED", "Confirm scenario should mark action EXECUTED.");
  assert(storedAction?.result?.data?.appointmentId === appointmentId, "Confirm scenario should store appointment result.");
  assert(storedAppointment?.services.length === 1, "Created appointment should include service link.");
  assert(storedAppointment?.statusHistory.length === 1, "Created appointment should include status history.");
  assert(audit?.data?.actionName === "appointment.create", "Real execute path should write action audit.");
  assert(audit?.data?.result?.data?.appointmentId === appointmentId, "Audit payload should include execute result.");
  assert(Array.isArray(audit?.data?.diff), "Audit payload should include preview diff.");
  assert(appointmentCount === 1, "Idempotent/conflict checks should leave exactly one appointment in the slot.");
  assert(failedConflict?.status === "FAILED", "Failed conflict action should persist FAILED status.");
}

async function testMediaExecutePath({ account, session }) {
  const confirmHandler = getCrmAgentExecuteToolHandler("actions.confirm");
  assert(typeof confirmHandler === "function", "actions.confirm handler must be importable for media execution tests.");

  const uploadAction = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "media.upload",
      summary: "Upload media",
      riskLevel: "medium",
      permission: "crm.media.upload",
      payload: {
        url: `https://example.test/${runId}/asset.jpg`,
        type: "image/jpeg",
        width: 640,
        height: 480,
        altText: "Initial alt",
        metadata: { source: "integration" },
      },
    },
  });
  created.actionIds.push(uploadAction.id);

  const uploadResult = await confirmHandler({ actionId: uploadAction.id }, {
    accountId: account.id,
    userId: null,
    sessionId: session.id,
    permissions: ["crm.media.upload"],
  });
  const mediaAssetId = uploadResult?.result?.data?.mediaAssetId;
  assert(uploadResult?.status === "EXECUTED" && Number.isInteger(mediaAssetId), "media.upload should execute through actions.confirm.");
  created.mediaAssetIds.push(mediaAssetId);

  const altAction = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "media.update_alt",
      summary: "Update media alt",
      riskLevel: "low",
      permission: "crm.media.update",
      payload: { assetId: mediaAssetId, altText: "Updated integration alt" },
    },
  });
  const metadataAction = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "media.update_metadata",
      summary: "Update media metadata",
      riskLevel: "medium",
      permission: "crm.media.update",
      payload: { assetId: mediaAssetId, metadata: { source: "integration", checked: true } },
    },
  });
  const archiveAction = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "media.archive",
      summary: "Archive media",
      riskLevel: "high",
      permission: "crm.media.update",
      payload: { assetId: mediaAssetId },
    },
  });
  created.actionIds.push(altAction.id, metadataAction.id, archiveAction.id);

  const altResult = await confirmHandler({ actionId: altAction.id }, { accountId: account.id, userId: null, sessionId: session.id, permissions: ["crm.media.update"] });
  const metadataResult = await confirmHandler({ actionId: metadataAction.id }, { accountId: account.id, userId: null, sessionId: session.id, permissions: ["crm.media.update"] });
  const archiveResult = await confirmHandler({ actionId: archiveAction.id }, { accountId: account.id, userId: null, sessionId: session.id, permissions: ["crm.media.update"] });

  const [asset, auditCount] = await Promise.all([
    prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } }),
    prisma.crmAgentAudit.count({
      where: {
        accountId: account.id,
        sessionId: session.id,
        action: { in: ["media.upload", "media.update_alt", "media.update_metadata", "media.archive"] },
      },
    }),
  ]);
  assert(altResult?.status === "EXECUTED", "media.update_alt should execute through actions.confirm.");
  assert(metadataResult?.status === "EXECUTED", "media.update_metadata should execute through actions.confirm.");
  assert(archiveResult?.status === "EXECUTED", "media.archive should execute through actions.confirm.");
  assert(asset?.altText === "Updated integration alt", "media.update_alt should persist altText.");
  assert(asset?.metadata?.checked === true, "media.update_metadata should persist metadata.");
  assert(asset?.archivedAt instanceof Date, "media.archive should persist archivedAt.");
  assert(auditCount === 4, "Media execute path should write audit rows for each action.");
}

async function testCampaignExecutePath({ account, session, clientA }) {
  const confirmHandler = getCrmAgentExecuteToolHandler("actions.confirm");
  assert(typeof confirmHandler === "function", "actions.confirm handler must be importable for campaign execution tests.");

  const createAction = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "campaign.create_retention",
      summary: "Create retention campaign",
      riskLevel: "high",
      permission: "crm.marketing.manage",
      payload: {
        title: "Integration retention",
        clientIds: [clientA.id],
        message: "Integration campaign message",
        channels: ["SMS"],
      },
    },
  });
  created.actionIds.push(createAction.id);

  const createResult = await confirmHandler({ actionId: createAction.id }, {
    accountId: account.id,
    userId: null,
    sessionId: session.id,
    permissions: ["crm.marketing.manage"],
  });
  const campaignId = createResult?.result?.data?.campaignId;
  assert(createResult?.status === "EXECUTED" && Number.isInteger(campaignId), "campaign.create_retention should execute through actions.confirm.");
  created.campaignIds.push(campaignId);

  const sendAction = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "campaign.send",
      summary: "Send campaign",
      riskLevel: "critical",
      permission: "crm.marketing.send",
      payload: { campaignId },
    },
  });
  created.actionIds.push(sendAction.id);

  const sendResult = await confirmHandler({ actionId: sendAction.id }, {
    accountId: account.id,
    userId: null,
    sessionId: session.id,
    permissions: ["crm.marketing.send"],
  });

  const [campaign, recipientCount, auditCount] = await Promise.all([
    prisma.crmAgentCampaign.findFirst({ where: { id: campaignId, accountId: account.id } }),
    prisma.crmAgentCampaignRecipient.count({ where: { campaignId, accountId: account.id } }),
    prisma.crmAgentAudit.count({ where: { accountId: account.id, sessionId: session.id, action: { in: ["campaign.create_retention", "campaign.send"] } } }),
  ]);
  assert(sendResult?.status === "EXECUTED", "campaign.send should execute through actions.confirm.");
  assert(campaign?.status === "READY", "campaign.send should mark campaign READY for worker delivery.");
  assert(recipientCount === 1, "campaign.send should create recipients for the selected audience.");
  assert(auditCount === 2, "Campaign execute path should write audit rows for create and send.");
}

async function testWorkerJobRateLimits({ account, clientA }) {
  const worker = await workerModulePromise;
  assert(typeof worker.sendCrmAgentV2Campaigns === "function", "Worker must export campaign processor for job-level tests.");
  assert(typeof worker.processCrmAgentV2NotificationOutbox === "function", "Worker must export notification outbox processor for job-level tests.");
  assert(typeof worker.processCrmAgentV2WebhookDeliveries === "function", "Worker must export webhook delivery processor for job-level tests.");

  await prisma.crmAgentCampaign.updateMany({
    where: { accountId: account.id, status: { in: ["READY", "SCHEDULED", "SENDING"] } },
    data: { status: "SENT", sentAt: new Date() },
  });

  const campaign = await prisma.crmAgentCampaign.create({
    data: {
      accountId: account.id,
      title: "Worker rate limit campaign",
      goal: "worker-rate-limit",
      audience: { clientIds: [clientA.id] },
      offer: {},
      content: { message: "Worker batch limit" },
      channels: ["SMS"],
      status: "READY",
      recipients: {
        create: Array.from({ length: 3 }, (_, index) => ({
          accountId: account.id,
          clientId: clientA.id,
          channel: "SMS",
          target: `+7900000000${index}`,
          message: `Worker batch limit ${index}`,
        })),
      },
    },
    include: { recipients: true },
  });
  created.campaignIds.push(campaign.id);

  const outboxItems = await Promise.all(
    Array.from({ length: 3 }, (_, index) =>
      prisma.outboxItem.create({
        data: {
          scope: "ACCOUNT",
          accountId: account.id,
          userId: null,
          eventName: `worker.rate_limit.${index}`,
          payload: { channel: "SMS", target: `+7900000010${index}`, bodyText: "Worker batch limit" },
          status: "PENDING",
          dedupeKey: `${runId}:outbox:${index}`,
          availableAt: new Date(Date.now() - 60_000),
        },
      }),
    ),
  );
  created.outboxItemIds.push(...outboxItems.map((item) => item.id));

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      accountId: account.id,
      url: "https://example.test/webhook",
      secret: "integration-secret",
      events: ["worker.rate_limit"],
      status: "ACTIVE",
      deliveries: {
        create: Array.from({ length: 3 }, (_, index) => ({
          eventName: "worker.rate_limit",
          payload: { index },
          signature: `sig-${index}`,
          status: "QUEUED",
        })),
      },
    },
    include: { deliveries: true },
  });
  created.webhookEndpointIds.push(endpoint.id);
  created.webhookDeliveryIds.push(...endpoint.deliveries.map((delivery) => delivery.id));

  const [campaignRun, notificationRun, webhookRun] = await Promise.all([
    worker.sendCrmAgentV2Campaigns({ accountId: account.id, campaignBatchLimit: 1, campaignRecipientBatchLimit: 2 }),
    worker.processCrmAgentV2NotificationOutbox({ accountId: account.id, notificationOutboxBatchLimit: 2 }),
    worker.processCrmAgentV2WebhookDeliveries({ accountId: account.id, webhookDeliveryBatchLimit: 2 }),
  ]);

  const [sentRecipients, pendingRecipients, doneOutbox, pendingOutbox, sentWebhooks, queuedWebhooks] = await Promise.all([
    prisma.crmAgentCampaignRecipient.count({ where: { campaignId: campaign.id, status: "SENT" } }),
    prisma.crmAgentCampaignRecipient.count({ where: { campaignId: campaign.id, status: "PENDING" } }),
    prisma.outboxItem.count({ where: { id: { in: created.outboxItemIds }, status: "DONE" } }),
    prisma.outboxItem.count({ where: { id: { in: created.outboxItemIds }, status: "PENDING" } }),
    prisma.webhookDelivery.count({ where: { id: { in: created.webhookDeliveryIds }, status: "SENT" } }),
    prisma.webhookDelivery.count({ where: { id: { in: created.webhookDeliveryIds }, status: "QUEUED" } }),
  ]);

  assert(campaignRun.recipientsSent === 2, "Campaign worker must respect recipient batch limit.");
  assert(sentRecipients === 2 && pendingRecipients === 1, "Campaign worker should leave excess recipients pending.");
  assert(notificationRun.itemsProcessed === 2, "Notification outbox worker must respect item batch limit.");
  assert(doneOutbox === 2 && pendingOutbox === 1, "Notification outbox worker should leave excess items pending.");
  assert(webhookRun.deliveriesSent === 2, "Webhook worker must respect delivery batch limit.");
  assert(sentWebhooks === 2 && queuedWebhooks === 1, "Webhook worker should leave excess deliveries queued.");
}

async function testLiveApiRoutes({ account }) {
  if (process.env.CRM_AGENT_V2_LIVE_API !== "1") {
    return;
  }

  const baseUrl = process.env.CRM_AGENT_V2_LIVE_BASE_URL || `http://127.0.0.1:${process.env.CRM_AGENT_V2_LIVE_PORT || "4012"}`;
  const server = process.env.CRM_AGENT_V2_LIVE_USE_EXISTING === "1" ? null : await startLiveApiServer(baseUrl);
  try {
    const auth = await createLiveApiAuth(account.id);
    const headers = {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    };

    const capabilities = await liveRequest(baseUrl, "/api/v1/crm/agent-v2/capabilities", { headers });
    assert(capabilities.status === 200, `Live capabilities route should return 200, got ${capabilities.status}.`);
    assert(Array.isArray(capabilities.payload?.data?.tools), "Live capabilities route should return tools.");
    assert(Array.isArray(capabilities.payload?.data?.actions), "Live capabilities route should return actions.");

    const createdSession = await liveRequest(baseUrl, "/api/v1/crm/agent-v2/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Live API route check", mode: "chat" }),
    });
    assert(createdSession.status === 201, `Live session create route should return 201, got ${createdSession.status}.`);
    const sessionId = createdSession.payload?.data?.id;
    assert(Number.isInteger(sessionId), "Live session create route should return session id.");
    created.sessionIds.push(sessionId);

    const sessionDetail = await liveRequest(baseUrl, `/api/v1/crm/agent-v2/sessions/${sessionId}`, { headers });
    assert(sessionDetail.status === 200, `Live session detail route should return 200, got ${sessionDetail.status}.`);
    assert(sessionDetail.payload?.data?.id === sessionId, "Live session detail should be account-scoped and return the created session.");

    const action = await prisma.crmAgentAction.create({
      data: {
        accountId: account.id,
        sessionId,
        userId: auth.userId,
        actionType: "memory.update",
        summary: "Live API reject check",
        riskLevel: "medium",
        permission: "crm.assistant.memory.manage",
        payload: { key: "live-api-check", value: { ok: true } },
      },
    });
    created.actionIds.push(action.id);

    const reject = await liveRequest(baseUrl, `/api/v1/crm/agent-v2/actions/${action.id}/reject`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "live api test" }),
    });
    assert(reject.status === 200, `Live action reject route should return 200, got ${reject.status}.`);
    assert(reject.payload?.data?.status === "REJECTED", "Live reject route should reject the pending action.");

    const storedAction = await prisma.crmAgentAction.findUnique({ where: { id: action.id }, select: { status: true } });
    assert(storedAction?.status === "REJECTED", "Live reject route should persist REJECTED status.");

    const unauthorized = await liveRequest(baseUrl, "/api/v1/crm/agent-v2/capabilities");
    assert(unauthorized.status === 401, `Live capabilities without auth should return 401, got ${unauthorized.status}.`);
  } finally {
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

async function createLiveApiAuth(accountId) {
  const user = await prisma.user.create({
    data: {
      email: `${runId}-live-api@example.test`,
      status: "ACTIVE",
      type: "STAFF",
    },
  });
  created.liveUserIds.push(user.id);

  const role = await prisma.role.upsert({
    where: { accountId_name: { accountId, name: "OWNER" } },
    update: {},
    create: {
      accountId,
      name: "OWNER",
    },
  });
  created.liveRoleIds.push(role.id);

  const permissionKeys = ["crm.all", "crm.assistant.agent.use", "crm.assistant.agent.write", "crm.assistant.memory.manage"];
  const permissions = await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
      }),
    ),
  );
  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    skipDuplicates: true,
  });
  await prisma.roleAssignment.create({
    data: {
      userId: user.id,
      accountId,
      roleId: role.id,
    },
  });

  const session = await createSession({ userId: user.id, sessionType: "CRM", accountId });
  return { userId: user.id, accessToken: session.accessToken };
}

async function startLiveApiServer(baseUrl) {
  const url = new URL(baseUrl);
  const port = url.port || "4012";
  const dev = spawn("npm", ["--workspace", "apps/web", "run", "dev", "--", "--port", port], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: { ...process.env },
  });

  dev.stdout?.on("data", (data) => process.stdout.write(data.toString("utf8")));
  dev.stderr?.on("data", (data) => process.stdout.write(data.toString("utf8")));

  await waitForLiveApiServer(baseUrl);
  return dev;
}

async function waitForLiveApiServer(baseUrl, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/crm/agent-v2/capabilities`);
      if (response.status === 401 || response.status === 403 || response.status === 200) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`Live API server did not become ready at ${baseUrl}: ${lastError}`);
}

async function liveRequest(baseUrl, route, init = {}) {
  const response = await fetch(`${baseUrl}${route}`, init);
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

async function testRejection({ account, session }) {
  const action = await prisma.crmAgentAction.create({
    data: {
      accountId: account.id,
      sessionId: session.id,
      actionType: "client.update",
      summary: "Reject client update",
      riskLevel: "low",
      permission: "crm.clients.write",
      payload: { clientId: 1, firstName: "Rejected" },
    },
  });
  created.actionIds.push(action.id);

  await prisma.crmAgentAction.update({
    where: { id: action.id },
    data: { status: "REJECTED", error: "Rejected by integration test" },
  });
  const rejected = await prisma.crmAgentAction.findUnique({ where: { id: action.id } });
  assert(rejected?.status === "REJECTED", "Reject scenario should mark action REJECTED.");
  assert(rejected?.error === "Rejected by integration test", "Reject scenario should persist rejection reason.");
}

async function testAishaSmokeRegression() {
  const result = spawnSync("npm", ["run", "test:aisha-dialogs:smoke"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  assert(result.status === 0, "Aisha smoke regression must pass after CRM Agent v2 changes.");
}

async function cleanup() {
  if (!created.accountId) return;
  const accountIds = [created.accountId, created.otherAccountId].filter((id) => typeof id === "number");
  await prisma.$transaction([
    prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: { in: created.appointmentIds } } }),
    prisma.appointmentService.deleteMany({ where: { appointmentId: { in: created.appointmentIds } } }),
    prisma.appointment.deleteMany({ where: { id: { in: created.appointmentIds } } }),
    prisma.crmAgentCampaignRecipient.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.crmAgentCampaign.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.deliveryLog.deleteMany({ where: { outboxItemId: { in: created.outboxItemIds } } }),
    prisma.outboxItem.deleteMany({ where: { id: { in: created.outboxItemIds } } }),
    prisma.webhookDelivery.deleteMany({ where: { id: { in: created.webhookDeliveryIds } } }),
    prisma.webhookEndpoint.deleteMany({ where: { id: { in: created.webhookEndpointIds } } }),
    prisma.crmAgentAudit.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.crmAgentToolCall.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.crmAgentAction.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.crmAgentArtifact.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.crmAgentPlanStep.deleteMany({ where: { plan: { accountId: { in: accountIds } } } }),
    prisma.crmAgentPlan.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.crmAgentState.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.crmAgentMessage.deleteMany({ where: { sessionId: { in: created.sessionIds } } }),
    prisma.crmAgentSession.deleteMany({ where: { id: { in: created.sessionIds } } }),
    prisma.specialistService.deleteMany({ where: { specialist: { accountId: created.accountId } } }),
    prisma.specialistLocation.deleteMany({ where: { specialist: { accountId: created.accountId } } }),
    prisma.serviceLocation.deleteMany({ where: { service: { accountId: created.accountId } } }),
    prisma.mediaLink.deleteMany({ where: { asset: { accountId: { in: accountIds } } } }),
    prisma.mediaAsset.deleteMany({ where: { id: { in: created.mediaAssetIds } } }),
    prisma.userSession.deleteMany({ where: { userId: { in: created.liveUserIds } } }),
    prisma.roleAssignment.deleteMany({ where: { userId: { in: created.liveUserIds } } }),
    prisma.rolePermission.deleteMany({ where: { roleId: { in: created.liveRoleIds } } }),
    prisma.role.deleteMany({ where: { id: { in: created.liveRoleIds } } }),
    prisma.user.deleteMany({ where: { id: { in: created.liveUserIds } } }),
    prisma.specialistProfile.deleteMany({ where: { accountId: created.accountId } }),
    prisma.service.deleteMany({ where: { accountId: created.accountId } }),
    prisma.location.deleteMany({ where: { accountId: created.accountId } }),
    prisma.client.deleteMany({ where: { accountId: created.accountId } }),
    prisma.aiAccountAccess.deleteMany({ where: { accountId: { in: accountIds } } }),
    prisma.account.deleteMany({ where: { id: { in: accountIds } } }),
    ...(created.specialistUserId ? [prisma.user.deleteMany({ where: { id: created.specialistUserId } })] : []),
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[crm-agent-v2-integration] cleanup failed", error);
      process.exitCode = 1;
    });
    await prisma.$disconnect();
  });
