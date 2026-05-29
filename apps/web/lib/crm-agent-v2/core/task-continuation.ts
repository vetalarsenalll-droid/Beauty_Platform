import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCrmAgentActionPreview } from "./draft-tools";
import {
  addCrmAgentMessage,
  getLatestPendingCrmAgentActionForSession,
  saveCrmAgentTaskState,
  updateCrmAgentActionPayload,
} from "./persistence";
import { executeCrmAgentReadTool } from "./read-tools";
import { resolveCrmAgentSpecialist } from "./resolvers";
import type {
  CrmAgentCard,
  CrmAgentCandidate,
  CrmAgentChatResponse,
  CrmAgentTaskState,
  CrmAgentUiWorkspace,
} from "./types";

export type HandleCrmAgentTaskContinuationInput = {
  accountId: number;
  userId?: number | null;
  sessionId: number;
  permissions: string[];
  message: string;
  timezone: string;
  state: CrmAgentTaskState | null;
};

export type CrmAgentTaskContinuationResult =
  | { handled: true; response: CrmAgentChatResponse; plannerHint: string }
  | { handled: false; plannerHint: string };

export async function handleCrmAgentTaskContinuation(
  input: HandleCrmAgentTaskContinuationInput,
): Promise<CrmAgentTaskContinuationResult> {
  const state = input.state ? cloneState(input.state) : null;
  if (state) {
    if (isAutoSuggestRequest(input.message) && state.missing.length) {
      const activeSlot = state.missing[0];
      const answer = pendingSelectionAnswer(state, activeSlot);
      await addCrmAgentMessage({
        accountId: input.accountId,
        sessionId: input.sessionId,
        role: "assistant",
        content: answer,
        data: inputJson({
          mode: "task_continuation",
          kind: "pending_selection",
          slot: activeSlot,
        }),
      });
      return {
        handled: true,
        plannerHint: `User asked the agent to suggest, but the current task still needs ${activeSlot} selection from real candidates.`,
        response: {
          answer,
          sessionId: input.sessionId,
          state,
          cards: buildContinuationCards(state),
          workspace: buildContinuationWorkspace(state, activeSlot),
          planTrace: [],
        },
      };
    }

    const selection = selectCandidateFromText(state, input.message, input.timezone);
    if (selection) {
      applyCandidateSelection(state, selection.slot, selection.candidate);
      await hydrateAppointmentSelection(state, input);
      applyNextMissingSlots(state);
      state.status = state.missing.length ? "collecting" : "ready_to_plan";
      await saveCrmAgentTaskState(state);
      const answer = selection.answer;
      await addCrmAgentMessage({
        accountId: input.accountId,
        sessionId: input.sessionId,
        role: "assistant",
        content: answer,
        data: inputJson({
          mode: "task_continuation",
          kind: "selection",
          slot: selection.slot,
          candidateId: selection.candidate.id,
        }),
      });
      return {
        handled: true,
        plannerHint: `User selected ${selection.slot}=${selection.candidate.id} from latest state candidates.`,
        response: {
          answer,
          sessionId: input.sessionId,
          state,
          cards: buildContinuationCards(state),
          workspace: buildContinuationWorkspace(state, selection.slot),
          planTrace: [],
        },
      };
    }

    const timeUpdate = parseTimeUpdate(input.message);
    if (timeUpdate) {
      state.slots.time = {
        ...(state.slots.time ?? {}),
        query: input.message,
        value: timeUpdate,
        status: "resolved",
      };
      state.selected.time = timeUpdate;
      state.missing = state.missing.filter((item) => item !== "time");
      state.status = state.missing.length ? "collecting" : "ready_to_plan";
      await saveCrmAgentTaskState(state);
      const answer = "Время зафиксировано. Продолжу с этим вариантом в текущей задаче.";
      await addCrmAgentMessage({
        accountId: input.accountId,
        sessionId: input.sessionId,
        role: "assistant",
        content: answer,
        data: inputJson({ mode: "task_continuation", kind: "time_update", time: timeUpdate }),
      });
      return {
        handled: true,
        plannerHint: `User updated time preference in latest state: ${timeUpdate}.`,
        response: {
          answer,
          sessionId: input.sessionId,
          state,
          cards: buildContinuationCards(state),
          workspace: buildContinuationWorkspace(state, "time"),
          planTrace: [],
        },
      };
    }
  }

  const draft = await updatePendingDraftFromText(input);
  if (draft) return draft;

  return {
    handled: false,
    plannerHint: buildContinuationPlannerHint(input.message, state),
  };
}

function selectCandidateFromText(state: CrmAgentTaskState, message: string, timezone: string) {
  const ordinal = parseOrdinal(message);
  const time = parseClockTime(message);
  const slots = candidateSlotsInPriority(state);

  for (const slot of slots) {
    const candidates = state.candidates[slot] ?? [];
    if (time && slot === "time") {
      const candidate = candidates.find((item) => candidateMatchesTime(item, time, message, timezone));
      if (candidate) {
        return { slot, candidate, answer: `Выбрал время ${candidate.title}.` };
      }
    }
    if (ordinal && candidates[ordinal - 1]) {
      const candidate = candidates[ordinal - 1];
      return { slot, candidate, answer: `Выбрал вариант: ${candidate.title}.` };
    }
  }

  return null;
}

function candidateSlotsInPriority(state: CrmAgentTaskState) {
  const unresolved = state.missing.filter((slot) => (state.candidates[slot] ?? []).length > 0);
  const ambiguous = Object.entries(state.slots)
    .filter(([slot, value]) => value.status === "ambiguous" && (state.candidates[slot] ?? []).length > 0)
    .map(([slot]) => slot);
  const remaining = Object.keys(state.candidates).filter((slot) => (state.candidates[slot] ?? []).length > 0);
  return [...new Set([...unresolved, ...ambiguous, ...remaining])];
}

function isAutoSuggestRequest(message: string) {
  return /(?:^|\s)(сам|сама|сами|предложи|подбери|любой|любая)(?:\s|$)/i.test(message);
}

function pendingSelectionAnswer(state: CrmAgentTaskState, activeSlot: string) {
  const candidates = state.candidates[activeSlot] ?? [];
  if (candidates.length > 1) {
    return `${selectionTabTitle(activeSlot)}: найдено ${candidates.length}. Выберите подходящий вариант, чтобы я продолжил по реальным данным.`;
  }
  if (candidates.length === 1) {
    return `${selectionTabTitle(activeSlot)}: найден один вариант. Подтвердите его, чтобы я продолжил по реальным данным.`;
  }
  return `Нужно уточнить: ${slotLabel(activeSlot)}. Без этого я не могу предложить реальное окно записи.`;
}

function applyCandidateSelection(state: CrmAgentTaskState, slot: string, candidate: CrmAgentCandidate) {
  state.slots[slot] = {
    ...(state.slots[slot] ?? {}),
    selectedId: candidate.id,
    candidates: state.candidates[slot] ?? [],
    status: "resolved",
  };
  state.selected[slot] = candidate.id;
  state.missing = state.missing.filter((item) => item !== slot);
  applySelectionSideEffects(state, slot, candidate.id);
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

async function hydrateAppointmentSelection(state: CrmAgentTaskState, input: HandleCrmAgentTaskContinuationInput) {
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
        sessionId: input.sessionId,
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
  candidates: CrmAgentCandidate[],
  selected?: CrmAgentCandidate,
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

async function loadServiceLocationCandidates(accountId: number, serviceId: number): Promise<CrmAgentCandidate[]> {
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

function availableSlotCandidates(value: unknown): CrmAgentCandidate[] {
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
  const missing = new Set(state.missing);
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

async function updatePendingDraftFromText(input: HandleCrmAgentTaskContinuationInput): Promise<CrmAgentTaskContinuationResult | null> {
  const text = extractReplacementText(input.message);
  const wantsDraftEdit = /измени|поправ|замени|отредакт|текст|черновик/i.test(input.message);
  if (!text && !wantsDraftEdit) return null;

  const action = await getLatestPendingCrmAgentActionForSession({
    accountId: input.accountId,
    sessionId: input.sessionId,
  });
  if (!action) return null;

  if (!text) {
    const answer = "Какой текст поставить в черновик? Напишите новую формулировку.";
    await addCrmAgentMessage({
      accountId: input.accountId,
      sessionId: input.sessionId,
      role: "assistant",
      content: answer,
      data: inputJson({ mode: "task_continuation", kind: "draft_edit_needs_text", actionId: action.id }),
    });
    return {
      handled: true,
      plannerHint: `User wants to edit pending action ${action.id}, but did not provide replacement text.`,
      response: {
        answer,
        sessionId: input.sessionId,
        state: input.state ?? emptyContinuationState(input.sessionId, input.accountId),
        cards: [],
        workspace: { mode: "form", title: "Нужен новый текст", commands: [] },
        planTrace: [],
      },
    };
  }

  const payload = patchTextPayload(recordArg(action.payload), text);
  const updated = await updateCrmAgentActionPayload({
    accountId: input.accountId,
    actionId: action.id,
    payload: inputJson(payload),
  });
  const preview = await buildCrmAgentActionPreview(action.actionType, payload, {
    accountId: input.accountId,
    userId: input.userId ?? null,
    sessionId: input.sessionId,
    permissions: input.permissions,
  });

  const answer = "Текст в черновике обновлен.";
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.sessionId,
    role: "assistant",
    content: answer,
    data: inputJson({ mode: "task_continuation", kind: "draft_edit", actionId: action.id, payload, preview }),
  });

  const card: CrmAgentCard = {
    type: "preview",
    id: action.id,
    title: updated?.summary ?? action.summary,
    subtitle: updated?.status ?? action.status,
    data: { actionType: action.actionType, payload, preview },
    actions: [
      { id: `confirm_action:${action.id}`, label: "Подтвердить", kind: "confirm", payload: { actionId: action.id } },
      { id: `reject_action:${action.id}`, label: "Отклонить", kind: "reject", payload: { actionId: action.id } },
    ],
  };

  return {
    handled: true,
    plannerHint: `User edited pending action ${action.id} payload text.`,
    response: {
      answer,
      sessionId: input.sessionId,
      state: input.state ?? emptyContinuationState(input.sessionId, input.accountId),
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
    },
  };
}

function buildContinuationPlannerHint(message: string, state: CrmAgentTaskState | null) {
  return JSON.stringify({
    continuationMessage: message,
    latestStateStatus: state?.status ?? null,
    goalType: state?.goalType ?? null,
    selected: state?.selected ?? {},
    missing: state?.missing ?? [],
    candidateSlots: state ? Object.keys(state.candidates) : [],
  });
}

function buildContinuationWorkspace(state: CrmAgentTaskState, activeSlot: string): CrmAgentUiWorkspace {
  const cards = buildContinuationCards(state);
  const selectionCards = cards.filter((card) => card.actions?.some((action) => action.kind === "select") && card.data?.slot === activeSlot);
  const selectedCards = cards.filter((card) => card.data?.status === "selected");
  const rows = (state.candidates[activeSlot] ?? []).map((candidate) => ({
      slot: activeSlot,
      value: candidate.id,
      title: candidate.title,
      subtitle: candidate.subtitle ?? "",
      status: state.selected[activeSlot] === candidate.id ? "selected" : "available",
    }));

  return {
    mode: state.missing.length ? "select" : "report",
    title: selectionCards.length ? selectionTitle(activeSlot) : selectionAnswer(state, activeSlot),
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

function buildContinuationCards(state: CrmAgentTaskState): CrmAgentCard[] {
  return Object.entries(state.candidates).flatMap(([slot, candidates]) =>
    candidates.map((candidate): CrmAgentCard => {
      const selected = state.selected[slot] === candidate.id;
      return {
        type: cardTypeForCandidate(candidate.type),
        id: candidate.id,
        title: candidate.title,
        subtitle: selected ? "Выбрано" : candidate.subtitle ?? null,
        data: {
          slot,
          value: candidate.id,
          status: selected ? "selected" : "available",
        },
        actions: selected
          ? []
          : [{ id: `select:${slot}:${encodeURIComponent(String(candidate.id))}`, label: "Выбрать", kind: "select", payload: { slot, value: candidate.id } }],
      };
    }),
  );
}

function parseOrdinal(message: string) {
  const normalized = message.toLocaleLowerCase("ru-RU");
  const digit = normalized.match(/\b([1-9])\b/)?.[1];
  if (digit) return Number(digit);
  if (/перв(ый|ую|ого|ое)|один|1-?й/.test(normalized)) return 1;
  if (/втор(ой|ую|ого|ое)|два|2-?й/.test(normalized)) return 2;
  if (/трет(ий|ью|ьего|ье)|три|3-?й/.test(normalized)) return 3;
  if (/четверт(ый|ую|ого|ое)|четыре|4-?й/.test(normalized)) return 4;
  if (/пят(ый|ую|ого|ое)|пять|5-?й/.test(normalized)) return 5;
  return null;
}

function parseClockTime(message: string) {
  const match = message.match(/\b([01]?\d|2[0-3])(?::|\.|\sчас(?:а|ов)?\s*)?([0-5]\d)?\b/i);
  if (!match) return null;
  const hour = match[1].padStart(2, "0");
  const minute = (match[2] ?? "00").padStart(2, "0");
  return `${hour}:${minute}`;
}

function parseTimeUpdate(message: string) {
  const clock = parseClockTime(message);
  if (!clock) return null;
  const day = /послезавтра/i.test(message) ? "day_after_tomorrow" : /завтра/i.test(message) ? "tomorrow" : /сегодня/i.test(message) ? "today" : "unspecified_day";
  return `${day} ${clock}`;
}

function candidateMatchesTime(candidate: CrmAgentCandidate, clock: string, message: string, timezone: string) {
  const values = [candidate.id, candidate.title, candidate.subtitle, isRecord(candidate.data) ? candidate.data.startAt : null]
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map(String);
  return values.some((value) => {
    if (value.includes(clock)) return true;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const formatted = new Intl.DateTimeFormat("ru-RU", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(date);
    if (formatted !== clock) return false;
    if (/завтра/i.test(message)) {
      const day = new Intl.DateTimeFormat("ru-RU", { timeZone: timezone, day: "2-digit", month: "2-digit" }).format(date);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = new Intl.DateTimeFormat("ru-RU", { timeZone: timezone, day: "2-digit", month: "2-digit" }).format(tomorrow);
      return day === expected;
    }
    return true;
  });
}

function extractReplacementText(message: string) {
  const quoted = message.match(/[«"]([^»"]{2,})[»"]/)?.[1]?.trim();
  if (quoted) return quoted;
  const afterColon = message.match(/:\s*(.{2,})$/)?.[1]?.trim();
  if (afterColon) return afterColon;
  const afterTo = message.match(/\b(?:на|так:)\s+(.{2,})$/i)?.[1]?.trim();
  return afterTo ?? null;
}

function patchTextPayload(payload: Record<string, unknown>, text: string) {
  const preferredKeys = ["text", "message", "content", "body", "description", "reply", "comment", "title"];
  const key = preferredKeys.find((item) => typeof payload[item] === "string") ?? preferredKeys.find((item) => item in payload) ?? "text";
  return { ...payload, [key]: text };
}

function emptyContinuationState(sessionId: number, accountId: number): CrmAgentTaskState {
  return {
    sessionId,
    accountId,
    goalType: "task_continuation",
    status: "collecting",
    slots: {},
    candidates: {},
    selected: {},
    missing: [],
  };
}

function cloneState(state: CrmAgentTaskState): CrmAgentTaskState {
  return JSON.parse(JSON.stringify(state)) as CrmAgentTaskState;
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

function selectionTitle(slot: string) {
  const map: Record<string, string> = {
    client: "Выберите клиента",
    service: "Выберите услугу",
    specialist: "Выберите специалиста",
    location: "Выберите филиал",
    time: "Выберите время",
  };
  return map[slot] ?? "Выберите вариант";
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

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function recordArg(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
