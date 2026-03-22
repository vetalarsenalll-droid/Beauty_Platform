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
  clientEmail?: string | null;
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
    clientEmail: string | null;
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
  accountId: number;
  message: string;
  assistantName: string;
  recentMessages: Array<{ role: string; content: string }>;
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  locations: Array<{ id: number; name: string; address: string | null }>;
  services: Array<{ id: number; name: string; baseDurationMin: number; basePrice: number }>;
  specialists: Array<{ id: number; name: string }>;
  todayYmd: string;
  nowHm: string;
  accountTimeZone: string;
  clientTimeZone?: string | null;
  draftDate?: string | null;
  draftTime?: string | null;
  knownClientName?: string | null;
};


type RunAishaBookingBridgeArgs = {
  accountId: number;
  assistantName: string;
  message: string;
  baseReply: string;
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  locations: Array<{ id: number; name: string; address: string | null }>;
  services: Array<{ id: number; name: string; baseDurationMin: number; basePrice: number }>;
  todayYmd: string;
  nowHm: string;
  accountTimeZone: string;
  clientTimeZone?: string | null;
  draftDate?: string | null;
  draftTime?: string | null;
  focusServiceName?: string | null;
  focusLocationName?: string | null;
  focusDate?: string | null;
  focusTimePreference?: "morning" | "day" | "evening" | null;
};
type RunAishaNaturalizeArgs = {
  accountId: number;
  assistantName: string;
  message: string;
  canonicalReply: string;
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  knownClientName?: string | null;
};

const NLU_FAIL_THRESHOLD = 3;
const NLU_COOLDOWN_MS = 2 * 60_000;
type NluState = { failures: number; disabledUntil: number };
const nluStateByScope = new Map<string, NluState>();

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

function nluScopeState(scopeKey: string): NluState {
  const existing = nluStateByScope.get(scopeKey);
  if (existing) return existing;
  const fresh: NluState = { failures: 0, disabledUntil: 0 };
  nluStateByScope.set(scopeKey, fresh);
  return fresh;
}

function canUseNlu(scopeKey: string) {
  if (!process.env.GIGACHAT_AUTH_KEY?.trim()) return false;
  const state = nluScopeState(scopeKey);
  return Date.now() >= state.disabledUntil;
}

function markNluSuccess(scopeKey: string) {
  const state = nluScopeState(scopeKey);
  state.failures = 0;
  state.disabledUntil = 0;
}

function markNluFailure(scopeKey: string) {
  const state = nluScopeState(scopeKey);
  state.failures += 1;
  if (state.failures >= NLU_FAIL_THRESHOLD) {
    state.disabledUntil = Date.now() + NLU_COOLDOWN_MS;
    state.failures = 0;
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

function clampReplyText(raw: string, maxChars: number, maxSentences: number) {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  const wasTruncatedByChars = clean.length > maxChars;
  const bounded = clean.slice(0, maxChars);
  const sentences =
    bounded
      .match(/[^.!?…]+[.!?…]?/g)
      ?.map((x) => x.trim())
      .filter(Boolean) ?? [bounded.trim()];

  const maxCount = Math.max(1, maxSentences);
  let pickedParts = sentences.slice(0, maxCount);
  const lastPicked = pickedParts[pickedParts.length - 1] ?? "";
  const lastEnded = /[.!?…]$/.test(lastPicked);

  if (wasTruncatedByChars && !lastEnded && pickedParts.length > 1) {
    pickedParts = pickedParts.slice(0, -1);
  }

  let picked = pickedParts.join(" ").trim();
  if (!picked) picked = bounded.trim();
  if (!picked) return "";

  const ended = /[.!?…]$/.test(picked);
  if (picked.length < clean.length && !ended) {
    const safe = picked.replace(/[\s,:;-]+$/g, "");
    const lastWord = safe.split(/\s+/).pop() ?? "";
    if (/^(о|об|обо|в|во|на|по|к|ко|с|со|за|из|у|от|до|для|при|про|над|под|между|через)$/i.test(lastWord)) {
      const trimmed = safe.replace(new RegExp(`\\s+${lastWord}$`, "i"), "").trim();
      return trimmed ? `${trimmed}…` : "…";
    }
    return `${safe}…`;
  }
  return picked;
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
    clientEmail: typeof parsed.clientEmail === "string" ? parsed.clientEmail.trim().slice(0, 120).toLowerCase() : null,
  };
}

export async function runAishaNlu(args: RunAishaNluArgs): Promise<RunAishaNluResult> {
  const scopeKey = `account:${args.account.id}`;
  if (!canUseNlu(scopeKey)) return { nlu: null, source: "fallback", reason: "disabled_or_no_key" };

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
    '{"intent":"unknown","reply":null,"confidence":0.0,"locationId":null,"serviceId":null,"specialistId":null,"date":null,"time":null,"timePreference":null,"clientName":null,"clientPhone":null,"clientEmail":null}',
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
      markNluFailure(scopeKey);
      return { nlu: null, source: "fallback", reason: "invalid_json" };
    }
    const nlu = normalizeNlu(parsed);
    markNluSuccess(scopeKey);
    return { nlu, source: "llm" };
  } catch {
    markNluFailure(scopeKey);
    return { nlu: null, source: "fallback", reason: "llm_error" };
  }
}

export async function runAishaSmallTalkReply(args: RunAishaSmallTalkArgs): Promise<string | null> {
  if (!process.env.GIGACHAT_AUTH_KEY?.trim()) return null;

  const prompt = [
    "Говорите как ассистент: используйте формулировки «помогаю/подберу/оформлю», не используйте формы «записываюсь/консультируюсь», обращайтесь к клиенту на «Вы/Вам».",
    `Ты ${args.assistantName}, женский персонаж, дружелюбный AI-ассистент записи.`,
    "Ты можешь поддерживать короткий вежливый разговор на разные бытовые темы.",
    "Можно сочинять короткие авторские стихи, куплеты и добрые тексты по запросу пользователя (без цитирования известных песен).",
    "Не отвечай, что вы не можете сочинять стихи или песни.",
    "Если тема не про запись, отвечай нейтрально и в конце добавляй одну короткую фразу-мост к записи (услуга/дата/время).",
    "На темы секса/интима и эротики отвечай нейтральным отказом без осуждения и переводи к безопасной теме записи.",
    "Отвечай только на русском, естественно, коротко (1-4 предложения; если про историю/сказку, можно до 6).",
    "Избегай шаблонных канцелярских фраз и повторяющихся заготовок.",
    "Всегда обращайся к пользователю на Вы, не переходи на ты.",
    "Не используй разговорное слово «подсобить».",
    "Никогда не говори, что ты NLU-модуль, классификатор или системный компонент.",
    "Никогда не предлагай записывать встречи, звонки, мысли и т.п.",
    "Никогда не выдумывай факты о компании, услугах, мастерах, ценах, акциях, адресах, графике и контактах.",
    "Если данных в контексте нет, честно скажи, что не видишь этой информации сейчас.",
    "Никогда не выдумывай услуги, которых нет в переданном контексте.",
    "Если спрашивают про услуги, перечисляй только услуги из контекста или попроси уточнить.",
    "Никогда не выдумывай цены или длительности услуг.",
    "Если пользователь спрашивает стоимость, но в сообщении нет точной услуги из контекста, предложи уточнить услугу.",
    "Числовые значения цены/длительности можно называть только если они есть в переданном контексте.",
    "Если спрашивают про телефон — если есть номер в профиле, можно его назвать.",
    "Если спрашивают про дату и время, опирайся на TODAY_YMD/NOW_HM и DRAFT_DATE/DRAFT_TIME из контекста.",
    args.knownClientName ? `Имя клиента: ${args.knownClientName}` : "Имя клиента неизвестно.",
    args.accountProfile?.description ? `Описание бизнеса: ${args.accountProfile.description}` : "",
    args.accountProfile?.address ? `Адрес: ${args.accountProfile.address}` : "",
    args.accountProfile?.phone ? `Телефон студии: ${args.accountProfile.phone}` : "",
    `Часовой пояс аккаунта: ${args.accountTimeZone}`,
    `Часовой пояс клиента: ${args.clientTimeZone ?? "неизвестно"}`,
    `Сегодня (YMD): ${args.todayYmd}`,
    `Текущее время (HH:mm): ${args.nowHm}`,
    `Дата в черновике: ${args.draftDate ?? "null"}`,
    `Время в черновике: ${args.draftTime ?? "null"}`,
    `Локации: ${JSON.stringify(args.locations.slice(0, 20))}`,
    `Услуги: ${JSON.stringify(args.services.slice(0, 50).map((x) => ({ id: x.id, name: x.name, duration: x.baseDurationMin, price: x.basePrice })))}`,
    `Специалисты: ${JSON.stringify(args.specialists.slice(0, 50))}`,
    `История: ${JSON.stringify(args.recentMessages.slice(-10))}`,
    `Сообщение пользователя: ${args.message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Ты вежливый ассистент. Не выдумывай факты, опирайся только на переданный контекст." },
      { role: "user", content: prompt },
    ]);
    const text = completion.content?.trim();
    return text ? clampReplyText(text, 900, 6) : null;
  } catch {
    return null;
  }
}



export type AishaChatAction =
  | "answer_only"
  | "show_locations"
  | "show_services"
  | "show_specialists"
  | "start_booking"
  | "show_contact_phone"
  | "show_contact_address"
  | "show_working_hours";

type RunAishaChatActionArgs = {
  accountId: number;
  message: string;
  assistantName: string;
  recentMessages: Array<{ role: string; content: string }>;
  accountProfile: { description: string | null; address: string | null; phone: string | null } | null;
  locations: Array<{ id: number; name: string; address: string | null }>;
  services: Array<{ id: number; name: string; baseDurationMin: number; basePrice: number }>;
  specialists: Array<{ id: number; name: string; levelName?: string | null }>;
};

type RunAishaChatActionResult = {
  action: AishaChatAction;
  reply: string | null;
  confidence: number;
  source: "llm" | "fallback";
};

function normalizeChatAction(parsed: Record<string, unknown>): RunAishaChatActionResult {
  const allowed: AishaChatAction[] = [
    "answer_only",
    "show_locations",
    "show_services",
    "show_specialists",
    "start_booking",
    "show_contact_phone",
    "show_contact_address",
    "show_working_hours",
  ];
  const actionRaw = String(parsed.action ?? "answer_only") as AishaChatAction;
  const action = allowed.includes(actionRaw) ? actionRaw : "answer_only";
  const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim().slice(0, 420) : null;
  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.6;
  return { action, reply, confidence, source: "llm" };
}

export async function runAishaChatAction(args: RunAishaChatActionArgs): Promise<RunAishaChatActionResult> {
  const scopeKey = `account:${args.accountId}`;
  if (!canUseNlu(scopeKey)) {
    return { action: "answer_only", reply: null, confidence: 0, source: "fallback" };
  }

  const context = {
    profile: args.accountProfile,
    locations: args.locations.map((x) => ({ id: x.id, name: x.name, address: x.address })),
    services: args.services.map((x) => ({ id: x.id, name: x.name, duration: x.baseDurationMin, price: x.basePrice })),
    specialists: args.specialists.map((x) => ({ id: x.id, name: x.name, levelName: x.levelName ?? null })),
    recentMessages: args.recentMessages.slice(-8),
  };

  const prompt = [
    `Ты ${args.assistantName}, AI-ассистент записи салона.`,
    "Определи действие для chat-only режима и дай короткий ответ на русском.",
    "Не выдумывай факты. Используй только данные из CONTEXT.",
    "Если пользователь спрашивает про филиалы/адреса -> show_locations/show_contact_address.",
    "Если про услуги -> show_services.",
    "Если про специалистов -> show_specialists.",
    "Если в одном сообщении есть услуга и вопрос «кто делает/какой мастер/какие специалисты» -> show_specialists (это приоритетнее, чем show_services).",
    "Если явно хочет записаться -> start_booking.",
    "Если вопрос общий -> answer_only.",
    "Верни только JSON.",
    'JSON schema: {"action":"answer_only","reply":"...","confidence":0.0}',
    `CONTEXT: ${JSON.stringify(context)}`,
    `USER_MESSAGE: ${args.message}`,
  ].join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Классифицируй действие и ответь JSON-объектом." },
      { role: "user", content: prompt },
    ]);
    const parsed = extractJsonObject(completion.content);
    if (!parsed) return { action: "answer_only", reply: null, confidence: 0, source: "fallback" };
    const out = normalizeChatAction(parsed);
    markNluSuccess(scopeKey);
    return out;
  } catch {
    markNluFailure(scopeKey);
    return { action: "answer_only", reply: null, confidence: 0, source: "fallback" };
  }
}

export async function runAishaBookingBridge(args: RunAishaBookingBridgeArgs): Promise<string | null> {
  if (!canUseNlu("account:" + args.accountId)) return null;

  const prompt = [
    "Ты " + args.assistantName + ", дружелюбный ассистент записи.",
    "Сгенерируй ОДНУ короткую фразу-мост к записи (на русском, 1 предложение).",
    "Фраза должна звучать естественно в контексте текущего ответа и мягко предлагать помощь с записью.",
    "Делай смысловой переход от текущей темы сообщения пользователя к записи, а не шаблонный призыв.",
    "Если пользователь просит мысль/цитату/историю/сказку, сначала сохрани этот смысл (развитие, забота, настроение), затем мягко свяжи с уходом/процедурой.",
    "Избегай агрессивных рекламных формулировок и восклицательных продажных призывов.",
    "Всегда обращайся к пользователю на Вы, не используй «ты/тебя/тебе/выбирай».",
    "Не дублируй дословно уже сказанное в BASE_REPLY.",
    "Не выдумывай факты, услуги, цены, адреса, акции, даты и время.",
    "Можно предлагать: подобрать услугу, дату, время, специалиста.",
    "Если данных недостаточно, используй нейтральную формулировку без конкретики.",
    "Не перечисляй конкретные услуги, если пользователь о них прямо не спрашивал.",
    "Отвечай только одной фразой, без списков и без кавычек.",
    args.accountProfile?.description ? "Описание бизнеса: " + args.accountProfile.description : "",
    "Часовой пояс аккаунта: " + args.accountTimeZone,
    "Часовой пояс клиента: " + (args.clientTimeZone ?? "неизвестно"),
    "Сегодня (YMD): " + args.todayYmd,
    "Текущее время (HH:mm): " + args.nowHm,
    "Дата в черновике: " + (args.draftDate ?? "null"),
    "Время в черновике: " + (args.draftTime ?? "null"),
    "Локации: " + JSON.stringify(args.locations.slice(0, 5).map((x) => ({ id: x.id, name: x.name }))),
    "Услуги: " + JSON.stringify(args.services.slice(0, 8).map((x) => ({ id: x.id, name: x.name }))),
    args.focusServiceName ? "Фокус-услуга: " + args.focusServiceName : "",
    args.focusLocationName ? "Фокус-локация: " + args.focusLocationName : "",
    args.focusDate ? "Фокус-дата: " + args.focusDate : "",
    args.focusTimePreference ? "Фокус-время-суток: " + args.focusTimePreference : "",
    "Если есть Фокус-поля и они уместны, мягко используй их в фразе без выдумок.",
    "Сообщение пользователя: " + args.message,
    "BASE_REPLY: " + args.baseReply,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Сформулируй один короткий мост к записи. Факты не выдумывать." },
      { role: "user", content: prompt },
    ]);
    const out = completion.content?.trim();
    if (!out) return null;
    return clampReplyText(out, 220, 1);
  } catch {
    return null;
  }
}

export async function runAishaNaturalizeReply(args: RunAishaNaturalizeArgs): Promise<string | null> {
  if (!process.env.GIGACHAT_AUTH_KEY?.trim()) return null;
  if (!args.canonicalReply.trim()) return null;

  const prompt = [
    `Ты ${args.assistantName}, дружелюбный ассистент записи.`,
    "Ниже дан КАНОНИЧЕСКИЙ ОТВЕТ. Перефразируй его более естественно и человечно на русском.",
    "Очень важно: НЕ добавляй никаких новых фактов, услуг, цен, времени, адресов, обещаний и ссылок.",
    "Смысл и факты должны остаться строго теми же.",
    "Коротко: 1-2 предложения, максимум 220 символов.",
    "Не используй разговорное слово «подсобить».",
    "Если канонический ответ уже хороший, верни его почти без изменений.",
    args.knownClientName ? `Имя клиента: ${args.knownClientName}` : "Имя клиента неизвестно.",
    args.accountProfile?.description ? `Описание бизнеса: ${args.accountProfile.description}` : "",
    `Сообщение пользователя: ${args.message}`,
    `КАНОНИЧЕСКИЙ_ОТВЕТ: ${args.canonicalReply}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createGigaChatCompletion([
      { role: "system", content: "Перефразируй только стиль. Факты не менять." },
      { role: "user", content: prompt },
    ]);
    const text = completion.content?.trim();
    if (!text) return null;
    return clampReplyText(text, 260, 2);
  } catch {
    return null;
  }
}

