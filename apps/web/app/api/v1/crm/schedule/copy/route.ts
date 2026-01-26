import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const toStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const toNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.schedule.create");
  if ("response" in auth) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return applyCrmAccessCookie(
      jsonError("INVALID_BODY", "Invalid request body.", null, 400),
      auth
    );
  }

  const accountId = auth.session.accountId;

  const locationId = toNum(body.locationId);
  const sourceSpecialistId = toNum(body.sourceSpecialistId);

  const targetSpecialistIds = (Array.isArray(body.targetSpecialistIds)
    ? body.targetSpecialistIds
    : []
  )
    .map(toNum)
    .filter((x): x is number => x !== null && Number.isInteger(x));

  const start = toStr(body.start);
  const end = toStr(body.end);
  const includeBreaks = body.includeBreaks !== false;

  if (
    !locationId ||
    !sourceSpecialistId ||
    targetSpecialistIds.length === 0 ||
    !start ||
    !end
  ) {
    return applyCrmAccessCookie(
      jsonError("INVALID_BODY", "Missing copy parameters.", null, 400),
      auth
    );
  }

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) {
    return applyCrmAccessCookie(
      jsonError("INVALID_RANGE", "Invalid date range.", null, 400),
      auth
    );
  }

  // Берём источник только по выбранной локации
  const sourceEntries = await prisma.scheduleEntry.findMany({
    where: {
      accountId,
      locationId,
      specialistId: sourceSpecialistId,
      date: { gte: startDate, lte: endDate },
    },
    include: { breaks: true },
    orderBy: { date: "asc" },
  });

  if (sourceEntries.length === 0) {
    return applyCrmAccessCookie(jsonOk({ copied: 0 }), auth);
  }

  // ✅ Проверка конфликтов: у target уже есть запись на эти даты в ДРУГОЙ локации
  // (учитываем уникальный ключ specialistId+date)
  const dates = sourceEntries.map((e) => e.date);

  const conflicts = await prisma.scheduleEntry.findMany({
    where: {
      accountId,
      specialistId: { in: targetSpecialistIds },
      date: { in: dates },
      // если запись не в этой локации — конфликт
      NOT: { locationId },
    },
    select: { specialistId: true, date: true, locationId: true },
  });

  if (conflicts.length > 0) {
    const locationIds = Array.from(
      new Set(conflicts.map((c) => c.locationId).filter((x): x is number => typeof x === "number"))
    );

    const locations = await prisma.location.findMany({
      where: { accountId, id: { in: locationIds } },
      select: { id: true, name: true },
    });

    const locMap = new Map<number, string>();
    locations.forEach((l) => locMap.set(l.id, l.name));

    const conflictDetails = conflicts.slice(0, 20).map((c) => ({
      specialistId: c.specialistId,
      date: c.date.toISOString().slice(0, 10),
      existingLocationId: c.locationId,
      existingLocationName:
        c.locationId ? locMap.get(c.locationId) ?? "Другая локация" : "Без локации",
    }));

    return applyCrmAccessCookie(
      jsonError(
        "LOCATION_CONFLICT",
        `Нельзя скопировать график: у некоторых специалистов уже есть график в другой локации в выбранный период.`,
        {
          locationId,
          conflictsCount: conflicts.length,
          conflicts: conflictDetails,
        },
        409
      ),
      auth
    );
  }

  // ✅ Копируем (в рамках выбранной локации), не трогая другие локации
  await prisma.$transaction(
    targetSpecialistIds.flatMap((targetId: number) => [
      prisma.scheduleEntry.deleteMany({
        where: {
          accountId,
          locationId,
          specialistId: targetId,
          date: { gte: startDate, lte: endDate },
        },
      }),
      ...sourceEntries.map((entry) =>
        prisma.scheduleEntry.create({
          data: {
            accountId,
            specialistId: targetId,
            locationId,
            date: entry.date,
            type: entry.type,
            customTypeId: entry.customTypeId,
            startTime: entry.startTime,
            endTime: entry.endTime,
            breaks: includeBreaks
              ? {
                  create: entry.breaks.map((item) => ({
                    startTime: item.startTime,
                    endTime: item.endTime,
                  })),
                }
              : undefined,
          },
        })
      ),
    ])
  );

  return applyCrmAccessCookie(jsonOk({ copied: sourceEntries.length }), auth);
}
