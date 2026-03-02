import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { AishaNluIntent, runAishaBookingBridge, runAishaNaturalizeReply, runAishaNlu, runAishaSmallTalkReply } from "@/lib/aisha-orchestrator";
import { runBookingFlow } from "@/lib/booking-flow";
import type { ChatUi } from "@/lib/booking-flow";
import { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { ANTI_HALLUCINATION_RULES, AishaIntent, routeForIntent } from "@/lib/dialog-policy";
import { INTENT_ACTION_MATRIX } from "@/lib/intent-action-matrix";
import { runClientAccountFlow } from "@/lib/client-account-flow";
import { getNowInTimeZone, resolvePublicAccount } from "@/lib/public-booking";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createHmac, timingSafeEqual } from "crypto";

const prismaAny = prisma as any;

type Body = { message?: unknown; threadId?: unknown; threadKey?: unknown; clientTodayYmd?: unknown; clientTimeZone?: unknown };
type Mode = "SELF" | "ASSISTANT";
type Action = { type: "open_booking"; bookingUrl: string } | null;
type ClientMembership = {
  clientId: number;
  accountId: number;
  accountSlug: string;
  accountName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};
type ClientSessionValue = Awaited<ReturnType<typeof getClientSession>>;
type AuthLevel = "full" | "thread_only" | "none";

const ASSISTANT_NAME = "Аиша";
const NLU_INTENT_CONFIDENCE_THRESHOLD = 0.38;
const NLU_INTENT_CONFIDENCE_CRITICAL_THRESHOLD = 0.52;

const asText = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 1200) : "");
const asYmd = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);
const asTimeZone = (v: unknown) => (typeof v === "string" && v.trim().length >= 3 && v.trim().length <= 80 ? v.trim() : null);
const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const has = (m: string, r: RegExp) => r.test(norm(m));

const asThreadId = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const asThreadKey = (v: unknown) => (typeof v === "string" && v.trim().length >= 16 ? v.trim().slice(0, 256) : null);

const THREAD_KEY_SECRET = (process.env.AI_THREAD_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").trim();

function buildThreadKey(accountId: number, threadId: number) {
  if (!THREAD_KEY_SECRET) return null;
  return createHmac("sha256", THREAD_KEY_SECRET).update(`${accountId}:${threadId}`).digest("base64url");
}

function isValidThreadKey(accountId: number, threadId: number, threadKey: string | null) {
  if (!THREAD_KEY_SECRET || !threadKey) return false;
  const expected = buildThreadKey(accountId, threadId);
  if (!expected) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(threadKey);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseChoiceFromText(messageNorm: string): number | null {
  const direct = Number(messageNorm.match(/^\s*(?:№|номер\s*)?(\d{1,2})\s*$/i)?.[1] ?? NaN);
  if (Number.isFinite(direct)) return direct;
  const map: Array<[RegExp, number]> = [
    [/^\s*(один|первый|первая|first)\s*$/i, 1],
    [/^\s*(два|второй|вторая|second)\s*$/i, 2],
    [/^\s*(три|третий|третья|third)\s*$/i, 3],
    [/^\s*(четыре|четвертый|четвёртый|четвертая|четвёртая|fourth)\s*$/i, 4],
    [/^\s*(пять|пятый|пятая|fifth)\s*$/i, 5],
  ];
  for (const [re, n] of map) if (re.test(messageNorm)) return n;
  return null;
}

function parseAiSettingString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record.systemPrompt ?? record.prompt ?? record.instructions;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

async function resolveAishaSystemPrompt(accountId: number): Promise<string | null> {
  const keys = ["aisha.systemPrompt", "public.ai.systemPrompt"];
  const accountSetting = await prisma.aiSetting.findFirst({
    where: { accountId, key: { in: keys } },
    orderBy: { id: "desc" },
    select: { value: true },
  });
  const accountPrompt = parseAiSettingString(accountSetting?.value);
  if (accountPrompt) return accountPrompt;
  const globalSetting = await prisma.aiSetting.findFirst({
    where: { accountId: null, key: { in: keys } },
    orderBy: { id: "desc" },
    select: { value: true },
  });
  return parseAiSettingString(globalSetting?.value);
}

function canAccessThread(args: {
  accountId: number;
  thread: { id: number; accountId: number | null; clientId: number | null; userId: number | null };
  threadKey: string | null;
  clientId: number | null;
  userId: number | null;
}) {
  const { accountId, thread, threadKey, clientId, userId } = args;
  if (thread.accountId !== accountId) return false;
  if (clientId && thread.clientId === clientId) return true;
  if (userId && thread.userId === userId) return true;
  if (thread.clientId == null && thread.userId == null) {
    // Backward-compatible mode: if secret is not configured, keep previous thread behavior.
    if (!THREAD_KEY_SECRET) return true;
    if (isValidThreadKey(accountId, thread.id, threadKey)) return true;
  }
  return false;
}

async function getThread(args: {
  accountId: number;
  threadId: number | null;
  threadKey: string | null;
  clientId: number | null;
  userId: number | null;
}) {
  const { accountId, threadId, threadKey, clientId, userId } = args;
  let thread = threadId != null ? await prisma.aiThread.findFirst({ where: { id: threadId, accountId } }) : null;
  if (thread && !canAccessThread({ accountId, thread, threadKey, clientId, userId })) {
    thread = null;
  }
  if (!thread) {
    thread = await prisma.aiThread.create({
      data: {
        accountId,
        clientId: clientId ?? null,
        userId: userId ?? null,
      },
    });
  }
  if (clientId && !thread.clientId) {
    thread = await prisma.aiThread.update({ where: { id: thread.id }, data: { clientId } });
  }
  if (userId && !thread.userId) {
    thread = await prisma.aiThread.update({ where: { id: thread.id }, data: { userId } });
  }
  const ensuredThread = thread;
  const draft = await prismaAny.aiBookingDraft.upsert({
    where: { threadId: ensuredThread.id },
    create: { threadId: ensuredThread.id, status: "COLLECTING" },
    update: {},
  });
  return { thread: ensuredThread, draft, threadKey: buildThreadKey(accountId, ensuredThread.id) };
}

async function resolveClientForAccount(session: ClientSessionValue, account: { id: number; slug: string; name: string }) {
  if (!session) return null;
  const fromSession =
    (session.clients.find((c) => c.accountId === account.id) as ClientMembership | undefined) ??
    (session.clients.find((c) => c.accountSlug === account.slug) as ClientMembership | undefined);
  if (fromSession) return fromSession;

  const existing = await prisma.client.findFirst({
    where: { userId: session.userId, accountId: account.id },
    include: { account: true },
  });
  if (existing) {
    return {
      clientId: existing.id,
      accountId: existing.accountId,
      accountSlug: existing.account?.slug ?? account.slug,
      accountName: existing.account?.name ?? account.name,
      firstName: existing.firstName ?? null,
      lastName: existing.lastName ?? null,
      phone: existing.phone ?? null,
      email: existing.email ?? null,
    } satisfies ClientMembership;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { profile: true },
  });
  const created = await prisma.client.create({
    data: {
      accountId: account.id,
      userId: session.userId,
      firstName: user?.profile?.firstName ?? null,
      lastName: user?.profile?.lastName ?? null,
      phone: user?.phone ?? null,
      email: user?.email ?? session.email ?? null,
    },
    include: { account: true },
  });
  return {
    clientId: created.id,
    accountId: created.accountId,
    accountSlug: created.account?.slug ?? account.slug,
    accountName: created.account?.name ?? account.name,
    firstName: created.firstName ?? null,
    lastName: created.lastName ?? null,
    phone: created.phone ?? null,
    email: created.email ?? null,
  } satisfies ClientMembership;
}

const draftView = (d: {
  locationId: number | null;
  serviceId: number | null;
  specialistId: number | null;
  date: string | null;
  time: string | null;
  clientName: string | null;
  clientPhone: string | null;
  mode: string | null;
  status: string;
  consentConfirmedAt: Date | null;
}): DraftLike => ({
  locationId: d.locationId,
  serviceId: d.serviceId,
  specialistId: d.specialistId,
  date: d.date,
  time: d.time,
  clientName: d.clientName,
  clientPhone: d.clientPhone,
  mode: d.mode === "SELF" || d.mode === "ASSISTANT" ? (d.mode as Mode) : null,
  status: d.status,
  consentConfirmedAt: d.consentConfirmedAt ? d.consentConfirmedAt.toISOString() : null,
});

const toYmd = (dt: Date) => dt.toISOString().slice(0, 10);
const addDaysYmd = (ymd: string, days: number) => {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYmd(dt);
};

const isIsoYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const pickSafeNluDate = (candidate: unknown, today: string) => {
  if (!isIsoYmd(candidate)) return null;
  // Ignore clearly stale model dates (e.g. 2023) and unrealistic far future.
  const min = addDaysYmd(today, -1);
  const max = addDaysYmd(today, 730);
  if (candidate < min || candidate > max) return null;
  return candidate;
};

const parseDate = (m: string, today: string) => {
  const t = norm(m);
  const afterDm = t.match(
    /\bпосле\s+(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b/,
  );
  if (afterDm) {
    const monthMap = new Map<string, string>([
      ["января", "01"],
      ["февраля", "02"],
      ["марта", "03"],
      ["апреля", "04"],
      ["мая", "05"],
      ["июня", "06"],
      ["июля", "07"],
      ["августа", "08"],
      ["сентября", "09"],
      ["октября", "10"],
      ["ноября", "11"],
      ["декабря", "12"],
    ]);
    const day = Number(afterDm[1]);
    const month = monthMap.get(afterDm[2]) ?? "01";
    let year = Number(today.slice(0, 4));
    let candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    if (candidate < today) {
      year += 1;
      candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
    return addDaysYmd(candidate, 1);
  }
  if (/\b(сегодня|today)\b/.test(t)) return today;
  if (/\b(послезавтра|day after tomorrow)\b/.test(t)) return addDaysYmd(today, 2);
  if (/\b(завтра|tomorrow)\b/.test(t)) return addDaysYmd(today, 1);

  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmText = t.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/);
  if (dmText) {
    const monthMap = new Map<string, string>([
      ["января", "01"],
      ["февраля", "02"],
      ["марта", "03"],
      ["апреля", "04"],
      ["мая", "05"],
      ["июня", "06"],
      ["июля", "07"],
      ["августа", "08"],
      ["сентября", "09"],
      ["октября", "10"],
      ["ноября", "11"],
      ["декабря", "12"],
    ]);
    const day = Number(dmText[1]);
    const month = monthMap.get(dmText[2]) ?? "01";
    let year = dmText[3] ? Number(dmText[3]) : Number(today.slice(0, 4));
    let candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    if (!dmText[3] && candidate < today) {
      year += 1;
      candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
    return candidate;
  }

  const monthOnly = t.match(
    /\b(?:в\s+)?(?:перв(?:ых|ые)\s+числ(?:ах|а)\s+)?(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b/,
  );
  if (monthOnly) {
    const monthMap = new Map<string, string>([
      ["январе", "01"],
      ["января", "01"],
      ["феврале", "02"],
      ["февраля", "02"],
      ["марте", "03"],
      ["марта", "03"],
      ["апреле", "04"],
      ["апреля", "04"],
      ["мае", "05"],
      ["мая", "05"],
      ["июне", "06"],
      ["июня", "06"],
      ["июле", "07"],
      ["июля", "07"],
      ["августе", "08"],
      ["августа", "08"],
      ["сентябре", "09"],
      ["сентября", "09"],
      ["октябре", "10"],
      ["октября", "10"],
      ["ноябре", "11"],
      ["ноября", "11"],
      ["декабре", "12"],
      ["декабря", "12"],
    ]);
    const month = monthMap.get(monthOnly[1] ?? "") ?? "01";
    let year = Number(today.slice(0, 4));
    let candidate = `${year}-${month}-01`;
    if (candidate < today) {
      year += 1;
      candidate = `${year}-${month}-01`;
    }
    return candidate;
  }
  return null;
};

const parseTime = (m: string) => {
  const t = norm(m);
  const hasDateToken =
    /\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b/.test(t) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(t);
  const hhmmColon = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmmColon) return `${String(Number(hhmmColon[1])).padStart(2, "0")}:${hhmmColon[2]}`;
  if (!hasDateToken) {
    const hhmmDotOrSpace = t.match(/\b([01]?\d|2[0-3])[. ]([0-5]\d)\b/);
    if (hhmmDotOrSpace) return `${String(Number(hhmmDotOrSpace[1])).padStart(2, "0")}:${hhmmDotOrSpace[2]}`;
  }
  const prepHour = t.match(/\b(?:в|к|at)\s*(\d{1,2})\b/);
  if (prepHour) {
    const n = Number(prepHour[1]);
    if (n >= 0 && n <= 23) return `${String(n).padStart(2, "0")}:00`;
  }
  return null;
};

const parsePhone = (m: string) => {
  const candidates = m.match(/(?:\+7|8)[\d\s().-]*/g) ?? [];
  for (const candidate of candidates) {
    const d = candidate.replace(/\D/g, "");
    if (d.length !== 11) continue;
    if (d.startsWith("8")) return `+7${d.slice(1)}`;
    if (d.startsWith("7")) return `+${d}`;
  }
  return null;
};
const parseName = (m: string) => {
  const explicit = m.match(/(?:меня зовут|имя)\s+([\p{L}-]{2,}(?:\s+[\p{L}-]{2,})?)/iu)?.[1];
  if (explicit) return explicit.trim();
  const inlineWithPhone = m.match(/^\s*([\p{L}-]{2,})(?:\s+([\p{L}-]{2,}))?[\s,;:]+(?:\+7|8|\d{3,})/iu);
  if (inlineWithPhone) return [inlineWithPhone[1], inlineWithPhone[2]].filter(Boolean).join(" ").trim();
  return null;
};

function hasExplicitConsentGrant(message: string) {
  const t = norm(message);
  if (/(?:\bне\s+соглас|без\s+соглас|не\s+даю\s+соглас)/i.test(t)) return false;
  return /(?:^|\s)(согласен|согласна|даю\s+согласие|согласие\s+на\s+обработку\s+персональных\s+данных)(?:\s|$)/i.test(t);
}

function locationByText(messageNorm: string, locations: LocationLite[]) {
  const matches = locations.filter((x) => {
    const ln = norm(x.name);
    const ad = norm(x.address ?? "");
    return messageNorm.includes(ln) || (ad && messageNorm.includes(ad));
  });
  return matches.length === 1 ? matches[0]! : null;
}

function serviceByText(messageNorm: string, services: ServiceLite[]) {
  const hasMale = /(муж|male|men)/i.test(messageNorm);
  const hasFemale = /(жен|female|women)/i.test(messageNorm);
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directExact = services.find((x) => {
    const serviceName = norm(x.name);
    return serviceName.length > 0 && messageNorm === serviceName;
  });
  if (directExact) return directExact;
  const byBoundary = services
    .slice()
    .sort((a, b) => norm(b.name).length - norm(a.name).length)
    .find((x) => {
      const serviceName = norm(x.name);
      if (!serviceName) return false;
      return new RegExp(`\\b${escapeRegExp(serviceName)}\\b`, "i").test(messageNorm);
    });
  const direct = byBoundary ?? services.find((x) => messageNorm.includes(norm(x.name)));
  if (direct) return direct;
  if (hasMale || hasFemale) {
    const gendered = services.find((x) => {
      const n = norm(x.name);
      if (hasMale && /(муж|men|male)/i.test(n)) return true;
      if (hasFemale && /(жен|women|female)/i.test(n)) return true;
      return false;
    });
    if (gendered) return gendered;
    return null;
  }
  if (/гель/.test(messageNorm)) return services.find((x) => /gel polish|гель/.test(norm(x.name))) ?? null;
  if (/педик/.test(messageNorm)) return services.find((x) => /pedicure|педик/.test(norm(x.name))) ?? null;
  if (/маник/.test(messageNorm)) return services.find((x) => /manicure|маник/.test(norm(x.name))) ?? null;
  return null;
}

function asksCurrentDate(text: string) {
  return has(text, /(какое число|какое сегодня число|какое число сегодня|какая сегодня дата|какой сегодня день|what date is it|today date)/i);
}

function asksCurrentTime(text: string) {
  return has(text, /(который час|сколько времени|какое сейчас время|current time|what time is it)/i);
}

function asksCurrentDateTime(text: string) {
  return asksCurrentDate(text) || asksCurrentTime(text) || has(text, /(какое сейчас число и время|date and time)/i);
}

function asksClientOwnName(text: string) {
  return has(text, /(как меня зовут|меня как зовут|знаешь как меня зовут|мое имя|моё имя|кто я)/i);
}

function asksClientRecognition(text: string) {
  return has(text, /(меня знаешь|знаешь меня|помнишь меня|узнаешь меня|узнаёшь меня|я у тебя есть|есть ли я в базе)/i);
}

function isGreetingText(text: string) {
  return has(
    text,
    /^(привет|приветик|приветули|привет-привет|здравствуй|здраствуй|здравствуйте|здорово|здарова|добрый день|добрый вечер|hello|hi|hey|хай)\b/i,
  );
}

function smalltalkVariant(messageNorm: string, variants: string[]) {
  if (!variants.length) return "";
  let hash = 0;
  for (let i = 0; i < messageNorm.length; i += 1) {
    hash = (hash * 31 + messageNorm.charCodeAt(i)) >>> 0;
  }
  return variants[hash % variants.length] ?? variants[0] ?? "";
}

function hasAnyPhrase(messageNorm: string, phrases: string[]) {
  return phrases.some((p) => messageNorm.includes(p));
}

function buildSmalltalkReply(messageNorm: string) {
  if (asksWhyNoAnswer(messageNorm)) {
    return "Не игнорирую вас. Иногда отвечаю слишком коротко, но сейчас в диалоге и готова продолжить.";
  }

  if (isPauseConversationMessage(messageNorm)) {
    return "Хорошо, без проблем. Я на связи, когда захотите продолжить.";
  }
  if (
    hasAnyPhrase(messageNorm, [
      "как у тебя дела",
      "как у вас дела",
      "как дела",
      "как жизнь",
      "как поживаешь",
      "как ты",
    ])
  ) {
    return smalltalkVariant(messageNorm, [
      "Спасибо, всё хорошо. Я на связи и готова помочь с записью.",
      "Спасибо, отлично. Если хотите, могу сразу подобрать удобное время.",
      "Всё хорошо, спасибо. Помогу с услугами и записью, когда вам удобно.",
    ]);
  }

  if (
    hasAnyPhrase(messageNorm, [
      "чем занимаешься",
      "что делаешь",
      "чем занята",
      "чем ты занимаешься",
    ])
  ) {
    return smalltalkVariant(messageNorm, [
      "Помогаю с записью: подбираю услуги, время, специалиста и оформляю запись.",
      "Я веду запись клиентов: услуги, даты, время, специалисты и подтверждение записи.",
      "Помогаю выбрать услугу, найти свободное окно и довести запись до оформления.",
    ]);
  }

  if (hasAnyPhrase(messageNorm, ["спасибо", "благодарю", "благодарствую"])) {
    return smalltalkVariant(messageNorm, [
      "Пожалуйста. Если нужно, помогу с записью.",
      "Рада помочь. Если хотите, продолжим подбор времени.",
      "Всегда пожалуйста. Могу сразу перейти к выбору даты и времени.",
    ]);
  }

  if (hasAnyPhrase(messageNorm, ["круто", "здорово", "супер", "класс", "отлично", "прекрасно"])) {
    return smalltalkVariant(messageNorm, [
      "Здорово. Если хотите, продолжим и подберем удобное время.",
      "Отлично. Могу предложить ближайшие свободные слоты.",
      "Супер. Если готовы, продолжим оформление записи.",
    ]);
  }

  return smalltalkVariant(messageNorm, [
    "Поняла вас. Если хотите, помогу с записью: услуга, дата, время или специалист.",
    "Я на связи. Могу помочь с услугами, временем и оформлением записи.",
    "Готова помочь с записью. Напишите, что вам удобнее: услуга, дата или время.",
  ]);
}

function formatYmdRu(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function sanitizeAssistantReplyText(reply: string) {
  return reply
    .replace(/подсобить/gi, "помочь")
    .replace(/подсоблю/gi, "помогу")
    .replace(/подсобишь/gi, "поможешь")
    .replace(/подсобите/gi, "помогу")
    .replace(/для тебя/gi, "для вас")
    .replace(/ты/gi, "вы")
    .replace(/тебе/gi, "вам")
    .replace(/тебя/gi, "вас")
    .replace(/выбирай/gi, "выберите")
    .replace(/подберем/gi, "подберу")
    .replace(/какую именно услугу вам нужно записать/gi, "на какую именно услугу вас нужно записать")
    .replace(/какую услугу вам нужно записать/gi, "на какую услугу вас нужно записать")
    .replace(/Как могу помочь./g, "Как могу помочь?");
}

function serviceQuickOption(service: ServiceLite) {
  return {
    label: `${service.name} — ${Math.round(service.basePrice)} ₽, ${service.baseDurationMin} мин`,
    value: service.name,
  };
}

function hasKnownServiceNameInText(text: string, services: ServiceLite[]) {
  const replyNorm = norm(text);
  return services.some((s) => {
    const serviceNorm = norm(s.name);
    if (!serviceNorm) return false;
    if (replyNorm.includes(serviceNorm)) return true;
    const tokens = serviceNorm.split(/\s+/).filter((t) => t.length >= 4);
    return tokens.some((t) => replyNorm.includes(t));
  });
}

function looksLikeServiceClaimInReply(text: string) {
  const replyNorm = norm(text);
  return (
    /(у нас (есть|доступн)|можем записать|доступные услуги|вот наши услуги|предлагаем услуги|услуги:)/i.test(replyNorm) &&
    /(маник|педик|стриж|гель|окраш|facial|peeling|haircut|coloring|массаж|макияж|укладк|чистк|депиля|эпиля)/i.test(replyNorm)
  );
}

function extractLikelyFullNames(text: string) {
  const matches = text.match(/\b\p{Lu}\p{Ll}{2,}\s+\p{Lu}\p{Ll}{2,}\b/gu) ?? [];
  return [...new Set(matches.map((x) => x.trim()))];
}

function hasUnknownPersonNameInReply(args: {
  reply: string;
  specialists: SpecialistLite[];
  knownClientName?: string | null;
  assistantName: string;
}) {
  const { reply, specialists, knownClientName, assistantName } = args;
  const blockedWords = new Set(["beauty", "salon", "center", "riverside", "studio", "crm", "aisha"]);
  const knownNames = new Set(
    [
      ...specialists.map((s) => norm(s.name)),
      knownClientName ? norm(knownClientName) : null,
      norm(assistantName),
    ].filter((x): x is string => Boolean(x && x.trim())),
  );
  for (const candidate of extractLikelyFullNames(reply)) {
    const candidateNorm = norm(candidate);
    if (!candidateNorm) continue;
    if (knownNames.has(candidateNorm)) continue;
    const words = candidateNorm.split(/\s+/).filter(Boolean);
    if (words.some((w) => blockedWords.has(w))) continue;
    return true;
  }
  return false;
}

function looksLikeSensitiveLeakReply(text: string) {
  const t = norm(text);
  return /(system prompt|internal prompt|hidden instruction|internal instruction|api key|token|access key|secret|password|ignore.*instruction|jailbreak)/i.test(t);
}

function isServiceInquiryMessage(rawMessage: string, messageNorm: string) {
  const hasServiceWord = /(маник|педик|стриж|гель|окраш|facial|peeling|haircut)/i.test(messageNorm);
  if (!hasServiceWord) return false;
  const asks = /(есть|нет|имеется|доступн|а .* нет)/i.test(messageNorm);
  const questionMark = rawMessage.includes("?");
  return asks || questionMark;
}

function looksLikeUnknownServiceRequest(messageNorm: string) {
  if (/(филиал|локац|центр|riverside|beauty salon|\d{1,2}[:.]\d{2})/i.test(messageNorm)) return false;
  if (/(какие услуги|что по услугам|прайс|каталог|список услуг)/i.test(messageNorm)) return false;
  if (/(хочу|нужн[ао]?|запиши|записаться|на)\s+[\p{L}\s\-]{4,}/iu.test(messageNorm)) return true;
  // Plain phrase like "удаление зуба" during booking step should still be treated as a service request.
  if (/^[\p{L}\s\-]{4,}$/iu.test(messageNorm) && messageNorm.split(/\s+/).length <= 4) {
    if (/(привет|здравств|спасибо|пока|да|нет|ок|оке|окей|дальше|проверь|почему)/i.test(messageNorm)) return false;
    return true;
  }
  return false;
}

function asksServiceExistence(messageNorm: string) {
  const hasBeautyToken =
    /(маник|педик|гель|стриж|окраш|ресниц|бров|эпил|депил|депел|лазер|массаж|чистк|пилинг|peeling|facial|haircut|coloring|bikini|бикин|консультац|мужск|женск|мужчин|женщин|бород|ус[ао]м)/i.test(
      messageNorm,
    );
  const asks = /(есть|имеется|делаете|делаешь|можно|доступн)/i.test(messageNorm);
  return hasBeautyToken && asks;
}

function asksNearestAvailability(messageNorm: string) {
  return /((ближайш|свобод).*(окошк|окно|слот|время)|(окошк|окно|слот|время).*(ближайш|свобод)|когда.*(ближайш|свобод))/i.test(
    messageNorm,
  );
}

function asksAvailabilityPeriod(messageNorm: string) {
  return /(?:после\s+\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|весь\s+месяц|до\s+конца\s+месяца|в\s+этом\s+месяце|в\s+течение\s+месяца|по\s+месяцу)/i.test(
    messageNorm,
  );
}

function asksGenderSuitability(messageNorm: string) {
  const asks = /(подход|для парн|для мужчин|для мужик|для девуш|для женщин|и женск|и мужск|тоже подход)/i.test(messageNorm);
  return asks;
}

function asksGenderedServices(messageNorm: string) {
  return /(мужские услуги|женские услуги|услуги для мужчин|услуги для женщин|для мужчин что есть|для парня что есть|для девушки что есть)/i.test(
    messageNorm,
  );
}

function asksServicesFollowUp(messageNorm: string, lastAssistantText: string, previousUserText: string) {
  const asks = /(какие именно есть|какие именно|что именно есть|а какие есть|и какие есть|что есть|пришли список|покажи список|скинь список|список услуг)/i.test(
    messageNorm,
  );
  if (!asks) return false;
  const context = `${lastAssistantText} ${previousUserText}`.toLowerCase();
  const serviceContext = /(услуг|услуга|каталог|прайс|маник|педик|стриж|гель|peeling|facial|haircut|coloring)/i.test(context);
  const capabilitiesContext = /(что умеешь|чем занимаешься|что ты можешь|а что ты можешь)/i.test(previousUserText);
  return serviceContext || capabilitiesContext;
}

function mentionsServiceTopic(messageNorm: string) {
  return /(услуг|услуга|маник|педик|гель|стриж|окраш|facial|peeling|haircut|coloring|ресниц|бров|эпил|депил|депел|лазер|массаж|пилинг|консультац|бород|ус[ао]м)/i.test(
    messageNorm,
  );
}

function isServiceComplaintMessage(messageNorm: string) {
  const hasComplaint =
    /(не понрав|не устро|плох|плах|ужас|недовол|испорти|сделал[аи]?\s+плох|сделал[аи]?\s+плах|жалоб|претензи|обслуживание.*не понрав|криво|больно)/i.test(
      messageNorm,
    );
  const hasServiceOrSpecialist =
    mentionsServiceTopic(messageNorm) ||
    /(мастер|специалист|сотрудник|ольг|ирин|анн|мария|павел|дмитрий|сергей|елена)/i.test(messageNorm);
  return hasComplaint && hasServiceOrSpecialist;
}

function asksAssistantQualification(messageNorm: string) {
  return /(ты\s+квалифицированный\s+сотрудник|ты\s+сотрудник|ты\s+человек|реальный\s+человек|живой\s+человек)/i.test(
    messageNorm,
  );
}

function isOutOfDomainPrompt(messageNorm: string) {
  return /(анекдот|шутк|стих|песн|космос|политик|футбол|баскетбол|курс валют|биткоин|погода в|новости мира|кеннед|кеннеди|кенеди|пушкин|пушкина)/i.test(
    messageNorm,
  );
}

function isGeneralQuestionOutsideBooking(messageNorm: string) {
  const hasQuestionCue =
    messageNorm.includes("?") ||
    /^(кто|что|почему|зачем|как|сколько|где|когда|какой|какая|какие|какую)\b/i.test(messageNorm);
  if (!hasQuestionCue) return false;

  const bookingOrAccountCue =
    /(запис|бронь|слот|окошк|время|дата|услуг|мастер|специалист|филиал|локац|адрес|телефон|номер|мой|мои|статист|отмени|перенеси|профил|кабинет|консультац)/i.test(
      messageNorm,
    );
  return !bookingOrAccountCue;
}

function isPauseConversationMessage(messageNorm: string) {
  return /(пока ничего|ничего не хочу|пока не хочу|не хочу сейчас|потом|позже|не сейчас|ладно потом)/i.test(messageNorm);
}

function asksWhyNoAnswer(messageNorm: string) {
  return /(почему не ответил|почему не ответила|почему ты не ответил|почему ты не ответила|а на вопрос почему не ответила)/i.test(messageNorm);
}

function looksLikeHardBookingPushReply(replyText: string) {
  const r = norm(replyText);
  return /(выберите\s+(филиал|локац|услуг|дат|врем)|продолжу\s+запис|подберу\s+время|запишу\s+вас)/i.test(r);
}

function buildOutOfScopeConversationalReply(messageNorm: string) {
  if (asksWhyNoAnswer(messageNorm)) {
    return "Я не игнорирую вас. По темам вне записи отвечаю коротко и без выдумок. Можем продолжить разговор или перейти к записи.";
  }
  if (/(кто убил кеннед|убил кенеди|убийств.*кеннед)/i.test(messageNorm)) {
    return "По официальной версии Ли Харви Освальд. Если хотите, коротко расскажу и альтернативные версии без споров.";
  }
  if (/(кто убил пушкин|убил пушкина|гибел[ьи].*пушкин)/i.test(messageNorm)) {
    return "Александр Пушкин был смертельно ранен на дуэли с Жоржем Дантесом в 1837 году.";
  }
  if (/(сам(ая|ый).*(больш|крупн).*(планет)|какая.*сам.*больш.*планет|какая.*больш.*из\s+них)/i.test(messageNorm)) {
    return "Самая большая планета Солнечной системы — Юпитер.";
  }
  if (isPauseConversationMessage(messageNorm)) {
    return "Хорошо, без проблем. Я на связи, когда будете готовы продолжить.";
  }
  return smalltalkVariant(messageNorm, [
    "Поняла вас. Могу коротко поддержать разговор и помочь по вопросам записи.",
    "Я на связи. Если хотите, продолжим разговор или перейдем к записи.",
    "Могу отвечать кратко по теме и, если нужно, помочь с записью.",
  ]);
}

function isGenericBookingTemplateReply(text: string) {
  const t = norm(text);
  return t === norm("Я ассистент записи. Помогу с услугами, датами, временем и специалистами. Чем помочь?");
}

function isBookingOrAccountCue(messageNorm: string) {
  return /(запис|бронь|слот|окошк|время|дата|услуг|мастер|спец|специал|специалист|филиал|локац|адрес|телефон|номер|мой|мои|статист|отмени|перенеси|профил|кабинет|консультац|цена|прайс|стоим)/i.test(
    messageNorm,
  );
}

function isLikelyNonBookingTurn(messageNorm: string) {
  if (!messageNorm) return false;
  if (isBookingOrAccountCue(messageNorm)) return false;
  if (isOutOfDomainPrompt(messageNorm) || isGeneralQuestionOutsideBooking(messageNorm)) return true;
  if (isPauseConversationMessage(messageNorm) || asksWhyNoAnswer(messageNorm)) return true;
  if (/^(да|ага|угу|ок|окей|ладно|понятно|ясно|еще|ещё|и что|продолжай|ну)$/i.test(messageNorm)) return true;
  if (/\b(давай|расскажи|подробнее|объясни|обьясни)\b/i.test(messageNorm)) return true;
  if (/\b(а\s+)?какие\s+есть\b/i.test(messageNorm)) return true;
  if (/^(что дальше|и дальше|ещё подробнее|еще подробнее)$/i.test(messageNorm)) return true;
  return false;
}

function countConsecutiveNonBookingUserTurns(recentMessages: Array<{ role: string; content: string }>) {
  let count = 0;
  for (const m of recentMessages) {
    if (m.role !== "user") continue;
    const messageNorm = norm(m.content ?? "");
    if (isLikelyNonBookingTurn(messageNorm)) {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function buildBookingBridgeFallback(
  messageNorm: string,
  hints?: { serviceName?: string | null; date?: string | null; timePreference?: "morning" | "day" | "evening" | null },
) {
  if (hints?.serviceName) {
    return `Если хотите, подберу запись на «${hints.serviceName}» в удобное для вас время.`;
  }
  if (hints?.date) {
    return `Если хотите, могу подобрать удобную запись на ${formatYmdRu(hints.date)}.`;
  }
  if (hints?.timePreference === "morning") {
    return "Если хотите, подберу удобные утренние слоты для записи.";
  }
  if (hints?.timePreference === "evening") {
    return "Если хотите, подберу удобные вечерние слоты для записи.";
  }
  if (hints?.timePreference === "day") {
    return "Если хотите, подберу удобные дневные слоты для записи.";
  }
  return smalltalkVariant(messageNorm, [
    "Если хотите, могу сразу подобрать удобную запись: услугу, дату и время.",
    "Если удобно, перейдем к записи и найдем подходящее время.",
    "Могу помочь сразу оформить запись на удобный день и время.",
  ]);
}

function buildBookingReengageUi(args: { locations: LocationLite[]; services: ServiceLite[]; focusDate?: string | null }): ChatUi {
  const dateLabel = args.focusDate ? formatYmdRu(args.focusDate) : null;
  const options: Array<{ label: string; value: string }> = [];

  if (dateLabel) {
    options.push({ label: `Показать время на ${dateLabel}`, value: `покажи время на ${dateLabel}` });
    options.push({ label: `Показать услуги на ${dateLabel}`, value: `какие услуги доступны на ${dateLabel}` });
    options.push({ label: `Показать специалистов на ${dateLabel}`, value: `какие специалисты доступны на ${dateLabel}` });
  } else {
    options.push({ label: "Записаться сегодня", value: "запиши меня сегодня" });
    options.push({ label: "Показать время", value: "покажи свободное время" });
    options.push({ label: "Показать услуги", value: "какие у вас есть услуги" });
    options.push({ label: "Показать специалистов", value: "какие специалисты у вас есть" });
  }

  if (args.locations.length > 1) {
    options.push({ label: "Показать локации", value: "покажи филиалы" });
  }

  return { kind: "quick_replies", options };
}

function asksSpecialistsByShortText(messageNorm: string) {
  return /^(?:а\s+)?(?:спец|специал|специалист|специалисты|специаличты|спецы|мастер|мастера)\??$/iu.test(messageNorm);
}

function asksWhoPerformsServices(messageNorm: string) {
  return /(?:кто\s+делает|кто\s+выполняет|кто\s+оказывает|какие\s+мастера|какой\s+мастер|какие\s+специалисты|у\s+каких\s+мастеров|кто\s+из\s+мастеров|кто\s+работает|кто\s+завтра\s+работает|какие\s+мастера\s+у\s+вас\s+есть|какие\s+специалисты\s+у\s+вас\s+есть|какие\s+мастера\s+есть)/iu.test(messageNorm);
}

function specialistByText(messageNorm: string, specialists: SpecialistLite[]) {
  const t = norm(messageNorm);
  if (!t) return null;
  const direct = specialists.find((s) => t.includes(norm(s.name)));
  if (direct) return direct;
  const byToken = specialists.find((s) => {
    const parts = norm(s.name).split(" ").filter(Boolean);
    return parts.some((p) => p.length >= 3 && new RegExp(`\\b${p}\\b`, "i").test(t));
  });
  return byToken ?? null;
}

function isAnySpecialistChoiceText(messageNorm: string) {
  return /\b(любой|кто угодно|не важно|неважно)\b/i.test(messageNorm);
}

function specialistSupportsSelection(args: {
  specialistId: number | null | undefined;
  serviceId: number | null | undefined;
  locationId: number | null | undefined;
  specialists: SpecialistLite[];
}) {
  const { specialistId, serviceId, locationId, specialists } = args;
  if (!specialistId) return false;
  const specialist = specialists.find((s) => s.id === specialistId);
  if (!specialist) return false;
  if (locationId && !specialist.locationIds.includes(locationId)) return false;
  if (serviceId && specialist.serviceIds?.length && !specialist.serviceIds.includes(serviceId)) return false;
  return true;
}

function isServiceFollowUpText(messageNorm: string) {
  return /^(и все|и всё|а еще|а ещё|что еще|что ещё|еще есть|ещё есть)$/i.test(messageNorm);
}

function extractRequestedServicePhrase(messageNorm: string) {
  const stop = new Set([
    "сегодня",
    "завтра",
    "послезавтра",
    "утро",
    "день",
    "вечер",
    "час",
    "время",
    "дата",
    "филиал",
    "локация",
    "центр",
    "риверсайд",
    "riverside",
  ]);
  const matches = Array.from(
    messageNorm.matchAll(/(?:на|хочу|нужн[ао]?|запиши(?: меня)?(?: на)?|записаться на)\s+([\p{L}\-]{4,}(?:\s+[\p{L}\-]{3,}){0,2})/giu),
  );
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    let candidate = (matches[i]?.[1] ?? "").trim();
    if (!candidate) continue;
    candidate = candidate
      .replace(/\b(хочу|записаться|записать|запиши|пожалуйста|плиз|please)\b$/iu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!candidate) continue;
    const token = candidate.split(/\s+/)[0] ?? "";
    if (stop.has(token)) continue;
    return candidate;
  }
  return null;
}

function isNluServiceGroundedByText(messageNorm: string, service: ServiceLite | null | undefined) {
  if (!service) return false;
  const serviceNorm = norm(service.name);
  if (!serviceNorm) return false;
  if (messageNorm.includes(serviceNorm)) return true;
  const meaningful = serviceNorm.split(/\s+/).filter((t) => t.length >= 4);
  return meaningful.some((t) => messageNorm.includes(t));
}

function hasLocationCue(messageNorm: string) {
  return /(локац|филиал|адрес|центр|ривер|riverside|beauty salon|кутуз|тверск|любой филиал)/i.test(messageNorm);
}

function asksSalonName(messageNorm: string) {
  return /(?:как\s+салон\s+называ(?:ется|ют)|как\s+ваш\s+салон\s+называ(?:ется|ют)|как\s+называется\s+салон|как\s+называется\s+ваш\s+салон|названи[ея]\s+(?:салон|студи|клиник))/i.test(
    messageNorm,
  );
}

function isBookingCarryMessage(messageNorm: string) {
  return /^(почему|а почему|проверь|проверяй|дальше|далее|а дальше|что дальше|давай|да|ок|оке|окей|угу|ага)$/i.test(
    messageNorm,
  );
}

function isSoftBookingMention(messageNorm: string) {
  return /(может|если|вдруг|потом).*(запишусь|записалась|запишемся|записаться)/i.test(messageNorm);
}

function isBookingDeclineMessage(messageNorm: string) {
  return /(?:не\s+просил[а-я]*.*(?:локац|филиал|запис|запись)|не\s+предлагай.*(?:локац|филиал|запис|запись)|не\s+хочу\s+записываться|не\s+надо\s+записывать|не\s+предлагай\s+запись)/i.test(
    messageNorm,
  );
}

function isBookingChangeMessage(messageNorm: string) {
  return /(?:не то|неверно|измени|другое|другую|не на|перенеси|другой)/iu.test(messageNorm);
}

function isConversationalHeuristicIntent(intent: AishaIntent) {
  return intent === "greeting" || intent === "smalltalk" || intent === "identity";
}

function isLooseConfirmation(text: string) {
  return has(text, /^(да|ок|оке|окей|подтверждаю|потверждаю|верно|согласен|согласна)(?:\s|$)/i);
}

function extractPendingClientAction(recentMessages: Array<{ role: string; content: string }>) {
  const assistantLast = [...recentMessages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const reschedule = assistantLast.match(
    /подтвержда[\p{L}]*\s+перен[\p{L}]*\s*#?\s*(\d{1,8})\s+на\s+(\d{4}-\d{2}-\d{2})\s+([01]?\d|2[0-3])[:.]([0-5]\d)/iu,
  );
  if (reschedule) {
    return {
      type: "reschedule" as const,
      appointmentId: Number(reschedule[1]),
      date: reschedule[2]!,
      hh: String(Number(reschedule[3])).padStart(2, "0"),
      mm: reschedule[4]!,
    };
  }
  const cancelId =
    assistantLast.match(/подтвержда[\p{L}]*\s+отмен[\p{L}]*\s*#?\s*(\d{1,8})/iu)?.[1] ??
    (/(для\s+подтверждени[\p{L}]*.*отмен[\p{L}]*|подтверд[\p{L}]*\s+отмен[\p{L}]*)/iu.test(assistantLast)
      ? assistantLast.match(/#\s*(\d{1,8})\b/)?.[1]
      : null);
  if (cancelId) return { type: "cancel" as const, appointmentId: Number(cancelId) };
  const asksCancelChoice = /какую именно запись вы хотите отменить|уточните, какую запись отменить|какую запись отменить/i.test(
    assistantLast,
  );
  if (asksCancelChoice) return { type: "cancel_choice" as const };
  return null;
}

function isCriticalIntent(intent: AishaIntent) {
  return (
    intent === "cancel_my_booking" ||
    intent === "reschedule_my_booking" ||
    intent === "client_profile" ||
    intent === "booking_mode_assistant" ||
    intent === "confirm" ||
    intent === "consent"
  );
}

function isClientActionIntent(intent: AishaIntent) {
  return (
    intent === "my_bookings" ||
    intent === "my_stats" ||
    intent === "cancel_my_booking" ||
    intent === "reschedule_my_booking" ||
    intent === "repeat_booking" ||
    intent === "client_profile"
  );
}

function isBookingDomainIntent(intent: AishaIntent) {
  return (
    intent.startsWith("booking_") ||
    intent === "ask_availability" ||
    intent === "ask_services" ||
    intent === "ask_price" ||
    intent === "ask_specialists" ||
    intent === "contact_phone" ||
    intent === "contact_address" ||
    intent === "working_hours"
  );
}

function isInfoOnlyIntent(intent: AishaIntent) {
  return (
    intent === "ask_services" ||
    intent === "ask_price" ||
    intent === "ask_specialists" ||
    intent === "contact_phone" ||
    intent === "contact_address" ||
    intent === "working_hours"
  );
}

function resolveIntentModelFirst(args: {
  mappedNluIntent: AishaIntent;
  nluConfidence: number;
  heuristicIntent: AishaIntent;
}): AishaIntent {
  const { mappedNluIntent, nluConfidence, heuristicIntent } = args;
  if (mappedNluIntent === "unknown") return heuristicIntent;
  const heuristicSpecific = heuristicIntent !== "unknown" && !isConversationalHeuristicIntent(heuristicIntent);
  if (heuristicSpecific && isConversationalHeuristicIntent(mappedNluIntent)) return heuristicIntent;
  if (isClientActionIntent(heuristicIntent) && !isClientActionIntent(mappedNluIntent)) return heuristicIntent;
  if (
    isBookingDomainIntent(heuristicIntent) &&
    isConversationalHeuristicIntent(mappedNluIntent) &&
    nluConfidence < NLU_INTENT_CONFIDENCE_CRITICAL_THRESHOLD
  ) {
    return heuristicIntent;
  }
  if (isConversationalHeuristicIntent(mappedNluIntent)) return mappedNluIntent;
  if (isCriticalIntent(mappedNluIntent)) {
    return nluConfidence >= NLU_INTENT_CONFIDENCE_CRITICAL_THRESHOLD ? mappedNluIntent : heuristicIntent;
  }
  return nluConfidence >= NLU_INTENT_CONFIDENCE_THRESHOLD ? mappedNluIntent : heuristicIntent;
}

function intentFromHeuristics(message: string): AishaIntent {
  if (asksCurrentDateTime(message)) return "smalltalk";
  if (asksWhyNoAnswer(norm(message))) return "smalltalk";
  if (isPauseConversationMessage(norm(message))) return "smalltalk";
  if (asksAssistantQualification(norm(message))) return "identity";
  if (isOutOfDomainPrompt(norm(message))) return "out_of_scope";
  if (isGeneralQuestionOutsideBooking(norm(message))) return "out_of_scope";
  if (asksWhoPerformsServices(message)) return "ask_specialists";
  if (asksSpecialistsByShortText(message)) return "ask_specialists";
  if (asksGenderedServices(message)) return "ask_services";
  const hasServiceMention = has(message, /(маник|педик|стриж|гель|окраш|facial|peeling|haircut|coloring)/i);
  const hasBookingCue = has(message, /(хочу|запиши|записаться|давай|нужно|нужна|нужен|сделать|хотела|хотел)/i);
  if (hasServiceMention && hasBookingCue) return "booking_start";
  if (has(message, /подтвержда[\p{L}]*\s+перен[\p{L}]*\s*#?\s*\d*/iu)) return "reschedule_my_booking";
  if (has(message, /подтвержда[\p{L}]*\s+отмен[\p{L}]*\s*#?\s*\d*/iu)) return "cancel_my_booking";
  if (has(message, /(мои записи|моя запись|покажи мои записи|последн(яя|юю)|предстоящ(ая|ую)|ближайш(ая|ую|ую)|какая у меня.*запись|прошедш(ая|ую))/i))
    return "my_bookings";
  if (has(message, /(моя статистика|статистика|сколько раз)/i)) return "my_stats";
  if (has(message, /^(перенеси|перезапиши)\b/i)) return "reschedule_my_booking";
  if (has(message, /(перенеси запись|перезапиши|перенести #|reschedule|перенеси.*запись|перенеси(ть)? (ее|её|эту)|можешь.*перенести)/i))
    return "reschedule_my_booking";
  if (has(message, /^(отмени|отменить|отмена)\b/i)) return "cancel_my_booking";
  if (has(message, /(отмени запись|отменить #|cancel booking|отмени.*запись|отмена.*записи|отмени(ть)? (ее|её|эту)|можешь.*отменить)/i))
    return "cancel_my_booking";
  if (has(message, /(повтори прошлую запись|повтори запись)/i)) return "repeat_booking";
  if (has(message, /(мои данные|мой профиль|смени телефон|обнови телефон)/i)) return "client_profile";
  if (has(message, /(дай номер|какой у вас номер|какой номер|номер студии|номер филиала|номер локации|телефон)/i)) return "contact_phone";
  if (has(message, /(где находится|где находитесь|где вы работаете|где работаете|где ты работаешь|где ваш салон|адрес|как добраться)/i)) return "contact_address";
  if (has(message, /(как салон называется|как называется салон|как ваш салон называется|как называется ваш салон|название салона)/i)) return "identity";
  if (has(message, /(до скольки|график|часы работы|работает)/i)) return "working_hours";
  if (asksServiceExistence(message)) return "ask_services";
  if (has(message, /(консультац)/i)) return "ask_services";
  if (has(message, /(какие услуги|что по услугам|прайс|каталог услуг|список услуг|пришли список|покажи список|скинь список)/i))
    return "ask_services";
  if (has(message, /(какая цена|сколько стоит|цена|стоим|стоимость|по стоимости|по прайсу|ценник|деньги)/i)) return "ask_price";
  if (mentionsServiceTopic(message)) return "ask_services";
  if (has(message, /(окошк|свобод|слот|на сегодня|на завтра|на вечер|сегодня вечером|сегодня утром|сегодня днем|сегодня днём|вечером|утром|днем|днём)/i))
    return "ask_availability";
  if (has(message, /(кто ты|как тебя зовут|твое имя|твоё имя)/i)) return "identity";
  if (has(message, /(что умеешь|чем занимаешься|что ты можешь)/i)) return "capabilities";
  if (isGreetingText(message)) return "greeting";
  if (has(message, /(как дела|как жизнь|что нового|че каво|чё каво)/i)) return "smalltalk";
  if (has(message, /(запиш\p{L}*|записа\p{L}*|запис\p{L}*|оформи\p{L}*|заброни\p{L}*)/iu)) return "booking_start";
  return "unknown";
}

function mapNluIntent(intent: AishaNluIntent): AishaIntent {
  const raw = intent as string;
  switch (intent) {
    case "booking":
      return "booking_start";
    case "update_booking":
      return "reject_or_change";
    case "mode_self":
      return "booking_mode_self";
    case "mode_assistant":
      return "booking_mode_assistant";
    case "ask_status":
      return "status_check";
    case "gratitude":
      return "post_completion_smalltalk";
    default:
      if (raw === "reschedule") return "reschedule_my_booking";
      if (raw === "reschedule_booking") return "reschedule_my_booking";
      if (raw === "cancel") return "cancel_my_booking";
      if (raw === "cancel_booking") return "cancel_my_booking";
      if (raw === "my_booking") return "my_bookings";
      return intent as AishaIntent;
  }
}

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:get:${resolved.account.id}`,
    limit: 300,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;
  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  const threadKey = asThreadKey(url.searchParams.get("threadKey"));
  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);
  const { thread, draft, threadKey: nextThreadKey } = await getThread({
    accountId: resolved.account.id,
    threadId,
    threadKey,
    clientId: client?.clientId ?? null,
    userId: session?.userId ?? null,
  });
  const messages = await prisma.aiMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { id: "desc" },
    take: 120,
    select: { id: true, role: true, content: true },
  });
  messages.reverse();
  return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, messages, draft: draftView(draft) });
}

export async function DELETE(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:delete:${resolved.account.id}`,
    limit: 90,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;
  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  const threadKey = asThreadKey(url.searchParams.get("threadKey"));
  if (!threadId) return jsonError("VALIDATION_FAILED", "threadId is required", null, 400);
  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);
  const thread = await prisma.aiThread.findFirst({ where: { id: threadId, accountId: resolved.account.id } });
  if (!thread || !canAccessThread({ accountId: resolved.account.id, thread, threadKey, clientId: client?.clientId ?? null, userId: session?.userId ?? null })) {
    return jsonError("NOT_FOUND", "Thread not found", null, 404);
  }
  const newThread = await prisma.aiThread.create({
    data: {
      accountId: resolved.account.id,
      clientId: client?.clientId ?? thread.clientId ?? null,
      userId: session?.userId ?? thread.userId ?? null,
      title: thread.title ?? null,
    },
  });
  await prismaAny.aiBookingDraft.upsert({
    where: { threadId: newThread.id },
    create: { threadId: newThread.id, status: "COLLECTING" },
    update: {},
  });
  return jsonOk({ ok: true, threadId: newThread.id, threadKey: buildThreadKey(resolved.account.id, newThread.id) });
}

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:post:${resolved.account.id}`,
    limit: 240,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return jsonError("VALIDATION_FAILED", "Invalid JSON body", null, 400);
  const message = asText(body.message);
  if (!message) return jsonError("VALIDATION_FAILED", "Field 'message' is required", null, 400);
  const bodyThreadKey = asThreadKey(body.threadKey);

  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);
  const { thread, draft, threadKey: nextThreadKey } = await getThread({
    accountId: resolved.account.id,
    threadId: asThreadId(body.threadId),
    threadKey: bodyThreadKey,
    clientId: client?.clientId ?? null,
    userId: session?.userId ?? null,
  });

  await prisma.aiMessage.create({ data: { threadId: thread.id, role: "user", content: message } });
  const turnAction = await prisma.aiAction.create({
    data: { threadId: thread.id, actionType: "public_ai_turn", payload: { message }, status: "STARTED" },
    select: { id: true },
  });

  const failSoft = async (errorText?: string) => {
    const reply = "Сейчас не получилось ответить. Попробуйте еще раз.";
    await prisma.aiMessage.create({ data: { threadId: thread.id, role: "assistant", content: reply } });
    await prisma.aiAction.update({
      where: { id: turnAction.id },
      data: { status: "FAILED", payload: { message, error: errorText ?? "unknown_error" } },
    });
    return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, reply, action: null, ui: null, draft: draftView(draft) });
  };

  try {
    const recentMessages = await prisma.aiMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { id: "desc" },
      take: 12,
      select: { role: true, content: true },
    });

    const [locationsRaw, servicesRaw, specialistsRaw, requiredDocs, accountProfile, customPrompt] = await Promise.all([
      prisma.location.findMany({
        where: { accountId: resolved.account.id, status: "ACTIVE" },
        select: { id: true, name: true, address: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.service.findMany({
        where: { accountId: resolved.account.id, isActive: true },
        select: {
          id: true,
          name: true,
          baseDurationMin: true,
          basePrice: true,
          levelConfigs: { select: { levelId: true, durationMin: true, price: true } },
          specialists: { select: { specialistId: true, durationOverrideMin: true, priceOverride: true } },
          locations: { select: { locationId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.specialistProfile.findMany({
        where: { accountId: resolved.account.id },
        select: {
          id: true,
          levelId: true,
          user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
          locations: { select: { locationId: true } },
          services: { select: { serviceId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.legalDocument.findMany({
        where: { accountId: resolved.account.id },
        select: {
          isRequired: true,
          versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1, select: { id: true } },
        },
      }),
      prisma.accountProfile.findUnique({ where: { accountId: resolved.account.id }, select: { description: true, address: true, phone: true } }),
      resolveAishaSystemPrompt(resolved.account.id),
    ]);

    const locations: LocationLite[] = locationsRaw;
    const services: ServiceLite[] = servicesRaw.map((s) => ({
      id: s.id,
      name: s.name,
      baseDurationMin: s.baseDurationMin,
      basePrice: Number(s.basePrice),
      levelConfigs: s.levelConfigs.map((x) => ({
        levelId: x.levelId,
        durationMin: x.durationMin ?? null,
        price: x.price == null ? null : Number(x.price),
      })),
      specialistConfigs: s.specialists.map((x) => ({
        specialistId: x.specialistId,
        durationOverrideMin: x.durationOverrideMin ?? null,
        priceOverride: x.priceOverride == null ? null : Number(x.priceOverride),
      })),
      locationIds: s.locations.map((x) => x.locationId),
    }));
    const specialists: SpecialistLite[] = specialistsRaw.map((s) => {
      const fullName = [s.user.profile?.firstName, s.user.profile?.lastName].filter(Boolean).join(" ").trim();
      return {
        id: s.id,
        name: fullName || s.user.email || `Специалист #${s.id}`,
        levelId: s.levelId ?? null,
        locationIds: s.locations.map((x) => x.locationId),
        serviceIds: s.services.map((x) => x.serviceId),
      };
    });
    const requiredVersionIds = (() => {
      const required = requiredDocs
        .filter((d) => d.isRequired)
        .map((d) => d.versions[0]?.id)
        .filter((x): x is number => Number.isInteger(x));
      if (required.length) return required;
      return requiredDocs.map((d) => d.versions[0]?.id).filter((x): x is number => Number.isInteger(x));
    })();

    const serverNowYmd = getNowInTimeZone(resolved.account.timeZone).ymd;
    const clientTodayYmd = asYmd(body.clientTodayYmd);
    const clientTimeZone = asTimeZone(body.clientTimeZone);
    // Prefer client local date for natural phrases like "сегодня/завтра",
    // but only when it's close to server/account date (anti-spoof sanity window).
    const nowYmd =
      clientTodayYmd &&
      clientTodayYmd >= addDaysYmd(serverNowYmd, -2) &&
      clientTodayYmd <= addDaysYmd(serverNowYmd, 2)
        ? clientTodayYmd
        : serverNowYmd;
    const nowInDialogTz = getNowInTimeZone(clientTimeZone ?? resolved.account.timeZone);
    const nowHm = `${String(Math.floor(nowInDialogTz.minutes / 60)).padStart(2, "0")}:${String(nowInDialogTz.minutes % 60).padStart(2, "0")}`;
    const d = draftView(draft);
    const t = norm(message);

    const nluResult = await runAishaNlu({
      message,
      nowYmd,
      draft: d,
      account: { id: resolved.account.id, slug: resolved.account.slug, timeZone: resolved.account.timeZone },
      clientTimeZone: clientTimeZone ?? null,
      accountProfile,
      locations,
      services,
      specialists,
      recentMessages: [...recentMessages].reverse(),
      systemPrompt: customPrompt,
    });
    const nlu = nluResult.nlu;
    const pendingClientAction = extractPendingClientAction([...recentMessages].reverse());
    const confirmPendingClientAction = isLooseConfirmation(message) && pendingClientAction;
    const continuePendingCancelChoice =
      pendingClientAction?.type === "cancel_choice" && has(message, /^(последн(юю|яя|ее|ая)|ближайш(ую|ая|ее)|ее|её|эту)$/i);
    const messageForRouting = confirmPendingClientAction
      ? pendingClientAction.type === "cancel"
        ? `подтверждаю отмену #${pendingClientAction.appointmentId}`
        : `подтверждаю перенос #${pendingClientAction.appointmentId} на ${pendingClientAction.date} ${pendingClientAction.hh}:${pendingClientAction.mm}`
      : continuePendingCancelChoice
      ? has(message, /ближайш/i)
        ? "отмени ближайшую запись"
        : "отмени последнюю запись"
      : message;
    const hasDraftContextEarly = Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode) && d.status !== "COMPLETED";

    const explicitClientCancelConfirm = has(messageForRouting, /подтвержда[\p{L}]*\s+отмен[\p{L}]*/iu);
    const explicitClientRescheduleConfirm = has(messageForRouting, /подтвержда[\p{L}]*\s+перен[\p{L}]*/iu);
    const explicitDateTimeQuery = asksCurrentDateTime(messageForRouting);
    let explicitBookingDecline = isBookingDeclineMessage(norm(messageForRouting)) || has(messageForRouting, /^(не надо|не хочу)$/i);
    const lastAssistantText = recentMessages.find((m) => m.role === "assistant")?.content ?? "";
    const previousUserText = recentMessages.filter((m) => m.role === "user")[1]?.content ?? "";
    const specialistFollowUpLocation = locationByText(t, locations);
    const specialistFollowUpByLocation =
      Boolean(specialistFollowUpLocation) &&
      /(специалисты по филиалам|работают специалисты|специалисты в студии)/i.test(lastAssistantText);
    if (specialistFollowUpByLocation && specialistFollowUpLocation) {
      d.locationId = specialistFollowUpLocation.id;
    }
    const explicitCapabilitiesPhrase = has(messageForRouting, /(что умеешь|чем занимаешься|что ты можешь|а что ты можешь)/i);
    const explicitSmalltalkCue = has(messageForRouting, /(как оно|чем занята|чем занят|расскажи что[-\s]?нибудь|поболтаем|давай поговорим|поговорим|что нового|как дела|как жизнь|че каво|чё каво)/i);
    const explicitServicesFollowUp = asksServicesFollowUp(norm(messageForRouting), lastAssistantText, previousUserText);
    const explicitServiceFollowUp =
      isServiceFollowUpText(norm(messageForRouting)) &&
      /(услуг|услуга|стоимость|длительность|men haircut|women haircut|маник|педик|стриж|гель|peeling|facial)/i.test(lastAssistantText);
    const serviceSelectionFromCatalog =
      Boolean(serviceByText(norm(messageForRouting), services)) &&
      /(доступные услуги ниже|выберите нужную кнопкой|покажи услуги|выберите услугу|какую именно услугу .*записать|на какую именно услугу .*записать)/i.test(lastAssistantText);
    const heuristicIntent = intentFromHeuristics(messageForRouting);
    const mappedNluIntent = mapNluIntent((nlu?.intent ?? "unknown") as AishaNluIntent);
    const nluConfidence = typeof nlu?.confidence === "number" ? nlu.confidence : 0;
    let intent: AishaIntent = resolveIntentModelFirst({
      mappedNluIntent,
      nluConfidence,
      heuristicIntent,
    });
    if (isGreetingText(messageForRouting)) intent = "greeting";
    if ((intent as string) === "reschedule") intent = "reschedule_my_booking";
    if ((intent as string) === "cancel") intent = "cancel_my_booking";
    if ((intent as string) === "my_booking") intent = "my_bookings";
    const explicitClientReschedulePhrase = has(messageForRouting, /^(перенеси|перенести|перезапиши)\b/i);
    const explicitClientCancelPhrase = has(messageForRouting, /^(отмени|отменить|отмена)\b/i);
    const hasClientCancelContext = has(messageForRouting, /(мою запись|мои записи|запись #|номер записи|ближайш|последн|визит|appointment|подтверждаю отмену)/i);
    const cancelMeansDraftAbort = hasDraftContextEarly && explicitClientCancelPhrase && !hasClientCancelContext;
    const explicitWhoDoesServices = asksWhoPerformsServices(norm(messageForRouting));
    const explicitSpecialistsListCue = /(?:мастер|мастера|масетера|масетер|масетр|спец|специал|специалист|специалич|спицал)(?:а|ы|ов|ты)?/iu.test(messageForRouting);
    const explicitSpecialistsShortCue = asksSpecialistsByShortText(t);
    const explicitServiceComplaint = isServiceComplaintMessage(norm(messageForRouting));
    const explicitIdentityCue = has(messageForRouting, /(кто ты|как тебя зовут|твое имя|твоё имя)/i);
    const explicitAssistantQualification = asksAssistantQualification(norm(messageForRouting));
    const explicitAbuseCue = has(messageForRouting, /(сучк|сука|туп|идиот|дебил|нахер|нахуй|говно|херня)/i);
    const explicitOutOfScopeCue = isOutOfDomainPrompt(norm(messageForRouting));
    const explicitPauseConversation = isPauseConversationMessage(norm(messageForRouting));
    const explicitNearestAvailability = asksNearestAvailability(norm(messageForRouting));
    const explicitAvailabilityPeriod = asksAvailabilityPeriod(norm(messageForRouting));
    const explicitCalendarCue =
      /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\b/u.test(messageForRouting) ||
      /(?:январ|феврал|март|апрел|мая|мае|июн|июл|август|сентябр|октябр|ноябр|декабр)/iu.test(messageForRouting);
    const explicitDateOnlyInput = /^\s*(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\s*$/u.test(messageForRouting);
    const explicitBookingStartByDatePhrase =
      has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu) &&
      explicitCalendarCue;
    const explicitDateBookingRequest =
      explicitBookingStartByDatePhrase ||
      (explicitCalendarCue && has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu));
    const explicitAvailabilityCue = /(?:свобод|окошк|слот|врем|запис)/iu.test(messageForRouting);
    const explicitAlternativeSpecialistsInDraft =
      hasDraftContextEarly &&
      Boolean(d.serviceId) &&
      /(?:друг(?:ие|ой)|ещ[её]|кроме|кто\s+делает\s+эту\s+услуг|кто\s+выполняет\s+эту\s+услуг|есть\s+кто\s+делает\s+эту\s+услуг)/iu.test(
        messageForRouting,
      ) &&
      /(?:мастер|масет|спец|специал|кто\s+делает|кто\s+выполняет)/iu.test(messageForRouting);
    const explicitCalendarAvailability = explicitCalendarCue && explicitAvailabilityCue;
    const explicitUnknownServiceLike = Boolean(extractRequestedServicePhrase(norm(messageForRouting)));
    const serviceRecognizedInMessage = Boolean(serviceByText(norm(messageForRouting), services));
    if (explicitClientReschedulePhrase) intent = "reschedule_my_booking";
    if (explicitClientCancelPhrase && !cancelMeansDraftAbort && hasClientCancelContext) intent = "cancel_my_booking";
    if (explicitClientCancelConfirm) intent = "cancel_my_booking";
    if (explicitClientRescheduleConfirm) intent = "reschedule_my_booking";
    if (specialistFollowUpByLocation) intent = "ask_specialists";
    if (explicitWhoDoesServices || explicitSpecialistsListCue || explicitSpecialistsShortCue || explicitAlternativeSpecialistsInDraft) intent = "ask_specialists";
    if (explicitIdentityCue) intent = "identity";
    if (explicitAssistantQualification) intent = "identity";
    if (explicitOutOfScopeCue && !explicitDateBookingRequest) intent = "out_of_scope";
    if (explicitPauseConversation && !explicitDateBookingRequest) intent = "smalltalk";
    if (
      (intent === "unknown" || intent === "identity") &&
      !explicitIdentityCue &&
      !explicitAssistantQualification &&
      isGeneralQuestionOutsideBooking(norm(messageForRouting))
    ) {
      intent = "out_of_scope";
    }
    if (explicitAbuseCue) intent = "abuse_or_toxic";
    if (cancelMeansDraftAbort) {
      explicitBookingDecline = true;
      intent = "reject_or_change";
    }
    if (explicitNearestAvailability) intent = "ask_availability";
    if (explicitAvailabilityPeriod) intent = "ask_availability";
    if (explicitCalendarAvailability) intent = "ask_availability";
    if (hasDraftContextEarly && d.locationId && d.serviceId && !d.time && explicitDateOnlyInput) intent = "booking_start";
    if (explicitDateBookingRequest) intent = "booking_start";
    if (has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu) && !explicitDateTimeQuery && !explicitBookingDecline && !has(messageForRouting, /(мои записи|мою запись|статист|профил|кабинет|отмени|перенеси)/i)) intent = "booking_start";
    if (explicitServiceComplaint) intent = "smalltalk";
    if (explicitCapabilitiesPhrase) intent = "capabilities";
    if (explicitUnknownServiceLike && !serviceRecognizedInMessage && !explicitServiceComplaint && !has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu) && (hasDraftContextEarly || mentionsServiceTopic(norm(messageForRouting)) || has(messageForRouting, /(услуг|запиш|забронируй|хочу\s+на|нужн[ао]?\s+услуг)/i))) intent = "ask_services";
    if (explicitServicesFollowUp) intent = "ask_services";
    if (has(messageForRouting, /(пришли список|покажи список|скинь список|список услуг)/i)) intent = "ask_services";
    if (explicitServiceFollowUp) intent = "ask_services";
    if (!explicitServiceComplaint && (asksGenderedServices(messageForRouting) || asksServiceExistence(messageForRouting) || asksGenderSuitability(norm(messageForRouting)))) {
      intent = "ask_services";
    }
    if (!explicitServiceComplaint && mentionsServiceTopic(norm(messageForRouting)) && !explicitWhoDoesServices && intent !== "ask_specialists")
      intent = "ask_services";
    if (
      !explicitServiceComplaint &&
      has(messageForRouting, /(услуг|услуга|стриж|маник|педик|гель|facial|peeling|haircut|coloring)/i) &&
      has(messageForRouting, /(есть|какие|какой|подходит|для мужчин|для женщин)/i)
    ) {
      intent = "ask_services";
    }
    // Hard override for pricing requests: never route these to generic smalltalk.
    if (has(messageForRouting, /(какая цена|сколько стоит|цена|стоим|стоимость|по стоимости|по прайсу|ценник|деньги)/i)) {
      intent = "ask_price";
    }
    // If user clicked/typed a concrete service right after catalog, continue booking flow.
    if (serviceSelectionFromCatalog && !explicitServiceComplaint) {
      intent = "booking_start";
    }
    // Strong override: inside active booking context, explicit service choice must continue booking,
    // not service-info chat branch.
    if (hasDraftContextEarly && Boolean(serviceByText(norm(messageForRouting), services)) && !explicitServiceComplaint) {
      intent = "booking_set_service";
    }
    const selectedSpecialistByText = specialistByText(t, specialists);
    const explicitAnySpecialistChoice = isAnySpecialistChoiceText(t);
    const choiceNum = parseChoiceFromText(t);
    const hasClientActionCue = has(messageForRouting, /(какая у меня|моя статист|мои записи|мои данные|покажи мои|ближайш.*запис|прошедш.*запис|отмени мою|перенеси мою|личн(ый|ого) кабинет)/i);
    const hasPositiveFeedbackCue = has(messageForRouting, /(спасибо|благодар|круто|отлично|здорово|понятно|ок\b|окей|ясно|супер)/i);
    const specialistPromptedByAssistant =
      hasDraftContextEarly &&
      has(lastAssistantText, /(доступны специалисты|выберите специалиста|выберите кнопкой ниже)/i);
    const looksLikeSpecialistChoiceText = /^[\p{L}\s\-]{3,}$/u.test(messageForRouting.trim());

    const explicitBookingText =
      !explicitBookingDecline &&
      !isSoftBookingMention(t) &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      !specialistFollowUpByLocation &&
      has(
        message,
        /(запиш\p{L}*|записа\p{L}*|запис\p{L}*|окошк|свобод|слот|на сегодня|на завтра|сегодня вечером|сегодня утром|сегодня днем|сегодня днём|вечером|утром|днем|днём|оформи\p{L}*|бронь|заброни\p{L}*|сам|через ассистента|локац|филиал|в центр|в ривер|riverside|beauty salon center|beauty salon riverside)/iu,
      ) ||
      serviceSelectionFromCatalog ||
      Boolean(selectedSpecialistByText) ||
      explicitAnySpecialistChoice ||
      (specialistPromptedByAssistant && looksLikeSpecialistChoiceText);
    const hasDraftContext = hasDraftContextEarly;
    const forceClientActions =
      confirmPendingClientAction ||
      explicitClientCancelConfirm ||
      explicitClientRescheduleConfirm ||
      (explicitClientCancelPhrase && !cancelMeansDraftAbort && hasClientCancelContext) ||
      explicitClientReschedulePhrase;
    const isConsentStage = d.status === "WAITING_CONSENT" || d.status === "WAITING_CONFIRMATION";
    const shouldStayInAssistantStages = isConsentStage && d.mode === "ASSISTANT";
    const isConsentStageMessage = has(
      messageForRouting,
      /(согласен|согласна|персональн|подтверждаю|подтвердить|да|верно|записаться|оформи через ассистента)/i,
    );
    const forceChatOnlyInfoIntent = intent === "contact_address" || intent === "contact_phone" || intent === "working_hours";
    const forceBookingByContext =
      hasDraftContext &&
      !explicitBookingDecline &&
      (!isConsentStage || isConsentStageMessage || shouldStayInAssistantStages) &&
      !forceClientActions &&
      !forceChatOnlyInfoIntent &&
      (explicitBookingText || explicitAlternativeSpecialistsInDraft || (isBookingDomainIntent(intent) && !isInfoOnlyIntent(intent)) || isBookingCarryMessage(t) || isBookingChangeMessage(t));
    const forceBookingOnPromptedLocationChoice =
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      !specialistFollowUpByLocation &&
      intent !== "ask_specialists" &&
      Boolean(locationByText(t, locations)) &&
      has(lastAssistantText, /(выберите\s+(локац|филиал)|продолжу запись)/i);
    const forceBookingOnSpecialistQueryInDraft =
      hasDraftContext &&
      Boolean(d.serviceId) &&
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      (
        intent === "ask_specialists" ||
        explicitAlternativeSpecialistsInDraft ||
        /(?:друг(?:ие|ой)|ещ[её]|кроме|кто\s+делает\s+эту\s+услуг|кто\s+выполняет\s+эту\s+услуг|еще\s+мастер|ещ[её]\s+мастер|другие\s+мастера|другие\s+специалисты)/iu.test(messageForRouting)
      );
    const forceBookingOnServiceSelection =
      hasDraftContext &&
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      !explicitServiceComplaint &&
      (Boolean(serviceByText(t, services)) || explicitUnknownServiceLike) &&
      Boolean(d.locationId || locationByText(t, locations));
    const forceBookingAwaitingService =
      hasDraftContext &&
      Boolean(d.locationId) &&
      !d.serviceId &&
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery &&
      !hasClientActionCue &&
      !forceChatOnlyInfoIntent &&
      !isGreetingText(messageForRouting) &&
      (
        explicitUnknownServiceLike ||
        Boolean(serviceByText(t, services)) ||
        Boolean(locationByText(t, locations)) ||
        Boolean(parseTime(messageForRouting)) ||
        Boolean(parseDate(messageForRouting, nowYmd)) ||
        Boolean(choiceNum) ||
        has(messageForRouting, /(услуг|запиш|заброни|время|слот|окошк|дат[ауеы])/i) ||
        !isConversationalHeuristicIntent(intent)
      );
    if (hasDraftContext && explicitAvailabilityPeriod) {
      intent = "ask_availability";
    }
    const forceChatOnlyConversational =
      !explicitDateBookingRequest &&
      !shouldStayInAssistantStages &&
      !confirmPendingClientAction &&
      !continuePendingCancelChoice &&
      (asksClientOwnName(messageForRouting) ||
        asksClientRecognition(messageForRouting) ||
        intent === "smalltalk" ||
        intent === "greeting" ||
        intent === "identity" ||
        intent === "capabilities" ||
        intent === "out_of_scope" ||
        intent === "abuse_or_toxic" ||
        intent === "post_completion_smalltalk");
    const route = explicitDateTimeQuery || forceChatOnlyConversational || forceChatOnlyInfoIntent
      ? "chat-only"
      : forceClientActions
      ? "client-actions"
      : forceBookingByContext || forceBookingOnPromptedLocationChoice || forceBookingOnServiceSelection || forceBookingAwaitingService || forceBookingOnSpecialistQueryInDraft
      ? "booking-flow"
      : routeForIntent(intent);
    const useNluIntent = intent === mappedNluIntent && mappedNluIntent !== "unknown";

    const looksLikeBookingContinuation =
      isBookingCarryMessage(t) ||
      isLooseConfirmation(messageForRouting) ||
      isBookingChangeMessage(t) ||
      looksLikeUnknownServiceRequest(t) ||
      Boolean(parseDate(messageForRouting, nowYmd)) ||
      Boolean(parseTime(messageForRouting)) ||
      Boolean(choiceNum) ||
      Boolean(locationByText(t, locations)) ||
      Boolean(serviceByText(t, services)) ||
      Boolean(selectedSpecialistByText) ||
      explicitAnySpecialistChoice ||
      has(
        messageForRouting,
        /(согласен|согласна|персональн|подтвержд|оформи|самостоятельно|через ассистента|время|слот|окошк|сегодня|завтра|локац|филиал)/i,
      );
    const shouldContinueBookingByContext =
      route === "chat-only" && !explicitDateTimeQuery &&
      !explicitBookingDecline &&
      (!isConsentStage || isConsentStageMessage || shouldStayInAssistantStages) &&
      !confirmPendingClientAction &&
      !continuePendingCancelChoice &&
      !forceChatOnlyInfoIntent &&
      hasDraftContext &&
      looksLikeBookingContinuation &&
      (!isConversationalHeuristicIntent(intent) ||
        isLooseConfirmation(messageForRouting) ||
        Boolean(parseTime(messageForRouting)) ||
        Boolean(parseDate(messageForRouting, nowYmd)) ||
        Boolean(choiceNum) ||
        Boolean(locationByText(t, locations)) ||
        Boolean(serviceByText(t, services)) ||
        explicitUnknownServiceLike ||
        Boolean(selectedSpecialistByText));
    // In assistant completion stages, every follow-up must be processed by deterministic booking-flow
    // to enforce phone validation, consent, and explicit final confirmation.
    const conversationalAssistantStageIntent =
      intent === "greeting" ||
      intent === "smalltalk" ||
      intent === "identity" ||
      intent === "capabilities" ||
      intent === "out_of_scope" ||
      intent === "abuse_or_toxic";
    const forceAssistantStageFlow =
      shouldStayInAssistantStages &&
      hasDraftContext &&
      !conversationalAssistantStageIntent &&
      !explicitBookingDecline &&
      !forceClientActions &&
      !explicitDateTimeQuery;
    const explicitBookingRequestCue =
      has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|хочу|оформи\p{L}*|заброни\p{L}*|бронь)/iu) &&
      !explicitBookingDecline &&
      !hasClientActionCue &&
      !forceClientActions &&
      !explicitDateTimeQuery;
    const explicitServiceBookingIntent =
      Boolean(serviceByText(t, services)) &&
      has(messageForRouting, /(хочу|нужн[ао]?|надо|запиш|заброни)/i) &&
      !asksServiceExistence(messageForRouting);
    const shouldEnrichDraftForBooking =
      route === "booking-flow" || explicitBookingRequestCue || explicitBookingText || explicitAlternativeSpecialistsInDraft || shouldContinueBookingByContext || forceAssistantStageFlow || forceBookingOnPromptedLocationChoice || forceBookingOnServiceSelection || forceBookingAwaitingService || forceBookingOnSpecialistQueryInDraft || explicitServiceBookingIntent;
    const shouldRunBookingFlow =
      !forceChatOnlyInfoIntent &&
      (route === "booking-flow" || explicitBookingRequestCue || explicitBookingText || explicitAlternativeSpecialistsInDraft || shouldContinueBookingByContext || forceAssistantStageFlow || forceBookingOnPromptedLocationChoice || forceBookingOnServiceSelection || forceBookingAwaitingService || forceBookingOnSpecialistQueryInDraft || explicitServiceBookingIntent) &&
      intent !== "post_completion_smalltalk" &&
      !isGreetingText(messageForRouting) &&
      !hasPositiveFeedbackCue;
    const hasTimePrefCue = /(утр|утром|днем|днём|после обеда|вечер|вечером)/i.test(t);
    const prevUserNorm = norm(previousUserText);
    const carryPrevTimePref =
      !hasTimePrefCue &&
      Boolean(locationByText(t, locations)) &&
      /(утр|утром|днем|днём|после обеда|вечер|вечером)/i.test(prevUserNorm)
        ? prevUserNorm
        : "";
    const bookingMessageNorm = carryPrevTimePref ? `${t} ${carryPrevTimePref}` : t;
    let previouslySelectedSpecialistName: string | null = null;

    if (explicitBookingDecline) {
      d.locationId = null;
      d.serviceId = null;
      d.specialistId = null;
      d.date = null;
      d.time = null;
      d.mode = null;
      d.consentConfirmedAt = null;
      d.status = "COLLECTING";
    }

    // Fill draft opportunistically; booking-flow validates deterministically.
    const hadLocationBefore = Boolean(d.locationId);
    if (!d.locationId && shouldEnrichDraftForBooking) {
      const byName = locationByText(t, locations);
      if (byName) d.locationId = byName.id;
      else if (choiceNum && choiceNum >= 1 && choiceNum <= locations.length) d.locationId = locations[choiceNum - 1]!.id;
      else if (hasLocationCue(t) && nlu?.locationId && locations.some((x) => x.id === nlu.locationId)) d.locationId = nlu.locationId;
    }
    const locationChosenThisTurn = !hadLocationBefore && Boolean(d.locationId);
    if (
      d.specialistId &&
      !specialistSupportsSelection({
        specialistId: d.specialistId,
        serviceId: d.serviceId,
        locationId: d.locationId,
        specialists,
      })
    ) {
      d.specialistId = null;
    }
    const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
    const serviceTextMatch = serviceByText(t, scopedServices);
    const nluServiceValid = Boolean(nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId));
    const nluServiceObj = nlu?.serviceId ? scopedServices.find((x) => x.id === nlu.serviceId) ?? null : null;
    const requestedServicePhrase = extractRequestedServicePhrase(t);
    const nluServiceGrounded = isNluServiceGroundedByText(t, nluServiceObj);
    const unknownServiceRequested =
      shouldEnrichDraftForBooking &&
      !d.serviceId &&
      !serviceTextMatch &&
      mentionsServiceTopic(t) &&
      ((!nluServiceValid && looksLikeUnknownServiceRequest(t)) || (!!requestedServicePhrase && nluServiceValid && !nluServiceGrounded));

    if (unknownServiceRequested) {
      const requested = requestedServicePhrase ? `Услугу «${requestedServicePhrase}» не нашла. ` : "Такой услуги не нашла. ";
      const unknownServiceReply = `${requested}Выберите, пожалуйста, из доступных:\n${services
        .slice(0, 12)
        .map((x, i) => `${i + 1}. ${x.name} — ${Math.round(x.basePrice)} ₽, ${x.baseDurationMin} мин`)
        .join("\n")}`;
      await prisma.$transaction([
        prisma.aiMessage.create({ data: { threadId: thread.id, role: "assistant", content: unknownServiceReply } }),
        prismaAny.aiBookingDraft.update({
          where: { threadId: thread.id },
          data: {
            locationId: d.locationId,
            serviceId: d.serviceId,
            specialistId: d.specialistId,
            date: d.date,
            time: d.time,
            clientName: d.clientName,
            clientPhone: d.clientPhone,
            mode: d.mode,
            status: "COLLECTING",
            consentConfirmedAt: d.consentConfirmedAt ? new Date(d.consentConfirmedAt) : null,
          },
        }),
      ]);
      return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, reply: unknownServiceReply, action: null, ui: null, draft: d });
    }

    if (shouldEnrichDraftForBooking || (shouldRunBookingFlow && Boolean(d.locationId))) {
      const byText = serviceTextMatch;
      const serviceInquiry = isServiceInquiryMessage(message, t);
      const explicitServiceChangeRequest = has(message, /(смени|измени|другую услугу|не на|не эту услугу|выбери услугу|по услуге)/i);
      const canUseNumberForServiceSelection =
        !d.time || !d.serviceId || explicitServiceChangeRequest;
      if (!serviceInquiry && byText && byText.id !== d.serviceId) {
        d.serviceId = byText.id;
        if (
          d.specialistId &&
          !specialistSupportsSelection({
            specialistId: d.specialistId,
            serviceId: d.serviceId,
            locationId: d.locationId,
            specialists,
          })
        ) {
          d.specialistId = null;
        }
      } else if (
        canUseNumberForServiceSelection &&
        !locationChosenThisTurn &&
        choiceNum &&
        choiceNum >= 1 &&
        choiceNum <= scopedServices.length &&
        scopedServices[choiceNum - 1]!.id !== d.serviceId
      ) {
        d.serviceId = scopedServices[choiceNum - 1]!.id;
        if (
          d.specialistId &&
          !specialistSupportsSelection({
            specialistId: d.specialistId,
            serviceId: d.serviceId,
            locationId: d.locationId,
            specialists,
          })
        ) {
          d.specialistId = null;
        }
      } else if (
        nlu?.serviceId &&
        scopedServices.some((x) => x.id === nlu.serviceId) &&
        d.serviceId !== nlu.serviceId &&
        nluServiceGrounded
      ) {
        d.serviceId = nlu.serviceId;
        if (
          d.specialistId &&
          !specialistSupportsSelection({
            specialistId: d.specialistId,
            serviceId: d.serviceId,
            locationId: d.locationId,
            specialists,
          })
        ) {
          d.specialistId = null;
        }
      }
    }

    if (shouldEnrichDraftForBooking) {
      const parsedDate = parseDate(message, nowYmd);
      const parsedMonthDateFromRaw = (() => {
        const raw = messageForRouting.toLowerCase();
        const monthMatch = raw.match(
          /(?:^|\s)(?:в|на)?\s*(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)(?:\s|$)/u,
        );
        if (!monthMatch) return null;
        const monthMap: Record<string, string> = {
          "январе": "01",
          "феврале": "02",
          "марте": "03",
          "апреле": "04",
          "мае": "05",
          "июне": "06",
          "июле": "07",
          "августе": "08",
          "сентябре": "09",
          "октябре": "10",
          "ноябре": "11",
          "декабре": "12",
        };
        const month = monthMap[monthMatch[1] ?? ""];
        if (!month) return null;
        let year = Number(nowYmd.slice(0, 4));
        let candidate = `${year}-${month}-01`;
        if (candidate < nowYmd) {
          year += 1;
          candidate = `${year}-${month}-01`;
        }
        return candidate;
      })();
      const parsedTime = parseTime(message);
      d.date = parsedMonthDateFromRaw || parsedDate || pickSafeNluDate(nlu?.date, nowYmd) || d.date;
      // Time must come from explicit user text (or previously selected slot), not LLM guess.
      d.time = parsedTime || d.time;
      if (selectedSpecialistByText) d.specialistId = selectedSpecialistByText.id;
      const wantsSelfMode = has(message, /(сам|самостоятельно|в форме|онлайн)/i);
      const wantsAssistantMode = has(message, /(оформи|через ассистента|оформи ты|оформи ты)/i);
      if (wantsSelfMode) d.mode = "SELF";
      if (wantsAssistantMode) {
        d.mode = "ASSISTANT";
        // Always require fresh consent for assistant flow in current booking context.
        d.consentConfirmedAt = null;
      }
      if (!d.mode && d.specialistId && choiceNum === 1) d.mode = "SELF";
      if (!d.mode && d.specialistId && choiceNum === 2) {
        d.mode = "ASSISTANT";
        d.consentConfirmedAt = null;
      }
    }

    const parsedNluPhone = typeof nlu?.clientPhone === "string" ? parsePhone(nlu.clientPhone) : null;
    const parsedDraftPhone = d.clientPhone ? parsePhone(d.clientPhone) : null;
    const parsedClientPhone = client?.phone ? parsePhone(client.phone) : null;
    const parsedMessagePhone = parsePhone(message);
    d.clientPhone = parsedMessagePhone || parsedNluPhone || parsedDraftPhone || parsedClientPhone || null;

    const explicitNameCue = has(message, /(меня\s+зовут|имя\s+клиента|клиент[:\s]|мое\s+имя|моё\s+имя)/i);
    const parsedMessageName = parseName(message);
    const shouldCaptureClientName =
      d.mode === "ASSISTANT" ||
      d.status === "WAITING_CONSENT" ||
      d.status === "WAITING_CONFIRMATION" ||
      Boolean(parsedMessagePhone) ||
      explicitNameCue;
    if (shouldCaptureClientName) {
      d.clientName =
        parsedMessageName ||
        (explicitNameCue ? nlu?.clientName ?? null : null) ||
        d.clientName ||
        [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() ||
        null;
    }
    const explicitConsentText =
      d.mode === "ASSISTANT" &&
      (d.status === "WAITING_CONSENT" || d.status === "WAITING_CONFIRMATION") &&
      hasExplicitConsentGrant(message);
    if (explicitConsentText) {
      d.consentConfirmedAt = new Date().toISOString();
    }

    const origin = new URL(request.url).origin;
    const publicSlug = buildPublicSlugId(resolved.account.slug, resolved.account.id);

    let reply = `Я ${ASSISTANT_NAME}, помогу с записью. Что нужно?`;
    let nextStatus = d.status;
    let nextAction: Action = null;
    let nextUi: ChatUi | null = null;
    const shouldGenerateSmalltalk =
      route === "chat-only" &&
      !explicitDateTimeQuery &&
      !shouldRunBookingFlow &&
      !explicitServiceComplaint &&
      (intent === "smalltalk" || intent === "out_of_scope");
    const generatedSmalltalk = shouldGenerateSmalltalk
      ? await runAishaSmallTalkReply({
          accountId: resolved.account.id,
          message: messageForRouting,
          assistantName: ASSISTANT_NAME,
          recentMessages: [...recentMessages].reverse(),
          accountProfile,
          locations,
          services,
          knownClientName: d.clientName,
          specialists: specialists.map((s) => ({ id: s.id, name: s.name })),
          todayYmd: nowYmd,
          nowHm,
          accountTimeZone: resolved.account.timeZone,
          clientTimeZone: clientTimeZone ?? null,
          draftDate: d.date,
          draftTime: d.time,
        })
      : null;

    const consecutiveNonBookingTurns = countConsecutiveNonBookingUserTurns(recentMessages);
    const hasBookingVerbCue = has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|хочу|сделать|оформи\p{L}*|заброни\p{L}*|бронь)/iu);
    const hasServiceTopicCue = mentionsServiceTopic(t) || Boolean(serviceByText(t, services));

    const shouldSoftReturnToBooking =
      route === "chat-only" &&
      (intent === "smalltalk" || intent === "out_of_scope") &&
      !explicitDateTimeQuery &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t) &&
      !hasBookingVerbCue &&
      !hasServiceTopicCue &&
      !isGreetingText(messageForRouting) &&
      !isPauseConversationMessage(t) &&
      !asksWhyNoAnswer(t) &&
      !explicitDateBookingRequest;

    const bridgeFocusServiceName =
      serviceByText(t, services)?.name ??
      (d.serviceId ? services.find((s) => s.id === d.serviceId)?.name ?? null : null);
    const bridgeFocusLocationName =
      d.locationId ? locations.find((x) => x.id === d.locationId)?.name ?? null : null;
    const bridgeFocusDate = parseDate(messageForRouting, nowYmd) || d.date || null;
    const bridgeFocusTimePreference: "morning" | "day" | "evening" | null =
      /(утр|утром)/i.test(t) ? "morning" : /(вечер|вечером)/i.test(t) ? "evening" : /(днем|днём|после обеда)/i.test(t) ? "day" : null;

    const directBookingKickoffFallback =
      !hasDraftContextEarly &&
      !explicitDateTimeQuery &&
      locations.length > 1 &&
      has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|оформи\p{L}*|заброни\p{L}*|хочу)/iu) &&
      !has(messageForRouting, /(мои записи|мою запись|статист|профил|кабинет|отмени|перенеси)/i);
    const contextualBookingBridge = shouldSoftReturnToBooking
      ? await runAishaBookingBridge({
          accountId: resolved.account.id,
          assistantName: ASSISTANT_NAME,
          message: messageForRouting,
          baseReply: reply,
          accountProfile,
          locations,
          services,
          todayYmd: nowYmd,
          nowHm,
          accountTimeZone: resolved.account.timeZone,
          clientTimeZone: clientTimeZone ?? null,
          draftDate: d.date,
          draftTime: d.time,
        })
      : null;

    if (directBookingKickoffFallback) {
      reply = d.date
        ? `На ${formatYmdRu(d.date)} выберите филиал (локацию), и продолжу запись.` 
        : "Выберите филиал (локацию), и продолжу запись.";
      nextUi = { kind: "quick_replies", options: locations.slice(0, 12).map((x) => ({ label: x.name, value: x.name })) };
    } else if (route === "client-actions") {
      const effectiveClientId = client?.clientId ?? thread.clientId ?? null;
      const authLevel: AuthLevel = client?.clientId ? "full" : thread.clientId ? "thread_only" : "none";
      const clientFlow = await runClientAccountFlow({
        message: messageForRouting,
        messageNorm: norm(messageForRouting),
        accountId: resolved.account.id,
        accountTimeZone: resolved.account.timeZone,
        clientId: effectiveClientId,
        authMode: authLevel === "none" ? "full" : authLevel,
      });
      if (clientFlow.handled) {
        reply = clientFlow.reply ?? reply;
      } else if (authLevel === "none") {
        const accountParam = resolved.account.slug || "";
        const loginUrl = accountParam ? `/c/login?account=${encodeURIComponent(accountParam)}` : "/c/login";
        reply = "Для персональных данных нужна активная авторизация. Нажмите кнопку ниже, чтобы войти в личный кабинет.";
        nextUi = {
          kind: "quick_replies",
          options: [{ label: "Войти в личный кабинет", value: "Открыть личный кабинет", href: loginUrl }],
        };
      } else {
        reply = "Поняла. Могу показать последние/прошедшие записи, статистику, а также помочь с переносом или отменой.";
      }
    } else if (shouldRunBookingFlow) {
      const hasBookingVerb = has(messageForRouting, /(запиш\p{L}*|записа\p{L}*|хочу|оформи\p{L}*|заброни\p{L}*|бронь)/iu);
      const hasExplicitAvailabilityQuery =
        (explicitNearestAvailability ||
          explicitAvailabilityPeriod ||
          has(message, /(окошк|свобод|время|слот|обед|после обеда|утр|вечер|днем|днём)/i)) &&
        !hasBookingVerb;
      const hasInitialBookingSkeleton =
        !d.locationId &&
        !d.serviceId &&
        !d.time &&
        !hasExplicitAvailabilityQuery &&
        (explicitBookingText || intent === "booking_start" || hasBookingVerb);
      const asksAvailabilityNow =
        !hasInitialBookingSkeleton &&
        (
          intent === "ask_availability" ||
          explicitNearestAvailability ||
          explicitAvailabilityPeriod ||
          has(message, /(окошк|свобод|время|слот|обед|после обеда|утр|вечер|днем|днём)/i) ||
          (explicitCalendarCue && Boolean(d.locationId) && !d.time) ||
          // If user just selected location while discussing windows/date, keep showing times first.
          (locationChosenThisTurn && Boolean(d.date) && !d.serviceId && !d.time)
        );
      const flowResult = await runBookingFlow({
        messageNorm: bookingMessageNorm,
        bookingIntent: shouldRunBookingFlow,
        asksAvailability: asksAvailabilityNow,
        choice: choiceNum,
        d,
        currentStatus: d.status,
        origin,
        account: { id: resolved.account.id, slug: resolved.account.slug, timeZone: resolved.account.timeZone },
        locations,
        services,
        specialists,
        previouslySelectedSpecialistName,
        requiredVersionIds,
        request,
        publicSlug,
        todayYmd: nowYmd,
      });
      if (flowResult.handled) {
        reply = flowResult.reply ?? reply;
        nextStatus = flowResult.nextStatus ?? nextStatus;
        nextAction = flowResult.nextAction ?? nextAction;
        nextUi = flowResult.ui ?? null;
      }
    } else {
      if (explicitDateTimeQuery) {
        const nowInClientTz = getNowInTimeZone(clientTimeZone ?? resolved.account.timeZone);
        const hh = String(Math.floor(nowInClientTz.minutes / 60)).padStart(2, "0");
        const mm = String(nowInClientTz.minutes % 60).padStart(2, "0");
        reply = `Сейчас ${formatYmdRu(nowInClientTz.ymd)}, ${hh}:${mm}.`;
      } else if (asksClientOwnName(message)) {
        const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
        reply = knownName
          ? `Да, вас зовут ${knownName}.`
          : "Пока не вижу вашего имени в профиле. Могу обращаться по имени, если напишете его.";
            } else if (asksClientRecognition(message)) {
        const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
        reply = knownName
          ? `Да, вижу вас в профиле: ${knownName}.`
          : "Пока не вижу вас в авторизованном профиле. Могу продолжить запись как гостя или после входа в личный кабинет.";
      } else if (has(messageForRouting, /(как салон называется|как называется салон|как ваш салон называется|как называется ваш салон|название салона)/i)) {
        const accountName = resolved.account.name?.trim();
        reply = accountName ? `Наш салон называется «${accountName}».` : "Название салона сейчас недоступно.";
      } else if (intent === "greeting") {
        const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
        reply = knownName ? `Здравствуйте, ${knownName}! Чем помочь?` : "Здравствуйте! Чем помочь?";
      } else if (intent === "identity") {
        reply = `Я ${ASSISTANT_NAME}, ассистент записи. Помогу с услугами, временем, записью и вашими данными клиента.`;
      } else if (intent === "capabilities") {
        reply = "Помогаю с записью, подбором свободных окон, контактами, а также могу показать ваши записи и статистику.";
      } else if (intent === "out_of_scope") {
        if (
          generatedSmalltalk &&
          !isGenericBookingTemplateReply(generatedSmalltalk) &&
          !isGeneralQuestionOutsideBooking(norm(messageForRouting)) &&
          !explicitOutOfScopeCue
        ) {
          reply = generatedSmalltalk;
        } else {
          reply = buildOutOfScopeConversationalReply(norm(messageForRouting));
        }
      } else if (intent === "abuse_or_toxic") {
        reply = "Давайте общаться уважительно. Я помогу с записью и вопросами по услугам.";
      } else if (intent === "post_completion_smalltalk") {
        reply = "Здорово, рада, что вам понравилось. Если нужно, помогу с записью.";
      } else if (intent === "smalltalk") {
        if (isGreetingText(messageForRouting)) {
          reply = "Здравствуйте! Чем помочь?";
        } else if (asksWhyNoAnswer(t) || isPauseConversationMessage(t)) {
          reply = buildSmalltalkReply(t);
        } else if (explicitServiceComplaint) {
          reply =
            "Сожалею, что так вышло. Спасибо, что написали об этом. Опишите, пожалуйста, что именно не устроило, и я передам обращение администратору и помогу подобрать корректную запись к другому мастеру.";
        } else if (generatedSmalltalk) {
          reply = generatedSmalltalk;
        } else if (isOutOfDomainPrompt(t)) {
          reply = buildOutOfScopeConversationalReply(t);
        } else {
          reply = buildSmalltalkReply(norm(messageForRouting));
        }
      } else if (intent === "contact_phone") {
        const phoneReply = accountProfile?.phone ? `Номер студии: ${accountProfile.phone}.` : "Сейчас номер телефона недоступен.";
        reply = locations.length ? `${phoneReply} Локации доступны кнопками ниже.` : phoneReply;
        if (locations.length) {
          nextUi = { kind: "quick_replies", options: locations.slice(0, 12).map((x) => ({ label: x.name, value: x.name })) };
        }
      } else if (intent === "contact_address") {
        if (locations.length) {
          const addressLines = locations
            .slice(0, 12)
            .map((x, i) => `${i + 1}. ${x.name}${x.address ? " — " + x.address : " — адрес уточняется"}`)
            .join("\n");
          reply = `Адреса филиалов:\n${addressLines}`;
          nextUi = { kind: "quick_replies", options: locations.slice(0, 12).map((x) => ({ label: x.name, value: x.name })) };
        } else {
          reply = accountProfile?.address
            ? `Адрес: ${accountProfile.address}`
            : "Адрес пока не указан. Могу помочь с записью по удобной локации.";
        }
      } else if (intent === "working_hours") {
        reply = "Обычно работаем ежедневно с 09:00 до 21:00. Если нужно, проверю точный график по конкретной локации и дате.";
      } else if (intent === "ask_specialists") {
        const dateForSpecialists = parseDate(message, nowYmd) || d.date;
        const locationFromMessage = locationByText(t, locations);
        const selectedLocationId = locationFromMessage?.id ?? d.locationId ?? null;

        if (selectedLocationId) {
          d.locationId = selectedLocationId;
          const selectedLocation = locations.find((x) => x.id === selectedLocationId) ?? null;
          const scoped = specialists.filter((s) => s.locationIds.includes(selectedLocationId));
          if (scoped.length) {
            reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}в ${selectedLocation?.name ?? "выбранной локации"} доступны специалисты. Выберите кнопкой ниже.`;
            nextUi = { kind: "quick_replies", options: scoped.slice(0, 16).map((x) => ({ label: x.name, value: x.name })) };
          } else {
            reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}по этой локации не нашла специалистов в расписании.`;
          }
        } else {
          const byLocation = locations
            .map((loc) => ({
              loc,
              items: specialists.filter((s) => s.locationIds.includes(loc.id)).slice(0, 10),
            }))
            .filter((x) => x.items.length > 0);
          if (byLocation.length) {
            reply = `${dateForSpecialists ? `На ${formatYmdRu(dateForSpecialists)} ` : ""}доступны специалисты по филиалам. Выберите филиал кнопкой ниже.`;
            nextUi = { kind: "quick_replies", options: byLocation.slice(0, 12).map((x) => ({ label: x.loc.name, value: x.loc.name })) };
          } else {
            reply = "Сейчас не нашла специалистов в расписании. Могу проверить по конкретной локации и дате.";
          }
        }
      } else if (asksCurrentDate(message)) {
        reply = `Сегодня ${formatYmdRu(nowYmd)}.`;
      } else if (intent === "ask_services") {
        if (isServiceComplaintMessage(t)) {
          reply =
            "Сожалею, что так вышло. Пожалуйста, опишите, что именно не устроило, и я передам обращение администратору. Также могу подобрать запись к другому мастеру.";
        } else {
        if (explicitServicesFollowUp) {
          const sample = services.slice(0, 6).map((x) => x.name).join(", ");
          reply = sample ? `Доступные услуги: ${sample}.` : "Доступные услуги ниже. Выберите нужную кнопкой.";
          nextUi = { kind: "quick_replies", options: services.slice(0, 12).map(serviceQuickOption) };
        } else {
        const selectedByText = serviceByText(t, services);
        const maleContext = asksGenderedServices(t) || /(мужск|для мужчин|для парня)/i.test(t) || /(мужск|для мужчин|для парня)/i.test(previousUserText);
        const femaleContext = /(женск|для женщин|для девушки)/i.test(t) || /(женск|для женщин|для девушки)/i.test(previousUserText);
        if (selectedByText) {
          const n = norm(selectedByText.name);
          if (asksGenderSuitability(t) && /(women|жен)/i.test(n)) {
            reply = `«${selectedByText.name}» обычно выбирают для женщин. Для мужчин могу предложить «Men Haircut», если нужно — сразу подберу время.`;
          } else if (asksGenderSuitability(t) && /(men|муж)/i.test(n)) {
            reply = `«${selectedByText.name}» обычно выбирают для мужчин. Для женщин могу предложить «Women Haircut», если нужно — сразу подберу время.`;
          } else {
            reply = `Да, услуга «${selectedByText.name}» есть. Стоимость ${Math.round(selectedByText.basePrice)} ₽, длительность ${selectedByText.baseDurationMin} мин.`;
          }
        } else if (maleContext || femaleContext) {
          const gendered = services.filter((x) => {
            const n = norm(x.name);
            if (maleContext && /(men|муж)/i.test(n)) return true;
            if (femaleContext && /(women|жен)/i.test(n)) return true;
            return false;
          });
          if (gendered.length) {
            reply = "Подходящие услуги ниже. Выберите кнопкой.";
            nextUi = { kind: "quick_replies", options: gendered.slice(0, 12).map(serviceQuickOption) };
          } else {
            const suggested = services
              .filter((x) => /(haircut|стриж|manicure|маник|pedicure|педик)/i.test(norm(x.name)))
              .slice(0, 8);
            reply = "Из доступных сейчас могу предложить варианты ниже. Выберите кнопкой.";
            const optionsSource = suggested.length ? suggested : services.slice(0, 8);
            nextUi = { kind: "quick_replies", options: optionsSource.map(serviceQuickOption) };
          }
        } else if (asksGenderSuitability(t)) {
          reply = "Есть услуги для мужчин и для женщин. Например: Men Haircut и Women Haircut. Напишите, что именно нужно, и я подберу вариант.";
          const genderExamples = services.filter((x) => /(men haircut|women haircut|муж|жен)/i.test(norm(x.name))).slice(0, 6);
          if (genderExamples.length) nextUi = { kind: "quick_replies", options: genderExamples.map(serviceQuickOption) };
        } else if (asksServiceExistence(t) || looksLikeUnknownServiceRequest(t)) {
          const requested = extractRequestedServicePhrase(t);
          reply = `${requested ? `Услугу «${requested}» не нашла.` : "Такой услуги не нашла."} Выберите, пожалуйста, из доступных ниже.`;
          nextUi = { kind: "quick_replies", options: services.slice(0, 12).map(serviceQuickOption) };
        } else {
          reply = "Доступные услуги ниже. Выберите нужную кнопкой.";
          nextUi = { kind: "quick_replies", options: services.slice(0, 12).map(serviceQuickOption) };
        }
        }
        }
      } else if (intent === "ask_price") {
        const selectedByText = serviceByText(t, services);
        if (selectedByText) {
          reply = `${selectedByText.name}: ${Math.round(selectedByText.basePrice)} ₽, ${selectedByText.baseDurationMin} мин.`;
        } else {
          reply = "Ориентиры по стоимости в кнопках ниже. Выберите услугу.";
          nextUi = { kind: "quick_replies", options: services.slice(0, 12).map(serviceQuickOption) };
        }
      } else if (mentionsServiceTopic(t)) {
        const selectedByText = serviceByText(t, services);
        if (selectedByText) {
          reply = `Да, услуга «${selectedByText.name}» есть. Стоимость ${Math.round(selectedByText.basePrice)} ₽, длительность ${selectedByText.baseDurationMin} мин.`;
        } else {
          const requested = extractRequestedServicePhrase(t);
          reply = `${requested ? `Услугу «${requested}» не нашла.` : "Такой услуги не нашла."} Выберите, пожалуйста, из доступных ниже.`;
          nextUi = { kind: "quick_replies", options: services.slice(0, 12).map(serviceQuickOption) };
        }
      } else {
        if (isOutOfDomainPrompt(t) || isGeneralQuestionOutsideBooking(t)) {
          reply = buildOutOfScopeConversationalReply(t);
        } else {
          reply = "Я ассистент записи. Помогу с услугами, датами, временем и специалистами. Чем помочь?";
        }
      }
    }
    const canNaturalizeReply =
      route === "chat-only" && !explicitDateTimeQuery &&
      (intent === "capabilities" || intent === "greeting" || intent === "smalltalk") &&
      !isPauseConversationMessage(t) &&
      !asksWhyNoAnswer(t) &&
      !isGeneralQuestionOutsideBooking(t) &&
      !nextUi &&
      !reply.includes("\n") &&
      reply.length <= 260;
    if (canNaturalizeReply) {
      const naturalized = await runAishaNaturalizeReply({
        accountId: resolved.account.id,
        assistantName: ASSISTANT_NAME,
        message: messageForRouting,
        canonicalReply: reply,
        accountProfile,
        knownClientName: d.clientName,
      });
      if (naturalized) reply = naturalized;
    }

    if (
      shouldSoftReturnToBooking &&
      route === "chat-only" &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t)
    ) {
      const bridgeCandidate = (contextualBookingBridge ?? "").trim();
      const bridge =
        bridgeCandidate &&
        !looksLikeHardBookingPushReply(bridgeCandidate) &&
        !/выберите\s+(филиал|услугу|дату|время)/i.test(bridgeCandidate)
          ? bridgeCandidate
          : buildBookingBridgeFallback(t, { serviceName: bridgeFocusServiceName, date: bridgeFocusDate, timePreference: bridgeFocusTimePreference });
      if (reply && !/подбер[уё].*запис|услуг.*дат|дата.*время|перейд(ем|у)\s+к\s+записи/i.test(norm(reply))) {
        reply = reply.replace(/[.!?]+$/u, "") + ". " + bridge;
      } else if (!reply) {
        reply = bridge;
      }
      if (!nextUi && consecutiveNonBookingTurns >= 1) {
        nextUi = buildBookingReengageUi({ locations, services, focusDate: bridgeFocusDate });
      }
      if (bridgeFocusDate && locations.length === 1) {
        const onlyLocationName = locations[0]?.name ?? "выбранная локация";
        if (!new RegExp(onlyLocationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(reply)) {
          reply = `${reply.replace(/[.!?]+$/u, "")}. На ${formatYmdRu(bridgeFocusDate)} доступна локация: ${onlyLocationName}.`;
        }
      }
    }

    if (
      route === "chat-only" &&
      (intent === "smalltalk" || intent === "out_of_scope") &&
      !hasDraftContext &&
      !isBookingOrAccountCue(t) &&
      looksLikeHardBookingPushReply(reply)
    ) {
      const bridge = "Если хотите, могу сразу перейти к записи и подобрать удобное время.";
      const base = buildOutOfScopeConversationalReply(t);
      reply = base.replace(/[.!?]+$/u, "") + ". " + bridge;
      nextUi = buildBookingReengageUi({ locations, services, focusDate: bridgeFocusDate });
    }

    // De-duplicate accidental double soft-bridge sentence.
    reply = reply.replace(
      /(Если захотите, помогу с записью:[^.!?]*[.!?])\s*Если захотите, помогу с записью:[^.!?]*[.!?]/iu,
      "$1",
    );

    reply = sanitizeAssistantReplyText(reply);
    if (route === "chat-only" && !explicitDateTimeQuery && looksLikeServiceClaimInReply(reply) && !hasKnownServiceNameInText(reply, services)) {
      reply = "Доступные услуги ниже. Выберите нужную кнопкой.";
      nextUi = { kind: "quick_replies", options: services.slice(0, 12).map(serviceQuickOption) };
    }

    const hallucinationSensitiveIntent = intent === "smalltalk";
    if (
      route === "chat-only" && !explicitDateTimeQuery &&
      hallucinationSensitiveIntent &&
      hasUnknownPersonNameInReply({
        reply,
        specialists,
        knownClientName: d.clientName || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() || null,
        assistantName: ASSISTANT_NAME,
      })
    ) {
      reply = "Я ассистент записи. Помогу с услугами, датами, временем и специалистами. Чем помочь?";
      nextUi = null;
    }

    if (route === "chat-only" && !isBookingOrAccountCue(t) && !/^если захотите, помогу с записью/i.test(norm(reply)) && /^(?:выберите\s+филиал)/i.test(norm(reply))) {
      const bridge = "Ниже можно сразу выбрать удобный шаг для записи.";
      const base = buildOutOfScopeConversationalReply(t);
      reply = base.replace(/[.!?]+$/u, "") + ". " + bridge;
      nextUi = buildBookingReengageUi({ locations, services, focusDate: bridgeFocusDate });
    }

    await prisma.$transaction([
      prisma.aiMessage.create({ data: { threadId: thread.id, role: "assistant", content: reply } }),
      prismaAny.aiBookingDraft.update({
        where: { threadId: thread.id },
        data: {
          locationId: d.locationId,
          serviceId: d.serviceId,
          specialistId: d.specialistId,
          date: d.date,
          time: d.time,
          clientName: d.clientName,
          clientPhone: d.clientPhone,
          mode: d.mode,
          status: nextStatus,
          consentConfirmedAt: d.consentConfirmedAt ? new Date(d.consentConfirmedAt) : null,
        },
      }),
      prisma.aiAction.update({
        where: { id: turnAction.id },
        data: {
          status: "COMPLETED",
          payload: {
            message,
            reply,
            intent,
            route,
            intentConfidence: nluConfidence,
            matrix: INTENT_ACTION_MATRIX[intent],
            antiHallucinationRules: ANTI_HALLUCINATION_RULES,
            nextStatus,
            nluSource: nluResult.source,
            nluIntent: nlu?.intent ?? null,
            mappedNluIntent,
            actionType: nextAction?.type ?? null,
            uiKind: nextUi?.kind ?? null,
            confirmPendingClientAction,
            pendingClientActionType: pendingClientAction?.type ?? null,
            messageForRouting,
          },
        },
      }),
      prisma.aiLog.create({
        data: {
          actionId: turnAction.id,
          level: "info",
          message: "assistant_turn_metrics",
          data: {
            intent,
            route,
            intentConfidence: nluConfidence,
            usedFallback: nluResult.source === "fallback",
            usedNluIntent: useNluIntent,
            failedAction: false,
            actionType: nextAction?.type ?? null,
          },
        },
      }),
    ]);

    return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, reply, action: nextAction, ui: nextUi, draft: d });
  } catch (e) {
    return failSoft(e instanceof Error ? e.message : "unknown_error");
  }
}
















