import assert from "node:assert/strict";
import path from "node:path";
import { createJiti } from "jiti";

const root = process.cwd();
const jiti = createJiti(path.join(root, "apps/web/test-entry.js"), {
  alias: { "@": path.join(root, "apps/web") },
});

const { canonicalizeCrmAgentPlan } = jiti("./lib/crm-agent-v2/core/plan-canonicalizer.ts");
const { parseCrmAgentPlannerPlan } = jiti("./lib/crm-agent-v2/core/planner.ts");
const { listCrmAgentToolsForPermissions } = jiti("./lib/crm-agent-v2/core/tools.ts");
const {
  listPlannerVisibleCrmAgentCatalogActionsForPermissions,
  summarizeCrmAgentCatalogAction,
} = jiti("./lib/crm-agent-v2/actions/registry.ts");

const permissions = ["crm.all"];
const tools = listCrmAgentToolsForPermissions(permissions);
const actions = listPlannerVisibleCrmAgentCatalogActionsForPermissions(permissions).map(summarizeCrmAgentCatalogAction);

test("client.delete_contact drops unneeded client reads and keeps direct contact id", () => {
  const result = canonicalize({
    message: "Удали контакт #69 клиента Анна Тестовая.",
    plan: {
      goal: {
        type: "client.delete_contact",
        intent: "delete",
        confidence: 0.8,
        slots: { clientId: 69, contactId: 69 },
        userFacingSummary: "Удалить контакт #69 клиента Анна Тестовая",
      },
      status: "planned",
      answer: "Готово, приступаю к удалению контакта.",
      missingSlots: [],
      steps: [
        { order: 1, type: "read", toolName: "clients.get", args: { clientId: 69 }, reason: "Find client" },
        { order: 2, type: "read", toolName: "client.view_history", args: { clientId: 69 }, reason: "Inspect client" },
        {
          order: 3,
          type: "draft",
          toolName: "actions.prepare",
          actionName: "client.delete_contact",
          args: { actionType: "client.delete_contact", payload: { contactId: 69 } },
          reason: "Prepare delete",
        },
      ],
    },
  });

  assert.equal(result.plan.status, "planned");
  assert.deepEqual(result.plan.steps.map((step) => step.toolName), ["actions.prepare"]);
  assert.equal(result.plan.steps[0].args.payload.contactId, 69);
  assert(result.findings.some((finding) => finding.code === "removed_forbidden_read_tool" || finding.code === "removed_unneeded_context_read"));
});

test("client.merge_duplicates coerces numeric id strings in payload", () => {
  const result = canonicalize({
    message: "Подготовь объединение дублей клиентов: основной #197, дубль #198.",
    plan: {
      goal: {
        type: "client.merge_duplicates",
        intent: "execute",
        confidence: 0.8,
        slots: { targetClientId: "197", sourceClientId: "198" },
        userFacingSummary: "Объединить дубли клиентов #197 и #198",
      },
      status: "planned",
      answer: "Подготовлю объединение.",
      missingSlots: [],
      steps: [
        {
          order: 1,
          type: "draft",
          toolName: "actions.prepare",
          actionName: "client.merge_duplicates",
          args: {
            actionType: "client.merge_duplicates",
            payload: { targetClientId: "197", sourceClientId: "198" },
          },
          reason: "Prepare merge",
        },
      ],
    },
  });

  const payload = result.plan.steps[0].args.payload;
  assert.equal(payload.targetClientId, 197);
  assert.equal(payload.sourceClientId, 198);
  assert.equal(result.plan.status, "planned");
});

test("client.update with consent wording canonicalizes to client.update_consent", () => {
  const result = canonicalize({
    message: "Обнови согласие клиента Анна Тестовая: marketing_sms разрешено.",
    plan: {
      goal: {
        type: "client.update",
        intent: "update",
        confidence: 0.8,
        slots: { clientId: 55 },
        userFacingSummary: "Обновить согласие клиента Анна Тестовая",
      },
      status: "planned",
      answer: "Обновлю согласие.",
      missingSlots: [],
      steps: [],
    },
  });

  assert.equal(result.plan.goal.type, "client.update_consent");
  assert.equal(result.plan.steps.at(-1).actionName, "client.update_consent");
  assert.equal(result.plan.steps.at(-1).args.payload.clientId, 55);
  assert.equal(result.plan.steps.at(-1).args.payload.type, "marketing_sms");
  assert.equal(result.plan.steps.at(-1).args.payload.granted, true);
});

test("client review read canonicalizes generic clients.search to client.view_reviews", () => {
  const result = canonicalize({
    message: "Покажи отзывы клиента Анна Тестовая.",
    plan: {
      goal: {
        type: "reviews.search",
        intent: "read",
        confidence: 0.8,
        slots: {},
        userFacingSummary: "Показать отзывы клиента Анна Тестовая",
      },
      status: "planned",
      answer: "Ищу отзывы.",
      missingSlots: [],
      steps: [{ order: 1, type: "read", toolName: "clients.search", args: { query: "Анна Тестовая" }, reason: "Find client" }],
    },
  });

  assert.equal(result.plan.goal.type, "client.view_reviews");
  assert.equal(result.plan.steps[0].toolName, "client.view_reviews");
  assert.equal(result.plan.steps[0].args.query, "Анна Тестовая");
});

test("parser and canonicalizer accept actions.prepare type and args.args payload", () => {
  const raw = JSON.stringify({
    goal: {
      type: "client.merge_duplicates",
      intent: "execute",
      confidence: 0.8,
      slots: {},
      userFacingSummary: "Объединить клиентов",
    },
    status: "planned",
    answer: "Подготовлю объединение.",
    missingSlots: [],
    steps: [
      {
        order: 1,
        type: "actions.prepare",
        actionName: "client.merge_duplicates",
        args: {
          actionType: "client.merge_duplicates",
          args: { targetClientId: "197", sourceClientId: "198" },
        },
        reason: "Prepare merge",
      },
    ],
  });
  const parsed = parseCrmAgentPlannerPlan(raw);
  assert(parsed, "plan should parse");
  assert.equal(parsed.steps[0].type, "draft");
  assert.equal(parsed.steps[0].toolName, "actions.prepare");
  assert.deepEqual(parsed.steps[0].args.payload, { targetClientId: "197", sourceClientId: "198" });

  const result = canonicalize({ message: "Подготовь объединение клиентов.", plan: parsed });
  assert.equal(result.plan.steps[0].args.payload.targetClientId, 197);
  assert.equal(result.plan.steps[0].args.payload.sourceClientId, 198);
});

test("appointment.create restores full startAt when model payload contains only time", () => {
  const result = canonicalize({
    message: "Запиши Анну Тестовую на Маникюр к Марии в Главный филиал на 15 января 2030 в 10:00.",
    plan: {
      goal: {
        type: "appointment.create",
        intent: "create",
        confidence: 0.8,
        slots: {
          client: { query: "Анна Тестовая" },
          service: { query: "Маникюр" },
          specialist: { query: "Мария" },
          location: { query: "Главный филиал" },
          date: { value: "2030-01-15" },
          time: { value: "10:00" },
        },
        userFacingSummary: "Записать Анну Тестовую на Маникюр к Марии в Главный филиал на 15 января 2030 в 10:00",
      },
      status: "planned",
      answer: "Подготовлю запись.",
      missingSlots: [],
      steps: [
        { order: 1, type: "read", toolName: "clients.search", args: { query: "Анна Тестовая" }, reason: "Find client" },
        { order: 2, type: "read", toolName: "services.search", args: { query: "Маникюр" }, reason: "Find service" },
        { order: 3, type: "read", toolName: "specialists.search", args: { query: "Мария" }, reason: "Find specialist" },
        { order: 4, type: "read", toolName: "locations.search", args: { query: "Главный филиал" }, reason: "Find location" },
        {
          order: 5,
          type: "draft",
          toolName: "actions.prepare",
          actionName: "appointment.create",
          args: {
            actionType: "appointment.create",
            payload: {
              startAt: "10:00",
              clientId: "#CLIENT_ID#",
              serviceId: "#SERVICE_ID#",
              specialistId: "#SPECIALIST_ID#",
              locationId: "#LOCATION_ID#",
            },
          },
          reason: "Prepare appointment",
        },
      ],
    },
  });

  const payload = result.plan.steps.at(-1).args.payload;
  assert.equal(payload.startAt, "2030-01-15T10:00:00.000Z");
});

test("client.notify resolves client before draft and removes invalid regex id", () => {
  const result = canonicalize({
    message: "Подготовь SMS клиенту Анна Тестовая с текстом: Анна, напоминаем о записи завтра в 10:00.",
    plan: {
      goal: {
        type: "client.notify",
        intent: "notify",
        confidence: 0.8,
        slots: {
          client: { query: "Анна" },
          bodyText: "Анна, напоминаем о записи завтра в 10:00.",
        },
        userFacingSummary: "Подготовка SMS-сообщения для Анны",
      },
      status: "planned",
      answer: "Подготовлю сообщение.",
      missingSlots: [],
      steps: [
        {
          order: 1,
          type: "draft",
          toolName: "actions.prepare",
          actionName: "client.notify",
          args: {
            actionType: "client.notify",
            payload: { clientId: ".*", bodyText: "Анна, напоминаем о записи завтра в 10:00." },
          },
          reason: "Prepare notify",
        },
      ],
    },
  });

  assert.equal(result.plan.status, "planned");
  assert.deepEqual(result.plan.steps.map((step) => step.toolName), ["clients.search", "actions.prepare"]);
  const payload = result.plan.steps.at(-1).args.payload;
  assert.equal(payload.clientId, "#CLIENT_ID#");
  assert.equal(payload.channel, "sms");
});

test("client segment drafts remove tag search reads and invalid date filters", () => {
  const result = canonicalize({
    message: "Подготовь сегмент клиентов с названием Тестовый сегмент real E2E по тегу Удалить после теста.",
    plan: {
      goal: {
        type: "client.create_segment",
        intent: "create",
        confidence: 0.8,
        slots: { name: "Тестовый сегмент real E2E", tagName: "Удалить после теста" },
        userFacingSummary: "Подготовка сегмента клиентов с названием Тестовый сегмент real E2E по тегу Удалить после теста",
      },
      status: "planned",
      answer: "Подготовлю сегмент.",
      missingSlots: [],
      steps: [
        { order: 1, type: "read", toolName: "clients.search", args: { tags: "Удалить после теста" }, reason: "Find clients" },
        {
          order: 2,
          type: "draft",
          toolName: "actions.prepare",
          actionName: "client.create_segment",
          args: {
            actionType: "client.create_segment",
            payload: {
              name: "Тестовый сегмент real E2E",
              query: "Удалить после теста",
              tagName: "Удалить после теста",
              createdFrom: "Пользовательский запрос",
            },
          },
          reason: "Prepare segment",
        },
      ],
    },
  });

  assert.deepEqual(result.plan.steps.map((step) => step.toolName), ["actions.prepare"]);
  const payload = result.plan.steps[0].args.payload;
  assert.equal(payload.name, "Тестовый сегмент real E2E");
  assert.equal(payload.tagName, "Удалить после теста");
  assert.equal(payload.query, undefined);
  assert.equal(payload.createdFrom, undefined);
});

test("client.export alias maps filterTag slot to export segment tagName", () => {
  const result = canonicalize({
    message: "Подготовь CSV экспорт клиентов с тегом Удалить после теста, максимум 50 строк.",
    plan: {
      goal: {
        type: "client.export",
        intent: "execute",
        confidence: 0.8,
        slots: { filterTag: "Удалить после теста", take: 50, format: "CSV" },
        userFacingSummary: "Подготовка CSV экспорта клиентов с тегом Удалить после теста, максимум 50 строк",
      },
      status: "planned",
      answer: "Подготовлю экспорт.",
      missingSlots: [],
      steps: [],
    },
  });

  assert.equal(result.plan.goal.type, "client.export_segment");
  assert.equal(result.plan.steps[0].actionName, "client.export_segment");
  assert.deepEqual(result.plan.steps[0].args.payload, {
    tagName: "Удалить после теста",
    format: "csv",
    take: 50,
  });
});

test("client.update comment wording canonicalizes path note payload to client.add_note", () => {
  const result = canonicalize({
    message: "Зафиксируй по Анне Тестовой комментарий: предпочитает напоминание за день.",
    plan: {
      goal: {
        type: "client.update",
        intent: "update",
        confidence: 0.8,
        slots: { client: { query: "Анна Тестовая" }, note: { query: "предпочитает напоминание за день" } },
        userFacingSummary: "Зафиксировать комментарий о предпочтении Анны Тестовой",
      },
      status: "planned",
      answer: "Добавлю комментарий.",
      missingSlots: [],
      steps: [
        { order: 1, type: "read", toolName: "clients.search", args: { query: "Анна Тестовая" }, reason: "Find client" },
        {
          order: 2,
          type: "draft",
          toolName: "actions.prepare",
          actionName: "client.add_note",
          args: {
            actionType: "client.add_note",
            payload: { clientId: "#CLIENT_ID#", note: ".slots.note.query" },
          },
          reason: "Prepare note",
        },
      ],
    },
  });

  assert.equal(result.plan.goal.type, "client.add_note");
  assert.equal(result.plan.steps.at(-1).actionName, "client.add_note");
  assert.equal(result.plan.steps.at(-1).args.payload.note, "предпочитает напоминание за день");
});

test("known goal action replaces unknown draft action emitted by model", () => {
  const result = canonicalize({
    message: "Создай тег Постоянный клиент.",
    plan: {
      goal: {
        type: "client.create_tag",
        intent: "create",
        confidence: 0.8,
        slots: { name: "Постоянный клиент" },
        userFacingSummary: "Создать тег Постоянный клиент",
      },
      status: "planned",
      answer: "Создам тег.",
      missingSlots: [],
      steps: [
        {
          order: 1,
          type: "draft",
          toolName: "actions.prepare",
          actionName: "client.tags.create",
          args: { actionType: "client.tags.create", payload: { name: "Постоянный клиент" } },
          reason: "Prepare tag",
        },
      ],
    },
  });

  assert.equal(result.plan.status, "planned");
  assert.equal(result.plan.steps[0].actionName, "client.create_tag");
  assert.equal(result.plan.steps[0].args.actionType, "client.create_tag");
});

test("client search read plan maps phone lookup arg to query", () => {
  const result = canonicalize({
    message: "Нужно быстро найти, кто у нас с телефоном +79000000000.",
    plan: {
      goal: {
        type: "clients.search",
        intent: "read",
        confidence: 0.8,
        slots: { phone: "+79000000000" },
        userFacingSummary: "Поиск клиента по номеру телефона +79000000000",
      },
      status: "planned",
      answer: "Ищу клиента.",
      missingSlots: [],
      steps: [{ order: 1, type: "read", toolName: "clients.search", args: { phone: "+79000000000" }, reason: "Find by phone" }],
    },
  });

  assert.equal(result.plan.steps[0].args.query, "+79000000000");
});

function canonicalize({ message, plan }) {
  return canonicalizeCrmAgentPlan({ plan, actions, tools, message });
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

console.log("CRM Agent v2 plan canonicalizer checks passed.");
