import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { runAishaNlu, runAishaSmallTalkReply } from "@/lib/aisha-orchestrator";
import { runBookingFlow } from "@/lib/booking-flow";
import { DraftLike, LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { getNowInTimeZone, resolvePublicAccount } from "@/lib/public-booking";

const prismaAny = prisma as any;

type Body = { message?: unknown; threadId?: unknown };
type Mode = "SELF" | "ASSISTANT";
type Action = { type: "open_booking"; bookingUrl: string } | null;

const ASSISTANT_NAME = "Аиша";

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
  if (!thread) thread = await prisma.aiThread.create({ data: { accountId, clientId } });
  const draft = await prismaAny.aiBookingDraft.upsert({
    where: { threadId: thread.id },
    create: { threadId: thread.id, status: "COLLECTING" },
    update: {},
  });
  return { thread, draft };
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

  const dmy = t.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

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
  const dmText = t.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/);
  if (dmText) {
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

  const bareDay = t.match(/^\s*(\d{1,2})\s*$/)?.[1] ?? null;
  if (bareDay) {
    const day = Number(bareDay);
    const [y, mo] = today.split("-").map(Number);
    const candidate = `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return candidate >= today ? candidate : addDaysYmd(candidate, 31);
  }

  return null;
};

const parseTime = (m: string, allowBareHour: boolean) => {
  const t = norm(m);
  const hhmm = t.match(/\b([01]?\d|2[0-3])[:. ]([0-5]\d)\b/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;
  const prepHour = t.match(/\b(?:в|к|at)\s*(\d{1,2})\b/);
  if (prepHour) {
    const n = Number(prepHour[1]);
    if (n >= 0 && n <= 23) return `${String(n).padStart(2, "0")}:00`;
  }
  if (allowBareHour) {
    const bare = t.match(/^([01]?\d|2[0-3])$/);
    if (bare) return `${String(Number(bare[1])).padStart(2, "0")}:00`;
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
    // User specified gender, but there is no matching gendered service by name.
    // Keep service unresolved so flow asks to clarify instead of auto-picking a wrong one.
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

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  const session = await getClientSession();
  const client = session?.clients.find((c) => c.accountId === resolved.account.id) ?? null;
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
  const client = session?.clients.find((c) => c.accountId === resolved.account.id) ?? null;
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
          locations: { select: { locationId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.specialistProfile.findMany({
        where: { accountId: resolved.account.id },
        select: {
          id: true,
          user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
          locations: { select: { locationId: true } },
          services: { select: { serviceId: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.legalDocument.findMany({
        where: { accountId: resolved.account.id, isRequired: true },
        select: {
          versions: {
            where: { isActive: true },
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      }),
      prisma.accountProfile.findUnique({
        where: { accountId: resolved.account.id },
        select: { description: true, address: true, phone: true },
      }),
      resolveAishaSystemPrompt(resolved.account.id),
    ]);

    const locations: LocationLite[] = locationsRaw;
    const services: ServiceLite[] = servicesRaw.map((s) => ({
      id: s.id,
      name: s.name,
      baseDurationMin: s.baseDurationMin,
      basePrice: Number(s.basePrice),
      locationIds: s.locations.map((x) => x.locationId),
    }));
    const specialists: SpecialistLite[] = specialistsRaw.map((s) => {
      const fullName = [s.user.profile?.firstName, s.user.profile?.lastName].filter(Boolean).join(" ").trim();
      return {
        id: s.id,
        name: fullName || s.user.email || `Специалист #${s.id}`,
        locationIds: s.locations.map((x) => x.locationId),
        serviceIds: s.services.map((x) => x.serviceId),
      };
    });
    const requiredVersionIds = requiredDocs.map((d) => d.versions[0]?.id).filter((x): x is number => Number.isInteger(x));

    const nowYmd = getNowInTimeZone(resolved.account.timeZone).ymd;
    const d = draftView(draft);
    const t = norm(message);

    let nluResult: Awaited<ReturnType<typeof runAishaNlu>> = { nlu: null, source: "fallback", reason: "nlu_error" };
    try {
      nluResult = await runAishaNlu({
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
    } catch {
      nluResult = { nlu: null, source: "fallback", reason: "nlu_exception" };
    }
    const nlu = nluResult.nlu;

    const choice = Number(t.match(/^\s*(?:№|номер\s*)?(\d{1,2})\s*$/i)?.[1] ?? NaN);
    const choiceNum = Number.isFinite(choice) ? choice : null;

    const hadLocationBefore = Boolean(d.locationId);
    const explicitBookingText = has(
      message,
      /(запиш|записаться|запись|окошк|свобод|время|дата|услуга|слот|на сегодня|на завтра|оформи|бронь|забронируй)/i,
    );
    const nluBookingIntent = Boolean(
      nlu && ["booking", "update_booking", "ask_availability", "mode_assistant", "mode_self"].includes(nlu.intent),
    );

    if (!d.locationId && (explicitBookingText || nluBookingIntent)) {
      const byName = locationByText(t, locations);
      if (byName) d.locationId = byName.id;
      else if (choiceNum && choiceNum >= 1 && choiceNum <= locations.length) d.locationId = locations[choiceNum - 1]!.id;
      else if (nlu?.locationId && locations.some((x) => x.id === nlu.locationId)) d.locationId = nlu.locationId;
    }
    const locationChosenThisTurn = !hadLocationBefore && Boolean(d.locationId);

    const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
    if (!d.serviceId && (explicitBookingText || nluBookingIntent || Boolean(d.locationId))) {
      const byText = serviceByText(t, scopedServices);
      if (byText) d.serviceId = byText.id;
      else if (!locationChosenThisTurn && choiceNum && choiceNum >= 1 && choiceNum <= scopedServices.length) {
        d.serviceId = scopedServices[choiceNum - 1]!.id;
      } else if (nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId)) {
        d.serviceId = nlu.serviceId;
      }
    }

    const parsedDate = parseDate(message, nowYmd);
    const parsedTime = parseTime(message, true);
    d.date = nlu?.date || parsedDate || d.date;
    d.time = nlu?.time || parsedTime || d.time;

    const wantsSelfMode = has(message, /(сам|самостоятельно|в форме|онлайн)/i);
    const wantsAssistantMode = has(message, /(оформи|через ассистента|запиши меня)/i);
    if (wantsSelfMode) d.mode = "SELF";
    if (wantsAssistantMode) d.mode = "ASSISTANT";
    if (!d.mode && d.specialistId && choiceNum === 1) d.mode = "SELF";
    if (!d.mode && d.specialistId && choiceNum === 2) d.mode = "ASSISTANT";

    d.clientPhone = parsePhone(message) || nlu?.clientPhone || d.clientPhone || client?.phone || null;
    d.clientName =
      parseName(message) ||
      nlu?.clientName ||
      d.clientName ||
      [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() ||
      null;
    if (has(message, /(согласен|согласна|даю согласие|согласие на обработку)/i) || nlu?.intent === "consent") {
      d.consentConfirmedAt = new Date().toISOString();
    }

    const asksGreeting = has(message, /^(привет|здравствуйте|здравствуй|добрый день|добрый вечер|hello|hi)\b/i);
    const asksIdentity = has(message, /(кто ты|ты кто|как тебя зовут|твое имя|твоё имя)/i);
    const asksCapabilities = has(message, /(чем занимаешься|что умеешь|что ты можешь)/i);
    const asksPhone = has(
      message,
      /(дай номер|ваш номер|твой номер|номер телефона|номер студии|номер салона|номер филиала|номер локации|как с вами связаться|контакт(ы)?|телефон)/i,
    );
    const asksDateNow = asksCurrentDate(message);
    const asksSmallTalk = nlu?.intent === "smalltalk" || has(message, /(как дела|как жизнь|как ты|что нового|че каво|почему)/i);
    const conversationalIntent = asksGreeting || asksIdentity || asksCapabilities || asksDateNow || asksSmallTalk || asksPhone;
    const hasBookingSignal = Boolean(
      d.locationId ||
        d.serviceId ||
        d.date ||
        d.time ||
        explicitBookingText ||
        (nluBookingIntent && !conversationalIntent),
    );

    const listLocations = `Наши локации:\n${locations
      .map((x, i) => `${i + 1}. ${x.name}${x.address ? ` — ${x.address}` : ""}`)
      .join("\n")}`;

    const origin = new URL(request.url).origin;
    const publicSlug = buildPublicSlugId(resolved.account.slug, resolved.account.id);

    let reply = `Я ${ASSISTANT_NAME}, помогу с записью. Что нужно?`;
    let nextStatus = d.status;
    let nextAction: Action = null;

    if (asksPhone) {
      const phoneReply = accountProfile?.phone
        ? `Номер студии: ${accountProfile.phone}.`
        : "Сейчас номер телефона недоступен. Могу сразу помочь записаться здесь в чате.";
      reply = `${phoneReply} ${listLocations}`;
    } else if (asksDateNow && !hasBookingSignal) {
      reply = `Сегодня ${nowYmd}.`;
    } else if ((asksGreeting || asksIdentity || asksCapabilities || asksSmallTalk) && !hasBookingSignal) {
      const talk = await runAishaSmallTalkReply({
        message,
        assistantName: ASSISTANT_NAME,
        recentMessages: [...recentMessages].reverse(),
        accountProfile,
        knownClientName: d.clientName,
      });
      if (asksIdentity && !talk) reply = `Я ${ASSISTANT_NAME}, AI-ассистент записи.`;
      else if (asksCapabilities && !talk) reply = "Помогаю выбрать услугу, время, специалиста и оформить запись.";
      else reply = talk || "Я на связи.";
    } else {
      const flowResult = await runBookingFlow({
        messageNorm: t,
        bookingIntent: hasBookingSignal,
        asksAvailability: has(message, /(окошк|свобод|время|слот)/i),
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
      } else {
        const talk = await runAishaSmallTalkReply({
          message,
          assistantName: ASSISTANT_NAME,
          recentMessages: [...recentMessages].reverse(),
          accountProfile,
          knownClientName: d.clientName,
        });
        reply = talk || "Уточните, пожалуйста, что хотите: подобрать время или оформить запись.";
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
            nextStatus,
            nluSource: nluResult.source,
            nluIntent: nlu?.intent ?? null,
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
