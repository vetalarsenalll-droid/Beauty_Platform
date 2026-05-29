import type { Prisma } from "@prisma/client";
import { runWithAiUsageContext } from "@/lib/ai-usage";
import { createGigaChatCompletion } from "@/lib/gigachat";
import type { CrmAgentRouteDecision } from "./conversation-router";
import {
  buildCrmAgentConversationDraftPrompt,
  buildCrmAgentConversationFinalPrompt,
  buildCrmAgentNaturalConversationPayload,
  buildCrmAgentNaturalConversationPrompt,
  buildCrmAgentConversationPayload,
} from "./conversation-prompts";
import { finishCrmAgentToolCall, startCrmAgentToolCall, writeCrmAgentAudit } from "./persistence";
import type { CrmAgentPlannerMessage } from "./planner";
import { executeCrmAgentReadTool } from "./read-tools";
import { listCrmAgentToolsForPermissions } from "./tools";
import type { CrmAgentCard, CrmAgentToolContext, CrmAgentUiWorkspace } from "./types";

type JsonRecord = Record<string, unknown>;

export type CrmAgentConversationResponse = {
  answer: string;
  workspace?: CrmAgentUiWorkspace;
  cards?: CrmAgentCard[];
  usedTools: Array<{ toolName: string; status: "done" | "failed"; reason?: string; error?: string }>;
  shouldEscalateToPlanner: boolean;
  plannerHint?: string;
  raw: string;
  model: string;
};

export type RunCrmAgentConversationInput = {
  accountId: number;
  userId?: number | null;
  sessionId?: number | null;
  permissions: string[];
  message: string;
  route: CrmAgentRouteDecision;
  nowIso: string;
  timezone: string;
  contextSummary: Prisma.JsonObject;
  state?: Prisma.JsonObject | null;
  history?: CrmAgentPlannerMessage[];
};

type ConversationDraft = {
  answer: string;
  readToolRequests: Array<{ toolName: string; args: JsonRecord; reason?: string }>;
  shouldEscalateToPlanner: boolean;
  plannerHint?: string;
};

type ConversationFinal = {
  answer: string;
  shouldEscalateToPlanner: boolean;
  plannerHint?: string;
};

type ReadToolResult = {
  toolName: string;
  status: "done" | "failed";
  reason?: string;
  result?: unknown;
  error?: string;
};

export async function runCrmAgentConversation(input: RunCrmAgentConversationInput): Promise<CrmAgentConversationResponse> {
  if (input.route.kind !== "crm_question") {
    return runNaturalCrmAgentConversation(input);
  }

  const readTools = listCrmAgentToolsForPermissions(input.permissions).filter((tool) => tool.mode === "read");
  let draftCompletion = await requestConversationDraft(input, readTools);
  let draft = parseConversationDraft(draftCompletion.content);

  if (!draft || shouldRepairEmptyConversationDraft(draft)) {
    const repairedCompletion = await requestConversationDraft(input, readTools, {
      previousAnswer: draft?.answer ?? draftCompletion.content,
      reason: draft ? "empty_conversation_answer" : "invalid_conversation_json",
    });
    const repairedDraft = parseConversationDraft(repairedCompletion.content);
    if (repairedDraft) {
      draftCompletion = repairedCompletion;
      draft = repairedDraft;
    }
  }

  draft ??= {
    answer: "",
    readToolRequests: [],
    shouldEscalateToPlanner: false,
  };

  if (shouldRepairMissingReadTools(input.route, draft)) {
    const repairedCompletion = await requestConversationDraft(input, readTools, {
      previousAnswer: draft.answer,
      reason: "crm_question_without_read_tools",
    });
    const repairedDraft = parseConversationDraft(repairedCompletion.content);
    if (repairedDraft) {
      draftCompletion = repairedCompletion;
      draft = repairedDraft;
    }
  }
  draft = withFallbackReadToolRequest(input.route, draft, readTools.map((tool) => tool.name));

  const readToolResults =
    input.route.kind === "crm_question" && !draft.shouldEscalateToPlanner
      ? await executeRequestedReadTools({
          accountId: input.accountId,
          userId: input.userId ?? null,
          sessionId: input.sessionId ?? null,
          permissions: input.permissions,
          requests: draft.readToolRequests,
          allowedToolNames: readTools.map((tool) => tool.name),
        })
      : [];

  if (!readToolResults.length) {
    return {
      answer: draft.answer || fallbackAnswer(input.route.kind),
      workspace: buildConversationWorkspace(draft.answer || fallbackAnswer(input.route.kind), readToolResults),
      cards: buildConversationCards(readToolResults),
      usedTools: [],
      shouldEscalateToPlanner: draft.shouldEscalateToPlanner,
      plannerHint: draft.plannerHint,
      raw: draftCompletion.content,
      model: draftCompletion.model,
    };
  }

  const finalCompletion = await requestConversationFinal(input, readToolResults);
  const final = parseConversationFinal(finalCompletion.content) ?? {
    answer: draft.answer || fallbackAnswer(input.route.kind),
    shouldEscalateToPlanner: false,
  };

  return {
    answer: final.answer || draft.answer || fallbackAnswer(input.route.kind),
    workspace: buildConversationWorkspace(final.answer || draft.answer || fallbackAnswer(input.route.kind), readToolResults),
    cards: buildConversationCards(readToolResults),
    usedTools: readToolResults.map((result) => ({
      toolName: result.toolName,
      status: result.status,
      reason: result.reason,
      error: result.error,
    })),
    shouldEscalateToPlanner: final.shouldEscalateToPlanner,
    plannerHint: final.plannerHint,
    raw: finalCompletion.content,
    model: finalCompletion.model,
  };
}

async function runNaturalCrmAgentConversation(input: RunCrmAgentConversationInput): Promise<CrmAgentConversationResponse> {
  const completion = await requestNaturalConversation(input);
  const answer = enforceNoMutationSuccessWithoutToolResult(completion.content);
  return {
    answer,
    workspace: buildConversationWorkspace(answer, []),
    cards: [],
    usedTools: [],
    shouldEscalateToPlanner: false,
    raw: completion.content,
    model: completion.model,
  };
}

function enforceNoMutationSuccessWithoutToolResult(answer: string) {
  if (!containsMutationSuccessClaim(answer)) return answer;
  return "Не могу подтвердить выполнение действия: в этом сообщении не было подготовленного действия, preview или результата выполнения. Данные в CRM не изменены.";
}

function containsMutationSuccessClaim(answer: string) {
  const normalized = answer.toLocaleLowerCase("ru-RU");
  const firstPersonCompleted = /\b(записал[аи]?|создал[аи]?|добавил[аи]?|изменил[аи]?|обновил[аи]?|отменил[аи]?|перен[её]с|перенесл[аи]?|удалил[аи]?|опубликовал[аи]?|отправил[аи]?)\b/iu.test(normalized);
  const completionClaim = /\b(вс[её]\s+готово|готово|выполнено|действие\s+выполнено|запись\s+создана)\b/iu.test(normalized);
  const crmMutationSubject = /\b(запис|клиент|услуг|специалист|мастер|расписан|график|отзыв|кампан|уведомлен|плат[её]ж|возврат|документ|webhook|интеграц)\w*/iu.test(normalized);
  return firstPersonCompleted || (completionClaim && crmMutationSubject);
}

async function requestNaturalConversation(input: RunCrmAgentConversationInput) {
  return runWithAiUsageContext(
    {
      accountId: input.accountId,
      threadId: input.sessionId ?? null,
      actionId: null,
    },
    () =>
      createGigaChatCompletion(
        [
          { role: "system", content: buildCrmAgentNaturalConversationPrompt(input.route) },
          ...chatHistoryMessages(input.history ?? []),
          {
            role: "user",
            content: buildCrmAgentNaturalConversationPayload({
              message: input.message,
              route: input.route,
              nowIso: input.nowIso,
              timezone: input.timezone,
              contextSummary: input.contextSummary,
              state: input.state ?? null,
            }),
          },
        ],
        { purpose: "crm_agent_v2_conversation", scope: "crm_agent" },
      ),
  );
}

async function requestConversationDraft(
  input: RunCrmAgentConversationInput,
  readTools: ReturnType<typeof listCrmAgentToolsForPermissions>,
  repair?: { previousAnswer: string; reason: string },
) {
  return runWithAiUsageContext(
    {
      accountId: input.accountId,
      threadId: input.sessionId ?? null,
      actionId: null,
    },
    () =>
      createGigaChatCompletion(
        [
          { role: "system", content: buildCrmAgentConversationDraftPrompt({ route: input.route, readTools, repair }) },
          ...chatHistoryMessages(input.history ?? []),
          {
            role: "user",
            content: buildCrmAgentConversationPayload({
              message: input.message,
              route: input.route,
              nowIso: input.nowIso,
              timezone: input.timezone,
              contextSummary: input.contextSummary,
              state: input.state ?? null,
            }),
          },
        ],
        { purpose: "crm_agent_v2_conversation", scope: "crm_agent" },
      ),
  );
}

async function requestConversationFinal(input: RunCrmAgentConversationInput, readToolResults: ReadToolResult[]) {
  return runWithAiUsageContext(
    {
      accountId: input.accountId,
      threadId: input.sessionId ?? null,
      actionId: null,
    },
    () =>
      createGigaChatCompletion(
        [
          { role: "system", content: buildCrmAgentConversationFinalPrompt() },
          ...chatHistoryMessages(input.history ?? []),
          {
            role: "user",
            content: buildCrmAgentConversationPayload({
              message: input.message,
              route: input.route,
              nowIso: input.nowIso,
              timezone: input.timezone,
              contextSummary: input.contextSummary,
              state: input.state ?? null,
              readToolResults,
            }),
          },
        ],
        { purpose: "crm_agent_v2_conversation_final", scope: "crm_agent" },
      ),
  );
}

async function executeRequestedReadTools(input: {
  accountId: number;
  userId?: number | null;
  sessionId?: number | null;
  permissions: string[];
  requests: ConversationDraft["readToolRequests"];
  allowedToolNames: string[];
}) {
  const results: ReadToolResult[] = [];
  const allowedToolNames = new Set(input.allowedToolNames);
  const ctx: CrmAgentToolContext = {
    accountId: input.accountId,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
    permissions: input.permissions,
  };

  for (const request of input.requests.slice(0, 3)) {
    const args = stripUnsafeToolArgs(request.args);
    if (!allowedToolNames.has(request.toolName)) {
      const error = `Read tool is not available for current permissions: ${request.toolName}`;
      await writeCrmAgentAudit({
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        action: "conversation.read_tool_denied",
        targetType: "tool",
        targetId: request.toolName,
        data: inputJson({ reason: request.reason, error }),
      });
      results.push({ toolName: request.toolName, status: "failed", reason: request.reason, error });
      continue;
    }

    const toolCall = await startCrmAgentToolCall({
      accountId: input.accountId,
      sessionId: input.sessionId ?? null,
      planStepId: null,
      toolName: request.toolName,
      args: inputJson(args),
    });

    try {
      const result = await executeCrmAgentReadTool({
        toolName: request.toolName,
        args,
        ctx,
      });
      await finishCrmAgentToolCall({
        accountId: input.accountId,
        toolCallId: toolCall.id,
        status: "DONE",
        result: inputJson(result),
      });
      await writeCrmAgentAudit({
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        action: "conversation.read_tool",
        targetType: "tool",
        targetId: request.toolName,
        data: inputJson({ reason: request.reason, toolCallId: toolCall.id }),
      });
      results.push({ toolName: request.toolName, status: "done", reason: request.reason, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Read tool failed.";
      await finishCrmAgentToolCall({
        accountId: input.accountId,
        toolCallId: toolCall.id,
        status: "FAILED",
        error: message,
      });
      await writeCrmAgentAudit({
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        action: "conversation.read_tool_failed",
        targetType: "tool",
        targetId: request.toolName,
        data: inputJson({ reason: request.reason, toolCallId: toolCall.id, error: message }),
      });
      results.push({
        toolName: request.toolName,
        status: "failed",
        reason: request.reason,
        error: message,
      });
    }
  }

  return results;
}

function stripUnsafeToolArgs(args: JsonRecord): JsonRecord {
  const cleaned: JsonRecord = {};
  for (const [key, value] of Object.entries(args)) {
    if (/^(accountId|account_id|userId|user_id)$/i.test(key)) continue;
    cleaned[key] = isRecord(value) ? stripUnsafeToolArgs(value) : value;
  }
  return cleaned;
}

function parseConversationDraft(raw: string): ConversationDraft | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const answer = extractStringField(jsonText, "answer");
    if (!answer) return null;
    return {
      answer,
      readToolRequests: [],
      shouldEscalateToPlanner: extractBooleanField(jsonText, "shouldEscalateToPlanner") === true,
      plannerHint: extractStringField(jsonText, "plannerHint") ?? undefined,
    };
  }
  if (!isRecord(parsed)) return null;
  return {
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    readToolRequests: normalizeReadToolRequests(parsed.readToolRequests),
    shouldEscalateToPlanner: parsed.shouldEscalateToPlanner === true,
    plannerHint: typeof parsed.plannerHint === "string" && parsed.plannerHint.trim() ? parsed.plannerHint.trim() : undefined,
  };
}

function parseConversationFinal(raw: string): ConversationFinal | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const answer = extractStringField(jsonText, "answer");
    if (!answer) return null;
    return {
      answer,
      shouldEscalateToPlanner: extractBooleanField(jsonText, "shouldEscalateToPlanner") === true,
      plannerHint: extractStringField(jsonText, "plannerHint") ?? undefined,
    };
  }
  if (!isRecord(parsed)) return null;
  return {
    answer: typeof parsed.answer === "string" ? parsed.answer : "",
    shouldEscalateToPlanner: parsed.shouldEscalateToPlanner === true,
    plannerHint: typeof parsed.plannerHint === "string" && parsed.plannerHint.trim() ? parsed.plannerHint.trim() : undefined,
  };
}

function normalizeReadToolRequests(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ConversationDraft["readToolRequests"] => {
    if (!isRecord(item) || typeof item.toolName !== "string") return [];
    return [
      {
        toolName: item.toolName,
        args: isRecord(item.args) ? item.args : {},
        reason: typeof item.reason === "string" ? item.reason : undefined,
      },
    ];
  });
}

function withFallbackReadToolRequest(
  route: CrmAgentRouteDecision,
  draft: ConversationDraft,
  allowedToolNames: string[],
): ConversationDraft {
  if (route.kind !== "crm_question" || draft.shouldEscalateToPlanner || draft.readToolRequests.length) return draft;
  const fallbackTool = readToolForSuggestedGoal(route.suggestedGoalType);
  if (!fallbackTool || !allowedToolNames.includes(fallbackTool)) return draft;

  return {
    ...draft,
    readToolRequests: [
      {
        toolName: fallbackTool,
        args: { take: 30 },
        reason: "Fallback read-only tool selected from router suggestedGoalType.",
      },
    ],
  };
}

function readToolForSuggestedGoal(goalType: string | undefined) {
  if (goalType === "analytics.retention") return "analytics.retention";
  if (goalType === "analytics.workload") return "analytics.workload";
  if (goalType === "reviews.search") return "reviews.search";
  if (goalType === "site.health") return "site.health";
  return null;
}

function shouldRepairMissingReadTools(route: CrmAgentRouteDecision, draft: ConversationDraft) {
  if (route.kind !== "crm_question" || draft.shouldEscalateToPlanner || draft.readToolRequests.length) return false;
  const answer = draft.answer.trim().toLocaleLowerCase("ru-RU");
  if (!answer) return true;
  return /(посмотр|провер|уточн|сейчас|данные crm|отвечу по текущему аккаунту|look|check|fetch|let me)/i.test(answer);
}

function shouldRepairEmptyConversationDraft(draft: ConversationDraft) {
  return (!draft.answer.trim() || isSchemaPlaceholderAnswer(draft.answer)) && !draft.readToolRequests.length && !draft.shouldEscalateToPlanner;
}

function isSchemaPlaceholderAnswer(answer: string) {
  const normalized = answer.trim().toLocaleLowerCase("ru-RU");
  return (
    normalized === "короткий естественный ответ пользователю или предварительная фраза." ||
    normalized === "сводка по данным crm и следующий полезный шаг." ||
    normalized.includes("placeholder") ||
    normalized.includes("описание схемы")
  );
}

function buildConversationWorkspace(answer: string, readToolResults: ReadToolResult[]): CrmAgentUiWorkspace {
  if (!readToolResults.length) {
    return {
      mode: "conversation",
      title: "Диалог",
      cards: [{ type: "report", title: "Диалог", data: { answer } }],
      commands: [],
    };
  }
  return {
    mode: "report",
    title: "Ответ по данным CRM",
    cards: buildConversationCards(readToolResults),
    tabs: [
      {
        id: "summary",
        title: "Ответ",
        cards: [{ type: "report", title: "Сводка", data: { answer } }],
      },
      {
        id: "read_tools",
        title: "Данные",
        badge: readToolResults.length,
        cards: buildConversationCards(readToolResults),
      },
    ],
    commands: [],
  };
}

function buildConversationCards(readToolResults: ReadToolResult[]): CrmAgentCard[] {
  return readToolResults.map((result) => ({
    type: "report",
    title: result.toolName,
    subtitle: result.status,
    data: {
      reason: result.reason ?? null,
      result: result.result ?? null,
      error: result.error ?? null,
    },
  }));
}

function fallbackAnswer(kind: CrmAgentRouteDecision["kind"]) {
  if (kind === "smalltalk") return "Я на месте. Можем спокойно обсудить CRM или перейти к задаче.";
  if (kind === "crm_question") return "Не удалось надежно разобрать ответ модели. Напишите вопрос по CRM чуть конкретнее.";
  return "Не получил корректный ответ модели. Повторите сообщение чуть иначе.";
}

function extractStringField(jsonLike: string, field: string) {
  const match = jsonLike.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "s"));
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1].replace(/\\"/g, '"').trim();
  }
}

function extractBooleanField(jsonLike: string, field: string) {
  const match = jsonLike.match(new RegExp(`"${field}"\\s*:\\s*(true|false)`, "i"));
  return match ? match[1].toLowerCase() === "true" : null;
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
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
