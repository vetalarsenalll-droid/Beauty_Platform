// apps/web/lib/public-booking.ts
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";

export type PublicAccount = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
};

type ResolveResult =
  | { account: PublicAccount; response?: undefined }
  | { account?: undefined; response: Response };

function normalizeHost(host: string | null) {
  if (!host) return "";
  const value = host.split(",")[0]?.trim().toLowerCase();
  return value ? value.replace(/:\d+$/, "") : "";
}

export async function resolvePublicAccount(request: Request): Promise<ResolveResult> {
  const { searchParams } = new URL(request.url);
  const accountSlug = String(searchParams.get("account") ?? "").trim();
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = normalizeHost(hostHeader);

  let account =
    accountSlug.length > 0
      ? await prisma.account.findFirst({
          where: { slug: accountSlug, status: "ACTIVE" },
          select: { id: true, name: true, slug: true, timeZone: true },
        })
      : null;

  if (!account && host && host !== "localhost" && host !== "127.0.0.1") {
    const domain = await prisma.accountDomain.findFirst({
      where: { domain: host },
      include: { account: true },
    });

    if (domain?.account?.status === "ACTIVE") {
      account = {
        id: domain.account.id,
        name: domain.account.name,
        slug: domain.account.slug,
        timeZone: domain.account.timeZone,
      };
    }
  }

  if (!account) {
    return {
      response: jsonError("ACCOUNT_NOT_FOUND", "Аккаунт не найден.", null, 404),
    };
  }

  return { account };
}

// ---------------- BASIC HELPERS ----------------

export function parseUtcDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function toMinutes(value: string) {
  const [h, m] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Legacy: локальные минуты через Date.getHours() в TZ окружения.
 * В новых местах используйте toZonedLocalMinutes(date, accountTz).
 */
export function toLocalMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

// ---------------- TZ HELPERS ----------------

export type ZonedNow = { ymd: string; minutes: number };

/**
 * Текущее "YYYY-MM-DD" и минуты в сутках в заданной TZ.
 * ВАЖНО: защищаемся от кейса, когда Intl возвращает hour="24" (24:00),
 * иначе может возникнуть сдвиг дня на +1.
 */
export function getNowInTimeZone(timeZone: string): ZonedNow {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });

    const parts = fmt.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";

    let hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

    if (hh === 24) hh = 0;

    const minutes =
      (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);

    return { ymd: `${y}-${m}-${d}`, minutes };
  } catch {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return { ymd: `${y}-${m}-${d}`, minutes: now.getHours() * 60 + now.getMinutes() };
  }
}

/**
 * Минуты в сутках в заданной TZ для произвольного Date(UTC).
 * ВАЖНО: защищаемся от hour="24".
 */
export function toZonedLocalMinutes(date: Date, timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });

    const parts = fmt.formatToParts(date);
    let hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

    if (hh === 24) hh = 0;

    return (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

function parseYmd(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, mo, d };
}

function parseHm(time: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function formatInTimeZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = fmt.formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const mo = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const d = Number(parts.find((p) => p.type === "day")?.value ?? "1");

  let hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  if (hh === 24) hh = 0;

  return { y, mo, d, hh, mm };
}

function addDaysYmd(ymd: string, days: number) {
  const d = parseYmd(ymd);
  if (!d) return null;

  // mid-day safe для математики дат (DST edge)
  const base = new Date(Date.UTC(d.y, d.mo - 1, d.d, 12, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);

  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const da = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/**
 * Конвертация "локального времени в TZ" -> Date(UTC).
 * Без внешних библиотек, с итерацией для корректной поправки offset/DST.
 */
export function zonedTimeToUtc(ymd: string, time: string, timeZone: string): Date | null {
  const d = parseYmd(ymd);
  const t = parseHm(time);
  if (!d || !t) return null;

  // initial guess: как будто это UTC
  let guess = new Date(Date.UTC(d.y, d.mo - 1, d.d, t.hh, t.mm, 0, 0));

  // 2-3 итерации обычно достаточно (DST)
  for (let i = 0; i < 3; i++) {
    const z = formatInTimeZone(guess, timeZone);

    const desiredUtc = Date.UTC(d.y, d.mo - 1, d.d, t.hh, t.mm, 0, 0);
    const actualAsUtc = Date.UTC(z.y, z.mo - 1, z.d, z.hh, z.mm, 0, 0);

    const diff = actualAsUtc - desiredUtc;
    if (Math.abs(diff) < 1000) return guess;

    guess = new Date(guess.getTime() - diff);
  }

  return guess;
}

/**
 * Диапазон суток [00:00, 00:00 следующего дня) в UTC по локальной дате в TZ.
 */
export function zonedDayRangeUtc(ymd: string, timeZone: string) {
  const start = zonedTimeToUtc(ymd, "00:00", timeZone);
  const nextYmd = addDaysYmd(ymd, 1);
  const end = nextYmd ? zonedTimeToUtc(nextYmd, "00:00", timeZone) : null;
  if (!start || !end) return null;
  return { dayStartUtc: start, dayEndUtc: end };
}

/**
 * true если дата/время в прошлом относительно TZ.
 */
export function isPastDateOrTimeInTz(ymd: string, time: string, timeZone: string) {
  const now = getNowInTimeZone(timeZone);
  if (ymd < now.ymd) return true;
  if (ymd > now.ymd) return false;
  const mins = toMinutes(time);
  if (mins == null) return false;
  return mins <= now.minutes;
}

/**
 * Парсит положительный int из query param.
 * null если отсутствует/некорректен.
 */
export function parsePositiveInt(value: string | null) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

const SLOT_STEP_ALLOWED = new Set([5, 10, 15, 20, 30]);

export async function getAccountSlotStepMinutes(accountId: number) {
  const setting = await prisma.accountSetting.findUnique({
    where: { accountId },
    select: { slotStepMinutes: true },
  });

  const value = setting?.slotStepMinutes ?? 15;
  return SLOT_STEP_ALLOWED.has(value) ? value : 15;
}
