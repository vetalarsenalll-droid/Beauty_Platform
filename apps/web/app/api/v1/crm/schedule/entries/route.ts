import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";

type EntryPayload = {
  specialistId: number;
  date: string;
  type: string;
  customTypeId?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  breaks?: { startTime: string; endTime: string }[];
};

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeEntry(entry: EntryPayload) {
  return {
    ...entry,
    startTime: entry.startTime ?? null,
    endTime: entry.endTime ?? null,
    breaks: entry.breaks ?? [],
  };
}

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.schedule.read");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return jsonError("INVALID_RANGE", "Missing start or end date.", null, 400);
  }

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) {
    return jsonError("INVALID_RANGE", "Invalid date range.", null, 400);
  }

  const specialistIdsParam = searchParams.getAll("specialistId");
  const specialistIds =
    specialistIdsParam.length > 0
      ? specialistIdsParam.flatMap((value) =>
          value
            .split(",")
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item))
        )
      : [];

  const entries = await prisma.scheduleEntry.findMany({
    where: {
      accountId: auth.session.accountId,
      date: { gte: startDate, lte: endDate },
      ...(specialistIds.length
        ? { specialistId: { in: specialistIds } }
        : {}),
    },
    include: { breaks: true, customType: true },
    orderBy: [{ date: "asc" }, { specialistId: "asc" }],
  });

  const response = jsonOk(
    entries.map((entry) => ({
      id: entry.id,
      specialistId: entry.specialistId,
      locationId: entry.locationId,
      date: entry.date.toISOString().slice(0, 10),
      type: entry.type,
      customTypeId: entry.customTypeId,
      startTime: entry.startTime,
      endTime: entry.endTime,
      breaks: entry.breaks.map((item) => ({
        startTime: item.startTime,
        endTime: item.endTime,
      })),
      customType: entry.customType
        ? {
            id: entry.customType.id,
            name: entry.customType.name,
            color: entry.customType.color,
          }
        : null,
    }))
  );
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.schedule.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const entries = Array.isArray(body.entries)
    ? body.entries.map(normalizeEntry)
    : [normalizeEntry(body as EntryPayload)];

  const toProcess = entries.filter(
    (entry) => entry.specialistId && entry.date
  );
  if (toProcess.length === 0) {
    return jsonError("INVALID_BODY", "Entries are required.", null, 400);
  }

  const specialistIds = Array.from(
    new Set(toProcess.map((entry) => Number(entry.specialistId)))
  );
  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: auth.session.accountId,
      id: { in: specialistIds },
    },
    select: { id: true },
  });

  const validIds = new Set(specialists.map((item) => item.id));
  const invalid = specialistIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return jsonError(
      "INVALID_SPECIALIST",
      "Specialist not found.",
      { ids: invalid },
      404
    );
  }

  const results = await prisma.$transaction(
    toProcess.map((entry) => {
      const date = parseDate(entry.date);
      if (!date) {
        throw new Error("INVALID_DATE");
      }
      if (entry.type === "DELETE") {
        return prisma.scheduleEntry.deleteMany({
          where: {
            accountId: auth.session.accountId,
            specialistId: Number(entry.specialistId),
            date,
          },
        });
      }

      const isWorking = entry.type === "WORKING";
      const startTime = isWorking ? entry.startTime ?? null : null;
      const endTime = isWorking ? entry.endTime ?? null : null;
      const breaks = isWorking ? entry.breaks ?? [] : [];
      const customTypeId =
        entry.type === "CUSTOM" ? entry.customTypeId ?? null : null;

      return prisma.scheduleEntry.upsert({
        where: {
          specialistId_date: {
            specialistId: Number(entry.specialistId),
            date,
          },
        },
        create: {
          accountId: auth.session.accountId,
          specialistId: Number(entry.specialistId),
          date,
          locationId: entry.locationId ?? null,
          type: entry.type,
          customTypeId,
          startTime,
          endTime,
          breaks: {
            create: breaks.map((item) => ({
              startTime: item.startTime,
              endTime: item.endTime,
            })),
          },
        },
        update: {
          locationId: entry.locationId ?? null,
          type: entry.type,
          customTypeId,
          startTime,
          endTime,
          breaks: {
            deleteMany: {},
            create: breaks.map((item) => ({
              startTime: item.startTime,
              endTime: item.endTime,
            })),
          },
        },
      });
    })
  );

  const response = jsonOk({ updated: results.length });
  return applyCrmAccessCookie(response, auth);
}
