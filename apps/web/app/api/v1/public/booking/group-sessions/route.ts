import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getNowInTimeZone,
  resolvePublicAccount,
  zonedDayRangeUtc,
} from "@/lib/public-booking";
import { parsePositiveInt } from "@/lib/public-booking";

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const tz = resolved.account.timeZone;
  const nowTz = getNowInTimeZone(tz);

  const { searchParams } = new URL(request.url);
  const locationId = parsePositiveInt(searchParams.get("locationId"));
  const serviceId = parsePositiveInt(searchParams.get("serviceId"));
  const specialistId = parsePositiveInt(searchParams.get("specialistId"));
  const dateValue = String(searchParams.get("date") ?? "").trim();

  if (!locationId || !dateValue) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  if (dateValue < nowTz.ymd) {
    return jsonOk({ date: dateValue, sessions: [] });
  }

  const range = zonedDayRangeUtc(dateValue, tz);
  if (!range) return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  const { dayStartUtc, dayEndUtc } = range;

  const sessions = await prisma.groupSession.findMany({
    where: {
      accountId: resolved.account.id,
      locationId,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
      status: { not: "CANCELLED" },
      ...(serviceId ? { serviceId } : {}),
      ...(specialistId ? { specialistId } : {}),
    },
    include: {
      service: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return jsonOk({
    date: dateValue,
    sessions: sessions.map((s) => ({
      id: s.id,
      serviceId: s.serviceId,
      serviceName: s.service.name,
      specialistId: s.specialistId,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      capacity: s.capacity,
      bookedCount: s.bookedCount,
      availableSeats: Math.max(0, s.capacity - s.bookedCount),
      pricePerClient: s.pricePerClient ? s.pricePerClient.toString() : null,
    })),
  });
}
