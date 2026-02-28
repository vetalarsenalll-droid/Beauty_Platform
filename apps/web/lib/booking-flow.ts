import {
  bookingSummary,
  createAssistantBooking,
  DraftLike,
  getEffectiveServiceForSpecialist,
  getOffers,
  getSlots,
  LocationLite,
  ServiceLite,
  specialistsForSlot,
  SpecialistLite,
} from "@/lib/booking-tools";

export type BookingState =
  | "IDLE"
  | "COLLECTING"
  | "CHECKING"
  | "READY_SELF"
  | "WAITING_CONSENT"
  | "WAITING_CONFIRMATION"
  | "COMPLETED"
  | "CANCEL_FLOW"
  | "RESCHEDULE_FLOW";

type FlowAction = { type: "open_booking"; bookingUrl: string } | null;
export type ChatUiOption = { label: string; value: string; href?: string };
export type ChatUi =
  | { kind: "quick_replies"; options: ChatUiOption[] }
  | { kind: "consent"; options: ChatUiOption[]; legalLinks: string[]; consentValue: string };

type FlowCtx = {
  messageNorm: string;
  bookingIntent: boolean;
  asksAvailability: boolean;
  choice: number | null;
  d: DraftLike;
  currentStatus: string;
  origin: string;
  account: { id: number; slug: string; timeZone: string };
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  requiredVersionIds: number[];
  request: Request;
  publicSlug: string;
  todayYmd: string;
};

type FlowResult = {
  handled: boolean;
  reply?: string;
  nextStatus?: string;
  nextAction?: FlowAction;
  ui?: ChatUi | null;
};

function formatYmdRu(ymd: string | null | undefined) {
  if (!ymd) return '—';
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatTimesShort(times: string[], limit: number | null = 12) {
  if (!times.length) return "";
  if (limit == null || limit <= 0) return times.join(", ");
  const head = times.slice(0, limit);
  const rest = Math.max(0, times.length - head.length);
  return rest > 0 ? `${head.join(", ")} (+еще ${rest})` : head.join(", ");
}

function addDaysYmd(ymd: string, days: number) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (mo || 1) - 1, d || 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function optionFromLabel(label: string, value?: string): ChatUiOption {
  return { label, value: value ?? label };
}

function serviceOption(service: ServiceLite): ChatUiOption {
  return optionFromLabel(
    `${service.name} — ${Math.round(service.basePrice)} ₽, ${service.baseDurationMin} мин`,
    service.name,
  );
}

function parseDateFromBookingMessage(messageNorm: string, todayYmd: string) {
  if (/\bсегодня\b/iu.test(messageNorm)) return todayYmd;
  if (/\bпослезавтра\b/iu.test(messageNorm)) return addDaysYmd(todayYmd, 2);
  if (/\bзавтра\b/iu.test(messageNorm)) return addDaysYmd(todayYmd, 1);

  const dmText = messageNorm.match(
    /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/iu,
  );
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
    const month = monthMap.get((dmText[2] ?? "").toLowerCase()) ?? "01";
    let year = dmText[3] ? Number(dmText[3]) : Number(todayYmd.slice(0, 4));
    let candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    if (!dmText[3] && candidate < todayYmd) {
      year += 1;
      candidate = `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
    return candidate;
  }

  const weekdayMatch = messageNorm.match(
    /\b(?:в\s+)?(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)\b/iu,
  );
  if (weekdayMatch) {
    const toIsoWeekday = (w: string) => {
      const x = w.toLowerCase();
      if (x.startsWith("понедель")) return 1;
      if (x.startsWith("втор")) return 2;
      if (x.startsWith("сред")) return 3;
      if (x.startsWith("четвер")) return 4;
      if (x.startsWith("пят")) return 5;
      if (x.startsWith("суб")) return 6;
      return 0;
    };
    const target = toIsoWeekday(weekdayMatch[1] ?? "");
    const [y, m, d] = todayYmd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
    const current = dt.getUTCDay();
    const delta = (target - current + 7) % 7;
    return addDaysYmd(todayYmd, delta);
  }

  const monthOnly = messageNorm.match(/\b(?:в\s+)?(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)\b/iu);
  if (monthOnly) {
    const monthMap = new Map<string, string>([
      ["январе", "01"],
      ["феврале", "02"],
      ["марте", "03"],
      ["апреле", "04"],
      ["мае", "05"],
      ["июне", "06"],
      ["июле", "07"],
      ["августе", "08"],
      ["сентябре", "09"],
      ["октябре", "10"],
      ["ноябре", "11"],
      ["декабре", "12"],
    ]);
    const month = monthMap.get((monthOnly[1] ?? "").toLowerCase()) ?? "01";
    let year = Number(todayYmd.slice(0, 4));
    let candidate = `${year}-${month}-01`;
    if (candidate < todayYmd) {
      year += 1;
      candidate = `${year}-${month}-01`;
    }
    return candidate;
  }

  return null;
}

function bookingUrl(publicSlug: string, d: DraftLike) {
  const u = new URL(`/${publicSlug}/booking`, "http://x");
  if (d.locationId) u.searchParams.set("locationId", String(d.locationId));
  if (d.serviceId) u.searchParams.set("serviceId", String(d.serviceId));
  if (d.specialistId) u.searchParams.set("specialistId", String(d.specialistId));
  if (d.date) u.searchParams.set("date", d.date);
  if (d.time) u.searchParams.set("time", d.time);
  u.searchParams.set("scenario", "specialistFirst");
  return `${u.pathname}?${u.searchParams.toString()}`;
}

function isAffirmative(t: string) {
  return /^(?:\u0434\u0430|\u0432\u0435\u0440\u043d\u043e|\u0432\u0441\u0435\s+\u0432\u0435\u0440\u043d\u043e|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e|\u043f\u043e\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e|\u0441\u043e\u0433\u043b\u0430\u0441\u0435\u043d|\u0441\u043e\u0433\u043b\u0430\u0441\u043d\u0430|\u043e\u043a|\u043e\u043a\u0435\u0439)$/iu.test(
    t.trim(),
  );
}

function wantsNewBooking(messageNorm: string) {
  return /(новая запись|запиши еще|еще запись|запиши меня|хочу записаться|повторная запись)/i.test(messageNorm);
}

function isGratitudeOrPostCompletion(messageNorm: string) {
  return /(спасибо|благодарю|отлично|супер|понял|поняла|окей|ок)/i.test(messageNorm);
}

function wantsChange(messageNorm: string) {
  return /(?:\u043d\u0435 \u0442\u043e|\u043d\u0435\u0432\u0435\u0440\u043d\u043e|\u0438\u0437\u043c\u0435\u043d\u0438|\u0434\u0440\u0443\u0433\u043e\u0435|\u0434\u0440\u0443\u0433\u0443\u044e|\u043d\u0435 \u043d\u0430|\u043f\u0435\u0440\u0435\u043d\u0435\u0441\u0438|\u0434\u0440\u0443\u0433\u043e\u0439)/iu.test(
    messageNorm,
  );
}

function shouldAskServiceClarification(messageNorm: string, services: ServiceLite[]) {
  if (!/(стриж|haircut)/i.test(messageNorm)) return false;
  const variants = services.filter((s) => /(men haircut|women haircut|муж|жен)/i.test(s.name));
  return variants.length > 1;
}

function detectTimePreference(messageNorm: string): "morning" | "day" | "evening" | null {
  if (
    /(?:\u0432\u0435\u0447\u0435\u0440|\u0432\u0435\u0447\u0435\u0440\u043e\u043c|\u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b|evening)/iu.test(
      messageNorm,
    )
  )
    return "evening";
  if (/(?:\u0443\u0442\u0440|\u0443\u0442\u0440\u043e\u043c|morning)/iu.test(messageNorm)) return "morning";
  if (/(?:\u0434\u043d\u0435\u043c|\u0434\u043d\u0451\u043c|\u0434\u0435\u043d\u044c|\u043f\u043e\u0441\u043b\u0435 \u043e\u0431\u0435\u0434\u0430|daytime)/iu.test(messageNorm))
    return "day";
  return null;
}

function filterByPreference(times: string[], pref: "morning" | "day" | "evening" | null) {
  if (!pref) return times;
  return times.filter((tm) => {
    const [hh] = tm.split(":").map(Number);
    if (!Number.isFinite(hh)) return false;
    if (pref === "morning") return hh < 12;
    if (pref === "day") return hh >= 12 && hh < 17;
    return hh >= 17;
  });
}

function wantsNextDateStep(messageNorm: string) {
  return /^(давай|дальше|далее|следующий|следующую|еще|ещё|да)\b/i.test(messageNorm);
}

function wantsStopBooking(messageNorm: string) {
  return /(?:я\s+передумал(?:а)?|передумал(?:а)?\s+записываться|не\s+хочу(?:\s+записываться)?|не\s+надо|не\s+нужно\s+записывать|отмена\s+записи|отмени\s+запись)/iu.test(
    messageNorm,
  );
}

function asksAfterDateRange(messageNorm: string) {
  return /(?:после\s+\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)|после\s+\d{4}-\d{2}-\d{2})/iu.test(
    messageNorm,
  );
}

function asksAboutSpecialists(messageNorm: string) {
  return /(?:\u0443 \u043a\u0430\u043a\u0438\u0445 \u043c\u0430\u0441\u0442|\u043a\u0430\u043a\u0438\u0435 \u043c\u0430\u0441\u0442|\u043a\u0430\u043a\u043e\u0439 \u043c\u0430\u0441\u0442\u0435\u0440|\u043a\u0430\u043a\u0438\u0435 \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442\u044b|\u043a\u0430\u043a\u043e\u0439 \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442|\u043c\u0430\u0441\u0442\u0435\u0440(?:\u0430|\u044b)?|\u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442(?:\u0430|\u044b)?)/iu.test(
    messageNorm,
  );
}

function normalizeText(v: string) {
  return v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function specialistByText(messageNorm: string, specs: SpecialistLite[]) {
  const t = normalizeText(messageNorm);
  if (!t) return null;
  if (/\b(любой|кто угодно|не важно|неважно)\b/i.test(t)) return specs[0] ?? null;

  const direct = specs.find((s) => t.includes(normalizeText(s.name)));
  if (direct) return direct;

  // Fallback by first/last name fragment from button text.
  const byToken = specs.find((s) => {
    const parts = normalizeText(s.name).split(" ").filter(Boolean);
    return parts.some((p) => p.length >= 3 && new RegExp(`\\b${p}\\b`, "i").test(t));
  });
  return byToken ?? null;
}

function autoAssignedSpecialistText(name: string) {
  const firstName = normalizeText(name).split(" ").find(Boolean) ?? "";
  const explicitFemaleNames = new Set([
    "ирина",
    "анна",
    "мария",
    "ольга",
    "елена",
    "наталья",
    "яна",
    "юлия",
    "екатерина",
    "софия",
    "irina",
    "anna",
    "maria",
    "olga",
    "elena",
    "natalia",
    "yana",
    "julia",
    "ekaterina",
    "sofia",
  ]);
  const maleException = new Set([
    "никита",
    "илья",
    "кузьма",
    "фома",
    "паша",
    "саша",
    "nikita",
    "ilya",
    "kuzma",
    "foma",
    "pasha",
    "sasha",
  ]);
  const isFemale =
    explicitFemaleNames.has(firstName) || ((/[ая]$/.test(firstName) || /(?:a|ia|ya)$/.test(firstName)) && !maleException.has(firstName));
  const availabilityWord = isFemale ? "доступна" : "доступен";
  const pronoun = isFemale ? "её" : "его";
  return `На это время ${availabilityWord} только ${name}, выбрала ${pronoun} автоматически.\n\n`;
}

async function collectLocationWindows(args: {
  origin: string;
  accountSlug: string;
  locations: LocationLite[];
  date: string;
  serviceId: number | null;
  preference: "morning" | "day" | "evening" | null;
  limit?: number | null;
}) {
  const { origin, accountSlug, locations, date, serviceId, preference, limit = 30 } = args;
  const rows: Array<{ locationId: number; name: string; times: string[]; allTimes: string[] }> = [];
  for (const loc of locations) {
    let all: string[] = [];
    if (serviceId) {
      // Use strict slot API for service-specific windows to avoid showing times
      // that later fail specialist/duration validation.
      all = await getSlots(origin, accountSlug, loc.id, serviceId, date);
    } else {
      const offers = await getOffers(origin, accountSlug, loc.id, date);
      all = Array.from(new Set((offers?.times ?? []).filter((x) => (x.services?.length ?? 0) > 0).map((x) => x.time)));
    }
    const filtered = filterByPreference(all, preference);
    const times = limit == null || limit <= 0 ? filtered : filtered.slice(0, limit);
    if (filtered.length) rows.push({ locationId: loc.id, name: loc.name, times, allTimes: filtered });
  }
  return rows;
}

function buildTimeSuggestionOptions(rows: Array<{ name: string; times: string[] }>, requestedTime?: string | null): ChatUiOption[] {
  const options: ChatUiOption[] = [];
  const seen = new Set<string>();
  const push = (label: string, value?: string) => {
    const key = `${label}::${value ?? label}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push(optionFromLabel(label, value));
  };

  if (requestedTime) push(requestedTime, requestedTime);
  rows.forEach((x) => push(x.name, x.name));
  rows
    .flatMap((x) => x.times)
    .slice(0, 24)
    .forEach((tm) => push(tm, tm));
  return options;
}

async function findNearestLocationWindows(args: {
  origin: string;
  accountSlug: string;
  locations: LocationLite[];
  fromDate: string;
  serviceId: number | null;
  preference: "morning" | "day" | "evening" | null;
  daysAhead?: number;
  limit?: number | null;
}) {
  const { origin, accountSlug, locations, fromDate, serviceId, preference, daysAhead = 14, limit = 30 } = args;
  const [yy, mm, dd] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 12, 0, 0));
  for (let i = 0; i < daysAhead; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const ymd = d.toISOString().slice(0, 10);
    const rows = await collectLocationWindows({
      origin,
      accountSlug,
      locations,
      date: ymd,
      serviceId,
      preference,
      limit,
    });
    if (rows.length) return { date: ymd, rows };
  }
  return null;
}

function applyChangeRollback(messageNorm: string, d: DraftLike) {
  if (/(локац|филиал|адрес)/i.test(messageNorm)) {
    d.locationId = null;
    d.specialistId = null;
    d.time = null;
  }
  if (/(услуг|маник|педик|стриж|гель|окраш|facial|peeling|hair)/i.test(messageNorm)) {
    d.serviceId = null;
    d.specialistId = null;
    d.time = null;
  }
  if (/(дата|день|завтра|сегодня|числ|марта|февраля|января|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.test(messageNorm)) {
    d.date = null;
    d.time = null;
    d.specialistId = null;
  }
  if (/(время|час|утр|вечер|днем|днём|:\d{2}|\d{1,2}[.]\d{2})/i.test(messageNorm)) {
    d.time = null;
    d.specialistId = null;
  }
  if (/(мастер|специалист|к [а-яa-z]+$)/i.test(messageNorm)) {
    d.specialistId = null;
  }
  d.mode = null;
  d.consentConfirmedAt = null;
}

export async function runBookingFlow(ctx: FlowCtx): Promise<FlowResult> {
  const {
    d,
    messageNorm,
    bookingIntent,
    asksAvailability,
    origin,
    account,
    locations,
    services,
    specialists,
    requiredVersionIds,
    request,
    choice,
    publicSlug,
    todayYmd,
  } = ctx;
  const hasContext = Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode);
  if (!bookingIntent && !hasContext && d.status !== "COMPLETED") return { handled: false };

  // Parse date intent as early as possible so phrases like
  // "запиши меня сегодня" affect the entire booking path.
  if (!d.date) {
    const parsedDate = parseDateFromBookingMessage(messageNorm, todayYmd);
    if (parsedDate) d.date = parsedDate;
  }
  const wantsAllTimes =
    /(?:покажи|напиши|выведи|дай)\s+в[сc]е\s+(?:врем|слот|окошк)|(?:в[сc]е|полный)\s+список\s+(?:врем|слот|окошк)|все\s+свободн(?:ое|ые)?\s+время|целиком|полностью/iu.test(
      messageNorm,
    );
  const wantsMoreTimes =
    /(?:покажи|дай|выведи)\s+ещ[её](?:\s+\p{L}+){0,3}\s+(?:врем|слот|окошк)|ещ[её]\s+(?:свободн(?:ое|ые)?\s+)?время/iu.test(
      messageNorm,
    );
  const timeLimit = wantsAllTimes || wantsMoreTimes ? null : 12;
  const wantsMonthRange =
    /(?:весь\s+месяц|до\s+конца\s+месяца|в\s+этом\s+месяце|в\s+течение\s+месяца)/iu.test(messageNorm);
  const wantsAfterRange = asksAfterDateRange(messageNorm);

  let nextStatus = (d.status || "COLLECTING") as BookingState;
  let nextAction: FlowAction = null;
  let autoSelectedSpecialistName: string | null = null;
  const singleAccountLocation = locations.length === 1 ? locations[0] ?? null : null;

  if (!d.locationId && singleAccountLocation) {
    d.locationId = singleAccountLocation.id;
  }

  if (d.status === "COMPLETED" && !bookingIntent) {
    if (isGratitudeOrPostCompletion(messageNorm)) {
      return { handled: true, reply: "Пожалуйста. Если захотите новую запись, напишите услугу, дату и время." };
    }
    if (wantsNewBooking(messageNorm)) {
      nextStatus = "COLLECTING";
      d.locationId = null;
      d.serviceId = null;
      d.specialistId = null;
      d.date = null;
      d.time = null;
      d.mode = null;
      d.consentConfirmedAt = null;
    } else {
      return { handled: true, reply: "Запись уже оформлена. Для новой записи напишите: «новая запись»." };
    }
  }
  if (d.status === "COMPLETED" && bookingIntent && wantsNewBooking(messageNorm)) {
    nextStatus = "COLLECTING";
    d.locationId = null;
    d.serviceId = null;
    d.specialistId = null;
    d.date = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
  }

  if (wantsChange(messageNorm) && hasContext && d.status !== "COMPLETED") {
    applyChangeRollback(messageNorm, d);
    nextStatus = "COLLECTING";
  }
  if (wantsStopBooking(messageNorm) && hasContext && d.status !== "COMPLETED") {
    d.locationId = null;
    d.serviceId = null;
    d.specialistId = null;
    d.date = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
    nextStatus = "COLLECTING";
    return {
      handled: true,
      reply: "Хорошо, запись не оформляю. Если передумаете, напишите удобную дату и услугу.",
      nextStatus,
    };
  }

  if (d.locationId && d.serviceId && d.date && d.time) nextStatus = "CHECKING";

  if (!d.locationId) {
    if (!bookingIntent && !d.serviceId && !d.time && asksAboutSpecialists(messageNorm) && d.date) {
      const specByLocation = locations
        .map((loc) => {
          const items = specialists.filter((s) => s.locationIds.includes(loc.id)).slice(0, 6);
          return { loc, items };
        })
        .filter((x) => x.items.length > 0);
      if (specByLocation.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} могу показать специалистов по филиалам. Выберите филиал кнопкой ниже.`,
          nextStatus: "COLLECTING",
          ui: {
            kind: "quick_replies",
            options: specByLocation.map((x) => optionFromLabel(x.loc.name)),
          },
        };
      }
    }
    if (d.date || asksAvailability || d.serviceId) {
      let targetDate = d.date ?? new Date().toISOString().slice(0, 10);
      if (wantsNextDateStep(messageNorm) && d.date) {
        targetDate = addDaysYmd(d.date, 1);
        d.date = targetDate;
      }
      const targetDateRu = formatYmdRu(targetDate);
      const pref = detectTimePreference(messageNorm);
      const rows = await collectLocationWindows({
        origin,
        accountSlug: account.slug,
        locations,
        date: targetDate,
        serviceId: d.serviceId,
        preference: pref,
        limit: timeLimit,
      });
      if (d.time) {
        let resolvedLocationFromTime = false;
        const rowsAtTime = rows.filter((x) => x.allTimes.includes(d.time!));
        if (rowsAtTime.length === 1) {
          d.locationId = rowsAtTime[0]!.locationId;
          nextStatus = "COLLECTING";
          resolvedLocationFromTime = true;
        } else if (rowsAtTime.length > 1) {
          return {
            handled: true,
            reply: `На ${targetDateRu} в ${d.time} есть окна в нескольких филиалах. Выберите филиал кнопкой ниже или напишите название.`,
            nextStatus: "COLLECTING",
            ui: {
              kind: "quick_replies",
              options: rowsAtTime.map((x) => optionFromLabel(x.name)),
            },
          };
        } else if (rows.length) {
          return {
            handled: true,
            reply: `На ${targetDateRu} в ${d.time} свободных окон не нашла. Выберите филиал или другое время кнопкой ниже.`,
            nextStatus: "COLLECTING",
            ui: {
              kind: "quick_replies",
              options: buildTimeSuggestionOptions(rows, d.time),
            },
          };
        }
        if (resolvedLocationFromTime) {
          if (!d.serviceId) {
            const offers = await getOffers(origin, account.slug, d.locationId!, targetDate);
            const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
            // At "choose service after selecting time" step, trust offer matrix for that slot.
            // Extra strict per-service recheck here caused false negatives vs online booking.
            const serviceIds = offerAtTime?.services.map((x) => x.serviceId) ?? [];
            const scopedAtLoc = services.filter((svc) => svc.locationIds.includes(d.locationId!));
            if (serviceIds.length) {
              return {
                handled: true,
                reply: `На ${targetDateRu} в ${d.time} доступны услуги. Выберите услугу кнопкой ниже или напишите название.`,
                nextStatus: "COLLECTING",
                ui: {
                  kind: "quick_replies",
                  options: scopedAtLoc
                    .filter((x) => serviceIds.includes(x.id))
                    .slice(0, 10)
                    .map(serviceOption),
                },
              };
            }
          }
          if (d.serviceId) {
            const offers = await getOffers(origin, account.slug, d.locationId!, targetDate);
            const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
            const serviceIds = offerAtTime?.services.map((x) => x.serviceId) ?? [];
            if (!serviceIds.includes(d.serviceId)) {
              const candidateTimes = Array.from(
                new Set((offers?.times ?? []).filter((x) => x.services.some((s) => s.serviceId === d.serviceId)).map((x) => x.time)),
              );
              if (candidateTimes.length) {
                return {
                  handled: true,
                  reply: `На ${d.time} выбранная услуга недоступна в ${locations.find((x) => x.id === d.locationId)?.name ?? "этой локации"}. Выберите другое время кнопкой ниже.`,
                  nextStatus: "COLLECTING",
                  ui: {
                    kind: "quick_replies",
                    options: candidateTimes.slice(0, 16).map((tm) => optionFromLabel(tm)),
                  },
                };
              }
            }
          }
        }
      }
      if (rows.length && !d.locationId) {
        if (rows.length === 1) {
          d.locationId = rows[0]!.locationId;
          const onlyLocation = rows[0]!;
          const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
          return {
            handled: true,
            reply: `По вашему запросу доступно свободное время на ${targetDateRu}${prefText} в филиале ${onlyLocation.name}. Выберите время ниже.`,
            nextStatus: "COLLECTING",
            ui: {
              kind: "quick_replies",
              options: onlyLocation.times.slice(0, 24).map((tm) => optionFromLabel(tm)),
            },
          };
        }
        const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
        return {
          handled: true,
          reply: `Нашла свободное время на ${targetDateRu}${prefText} в филиалах. Выберите филиал кнопкой ниже или напишите время и филиал сообщением.`,
          nextStatus: "COLLECTING",
          ui: {
            kind: "quick_replies",
            options: rows.map((x) => optionFromLabel(x.name)),
          },
        };
      }
      const nearest = await findNearestLocationWindows({
        origin,
        accountSlug: account.slug,
        locations,
        fromDate: targetDate,
        serviceId: d.serviceId ?? null,
        preference: pref,
        daysAhead: wantsMonthRange ? 45 : wantsAfterRange ? 60 : 14,
        limit: timeLimit,
      });
      if (nearest) {
        return {
          handled: true,
          reply: `На ${targetDateRu}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Нашла ближайшие свободные окна на дату ${formatYmdRu(
            nearest.date,
          )}. Выберите филиал кнопкой ниже.`,
          nextStatus: "COLLECTING",
          ui: {
            kind: "quick_replies",
            options: nearest.rows.map((x) => optionFromLabel(x.name)),
          },
        };
      }
      if (wantsMonthRange || wantsAfterRange) {
        return {
          handled: true,
          reply: `После ${targetDateRu} свободных окон по текущему графику не нашла. Могу проверить более ранние даты или другой филиал.`,
          nextStatus: "COLLECTING",
        };
      }
      return {
        handled: true,
        reply: `На ${targetDateRu}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Могу проверить другую дату.`,
        nextStatus: "COLLECTING",
      };
    }
    return {
      handled: true,
      reply: "Выберите локацию, и продолжу запись.",
      nextStatus: "COLLECTING",
      ui: {
        kind: "quick_replies",
        options: locations.map((x) => optionFromLabel(x.name)),
      },
    };
  }

  const scopedServices = services.filter((x) => x.locationIds.includes(d.locationId!));
  if (!d.serviceId) {
    if (d.date && d.time) {
      const offers = await getOffers(origin, account.slug, d.locationId!, d.date);
      const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
      const availableTimes = Array.from(new Set((offers?.times ?? []).map((x) => x.time))).slice(0, 24);
      if (!offerAtTime || !offerAtTime.services.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} в ${d.time} нет доступных услуг в этой локации. Укажите другое время.`,
          nextStatus: "COLLECTING",
          ui: availableTimes.length ? { kind: "quick_replies", options: availableTimes.map((tm) => optionFromLabel(tm)) } : null,
        };
      }
      // Use slot offer matrix as source of truth while user is choosing service.
      const serviceIds = offerAtTime.services.map((x) => x.serviceId);
      if (!serviceIds.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} в ${d.time} нет доступных услуг с учетом длительности и графика специалистов. Укажите другое время.`,
          nextStatus: "COLLECTING",
          ui: availableTimes.length ? { kind: "quick_replies", options: availableTimes.map((tm) => optionFromLabel(tm)) } : null,
        };
      }
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} в ${d.time} доступны услуги. Выберите услугу кнопкой ниже или напишите название.`,
        nextStatus: "COLLECTING",
        ui: {
          kind: "quick_replies",
          options: scopedServices
            .filter((x) => serviceIds.includes(x.id))
            .slice(0, 10)
            .map(serviceOption),
        },
      };
    }
    if (!bookingIntent && !d.time && asksAboutSpecialists(messageNorm) && d.date) {
      const availableByLocation = specialists.filter((s) => s.locationIds.includes(d.locationId!));
      if (availableByLocation.length) {
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} есть специалисты. Выберите специалиста кнопкой ниже.`,
          nextStatus: "COLLECTING",
          ui: {
            kind: "quick_replies",
            options: availableByLocation.slice(0, 12).map((x) => optionFromLabel(x.name)),
          },
        };
      }
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} по этой локации не нашла специалистов в расписании. Могу проверить другую дату или локацию.`,
        nextStatus: "COLLECTING",
      };
    }
    if (asksAvailability) {
      const targetDate = d.date ?? todayYmd;
      if (!d.date) d.date = targetDate;
      const offers = await getOffers(origin, account.slug, d.locationId!, targetDate);
      const allTimes = Array.from(new Set((offers?.times ?? []).filter((x) => (x.services?.length ?? 0) > 0).map((x) => x.time)));
      const pref = detectTimePreference(messageNorm);
      const times = filterByPreference(allTimes, pref);
      if (times.length) {
        const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
        return {
          handled: true,
          reply: `На ${formatYmdRu(targetDate)}${prefText} в ${
            locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"
          } есть свободное время. Можете выбрать время, а затем услугу.`,
          nextStatus: "COLLECTING",
          ui: { kind: "quick_replies", options: (timeLimit == null ? times : times.slice(0, 24)).map((x) => optionFromLabel(x)) },
        };
      }
      return {
        handled: true,
        reply: `На ${formatYmdRu(targetDate)}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Могу показать другой период или подобрать по услуге.`,
        nextStatus: "COLLECTING",
      };
    }
    if (shouldAskServiceClarification(messageNorm, scopedServices)) {
      const haircutOptions = scopedServices.filter((x) => /(стриж|haircut)/i.test(x.name));
      return {
        handled: true,
        reply: "Уточните услугу. Можно выбрать кнопкой ниже или написать услугу сообщением.",
        nextStatus: "COLLECTING",
        ui: { kind: "quick_replies", options: haircutOptions.slice(0, 8).map(serviceOption) },
      };
    }
    return {
      handled: true,
      reply: "Выберите услугу, и продолжу запись.",
      nextStatus: "COLLECTING",
      ui: { kind: "quick_replies", options: scopedServices.slice(0, 10).map(serviceOption) },
    };
  }

  if (!d.date) {
    return {
      handled: true,
      reply: "Напишите дату: например «сегодня», «завтра» или «в субботу».",
      nextStatus: "COLLECTING",
    };
  }

  if (!d.time) {
    const allTimes = await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date);
    const pref = detectTimePreference(messageNorm);
    const times = filterByPreference(allTimes, pref);
    if (!times.length) {
      return { handled: true, reply: `На ${formatYmdRu(d.date)} свободных окон по этой услуге не нашла. Укажите другую дату.`, nextStatus: "COLLECTING" };
    }
    const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
    return {
      handled: true,
      reply: `На ${formatYmdRu(d.date)}${prefText} доступны времена. Выберите время.`,
      nextStatus: "COLLECTING",
      ui: { kind: "quick_replies", options: times.map((x) => optionFromLabel(x)) },
    };
  }

  if (!d.specialistId) {
    const offers = await getOffers(origin, account.slug, d.locationId!, d.date!);
    const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
    const offerService = offerAtTime?.services.find((s) => s.serviceId === d.serviceId) ?? null;
    let specs =
      offerService?.specialistIds?.length
        ? specialists.filter((s) => offerService.specialistIds!.includes(s.id))
        : [];
    if (!specs.length) {
      specs = await specialistsForSlot(origin, account.slug, d, specialists);
    }
    if (!specs.length) {
      const offerTimesForService = Array.from(
        new Set(
          (offers?.times ?? [])
            .filter((t) => t.services.some((s) => s.serviceId === d.serviceId && (s.specialistIds?.length ?? 0) > 0))
            .map((t) => t.time),
        ),
      );
      const times = offerTimesForService.length
        ? offerTimesForService
        : await getSlots(origin, account.slug, d.locationId!, d.serviceId!, d.date!);
      const suggestedTimes = times.filter((tm) => tm !== d.time).slice(0, 8);
      if (times.length) {
        const serviceName = services.find((x) => x.id === d.serviceId)?.name ?? "выбранная услуга";
        const shownTimes = (suggestedTimes.length ? suggestedTimes : times.slice(0, 8)).map((tm) => optionFromLabel(tm));
        return {
          handled: true,
          reply:
            offerService == null
              ? `На ${d.time} услуга «${serviceName}» недоступна. Выберите другое время кнопкой ниже.`
              : `На ${d.time} свободных специалистов нет. Выберите другое время кнопкой ниже.`,
          nextStatus: "COLLECTING",
          ui: { kind: "quick_replies", options: shownTimes },
        };
      }
      return { handled: true, reply: "На выбранную дату слотов нет. Укажите другую дату.", nextStatus: "COLLECTING" };
    }
    const byText = specialistByText(messageNorm, specs);
    if (byText) {
      d.specialistId = byText.id;
    } else if (choice && choice >= 1 && choice <= specs.length) {
      d.specialistId = specs[choice - 1]!.id;
    } else if (specs.length === 1) {
      d.specialistId = specs[0]!.id;
      autoSelectedSpecialistName = specs[0]!.name;
    } else {
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} в ${d.time} доступны специалисты. Выберите специалиста кнопкой ниже.`,
        nextStatus: "CHECKING",
        ui: { kind: "quick_replies", options: specs.map((x) => optionFromLabel(x.name)) },
      };
    }
  }

  if (!d.mode) {
    const selectedService = services.find((x) => x.id === d.serviceId) ?? null;
    const selectedSpecialist = specialists.find((x) => x.id === d.specialistId) ?? null;
    const effective = selectedService ? getEffectiveServiceForSpecialist(selectedService, selectedSpecialist) : null;
    const effectiveText = effective ? `\nСтоимость: ${Math.round(effective.price)} ₽\nДлительность: ${effective.durationMin} мин` : "";
    const specialistAutoText = autoSelectedSpecialistName ? autoAssignedSpecialistText(autoSelectedSpecialistName) : "";
    return {
      handled: true,
      reply: `${specialistAutoText}Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}${effectiveText}\n\nКак завершим запись?`,
      nextStatus: "CHECKING",
      ui: {
        kind: "quick_replies",
        options: [optionFromLabel("Самостоятельно", "самостоятельно"), optionFromLabel("Через ассистента", "оформи через ассистента")],
      },
    };
  }

  if (d.mode === "SELF") {
    nextStatus = "READY_SELF";
    nextAction = { type: "open_booking", bookingUrl: bookingUrl(publicSlug, d) };
    return {
      handled: true,
      nextStatus,
      nextAction,
      reply: "Открываю онлайн-запись с подставленными параметрами.",
    };
  }

  if (!d.clientName || !d.clientPhone) {
    const digitCount = (messageNorm.match(/\d/g) ?? []).length;
    const hasAnyDigits = digitCount > 0;
    const hasPhoneMaskPlaceholder = /[xх]{2,}/i.test(messageNorm);
    const invalidPhoneHint =
      hasAnyDigits && !d.clientPhone
        ? hasPhoneMaskPlaceholder
          ? "Похоже, указан шаблон номера. Введите реальный номер цифрами."
          : digitCount < 11
          ? "Похоже, номер слишком короткий."
          : "Не смогла распознать номер телефона."
        : "";
    if (!d.clientName && !d.clientPhone) {
      return {
        handled: true,
        reply:
          "Для оформления через ассистента нужны имя и телефон клиента. " +
          `${invalidPhoneHint ? `${invalidPhoneHint} ` : ""}` +
          "Напишите одним сообщением, например: «Надежда +7XXXXXXXXXX».",
        nextStatus: "WAITING_CONSENT",
      };
    }
    if (!d.clientPhone) {
      return {
        handled: true,
        reply:
          `${invalidPhoneHint ? `${invalidPhoneHint} ` : ""}` +
          "Укажите, пожалуйста, номер телефона клиента в формате +7XXXXXXXXXX или 8XXXXXXXXXX.",
        nextStatus: "WAITING_CONSENT",
      };
    }
    return {
      handled: true,
      reply: "Укажите, пожалуйста, имя клиента (например: «Виталий»).",
      nextStatus: "WAITING_CONSENT",
    };
  }

  if (!d.consentConfirmedAt) {
    const legalLinks = Array.from(new Set(requiredVersionIds.map((id) => `/${publicSlug}/legal/${id}`)));
    return {
      handled: true,
      reply: "Для оформления нужно согласие на обработку персональных данных. Подтвердите галочкой и кнопкой ниже.",
      nextStatus: "WAITING_CONSENT",
      ui: {
        kind: "consent",
        options: [],
        legalLinks,
        consentValue: "Согласен на обработку персональных данных",
      },
    };
  }

  const confirmedByUser = isAffirmative(messageNorm);
  // Enforce a dedicated confirmation step: user must first see confirmation with button,
  // then send explicit confirmation in the next turn.
  if (d.status !== "WAITING_CONFIRMATION" || !confirmedByUser) {
    nextStatus = "WAITING_CONFIRMATION";
    return {
      handled: true,
      nextStatus,
      reply: `Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}\nКлиент: ${d.clientName} ${d.clientPhone}\nЕсли все верно, нажмите кнопку «Записаться» ниже или напишите «да».`,
      ui: { kind: "quick_replies", options: [optionFromLabel("Записаться", "да")] },
    };
  }

  const created = await createAssistantBooking({
    d,
    accountId: account.id,
    accountTz: account.timeZone,
    requiredVersionIds,
    request,
    services,
  });
  if (!created.ok) {
    if (created.code === "slot_busy") {
      const times =
        d.locationId && d.serviceId && d.date
          ? (await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date)).slice(0, 24)
          : [];
      return {
        handled: true,
        reply: "Этот слот уже занят. Выберите другое время.",
        nextStatus: "COLLECTING",
        ui: times.length ? { kind: "quick_replies", options: times.map((tm) => optionFromLabel(tm)) } : null,
      };
    }
    if (created.code === "outside_working_hours") {
      const times =
        d.locationId && d.serviceId && d.date
          ? (await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date)).slice(0, 24)
          : [];
      return {
        handled: true,
        reply: "Время вне графика. Выберите другой слот.",
        nextStatus: "COLLECTING",
        ui: times.length ? { kind: "quick_replies", options: times.map((tm) => optionFromLabel(tm)) } : null,
      };
    }
    if (created.code === "combo_unavailable") return { handled: true, reply: "Эта комбинация локации/услуги/специалиста недоступна.", nextStatus: "COLLECTING" };
    return { handled: true, reply: "Некорректная дата/время для записи.", nextStatus: "COLLECTING" };
  }

  nextStatus = "COMPLETED";
  return {
    handled: true,
    nextStatus,
    reply: `Запись оформлена.\n${bookingSummary(d, locations, services, specialists)}\nНомер записи: ${created.appointmentId}.`,
  };
}

