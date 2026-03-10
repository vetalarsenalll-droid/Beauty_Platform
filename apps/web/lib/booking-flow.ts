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
  | { kind: "date_picker"; minDate: string; maxDate: string; initialDate?: string | null; availableDates?: string[] | null };

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
): ChatUiOption {
  const effective = getEffectiveServiceForSpecialist(service, specialist);
  const hasSpecialist = Boolean(specialist);
  const bounds = serviceLowerBounds(service);
  const priceText = hasSpecialist ? `${Math.round(effective.price)} ₽` : `от ${Math.round(bounds.minPrice)} ₽`;
  const durationText = hasSpecialist ? `${Math.round(effective.durationMin)} мин` : `от ${Math.round(bounds.minDuration)} мин`;
  return optionFromLabel(`${service.name} — ${priceText}, ${durationText}`, service.name);
}

function specialistOption(
  specialist: SpecialistLite,
  service: ServiceLite | null = null,
): ChatUiOption {
  const level = (specialist.levelName ?? "").trim();
  const base = level ? `${specialist.name} — ${level}` : specialist.name;
  if (!service) return optionFromLabel(base, specialist.name);
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

function serviceOptionsWithCategoryTabs(
  servicesAll: ServiceLite[],
  servicesShown: ServiceLite[],
  specialist: SpecialistLite | null = null,
): ChatUiOption[] {
  return [...serviceCategoryTabOptions(servicesAll), ...servicesShown.map((s) => serviceOption(s, specialist))];
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
    /(?:^|\s)(?:в\s+)?(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)(?:\s|$)/iu,
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
  if (d.locationId) u.searchParams.set("locationId", String(d.locationId));
  if (d.serviceId) u.searchParams.set("serviceId", String(d.serviceId));
  if (d.specialistId) u.searchParams.set("specialistId", String(d.specialistId));
  if (d.date) u.searchParams.set("date", d.date);
  if (d.time) u.searchParams.set("time", d.time);
  u.searchParams.set("scenario", "specialistFirst");
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
  const hasContext = Boolean(d.locationId || d.serviceId || d.specialistId || d.date || d.time || d.mode);
  if (!bookingIntent && !hasContext && d.status !== "COMPLETED") return { handled: false };

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
  const parsedDate = parseDateFromBookingMessage(messageNorm, todayYmd);
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
          return {
            handled: true,
            reply: `По вашему запросу доступно свободное время на ${targetDateRu}${prefText} в филиале ${onlyLocation.name}. Выберите время ниже.`,
            nextStatus: "COLLECTING",
            ui: {
              kind: "quick_replies",
              options: buildTimeOptionsWithControls(onlyLocation.times, 24),
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
  const selectedServiceCategoryFilter = parseServiceCategoryFilter(messageNorm, scopedServices);

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
          options: serviceOptionsWithCategoryTabs(scopedServices, filterServicesByCategory(scopedServices.filter((x) => serviceIds.includes(x.id)), selectedServiceCategoryFilter), specialists.find((sp) => sp.id === d.specialistId) ?? null),
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
        ui: { kind: "quick_replies", options: serviceOptionsWithCategoryTabs(servicesForSelection, optionsSource, specialists.find((sp) => sp.id === d.specialistId) ?? null) },
      };
    }
    const asksServicesList = /(какие|что)\s+.*(услуг|процедур)|список\s+услуг|услуги\s+доступны/i.test(messageNorm);
    if (d.date && !d.time && asksServicesList) {
      return {
        handled: true,
        reply: `На ${formatYmdRu(d.date)} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"} доступны услуги в течение дня. Выберите услугу, и затем я покажу доступное время.`,
        nextStatus: "COLLECTING",
        ui: { kind: "quick_replies", options: serviceOptionsWithCategoryTabs(servicesForSelection, servicesForSelectionByCategory, specialists.find((sp) => sp.id === d.specialistId) ?? null) },
      };
    }
    return {
      handled: true,
      reply: d.date && !d.time
        ? `Выберите услугу на ${formatYmdRu(d.date)} в ${locations.find((x) => x.id === d.locationId)?.name ?? "выбранной локации"}, и продолжу запись.`
        : "Выберите услугу, и продолжу запись.",
      nextStatus: "COLLECTING",
      ui: { kind: "quick_replies", options: serviceOptionsWithCategoryTabs(servicesForSelection, servicesForSelectionByCategory, specialists.find((sp) => sp.id === d.specialistId) ?? null) },
    };
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
    const allTimes = specialistSelected
      ? await findTimesForServiceAndSpecialist({
          origin,
          accountSlug: account.slug,
          locationId: d.locationId,
          serviceId: d.serviceId,
          specialistId: d.specialistId!,
          date: d.date,
        })
      : await getSlots(origin, account.slug, d.locationId, d.serviceId, d.date, holdOwnerMarker ?? undefined);
    const times = filterByPreference(allTimes, pref);
    if (!times.length) {
      const nextDates = specialistSelected
        ? await findNextServiceDatesForSpecialist({
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
    const offers = await getOffers(origin, account.slug, d.locationId!, d.date!, undefined, holdOwnerMarker ?? undefined);
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
        : await getSlots(origin, account.slug, d.locationId!, d.serviceId!, d.date!, holdOwnerMarker ?? undefined);
      const suggestedTimes = times.filter((tm) => tm !== d.time).slice(0, 8);
      if (times.length) {
        const serviceName = services.find((x) => x.id === d.serviceId)?.name ?? "выбранная услуга";
        const shownTimes = (suggestedTimes.length ? suggestedTimes : times.slice(0, 8)).map((tm) => optionFromLabel(tm));
        return {
          handled: true,
          reply:
            offerService == null
              ? `На ${d.time} услуга «${serviceName}» недоступна. Выберите другое время или другой день.`
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
          ? `На ${formatYmdRu(d.date)} в ${d.time} свободных специалистов по этой услуге не нашла. Выберите другую дату.`
          : `На ${formatYmdRu(d.date)} в ${d.time} свободных специалистов по этой услуге не нашла. Укажите другую дату.`,
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
        nextStatus: "COLLECTING",
        ui: { kind: "quick_replies", options: specs.map((x) => specialistOption(x, services.find((svc) => svc.id === d.serviceId) ?? null)) },
      };
    }
  }

  if (d.locationId && d.serviceId && d.date && d.time && d.specialistId) {
    const selectedDate = d.date;
    const selectedTime = d.time;
    const offers = await getOffers(origin, account.slug, d.locationId, d.date, undefined, holdOwnerMarker ?? undefined);
    const offerAtTime = (offers?.times ?? []).find((x) => x.time === selectedTime) ?? null;
    const offerService = offerAtTime?.services.find((s) => s.serviceId === d.serviceId) ?? null;
    const specialistAvailableAtSlot =
      !!offerService &&
      ((offerService.specialistIds?.length ?? 0) === 0 || offerService.specialistIds?.includes(d.specialistId) === true);

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

  if (!d.mode) {
    const selectedDate = d.date;
    const selectedTime = d.time;
    const specialistScope = specialists.filter((s) => {
      if (d.locationId && !s.locationIds.includes(d.locationId)) return false;
      if (d.serviceId && s.serviceIds?.length && !s.serviceIds.includes(d.serviceId)) return false;
      return true;
    });
    const selectedSpecialistByMessage = specialistByText(messageNorm, specialistScope);
    if (selectedSpecialistByMessage && selectedSpecialistByMessage.id !== d.specialistId && d.locationId && d.serviceId && d.date) {
      const offers = await getOffers(origin, account.slug, d.locationId, d.date, undefined, holdOwnerMarker ?? undefined);
      const offerAtCurrentTime = selectedTime ? (offers?.times ?? []).find((x) => x.time === selectedTime) ?? null : null;
      const serviceAtCurrentTime = offerAtCurrentTime?.services.find((s) => s.serviceId === d.serviceId) ?? null;
      const selectedIsAvailableAtCurrentTime =
        !!selectedTime &&
        !!serviceAtCurrentTime?.specialistIds?.length &&
        serviceAtCurrentTime.specialistIds.includes(selectedSpecialistByMessage.id);

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

    if (d.locationId && d.serviceId && d.date && d.time && d.specialistId && asksAlternativeSpecialists(messageNorm)) {
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

    const selectedService = services.find((x) => x.id === d.serviceId) ?? null;
    const selectedSpecialist = specialists.find((x) => x.id === d.specialistId) ?? null;
    const effective = selectedService ? getEffectiveServiceForSpecialist(selectedService, selectedSpecialist) : null;

    if (d.mode === "ASSISTANT" && holdOwnerMarker != null && d.locationId && d.specialistId && d.date && d.time && effective) {
      const holdOk = await reserveAssistantSlotHold({
        accountId: account.id,
        locationId: d.locationId,
        specialistId: d.specialistId,
        date: d.date,
        time: d.time,
        durationMin: effective.durationMin,
        accountTz: account.timeZone,
        holdOwnerMarker,
      });
      if (!holdOk) {
        const times = await getSlots(origin, account.slug, d.locationId, d.serviceId!, d.date, holdOwnerMarker ?? undefined);
        d.time = null;
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
    const effectiveText = effective ? `\nСтоимость: ${Math.round(effective.price)} ₽\nДлительность: ${effective.durationMin} мин` : "";
    const specialistAutoText = autoSelectedSpecialistName
      ? autoAssignedSpecialistText(autoSelectedSpecialistName, previouslySelectedSpecialistName)
      : "";
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








