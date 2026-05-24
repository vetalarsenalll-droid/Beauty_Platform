import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canExecuteCrmAgentAction, executeConfirmedCrmAgentAction } from "@/lib/crm-agent-action-executor";
import { canAutopilotExecuteCrmAgentAction } from "@/lib/crm-agent-autopilot";
import { buildCrmAgentAccountContext } from "@/lib/crm-agent-context";
import { executeCrmAgentReadTool } from "@/lib/crm-agent-domain-tools";
import { generateCrmAgentInsights } from "@/lib/crm-agent-insights";
import {
  requestCrmAgentLlmCommand,
  type CrmAgentLlmCommand,
  type CrmAgentLlmHistoryMessage,
  type CrmAgentLlmObservation,
} from "@/lib/crm-agent-llm-contract";
import {
  appendCrmAgentMessage,
  confirmPendingAction,
  createAgentToolCall,
  createPendingAction,
  finishAgentRun,
  finishAgentToolCall,
  getPendingActionForAccount,
  getCrmAgentThreadState,
  listCrmAgentMessages,
  listPendingActions,
  rejectPendingAction,
  updateCrmAgentThreadState,
  writeAgentAudit,
} from "@/lib/crm-agent-persistence";
import { buildCrmAgentGroundedAnswer, buildCrmAgentStructuredResponse, type CrmAgentCard } from "@/lib/crm-agent-structured-response";
import { resolveThreadContinuation, type CrmAgentContinuationResolution } from "@/lib/crm-agent-thread-continuation";
import { getCrmAgentTool, listCrmAgentToolsForPermissions } from "@/lib/crm-agent-tool-registry";
import type { CrmAgentRiskLevel, CrmAgentScope, CrmAgentToolDefinition } from "@/lib/crm-agent-types";

type RunCrmAgentChatInput = {
  accountId: number;
  userId: number;
  permissions: string[];
  runId: number;
  threadId: number;
  message: string;
  requestedToolName?: string | null;
  requestedToolArgs?: Prisma.JsonObject | null;
  actionIntent?: string | null;
  actionEntity?: { type: string | null; id: number | string | null } | null;
};

type ToolExecution = {
  selectedToolName: string | null;
  toolResult: Prisma.JsonValue | null;
  answer: string;
  observations?: CrmAgentLlmObservation[];
  autopilot?: Prisma.JsonValue | null;
};

type ContinuationExecution = {
  execution: ToolExecution;
  selectedEntity?: { type: "client" | "specialist" | "service" | "location" | "appointment" | "review" | "promo" | "slot"; id: number | string } | null;
  pendingClarification?: Prisma.JsonValue | null;
};

const MAX_LLM_TOOL_STEPS = 5;
const DEFAULT_APPOINTMENT_LOOKAHEAD_DAYS = 14;

function toJsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function toJsonObject(value: unknown): Prisma.JsonObject {
  const json = toJsonValue(value);
  return typeof json === "object" && json !== null && !Array.isArray(json) ? json : {};
}

function compactJsonValue(value: unknown, maxLength = 5000): Prisma.JsonValue {
  const json = toJsonValue(value);
  const text = JSON.stringify(json);
  if (text.length <= maxLength) return json;
  return {
    truncated: true,
    originalLength: text.length,
    preview: text.slice(0, maxLength),
  };
}

function commandKey(command: CrmAgentLlmCommand) {
  if (command.command === "read") return `${command.toolName}:${JSON.stringify(command.args)}`;
  if (command.command === "analyze") return `analyze:${command.analysisType}:${JSON.stringify(command.args)}`;
  return `${command.command}:${JSON.stringify("args" in command ? command.args : {})}`;
}

function compactHistoryContent(content: string, maxLength = 3000) {
  const text = String(content || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

async function loadConversationHistory(input: {
  accountId: number;
  threadId: number;
  currentMessage: string;
}): Promise<CrmAgentLlmHistoryMessage[]> {
  const messages = await listCrmAgentMessages({
    accountId: input.accountId,
    threadId: input.threadId,
    take: 40,
  });

  return messages
    .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "tool")
    .map((message) => ({
      role: message.role,
      content: compactHistoryContent(message.content),
      createdAt: message.createdAt.toISOString(),
    }))
    .concat([{ role: "user_current", content: input.currentMessage, createdAt: new Date().toISOString() }]);
}

function hasPermission(permissions: string[], permission?: string | null) {
  return !permission || permissions.includes("crm.all") || permissions.includes(permission);
}

function pendingActionIdFromResult(result: Prisma.JsonValue | null) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const value = result.pendingActionId;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numericEntityId(value: number | string | null | undefined) {
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;
  return Number.isInteger(id) && id != null && id > 0 ? id : null;
}

function riskLevel(value: unknown): CrmAgentRiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function stringField(args: Prisma.JsonObject, key: string) {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addLocalDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isoDateOnly(date: Date) {
  return startOfLocalDay(date).toISOString();
}

function endOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function normalizeCrmText(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[#№]/g, " ")
    .replace(/[^\p{L}\p{N}:.\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function crmTokenStem(token: string) {
  return token
    .replace(/(ого|ему|ыми|ими|ами|ями|ую|юю|ая|яя|ое|ее|ий|ый|ой|ых|их|ам|ям|ом|ем|ах|ях|у|ю|а|я|е|ы|и)$/u, "")
    .trim();
}

function crmSearchTokens(message: string) {
  return normalizeCrmText(message)
    .split(/\s+/)
    .map(crmTokenStem)
    .filter((token) => token.length >= 3 && !["запиш", "перенес", "напиш", "отправ", "клиент", "услуг", "мастер", "сотрудник", "завтр", "сегодн", "перв", "свободн", "окн"].includes(token))
    .slice(0, 12);
}

function scoreLabels(message: string, labels: Array<string | null | undefined>) {
  const tokens = crmSearchTokens(message);
  if (!tokens.length) return 0;
  const haystack = normalizeCrmText(labels.filter(Boolean).join(" "));
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += token.length;
  }
  return score;
}

function parseSingleTime(message: string) {
  const text = normalizeCrmText(message);
  const matches = Array.from(text.matchAll(/\b(?:в\s*)?(\d{1,2})(?::(\d{2}))?\b/gu));
  const match = matches.find((item) => {
    const value = Number(item[1]);
    return value >= 0 && value <= 23;
  });
  if (!match) return null;
  const hour = Math.min(Math.max(Number(match[1]), 0), 23);
  const minute = match[2] ? Math.min(Math.max(Number(match[2]), 0), 59) : 0;
  return { hour, minute, label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

function applyTimeToDate(date: Date, time: { hour: number; minute: number }) {
  const result = new Date(date);
  result.setHours(time.hour, time.minute, 0, 0);
  return result;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStoredCards(value: unknown): CrmAgentCard[] {
  if (!isRecordValue(value) || !Array.isArray(value.latestCards)) return [];
  return value.latestCards.filter((card): card is CrmAgentCard =>
    isRecordValue(card) &&
    typeof card.type === "string" &&
    (typeof card.id === "number" || typeof card.id === "string") &&
    typeof card.title === "string",
  );
}

function selectedCardFromState(value: unknown) {
  if (!isRecordValue(value) || !isRecordValue(value.selectedEntity)) return null;
  const selected = value.selectedEntity;
  const cards = parseStoredCards(value);
  return cards.find((card) => card.type === selected.type && String(card.id) === String(selected.id)) ?? null;
}

function numericCardId(card: CrmAgentCard | null | undefined) {
  return numericEntityId(card?.id);
}

function slotDraftData(card: CrmAgentCard | null | undefined) {
  if (!card || card.type !== "slot" || !isRecordValue(card.data)) return null;
  const startAt = typeof card.data.startAt === "string" ? card.data.startAt : null;
  if (!startAt) return null;
  return {
    startAt,
    endAt: typeof card.data.endAt === "string" ? card.data.endAt : null,
    specialistId: numericEntityId(card.data.specialistId as number | string | null),
    locationId: numericEntityId(card.data.locationId as number | string | null),
    serviceId: numericEntityId(card.data.serviceId as number | string | null),
  };
}

function parseRelativeScheduleDate(message: string) {
  const text = message.toLocaleLowerCase("ru-RU");
  const today = startOfLocalDay(new Date());
  if (/(послезавтра|через\s+2\s+дн)/i.test(text)) return addLocalDays(today, 2);
  if (/(завтра|следующ(?:ий|ую)\s+день)/i.test(text)) return addLocalDays(today, 1);
  if (/(сегодня)/i.test(text)) return today;
  const numeric = text.match(/\b(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const currentYear = today.getFullYear();
    const rawYear = numeric[3] ? Number(numeric[3]) : currentYear;
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return startOfLocalDay(date);
  }
  return null;
}

function parseWorkTimeRange(message: string) {
  const match = message.match(/(?:с\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:до|-|—)\s*(\d{1,2})(?::(\d{2}))?/i);
  if (!match) return { startTime: "10:00", endTime: "19:00", defaulted: true };
  const startHour = Math.min(Math.max(Number(match[1]), 0), 23);
  const startMinute = match[2] ? Math.min(Math.max(Number(match[2]), 0), 59) : 0;
  const endHour = Math.min(Math.max(Number(match[3]), 0), 23);
  const endMinute = match[4] ? Math.min(Math.max(Number(match[4]), 0), 59) : 0;
  return {
    startTime: `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`,
    endTime: `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`,
    defaulted: false,
  };
}

function parseAppointmentLookupRange(message: string) {
  const text = normalizeCrmText(message);
  const today = startOfLocalDay(new Date());
  if (/\b(сегодня|сегодняшн)\b/u.test(text) && /\b(завтра|завтрашн)\b/u.test(text)) {
    return { dateFrom: today, dateTo: addLocalDays(today, 1), label: "за сегодня и завтра" };
  }
  if (/\b(сегодня|сегодняшн)\b/u.test(text)) {
    return { dateFrom: today, dateTo: today, label: "за сегодня" };
  }
  if (/\b(вчера|вчерашн)\b/u.test(text)) {
    const yesterday = addLocalDays(today, -1);
    return { dateFrom: yesterday, dateTo: yesterday, label: "за вчера" };
  }
  if (/\b(завтра|завтрашн)\b/u.test(text)) {
    const tomorrow = addLocalDays(today, 1);
    return { dateFrom: tomorrow, dateTo: tomorrow, label: "на завтра" };
  }
  if (/\b(прошл|последн)\w*\s+недел|\bнедел[юеи]\b/u.test(text)) {
    return { dateFrom: addLocalDays(today, -7), dateTo: today, label: "за последнюю неделю" };
  }
  const numeric = text.match(/\b(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?\b/u);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const rawYear = numeric[3] ? Number(numeric[3]) : today.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = startOfLocalDay(new Date(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) return { dateFrom: date, dateTo: date, label: `за ${date.toLocaleDateString("ru-RU")}` };
  }
  if (/\b(сколько|какие|какое|что за|покажи|были|было|посещени|визит|запис)\b/u.test(text)) {
    return { dateFrom: today, dateTo: addLocalDays(today, 1), label: "за сегодня и завтра" };
  }
  return null;
}

function isAppointmentLookupMessage(message: string) {
  const text = normalizeCrmText(message);
  if (/\b(запиши|создай|перенеси|отмени|сними|удали)\b/u.test(text)) return false;
  return /\b(запис|визит|посещени|прием|приём)\b/u.test(text) && /\b(сколько|какие|какое|что за|покажи|найди|были|было|прошл|последн|сегодня|завтра|вчера|недел)\b/u.test(text);
}

function appointmentCardDetails(cards: CrmAgentCard[]) {
  return cards
    .filter((card) => card.type === "appointment")
    .slice(0, 8)
    .map((card, index) => {
      const data = isRecordValue(card.data) ? card.data : {};
      const start = typeof data.startAt === "string" ? new Date(data.startAt) : null;
      const startText = start && !Number.isNaN(start.getTime())
        ? start.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : null;
      return `${index + 1}. ${[card.title, startText, card.subtitle, ...(card.meta ?? [])].filter(Boolean).join(" - ")}`;
    });
}

function inferReadToolName(message: string) {
  const text = message.toLocaleLowerCase("ru-RU");
  if (/(свободн|окн|слот|окошк|какое время|какие дни)/i.test(text)) return "appointments.findAvailableSlots";
  if (/(отзыв|жалоб|оценк|рейтинг)/i.test(text)) return "reviews.search";
  if (/(клиент|телефон|почт|контакт)/i.test(text)) return "clients.search";
  if (/(запис|визит|брон|приём|прием)/i.test(text)) return "appointments.search";
  if (/(услуг|прайс|цен)/i.test(text)) return "services.search";
  if (/(мастер|специалист|сотрудник)/i.test(text)) return "specialists.search";
  if (/(филиал|локац|адрес)/i.test(text)) return "locations.search";
  if (/(акци|промо|скидк)/i.test(text)) return "promos.search";
  if (/(удерж|вернуть|давно не был|реактивац)/i.test(text)) return "analytics.retention";
  if (/(загруз|выруч|аналит|слаб.*дн|неявк|отмен)/i.test(text)) return "analytics.workload";
  if (/(сайт|поиск|описан|карточк)/i.test(text)) return "site.health";
  return null;
}

function extractSpecialistAvailabilityQuery(message: string) {
  const text = message.trim();
  if (!/(свободн|окн|слот|время|дни|расписан)/i.test(text)) return null;
  const normalized = text
    .replace(/[?!.]+/g, " ")
    .replace(/\b(какие|какое|когда|есть|свободные|свободна|свободен|свободно|свободны|дни|день|время|окна|окно|слоты|слот|расписание|напиши|покажи|у)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  if (normalized.length < 3 || normalized.length > 80) return null;
  return normalized;
}

function extractScheduleWorkdayQuery(message: string) {
  const text = message.trim();
  if (!/(рабоч(?:ий|ую|его)?\s+д(?:е|ё)нь|график|смен[ау]|поставь|добавь|назначь)/iu.test(text)) return null;
  if (!/(рабоч|график|смен)/iu.test(text)) return null;
  const normalized = text
    .replace(/[?!.]+/g, " ")
    .replace(/\b(поставь|добавь|назначь|сделай|открой|рабочий|рабочую|рабочего|день|смену|смена|график|на|сегодня|завтра|послезавтра|с|до|в|часов|часа|час)\b/giu, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\b/g, " ")
    .replace(/\b\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.length < 3 || normalized.length > 80) return null;
  return normalized;
}

function daySlotsSummary(slots: Array<{ startAt?: string; endAt?: string; locationName?: string | null }>) {
  const byDay = new Map<string, string[]>();
  for (const slot of slots.slice(0, 40)) {
    if (!slot.startAt || !slot.endAt) continue;
    const start = new Date(slot.startAt);
    const end = new Date(slot.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const day = start.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", weekday: "short" });
    const time = `${start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}-${end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}${slot.locationName ? `, ${slot.locationName}` : ""}`;
    const current = byDay.get(day) ?? [];
    if (current.length < 6) current.push(time);
    byDay.set(day, current);
  }
  return Array.from(byDay.entries())
    .slice(0, 8)
    .map(([day, times]) => `${day}: ${times.join("; ")}`)
    .join("\n");
}

function fallbackAnswer(message: string, selectedToolName: string | null, toolResult: Prisma.JsonValue | null) {
  if (selectedToolName && toolResult) {
    return "Проверил данные. Ниже вернул результат инструмента; изменения без подтверждения не выполнялись.";
  }
  if (/созда|измени|удали|отправ|ответь|опубликуй|перенеси|отмени/i.test(message)) {
    return "Для такого действия нужно подготовить черновик и подтвердить его перед выполнением. Уточните объект и желаемое изменение.";
  }
  return "Готов проверить данные, подготовить черновик действия или собрать рекомендации. Напишите, какой участок разобрать.";
}

async function createActionFromArgs(input: {
  args: Prisma.JsonObject;
  accountId: number;
  userId: number;
  threadId: number;
  permissions: string[];
}) {
  const actionType = stringField(input.args, "actionType");
  const summary = stringField(input.args, "summary");
  if (!actionType || !summary) throw new Error("Для подготовки действия нужны тип действия и краткое описание.");

  const permission = stringField(input.args, "permission") || null;
  if (!hasPermission(input.permissions, permission)) {
    throw new Error(`Недостаточно прав: ${permission}`);
  }

  return createPendingAction({
    accountId: input.accountId,
    userId: input.userId,
    threadId: input.threadId,
    actionType,
    summary,
    payload: (input.args.payload ?? {}) as Prisma.InputJsonValue,
    riskLevel: riskLevel(input.args.riskLevel),
    permission,
  });
}

async function createMemoryActionFromArgs(input: {
  args: Prisma.JsonObject;
  accountId: number;
  userId: number;
  threadId: number;
  permissions: string[];
}) {
  if (!hasPermission(input.permissions, "crm.assistant.memory.manage")) {
    throw new Error("Недостаточно прав для изменения памяти ассистента.");
  }
  const key = stringField(input.args, "key");
  if (!key) throw new Error("Для обновления памяти нужен ключ.");
  const summary = stringField(input.args, "summary") || `Обновить память ассистента: ${key}`;

  return createPendingAction({
    accountId: input.accountId,
    userId: input.userId,
    threadId: input.threadId,
    actionType: "memory.update",
    summary,
    payload: {
      key,
      value: (input.args.value ?? null) as Prisma.JsonValue,
      confidence: typeof input.args.confidence === "number" ? input.args.confidence : 1,
      source: "crm_agent_llm",
    },
    riskLevel: "medium",
    permission: "crm.assistant.memory.manage",
  });
}

async function runReadTool(input: {
  tool: CrmAgentToolDefinition;
  args: Prisma.JsonObject;
  scope: CrmAgentScope;
  accountId: number;
  runId: number;
  threadId: number;
}) {
  const toolCall = await createAgentToolCall({
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
    toolName: input.tool.name,
    arguments: input.args as Prisma.InputJsonValue,
  });

  try {
    const result = await executeCrmAgentReadTool({
      tool: input.tool,
      args: input.args,
      scope: input.scope,
    });
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      result: result as Prisma.InputJsonValue,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить инструмент.";
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      error: message,
    });
    throw error;
  }
}

async function runDraftTool(input: {
  tool: CrmAgentToolDefinition;
  args: Prisma.JsonObject;
  scope: CrmAgentScope;
  accountId: number;
  runId: number;
  threadId: number;
}) {
  const toolCall = await createAgentToolCall({
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
    toolName: input.tool.name,
    arguments: input.args as Prisma.InputJsonValue,
  });

  try {
    if (!input.tool.handler) throw new Error(`Draft tool handler is not registered: ${input.tool.name}`);
    const result = await input.tool.handler(input.args, input.scope);
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      result: result as Prisma.InputJsonValue,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подготовить черновик.";
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      error: message,
    });
    throw error;
  }
}

async function maybeExecuteAutopilotAction(input: {
  accountId: number;
  actionId: number | null;
  userId: number;
  settings: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}) {
  if (!input.actionId) return null;
  const action = await getPendingActionForAccount({ accountId: input.accountId, actionId: input.actionId });
  if (!action || action.status !== "PENDING") return null;

  const decision = canAutopilotExecuteCrmAgentAction({
    settings: input.settings,
    actionType: action.actionType,
    riskLevel: action.riskLevel,
    payload: action.payload,
  });
  if (!decision.allowed) {
    return toJsonValue({ attempted: false, decision });
  }
  if (!canExecuteCrmAgentAction(action.actionType)) {
    return toJsonValue({ attempted: false, decision: { ...decision, allowed: false, reason: "action_not_executable" } });
  }

  const confirmed = await confirmPendingAction({
    accountId: input.accountId,
    actionId: input.actionId,
    userId: input.userId,
  });
  if (!confirmed.count) return toJsonValue({ attempted: false, decision: { ...decision, reason: "action_not_pending" } });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.autopilot.execute",
    targetType: "ai_pending_action",
    targetId: String(input.actionId),
    data: { actionType: action.actionType, level: input.settings.level, domain: decision.domain },
  });

  const execution = await executeConfirmedCrmAgentAction({
    accountId: input.accountId,
    actionId: input.actionId,
    userId: input.userId,
  });
  return toJsonValue({ attempted: true, decision, execution });
}

async function executeLlmCommand(input: {
  command: CrmAgentLlmCommand;
  accountId: number;
  userId: number;
  permissions: string[];
  runId: number;
  threadId: number;
  scope: CrmAgentScope;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}) {
  if (input.command.command === "answer") {
    return {
      selectedToolName: null,
      toolResult: null,
      answer: input.command.answer || "Готов помочь с клиентской базой, записями и рекомендациями.",
    };
  }

  if (input.command.command === "read") {
    const tool = getCrmAgentTool(input.command.toolName);
    if (!tool || tool.mode !== "read") throw new Error("Запрошенный инструмент чтения недоступен.");
    const result = await runReadTool({
      tool,
      args: input.command.args,
      scope: input.scope,
      accountId: input.accountId,
      runId: input.runId,
      threadId: input.threadId,
    });
    return {
      selectedToolName: tool.name,
      toolResult: result,
      answer: input.command.answer || "Проверил данные.",
    };
  }

  if (input.command.command === "draft_action") {
    if (input.command.toolName && input.command.toolName !== "action.prepare") {
      const tool = getCrmAgentTool(input.command.toolName);
      if (!tool || tool.mode !== "draft") throw new Error("Запрошенный draft-инструмент недоступен.");
      const result = await runDraftTool({
        tool,
        args: input.command.args,
        scope: input.scope,
        accountId: input.accountId,
        runId: input.runId,
        threadId: input.threadId,
      });
      const autopilot = await maybeExecuteAutopilotAction({
        accountId: input.accountId,
        actionId: pendingActionIdFromResult(result),
        userId: input.userId,
        settings: input.autopilot,
      });
      return {
        selectedToolName: tool.name,
        toolResult: autopilot && typeof autopilot === "object" && !Array.isArray(autopilot)
          ? toJsonValue({ draft: result, autopilot })
          : result,
        answer:
          autopilot && typeof autopilot === "object" && !Array.isArray(autopilot) && autopilot.attempted === true
            ? input.command.answer || "Подготовил и выполнил безопасное действие по правилам автопилота."
            : input.command.answer || "Подготовил черновик действия. Его нужно подтвердить перед выполнением.",
        autopilot,
      };
    }

    const action = await createActionFromArgs({ ...input, args: input.command.args });
    const autopilot = await maybeExecuteAutopilotAction({
      accountId: input.accountId,
      actionId: action.id,
      userId: input.userId,
      settings: input.autopilot,
    });
    return {
      selectedToolName: "action.prepare",
      toolResult: toJsonValue({ pendingActionId: action.id, status: action.status, autopilot }),
      answer:
        autopilot && typeof autopilot === "object" && !Array.isArray(autopilot) && autopilot.attempted === true
          ? input.command.answer || "Подготовил и выполнил безопасное действие по правилам автопилота."
          : input.command.answer || "Подготовил действие. Его нужно подтвердить перед выполнением.",
      autopilot,
    };
  }

  if (input.command.command === "update_memory") {
    const action = await createMemoryActionFromArgs({ ...input, args: input.command.args });
    const autopilot = await maybeExecuteAutopilotAction({
      accountId: input.accountId,
      actionId: action.id,
      userId: input.userId,
      settings: input.autopilot,
    });
    return {
      selectedToolName: "memory.update",
      toolResult: toJsonValue({ pendingActionId: action.id, status: action.status, autopilot }),
      answer:
        autopilot && typeof autopilot === "object" && !Array.isArray(autopilot) && autopilot.attempted === true
          ? input.command.answer || "Обновил память ассистента по правилам автопилота."
          : input.command.answer || "Подготовил обновление памяти. Его нужно подтвердить.",
      autopilot,
    };
  }

  if (input.command.command === "analyze" && input.command.analysisType === "insights") {
    const result = await generateCrmAgentInsights(input.accountId);
    return {
      selectedToolName: null,
      toolResult: toJsonValue(result),
      answer: input.command.answer || `Провёл анализ и создал новых рекомендаций: ${result.createdCount}.`,
    };
  }

  return {
    selectedToolName: null,
    toolResult: toJsonValue({ analysisType: input.command.analysisType, args: input.command.args }),
    answer: input.command.answer || "Собрал основу для анализа. Детальные выводы появятся в рекомендациях.",
  };
}

async function executeLlmToolLoop(input: {
  accountId: number;
  userId: number;
  permissions: string[];
  runId: number;
  threadId: number;
  message: string;
  context: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>;
  tools: CrmAgentToolDefinition[];
  scope: CrmAgentScope;
  conversationHistory: CrmAgentLlmHistoryMessage[];
}) {
  const observations: CrmAgentLlmObservation[] = [];
  const seenCommands = new Set<string>();
  let model: string | null = null;
  let lastCommand: CrmAgentLlmCommand | null = null;
  let lastError: string | null = null;

  for (let step = 1; step <= MAX_LLM_TOOL_STEPS; step += 1) {
    const llm = await requestCrmAgentLlmCommand({
      accountId: input.accountId,
      threadId: input.threadId,
      runId: input.runId,
      message: input.message,
      contextSummary: toJsonObject(input.context.summary),
      memory: toJsonValue(input.context.memory),
      insights: toJsonValue(input.context.insights),
      tools: input.tools,
      conversationHistory: input.conversationHistory,
      observations,
      step,
    });

    if (!llm.ok) {
      return {
        ok: false as const,
        model: llm.model ?? model,
        error: llm.error,
        raw: llm.raw,
        observations,
        lastCommand,
      };
    }

    model = llm.model;
    lastCommand = llm.command;
    const key = commandKey(llm.command);
    if (seenCommands.has(key) && llm.command.command !== "answer") {
      lastError = "Модель повторно запросила тот же шаг.";
      break;
    }
    seenCommands.add(key);

    if (llm.command.command === "answer") {
      return {
        ok: true as const,
        model,
        execution: {
          selectedToolName: observations.at(-1)?.toolName ?? null,
          toolResult: observations.at(-1)?.result ?? null,
          answer: llm.command.answer || "Готово.",
          observations,
        },
      };
    }

    if (llm.command.command === "read") {
      const tool = getCrmAgentTool(llm.command.toolName);
      if (!tool || tool.mode !== "read") throw new Error("Запрошенный инструмент чтения недоступен.");
      try {
        const result = await runReadTool({
          tool,
          args: llm.command.args,
          scope: input.scope,
          accountId: input.accountId,
          runId: input.runId,
          threadId: input.threadId,
        });
        const observation: CrmAgentLlmObservation = {
          step,
          toolName: tool.name,
          args: llm.command.args,
          result: compactJsonValue(result),
          error: null,
        };
        observations.push(observation);
        await appendCrmAgentMessage({
          threadId: input.threadId,
          role: "tool",
          content: JSON.stringify(observation),
        });
        continue;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось выполнить инструмент.";
        const observation: CrmAgentLlmObservation = {
          step,
          toolName: llm.command.toolName,
          args: llm.command.args,
          error: message,
        };
        observations.push(observation);
        await appendCrmAgentMessage({
          threadId: input.threadId,
          role: "tool",
          content: JSON.stringify(observation),
        });
        continue;
      }
    }

    if (llm.command.command === "analyze" && llm.command.analysisType === "insights") {
      const result = await generateCrmAgentInsights(input.accountId);
      const observation: CrmAgentLlmObservation = {
        step,
        toolName: "insights.generate",
        args: llm.command.args,
        result: compactJsonValue(result),
        error: null,
      };
      observations.push(observation);
      await appendCrmAgentMessage({
        threadId: input.threadId,
        role: "tool",
        content: JSON.stringify(observation),
      });
      continue;
    }

    const execution = await executeLlmCommand({
      command: llm.command,
      accountId: input.accountId,
      userId: input.userId,
      permissions: input.permissions,
      runId: input.runId,
      threadId: input.threadId,
      scope: input.scope,
      autopilot: input.context.autopilot,
    });
    return {
      ok: true as const,
      model,
      execution: {
        ...execution,
        observations,
      },
    };
  }

  const lastObservation = observations.at(-1);
  return {
    ok: true as const,
    model,
    execution: {
      selectedToolName: lastObservation?.toolName ?? null,
      toolResult: lastObservation?.result ?? null,
      answer: lastError
        ? "Проверил данные, но остановил цепочку инструментов из-за повторяющегося шага. Сформулируйте запрос точнее или подтвердите нужное действие отдельно."
        : "Проверил данные несколькими инструментами. Для продолжения уточните, какое действие подготовить на подтверждение.",
      observations,
    },
  };
}

async function executeDeterministicFallback(input: {
  accountId: number;
  runId: number;
  threadId: number;
  message: string;
  requestedToolName?: string | null;
  requestedToolArgs?: Prisma.JsonObject | null;
  scope: CrmAgentScope;
}): Promise<ToolExecution> {
  const selectedToolName = input.requestedToolName || inferReadToolName(input.message);
  if (!selectedToolName) {
    if (/(проанализ|рекомендац|совет|что улучш|найди проблем)/i.test(input.message)) {
      const result = await generateCrmAgentInsights(input.accountId);
      return {
        selectedToolName: null,
        toolResult: toJsonValue(result),
        answer: `Провёл анализ и создал новых рекомендаций: ${result.createdCount}.`,
      };
    }
    return {
      selectedToolName: null,
      toolResult: null,
      answer: fallbackAnswer(input.message, null, null),
    };
  }

  const tool = getCrmAgentTool(selectedToolName);
  if (!tool || tool.mode !== "read") {
    return {
      selectedToolName: null,
      toolResult: null,
      answer: "Запрошенный инструмент недоступен для чтения. Изменения можно выполнять только через действия на подтверждение.",
    };
  }

  const result = await runReadTool({
    tool,
    args: input.requestedToolArgs ?? {},
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });

  return {
    selectedToolName: tool.name,
    toolResult: result,
    answer: fallbackAnswer(input.message, tool.name, result),
  };
}

async function executeAppointmentLookupFromText(input: {
  accountId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState: unknown;
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  const previousAppointmentCards = parseStoredCards(input.threadState).filter((card) => card.type === "appointment");
  if (previousAppointmentCards.length && /\b(какое|какие|что за|подробн|например)\b/u.test(text)) {
    const details = appointmentCardDetails(previousAppointmentCards);
    return {
      selectedEntity: previousAppointmentCards.length === 1 ? { type: "appointment", id: previousAppointmentCards[0].id } : null,
      execution: {
        selectedToolName: null,
        toolResult: toJsonValue({ appointments: previousAppointmentCards.map((card) => card.data).filter(Boolean) }),
        answer: details.length ? `Вот что нашёл по этим посещениям:\n${details.join("\n")}` : "В прошлом ответе не сохранились детали посещения. Уточните период, и я покажу записи карточками.",
      },
    };
  }

  if (!isAppointmentLookupMessage(input.message)) return null;
  const range = parseAppointmentLookupRange(input.message);
  if (!range) return null;
  const tool = getCrmAgentTool("appointments.search");
  if (!tool || tool.mode !== "read") return null;
  const args = {
    dateFrom: isoDateOnly(range.dateFrom),
    dateTo: endOfLocalDay(range.dateTo).toISOString(),
    take: 50,
  };
  const result = await runReadTool({
    tool,
    args,
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });
  const object = isRecordValue(result) ? result : null;
  const appointments = Array.isArray(object?.appointments) ? object.appointments : [];
  const count = appointments.length;
  return {
    selectedEntity: null,
    execution: {
      selectedToolName: tool.name,
      toolResult: result,
      answer: count
        ? `Нашёл ${count} ${count === 1 ? "запись" : count < 5 ? "записи" : "записей"} ${range.label}. Показываю детали карточками ниже.`
        : `За ${range.label.replace(/^за\s+/u, "")} записей не нашёл.`,
      observations: [{ step: 1, toolName: tool.name, args, result: compactJsonValue(result), error: null }],
    },
  };
}

async function findBestClient(accountId: number, message: string, cards: CrmAgentCard[], selected: CrmAgentCard | null) {
  const explicit = message.match(/(?:client|клиент[ау]?|клиента)\s*[#№]\s*(\d+)/iu);
  if (explicit) return { id: Number(explicit[1]), title: `#${explicit[1]}` };
  if (selected?.type === "client") return { id: numericCardId(selected), title: selected.title };
  const card = cards.find((item) => item.type === "client" && scoreLabels(message, [item.title, item.subtitle, ...(item.meta ?? [])]) > 0);
  if (card) return { id: numericCardId(card), title: card.title };
  const clients = await prisma.client.findMany({
    where: { accountId },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });
  const ranked = clients
    .map((client) => ({
      client,
      score: scoreLabels(message, [client.firstName, client.lastName, [client.firstName, client.lastName].filter(Boolean).join(" "), client.phone, client.email]),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const client = ranked[0]?.client;
  return client ? { id: client.id, title: [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || `#${client.id}` } : null;
}

async function findBestService(accountId: number, message: string, cards: CrmAgentCard[], selected: CrmAgentCard | null) {
  const explicit = message.match(/(?:service|услуг[ауи]?)\s*[#№]\s*(\d+)/iu);
  if (explicit) return { id: Number(explicit[1]), title: `#${explicit[1]}`, durationMin: null as number | null, price: null as string | null };
  if (selected?.type === "service") return { id: numericCardId(selected), title: selected.title, durationMin: null as number | null, price: null as string | null };
  const card = cards.find((item) => item.type === "service" && scoreLabels(message, [item.title, item.subtitle, ...(item.meta ?? [])]) > 0);
  if (card) return { id: numericCardId(card), title: card.title, durationMin: null, price: null };
  const services = await prisma.service.findMany({
    where: { accountId, isActive: true },
    orderBy: { name: "asc" },
    take: 300,
    select: { id: true, name: true, description: true, baseDurationMin: true, basePrice: true, category: { select: { name: true } } },
  });
  const ranked = services
    .map((service) => ({ service, score: scoreLabels(message, [service.name, service.description, service.category?.name]) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const service = ranked[0]?.service;
  return service ? { id: service.id, title: service.name, durationMin: service.baseDurationMin, price: service.basePrice.toString() } : null;
}

async function findBestSpecialist(accountId: number, message: string, cards: CrmAgentCard[], selected: CrmAgentCard | null, serviceId?: number | null) {
  const explicit = message.match(/(?:specialist|сотрудник[ау]?|специалист[ау]?|мастер[ау]?)\s*[#№]\s*(\d+)/iu);
  if (explicit) return { id: Number(explicit[1]), title: `#${explicit[1]}` };
  if (selected?.type === "specialist") return { id: numericCardId(selected), title: selected.title };
  const card = cards.find((item) => item.type === "specialist" && scoreLabels(message, [item.title, item.subtitle, ...(item.meta ?? [])]) > 0);
  if (card) return { id: numericCardId(card), title: card.title };
  const specialists = await prisma.specialistProfile.findMany({
    where: { accountId, ...(serviceId ? { services: { some: { serviceId } } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      bio: true,
      user: { select: { profile: { select: { firstName: true, lastName: true } } } },
      services: { select: { service: { select: { name: true } } }, take: 20 },
      locations: { select: { location: { select: { id: true, name: true } } }, take: 10 },
    },
  });
  const ranked = specialists
    .map((specialist) => {
      const profile = specialist.user.profile;
      const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
      return {
        specialist,
        name,
        score: scoreLabels(message, [name, specialist.bio, ...specialist.services.map((item) => item.service.name), ...specialist.locations.map((item) => item.location.name)]),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const item = ranked[0] ?? (serviceId && specialists.length === 1 ? {
    specialist: specialists[0],
    name: [specialists[0].user.profile?.firstName, specialists[0].user.profile?.lastName].filter(Boolean).join(" "),
  } : null);
  return item ? { id: item.specialist.id, title: item.name || `#${item.specialist.id}` } : null;
}

async function firstLocationForAppointment(accountId: number, input: { specialistId?: number | null; serviceId?: number | null }) {
  if (input.specialistId) {
    const binding = await prisma.specialistLocation.findFirst({
      where: { specialistId: input.specialistId, location: { accountId } },
      select: { location: { select: { id: true, name: true } } },
    });
    if (binding?.location) return binding.location;
  }
  if (input.serviceId) {
    const binding = await prisma.serviceLocation.findFirst({
      where: { serviceId: input.serviceId, location: { accountId } },
      select: { location: { select: { id: true, name: true } } },
    });
    if (binding?.location) return binding.location;
  }
  return prisma.location.findFirst({ where: { accountId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
}

function clarificationExecution(question: string, options: Array<{ label: string; value: Prisma.JsonValue }> = []): ToolExecution {
  return {
    selectedToolName: null,
    toolResult: toJsonValue({ clarification: { question, options } }),
    answer: options.length ? `${question}\n${options.map((option, index) => `${index + 1}. ${option.label}`).join("\n")}` : question,
  };
}

function quotedValue(message: string) {
  const match = message.match(/[«"]([^»"]+)[»"]/u);
  return match?.[1]?.trim() || null;
}

function textAfterAny(message: string, markers: string[]) {
  for (const marker of markers) {
    const index = normalizeCrmText(message).indexOf(normalizeCrmText(marker));
    if (index >= 0) {
      const raw = message.slice(index + marker.length).replace(/^[:\s-]+/u, "").trim();
      if (raw) return raw;
    }
  }
  return null;
}

function parseMoneyLike(message: string) {
  const match = normalizeCrmText(message).match(/\b(?:цена|стоимость|прайс|за)\s*(\d{2,7})(?:[.,](\d{1,2}))?\b/u) ?? normalizeCrmText(message).match(/\b(\d{2,7})(?:[.,](\d{1,2}))?\s*(?:руб|₽|р)\b/u);
  if (!match) return null;
  return `${match[1]}${match[2] ? `.${match[2].padEnd(2, "0")}` : ".00"}`;
}

function parseDurationMin(message: string) {
  const text = normalizeCrmText(message);
  const hours = text.match(/\b(\d{1,2})\s*(?:ч|час|часа|часов)\b/u);
  const minutes = text.match(/\b(\d{1,3})\s*(?:мин|минут)\b/u);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  return total > 0 ? total : null;
}

function parseBooleanIntent(message: string) {
  const text = normalizeCrmText(message);
  if (/\b(включи|актив|показывай|опубликуй|публичн)\b/u.test(text)) return true;
  if (/\b(выключи|скрой|архив|неактив|не показывай|непубличн)\b/u.test(text)) return false;
  return null;
}

function updateArgsFromEditMessage(intent: string, entityId: number, message: string): Prisma.JsonObject | null {
  const text = normalizeCrmText(message);
  const name = quotedValue(message) ?? textAfterAny(message, ["название", "имя", "назови"]);
  const description = textAfterAny(message, ["описание", "текст"]);
  const status = /\b(актив|active)\b/u.test(text) ? "ACTIVE" : /\b(архив|неактив|inactive)\b/u.test(text) ? "ARCHIVED" : null;

  if (intent === "edit_service") {
    const args: Prisma.JsonObject = { serviceId: entityId };
    if (name) args.name = name;
    if (description) args.description = description;
    const price = parseMoneyLike(message);
    if (price) args.basePrice = price;
    const duration = parseDurationMin(message);
    if (duration) args.baseDurationMin = duration;
    const active = parseBooleanIntent(message);
    if (active != null) args.isActive = active;
    return Object.keys(args).length > 1 ? args : null;
  }

  if (intent === "edit_location") {
    const args: Prisma.JsonObject = { locationId: entityId };
    if (name) args.name = name;
    const address = textAfterAny(message, ["адрес"]);
    if (address) args.address = address;
    if (description) args.description = description;
    const phone = message.match(/(?:\+?\d[\d\s().-]{7,}\d)/u)?.[0]?.replace(/[^\d+]/g, "");
    if (phone) args.phone = phone;
    if (status) args.status = status;
    return Object.keys(args).length > 1 ? args : null;
  }

  if (intent === "edit_promo") {
    const args: Prisma.JsonObject = { promotionId: entityId };
    if (name) args.name = name;
    const percent = text.match(/\b(\d{1,2})\s*%/u);
    if (percent) {
      args.type = "PERCENT";
      args.value = percent[1];
    }
    const money = parseMoneyLike(message);
    if (money && !percent) {
      args.type = "FIXED";
      args.value = money;
    }
    const active = parseBooleanIntent(message);
    if (active != null) args.isActive = active;
    return Object.keys(args).length > 1 ? args : null;
  }

  if (intent === "edit_specialist") {
    const args: Prisma.JsonObject = { specialistId: entityId };
    const bio = textAfterAny(message, ["био", "описание", "профиль"]);
    if (bio) args.bio = bio;
    const isPublic = parseBooleanIntent(message);
    if (isPublic != null) args.isPublic = isPublic;
    return Object.keys(args).length > 1 ? args : null;
  }

  return null;
}

function selectedEntityFromState(value: unknown) {
  if (!isRecordValue(value) || !isRecordValue(value.selectedEntity)) return null;
  const type = typeof value.selectedEntity.type === "string" ? value.selectedEntity.type : null;
  const id = numericEntityId(value.selectedEntity.id as number | string | null);
  return type && id ? { type, id } : null;
}

function inferEditIntentFromEntityType(type: string | null) {
  if (type === "service") return "edit_service";
  if (type === "location") return "edit_location";
  if (type === "promo") return "edit_promo";
  if (type === "specialist") return "edit_specialist";
  return null;
}

async function executeEntityEditFromText(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  const selected = selectedEntityFromState(input.threadState);
  const explicitService = input.message.match(/(?:услуг[ауи]?|service)\s*[#№]\s*(\d+)/iu);
  const explicitLocation = input.message.match(/(?:локаци[яюи]?|филиал|location)\s*[#№]\s*(\d+)/iu);
  const explicitPromo = input.message.match(/(?:акци[яюи]?|promo|promotion)\s*[#№]\s*(\d+)/iu);
  const explicitSpecialist = input.message.match(/(?:сотрудник[ау]?|специалист[ау]?|мастер[ау]?|specialist)\s*[#№]\s*(\d+)/iu);
  const explicit = explicitService
    ? { intent: "edit_service", type: "service", id: Number(explicitService[1]) }
    : explicitLocation
      ? { intent: "edit_location", type: "location", id: Number(explicitLocation[1]) }
      : explicitPromo
        ? { intent: "edit_promo", type: "promo", id: Number(explicitPromo[1]) }
        : explicitSpecialist
          ? { intent: "edit_specialist", type: "specialist", id: Number(explicitSpecialist[1]) }
          : null;
  const selectedIntent = inferEditIntentFromEntityType(selected?.type ?? null);
  const selectedId = selected?.id ?? null;
  const parsedSelectedArgs = selectedIntent && selectedId ? updateArgsFromEditMessage(selectedIntent, selectedId, input.message) : null;
  const inferredIntent =
    explicit?.intent ??
    (parsedSelectedArgs || /\b(измени|обнови|поменяй|поставь|сделай|цена|стоимость|прайс|адрес|телефон|описание|название|био|скрой|опубликуй|актив|неактив|публичн)\b/u.test(text)
      ? selectedIntent
      : null);
  const entityId = explicit?.id ?? selected?.id ?? null;
  if (!inferredIntent || !entityId) return null;

  const toolNameByIntent: Record<string, string> = {
    edit_service: "services.draftUpdate",
    edit_location: "locations.draftUpdate",
    edit_promo: "promos.draftUpdate",
    edit_specialist: "specialists.draftUpdate",
  };
  const args = parsedSelectedArgs && inferredIntent === selectedIntent && entityId === selectedId
    ? parsedSelectedArgs
    : updateArgsFromEditMessage(inferredIntent, entityId, input.message);
  if (!args) {
    return {
      selectedEntity: { type: explicit?.type ?? selected?.type ?? "service", id: entityId } as ContinuationExecution["selectedEntity"],
      pendingClarification: toJsonValue({ kind: "edit_entity", intent: inferredIntent, entityId }),
      execution: clarificationExecution("Что именно изменить? Укажите новое название, цену, длительность, адрес, описание, статус или текст профиля."),
    };
  }
  const tool = getCrmAgentTool(toolNameByIntent[inferredIntent]);
  if (!tool || tool.mode !== "draft") return null;
  const result = await runDraftTool({ tool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
  const autopilot = await maybeExecuteAutopilotAction({ accountId: input.accountId, actionId: pendingActionIdFromResult(result), userId: input.userId, settings: input.autopilot });
  const type = inferredIntent === "edit_service" ? "service" : inferredIntent === "edit_location" ? "location" : inferredIntent === "edit_promo" ? "promo" : "specialist";
  return {
    selectedEntity: { type, id: entityId } as ContinuationExecution["selectedEntity"],
    execution: {
      selectedToolName: tool.name,
      toolResult: toJsonValue({ draft: result, autopilot }),
      answer: "Подготовил изменение карточки. Проверьте preview и подтвердите действие.",
      observations: [{ step: 1, toolName: tool.name, args, result: compactJsonValue(result), error: null }],
      autopilot,
    },
  };
}

async function applySelectedCardToPendingAction(input: {
  accountId: number;
  action: Awaited<ReturnType<typeof listPendingActions>>[number];
  card: CrmAgentCard;
}) {
  if (!isRecordValue(input.action.payload)) return null;
  const payload = { ...input.action.payload } as Prisma.JsonObject;
  const id = numericEntityId(input.card.id);
  if (id == null && input.card.type !== "slot") return null;

  if (input.card.type === "slot" && (input.action.actionType === "appointment.create" || input.action.actionType === "appointment.reschedule")) {
    const slot = slotDraftData(input.card);
    if (!slot?.startAt) return null;
    payload.startAt = slot.startAt;
    if (slot.endAt) payload.endAt = slot.endAt;
    if (slot.specialistId) payload.specialistId = slot.specialistId;
    if (slot.locationId) payload.locationId = slot.locationId;
    if (slot.serviceId && input.action.actionType === "appointment.create") payload.serviceId = slot.serviceId;
    const data = isRecordValue(input.card.data) ? input.card.data : {};
    if (typeof data.specialistName === "string") payload.specialistName = data.specialistName;
    if (typeof data.locationName === "string") payload.locationName = data.locationName;
    if (typeof data.serviceName === "string" && input.action.actionType === "appointment.create") payload.serviceName = data.serviceName;
  } else if (input.card.type === "location" && (input.action.actionType === "appointment.create" || input.action.actionType === "appointment.reschedule" || input.action.actionType === "specialist.schedule.update")) {
    payload.locationId = id;
    payload.locationName = input.card.title;
  } else if (input.card.type === "specialist" && (input.action.actionType === "appointment.create" || input.action.actionType === "appointment.reschedule" || input.action.actionType === "specialist.schedule.update")) {
    payload.specialistId = id;
    payload.specialistName = input.card.title;
  } else if (input.card.type === "service" && input.action.actionType === "appointment.create") {
    payload.serviceId = id;
    payload.serviceName = input.card.title;
  } else if (input.card.type === "client" && (input.action.actionType === "appointment.create" || input.action.actionType === "notification.send")) {
    payload.clientId = id;
    payload.clientName = input.card.title;
  } else {
    return null;
  }

  await prisma.aiPendingAction.updateMany({
    where: { id: input.action.id, accountId: input.accountId, status: "PENDING" },
    data: { payload: payload as Prisma.InputJsonValue, summary: `${input.action.summary} (updated)` },
  });
  return payload;
}

async function verifySlotAvailability(input: {
  accountId: number;
  runId: number;
  threadId: number;
  scope: CrmAgentScope;
  serviceId?: number | null;
  specialistId: number;
  locationId: number;
  startAt: Date;
  durationMin?: number | null;
}) {
  const slotsTool = getCrmAgentTool("appointments.findAvailableSlots");
  if (!slotsTool || slotsTool.mode !== "read") return null;
  const result = await runReadTool({
    tool: slotsTool,
    args: {
      ...(input.serviceId ? { serviceId: input.serviceId } : {}),
      specialistId: input.specialistId,
      locationId: input.locationId,
      ...(input.durationMin ? { durationMin: input.durationMin } : {}),
      dateFrom: isoDateOnly(input.startAt),
      dateTo: endOfLocalDay(input.startAt).toISOString(),
      take: 80,
    },
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });
  const object = isRecordValue(result) ? result : null;
  const slots: Record<string, unknown>[] = Array.isArray(object?.slots) ? (object.slots as unknown[]).filter(isRecordValue) : [];
  const requested = input.startAt.getTime();
  return slots.find((slot) => typeof slot.startAt === "string" && Math.abs(new Date(slot.startAt).getTime() - requested) < 60_000) ?? null;
}

async function executeAppointmentCreateFromText(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  if (!/\b(запиш|создай запись|забронируй|записать)\b/u.test(text)) return null;

  const cards = parseStoredCards(input.threadState);
  const selected = selectedCardFromState(input.threadState);
  const selectedSlot = selected?.type === "slot" ? selected : cards.find((card) => card.type === "slot" && /\b(перв|слот|окн|подходит)\b/u.test(text));
  const slot = slotDraftData(selectedSlot);
  const client = await findBestClient(input.accountId, input.message, cards, selected);
  const service = await findBestService(input.accountId, input.message, cards, selected);
  const specialist = slot?.specialistId
    ? { id: slot.specialistId, title: selectedSlot?.meta?.[0] ?? `#${slot.specialistId}` }
    : await findBestSpecialist(input.accountId, input.message, cards, selected, service?.id ?? null);
  const date = parseRelativeScheduleDate(input.message);
  const time = parseSingleTime(input.message);
  const wantsFirstSlot = /\b(перв(?:ое|ый|ая)|ближайш|свободн|окн|слот)\b/u.test(text);

  if (!client?.id) return { execution: clarificationExecution("Какого клиента записать?") };
  if (!service?.id) return { execution: clarificationExecution("Какую услугу записать клиенту?") };

  let startAt = slot?.startAt ? new Date(slot.startAt) : null;
  let endAt = slot?.endAt ? new Date(slot.endAt) : null;
  let specialistId = slot?.specialistId ?? specialist?.id ?? null;
  let locationId = slot?.locationId ?? null;
  const durationMin = service.durationMin ?? 60;

  if (!startAt && date && time) {
    startAt = applyTimeToDate(date, time);
    endAt = addMinutes(startAt, durationMin);
  }

  if (!specialistId) {
    const fallbackSpecialist = await findBestSpecialist(input.accountId, input.message, cards, selected, service.id);
    specialistId = fallbackSpecialist?.id ?? null;
  }
  if (!specialistId) return { execution: clarificationExecution("К какому сотруднику записать клиента?") };

  if (!locationId) {
    const location = await firstLocationForAppointment(input.accountId, { specialistId, serviceId: service.id });
    locationId = location?.id ?? null;
  }
  if (!locationId) return { execution: clarificationExecution("В какой локации создать запись?") };

  if (!startAt && (wantsFirstSlot || date)) {
    const slotsTool = getCrmAgentTool("appointments.findAvailableSlots");
    if (slotsTool?.mode === "read") {
      const dateFrom = date ?? new Date();
      const dateTo = addLocalDays(dateFrom, date ? 1 : DEFAULT_APPOINTMENT_LOOKAHEAD_DAYS);
      const slotsResult = await runReadTool({
        tool: slotsTool,
        args: { serviceId: service.id, specialistId, locationId, dateFrom: isoDateOnly(dateFrom), dateTo: endOfLocalDay(dateTo).toISOString(), take: 20 },
        scope: input.scope,
        accountId: input.accountId,
        runId: input.runId,
        threadId: input.threadId,
      });
      const slots: Record<string, unknown>[] = isRecordValue(slotsResult) && Array.isArray(slotsResult.slots) ? (slotsResult.slots as unknown[]).filter(isRecordValue) : [];
      const first = slots[0];
      if (!first || typeof first.startAt !== "string") {
        return {
          execution: {
            selectedToolName: slotsTool.name,
            toolResult: slotsResult,
            answer: "Не нашёл свободное окно для этой записи. Уточните дату, сотрудника или локацию.",
            observations: [{ step: 1, toolName: slotsTool.name, args: { serviceId: service.id, specialistId, locationId }, result: compactJsonValue(slotsResult), error: null }],
          },
        };
      }
      startAt = new Date(first.startAt);
      endAt = typeof first.endAt === "string" ? new Date(first.endAt) : addMinutes(startAt, durationMin);
    }
  }

  if (!startAt) return { execution: clarificationExecution("На какое время создать запись?") };

  const available = await verifySlotAvailability({
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
    scope: input.scope,
    serviceId: service.id,
    specialistId,
    locationId,
    startAt,
    durationMin,
  });
  if (!available && startAt > new Date()) return { execution: clarificationExecution("Это время не найдено среди свободных окон. Выберите другое окно или попросите показать ближайшие свободные.") };

  const draftTool = getCrmAgentTool("appointments.draftCreate");
  if (!draftTool || draftTool.mode !== "draft") return null;
  const args = {
    clientId: client.id,
    serviceId: service.id,
    specialistId,
    locationId,
    startAt: startAt.toISOString(),
    ...(endAt ? { endAt: endAt.toISOString() } : {}),
    durationTotalMin: durationMin,
    ...(service.price ? { priceTotal: service.price } : {}),
    comment: "Created by CRM assistant",
  };
  const draftResult = await runDraftTool({ tool: draftTool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
  const autopilot = await maybeExecuteAutopilotAction({ accountId: input.accountId, actionId: pendingActionIdFromResult(draftResult), userId: input.userId, settings: input.autopilot });
  return {
    selectedEntity: { type: "client", id: client.id },
    execution: {
      selectedToolName: draftTool.name,
      toolResult: toJsonValue({ draft: draftResult, autopilot }),
      answer: `Подготовил запись: ${client.title}, ${service.title}, ${startAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}. Проверьте и подтвердите действие.`,
      observations: [{ step: 1, toolName: draftTool.name, args, result: compactJsonValue(draftResult), error: null }],
      autopilot,
    },
  };
}

async function executeAppointmentRescheduleFromText(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  if (!/\b(перенес|перенести|передвин|поставь такое же время)\b/u.test(text)) return null;
  const cards = parseStoredCards(input.threadState);
  const selected = selectedCardFromState(input.threadState);
  const explicitId = input.message.match(/(?:запис[ьиь]\s*)?[#№]\s*(\d+)/iu);
  const selectedAppointmentId = selected?.type === "appointment" ? numericCardId(selected) : null;
  let appointmentId = selectedAppointmentId ?? (explicitId ? Number(explicitId[1]) : null);

  if (!appointmentId) {
    const client = await findBestClient(input.accountId, input.message, cards, selected);
    if (client?.id) {
      const appointments = await prisma.appointment.findMany({
        where: { accountId: input.accountId, clientId: client.id, status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] } },
        orderBy: { startAt: "asc" },
        take: 5,
        select: { id: true, startAt: true, services: { select: { service: { select: { name: true } } }, take: 2 } },
      });
      if (appointments.length > 1) {
        return {
          pendingClarification: toJsonValue({ kind: "select_appointment", clientId: client.id }),
          execution: clarificationExecution("Какую запись перенести?", appointments.map((appointment) => ({
            label: `#${appointment.id} ${appointment.startAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })} ${appointment.services.map((item) => item.service.name).join(", ")}`,
            value: { type: "appointment", id: appointment.id } as Prisma.JsonObject,
          }))),
        };
      }
      appointmentId = appointments[0]?.id ?? null;
    }
  }
  if (!appointmentId) return { execution: clarificationExecution("Какую запись перенести? Укажите номер записи или выберите карточку.") };

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId: input.accountId },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      durationTotalMin: true,
      specialistId: true,
      locationId: true,
      services: { select: { serviceId: true }, take: 1 },
    },
  });
  if (!appointment) return { execution: clarificationExecution("Не нашёл эту запись в аккаунте.") };

  const selectedSlot = selected?.type === "slot" ? selected : cards.find((card) => card.type === "slot" && /\b(перв|слот|окн|подходит)\b/u.test(text));
  const slot = slotDraftData(selectedSlot);
  const date = parseRelativeScheduleDate(input.message);
  const time = parseSingleTime(input.message);
  let startAt = slot?.startAt ? new Date(slot.startAt) : null;
  let specialistId = slot?.specialistId ?? appointment.specialistId;
  let locationId = slot?.locationId ?? appointment.locationId;
  const serviceId = slot?.serviceId ?? appointment.services[0]?.serviceId ?? null;

  if (!startAt && date) {
    const effectiveTime = time ?? (/\b(такое же время)\b/u.test(text) ? { hour: appointment.startAt.getHours(), minute: appointment.startAt.getMinutes(), label: "" } : null);
    if (effectiveTime) startAt = applyTimeToDate(date, effectiveTime);
  }
  if (!startAt && /\b(перв|ближайш|свободн|окн|слот)\b/u.test(text)) {
    const slotsTool = getCrmAgentTool("appointments.findAvailableSlots");
    if (slotsTool?.mode === "read") {
      const dateFrom = date ?? new Date();
      const dateTo = addLocalDays(dateFrom, date ? 1 : DEFAULT_APPOINTMENT_LOOKAHEAD_DAYS);
      const slotsResult = await runReadTool({
        tool: slotsTool,
        args: { ...(serviceId ? { serviceId } : {}), specialistId, locationId, durationMin: appointment.durationTotalMin, dateFrom: isoDateOnly(dateFrom), dateTo: endOfLocalDay(dateTo).toISOString(), take: 20 },
        scope: input.scope,
        accountId: input.accountId,
        runId: input.runId,
        threadId: input.threadId,
      });
      const slots: Record<string, unknown>[] = isRecordValue(slotsResult) && Array.isArray(slotsResult.slots) ? (slotsResult.slots as unknown[]).filter(isRecordValue) : [];
      const first = slots[0];
      if (first && typeof first.startAt === "string") {
        startAt = new Date(first.startAt);
        specialistId = numericEntityId(first.specialistId as number | string | null) ?? specialistId;
        locationId = numericEntityId(first.locationId as number | string | null) ?? locationId;
      }
    }
  }
  if (!startAt) return { execution: clarificationExecution("На какую дату и время перенести запись?") };

  const draftTool = getCrmAgentTool("appointments.draftReschedule");
  if (!draftTool || draftTool.mode !== "draft") return null;
  const endAt = addMinutes(startAt, appointment.durationTotalMin);
  const args = { appointmentId, startAt: startAt.toISOString(), endAt: endAt.toISOString(), specialistId, locationId, comment: "Rescheduled by CRM assistant" };
  const draftResult = await runDraftTool({ tool: draftTool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
  const autopilot = await maybeExecuteAutopilotAction({ accountId: input.accountId, actionId: pendingActionIdFromResult(draftResult), userId: input.userId, settings: input.autopilot });
  return {
    selectedEntity: { type: "appointment", id: appointmentId },
    execution: {
      selectedToolName: draftTool.name,
      toolResult: toJsonValue({ draft: draftResult, autopilot }),
      answer: `Подготовил перенос записи #${appointmentId} на ${startAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}. Проверьте и подтвердите действие.`,
      observations: [{ step: 1, toolName: draftTool.name, args, result: compactJsonValue(draftResult), error: null }],
      autopilot,
    },
  };
}

async function executeNotificationSendFromText(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  if (!/\b(напиш|отправ|сообщ|предложи|напомни)\b/u.test(text)) return null;
  const cards = parseStoredCards(input.threadState);
  const selected = selectedCardFromState(input.threadState);
  const client = await findBestClient(input.accountId, input.message, cards, selected);
  if (!client?.id) return { execution: clarificationExecution("Какому клиенту отправить сообщение?") };

  const clientData = await prisma.client.findFirst({
    where: { id: client.id, accountId: input.accountId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      userId: true,
      contacts: { select: { type: true, value: true } },
      consents: { where: { type: "marketing", grantedAt: { not: null }, revokedAt: null }, select: { id: true } },
    },
  });
  if (!clientData) return { execution: clarificationExecution("Не нашёл клиента в аккаунте.") };
  if (!clientData.consents.length) return { execution: clarificationExecution("У клиента нет активного согласия на маркетинговые сообщения.") };

  const channels = [
    ...(clientData.email ? [{ channel: "EMAIL", label: "Email" }] : []),
    ...(clientData.phone ? [{ channel: "SMS", label: "SMS" }] : []),
    ...(clientData.contacts.some((contact) => ["telegram", "telegram_chat_id", "tg"].includes(contact.type.toLowerCase())) ? [{ channel: "TELEGRAM", label: "Telegram" }] : []),
    ...(clientData.userId ? [{ channel: "IN_APP", label: "In-app" }] : []),
  ];
  if (!channels.length) return { execution: clarificationExecution("У клиента нет доступных контактов для отправки.") };

  const explicitChannel = /\b(email|почт)\b/u.test(text) ? "EMAIL" : /\b(sms|смс)\b/u.test(text) ? "SMS" : /\b(telegram|телеграм|tg)\b/u.test(text) ? "TELEGRAM" : null;
  const channel = explicitChannel ?? (channels.length === 1 ? channels[0].channel : null);
  if (!channel) {
    return {
      pendingClarification: toJsonValue({ kind: "select_notification_channel", clientId: client.id }),
      execution: clarificationExecution("По какому каналу отправить сообщение?", channels.map((item) => ({ label: item.label, value: { channel: item.channel } as Prisma.JsonObject }))),
    };
  }

  const bodyMatch = input.message.match(/(?:что|текст|сообщение)[:\s]+(.+)$/iu);
  const bodyText = bodyMatch?.[1]?.trim()
    || (/\bнапомин/i.test(input.message) ? "Напоминаем о вашей записи. Если нужно изменить время, ответьте на это сообщение." : null)
    || (/\bокн/i.test(input.message) ? "Здравствуйте! Появилось свободное окно. Напишите, если хотите записаться." : null);
  if (!bodyText) return { execution: clarificationExecution("Какой текст отправить клиенту?") };

  const draftTool = getCrmAgentTool("notifications.draftSend");
  if (!draftTool || draftTool.mode !== "draft") return null;
  const args = { clientId: client.id, channel, bodyText, title: "Сообщение от салона" };
  const draftResult = await runDraftTool({ tool: draftTool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
  const autopilot = await maybeExecuteAutopilotAction({ accountId: input.accountId, actionId: pendingActionIdFromResult(draftResult), userId: input.userId, settings: input.autopilot });
  return {
    selectedEntity: { type: "client", id: client.id },
    execution: {
      selectedToolName: draftTool.name,
      toolResult: toJsonValue({ draft: draftResult, autopilot }),
      answer: `Подготовил сообщение клиенту ${client.title} через ${channel}. Проверьте и подтвердите отправку.`,
      observations: [{ step: 1, toolName: draftTool.name, args, result: compactJsonValue(draftResult), error: null }],
      autopilot,
    },
  };
}

async function executeAppointmentCancelFromText(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  if (!/\b(отмени|отменить|сними|удали)\b/u.test(text) || !/\b(запись|визит|бронь)\b/u.test(text)) return null;
  const cards = parseStoredCards(input.threadState);
  const selected = selectedCardFromState(input.threadState);
  const explicitId = input.message.match(/(?:запис[ьиь]\s*)?[#№]\s*(\d+)/iu);
  let appointmentId = selected?.type === "appointment" ? numericCardId(selected) : explicitId ? Number(explicitId[1]) : null;
  if (!appointmentId) {
    const client = await findBestClient(input.accountId, input.message, cards, selected);
    if (client?.id) {
      const appointments = await prisma.appointment.findMany({
        where: { accountId: input.accountId, clientId: client.id, status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] } },
        orderBy: { startAt: "asc" },
        take: 5,
        select: { id: true, startAt: true, services: { select: { service: { select: { name: true } } }, take: 2 } },
      });
      if (appointments.length > 1) {
        return {
          pendingClarification: toJsonValue({ kind: "select_appointment_to_cancel", clientId: client.id }),
          execution: clarificationExecution("Какую запись отменить?", appointments.map((appointment) => ({
            label: `#${appointment.id} ${appointment.startAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })} ${appointment.services.map((item) => item.service.name).join(", ")}`,
            value: { type: "appointment", id: appointment.id } as Prisma.JsonObject,
          }))),
        };
      }
      appointmentId = appointments[0]?.id ?? null;
    }
  }
  if (!appointmentId) return { execution: clarificationExecution("Какую запись отменить? Укажите номер записи или выберите карточку.") };
  const tool = getCrmAgentTool("appointments.draftCancel");
  if (!tool || tool.mode !== "draft") return null;
  const args = { appointmentId, comment: "Cancelled by CRM assistant" };
  const result = await runDraftTool({ tool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
  const autopilot = await maybeExecuteAutopilotAction({ accountId: input.accountId, actionId: pendingActionIdFromResult(result), userId: input.userId, settings: input.autopilot });
  return {
    selectedEntity: { type: "appointment", id: appointmentId },
    execution: {
      selectedToolName: tool.name,
      toolResult: toJsonValue({ draft: result, autopilot }),
      answer: `Подготовил отмену записи #${appointmentId}. Проверьте и подтвердите действие.`,
      observations: [{ step: 1, toolName: tool.name, args, result: compactJsonValue(result), error: null }],
      autopilot,
    },
  };
}

async function executeReviewReplyFromText(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  if (!/\b(ответь|ответ|reply)\b/u.test(text) || !/\b(отзыв|review)\b/u.test(text)) return null;
  const selected = selectedCardFromState(input.threadState);
  const explicitId = input.message.match(/(?:отзыв\w*\s*)?[#№]\s*(\d+)/iu);
  const reviewId = selected?.type === "review" ? numericCardId(selected) : explicitId ? Number(explicitId[1]) : null;
  if (!reviewId) return { execution: clarificationExecution("На какой отзыв подготовить ответ? Укажите номер отзыва или выберите карточку.") };
  const replyMatch = input.message.match(/(?:текст|ответь|ответ)[:\s]+(.+)$/iu);
  const replyText = replyMatch?.[1]?.trim();
  if (!replyText || normalizeCrmText(replyText) === "на отзыв") return { execution: clarificationExecution("Какой текст ответа подготовить для отзыва?") };
  const tool = getCrmAgentTool("reviews.draftReply");
  if (!tool || tool.mode !== "draft") return null;
  const args = { reviewId, replyText };
  const result = await runDraftTool({ tool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
  const autopilot = await maybeExecuteAutopilotAction({ accountId: input.accountId, actionId: pendingActionIdFromResult(result), userId: input.userId, settings: input.autopilot });
  return {
    selectedEntity: { type: "review", id: reviewId },
    execution: {
      selectedToolName: tool.name,
      toolResult: toJsonValue({ draft: result, autopilot }),
      answer: `Подготовил ответ на отзыв #${reviewId}. Проверьте и подтвердите действие.`,
      observations: [{ step: 1, toolName: tool.name, args, result: compactJsonValue(result), error: null }],
      autopilot,
    },
  };
}

async function executeClientCreateFromText(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ContinuationExecution | null> {
  const text = normalizeCrmText(input.message);
  if (!/\b(создай|добавь|новый|нового)\b/u.test(text) || !/\b(клиент|клиентку)\b/u.test(text)) return null;
  const phone = input.message.match(/(?:\+?\d[\d\s().-]{7,}\d)/u)?.[0]?.replace(/[^\d+]/g, "");
  const email = input.message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0];
  const namePart = input.message
    .replace(/(?:создай|добавь|нового|новый|клиента|клиентку|клиент)/giu, " ")
    .replace(phone ?? "", " ")
    .replace(email ?? "", " ")
    .trim();
  const parts = namePart.split(/\s+/).filter((part) => /[A-Za-zА-Яа-яЁё]/u.test(part)).slice(0, 2);
  if (!parts.length && !phone && !email) return { execution: clarificationExecution("Какие данные клиента добавить: имя, телефон или email?") };
  const tool = getCrmAgentTool("clients.draftCreate");
  if (!tool || tool.mode !== "draft") return null;
  const args = {
    ...(parts[0] ? { firstName: parts[0] } : {}),
    ...(parts[1] ? { lastName: parts[1] } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
  const result = await runDraftTool({ tool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
  const autopilot = await maybeExecuteAutopilotAction({ accountId: input.accountId, actionId: pendingActionIdFromResult(result), userId: input.userId, settings: input.autopilot });
  return {
    execution: {
      selectedToolName: tool.name,
      toolResult: toJsonValue({ draft: result, autopilot }),
      answer: "Подготовил создание клиента. Проверьте и подтвердите действие.",
      observations: [{ step: 1, toolName: tool.name, args, result: compactJsonValue(result), error: null }],
      autopilot,
    },
  };
}

async function executeActionIntentFlow(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  actionIntent?: string | null;
  actionEntity?: { type: string | null; id: number | string | null } | null;
  scope: CrmAgentScope;
  threadState: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ToolExecution | null> {
  const intent = input.actionIntent;
  const entity = input.actionEntity;
  const entityId = numericEntityId(entity?.id);
  if (!intent || !entity?.type || entityId == null) return null;

  if ((intent === "find_slots" || intent === "show_schedule") && entity.type === "specialist") {
    const tool = getCrmAgentTool("appointments.findAvailableSlots");
    if (!tool || tool.mode !== "read") return null;
    const dateFrom = new Date();
    const dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + 14);
    const args = {
      specialistId: entityId,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      take: 60,
    };
    const result = await runReadTool({
      tool,
      args,
      scope: input.scope,
      accountId: input.accountId,
      runId: input.runId,
      threadId: input.threadId,
    });
    const resultObject = result && typeof result === "object" && !Array.isArray(result) ? result : null;
    const slots = Array.isArray(resultObject?.slots) ? resultObject.slots as Array<{ startAt?: string; endAt?: string; locationName?: string | null }> : [];
    const summary = daySlotsSummary(slots);
    const observation: CrmAgentLlmObservation = {
      step: 1,
      toolName: tool.name,
      args,
      result: compactJsonValue(result),
      error: null,
    };
    await appendCrmAgentMessage({
      threadId: input.threadId,
      role: "tool",
      content: JSON.stringify(observation),
    });
    return {
      selectedToolName: tool.name,
      toolResult: result,
      answer: slots.length
        ? `Нашёл свободные окна сотрудника #${entityId} на ближайшие 14 дней:\n${summary}\n\nМожно выбрать окно и подготовить запись.`
        : `У сотрудника #${entityId} на ближайшие 14 дней свободных окон не нашёл.`,
      observations: [observation],
    };
  }

  if (intent === "show_visits" && entity.type === "client") {
    const tool = getCrmAgentTool("appointments.search");
    if (!tool || tool.mode !== "read") return null;
    const args = { clientId: entityId, take: 10 };
    const result = await runReadTool({
      tool,
      args,
      scope: input.scope,
      accountId: input.accountId,
      runId: input.runId,
      threadId: input.threadId,
    });
    const resultObject = result && typeof result === "object" && !Array.isArray(result) ? result : null;
    const appointments = Array.isArray(resultObject?.appointments) ? resultObject.appointments : [];
    const observation: CrmAgentLlmObservation = {
      step: 1,
      toolName: tool.name,
      args,
      result: compactJsonValue(result),
      error: null,
    };
    await appendCrmAgentMessage({
      threadId: input.threadId,
      role: "tool",
      content: JSON.stringify(observation),
    });
    return {
      selectedToolName: tool.name,
      toolResult: result,
      answer: appointments.length ? `Нашёл записи клиента #${entityId}. Карточки ниже можно открыть или использовать для действий.` : `У клиента #${entityId} записей не нашёл.`,
      observations: [observation],
    };
  }

  if (intent === "create_appointment") {
    const fakeState = {
      ...(isRecordValue(input.threadState) ? input.threadState : {}),
      selectedEntity: { type: entity.type, id: entityId },
    };
    const execution = await executeAppointmentCreateFromText({
      accountId: input.accountId,
      userId: input.userId,
      runId: input.runId,
      threadId: input.threadId,
      message: entity.type === "slot" ? "запиши на первый слот" : `запиши ${entity.type} #${entityId}`,
      scope: input.scope,
      threadState: fakeState,
      autopilot: input.autopilot,
    });
    return execution?.execution ?? clarificationExecution("Для создания записи не хватает данных: клиент, услуга и время.");
  }

  if (intent === "send_message") {
    const fakeState = {
      ...(isRecordValue(input.threadState) ? input.threadState : {}),
      selectedEntity: { type: entity.type, id: entityId },
    };
    const execution = await executeNotificationSendFromText({
      accountId: input.accountId,
      userId: input.userId,
      runId: input.runId,
      threadId: input.threadId,
      message: `напиши ${entity.type} #${entityId}`,
      scope: input.scope,
      threadState: fakeState,
      autopilot: input.autopilot,
    });
    return execution?.execution ?? clarificationExecution("Какой текст отправить клиенту?");
  }

  if (intent === "reschedule_appointment" && entity.type === "appointment") {
    return clarificationExecution("На какую дату и время перенести эту запись?");
  }

  if (intent === "cancel_appointment" && entity.type === "appointment") {
    const tool = getCrmAgentTool("appointments.draftCancel");
    if (!tool || tool.mode !== "draft") return null;
    const args = { appointmentId: entityId, comment: "Cancelled by CRM assistant" };
    const result = await runDraftTool({ tool, args, scope: input.scope, accountId: input.accountId, runId: input.runId, threadId: input.threadId });
    return {
      selectedToolName: tool.name,
      toolResult: result,
      answer: `Подготовил отмену записи #${entityId}. Проверьте и подтвердите действие.`,
      observations: [{ step: 1, toolName: tool.name, args, result: compactJsonValue(result), error: null }],
    };
  }

  if (intent === "set_workday" && entity.type === "specialist") {
    return clarificationExecution("На какую дату и какое время поставить рабочий день?");
  }

  const editToolByIntent: Record<string, { toolName: string; idKey: string; entityType: string }> = {
    reply_review: { toolName: "reviews.draftReply", idKey: "reviewId", entityType: "review" },
    edit_service: { toolName: "services.draftUpdate", idKey: "serviceId", entityType: "service" },
    edit_location: { toolName: "locations.draftUpdate", idKey: "locationId", entityType: "location" },
    edit_promo: { toolName: "promos.draftUpdate", idKey: "promotionId", entityType: "promo" },
  };
  const edit = editToolByIntent[intent];
  if (edit && entity.type === edit.entityType) {
    if (intent === "reply_review") return clarificationExecution("Какой текст ответа подготовить для отзыва?");
    return clarificationExecution("Что именно изменить? Укажите новое название, цену, адрес, описание или статус.");
  }

  return null;
}

async function executeThreadContinuation(input: {
  accountId: number;
  userId: number;
  permissions: string[];
  resolution: CrmAgentContinuationResolution;
  pendingActions: Awaited<ReturnType<typeof listPendingActions>>;
}): Promise<ContinuationExecution | null> {
  if (input.resolution.kind === "none") return null;

  if (input.resolution.kind === "select_entity") {
    const entity = input.resolution.entity;
    const action = input.pendingActions[0] ?? null;
    const patchedPayload = action
      ? await applySelectedCardToPendingAction({
          accountId: input.accountId,
          action,
          card: input.resolution.card,
        })
      : null;
    if (patchedPayload) {
      return {
        selectedEntity: entity,
        pendingClarification: null,
        execution: {
          selectedToolName: null,
          toolResult: toJsonValue({
            continuation: {
              kind: input.resolution.kind,
              entity,
              confidence: input.resolution.confidence,
              reason: input.resolution.reason,
            },
            actionId: action?.id,
            payload: patchedPayload,
          }),
          answer: `Выбрано: ${input.resolution.card.title}. Обновил действие на подтверждение с этим вариантом, проверьте preview и подтвердите.`,
        },
      };
    }
    return {
      selectedEntity: entity,
      execution: {
        selectedToolName: null,
        toolResult: toJsonValue({
          continuation: {
            kind: input.resolution.kind,
            entity,
            confidence: input.resolution.confidence,
            reason: input.resolution.reason,
          },
        }),
        answer: `Выбрано: ${input.resolution.card.title}. Теперь можно продолжить действие с этой карточкой.`,
      },
    };
  }

  if (input.resolution.kind === "confirm_pending_action") {
    const action = await getPendingActionForAccount({ accountId: input.accountId, actionId: input.resolution.actionId });
    if (!action) {
      return {
        pendingClarification: { kind: "missing_pending_action", actionId: input.resolution.actionId },
        execution: {
          selectedToolName: null,
          toolResult: toJsonValue({ continuation: input.resolution }),
          answer: "Не нашел действие на подтверждение. Возможно, оно уже выполнено, отменено или истекло.",
        },
      };
    }
    if (action.permission && !input.permissions.includes("crm.all") && !input.permissions.includes(action.permission)) {
      return {
        pendingClarification: { kind: "forbidden_pending_action", actionId: action.id, permission: action.permission },
        execution: {
          selectedToolName: null,
          toolResult: toJsonValue({ continuation: input.resolution, permission: action.permission }),
          answer: `Недостаточно прав, чтобы подтвердить действие: ${action.permission}.`,
        },
      };
    }

    const confirmed = await confirmPendingAction({
      accountId: input.accountId,
      actionId: action.id,
      userId: input.userId,
    });
    if (!confirmed.count) {
      return {
        pendingClarification: { kind: "stale_pending_action", actionId: action.id },
        execution: {
          selectedToolName: null,
          toolResult: toJsonValue({ continuation: input.resolution }),
          answer: "Действие уже обработано или истекло. Проверьте актуальный список действий.",
        },
      };
    }

    await writeAgentAudit({
      accountId: input.accountId,
      userId: input.userId,
      action: "ai_agent.action.confirm",
      targetType: "ai_pending_action",
      targetId: String(action.id),
      data: { actionType: action.actionType, source: "thread_continuation" },
    });

    const executionResult = canExecuteCrmAgentAction(action.actionType)
      ? await executeConfirmedCrmAgentAction({
          accountId: input.accountId,
          actionId: action.id,
          userId: input.userId,
        })
      : null;

    return {
      execution: {
        selectedToolName: null,
        toolResult: toJsonValue({ continuation: input.resolution, action, execution: executionResult }),
        answer: executionResult ? "Подтвердил и выполнил действие." : "Подтвердил действие. Оно ожидает выполнения обработчиком.",
      },
    };
  }

  if (input.resolution.kind === "cancel_pending_action") {
    const action = await getPendingActionForAccount({ accountId: input.accountId, actionId: input.resolution.actionId });
    const rejected = await rejectPendingAction({ accountId: input.accountId, actionId: input.resolution.actionId });
    if (!rejected.count) {
      return {
        pendingClarification: { kind: "stale_pending_action", actionId: input.resolution.actionId },
        execution: {
          selectedToolName: null,
          toolResult: toJsonValue({ continuation: input.resolution }),
          answer: "Не удалось отменить действие: оно уже обработано или не найдено.",
        },
      };
    }
    await writeAgentAudit({
      accountId: input.accountId,
      userId: input.userId,
      action: "ai_agent.action.reject",
      targetType: "ai_pending_action",
      targetId: String(input.resolution.actionId),
      data: { actionType: action?.actionType ?? null, source: "thread_continuation" },
    });
    return {
      execution: {
        selectedToolName: null,
        toolResult: toJsonValue({ continuation: input.resolution, action }),
        answer: "Отменил действие на подтверждение.",
      },
    };
  }

  if (input.resolution.kind === "clarify") {
    return {
      pendingClarification: toJsonValue(input.resolution),
      execution: {
        selectedToolName: null,
        toolResult: toJsonValue({ continuation: input.resolution }),
        answer: input.resolution.options.length
          ? `${input.resolution.question}\n${input.resolution.options.map((option, index) => `${index + 1}. ${option.label}`).join("\n")}`
          : input.resolution.question,
      },
    };
  }

  if (input.resolution.kind === "correction") {
    const action = input.pendingActions[0] ?? null;
    if (action && isRecordValue(action.payload)) {
      const payload = { ...action.payload } as Prisma.JsonObject;
      const patch = input.resolution.patch;
      const time = typeof patch.time === "string" ? parseSingleTime(`в ${patch.time}`) : null;
      const date = typeof patch.dateHint === "string" ? parseRelativeScheduleDate(patch.dateHint) : null;
      if (typeof patch.location === "string" && patch.location === "another") {
        return {
          pendingClarification: toJsonValue(input.resolution),
          execution: clarificationExecution("Какую локацию выбрать вместо текущей?"),
        };
      }
      if ((action.actionType === "appointment.create" || action.actionType === "appointment.reschedule") && typeof payload.startAt === "string") {
        const currentStart = new Date(payload.startAt);
        const nextStart = date ? new Date(date) : new Date(currentStart);
        nextStart.setHours(time?.hour ?? currentStart.getHours(), time?.minute ?? currentStart.getMinutes(), 0, 0);
        const currentEnd = typeof payload.endAt === "string" ? new Date(payload.endAt) : null;
        const durationMin = currentEnd && !Number.isNaN(currentEnd.getTime()) ? Math.max(15, Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000)) : 60;
        payload.startAt = nextStart.toISOString();
        payload.endAt = addMinutes(nextStart, durationMin).toISOString();
      }
      if (action.actionType === "specialist.schedule.update") {
        if (date) payload.date = isoDateOnly(date);
        if (time) {
          const oldStart = typeof payload.startTime === "string" ? parseSingleTime(`в ${payload.startTime}`) : null;
          const oldEnd = typeof payload.endTime === "string" ? parseSingleTime(`в ${payload.endTime}`) : null;
          const duration = oldStart && oldEnd ? Math.max(1, (oldEnd.hour * 60 + oldEnd.minute) - (oldStart.hour * 60 + oldStart.minute)) : null;
          payload.startTime = time.label;
          if (duration) {
            const endMinutes = time.hour * 60 + time.minute + duration;
            payload.endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
          }
        }
      }
      await prisma.aiPendingAction.updateMany({
        where: { id: action.id, accountId: input.accountId, status: "PENDING" },
        data: { payload: payload as Prisma.InputJsonValue, summary: `${action.summary} (updated)` },
      });
      return {
        pendingClarification: null,
        execution: {
          selectedToolName: null,
          toolResult: toJsonValue({ continuation: input.resolution, actionId: action.id, payload }),
          answer: "Обновил действие на подтверждение с учётом правки. Проверьте preview и подтвердите, если всё верно.",
        },
      };
    }
    return {
      pendingClarification: toJsonValue(input.resolution),
      execution: {
        selectedToolName: null,
        toolResult: toJsonValue({ continuation: input.resolution }),
        answer: "Понял изменение, но для этого действия нужен следующий deterministic flow. Уточните объект, если он не выбран, или выберите карточку.",
      },
    };
  }

  return null;
}

async function executeSpecialistAvailabilityFlow(input: {
  accountId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
}): Promise<ToolExecution | null> {
  const query = extractSpecialistAvailabilityQuery(input.message);
  if (!query) return null;

  const specialistsTool = getCrmAgentTool("specialists.search");
  const slotsTool = getCrmAgentTool("appointments.findAvailableSlots");
  if (!specialistsTool || !slotsTool) return null;

  const specialistsResult = await runReadTool({
    tool: specialistsTool,
    args: { query, take: 5 },
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });
  await appendCrmAgentMessage({
    threadId: input.threadId,
    role: "tool",
    content: JSON.stringify({ step: 1, toolName: specialistsTool.name, args: { query, take: 5 }, result: compactJsonValue(specialistsResult) }),
  });

  const specialistsObject = specialistsResult && typeof specialistsResult === "object" && !Array.isArray(specialistsResult) ? specialistsResult : null;
  const specialists = Array.isArray(specialistsObject?.specialists) ? specialistsObject.specialists : [];
  const specialist = specialists.find((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "number");
  if (!specialist || typeof specialist !== "object" || Array.isArray(specialist) || typeof specialist.id !== "number") {
    return {
      selectedToolName: "specialists.search",
      toolResult: specialistsResult,
      answer: `Не нашёл сотрудника по запросу «${query}». Проверьте написание имени или выберите сотрудника из списка.`,
      observations: [{ step: 1, toolName: specialistsTool.name, args: { query, take: 5 }, result: compactJsonValue(specialistsResult), error: null }],
    };
  }

  const profile = "profile" in specialist && specialist.profile && typeof specialist.profile === "object" && !Array.isArray(specialist.profile) ? specialist.profile as { firstName?: string | null; lastName?: string | null } : {};
  const specialistName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || `сотрудника #${specialist.id}`;
  const dateFrom = new Date();
  const dateTo = new Date(dateFrom);
  dateTo.setDate(dateTo.getDate() + 7);
  const slotArgs = {
    specialistId: specialist.id,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    take: 60,
  };
  const slotsResult = await runReadTool({
    tool: slotsTool,
    args: slotArgs,
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });
  await appendCrmAgentMessage({
    threadId: input.threadId,
    role: "tool",
    content: JSON.stringify({ step: 2, toolName: slotsTool.name, args: slotArgs, result: compactJsonValue(slotsResult) }),
  });

  const slotsObject = slotsResult && typeof slotsResult === "object" && !Array.isArray(slotsResult) ? slotsResult : null;
  const slots = Array.isArray(slotsObject?.slots) ? slotsObject.slots as Array<{ startAt?: string; endAt?: string; locationName?: string | null }> : [];
  const summary = daySlotsSummary(slots);
  return {
    selectedToolName: "appointments.findAvailableSlots",
    toolResult: slotsResult,
    answer: slots.length
      ? `У ${specialistName} на ближайшие 7 дней есть такие свободные окна:\n${summary}\n\nЕсли нужно, подготовлю запись или сообщение клиенту под выбранное время.`
      : `У ${specialistName} на ближайшие 7 дней свободных окон не нашёл.`,
    observations: [
      { step: 1, toolName: specialistsTool.name, args: { query, take: 5 }, result: compactJsonValue(specialistsResult), error: null },
      { step: 2, toolName: slotsTool.name, args: slotArgs, result: compactJsonValue(slotsResult), error: null },
    ],
  };
}

async function executeScheduleWorkdayFlow(input: {
  accountId: number;
  userId: number;
  runId: number;
  threadId: number;
  message: string;
  scope: CrmAgentScope;
  threadState?: unknown;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}): Promise<ToolExecution | null> {
  const query = extractScheduleWorkdayQuery(input.message);
  const selected = selectedEntityFromState(input.threadState);
  const selectedSpecialistId = selected?.type === "specialist" ? selected.id : null;
  if (!query && !selectedSpecialistId) return null;

  const date = parseRelativeScheduleDate(input.message);
  if (!date) {
    return {
      selectedToolName: null,
      toolResult: null,
      answer: "Нашёл запрос на изменение графика. Укажите дату рабочего дня: сегодня, завтра, послезавтра или конкретную дату.",
    };
  }

  const specialistsTool = getCrmAgentTool("specialists.search");
  const scheduleTool = getCrmAgentTool("specialists.draftScheduleUpdate");
  if (!scheduleTool || scheduleTool.mode !== "draft" || (!selectedSpecialistId && !specialistsTool)) return null;

  if (selectedSpecialistId) {
    const specialist = await prisma.specialistProfile.findFirst({
      where: { id: selectedSpecialistId, accountId: input.accountId },
      select: {
        id: true,
        user: { select: { profile: { select: { firstName: true, lastName: true } } } },
        locations: { select: { location: { select: { id: true, name: true } } }, take: 5 },
      },
    });
    if (!specialist) {
      return { selectedToolName: null, toolResult: null, answer: "Не нашёл выбранного сотрудника в аккаунте." };
    }
    const specialistName = [specialist.user.profile?.firstName, specialist.user.profile?.lastName].filter(Boolean).join(" ").trim() || `сотрудник #${specialist.id}`;
    const firstLocation = specialist.locations[0]?.location ?? null;
    const timeRange = parseWorkTimeRange(input.message);
    const draftArgs = {
      specialistId: specialist.id,
      date: isoDateOnly(date),
      type: "WORKING",
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      ...(firstLocation ? { locationId: firstLocation.id } : {}),
      notes: "Создано CRM-ассистентом",
    };
    const draftResult = await runDraftTool({
      tool: scheduleTool,
      args: draftArgs,
      scope: input.scope,
      accountId: input.accountId,
      runId: input.runId,
      threadId: input.threadId,
    });
    const autopilot = await maybeExecuteAutopilotAction({
      accountId: input.accountId,
      actionId: pendingActionIdFromResult(draftResult),
      userId: input.userId,
      settings: input.autopilot,
    });
    return {
      selectedToolName: scheduleTool.name,
      toolResult: toJsonValue({ draft: draftResult, autopilot }),
      answer: `Подготовил черновик рабочего дня: ${specialistName}, ${date.toLocaleDateString("ru-RU")}, ${timeRange.startTime}-${timeRange.endTime}. Проверьте и подтвердите действие.`,
      observations: [{ step: 1, toolName: scheduleTool.name, args: draftArgs, result: compactJsonValue(draftResult), error: null }],
      autopilot,
    };
  }

  if (!specialistsTool) return null;

  const specialistsResult = await runReadTool({
    tool: specialistsTool,
    args: { query, take: 5 },
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });
  const searchObservation: CrmAgentLlmObservation = {
    step: 1,
    toolName: specialistsTool.name,
    args: { query, take: 5 },
    result: compactJsonValue(specialistsResult),
    error: null,
  };
  await appendCrmAgentMessage({
    threadId: input.threadId,
    role: "tool",
    content: JSON.stringify(searchObservation),
  });

  const specialistsObject = specialistsResult && typeof specialistsResult === "object" && !Array.isArray(specialistsResult) ? specialistsResult : null;
  const specialists = Array.isArray(specialistsObject?.specialists) ? specialistsObject.specialists : [];
  const specialist = specialists.find((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "number");
  if (!specialist || typeof specialist !== "object" || Array.isArray(specialist) || typeof specialist.id !== "number") {
    return {
      selectedToolName: specialistsTool.name,
      toolResult: specialistsResult,
      answer: `Не нашёл сотрудника по запросу «${query}». Проверьте имя или выберите сотрудника из списка.`,
      observations: [searchObservation],
    };
  }

  const profile = "profile" in specialist && specialist.profile && typeof specialist.profile === "object" && !Array.isArray(specialist.profile)
    ? specialist.profile as { firstName?: string | null; lastName?: string | null }
    : {};
  const specialistName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || `сотрудник #${specialist.id}`;
  const locations = "locations" in specialist && Array.isArray(specialist.locations) ? specialist.locations : [];
  const firstLocation = locations.find((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "number");
  const locationId = firstLocation && typeof firstLocation === "object" && !Array.isArray(firstLocation) && typeof firstLocation.id === "number" ? firstLocation.id : null;
  const locationName = firstLocation && typeof firstLocation === "object" && !Array.isArray(firstLocation) && typeof firstLocation.name === "string" ? firstLocation.name : null;
  const timeRange = parseWorkTimeRange(input.message);
  const draftArgs = {
    specialistId: specialist.id,
    date: isoDateOnly(date),
    type: "WORKING",
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
    ...(locationId != null ? { locationId } : {}),
    notes: "Создано CRM-ассистентом",
  };

  const draftResult = await runDraftTool({
    tool: scheduleTool,
    args: draftArgs,
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });
  const draftObservation: CrmAgentLlmObservation = {
    step: 2,
    toolName: scheduleTool.name,
    args: draftArgs,
    result: compactJsonValue(draftResult),
    error: null,
  };
  await appendCrmAgentMessage({
    threadId: input.threadId,
    role: "tool",
    content: JSON.stringify(draftObservation),
  });

  const autopilot = await maybeExecuteAutopilotAction({
    accountId: input.accountId,
    actionId: pendingActionIdFromResult(draftResult),
    userId: input.userId,
    settings: input.autopilot,
  });
  const dateLabel = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const locationText = locationName ? `, локация: ${locationName}` : "";
  const defaultText = timeRange.defaulted ? " Время взял по умолчанию; его можно изменить перед подтверждением." : "";

  return {
    selectedToolName: scheduleTool.name,
    toolResult: toJsonValue({ draft: draftResult, autopilot }),
    answer: `Подготовил черновик рабочего дня: ${specialistName}, ${dateLabel}, ${timeRange.startTime}-${timeRange.endTime}${locationText}.${defaultText} Проверьте и подтвердите действие справа.`,
    observations: [searchObservation, draftObservation],
    autopilot,
  };
}

export async function runCrmAgentChat(input: RunCrmAgentChatInput) {
  const scope: CrmAgentScope = {
    accountId: input.accountId,
    userId: input.userId,
    permissions: input.permissions,
    threadId: input.threadId,
    runId: input.runId,
  };
  const context = await buildCrmAgentAccountContext({
    accountId: input.accountId,
    userId: input.userId,
    permissions: input.permissions,
  });
  const tools = listCrmAgentToolsForPermissions(input.permissions);
  const conversationHistory = await loadConversationHistory({
    accountId: input.accountId,
    threadId: input.threadId,
    currentMessage: input.message,
  });
  const [storedThreadState, initialPendingActions] = await Promise.all([
    getCrmAgentThreadState({ accountId: input.accountId, threadId: input.threadId }),
    listPendingActions({ accountId: input.accountId, threadId: input.threadId, take: 20 }),
  ]);

  let execution: ToolExecution;
  let continuationExecution: ContinuationExecution | null = null;
  let llmStatus: Prisma.JsonObject = { used: false };

  try {
    const continuation = input.requestedToolName || input.actionIntent
      ? { kind: "none" as const, confidence: 0 }
      : resolveThreadContinuation({
          message: input.message,
          threadState: storedThreadState?.state ?? null,
          pendingActions: initialPendingActions,
        });
    continuationExecution = await executeThreadContinuation({
      accountId: input.accountId,
      userId: input.userId,
      permissions: input.permissions,
      resolution: continuation,
      pendingActions: initialPendingActions,
    });
    const actionIntentFlow = continuationExecution || input.requestedToolName ? null : await executeActionIntentFlow({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const appointmentLookup = continuationExecution || actionIntentFlow || input.requestedToolName
      ? null
      : await executeAppointmentLookupFromText({ ...input, scope, threadState: storedThreadState?.state ?? null });
    const appointmentCreate = continuationExecution || actionIntentFlow || appointmentLookup || input.requestedToolName
      ? null
      : await executeAppointmentCreateFromText({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const appointmentReschedule = continuationExecution || actionIntentFlow || appointmentCreate || input.requestedToolName
      ? null
      : await executeAppointmentRescheduleFromText({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const notificationSend = continuationExecution || actionIntentFlow || appointmentCreate || appointmentReschedule || input.requestedToolName
      ? null
      : await executeNotificationSendFromText({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const entityEdit = continuationExecution || actionIntentFlow || appointmentCreate || appointmentReschedule || notificationSend || input.requestedToolName
      ? null
      : await executeEntityEditFromText({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const appointmentCancel = continuationExecution || actionIntentFlow || appointmentCreate || appointmentReschedule || notificationSend || entityEdit || input.requestedToolName
      ? null
      : await executeAppointmentCancelFromText({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const reviewReply = continuationExecution || actionIntentFlow || appointmentCreate || appointmentReschedule || notificationSend || entityEdit || appointmentCancel || input.requestedToolName
      ? null
      : await executeReviewReplyFromText({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const clientCreate = continuationExecution || actionIntentFlow || appointmentCreate || appointmentReschedule || notificationSend || entityEdit || appointmentCancel || reviewReply || input.requestedToolName
      ? null
      : await executeClientCreateFromText({ ...input, scope, autopilot: context.autopilot });
    const scheduleWorkday = continuationExecution || actionIntentFlow || appointmentCreate || appointmentReschedule || notificationSend || entityEdit || appointmentCancel || reviewReply || clientCreate || input.requestedToolName ? null : await executeScheduleWorkdayFlow({ ...input, scope, threadState: storedThreadState?.state ?? null, autopilot: context.autopilot });
    const specialistAvailability = continuationExecution || actionIntentFlow || appointmentCreate || appointmentReschedule || notificationSend || entityEdit || appointmentCancel || reviewReply || clientCreate || scheduleWorkday || input.requestedToolName ? null : await executeSpecialistAvailabilityFlow({ ...input, scope });
    if (continuationExecution) {
      execution = continuationExecution.execution;
      llmStatus = { used: false, mode: "thread_continuation", continuationKind: continuation.kind, confidence: continuation.confidence };
    } else if (actionIntentFlow) {
      execution = actionIntentFlow;
      llmStatus = { used: false, mode: "deterministic_action_intent", actionIntent: input.actionIntent ?? null };
    } else if (appointmentLookup) {
      continuationExecution = appointmentLookup;
      execution = appointmentLookup.execution;
      llmStatus = { used: false, mode: "deterministic_appointment_lookup" };
    } else if (appointmentCreate) {
      continuationExecution = appointmentCreate;
      execution = appointmentCreate.execution;
      llmStatus = { used: false, mode: "deterministic_appointment_create" };
    } else if (appointmentReschedule) {
      continuationExecution = appointmentReschedule;
      execution = appointmentReschedule.execution;
      llmStatus = { used: false, mode: "deterministic_appointment_reschedule" };
    } else if (notificationSend) {
      continuationExecution = notificationSend;
      execution = notificationSend.execution;
      llmStatus = { used: false, mode: "deterministic_notification_send" };
    } else if (entityEdit) {
      continuationExecution = entityEdit;
      execution = entityEdit.execution;
      llmStatus = { used: false, mode: "deterministic_entity_edit" };
    } else if (appointmentCancel) {
      continuationExecution = appointmentCancel;
      execution = appointmentCancel.execution;
      llmStatus = { used: false, mode: "deterministic_appointment_cancel" };
    } else if (reviewReply) {
      continuationExecution = reviewReply;
      execution = reviewReply.execution;
      llmStatus = { used: false, mode: "deterministic_review_reply" };
    } else if (clientCreate) {
      continuationExecution = clientCreate;
      execution = clientCreate.execution;
      llmStatus = { used: false, mode: "deterministic_client_create" };
    } else if (scheduleWorkday) {
      execution = scheduleWorkday;
      llmStatus = { used: false, mode: "deterministic_schedule_workday" };
    } else if (specialistAvailability) {
      execution = specialistAvailability;
      llmStatus = { used: false, mode: "deterministic_specialist_availability" };
    } else if (input.requestedToolName) {
      execution = await executeDeterministicFallback({ ...input, scope });
    } else {
      const loop = await executeLlmToolLoop({
        accountId: input.accountId,
        userId: input.userId,
        permissions: input.permissions,
        runId: input.runId,
        threadId: input.threadId,
        message: input.message,
        context,
        tools,
        scope,
        conversationHistory,
      });

      if (loop.ok) {
        llmStatus = {
          used: true,
          ok: true,
          model: loop.model,
          mode: "tool_loop",
          steps: loop.execution.observations?.length ?? 0,
        };
        execution = loop.execution;
      } else {
        llmStatus = { used: true, ok: false, error: loop.error, model: loop.model, mode: "tool_loop" };
        execution = await executeDeterministicFallback({ ...input, scope });
      }
    }

    const actionIntentSelectedEntity =
      input.actionEntity?.type && input.actionEntity.id != null
        ? { type: input.actionEntity.type as "client" | "specialist" | "service" | "location" | "appointment" | "review" | "promo" | "slot", id: input.actionEntity.id }
        : null;
    const structured = buildCrmAgentStructuredResponse({
      selectedToolName: execution.selectedToolName,
      toolResult: execution.toolResult,
      toolSteps: execution.observations ?? [],
      previousThreadState: storedThreadState?.state ?? null,
      selectedEntity: continuationExecution?.selectedEntity ?? actionIntentSelectedEntity,
      pendingClarification: continuationExecution?.pendingClarification ?? null,
    });
    const groundedAnswer = buildCrmAgentGroundedAnswer({
      selectedToolName: execution.selectedToolName,
      toolResult: execution.toolResult,
      cards: structured.cards,
    });
    const answer = groundedAnswer ?? execution.answer;

    await updateCrmAgentThreadState({
      threadId: input.threadId,
      state: structured.threadState as Prisma.InputJsonValue,
    });

    await appendCrmAgentMessage({
      threadId: input.threadId,
      role: "assistant",
      content: answer,
    });
    await finishAgentRun({
      accountId: input.accountId,
      runId: input.runId,
      output: toJsonValue({
        answer,
        selectedToolName: execution.selectedToolName,
        toolSteps: execution.observations ?? [],
        entities: structured.entities,
        cards: structured.cards,
        suggestedActions: structured.suggestedActions,
        clarification: structured.clarification,
        threadState: structured.threadState,
        llm: llmStatus,
        autopilot: {
          settings: context.autopilot,
          execution: execution.autopilot ?? null,
        },
      }) as Prisma.InputJsonValue,
    });

    const pendingActions = await listPendingActions({
      accountId: input.accountId,
      threadId: input.threadId,
      take: 20,
    });

    return {
      answer,
      context,
      selectedToolName: execution.selectedToolName,
      toolResult: execution.toolResult,
      toolSteps: execution.observations ?? [],
      entities: structured.entities,
      cards: structured.cards,
      suggestedActions: structured.suggestedActions,
      clarification: structured.clarification,
      threadState: structured.threadState,
      tools,
      pendingActions,
      llm: llmStatus,
      autopilot: {
        settings: context.autopilot,
        execution: execution.autopilot ?? null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить запрос ассистента.";
    await finishAgentRun({
      accountId: input.accountId,
      runId: input.runId,
      error: message,
      output: { message: input.message } as Prisma.InputJsonValue,
    });
    await appendCrmAgentMessage({
      threadId: input.threadId,
      role: "assistant",
      content: "Не удалось выполнить запрос ассистента. Проверьте права доступа или параметры действия.",
    });
    throw error;
  }
}
