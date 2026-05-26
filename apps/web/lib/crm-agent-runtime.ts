import type { Prisma } from "@prisma/client";
import { executeCrmAgentReadTool } from "@/lib/crm-agent-domain-tools";
import type { CrmAgentLlmObservation } from "@/lib/crm-agent-llm-contract";
import type { CrmAgentScope } from "@/lib/crm-agent-types";
import { getCrmAgentTool } from "@/lib/crm-agent-tool-registry";

export type CrmAgentGoal = {
  intent: "read" | "analyze" | "create" | "update" | "delete" | "notify";
  domain:
    | "appointments"
    | "clients"
    | "services"
    | "specialists"
    | "locations"
    | "schedule"
    | "promos"
    | "reviews"
    | "notifications"
    | "site"
    | "analytics";
  toolName: string;
  constraints: Prisma.JsonObject;
  missing: string[];
  confidence: number;
};

export type CrmAgentPlanStep = {
  type: "tool";
  toolName: string;
  args: Prisma.JsonObject;
  reason: string;
  requiresConfirmation: boolean;
};

export type CrmAgentPlan = {
  goalId: string;
  steps: CrmAgentPlanStep[];
};

export type CrmAgentActiveTask = {
  goal: CrmAgentGoal;
  plan: CrmAgentPlan;
  completedSteps: Array<{ toolName: string; ok: boolean }>;
  missing: string[];
  candidates: Prisma.JsonValue | null;
  selectedEntities: Prisma.JsonObject;
  pendingActionId: number | null;
  status: "completed" | "needs_clarification" | "failed";
  updatedAt: string;
};

export type CrmAgentRuntimeResult = {
  execution: {
    selectedToolName: string | null;
    toolResult: Prisma.JsonValue | null;
    answer: string;
    observations: CrmAgentLlmObservation[];
  };
  activeTask: CrmAgentActiveTask;
  pendingClarification?: Prisma.JsonValue | null;
  trace: Prisma.JsonObject;
};

export type CrmAgentRuntimeTaskSource = "runtime" | "legacy_skill";

function toJsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function compactJsonValue(value: unknown, maxLength = 5000): Prisma.JsonValue {
  const json = toJsonValue(value);
  const text = JSON.stringify(json);
  if (text.length <= maxLength) return json;
  return { truncated: true, originalLength: text.length, preview: text.slice(0, maxLength) };
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}:.\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseDateRange(message: string) {
  const text = normalizeText(message);
  const today = startOfDay(new Date());
  if (/\bсегодня\b/u.test(text) && /\bзавтра\b/u.test(text)) return { dateFrom: today, dateTo: addDays(today, 1), label: "за сегодня и завтра" };
  if (/\bсегодня\b/u.test(text)) return { dateFrom: today, dateTo: today, label: "за сегодня" };
  if (/\bвчера\b/u.test(text)) {
    const date = addDays(today, -1);
    return { dateFrom: date, dateTo: date, label: "за вчера" };
  }
  if (/\bзавтра\b/u.test(text)) {
    const date = addDays(today, 1);
    return { dateFrom: date, dateTo: date, label: "на завтра" };
  }
  if (/\b(прошл|последн)\w*\s+недел|\bнедел[юеи]\b/u.test(text)) return { dateFrom: addDays(today, -7), dateTo: today, label: "за последнюю неделю" };
  const numeric = text.match(/\b(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?\b/u);
  if (numeric) {
    const rawYear = numeric[3] ? Number(numeric[3]) : today.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = startOfDay(new Date(year, Number(numeric[2]) - 1, Number(numeric[1])));
    if (!Number.isNaN(date.getTime())) return { dateFrom: date, dateTo: date, label: `за ${date.toLocaleDateString("ru-RU")}` };
  }
  return null;
}

function searchQuery(message: string, stopWords: RegExp) {
  return normalizeText(message)
    .replace(stopWords, " ")
    .replace(/\b(найди|покажи|какие|какая|какой|список|все|есть|по|про|мне|давай)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function goalId(goal: CrmAgentGoal) {
  return `${goal.intent}:${goal.domain}:${goal.toolName}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function planFromGoal(goal: CrmAgentGoal): CrmAgentPlan {
  return {
    goalId: goalId(goal),
    steps: [
      {
        type: "tool",
        toolName: goal.toolName,
        args: goal.constraints,
        reason: goal.intent === "read" || goal.intent === "analyze" ? `Read ${goal.domain} data for the user goal.` : `Prepare ${goal.domain} draft action for confirmation.`,
        requiresConfirmation: goal.intent !== "read" && goal.intent !== "analyze",
      },
    ],
  };
}

export function understandCrmAgentWriteGoal(message: string, threadState?: unknown): CrmAgentGoal | null {
  const text = normalizeText(message);
  const selected = isRecord(threadState) && isRecord(threadState.selectedEntity) ? threadState.selectedEntity : null;
  const selectedType = typeof selected?.type === "string" ? selected.type : null;
  const selectedConstraint = selected ? { selectedEntity: selected as Prisma.JsonObject } : {};

  if (/\b(запиш|создай\s+запис|забронируй)\b/u.test(text)) {
    return { intent: "create", domain: "appointments", toolName: "appointments.draftCreate", constraints: { source: "message", ...selectedConstraint }, missing: [], confidence: 0.82 };
  }
  if (/\b(перенес|перенести|передвин)\b/u.test(text)) {
    return { intent: "update", domain: "appointments", toolName: "appointments.draftReschedule", constraints: { source: "message", ...selectedConstraint }, missing: [], confidence: 0.82 };
  }
  if (/\b(отмени|отменить|сними|удали)\b/u.test(text) && /\b(запис|визит|брон)\b/u.test(text)) {
    return { intent: "delete", domain: "appointments", toolName: "appointments.draftCancel", constraints: { source: "message", ...selectedConstraint }, missing: [], confidence: 0.82 };
  }
  if (/\b(напиш|отправ|сообщ|предложи|напомни)\b/u.test(text)) {
    return { intent: "notify", domain: "notifications", toolName: "notifications.draftSend", constraints: { source: "message", ...selectedConstraint }, missing: [], confidence: 0.78 };
  }
  if (/\b(ответь|ответ|reply)\b/u.test(text) && /\b(отзыв|review)\b/u.test(text)) {
    return { intent: "create", domain: "reviews", toolName: "reviews.draftReply", constraints: { source: "message", ...selectedConstraint }, missing: [], confidence: 0.8 };
  }
  if (/\b(создай|добавь|новый|нового)\b/u.test(text) && /\b(клиент|клиентк)\b/u.test(text)) {
    return { intent: "create", domain: "clients", toolName: "clients.draftCreate", constraints: { source: "message" }, missing: [], confidence: 0.78 };
  }
  if (/\b(измени|обнови|поменяй|цена|стоимость|прайс|адрес|телефон|описание|название|био|скрой|опубликуй|актив|неактив|публичн)\b/u.test(text)) {
    const toolName =
      selectedType === "service" ? "services.draftUpdate"
      : selectedType === "location" ? "locations.draftUpdate"
      : selectedType === "promo" ? "promos.draftUpdate"
      : selectedType === "specialist" ? "specialists.draftUpdate"
      : null;
    if (toolName) {
      const domain = selectedType === "location" ? "locations" : selectedType === "promo" ? "promos" : selectedType === "specialist" ? "specialists" : "services";
      return { intent: "update", domain, toolName, constraints: { source: "message", ...selectedConstraint }, missing: [], confidence: 0.78 };
    }
  }
  return null;
}

function goalFromToolName(toolName: string, message: string, threadState?: unknown): CrmAgentGoal | null {
  const writeGoal = understandCrmAgentWriteGoal(message, threadState);
  if (writeGoal?.toolName === toolName) return writeGoal;

  const byToolName: Record<string, Pick<CrmAgentGoal, "intent" | "domain">> = {
    "appointments.draftCreate": { intent: "create", domain: "appointments" },
    "appointments.draftReschedule": { intent: "update", domain: "appointments" },
    "appointments.draftCancel": { intent: "delete", domain: "appointments" },
    "notifications.draftSend": { intent: "notify", domain: "notifications" },
    "reviews.draftReply": { intent: "create", domain: "reviews" },
    "clients.draftCreate": { intent: "create", domain: "clients" },
    "services.draftUpdate": { intent: "update", domain: "services" },
    "locations.draftUpdate": { intent: "update", domain: "locations" },
    "promos.draftUpdate": { intent: "update", domain: "promos" },
    "specialists.draftUpdate": { intent: "update", domain: "specialists" },
    "specialists.draftScheduleUpdate": { intent: "update", domain: "schedule" },
  };
  const mapped = byToolName[toolName];
  if (!mapped) return null;
  return {
    intent: mapped.intent,
    domain: mapped.domain,
    toolName,
    constraints: { source: "legacy_skill" },
    missing: [],
    confidence: 0.75,
  };
}

function goalFromExecutionInput(toolName: string | null, message: string, threadState?: unknown): CrmAgentGoal | null {
  if (toolName) return goalFromToolName(toolName, message, threadState);
  return understandCrmAgentWriteGoal(message, threadState);
}

function pendingActionIdFromToolResult(result: Prisma.JsonValue | null): number | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const object = result as Record<string, unknown>;
  if (typeof object.pendingActionId === "number") return object.pendingActionId;
  const draft = object.draft;
  if (isRecord(draft) && typeof draft.pendingActionId === "number") return draft.pendingActionId;
  return null;
}

function clarificationQuestion(result: Prisma.JsonValue | null) {
  if (!isRecord(result) || !isRecord(result.clarification)) return "";
  return typeof result.clarification.question === "string" ? normalizeText(result.clarification.question) : "";
}

function numberFromRecord(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringFromRecord(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstObservationArgs(observations?: CrmAgentLlmObservation[]) {
  const args = observations?.find((observation) => isRecord(observation.args))?.args;
  return isRecord(args) ? args : null;
}

function selectedEntitiesFromDraftArgs(toolName: string, args: Record<string, unknown> | null, selectedEntity?: { type: string; id: number | string } | null): Prisma.JsonObject {
  const selectedEntities: Prisma.JsonObject = selectedEntity ? { [selectedEntity.type]: selectedEntity.id } : {};
  if (!args) return selectedEntities;

  if (toolName === "appointments.draftCreate") {
    const clientId = numberFromRecord(args, "clientId");
    const serviceId = numberFromRecord(args, "serviceId");
    const specialistId = numberFromRecord(args, "specialistId");
    const locationId = numberFromRecord(args, "locationId");
    if (clientId != null) selectedEntities.client = clientId;
    if (serviceId != null) selectedEntities.service = serviceId;
    if (specialistId != null) selectedEntities.specialist = specialistId;
    if (locationId != null) selectedEntities.location = locationId;
    if (stringFromRecord(args, "startAt")) selectedEntities.slot = stringFromRecord(args, "startAt");
  }

  if (toolName === "appointments.draftReschedule") {
    const appointmentId = numberFromRecord(args, "appointmentId");
    const specialistId = numberFromRecord(args, "specialistId");
    const locationId = numberFromRecord(args, "locationId");
    if (appointmentId != null) selectedEntities.appointment = appointmentId;
    if (specialistId != null) selectedEntities.specialist = specialistId;
    if (locationId != null) selectedEntities.location = locationId;
    if (stringFromRecord(args, "startAt")) selectedEntities.slot = stringFromRecord(args, "startAt");
  }

  if (toolName === "appointments.draftCancel") {
    const appointmentId = numberFromRecord(args, "appointmentId");
    if (appointmentId != null) selectedEntities.appointment = appointmentId;
  }

  if (toolName === "notifications.draftSend") {
    const clientId = numberFromRecord(args, "clientId");
    if (clientId != null) selectedEntities.client = clientId;
    if (stringFromRecord(args, "channel")) selectedEntities.channel = stringFromRecord(args, "channel");
  }

  if (toolName === "reviews.draftReply") {
    const reviewId = numberFromRecord(args, "reviewId");
    if (reviewId != null) selectedEntities.review = reviewId;
  }

  if (toolName === "services.draftUpdate") {
    const serviceId = numberFromRecord(args, "serviceId");
    if (serviceId != null) selectedEntities.service = serviceId;
  }

  if (toolName === "locations.draftUpdate") {
    const locationId = numberFromRecord(args, "locationId");
    if (locationId != null) selectedEntities.location = locationId;
  }

  if (toolName === "promos.draftUpdate") {
    const promotionId = numberFromRecord(args, "promotionId");
    if (promotionId != null) selectedEntities.promo = promotionId;
  }

  if (toolName === "specialists.draftUpdate") {
    const specialistId = numberFromRecord(args, "specialistId");
    if (specialistId != null) selectedEntities.specialist = specialistId;
  }

  return selectedEntities;
}

function missingForDraftTool(toolName: string, args: Record<string, unknown> | null) {
  if (!args) return [];
  const requiredByTool: Record<string, string[]> = {
    "appointments.draftCreate": ["clientId", "serviceId", "specialistId", "locationId", "startAt"],
    "appointments.draftReschedule": ["appointmentId", "startAt"],
    "appointments.draftCancel": ["appointmentId"],
    "notifications.draftSend": ["clientId", "channel", "bodyText"],
    "reviews.draftReply": ["reviewId", "replyText"],
    "services.draftUpdate": ["serviceId"],
    "locations.draftUpdate": ["locationId"],
    "promos.draftUpdate": ["promotionId"],
    "specialists.draftUpdate": ["specialistId"],
    "clients.draftCreate": [],
  };
  return (requiredByTool[toolName] ?? []).filter((key) => args[key] == null || args[key] === "");
}

function missingFromClarification(toolName: string, result: Prisma.JsonValue | null) {
  const question = clarificationQuestion(result);
  if (!question) return [];

  if (toolName === "appointments.draftCreate") {
    if (/\b(клиент|клиента|клиенту)\b/u.test(question)) return ["clientId"];
    if (/\b(услуг|услугу|услуга)\b/u.test(question)) return ["serviceId"];
    if (/\b(сотрудник|сотруднику|мастер|специалист)\b/u.test(question)) return ["specialistId"];
    if (/\b(локац|локации|филиал)\b/u.test(question)) return ["locationId"];
    if (/\b(время|дату|окно)\b/u.test(question)) return ["startAt"];
  }
  if (toolName === "appointments.draftReschedule") {
    if (/\b(запись|записи)\b/u.test(question)) return ["appointmentId"];
    if (/\b(время|дату|окно)\b/u.test(question)) return ["startAt"];
  }
  if (toolName === "notifications.draftSend") {
    if (/\b(клиент|клиенту)\b/u.test(question)) return ["clientId"];
    if (/\b(текст|сообщение)\b/u.test(question)) return ["message"];
  }
  if (toolName === "reviews.draftReply" && /\b(отзыв|ответ|текст)\b/u.test(question)) return ["reviewId", "replyText"];
  if (toolName === "services.draftUpdate" && question) return ["serviceField"];
  if (toolName === "locations.draftUpdate" && question) return ["locationField"];
  if (toolName === "promos.draftUpdate" && question) return ["promoField"];
  if (toolName === "specialists.draftUpdate" && question) return ["specialistField"];
  return [];
}

function normalizeMissingFields(toolName: string, fields: string[]) {
  if (toolName !== "notifications.draftSend") return fields;
  return fields.map((field) => field === "message" ? "bodyText" : field);
}

function planFromExecution(goal: CrmAgentGoal, args: Record<string, unknown> | null): CrmAgentPlan {
  const draftStep = (reason: string): CrmAgentPlanStep => ({
    type: "tool",
    toolName: goal.toolName,
    args: args ? toJsonValue(args) as Prisma.JsonObject : goal.constraints,
    reason,
    requiresConfirmation: true,
  });

  if (goal.toolName === "appointments.draftCreate") {
    const steps: CrmAgentPlanStep[] = [
      { type: "tool", toolName: "clients.search", args: args?.clientId != null ? { selectedId: args.clientId as Prisma.JsonValue } : {}, reason: "Resolve the client for the appointment.", requiresConfirmation: false },
      { type: "tool", toolName: "services.search", args: args?.serviceId != null ? { selectedId: args.serviceId as Prisma.JsonValue } : {}, reason: "Resolve the service for the appointment.", requiresConfirmation: false },
      { type: "tool", toolName: "specialists.search", args: args?.specialistId != null ? { selectedId: args.specialistId as Prisma.JsonValue } : {}, reason: "Resolve the specialist for the appointment.", requiresConfirmation: false },
      { type: "tool", toolName: "appointments.findAvailableSlots", args: args?.startAt != null ? { selectedStartAt: args.startAt as Prisma.JsonValue } : {}, reason: "Resolve and validate the appointment time.", requiresConfirmation: false },
      draftStep("Prepare the appointment draft for confirmation."),
    ];
    return { goalId: goalId(goal), steps };
  }

  if (goal.toolName === "appointments.draftReschedule") {
    return {
      goalId: goalId(goal),
      steps: [
        { type: "tool", toolName: "appointments.search", args: args?.appointmentId != null ? { selectedId: args.appointmentId as Prisma.JsonValue } : {}, reason: "Resolve the appointment to reschedule.", requiresConfirmation: false },
        { type: "tool", toolName: "appointments.findAvailableSlots", args: args?.startAt != null ? { selectedStartAt: args.startAt as Prisma.JsonValue } : {}, reason: "Resolve and validate the new time.", requiresConfirmation: false },
        draftStep("Prepare the reschedule draft for confirmation."),
      ],
    };
  }

  if (goal.toolName === "appointments.draftCancel") {
    return {
      goalId: goalId(goal),
      steps: [
        { type: "tool", toolName: "appointments.search", args: args?.appointmentId != null ? { selectedId: args.appointmentId as Prisma.JsonValue } : {}, reason: "Resolve the appointment to cancel.", requiresConfirmation: false },
        draftStep("Prepare the cancellation draft for confirmation."),
      ],
    };
  }

  if (goal.toolName === "notifications.draftSend") {
    return {
      goalId: goalId(goal),
      steps: [
        { type: "tool", toolName: "clients.search", args: args?.clientId != null ? { selectedId: args.clientId as Prisma.JsonValue } : {}, reason: "Resolve the notification recipient.", requiresConfirmation: false },
        draftStep("Prepare the notification draft for confirmation."),
      ],
    };
  }

  if (goal.toolName === "reviews.draftReply") {
    return {
      goalId: goalId(goal),
      steps: [
        { type: "tool", toolName: "reviews.search", args: args?.reviewId != null ? { selectedId: args.reviewId as Prisma.JsonValue } : {}, reason: "Resolve the review to answer.", requiresConfirmation: false },
        draftStep("Prepare the review reply draft for confirmation."),
      ],
    };
  }

  const updateSearchSteps: Record<string, { readTool: string; idKey: string; reason: string; draftReason: string }> = {
    "services.draftUpdate": { readTool: "services.search", idKey: "serviceId", reason: "Resolve the service to update.", draftReason: "Prepare the service update draft for confirmation." },
    "locations.draftUpdate": { readTool: "locations.search", idKey: "locationId", reason: "Resolve the location to update.", draftReason: "Prepare the location update draft for confirmation." },
    "promos.draftUpdate": { readTool: "promos.search", idKey: "promotionId", reason: "Resolve the promotion to update.", draftReason: "Prepare the promotion update draft for confirmation." },
    "specialists.draftUpdate": { readTool: "specialists.search", idKey: "specialistId", reason: "Resolve the specialist to update.", draftReason: "Prepare the specialist update draft for confirmation." },
  };
  const updateStep = updateSearchSteps[goal.toolName];
  if (updateStep) {
    return {
      goalId: goalId(goal),
      steps: [
        { type: "tool", toolName: updateStep.readTool, args: args?.[updateStep.idKey] != null ? { selectedId: args[updateStep.idKey] as Prisma.JsonValue } : {}, reason: updateStep.reason, requiresConfirmation: false },
        draftStep(updateStep.draftReason),
      ],
    };
  }

  return planFromGoal(goal);
}

export function buildCrmAgentActiveTaskFromExecution(input: {
  message: string;
  threadState?: unknown;
  selectedToolName: string | null;
  toolResult: Prisma.JsonValue | null;
  observations?: CrmAgentLlmObservation[];
  selectedEntity?: { type: string; id: number | string } | null;
  source: CrmAgentRuntimeTaskSource;
}): CrmAgentActiveTask | null {
  const baseGoal = goalFromExecutionInput(input.selectedToolName, input.message, input.threadState);
  const goal = baseGoal ? { ...baseGoal, constraints: { ...baseGoal.constraints, runtimeSource: input.source } } : null;
  if (!goal || (goal.intent === "read" || goal.intent === "analyze")) return null;

  const toolName = input.selectedToolName ?? goal.toolName;
  const draftArgs = firstObservationArgs(input.observations);
  const plan = planFromExecution(goal, draftArgs);
  const completedSteps = input.observations?.length
    ? input.observations.map((observation) => ({ toolName: observation.toolName, ok: !observation.error }))
    : [{ toolName: input.selectedToolName ?? "clarification", ok: input.toolResult != null }];
  const selectedEntities = selectedEntitiesFromDraftArgs(toolName, draftArgs, input.selectedEntity);
  const missing = missingForDraftTool(toolName, draftArgs);
  const clarificationMissing = missingFromClarification(toolName, input.toolResult);
  const effectiveMissing = normalizeMissingFields(toolName, missing.length ? missing : clarificationMissing.length ? clarificationMissing : goal.missing);

  return {
    goal,
    plan,
    completedSteps,
    missing: effectiveMissing,
    candidates: input.toolResult ? compactJsonValue(input.toolResult) : null,
    selectedEntities,
    pendingActionId: pendingActionIdFromToolResult(input.toolResult),
    status: effectiveMissing.length ? "needs_clarification" : input.toolResult ? "completed" : "failed",
    updatedAt: new Date().toISOString(),
  };
}

function activeTaskFromThreadState(threadState: unknown): CrmAgentActiveTask | null {
  if (!isRecord(threadState) || !isRecord(threadState.activeTask)) return null;
  const task = threadState.activeTask;
  if (!isRecord(task.goal) || !isRecord(task.plan)) return null;
  if (typeof task.status !== "string" || typeof task.updatedAt !== "string") return null;
  return {
    goal: task.goal as CrmAgentGoal,
    plan: task.plan as CrmAgentPlan,
    completedSteps: Array.isArray(task.completedSteps) ? task.completedSteps.filter(isRecord).map((step) => ({
      toolName: typeof step.toolName === "string" ? step.toolName : "unknown",
      ok: step.ok !== false,
    })) : [],
    missing: Array.isArray(task.missing) ? task.missing.filter((item): item is string => typeof item === "string") : [],
    candidates: (task.candidates ?? null) as Prisma.JsonValue | null,
    selectedEntities: isRecord(task.selectedEntities) ? task.selectedEntities as Prisma.JsonObject : {},
    pendingActionId: typeof task.pendingActionId === "number" ? task.pendingActionId : null,
    status: task.status === "needs_clarification" || task.status === "failed" ? task.status : "completed",
    updatedAt: task.updatedAt,
  };
}

function payloadFromContinuationResult(result: Prisma.JsonValue | null) {
  if (!isRecord(result)) return null;
  return isRecord(result.payload) ? result.payload : null;
}

export function buildCrmAgentActiveTaskFromContinuation(input: {
  threadState?: unknown;
  toolResult: Prisma.JsonValue | null;
}): CrmAgentActiveTask | null {
  const previous = activeTaskFromThreadState(input.threadState);
  const payload = payloadFromContinuationResult(input.toolResult);
  if (!previous || !payload) return null;

  const toolName = previous.goal.toolName;
  const selectedEntities = selectedEntitiesFromDraftArgs(toolName, payload, null);
  const missing = missingForDraftTool(toolName, payload);
  return {
    ...previous,
    completedSteps: [
      ...previous.completedSteps,
      { toolName: "thread_continuation.correction", ok: true },
    ],
    missing,
    candidates: input.toolResult ? compactJsonValue(input.toolResult) : previous.candidates,
    selectedEntities: { ...previous.selectedEntities, ...selectedEntities },
    status: missing.length ? "needs_clarification" : "completed",
    updatedAt: new Date().toISOString(),
  };
}

function isReadOnlyQuestion(message: string) {
  const text = normalizeText(message);
  if (/\b(создай|запиши|перенеси|отмени|удали|сними|измени|обнови|поставь|отправь|напиши)\b/u.test(text)) return false;
  return /\b(сколько|какие|какая|какой|что за|покажи|найди|проверь|есть|были|было|список|детали|подробн|например)\b/u.test(text);
}

function previousActiveTask(threadState: unknown) {
  if (!isRecord(threadState) || !isRecord(threadState.activeTask)) return null;
  const task = threadState.activeTask;
  if (!isRecord(task.goal)) return null;
  const goal = task.goal;
  return typeof goal.toolName === "string" && typeof goal.domain === "string" ? task : null;
}

function previousCards(threadState: unknown) {
  if (!isRecord(threadState) || !Array.isArray(threadState.latestCards)) return [];
  return threadState.latestCards.filter(isRecord);
}

function cardDetails(cards: Record<string, unknown>[], type: string) {
  return cards
    .filter((card) => card.type === type)
    .slice(0, 8)
    .map((card) => card.data)
    .filter((item): item is Prisma.JsonValue => item != null) as Prisma.JsonValue[];
}

function continuationGoalFromState(message: string, threadState: unknown): CrmAgentGoal | null {
  const activeTask = previousActiveTask(threadState);
  if (!activeTask || !isRecord(activeTask.goal)) return null;
  const domain = activeTask.goal.domain;
  const toolName = activeTask.goal.toolName;
  const dateRange = parseDateRange(message);
  if (domain === "appointments" && toolName === "appointments.search" && dateRange) {
    return {
      intent: "read",
      domain: "appointments",
      toolName: "appointments.search",
      constraints: {
        dateFrom: startOfDay(dateRange.dateFrom).toISOString(),
        dateTo: endOfDay(dateRange.dateTo).toISOString(),
        dateLabel: dateRange.label,
        take: 50,
      },
      missing: [],
      confidence: 0.9,
    };
  }
  return null;
}

export function understandCrmAgentGoal(message: string, threadState?: unknown): CrmAgentGoal | null {
  const continuationGoal = continuationGoalFromState(message, threadState);
  if (continuationGoal) return continuationGoal;

  if (!isReadOnlyQuestion(message)) return null;
  const text = normalizeText(message);
  const dateRange = parseDateRange(message);

  if (/\b(запис|визит|посещени|прием|приём)\b/u.test(text)) {
    return {
      intent: "read",
      domain: "appointments",
      toolName: "appointments.search",
      constraints: {
        ...(dateRange ? { dateFrom: startOfDay(dateRange.dateFrom).toISOString(), dateTo: endOfDay(dateRange.dateTo).toISOString(), dateLabel: dateRange.label } : {}),
        take: 50,
      },
      missing: [],
      confidence: dateRange ? 0.92 : 0.76,
    };
  }

  if (/\b(свободн|окн|слот|время)\b/u.test(text)) {
    return {
      intent: "read",
      domain: "schedule",
      toolName: "appointments.findAvailableSlots",
      constraints: {
        ...(dateRange ? { dateFrom: startOfDay(dateRange.dateFrom).toISOString(), dateTo: endOfDay(dateRange.dateTo).toISOString(), dateLabel: dateRange.label } : {}),
        take: 30,
      },
      missing: [],
      confidence: 0.78,
    };
  }

  if (/\b(клиент|телефон|почт|контакт)\b/u.test(text)) {
    const query = searchQuery(message, /\b(клиент\w*|телефон\w*|почт\w*|контакт\w*)\b/gu);
    return { intent: "read", domain: "clients", toolName: "clients.search", constraints: { ...(query ? { query } : {}), take: 20 }, missing: [], confidence: 0.8 };
  }
  if (/\b(услуг|прайс|цен)\b/u.test(text)) {
    const query = searchQuery(message, /\b(услуг\w*|прайс\w*|цен\w*)\b/gu);
    return { intent: "read", domain: "services", toolName: "services.search", constraints: { ...(query ? { query } : {}), take: 20 }, missing: [], confidence: 0.8 };
  }
  if (/\b(мастер|специалист|сотрудник)\b/u.test(text)) {
    const query = searchQuery(message, /\b(мастер\w*|специалист\w*|сотрудник\w*)\b/gu);
    return { intent: "read", domain: "specialists", toolName: "specialists.search", constraints: { ...(query ? { query } : {}), take: 20 }, missing: [], confidence: 0.8 };
  }
  if (/\b(локац|филиал|адрес)\b/u.test(text)) {
    const query = searchQuery(message, /\b(локац\w*|филиал\w*|адрес\w*)\b/gu);
    return { intent: "read", domain: "locations", toolName: "locations.search", constraints: { ...(query ? { query } : {}), take: 20 }, missing: [], confidence: 0.8 };
  }
  if (/\b(акци|промо|скидк)\b/u.test(text)) {
    const query = searchQuery(message, /\b(акци\w*|промо\w*|скидк\w*)\b/gu);
    return { intent: "read", domain: "promos", toolName: "promos.search", constraints: { ...(query ? { query } : {}), activeOnly: false, take: 20 }, missing: [], confidence: 0.8 };
  }
  if (/\b(отзыв|жалоб|рейтинг|негатив)\b/u.test(text)) {
    return { intent: "read", domain: "reviews", toolName: "reviews.search", constraints: { ...(text.includes("негатив") ? { maxRating: 3 } : {}), take: 20 }, missing: [], confidence: 0.82 };
  }
  if (/\b(сайт|описан|карточк|поиск)\b/u.test(text)) {
    return { intent: "read", domain: "site", toolName: "site.health", constraints: {}, missing: [], confidence: 0.75 };
  }
  if (/\b(аналит|загруз|выруч|неявк|отмен)\b/u.test(text)) {
    return { intent: "analyze", domain: "analytics", toolName: "analytics.workload", constraints: {}, missing: [], confidence: 0.75 };
  }

  return null;
}

function resultItems(result: Prisma.JsonValue | null, domain: CrmAgentGoal["domain"]) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return [];
  const object = result as Record<string, unknown>;
  const keyByDomain: Partial<Record<CrmAgentGoal["domain"], string>> = {
    appointments: "appointments",
    clients: "clients",
    services: "services",
    specialists: "specialists",
    locations: "locations",
    promos: "promotions",
    reviews: "reviews",
    schedule: "slots",
  };
  const key = keyByDomain[domain];
  const value = key ? object[key] : null;
  return Array.isArray(value) ? value : [];
}

function itemLabel(item: unknown, fallback: string) {
  if (!isRecord(item)) return fallback;
  const profile = isRecord(item.profile) ? item.profile : null;
  const clientName = [item.firstName, item.lastName].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ").trim();
  const profileName = profile ? [profile.firstName, profile.lastName].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ").trim() : "";
  const name = typeof item.name === "string" ? item.name : "";
  const title = clientName || profileName || name;
  const id = typeof item.id === "number" || typeof item.id === "string" ? item.id : null;
  return title || (id != null ? `${fallback} #${id}` : fallback);
}

function entityTypeForDomain(domain: CrmAgentGoal["domain"]) {
  const map: Partial<Record<CrmAgentGoal["domain"], string>> = {
    clients: "client",
    services: "service",
    specialists: "specialist",
    locations: "location",
    promos: "promo",
    reviews: "review",
  };
  return map[domain] ?? null;
}

function clarificationFromInspection(goal: CrmAgentGoal, result: Prisma.JsonValue | null): Prisma.JsonValue | null {
  const items = resultItems(result, goal.domain);
  const entityType = entityTypeForDomain(goal.domain);
  if (!entityType || items.length <= 1 || typeof goal.constraints.query !== "string") return null;
  const options = items.slice(0, 6).flatMap((item, index) => {
    if (!isRecord(item) || (typeof item.id !== "number" && typeof item.id !== "string")) return [];
    return [{
      label: itemLabel(item, `Variant ${index + 1}`),
      value: { type: entityType, id: item.id },
    }];
  });
  if (options.length <= 1) return null;
  return {
    kind: "entity_selection",
    question: "Нашел несколько вариантов. Какой выбрать?",
    options,
  };
}

function answerFromInspection(goal: CrmAgentGoal, result: Prisma.JsonValue | null) {
  const items = resultItems(result, goal.domain);
  if (goal.domain === "appointments") {
    const label = typeof goal.constraints.dateLabel === "string" ? goal.constraints.dateLabel : "по запросу";
    if (!items.length) return `В CRM не нашел записей ${label}.`;
    return `Нашел ${items.length} ${items.length === 1 ? "запись" : items.length < 5 ? "записи" : "записей"} ${label}. Детали показываю карточками.`;
  }
  if (goal.domain === "schedule") {
    if (!items.length) return "Свободных окон по заданным условиям не нашел.";
    return `Нашел ${items.length} свободных окон. Детали показываю карточками.`;
  }
  if (goal.domain === "site") return "Проверил данные сайта в CRM.";
  if (goal.domain === "analytics") return "Проверил аналитику CRM.";
  if (!items.length) return "В CRM не нашел подходящих данных по запросу.";
  return `Нашел ${items.length} ${items.length === 1 ? "результат" : items.length < 5 ? "результата" : "результатов"} в CRM. Детали показываю карточками.`;
}

export async function runCrmAgentRuntime(input: {
  message: string;
  accountId: number;
  runId: number;
  threadId: number;
  scope: CrmAgentScope;
  threadState?: unknown;
}): Promise<CrmAgentRuntimeResult | null> {
  const text = normalizeText(input.message);
  const cards = previousCards(input.threadState);
  if (cards.some((card) => card.type === "appointment") && /\b(какое|какие|что за|подробн|например)\b/u.test(text) && /\b(посещени|визит|запис)\b/u.test(text)) {
    const appointments = cardDetails(cards, "appointment");
    const goal: CrmAgentGoal = {
      intent: "read",
      domain: "appointments",
      toolName: "appointments.search",
      constraints: { fromThreadState: true },
      missing: [],
      confidence: 0.88,
    };
    const plan = planFromGoal(goal);
    const activeTask: CrmAgentActiveTask = {
      goal,
      plan,
      completedSteps: [{ toolName: "threadState.latestCards", ok: true }],
      missing: [],
      candidates: toJsonValue({ appointments }),
      selectedEntities: {},
      pendingActionId: null,
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
    return {
      execution: {
        selectedToolName: "appointments.search",
        toolResult: toJsonValue({ appointments }),
        answer: appointments.length ? "Показываю детали посещений из прошлого результата." : "В прошлом результате не нашел деталей посещений.",
        observations: [],
      },
      activeTask,
      trace: { runtime: "CrmAgentRuntime", source: "threadState.latestCards", goal, plan } as Prisma.JsonObject,
    };
  }

  const goal = understandCrmAgentGoal(input.message, input.threadState);
  if (!goal || goal.confidence < 0.7) return null;

  const plan = planFromGoal(goal);
  const observations: CrmAgentLlmObservation[] = [];
  let toolResult: Prisma.JsonValue | null = null;
  let selectedToolName: string | null = null;
  const completedSteps: CrmAgentActiveTask["completedSteps"] = [];

  for (const [index, step] of plan.steps.entries()) {
    const tool = getCrmAgentTool(step.toolName);
    if (!tool || tool.mode !== "read") {
      completedSteps.push({ toolName: step.toolName, ok: false });
      continue;
    }
    selectedToolName = tool.name;
    toolResult = await executeCrmAgentReadTool({ tool, args: step.args, scope: input.scope });
    observations.push({
      step: index + 1,
      toolName: tool.name,
      args: step.args,
      result: compactJsonValue(toolResult),
      error: null,
    });
    completedSteps.push({ toolName: tool.name, ok: true });
  }

  const candidates = toolResult ? compactJsonValue(toolResult) : null;
  const pendingClarification = clarificationFromInspection(goal, toolResult);
  const activeTask: CrmAgentActiveTask = {
    goal,
    plan,
    completedSteps,
    missing: pendingClarification ? ["entity"] : goal.missing,
    candidates,
    selectedEntities: {},
    pendingActionId: null,
    status: pendingClarification || goal.missing.length ? "needs_clarification" : "completed",
    updatedAt: new Date().toISOString(),
  };

  return {
    execution: {
      selectedToolName,
      toolResult,
      answer: answerFromInspection(goal, toolResult),
      observations,
    },
    activeTask,
    pendingClarification,
    trace: {
      runtime: "CrmAgentRuntime",
      goal,
      plan,
      completedSteps,
      pendingClarification,
    } as Prisma.JsonObject,
  };
}
