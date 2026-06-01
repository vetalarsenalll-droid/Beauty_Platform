import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addCrmAgentMessage,
  confirmCrmAgentAction,
  getCrmAgentAction,
  getCrmAgentSession,
  getLatestCrmAgentTaskState,
  rejectCrmAgentAction,
  saveCrmAgentTaskState,
  updateCrmAgentActionPayload,
} from "./persistence";
import { buildCrmAgentActionPreview } from "./draft-tools";
import { executeCrmAgentReadTool } from "./read-tools";
import { resolveCrmAgentSpecialist } from "./resolvers";
import type { CrmAgentCard, CrmAgentChatResponse, CrmAgentInteractionRequest, CrmAgentTaskState, CrmAgentUiWorkspace } from "./types";

export type HandleCrmAgentCommandInput = {
  accountId: number;
  userId?: number | null;
  permissions: string[];
  request: CrmAgentInteractionRequest;
};

export async function handleCrmAgentInteractiveCommand(input: HandleCrmAgentCommandInput): Promise<CrmAgentChatResponse> {
  const session = await getCrmAgentSession({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
  });
  if (!session) {
    return commandError(input.request.sessionId, input.accountId, "Session not found.");
  }

  const command = parseCommand(input.request.commandId);
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
    role: "user",
    content: `command:${input.request.commandId}`,
    data: (input.request.payload ?? {}) as Prisma.InputJsonValue,
  });

  if (command.kind === "confirm_action") {
    return confirmActionCommand(input, command.actionId);
  }
  if (command.kind === "reject_action") {
    return rejectActionCommand(input, command.actionId);
  }
  if (command.kind === "select") {
    return selectCommand(input, command.slot, command.value);
  }
  if (command.kind === "save_draft") {
    return saveDraftCommand(input, command.actionId);
  }

  return commandError(input.request.sessionId, input.accountId, "Unsupported command.");
}

async function confirmActionCommand(input: HandleCrmAgentCommandInput, actionId: number): Promise<CrmAgentChatResponse> {
  const action = await getCrmAgentAction({ accountId: input.accountId, actionId });
  if (!action) return commandError(input.request.sessionId, input.accountId, "Action not found.");
  if (!canUseActionPermission(input.permissions, action.permission)) {
    return commandError(input.request.sessionId, input.accountId, "Insufficient permission for action confirmation.");
  }

  const confirmed = await confirmCrmAgentAction({ accountId: input.accountId, actionId });
  const answer = confirmed ? "Действие подтверждено." : "Действие не найдено или уже обработано.";
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
    role: "assistant",
    content: answer,
    data: { actionId, status: confirmed?.status ?? null } as Prisma.InputJsonValue,
  });
  return commandResponse(input.request.sessionId, input.accountId, answer, {
    status: "ready_for_confirmation",
    action: confirmed,
  });
}

async function rejectActionCommand(input: HandleCrmAgentCommandInput, actionId: number): Promise<CrmAgentChatResponse> {
  const action = await getCrmAgentAction({ accountId: input.accountId, actionId });
  if (!action) return commandError(input.request.sessionId, input.accountId, "Action not found.");
  if (!canUseActionPermission(input.permissions, action.permission)) {
    return commandError(input.request.sessionId, input.accountId, "Insufficient permission for action rejection.");
  }

  const rejected = await rejectCrmAgentAction({
    accountId: input.accountId,
    actionId,
    error: typeof input.request.payload?.reason === "string" ? input.request.payload.reason : null,
  });
  const answer = rejected ? "Действие отклонено." : "Действие не найдено или уже обработано.";
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
    role: "assistant",
    content: answer,
    data: { actionId, status: rejected?.status ?? null } as Prisma.InputJsonValue,
  });
  return commandResponse(input.request.sessionId, input.accountId, answer, {
    status: "collecting",
    action: rejected,
  });
}

async function selectCommand(input: HandleCrmAgentCommandInput, slot: string, value: number | string): Promise<CrmAgentChatResponse> {
  const latest = await getLatestCrmAgentTaskState({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
  });
  if (!latest) return commandError(input.request.sessionId, input.accountId, "State not found.");

  const state = deserializeState(latest, input.request.sessionId, input.accountId);
  normalizeContinuationMissingSlots(state);
  const normalizedSlot = normalizeEntitySlotName(slot);
  state.slots[normalizedSlot] = {
    ...(state.slots[normalizedSlot] ?? {}),
    selectedId: value,
    status: "resolved",
  };
  state.selected[normalizedSlot] = value;
  state.missing = state.missing.filter((item) => normalizeEntitySlotName(item) !== normalizedSlot);
  applySelectionSideEffects(state, normalizedSlot, value);
  await hydrateAppointmentSelection(state, input);
  applyNextMissingSlots(state);
  state.status = state.missing.length ? "collecting" : "ready_to_plan";

  await saveCrmAgentTaskState(state);
  const answer = selectionAnswer(state, normalizedSlot);
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
    role: "assistant",
    content: answer,
    data: { slot: normalizedSlot, value } as Prisma.InputJsonValue,
  });
  return {
    answer,
    sessionId: input.request.sessionId,
    state,
    cards: buildSelectionCards(state),
    workspace: buildSelectionWorkspace(state, nextActiveSlot(state, normalizedSlot)),
    planTrace: [],
  };
}

async function saveDraftCommand(input: HandleCrmAgentCommandInput, actionId: number): Promise<CrmAgentChatResponse> {
  const action = await getCrmAgentAction({ accountId: input.accountId, actionId });
  if (!action) return commandError(input.request.sessionId, input.accountId, "Action not found.");
  if (action.status !== "PENDING") return commandError(input.request.sessionId, input.accountId, "Only pending drafts can be edited.");
  if (!canUseActionPermission(input.permissions, action.permission)) {
    return commandError(input.request.sessionId, input.accountId, "Insufficient permission for draft editing.");
  }

  const payload = mergePayload(recordArg(action.payload), input.request.payload ?? {});
  const updated = await updateCrmAgentActionPayload({
    accountId: input.accountId,
    actionId,
    payload: inputJson(payload),
  });
  const preview = await buildCrmAgentActionPreview(action.actionType, payload, {
    accountId: input.accountId,
    userId: input.userId ?? null,
    sessionId: input.request.sessionId,
    permissions: input.permissions,
  });

  const answer = "Черновик обновлен.";
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
    role: "assistant",
    content: answer,
    data: { actionId, payload, preview } as Prisma.InputJsonValue,
  });

  const card = {
    type: "preview" as const,
    id: actionId,
    title: updated?.summary ?? action.summary,
    subtitle: updated?.status ?? action.status,
    data: { actionType: action.actionType, preview, payload },
    actions: [
      { id: `confirm_action:${actionId}`, label: "Подтвердить", kind: "confirm" as const, payload: { actionId } },
      { id: `reject_action:${actionId}`, label: "Отклонить", kind: "reject" as const, payload: { actionId } },
    ],
  };

  const state = await loadCurrentStateOrEmpty(input, "ready_for_confirmation");
  state.status = "ready_for_confirmation";
  await saveCrmAgentTaskState(state);

  return {
    answer,
    sessionId: input.request.sessionId,
    state,
    cards: [card],
    workspace: {
      mode: "preview",
      title: "Черновик обновлен",
      cards: [card],
      preview: {
        before: preview.before ?? undefined,
        after: preview.after,
        diff: preview.diff,
      },
      commands: card.actions,
    },
    planTrace: [],
  };
}

async function loadCurrentStateOrEmpty(input: HandleCrmAgentCommandInput, status: CrmAgentTaskState["status"]) {
  const latest = await getLatestCrmAgentTaskState({
    accountId: input.accountId,
    sessionId: input.request.sessionId,
  });
  return latest ? deserializeState(latest, input.request.sessionId, input.accountId) : emptyState(input.request.sessionId, input.accountId, status);
}

function deserializeState(
  record: NonNullable<Awaited<ReturnType<typeof getLatestCrmAgentTaskState>>>,
  sessionId: number,
  accountId: number,
): CrmAgentTaskState {
  return {
    sessionId,
    accountId,
    goalType: record.goalType,
    status: isTaskStatus(record.status) ? record.status : "collecting",
    slots: isRecord(record.slots) ? (record.slots as CrmAgentTaskState["slots"]) : {},
    candidates: isRecord(record.candidates) ? (record.candidates as CrmAgentTaskState["candidates"]) : {},
    selected: isRecord(record.selected) ? (record.selected as CrmAgentTaskState["selected"]) : {},
    missing: Array.isArray(record.missing) ? record.missing.filter((item): item is string => typeof item === "string") : [],
  };
}

function parseCommand(commandId: string):
  | { kind: "confirm_action"; actionId: number }
  | { kind: "reject_action"; actionId: number }
  | { kind: "select"; slot: string; value: number | string }
  | { kind: "save_draft"; actionId: number }
  | { kind: "unknown" } {
  const [kind, first, ...rest] = commandId.split(":");
  const valuePart = rest.join(":");
  if (kind === "confirm_action") {
    const actionId = Number(first);
    return Number.isInteger(actionId) ? { kind, actionId } : { kind: "unknown" };
  }
  if (kind === "reject_action") {
    const actionId = Number(first);
    return Number.isInteger(actionId) ? { kind, actionId } : { kind: "unknown" };
  }
  if (kind === "select" && first && valuePart) {
    const decoded = decodeCommandPart(valuePart);
    const numeric = Number(decoded);
    return { kind, slot: first, value: Number.isInteger(numeric) ? numeric : decoded };
  }
  if (kind === "save_draft") {
    const actionId = Number(first);
    return Number.isInteger(actionId) ? { kind, actionId } : { kind: "unknown" };
  }
  return { kind: "unknown" };
}

function decodeCommandPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function canUseActionPermission(permissions: string[], permission: string | null) {
  return !permission || permissions.includes("crm.all") || permissions.includes(permission);
}

function commandError(sessionId: number, accountId: number, message: string): CrmAgentChatResponse {
  return {
    answer: message,
    sessionId,
    state: emptyState(sessionId, accountId, "failed"),
    cards: [],
    workspace: { mode: "empty", title: "Command error", commands: [] },
    planTrace: [],
  };
}

function commandResponse(
  sessionId: number,
  accountId: number,
  answer: string,
  data: Record<string, unknown>,
): CrmAgentChatResponse {
  return {
    answer,
    sessionId,
    state: emptyState(sessionId, accountId, "ready_for_confirmation"),
    cards: [{ type: "action", title: answer, data }],
    workspace: { mode: "confirm", title: answer, cards: [{ type: "action", title: answer, data }], commands: [] },
    planTrace: [],
  };
}

function emptyState(sessionId: number, accountId: number, status: CrmAgentTaskState["status"]): CrmAgentTaskState {
  return {
    sessionId,
    accountId,
    goalType: "command",
    status,
    slots: {},
    candidates: {},
    selected: {},
    missing: [],
  };
}

function buildSelectionWorkspace(state: CrmAgentTaskState, activeSlot: string): CrmAgentUiWorkspace {
  const cards = buildSelectionCards(state);
  const selectionCards = cards.filter((card) => card.actions?.some((action) => action.kind === "select") && card.data?.slot === activeSlot);
  const selectedCards = cards.filter((card) => card.data?.status === "selected");
  const rows = (state.candidates[activeSlot] ?? []).map((candidate) => ({
      slot: activeSlot,
      value: candidate.id,
      type: candidate.type,
      title: candidate.title,
      subtitle: candidate.subtitle ?? "",
      status: state.selected[activeSlot] === candidate.id ? "selected" : "available",
    }));

  return {
    mode: state.missing.length ? "select" : "report",
    title: selectionAnswer(state, activeSlot),
    activeTabId: selectionCards.length ? "selection" : "selected",
    cards: selectionCards.length ? selectionCards : selectedCards,
    tabs: [
      {
        id: "selection",
        title: selectionTabTitle(activeSlot),
        badge: selectionCards.length,
        cards: [],
        table: rows.length
          ? {
              columns: [
                { key: "slot", title: "Что выбираем" },
                { key: "title", title: "Вариант" },
                { key: "subtitle", title: "Детали" },
                { key: "status", title: "Статус", type: "status" },
              ],
              rows,
              selectedRowIds: rows.filter((row) => row.status === "selected").map((row) => String(row.value)),
              rowCommands: [{ id: "select:{slot}:{value}", label: "Выбрать", kind: "select" }],
            }
          : undefined,
      },
      {
        id: "selected",
        title: "Выбрано",
        badge: selectedCards.length,
        cards: selectedCards,
      },
    ],
    commands: [],
  };
}

function buildSelectionCards(state: CrmAgentTaskState): CrmAgentCard[] {
  const cards: CrmAgentCard[] = [];
  for (const [slot, candidates] of Object.entries(state.candidates)) {
    for (const candidate of candidates) {
      const selected = state.selected[slot] === candidate.id;
      cards.push({
        type: cardTypeForCandidate(candidate.type),
        id: candidate.id,
        title: candidate.type === "slot" ? formatSlotDate(String(candidate.title)) : candidate.title,
        subtitle: selected ? "Выбрано" : candidate.subtitle ?? null,
        data: {
          slot,
          value: candidate.id,
          status: selected ? "selected" : "available",
        },
        actions: selected
          ? []
          : [
              {
                id: `select:${slot}:${candidate.id}`,
                label: "Выбрать",
                kind: "select",
                payload: { slot, value: candidate.id },
              },
            ],
      });
    }
  }
  return cards;
}

function applySelectionSideEffects(state: CrmAgentTaskState, slot: string, value: number | string) {
  if (state.goalType !== "appointment.create" || slot !== "time") return;
  const candidate = (state.candidates.time ?? []).find((item) => item.id === value);
  if (!candidate || !isRecord(candidate.data)) return;

  const specialistId = numberValue(candidate.data.specialistId);
  if (specialistId && !state.selected.specialist) {
    state.selected.specialist = specialistId;
    state.slots.specialist = {
      ...(state.slots.specialist ?? {}),
      selectedId: specialistId,
      status: "resolved",
    };
  }

  const locationId = numberValue(candidate.data.locationId);
  if (locationId && !state.selected.location) {
    state.selected.location = locationId;
    state.slots.location = {
      ...(state.slots.location ?? {}),
      selectedId: locationId,
      status: "resolved",
    };
  }
}

async function hydrateAppointmentSelection(state: CrmAgentTaskState, input: HandleCrmAgentCommandInput) {
  if (state.goalType !== "appointment.create") return;
  const serviceId = numberValue(state.selected.service);
  if (!serviceId) return;

  if (!state.selected.specialist && !(state.candidates.specialist ?? []).length) {
    const specialistResult = await resolveCrmAgentSpecialist(
      { accountId: input.accountId },
      { filters: { serviceId, all: true }, take: 8 },
    );
    applyCandidateResult(state, "specialist", specialistResult.candidates, specialistResult.selected);
  }

  if (!state.selected.location && !(state.candidates.location ?? []).length) {
    const locationCandidates = await loadServiceLocationCandidates(input.accountId, serviceId);
    applyCandidateResult(state, "location", locationCandidates, locationCandidates.length === 1 ? locationCandidates[0] : undefined);
  }

  if (!state.selected.time && !(state.candidates.time ?? []).length) {
    const slotsResult = await executeCrmAgentReadTool({
      toolName: "appointments.findAvailableSlots",
      args: {
        serviceId,
        specialistId: numberValue(state.selected.specialist) ?? undefined,
        locationId: numberValue(state.selected.location) ?? undefined,
        take: 8,
      },
      ctx: {
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: input.request.sessionId,
        permissions: input.permissions,
      },
    });
    const timeCandidates = availableSlotCandidates(slotsResult);
    applyCandidateResult(state, "time", timeCandidates, timeCandidates.length === 1 ? timeCandidates[0] : undefined);
  }
}

function applyCandidateResult(
  state: CrmAgentTaskState,
  slot: string,
  candidates: CrmAgentTaskState["candidates"][string],
  selected?: CrmAgentTaskState["candidates"][string][number],
) {
  state.candidates[slot] = candidates;
  state.slots[slot] = {
    ...(state.slots[slot] ?? {}),
    candidates,
    selectedId: selected?.id ?? state.slots[slot]?.selectedId ?? null,
    status: selected ? "resolved" : candidates.length ? "ambiguous" : "not_found",
  };
  if (selected) state.selected[slot] = selected.id;
}

async function loadServiceLocationCandidates(accountId: number, serviceId: number): Promise<CrmAgentTaskState["candidates"][string]> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, accountId },
    select: {
      locations: {
        select: {
          location: { select: { id: true, name: true, address: true, phone: true, status: true } },
        },
        take: 20,
      },
    },
  });
  return (service?.locations ?? []).map(({ location }) => ({
    type: "location",
    id: location.id,
    title: location.name,
    subtitle: location.address || location.phone || null,
    data: { status: location.status },
  }));
}

function availableSlotCandidates(value: unknown): CrmAgentTaskState["candidates"][string] {
  if (!isRecord(value) || !Array.isArray(value.slots)) return [];
  return value.slots
    .filter((slot): slot is Record<string, unknown> => isRecord(slot) && typeof slot.startAt === "string")
    .map((slot, index) => {
      const subtitle = [slot.serviceName, slot.specialistName, slot.locationName]
        .filter((item): item is string => typeof item === "string" && Boolean(item))
        .join(" | ");
      return {
        type: "slot",
        id: slotCandidateId(slot),
        title: formatSlotDate(String(slot.startAt)),
        subtitle: subtitle || null,
        data: { ...slot, rank: index + 1 },
      };
    });
}

function applyNextMissingSlots(state: CrmAgentTaskState) {
  if (state.goalType !== "appointment.create") return;
  const missing = new Set(state.missing.map(normalizeEntitySlotName));
  if (!state.selected.client) missing.add("client");
  if (!state.selected.service) missing.add("service");
  if (state.selected.client && state.selected.service) {
    if (!state.selected.specialist && !(state.candidates.specialist ?? []).length) missing.add("specialist");
    if (!state.selected.location && !(state.candidates.location ?? []).length) missing.add("location");
    if (!state.selected.time) missing.add("time");
  }
  for (const slot of Object.keys(state.selected)) missing.delete(slot);
  state.missing = [...missing];
}

function normalizeContinuationMissingSlots(state: CrmAgentTaskState) {
  state.missing = [...new Set(state.missing.map(normalizeEntitySlotName))];
}

function normalizeEntitySlotName(slot: string) {
  const map: Record<string, string> = {
    clientId: "client",
    serviceId: "service",
    specialistId: "specialist",
    locationId: "location",
    startAt: "time",
  };
  return map[slot] ?? slot;
}

function nextActiveSlot(state: CrmAgentTaskState, fallback: string) {
  return state.missing[0] ?? fallback;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function selectionAnswer(state: CrmAgentTaskState, activeSlot: string) {
  if (!state.missing.length) {
    return state.goalType === "appointment.create"
      ? "Все параметры выбраны. Напишите «продолжить», чтобы подготовить черновик записи."
      : "Выбор сохранен. Можно продолжить.";
  }
  if (state.goalType === "appointment.create") {
    const labels = state.missing.map(slotLabel).join(", ");
    return `Выбор сохранен. Для записи осталось уточнить: ${labels}.`;
  }
  return `Выбор сохранен. Осталось уточнить: ${slotLabel(activeSlot)}.`;
}

function selectionTabTitle(slot: string) {
  const map: Record<string, string> = {
    client: "Клиенты",
    service: "Услуги",
    specialist: "Специалисты",
    location: "Филиалы",
    time: "Время",
  };
  return map[slot] ?? "Варианты";
}

function slotLabel(slot: string) {
  const map: Record<string, string> = {
    client: "клиент",
    service: "услуга",
    specialist: "специалист",
    location: "филиал",
    time: "дата и время",
  };
  return map[slot] ?? slot;
}

function cardTypeForCandidate(type: string): CrmAgentCard["type"] {
  if (type === "client") return "client";
  if (type === "service") return "service";
  if (type === "specialist") return "specialist";
  if (type === "location") return "location";
  if (type === "appointment") return "appointment";
  if (type === "slot") return "slot";
  if (type === "review") return "review";
  if (type === "promo" || type === "promotion") return "promo";
  return "report";
}

function formatSlotDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function slotCandidateId(slot: Record<string, unknown>) {
  return [slot.startAt, slot.specialistId, slot.locationId].filter((item) => item != null && item !== "").map(String).join("|");
}

function isTaskStatus(value: string): value is CrmAgentTaskState["status"] {
  return [
    "collecting",
    "resolving",
    "needs_clarification",
    "ready_to_plan",
    "ready_for_confirmation",
    "completed",
    "failed",
  ].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordArg(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function mergePayload(current: Record<string, unknown>, patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries({ ...current, ...patch }).filter(([, value]) => value !== undefined),
  );
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
