import {
  bookingSummary,
  createAssistantBooking,
  reserveAssistantSlotHold,
  DraftLike,
      getEffectiveServiceForSpecialist,
  getOffers,
  getSlots,
  serviceLowerBounds,
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

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
export type ChatUi =
  | { kind: "quick_replies"; options: ChatUiOption[] }
  | { kind: "consent"; options: ChatUiOption[]; legalLinks: string[]; consentValue: string }
  | { kind: "date_picker"; minDate: string; maxDate: string; initialDate?: string | null; availableDates?: string[] | null }
  | { kind: "complaint_form"; placeholder?: string; submitLabel?: string; minLength?: number; maxLength?: number };

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
  previouslySelectedSpecialistName?: string | null;
  requiredVersionIds: number[];
  request: Request;
  publicSlug: string;
  todayYmd: string;
  preferredClientId?: number | null;
  holdOwnerMarker?: number | null;
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
function dateDistanceDays(fromYmd: string, toYmd: string) {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const from = Date.UTC(fy, (fm || 1) - 1, fd || 1, 12, 0, 0);
  const to = Date.UTC(ty, (tm || 1) - 1, td || 1, 12, 0, 0);
  return Math.round((to - from) / 86400000);
}

function dateOptionFromYmd(ymd: string, todayYmd: string): ChatUiOption {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 12, 0, 0));
  const monthsGen = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const weekdays = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const diff = dateDistanceDays(todayYmd, ymd);
  const short = `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}`;
  if (diff === 0) return optionFromLabel(`Сегодня, ${short}`, "сегодня");
  if (diff === 1) return optionFromLabel(`Завтра, ${short}`, "завтра");
  if (diff === 2) return optionFromLabel(`Послезавтра, ${short}`, "послезавтра");
  const weekday = weekdays[dt.getUTCDay()] ?? "";
  const value = ymd;
  return optionFromLabel(`${weekday}, ${short}`, value);
}

function sequentialDateOptions(fromYmd: string, todayYmd: string, count = 6): ChatUiOption[] {
  const opts: ChatUiOption[] = [];
  for (let i = 0; i < count; i += 1) {
    opts.push(dateOptionFromYmd(addDaysYmd(fromYmd, i), todayYmd));
  }
  return opts;
}


function endOfMonthYmd(ymd: string) {
  const [y, mo] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo || 1, 0, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function extractMonthOnlyDate(messageNorm: string, todayYmd: string): string | null {
  const monthOnly = messageNorm.match(
    /(?:^|\s)(?:в|на)?\s*(январь|январе|января|февраль|феврале|февраля|март|марте|марта|апрель|апреле|апреля|май|мае|мая|июнь|июне|июня|июль|июле|июля|август|августе|августа|сентябрь|сентябре|сентября|октябрь|октябре|октября|ноябрь|ноябре|ноября|декабрь|декабре|декабря)(?:\s+(\d{4}))?(?:\s|$)/iu,
  );
  if (!monthOnly) return null;
  const monthMap = new Map<string, string>([
    ["январь", "01"],
    ["январе", "01"],
    ["января", "01"],
    ["февраль", "02"],
    ["феврале", "02"],
    ["февраля", "02"],
    ["март", "03"],
    ["марте", "03"],
    ["марта", "03"],
    ["апрель", "04"],
    ["апреле", "04"],
    ["апреля", "04"],
    ["май", "05"],
    ["мае", "05"],
    ["мая", "05"],
    ["июнь", "06"],
    ["июне", "06"],
    ["июня", "06"],
    ["июль", "07"],
    ["июле", "07"],
    ["июля", "07"],
    ["август", "08"],
    ["августе", "08"],
    ["августа", "08"],
    ["сентябрь", "09"],
    ["сентябре", "09"],
    ["сентября", "09"],
    ["октябрь", "10"],
    ["октябре", "10"],
    ["октября", "10"],
    ["ноябрь", "11"],
    ["ноябре", "11"],
    ["ноября", "11"],
    ["декабрь", "12"],
    ["декабре", "12"],
    ["декабря", "12"],
  ]);
  const month = monthMap.get((monthOnly[1] ?? "").toLowerCase()) ?? "01";
  let year = monthOnly[2] ? Number(monthOnly[2]) : Number(todayYmd.slice(0, 4));
  let candidate = `${year}-${month}-01`;
  if (!monthOnly[2] && candidate < todayYmd) {
    year += 1;
    candidate = `${year}-${month}-01`;
  }
  return candidate;
}

function hasConcreteDateMention(messageNorm: string) {
  return (
    /\b\d{4}-\d{2}-\d{2}\b/.test(messageNorm) ||
    /\b\d{1,2}[.]\d{1,2}(?:[.]\d{4})?\b/.test(messageNorm) ||
    /(?:^|\s)(сегодня|завтра|послезавтра)(?:\s|$)/iu.test(messageNorm) ||
    /(?:^|\s)\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s|$)/iu.test(messageNorm)
  );
}

function optionFromLabel(label: string, value?: string): ChatUiOption {
  return { label, value: value ?? label };
}

function serviceOption(
  service: ServiceLite,
  specialist: SpecialistLite | null = null,
  action: "select" | "add" = "select",
): ChatUiOption {
  const effective = getEffectiveServiceForSpecialist(service, specialist);
  const hasSpecialist = Boolean(specialist);
  const bounds = serviceLowerBounds(service);
  const priceText = hasSpecialist ? `${Math.round(effective.price)} ₽` : `от ${Math.round(bounds.minPrice)} ₽`;
  const durationText = hasSpecialist ? `${Math.round(effective.durationMin)} мин` : `от ${Math.round(bounds.minDuration)} мин`;
  if (action === "add") {
    return optionFromLabel(`${service.name} — ${priceText}, ${durationText}`, `добавить ${service.name}`);
  }
  return optionFromLabel(`${service.name} — ${priceText}, ${durationText}`, `выбрать услугу ${service.name}`);
}

function specialistOption(
  specialist: SpecialistLite,
  service: ServiceLite | ServiceLite[] | null = null,
): ChatUiOption {
  const level = (specialist.levelName ?? "").trim();
  const base = level ? `${specialist.name} — ${level}` : specialist.name;
  if (!service) return optionFromLabel(base, specialist.name);
  if (Array.isArray(service)) {
    if (!service.length) return optionFromLabel(base, specialist.name);
    const rows = service.map((svc, index) => {
      const effective = getEffectiveServiceForSpecialist(svc, specialist);
      return `Услуга №${index + 1}: ${svc.name} — ${Math.round(effective.price)} ₽, ${Math.round(effective.durationMin)} мин`;
    });
    const totals = service.reduce(
      (acc, svc) => {
        const effective = getEffectiveServiceForSpecialist(svc, specialist);
        return {
          price: acc.price + Number(effective.price || 0),
          duration: acc.duration + Number(effective.durationMin || 0),
        };
      },
      { price: 0, duration: 0 },
    );
    return optionFromLabel(
      `${base}\n${rows.join("\n")}\nИтого: ${Math.round(totals.price)} ₽, ${Math.round(totals.duration)} мин`,
      specialist.name,
    );
  }
  const effective = getEffectiveServiceForSpecialist(service, specialist);
  return optionFromLabel(`${base} — ${Math.round(effective.price)} ₽, ${Math.round(effective.durationMin)} мин`, specialist.name);
}

function resolveServiceCategoryFromMessage(message: string, values: string[]) {
  if (!values.length) return null;
  const msg = norm(message);
  if (!msg) return null;

  let best: { value: string; score: number } | null = null;
  let second = -1;
  for (const value of values) {
    const v = norm(value);
    if (!v) continue;

    let score = 0;
    if (msg === v) score += 8;
    if (msg.includes(v)) score += 6;
    if (v.includes(msg) && msg.length >= 3) score += 4;

    const tokens = v.split(/\s+/).filter((t) => t.length >= 3);
    for (const token of tokens) {
      if (msg.includes(token)) score += token.length >= 6 ? 3 : 2;
    }

    if (!best || score > best.score) {
      second = best ? best.score : -1;
      best = { value, score };
    } else if (score > second) {
      second = score;
    }
  }

  if (!best || best.score < 3) return null;
  if (second >= 0 && best.score - second < 1) return null;
  return best.value;
}

function parseServiceCategoryFilter(messageNorm: string, services: ServiceLite[]): string | "__all__" | null {
  const m = /^\s*категория:\s*(.+?)\s*$/iu.exec(messageNorm);
  if (m?.[1]) {
    const value = m[1].trim();
    if (!value || /^(все|все категории)$/iu.test(value)) return "__all__";
    return value;
  }

  if (/(?:все|все категории|любая категория|без категории)/iu.test(messageNorm)) return "__all__";
  if (!/(?:категор|раздел|направлен)/iu.test(messageNorm)) return null;

  return resolveServiceCategoryFromMessage(messageNorm, uniqueServiceCategories(services));
}

function uniqueServiceCategories(services: ServiceLite[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of services) {
    const raw = (s.categoryName ?? "").trim();
    if (!raw) continue;
    const key = norm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

function filterServicesByCategory(services: ServiceLite[], selected: string | "__all__" | null) {
  if (!selected || selected === "__all__") return services;
  const selectedNorm = norm(selected);
  return services.filter((s) => norm((s.categoryName ?? "").trim()) === selectedNorm);
}

function serviceCategoryTabOptions(services: ServiceLite[]): ChatUiOption[] {
  const categories = uniqueServiceCategories(services);
  return [
    optionFromLabel("Все категории", "категория: Все категории"),
    ...categories.map((cat) => optionFromLabel(cat, `категория: ${cat}`)),
  ];
}

function serviceSelectionActionOptions(args: {
  servicesAll: ServiceLite[];
  servicesShown: ServiceLite[];
  selectedServiceIds: number[];
  specialist?: SpecialistLite | null;
}) {
  const { servicesAll, servicesShown, selectedServiceIds, specialist = null } = args;
  const selectedSet = new Set(selectedServiceIds);
  const selectedServices = servicesAll.filter((s) => selectedSet.has(s.id));
  const canAdd =
    selectedServices.length > 0 &&
    selectedServices.every((s) => s.allowMultiServiceBooking !== false);

  const controls: ChatUiOption[] = [];
  if (selectedServices.length) {
    controls.push(optionFromLabel("Очистить услуги", "очистить услуги"));
    for (const svc of selectedServices) {
      controls.push(optionFromLabel(`Удалить: ${svc.name}`, `удалить услугу ${svc.name}`));
    }
    controls.push(optionFromLabel("Продолжить запись", "готово с услугами"));
  }

  const selectOptions = servicesShown.map((s) => serviceOption(s, specialist, "select"));
  const addCandidates = canAdd
    ? servicesShown.filter((s) => !selectedSet.has(s.id) && s.allowMultiServiceBooking !== false)
    : [];
  const addOptions = addCandidates.map((s) => serviceOption(s, specialist, "add"));
  const categorySource = canAdd ? addCandidates : servicesAll;

  if (canAdd) {
    return [controls[controls.length - 1]!, ...serviceCategoryTabOptions(categorySource), ...controls.slice(0, -1), ...addOptions];
  }
  return [...serviceCategoryTabOptions(categorySource), ...controls, ...selectOptions];
}

function buildDateContextQuickOptions(dateYmd: string, locationsCount: number): ChatUiOption[] {
  const dateRu = formatYmdRu(dateYmd);
  const options: ChatUiOption[] = [
    optionFromLabel(`Показать время на ${dateRu}`, `покажи время на ${dateRu}`),
    optionFromLabel(`Показать услуги на ${dateRu}`, `какие услуги доступны на ${dateRu}`),
    optionFromLabel(`Показать специалистов на ${dateRu}`, `какие специалисты доступны на ${dateRu}`),
  ];
  if (locationsCount > 1) {
    options.push(optionFromLabel("Выбрать филиал", "покажи филиалы"));
  }
  return options;
}


function buildTimeOptionsWithControls(times: string[], limit: number | null = null): ChatUiOption[] {
  const shown = times;
  const controls: ChatUiOption[] = [];
  controls.push(optionFromLabel("Выбрать другую дату", "другое число хочу выбрать"));
  controls.push(optionFromLabel("Утро", "утром"));
  controls.push(optionFromLabel("День", "днем"));
  controls.push(optionFromLabel("Вечер", "вечером"));

  // Always show full slot list: no collapse and no "Показать всё время" button.
  return [...controls, ...shown.map((tm) => optionFromLabel(tm))];
}

function isValidYmdParts(year: number, month: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}
function parseDateFromBookingMessage(messageNorm: string, todayYmd: string) {
  const iso = messageNorm.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (isValidYmdParts(y, m, d)) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const dmy = messageNorm.match(/\b(\d{1,2})[.](\d{1,2})(?:[.](\d{4}))?\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = dmy[3] ? Number(dmy[3]) : Number(todayYmd.slice(0, 4));
    if (!isValidYmdParts(year, month, day)) return null;
    let candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!dmy[3] && candidate < todayYmd) {
      year += 1;
      if (!isValidYmdParts(year, month, day)) return null;
      candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return candidate;
  }

  if (/(^|\s)сегодня(\s|$)/iu.test(messageNorm)) return todayYmd;
  if (/(^|\s)послезавтра(\s|$)/iu.test(messageNorm)) return addDaysYmd(todayYmd, 2);
  if (/(^|\s)завтра(\s|$)/iu.test(messageNorm)) return addDaysYmd(todayYmd, 1);

  const dmText = messageNorm.match(
    /(?:^|\s)(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?(?:\s|$)/iu,
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
    const month = Number(monthMap.get((dmText[2] ?? "").toLowerCase()) ?? "1");
    let year = dmText[3] ? Number(dmText[3]) : Number(todayYmd.slice(0, 4));
    if (!isValidYmdParts(year, month, day)) return null;
    let candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!dmText[3] && candidate < todayYmd) {
      year += 1;
      if (!isValidYmdParts(year, month, day)) return null;
      candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return candidate;
  }

  const weekdayMatch = messageNorm.match(
    /(?:^|\s)(?:(?:в|на)\s+)?(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)(?:\s|$)/iu,
  );
  if (weekdayMatch) {
    const wantsNextWeek = /следующ/i.test(messageNorm);
    const wantsThisWeek = /(эт(от|у)|ближайш)/iu.test(messageNorm);
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
    let delta = (target - current + 7) % 7;
    if (wantsNextWeek) delta = delta === 0 ? 7 : delta + 7;
    if (!wantsNextWeek && !wantsThisWeek && delta === 0) delta = 0;
    return addDaysYmd(todayYmd, delta);
  }

  const monthOnly = messageNorm.match(
    /(?:^|\s)(?:в|на)?\s*(январь|январе|января|февраль|феврале|февраля|март|марте|марта|апрель|апреле|апреля|май|мае|мая|июнь|июне|июня|июль|июле|июля|август|августе|августа|сентябрь|сентябре|сентября|октябрь|октябре|октября|ноябрь|ноябре|ноября|декабрь|декабре|декабря)(?:\s|$)/iu,
  );
  if (monthOnly) {
    const monthMap = new Map<string, string>([
      ["январь", "01"],
      ["январе", "01"],
      ["января", "01"],
      ["февраль", "02"],
      ["феврале", "02"],
      ["февраля", "02"],
      ["март", "03"],
      ["марте", "03"],
      ["марта", "03"],
      ["апрель", "04"],
      ["апреле", "04"],
      ["апреля", "04"],
      ["май", "05"],
      ["мае", "05"],
      ["мая", "05"],
      ["июнь", "06"],
      ["июне", "06"],
      ["июня", "06"],
      ["июль", "07"],
      ["июле", "07"],
      ["июля", "07"],
      ["август", "08"],
      ["августе", "08"],
      ["августа", "08"],
      ["сентябрь", "09"],
      ["сентябре", "09"],
      ["сентября", "09"],
      ["октябрь", "10"],
      ["октябре", "10"],
      ["октября", "10"],
      ["ноябрь", "11"],
      ["ноябре", "11"],
      ["ноября", "11"],
      ["декабрь", "12"],
      ["декабре", "12"],
      ["декабря", "12"],
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
  const selectedServiceIds = Array.from(
    new Set<number>([
      ...(Array.isArray(d.serviceIds) ? d.serviceIds : []),
      ...(d.serviceId ? [Number(d.serviceId)] : []),
    ]),
  ).filter((id) => Number.isInteger(id) && id > 0);
  if (d.locationId) u.searchParams.set("locationId", String(d.locationId));
  if (selectedServiceIds.length > 0) {
    u.searchParams.set("serviceId", String(selectedServiceIds[0]));
    if (selectedServiceIds.length > 1) {
      u.searchParams.set("serviceIds", selectedServiceIds.join(","));
      u.searchParams.set("scenario", "serviceFirst");
    }
  }
  if (d.specialistId) {
    u.searchParams.set("specialistId", String(d.specialistId));
  } else if (selectedServiceIds.length > 1 && Array.isArray(d.planJson) && d.planJson.length > 0) {
    const specialistIds = Array.from(
      new Set(
        d.planJson
          .map((item) => Number(item?.specialistId))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
    if (specialistIds.length === 1) {
      u.searchParams.set("specialistId", String(specialistIds[0]));
    }
  }
  if (d.date) u.searchParams.set("date", d.date);
  if (d.time) u.searchParams.set("time", d.time);
  if (Array.isArray(d.planJson) && d.planJson.length > 0) {
    try {
      u.searchParams.set("plan", JSON.stringify(d.planJson));
    } catch {
      // ignore malformed plan
    }
  }
  if (!u.searchParams.has("scenario")) {
    u.searchParams.set("scenario", "specialistFirst");
  }
  return `${u.pathname}?${u.searchParams.toString()}`;
}

function isAffirmative(t: string) {
  return /^(?:да|верно|все\s+верно|подтверждаю|потверждаю|согласен|согласна|ок|окей)$/iu.test(t.trim());
}

function wantsNewBooking(messageNorm: string) {
  return /(новая запись|запиши еще|еще запись|запиши меня|хочу записаться|повторная запись)/i.test(messageNorm);
}

function isGratitudeOrPostCompletion(messageNorm: string) {
  return /(спасибо|благодарю|отлично|супер|понял|поняла|окей|ок)/i.test(messageNorm);
}

function wantsChange(messageNorm: string) {
  return /(?:не\s+то|неверно|измени|смени|друг(?:ой|ую|ое)\s+(?:дат|день|врем|услуг|мастер|специалист|филиал|локац)|не\s+на\s+эту\s+услуг|перенеси\s+(?:время|дату))/iu.test(
    messageNorm,
  );
}

function extractServiceTopicRoots(messageNorm: string) {
  const roots = [
    "маник",
    "педик",
    "стриж",
    "окраш",
    "бров",
    "ресниц",
    "гель",
    "уход",
    "ламин",
    "коррекц",
    "наращ",
    "уклад",
    "пилинг",
    "чистк",
    "массаж",
  ];
  return roots.filter((root) => new RegExp(root, "i").test(messageNorm));
}

function getServiceClarificationCandidates(messageNorm: string, services: ServiceLite[]) {
  const explicitMatches = services.filter((s) => {
    const n = norm(s.name);
    return n.length > 0 && messageNorm.includes(n);
  });
  if (explicitMatches.length > 1) return explicitMatches;

  const roots = extractServiceTopicRoots(messageNorm);
  if (!roots.length) return [];

  return services.filter((s) => {
    const n = norm(s.name);
    return roots.some((root) => new RegExp(root, "i").test(n));
  });
}

function shouldAskServiceClarification(messageNorm: string, services: ServiceLite[]) {
  const candidates = getServiceClarificationCandidates(messageNorm, services);
  return candidates.length > 1;
}
function detectTimePreference(messageNorm: string): "morning" | "day" | "evening" | null {
  if (/(?:вечер|вечером|после\s+работы)/iu.test(messageNorm)) return "evening";
  if (/(?:утр|утром)/iu.test(messageNorm)) return "morning";
  if (/(?:днем|днём|день|после\s+обеда)/iu.test(messageNorm)) return "day";
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

function asksDateChoices(messageNorm: string) {
  return /(?:какие\s+дни|какие\s+числа|какие\s+даты|свободные\s+дни|свободные\s+числа|свободные\s+даты|по\s+датам|по\s+числам|на\s+какие\s+дни|на\s+какие\s+числа|на\s+какие\s+даты|на\s+какую\s+дату|все\s+даты|все\s+дни|все\s+числа|покажи\s+даты|покажи\s+все\s+даты|покажи\s+календарь|весь\s+календарь|календарь|ближайшие\s+даты|какие\s+ближайшие\s+даты|на\s+какую\s+дату\s+есть|на\s+какие\s+даты\s+есть|когда\s+есть)/iu.test(
    messageNorm,
  );
}

function wantsOtherDates(messageNorm: string) {
  return /(?:другое число хочу выбрать|другие\s+числа|другие\s+дни|другие\s+даты|другая\s+дата|на\s+другую\s+дату|на\s+другие\s+числа|на\s+другие\s+дни|на\s+другие\s+даты|другой\s+период|на\s+другой\s+период|на\s+какую\s+дату\s+есть|на\s+какие\s+даты\s+есть|а\s+на\s+какую\s+дату\s+есть|когда\s+есть|когда\s+есть\s+окна)/iu.test(
    messageNorm,
  );
}

function wantsOtherLocation(messageNorm: string) {
  return /(?:в\s+другом\s+филиале|другой\s+филиал|другую\s+локацию|другая\s+локация|другой\s+адрес)/iu.test(messageNorm);
}

function asksMonthScope(messageNorm: string) {
  return /(?:на\s+\p{L}+\s+(?:месяц\s+)?посмотри|про\s+\p{L}+|покажи\s+\p{L}+|что\s+по\s+\p{L}+\s+месяцу)/iu.test(messageNorm);
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
  return /(?:у\s+каких\s+маст|какие\s+маст|какой\s+мастер|какие\s+специалисты|какой\s+специалист|мастер(?:а|ы)?|специалист(?:а|ы)?)/iu.test(
    messageNorm,
  );
}

function asksAlternativeSpecialists(messageNorm: string) {
  const asksSpecialistTopic =
    asksAboutSpecialists(messageNorm) ||
    /(?:масетер|масетр|мастер|спец|кто\s+делает|кто\s+выполняет|кто\s+из\s+мастеров)/iu.test(messageNorm);
  const asksAlternativeCue = /(?:другие|другой|другого|еще|ещё|кроме|иной|а\s+кто\s+еще|а\s+кто\s+ещё|есть\s+кто)/iu.test(messageNorm);
  return asksSpecialistTopic && asksAlternativeCue;
}

function wantsEditTimeIntent(messageNorm: string) {
  return /(?:измени|изменить|смени|сменить|поменяй|поменять|другое)\s*(?:время|врем)|(?:^|\s)время\s+услуг/iu.test(
    messageNorm,
  );
}

function wantsEditSpecialistIntent(messageNorm: string) {
  return /(?:измени|изменить|смени|сменить|поменяй|поменять|друг(?:ой|ого|ому|их))\s*(?:специалист|специалистов|мастер|мастеров)|(?:^|\s)специалист\s+услуг/iu.test(
    messageNorm,
  );
}

function parseChainServiceIndexFromMessage(args: {
  messageNorm: string;
  selectedServiceIds: number[];
  selectedServices: ServiceLite[];
}): number | null {
  const { messageNorm, selectedServiceIds, selectedServices } = args;
  const idxMatch = messageNorm.match(/услуг[аи]?\s*(?:№|#)?\s*(\d{1,2})/iu);
  if (idxMatch?.[1]) {
    const idx = Number(idxMatch[1]) - 1;
    if (idx >= 0 && idx < selectedServiceIds.length) return idx;
  }

  let foundIndex: number | null = null;
  for (let i = 0; i < selectedServices.length; i += 1) {
    const service = selectedServices[i];
    const key = normalizeText(service.name);
    if (!key) continue;
    if (!messageNorm.includes(key)) continue;
    if (foundIndex != null) return null;
    foundIndex = i;
  }
  return foundIndex;
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
  if (/\b(любой|кто угодно|не важно|неважно)\b/i.test(t)) return null;

  const direct = specs.find((s) => t.includes(normalizeText(s.name)));
  if (direct) return direct;

  // Fallback by first/last name fragment from button text.
  const byToken = specs.find((s) => {
    const parts = normalizeText(s.name).split(" ").filter(Boolean);
    return parts.some((p) => p.length >= 3 && new RegExp(`\\b${p}\\b`, "i").test(t));
  });
  return byToken ?? null;
}

function autoAssignedSpecialistText(name: string, previousName?: string | null) {
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
  if (previousName && normalizeText(previousName) !== normalizeText(name)) {
    return `Вы выбрали специалиста ${previousName}, но на это время и услугу он недоступен.
На это время ${availabilityWord} только ${name}, выбрала ${pronoun} автоматически.\n\n`;
  }
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

async function findNearestDateWindows(args: {
  origin: string;
  accountSlug: string;
  locations: LocationLite[];
  fromDate: string;
  serviceId: number | null;
  preference: "morning" | "day" | "evening" | null;
  daysAhead?: number;
  limit?: number | null;
  maxDates?: number;
}) {
  const { origin, accountSlug, locations, fromDate, serviceId, preference, daysAhead = 30, limit = 30, maxDates = 5 } = args;
  const [yy, mm, dd] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 12, 0, 0));
  const results: Array<{ date: string; rows: Array<{ locationId: number; name: string; times: string[]; allTimes: string[] }> }> = [];
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
    if (!rows.length) continue;
    results.push({ date: ymd, rows });
    if (results.length >= maxDates) break;
  }
  return results;
}


async function findServiceAvailableDatesInRange(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  serviceId: number;
  fromDate: string;
  daysAhead?: number;
}) {
  const { origin, accountSlug, locationId, serviceId, fromDate, daysAhead = 60 } = args;
  const found: string[] = [];
  for (let i = 0; i < daysAhead; i += 1) {
    const ymd = addDaysYmd(fromDate, i);
    const slots = await getSlots(origin, accountSlug, locationId, serviceId, ymd);
    if (slots.length) found.push(ymd);
  }
  return found;
}async function findNextServiceDates(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  serviceId: number;
  fromDate: string;
  daysAhead?: number;
  maxDates?: number;
}) {
  const { origin, accountSlug, locationId, serviceId, fromDate, daysAhead = 30, maxDates = 5 } = args;
  const found: string[] = [];
  for (let i = 1; i <= daysAhead; i += 1) {
    const ymd = addDaysYmd(fromDate, i);
    const slots = await getSlots(origin, accountSlug, locationId, serviceId, ymd);
    if (!slots.length) continue;
    found.push(ymd);
    if (found.length >= maxDates) break;
  }
  return found;
}

async function findTimesForServiceAndSpecialist(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  serviceId: number;
  specialistId: number;
  date: string;
}) {
  const { origin, accountSlug, locationId, serviceId, specialistId, date } = args;
  const offers = await getOffers(origin, accountSlug, locationId, date);
  const times = Array.from(
    new Set(
      (offers?.times ?? [])
        .filter((slot) =>
          slot.services.some(
            (s) => s.serviceId === serviceId && Array.isArray(s.specialistIds) && s.specialistIds.includes(specialistId),
          ),
        )
        .map((slot) => slot.time),
    ),
  );
  return times.sort((a, b) => a.localeCompare(b));
}

async function findNextServiceDatesForSpecialist(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  serviceId: number;
  specialistId: number;
  fromDate: string;
  daysAhead: number;
  maxDates: number;
  includeFromDate?: boolean;
}) {
  const { origin, accountSlug, locationId, serviceId, specialistId, fromDate, daysAhead, maxDates, includeFromDate = false } = args;
  const found: string[] = [];
  const startOffset = includeFromDate ? 0 : 1;
  for (let i = startOffset; i <= daysAhead && found.length < maxDates; i += 1) {
    const ymd = addDaysYmd(fromDate, i);
    const times = await findTimesForServiceAndSpecialist({
      origin,
      accountSlug,
      locationId,
      serviceId,
      specialistId,
      date: ymd,
    });
    if (times.length) found.push(ymd);
  }
  return found;
}

type ChainPlanItem = {
  serviceId: number;
  specialistId: number;
  date: string;
  time: string;
};

function timeToMinutes(value: string | null | undefined) {
  if (!value) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesToTime(value: number) {
  const hh = Math.floor(value / 60);
  const mm = value % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function isCompleteChainPlan(
  d: DraftLike,
  selectedServiceIds: number[],
): d is DraftLike & { planJson: ChainPlanItem[]; bookingMode: "chain_multi_specialist" } {
  if (d.bookingMode !== "chain_multi_specialist") return false;
  if (!Array.isArray(d.planJson)) return false;
  if (!selectedServiceIds.length || d.planJson.length !== selectedServiceIds.length) return false;
  const itemByService = new Map<number, ChainPlanItem>();
  for (const item of d.planJson) {
    if (!item || !Number.isInteger(item.serviceId) || !Number.isInteger(item.specialistId) || !item.date || !item.time) return false;
    itemByService.set(item.serviceId, item as ChainPlanItem);
  }
  return selectedServiceIds.every((id) => itemByService.has(id));
}

async function buildAutoChainPlan(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  date: string;
  startTime: string;
  serviceIds: number[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  holdOwnerMarker?: number | null;
}) {
  const { origin, accountSlug, locationId, date, startTime, serviceIds, services, specialists, holdOwnerMarker = null } = args;
  const offers = await getOffers(origin, accountSlug, locationId, date, undefined, holdOwnerMarker ?? undefined);
  const offersByTime = new Map((offers?.times ?? []).map((slot) => [slot.time, slot]));
  const slotsCache = new Map<number, string[]>();
  const plan: ChainPlanItem[] = [];
  const startMinutes = timeToMinutes(startTime);
  if (startMinutes == null) return null;
  let cursor: number = startMinutes;

  for (const serviceId of serviceIds) {
    const service = services.find((x) => x.id === serviceId) ?? null;
    if (!service) return null;
    if (!slotsCache.has(serviceId)) {
      const slots = await getSlots(origin, accountSlug, locationId, serviceId, date, holdOwnerMarker ?? undefined);
      slotsCache.set(serviceId, slots);
    }
    const slots = slotsCache.get(serviceId) ?? [];
    const candidates = slots
      .map((time) => ({ time, minute: timeToMinutes(time) }))
      .filter((x): x is { time: string; minute: number } => x.minute != null && x.minute >= cursor);
    let selected: ChainPlanItem | null = null;
    let selectedEnd: number | null = null;

    for (const candidate of candidates) {
      const offerAtTime = offersByTime.get(candidate.time);
      const offerService = offerAtTime?.services.find((s) => s.serviceId === serviceId) ?? null;
      const specialistCandidates = (offerService?.specialistIds?.length ?? 0) > 0
        ? specialists.filter((sp) => offerService!.specialistIds!.includes(sp.id))
        : specialists.filter((sp) => sp.locationIds.includes(locationId) && (sp.serviceIds?.length ? sp.serviceIds.includes(serviceId) : true));
      for (const specialist of specialistCandidates) {
        const effective = getEffectiveServiceForSpecialist(service, specialist);
        const endMinute = candidate.minute + Number(effective.durationMin || 0);
        if (endMinute <= candidate.minute) continue;
        selected = { serviceId, specialistId: specialist.id, date, time: candidate.time };
        selectedEnd = endMinute;
        break;
      }
      if (selected) break;
    }

    if (!selected || selectedEnd == null) return null;
    plan.push(selected);
    cursor = selectedEnd;
  }

  return plan;
}

async function findValidSingleSpecialistStartTimes(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  date: string;
  serviceIds: number[];
  specialistId: number;
  services: ServiceLite[];
  specialists: SpecialistLite[];
}) {
  const { origin, accountSlug, locationId, date, serviceIds, specialistId, services, specialists } = args;
  if (!serviceIds.length) return [];
  const specialist = specialists.find((sp) => sp.id === specialistId) ?? null;
  if (!specialist) return [];

  const timesByService = new Map<number, number[]>();
  const durationsByService = new Map<number, number>();
  for (const serviceId of serviceIds) {
    const service = services.find((svc) => svc.id === serviceId) ?? null;
    if (!service) return [];
    const effective = getEffectiveServiceForSpecialist(service, specialist);
    durationsByService.set(serviceId, Number(effective.durationMin || 0));
    const times = await findTimesForServiceAndSpecialist({
      origin,
      accountSlug,
      locationId,
      serviceId,
      specialistId,
      date,
    });
    timesByService.set(
      serviceId,
      times.map((tm) => timeToMinutes(tm)).filter((tm): tm is number => tm != null).sort((a, b) => a - b),
    );
  }

  const firstServiceId = serviceIds[0]!;
  const firstTimes = timesByService.get(firstServiceId) ?? [];
  const validStarts: string[] = [];
  for (const startMinute of firstTimes) {
    let cursor = startMinute;
    let valid = true;
    for (let i = 0; i < serviceIds.length; i += 1) {
      const serviceId = serviceIds[i]!;
      const duration = durationsByService.get(serviceId) ?? 0;
      const times = timesByService.get(serviceId) ?? [];
      if (i === 0) {
        if (!times.includes(startMinute)) {
          valid = false;
          break;
        }
        cursor = startMinute + duration;
        continue;
      }
      const nextStart = times.find((tm) => tm >= cursor);
      if (nextStart == null) {
        valid = false;
        break;
      }
      cursor = nextStart + duration;
    }
    if (valid) validStarts.push(minutesToTime(startMinute));
  }
  return validStarts;
}

async function findNextDatesForSingleSpecialistServiceChain(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  specialistId: number;
  serviceIds: number[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  fromDate: string;
  daysAhead: number;
  maxDates: number;
  includeFromDate?: boolean;
}) {
  const {
    origin,
    accountSlug,
    locationId,
    specialistId,
    serviceIds,
    services,
    specialists,
    fromDate,
    daysAhead,
    maxDates,
    includeFromDate = false,
  } = args;
  const found: string[] = [];
  const startOffset = includeFromDate ? 0 : 1;
  for (let i = startOffset; i <= daysAhead && found.length < maxDates; i += 1) {
    const date = addDaysYmd(fromDate, i);
    const starts = await findValidSingleSpecialistStartTimes({
      origin,
      accountSlug,
      locationId,
      date,
      serviceIds,
      specialistId,
      services,
      specialists,
    });
    if (starts.length) found.push(date);
  }
  return found;
}

async function findValidChainStartTimesAnySpecialists(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  date: string;
  serviceIds: number[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  holdOwnerMarker?: number | null;
}) {
  const { origin, accountSlug, locationId, date, serviceIds, services, specialists, holdOwnerMarker = null } = args;
  if (!serviceIds.length) return [];
  const firstServiceId = serviceIds[0]!;
  const firstSlots = await getSlots(origin, accountSlug, locationId, firstServiceId, date, holdOwnerMarker ?? undefined);
  const validStarts: string[] = [];
  for (const startTime of firstSlots) {
    const plan = await buildAutoChainPlan({
      origin,
      accountSlug,
      locationId,
      date,
      startTime,
      serviceIds,
      services,
      specialists,
      holdOwnerMarker,
    });
    if (plan?.length === serviceIds.length) validStarts.push(startTime);
  }
  return Array.from(new Set(validStarts));
}

function orderedChainPlan(args: {
  serviceIds: number[];
  planJson: DraftLike["planJson"];
  fallbackDate: string | null;
}): ChainPlanItem[] {
  const { serviceIds, planJson, fallbackDate } = args;
  return serviceIds
    .map((serviceId) => {
      const src = Array.isArray(planJson) ? planJson.find((item) => Number(item?.serviceId) === serviceId) ?? null : null;
      return {
        serviceId,
        specialistId: Number(src?.specialistId ?? 0),
        date: String(src?.date ?? fallbackDate ?? ""),
        time: String(src?.time ?? ""),
      };
    })
    .filter((item) => item.specialistId > 0 && item.date && item.time);
}

async function reflowChainTail(args: {
  origin: string;
  accountSlug: string;
  locationId: number;
  date: string;
  serviceIds: number[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  plan: ChainPlanItem[];
  fromIndex: number;
}) {
  const { origin, accountSlug, locationId, date, serviceIds, services, specialists, plan, fromIndex } = args;
  if (!serviceIds.length || fromIndex <= 0) return plan;
  const byService = new Map<number, ChainPlanItem>(plan.map((item) => [item.serviceId, { ...item }]));
  for (let i = 0; i < fromIndex; i += 1) {
    const serviceId = serviceIds[i]!;
    if (!byService.has(serviceId)) return null;
  }

  const getEndAfter = (index: number) => {
    const serviceId = serviceIds[index]!;
    const item = byService.get(serviceId);
    if (!item) return null;
    const start = timeToMinutes(item.time);
    const service = services.find((x) => x.id === serviceId) ?? null;
    const specialist = specialists.find((x) => x.id === item.specialistId) ?? null;
    if (start == null || !service || !specialist) return null;
    const effective = getEffectiveServiceForSpecialist(service, specialist);
    return start + Number(effective.durationMin || 0);
  };

  for (let i = fromIndex; i < serviceIds.length; i += 1) {
    const serviceId = serviceIds[i]!;
    const cursor = getEndAfter(i - 1);
    if (cursor == null) return null;
    const current = byService.get(serviceId);
    if (!current || !current.specialistId) return null;
    const times = await findTimesForServiceAndSpecialist({
      origin,
      accountSlug,
      locationId,
      serviceId,
      specialistId: current.specialistId,
      date,
    });
    const next = times.find((tm) => {
      const minute = timeToMinutes(tm);
      return minute != null && minute >= cursor;
    });
    if (!next) return null;
    byService.set(serviceId, { ...current, date, time: next });
  }

  return serviceIds.map((serviceId) => byService.get(serviceId)).filter((item): item is ChainPlanItem => Boolean(item));
}
function applyChangeRollback(messageNorm: string, d: DraftLike) {
  const changeLocation = /(локац|филиал|адрес)/i.test(messageNorm);
  const changeService = /(услуг|маник|педик|стриж|гель|окраш|facial|peeling|hair)/i.test(messageNorm);
  const changeDate = /(дата|день|завтра|сегодня|числ|марта|февраля|января|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i.test(messageNorm);
  const changeTime = /(время|час|утр|вечер|днем|днём|:\d{2}|\d{1,2}[.]\d{2})/i.test(messageNorm);
  const changeSpecialist = /(мастер|специалист|к [а-яa-z]+$)/i.test(messageNorm);

  if (changeLocation) {
    d.locationId = null;
    d.time = null;
    d.specialistId = null;
  }
  if (changeService) {
    d.serviceId = null;
    d.serviceIds = [];
    d.planJson = [];
    d.bookingMode = null;
    d.time = null;
    d.specialistId = null;
  }
  if (changeDate) {
    d.date = null;
    d.time = null;
  }
  if (changeTime) {
    d.time = null;
  }
  if (changeSpecialist) {
    d.specialistId = null;
    d.time = null;
  }

  d.mode = null;
  d.consentConfirmedAt = null;
}

function normalizeDraftServiceIds(d: DraftLike) {
  const serviceIds = Array.from(
    new Set<number>([
      ...(Array.isArray(d.serviceIds) ? d.serviceIds : []),
      ...(d.serviceId ? [Number(d.serviceId)] : []),
    ]),
  ).filter((id) => Number.isInteger(id) && id > 0);
  d.serviceIds = serviceIds;
  d.serviceId = serviceIds[0] ?? null;
  return serviceIds;
}

function clearDraftServices(d: DraftLike) {
  d.serviceId = null;
  d.serviceIds = [];
  d.planJson = [];
  d.bookingMode = null;
}

function specialistMatchesCurrentDraft(args: {
  specialistId: number | null;
  locationId: number | null;
  serviceId: number | null;
  specialists: SpecialistLite[];
}) {
  const { specialistId, locationId, serviceId, specialists } = args;
  if (!specialistId) return false;
  const specialist = specialists.find((s) => s.id === specialistId);
  if (!specialist) return false;
  if (locationId && !specialist.locationIds.includes(locationId)) return false;
  if (serviceId && specialist.serviceIds?.length && !specialist.serviceIds.includes(serviceId)) return false;
  return true;
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
    previouslySelectedSpecialistName,
    requiredVersionIds,
    request,
    choice,
    publicSlug,
    todayYmd,
    preferredClientId = null,
    holdOwnerMarker = null,
  } = ctx;
  const selectedServiceIds = normalizeDraftServiceIds(d);
  if (selectedServiceIds.length <= 1) {
    d.bookingMode = null;
    d.planJson = [];
  } else if (Array.isArray(d.planJson) && d.planJson.length) {
    d.planJson = d.planJson
      .filter((item) => selectedServiceIds.includes(Number((item as { serviceId?: unknown })?.serviceId)))
      .map((item) => ({
        serviceId: Number((item as { serviceId?: unknown })?.serviceId),
        specialistId: Number((item as { specialistId?: unknown })?.specialistId),
        date: String((item as { date?: unknown })?.date ?? d.date ?? ""),
        time: String((item as { time?: unknown })?.time ?? ""),
      }));
  }
  const hasContext = Boolean(
    d.locationId || selectedServiceIds.length > 0 || d.specialistId || d.date || d.time || d.mode
  );
  if (!bookingIntent && !hasContext && d.status !== "COMPLETED") return { handled: false };

  const wantsSelfCheckout = /(?:^|\s)самостоятельно(?:\s|$)/iu.test(messageNorm);
  const wantsAssistantCheckout = /оформи\s+через\s+ассистента|через\s+ассистента/iu.test(messageNorm);
  if (wantsSelfCheckout) {
    d.mode = "SELF";
  } else if (wantsAssistantCheckout) {
    d.mode = "ASSISTANT";
  }
  if (d.mode === "SELF" && d.locationId && selectedServiceIds.length === 1) {
    return {
      handled: true,
      nextStatus: "READY_SELF",
      nextAction: { type: "open_booking", bookingUrl: bookingUrl(publicSlug, d) },
      reply: "Открываю онлайн-запись с подставленными параметрами.",
    };
  }

  let scopedServicesForFlow = services;
  const scopedLocationId = d.locationId;
  if (typeof scopedLocationId === "number") {
    scopedServicesForFlow = services.filter((x) => x.locationIds.includes(scopedLocationId));
  }
  const selectedServiceCategoryFilter = parseServiceCategoryFilter(messageNorm, scopedServicesForFlow);

  const monthOnlyDate = extractMonthOnlyDate(messageNorm, todayYmd);
  const hasConcreteDate = hasConcreteDateMention(messageNorm);
  const asksDateList = asksDateChoices(messageNorm);
  const asksAnotherDate = wantsOtherDates(messageNorm);
  const asksLocationSwitch = wantsOtherLocation(messageNorm);

  if (asksLocationSwitch && hasContext && locations.length > 1) {
    d.locationId = null;
    d.specialistId = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
    return {
      handled: true,
      reply: "Выберите филиал, и продолжу запись.",
      nextStatus: "COLLECTING",
      ui: { kind: "quick_replies", options: locations.map((x) => optionFromLabel(x.name)) },
    };
  }

  // Parse date intent as early as possible so phrases like
  // "запиши меня сегодня" affect the entire booking path.
  const requestedDateFromMessage = parseDateFromBookingMessage(messageNorm, todayYmd);
  const parsedDate = requestedDateFromMessage;
  if (parsedDate) {
    const shouldResetDependent = parsedDate !== d.date || hasConcreteDate || Boolean(monthOnlyDate);
    d.date = parsedDate;
    if (shouldResetDependent) {
      d.time = null;
      if (
        d.specialistId &&
        !specialistMatchesCurrentDraft({
          specialistId: d.specialistId,
          locationId: d.locationId,
          serviceId: d.serviceId,
          specialists,
        })
      ) {
        d.specialistId = null;
      }
      d.mode = null;
      d.consentConfirmedAt = null;
    }
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
  const asksMonth = asksMonthScope(messageNorm);
  const isFuzzyMonthAvailability = Boolean(monthOnlyDate) && !hasConcreteDate && (asksAvailability || asksDateList || asksMonth);
  if (isFuzzyMonthAvailability && monthOnlyDate) {
    d.date = monthOnlyDate;
    d.time = null;
    if (
      d.specialistId &&
      !specialistMatchesCurrentDraft({
        specialistId: d.specialistId,
        locationId: d.locationId,
        serviceId: d.serviceId,
        specialists,
      })
    ) {
      d.specialistId = null;
    }
    d.mode = null;
    d.consentConfirmedAt = null;
    const minDate = monthOnlyDate < todayYmd ? todayYmd : monthOnlyDate;
    const maxDate = endOfMonthYmd(monthOnlyDate);
    const daysAhead = Math.max(1, dateDistanceDays(minDate, maxDate) + 1);
    const monthAvailable = await findNearestDateWindows({
      origin,
      accountSlug: account.slug,
      locations,
      fromDate: minDate,
      serviceId: d.serviceId ?? null,
      preference: detectTimePreference(messageNorm),
      daysAhead,
      maxDates: daysAhead,
      limit: 24,
    });
    const availableDates = monthAvailable.map((x) => x.date);
    return {
      handled: true,
      reply: `Выберите дату в календаре, и я сразу покажу свободное время${d.locationId ? " в выбранном филиале" : ""}.`,
      nextStatus: "COLLECTING",
      ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates },
    };
  }

  if ((asksDateList || asksAnotherDate) && d.locationId && d.serviceId) {
    const previousDate = d.date;
    const rangeStart = monthOnlyDate ? monthOnlyDate : d.date ? addDaysYmd(d.date, 1) : todayYmd;
    const rangeEnd = monthOnlyDate ? endOfMonthYmd(monthOnlyDate) : addDaysYmd(rangeStart, 45);
    const daysAhead = Math.max(1, dateDistanceDays(rangeStart, rangeEnd) + 1);
    let availableDates = d.specialistId
      ? await findNextServiceDatesForSpecialist({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: d.serviceId,
          specialistId: d.specialistId,
          fromDate: rangeStart,
          daysAhead,
          maxDates: daysAhead,
        })
      : await findServiceAvailableDatesInRange({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: d.serviceId,
          fromDate: rangeStart,
          daysAhead,
        });
    const minDate = previousDate && previousDate >= todayYmd ? previousDate : rangeStart;
    if (previousDate && previousDate >= minDate && previousDate <= rangeEnd && !availableDates.includes(previousDate)) {
      availableDates = [previousDate, ...availableDates];
    }
    d.date = null;
    d.time = null;
    if (
      d.specialistId &&
      !specialistMatchesCurrentDraft({
        specialistId: d.specialistId,
        locationId: d.locationId,
        serviceId: d.serviceId,
        specialists,
      })
    ) {
      d.specialistId = null;
    }
    d.mode = null;
    d.consentConfirmedAt = null;
    return {
      handled: true,
      reply: "Выберите дату в календаре, и я сразу покажу свободное время в выбранном филиале.",
      nextStatus: "COLLECTING",
      ui: { kind: "date_picker", minDate, maxDate: rangeEnd, initialDate: previousDate ?? minDate, availableDates },
    };
  }

  if ((asksDateList || asksAnotherDate) && d.locationId && !d.serviceId) {
    const previousDate = d.date;
    const rangeStart = monthOnlyDate ? monthOnlyDate : d.date ? addDaysYmd(d.date, 1) : todayYmd;
    const rangeEnd = monthOnlyDate ? endOfMonthYmd(monthOnlyDate) : addDaysYmd(rangeStart, 60);
    const daysAhead = Math.max(1, dateDistanceDays(rangeStart, rangeEnd) + 1);
    const nearestDates = await findNearestDateWindows({
      origin,
      accountSlug: account.slug,
      locations: locations.filter((x) => x.id === d.locationId),
      fromDate: rangeStart,
      serviceId: null,
      preference: detectTimePreference(messageNorm),
      daysAhead,
      maxDates: daysAhead,
      limit: 24,
    });
    let availableDates = nearestDates.map((x) => x.date);
    const minDate = previousDate && previousDate >= todayYmd ? previousDate : rangeStart;
    if (previousDate && previousDate >= minDate && previousDate <= rangeEnd && !availableDates.includes(previousDate)) {
      availableDates = [previousDate, ...availableDates];
    }
    d.date = null;
    d.time = null;
    if (
      d.specialistId &&
      !specialistMatchesCurrentDraft({
        specialistId: d.specialistId,
        locationId: d.locationId,
        serviceId: d.serviceId,
        specialists,
      })
    ) {
      d.specialistId = null;
    }
    d.mode = null;
    d.consentConfirmedAt = null;
    return {
      handled: true,
      reply: "Показываю даты в календаре по выбранному филиалу. Выберите удобную дату.",
      nextStatus: "COLLECTING",
      ui: {
        kind: "date_picker",
        minDate,
        maxDate: rangeEnd,
        initialDate: previousDate ?? minDate,
        availableDates: availableDates.length ? availableDates : null,
      },
    };
  }

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
      clearDraftServices(d);
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
    clearDraftServices(d);
    d.specialistId = null;
    d.date = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
  }

  const explicitEditIntent = wantsEditTimeIntent(messageNorm) || wantsEditSpecialistIntent(messageNorm);
  if (wantsChange(messageNorm) && !explicitEditIntent && hasContext && d.status !== "COMPLETED") {
    applyChangeRollback(messageNorm, d);
    nextStatus = "COLLECTING";
  }
  if (wantsStopBooking(messageNorm) && hasContext && d.status !== "COMPLETED") {
    d.locationId = null;
    clearDraftServices(d);
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

  if (d.locationId && d.serviceId && d.date && d.time && d.specialistId) nextStatus = "CHECKING";

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
    if (asksAvailability || d.serviceId) {
      let targetDate = d.date ?? todayYmd;
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
            const offers = await getOffers(origin, account.slug, d.locationId!, targetDate, undefined, holdOwnerMarker ?? undefined);
            const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
            // At "choose service after selecting time" step, trust offer matrix for that slot.
            // Extra strict per-service recheck here caused false negatives vs online booking.
            const serviceIds = (offerAtTime?.services ?? [])
              .filter((svc) => !d.specialistId || (svc.specialistIds?.length ?? 0) === 0 || svc.specialistIds?.includes(d.specialistId) === true)
              .map((x) => x.serviceId);
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
            .map((x) => serviceOption(x, specialists.find((sp) => sp.id === d.specialistId) ?? null)),
                },
              };
            }
          }
          if (d.serviceId) {
            const offers = await getOffers(origin, account.slug, d.locationId!, targetDate, undefined, holdOwnerMarker ?? undefined);
            const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
            const serviceIds = (offerAtTime?.services ?? [])
              .filter((svc) => !d.specialistId || (svc.specialistIds?.length ?? 0) === 0 || svc.specialistIds?.includes(d.specialistId) === true)
              .map((x) => x.serviceId);
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
          const requestedDateRu = requestedDateFromMessage ? formatYmdRu(requestedDateFromMessage) : null;
          const datePrefix =
            requestedDateRu && requestedDateFromMessage !== targetDate
              ? `На ${requestedDateRu} свободных окон не нашла. Ближайшее время `
              : "По вашему запросу доступно свободное время ";
          return {
            handled: true,
            reply: `${datePrefix}на ${targetDateRu}${prefText} в филиале ${onlyLocation.name}. Выберите время ниже.`,
            nextStatus: "COLLECTING",
            ui: {
              kind: "quick_replies",
              options: buildTimeOptionsWithControls(onlyLocation.times, 24),
            },
          };
        }
        const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
        const requestedDateRu = requestedDateFromMessage ? formatYmdRu(requestedDateFromMessage) : null;
        const datePrefix =
          requestedDateRu && requestedDateFromMessage !== targetDate
            ? `На ${requestedDateRu} свободных окон не нашла. Ближайшее время `
            : "Нашла свободное время ";
        return {
          handled: true,
          reply: `${datePrefix}на ${targetDateRu}${prefText} в филиалах. Выберите филиал кнопкой ниже или напишите время и филиал сообщением.`,
          nextStatus: "COLLECTING",
          ui: {
            kind: "quick_replies",
            options: rows.map((x) => optionFromLabel(x.name)),
          },
        };
      }
      if (requestedDateFromMessage && requestedDateFromMessage === targetDate) {
        const requestedDateRu = formatYmdRu(requestedDateFromMessage);
        const nearestDates = await findNearestDateWindows({
          origin,
          accountSlug: account.slug,
          locations,
          fromDate: targetDate,
          serviceId: d.serviceId ?? null,
          preference: pref,
          daysAhead: wantsMonthRange ? 45 : wantsAfterRange ? 60 : 21,
          limit: timeLimit,
          maxDates: 6,
        });
        if (nearestDates.length) {
          const minDate = nearestDates[0]!.date;
          const maxDate = nearestDates[nearestDates.length - 1]!.date;
          return {
            handled: true,
            reply: `На ${requestedDateRu} свободных окон не нашла. Выберите другую дату в календаре, и я покажу доступное время.`,
            nextStatus: "COLLECTING",
            ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates: nearestDates.map((x) => x.date) },
          };
        }
      }
      const nearestDates = await findNearestDateWindows({
        origin,
        accountSlug: account.slug,
        locations,
        fromDate: targetDate,
        serviceId: d.serviceId ?? null,
        preference: pref,
        daysAhead: wantsMonthRange ? 45 : wantsAfterRange ? 60 : 21,
        limit: timeLimit,
        maxDates: 6,
      });
      if (nearestDates.length) {
        const minDate = nearestDates[0]!.date;
        const maxDate = nearestDates[nearestDates.length - 1]!.date;
        return {
          handled: true,
          reply: `На ${targetDateRu}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Выберите дату в календаре, и я покажу доступное время.`,
          nextStatus: "COLLECTING",
          ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates: nearestDates.map((x) => x.date) },
        };
      }
      if (wantsMonthRange || wantsAfterRange) {
        const minDate = addDaysYmd(targetDate, 1);
        const maxDate = addDaysYmd(targetDate, 60);
        const daysAhead = Math.max(1, dateDistanceDays(minDate, maxDate) + 1);
        const availableDates = (
          await findNearestDateWindows({
            origin,
            accountSlug: account.slug,
            locations,
            fromDate: minDate,
            serviceId: d.serviceId ?? null,
            preference: pref,
            daysAhead,
            maxDates: daysAhead,
            limit: timeLimit,
          })
        ).map((x) => x.date);
        return {
          handled: true,
          reply: `После ${targetDateRu} свободных окон по текущему графику не нашла. Выберите другую дату в календаре.`,
          nextStatus: "COLLECTING",
          ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates },
        };
      }
      const minDate = addDaysYmd(targetDate, 1);
      const maxDate = addDaysYmd(targetDate, 45);
      const daysAhead = Math.max(1, dateDistanceDays(minDate, maxDate) + 1);
      const availableDates = (
        await findNearestDateWindows({
          origin,
          accountSlug: account.slug,
          locations,
          fromDate: minDate,
          serviceId: d.serviceId ?? null,
          preference: pref,
          daysAhead,
          maxDates: daysAhead,
          limit: timeLimit,
        })
      ).map((x) => x.date);
      return {
        handled: true,
        reply: `На ${targetDateRu}${pref ? " по этому времени суток" : ""} свободных окон не нашла. Выберите другую дату в календаре.`,
        nextStatus: "COLLECTING",
        ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates },
      };
    }
    const dateContextOptions = d.date ? buildDateContextQuickOptions(d.date, locations.length) : [];
    const locationOptions = locations.map((x) => optionFromLabel(x.name));
    return {
      handled: true,
      reply: d.date
        ? `На ${formatYmdRu(d.date)} сначала выберите филиал, затем помогу продолжить запись.`
        : "Выберите филиал (локацию), и продолжу запись.",
      nextStatus: "COLLECTING",
      ui: {
        kind: "quick_replies",
        options: [...dateContextOptions, ...locationOptions],
      },
    };
  }

  const scopedServices = services.filter((x) => x.locationIds.includes(d.locationId!));

  const selectedSpecialistForSelection = d.specialistId ? specialists.find((sp) => sp.id === d.specialistId) ?? null : null;
  let servicesForSelection = selectedSpecialistForSelection
    ? scopedServices.filter((svc) => (selectedSpecialistForSelection.serviceIds?.length ? selectedSpecialistForSelection.serviceIds.includes(svc.id) : true))
    : scopedServices;
  if (d.date && !d.time) {
    const dayOffers = await getOffers(origin, account.slug, d.locationId!, d.date, undefined, holdOwnerMarker ?? undefined);
    const availableServiceIds = new Set(
      (dayOffers?.times ?? []).flatMap((slot) =>
        (slot.services ?? [])
          .filter((svc) => !d.specialistId || (svc.specialistIds?.length ?? 0) === 0 || svc.specialistIds?.includes(d.specialistId) === true)
          .map((svc) => svc.serviceId),
      ),
    );
    servicesForSelection = scopedServices.filter((svc) => availableServiceIds.has(svc.id));
  }
  const servicesForSelectionByCategory = filterServicesByCategory(servicesForSelection, selectedServiceCategoryFilter);
  if (!d.serviceId && d.specialistId && !servicesForSelection.length) {
    const selectedSpecialistName = specialists.find((x) => x.id === d.specialistId)?.name ?? "выбранный специалист";
    const alternativeSpecialists = specialists.filter((s) => {
      if (!d.locationId || !s.locationIds.includes(d.locationId)) return false;
      if (s.id === d.specialistId) return false;
      return s.serviceIds?.length ? s.serviceIds.some((id) => scopedServices.some((svc) => svc.id === id)) : true;
    });
    return {
      handled: true,
      reply: "У выбранного специалиста в этой локации нет доступных услуг. Выберите другого специалиста или смените филиал.",
      nextStatus: "COLLECTING",
      ui: alternativeSpecialists.length
        ? { kind: "quick_replies", options: alternativeSpecialists.map((x) => specialistOption(x)) }
        : null,
    };
  }
  if (!d.serviceId) {
    if (d.date && d.time) {
      const offers = await getOffers(origin, account.slug, d.locationId!, d.date, undefined, holdOwnerMarker ?? undefined);
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
      const serviceIds = offerAtTime.services
        .filter((svc) => !d.specialistId || (svc.specialistIds?.length ?? 0) === 0 || svc.specialistIds?.includes(d.specialistId) === true)
        .map((x) => x.serviceId);
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
            options: serviceSelectionActionOptions({
              servicesAll: scopedServices,
              servicesShown: filterServicesByCategory(scopedServices.filter((x) => serviceIds.includes(x.id)), selectedServiceCategoryFilter),
              selectedServiceIds: normalizeDraftServiceIds(d),
              specialist: specialists.find((sp) => sp.id === d.specialistId) ?? null,
            }),
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
            options: availableByLocation.map((x) => specialistOption(x)),
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
      const offers = await getOffers(origin, account.slug, d.locationId!, targetDate, undefined, holdOwnerMarker ?? undefined);
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
          ui: { kind: "quick_replies", options: buildTimeOptionsWithControls(times, timeLimit == null ? null : 24) },
        };
      }
      const nextDates = await findNearestDateWindows({
        origin,
        accountSlug: account.slug,
        locations: locations.filter((x) => x.id === d.locationId),
        fromDate: addDaysYmd(targetDate, 1),
        serviceId: null,
        preference: pref,
        daysAhead: 45,
        maxDates: 12,
        limit: timeLimit,
      });
      return {
        handled: true,
        reply: `На ${formatYmdRu(targetDate)}${pref ? " по этому времени суток" : ""} свободных окон, к сожалению, не нашла. Давайте выберем другую дату.`,
        nextStatus: "COLLECTING",
        ui: nextDates.length
          ? {
              kind: "date_picker",
              minDate: nextDates[0]!.date,
              maxDate: nextDates[nextDates.length - 1]!.date,
              initialDate: nextDates[0]!.date,
              availableDates: nextDates.map((x) => x.date),
            }
          : null,
      };
    }
    if (d.date && !d.time && !servicesForSelection.length) {
      const nextDates = await findNearestDateWindows({
        origin,
        accountSlug: account.slug,
        locations: locations.filter((x) => x.id === d.locationId),
        fromDate: addDaysYmd(d.date, 1),
        serviceId: null,
        preference: null,
        daysAhead: 45,
        maxDates: 10,
        limit: 24,
      });
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} по текущему графику нет доступных услуг. Выберите другую дату.`,
        nextStatus: "COLLECTING",
        ui: nextDates.length
          ? {
              kind: "date_picker",
              minDate: nextDates[0]!.date,
              maxDate: nextDates[nextDates.length - 1]!.date,
              initialDate: nextDates[0]!.date,
              availableDates: nextDates.map((x) => x.date),
            }
          : null,
      };
    }
    if (shouldAskServiceClarification(messageNorm, servicesForSelectionByCategory)) {
      const clarificationCandidates = getServiceClarificationCandidates(messageNorm, servicesForSelectionByCategory);
      const optionsSource = clarificationCandidates.length ? clarificationCandidates : servicesForSelectionByCategory;
      return {
        handled: true,
        reply: "Уточните, пожалуйста, конкретную услугу. Выберите вариант кнопкой ниже или напишите полное название.",
        nextStatus: "COLLECTING",
        ui: {
          kind: "quick_replies",
          options: serviceSelectionActionOptions({
            servicesAll: servicesForSelection,
            servicesShown: optionsSource,
            selectedServiceIds: normalizeDraftServiceIds(d),
            specialist: specialists.find((sp) => sp.id === d.specialistId) ?? null,
          }),
        },
      };
    }
    const asksServicesList = /(какие|что)\s+.*(услуг|процедур)|список\s+услуг|услуги\s+доступны/i.test(messageNorm);
    if (d.date && !d.time && asksServicesList) {
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} доступны услуги в течение дня. Выберите услугу, и затем я покажу доступное время.`,
        nextStatus: "COLLECTING",
        ui: {
          kind: "quick_replies",
          options: serviceSelectionActionOptions({
            servicesAll: servicesForSelection,
            servicesShown: servicesForSelectionByCategory,
            selectedServiceIds: normalizeDraftServiceIds(d),
            specialist: specialists.find((sp) => sp.id === d.specialistId) ?? null,
          }),
        },
      };
    }
    return {
      handled: true,
      reply: d.date && !d.time
        ? `Выберите услугу на ${formatYmdRu(d.date)} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"}, и продолжу запись.`
        : "Выберите услугу, и продолжу запись.",
      nextStatus: "COLLECTING",
      ui: {
        kind: "quick_replies",
        options: serviceSelectionActionOptions({
          servicesAll: servicesForSelection,
          servicesShown: servicesForSelectionByCategory,
          selectedServiceIds: normalizeDraftServiceIds(d),
          specialist: specialists.find((sp) => sp.id === d.specialistId) ?? null,
        }),
      },
    };
  }

  const isServiceSelectionCommand = /^(?:\s*)(?:выбрать\s+услугу|добавить\s+)/iu.test(messageNorm);
  const isDoneWithServices = /(?:^|\s)готово\s+с\s+услугами(?:\s|$)/iu.test(messageNorm);
  if (d.serviceId && isServiceSelectionCommand && !isDoneWithServices) {
    const selectedServices = selectedServiceIds
      .map((id) => services.find((s) => s.id === id) ?? null)
      .filter((s): s is ServiceLite => Boolean(s));
    const canAdd =
      selectedServices.length > 0 && selectedServices.every((service) => service.allowMultiServiceBooking !== false);
    if (canAdd) {
      const selectedSpecialistForSelection = d.specialistId
        ? specialists.find((sp) => sp.id === d.specialistId) ?? null
        : null;
      let servicesForSelection = selectedSpecialistForSelection
        ? scopedServicesForFlow.filter((svc) =>
            selectedSpecialistForSelection.serviceIds?.length ? selectedSpecialistForSelection.serviceIds.includes(svc.id) : true,
          )
        : scopedServicesForFlow;
      if (d.date && !d.time) {
        const dayOffers = await getOffers(origin, account.slug, d.locationId!, d.date, undefined, holdOwnerMarker ?? undefined);
        const availableServiceIds = new Set(
          (dayOffers?.times ?? []).flatMap((slot) =>
            (slot.services ?? [])
              .filter(
                (svc) =>
                  !d.specialistId ||
                  (svc.specialistIds?.length ?? 0) === 0 ||
                  svc.specialistIds?.includes(d.specialistId) === true,
              )
              .map((svc) => svc.serviceId),
          ),
        );
        servicesForSelection = scopedServicesForFlow.filter((svc) => availableServiceIds.has(svc.id));
      }
      if (d.date && d.time) {
        const offers = await getOffers(origin, account.slug, d.locationId!, d.date, undefined, holdOwnerMarker ?? undefined);
        const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
        if (offerAtTime?.services?.length) {
          const serviceIds = offerAtTime.services
            .filter(
              (svc) =>
                !d.specialistId ||
                (svc.specialistIds?.length ?? 0) === 0 ||
                svc.specialistIds?.includes(d.specialistId) === true,
            )
            .map((x) => x.serviceId);
          servicesForSelection = scopedServicesForFlow.filter((svc) => serviceIds.includes(svc.id));
        }
      }
      return {
        handled: true,
        reply: "Услуга добавлена. Хотите добавить ещё? Выберите услугу для добавления или нажмите «Продолжить запись».",
        nextStatus: "COLLECTING",
        ui: {
          kind: "quick_replies",
          options: serviceSelectionActionOptions({
            servicesAll: scopedServicesForFlow,
            servicesShown: filterServicesByCategory(servicesForSelection, selectedServiceCategoryFilter),
            selectedServiceIds,
            specialist: selectedSpecialistForSelection,
          }),
        },
      };
    }
  }

  if (!d.date) {
    // Only default to today when user asked for today explicitly;
    // otherwise ask to choose date to avoid silent auto-selection.
    const explicitTodayRequest = /(?:^|\s)(сегодня|today)(?:\s|$)/iu.test(messageNorm);
    if (bookingIntent && d.locationId && d.serviceId && explicitTodayRequest) {
      d.date = todayYmd;
    }
    if (!d.date) {
      const minDate = todayYmd;
      const maxDate = addDaysYmd(todayYmd, 60);
      const availableDates = d.locationId && d.serviceId
        ? d.specialistId
          ? await findNextServiceDatesForSpecialist({
              origin,
              accountSlug: account.slug,
              locationId: d.locationId,
              serviceId: d.serviceId,
              specialistId: d.specialistId,
              fromDate: minDate,
              daysAhead: 61,
              maxDates: 61,
              includeFromDate: true,
            })
          : await findServiceAvailableDatesInRange({
              origin,
              accountSlug: account.slug,
              locationId: d.locationId,
              serviceId: d.serviceId,
              fromDate: minDate,
              daysAhead: 61,
            })
        : (
            await findNearestDateWindows({
              origin,
              accountSlug: account.slug,
              locations,
              fromDate: minDate,
              serviceId: d.serviceId ?? null,
              preference: null,
              daysAhead: 61,
              maxDates: 61,
              limit: 24,
            })
          ).map((x) => x.date);
      const anyDateRequested = /(?:любая\s+дата|любой\s+день|не\s+важно\s+когда|неважно\s+когда)/iu.test(messageNorm);
      if (anyDateRequested && availableDates.length) {
        d.date = availableDates[0]!;
        d.mode = null;
        d.consentConfirmedAt = null;
      }
      if (!d.date) {
        return {
          handled: true,
          reply: "Выберите дату в календаре или напишите её сообщением.",
          nextStatus: "COLLECTING",
          ui: { kind: "date_picker", minDate, maxDate, initialDate: minDate, availableDates },
        };
      }
    }
  }

  if (!d.time) {
    const pref = detectTimePreference(messageNorm);
    const specialistSelected = Boolean(d.specialistId);
    const selectedServiceIdsForTime = selectedServiceIds.length ? selectedServiceIds : d.serviceId ? [d.serviceId] : [];
    const allTimes = specialistSelected
      ? selectedServiceIdsForTime.length > 1
        ? await findValidSingleSpecialistStartTimes({
            origin,
            accountSlug: account.slug,
            locationId: d.locationId,
            date: d.date,
            serviceIds: selectedServiceIdsForTime,
            specialistId: d.specialistId!,
            services,
            specialists,
          })
        : await findTimesForServiceAndSpecialist({
            origin,
            accountSlug: account.slug,
            locationId: d.locationId,
            serviceId: d.serviceId,
            specialistId: d.specialistId!,
            date: d.date,
          })
      : selectedServiceIdsForTime.length > 1
        ? await findValidChainStartTimesAnySpecialists({
            origin,
            accountSlug: account.slug,
            locationId: d.locationId,
            date: d.date,
            serviceIds: selectedServiceIdsForTime,
            services,
            specialists,
            holdOwnerMarker,
          })
        : await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date, holdOwnerMarker ?? undefined);
    const times = filterByPreference(allTimes, pref);
    if (!times.length) {
      const nextDates = specialistSelected
        ? selectedServiceIdsForTime.length > 1
          ? await findNextDatesForSingleSpecialistServiceChain({
              origin,
              accountSlug: account.slug,
              locationId: d.locationId!,
              specialistId: d.specialistId!,
              serviceIds: selectedServiceIdsForTime,
              services,
              specialists,
              fromDate: d.date,
              daysAhead: 35,
              maxDates: 6,
            })
          : await findNextServiceDatesForSpecialist({
              origin,
              accountSlug: account.slug,
              locationId: d.locationId!,
              serviceId: d.serviceId!,
              specialistId: d.specialistId!,
              fromDate: d.date,
              daysAhead: 35,
              maxDates: 6,
            })
        : await findNextServiceDates({
            origin,
            accountSlug: account.slug,
            locationId: d.locationId!,
            serviceId: d.serviceId!,
            fromDate: d.date,
            daysAhead: 35,
            maxDates: 6,
          });
      return {
        handled: true,
        reply: nextDates.length
          ? specialistSelected
            ? `На ${formatYmdRu(d.date)} свободных окон по этой услуге у выбранного специалиста не нашла. Выберите другую дату в календаре.`
            : `На ${formatYmdRu(d.date)} свободных окон по этой услуге не нашла. Выберите другую дату в календаре.`
          : specialistSelected
          ? `На ${formatYmdRu(d.date)} свободных окон по этой услуге у выбранного специалиста не нашла. Укажите другую дату.`
          : `На ${formatYmdRu(d.date)} свободных окон по этой услуге не нашла. Укажите другую дату.`,
        nextStatus: "COLLECTING",
        ui: nextDates.length
          ? {
              kind: "date_picker",
              minDate: nextDates[0]!,
              maxDate: nextDates[nextDates.length - 1]!,
              initialDate: nextDates[0]!,
              availableDates: nextDates,
            }
          : null,
      };
    }
    const anyTimeRequested = /(?:любое\s+время|не\s+важно\s+время|неважно\s+время)/iu.test(messageNorm);
    if (anyTimeRequested && times.length) {
      d.time = times[0]!;
      d.mode = null;
      d.consentConfirmedAt = null;
    } else {
      const prefText = pref === "evening" ? " на вечер" : pref === "morning" ? " на утро" : pref === "day" ? " на день" : "";
      return {
        handled: true,
        reply: specialistSelected
          ? `На ${formatYmdRu(d.date)}${prefText} у выбранного специалиста доступны времена. Выберите время.`
          : `На ${formatYmdRu(d.date)}${prefText} доступны времена. Выберите время.`,
        nextStatus: "COLLECTING",
        ui: { kind: "quick_replies", options: buildTimeOptionsWithControls(times, null) },
      };
    }
  }
  if (!d.specialistId) {
    const selectedServiceIdsForBooking = selectedServiceIds.length
      ? selectedServiceIds
      : d.serviceId
        ? [d.serviceId]
        : [];
    const hasCompletePlan =
      Array.isArray(d.planJson) &&
      selectedServiceIdsForBooking.length > 1 &&
      d.planJson.length === selectedServiceIdsForBooking.length &&
      d.planJson.every(
        (item) =>
          Number.isInteger(item?.serviceId) &&
          selectedServiceIdsForBooking.includes(item.serviceId) &&
          Number.isInteger(item?.specialistId) &&
          item.specialistId! > 0 &&
          typeof item?.date === "string" &&
          item.date.length > 0 &&
          typeof item?.time === "string" &&
          item.time.length > 0,
      );
    if (hasCompletePlan) {
      if (wantsSelfCheckout) {
        d.mode = "SELF";
      } else if (wantsAssistantCheckout) {
        d.mode = "ASSISTANT";
        d.consentConfirmedAt = null;
      }
    }
    if (!hasCompletePlan) {
    const offers = await getOffers(origin, account.slug, d.locationId!, d.date!, undefined, holdOwnerMarker ?? undefined);
    const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
    const servicesAtTime = offerAtTime?.services ?? [];
    let specs = specialists.filter((s) => s.locationIds.includes(d.locationId!));
    for (const serviceId of selectedServiceIdsForBooking) {
      const offerService = servicesAtTime.find((s) => s.serviceId === serviceId) ?? null;
      if (!offerService) {
        specs = [];
        break;
      }
      specs = specs.filter((sp) => (sp.serviceIds?.length ? sp.serviceIds.includes(serviceId) : true));
      if (offerService.specialistIds?.length) {
        const allowed = new Set(offerService.specialistIds);
        specs = specs.filter((sp) => allowed.has(sp.id));
      }
    }
    if (selectedServiceIdsForBooking.length > 1 && d.time) {
      const viableSpecs: SpecialistLite[] = [];
      for (const specialist of specs) {
        const starts = await findValidSingleSpecialistStartTimes({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId!,
          date: d.date!,
          serviceIds: selectedServiceIdsForBooking,
          specialistId: specialist.id,
          services,
          specialists,
        });
        if (starts.includes(d.time)) viableSpecs.push(specialist);
      }
      specs = viableSpecs;
    }
    if (!specs.length) {
      if (selectedServiceIdsForBooking.length === 1) {
        specs = await specialistsForSlot(origin, account.slug, d, specialists);
      }
    }
    if (!specs.length) {
      if (selectedServiceIdsForBooking.length > 1 && d.locationId && d.date && d.time) {
        const chainPlan = await buildAutoChainPlan({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          date: d.date,
          startTime: d.time,
          serviceIds: selectedServiceIdsForBooking,
          services,
          specialists,
          holdOwnerMarker,
        });
        if (chainPlan?.length) {
          d.bookingMode = "chain_multi_specialist";
          d.planJson = chainPlan;
          d.specialistId = null;
          d.mode = null;
          d.consentConfirmedAt = null;
          const planSummary = bookingSummary(d, locations, services, specialists);
          if (!wantsSelfCheckout && !wantsAssistantCheckout) {
            return {
              handled: true,
              reply:
                "Одним специалистом это время закрыть нельзя. Составила план визита по услугам с разными специалистами.\n\n" +
                `План визита:\n${planSummary}\n\n` +
                "Проверьте и выберите формат оформления.",
              nextStatus: "CHECKING",
              ui: {
                kind: "quick_replies",
                options: [
                  optionFromLabel("Изменить время", "изменить время"),
                  optionFromLabel("Изменить специалистов", "изменить специалистов"),
                  optionFromLabel("Самостоятельно", "самостоятельно"),
                  optionFromLabel("Через ассистента", "оформи через ассистента"),
                ],
              },
            };
          }
          if (wantsSelfCheckout) {
            d.mode = "SELF";
          } else if (wantsAssistantCheckout) {
            d.mode = "ASSISTANT";
          }
        }
      }
      const skipComboFallback =
        Array.isArray(d.planJson) &&
        d.planJson.length > 0 &&
        (wantsSelfCheckout || wantsAssistantCheckout);
      if (skipComboFallback) {
        // дальше обработаем выбранный режим без повторного запроса времени
      } else {
      const offerTimesForService = Array.from(
        new Set(
          (offers?.times ?? [])
            .filter((t) =>
              selectedServiceIdsForBooking.every((serviceId) =>
                t.services.some((s) => s.serviceId === serviceId && (s.specialistIds?.length ?? 0) > 0),
              ),
            )
            .map((t) => t.time),
        ),
      );
      const times = offerTimesForService.length
        ? offerTimesForService
        : await getSlots(origin, account.slug, d.locationId!, d.serviceId!, d.date!, holdOwnerMarker ?? undefined);
      const suggestedTimes = times.filter((tm) => tm !== d.time).slice(0, 8);
      if (times.length) {
        const serviceName = services.find((x) => x.id === d.serviceId)?.name ?? "выбранная услуга";
        const shownTimes = (suggestedTimes.length ? suggestedTimes : times.slice(0, 8)).map((tm) => optionFromLabel(tm));
        return {
          handled: true,
          reply:
            selectedServiceIdsForBooking.length > 1
              ? `На ${d.time} комбинация выбранных услуг недоступна. Выберите другое время или другой день.`
              : `На ${d.time} свободных специалистов нет. Выберите другое время или другой день.`,
          nextStatus: "COLLECTING",
          ui: { kind: "quick_replies", options: shownTimes },
        };
      }
      const nextDates = await findNextServiceDates({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId!,
        serviceId: d.serviceId!,
        fromDate: d.date!,
        daysAhead: 35,
        maxDates: 6,
      });
      return {
        handled: true,
        reply: nextDates.length
          ? `На ${formatYmdRu(d.date)} в ${d.time} свободных специалистов по выбранным услугам не нашла. Выберите другую дату.`
          : `На ${formatYmdRu(d.date)} в ${d.time} свободных специалистов по выбранным услугам не нашла. Укажите другую дату.`,
        nextStatus: "COLLECTING",
        ui: nextDates.length
          ? {
              kind: "date_picker",
              minDate: nextDates[0]!,
              maxDate: nextDates[nextDates.length - 1]!,
              initialDate: nextDates[0]!,
              availableDates: nextDates,
            }
          : null,
      };
      }
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
      const labelServices =
        selectedServiceIdsForBooking.length > 1
          ? selectedServiceIdsForBooking
              .map((id) => services.find((svc) => svc.id === id) ?? null)
              .filter((svc): svc is ServiceLite => Boolean(svc))
          : services.find((svc) => svc.id === d.serviceId) ?? null;
      return {
        handled: true,
        reply:
          selectedServiceIdsForBooking.length > 1
            ? `На ${formatYmdRu(d.date)} в ${d.time} доступны специалисты по всем выбранным услугам. Выберите специалиста кнопкой ниже.`
            : `На ${formatYmdRu(d.date)} в ${d.time} доступны специалисты. Выберите специалиста кнопкой ниже.`,
        nextStatus: "COLLECTING",
        ui: { kind: "quick_replies", options: specs.map((x) => specialistOption(x, labelServices)) },
        };
      }
    }
  }

  if (d.locationId && d.serviceId && d.date && d.time && d.specialistId) {
    const selectedServiceIdsForBooking = selectedServiceIds.length
      ? selectedServiceIds
      : d.serviceId
        ? [d.serviceId]
        : [];
    const selectedDate = d.date;
    const selectedTime = d.time;
    const offers = await getOffers(origin, account.slug, d.locationId, d.date, undefined, holdOwnerMarker ?? undefined);
    const offerAtTime = (offers?.times ?? []).find((x) => x.time === selectedTime) ?? null;
    const specialistAvailableAtSlot = selectedServiceIdsForBooking.every((serviceId) => {
      const offerService = offerAtTime?.services.find((s) => s.serviceId === serviceId) ?? null;
      if (!offerService) return false;
      return (offerService.specialistIds?.length ?? 0) === 0 || offerService.specialistIds?.includes(d.specialistId!) === true;
    });

    if (!specialistAvailableAtSlot) {
      const selectedSpecialistName = specialists.find((x) => x.id === d.specialistId)?.name ?? "выбранный специалист";
      const specialistTimes = await findTimesForServiceAndSpecialist({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId,
        serviceId: d.serviceId,
        specialistId: d.specialistId,
        date: selectedDate,
      });

      if (specialistTimes.length) {
        d.time = null;
        d.mode = null;
        d.consentConfirmedAt = null;
        return {
          handled: true,
          reply: "На " + selectedTime + " у " + selectedSpecialistName + " окно недоступно. Выберите другое время.",
          nextStatus: "COLLECTING",
          ui: { kind: "quick_replies", options: buildTimeOptionsWithControls(specialistTimes, 24) },
        };
      }

      const nextSpecialistDates = await findNextServiceDatesForSpecialist({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId,
        serviceId: d.serviceId,
        specialistId: d.specialistId,
        fromDate: selectedDate,
        daysAhead: 35,
        maxDates: 6,
      });

      if (nextSpecialistDates.length) {
        d.date = null;
        d.time = null;
        d.mode = null;
        d.consentConfirmedAt = null;
        return {
          handled: true,
          reply: "У " + selectedSpecialistName + " на " + formatYmdRu(selectedDate) + " нет свободных окон по этой услуге. Выберите другую дату.",
          nextStatus: "COLLECTING",
          ui: {
            kind: "date_picker",
            minDate: nextSpecialistDates[0]!,
            maxDate: nextSpecialistDates[nextSpecialistDates.length - 1]!,
            initialDate: nextSpecialistDates[0]!,
            availableDates: nextSpecialistDates,
          },
        };
      }

      const alternativeSpecs = specialists.filter((s) => {
        if (d.locationId && !s.locationIds.includes(d.locationId)) return false;
        if (d.serviceId && s.serviceIds?.length && !s.serviceIds.includes(d.serviceId)) return false;
        return s.id !== d.specialistId;
      });
      d.specialistId = null;
      d.time = null;
      d.mode = null;
      d.consentConfirmedAt = null;
      return {
        handled: true,
        reply: "У " + selectedSpecialistName + " нет доступных окон на выбранный слот. Выберите другого специалиста или другое время.",
        nextStatus: "COLLECTING",
        ui: alternativeSpecs.length
          ? { kind: "quick_replies", options: alternativeSpecs.map((x) => specialistOption(x, services.find((svc) => svc.id === d.serviceId) ?? null)) }
          : null,
      };
    }
  }

  const selectedServiceIdsForBooking = selectedServiceIds.length
    ? selectedServiceIds
    : d.serviceId
      ? [d.serviceId]
      : [];
  const chainPlanReady = isCompleteChainPlan(d, selectedServiceIdsForBooking);
  const wantsEditTime = wantsEditTimeIntent(messageNorm);
  const wantsEditSpecialist = wantsEditSpecialistIntent(messageNorm);
  const hasPlanForEdit = (Array.isArray(d.planJson) && d.planJson.length > 0) || chainPlanReady;
  const chainTimeSelectionMatch = messageNorm.match(/время\s+услуг[аи]?\s*(?:№|#)?\s*(\d{1,2})\s*[:\-]\s*([01]?\d|2[0-3]):([0-5]\d)/iu);
  const chainSpecialistSelectionMatch = messageNorm.match(/специалист\s+услуг[аи]?\s*(?:№|#)?\s*(\d{1,2})\s*[:\-]\s*(.+)$/iu);

  if (hasPlanForEdit && d.locationId && d.date && selectedServiceIdsForBooking.length > 1) {
    const selectedServicesForPlan = selectedServiceIdsForBooking
      .map((id) => services.find((svc) => svc.id === id) ?? null)
      .filter((svc): svc is ServiceLite => Boolean(svc));
    const planForEdit = orderedChainPlan({
      serviceIds: selectedServiceIdsForBooking,
      planJson: d.planJson,
      fallbackDate: d.date,
    });
    const serviceIndexFromMessage = parseChainServiceIndexFromMessage({
      messageNorm,
      selectedServiceIds: selectedServiceIdsForBooking,
      selectedServices: selectedServicesForPlan,
    });

    if ((wantsEditTime || wantsEditSpecialist) && serviceIndexFromMessage == null && !chainTimeSelectionMatch && !chainSpecialistSelectionMatch) {
      if (wantsEditTime) {
        return {
          handled: true,
          reply: "Для какой услуги изменить время?",
          nextStatus: "CHECKING",
          ui: {
            kind: "quick_replies",
            options: selectedServicesForPlan.map((service, index) =>
              optionFromLabel(`Услуга №${index + 1}: ${service.name}`, `изменить время услуги №${index + 1}`),
            ),
          },
        };
      }
      if (wantsEditSpecialist) {
        return {
          handled: true,
          reply: "Для какой услуги изменить специалиста?",
          nextStatus: "CHECKING",
          ui: {
            kind: "quick_replies",
            options: selectedServicesForPlan.map((service, index) =>
              optionFromLabel(`Услуга №${index + 1}: ${service.name}`, `изменить специалиста услуги №${index + 1}`),
            ),
          },
        };
      }
    }

    const buildMinStartMinute = (targetIndex: number) => {
      if (targetIndex <= 0) return 0;
      let cursor = 0;
      for (let i = 0; i < targetIndex; i += 1) {
        const item = planForEdit[i];
        const service = selectedServicesForPlan[i];
        const specialist = item ? specialists.find((sp) => sp.id === item.specialistId) ?? null : null;
        const startMinute = item ? timeToMinutes(item.time) : null;
        if (!item || !service || !specialist || startMinute == null) return null;
        const effective = getEffectiveServiceForSpecialist(service, specialist);
        cursor = startMinute + Number(effective.durationMin || 0);
      }
      return cursor;
    };

    if (wantsEditTime && serviceIndexFromMessage != null && !chainTimeSelectionMatch) {
      if (!planForEdit.length || planForEdit.length !== selectedServiceIdsForBooking.length) {
        return {
          handled: true,
          reply: "План визита пока не заполнен полностью. Сначала выберите время для первой услуги.",
          nextStatus: "COLLECTING",
        };
      }
      const targetServiceId = selectedServiceIdsForBooking[serviceIndexFromMessage]!;
      const targetItem = planForEdit[serviceIndexFromMessage]!;
      const minStartMinute = buildMinStartMinute(serviceIndexFromMessage);
      if (minStartMinute == null) {
        return {
          handled: true,
          reply: "Не хватает данных по предыдущим услугам. Сначала зафиксируйте время начала визита.",
          nextStatus: "COLLECTING",
        };
      }
      const baseTimes = targetItem.specialistId
        ? await findTimesForServiceAndSpecialist({
            origin,
            accountSlug: account.slug,
            locationId: d.locationId,
            serviceId: targetServiceId,
            specialistId: targetItem.specialistId,
            date: d.date,
          })
        : await getSlots(origin, account.slug, d.locationId, targetServiceId, d.date, holdOwnerMarker ?? undefined);
      const times = baseTimes.filter((tm) => {
        const minute = timeToMinutes(tm);
        return minute != null && minute >= minStartMinute;
      });
      if (!times.length) {
        return {
          handled: true,
          reply: "Для этой услуги после предыдущей не осталось доступного времени. Выберите другого специалиста или измените предыдущую услугу.",
          nextStatus: "CHECKING",
        };
      }
      return {
        handled: true,
        reply: `Выберите новое время для услуги №${serviceIndexFromMessage + 1}.`,
        nextStatus: "CHECKING",
        ui: {
          kind: "quick_replies",
          options: times.slice(0, 24).map((tm) => optionFromLabel(tm, `время услуги №${serviceIndexFromMessage + 1}: ${tm}`)),
        },
      };
    }

    if (chainTimeSelectionMatch?.[1] && chainTimeSelectionMatch?.[2] && chainTimeSelectionMatch?.[3]) {
      const targetIndex = Number(chainTimeSelectionMatch[1]) - 1;
      if (targetIndex >= 0 && targetIndex < selectedServiceIdsForBooking.length) {
        if (!planForEdit.length || planForEdit.length !== selectedServiceIdsForBooking.length) {
          return {
            handled: true,
            reply: "План визита пока не заполнен полностью. Сначала выберите время для первой услуги.",
            nextStatus: "COLLECTING",
          };
        }
        const nextTime = `${String(Number(chainTimeSelectionMatch[2])).padStart(2, "0")}:${chainTimeSelectionMatch[3]}`;
        const minStartMinute = buildMinStartMinute(targetIndex);
        const nextMinute = timeToMinutes(nextTime);
        if (minStartMinute == null || nextMinute == null || nextMinute < minStartMinute) {
          return {
            handled: true,
            reply: "Это время раньше окончания предыдущей услуги. Выберите более поздний слот.",
            nextStatus: "CHECKING",
          };
        }
        const targetServiceId = selectedServiceIdsForBooking[targetIndex]!;
        const targetItem = planForEdit[targetIndex]!;
        const targetSpecialistId = targetItem.specialistId;
        if (!targetSpecialistId) {
          return {
            handled: true,
            reply: "Сначала выберите специалиста для этой услуги.",
            nextStatus: "CHECKING",
          };
        }
        const allowedTimes = await findTimesForServiceAndSpecialist({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: targetServiceId,
          specialistId: targetSpecialistId,
          date: d.date,
        });
        if (!allowedTimes.includes(nextTime)) {
          return {
            handled: true,
            reply: "У выбранного специалиста это время недоступно. Выберите другой слот.",
            nextStatus: "CHECKING",
          };
        }

        const nextPlan = planForEdit.map((item) => ({ ...item }));
        nextPlan[targetIndex] = { ...nextPlan[targetIndex]!, time: nextTime, date: d.date };
        const reflowed = await reflowChainTail({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          date: d.date,
          serviceIds: selectedServiceIdsForBooking,
          services,
          specialists,
          plan: nextPlan,
          fromIndex: targetIndex + 1,
        });
        if (!reflowed) {
          return {
            handled: true,
            reply: "После этого времени не получается последовательно разместить остальные услуги. Выберите другой слот.",
            nextStatus: "CHECKING",
          };
        }
        d.bookingMode = "chain_multi_specialist";
        d.planJson = reflowed;
        d.time = reflowed[0]?.time ?? d.time;
        d.specialistId = null;
        d.mode = null;
        d.consentConfirmedAt = null;
        return {
          handled: true,
          reply: `Обновила время услуги №${targetIndex + 1}. Проверьте план визита:\n${bookingSummary(d, locations, services, specialists)}`,
          nextStatus: "CHECKING",
          ui: {
            kind: "quick_replies",
            options: [
              optionFromLabel("Изменить время", "изменить время"),
              optionFromLabel("Изменить специалиста", "изменить специалиста"),
              optionFromLabel("Самостоятельно", "самостоятельно"),
              optionFromLabel("Через ассистента", "оформи через ассистента"),
            ],
          },
        };
      }
    }

    if (wantsEditSpecialist && serviceIndexFromMessage != null && !chainSpecialistSelectionMatch) {
      const targetServiceId = selectedServiceIdsForBooking[serviceIndexFromMessage]!;
      const targetService = services.find((svc) => svc.id === targetServiceId) ?? null;
      const specs = specialists.filter((sp) => {
        if (!sp.locationIds.includes(d.locationId!)) return false;
        if (sp.serviceIds?.length && !sp.serviceIds.includes(targetServiceId)) return false;
        return true;
      });
      if (!specs.length) {
        return {
          handled: true,
          reply: "По этой услуге в выбранном филиале нет доступных специалистов.",
          nextStatus: "CHECKING",
        };
      }
      return {
        handled: true,
        reply: `Выберите специалиста для услуги №${serviceIndexFromMessage + 1}${targetService ? ` (${targetService.name})` : ""}.`,
        nextStatus: "CHECKING",
        ui: {
          kind: "quick_replies",
          options: specs.map((sp) => optionFromLabel(sp.name, `специалист услуги №${serviceIndexFromMessage + 1}: ${sp.name}`)),
        },
      };
    }

    if (chainSpecialistSelectionMatch?.[1] && chainSpecialistSelectionMatch?.[2]) {
      const targetIndex = Number(chainSpecialistSelectionMatch[1]) - 1;
      const specialistText = chainSpecialistSelectionMatch[2].trim();
      if (targetIndex >= 0 && targetIndex < selectedServiceIdsForBooking.length) {
        if (!planForEdit.length || planForEdit.length !== selectedServiceIdsForBooking.length) {
          return {
            handled: true,
            reply: "План визита пока не заполнен полностью. Сначала выберите время для первой услуги.",
            nextStatus: "COLLECTING",
          };
        }
        const targetServiceId = selectedServiceIdsForBooking[targetIndex]!;
        const allowedSpecs = specialists.filter((sp) => {
          if (!sp.locationIds.includes(d.locationId!)) return false;
          if (sp.serviceIds?.length && !sp.serviceIds.includes(targetServiceId)) return false;
          return true;
        });
        const chosen = specialistByText(specialistText, allowedSpecs);
        if (!chosen) {
          return {
            handled: true,
            reply: "Не удалось распознать специалиста. Выберите специалиста кнопкой ниже.",
            nextStatus: "CHECKING",
            ui: {
              kind: "quick_replies",
              options: allowedSpecs.map((sp) => optionFromLabel(sp.name, `специалист услуги №${targetIndex + 1}: ${sp.name}`)),
            },
          };
        }
        const minStartMinute = buildMinStartMinute(targetIndex);
        if (minStartMinute == null) {
          return {
            handled: true,
            reply: "Не хватает данных по предыдущим услугам. Сначала зафиксируйте время начала визита.",
            nextStatus: "COLLECTING",
          };
        }
        const availableTimes = await findTimesForServiceAndSpecialist({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: targetServiceId,
          specialistId: chosen.id,
          date: d.date,
        });
        const filteredTimes = availableTimes.filter((tm) => {
          const minute = timeToMinutes(tm);
          return minute != null && minute >= minStartMinute;
        });
        if (!filteredTimes.length) {
          return {
            handled: true,
            reply: "У выбранного специалиста нет доступного времени после предыдущей услуги. Выберите другого специалиста или измените время предыдущей услуги.",
            nextStatus: "CHECKING",
          };
        }
        const currentTime = planForEdit[targetIndex]?.time ?? "";
        const keepCurrent = filteredTimes.includes(currentTime) ? currentTime : filteredTimes[0]!;
        const nextPlan = planForEdit.map((item) => ({ ...item }));
        nextPlan[targetIndex] = {
          ...nextPlan[targetIndex]!,
          specialistId: chosen.id,
          date: d.date,
          time: keepCurrent,
        };
        const reflowed = await reflowChainTail({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          date: d.date,
          serviceIds: selectedServiceIdsForBooking,
          services,
          specialists,
          plan: nextPlan,
          fromIndex: targetIndex + 1,
        });
        if (!reflowed) {
          return {
            handled: true,
            reply: "После смены специалиста не получается последовательно разместить оставшиеся услуги. Попробуйте другого специалиста.",
            nextStatus: "CHECKING",
          };
        }
        d.bookingMode = "chain_multi_specialist";
        d.planJson = reflowed;
        d.time = reflowed[0]?.time ?? d.time;
        d.specialistId = null;
        d.mode = null;
        d.consentConfirmedAt = null;
        return {
          handled: true,
          reply: `Обновила специалиста для услуги №${targetIndex + 1}. Проверьте план визита:\n${bookingSummary(d, locations, services, specialists)}`,
          nextStatus: "CHECKING",
          ui: {
            kind: "quick_replies",
            options: [
              optionFromLabel("Изменить время", "изменить время"),
              optionFromLabel("Изменить специалиста", "изменить специалиста"),
              optionFromLabel("Самостоятельно", "самостоятельно"),
              optionFromLabel("Через ассистента", "оформи через ассистента"),
            ],
          },
        };
      }
    }
  }

  if (wantsEditTime && d.locationId && d.date && selectedServiceIdsForBooking.length) {
    let times: string[] = [];
    if (d.specialistId && selectedServiceIdsForBooking.length > 1) {
      times = await findValidSingleSpecialistStartTimes({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId,
        date: d.date,
        serviceIds: selectedServiceIdsForBooking,
        specialistId: d.specialistId,
        services,
        specialists,
      });
      if (!times.length) {
        const nextDates = await findNextDatesForSingleSpecialistServiceChain({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          specialistId: d.specialistId,
          serviceIds: selectedServiceIdsForBooking,
          services,
          specialists,
          fromDate: d.date,
          daysAhead: 35,
          maxDates: 6,
        });
        return {
          handled: true,
          reply: nextDates.length
            ? "У выбранного специалиста на эту дату нет последовательных слотов для всех услуг. Выберите другую дату."
            : "У выбранного специалиста нет последовательных слотов для всех услуг. Выберите другого специалиста или другую дату.",
          nextStatus: "COLLECTING",
          ui: nextDates.length
            ? {
                kind: "date_picker",
                minDate: nextDates[0]!,
                maxDate: nextDates[nextDates.length - 1]!,
                initialDate: nextDates[0]!,
                availableDates: nextDates,
              }
            : null,
        };
      }
    } else if (selectedServiceIdsForBooking.length > 1) {
      times = await findValidChainStartTimesAnySpecialists({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId,
        date: d.date,
        serviceIds: selectedServiceIdsForBooking,
        services,
        specialists,
        holdOwnerMarker,
      });
      if (!times.length) {
        const nextDates = await findNextServiceDates({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: selectedServiceIdsForBooking[0]!,
          fromDate: d.date,
          daysAhead: 35,
          maxDates: 6,
        });
        return {
          handled: true,
          reply: nextDates.length
            ? "На эту дату не получается составить последовательный план всех выбранных услуг. Выберите другую дату."
            : "Не получается составить последовательный план всех выбранных услуг. Выберите другую дату или услуги.",
          nextStatus: "COLLECTING",
          ui: nextDates.length
            ? {
                kind: "date_picker",
                minDate: nextDates[0]!,
                maxDate: nextDates[nextDates.length - 1]!,
                initialDate: nextDates[0]!,
                availableDates: nextDates,
              }
            : null,
        };
      }
    } else {
      const offers = await getOffers(origin, account.slug, d.locationId, d.date, undefined, holdOwnerMarker ?? undefined);
      times = (offers?.times ?? [])
        .filter((slot) =>
          selectedServiceIdsForBooking.every((serviceId) => {
            const offerService = slot.services.find((s) => s.serviceId === serviceId) ?? null;
            if (!offerService) return false;
            if (d.specialistId) {
              return (offerService.specialistIds?.length ?? 0) === 0 || offerService.specialistIds?.includes(d.specialistId);
            }
            return (offerService.specialistIds?.length ?? 0) > 0;
          }),
        )
        .map((slot) => slot.time);
      if (!times.length) {
        times = await getSlots(origin, account.slug, d.locationId, selectedServiceIdsForBooking[0]!, d.date, holdOwnerMarker ?? undefined);
      }
    }
    d.time = null;
    d.planJson = [];
    d.mode = null;
    d.consentConfirmedAt = null;
    return {
      handled: true,
      reply: "Выберите новое время.",
      nextStatus: "COLLECTING",
      ui: { kind: "quick_replies", options: buildTimeOptionsWithControls(times, 24) },
    };
  }

  if (wantsEditSpecialist && d.locationId && selectedServiceIdsForBooking.length) {
    let specs = specialists.filter((s) => s.locationIds.includes(d.locationId!));
    for (const serviceId of selectedServiceIdsForBooking) {
      specs = specs.filter((sp) => (sp.serviceIds?.length ? sp.serviceIds.includes(serviceId) : true));
    }
    const labelServices =
      selectedServiceIdsForBooking.length > 1
        ? selectedServiceIdsForBooking
            .map((id) => services.find((svc) => svc.id === id) ?? null)
            .filter((svc): svc is ServiceLite => Boolean(svc))
        : services.find((svc) => svc.id === d.serviceId) ?? null;
    d.specialistId = null;
    d.time = null;
    d.mode = null;
    d.consentConfirmedAt = null;
    return {
      handled: true,
      reply: specs.length ? "Выберите специалиста." : "По выбранным услугам не нашла специалистов. Выберите другие услуги.",
      nextStatus: "COLLECTING",
      ui: specs.length
        ? { kind: "quick_replies", options: specs.map((x) => specialistOption(x, labelServices)) }
        : null,
    };
  }

  if (!d.mode) {
    const selectedDate = d.date;
    const selectedTime = d.time;
    const specialistScope = specialists.filter((s) => {
      if (d.locationId && !s.locationIds.includes(d.locationId)) return false;
      if (d.serviceId && s.serviceIds?.length && !s.serviceIds.includes(d.serviceId)) return false;
      return true;
    });
    const selectedSpecialistByMessage = specialistByText(messageNorm, specialistScope);
    if (
      !chainPlanReady &&
      selectedSpecialistByMessage &&
      selectedSpecialistByMessage.id !== d.specialistId &&
      d.locationId &&
      d.serviceId &&
      d.date
    ) {
      const offers = await getOffers(origin, account.slug, d.locationId, d.date, undefined, holdOwnerMarker ?? undefined);
      const offerAtCurrentTime = selectedTime ? (offers?.times ?? []).find((x) => x.time === selectedTime) ?? null : null;
      const serviceAtCurrentTime = offerAtCurrentTime?.services.find((s) => s.serviceId === d.serviceId) ?? null;
      const selectedIsAvailableAtCurrentTime =
        !!selectedTime &&
        (!!serviceAtCurrentTime?.specialistIds?.length
          ? serviceAtCurrentTime.specialistIds.includes(selectedSpecialistByMessage.id)
          : selectedSpecialistByMessage.serviceIds.includes(d.serviceId));

      if (selectedIsAvailableAtCurrentTime) {
        d.specialistId = selectedSpecialistByMessage.id;
      } else {
        const specialistTimes = await findTimesForServiceAndSpecialist({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: d.serviceId,
          specialistId: selectedSpecialistByMessage.id,
          date: d.date,
        });
        if (specialistTimes.length) {
          d.specialistId = selectedSpecialistByMessage.id;
          d.time = null;
          d.mode = null;
          d.consentConfirmedAt = null;
          return {
            handled: true,
            reply: `У ${selectedSpecialistByMessage.name} на ${formatYmdRu(selectedDate)} доступны времена. Выберите время.`,
            nextStatus: "COLLECTING",
            ui: { kind: "quick_replies", options: buildTimeOptionsWithControls(specialistTimes, 24) },
          };
        }

        const nextSpecialistDates = await findNextServiceDatesForSpecialist({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: d.serviceId,
          specialistId: selectedSpecialistByMessage.id,
          fromDate: d.date,
          daysAhead: 35,
          maxDates: 6,
        });
        if (nextSpecialistDates.length) {
          d.specialistId = selectedSpecialistByMessage.id;
          d.date = null;
          d.time = null;
          d.mode = null;
          d.consentConfirmedAt = null;
          return {
            handled: true,
            reply: `У ${selectedSpecialistByMessage.name} на ${formatYmdRu(selectedDate)} свободных окон по этой услуге не нашла. Выберите другую дату в календаре.`,
            nextStatus: "COLLECTING",
            ui: {
              kind: "date_picker",
              minDate: nextSpecialistDates[0]!,
              maxDate: nextSpecialistDates[nextSpecialistDates.length - 1]!,
              initialDate: nextSpecialistDates[0]!,
              availableDates: nextSpecialistDates,
            },
          };
        }

        return {
          handled: true,
          reply: `У ${selectedSpecialistByMessage.name} пока нет доступных окон по этой услуге. Могу подобрать другого специалиста или услугу.`,
          nextStatus: "COLLECTING",
        };
      }
    }

    if (!chainPlanReady && d.locationId && d.serviceId && d.date && d.time && d.specialistId && asksAlternativeSpecialists(messageNorm)) {
      const offers = await getOffers(origin, account.slug, d.locationId, d.date, undefined, holdOwnerMarker ?? undefined);
      const offerAtTime = (offers?.times ?? []).find((x) => x.time === d.time) ?? null;
      const offerService = offerAtTime?.services.find((s) => s.serviceId === d.serviceId) ?? null;
      const specialistIdsAtTime = offerService?.specialistIds ?? [];
      const alternativesAtSameTime = specialists.filter((s) => specialistIdsAtTime.includes(s.id) && s.id !== d.specialistId);

      if (alternativesAtSameTime.length) {
        d.specialistId = null;
        return {
          handled: true,
          reply: `На ${formatYmdRu(d.date)} в ${d.time} по этой услуге доступны и другие специалисты. Выберите мастера кнопкой ниже.`,
          nextStatus: "CHECKING",
          ui: { kind: "quick_replies", options: alternativesAtSameTime.map((x) => specialistOption(x, services.find((svc) => svc.id === d.serviceId) ?? null)) },
        };
      }

      const timesWithOtherSpecialists = Array.from(
        new Set(
          (offers?.times ?? [])
            .filter((slot) => {
              const svc = slot.services.find((s) => s.serviceId === d.serviceId);
              if (!svc?.specialistIds?.length) return false;
              return svc.specialistIds.some((id) => id !== d.specialistId);
            })
            .map((slot) => slot.time),
        ),
      ).filter((tm) => tm !== d.time);

      if (timesWithOtherSpecialists.length) {
        const currentSpecialistName = specialists.find((x) => x.id === d.specialistId)?.name ?? "выбранный специалист";
        d.time = null;
        d.specialistId = null;
        d.mode = null;
        d.consentConfirmedAt = null;
        return {
          handled: true,
          reply: `На ${formatYmdRu(selectedDate)} в ${selectedTime} доступен только ${currentSpecialistName}. Выберите другое время, и покажу других специалистов.`,
          nextStatus: "COLLECTING",
          ui: { kind: "quick_replies", options: timesWithOtherSpecialists.slice(0, 12).map((tm) => optionFromLabel(tm)) },
        };
      }

      const nextDates = await findNextServiceDates({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId,
        serviceId: d.serviceId,
        fromDate: d.date,
        daysAhead: 35,
        maxDates: 6,
      });
      const currentSpecialistName = specialists.find((x) => x.id === d.specialistId)?.name ?? "выбранный специалист";
      if (nextDates.length) {
        d.date = null;
        d.time = null;
        d.specialistId = null;
        d.mode = null;
        d.consentConfirmedAt = null;
        return {
          handled: true,
          reply: `На ${formatYmdRu(selectedDate)} по этой услуге доступен только ${currentSpecialistName}. Выберите другую дату, и покажу варианты с другими специалистами.`,
          nextStatus: "COLLECTING",
          ui: {
            kind: "date_picker",
            minDate: nextDates[0]!,
            maxDate: nextDates[nextDates.length - 1]!,
            initialDate: nextDates[0]!,
            availableDates: nextDates,
          },
        };
      }

      return {
        handled: true,
        reply: "По этой услуге и дате на выбранное время доступен только один специалист. Могу подобрать другую дату или услугу.",
        nextStatus: "COLLECTING",
      };
    }

    const selectedServicesForBooking = selectedServiceIdsForBooking
      .map((id) => services.find((x) => x.id === id) ?? null)
      .filter((x): x is ServiceLite => Boolean(x));
    const chainRows = chainPlanReady
      ? selectedServiceIdsForBooking
          .map((serviceId) => {
            const planItem = d.planJson.find((item) => item.serviceId === serviceId) ?? null;
            const service = selectedServicesForBooking.find((x) => x.id === serviceId) ?? null;
            const specialist = specialists.find((x) => x.id === (planItem?.specialistId ?? -1)) ?? null;
            if (!planItem || !service || !specialist) return null;
            return { service, specialist, time: planItem.time, date: planItem.date, effective: getEffectiveServiceForSpecialist(service, specialist) };
          })
          .filter((x): x is { service: ServiceLite; specialist: SpecialistLite; time: string; date: string; effective: { durationMin: number; price: number } } => Boolean(x))
      : [];
    const selectedSpecialist = specialists.find((x) => x.id === d.specialistId) ?? null;
    const effectiveRows =
      chainRows.length === selectedServicesForBooking.length && chainRows.length > 0
        ? chainRows.map((row) => ({ service: row.service, effective: row.effective }))
        : selectedServicesForBooking.map((service) => ({
            service,
            effective: getEffectiveServiceForSpecialist(service, selectedSpecialist),
          }));
    const effectiveDurationTotal = effectiveRows.reduce((acc, row) => acc + Number(row.effective.durationMin || 0), 0);
    const effectivePriceTotal = effectiveRows.reduce((acc, row) => acc + Number(row.effective.price || 0), 0);
    const hasEffective = effectiveRows.length > 0;
    const effectiveText = hasEffective
      ? selectedServicesForBooking.length > 1
        ? `\nОбщая стоимость: ${Math.round(effectivePriceTotal)} ₽\nОбщая длительность: ${effectiveDurationTotal} мин`
        : `\nСтоимость: ${Math.round(effectivePriceTotal)} ₽\nДлительность: ${effectiveDurationTotal} мин`
      : "";
    const specialistAutoText = autoSelectedSpecialistName
      ? autoAssignedSpecialistText(autoSelectedSpecialistName, previouslySelectedSpecialistName)
      : "";
    const summaryOptions = [
      optionFromLabel("Самостоятельно", "самостоятельно"),
      optionFromLabel("Через ассистента", "оформи через ассистента"),
    ];
    if (selectedServiceIdsForBooking.length > 0) {
      summaryOptions.unshift(optionFromLabel("Изменить время", "изменить время"));
    }
    if (selectedServiceIdsForBooking.length > 0) {
      summaryOptions.unshift(optionFromLabel("Изменить специалиста", "изменить специалиста"));
    }
    return {
      handled: true,
      reply: `${specialistAutoText}Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}${effectiveText}\n\nКак завершим запись?`,
      nextStatus: "CHECKING",
      ui: {
        kind: "quick_replies",
        options: summaryOptions,
      },
    };
  }

  if (d.mode === "SELF" && selectedServiceIdsForBooking.length > 1 && d.locationId && d.date && !chainPlanReady) {
    if (d.specialistId && d.time) {
      const startMinute = timeToMinutes(d.time);
      const specialist = specialists.find((sp) => sp.id === d.specialistId) ?? null;
      if (startMinute != null && specialist) {
        const generatedPlan: ChainPlanItem[] = [];
        let cursor = startMinute;
        let valid = true;
        for (const serviceId of selectedServiceIdsForBooking) {
          const service = services.find((svc) => svc.id === serviceId) ?? null;
          if (!service) {
            valid = false;
            break;
          }
          const times = await findTimesForServiceAndSpecialist({
            origin,
            accountSlug: account.slug,
            locationId: d.locationId,
            serviceId,
            specialistId: specialist.id,
            date: d.date,
          });
          const picked =
            generatedPlan.length === 0 && times.includes(d.time)
              ? d.time
              : (times.find((tm) => {
                  const minute = timeToMinutes(tm);
                  return minute != null && minute >= cursor;
                }) ?? null);
          if (!picked) {
            valid = false;
            break;
          }
          generatedPlan.push({
            serviceId,
            specialistId: specialist.id,
            date: d.date,
            time: picked,
          });
          const pickedMinute = timeToMinutes(picked);
          if (pickedMinute == null) {
            valid = false;
            break;
          }
          const effective = getEffectiveServiceForSpecialist(service, specialist);
          cursor = pickedMinute + Number(effective.durationMin || 0);
        }
        if (valid && generatedPlan.length === selectedServiceIdsForBooking.length) {
          d.bookingMode = "chain_multi_specialist";
          d.planJson = generatedPlan;
          d.time = generatedPlan[0]?.time ?? d.time;
          d.specialistId = null;
        }
      }
    } else if (d.time) {
      const generatedPlan = await buildAutoChainPlan({
        origin,
        accountSlug: account.slug,
        locationId: d.locationId,
        date: d.date,
        startTime: d.time,
        serviceIds: selectedServiceIdsForBooking,
        services,
        specialists,
        holdOwnerMarker,
      });
      if (generatedPlan?.length === selectedServiceIdsForBooking.length) {
        d.bookingMode = "chain_multi_specialist";
        d.planJson = generatedPlan;
        d.time = generatedPlan[0]?.time ?? d.time;
        d.specialistId = null;
      }
    }
    const selfChainReadyAfterBuild = isCompleteChainPlan(d, selectedServiceIdsForBooking);
    if (!selfChainReadyAfterBuild) {
      d.mode = null;
      return {
        handled: true,
        reply: "Не удалось собрать корректный план визита для выбранного времени. Выберите другое время.",
        nextStatus: "COLLECTING",
      };
    }
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

  if (d.mode === "ASSISTANT" && holdOwnerMarker != null && d.locationId && d.date) {
    if (chainPlanReady) {
      for (const serviceId of selectedServiceIdsForBooking) {
        const planItem = d.planJson.find((item) => item.serviceId === serviceId) ?? null;
        const service = services.find((s) => s.id === serviceId) ?? null;
        const specialist = specialists.find((s) => s.id === (planItem?.specialistId ?? -1)) ?? null;
        if (!planItem || !service || !specialist) {
          return {
            handled: true,
            reply: "План визита заполнен не полностью. Выберите специалистов и время для всех услуг.",
            nextStatus: "COLLECTING",
          };
        }
        const effective = getEffectiveServiceForSpecialist(service, specialist);
        const holdOk = await reserveAssistantSlotHold({
          accountId: account.id,
          locationId: d.locationId,
          specialistId: specialist.id,
          date: String(planItem.date),
          time: String(planItem.time),
          durationMin: Number(effective.durationMin || 0),
          accountTz: account.timeZone,
          holdOwnerMarker,
        });
        if (!holdOk) {
          d.mode = null;
          d.consentConfirmedAt = null;
          return {
            handled: true,
            reply: `Слот для услуги «${service.name}» в ${planItem.time} уже заняли. Выберите другое время.`,
            nextStatus: "COLLECTING",
          };
        }
      }
    } else if (d.specialistId && d.time) {
      const selectedServicesForBooking = selectedServiceIdsForBooking
        .map((id) => services.find((x) => x.id === id) ?? null)
        .filter((x): x is ServiceLite => Boolean(x));
      const selectedSpecialist = specialists.find((x) => x.id === d.specialistId) ?? null;
      const effectiveDurationTotal = selectedServicesForBooking.reduce((acc, service) => {
        const effective = getEffectiveServiceForSpecialist(service, selectedSpecialist);
        return acc + Number(effective.durationMin || 0);
      }, 0);
      const holdOk = await reserveAssistantSlotHold({
        accountId: account.id,
        locationId: d.locationId,
        specialistId: d.specialistId,
        date: d.date,
        time: d.time,
        durationMin: effectiveDurationTotal,
        accountTz: account.timeZone,
        holdOwnerMarker,
      });
      if (!holdOk) {
        const times = await getSlots(origin, account.slug, d.locationId, d.serviceId!, d.date, holdOwnerMarker ?? undefined);
        d.time = null;
        d.mode = null;
        d.consentConfirmedAt = null;
        return {
          handled: true,
          reply: "Этот слот только что заняли. Выберите, пожалуйста, другое время.",
          nextStatus: "COLLECTING",
          ui: {
            kind: "quick_replies",
            options: buildTimeOptionsWithControls(times, 24),
          },
        };
      }
    }
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
          "Для оформления через ассистента нужны имя и номер телефона клиента. " +
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
    preferredClientId,
    holdOwnerMarker,
  });
  if (!created.ok) {
    if (created.code === "slot_busy") {
      const times =
        d.locationId && d.serviceId && d.date
          ? (await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date, holdOwnerMarker ?? undefined)).slice(0, 24)
          : [];
      return {
        handled: true,
        reply: "Этот слот уже занят. Выберите другое время.",
        nextStatus: "COLLECTING",
        ui: times.length ? { kind: "quick_replies", options: [optionFromLabel("Выбрать другую дату", "другое число хочу выбрать"), ...times.map((tm) => optionFromLabel(tm))] } : { kind: "quick_replies", options: [optionFromLabel("Выбрать другую дату", "другое число хочу выбрать")] },
      };
    }
    if (created.code === "outside_working_hours") {
      const times =
        d.locationId && d.serviceId && d.date
          ? (await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date, holdOwnerMarker ?? undefined)).slice(0, 24)
          : [];
      return {
        handled: true,
        reply: "Время вне графика. Выберите другой слот.",
        nextStatus: "COLLECTING",
        ui: times.length ? { kind: "quick_replies", options: [optionFromLabel("Выбрать другую дату", "другое число хочу выбрать"), ...times.map((tm) => optionFromLabel(tm))] } : { kind: "quick_replies", options: [optionFromLabel("Выбрать другую дату", "другое число хочу выбрать")] },
      };
    }
    if (created.code === "client_conflict") {
      return {
        handled: true,
        reply: "Телефон и email относятся к разным клиентам. Проверьте контактные данные.",
        nextStatus: "COLLECTING",
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








