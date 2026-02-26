import { createGigaChatCompletion } from "@/lib/gigachat";

export type TimePreference = "morning" | "day" | "evening" | null;

export type AishaNlu = {
  intent:
    | "smalltalk"
    | "booking"
    | "update_booking"
    | "ask_availability"
    | "ask_status"
    | "confirm"
    | "consent"
    | "mode_self"
    | "mode_assistant"
    | "gratitude"
    | "unknown";
  reply?: string | null;
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
  const allowed = new Set<AishaNlu["intent"]>([
    "smalltalk",
    "booking",
    "update_booking",
    "ask_availability",
    "ask_status",
    "confirm",
    "consent",
    "mode_self",
    "mode_assistant",
    "gratitude",
    "unknown",
  ]);
  const intent = allowed.has(intentRaw as AishaNlu["intent"])
    ? (intentRaw as AishaNlu["intent"])
    : "unknown";
  const asNumOrNull = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const date = typeof parsed.date === "string" && isIsoDate(parsed.date) ? parsed.date : null;
  const time = typeof parsed.time === "string" && isHmTime(parsed.time) ? parsed.time : null;
  const timePreference =
    parsed.timePreference === "morning" ||
    parsed.timePreference === "day" ||
    parsed.timePreference === "evening"
      ? (parsed.timePreference as TimePreference)
      : null;

  return {
    intent,
    reply: typeof parsed.reply === "string" ? parsed.reply.trim().slice(0, 400) : null,
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
  if (!canUseNlu()) {
    return { nlu: null, source: "fallback", reason: "disabled_or_no_key" };
  }

  const businessKind = args.specialists.length <= 1 ? "private_master_or_small_studio" : "beauty_salon";
  const context = {
    account: {
      id: args.account.id,
      slug: args.account.slug,
      timeZone: args.account.timeZone,
      today: args.nowYmd,
      businessKind,
      profile: args.accountProfile,
    },
    draft: args.draft,
    locations: args.locations.map((x) => ({ id: x.id, name: x.name, address: x.address })),
    services: args.services.map((x) => ({ id: x.id, name: x.name, duration: x.baseDurationMin, price: x.basePrice })),
    specialists: args.specialists.map((x) => ({ id: x.id, name: x.name })),
    recentMessages: args.recentMessages.slice(-8),
  };

  const prompt = [
    "Ты NLU-модуль ассистента записи Аиша.",
    "Для reply всегда используй женский род (например: 'рада', 'поняла').",
    "Верни ТОЛЬКО JSON без markdown.",
    "Определи intent и извлеки сущности из user сообщения в контексте салона.",
    "Сопоставляй разговорные формы, уменьшительные, сленг, опечатки и транслит с сущностями из CONTEXT.",
    "Для locationId/serviceId/specialistId выбирай id только из CONTEXT, даже если в сообщении нет точного совпадения названия.",
    "Примеры: 'машка' ~ 'Мария', 'бьюти центр' ~ 'Beauty Salon Center', 'стрижка от саши' ~ услуга haircut + специалист с именем из контекста.",
    "Если уверенно сопоставить сущность нельзя, верни null (не выдумывай id).",
    "date верни в формате YYYY-MM-DD, time в HH:mm.",
    "Если пользователь написал день недели (например, 'в субботу'), верни ближайшую будущую дату от account.today.",
    "Если поле не найдено, верни null.",
    "Допустимые intent: smalltalk, booking, update_booking, ask_availability, ask_status, confirm, consent, mode_self, mode_assistant, gratitude, unknown.",
    "timePreference: morning|day|evening|null.",
    "Для smalltalk/gratitude добавь короткий дружелюбный reply на русском.",
    "JSON schema:",
    '{"intent":"unknown","reply":null,"locationId":null,"serviceId":null,"specialistId":null,"date":null,"time":null,"timePreference":null,"clientName":null,"clientPhone":null}',
    args.systemPrompt ? `CUSTOM_SYSTEM_PROMPT: ${args.systemPrompt}` : "",
    `CONTEXT: ${JSON.stringify(context)}`,
    `USER_MESSAGE: ${args.message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Ты извлекаешь структуру. Никакого текста кроме JSON." },
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
    "Отвечай только на русском, естественно, коротко (1-3 предложения).",
    "Никогда не говори, что ты NLU-модуль, классификатор, модель или системный компонент.",
    "Если спрашивают 'кто ты' или имя: представься как Аиша, ассистент записи.",
    "Если спрашивают 'сколько тебе лет': скажи, что ты виртуальный ассистент без возраста.",
    "Если спрашивают 'как меня зовут': назови имя только если оно известно, иначе честно скажи, что не знаешь и попроси подсказать.",
    "Можно поддержать лёгкий разговор, но мягко возвращай к теме записи, без навязчивости.",
    "Если пользователь грубит, отвечай спокойно и без конфликта.",
    args.knownClientName ? `Известное имя клиента: ${args.knownClientName}` : "Имя клиента неизвестно.",
    args.accountProfile?.description ? `Контекст бизнеса: ${args.accountProfile.description}` : "",
    args.accountProfile?.address ? `Адрес: ${args.accountProfile.address}` : "",
    `История (последние сообщения): ${JSON.stringify(args.recentMessages.slice(-10))}`,
    `Сообщение пользователя: ${args.message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Ты ведешь вежливый диалог и отвечаешь кратко." },
      { role: "user", content: prompt },
    ]);
    const text = completion.content?.trim();
    return text ? text.slice(0, 400) : null;
  } catch {
    return null;
  }
}
