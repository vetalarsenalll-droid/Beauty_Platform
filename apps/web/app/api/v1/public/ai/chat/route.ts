import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import {
  getNowInTimeZone,
  isPastDateOrTimeInTz,
  toMinutes,
  zonedDayRangeUtc,
  zonedTimeToUtc,
  resolvePublicAccount,
} from "@/lib/public-booking";

const prismaAny = prisma as any;

type Body = { message?: unknown; threadId?: unknown };
type Mode = "SELF" | "ASSISTANT";
type Draft = {
  locationId: number | null;
  serviceId: number | null;
  specialistId: number | null;
  date: string | null;
  time: string | null;
  clientName: string | null;
  clientPhone: string | null;
  mode: Mode | null;
  status: string;
  consentConfirmedAt: string | null;
};
type Action = { type: "open_booking"; bookingUrl: string } | null;

const asText = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 1200) : "";
const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const fmtRub = (v: unknown) => `${Math.round(Number(v) || 0)} ₽`;
const has = (m: string, r: RegExp) => r.test(norm(m));
const asThreadId = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const parseDate = (m: string, today: string) => {
  const t = norm(m);
  if (t.includes("сегодня")) return today;
  if (t.includes("завтра")) {
    const [y, mo, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
};
const parseTime = (m: string) => {
  const t = norm(m);
  const hhmm = t.match(/\b([01]?\d|2[0-3])[:. ]([0-5]\d)\b/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;
  const hh = t.match(/\b(?:в|к)\s*(\d{1,2})\b/);
  if (!hh) return null;
  const n = Number(hh[1]);
  return n >= 0 && n <= 23 ? `${String(n).padStart(2, "0")}:00` : null;
};
const parsePhone = (m: string) => {
  const s = m.match(/(?:\+7|8)\D*(?:\d\D*){10}/)?.[0] ?? "";
  const d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return `+${d}`;
  if (d.length === 10) return `+7${d}`;
  return null;
};
const parseName = (m: string) =>
  m.match(/(?:меня зовут|имя)\s+([A-Za-zА-Яа-яЁё\-]{2,})/i)?.[1] ?? null;

function bookingUrl(publicSlug: string, d: Draft) {
  const q = new URLSearchParams();
  if (d.locationId) q.set("locationId", String(d.locationId));
  if (d.serviceId) q.set("serviceId", String(d.serviceId));
  if (d.specialistId) q.set("specialistId", String(d.specialistId));
  if (d.date) q.set("date", d.date);
  if (d.time) q.set("time", d.time);
  q.set("scenario", d.specialistId ? "specialistFirst" : d.serviceId ? "serviceFirst" : "dateFirst");
  return `/${publicSlug}/booking?${q.toString()}`;
}

async function getThread(accountId: number, threadId: number | null, clientId: number | null) {
  let thread =
    threadId != null
      ? await prisma.aiThread.findFirst({ where: { id: threadId, accountId } })
      : null;
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
}): Draft => ({
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
  return jsonOk({
    threadId: thread.id,
    messages: messages.length
      ? messages
      : [{ id: 0, role: "assistant", content: "Привет! Помогу подобрать запись. Что нужно?" }],
    draft: draftView(draft),
  });
}

export async function DELETE(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  if (!threadId) return jsonError("VALIDATION_FAILED", "threadId is required", null, 400);
  const thread = await prisma.aiThread.findFirst({ where: { id: threadId, accountId: resolved.account.id } });
  if (!thread) return jsonError("NOT_FOUND", "Thread not found", null, 404);
  await prisma.$transaction([
    prisma.aiMessage.deleteMany({ where: { threadId } }),
    prismaAny.aiBookingDraft.update({
      where: { threadId },
      data: {
        locationId: null,
        serviceId: null,
        specialistId: null,
        date: null,
        time: null,
        clientName: null,
        clientPhone: null,
        mode: null,
        status: "COLLECTING",
        consentConfirmedAt: null,
      },
    }),
  ]);
  return jsonOk({ ok: true });
}

async function apiData<T>(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const p = await r.json().catch(() => null);
  return r.ok ? ((p?.data ?? null) as T | null) : null;
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

  const [locationsRaw, servicesRaw, specialistsRaw, requiredDocs] = await Promise.all([
    prisma.location.findMany({ where: { accountId: resolved.account.id, status: "ACTIVE" }, select: { id: true, name: true, address: true }, orderBy: { createdAt: "asc" } }),
    prisma.service.findMany({ where: { accountId: resolved.account.id, isActive: true }, select: { id: true, name: true, baseDurationMin: true, basePrice: true, locations: { select: { locationId: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.specialistProfile.findMany({ where: { accountId: resolved.account.id }, select: { id: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }, locations: { select: { locationId: true } }, services: { select: { serviceId: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.legalDocument.findMany({ where: { accountId: resolved.account.id, isRequired: true }, select: { versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1, select: { id: true } } } }),
  ]);
  const locations = locationsRaw;
  const services = servicesRaw.map((s) => ({ ...s, locationIds: s.locations.map((x) => x.locationId) }));
  const specialists = specialistsRaw.map((s) => {
    const fullName = [s.user.profile?.firstName, s.user.profile?.lastName].filter(Boolean).join(" ").trim();
    return { id: s.id, name: fullName || s.user.email || `Специалист #${s.id}`, locationIds: s.locations.map((x) => x.locationId), serviceIds: s.services.map((x) => x.serviceId) };
  });
  const requiredVersionIds = requiredDocs.map((d) => d.versions[0]?.id).filter((x): x is number => Number.isInteger(x));

  const nowYmd = getNowInTimeZone(resolved.account.timeZone).ymd;
  const d = draftView(draft);
  const loc = locations.find((x) => norm(message).includes(norm(x.name)) || (x.address && norm(message).includes(norm(x.address))));
  if (loc) d.locationId = loc.id;
  const srv = services.find((x) => norm(message).includes(norm(x.name)) || (has(message, /гель|гел/i) && norm(x.name).includes("gel")) || (has(message, /маник/i) && (norm(x.name).includes("manicure") || norm(x.name).includes("маник"))));
  if (srv) d.serviceId = srv.id;
  const sp = specialists.find((x) => norm(message).includes(norm(x.name)));
  if (sp) d.specialistId = sp.id;
  d.date = parseDate(message, nowYmd) || d.date;
  d.time = parseTime(message) || d.time;
  if (has(message, /(сам|самостоятельно|в форме)/i)) d.mode = "SELF";
  if (has(message, /(оформи|запиши меня|через ассистента)/i)) d.mode = "ASSISTANT";
  d.clientPhone = parsePhone(message) || d.clientPhone || client?.phone || null;
  d.clientName = parseName(message) || d.clientName || [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() || null;
  if (has(message, /(согласен на обработку|даю согласие)/i)) d.consentConfirmedAt = new Date().toISOString();

  const publicSlug = buildPublicSlugId(resolved.account.slug, resolved.account.id);
  const action: Action = null;
  const origin = new URL(request.url).origin;
  let reply = "Уточните, пожалуйста, что вы хотите забронировать.";
  let nextStatus = d.status;
  let nextAction: Action = action;

  if (has(message, /(адрес|локац|филиал|где находится)/i)) {
    reply = `Наши локации:\n${locations.map((x, i) => `${i + 1}. ${x.name}${x.address ? ` — ${x.address}` : ""}`).join("\n")}`;
  } else if (has(message, /(услуг|прайс|маник|педик|гель|покрыт)/i)) {
    const scoped = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
    reply = `Доступные услуги:\n${scoped.slice(0, 12).map((x, i) => `${i + 1}. ${x.name} — ${fmtRub(x.basePrice)}, ${x.baseDurationMin} мин`).join("\n")}`;
  } else if (has(message, /(свобод|окно|время|на завтра|завтра|сегодня)/i)) {
    const date = d.date || nowYmd;
    if (!d.locationId) {
      const lines: string[] = [];
      for (const l of locations) {
        const u = new URL("/api/v1/public/booking/offers", origin);
        u.searchParams.set("account", resolved.account.slug);
        u.searchParams.set("locationId", String(l.id));
        u.searchParams.set("date", date);
        const data = await apiData<{ times: Array<{ time: string; services: Array<{ serviceId: number }> }> }>(u.toString());
        const filtered = d.serviceId ? (data?.times ?? []).filter((t) => t.services.some((s) => s.serviceId === d.serviceId)) : data?.times ?? [];
        const ts = filtered.slice(0, 4).map((x) => x.time);
        if (ts.length) lines.push(`- ${l.name}: ${ts.join(", ")}`);
      }
      reply = lines.length ? `Свободные окна на ${date}:\n${lines.join("\n")}\nВыберите локацию и услугу.` : "Свободных окон по текущим условиям не нашел.";
    } else if (!d.serviceId) {
      reply = "Выберите услугу, и я покажу точные слоты по времени.";
    } else {
      const u = new URL("/api/v1/public/booking/availability/calendar", origin);
      u.searchParams.set("account", resolved.account.slug);
      u.searchParams.set("locationId", String(d.locationId));
      u.searchParams.set("serviceId", String(d.serviceId));
      u.searchParams.set("start", date);
      u.searchParams.set("days", "2");
      if (d.specialistId) u.searchParams.set("specialistId", String(d.specialistId));
      const cal = await apiData<{ days: Array<{ date: string; times: Array<{ time: string; specialistIds: number[] }> }> }>(u.toString());
      const lines = (cal?.days ?? []).map((day) => `- ${day.date}: ${day.times.slice(0, 5).map((t) => t.time).join(", ")}`).filter((x) => !x.endsWith(": "));
      reply = lines.length ? `Свободные слоты:\n${lines.join("\n")}\nВыберите точное время.` : "По выбранной услуге нет свободных слотов.";
    }
  } else {
    const missing = [!d.locationId ? "локацию" : "", !d.serviceId ? "услугу" : "", !d.date ? "дату" : "", !d.time ? "время" : ""].filter(Boolean);
    if (missing.length) {
      reply = `Чтобы продолжить, уточните: ${missing.join(", ")}.`;
    } else if (!d.specialistId) {
      const u = new URL("/api/v1/public/booking/slots", origin);
      u.searchParams.set("account", resolved.account.slug);
      u.searchParams.set("locationId", String(d.locationId));
      u.searchParams.set("serviceId", String(d.serviceId));
      u.searchParams.set("date", String(d.date));
      const slots = await apiData<{ slots: Array<{ time: string; specialistId: number }> }>(u.toString());
      const ids = Array.from(new Set((slots?.slots ?? []).filter((s) => s.time === d.time).map((s) => s.specialistId)));
      const list = specialists.filter((s) => ids.includes(s.id));
      reply = list.length
        ? `На ${d.date} в ${d.time} доступны специалисты:\n${list.map((s, i) => `${i + 1}. ${s.name}`).join("\n")}\nВыберите специалиста или напишите «любой».`
        : "Выберите специалиста.";
    } else if (!d.mode) {
      reply = "Как завершим запись?\n1) Сам в форме онлайн-записи.\n2) Оформить через ассистента.";
    } else if (d.mode === "SELF") {
      nextAction = { type: "open_booking", bookingUrl: bookingUrl(publicSlug, d) };
      nextStatus = "READY_SELF";
      reply = "Открываю форму с заполненными параметрами. Введите имя и телефон и подтвердите запись.";
    } else if (!d.clientName || !d.clientPhone) {
      reply = "Для оформления через ассистента напишите имя и номер телефона клиента.";
    } else if (!d.consentConfirmedAt) {
      const links = requiredVersionIds.map((id) => `/${publicSlug}/legal/${id}`).join("\n");
      reply = `Для оформления нужно согласие на обработку персональных данных.\n${links || "Документы не настроены"}\nНапишите: «Согласен на обработку персональных данных».`;
    } else if (!/^(да|подтверждаю|согласен|ок)$/i.test(norm(message))) {
      reply = `Проверьте данные: ${d.date} ${d.time}, клиент ${d.clientName} ${d.clientPhone}. Если всё верно, напишите «да».`;
      nextStatus = "WAITING_CONFIRMATION";
    } else {
      const startAt = zonedTimeToUtc(String(d.date), String(d.time), resolved.account.timeZone);
      const day = zonedDayRangeUtc(String(d.date), resolved.account.timeZone);
      if (!startAt || !day || isPastDateOrTimeInTz(String(d.date), String(d.time), resolved.account.timeZone)) {
        reply = "Некорректная дата/время для записи.";
      } else {
        const [service, specialist, schedule] = await Promise.all([
          prisma.service.findFirst({ where: { id: d.serviceId!, accountId: resolved.account.id, isActive: true }, select: { id: true, baseDurationMin: true, basePrice: true } }),
          prisma.specialistProfile.findFirst({ where: { id: d.specialistId!, accountId: resolved.account.id }, select: { id: true } }),
          prisma.scheduleEntry.findFirst({ where: { accountId: resolved.account.id, specialistId: d.specialistId!, locationId: d.locationId!, date: { gte: day.dayStartUtc, lt: day.dayEndUtc }, type: "WORKING" } }),
        ]);
        if (!service || !specialist || !schedule) {
          reply = "Эта комбинация локации/услуги/специалиста недоступна.";
        } else {
          const startM = toMinutes(String(d.time));
          const sStart = toMinutes(schedule.startTime || "");
          const sEnd = toMinutes(schedule.endTime || "");
          if (startM == null || sStart == null || sEnd == null || startM < sStart || startM + service.baseDurationMin > sEnd) {
            reply = "Время вне графика. Выберите другой слот.";
          } else {
            const endAt = new Date(startAt);
            endAt.setUTCMinutes(endAt.getUTCMinutes() + service.baseDurationMin);
            const conflict = await prisma.appointment.findFirst({
              where: { accountId: resolved.account.id, locationId: d.locationId!, specialistId: d.specialistId!, status: { notIn: ["CANCELLED", "NO_SHOW"] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
              select: { id: true },
            });
            if (conflict) {
              reply = "Этот слот уже занят. Выберите другое время.";
            } else {
              const clientProfile = await prisma.client.findFirst({ where: { accountId: resolved.account.id, phone: d.clientPhone! }, select: { id: true, firstName: true, phone: true } });
              const clientId = clientProfile
                ? (await prisma.client.update({ where: { id: clientProfile.id }, data: { firstName: clientProfile.firstName || d.clientName! } })).id
                : (await prisma.client.create({ data: { accountId: resolved.account.id, firstName: d.clientName!, phone: d.clientPhone! } })).id;
              const appt = await prisma.appointment.create({
                data: {
                  accountId: resolved.account.id,
                  locationId: d.locationId!,
                  specialistId: d.specialistId!,
                  clientId,
                  startAt,
                  endAt,
                  status: "NEW",
                  priceTotal: Number(service.basePrice),
                  durationTotalMin: service.baseDurationMin,
                  source: "ai_assistant",
                  services: { create: [{ serviceId: service.id, price: Number(service.basePrice), durationMin: service.baseDurationMin }] },
                },
                select: { id: true },
              });
              await prisma.appointmentStatusHistory.create({ data: { appointmentId: appt.id, actorType: "assistant", toStatus: "NEW" } });
              if (requiredVersionIds.length) {
                const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
                const ua = request.headers.get("user-agent") ?? null;
                await prisma.legalAcceptance.createMany({ data: requiredVersionIds.map((v) => ({ accountId: resolved.account.id, documentVersionId: v, appointmentId: appt.id, clientId, source: "public_booking", ip, userAgent: ua })) });
              }
              nextStatus = "COMPLETED";
              reply = `Запись оформлена. Номер записи: ${appt.id}. Ждем вас ${d.date} в ${d.time}.`;
            }
          }
        }
      }
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
  ]);

  return jsonOk({ threadId: thread.id, reply, action: nextAction, draft: d });
}
