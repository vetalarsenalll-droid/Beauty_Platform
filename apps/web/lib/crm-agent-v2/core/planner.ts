import type { Prisma } from "@prisma/client";
import { runWithAiUsageContext } from "@/lib/ai-usage";
import { createGigaChatCompletion } from "@/lib/gigachat";
import type { CrmAgentCatalogSummaryAction } from "../actions";
import type { CrmAgentGoal, CrmAgentIntent, CrmAgentPlanStepType } from "./types";
import type { CrmAgentRegisteredToolDefinition } from "./tools";

export type CrmAgentPlannerMessage = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  data?: Prisma.JsonValue;
};

export type CrmAgentPlannerStep = {
  order: number;
  type: CrmAgentPlanStepType;
  toolName?: string | null;
  actionName?: string | null;
  args?: Prisma.JsonObject;
  reason: string;
};

export type CrmAgentPlannerRequest = {
  accountId: number;
  userId?: number | null;
  sessionId?: number | null;
  message: string;
  locale?: "ru";
  nowIso: string;
  timezone: string;
  contextSummary: Prisma.JsonObject;
  state?: Prisma.JsonObject | null;
  history?: CrmAgentPlannerMessage[];
  tools: CrmAgentRegisteredToolDefinition[];
  actions: CrmAgentCatalogSummaryAction[];
};

export type CrmAgentPlannerPlan = {
  goal: CrmAgentGoal;
  status: "planned" | "needs_clarification" | "answer_only" | "unsupported";
  answer: string;
  missingSlots: string[];
  clarificationQuestion?: string;
  steps: CrmAgentPlannerStep[];
};

export type CrmAgentPlannerResult =
  | { ok: true; plan: CrmAgentPlannerPlan; raw: string; model: string }
  | { ok: false; error: string; raw: string | null; model: string | null };

const supportedIntents = new Set<CrmAgentIntent>(["read", "create", "update", "delete", "analyze", "notify", "execute"]);
const supportedStepTypes = new Set<CrmAgentPlanStepType>([
  "read",
  "resolve",
  "draft",
  "execute",
  "inspect",
  "clarify",
  "generate",
  "preview",
]);

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced?.startsWith("{") && fenced.endsWith("}")) return fenced;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizeGoal(value: unknown): CrmAgentGoal | null {
  if (!isJsonObject(value)) return null;
  const intent =
    typeof value.intent === "string" && supportedIntents.has(value.intent as CrmAgentIntent)
      ? (value.intent as CrmAgentIntent)
      : null;
  const type = typeof value.type === "string" && value.type.trim() ? value.type.trim() : null;
  if (!intent || !type) return null;
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence) ? value.confidence : 0.5;
  return {
    type,
    intent,
    confidence: Math.max(0, Math.min(1, confidence)),
    slots: isJsonObject(value.slots) ? value.slots : {},
    userFacingSummary: typeof value.userFacingSummary === "string" ? value.userFacingSummary : "",
  };
}

function normalizeSteps(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): CrmAgentPlannerStep[] => {
    if (!isJsonObject(item)) return [];
    const rawType = typeof item.type === "string" ? item.type : null;
    const normalizedType = rawType === "prepare" || rawType === "actions.prepare" ? "draft" : rawType;
    const type =
      typeof normalizedType === "string" && supportedStepTypes.has(normalizedType as CrmAgentPlanStepType)
        ? (normalizedType as CrmAgentPlanStepType)
        : null;
    if (!type) return [];
    const args = normalizePlannerStepArgs(item.args) ?? {};
    const actionName =
      typeof item.actionName === "string"
        ? item.actionName
        : typeof args.actionName === "string"
          ? args.actionName
          : typeof args.actionType === "string"
            ? args.actionType
            : null;
    return [
      {
        order: typeof item.order === "number" && Number.isFinite(item.order) ? item.order : index + 1,
        type,
        toolName:
          typeof item.toolName === "string" && item.toolName.trim()
            ? item.toolName
            : rawType === "actions.prepare"
              ? "actions.prepare"
              : null,
        actionName,
        args,
        reason: typeof item.reason === "string" ? item.reason : "",
      },
    ];
  });
}

function normalizePlannerStepArgs(value: unknown): Prisma.JsonObject | undefined {
  if (!isJsonObject(value)) return undefined;
  const args = { ...value };
  if (!isJsonObject(args.payload) && isJsonObject(args.args)) {
    args.payload = args.args;
    delete args.args;
  }
  if (typeof args.actionName === "string" && typeof args.actionType !== "string") {
    args.actionType = args.actionName;
  }
  return args;
}

export function parseCrmAgentPlannerPlan(raw: string): CrmAgentPlannerPlan | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = parseJsonObjectWithRepairedKeys(jsonText);
  }
  if (!isJsonObject(parsed)) return null;

  const rawStatus = typeof parsed.status === "string" ? parsed.status : "planned";
  const status =
    rawStatus === "needs_clarification" || rawStatus === "answer_only" || rawStatus === "unsupported"
      ? rawStatus
      : "planned";
  const goal = normalizeGoal(parsed.goal) ?? fallbackGoalForStatus(status);
  if (!goal) return null;

  return {
    goal,
    status,
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    missingSlots: stringArray(parsed.missingSlots),
    clarificationQuestion: typeof parsed.clarificationQuestion === "string" ? parsed.clarificationQuestion : undefined,
    steps: normalizeSteps(parsed.steps),
  };
}

function fallbackGoalForStatus(status: CrmAgentPlannerPlan["status"]): CrmAgentGoal | null {
  if (status !== "answer_only" && status !== "unsupported") return null;
  return {
    type: status === "answer_only" ? "conversation.answer" : "conversation.unsupported",
    intent: "read",
    confidence: 0,
    slots: {},
    userFacingSummary: "",
  };
}

function parseJsonObjectWithRepairedKeys(jsonLike: string): unknown {
  const repaired = trimExtraClosingBraces(jsonLike)
    .replace(/,\s*"steps=\[\]"\s*(?=})/g, ',"steps":[]')
    .replace(/"steps=\[\]"\s*(?=})/g, '"steps":[]')
    .replace(/([,{]\s*)\.([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/([,{]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ':"$1"');
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

function trimExtraClosingBraces(jsonLike: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = 0; index < jsonLike.length; index += 1) {
    const char = jsonLike[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) end = index + 1;
      if (depth < 0) break;
    }
  }
  return end > 0 ? jsonLike.slice(0, end) : jsonLike;
}

function buildPlannerPrompt(input: CrmAgentPlannerRequest, repair = false) {
  const toolLines = input.tools.map((tool) =>
    JSON.stringify({
      name: tool.name,
      mode: tool.mode,
      domain: tool.domain,
      permission: tool.permission ?? null,
      risk: tool.risk,
      description: tool.description,
    }),
  );
  const actionLines = input.actions.map((action) =>
    JSON.stringify({
      name: action.name,
      domain: action.domain,
      kind: action.kind,
      intent: action.intent,
      status: action.status,
      requiredSlots: action.requiredSlots,
      optionalSlots: action.optionalSlots,
      risk: action.risk,
      permission: action.permission,
      confirmation: action.confirmation,
      description: action.description,
      plannerHints: action.plannerHints,
    }),
  );

  return [
    "Ты planner внутреннего CRM-агента для русскоязычного салона или студии услуг.",
    "Публичное имя ассистента: CRM-агент. В пользовательском answer не называй его внутренним техническим названием, версией, кодовым именем или названием LLM-провайдера.",
    "Верни только строгий JSON без markdown.",
    "Не выполняй изменения. Любое изменение должно идти через draft/preview/confirm steps.",
    "Если данных не хватает, верни status=needs_clarification, missingSlots и clarificationQuestion.",
    "Если пользователь просто здоровается, благодарит или задает общий вопрос без CRM-задачи, верни status=answer_only, пустые steps и нормальный дружелюбный ответ. Не копируй пример из инструкции.",
    "Если нужен поиск сущностей или свободных окон, запланируй read/resolve steps через доступные tools.",
    "Если пользователь просит создать, изменить, отменить, отправить или опубликовать, выбери actionName только из action registry и сначала запланируй read/resolve steps для обязательных сущностей.",
    "После read/resolve steps для изменения данных обязательно добавь draft step через toolName=actions.prepare с actionName и args.actionType равными выбранному action registry name. Не останавливайся только на поиске сущности, если пользователь просит изменить данные.",
    "Для изменения описания услуги используй actionName=service.update_description, а не общий service.update. После services.search добавь draft actions.prepare с payload description и serviceId из найденной услуги.",
    "Учитывай status action: implemented/draft_only можно планировать для draft/preview; read_only используй только для чтения; planned/blocked/unsupported не планируй как draft/preview/execute.",
    "Если пользователь просит действие, которое есть только со status planned/blocked/unsupported, верни status=unsupported и коротко объясни, что действие описано в каталоге, но еще не подключено к выполнению.",
    "Не планируй draft/preview для action, пока requiredSlots этой action не заполнены в args или не будут получены предыдущими resolve/read шагами. Если обязательные данные нельзя получить из сообщения и состояния, верни needs_clarification.",
    "Опасные действия с risk high/critical требуют preview и execute только после пользовательского подтверждения.",
    "Форма ответа:",
    JSON.stringify({
      goal: {
        type: "appointment.create",
        intent: "create",
        confidence: 0.8,
        slots: { client: { query: "Анна" } },
        userFacingSummary: "Записать Анну на маникюр",
      },
      status: "planned",
      answer: "Проверю клиентов, услугу и свободные окна, затем покажу варианты для выбора.",
      missingSlots: [],
      clarificationQuestion: "",
      steps: [
        { order: 1, type: "read", toolName: "clients.search", args: { query: "Анна" }, reason: "Найти клиента" },
        { order: 2, type: "read", toolName: "services.search", args: { query: "маникюр" }, reason: "Найти услугу" },
      ],
    }),
    "Доступные tools:",
    ...toolLines,
    "Доступные actions:",
    ...actionLines,
    repair ? "Repair-pass: предыдущий ответ был невалидным или неполным. Верни только один JSON object по указанной форме, без обычного текста, markdown и пояснений вокруг. Если goal.intent=create/update/delete/notify/execute и status=planned, steps обязаны включать draft step actions.prepare для выбранного actionName." : null,
  ].join("\n");
}

export async function requestCrmAgentPlannerPlan(input: CrmAgentPlannerRequest): Promise<CrmAgentPlannerResult> {
  try {
    let completion = await requestPlannerCompletion(input);
    let plan = parseCrmAgentPlannerPlan(completion.content);
    if (!plan || shouldRepairPlannedMutationWithoutDraft(plan)) {
      completion = await requestPlannerCompletion(input, completion.content);
      plan = parseCrmAgentPlannerPlan(completion.content);
    }
    if (!plan) {
      return { ok: false, error: "invalid_planner_json", raw: completion.content, model: completion.model };
    }
    plan = normalizePlannerPlanForRuntime(plan, input.actions, input.message);
    return { ok: true, plan, raw: completion.content, model: completion.model };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "planner_request_failed",
      raw: null,
      model: null,
    };
  }
}

function shouldRepairPlannedMutationWithoutDraft(plan: CrmAgentPlannerPlan) {
  if (plan.status !== "planned") return false;
  if (!["create", "update", "delete", "notify", "execute"].includes(plan.goal.intent)) return false;
  return !plan.steps.some((step) => step.type === "draft" || step.toolName === "actions.prepare" || step.toolName === "actions.preview");
}

export function normalizePlannerPlanForRuntime(
  plan: CrmAgentPlannerPlan,
  actions: CrmAgentCatalogSummaryAction[],
  message: string,
): CrmAgentPlannerPlan {
  if (!["create", "update", "delete", "notify", "execute"].includes(plan.goal.intent)) return plan;

  const action = actions.find((item) => item.name === plan.goal.type);
  if (!action || action.status === "read_only" || action.status === "planned" || action.status === "blocked" || action.status === "unsupported") {
    return plan;
  }
  if (plan.status !== "planned" && !canPromoteClarificationToResolvablePlan(plan, action)) return plan;

  const readSteps = ensureResolvableReadSteps(plan.steps, plan.goal, action);
  const steps: CrmAgentPlannerStep[] = readSteps.map((step) => {
    if (step.type !== "draft" && step.toolName !== "actions.prepare" && step.toolName !== "actions.preview") return step;
    const actionName = step.actionName ?? action.name;
    const payload = {
      ...payloadFromGoalSlots(plan.goal.slots, action.requiredSlots, readSteps, plan.goal.userFacingSummary),
      ...(isJsonObject(step.args?.payload) ? step.args.payload : {}),
    };
    normalizeActionPayloadFromMessage(payload, action, message);
    fillMissingIdPlaceholders(payload, action.requiredSlots, readSteps);
    return {
      ...step,
      type: step.type === "preview" ? "preview" : "draft",
      toolName: step.toolName ?? "actions.prepare",
      actionName,
      args: {
        ...(step.args ?? {}),
        actionType: actionName,
        payload,
      },
    };
  });

  if (!steps.some((step) => step.type === "draft" || step.toolName === "actions.prepare")) {
    steps.push({
      order: steps.length + 1,
      type: "draft",
      toolName: "actions.prepare",
      actionName: action.name,
      args: {
        actionType: action.name,
        summary: plan.goal.userFacingSummary || action.name,
        payload: normalizedActionPayloadFromMessage(
          payloadFromGoalSlots(plan.goal.slots, action.requiredSlots, readSteps, plan.goal.userFacingSummary),
          action,
          message,
        ),
      },
      reason: "Prepare action draft after required entities are resolved.",
    });
  }

  return { ...plan, status: "planned", missingSlots: [], clarificationQuestion: "", steps: steps.map((step, index) => ({ ...step, order: index + 1 })) };
}

function normalizedActionPayloadFromMessage(
  payload: Prisma.JsonObject,
  action: CrmAgentCatalogSummaryAction,
  message: string,
) {
  normalizeActionPayloadFromMessage(payload, action, message);
  return payload;
}

function normalizeActionPayloadFromMessage(
  payload: Prisma.JsonObject,
  action: CrmAgentCatalogSummaryAction,
  message: string,
) {
  if (action.name === "service.update_description") {
    const exactDescription = message.match(/(?:^|\s)на:\s*(.+?)\s*$/iu)?.[1]?.trim();
    if (exactDescription) payload.description = exactDescription;
  }
  if (action.name === "service.update_price") {
    if (payload.basePrice == null && payload.priceTotal != null) payload.basePrice = payload.priceTotal;
    const exactPrice = message.match(/(?:^|\s)на\s+(\d+(?:[.,]\d+)?)\s*(?:руб|р\b|₽|$)/iu)?.[1]?.replace(",", ".");
    if (exactPrice) payload.basePrice = exactPrice;
  }
}

function payloadFromGoalSlots(
  slots: Record<string, unknown>,
  requiredSlots: string[],
  steps: CrmAgentPlannerStep[] = [],
  summary = "",
) {
  const payload: Prisma.JsonObject = {};
  for (const slot of requiredSlots) {
    if (slot.endsWith("Id")) {
      const entity = slot.slice(0, -2);
      const selected = selectedIdSlotValue(slots[slot]);
      if (selected != null && selected !== "") {
        payload[slot] = selected;
        continue;
      }
      const entityValue = slotValue(slots[entity]) ?? slotValue(slots[slot]) ?? inferredEntityQueryFromSummary(entity, summary);
      if (entityValue != null && entityValue !== "") payload[slot] = placeholderForEntityId(entity);
      if (payload[slot] === undefined && hasReadStepForEntity(steps, entity)) payload[slot] = placeholderForEntityId(entity);
      continue;
    }

    const direct = slotValue(slots[slot]);
    if (direct != null && direct !== "") {
      payload[slot] = slot === "startAt" ? normalizePlannerDateValue(direct) ?? direct : direct;
      continue;
    }

    if (slot === "startAt") {
      const startAt = slotValue(slots.startAt) ?? slotValue(slots.time);
      payload.startAt = startAt ? normalizePlannerDateValue(startAt) ?? startAt : "#START_AT#";
    }
  }
  return payload;
}

function canPromoteClarificationToResolvablePlan(plan: CrmAgentPlannerPlan, action: CrmAgentCatalogSummaryAction) {
  if (plan.status !== "needs_clarification") return true;
  return action.requiredSlots.every((slot) => {
    const direct = slotValue(plan.goal.slots[slot]);
    if (direct != null && direct !== "") return true;
    if (!slot.endsWith("Id")) return false;
    const entity = slot.slice(0, -2);
    return Boolean(slotValue(plan.goal.slots[entity]) ?? inferredEntityQueryFromSummary(entity, plan.goal.userFacingSummary));
  });
}

function ensureResolvableReadSteps(
  steps: CrmAgentPlannerStep[],
  goal: CrmAgentGoal,
  action: CrmAgentCatalogSummaryAction,
) {
  const next = [...steps];
  for (const slot of action.requiredSlots) {
    if (!slot.endsWith("Id")) continue;
    const entity = slot.slice(0, -2);
    if (hasReadStepForEntity(next, entity)) continue;
    const query = slotValue(goal.slots[entity]) ?? slotValue(goal.slots[slot]) ?? inferredEntityQueryFromSummary(entity, goal.userFacingSummary);
    const toolName = readToolForEntity(entity);
    if (typeof query === "string" && query.trim() && toolName) {
      next.push({
        order: next.length + 1,
        type: "read",
        toolName,
        args: { query: query.trim() },
        reason: `Resolve ${entity} before preparing ${action.name}.`,
      });
    }
  }
  return next;
}

function readToolForEntity(entity: string) {
  const tools: Record<string, string> = {
    client: "clients.search",
    service: "services.search",
    specialist: "specialists.search",
    location: "locations.search",
    appointment: "appointments.search",
  };
  return tools[entity] ?? null;
}

function fillMissingIdPlaceholders(payload: Prisma.JsonObject, requiredSlots: string[], steps: CrmAgentPlannerStep[]) {
  for (const slot of requiredSlots) {
    if (!slot.endsWith("Id") || (payload[slot] != null && payload[slot] !== "")) continue;
    const entity = slot.slice(0, -2);
    if (hasReadStepForEntity(steps, entity)) payload[slot] = placeholderForEntityId(entity);
  }
}

function hasReadStepForEntity(steps: CrmAgentPlannerStep[], entity: string) {
  const toolPrefixByEntity: Record<string, string> = {
    client: "clients.",
    service: "services.",
    specialist: "specialists.",
    location: "locations.",
    appointment: "appointments.",
  };
  const prefix = toolPrefixByEntity[entity];
  return Boolean(prefix && steps.some((step) => step.type === "read" && step.toolName?.startsWith(prefix)));
}

function inferredEntityQueryFromSummary(entity: string, summary: string) {
  if (entity !== "service") return null;
  const match = summary.match(/услуг[аи]?\s+(.+?)(?:\s+на\s+|\s+с\s+|$)/iu);
  return match?.[1]?.trim() || null;
}

function slotValue(value: unknown): unknown {
  if (isJsonObject(value)) return value.value ?? value.query ?? value.selectedId ?? null;
  return value ?? null;
}

function selectedIdSlotValue(value: unknown): unknown {
  if (!isJsonObject(value)) return value ?? null;
  return value.selectedId ?? value.value ?? null;
}

function placeholderForEntityId(entity: string) {
  return `#${entity.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()}_ID#`;
}

function normalizePlannerDateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  const match = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  const ruMatch = raw.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})(?:\s+(?:в\s*)?(\d{1,2}):(\d{2}))?$/iu);
  if (!match && !ruMatch) return null;
  const [, day, month, year, hour = "0", minute = "0"] = match ?? ruMatch ?? [];
  const monthIndex = match ? Number(month) - 1 : ruMonthIndex(month);
  if (monthIndex == null) return null;
  const date = new Date(Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function ruMonthIndex(value: string) {
  const months: Record<string, number> = {
    января: 0,
    январь: 0,
    февраля: 1,
    февраль: 1,
    марта: 2,
    март: 2,
    апреля: 3,
    апрель: 3,
    мая: 4,
    май: 4,
    июня: 5,
    июнь: 5,
    июля: 6,
    июль: 6,
    августа: 7,
    август: 7,
    сентября: 8,
    сентябрь: 8,
    октября: 9,
    октябрь: 9,
    ноября: 10,
    ноябрь: 10,
    декабря: 11,
    декабрь: 11,
  };
  return months[value.toLowerCase()] ?? null;
}

async function requestPlannerCompletion(input: CrmAgentPlannerRequest, repairRaw?: string) {
  return runWithAiUsageContext(
    {
      accountId: input.accountId,
      threadId: input.sessionId ?? null,
      actionId: null,
    },
    () =>
      createGigaChatCompletion(
        [
          { role: "system", content: buildPlannerPrompt(input, Boolean(repairRaw)) },
          ...chatHistoryMessages(input.history ?? []),
          {
            role: "user",
            content: JSON.stringify({
              message: input.message,
              nowIso: input.nowIso,
              timezone: input.timezone,
              contextSummary: input.contextSummary,
              state: input.state ?? null,
              previousInvalidResponse: repairRaw ?? undefined,
            }),
          },
        ],
        { purpose: "crm_agent_v2_planner", scope: "crm_agent" },
      ),
  );
}

function chatHistoryMessages(history: CrmAgentPlannerMessage[]) {
  return history
    .filter((message): message is CrmAgentPlannerMessage & { role: "user" | "assistant" } => {
      return (message.role === "user" || message.role === "assistant") && message.content.trim().length > 0;
    })
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}
