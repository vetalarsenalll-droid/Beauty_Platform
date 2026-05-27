import type { Prisma } from "@prisma/client";
import { runWithAiUsageContext } from "@/lib/ai-usage";
import { createGigaChatCompletion } from "@/lib/gigachat";
import type { CrmAgentPlannerMessage } from "./planner";

export type CrmAgentRouteKind = "smalltalk" | "crm_question" | "crm_task" | "task_continuation" | "unsupported";
export type CrmAgentAllowedToolMode = "read" | "draft" | "execute";

export type CrmAgentRouteDecision = {
  kind: CrmAgentRouteKind;
  confidence: number;
  reason: string;
  suggestedGoalType?: string;
  needsAccountContext: boolean;
  allowedToolModes: CrmAgentAllowedToolMode[];
};

export type CrmAgentConversationRouterRequest = {
  accountId: number;
  userId?: number | null;
  sessionId?: number | null;
  message: string;
  nowIso: string;
  timezone: string;
  contextSummary: Prisma.JsonObject;
  state?: Prisma.JsonObject | null;
  history?: CrmAgentPlannerMessage[];
};

export type CrmAgentConversationRouterResult =
  | { ok: true; decision: CrmAgentRouteDecision; raw: string; model: string; fallback: false }
  | { ok: true; decision: CrmAgentRouteDecision; raw: string | null; model: string | null; fallback: true; error: string }
  | { ok: false; error: string; raw: string | null; model: string | null };

const routeKinds = new Set<CrmAgentRouteKind>(["smalltalk", "crm_question", "crm_task", "task_continuation", "unsupported"]);
const toolModes = new Set<CrmAgentAllowedToolMode>(["read", "draft", "execute"]);

export function parseCrmAgentRouteDecision(raw: string): CrmAgentRouteDecision | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const kind = typeof parsed.kind === "string" && routeKinds.has(parsed.kind as CrmAgentRouteKind)
    ? (parsed.kind as CrmAgentRouteKind)
    : null;
  if (!kind) return null;

  const confidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) ? parsed.confidence : 0.5;
  const allowedToolModes = Array.isArray(parsed.allowedToolModes)
    ? parsed.allowedToolModes.filter((mode): mode is CrmAgentAllowedToolMode => typeof mode === "string" && toolModes.has(mode as CrmAgentAllowedToolMode))
    : defaultAllowedToolModes(kind);

  return normalizeRouteDecision({
    kind,
    confidence,
    reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "Router classified the turn.",
    suggestedGoalType: typeof parsed.suggestedGoalType === "string" && parsed.suggestedGoalType.trim() ? parsed.suggestedGoalType.trim() : undefined,
    needsAccountContext: typeof parsed.needsAccountContext === "boolean" ? parsed.needsAccountContext : kind !== "smalltalk",
    allowedToolModes,
  });
}

export async function routeCrmAgentConversationTurn(
  input: CrmAgentConversationRouterRequest,
): Promise<CrmAgentConversationRouterResult> {
  try {
    let completion = await requestRouterCompletion(input);
    let parsedDecision = parseCrmAgentRouteDecision(completion.content);
    if (!parsedDecision) {
      completion = await requestRouterCompletion(input, completion.content);
      parsedDecision = parseCrmAgentRouteDecision(completion.content);
    }
    const decision = parsedDecision ? coerceReadOnlyCrmQuestion(input.message, parsedDecision) : null;
    if (!decision) {
      return {
        ok: true,
        decision: fallbackRouteDecision(input),
        raw: completion.content,
        model: completion.model,
        fallback: true,
        error: "invalid_router_json",
      };
    }
    return { ok: true, decision, raw: completion.content, model: completion.model, fallback: false };
  } catch (error) {
    return {
      ok: true,
      decision: fallbackRouteDecision(input),
      raw: null,
      model: null,
      fallback: true,
      error: error instanceof Error ? error.message : "conversation_router_failed",
    };
  }
}

async function requestRouterCompletion(input: CrmAgentConversationRouterRequest, repairRaw?: string) {
  return runWithAiUsageContext(
    {
      accountId: input.accountId,
      threadId: input.sessionId ?? null,
      actionId: null,
    },
    () =>
      createGigaChatCompletion(
        [
          { role: "system", content: buildRouterPrompt(Boolean(repairRaw)) },
          ...chatHistoryMessages(input.history ?? []),
          {
            role: "user",
            content: JSON.stringify({
              accountId: input.accountId,
              message: input.message,
              nowIso: input.nowIso,
              timezone: input.timezone,
              contextSummary: routerContextSummary(input.contextSummary),
              state: input.state ?? null,
              previousInvalidResponse: repairRaw ?? undefined,
            }),
          },
        ],
        { purpose: "crm_agent_v2_conversation_router", scope: "crm_agent" },
      ),
  );
}

function buildRouterPrompt(repair = false) {
  return [
    "Ты входной router CRM-агента внутри CRM-аккаунта салона.",
    "Ты не отвечаешь пользователю и не строишь план. Верни только строгий JSON без markdown.",
    "Публичное имя ассистента: CRM-агент. Не закладывай в маршрутизацию ответов внутреннее техническое название или версию.",
    "CRM-агент должен быть Codex-like рабочим агентом, а не scripted intent-bot.",
    "Классифицируй следующий шаг по message, history и state. contextSummary - только фон текущего accountId, а не источник темы запроса.",
    "Никогда не выводи тему из contextSummary. Если в message нет запроса про данные аккаунта, не выбирай crm_question только потому, что такие данные есть в contextSummary.",
    "Никогда не используй accountId из текста пользователя как источник правды; accountId уже задан серверным контекстом.",
    "Не классифицируй обычную человеческую реплику как crm_task.",
    "Не отправляй в planner вопрос, если пользователь не просит выполнить CRM-действие.",
    "Если пользователь спрашивает о состоянии CRM/аккаунта без изменения данных, выбери crm_question и только read mode.",
    "Приветствия, реакция на приветствие, вопросы 'ты кто' и обычные фразы без CRM-предмета всегда smalltalk.",
    "Если короткая реплика является продолжением предыдущего CRM-вопроса в history и просит список, детали или уточнение предмета, выбери crm_question, а не unsupported.",
    "Если пользователь явно просит найти/создать/изменить/отменить/подготовить/отправить/опубликовать, выбери crm_task.",
    "Если пользователь коротко продолжает активную задачу, выбирает вариант или правит draft, выбери task_continuation.",
    "Если запрос вне CRM или небезопасен, выбери unsupported.",
    "allowedToolModes: smalltalk=[], crm_question=[read], crm_task=[read,draft], task_continuation=[read,draft], unsupported=[]. execute не разрешай из router.",
    "Форма ответа: JSON object with keys kind, confidence, reason, suggestedGoalType, needsAccountContext, allowedToolModes.",
    "Для smalltalk suggestedGoalType не заполняй, needsAccountContext=false, allowedToolModes=[].",
    repair ? "Repair-pass: предыдущий ответ был невалидным. Верни только один JSON object, без текста до или после." : null,
  ].join("\n");
}

function routerContextSummary(contextSummary: Prisma.JsonObject): Prisma.JsonObject {
  const source = isRecord(contextSummary) ? contextSummary : {};
  return {
    accountScoped: true,
    hasContext: Object.keys(source).length > 0,
    pendingActionsCount: numberField(source.pendingActionsCount),
    latestStateStatus: stringField(source.latestStateStatus),
    latestGoalType: stringField(source.latestGoalType),
  };
}

function normalizeRouteDecision(decision: CrmAgentRouteDecision): CrmAgentRouteDecision {
  const allowedToolModes = decision.allowedToolModes.length ? decision.allowedToolModes : defaultAllowedToolModes(decision.kind);
  return {
    kind: decision.kind,
    confidence: Math.max(0, Math.min(1, decision.confidence)),
    reason: decision.reason,
    suggestedGoalType: decision.suggestedGoalType,
    needsAccountContext: decision.needsAccountContext,
    allowedToolModes: enforceAllowedToolModes(decision.kind, allowedToolModes),
  };
}

function enforceAllowedToolModes(kind: CrmAgentRouteKind, modes: CrmAgentAllowedToolMode[]) {
  const defaults = defaultAllowedToolModes(kind);
  if (kind === "crm_task" || kind === "task_continuation") {
    return modes.filter((mode) => mode === "read" || mode === "draft");
  }
  if (kind === "crm_question") return modes.filter((mode) => mode === "read");
  return defaults;
}

function defaultAllowedToolModes(kind: CrmAgentRouteKind): CrmAgentAllowedToolMode[] {
  if (kind === "crm_question") return ["read"];
  if (kind === "crm_task" || kind === "task_continuation") return ["read", "draft"];
  return [];
}

function fallbackRouteDecision(input: CrmAgentConversationRouterRequest): CrmAgentRouteDecision {
  const readOnlyQuestion = readOnlyCrmQuestionDecision(input.message);
  if (readOnlyQuestion) return readOnlyQuestion;

  const hasActiveState = isRecord(input.state) && typeof input.state.status === "string" && input.state.status !== "completed" && input.state.status !== "failed";
  if (hasActiveState) {
    return {
      kind: "task_continuation",
      confidence: 0.35,
      reason: "LLM router failed; active task state exists, so route as continuation fallback.",
      needsAccountContext: true,
      allowedToolModes: ["read", "draft"],
    };
  }

  return {
    kind: "unsupported",
    confidence: 0.2,
    reason: "LLM router failed; use non-mutating conversation fallback instead of planning an unverified task.",
    needsAccountContext: false,
    allowedToolModes: [],
  };
}

function coerceReadOnlyCrmQuestion(message: string, decision: CrmAgentRouteDecision): CrmAgentRouteDecision {
  const readOnlyQuestion = readOnlyCrmQuestionDecision(message);
  if (!readOnlyQuestion) return decision;
  if (decision.kind === "crm_question") {
    return {
      ...decision,
      suggestedGoalType: decision.suggestedGoalType ?? readOnlyQuestion.suggestedGoalType,
      allowedToolModes: ["read"],
    };
  }
  if (decision.kind === "smalltalk" || decision.kind === "unsupported") return decision;

  return {
    ...readOnlyQuestion,
    confidence: Math.max(readOnlyQuestion.confidence, Math.min(decision.confidence, 0.82)),
    reason: `${decision.reason} Server guard reclassified a read-only CRM data request away from planner.`,
  };
}

function readOnlyCrmQuestionDecision(message: string): CrmAgentRouteDecision | null {
  const normalized = message.trim().toLocaleLowerCase("ru-RU");
  if (!normalized) return null;
  if (!looksLikeReadOnlyCrmDataRequest(normalized) || looksLikeWriteCrmTaskRequest(normalized)) return null;

  return {
    kind: "crm_question",
    confidence: 0.72,
    reason: "Server fallback detected a read-only CRM data request.",
    suggestedGoalType: suggestedReadOnlyGoalType(normalized),
    needsAccountContext: true,
    allowedToolModes: ["read"],
  };
}

function looksLikeReadOnlyCrmDataRequest(text: string) {
  const hasReadIntent = /(покажи|показать|выведи|дай|найди|посмотри|проверь|сколько|какие|кто|кого|список|перечень|статус|сводк|аналитик|отчет|отчёт)/iu.test(text);
  const hasCrmSubject = /(клиент|запис|визит|отзыв|услуг|мастер|специалист|филиал|локац|салон|расписан|загрузк|возврат|ретенш|retention|вернуть|вернулись)/iu.test(text);
  return hasReadIntent && hasCrmSubject;
}

function looksLikeWriteCrmTaskRequest(text: string) {
  return /(запиши|создай|добавь|обнови|измени|исправь|отмени|перенеси|подготовь|отправь|опубликуй|подтверди|удали|назначь|поставь)/iu.test(text);
}

function suggestedReadOnlyGoalType(text: string) {
  if (/(вернуть|вернулись|возврат|ретенш|retention|без визит|не был|не была|не приход)/iu.test(text)) return "analytics.retention";
  if (/(отзыв|оценк|негатив|жалоб)/iu.test(text)) return "reviews.search";
  if (/(запис|сегодня|завтра|календар|расписан|загрузк)/iu.test(text)) return "analytics.workload";
  return undefined;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
