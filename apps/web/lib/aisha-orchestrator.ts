import { createGigaChatCompletion } from "@/lib/gigachat";

export type TimePreference = "morning" | "day" | "evening" | null;

export type AishaNluIntent =
  | "greeting"
  | "smalltalk"
  | "identity"
  | "capabilities"
  | "contact_phone"
  | "contact_address"
  | "working_hours"
  | "ask_services"
  | "ask_price"
  | "ask_specialists"
  | "ask_availability"
  | "booking"
  | "update_booking"
  | "ask_status"
  | "confirm"
  | "consent"
  | "mode_self"
  | "mode_assistant"
  | "reject_or_change"
  | "reschedule"
  | "cancel_booking"
  | "my_bookings"
  | "my_stats"
  | "cancel_my_booking"
  | "reschedule_my_booking"
  | "repeat_booking"
  | "client_profile"
  | "out_of_scope"
  | "abuse_or_toxic"
  | "gratitude"
  | "unknown";

export type AishaNlu = {
  intent: AishaNluIntent;
  reply?: string | null;
  confidence?: number | null;
  locationId?: number | null;
  serviceId?: number | null;
  specialistId?: number | null;
  date?: string | null;
  time?: string | null;
  timePreference?: TimePreference;
  clientName?: string | null;
  clientPhone?: string | null;
};

type RunAishaNluArgs = {
  message: string;
  nowYmd: string;
  clientTimeZone?: string | null;
  draft: {
    locationId: number | null;
    serviceId: number | null;
    specialistId: number | null;
    date: string | null;
    time: string | null;
    clientName: string | null;
    clientPhone: string | null;
    mode: "SELF" | "ASSISTANT" | null;
    status: string;
    consentConfirmedAt: string | null;
  };
  account: { id: number; slug: string; timeZone: string };
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  locations: Array<{ id: number; name: string; address: string | null }>;
  services: Array<{ id: number; name: string; baseDurationMin: number; basePrice: number }>;
  specialists: Array<{ id: number; name: string }>;
  recentMessages: Array<{ role: string; content: string }>;
  systemPrompt?: string | null;
};

type RunAishaNluResult = {
  nlu: AishaNlu | null;
  source: "llm" | "fallback";
  reason?: string;
};

type RunAishaSmallTalkArgs = {
  message: string;
  assistantName: string;
  recentMessages: Array<{ role: string; content: string }>;
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  knownClientName?: string | null;
};

const NLU_FAIL_THRESHOLD = 3;
const NLU_COOLDOWN_MS = 2 * 60_000;

let nluFailures = 0;
let nluDisabledUntil = 0;

const ALLOWED_INTENTS: AishaNluIntent[] = [
  "greeting",
  "smalltalk",
  "identity",
  "capabilities",
  "contact_phone",
  "contact_address",
  "working_hours",
  "ask_services",
  "ask_price",
  "ask_specialists",
  "ask_availability",
  "booking",
  "update_booking",
  "ask_status",
  "confirm",
  "consent",
  "mode_self",
  "mode_assistant",
  "reject_or_change",
  "reschedule",
  "cancel_booking",
  "my_bookings",
  "my_stats",
  "cancel_my_booking",
  "reschedule_my_booking",
  "repeat_booking",
  "client_profile",
  "out_of_scope",
  "abuse_or_toxic",
  "gratitude",
  "unknown",
];

function canUseNlu() {
  return Boolean(process.env.GIGACHAT_AUTH_KEY?.trim()) && Date.now() >= nluDisabledUntil;
}

function markNluSuccess() {
  nluFailures = 0;
  nluDisabledUntil = 0;
}

function markNluFailure() {
  nluFailures += 1;
  if (nluFailures >= NLU_FAIL_THRESHOLD) {
    nluDisabledUntil = Date.now() + NLU_COOLDOWN_MS;
    nluFailures = 0;
  }
}

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isHmTime(v: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function extractJsonObject(text: string) {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0 || e <= s) return null;
  const raw = text.slice(s, e + 1);
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeNlu(parsed: Record<string, unknown>): AishaNlu {
  const intentRaw = String(parsed.intent ?? "unknown");
  const intent = (ALLOWED_INTENTS.includes(intentRaw as AishaNluIntent)
    ? intentRaw
    : "unknown") as AishaNluIntent;

  const asNumOrNull = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const date = typeof parsed.date === "string" && isIsoDate(parsed.date) ? parsed.date : null;
  const time = typeof parsed.time === "string" && isHmTime(parsed.time) ? parsed.time : null;
  const timePreference =
    parsed.timePreference === "morning" || parsed.timePreference === "day" || parsed.timePreference === "evening"
      ? (parsed.timePreference as TimePreference)
      : null;

  return {
    intent,
    reply: typeof parsed.reply === "string" ? parsed.reply.trim().slice(0, 500) : null,
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : null,
    locationId: asNumOrNull(parsed.locationId),
    serviceId: asNumOrNull(parsed.serviceId),
    specialistId: asNumOrNull(parsed.specialistId),
    date,
    time,
    timePreference,
    clientName: typeof parsed.clientName === "string" ? parsed.clientName.trim().slice(0, 80) : null,
    clientPhone: typeof parsed.clientPhone === "string" ? parsed.clientPhone.trim().slice(0, 40) : null,
  };
}

export async function runAishaNlu(args: RunAishaNluArgs): Promise<RunAishaNluResult> {
  if (!canUseNlu()) return { nlu: null, source: "fallback", reason: "disabled_or_no_key" };

  const context = {
    account: {
      id: args.account.id,
      slug: args.account.slug,
      timeZone: args.account.timeZone,
      clientTimeZone: args.clientTimeZone ?? null,
      today: args.nowYmd,
      profile: args.accountProfile,
    },
    draft: args.draft,
    locations: args.locations,
    services: args.services.map((x) => ({ id: x.id, name: x.name, duration: x.baseDurationMin, price: x.basePrice })),
    specialists: args.specialists,
    recentMessages: args.recentMessages.slice(-10),
  };

  const prompt = [
    "Ты модуль NLU для ассистента записи Аиша.",
    "Верни только JSON без markdown.",
    "Никогда не выдумывай ID сущностей, используй только IDs из CONTEXT.",
    "Если сущность не уверена — верни null.",
    "date формат YYYY-MM-DD, time формат HH:mm.",
    `Допустимые intents: ${ALLOWED_INTENTS.join(", ")}.`,
    "Для confidence верни число от 0 до 1.",
    "Для smalltalk/gratitude можно добавить короткий вежливый reply на русском.",
    "JSON schema:",
    '{"intent":"unknown","reply":null,"confidence":0.0,"locationId":null,"serviceId":null,"specialistId":null,"date":null,"time":null,"timePreference":null,"clientName":null,"clientPhone":null}',
    args.systemPrompt ? `CUSTOM_SYSTEM_PROMPT: ${args.systemPrompt}` : "",
    `CONTEXT: ${JSON.stringify(context)}`,
    `USER_MESSAGE: ${args.message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Извлекай структуру. Только JSON." },
      { role: "user", content: prompt },
    ]);
    const parsed = extractJsonObject(completion.content);
    if (!parsed) {
      markNluFailure();
      return { nlu: null, source: "fallback", reason: "invalid_json" };
    }
    const nlu = normalizeNlu(parsed);
    markNluSuccess();
    return { nlu, source: "llm" };
  } catch {
    markNluFailure();
    return { nlu: null, source: "fallback", reason: "llm_error" };
  }
}

export async function runAishaSmallTalkReply(args: RunAishaSmallTalkArgs): Promise<string | null> {
  if (!canUseNlu()) return null;

  const prompt = [
    `Ты ${args.assistantName}, женский персонаж, дружелюбный AI-ассистент записи.`,
    "Ты работаешь в бьюти-бизнесе аккаунта из контекста (студия, салон, частный мастер и т.п.) и обсуждаешь только этот домен.",
    "Отвечай только на русском, естественно, коротко (1-3 предложения).",
    "Никогда не говори, что ты NLU-модуль, классификатор или системный компонент.",
    "Никогда не предлагай записывать встречи, звонки, мысли и т.п.",
    "Никогда не выдумывай услуги, которых нет в переданном контексте.",
    "Если спрашивают про услуги, перечисляй только услуги из контекста или попроси уточнить.",
    "Никогда не выдумывай цены или длительности услуг.",
    "Если пользователь спрашивает стоимость, но в сообщении нет точной услуги из контекста, предложи уточнить услугу.",
    "Числовые значения цены/длительности можно называть только если они есть в переданном контексте.",
    "Если спрашивают про телефон — если есть номер в профиле, можно его назвать.",
    args.knownClientName ? `Имя клиента: ${args.knownClientName}` : "Имя клиента неизвестно.",
    args.accountProfile?.description ? `Описание бизнеса: ${args.accountProfile.description}` : "",
    args.accountProfile?.address ? `Адрес: ${args.accountProfile.address}` : "",
    args.accountProfile?.phone ? `Телефон студии: ${args.accountProfile.phone}` : "",
    `История: ${JSON.stringify(args.recentMessages.slice(-10))}`,
    `Сообщение пользователя: ${args.message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Ты вежливый ассистент записи бьюти-услуг аккаунта из контекста." },
      { role: "user", content: prompt },
    ]);
    const text = completion.content?.trim();
    return text ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}
