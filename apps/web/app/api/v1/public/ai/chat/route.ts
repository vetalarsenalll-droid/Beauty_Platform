import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { AishaNluIntent, runAishaNlu, runAishaSmallTalkReply } from "@/lib/aisha-orchestrator";
import { runBookingFlow } from "@/lib/booking-flow";
import { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { ANTI_HALLUCINATION_RULES, AishaIntent, routeForIntent } from "@/lib/dialog-policy";
import { INTENT_ACTION_MATRIX } from "@/lib/intent-action-matrix";
import { runClientAccountFlow } from "@/lib/client-account-flow";
import { getNowInTimeZone, resolvePublicAccount } from "@/lib/public-booking";

const prismaAny = prisma as any;

type Body = { message?: unknown; threadId?: unknown };
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
const NLU_INTENT_CONFIDENCE_THRESHOLD = 0.58;

const asText = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 1200) : "");
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

async function getThread(accountId: number, threadId: number | null, clientId: number | null) {
  let thread = threadId != null ? await prisma.aiThread.findFirst({ where: { id: threadId, accountId } }) : null;
  if (!thread) {
    thread = await prisma.aiThread.create({ data: { accountId, clientId } });
  }
  if (clientId && !thread.clientId) {
    thread = await prisma.aiThread.update({ where: { id: thread.id }, data: { clientId } });
  }
  const ensuredThread = thread;
  const draft = await prismaAny.aiBookingDraft.upsert({
    where: { threadId: ensuredThread.id },
    create: { threadId: ensuredThread.id, status: "COLLECTING" },
    update: {},
  });
  return { thread: ensuredThread, draft };
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

const parseDate = (m: string, today: string) => {
  const t = norm(m);
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
  return null;
};

const parseTime = (m: string) => {
  const t = norm(m);
  const hhmm = t.match(/\b([01]?\d|2[0-3])[:. ]([0-5]\d)\b/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;
  const prepHour = t.match(/\b(?:в|к|at)\s*(\d{1,2})\b/);
  if (prepHour) {
    const n = Number(prepHour[1]);
    if (n >= 0 && n <= 23) return `${String(n).padStart(2, "0")}:00`;
  }
  return null;
};

const parsePhone = (m: string) => {
  const s = m.match(/(?:\+7|8)\D*(?:\d\D*){10}/)?.[0] ?? "";
  const d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return `+${d}`;
  if (d.length === 10) return `+7${d}`;
  return null;
};
const parseName = (m: string) => m.match(/(?:меня зовут|имя)\s+([A-Za-zА-Яа-яЁё\-]{2,})/i)?.[1] ?? null;

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
  const direct = services.find((x) => messageNorm.includes(norm(x.name)));
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
  return has(text, /(какое число|какая сегодня дата|какой сегодня день|what date is it|today date)/i);
}

function isConversationalHeuristicIntent(intent: AishaIntent) {
  return intent === "greeting" || intent === "smalltalk" || intent === "identity" || intent === "capabilities";
}

function intentFromHeuristics(message: string): AishaIntent {
  if (has(message, /(мои записи|моя запись|покажи мои записи|последн(яя|юю)|предстоящ(ая|ую)|ближайш(ая|ую|ую)|какая у меня.*запись|прошедш(ая|ую))/i))
    return "my_bookings";
  if (has(message, /(моя статистика|статистика|сколько раз)/i)) return "my_stats";
  if (has(message, /(перенеси запись|перезапиши|перенести #|reschedule|перенеси.*запись|перенеси(ть)? (ее|её|эту)|можешь.*перенести)/i))
    return "reschedule_my_booking";
  if (has(message, /(отмени запись|отменить #|cancel booking|отмени.*запись|отмена.*записи|отмени(ть)? (ее|её|эту)|можешь.*отменить)/i))
    return "cancel_my_booking";
  if (has(message, /(повтори прошлую запись|повтори запись)/i)) return "repeat_booking";
  if (has(message, /(мои данные|мой профиль|смени телефон|обнови телефон)/i)) return "client_profile";
  if (has(message, /(дай номер|номер студии|номер филиала|номер локации|телефон)/i)) return "contact_phone";
  if (has(message, /(где находится|адрес|как добраться)/i)) return "contact_address";
  if (has(message, /(до скольки|график|часы работы|работает)/i)) return "working_hours";
  if (has(message, /(какие услуги|что по услугам|прайс)/i)) return "ask_services";
  if (has(message, /(какая цена|сколько стоит|цена)/i)) return "ask_price";
  if (has(message, /(какие мастера|какой мастер|какие специалисты|у каких мастеров)/i)) return "ask_specialists";
  if (has(message, /(окошк|свобод|слот|на сегодня|на завтра|на вечер)/i)) return "ask_availability";
  if (has(message, /(кто ты|как тебя зовут|твое имя|твоё имя)/i)) return "identity";
  if (has(message, /(что умеешь|чем занимаешься|что ты можешь)/i)) return "capabilities";
  if (has(message, /^(привет|здравствуйте|здравствуй|добрый день|добрый вечер|hello|hi)\b/i)) return "greeting";
  if (has(message, /(как дела|как жизнь|что нового|че каво|чё каво)/i)) return "smalltalk";
  if (has(message, /(запиш|записаться|запись|оформи|забронируй)/i)) return "booking_start";
  return "unknown";
}

function mapNluIntent(intent: AishaNluIntent): AishaIntent {
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
      return intent as AishaIntent;
  }
}

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);
  const { thread, draft } = await getThread(resolved.account.id, threadId, client?.clientId ?? null);
  const messages = await prisma.aiMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { id: "asc" },
    select: { id: true, role: true, content: true },
  });
  return jsonOk({ threadId: thread.id, messages, draft: draftView(draft) });
}

export async function DELETE(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  if (!threadId) return jsonError("VALIDATION_FAILED", "threadId is required", null, 400);
  const thread = await prisma.aiThread.findFirst({ where: { id: threadId, accountId: resolved.account.id } });
  if (!thread) return jsonError("NOT_FOUND", "Thread not found", null, 404);
  const newThread = await prisma.aiThread.create({
    data: {
      accountId: resolved.account.id,
      clientId: thread.clientId ?? null,
      userId: thread.userId ?? null,
      title: thread.title ?? null,
    },
  });
  await prismaAny.aiBookingDraft.upsert({
    where: { threadId: newThread.id },
    create: { threadId: newThread.id, status: "COLLECTING" },
    update: {},
  });
  return jsonOk({ ok: true, threadId: newThread.id });
}

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return jsonError("VALIDATION_FAILED", "Invalid JSON body", null, 400);
  const message = asText(body.message);
  if (!message) return jsonError("VALIDATION_FAILED", "Field 'message' is required", null, 400);

  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);
  const { thread, draft } = await getThread(resolved.account.id, asThreadId(body.threadId), client?.clientId ?? null);

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
    return jsonOk({ threadId: thread.id, reply, action: null, draft: draftView(draft) });
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
        where: { accountId: resolved.account.id, isRequired: true },
        select: { versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1, select: { id: true } } },
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
    const requiredVersionIds = requiredDocs.map((d) => d.versions[0]?.id).filter((x): x is number => Number.isInteger(x));

    const nowYmd = getNowInTimeZone(resolved.account.timeZone).ymd;
    const d = draftView(draft);
    const t = norm(message);

    const nluResult = await runAishaNlu({
      message,
      nowYmd,
      draft: d,
      account: { id: resolved.account.id, slug: resolved.account.slug, timeZone: resolved.account.timeZone },
      accountProfile,
      locations,
      services,
      specialists,
      recentMessages: [...recentMessages].reverse(),
      systemPrompt: customPrompt,
    });
    const nlu = nluResult.nlu;

    const heuristicIntent = intentFromHeuristics(message);
    const mappedNluIntent = mapNluIntent((nlu?.intent ?? "unknown") as AishaNluIntent);
    const nluConfidence = typeof nlu?.confidence === "number" ? nlu.confidence : 0;
    const useNluIntent = mappedNluIntent !== "unknown" && nluConfidence >= NLU_INTENT_CONFIDENCE_THRESHOLD;
    const intent: AishaIntent = isConversationalHeuristicIntent(heuristicIntent)
      ? heuristicIntent
      : useNluIntent
      ? mappedNluIntent
      : heuristicIntent;
    const route = routeForIntent(intent);

    const listLocations = `Наши локации:\n${locations.map((x, i) => `${i + 1}. ${x.name}${x.address ? ` — ${x.address}` : ""}`).join("\n")}`;
    const explicitBookingText = has(
      message,
      /(запиш|записаться|запись|окошк|свобод|время|дата|услуга|слот|на сегодня|на завтра|оформи|бронь|забронируй|сам|через ассистента)/i,
    );
    const hasDraftContext = Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode) && d.status !== "COMPLETED";

    // Fill draft opportunistically; booking-flow validates deterministically.
    const choice = Number(t.match(/^\s*(?:№|номер\s*)?(\d{1,2})\s*$/i)?.[1] ?? NaN);
    const choiceNum = Number.isFinite(choice) ? choice : null;
    const hadLocationBefore = Boolean(d.locationId);
    if (!d.locationId && (route === "booking-flow" || explicitBookingText || hasDraftContext)) {
      const byName = locationByText(t, locations);
      if (byName) d.locationId = byName.id;
      else if (choiceNum && choiceNum >= 1 && choiceNum <= locations.length) d.locationId = locations[choiceNum - 1]!.id;
      else if (nlu?.locationId && locations.some((x) => x.id === nlu.locationId)) d.locationId = nlu.locationId;
    }
    const locationChosenThisTurn = !hadLocationBefore && Boolean(d.locationId);
    const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
    if (!d.serviceId && (route === "booking-flow" || explicitBookingText || Boolean(d.locationId) || hasDraftContext)) {
      const byText = serviceByText(t, scopedServices);
      if (byText) d.serviceId = byText.id;
      else if (!locationChosenThisTurn && choiceNum && choiceNum >= 1 && choiceNum <= scopedServices.length) d.serviceId = scopedServices[choiceNum - 1]!.id;
      else if (nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId)) d.serviceId = nlu.serviceId;
    }

    if (route === "booking-flow" || explicitBookingText || hasDraftContext) {
      d.date = nlu?.date || parseDate(message, nowYmd) || d.date;
      d.time = nlu?.time || parseTime(message) || d.time;
      const wantsSelfMode = has(message, /(сам|самостоятельно|в форме|онлайн)/i);
      const wantsAssistantMode = has(message, /(оформи|через ассистента|запиши меня)/i);
      if (wantsSelfMode) d.mode = "SELF";
      if (wantsAssistantMode) d.mode = "ASSISTANT";
      if (!d.mode && d.specialistId && choiceNum === 1) d.mode = "SELF";
      if (!d.mode && d.specialistId && choiceNum === 2) d.mode = "ASSISTANT";
    }

    d.clientPhone = parsePhone(message) || nlu?.clientPhone || d.clientPhone || client?.phone || null;
    d.clientName = parseName(message) || nlu?.clientName || d.clientName || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() || null;
    if (has(message, /(согласен|согласна|даю согласие|согласие на обработку)/i) || intent === "consent") {
      d.consentConfirmedAt = new Date().toISOString();
    }

    const origin = new URL(request.url).origin;
    const publicSlug = buildPublicSlugId(resolved.account.slug, resolved.account.id);

    let reply = `Я ${ASSISTANT_NAME}, помогу с записью. Что нужно?`;
    let nextStatus = d.status;
    let nextAction: Action = null;

    if (route === "client-actions") {
      const effectiveClientId = client?.clientId ?? thread.clientId ?? null;
      const authLevel: AuthLevel = client?.clientId ? "full" : thread.clientId ? "thread_only" : "none";
      const clientFlow = await runClientAccountFlow({
        message,
        messageNorm: t,
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
        reply = `Для персональных данных нужна активная авторизация. Войдите в личный кабинет аккаунта: ${loginUrl}`;
      } else {
        reply = "Поняла. Могу показать последние/прошедшие записи, статистику, а также помочь с переносом или отменой.";
      }
    } else if (route === "booking-flow" || explicitBookingText || hasDraftContext) {
      const flowResult = await runBookingFlow({
        messageNorm: t,
        bookingIntent: route === "booking-flow" || explicitBookingText,
        asksAvailability: intent === "ask_availability" || has(message, /(окошк|свобод|время|слот)/i),
        choice: choiceNum,
        d,
        currentStatus: d.status,
        origin,
        account: { id: resolved.account.id, slug: resolved.account.slug, timeZone: resolved.account.timeZone },
        locations,
        services,
        specialists,
        requiredVersionIds,
        request,
        listLocations,
        publicSlug,
      });
      if (flowResult.handled) {
        reply = flowResult.reply ?? reply;
        nextStatus = flowResult.nextStatus ?? nextStatus;
        nextAction = flowResult.nextAction ?? nextAction;
      }
    } else {
      if (intent === "greeting") {
        const knownName = d.clientName?.trim() || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim();
        reply = knownName ? `Здравствуйте, ${knownName}! Чем помочь?` : "Здравствуйте! Чем помочь?";
      } else if (intent === "identity") {
        reply = `Я ${ASSISTANT_NAME}, ассистент записи. Помогу с услугами, временем, записью и вашими данными клиента.`;
      } else if (intent === "capabilities") {
        reply = "Помогаю с записью, подбором свободных окон, контактами, а также могу показать ваши записи и статистику.";
      } else if (intent === "smalltalk") {
        const talk = await runAishaSmallTalkReply({
          message,
          assistantName: ASSISTANT_NAME,
          recentMessages: [...recentMessages].reverse(),
          accountProfile,
          knownClientName: d.clientName,
        });
        reply = talk || "Все хорошо, я на связи. Могу помочь с записью или ответить по вашим записям.";
      } else if (intent === "contact_phone") {
        const phoneReply = accountProfile?.phone ? `Номер студии: ${accountProfile.phone}.` : "Сейчас номер телефона недоступен.";
        reply = `${phoneReply} ${listLocations}`;
      } else if (intent === "working_hours") {
        reply = "Обычно работаем ежедневно с 09:00 до 21:00. Если нужно, проверю точный график по конкретной локации и дате.";
      } else if (intent === "ask_specialists") {
        reply = `Специалисты в студии:\n${specialists.slice(0, 12).map((x, i) => `${i + 1}. ${x.name}`).join("\n")}\nМогу сразу проверить свободные окна по нужной услуге.`;
      } else if (asksCurrentDate(message)) {
        reply = `Сегодня ${nowYmd}.`;
      } else if (intent === "ask_services") {
        reply = `Доступные услуги:\n${services.slice(0, 12).map((x, i) => `${i + 1}. ${x.name} — ${Math.round(x.basePrice)} ₽, ${x.baseDurationMin} мин`).join("\n")}`;
      } else {
        const talk = await runAishaSmallTalkReply({
          message,
          assistantName: ASSISTANT_NAME,
          recentMessages: [...recentMessages].reverse(),
          accountProfile,
          knownClientName: d.clientName,
        });
        reply = talk || "Уточните, пожалуйста, что именно нужно: запись, услуги, контакты или ваши записи.";
      }
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

    return jsonOk({ threadId: thread.id, reply, action: nextAction, draft: d });
  } catch (e) {
    return failSoft(e instanceof Error ? e.message : "unknown_error");
  }
}
