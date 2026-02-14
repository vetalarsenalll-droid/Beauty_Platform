import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getNowInTimeZone,
  resolvePublicAccount,
  zonedDayRangeUtc,
} from "@/lib/public-booking";

function addDaysYmd(ymd: string, days: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const base = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);
  const ny = base.getUTCFullYear();
  const nmo = String(base.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(base.getUTCDate()).padStart(2, "0");
  return `${ny}-${nmo}-${nd}`;
}

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const tz = resolved.account.timeZone;
  const nowTz = getNowInTimeZone(tz);

  const { searchParams } = new URL(request.url);

  const locationId = Number(searchParams.get("locationId"));
  const startRaw = String(searchParams.get("start") ?? "").trim();
  const days = Math.min(60, Math.max(1, Number(searchParams.get("days") ?? "30")));

  if (!Number.isInteger(locationId) || locationId <= 0 || !startRaw) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  const safeStart = startRaw < nowTz.ymd ? nowTz.ymd : startRaw;
  const endYmd = addDaysYmd(safeStart, days);
  if (!endYmd) return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);

  const startRange = zonedDayRangeUtc(safeStart, tz);
  const endRange = zonedDayRangeUtc(endYmd, tz);
  if (!startRange || !endRange) {
    return jsonError("INVALID_DATE", "Некорректный диапазон дат.", null, 400);
  }

  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
    },
    select: { id: true },
  });

  if (!specialists.length) return jsonOk({ specialistIds: [] });

  const specialistIds = specialists.map((s) => s.id);

  const entries = await prisma.scheduleEntry.findMany({
    where: {
      accountId: resolved.account.id,
      locationId,
      specialistId: { in: specialistIds },
      type: "WORKING",
      date: { gte: startRange.dayStartUtc, lt: endRange.dayStartUtc },
    },
    select: { specialistId: true },
  });

  const set = new Set<number>(entries.map((e) => e.specialistId));
  return jsonOk({ specialistIds: Array.from(set) });
}