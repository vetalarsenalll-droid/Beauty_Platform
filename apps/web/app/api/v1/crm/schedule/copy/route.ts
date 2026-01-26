import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.schedule.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const sourceSpecialistId = Number(body.sourceSpecialistId);
  const targetSpecialistIds = Array.isArray(body.targetSpecialistIds)
    ? body.targetSpecialistIds.map((id: number) => Number(id))
    : [];
  const start = typeof body.start === "string" ? body.start : null;
  const end = typeof body.end === "string" ? body.end : null;
  const includeBreaks = body.includeBreaks !== false;

  if (!sourceSpecialistId || targetSpecialistIds.length === 0 || !start || !end) {
    return jsonError("INVALID_BODY", "Missing copy parameters.", null, 400);
  }

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) {
    return jsonError("INVALID_RANGE", "Invalid date range.", null, 400);
  }

  const sourceEntries = await prisma.scheduleEntry.findMany({
    where: {
      accountId: auth.session.accountId,
      specialistId: sourceSpecialistId,
      date: { gte: startDate, lte: endDate },
    },
    include: { breaks: true },
  });

  if (sourceEntries.length === 0) {
    const response = jsonOk({ copied: 0 });
    return applyCrmAccessCookie(response, auth);
  }

  await prisma.$transaction(
    targetSpecialistIds.flatMap((targetId) => [
      prisma.scheduleEntry.deleteMany({
        where: {
          accountId: auth.session.accountId,
          specialistId: targetId,
          date: { gte: startDate, lte: endDate },
        },
      }),
      ...sourceEntries.map((entry) =>
        prisma.scheduleEntry.create({
          data: {
            accountId: auth.session.accountId,
            specialistId: targetId,
            locationId: entry.locationId,
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

  const response = jsonOk({ copied: sourceEntries.length });
  return applyCrmAccessCookie(response, auth);
}
