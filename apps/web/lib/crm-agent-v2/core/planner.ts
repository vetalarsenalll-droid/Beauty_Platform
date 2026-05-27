import type { Prisma } from "@prisma/client";
import { runWithAiUsageContext } from "@/lib/ai-usage";
import { createGigaChatCompletion } from "@/lib/gigachat";
import type { CrmAgentGoal, CrmAgentIntent, CrmAgentPlanStepType } from "./types";
import type { CrmAgentRegisteredActionDefinition } from "./actions";
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
  actions: CrmAgentRegisteredActionDefinition[];
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
    const type =
      typeof item.type === "string" && supportedStepTypes.has(item.type as CrmAgentPlanStepType)
        ? (item.type as CrmAgentPlanStepType)
        : null;
    if (!type) return [];
    return [
      {
        order: typeof item.order === "number" && Number.isFinite(item.order) ? item.order : index + 1,
        type,
        toolName: typeof item.toolName === "string" ? item.toolName : null,
        actionName: typeof item.actionName === "string" ? item.actionName : null,
        args: isJsonObject(item.args) ? item.args : undefined,
        reason: typeof item.reason === "string" ? item.reason : "",
      },
    ];
  });
}

export function parseCrmAgentPlannerPlan(raw: string): CrmAgentPlannerPlan | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!isJsonObject(parsed)) return null;

  const goal = normalizeGoal(parsed.goal);
  if (!goal) return null;

  const rawStatus = typeof parsed.status === "string" ? parsed.status : "planned";
  const status =
    rawStatus === "needs_clarification" || rawStatus === "answer_only" || rawStatus === "unsupported"
      ? rawStatus
      : "planned";

  return {
    goal,
    status,
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    missingSlots: stringArray(parsed.missingSlots),
    clarificationQuestion: typeof parsed.clarificationQuestion === "string" ? parsed.clarificationQuestion : undefined,
    steps: normalizeSteps(parsed.steps),
  };
}

function buildPlannerPrompt(input: CrmAgentPlannerRequest) {
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
      intent: action.intent,
      requiredSlots: action.requiredSlots,
      optionalSlots: action.optionalSlots,
      risk: action.risk,
      permission: action.permission,
      confirmation: action.confirmation,
      description: action.description,
    }),
  );

  return [
    "Ты planner внутреннего CRM Agent v2 для русскоязычного салона или студии услуг.",
    "Верни только строгий JSON без markdown.",
    "Не выполняй изменения. Любое изменение должно идти через draft/preview/confirm steps.",
    "Если данных не хватает, верни status=needs_clarification, missingSlots и clarificationQuestion.",
    "Если пользователь просто здоровается, благодарит или задает общий вопрос без CRM-задачи, верни status=answer_only, пустые steps и нормальный дружелюбный ответ. Не копируй пример из инструкции.",
    "Если нужен поиск сущностей или свободных окон, запланируй read/resolve steps через доступные tools.",
    "Если пользователь просит создать, изменить, отменить, отправить или опубликовать, выбери actionName из action registry и сначала запланируй read/resolve steps для обязательных сущностей.",
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
  ].join("\n");
}

export async function requestCrmAgentPlannerPlan(input: CrmAgentPlannerRequest): Promise<CrmAgentPlannerResult> {
  try {
    const completion = await runWithAiUsageContext(
      {
        accountId: input.accountId,
        threadId: input.sessionId ?? null,
        actionId: null,
      },
      () =>
        createGigaChatCompletion(
          [
            { role: "system", content: buildPlannerPrompt(input) },
            {
              role: "user",
              content: JSON.stringify({
                message: input.message,
                nowIso: input.nowIso,
                timezone: input.timezone,
                contextSummary: input.contextSummary,
                state: input.state ?? null,
                history: input.history ?? [],
              }),
            },
          ],
          { purpose: "crm_agent_v2_planner", scope: "crm_agent" },
        ),
    );

    const plan = parseCrmAgentPlannerPlan(completion.content);
    if (!plan) {
      return { ok: false, error: "invalid_planner_json", raw: completion.content, model: completion.model };
    }
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
