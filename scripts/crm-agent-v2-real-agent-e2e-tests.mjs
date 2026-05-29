import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createJiti } from "jiti";

const root = process.cwd();
const reportPath = path.join(root, "docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.md");
const enabled = process.env.CRM_AGENT_V2_REAL_E2E === "1";

loadEnv();

if (!enabled) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "Set CRM_AGENT_V2_REAL_E2E=1 and DATABASE_URL to run real agent E2E tests." }));
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("[crm-agent-v2-real-e2e] DATABASE_URL is required.");
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["error"] });
const jiti = createJiti(path.join(root, "apps/web/test-entry.js"), {
  alias: { "@": path.join(root, "apps/web") },
  fsCache: false,
  moduleCache: false,
});

const { runCrmAgentTurn } = jiti("./lib/crm-agent-v2/core/runtime.ts");
const { getCrmAgentExecuteToolHandler } = jiti("./lib/crm-agent-v2/core/execute-tools.ts");
const { listCrmAgentCatalogActions } = jiti("./lib/crm-agent-v2/actions/registry.ts");

const runId = `crm-agent-v2-real-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const permissions = ["crm.all"];
const created = {
  accountId: null,
  userIds: [],
  sessionIds: [],
  appointmentIds: [],
};
const resultsByAction = new Map();
const architectureGuards = [];

const scenarios = [
  {
    id: "client-search-real-dialog",
    action: "client.search",
    mode: "conversation",
    message: "Найди клиента Анна Тестовая.",
    verify: async ({ account }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: { in: ["clients.search", "client.search"] } },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call a client search read tool.");
    },
  },
  {
    id: "appointment-create-real-dialog",
    action: "appointment.create",
    mode: "conversation_execute",
    message: "Запиши Анну Тестовую на Маникюр к Марии в Главный филиал на 15 января 2030 в 10:00.",
    verify: async ({ account, fixture, action }) => {
      const appointmentId = action?.result?.data?.appointmentId;
      const appointment = appointmentId
        ? await prisma.appointment.findFirst({ where: { id: appointmentId, accountId: account.id }, include: { services: true } })
        : await prisma.appointment.findFirst({
            where: { accountId: account.id, clientId: fixture.client.id },
            orderBy: { createdAt: "desc" },
            include: { services: true },
          });
      if (!appointment) throw new Error("Appointment was not created in DB.");
      created.appointmentIds.push(appointment.id);
      if (appointment.clientId !== fixture.client.id) throw new Error("Appointment clientId does not match fixture client.");
      if (appointment.services[0]?.serviceId !== fixture.service.id) throw new Error("Appointment service does not match fixture service.");
      if (appointment.source !== "CRM_AGENT_V2") throw new Error("Appointment source is not CRM_AGENT_V2.");
    },
  },
  {
    id: "service-update-description-real-dialog",
    action: "service.update_description",
    mode: "conversation_execute",
    message: "Поменяй описание услуги Мужская стрижка на: Тестовое описание из real E2E CRM Agent.",
    verify: async ({ fixture }) => {
      const service = await prisma.service.findUnique({ where: { id: fixture.haircut.id } });
      if (service?.description !== "Тестовое описание из real E2E CRM Agent.") {
        throw new Error(`Service description was not updated. Got: ${service?.description ?? "null"}`);
      }
    },
  },
  {
    id: "service-search-real-dialog",
    action: "service.search",
    mode: "conversation",
    message: "Найди услугу Маникюр.",
    verify: async ({ account }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: { in: ["services.search", "services.get"] } },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call a service search read tool.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes("Маникюр")) throw new Error(`Service search result does not mention fixture service. Got: ${resultText}`);
    },
  },
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
  },
];

function loadEnv() {
  for (const name of [".env.local", ".env", "apps/web/.env.local", "apps/web/.env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function extractSection13Actions() {
  const planText = read("CRM_AGENT_V2_IMPLEMENTATION_PLAN.md");
  const start = planText.indexOf("## 13.");
  const end = planText.indexOf("## 14.", start);
  if (start < 0 || end < 0) throw new Error("Cannot find section 13 in CRM_AGENT_V2_IMPLEMENTATION_PLAN.md.");
  const actions = [];
  let section = "13";
  for (const line of planText.slice(start, end).split(/\r?\n/)) {
    const heading = line.match(/^###\s+(13\.\d+)\s+(.+)$/);
    if (heading) section = `${heading[1]} ${heading[2].trim()}`;
    const action = line.trim().match(/^([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)$/)?.[1];
    if (action) actions.push({ name: action, section });
  }
  return actions;
}

async function main() {
  assertNoRuntimeDeterministicRecovery();

  const sectionActions = extractSection13Actions();
  const catalog = listCrmAgentCatalogActions();
  for (const action of sectionActions) {
    const definition = catalog.find((item) => item.name === action.name);
    resultsByAction.set(action.name, {
      section: action.section,
      action: action.name,
      catalogStatus: definition?.status ?? "missing",
      e2eStatus: "not_covered_yet",
      scenario: "",
      details: "Real dialog scenario is not defined yet.",
    });
  }

  const fixture = await createFixture();
  for (const scenario of scenarios) {
    await runScenario(fixture, scenario);
  }

  writeReport(sectionActions);
  const failures = [...resultsByAction.values()].filter((item) => item.e2eStatus === "failed");
  if (failures.length) {
    console.error(`CRM Agent v2 real E2E failed: ${failures.length}. Report: ${normalizePath(reportPath)}`);
    throw new Error(`real_e2e_failures:${failures.length}`);
  } else {
    console.log(`CRM Agent v2 real E2E completed: ${scenarios.length} scenarios, ${normalizePath(reportPath)}`);
  }
}

async function runScenario(fixture, scenario) {
  const base = resultsByAction.get(scenario.action);
  const result = {
    ...base,
    e2eStatus: "running",
    scenario: scenario.id,
    details: "",
  };
  resultsByAction.set(scenario.action, result);

  let response = null;
  try {
    response = await runCrmAgentTurn({
      accountId: fixture.account.id,
      userId: null,
      permissions,
      message: scenario.message,
      timezone: "Europe/Moscow",
    });
    created.sessionIds.push(response.sessionId);

    const pendingAction = await prisma.crmAgentAction.findFirst({
      where: { accountId: fixture.account.id, sessionId: response.sessionId, actionType: scenario.action },
      orderBy: { createdAt: "desc" },
    });

    let executedAction = pendingAction;
    if (scenario.mode === "conversation_execute") {
      if (!pendingAction) {
        throw new Error(`Agent did not prepare expected action ${scenario.action}. ${await scenarioDiagnostics(fixture.account.id, response)}`);
      }
      const confirm = getCrmAgentExecuteToolHandler("actions.confirm");
      if (!confirm) throw new Error("actions.confirm handler is not available.");
      await confirm({ actionId: pendingAction.id }, { accountId: fixture.account.id, userId: null, sessionId: response.sessionId, permissions });
      executedAction = await prisma.crmAgentAction.findUnique({ where: { id: pendingAction.id } });
      if (executedAction?.status !== "EXECUTED") {
        throw new Error(`Expected EXECUTED action, got ${executedAction?.status ?? "missing"}: ${executedAction?.error ?? ""}`);
      }
    }

    await scenario.verify({ account: fixture.account, fixture, response, action: executedAction });
    resultsByAction.set(scenario.action, {
      ...result,
      e2eStatus: "passed",
      details: scenario.mode === "conversation_execute" ? `Prepared and executed action #${executedAction?.id}.` : "Agent produced the expected read/search behavior.",
    });
  } catch (error) {
    const diagnostics = response ? ` ${await scenarioDiagnostics(fixture.account.id, response)}` : "";
    resultsByAction.set(scenario.action, {
      ...result,
      e2eStatus: "failed",
      details: `${error instanceof Error ? error.message : String(error)}${diagnostics}`,
    });
  }
}

async function scenarioDiagnostics(accountId, response) {
  const [messages, plans, toolCalls, actions, artifacts] = await Promise.all([
    prisma.crmAgentMessage.findMany({
      where: { sessionId: response.sessionId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, data: true, createdAt: true },
    }),
    prisma.crmAgentPlan.findMany({
      where: { accountId, sessionId: response.sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        goalType: true,
        goal: true,
        status: true,
        result: true,
        error: true,
        steps: {
          orderBy: { order: "asc" },
          select: { order: true, type: true, toolName: true, args: true, status: true, result: true, error: true },
        },
      },
    }),
    prisma.crmAgentToolCall.findMany({
      where: { accountId, sessionId: response.sessionId },
      orderBy: { startedAt: "asc" },
      select: { toolName: true, status: true, args: true, result: true, error: true },
    }),
    prisma.crmAgentAction.findMany({
      where: { accountId, sessionId: response.sessionId },
      orderBy: { createdAt: "asc" },
      select: { actionType: true, status: true, payload: true, error: true },
    }),
    prisma.crmAgentArtifact.findMany({
      where: { accountId, sessionId: response.sessionId },
      orderBy: { createdAt: "asc" },
      select: { type: true, title: true, data: true },
    }),
  ]);
  return JSON.stringify({
    sessionId: response.sessionId,
    answer: response.answer,
    state: response.state,
    workspaceMode: response.workspace?.mode ?? null,
    planTrace: response.planTrace?.map((step) => ({
      order: step.order,
      type: step.type,
      toolName: step.toolName,
      status: step.status,
      args: step.args,
        error: step.error,
      })),
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
      data: message.data,
      createdAt: message.createdAt,
    })),
    plans,
    toolCalls: toolCalls.map((call) => ({
      toolName: call.toolName,
      status: call.status,
      args: call.args,
      resultStatus: call.result?.status ?? null,
      error: call.error,
    })),
    actions,
    artifacts,
  });
}

function assertNoRuntimeDeterministicRecovery() {
  const runtime = read("apps/web/lib/crm-agent-v2/core/runtime.ts");
  const banned = [
    "recoverAppointmentCreatePlanFromMessage",
    "recoverAppointmentCreatePlan(",
    "extractClientQueryFromBookingMessage",
    "extractServiceQueryFromBookingMessage",
  ];
  const violations = banned.filter((needle) => runtime.includes(needle));
  const result = {
    name: "runtime has no appointment keyword/regex recovery",
    status: violations.length ? "failed" : "passed",
    details: violations.length ? `Forbidden runtime recovery symbols: ${violations.join(", ")}` : "No appointment phrase parser recovery is present in runtime.",
  };
  architectureGuards.push(result);
  if (violations.length) {
    throw new Error(result.details);
  }
}

async function createFixture() {
  const suffix = Date.now().toString().slice(-8);
  const account = await prisma.account.create({
    data: {
      name: `CRM Agent real E2E ${suffix}`,
      slug: `crm-agent-real-e2e-${suffix}`,
      status: "ACTIVE",
      timeZone: "Europe/Moscow",
    },
  });
  created.accountId = account.id;

  await prisma.aiAccountAccess.create({
    data: {
      accountId: account.id,
      aiEnabled: true,
      siteAssistantEnabled: true,
      crmAgentEnabled: true,
    },
  });
  await prisma.aiBalanceLedger.create({
    data: {
      accountId: account.id,
      type: "manual_credit",
      amountRub: "1000.000000",
      comment: "CRM Agent v2 real E2E test credit",
    },
  });

  const specialistUser = await prisma.user.create({
    data: {
      email: `${runId}-maria@example.test`,
      status: "ACTIVE",
      type: "STAFF",
      profile: {
        create: {
          firstName: "Мария",
          lastName: "Мастер",
        },
      },
    },
  });
  created.userIds.push(specialistUser.id);

  const [client, location, service, haircut, specialist] = await Promise.all([
    prisma.client.create({ data: { accountId: account.id, firstName: "Анна", lastName: "Тестовая", phone: `+7900${suffix}` } }),
    prisma.location.create({ data: { accountId: account.id, name: "Главный филиал", address: "Тестовая улица, 1", status: "ACTIVE" } }),
    prisma.service.create({ data: { accountId: account.id, name: "Маникюр", baseDurationMin: 60, basePrice: "2500", isActive: true } }),
    prisma.service.create({ data: { accountId: account.id, name: "Мужская стрижка", description: "Старое описание", baseDurationMin: 45, basePrice: "1800", isActive: true } }),
    prisma.specialistProfile.create({ data: { accountId: account.id, userId: specialistUser.id, isPublic: true } }),
  ]);

  await Promise.all([
    prisma.serviceLocation.create({ data: { serviceId: service.id, locationId: location.id } }),
    prisma.serviceLocation.create({ data: { serviceId: haircut.id, locationId: location.id } }),
    prisma.specialistLocation.create({ data: { specialistId: specialist.id, locationId: location.id } }),
    prisma.specialistService.create({ data: { specialistId: specialist.id, serviceId: service.id } }),
    prisma.specialistService.create({ data: { specialistId: specialist.id, serviceId: haircut.id } }),
  ]);

  return { account, client, location, service, haircut, specialist };
}

function writeReport(sectionActions) {
  const rows = sectionActions.map((action) => resultsByAction.get(action.name));
  const counts = countBy(rows, (row) => row.e2eStatus);
  const report = [
    "# CRM Agent v2 Real Agent E2E Test Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Run ID: ${runId}`,
    "",
    "## Summary",
    "",
    markdownTable(
      [
        { metric: "Section 13 actions", value: rows.length },
        { metric: "Real dialog scenarios", value: scenarios.length },
        { metric: "Passed", value: rows.filter((row) => row.e2eStatus === "passed").length },
        { metric: "Failed", value: rows.filter((row) => row.e2eStatus === "failed").length },
        { metric: "Not covered yet", value: rows.filter((row) => row.e2eStatus === "not_covered_yet").length },
      ],
      [
        { key: "metric", title: "Metric" },
        { key: "value", title: "Value" },
      ],
    ),
    "",
    "## E2E Status Counts",
    "",
    markdownTable(
      [...counts.entries()].map(([status, count]) => ({ status, count })),
      [
        { key: "status", title: "Status" },
        { key: "count", title: "Count" },
      ],
    ),
    "",
    "## Architecture Guards",
    "",
    markdownTable(architectureGuards, [
      { key: "name", title: "Guard" },
      { key: "status", title: "Status" },
      { key: "details", title: "Details" },
    ]),
    "",
    "## Bugs / Deviations",
    "",
    rows.some((row) => row.e2eStatus === "failed")
      ? rows.filter((row) => row.e2eStatus === "failed").map((row) => `- ${row.action}: ${row.details}`).join("\n")
      : "_Нет зафиксированных падений в покрытых real-E2E сценариях._",
    "",
    "## Per-Action Matrix",
    "",
    markdownTable(rows, [
      { key: "section", title: "Section" },
      { key: "action", title: "Action" },
      { key: "catalogStatus", title: "Catalog Status" },
      { key: "e2eStatus", title: "Real E2E Status" },
      { key: "scenario", title: "Scenario" },
      { key: "details", title: "Details" },
    ]),
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, "utf8");
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function markdownTable(rows, columns) {
  if (!rows.length) return "_Нет._";
  return [
    `| ${columns.map((column) => column.title).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => String(row?.[column.key] ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ")).join(" | ")} |`),
  ].join("\n");
}

function normalizePath(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

async function cleanup() {
  if (!created.accountId) return;
  await prisma.$transaction([
    prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: { in: created.appointmentIds } } }),
    prisma.appointmentService.deleteMany({ where: { appointmentId: { in: created.appointmentIds } } }),
    prisma.appointment.deleteMany({ where: { accountId: created.accountId } }),
    prisma.crmAgentAudit.deleteMany({ where: { accountId: created.accountId } }),
    prisma.crmAgentToolCall.deleteMany({ where: { accountId: created.accountId } }),
    prisma.crmAgentAction.deleteMany({ where: { accountId: created.accountId } }),
    prisma.crmAgentArtifact.deleteMany({ where: { accountId: created.accountId } }),
    prisma.crmAgentPlanStep.deleteMany({ where: { plan: { accountId: created.accountId } } }),
    prisma.crmAgentPlan.deleteMany({ where: { accountId: created.accountId } }),
    prisma.crmAgentState.deleteMany({ where: { accountId: created.accountId } }),
    prisma.crmAgentMessage.deleteMany({ where: { sessionId: { in: created.sessionIds } } }),
    prisma.crmAgentSession.deleteMany({ where: { id: { in: created.sessionIds } } }),
    prisma.specialistService.deleteMany({ where: { specialist: { accountId: created.accountId } } }),
    prisma.specialistLocation.deleteMany({ where: { specialist: { accountId: created.accountId } } }),
    prisma.serviceLocation.deleteMany({ where: { service: { accountId: created.accountId } } }),
    prisma.specialistProfile.deleteMany({ where: { accountId: created.accountId } }),
    prisma.service.deleteMany({ where: { accountId: created.accountId } }),
    prisma.location.deleteMany({ where: { accountId: created.accountId } }),
    prisma.client.deleteMany({ where: { accountId: created.accountId } }),
    prisma.aiAccountAccess.deleteMany({ where: { accountId: created.accountId } }),
    prisma.aiBalanceLedger.deleteMany({ where: { accountId: created.accountId } }),
    prisma.account.deleteMany({ where: { id: created.accountId } }),
    prisma.userProfile.deleteMany({ where: { userId: { in: created.userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: created.userIds } } }),
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[crm-agent-v2-real-e2e] cleanup failed", error);
      process.exitCode = 1;
    });
    await prisma.$disconnect();
  });
