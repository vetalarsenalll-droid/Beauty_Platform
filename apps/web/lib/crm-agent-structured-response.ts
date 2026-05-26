import type { Prisma } from "@prisma/client";
import type { CrmAgentLlmObservation } from "@/lib/crm-agent-llm-contract";

export type CrmAgentEntityType = "client" | "specialist" | "service" | "location" | "appointment" | "review" | "promo" | "slot";

export type CrmAgentEntity = {
  type: CrmAgentEntityType;
  id: number | string;
  title: string;
  subtitle?: string | null;
  meta?: string[];
  data?: Prisma.JsonValue;
};

export type CrmAgentCard = CrmAgentEntity & {
  actions: Array<{
    intent: string;
    label: string;
  }>;
};

export type CrmAgentSuggestedAction = {
  intent: string;
  label: string;
  entity?: { type: CrmAgentEntityType; id: number | string };
};

export type CrmAgentThreadStateSnapshot = {
  latestEntities: CrmAgentEntity[];
  latestCards: CrmAgentCard[];
  selectedEntity: { type: CrmAgentEntityType; id: number | string } | null;
  pendingClarification: Prisma.JsonValue | null;
  lastToolName: string | null;
  activeTask?: Prisma.JsonValue | null;
  updatedAt: string;
};

function isEntityType(value: unknown): value is CrmAgentEntityType {
  return value === "client" || value === "specialist" || value === "service" || value === "location" || value === "appointment" || value === "review" || value === "promo" || value === "slot";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return null;
}

function fullName(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  const firstName = stringValue(value.firstName);
  const lastName = stringValue(value.lastName);
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

function compactData(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function isCard(value: unknown): value is CrmAgentCard {
  return isRecord(value) && isEntityType(value.type) && (typeof value.id === "number" || typeof value.id === "string") && typeof value.title === "string";
}

function parsePreviousThreadState(value: unknown): CrmAgentThreadStateSnapshot | null {
  if (!isRecord(value)) return null;
  const latestCards = Array.isArray(value.latestCards) ? value.latestCards.filter(isCard) : [];
  const latestEntities = Array.isArray(value.latestEntities) ? value.latestEntities as CrmAgentEntity[] : latestCards.map((card) => ({
    type: card.type,
    id: card.id,
    title: card.title,
    subtitle: card.subtitle,
    meta: card.meta,
    data: card.data,
  }));
  const selectedEntity = isRecord(value.selectedEntity) && isEntityType(value.selectedEntity.type) && (typeof value.selectedEntity.id === "number" || typeof value.selectedEntity.id === "string")
    ? { type: value.selectedEntity.type, id: value.selectedEntity.id }
    : null;
  return {
    latestEntities,
    latestCards,
    selectedEntity,
    pendingClarification: (value.pendingClarification ?? null) as Prisma.JsonValue | null,
    lastToolName: typeof value.lastToolName === "string" ? value.lastToolName : null,
    activeTask: (value.activeTask ?? null) as Prisma.JsonValue | null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

function cardFromClient(client: unknown): CrmAgentCard | null {
  if (!isRecord(client)) return null;
  const id = numberValue(client.id);
  if (id == null) return null;
  const name = [stringValue(client.firstName), stringValue(client.lastName)].filter(Boolean).join(" ").trim() || `Клиент #${id}`;
  const meta = [stringValue(client.email), Array.isArray(client.tags) ? client.tags.filter((item): item is string => typeof item === "string").slice(0, 3).join(", ") : null].filter(Boolean) as string[];
  return {
    type: "client",
    id,
    title: name,
    subtitle: stringValue(client.phone),
    meta,
    data: compactData(client),
    actions: [
      { intent: "open_profile", label: "Открыть" },
      { intent: "create_appointment", label: "Записать" },
      { intent: "send_message", label: "Написать" },
      { intent: "show_visits", label: "Визиты" },
    ],
  };
}

function cardFromSpecialist(specialist: unknown): CrmAgentCard | null {
  if (!isRecord(specialist)) return null;
  const id = numberValue(specialist.id);
  if (id == null) return null;
  const profile = isRecord(specialist.profile) ? specialist.profile : null;
  const title = fullName(profile) || `Сотрудник #${id}`;
  const services = Array.isArray(specialist.services)
    ? specialist.services.map((item) => (isRecord(item) ? stringValue(item.name) : null)).filter(Boolean).slice(0, 3)
    : [];
  const locations = Array.isArray(specialist.locations)
    ? specialist.locations.map((item) => (isRecord(item) ? stringValue(item.name) : null)).filter(Boolean).slice(0, 2)
    : [];
  return {
    type: "specialist",
    id,
    title,
    subtitle: firstString(specialist.bio, services.join(", ")),
    meta: locations as string[],
    data: compactData(specialist),
    actions: [
      { intent: "open_profile", label: "Открыть" },
      { intent: "show_schedule", label: "График" },
      { intent: "set_workday", label: "Рабочий день" },
      { intent: "find_slots", label: "Окна" },
    ],
  };
}

function cardFromService(service: unknown): CrmAgentCard | null {
  if (!isRecord(service)) return null;
  const id = numberValue(service.id);
  if (id == null) return null;
  const price = firstString(service.basePrice);
  const duration = numberValue(service.baseDurationMin);
  return {
    type: "service",
    id,
    title: stringValue(service.name) || `Услуга #${id}`,
    subtitle: [price ? `${price} ₽` : null, duration ? `${duration} мин` : null].filter(Boolean).join(" · ") || stringValue(service.description),
    meta: [isRecord(service.category) ? stringValue(service.category.name) : null, service.isActive === false ? "Архив" : null].filter(Boolean) as string[],
    data: compactData(service),
    actions: [
      { intent: "open_profile", label: "Открыть" },
      { intent: "create_appointment", label: "Записать" },
      { intent: "edit_service", label: "Изменить" },
    ],
  };
}

function cardFromLocation(location: unknown): CrmAgentCard | null {
  if (!isRecord(location)) return null;
  const id = numberValue(location.id);
  if (id == null) return null;
  return {
    type: "location",
    id,
    title: stringValue(location.name) || `Локация #${id}`,
    subtitle: stringValue(location.address),
    meta: [stringValue(location.phone), stringValue(location.status)].filter(Boolean) as string[],
    data: compactData(location),
    actions: [
      { intent: "open_profile", label: "Открыть" },
      { intent: "show_schedule", label: "График" },
      { intent: "edit_location", label: "Изменить" },
    ],
  };
}

function cardFromAppointment(appointment: unknown): CrmAgentCard | null {
  if (!isRecord(appointment)) return null;
  const id = numberValue(appointment.id);
  if (id == null) return null;
  const client = isRecord(appointment.client) ? appointment.client : null;
  const specialist = isRecord(appointment.specialist) ? appointment.specialist : null;
  const profile = isRecord(specialist?.user) && isRecord(specialist.user.profile) ? specialist.user.profile : null;
  const services = Array.isArray(appointment.services)
    ? appointment.services.map((item) => (isRecord(item) ? stringValue(item.name) : null)).filter(Boolean).slice(0, 3)
    : [];
  return {
    type: "appointment",
    id,
    title: `Запись #${id}`,
    subtitle: [fullName(client), services.join(", ")].filter(Boolean).join(" · "),
    meta: [stringValue(appointment.status), fullName(profile), isRecord(appointment.location) ? stringValue(appointment.location.name) : null].filter(Boolean) as string[],
    data: compactData(appointment),
    actions: [
      { intent: "open_profile", label: "Открыть" },
      { intent: "reschedule_appointment", label: "Перенести" },
      { intent: "cancel_appointment", label: "Отменить" },
    ],
  };
}

function cardFromReview(review: unknown): CrmAgentCard | null {
  if (!isRecord(review)) return null;
  const id = numberValue(review.id);
  if (id == null) return null;
  const client = isRecord(review.client) ? review.client : null;
  return {
    type: "review",
    id,
    title: `Отзыв ${numberValue(review.rating) ?? "?"}/5`,
    subtitle: stringValue(review.comment),
    meta: [fullName(client), stringValue(review.status), review.replyText ? "Есть ответ" : "Без ответа"].filter(Boolean) as string[],
    data: compactData(review),
    actions: [
      { intent: "open_profile", label: "Открыть" },
      { intent: "reply_review", label: "Ответить" },
    ],
  };
}

function cardFromPromo(promo: unknown): CrmAgentCard | null {
  if (!isRecord(promo)) return null;
  const id = numberValue(promo.id);
  if (id == null) return null;
  return {
    type: "promo",
    id,
    title: stringValue(promo.name) || `Акция #${id}`,
    subtitle: [stringValue(promo.type), firstString(promo.value)].filter(Boolean).join(" · "),
    meta: [promo.isActive === false ? "Неактивна" : "Активна"].filter(Boolean),
    data: compactData(promo),
    actions: [
      { intent: "open_profile", label: "Открыть" },
      { intent: "edit_promo", label: "Изменить" },
    ],
  };
}

function cardFromSlot(slot: unknown, index: number): CrmAgentCard | null {
  if (!isRecord(slot)) return null;
  const startAt = stringValue(slot.startAt);
  if (!startAt) return null;
  const id = `${startAt}:${numberValue(slot.specialistId) ?? ""}:${numberValue(slot.locationId) ?? ""}`;
  return {
    type: "slot",
    id,
    title: `Окно ${index + 1}`,
    subtitle: startAt,
    meta: [stringValue(slot.specialistName), stringValue(slot.locationName), stringValue(slot.serviceName)].filter(Boolean) as string[],
    data: compactData(slot),
    actions: [
      { intent: "create_appointment", label: "Записать" },
      { intent: "send_message", label: "Предложить клиенту" },
    ],
  };
}

function cardsFromResult(result: unknown) {
  if (!isRecord(result)) return [];
  const builders: Array<[string, (item: unknown, index: number) => CrmAgentCard | null]> = [
    ["clients", (item) => cardFromClient(item)],
    ["specialists", (item) => cardFromSpecialist(item)],
    ["services", (item) => cardFromService(item)],
    ["locations", (item) => cardFromLocation(item)],
    ["appointments", (item) => cardFromAppointment(item)],
    ["reviews", (item) => cardFromReview(item)],
    ["promotions", (item) => cardFromPromo(item)],
    ["slots", (item, index) => cardFromSlot(item, index)],
  ];

  const cards: CrmAgentCard[] = [];
  for (const [key, build] of builders) {
    const items = result[key];
    if (!Array.isArray(items)) continue;
    for (const [index, item] of items.entries()) {
      const card = build(item, index);
      if (card) cards.push(card);
      if (cards.length >= 12) return cards;
    }
  }
  return cards;
}

export function buildCrmAgentStructuredResponse(input: {
  selectedToolName: string | null;
  toolResult: Prisma.JsonValue | null;
  toolSteps: CrmAgentLlmObservation[];
  previousThreadState?: unknown;
  selectedEntity?: { type: CrmAgentEntityType; id: number | string } | null;
  pendingClarification?: Prisma.JsonValue | null;
  activeTask?: Prisma.JsonValue | null;
}) {
  const previousThreadState = parsePreviousThreadState(input.previousThreadState);
  const cardsByKey = new Map<string, CrmAgentCard>();
  const collect = (result: unknown) => {
    for (const card of cardsFromResult(result)) {
      cardsByKey.set(`${card.type}:${card.id}`, card);
    }
  };

  collect(input.toolResult);
  for (const step of input.toolSteps) collect(step.result);

  const newCards = Array.from(cardsByKey.values()).slice(0, 12);
  const cards = newCards.length ? newCards : previousThreadState?.latestCards ?? [];
  const entities = cards.map((card) => ({
    type: card.type,
    id: card.id,
    title: card.title,
    subtitle: card.subtitle,
    meta: card.meta,
    data: card.data,
  }));
  const suggestedActions: CrmAgentSuggestedAction[] = cards.slice(0, 4).flatMap((card) =>
    card.actions.slice(0, 2).map((action) => ({
      intent: action.intent,
      label: action.label,
      entity: { type: card.type, id: card.id },
    })),
  );
  const threadState: CrmAgentThreadStateSnapshot = {
    latestEntities: entities,
    latestCards: cards,
    selectedEntity: input.selectedEntity ?? (newCards.length && entities[0] ? { type: entities[0].type, id: entities[0].id } : previousThreadState?.selectedEntity ?? null),
    pendingClarification: input.pendingClarification ?? null,
    lastToolName: input.selectedToolName ?? previousThreadState?.lastToolName ?? null,
    activeTask: input.activeTask !== undefined ? input.activeTask : previousThreadState?.activeTask ?? null,
    updatedAt: new Date().toISOString(),
  };

  return {
    entities,
    cards,
    suggestedActions,
    clarification: input.pendingClarification ?? null,
    threadState,
  };
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export function buildCrmAgentGroundedAnswer(input: {
  selectedToolName: string | null;
  toolResult: Prisma.JsonValue | null;
  cards: CrmAgentCard[];
}) {
  const tool = input.selectedToolName;
  const cards = input.cards;
  if (!tool || !cards.length) return null;

  if (tool === "clients.search") {
    return `Нашёл клиентов: ${cards.filter((card) => card.type === "client").slice(0, 8).map((card) => card.title).join("; ")}.`;
  }
  if (tool === "services.search") {
    return `Нашёл услуги: ${cards.filter((card) => card.type === "service").slice(0, 8).map((card) => [card.title, card.subtitle].filter(Boolean).join(" - ")).join("; ")}.`;
  }
  if (tool === "specialists.search") {
    return `Нашёл сотрудников: ${cards.filter((card) => card.type === "specialist").slice(0, 8).map((card) => [card.title, card.subtitle].filter(Boolean).join(" - ")).join("; ")}.`;
  }
  if (tool === "locations.search") {
    return `Нашёл локации: ${cards.filter((card) => card.type === "location").slice(0, 8).map((card) => [card.title, card.subtitle].filter(Boolean).join(" - ")).join("; ")}.`;
  }
  if (tool === "promos.search") {
    return `Нашёл акции: ${cards.filter((card) => card.type === "promo").slice(0, 8).map((card) => [card.title, card.subtitle].filter(Boolean).join(" - ")).join("; ")}.`;
  }
  if (tool === "reviews.search") {
    return `Нашёл отзывы: ${cards.filter((card) => card.type === "review").slice(0, 8).map((card) => [card.title, card.subtitle].filter(Boolean).join(" - ")).join("; ")}.`;
  }
  if (tool === "appointments.search") {
    return `Нашёл записи: ${cards.filter((card) => card.type === "appointment").slice(0, 8).map((card) => [card.title, card.subtitle, ...(card.meta ?? [])].filter(Boolean).join(" - ")).join("; ")}.`;
  }
  if (tool === "appointments.findAvailableSlots") {
    const slots = cards.filter((card) => card.type === "slot").slice(0, 8).map((card) => {
      const data = isRecord(card.data) ? card.data : {};
      return [formatDateTime(data.startAt), ...(card.meta ?? [])].filter(Boolean).join(" - ");
    });
    return slots.length ? `Нашёл свободные окна: ${slots.join("; ")}.` : "Свободных окон по заданным условиям не нашёл.";
  }

  return null;
}
