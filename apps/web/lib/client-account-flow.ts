import {
  cancelClientBooking,
  findLatestUpcomingBooking,
  getBookingPolicy,
  getClientBookings,
  getClientStats,
  rescheduleClientBooking,
  updateClientPhone,
} from "@/lib/client-account-tools";
import { zonedTimeToUtc } from "@/lib/public-booking";
import { getOffers } from "@/lib/booking-tools";
import type { ChatUi, ChatUiOption } from "@/lib/booking-flow";

type FlowResult = { handled: boolean; reply?: string; ui?: ChatUi | null };

type ClientFlowArgs = {
  message: string;
  messageNorm: string;
  accountId: number;
  accountTimeZone: string;
  clientId: number | null;
  authMode?: "full" | "thread_only";
  origin?: string | null;
  accountSlug?: string | null;
};

const has = (m: string, r: RegExp) => r.test(m);

const CLIENT_BOOKINGS_PAGE_SIZE = 6;

function qr(label: string, value?: string, href?: string): ChatUiOption {
  return { label, value: value ?? label, href };
}

function buildClientActionsMenuUi(): ChatUi {
  return {
    kind: "quick_replies",
    options: clientActionsMenuOptions(),
  };
}


function bookingSpecialistName(item: any) {
  const first = item?.specialist?.user?.profile?.firstName ?? "";
  const last = item?.specialist?.user?.profile?.lastName ?? "";
  const full = `${first} ${last}`.trim();
  return full || "Специалист не указан";
}

function bookingLocationName(item: any) {
  return item?.location?.name ?? "Локация не указана";
}

function bookingServiceName(item: any) {
  return item?.services?.[0]?.service?.name ?? "Услуга";
}

function bookingShortLabel(item: any, accountTimeZone: string) {
  return `#${item.id} · ${bookingLocationName(item)} · ${bookingSpecialistName(item)} · ${bookingServiceName(item)} · ${formatDateTimeInTz(item.startAt, accountTimeZone)}`;
}

function bookingDetailsText(item: any, accountTimeZone: string) {
  const services = (item.services ?? []).map((s: any) => s?.service?.name).filter(Boolean);
  const serviceText = services.length ? services.join(", ") : "Услуга";
  return `Запись #${item.id}\nЛокация: ${bookingLocationName(item)}\nСпециалист: ${bookingSpecialistName(item)}\nУслуги: ${serviceText}\nДата и время: ${formatDateTimeInTz(item.startAt, accountTimeZone)}\nСтатус: ${item.status}`;
}

function bookingOptionLabel(item: any, accountTimeZone: string) {
  return `#${item.id} · ${bookingLocationName(item)} · ${bookingSpecialistName(item)} · ${bookingServiceName(item)} · ${formatDateTimeInTz(item.startAt, accountTimeZone)}`;
}

function bookingCancelOptionLabel(item: any, accountTimeZone: string) {
  return `Отменить #${item.id} · ${bookingLocationName(item)} · ${bookingSpecialistName(item)} · ${bookingServiceName(item)} · ${formatDateTimeInTz(item.startAt, accountTimeZone)}`;
}

function bookingRescheduleOptionLabel(item: any, accountTimeZone: string) {
  return `Перенести #${item.id} · ${bookingLocationName(item)} · ${bookingSpecialistName(item)} · ${bookingServiceName(item)} · ${formatDateTimeInTz(item.startAt, accountTimeZone)}`;
}
function rescheduleQuickTimeOptions(appointmentId: number): ChatUiOption[] {
  return [
    qr("10:00", `перенести #${appointmentId} на 10:00`),
    qr("12:00", `перенести #${appointmentId} на 12:00`),
    qr("15:00", `перенести #${appointmentId} на 15:00`),
    qr("18:00", `перенести #${appointmentId} на 18:00`),
    qr("19:30", `перенести #${appointmentId} на 19:30`),
  ];
}

function parsePage(messageNorm: string) {
  const n = Number(messageNorm.match(/(?:страниц[аые]?|page)\s*(\d{1,2})/i)?.[1] ?? 1);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, 20);
}

function listBookingsResponse(args: {
  title: string;
  items: any[];
  page: number;
  scopeValue: string;
  accountTimeZone: string;
}): FlowResult {
  const { title, items, page, scopeValue, accountTimeZone } = args;
  const total = items.length;
  const start = (page - 1) * CLIENT_BOOKINGS_PAGE_SIZE;
  const chunk = items.slice(start, start + CLIENT_BOOKINGS_PAGE_SIZE);
  if (!chunk.length) {
    return {
      handled: true,
      reply: `Больше записей не нашла. Всего: ${total}.`,
      ui: buildClientActionsMenuUi(),
    };
  }

  const reply = `${title}: показаны ${start + 1}-${start + chunk.length} из ${total}. Выберите запись кнопкой ниже.`;

  const options: ChatUiOption[] = chunk.map((x) => qr(bookingOptionLabel(x, accountTimeZone), `покажи запись #${x.id}`));
  if (start + chunk.length < total) {
    options.push(qr("Показать ещё", `${scopeValue} страница ${page + 1}`));
  }


  return { handled: true, reply, ui: { kind: "quick_replies", options: options.slice(0, 14) } };
}

function parsePhone(message: string) {
  const candidates = message.match(/(?:\+7|8)[\d\s().-]*/g) ?? [];
  for (const candidate of candidates) {
    const d = candidate.replace(/\D/g, "");
    if (d.length !== 11) continue;
    if (d.startsWith("8")) return `+7${d.slice(1)}`;
    if (d.startsWith("7")) return `+${d}`;
  }
  return null;
}

function parseAppointmentId(messageNorm: string) {
  const explicitHash = messageNorm.match(/#\s*(\d{1,8})(?!\d)/u);
  if (explicitHash) {
    const n = Number(explicitHash[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  const patterns = [
    /(?:запис[ьи]?|запись|номер|id)\s*#?\s*(\d{1,8})(?!\d)/iu,
    /(?:перенес(?:и|ти|ть)?|отмен(?:и|ить|а)?)\s*(?:запис[ьи]?|запись)?\s*#?\s*(\d{1,8})(?!\d)/iu,
  ];

  for (const pattern of patterns) {
    const match = messageNorm.match(pattern);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isInteger(n) && n > 0) return n;
  }

  return null;
}
function ymdFromDateInTz(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parseRuDateToYmd(messageNorm: string, todayYmd: string) {
  if (/\b(сегодня|today)\b/i.test(messageNorm)) return todayYmd;
  if (/\b(завтра|tomorrow)\b/i.test(messageNorm)) return addDaysYmd(todayYmd, 1);
  if (/\b(послезавтра|day after tomorrow)\b/i.test(messageNorm)) return addDaysYmd(todayYmd, 2);

  const iso = messageNorm.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmDot = messageNorm.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
  if (dmDot) {
    const day = String(Number(dmDot[1])).padStart(2, "0");
    const month = String(Number(dmDot[2])).padStart(2, "0");
    let year = dmDot[3] ? Number(dmDot[3]) : Number(todayYmd.slice(0, 4));
    if (year < 100) year += 2000;
    let candidate = `${year}-${month}-${day}`;
    if (!dmDot[3] && candidate < todayYmd) candidate = `${year + 1}-${month}-${day}`;
    return candidate;
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
  const dmText = messageNorm.match(
    /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/i,
  );
  if (dmText) {
    const day = String(Number(dmText[1])).padStart(2, "0");
    const month = monthMap.get(dmText[2].toLowerCase()) ?? "01";
    let year = dmText[3] ? Number(dmText[3]) : Number(todayYmd.slice(0, 4));
    let candidate = `${year}-${month}-${day}`;
    if (!dmText[3] && candidate < todayYmd) candidate = `${year + 1}-${month}-${day}`;
    return candidate;
  }

  return null;
}

function parseTime(messageNorm: string) {
  // Avoid treating date fragments like 03.03.2026 as time 03:03.
  const hasDateToken =
    /\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b/u.test(messageNorm) ||
    /\b\d{4}-\d{2}-\d{2}\b/u.test(messageNorm);

  const hhmmColon = messageNorm.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/u);
  if (hhmmColon) return `${String(Number(hhmmColon[1])).padStart(2, "0")}:${hhmmColon[2]}`;

  if (!hasDateToken) {
    const hhmmDot = messageNorm.match(/\b([01]?\d|2[0-3])\.([0-5]\d)\b/u);
    if (hhmmDot) return `${String(Number(hhmmDot[1])).padStart(2, "0")}:${hhmmDot[2]}`;
  }

  const hourOnly = messageNorm.match(/\b(?:в|на|к)\s*([01]?\d|2[0-3])\b/iu);
  if (hourOnly) return `${String(Number(hourOnly[1])).padStart(2, "0")}:00`;
  return null;
}
function parseDateTime(messageNorm: string, todayYmd: string) {
  const date = parseRuDateToYmd(messageNorm, todayYmd);
  const time = parseTime(messageNorm);
  if (!date || !time) return null;
  return { date, time };
}


function extractPrimaryServiceId(item: any) {
  const raw = item?.services?.[0]?.serviceId;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function extractAvailableTimesForTarget(args: {
  offers: { times: Array<{ time: string; services: Array<{ serviceId: number; specialistIds?: number[] }> }> };
  serviceId: number;
  specialistId: number;
}) {
  const { offers, serviceId, specialistId } = args;
  return Array.from(
    new Set(
      (offers?.times ?? [])
        .filter((slot) =>
          (slot.services ?? []).some((svc) =>
            svc.serviceId === serviceId &&
            (!Array.isArray(svc.specialistIds) || svc.specialistIds.includes(specialistId)),
          ),
        )
        .map((slot) => slot.time),
    ),
  );
}

async function getRescheduleAvailableDates(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  serviceId: number;
  specialistId: number;
  excludeAppointmentId: number;
  fromYmd: string;
  days: number;
}) {
  const { origin, accountSlug, locationId, serviceId, specialistId, excludeAppointmentId, fromYmd, days } = args;
  const out: string[] = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const date = addDaysYmd(fromYmd, offset);
    const offers = await getOffers(origin, accountSlug, locationId, date, excludeAppointmentId);
    const times = extractAvailableTimesForTarget({ offers, serviceId, specialistId });
    if (times.length) out.push(date);
  }
  return out;
}function formatDateTimeInTz(date: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

function formatYmdRu(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
function formatPolicyHoursHuman(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0 && remHours > 0) return `${days} дн ${remHours} ч`;
  if (days > 0) return `${days} дн`;
  return `${hours} ч`;
}

function parseRescheduleConfirm(text: string) {
  const match = text.match(
    /подтвержда[а-я]*\s+перенос\s*#?\s*(\d{1,8})\s+на\s+((?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}\.\d{1,2}\.\d{2,4}))\s+([01]?\d|2[0-3])[:.]([0-5]\d)/i,
  );
  if (!match) return null;

  const id = Number(match[1]);
  if (!Number.isInteger(id) || id <= 0) return null;

  const rawDate = String(match[2] ?? "");
  let date = rawDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(rawDate);
    if (!m) return null;
    const day = String(Number(m[1])).padStart(2, "0");
    const month = String(Number(m[2])).padStart(2, "0");
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    date = `${year}-${month}-${day}`;
  }

  const hh = String(Number(match[3])).padStart(2, "0");
  const mm = String(match[4]);
  return { id, date, hh, mm };
}
export async function runClientAccountFlow(args: ClientFlowArgs): Promise<FlowResult> {
  const { message, messageNorm, accountId, accountTimeZone, clientId, authMode = "full", origin = null, accountSlug = null } = args;
  if (!clientId) return { handled: false };

  const todayYmd = ymdFromDateInTz(new Date(), accountTimeZone);

  const asksMyBookings = has(
    messageNorm,
    /(мои записи|моя запись|покажи мои записи|последняя запись|прошедш|история записей|какая у меня.*запись|какая запись|какие записи|что с моей записью|что по моей записи|ближайшая запись|предстоящая запись)/i,
  );
  const asksLatestSingle = has(messageNorm, /(какая последняя запись|последнюю покажи|последняя запись|последний визит)/i);
  const asksNearest = has(messageNorm, /(ближайш|предстоящ|следующ|скоро.*запись)/i);
  const asksPast = has(messageNorm, /(прошедш|прошлая|история)/i);
  const asksAllBookings = has(messageNorm, /(?:^|\\s)(?:все|всё)(?:\\s+(?:записи|напиши|покажи|выведи))?(?:\\s|$)/i);
  const asksAllPast =
    has(messageNorm, /(?:все|всё).*(?:прошед|прошл)/i) || has(messageNorm, /(?:прошед|прошл).*(?:все|всё)/i);

  const asksStats = has(messageNorm, /(моя статистика|статистика|сколько раз|сколько посещений|средний чек)/i);
  const asksCancel = has(
    messageNorm,
    /(отмени(ть)?( запись)?|отмена записи|cancel booking|можешь.*отменить|отмени (ее|её|эту|последнюю|ближайшую))/i,
  );
  const asksReschedule = has(
    messageNorm,
    /(перенес(?:и|ти|ть)?( запись)?|перезапиши|reschedule|можешь.*перенести|перенеси (ее|её|эту|последнюю|ближайшую)|перенести\s*#?\d{1,8}\s*на)/i,
  );
  const asksRepeat = has(messageNorm, /(повтори прошлую запись|повтори запись|запиши как в прошлый раз)/i);
  const asksProfile = has(messageNorm, /(мои данные|мой телефон|смени телефон|обнови телефон|мой профиль)/i);

  const cancelConfirmId = messageNorm.match(/п?одтверждаю\s+отмену\s*#?\s*(\d{1,8})/i)?.[1];
  const cancelConfirmBare = has(messageNorm, /п?одтверждаю\s+отмену/i);
  const rescheduleConfirm = parseRescheduleConfirm(messageNorm);

  if (!asksMyBookings && !asksLatestSingle && !asksNearest && !asksPast && !asksAllBookings && !asksAllPast && !asksStats && !asksCancel && !asksReschedule && !asksRepeat && !asksProfile && !(parseAppointmentId(messageNorm) != null && has(messageNorm, /(подроб|расшифр|детал|покажи запись|запись\s*#|запись\s*№)/i))) {
    if (!cancelConfirmId && !cancelConfirmBare && !rescheduleConfirm) return { handled: false };
  }

  if (asksMyBookings || asksLatestSingle || asksNearest || asksPast || asksAllBookings || asksAllPast || (parseAppointmentId(messageNorm) != null && has(messageNorm, /(подроб|расшифр|детал|покажи запись|запись\s*#|запись\s*№)/i))) {
    const items = await getClientBookings({ accountId, clientId, limit: 50 });
    if (!items.length) return { handled: true, reply: "У вас пока нет записей.", ui: buildClientActionsMenuUi() };

    const now = new Date();
    const past = items
      .filter((x) => x.startAt < now && x.status !== "CANCELLED")
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    const upcoming = items
      .filter((x) => x.startAt >= now && x.status !== "CANCELLED")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    const asksUpcomingList = has(messageNorm, /(предстоящ(ие|их)|ближайшие|будущие)(?:\s+запис)?/i);
    const asksPastList = has(messageNorm, /(прошедш(ие|их)|история( записей)?)(?:\s+запис)?/i);
    const asksAll = has(messageNorm, /(?:^|\s)(?:все|всё)(?:\s+(?:записи|напиши|покажи|выведи))?(?:\s|$)/i);
    const page = parsePage(messageNorm);
    const requestedId = parseAppointmentId(messageNorm);
    const asksDetails = requestedId != null && has(messageNorm, /(подроб|расшифр|детал|покажи запись|запись\s*#|запись\s*№)/i);

    const serviceFilter = messageNorm.match(/по услуге\s+([^\n]+)/i)?.[1]?.trim() ?? null;
    const specialistFilter = messageNorm.match(/по специалисту\s+([^\n]+)/i)?.[1]?.trim() ?? null;
    const locationFilter = messageNorm.match(/по локации\s+([^\n]+)/i)?.[1]?.trim() ?? null;
    const dateFilter = parseRuDateToYmd(messageNorm, todayYmd);
    const timeFilter = parseTime(messageNorm);

    const applyFilters = (arr: any[]) =>
      arr.filter((x) => {
        const serviceNames = (x.services ?? []).map((s: any) => String(s?.service?.name ?? "").toLowerCase());
        if (serviceFilter && !serviceNames.some((n: string) => n.includes(serviceFilter.toLowerCase()))) return false;
        if (specialistFilter) {
          const raw = JSON.stringify(x).toLowerCase();
          if (!raw.includes(specialistFilter.toLowerCase())) return false;
        }
        if (locationFilter) {
          const raw = JSON.stringify(x).toLowerCase();
          if (!raw.includes(locationFilter.toLowerCase())) return false;
        }
        if (dateFilter) {
          const ru = dateFilter.split("-").reverse().join(".");
          if (!formatDateTimeInTz(x.startAt, accountTimeZone).includes(ru)) return false;
        }
        if (timeFilter && !formatDateTimeInTz(x.startAt, accountTimeZone).includes(timeFilter)) return false;
        return true;
      });

    if (asksDetails && requestedId) {
      const found = items.find((x) => x.id === requestedId);
      if (!found) return { handled: true, reply: `Запись #${requestedId} не нашла.`, ui: buildClientActionsMenuUi() };
      return {
        handled: true,
        reply: bookingDetailsText(found, accountTimeZone),
        ui: { kind: "quick_replies", options: [qr("Отменить эту запись", `отмени запись #${found.id}`), qr("Перенести эту запись", `перенеси запись #${found.id}`), qr("К списку записей", "какие у меня записи")] },
      };
    }

    if (asksNearest) {
      const near = upcoming[0];
      if (!near) return { handled: true, reply: "Ближайших предстоящих записей не нашла.", ui: buildClientActionsMenuUi() };
      return {
        handled: true,
        reply: `Ближайшая запись: ${bookingShortLabel(near, accountTimeZone)} — ${near.status}.`,
        ui: { kind: "quick_replies", options: [qr(`Открыть #${near.id}`, `покажи запись #${near.id}`), ...clientActionsMenuOptions()] },
      };
    }

    if (asksAllPast || asksPastList) {
      const scoped = applyFilters(past);
      if (!scoped.length) return { handled: true, reply: "Прошедших записей по этому запросу не нашла.", ui: buildClientActionsMenuUi() };
      return listBookingsResponse({ title: "Прошедшие записи", items: scoped, page, scopeValue: "прошедшие записи", accountTimeZone });
    }

    if (asksLatestSingle || has(messageNorm, /(последн|последи)/i)) {
      const last = past[0];
      if (!last) return { handled: true, reply: "Прошедших записей пока нет.", ui: buildClientActionsMenuUi() };
      return {
        handled: true,
        reply: `Последняя прошедшая запись: ${bookingShortLabel(last, accountTimeZone)} — ${last.status}.`,
        ui: { kind: "quick_replies", options: [qr(`Открыть #${last.id}`, `покажи запись #${last.id}`), qr("Все прошедшие", "прошедшие записи"), ...clientActionsMenuOptions()] },
      };
    }

    if (asksUpcomingList) {
      const scoped = applyFilters(upcoming);
      if (!scoped.length) return { handled: true, reply: "Предстоящих записей по этому запросу не нашла.", ui: buildClientActionsMenuUi() };
      return listBookingsResponse({ title: "Предстоящие записи", items: scoped, page, scopeValue: "предстоящие записи", accountTimeZone });
    }

    if (asksAll || asksAllBookings) {
      const scoped = applyFilters(items);
      if (!scoped.length) return { handled: true, reply: "Записей по этому запросу не нашла.", ui: buildClientActionsMenuUi() };
      return listBookingsResponse({ title: "Все записи", items: scoped, page, scopeValue: "все записи", accountTimeZone });
    }

    if (asksMyBookings) {
      return {
        handled: true,
        reply: "Что показать по вашим записям?",
        ui: buildClientActionsMenuUi(),
      };
    }

    const near = upcoming[0];
    if (near) {
      return {
        handled: true,
        reply: `Ближайшая запись: ${bookingShortLabel(near, accountTimeZone)} — ${near.status}.`,
        ui: buildClientActionsMenuUi(),
      };
    }

    return {
      handled: true,
      reply: "Могу показать предстоящие или прошедшие записи.",
      ui: buildClientActionsMenuUi(),
    };
  }

  if (asksStats) {
    const s = await getClientStats({ accountId, clientId });
    return {
      handled: true,
      reply: `Ваша статистика: визитов всего ${s.total}, завершено ${s.done}, отмен ${s.cancelled}, средний чек ${Math.round(
        s.avgCheck,
      )} ₽${s.topService ? `, любимая услуга: ${s.topService}` : ""}.`,
    };
  }

  if (asksProfile) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для изменения профиля нужна активная авторизация." };
    }
    const newPhone = parsePhone(message);
    if (newPhone) {
      const updated = await updateClientPhone({ accountId, clientId, phone: newPhone });
      return { handled: true, reply: `Готово, обновила телефон: ${updated.phone}.` };
    }
    return { handled: true, reply: "Могу показать и обновить ваш телефон. Напишите новый номер в формате +7..." };
  }

  if (asksCancel) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для отмены записи нужна активная авторизация." };
    }
    const id = parseAppointmentId(messageNorm);
    const all = await getClientBookings({ accountId, clientId, limit: 50 });
    const now = new Date();
    const upcomingForCancel = all
      .filter((x) => x.startAt >= now && x.status !== "CANCELLED" && x.status !== "DONE")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    if (!upcomingForCancel.length) return { handled: true, reply: "Не нашла активные будущие записи для отмены." };

    if (!id) {
      return {
        handled: true,
        reply: "Выберите запись для отмены:",
        ui: { kind: "quick_replies", options: upcomingForCancel.slice(0, 10).map((x) => qr(bookingCancelOptionLabel(x, accountTimeZone), `отмени запись #${x.id}`)) },
      };
    }

    const target = upcomingForCancel.find((x) => x.id === id) ?? all.find((x) => x.id === id) ?? null;
    if (!target) return { handled: true, reply: `Запись #${id} не нашла.` };
    const policy = await getBookingPolicy({ accountId });
    return {
      handled: true,
      reply: `Проверьте отмену: #${id} — ${formatDateTimeInTz(target.startAt, accountTimeZone)}.${policy.cancellationWindowHours != null ? ` Отмена доступна не позднее чем за ${formatPolicyHoursHuman(policy.cancellationWindowHours)} до визита.` : ""}`,
      ui: { kind: "quick_replies", options: [qr(`Подтверждаю отмену #${id}`, `подтверждаю отмену #${id}`), qr("Назад к моим записям", "какие у меня записи")] },
    };
  }

  if (cancelConfirmId || cancelConfirmBare) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для отмены записи нужна активная авторизация." };
    }
    let id = cancelConfirmId ? Number(cancelConfirmId) : null;
    if (!id) {
      const nearest = await findLatestUpcomingBooking({ accountId, clientId });
      if (!nearest) return { handled: true, reply: "Не нашла запись для подтверждения отмены. Укажите номер: «подтверждаю отмену #ID»." };
      id = nearest.id;
    }
    const cancelled = await cancelClientBooking({ accountId, clientId, appointmentId: id });
    if (!cancelled.ok) {
      if ((cancelled as any).reason === "cancellation_window_blocked") {
        const policyHours = (cancelled as any).policyHours;
        return {
          handled: true,
          reply: `Не могу отменить: по правилам отмена доступна не позднее чем за ${formatPolicyHoursHuman(
            policyHours,
          )} до начала.`,
        };
      }
      return { handled: true, reply: "Не получилось отменить запись. Проверьте номер записи и статус." };
    }
    return { handled: true, reply: `Запись #${id} отменена.` };
  }

  if (asksReschedule) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для переноса записи нужна активная авторизация." };
    }

    const idFromText = parseAppointmentId(messageNorm);
    const dt = parseDateTime(messageNorm, todayYmd);
    const all = await getClientBookings({ accountId, clientId, limit: 50 });
    const now = new Date();
    const upcomingForReschedule = all
      .filter((x) => x.startAt >= now && x.status !== "CANCELLED" && x.status !== "DONE")
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    if (!upcomingForReschedule.length) return { handled: true, reply: "Не нашла активные будущие записи для переноса." };

    if (!idFromText) {
      return {
        handled: true,
        reply: "Выберите запись для переноса:",
        ui: { kind: "quick_replies", options: upcomingForReschedule.slice(0, 10).map((x) => qr(bookingRescheduleOptionLabel(x, accountTimeZone), `перенеси запись #${x.id}`)) },
      };
    }

    const target = upcomingForReschedule.find((x) => x.id === idFromText) ?? all.find((x) => x.id === idFromText) ?? null;
    if (!target) return { handled: true, reply: `Запись #${idFromText} не нашла.` };

    const dateOnly = parseRuDateToYmd(messageNorm, todayYmd);
    const targetServiceId = extractPrimaryServiceId(target);
    const canComputeExactAvailability =
      Boolean(origin) &&
      Boolean(accountSlug) &&
      Number.isInteger(target.locationId) &&
      Number.isInteger(target.specialistId) &&
      Number.isInteger(targetServiceId);

    if (!dt && dateOnly && canComputeExactAvailability) {
      const offers = await getOffers(
        String(origin),
        String(accountSlug),
        Number(target.locationId),
        dateOnly,
        Number(target.id),
      );
      const availableTimes = extractAvailableTimesForTarget({
        offers,
        serviceId: Number(targetServiceId),
        specialistId: Number(target.specialistId),
      }).slice(0, 24);

      if (!availableTimes.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(dateOnly)} для записи #${target.id} свободных слотов не нашла. Выберите другую дату в календаре.`,
          ui: {
            kind: "date_picker",
            minDate: todayYmd,
            maxDate: addDaysYmd(todayYmd, 60),
            initialDate: dateOnly,
            availableDates: await getRescheduleAvailableDates({
              origin: String(origin),
              accountSlug: String(accountSlug),
              locationId: Number(target.locationId),
              serviceId: Number(targetServiceId),
              specialistId: Number(target.specialistId),
              excludeAppointmentId: Number(target.id),
              fromYmd: todayYmd,
              days: 60,
            }),
          },
        };
      }

      return {
        handled: true,
        reply: `Выберите новое время на ${formatYmdRu(dateOnly)} для записи #${target.id}.`,
        ui: {
          kind: "quick_replies",
          options: [
            qr("Выбрать другую дату", `перенеси запись #${target.id}`),
            ...availableTimes.map((hm) => qr(hm, `перенести #${target.id} на ${formatYmdRu(dateOnly)} ${hm}`)),
          ],
        },
      };
    }

    if (!dt && dateOnly) {
      return {
        handled: true,
        reply: `Выберите новое время на ${formatYmdRu(dateOnly)} для записи #${target.id}.`,
        ui: {
          kind: "quick_replies",
          options: [
            qr("Выбрать другую дату", `перенеси запись #${target.id}`),
            ...rescheduleQuickTimeOptions(target.id).map((x) => {
              const hm = x.label;
              return qr(hm, `перенести #${target.id} на ${formatYmdRu(dateOnly)} ${hm}`);
            }),
          ],
        },
      };
    }

    if (!dt) {
      const minDate = todayYmd;
      const maxDate = addDaysYmd(todayYmd, 60);
      if (canComputeExactAvailability) {
        const availableDates = await getRescheduleAvailableDates({
          origin: String(origin),
          accountSlug: String(accountSlug),
          locationId: Number(target.locationId),
          serviceId: Number(targetServiceId),
          specialistId: Number(target.specialistId),
          excludeAppointmentId: Number(target.id),
          fromYmd: minDate,
          days: 60,
        });

        return {
          handled: true,
          reply: `Запись #${target.id} нашла. Выберите новую дату в календаре.`,
          ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates },
        };
      }

      return {
        handled: true,
        reply: `Запись #${target.id} нашла. Выберите новую дату в календаре.`,
        ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates: null },
      };
    }
    const policy = await getBookingPolicy({ accountId });
    return {
      handled: true,
      reply: `Проверьте перенос:` + "\n" + `Номер: #${target.id}` + "\n" + `Локация: ${bookingLocationName(target)}` + "\n" + `Специалист: ${bookingSpecialistName(target)}` + "\n" + `Услуга: ${bookingServiceName(target)}` + "\n" + `Дата и время: ${formatYmdRu(dt.date)} ${dt.time}` + "\n" + `Для подтверждения нажмите кнопку ниже.${
        policy.rescheduleWindowHours != null
          ? ` Перенос доступен не позднее чем за ${formatPolicyHoursHuman(policy.rescheduleWindowHours)} до визита.`
          : ""
      }`,
      ui: {
        kind: "quick_replies",
        options: [
          qr("Потверждаю перенос", `подтверждаю перенос #${target.id} на ${formatYmdRu(dt.date)} ${dt.time}`),
          qr("Выбрать другое время", `перенести #${target.id} на ${formatYmdRu(dt.date)}`),
        ],
      },
    };
  }

  if (rescheduleConfirm) {
    if (authMode !== "full") {
      return { handled: true, reply: "Для переноса записи нужна активная авторизация." };
    }
    const id = rescheduleConfirm.id;
    const date = rescheduleConfirm.date;
    const hh = rescheduleConfirm.hh;
    const mm = rescheduleConfirm.mm;
    const startAt = zonedTimeToUtc(date, `${hh}:${mm}`, accountTimeZone);
    if (!startAt) return { handled: true, reply: "Не распознала новую дату/время для переноса." };
    const bookings = await getClientBookings({ accountId, clientId, limit: 50 });
    const current = bookings.find((x) => x.id === id) ?? null;
    const durationMs = current ? Math.max(30 * 60_000, current.endAt.getTime() - current.startAt.getTime()) : 60 * 60_000;
    const endAt = new Date(startAt.getTime() + durationMs);
    const moved = await rescheduleClientBooking({ accountId, clientId, appointmentId: id, startAt, endAt });
    if (!moved.ok) {
      if ((moved as any).reason === "reschedule_window_blocked") {
        const policyHours = (moved as any).policyHours;
        return {
          handled: true,
          reply: `Не могу перенести: по правилам перенос доступен не позднее чем за ${formatPolicyHoursHuman(
            policyHours,
          )} до начала визита.`,
          ui: {
            kind: "quick_replies",
            options: [
              qr("Выбрать другое время", `перенести #${id} на ${formatYmdRu(date)}`),
              qr("Выбрать другую дату", `перенеси запись #${id}`),
            ],
          },
        };
      }
      if ((moved as any).reason === "slot_busy") {
        return {
          handled: true,
          reply: "Не получилось перенести: выбранный слот уже занят. Выберите другое время.",
          ui: {
            kind: "quick_replies",
            options: [
              qr("Выбрать другое время", `перенести #${id} на ${formatYmdRu(date)}`),
              qr("Выбрать другую дату", `перенеси запись #${id}`),
            ],
          },
        };
      }
      return {
        handled: true,
        reply: "Не получилось перенести запись. Проверьте номер записи и выберите другой слот.",
        ui: {
          kind: "quick_replies",
          options: [
            qr("Выбрать другое время", `перенести #${id} на ${formatYmdRu(date)}`),
            qr("Выбрать другую дату", `перенеси запись #${id}`),
          ],
        },
      };
    }
    const updated = bookings.find((x) => x.id === id) ?? current;
    return {
      handled: true,
      reply: `Готово, перенос выполнен.` + "\n" + `Номер: #${id}` + "\n" + `Локация: ${updated ? bookingLocationName(updated) : "Локация не указана"}` + "\n" + `Специалист: ${updated ? bookingSpecialistName(updated) : "Специалист не указан"}` + "\n" + `Услуга: ${updated ? bookingServiceName(updated) : "Услуга"}` + "\n" + `Дата и время: ${formatYmdRu(date)} ${hh}:${mm}`,
    };
  }

  if (asksRepeat) {
    const items = await getClientBookings({ accountId, clientId, limit: 1 });
    if (!items.length) return { handled: true, reply: "Не нашла предыдущих записей для повтора." };
    const last = items[0]!;
    return {
      handled: true,
      reply: `Могу повторить последнюю запись (#${last.id}: ${last.services[0]?.service.name ?? "услуга"}). Напишите дату и время, и я подберу слот.`,
    };
  }

  return { handled: false };
}



function clientActionsMenuOptions(): ChatUiOption[] {
  return [
    qr("Предстоящие записи", "предстоящие записи"),
    qr("Прошедшие записи", "прошедшие записи"),
    qr("Отменить запись", "отмени мою ближайшую запись"),
    qr("Перенести запись", "перенеси мою запись"),
    qr("Статистика", "моя статистика"),
  ];
}




























