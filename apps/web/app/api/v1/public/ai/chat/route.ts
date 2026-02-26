import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { runAishaNlu } from "@/lib/aisha-orchestrator";
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

type SpecialistLite = { id: number; name: string; locationIds: number[]; serviceIds: number[] };
type ServiceLite = {
  id: number;
  name: string;
  baseDurationMin: number;
  basePrice: number;
  locationIds: number[];
};
type LocationLite = { id: number; name: string; address: string | null };
const ASSISTANT_NAME = "Аиша";
const SLOT_REPLY_LIMIT = 30;
const STOP_TOKENS = new Set([
  "на",
  "в",
  "к",
  "и",
  "или",
  "по",
  "для",
  "от",
  "с",
  "у",
  "меня",
  "мне",
  "хочу",
  "запиши",
  "записаться",
  "запись",
  "please",
  "the",
  "a",
  "to",
  "of",
  "beauty",
  "salon",
]);

const asText = (v: unknown) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 1200) : "";
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
const fmtRub = (v: unknown) => `${Math.round(Number(v) || 0)} ₽`;

const toYmd = (dt: Date) => dt.toISOString().slice(0, 10);
const addDaysYmd = (ymd: string, days: number) => {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toYmd(dt);
};
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const monthDayToNearestYmd = (day: number, today: string) => {
  if (day < 1 || day > 31) return null;
  const [y, mo, d] = today.split("-").map(Number);
  for (let step = 0; step < 12; step += 1) {
    const month = ((mo - 1 + step) % 12) + 1;
    const year = y + Math.floor((mo - 1 + step) / 12);
    const dim = daysInMonth(year, month);
    if (day > dim) continue;
    const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (candidate >= today) return candidate;
  }
  return null;
};

const nextWeekdayYmd = (today: string, targetWeekday: number, forceNextWeek = false) => {
  const [y, mo, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const currentWeekday = dt.getUTCDay();
  let delta = (targetWeekday - currentWeekday + 7) % 7;
  if (delta === 0 || forceNextWeek) delta += 7;
  dt.setUTCDate(dt.getUTCDate() + delta);
  return toYmd(dt);
};

const parseDate = (m: string, today: string, options?: { allowBareDay?: boolean }) => {
  const t = norm(m);
  const allowBareDay = options?.allowBareDay ?? true;
  if (/\b(сегодня|today)\b/.test(t)) return today;
  if (/\b(послезавтра|day after tomorrow)\b/.test(t)) return addDaysYmd(today, 2);
  if (/\b(завтра|tomorrow)\b/.test(t)) {
    return addDaysYmd(today, 1);
  }

  const weekdayMap: Array<{ re: RegExp; day: number }> = [
    { re: /\b(воскресенье|вск|sunday)\b/, day: 0 },
    { re: /\b(понедельник|пн|monday)\b/, day: 1 },
    { re: /\b(вторник|вт|tuesday)\b/, day: 2 },
    { re: /\b(среда|ср|wednesday)\b/, day: 3 },
    { re: /\b(четверг|чт|thursday)\b/, day: 4 },
    { re: /\b(пятница|пт|friday)\b/, day: 5 },
    { re: /\b(суббота|субота|сб|saturday)\b/, day: 6 },
  ];
  const weekdayHit = weekdayMap.find((x) => x.re.test(t));
  if (weekdayHit) {
    const forceNext = /\b(следующ|next)\b/.test(t);
    return nextWeekdayYmd(today, weekdayHit.day, forceNext);
  }

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
  const dmText = t.match(
    /\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/,
  );
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

  if (allowBareDay) {
    const bareDay =
      t.match(/^\s*(\d{1,2})\s*$/)?.[1] ??
      t.match(/\b(?:на\s*)?(\d{1,2})(?:\s*(?:число|го|е))\b/)?.[1] ??
      null;
    if (bareDay) return monthDayToNearestYmd(Number(bareDay), today);
  }
  return null;
};

const parseTime = (m: string, allowBareHour: boolean) => {
  const t = norm(m);
  const ruHourMap: Record<string, number> = {
    "ноль": 0,
    "один": 1,
    "одна": 1,
    "одну": 1,
    "два": 2,
    "две": 2,
    "три": 3,
    "четыре": 4,
    "пять": 5,
    "шесть": 6,
    "семь": 7,
    "восемь": 8,
    "девять": 9,
    "десять": 10,
    "одиннадцать": 11,
    "двенадцать": 12,
  };
  const hhmm = t.match(/\b([01]?\d|2[0-3])[:. ]([0-5]\d)\b/);
  if (hhmm) return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;

  const withPrepCompact = t.match(/\b(?:в|к|at)\s*([01]?\d|2[0-3])([0-5]\d)\b/);
  if (withPrepCompact) return `${String(Number(withPrepCompact[1])).padStart(2, "0")}:${withPrepCompact[2]}`;

  const withPrep = t.match(/\b(?:в|к|at)\s*(\d{1,2})\b/);
  if (withPrep) {
    const n = Number(withPrep[1]);
    if (n >= 0 && n <= 23) return `${String(n).padStart(2, "0")}:00`;
  }

  const words = t.match(/\b(?:в|на|к)\s*(один|одна|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать)\s*(?:час(?:а|ов)?)?\s*(утра|дня|вечера|ночи)?\b/i);
  if (words) {
    const base = ruHourMap[words[1]!] ?? null;
    if (base != null) {
      const meridiem = words[2] ?? "";
      let hour = base;
      if (/дня|вечера/i.test(meridiem) && hour < 12) hour += 12;
      if (/ночи/i.test(meridiem) && hour === 12) hour = 0;
      if (hour >= 0 && hour <= 23) return `${String(hour).padStart(2, "0")}:00`;
    }
  }

  if (allowBareHour) {
    const bare = t.match(/^([01]?\d|2[0-3])$/);
    if (bare) return `${String(Number(bare[1])).padStart(2, "0")}:00`;
    const bareCompact = t.match(/^([01]?\d|2[0-3])([0-5]\d)$/);
    if (bareCompact) return `${String(Number(bareCompact[1])).padStart(2, "0")}:${bareCompact[2]}`;
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
const parseName = (m: string) =>
  m.match(/(?:меня зовут|имя)\s+([A-Za-zА-Яа-яЁё\-]{2,})/i)?.[1] ?? null;

const detectTimePreference = (m: string, nluPref?: string | null) => {
  if (nluPref === "morning" || nluPref === "day" || nluPref === "evening") return nluPref;
  const t = norm(m);
  if (/\b(вечер|вечером|после обеда|после работы|evening)\b/i.test(t)) return "evening";
  if (/\b(утро|утром|morning)\b/i.test(t)) return "morning";
  if (/\b(днем|днём|день|daytime)\b/i.test(t)) return "day";
  return null;
};

const filterTimesByPreference = (times: string[], preference: string | null) => {
  if (!preference) return times;
  if (preference === "evening") return times.filter((tm) => (toMinutes(tm) ?? -1) >= 17 * 60);
  if (preference === "morning") return times.filter((tm) => (toMinutes(tm) ?? 24 * 60) < 12 * 60);
  if (preference === "day") {
    return times.filter((tm) => {
      const m = toMinutes(tm) ?? -1;
      return m >= 12 * 60 && m < 17 * 60;
    });
  }
  return times;
};

const previewTimes = (times: string[], preference: string | null, max = 10) => {
  const uniqSorted = Array.from(new Set(times)).sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0));
  if (!uniqSorted.length) return uniqSorted;
  const target = Math.min(max, uniqSorted.length);
  if (preference) return filterTimesByPreference(uniqSorted, preference).slice(0, target);
  return uniqSorted.slice(0, target);
};

const parseMonthWindow = (m: string, today: string): { start: string; days: number; label: string } | null => {
  const t = norm(m);
  const monthMap: Array<{ tokens: string[]; month: number; label: string }> = [
    { tokens: ["январ", "january"], month: 1, label: "январь" },
    { tokens: ["феврал", "february"], month: 2, label: "февраль" },
    { tokens: ["март", "march"], month: 3, label: "март" },
    { tokens: ["апрел", "april"], month: 4, label: "апрель" },
    { tokens: ["май", "мая", "may"], month: 5, label: "май" },
    { tokens: ["июн", "june"], month: 6, label: "июнь" },
    { tokens: ["июл", "july"], month: 7, label: "июль" },
    { tokens: ["август", "august"], month: 8, label: "август" },
    { tokens: ["сентябр", "september"], month: 9, label: "сентябрь" },
    { tokens: ["октябр", "october"], month: 10, label: "октябрь" },
    { tokens: ["ноябр", "november"], month: 11, label: "ноябрь" },
    { tokens: ["декабр", "december"], month: 12, label: "декабрь" },
  ];
  const monthHit = monthMap.find((x) => x.tokens.some((token) => t.includes(token)));
  const hasSpecificDay = /\b([12]\d{3}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}(?:[./-](?:\d{2}|\d{4}))?)\b/.test(t);
  const monthKeywords = ["весь", "все", "какие числа", "на какие числа", "в течение", "на", "по"];
  const availabilityKeywords = ["окошк", "свобод", "время", "slot", "слот"];
  const wantsMonth =
    Boolean(monthHit) &&
    !hasSpecificDay &&
    (monthKeywords.some((x) => t.includes(x)) || availabilityKeywords.some((x) => t.includes(x)));
  if (!monthHit || !wantsMonth) return null;
  const [yy, mm] = today.split("-").map(Number);
  let year = yy;
  const yearFromText = t.match(/\b(20\d{2})\b/)?.[1];
  if (yearFromText) year = Number(yearFromText);
  else if (monthHit.month < mm) year += 1;
  const start = `${year}-${String(monthHit.month).padStart(2, "0")}-01`;
  const days = new Date(Date.UTC(year, monthHit.month, 0)).getUTCDate();
  return { start, days, label: monthHit.label };
};

const parseDayRangeRequest = (m: string): number | null => {
  const t = norm(m);
  const numMatch = t.match(/(?:^|\s)(?:на\s*)?(\d{1,2})\s*дн(?:я|ей)(?:\s|$)/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    return Number.isFinite(n) && n >= 2 && n <= 14 ? n : null;
  }
  if (t.includes("два дня")) return 2;
  if (t.includes("три дня")) return 3;
  if (t.includes("неделю") || t.includes("недели")) return 7;
  return null;
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
    threadId != null ? await prisma.aiThread.findFirst({ where: { id: threadId, accountId } }) : null;
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

async function apiData<T>(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const p = await r.json().catch(() => null);
  return r.ok ? ((p?.data ?? null) as T | null) : null;
}

async function specialistsForSlot(
  origin: string,
  accountSlug: string,
  d: Draft,
  specialists: SpecialistLite[],
) {
  if (!d.locationId || !d.serviceId || !d.date || !d.time) return [];
  const u = new URL("/api/v1/public/booking/slots", origin);
  u.searchParams.set("account", accountSlug);
  u.searchParams.set("locationId", String(d.locationId));
  u.searchParams.set("serviceId", String(d.serviceId));
  u.searchParams.set("date", String(d.date));
  const slots = await apiData<{ slots: Array<{ time: string; specialistId: number }> }>(u.toString());
  const ids = Array.from(new Set((slots?.slots ?? []).filter((x) => x.time === d.time).map((x) => x.specialistId)));
  return specialists.filter((x) => ids.includes(x.id));
}

function bookingSummary(
  d: Draft,
  locations: LocationLite[],
  services: ServiceLite[],
  specialists: SpecialistLite[],
) {
  const location = locations.find((x) => x.id === d.locationId)?.name ?? "—";
  const service = services.find((x) => x.id === d.serviceId)?.name ?? "—";
  const specialist = specialists.find((x) => x.id === d.specialistId)?.name ?? "—";
  return `Локация: ${location}\nУслуга: ${service}\nСпециалист: ${specialist}\nДата: ${d.date ?? "—"}\nВремя: ${d.time ?? "—"}`;
}

function serviceListText(services: ServiceLite[], limit = 12) {
  return services
    .slice(0, limit)
    .map((x, i) => `${i + 1}. ${x.name} — ${fmtRub(x.basePrice)}, ${x.baseDurationMin} мин`)
    .join("\n");
}

function stemToken(token: string) {
  return token
    .replace(/(ами|ями|ого|ему|ому|ыми|ими|ая|яя|ое|ее|ые|ие|ой|ий|ый|ую|юю|ам|ям|ах|ях|ов|ев|ом|ем|а|я|ы|и|о|е|у|ю)$/i, "")
    .replace(/[^a-zа-я0-9]/gi, "");
}

function tokenize(value: string) {
  return norm(value)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && !STOP_TOKENS.has(x));
}

function canonicalToken(token: string) {
  const s = stemToken(token);
  if (/^стриж|^причес|^haircut|^hairstyl/.test(s)) return "hair_style";
  if (/^маник|^nail|^manicur/.test(s)) return "manicure";
  if (/^педик|^pedicur/.test(s)) return "pedicure";
  if (/^гель|^гел|^gel|^polish/.test(s)) return "gel_polish";
  if (/^окраш|^color|^balay/.test(s)) return "coloring";
  return s;
}

const SERVICE_FAMILY_KEYS = new Set(["hair_style", "manicure", "pedicure", "gel_polish", "coloring"]);

function editDistance(a: string, b: string) {
  const x = canonicalToken(a);
  const y = canonicalToken(b);
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= y.length; j += 1) dp[0]![j] = j;
  for (let i = 1; i <= x.length; i += 1) {
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[x.length]![y.length]!;
}

function isPersonTokenMatch(query: string, candidate: string) {
  const q = canonicalToken(query);
  const c = canonicalToken(candidate);
  if (!q || !c) return false;
  if (q === c || q.startsWith(c) || c.startsWith(q)) return true;
  const dist = editDistance(q, c);
  const maxLen = Math.max(q.length, c.length);
  return dist <= 1 || (maxLen >= 5 && dist <= 2);
}

function matchSpecialistByMention(messageNorm: string, specialists: SpecialistLite[]) {
  const queryTokens = tokenize(messageNorm);
  const explicitAfterOt = messageNorm.match(/\bот\s+([a-zа-яё\-]{2,})/i)?.[1] ?? null;
  const personTokens = explicitAfterOt ? [explicitAfterOt, ...queryTokens] : queryTokens;
  let best: { specialist: SpecialistLite; score: number } | null = null;
  for (const sp of specialists) {
    const spTokens = tokenize(sp.name);
    let score = 0;
    for (const q of personTokens) {
      const ok = spTokens.some((st) => isPersonTokenMatch(q, st));
      if (ok) score += explicitAfterOt && q === explicitAfterOt ? 3 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { specialist: sp, score };
  }
  return best?.score && best.score >= 2 ? best.specialist : null;
}

function matchServiceBySemantic(messageNorm: string, candidates: ServiceLite[]) {
  const qTokens = tokenize(messageNorm).map(canonicalToken);
  if (!qTokens.length) return null;
  let best: { service: ServiceLite; score: number } | null = null;
  for (const s of candidates) {
    const sTokens = tokenize(s.name).map(canonicalToken);
    let score = 0;
    for (const qt of qTokens) {
      if (sTokens.some((st) => st === qt)) score += 3;
      else if (sTokens.some((st) => st.startsWith(qt) || qt.startsWith(st))) score += 2;
      else if (norm(s.name).includes(qt)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { service: s, score };
  }
  return best && best.score >= 2 ? best.service : null;
}

function serviceFamilyKeys(name: string) {
  const set = new Set<string>();
  for (const token of tokenize(name).map(canonicalToken)) {
    if (SERVICE_FAMILY_KEYS.has(token)) set.add(token);
  }
  return set;
}

function requestedServiceFamilies(messageNorm: string) {
  const set = new Set<string>();
  for (const token of tokenize(messageNorm).map(canonicalToken)) {
    if (SERVICE_FAMILY_KEYS.has(token)) set.add(token);
  }
  if (/(подстр|стриж|причес|haircut|hairstyl)/i.test(messageNorm)) set.add("hair_style");
  return set;
}

function isHaircutServiceName(name: string) {
  return serviceFamilyKeys(name).has("hair_style");
}

function locationMatchesByText(messageNorm: string, locations: LocationLite[]) {
  const stopWords = new Set(["beauty", "salon", "салон", "бьюти"]);
  const hasToken = (value: string, token: string) => value.includes(token);
  return locations.filter((loc) => {
    const full = `${loc.name} ${loc.address ?? ""}`;
    const normFull = norm(full);
    if (messageNorm.includes(norm(loc.name)) || (loc.address && messageNorm.includes(norm(loc.address)))) return true;
    const tokens = normFull.split(" ").filter((x) => x.length >= 4 && !stopWords.has(x));
    if (tokens.some((tk) => messageNorm.includes(tk))) return true;

    // Colloquial aliases users type in Russian for common location names.
    if (hasToken(normFull, "center")) {
      if (/(центр|center|центре|центра|тверск)/i.test(messageNorm)) return true;
    }
    if (hasToken(normFull, "riverside")) {
      if (/(ривер|river|riverside|кутуз)/i.test(messageNorm)) return true;
    }

    return false;
  });
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
  return jsonOk({
    threadId: thread.id,
    messages,
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
    data: {
      threadId: thread.id,
      actionType: "public_ai_turn",
      payload: { message },
      status: "STARTED",
    },
    select: { id: true },
  });
  const logTurn = async (level: string, event: string, data?: Record<string, unknown>) => {
    await prisma.aiLog.create({
      data: {
        actionId: turnAction.id,
        level,
        message: event,
        data: data ? (data as Prisma.InputJsonValue) : undefined,
      },
    });
  };

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
  const isBareNumberMessage = /^\s*\d{1,2}\s*$/.test(t);
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
  await logTurn("info", "nlu_result", {
    source: nluResult.source,
    reason: nluResult.reason ?? null,
    intent: nlu?.intent ?? null,
    hasDate: Boolean(nlu?.date),
    hasTime: Boolean(nlu?.time),
    hasLocation: Boolean(nlu?.locationId),
    hasService: Boolean(nlu?.serviceId),
    hasSpecialist: Boolean(nlu?.specialistId),
  });
  const hadLocationBeforeMessage = Boolean(d.locationId);
  const standaloneChoice = t.match(/^\s*(?:№|номер\s*)?(\d{1,2})\s*$/i);
  const choice = standaloneChoice ? Number(standaloneChoice[1]) : null;
  const serviceChoiceMatch = t.match(/(?:услуг[аи]?|service)\s*(?:номер\s*)?(\d{1,2})/i);
  const serviceChoice = serviceChoiceMatch ? Number(serviceChoiceMatch[1]) : null;

  const locationMatches = locationMatchesByText(t, locations);
  const locationByName = locationMatches.length === 1 ? locationMatches[0]! : null;
  const locationMentionedAmbiguous = locationMatches.length > 1;
  const nluIntentAllowsLocation =
    nlu?.intent === "booking" || nlu?.intent === "update_booking" || nlu?.intent === "ask_availability";
  const specialistMention = matchSpecialistByMention(t, specialists);
  let choiceWasUsedForLocation = false;
  if (locationByName) d.locationId = locationByName.id;
  if (!d.locationId && choice && choice >= 1 && choice <= locations.length) {
    d.locationId = locations[choice - 1]?.id ?? null;
    choiceWasUsedForLocation = true;
  }
  if (
    !d.locationId &&
    nlu?.locationId &&
    locations.some((x) => x.id === nlu.locationId) &&
    (locations.length === 1 || nluIntentAllowsLocation)
  ) {
    d.locationId = nlu.locationId;
  }
  const locationChosenThisTurn = Boolean((!hadLocationBeforeMessage && d.locationId) || locationByName || choiceWasUsedForLocation);

  const scopedServices = services.filter((x) => (d.locationId ? x.locationIds.includes(d.locationId) : true));
  const asksGenericHaircut = /(стриж|причес|haircut|hairstyl)/i.test(t);
  const hasHaircutGenderHint = /(муж|жен|men|women|male|female|парн|дев|boy|girl)/i.test(t);
  const haircutScopedServices = scopedServices.filter((x) => isHaircutServiceName(x.name));
  const hasAmbiguousHaircutChoice =
    asksGenericHaircut && !hasHaircutGenderHint && haircutScopedServices.length > 1;
  const serviceByName = scopedServices.find(
    (x) =>
      t.includes(norm(x.name)) ||
      (/маник/.test(t) && (norm(x.name).includes("manicure") || norm(x.name).includes("маник"))) ||
      (/гель|гел/.test(t) && norm(x.name).includes("gel")),
  );
  const serviceBySemantic = matchServiceBySemantic(t, scopedServices);
  let choiceWasUsedForService = false;
  if (!hasAmbiguousHaircutChoice) {
    if (serviceByName) d.serviceId = serviceByName.id;
    else if (!d.serviceId && serviceBySemantic) d.serviceId = serviceBySemantic.id;
  }
  if (!d.serviceId) {
    const shouldUseChoiceForService = hadLocationBeforeMessage || !choiceWasUsedForLocation;
    const idx = serviceChoice ?? (shouldUseChoiceForService ? choice : null);
    if (idx && idx >= 1 && idx <= scopedServices.length) {
      d.serviceId = scopedServices[idx - 1]?.id ?? null;
      choiceWasUsedForService = true;
    }
  }
  if (!d.serviceId && nlu?.serviceId && scopedServices.some((x) => x.id === nlu.serviceId)) d.serviceId = nlu.serviceId;
  const requestedFamilies = requestedServiceFamilies(t);
  const familyScopedServices =
    requestedFamilies.size > 0
      ? scopedServices.filter((x) => {
          const keys = serviceFamilyKeys(x.name);
          for (const key of requestedFamilies) {
            if (keys.has(key)) return true;
          }
          return false;
        })
      : [];
  const hasAmbiguousServiceChoice = requestedFamilies.size > 0 && familyScopedServices.length > 1;
  if (hasAmbiguousServiceChoice && !serviceByName && !choiceWasUsedForService && d.serviceId) {
    const selectedService = scopedServices.find((x) => x.id === d.serviceId);
    if (selectedService) {
      const selectedKeys = serviceFamilyKeys(selectedService.name);
      const intersectsRequestedFamily = Array.from(requestedFamilies).some((key) => selectedKeys.has(key));
      if (intersectsRequestedFamily) d.serviceId = null;
    }
  }
  const ambiguousServiceOptions = hasAmbiguousServiceChoice ? familyScopedServices : haircutScopedServices;
  const needsServiceClarification = hasAmbiguousServiceChoice || hasAmbiguousHaircutChoice;

  const explicitTime = /[:.]/.test(message) || /\b(в|к|после|до|утром|днем|днём|вечером|ночью|час|at)\b/i.test(t);
  const expectingTimeBeforeDateParsing = Boolean(d.locationId && d.serviceId && d.date && !d.time);
  const monthWindow = parseMonthWindow(message, nowYmd);
  const parsedDate = parseDate(message, nowYmd, {
    allowBareDay: !expectingTimeBeforeDateParsing && !(choiceWasUsedForLocation || choiceWasUsedForService),
  });
  const nluDate = monthWindow ? null : (nlu?.date ?? null);
  d.date = nluDate || parsedDate || d.date;
  const expectingTime = Boolean(d.locationId && d.serviceId && d.date && !d.time);
  const skipBareHourBecauseDateWasParsed = Boolean(parsedDate && isBareNumberMessage && !explicitTime);
  const allowBareHourTime =
    (explicitTime || expectingTime) &&
    !(choiceWasUsedForLocation || choiceWasUsedForService) &&
    !skipBareHourBecauseDateWasParsed;
  d.time = nlu?.time || parseTime(message, allowBareHourTime) || d.time;

  const wantsSelfMode = has(message, /(сам|самостоятельно|в форме|онлайн)/i);
  const wantsAssistantMode = has(message, /(оформи|запиши меня|через ассистента|оформи ты)/i);
  if (wantsSelfMode) d.mode = "SELF";
  if (wantsAssistantMode) d.mode = "ASSISTANT";
  if (!d.mode && d.specialistId && choice === 1) d.mode = "SELF";
  if (!d.mode && d.specialistId && choice === 2) d.mode = "ASSISTANT";
  d.clientPhone = parsePhone(message) || nlu?.clientPhone || d.clientPhone || client?.phone || null;
  d.clientName =
    parseName(message) ||
    nlu?.clientName ||
    d.clientName ||
    [client?.firstName, client?.lastName].filter(Boolean).join(" ").trim() ||
    null;
  if (has(message, /(согласен|согласна|даю согласие|даю согласие на обработку)/i) || nlu?.intent === "consent") {
    d.consentConfirmedAt = new Date().toISOString();
  }

  const publicSlug = buildPublicSlugId(resolved.account.slug, resolved.account.id);
  const origin = new URL(request.url).origin;
  let reply = `Я ${ASSISTANT_NAME}, помогу с записью. Что хотите забронировать?`;
  let nextStatus = d.status;
  let nextAction: Action = null;

  const listLocations = `Наши локации:\n${locations.map((x, i) => `${i + 1}. ${x.name}${x.address ? ` — ${x.address}` : ""}`).join("\n")}`;

  const signalsNewBookingIntent =
    Boolean(parsedDate) ||
    Boolean(nlu?.date) ||
    Boolean(nlu?.time) ||
    Boolean(parseTime(message, true)) ||
    Boolean(nlu && ["booking", "update_booking", "ask_availability", "mode_assistant", "mode_self"].includes(nlu.intent)) ||
    has(
      message,
      /(новую запись|другую запись|заново|сначала|перенести|измени|изменить|другое время|другая дата|запис|запись|записаться|хочу на|хочу в|время|дату|услугу|маник|педик|гель|окошк|слот|свобод|локацию|location|service)/i,
    );
  const asksAvailability =
    Boolean(nlu && ["ask_availability", "booking", "update_booking"].includes(nlu.intent)) ||
    has(message, /(окошк|свобод|время|slot|слот)/i);
  const asksIdentity = has(
    message,
    /(кто ты|ты кто|как тебя зовут|как к тебе обращаться|твое имя|твоё имя)/i,
  );
  const asksCapabilities = has(message, /(чем занимаешься|что умеешь|что делаешь)/i);
  const asksWhyNoAnswer = has(
    message,
    /(почему ты.*не отвеча|почему не отвеча|почему так отвеча|не в контексте)/i,
  );
  const timePreference = detectTimePreference(message, nlu?.timePreference ?? null);
  const dayRangeRequest = parseDayRangeRequest(message);
  const hasDirectBookingVerb = has(message, /(запиш|записать|записаться|оформи|забронируй)/i);
  const hasActiveDraftContext =
    d.status !== "COMPLETED" &&
    Boolean(
      d.locationId ||
        d.serviceId ||
        d.specialistId ||
        d.date ||
        d.time ||
        d.mode ||
        d.clientName ||
        d.clientPhone ||
        d.consentConfirmedAt,
    );

  if (d.status === "COMPLETED" && !signalsNewBookingIntent) {
    reply = nlu?.reply?.trim() || "Запись уже оформлена.";
  } else {
    if (d.status === "COMPLETED" && signalsNewBookingIntent) {
      nextStatus = "COLLECTING";
      d.specialistId = null;
      d.mode = null;
      d.consentConfirmedAt = null;
    }

    if (asksIdentity && !signalsNewBookingIntent) {
    reply = `Я ${ASSISTANT_NAME}, AI-ассистент записи. Помогаю подобрать локацию, услугу, время и оформить запись.`;
    } else if (asksCapabilities && !signalsNewBookingIntent) {
    reply = "Помогаю с записью: подбираю свободные окна, специалиста и могу оформить запись через чат или открыть онлайн-форму.";
    } else if (asksWhyNoAnswer && !signalsNewBookingIntent) {
    reply = `Отвечаю. Я ${ASSISTANT_NAME}, и моя задача — быстро помочь с записью. Если хотите, начнем с удобной даты/времени или услуги.`;
    } else if (!signalsNewBookingIntent && has(message, /(адрес|где находится|как добраться)/i)) {
    reply = listLocations;
    } else if (has(message, /(услуг|прайс|price|каталог)/i)) {
    reply = `Доступные услуги:\n${serviceListText(scopedServices)}`;
    } else if (has(message, /(что выбрано|на что записываешь|какая услуга|какой специалист|итог)/i)) {
    reply = `Текущие данные записи:\n${bookingSummary(d, locations, services, specialists)}`;
    } else if (!signalsNewBookingIntent && !hasActiveDraftContext) {
    reply = nlu?.reply?.trim() || "Я на связи.";
    } else {
    const missing = [!d.locationId ? "локацию" : "", !d.serviceId ? "услугу" : "", !d.date ? "дату" : "", !d.time ? "время" : ""].filter(Boolean);
    if (missing.length) {
      if (!d.locationId && asksAvailability) {
        if (dayRangeRequest && hasDirectBookingVerb) {
          reply = `Уточню: вы хотите посмотреть окна на ${dayRangeRequest} дня или записаться на конкретное время (например, в 14:00)?`;
        } else
        if (monthWindow || dayRangeRequest) {
          if (dayRangeRequest) {
            const startDate = d.date || parsedDate || nluDate || nowYmd;
            const daySummaries: string[] = [];
            const maxDaysToShow = Math.min(dayRangeRequest, 10);
            for (let i = 0; i < maxDaysToShow; i += 1) {
              const date = addDaysYmd(startDate, i);
              const perLocation: string[] = [];
              for (const loc of locations) {
                const u = new URL("/api/v1/public/booking/offers", origin);
                u.searchParams.set("account", resolved.account.slug);
                u.searchParams.set("locationId", String(loc.id));
                u.searchParams.set("date", date);
                const offers = await apiData<{ times: Array<{ time: string; services: Array<{ serviceId: number }> }> }>(u.toString());
                const filtered = d.serviceId
                  ? (offers?.times ?? []).filter((x) => x.services.some((s) => s.serviceId === d.serviceId))
                  : offers?.times ?? [];
                const times = previewTimes(filterTimesByPreference(filtered.map((x) => x.time), timePreference), timePreference, 4);
                if (times.length) perLocation.push(`${loc.name}: ${times.join(", ")}`);
              }
              if (perLocation.length) daySummaries.push(`${date} — ${perLocation.join(" | ")}`);
            }
            if (daySummaries.length) {
              reply = `Поняла, смотрю на ${dayRangeRequest} дня.\n${daySummaries
                .map((x, i) => `${i + 1}. ${x}`)
                .join("\n")}\nНапишите подходящую дату и локацию, и я продолжу запись.`;
            } else {
              reply = `На ближайшие ${dayRangeRequest} дня свободных окон не нашла. Могу проверить другие даты.`;
            }
          } else {
          const mw = monthWindow;
          if (!mw) {
            reply = "Могу проверить даты по периоду, уточните запрос, пожалуйста.";
          } else {
          const daySummaries: string[] = [];
          const maxDaysToShow = 10;
          for (let i = 0; i < mw.days; i += 1) {
            const date = addDaysYmd(mw.start, i);
            const perLocation: string[] = [];
            for (const loc of locations) {
              const u = new URL("/api/v1/public/booking/offers", origin);
              u.searchParams.set("account", resolved.account.slug);
              u.searchParams.set("locationId", String(loc.id));
              u.searchParams.set("date", date);
              const offers = await apiData<{ times: Array<{ time: string; services: Array<{ serviceId: number }> }> }>(u.toString());
              const filtered = d.serviceId
                ? (offers?.times ?? []).filter((x) => x.services.some((s) => s.serviceId === d.serviceId))
                : offers?.times ?? [];
              const times = filterTimesByPreference(filtered.map((x) => x.time), timePreference);
              if (times.length) perLocation.push(`${loc.name}: ${times.slice(0, 2).join(", ")}`);
            }
            if (perLocation.length) {
              daySummaries.push(`${date} — ${perLocation.join(" | ")}`);
              if (daySummaries.length >= maxDaysToShow) break;
            }
          }
          if (daySummaries.length) {
            reply = `По запросу на ${mw.label} нашла даты с окнами:\n${daySummaries
              .map((x, i) => `${i + 1}. ${x}`)
              .join("\n")}\nНапишите дату и локацию, и подберу точное время.`;
          } else {
            reply = `На ${mw.label} свободных окон не нашла. Могу проверить другой месяц.`;
          }
          }
          }
          // eslint-disable-next-line no-lonely-if
        } else {
        const targetDate = d.date || nowYmd;
        const requestedTime = d.time;
        const options: Array<{
          locationId: number;
          locationName: string;
          address: string | null;
          times: string[];
          totalTimes: number;
          hasRequestedTime: boolean;
        }> = [];
        for (const loc of locations) {
          const u = new URL("/api/v1/public/booking/offers", origin);
          u.searchParams.set("account", resolved.account.slug);
          u.searchParams.set("locationId", String(loc.id));
          u.searchParams.set("date", targetDate);
          const offers = await apiData<{ times: Array<{ time: string; services: Array<{ serviceId: number }> }> }>(u.toString());
          const filtered = d.serviceId
            ? (offers?.times ?? []).filter((x) => x.services.some((s) => s.serviceId === d.serviceId))
            : offers?.times ?? [];
          const baseTimes = filtered.map((x) => x.time);
          const filteredTimes = filterTimesByPreference(baseTimes, timePreference);
          const times = previewTimes(filteredTimes, timePreference, SLOT_REPLY_LIMIT);
          const hasRequestedTime = Boolean(requestedTime && filteredTimes.includes(requestedTime));
          if (times.length) {
            options.push({
              locationId: loc.id,
              locationName: loc.name,
              address: loc.address,
              times,
              totalTimes: Array.from(new Set(filteredTimes)).length,
              hasRequestedTime,
            });
          }
        }
        const unavailableLocations = locations.filter((loc) => !options.some((x) => x.locationId === loc.id));
        const exactTimeOptions = requestedTime ? options.filter((x) => x.hasRequestedTime) : [];
        const effectiveOptions = exactTimeOptions.length ? exactTimeOptions : options;
        if (effectiveOptions.length === 1) {
          const single = effectiveOptions[0]!;
          d.locationId = single.locationId;
          const prefLabel =
            timePreference === "evening"
              ? "на вечер"
              : timePreference === "morning"
                ? "на утро"
              : timePreference === "day"
                ? "на день"
                : "";
          const unavailableHint =
            unavailableLocations.length && d.serviceId
              ? `\nПо этой услуге в ${unavailableLocations.map((x) => x.name).join(", ")} на ${targetDate} свободных окон нет.`
              : "";
          const requestedTimeHint =
            requestedTime && !single.hasRequestedTime ? `\nНа ${requestedTime} в этой локации свободного окна нет, показываю ближайшие.` : "";
          if (d.serviceId && d.date && d.time && single.hasRequestedTime) {
            const matchedSpecs = await specialistsForSlot(origin, resolved.account.slug, d, specialists);
            if (matchedSpecs.length === 1) {
              d.specialistId = matchedSpecs[0]!.id;
              reply = `Отлично, в ${single.locationName} на ${d.date} в ${d.time} всё доступно. Специалист ${matchedSpecs[0]!.name} выбран автоматически.\nКак завершим запись?\n1) Сам(а) в форме онлайн-записи.\n2) Оформить через ассистента.${unavailableHint}`;
            } else if (matchedSpecs.length > 1) {
              if (specialistMention && matchedSpecs.some((x) => x.id === specialistMention.id)) {
                d.specialistId = specialistMention.id;
                reply = `Отлично, в ${single.locationName} на ${d.date} в ${d.time} доступно. Специалист ${specialistMention.name} выбран по вашему запросу.\nКак завершим запись?\n1) Сам(а) в форме онлайн-записи.\n2) Оформить через ассистента.${unavailableHint}`;
              } else {
                reply = `Отлично, в ${single.locationName} на ${d.date} в ${d.time} доступно.\nСпециалисты:\n${matchedSpecs
                  .map((x, i) => `${i + 1}. ${x.name}`)
                  .join("\n")}\nВыберите специалиста номером или напишите «любой».${unavailableHint}${requestedTimeHint}`;
              }
            } else {
              reply = `Нашла доступную локацию: ${single.locationName}. На ${targetDate}${prefLabel ? ` ${prefLabel}` : ""} есть окна: ${single.times.join(", ")}. Напишите удобное время.${unavailableHint}${requestedTimeHint}`;
              d.time = null;
            }
          } else if (!d.serviceId && d.date && d.time) {
            const locationScopedServices = services.filter((x) => x.locationIds.includes(single.locationId));
            reply = `Зафиксировала локацию ${single.locationName} и время ${d.time} на ${d.date}. Теперь подскажите услугу, и я продолжу запись.\n${serviceListText(locationScopedServices, 8)}${unavailableHint}${requestedTimeHint}`;
          } else {
            reply = `Нашла доступную локацию: ${single.locationName}. На ${targetDate}${prefLabel ? ` ${prefLabel}` : ""} есть окна: ${single.times.join(", ")}. Напишите удобное время.${unavailableHint}${requestedTimeHint}`;
          }
        } else if (effectiveOptions.length > 1) {
          const userUnsureLocation = has(message, /(без разницы|любой филиал|любая локация|не важно|неважно|не знаю какую|не знаю)/i);
          if (userUnsureLocation) {
            const best = [...effectiveOptions].sort((a, b) => b.times.length - a.times.length)[0]!;
            d.locationId = best.locationId;
            const moreHint =
              best.totalTimes > best.times.length ? ` Еще ${best.totalTimes - best.times.length} слотов.` : "";
            reply = `Выберу локацию ${best.locationName}${best.address ? ` (${best.address})` : ""}, чтобы не задерживать запись. Доступные окна: ${best.times.join(", ")}.${moreHint} Напишите удобное время.`;
          } else {
          const prefLabel =
            timePreference === "evening"
              ? "на вечер"
              : timePreference === "morning"
                ? "на утро"
                : timePreference === "day"
                  ? "на день"
                  : "";
          const intro =
            nlu?.reply?.trim() ||
            `Нашла свободные окна на ${targetDate}${prefLabel ? ` ${prefLabel}` : ""} в нескольких локациях.`;
          const exactHint = requestedTime && !exactTimeOptions.length ? `\nНа ${requestedTime} свободных окон не нашла, показываю ближайшие варианты.` : "";
          reply = `${intro}${exactHint}\n${effectiveOptions
            .map((x, i) => {
              const moreHint = x.totalTimes > x.times.length ? ` (+еще ${x.totalTimes - x.times.length})` : "";
              return `${i + 1}. ${x.locationName}${x.address ? ` — ${x.address}` : ""}: ${x.times.join(", ")}${moreHint}`;
            })
            .join("\n")}\nМожно написать название локации или цифру (1, 2 и т.д.).`;
          }
        } else {
          const prefLabel =
            timePreference === "evening"
              ? "вечерних"
              : timePreference === "morning"
                ? "утренних"
                : timePreference === "day"
                  ? "дневных"
                  : "";
          reply = `На ${targetDate} ${prefLabel ? `${prefLabel} ` : ""}окон по локациям не нашла. Могу проверить другую дату.`;
        }
        }
      } else if (d.locationId && d.serviceId && !d.date) {
        if (monthWindow) {
          const u = new URL("/api/v1/public/booking/availability/calendar", origin);
          u.searchParams.set("account", resolved.account.slug);
          u.searchParams.set("locationId", String(d.locationId));
          u.searchParams.set("serviceId", String(d.serviceId));
          u.searchParams.set("start", monthWindow.start);
          u.searchParams.set("days", String(monthWindow.days));
          const cal = await apiData<{ days: Array<{ date: string; times: Array<{ time: string }> }> }>(u.toString());
          const daysWithSlots = (cal?.days ?? [])
            .map((day) => {
              const times = filterTimesByPreference(day.times.map((x) => x.time), timePreference);
              return { date: day.date, times };
            })
            .filter((x) => x.times.length > 0)
            .slice(0, 12);
          if (daysWithSlots.length) {
            reply = `На ${monthWindow.label} есть свободные даты:\n${daysWithSlots
              .map((x, i) => `${i + 1}. ${x.date}: ${x.times.slice(0, 3).join(", ")}`)
              .join("\n")}\nНапишите удобную дату и время.`;
          } else {
            reply = `На ${monthWindow.label} свободных окон не нашла. Могу проверить другой месяц.`;
          }
        } else {
          const u = new URL("/api/v1/public/booking/availability/calendar", origin);
          u.searchParams.set("account", resolved.account.slug);
          u.searchParams.set("locationId", String(d.locationId));
          u.searchParams.set("serviceId", String(d.serviceId));
          u.searchParams.set("start", nowYmd);
          u.searchParams.set("days", "3");
          const cal = await apiData<{ days: Array<{ date: string; times: Array<{ time: string }> }> }>(u.toString());
          const firstDay = (cal?.days ?? []).find((day) => (day.times?.length ?? 0) > 0) ?? null;
          const firstDayTimes = previewTimes(
            filterTimesByPreference((firstDay?.times ?? []).map((x) => x.time), timePreference),
            timePreference,
            SLOT_REPLY_LIMIT,
          );
          reply = firstDay
            ? `Есть свободные слоты на ${firstDay.date}: ${firstDayTimes.join(", ")}. Напишите удобную дату и время.`
            : "По выбранной услуге ближайших слотов пока нет. Укажите другую дату.";
        }
      } else if (d.locationId && d.serviceId && d.date && !d.time) {
        if (monthWindow) {
          const u = new URL("/api/v1/public/booking/availability/calendar", origin);
          u.searchParams.set("account", resolved.account.slug);
          u.searchParams.set("locationId", String(d.locationId));
          u.searchParams.set("serviceId", String(d.serviceId));
          u.searchParams.set("start", monthWindow.start);
          u.searchParams.set("days", String(monthWindow.days));
          const cal = await apiData<{ days: Array<{ date: string; times: Array<{ time: string }> }> }>(u.toString());
          const daysWithSlots = (cal?.days ?? [])
            .map((day) => {
              const times = filterTimesByPreference(day.times.map((x) => x.time), timePreference);
              return { date: day.date, times };
            })
            .filter((x) => x.times.length > 0)
            .slice(0, 12);
          if (daysWithSlots.length) {
            reply = `На ${monthWindow.label} есть свободные даты:\n${daysWithSlots
              .map((x, i) => `${i + 1}. ${x.date}: ${x.times.slice(0, 3).join(", ")}`)
              .join("\n")}\nНапишите удобную дату и время.`;
          } else {
            reply = `На ${monthWindow.label} свободных окон не нашла.`;
          }
        } else {
        const u = new URL("/api/v1/public/booking/slots", origin);
        u.searchParams.set("account", resolved.account.slug);
        u.searchParams.set("locationId", String(d.locationId));
        u.searchParams.set("serviceId", String(d.serviceId));
        u.searchParams.set("date", String(d.date));
        const slots = await apiData<{ slots: Array<{ time: string }> }>(u.toString());
        const allTimes = Array.from(new Set((slots?.slots ?? []).map((x) => x.time))).sort(
          (a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0),
        );
        const wantsEvening = nlu?.timePreference === "evening" || has(message, /(вечер|после обеда|после работы)/i);
        const wantsMorning = nlu?.timePreference === "morning" || has(message, /(утро|утром)/i);
        const wantsDay = nlu?.timePreference === "day" || has(message, /(днем|днём|день)/i);
        let times = allTimes;
        if (wantsEvening) times = allTimes.filter((tm) => (toMinutes(tm) ?? -1) >= 17 * 60);
        else if (wantsMorning) times = allTimes.filter((tm) => (toMinutes(tm) ?? 24 * 60) < 12 * 60);
        else if (wantsDay) times = allTimes.filter((tm) => (toMinutes(tm) ?? -1) >= 12 * 60 && (toMinutes(tm) ?? -1) < 17 * 60);
        const totalTimes = times.length;
        times = times.slice(0, SLOT_REPLY_LIMIT);
        if (times.length) {
          const moreSuffix =
            totalTimes > times.length ? ` Еще ${totalTimes - times.length} слотов по запросу.` : "";
          reply = `На ${d.date} доступны времена: ${times.join(", ")}.${moreSuffix} Выберите время.`;
        } else {
          const otherLocationOptions: Array<{ locationId: number; name: string; times: string[] }> = [];
          for (const loc of locations.filter((x) => x.id !== d.locationId)) {
            const uOther = new URL("/api/v1/public/booking/slots", origin);
            uOther.searchParams.set("account", resolved.account.slug);
            uOther.searchParams.set("locationId", String(loc.id));
            uOther.searchParams.set("serviceId", String(d.serviceId));
            uOther.searchParams.set("date", String(d.date));
            const otherSlots = await apiData<{ slots: Array<{ time: string }> }>(uOther.toString());
            const otherAllTimes = Array.from(new Set((otherSlots?.slots ?? []).map((x) => x.time)));
            let otherTimes = otherAllTimes;
            if (wantsEvening) otherTimes = otherAllTimes.filter((tm) => (toMinutes(tm) ?? -1) >= 17 * 60);
            else if (wantsMorning) otherTimes = otherAllTimes.filter((tm) => (toMinutes(tm) ?? 24 * 60) < 12 * 60);
            else if (wantsDay) otherTimes = otherAllTimes.filter((tm) => (toMinutes(tm) ?? -1) >= 12 * 60 && (toMinutes(tm) ?? -1) < 17 * 60);
            const preview = previewTimes(otherTimes, timePreference, 10);
            if (preview.length) {
              otherLocationOptions.push({ locationId: loc.id, name: loc.name, times: preview });
            }
          }

          if (otherLocationOptions.length === 1) {
            const currentLoc = locations.find((x) => x.id === d.locationId)?.name ?? "текущей локации";
            const alt = otherLocationOptions[0]!;
            d.locationId = alt.locationId;
            reply = `В ${currentLoc} на ${d.date} по этой услуге свободных окон нет. Переключила на ${alt.name}: доступны ${alt.times.join(", ")}. Выберите время.`;
          } else if (otherLocationOptions.length > 1) {
            const currentLoc = locations.find((x) => x.id === d.locationId)?.name ?? "текущей локации";
            reply = `В ${currentLoc} на ${d.date} по этой услуге свободных окон нет. В других локациях есть:\n${otherLocationOptions
              .map((x, i) => `${i + 1}. ${x.name}: ${x.times.join(", ")}`)
              .join("\n")}\nНапишите локацию (название или номер), и продолжу запись.`;
          } else {
            reply = `На ${d.date} свободных времен не нашла. Укажите другую дату.`;
          }
        }
        }
      } else {
        const locHelp = !d.locationId ? `\n${listLocations}` : "";
        if (!d.locationId) {
          if (locationMentionedAmbiguous) {
            reply = `Уточните филиал, пожалуйста: ${locations.map((x) => x.name).join(" или ")}.\n${listLocations}`;
          } else {
            reply = `Подскажу по локации. Можно выбрать любую из списка, я подстрою запись под удобное время.\n${listLocations}\nЕсли не принципиально, напишите «любой филиал», и выберу лучший вариант по слотам.`;
          }
        } else if (!d.serviceId) {
          if (needsServiceClarification) {
            reply = `Уточните, пожалуйста, услугу:\n${serviceListText(ambiguousServiceOptions, 8)}\nМожно выбрать номером или написать названием.`;
          } else
          if (d.locationId && d.date && !d.time && locationChosenThisTurn) {
            const u = new URL("/api/v1/public/booking/offers", origin);
            u.searchParams.set("account", resolved.account.slug);
            u.searchParams.set("locationId", String(d.locationId));
            u.searchParams.set("date", String(d.date));
            const offers = await apiData<{ times: Array<{ time: string; services: Array<{ serviceId: number }> }> }>(
              u.toString(),
            );
            const allTimes = filterTimesByPreference((offers?.times ?? []).map((x) => x.time), timePreference);
            const times = previewTimes(allTimes, timePreference, SLOT_REPLY_LIMIT);
            const totalTimes = Array.from(new Set(allTimes)).length;
            if (times.length) {
              const moreHint = totalTimes > times.length ? ` Еще ${totalTimes - times.length} слотов.` : "";
              reply = `Отлично, выбрала локацию. На ${d.date} доступны времена: ${times.join(", ")}.${moreHint} Выберите время.`;
            } else {
              reply = `В этой локации на ${d.date} свободных окон не нашла. Могу проверить другую локацию или дату.`;
            }
          } else
          if (has(message, /(какие есть|какая есть|что есть|какие услуги|что по услугам|покажи услуги|список услуг)/i)) {
            reply = `Доступные услуги:\n${serviceListText(scopedServices)}\nМожно выбрать номером или названием.`;
          } else if (d.date && d.time) {
            reply = `Приняла: ${d.date} в ${d.time}. Теперь подскажите услугу, и я сразу проверю это время.\n${serviceListText(scopedServices, 8)}`;
          } else if (d.date || d.time) {
            const dateLabel = d.date ? `на ${d.date}` : "";
            const timeLabel = d.time ? `в ${d.time}` : "";
            const when = [dateLabel, timeLabel].filter(Boolean).join(" ");
            reply = `Отлично${when ? `, ${when}` : ""}. Теперь выберите услугу, и я продолжу запись.\n${serviceListText(scopedServices, 8)}`;
          } else {
            reply = `Подскажите услугу, и я сразу продолжу запись.\n${serviceListText(scopedServices, 8)}`;
          }
        }
        else if (!d.date) reply = "Напишите дату: например «27 февраля», «в субботу» или «завтра».";
        else reply = `Напишите удобное время на ${d.date}, например 17:00 или «вечером».`;
      }
    } else {
      const availableSpecialists = await specialistsForSlot(origin, resolved.account.slug, d, specialists);
      const specialistByName = availableSpecialists.find((x) => t.includes(norm(x.name)));
      if (!d.specialistId && specialistByName) d.specialistId = specialistByName.id;
      if (!d.specialistId && specialistMention && availableSpecialists.some((x) => x.id === specialistMention.id)) {
        d.specialistId = specialistMention.id;
      }
      if (!d.specialistId && nlu?.specialistId && availableSpecialists.some((x) => x.id === nlu.specialistId)) {
        d.specialistId = nlu.specialistId;
      }
      if (!d.specialistId && choice && choice >= 1 && choice <= availableSpecialists.length) d.specialistId = availableSpecialists[choice - 1]?.id ?? null;
      if (!d.specialistId && has(message, /(любой|any)/i) && availableSpecialists.length) d.specialistId = availableSpecialists[0]!.id;

      if (!d.specialistId) {
        if (availableSpecialists.length === 1) {
          d.specialistId = availableSpecialists[0]!.id;
          reply = `На ${d.date} в ${d.time} доступен специалист ${availableSpecialists[0]!.name}, выбрала его автоматически.\nКак завершим запись?\n1) Сам(а) в форме онлайн-записи.\n2) Оформить через ассистента.`;
        } else if (availableSpecialists.length > 1) {
          reply = `На ${d.date} в ${d.time} доступны специалисты:\n${availableSpecialists.map((x, i) => `${i + 1}. ${x.name}`).join("\n")}\nВыберите специалиста номером или напишите «любой».`;
        } else {
          const u = new URL("/api/v1/public/booking/slots", origin);
          u.searchParams.set("account", resolved.account.slug);
          u.searchParams.set("locationId", String(d.locationId));
          u.searchParams.set("serviceId", String(d.serviceId));
          u.searchParams.set("date", String(d.date));
          const slots = await apiData<{ slots: Array<{ time: string }> }>(u.toString());
          const nearestTimes = Array.from(new Set((slots?.slots ?? []).map((x) => x.time)))
            .sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0))
            .slice(0, 8);
          if (nearestTimes.length) {
            reply = `На ${d.time} свободных специалистов нет. Ближайшие времена: ${nearestTimes.join(", ")}. Выберите время.`;
          } else {
            const otherLocationOptions: Array<{ locationId: number; name: string; times: string[]; hasExactTime: boolean }> = [];
            for (const loc of locations.filter((x) => x.id !== d.locationId)) {
              const uOther = new URL("/api/v1/public/booking/slots", origin);
              uOther.searchParams.set("account", resolved.account.slug);
              uOther.searchParams.set("locationId", String(loc.id));
              uOther.searchParams.set("serviceId", String(d.serviceId));
              uOther.searchParams.set("date", String(d.date));
              const otherSlots = await apiData<{ slots: Array<{ time: string }> }>(uOther.toString());
              const otherTimes = previewTimes(Array.from(new Set((otherSlots?.slots ?? []).map((x) => x.time))), null, 8);
              if (otherTimes.length) {
                otherLocationOptions.push({
                  locationId: loc.id,
                  name: loc.name,
                  times: otherTimes,
                  hasExactTime: Boolean(d.time && otherTimes.includes(d.time)),
                });
              }
            }

            if (otherLocationOptions.length === 1) {
              const target = otherLocationOptions[0]!;
              d.locationId = target.locationId;
              if (target.hasExactTime) {
                const altSpecs = await specialistsForSlot(origin, resolved.account.slug, d, specialists);
                if (altSpecs.length === 1) {
                  d.specialistId = altSpecs[0]!.id;
                  reply = `В текущей локации на ${d.date} по этой услуге окон нет. Переключила на ${target.name}: ${d.time} доступно. Специалист ${altSpecs[0]!.name} выбран автоматически.\nКак завершим запись?\n1) Сам(а) в форме онлайн-записи.\n2) Оформить через ассистента.`;
                } else if (altSpecs.length > 1) {
                  reply = `В текущей локации на ${d.date} по этой услуге окон нет. Переключила на ${target.name}: ${d.time} доступно.\nСпециалисты:\n${altSpecs.map((x, i) => `${i + 1}. ${x.name}`).join("\n")}\nВыберите специалиста номером или напишите «любой».`;
                } else {
                  reply = `В текущей локации окон нет. В ${target.name} на ${d.date} есть времена: ${target.times.join(", ")}. Выберите удобное время.`;
                  d.time = null;
                }
              } else {
                reply = `В текущей локации на ${d.date} по этой услуге окон нет. Переключила на ${target.name}: доступны ${target.times.join(", ")}. Выберите удобное время.`;
                d.time = null;
              }
            } else if (otherLocationOptions.length > 1) {
              reply = `В текущей локации на ${d.date} по этой услуге окон нет. В других локациях есть:\n${otherLocationOptions
                .map((x, i) => `${i + 1}. ${x.name}: ${x.times.join(", ")}`)
                .join("\n")}\nНапишите номер локации, и продолжу запись.`;
              d.time = null;
            } else {
              reply = "На выбранную дату слотов нет. Попробуйте другую дату.";
            }
          }
        }
      } else if (!d.mode) {
        reply = `Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}\n\nКак завершим запись?\n1) Сам в форме онлайн-записи.\n2) Оформить через ассистента.`;
      } else if (d.mode === "SELF") {
        nextAction = { type: "open_booking", bookingUrl: bookingUrl(publicSlug, d) };
        nextStatus = "READY_SELF";
        reply = "Открываю онлайн-запись с подставленными параметрами. Заполните имя и телефон и подтвердите запись.";
      } else if (!d.clientName || !d.clientPhone) {
        reply = "Для оформления через ассистента напишите имя и номер телефона клиента.";
      } else if (!d.consentConfirmedAt) {
        const links = requiredVersionIds.map((id) => `/${publicSlug}/legal/${id}`).join("\n");
        reply = `Для оформления нужно согласие на обработку персональных данных.\n${links || "Документы не настроены"}\nНапишите: «Согласен на обработку персональных данных».`;
      } else if (!/^(да|подтверждаю|согласен|ок)$/i.test(t)) {
        reply = `Проверьте данные:\n${bookingSummary(d, locations, services, specialists)}\nКлиент: ${d.clientName} ${d.clientPhone}\nЕсли все верно, напишите «да».`;
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
            prisma.scheduleEntry.findFirst({
              where: {
                accountId: resolved.account.id,
                specialistId: d.specialistId!,
                locationId: d.locationId!,
                date: { gte: day.dayStartUtc, lt: day.dayEndUtc },
                type: "WORKING",
              },
            }),
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
                where: {
                  accountId: resolved.account.id,
                  locationId: d.locationId!,
                  specialistId: d.specialistId!,
                  status: { notIn: ["CANCELLED", "NO_SHOW"] },
                  startAt: { lt: endAt },
                  endAt: { gt: startAt },
                },
                select: { id: true },
              });
              if (conflict) {
                reply = "Этот слот уже занят. Выберите другое время.";
              } else {
                const clientProfile = await prisma.client.findFirst({ where: { accountId: resolved.account.id, phone: d.clientPhone! }, select: { id: true, firstName: true } });
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
                  await prisma.legalAcceptance.createMany({
                    data: requiredVersionIds.map((v) => ({
                      accountId: resolved.account.id,
                      documentVersionId: v,
                      appointmentId: appt.id,
                      clientId,
                      source: "public_booking",
                      ip,
                      userAgent: ua,
                    })),
                  });
                }
                nextStatus = "COMPLETED";
                reply = `Запись оформлена.\n${bookingSummary(d, locations, services, specialists)}\nНомер записи: ${appt.id}.`;
              }
            }
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
}
