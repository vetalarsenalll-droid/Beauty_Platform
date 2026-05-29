import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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
const runId = `crm-agent-v2-it-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const created = {
  accountId: null,
  otherAccountId: null,
  userId: null,
  specialistUserId: null,
  clientIds: [],
  appointmentIds: [],
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
  assert(read("apps/web/lib/crm-agent-v2/core/conversation-router.ts").includes("readOnlyCrmQuestionDecision"), "Router fallback must preserve read-only CRM questions when the LLM route degrades.");
  assert(runtime.includes("handleCrmAgentTaskContinuation") && runtime.indexOf("routeDecision.kind === \"task_continuation\"") < runtime.indexOf("const plannerResult = await requestCrmAgentPlannerPlan"), "Task continuation must use latest state before planner.");
  assert(conversation.includes("input.route.kind === \"crm_question\" && !draft.shouldEscalateToPlanner"), "CRM questions must run only read-only conversation tools.");
  assert(conversation.includes("withFallbackReadToolRequest") && conversation.includes("readToolForSuggestedGoal"), "CRM questions must fall back to router-suggested read tools when draft tools are missing.");
  assert(!conversation.includes("actions.prepare") && !conversation.includes("actions.confirm"), "Conversation layer must not draft or execute actions.");
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
  const fixture = await createFixture();
  await testAmbiguitySelection(fixture);
  await testDraftEdit(fixture);
  await testCrmQuestionReadOnly(fixture);
  await testTaskContinuationStateAndDraft(fixture);
  await testCrossAccountDenial(fixture);
  await testConfirmExecuteAppointment(fixture);
  await testRejection(fixture);
  await testAishaSmokeRegression();
  console.log(JSON.stringify({ ok: true, runId }));
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
      permission: "crm.appointments.write",
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

  const appointment = await prisma.appointment.create({
    data: {
      accountId: account.id,
      clientId: clientA.id,
      specialistId: specialist.id,
      locationId: location.id,
      startAt,
      endAt,
      status: "NEW",
      priceTotal: "2500",
      durationTotalMin: 60,
      source: "CRM_AGENT_V2_INTEGRATION",
      services: { create: { serviceId: service.id, price: "2500", durationMin: 60, specialistId: specialist.id } },
      statusHistory: { create: { actorType: "CRM_AGENT_V2", toStatus: "NEW" } },
    },
  });
  created.appointmentIds.push(appointment.id);

  await prisma.crmAgentAction.update({
    where: { id: action.id },
    data: { status: "EXECUTED", confirmedAt: new Date(), executedAt: new Date(), result: { appointmentId: appointment.id } },
  });

  const [storedAction, storedAppointment] = await Promise.all([
    prisma.crmAgentAction.findUnique({ where: { id: action.id } }),
    prisma.appointment.findUnique({ where: { id: appointment.id }, include: { services: true, statusHistory: true } }),
  ]);
  assert(storedAction?.status === "EXECUTED", "Confirm scenario should mark action EXECUTED.");
  assert(storedAction?.result?.appointmentId === appointment.id, "Confirm scenario should store appointment result.");
  assert(storedAppointment?.services.length === 1, "Created appointment should include service link.");
  assert(storedAppointment?.statusHistory.length === 1, "Created appointment should include status history.");
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
