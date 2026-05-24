import type { Prisma } from "@prisma/client";
import type { CrmAgentCard, CrmAgentEntityType, CrmAgentThreadStateSnapshot } from "@/lib/crm-agent-structured-response";

type PendingActionLike = {
  id: number;
  actionType: string;
  summary: string;
};

export type CrmAgentContinuationResolution =
  | {
      kind: "select_entity";
      entity: { type: CrmAgentEntityType; id: number | string };
      card: CrmAgentCard;
      confidence: number;
      reason: "ordinal" | "name" | "time" | "earliest" | "pronoun";
    }
  | {
      kind: "confirm_pending_action";
      actionId: number;
      confidence: number;
    }
  | {
      kind: "cancel_pending_action";
      actionId: number;
      confidence: number;
    }
  | {
      kind: "clarify";
      confidence: number;
      question: string;
      options: Array<{ label: string; value: Prisma.JsonValue }>;
    }
  | {
      kind: "correction";
      confidence: number;
      patch: Prisma.JsonObject;
    }
  | {
      kind: "none";
      confidence: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[#№]/g, " ")
    .replace(/[^\p{L}\p{N}:.\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseThreadState(value: unknown): CrmAgentThreadStateSnapshot | null {
  if (!isRecord(value)) return null;
  const latestCards = Array.isArray(value.latestCards) ? value.latestCards.filter(isCard) : [];
  const latestEntities = Array.isArray(value.latestEntities) ? value.latestEntities : latestCards;
  const selectedEntity = isRecord(value.selectedEntity) && isEntityType(value.selectedEntity.type) && (typeof value.selectedEntity.id === "number" || typeof value.selectedEntity.id === "string")
    ? { type: value.selectedEntity.type, id: value.selectedEntity.id }
    : null;
  return {
    latestEntities: latestEntities as CrmAgentThreadStateSnapshot["latestEntities"],
    latestCards,
    selectedEntity,
    pendingClarification: (value.pendingClarification ?? null) as Prisma.JsonValue | null,
    lastToolName: typeof value.lastToolName === "string" ? value.lastToolName : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

function isEntityType(value: unknown): value is CrmAgentEntityType {
  return value === "client" || value === "specialist" || value === "service" || value === "location" || value === "appointment" || value === "review" || value === "promo" || value === "slot";
}

function isCard(value: unknown): value is CrmAgentCard {
  return isRecord(value) && isEntityType(value.type) && (typeof value.id === "number" || typeof value.id === "string") && typeof value.title === "string";
}

function cardSearchText(card: CrmAgentCard) {
  return normalizeText([
    card.title,
    card.subtitle,
    ...(Array.isArray(card.meta) ? card.meta : []),
    isRecord(card.data) ? JSON.stringify(card.data) : "",
  ].filter(Boolean).join(" "));
}

function parseOrdinal(text: string) {
  if (/\b(1|перв(?:ый|ая|ое|ого|ую)|верхн(?:ий|яя|ее)|сверху)\b/u.test(text)) return 0;
  if (/\b(2|втор(?:ой|ая|ое|ого|ую))\b/u.test(text)) return 1;
  if (/\b(3|трет(?:ий|ья|ье|ьего|ью))\b/u.test(text)) return 2;
  if (/\b(4|четверт(?:ый|ая|ое|ого|ую))\b/u.test(text)) return 3;
  if (/\b(5|пят(?:ый|ая|ое|ого|ую))\b/u.test(text)) return 4;
  return null;
}

function parseTime(text: string) {
  const match = text.match(/\b(?:в\s*)?(\d{1,2})(?::(\d{2}))?\b/u);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function detectTypeHint(text: string): CrmAgentEntityType | null {
  if (/\b(клиент|клиента|клиенту)\b/u.test(text)) return "client";
  if (/\b(сотрудник|сотрудника|сотруднику|мастер|мастера|мастеру|специалист|специалиста)\b/u.test(text)) return "specialist";
  if (/\b(услуга|услугу|услуги)\b/u.test(text)) return "service";
  if (/\b(локация|локацию|филиал|филиала|адрес)\b/u.test(text)) return "location";
  if (/\b(запись|записи|визит|визита)\b/u.test(text)) return "appointment";
  if (/\b(отзыв|отзыва)\b/u.test(text)) return "review";
  if (/\b(акция|акцию|промо|скидка|скидку)\b/u.test(text)) return "promo";
  if (/\b(окно|окошко|слот|время)\b/u.test(text)) return "slot";
  return null;
}

function wordStem(token: string) {
  return token
    .replace(/(ого|ему|ыми|ими|ыми|ами|ями|ую|юю|ая|яя|ое|ее|ий|ый|ой|ых|их|ам|ям|ом|ем|ах|ях|у|ю|а|я|е|ы|и)$/u, "")
    .trim();
}

function tokenMatches(haystack: string, token: string) {
  if (haystack.includes(token)) return true;
  const stem = wordStem(token);
  return stem.length >= 3 && haystack.includes(stem);
}

function selectedCard(cards: CrmAgentCard[], selectedEntity: CrmAgentThreadStateSnapshot["selectedEntity"]) {
  if (!selectedEntity) return null;
  return cards.find((card) => card.type === selectedEntity.type && String(card.id) === String(selectedEntity.id)) ?? null;
}

function clarificationForCards(question: string, cards: CrmAgentCard[]) {
  return {
    kind: "clarify" as const,
    confidence: 0.78,
    question,
    options: cards.slice(0, 6).map((card) => ({
      label: card.title,
      value: { type: card.type, id: card.id } as Prisma.JsonObject,
    })),
  };
}

function resolveEntitySelection(message: string, state: CrmAgentThreadStateSnapshot): CrmAgentContinuationResolution | null {
  const text = normalizeText(message);
  const cards = state.latestCards ?? [];
  if (!cards.length) return null;

  if (/\b(ее|её|его|этому|этой|этого|для нее|для неё|для него|того сотрудника|этого клиента|эту запись)\b/u.test(text)) {
    const card = selectedCard(cards, state.selectedEntity);
    if (card) return { kind: "select_entity", entity: { type: card.type, id: card.id }, card, confidence: 0.86, reason: "pronoun" };
  }

  if (/\b(сам(?:ый|ое|ая)\s+ранн(?:ий|ее|яя)|раньше|перв(?:ое|ый|ая)\s+окно)\b/u.test(text)) {
    const slots = cards.filter((card) => card.type === "slot");
    const sorted = slots
      .map((card) => ({ card, time: typeof card.subtitle === "string" ? Date.parse(card.subtitle) : Number.NaN }))
      .filter((item) => Number.isFinite(item.time))
      .sort((a, b) => a.time - b.time);
    const card = sorted[0]?.card ?? slots[0];
    if (card) return { kind: "select_entity", entity: { type: card.type, id: card.id }, card, confidence: 0.9, reason: "earliest" };
  }

  const ordinal = parseOrdinal(text);
  if (ordinal != null && /\b(выбери|давай|вариант|клиент|сотрудник|запись|окно|слот|услуга|локация|акция|отзыв|перв|втор|трет|четверт|пят|верхн|\d)\b/u.test(text)) {
    const typeHint = detectTypeHint(text);
    const scopedCards = typeHint ? cards.filter((card) => card.type === typeHint) : cards;
    const card = scopedCards[ordinal];
    if (card) return { kind: "select_entity", entity: { type: card.type, id: card.id }, card, confidence: 0.92, reason: "ordinal" };
  }

  const time = parseTime(text);
  if (time && /\b(окно|слот|время|тот|котор)\b/u.test(text)) {
    const matches = cards.filter((card) => card.type === "slot" && cardSearchText(card).includes(time));
    if (matches.length === 1) {
      const card = matches[0];
      return { kind: "select_entity", entity: { type: card.type, id: card.id }, card, confidence: 0.9, reason: "time" };
    }
    if (matches.length > 1) return clarificationForCards(`Found several slots at ${time}. Which one should I use?`, matches);
  }

  const nameQuery = text
    .replace(/\b(выбери|давай|возьми|нужн(?:о|а|ый)|клиент(?:а|у)?|сотрудник(?:а|у)?|мастер(?:а|у)?|услуг(?:у|а|и)|локаци(?:ю|я|и)|запис(?:ь|и)|окно|слот|тот|та|это|эту|этого|этому)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (nameQuery.length >= 3) {
    const tokens = nameQuery.split(" ").filter((token) => token.length >= 3);
    const matches = tokens.length
      ? cards.filter((card) => {
          const haystack = cardSearchText(card);
          return tokens.every((token) => tokenMatches(haystack, token));
        })
      : [];
    if (matches.length === 1) {
      const card = matches[0];
      return { kind: "select_entity", entity: { type: card.type, id: card.id }, card, confidence: 0.84, reason: "name" };
    }
    if (matches.length > 1) return clarificationForCards("Found several matching items. Which one should I use?", matches);
  }

  return null;
}

function resolvePendingAction(message: string, pendingActions: PendingActionLike[]): CrmAgentContinuationResolution | null {
  const text = normalizeText(message);
  const confirm = /^(да|ок|окей|хорошо|подтверждаю|применяй|делай|отправляй|можно|верно|согласен|согласна)\b/u.test(text);
  const cancel = /^(отмена|отмени|не надо|сбрось|не применяй|стоп|не отправляй)\b/u.test(text);
  if (!confirm && !cancel) return null;
  if (!pendingActions.length) {
    return { kind: "clarify", confidence: 0.7, question: "There is no pending action to confirm or cancel.", options: [] };
  }
  if (pendingActions.length === 1) {
    return confirm
      ? { kind: "confirm_pending_action", actionId: pendingActions[0].id, confidence: 0.95 }
      : { kind: "cancel_pending_action", actionId: pendingActions[0].id, confidence: 0.95 };
  }
  return {
    kind: "clarify",
    confidence: 0.82,
    question: confirm ? "Which action should I confirm?" : "Which action should I cancel?",
    options: pendingActions.slice(0, 6).map((action) => ({
      label: action.summary || `${action.actionType} #${action.id}`,
      value: { actionId: action.id } as Prisma.JsonObject,
    })),
  };
}

function resolveCorrection(message: string): CrmAgentContinuationResolution | null {
  const text = normalizeText(message);
  const time = parseTime(text);
  const hasCorrection = /\b(не\s+в|а\s+в|лучше|другая|другую|такое же время|перенеси|измени)\b/u.test(text);
  if (!hasCorrection) return null;
  const patch: Prisma.JsonObject = {};
  if (time) patch.time = time;
  if (/\b(завтра|сегодня|послезавтра|пятниц|суббот|воскрес|понедельник|вторник|среду|четверг)\b/u.test(text)) patch.dateHint = text;
  if (/\b(другая|другую)\s+локац/u.test(text)) patch.location = "another";
  if (!Object.keys(patch).length) return { kind: "clarify", confidence: 0.62, question: "What exactly should I change?", options: [] };
  return { kind: "correction", confidence: 0.74, patch };
}

export function resolveThreadContinuation(input: {
  message: string;
  threadState: unknown;
  pendingActions: PendingActionLike[];
}): CrmAgentContinuationResolution {
  const state = parseThreadState(input.threadState);
  const pending = resolvePendingAction(input.message, input.pendingActions);
  if (pending) return pending;

  if (state) {
    const entity = resolveEntitySelection(input.message, state);
    if (entity) return entity;
  }

  const correction = resolveCorrection(input.message);
  if (correction) return correction;

  return { kind: "none", confidence: 0 };
}
