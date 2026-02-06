import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount, parseUtcDate } from "@/lib/public-booking";

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const { searchParams } = new URL(request.url);

  const locationId = Number(searchParams.get("locationId"));
  const start = String(searchParams.get("start") ?? "").trim(); // YYYY-MM-DD
  const days = Math.min(60, Math.max(1, Number(searchParams.get("days") ?? "30")));

  if (!Number.isInteger(locationId) || locationId <= 0 || !start) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  const dayStart = parseUtcDate(start);
  if (!dayStart) return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);

  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + days);

  // Проверяем локацию
  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  // Специалисты локации
  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
    },
    select: { id: true },
  });

  if (!specialists.length) return jsonOk({ specialistIds: [] });

  const specialistIds = specialists.map((s) => s.id);

  // ВАЖНО: только график этой локации (без locationId:null),
  // чтобы совпадало с твоим экраном "График работы" по выбранной локации.
  const entries = await prisma.scheduleEntry.findMany({
    where: {
      accountId: resolved.account.id,
      locationId,
      specialistId: { in: specialistIds },
      type: "WORKING",
      date: { gte: dayStart, lt: dayEnd },
    },
    select: { specialistId: true },
  });

  const set = new Set<number>(entries.map((e) => e.specialistId));
  return jsonOk({ specialistIds: Array.from(set) });
}
