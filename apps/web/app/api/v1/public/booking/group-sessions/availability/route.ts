import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getNowInTimeZone,
  parsePositiveInt,
  resolvePublicAccount,
  zonedDayRangeUtc,
} from "@/lib/public-booking";

const MAX_DAYS = 92;

function addDaysYmd(ymd: string, days: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const base = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function ymdInTimeZone(date: Date, timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const tz = resolved.account.timeZone;
  const nowTz = getNowInTimeZone(tz);

  const { searchParams } = new URL(request.url);
  const locationId = parsePositiveInt(searchParams.get("locationId"));
  const serviceId = parsePositiveInt(searchParams.get("serviceId"));
  const specialistId = parsePositiveInt(searchParams.get("specialistId"));
  const start = String(searchParams.get("start") ?? "").trim();
  const daysRaw = Number(searchParams.get("days"));
  const days = Number.isInteger(daysRaw) ? Math.max(1, Math.min(daysRaw, MAX_DAYS)) : 30;

  if (!locationId || !serviceId || !start) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  const endYmd = addDaysYmd(start, days);
  if (!endYmd) {
    return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  }

  const rangeStart = zonedDayRangeUtc(start, tz);
  const rangeEnd = zonedDayRangeUtc(endYmd, tz);
  if (!rangeStart || !rangeEnd) {
    return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  }

  if (endYmd < nowTz.ymd) {
    return jsonOk({ start, days: [] });
  }

  const sessions = await prisma.groupSession.findMany({
    where: {
      accountId: resolved.account.id,
      locationId,
      serviceId,
      startAt: { lt: rangeEnd.dayStartUtc },
      endAt: { gt: rangeStart.dayStartUtc },
      status: { not: "CANCELLED" },
      ...(specialistId ? { specialistId } : {}),
    },
    select: {
      startAt: true,
      endAt: true,
      capacity: true,
      bookedCount: true,
    },
  });

  const availableDates = new Set<string>();
  for (const session of sessions) {
    if (session.bookedCount >= session.capacity) continue;
    const startYmd = ymdInTimeZone(session.startAt, tz);
    const endYmdSession = ymdInTimeZone(session.endAt, tz);
    availableDates.add(startYmd);
    if (endYmdSession !== startYmd) {
      availableDates.add(endYmdSession);
    }
  }

  const list: Array<{ date: string }> = [];
  for (let i = 0; i < days; i += 1) {
    const ymd = addDaysYmd(start, i);
    if (!ymd) continue;
    if (availableDates.has(ymd)) {
      list.push({ date: ymd });
    }
  }

  return jsonOk({ start, days: list });
}
