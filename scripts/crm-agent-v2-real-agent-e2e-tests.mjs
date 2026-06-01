import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createJiti } from "jiti";

const root = process.cwd();
const scenarioFilterRaw = process.env.CRM_AGENT_V2_REAL_E2E_FILTER ?? "";
const reportPath = path.join(root, scenarioFilterRaw ? "docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.filtered.md" : "docs/CRM_AGENT_V2_REAL_AGENT_E2E_TEST_REPORT.md");
const diagnosticsPath = path.join(root, scenarioFilterRaw ? "docs/CRM_AGENT_V2_REAL_AGENT_E2E_DIAGNOSTICS.filtered.json" : "docs/CRM_AGENT_V2_REAL_AGENT_E2E_DIAGNOSTICS.json");
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
const scenarioResults = [];
const architectureGuards = [];
const failureDiagnostics = [];

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
    id: "client-view-real-dialog",
    action: "client.view",
    mode: "conversation",
    message: "Покажи карточку клиента Анна Тестовая.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: { in: ["client.view", "clients.get"] } },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call a client view/get read tool.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.client.id))) throw new Error(`client.view result does not include fixture client id. Got: ${resultText}`);
    },
  },
  {
    id: "client-resolve-real-dialog",
    action: "client.resolve",
    mode: "conversation",
    message: "Определи точного клиента по имени Анна Тестовая.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: { in: ["client.resolve", "clients.search"] } },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call a client resolve/search read tool.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.client.id))) throw new Error(`client.resolve result does not include fixture client id. Got: ${resultText}`);
    },
  },
  {
    id: "client-create-real-dialog",
    action: "client.create",
    mode: "conversation_execute",
    message: `Создай клиента Елена Реалова, телефон +79110000001, email elena-${runId}@example.test.`,
    verify: async ({ account, action }) => {
      const clientId = action?.result?.data?.clientId;
      const payloadEmail = typeof action?.payload?.email === "string" ? action.payload.email : null;
      const client = clientId
        ? await prisma.client.findFirst({ where: { id: clientId, accountId: account.id } })
        : payloadEmail
          ? await prisma.client.findFirst({ where: { accountId: account.id, email: payloadEmail } })
          : null;
      if (!client) throw new Error("Client was not created in DB.");
      if (client.firstName !== "Елена" || client.lastName !== "Реалова") {
        throw new Error(`Created client name mismatch. Got: ${client.firstName ?? ""} ${client.lastName ?? ""}`.trim());
      }
    },
  },
  {
    id: "client-update-real-dialog",
    action: "client.update",
    mode: "conversation_execute",
    message: "Обнови карточку клиента Анна Тестовая: email anna.updated@example.test.",
    verify: async ({ fixture }) => {
      const client = await prisma.client.findUnique({ where: { id: fixture.client.id } });
      if (client?.email !== "anna.updated@example.test") {
        throw new Error(`Client email was not updated. Got: ${client?.email ?? "null"}`);
      }
    },
  },
  {
    id: "client-archive-real-dialog",
    action: "client.archive",
    mode: "conversation_execute",
    message: ({ fixture }) => `Архивируй клиента Анна Тестовая, телефон ${fixture.client.phone}.`,
    verify: async ({ account, fixture }) => {
      const tag = await prisma.clientTag.findFirst({ where: { accountId: account.id, name: "archived" } });
      if (!tag) throw new Error("Archived tag was not created.");
      const assignment = await prisma.clientTagAssignment.findFirst({ where: { clientId: fixture.client.id, tagId: tag.id } });
      if (!assignment) throw new Error("Client was not archived with archived tag.");
      const note = await prisma.clientNote.findFirst({ where: { clientId: fixture.client.id, note: "Archived by CRM Agent v2." } });
      if (!note) throw new Error("Archive audit note was not created.");
    },
  },
  {
    id: "client-restore-real-dialog",
    action: "client.restore",
    mode: "conversation_execute",
    message: "Восстанови клиента Ирина Архивная из архива.",
    verify: async ({ fixture }) => {
      const assignment = await prisma.clientTagAssignment.findFirst({ where: { clientId: fixture.archivedClient.id, tagId: fixture.archivedTag.id } });
      if (assignment) throw new Error("Archived tag assignment was not removed.");
      const note = await prisma.clientNote.findFirst({ where: { clientId: fixture.archivedClient.id, note: "Restored by CRM Agent v2." } });
      if (!note) throw new Error("Restore audit note was not created.");
    },
  },
  {
    id: "client-add-contact-real-dialog",
    action: "client.add_contact",
    mode: "conversation_execute",
    message: "Добавь клиенту Анна Тестовая контакт telegram @anna_real_e2e.",
    verify: async ({ fixture, action }) => {
      const contactId = action?.result?.data?.contactId;
      const contact = contactId
        ? await prisma.clientContact.findFirst({ where: { id: contactId, clientId: fixture.client.id } })
        : await prisma.clientContact.findFirst({ where: { clientId: fixture.client.id, value: "@anna_real_e2e" } });
      if (!contact) throw new Error("Client contact was not created.");
      if (contact.type.toLowerCase() !== "telegram" || contact.value !== "@anna_real_e2e") {
        throw new Error(`Created contact mismatch. Got: ${contact.type} ${contact.value}`);
      }
    },
  },
  {
    id: "client-update-contact-real-dialog",
    action: "client.update_contact",
    mode: "conversation_execute",
    message: ({ fixture }) => `Обнови контакт #${fixture.clientContact.id}: значение +79990001122.`,
    verify: async ({ fixture }) => {
      const contact = await prisma.clientContact.findUnique({ where: { id: fixture.clientContact.id } });
      if (contact?.value !== "+79990001122") {
        throw new Error(`Client contact was not updated. Got: ${contact?.value ?? "null"}`);
      }
    },
  },
  {
    id: "client-delete-contact-real-dialog",
    action: "client.delete_contact",
    mode: "conversation_execute",
    message: ({ fixture }) => `Удали контакт #${fixture.deleteContact.id} клиента Анна Тестовая.`,
    verify: async ({ fixture }) => {
      const contact = await prisma.clientContact.findUnique({ where: { id: fixture.deleteContact.id } });
      if (contact) throw new Error("Client contact was not deleted.");
    },
  },
  {
    id: "client-add-note-real-dialog",
    action: "client.add_note",
    mode: "conversation_execute",
    message: "Добавь заметку клиенту Анна Тестовая: любит утренние визиты.",
    verify: async ({ fixture }) => {
      const note = await prisma.clientNote.findFirst({ where: { clientId: fixture.client.id, note: { contains: "любит утренние визиты" } } });
      if (!note) throw new Error("Client note was not created.");
    },
  },
  {
    id: "client-update-note-real-dialog",
    action: "client.update_note",
    mode: "conversation_execute",
    message: ({ fixture }) => `Измени заметку #${fixture.updateNote.id}: нужен вечерний визит.`,
    verify: async ({ fixture }) => {
      const note = await prisma.clientNote.findUnique({ where: { id: fixture.updateNote.id } });
      if (note?.note !== "нужен вечерний визит") {
        throw new Error(`Client note was not updated. Got: ${note?.note ?? "null"}`);
      }
    },
  },
  {
    id: "client-delete-note-real-dialog",
    action: "client.delete_note",
    mode: "conversation_execute",
    message: ({ fixture }) => `Удали заметку #${fixture.deleteNote.id} клиента Анна Тестовая.`,
    verify: async ({ fixture }) => {
      const note = await prisma.clientNote.findUnique({ where: { id: fixture.deleteNote.id } });
      if (note) throw new Error("Client note was not deleted.");
    },
  },
  {
    id: "client-add-tag-real-dialog",
    action: "client.add_tag",
    mode: "conversation_execute",
    message: "Добавь клиенту Анна Тестовая тег VIP.",
    verify: async ({ account, fixture }) => {
      const tag = await prisma.clientTag.findFirst({ where: { accountId: account.id, name: "VIP" } });
      if (!tag) throw new Error("Client tag VIP was not created.");
      const assignment = await prisma.clientTagAssignment.findFirst({ where: { clientId: fixture.client.id, tagId: tag.id } });
      if (!assignment) throw new Error("Client tag VIP was not assigned.");
    },
  },
  {
    id: "client-remove-tag-real-dialog",
    action: "client.remove_tag",
    mode: "conversation_execute",
    message: "Убери тег Удалить после теста у клиента Анна Тестовая.",
    verify: async ({ fixture }) => {
      const assignment = await prisma.clientTagAssignment.findFirst({ where: { clientId: fixture.client.id, tagId: fixture.removeTag.id } });
      if (assignment) throw new Error("Client tag assignment was not removed.");
    },
  },
  {
    id: "client-create-tag-real-dialog",
    action: "client.create_tag",
    mode: "conversation_execute",
    message: "Создай тег Постоянный клиент.",
    verify: async ({ account }) => {
      const tag = await prisma.clientTag.findFirst({ where: { accountId: account.id, name: "Постоянный клиент" } });
      if (!tag) throw new Error("Client tag was not created.");
    },
  },
  {
    id: "client-view-history-real-dialog",
    action: "client.view_history",
    mode: "conversation",
    message: "Покажи историю и заметки клиента Анна Тестовая.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: { in: ["clients.get", "client.view_history"] } },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call a client history/view read tool.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.client.id)) || !resultText.includes("история для просмотра")) {
        throw new Error(`Client history result does not include expected fixture data. Got: ${resultText}`);
      }
    },
  },
  {
    id: "client-merge-duplicates-real-dialog",
    action: "client.merge_duplicates",
    mode: "draft_only",
    message: ({ fixture }) => `Подготовь объединение дублей клиентов: основной #${fixture.client.id}, дубль #${fixture.duplicateClient.id}.`,
    verify: async ({ fixture, action }) => {
      if (!action) throw new Error("Client merge draft was not created.");
      if (action.status !== "PENDING") throw new Error(`Expected PENDING draft action, got ${action.status}.`);
      if (action.payload?.targetClientId !== fixture.client.id || action.payload?.sourceClientId !== fixture.duplicateClient.id) {
        throw new Error(`Client merge payload mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
    },
  },
  {
    id: "client-view-visits-real-dialog",
    action: "client.view_visits",
    mode: "conversation",
    message: "Покажи визиты клиента Анна Тестовая.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: "client.view_visits" },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call client.view_visits.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.fixtureAppointment.id))) throw new Error(`Client visits result does not include fixture appointment. Got: ${resultText}`);
    },
  },
  {
    id: "client-view-payments-real-dialog",
    action: "client.view_payments",
    mode: "conversation",
    message: "Покажи платежи клиента Анна Тестовая.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: "client.view_payments" },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call client.view_payments.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.paymentIntent.id))) throw new Error(`Client payments result does not include fixture payment. Got: ${resultText}`);
    },
  },
  {
    id: "client-view-reviews-real-dialog",
    action: "client.view_reviews",
    mode: "conversation",
    message: "Покажи отзывы клиента Анна Тестовая.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: "client.view_reviews" },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call client.view_reviews.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.review.id)) || !resultText.includes("Отзыв real E2E")) {
        throw new Error(`Client reviews result does not include fixture review. Got: ${resultText}`);
      }
    },
  },
  {
    id: "client-view-loyalty-real-dialog",
    action: "client.view_loyalty",
    mode: "conversation",
    message: "Покажи бонусы и лояльность клиента Анна Тестовая.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: "client.view_loyalty" },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Agent did not call client.view_loyalty.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.loyaltyWallet.id)) || !resultText.includes("real e2e bonus")) {
        throw new Error(`Client loyalty result does not include fixture wallet. Got: ${resultText}`);
      }
    },
  },
  {
    id: "client-update-consent-real-dialog",
    action: "client.update_consent",
    mode: "conversation_execute",
    message: "Обнови согласие клиента Анна Тестовая: marketing_sms разрешено.",
    verify: async ({ fixture }) => {
      const consent = await prisma.clientConsent.findFirst({ where: { clientId: fixture.client.id, type: "marketing_sms" } });
      if (!consent?.grantedAt || consent.revokedAt) {
        throw new Error(`Client consent was not granted. Got: ${JSON.stringify(consent)}`);
      }
    },
  },
  {
    id: "client-notify-real-dialog",
    action: "client.notify",
    mode: "draft_only",
    message: "Подготовь SMS клиенту Анна Тестовая с текстом: Анна, напоминаем о записи завтра в 10:00.",
    verify: async ({ fixture, action }) => {
      if (!action) throw new Error("Client notify draft was not created.");
      if (action.payload?.clientId !== fixture.client.id) {
        throw new Error(`Client notify payload clientId mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
      if (action.payload?.channel !== "sms") {
        throw new Error(`Client notify channel mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
      if (!String(action.payload?.bodyText ?? "").includes("напоминаем о записи")) {
        throw new Error(`Client notify bodyText mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
    },
  },
  {
    id: "client-create-segment-real-dialog",
    action: "client.create_segment",
    mode: "draft_only",
    message: "Подготовь сегмент клиентов с названием Тестовый сегмент real E2E по тегу Удалить после теста.",
    verify: async ({ fixture, action }) => {
      if (!action) throw new Error("Client segment draft was not created.");
      if (action.payload?.name !== "Тестовый сегмент real E2E") {
        throw new Error(`Client segment name mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
      if (action.payload?.tagName !== fixture.removeTag.name) {
        throw new Error(`Client segment tagName mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
    },
  },
  {
    id: "client-export-segment-real-dialog",
    action: "client.export_segment",
    mode: "draft_only",
    message: "Подготовь CSV экспорт клиентов с тегом Удалить после теста, максимум 50 строк.",
    verify: async ({ fixture, action }) => {
      if (!action) throw new Error("Client export draft was not created.");
      if (action.payload?.format !== "csv") {
        throw new Error(`Client export format mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
      if (action.payload?.tagName !== fixture.removeTag.name) {
        throw new Error(`Client export tagName mismatch. Got: ${JSON.stringify(action.payload)}`);
      }
    },
  },
  {
    id: "client-search-by-phone-paraphrase",
    action: "client.search",
    mode: "conversation",
    matrix: false,
    message: ({ fixture }) => `Нужно быстро найти, кто у нас с телефоном ${fixture.client.phone}.`,
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: "clients.search" },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Paraphrase did not call clients.search.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.client.id))) throw new Error(`Phone search did not resolve fixture client. Got: ${resultText}`);
    },
  },
  {
    id: "client-view-short-paraphrase",
    action: "client.view",
    mode: "conversation",
    matrix: false,
    message: "Открой Анну Тестовую в CRM.",
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: { in: ["clients.get", "clients.search"] } },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Short view paraphrase did not call a client read tool.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.client.id))) throw new Error(`Client view paraphrase did not include fixture client. Got: ${resultText}`);
    },
  },
  {
    id: "client-add-note-paraphrase",
    action: "client.add_note",
    mode: "conversation_execute",
    matrix: false,
    message: "Зафиксируй по Анне Тестовой комментарий: предпочитает напоминание за день.",
    verify: async ({ fixture }) => {
      const note = await prisma.clientNote.findFirst({ where: { clientId: fixture.client.id, note: { contains: "предпочитает напоминание за день" } } });
      if (!note) throw new Error("Client add note paraphrase did not create expected note.");
    },
  },
  {
    id: "client-notify-paraphrase",
    action: "client.notify",
    mode: "draft_only",
    matrix: false,
    message: "Собери черновик сообщения Анне Тестовой в телеграм: ждём вас завтра к 10:00.",
    verify: async ({ fixture, action }) => {
      if (action.payload?.clientId !== fixture.client.id) throw new Error(`Notify paraphrase clientId mismatch. Got: ${JSON.stringify(action.payload)}`);
      if (!String(action.payload?.bodyText ?? "").includes("завтра к 10:00")) throw new Error(`Notify paraphrase body mismatch. Got: ${JSON.stringify(action.payload)}`);
    },
  },
  {
    id: "client-history-multiturn",
    action: "client.view_history",
    mode: "conversation",
    matrix: false,
    turns: ["Найди клиента Анна Тестовая.", "Покажи по ней историю и заметки."],
    verify: async ({ account, fixture }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, toolName: { in: ["client.view_history", "clients.get"] } },
        orderBy: { startedAt: "desc" },
      });
      if (!toolCall) throw new Error("Multi-turn history did not call history/view tool.");
      const resultText = JSON.stringify(toolCall.result ?? {});
      if (!resultText.includes(String(fixture.client.id))) throw new Error(`Multi-turn history did not include fixture client. Got: ${resultText}`);
    },
  },
  {
    id: "client-delete-note-ambiguous-negative",
    action: "client.delete_note",
    mode: "no_action",
    matrix: false,
    message: "Удали заметку у клиента.",
    verify: async ({ response }) => {
      if (!/уточ|какую|номер|id|замет/i.test(response.answer)) {
        throw new Error(`Ambiguous delete note did not ask for clarification. Got: ${response.answer}`);
      }
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
    verify: async ({ account, response }) => {
      const toolCall = await prisma.crmAgentToolCall.findFirst({
        where: { accountId: account.id, sessionId: response.sessionId, toolName: { in: ["services.search", "services.get"] } },
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
  const activeScenarios = filterScenarios(scenarios, scenarioFilterRaw);
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
  for (const scenario of activeScenarios) {
    await runScenario(fixture, scenario);
  }

  writeReport(sectionActions, activeScenarios);
  const failures = scenarioResults.filter((item) => item.e2eStatus === "failed");
  if (failures.length) {
    console.error(`CRM Agent v2 real E2E failed: ${failures.length}. Report: ${normalizePath(reportPath)}`);
    throw new Error(`real_e2e_failures:${failures.length}`);
  } else {
    console.log(`CRM Agent v2 real E2E completed: ${activeScenarios.length} scenarios, ${normalizePath(reportPath)}`);
  }
}

function filterScenarios(allScenarios, rawFilter) {
  const filters = rawFilter
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!filters.length) return allScenarios;
  const filterSet = new Set(filters);
  const selected = allScenarios.filter((scenario) => filterSet.has(scenario.id) || filterSet.has(scenario.action));
  const matched = new Set(selected.flatMap((scenario) => [scenario.id, scenario.action]).filter((value) => filterSet.has(value)));
  const unknown = filters.filter((item) => !matched.has(item));
  if (unknown.length) {
    throw new Error(`Unknown CRM Agent v2 real E2E filter value(s): ${unknown.join(", ")}`);
  }
  return selected;
}

async function runScenario(fixture, scenario) {
  const base = resultsByAction.get(scenario.action);
  const result = {
    ...base,
    e2eStatus: "running",
    scenario: scenario.id,
    details: "",
  };
  if (scenario.matrix !== false) resultsByAction.set(scenario.action, result);

  let response = null;
  try {
    const turnResponses = [];
    const messages = scenario.turns ?? [scenario.message];
    for (const message of messages) {
      response = await runCrmAgentTurn({
        accountId: fixture.account.id,
        userId: null,
        permissions,
        sessionId: response?.sessionId,
        message: typeof message === "function" ? message({ fixture, response, responses: turnResponses }) : message,
        timezone: "Europe/Moscow",
      });
      if (!created.sessionIds.includes(response.sessionId)) created.sessionIds.push(response.sessionId);
      turnResponses.push(response);
    }

    const pendingAction = await prisma.crmAgentAction.findFirst({
      where: { accountId: fixture.account.id, sessionId: response.sessionId, actionType: scenario.action },
      orderBy: { createdAt: "desc" },
    });

    let executedAction = pendingAction;
    if (scenario.mode === "conversation_execute") {
      if (!pendingAction) {
        throw new Error(`Agent did not prepare expected action ${scenario.action}.`);
      }
      const confirm = getCrmAgentExecuteToolHandler("actions.confirm");
      if (!confirm) throw new Error("actions.confirm handler is not available.");
      await confirm({ actionId: pendingAction.id }, { accountId: fixture.account.id, userId: null, sessionId: response.sessionId, permissions });
      executedAction = await prisma.crmAgentAction.findUnique({ where: { id: pendingAction.id } });
      if (executedAction?.status !== "EXECUTED") {
        throw new Error(`Expected EXECUTED action, got ${executedAction?.status ?? "missing"}: ${executedAction?.error ?? ""}`);
      }
    } else if (scenario.mode === "draft_only") {
      if (!pendingAction) {
        throw new Error(`Agent did not prepare expected draft action ${scenario.action}.`);
      }
      if (pendingAction.status !== "PENDING") {
        throw new Error(`Expected PENDING draft action, got ${pendingAction.status}: ${pendingAction.error ?? ""}`);
      }
    } else if (scenario.mode === "no_action") {
      const action = await prisma.crmAgentAction.findFirst({
        where: { accountId: fixture.account.id, sessionId: response.sessionId },
        orderBy: { createdAt: "desc" },
      });
      if (action) {
        throw new Error(`Expected no action draft, got ${action.actionType} #${action.id}.`);
      }
    }

    await scenario.verify({ account: fixture.account, fixture, response, action: executedAction });
    const passedResult = {
      ...result,
      e2eStatus: "passed",
      details:
        scenario.mode === "conversation_execute"
          ? `Prepared and executed action #${executedAction?.id}.`
          : scenario.mode === "draft_only"
            ? `Prepared draft action #${executedAction?.id}.`
            : scenario.mode === "no_action"
              ? "Agent avoided unsafe action as expected."
              : "Agent produced the expected read/search behavior.",
    };
    scenarioResults.push(passedResult);
    if (scenario.matrix !== false) resultsByAction.set(scenario.action, passedResult);
  } catch (error) {
    const diagnosticId = response ? await recordFailureDiagnostic(fixture.account.id, scenario, response, error) : null;
    const failedResult = {
      ...result,
      e2eStatus: "failed",
      details: compactFailureDetails(error, diagnosticId),
    };
    scenarioResults.push(failedResult);
    if (scenario.matrix !== false) resultsByAction.set(scenario.action, failedResult);
  }
}

async function recordFailureDiagnostic(accountId, scenario, response, error) {
  const id = `failure-${failureDiagnostics.length + 1}`;
  failureDiagnostics.push({
    id,
    scenarioId: scenario.id,
    action: scenario.action,
    error: error instanceof Error ? error.message : String(error),
    diagnostics: await scenarioDiagnostics(accountId, response),
  });
  return id;
}

function compactFailureDetails(error, diagnosticId) {
  const message = truncateText(String(error instanceof Error ? error.message : error).replace(/\s+/g, " "), 500);
  if (!diagnosticId) return message;
  return `${message} Diagnostic: ${diagnosticId}; see ${normalizePath(diagnosticsPath)}.`;
}

function truncateText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
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
  return {
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
  };
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

  const [archivedClient, duplicateClient, archivedTag, clientContact, deleteContact, updateNote, deleteNote, removeTag] = await Promise.all([
    prisma.client.create({ data: { accountId: account.id, firstName: "Ирина", lastName: "Архивная", phone: `+7901${suffix}` } }),
    prisma.client.create({ data: { accountId: account.id, firstName: "Елена", lastName: "Дубль", phone: `+7902${suffix}` } }),
    prisma.clientTag.create({ data: { accountId: account.id, name: "archived" } }),
    prisma.clientContact.create({ data: { clientId: client.id, type: "phone", value: "+79990000001" } }),
    prisma.clientContact.create({ data: { clientId: client.id, type: "phone", value: "+79990000002" } }),
    prisma.clientNote.create({ data: { clientId: client.id, note: "исходная заметка для обновления" } }),
    prisma.clientNote.create({ data: { clientId: client.id, note: "исходная заметка для удаления" } }),
    prisma.clientTag.create({ data: { accountId: account.id, name: "Удалить после теста" } }),
  ]);
  await Promise.all([
    prisma.clientTagAssignment.create({ data: { clientId: archivedClient.id, tagId: archivedTag.id } }),
    prisma.clientTagAssignment.create({ data: { clientId: client.id, tagId: removeTag.id } }),
    prisma.clientNote.create({ data: { clientId: client.id, note: "история для просмотра" } }),
  ]);

  const fixtureStartAt = new Date(Date.UTC(2030, 1, 20, 9, 0, 0));
  const fixtureEndAt = new Date(Date.UTC(2030, 1, 20, 10, 0, 0));
  const fixtureAppointment = await prisma.appointment.create({
    data: {
      accountId: account.id,
      clientId: client.id,
      specialistId: specialist.id,
      locationId: location.id,
      startAt: fixtureStartAt,
      endAt: fixtureEndAt,
      status: "CONFIRMED",
      priceTotal: "2500",
      durationTotalMin: 60,
      source: "CRM_AGENT_V2_REAL_E2E_FIXTURE",
      comment: "fixture visit for client view scenarios",
      services: {
        create: {
          serviceId: service.id,
          price: "2500",
          durationMin: 60,
          specialistId: specialist.id,
        },
      },
      statusHistory: {
        create: {
          actorType: "SYSTEM",
          toStatus: "CONFIRMED",
          comment: "fixture status",
        },
      },
    },
  });
  created.appointmentIds.push(fixtureAppointment.id);

  const [paymentIntent, review, loyaltyWallet] = await Promise.all([
    prisma.paymentIntent.create({
      data: {
        accountId: account.id,
        appointmentId: fixtureAppointment.id,
        clientId: client.id,
        amount: "2500",
        currency: "RUB",
        scenario: "crm_agent_real_e2e",
        provider: "manual",
        status: "SUCCEEDED",
      },
    }),
    prisma.review.create({
      data: {
        accountId: account.id,
        clientId: client.id,
        appointmentId: fixtureAppointment.id,
        entityType: "service",
        entityId: String(service.id),
        rating: 5,
        comment: "Отзыв real E2E",
        status: "PUBLISHED",
      },
    }),
    prisma.loyaltyWallet.create({
      data: {
        accountId: account.id,
        clientId: client.id,
        balance: "120",
      },
    }),
  ]);
  const loyaltyTransaction = await prisma.loyaltyTransaction.create({
    data: {
      walletId: loyaltyWallet.id,
      type: "ADJUSTMENT",
      amount: "120",
      reason: "real e2e bonus",
      sourceType: "crm_agent_real_e2e",
    },
  });

  return {
    account,
    client,
    archivedClient,
    duplicateClient,
    archivedTag,
    clientContact,
    deleteContact,
    updateNote,
    deleteNote,
    removeTag,
    fixtureAppointment,
    paymentIntent,
    review,
    loyaltyWallet,
    loyaltyTransaction,
    location,
    service,
    haircut,
    specialist,
  };
}

function writeReport(sectionActions, activeScenarios) {
  const rows = sectionActions.map((action) => resultsByAction.get(action.name));
  const counts = countBy(rows, (row) => row.e2eStatus);
  const scenarioCounts = countBy(scenarioResults, (row) => row.e2eStatus);
  const report = [
    "# CRM Agent v2 Real Agent E2E Test Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Run ID: ${runId}`,
    scenarioFilterRaw ? `Scenario filter: ${scenarioFilterRaw}` : "Scenario filter: none",
    failureDiagnostics.length ? `Diagnostics: ${normalizePath(diagnosticsPath)}` : "Diagnostics: none",
    "",
    "## Summary",
    "",
    markdownTable(
      [
        { metric: "Section 13 actions", value: rows.length },
        { metric: "Real dialog scenarios", value: activeScenarios.length },
        { metric: "Scenario passed", value: scenarioCounts.get("passed") ?? 0 },
        { metric: "Scenario failed", value: scenarioCounts.get("failed") ?? 0 },
        { metric: "Action passed", value: rows.filter((row) => row.e2eStatus === "passed").length },
        { metric: "Action failed", value: rows.filter((row) => row.e2eStatus === "failed").length },
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
    scenarioResults.some((row) => row.e2eStatus === "failed")
      ? scenarioResults.filter((row) => row.e2eStatus === "failed").map((row) => `- ${row.scenario}: ${row.details}`).join("\n")
      : "_Нет зафиксированных падений в покрытых real-E2E сценариях._",
    "",
    "## Scenario Results",
    "",
    markdownTable(scenarioResults, [
      { key: "action", title: "Action" },
      { key: "scenario", title: "Scenario" },
      { key: "e2eStatus", title: "Status" },
      { key: "details", title: "Details" },
    ]),
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
  if (failureDiagnostics.length) {
    fs.writeFileSync(diagnosticsPath, JSON.stringify({ runId, generatedAt: new Date().toISOString(), failures: failureDiagnostics }, null, 2), "utf8");
  } else if (fs.existsSync(diagnosticsPath)) {
    fs.rmSync(diagnosticsPath);
  }
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
    prisma.loyaltyTransaction.deleteMany({ where: { wallet: { accountId: created.accountId } } }),
    prisma.loyaltyWallet.deleteMany({ where: { accountId: created.accountId } }),
    prisma.reviewVote.deleteMany({ where: { review: { accountId: created.accountId } } }),
    prisma.review.deleteMany({ where: { accountId: created.accountId } }),
    prisma.refund.deleteMany({ where: { accountId: created.accountId } }),
    prisma.transaction.deleteMany({ where: { accountId: created.accountId } }),
    prisma.paymentIntent.deleteMany({ where: { accountId: created.accountId } }),
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
    prisma.clientTagAssignment.deleteMany({ where: { client: { accountId: created.accountId } } }),
    prisma.clientTag.deleteMany({ where: { accountId: created.accountId } }),
    prisma.clientContact.deleteMany({ where: { client: { accountId: created.accountId } } }),
    prisma.clientNote.deleteMany({ where: { client: { accountId: created.accountId } } }),
    prisma.clientConsent.deleteMany({ where: { client: { accountId: created.accountId } } }),
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
