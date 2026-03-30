import type { DraftLike } from "@/lib/booking-tools";

type Mode = "SELF" | "ASSISTANT";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const draftView = (d: {
  locationId: number | null;
  serviceId: number | null;
  serviceIds?: number[] | null;
  specialistId: number | null;
  date: string | null;
  time: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail?: string | null;
  planJson?: Array<{ serviceId: number; specialistId: number | null; date: string | null; time: string | null }> | null;
  bookingMode?: "single_specialist_multi" | "chain_multi_specialist" | null;
  mode: string | null;
  status: string;
  consentConfirmedAt: Date | null;
}): DraftLike => ({
  locationId: d.locationId,
  serviceId: d.serviceId,
  serviceIds: Array.isArray(d.serviceIds) ? d.serviceIds : [],
  specialistId: d.specialistId,
  date: d.date,
  time: d.time,
  clientName: d.clientName,
  clientPhone: d.clientPhone,
  clientEmail: d.clientEmail ?? null,
  planJson: Array.isArray(d.planJson) ? d.planJson : [],
  bookingMode: d.bookingMode ?? null,
  mode: d.mode === "SELF" || d.mode === "ASSISTANT" ? (d.mode as Mode) : null,
  status: d.status,
  consentConfirmedAt: d.consentConfirmedAt ? d.consentConfirmedAt.toISOString() : null,
});

export const toYmd = (dt: Date) => dt.toISOString().slice(0, 10);
export const addDaysYmd = (ymd: string, days: number) => {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYmd(dt);
};

export const isIsoYmd = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const pickSafeNluDate = (candidate: unknown, today: string) => {
  if (!isIsoYmd(candidate)) return null;
  // Ignore clearly stale model dates (e.g. 2023) and unrealistic far future.
  const min = addDaysYmd(today, -1);
  const max = addDaysYmd(today, 730);
  if (candidate < min || candidate > max) return null;
  return candidate;
};

const parseWeekdayDate = (t: string, today: string) => {
  const weekdayMatch = t.match(
    /(?:^|\s)(?:(?:\u0432|\u043d\u0430)\s+)?(\u043f\u043e\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u0438\u043a|\u043f\u043d|\u0432\u0442\u043e\u0440\u043d\u0438\u043a|\u0432\u0442|\u0441\u0440\u0435\u0434\u0443|\u0441\u0440\u0435\u0434\u0430|\u0441\u0440|\u0447\u0435\u0442\u0432\u0435\u0440\u0433|\u0447\u0442|\u043f\u044f\u0442\u043d\u0438\u0446\u0443|\u043f\u044f\u0442\u043d\u0438\u0446\u0430|\u043f\u0442|\u0441\u0443\u0431\u0431\u043e\u0442\u0443|\u0441\u0443\u0431\u0431\u043e\u0442\u0430|\u0441\u0431|\u0432\u043e\u0441\u043a\u0440\u0435\u0441\u0435\u043d\u044c\u0435|\u0432\u0441)(?:\s|$)/iu,
  );
  if (!weekdayMatch) return null;
  const wantsNextWeek = /\u0441\u043b\u0435\u0434\u0443\u044e\u0449/i.test(t);
  const wantsThisWeek = /(\u044d\u0442(\u043e\u0442|\u0443)|\u0431\u043b\u0438\u0436\u0430\u0439\u0448)/iu.test(t);
  const toIsoWeekday = (w: string) => {
    const x = w.toLowerCase();
    if (x.startsWith("\u043f\u043e\u043d") || x === "\u043f\u043d") return 1;
    if (x.startsWith("\u0432\u0442\u043e") || x === "\u0432\u0442") return 2;
    if (x.startsWith("\u0441\u0440\u0435") || x === "\u0441\u0440") return 3;
    if (x.startsWith("\u0447\u0435\u0442") || x === "\u0447\u0442") return 4;
    if (x.startsWith("\u043f\u044f\u0442") || x === "\u043f\u0442") return 5;
    if (x.startsWith("\u0441\u0443\u0431") || x === "\u0441\u0431") return 6;
    return 0;
  };
  const target = toIsoWeekday(weekdayMatch[1] ?? "");
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  const current = dt.getUTCDay();
  let delta = (target - current + 7) % 7;
  if (wantsNextWeek) delta = delta === 0 ? 7 : delta + 7;
  if (!wantsNextWeek && !wantsThisWeek && delta === 0) delta = 0;
  return addDaysYmd(today, delta);
};

export const parseDate = (m: string, today: string) => {
  const t = norm(m);
  const afterDm = t.match(
    /(?:^|\s)\u043f\u043e\u0441\u043b\u0435\s+(\d{1,2})\s+(\u044f\u043d\u0432\u0430\u0440\u044f|\u0444\u0435\u0432\u0440\u0430\u043b\u044f|\u043c\u0430\u0440\u0442\u0430|\u0430\u043f\u0440\u0435\u043b\u044f|\u043c\u0430\u044f|\u0438\u044e\u043d\u044f|\u0438\u044e\u043b\u044f|\u0430\u0432\u0433\u0443\u0441\u0442\u0430|\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f|\u043e\u043a\u0442\u044f\u0431\u0440\u044f|\u043d\u043e\u044f\u0431\u0440\u044f|\u0434\u0435\u043a\u0430\u0431\u0440\u044f)(?:\s|$)/u,
  );
  if (afterDm) {
    const monthMap = new Map<string, string>([
      ["\u044f\u043d\u0432\u0430\u0440\u044f", "01"],
      ["\u0444\u0435\u0432\u0440\u0430\u043b\u044f", "02"],
      ["\u043c\u0430\u0440\u0442\u0430", "03"],
      ["\u0430\u043f\u0440\u0435\u043b\u044f", "04"],
      ["\u043c\u0430\u044f", "05"],
      ["\u0438\u044e\u043d\u044f", "06"],
      ["\u0438\u044e\u043b\u044f", "07"],
      ["\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "08"],
      ["\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f", "09"],
      ["\u043e\u043a\u0442\u044f\u0431\u0440\u044f", "10"],
      ["\u043d\u043e\u044f\u0431\u0440\u044f", "11"],
      ["\u0434\u0435\u043a\u0430\u0431\u0440\u044f", "12"],
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
  if (/(?:^|\s)(\u0441\u0435\u0433\u043e\u0434\u043d\u044f|today)(?:\s|$)/u.test(t)) return today;
  if (/(?:^|\s)(\u043f\u043e\u0441\u043b\u0435\u0437\u0430\u0432\u0442\u0440\u0430|day after tomorrow)(?:\s|$)/u.test(t)) return addDaysYmd(today, 2);
  if (/(?:^|\s)(\u0437\u0430\u0432\u0442\u0440\u0430|tomorrow)(?:\s|$)/u.test(t)) return addDaysYmd(today, 1);

  const weekdayDate = parseWeekdayDate(t, today);
  if (weekdayDate) return weekdayDate;

  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmText = t.match(
    /(?:^|\s)(\d{1,2})\s+(\u044f\u043d\u0432\u0430\u0440\u044f|\u0444\u0435\u0432\u0440\u0430\u043b\u044f|\u043c\u0430\u0440\u0442\u0430|\u0430\u043f\u0440\u0435\u043b\u044f|\u043c\u0430\u044f|\u0438\u044e\u043d\u044f|\u0438\u044e\u043b\u044f|\u0430\u0432\u0433\u0443\u0441\u0442\u0430|\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f|\u043e\u043a\u0442\u044f\u0431\u0440\u044f|\u043d\u043e\u044f\u0431\u0440\u044f|\u0434\u0435\u043a\u0430\u0431\u0440\u044f)(?:\s+(\d{4}))?(?:\s|$)/u,
  );
  if (dmText) {
    const monthMap = new Map<string, string>([
      ["\u044f\u043d\u0432\u0430\u0440\u044f", "01"],
      ["\u0444\u0435\u0432\u0440\u0430\u043b\u044f", "02"],
      ["\u043c\u0430\u0440\u0442\u0430", "03"],
      ["\u0430\u043f\u0440\u0435\u043b\u044f", "04"],
      ["\u043c\u0430\u044f", "05"],
      ["\u0438\u044e\u043d\u044f", "06"],
      ["\u0438\u044e\u043b\u044f", "07"],
      ["\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "08"],
      ["\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f", "09"],
      ["\u043e\u043a\u0442\u044f\u0431\u0440\u044f", "10"],
      ["\u043d\u043e\u044f\u0431\u0440\u044f", "11"],
      ["\u0434\u0435\u043a\u0430\u0431\u0440\u044f", "12"],
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
    /(?:^|\s)(?:\u0432\s+)?(?:\u043f\u0435\u0440\u0432(?:\u044b\u0445|\u044b\u0435)\s+\u0447\u0438\u0441\u043b(?:\u0430\u0445|\u0430)\s+)?(\u044f\u043d\u0432\u0430\u0440\u0435|\u0444\u0435\u0432\u0440\u0430\u043b\u0435|\u043c\u0430\u0440\u0442\u0435|\u0430\u043f\u0440\u0435\u043b\u0435|\u043c\u0430\u0435|\u0438\u044e\u043d\u0435|\u0438\u044e\u043b\u0435|\u0430\u0432\u0433\u0443\u0441\u0442\u0435|\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u0435|\u043e\u043a\u0442\u044f\u0431\u0440\u0435|\u043d\u043e\u044f\u0431\u0440\u0435|\u0434\u0435\u043a\u0430\u0431\u0440\u0435|\u044f\u043d\u0432\u0430\u0440\u044f|\u0444\u0435\u0432\u0440\u0430\u043b\u044f|\u043c\u0430\u0440\u0442\u0430|\u0430\u043f\u0440\u0435\u043b\u044f|\u043c\u0430\u044f|\u0438\u044e\u043d\u044f|\u0438\u044e\u043b\u044f|\u0430\u0432\u0433\u0443\u0441\u0442\u0430|\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f|\u043e\u043a\u0442\u044f\u0431\u0440\u044f|\u043d\u043e\u044f\u0431\u0440\u044f|\u0434\u0435\u043a\u0430\u0431\u0440\u044f)(?:\s|$)/u,
  );
  if (monthOnly) {
    const monthMap = new Map<string, string>([
      ["\u044f\u043d\u0432\u0430\u0440\u0435", "01"],
      ["\u044f\u043d\u0432\u0430\u0440\u044f", "01"],
      ["\u0444\u0435\u0432\u0440\u0430\u043b\u0435", "02"],
      ["\u0444\u0435\u0432\u0440\u0430\u043b\u044f", "02"],
      ["\u043c\u0430\u0440\u0442\u0435", "03"],
      ["\u043c\u0430\u0440\u0442\u0430", "03"],
      ["\u0430\u043f\u0440\u0435\u043b\u0435", "04"],
      ["\u0430\u043f\u0440\u0435\u043b\u044f", "04"],
      ["\u043c\u0430\u0435", "05"],
      ["\u043c\u0430\u044f", "05"],
      ["\u0438\u044e\u043d\u0435", "06"],
      ["\u0438\u044e\u043d\u044f", "06"],
      ["\u0438\u044e\u043b\u0435", "07"],
      ["\u0438\u044e\u043b\u044f", "07"],
      ["\u0430\u0432\u0433\u0443\u0441\u0442\u0435", "08"],
      ["\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "08"],
      ["\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u0435", "09"],
      ["\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f", "09"],
      ["\u043e\u043a\u0442\u044f\u0431\u0440\u0435", "10"],
      ["\u043e\u043a\u0442\u044f\u0431\u0440\u044f", "10"],
      ["\u043d\u043e\u044f\u0431\u0440\u0435", "11"],
      ["\u043d\u043e\u044f\u0431\u0440\u044f", "11"],
      ["\u0434\u0435\u043a\u0430\u0431\u0440\u0435", "12"],
      ["\u0434\u0435\u043a\u0430\u0431\u0440\u044f", "12"],
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

export const parseTime = (m: string) => {
  const t = norm(m);
  const hhmmColon = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmmColon) return `${String(Number(hhmmColon[1])).padStart(2, "0")}:${hhmmColon[2]}`;

  const hhmmDotOrSpace = t.match(/\b([01]?\d|2[0-3])[. ]([0-5]\d)\b(?!\s*[.]\s*\d{2,4})/);
  if (hhmmDotOrSpace) {
    const hh = Number(hhmmDotOrSpace[1]);
    const mm = Number(hhmmDotOrSpace[2]);
    const maybeDateLike = hh >= 1 && hh <= 31 && mm >= 1 && mm <= 12;
    const prefix = t.slice(0, hhmmDotOrSpace.index ?? 0);
    const hasTimeCue = /(?:^|\s)(?:в|к|на|at)\s*$/iu.test(prefix) || /(?:время|час|окно|слот)/iu.test(t);
    if (!maybeDateLike || hasTimeCue) {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }

  const prepHour = t.match(/\b(?:в|к|at)\s*(\d{1,2})\b/);
  if (prepHour) {
    const n = Number(prepHour[1]);
    if (n >= 0 && n <= 23) return `${String(n).padStart(2, "0")}:00`;
  }
  return null;
};
export const parsePhone = (m: string) => {
  const candidates = m.match(/(?:\+7|8)[\d\s().-]*/g) ?? [];
  for (const candidate of candidates) {
    const d = candidate.replace(/\D/g, "");
    if (d.length !== 11) continue;
    if (d.startsWith("8")) return `+7${d.slice(1)}`;
    if (d.startsWith("7")) return `+${d}`;
  }
  return null;
};

export const parseEmail = (m: string) => {
  const match = m.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
};

export const parseName = (m: string) => {
  const explicit = m.match(/(?:меня зовут|имя)\s+([\p{L}-]{2,}(?:\s+[\p{L}-]{2,})?)/iu)?.[1];
  if (explicit) return explicit.trim();
  const inlineWithPhone = m.match(/^\s*([\p{L}-]{2,})(?:\s+([\p{L}-]{2,}))?[\s,;:]+(?:\+7|8|\d{3,})/iu);
  if (inlineWithPhone) return [inlineWithPhone[1], inlineWithPhone[2]].filter(Boolean).join(" ").trim();
  return null;
};




export const normalizeSystemTypos = (text: string) => {
  if (!text) return text;
  return text
    .replace(/\bближа[йи]щ+е[её]\b/giu, "ближайшее")
    .replace(/\bближа[йи]ш+е[её]\b/giu, "ближайшее")
    .replace(/\bближа[йи]ш+и[еи]\b/giu, "ближайшие")
    .replace(/\bзаписат[ьс]я\b/giu, "записаться")
    .replace(/\bзаписат\b/giu, "записать")
    .replace(/\bзапш[иы]\b/giu, "запиши")
    .replace(/\bокн[ао]\b/giu, "окно")
    .replace(/\bслотт?ы?\b/giu, "слоты")
    .replace(/\s{2,}/g, " ")
    .trim();
};
