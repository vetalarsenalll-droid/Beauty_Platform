import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { ScheduleEntryType } from "@prisma/client";
import { getLocationWorkWindowForDate, toMinutes } from "@/lib/public-booking";

type BreakPayload = { startTime: string; endTime: string };
type EntryTypeInput = ScheduleEntryType | "DELETE";

type EntryPayload = {
  specialistId: number;
  locationId?: number | null;
  date: string; // YYYY-MM-DD
  type: EntryTypeInput;
  customTypeId?: number | null;
  startTime?: string | null; // HH:mm
  endTime?: string | null; // HH:mm
  breaks?: BreakPayload[];
};

type ScheduleRequest = {
  entries: EntryPayload[];
  forceReplaceLocation?: boolean;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const toStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const toNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const isScheduleEntryType = (v: unknown): v is ScheduleEntryType =>
  typeof v === "string" &&
  (Object.values(ScheduleEntryType) as string[]).includes(v);

const isEntryTypeInput = (v: unknown): v is EntryTypeInput =>
  v === "DELETE" || isScheduleEntryType(v);

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

const HH_MM_RE = /^\d{2}:\d{2}$/;

function validateWorkingTimes(entry: EntryPayload) {
  if (entry.type !== "WORKING") return null;
  if (!entry.locationId) return "WORKING_LOCATION_REQUIRED";

  const start = entry.startTime ?? "";
  const end = entry.endTime ?? "";
  if (!HH_MM_RE.test(start) || !HH_MM_RE.test(end)) return "INVALID_WORKING_HOURS";

  const startM = toMinutes(start);
  const endM = toMinutes(end);
  if (startM == null || endM == null || startM >= endM) return "INVALID_WORKING_HOURS";

  const breaks = (entry.breaks ?? [])
    .map((item) => ({ start: toMinutes(item.startTime), end: toMinutes(item.endTime) }))
    .filter((item): item is { start: number; end: number } => item.start != null && item.end != null)
    .sort((a, b) => a.start - b.start);

  for (const br of breaks) {
    if (br.start >= br.end) return "INVALID_BREAKS";
    if (br.start < startM || br.end > endM) return "INVALID_BREAKS";
  }
  for (let i = 1; i < breaks.length; i += 1) {
    if (breaks[i - 1]!.end > breaks[i]!.start) return "INVALID_BREAKS";
  }

  return null;
}

function parseEntry(raw: unknown): EntryPayload | null {
  if (!isRecord(raw)) return null;

  const specialistId = toNum(raw.specialistId);
  const date = toStr(raw.date);
  const typeRaw = raw.type;

  if (!specialistId || !date || !isEntryTypeInput(typeRaw)) return null;

  const locationId = toNum(raw.locationId);
  const customTypeId = toNum(raw.customTypeId);

  const startTime = toStr(raw.startTime);
  const endTime = toStr(raw.endTime);

  const breaksRaw = Array.isArray(raw.breaks) ? raw.breaks : [];
  const breaks = breaksRaw
    .map((b) => {
      if (!isRecord(b)) return null;
      const bs = toStr(b.startTime);
      const be = toStr(b.endTime);
      if (!bs || !be) return null;
      return { startTime: bs, endTime: be };
    })
    .filter((x): x is BreakPayload => x !== null);

  const type: EntryTypeInput = typeRaw;

  return {
    specialistId,
    locationId: locationId ?? null,
    date,
    type,
    // customTypeId имеет смысл только при CUSTOM
    customTypeId: type === "CUSTOM" ? (customTypeId ?? null) : null,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    breaks,
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

  const locationIdParam = searchParams.get("locationId");
  const locationId = locationIdParam ? Number(locationIdParam) : null;
  if (locationIdParam && !Number.isInteger(locationId)) {
    return jsonError("INVALID_LOCATION", "Invalid locationId.", null, 400);
  }

  const specialistIdsParam = searchParams.getAll("specialistId");
  const specialistIds =
    specialistIdsParam.length > 0
      ? specialistIdsParam
          .flatMap((value) =>
            value
              .split(",")
              .map((item) => Number(item))
              .filter((item) => Number.isInteger(item))
          )
          .filter((n): n is number => typeof n === "number")
      : [];

  const entries = await prisma.scheduleEntry.findMany({
    where: {
      accountId: auth.session.accountId,
      date: { gte: startDate, lte: endDate },
      ...(specialistIds.length ? { specialistId: { in: specialistIds } } : {}),
      ...(locationIdParam ? { locationId } : {}),
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

  const body: unknown = await request.json().catch(() => null);
  if (!body) {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const forceReplaceLocation =
    isRecord(body) && typeof body.forceReplaceLocation === "boolean"
      ? body.forceReplaceLocation
      : false;

  const rawEntries =
    isRecord(body) && Array.isArray(body.entries) ? body.entries : [body];

  const entries: EntryPayload[] = rawEntries
    .map(parseEntry)
    .filter((x): x is EntryPayload => x !== null);

  if (entries.length === 0) {
    return jsonError("INVALID_BODY", "Entries are required.", null, 400);
  }

  for (const entry of entries) {
    if (!parseDate(entry.date)) {
      return jsonError("INVALID_DATE", "Некорректная дата. Используйте формат ГГГГ-ММ-ДД.", null, 400);
    }
    const timeError = validateWorkingTimes(entry);
    if (timeError === "WORKING_LOCATION_REQUIRED") {
      return jsonError("WORKING_LOCATION_REQUIRED", "Для рабочего дня обязательно выберите локацию.", null, 400);
    }
    if (timeError === "INVALID_WORKING_HOURS") {
      return jsonError("INVALID_WORKING_HOURS", "Некорректный интервал рабочего времени.", null, 400);
    }
    if (timeError === "INVALID_BREAKS") {
      return jsonError("INVALID_BREAKS", "Проверьте перерывы: они должны быть внутри рабочего времени и не пересекаться.", null, 400);
    }
  }

  const workingEntries = entries.filter((entry) => entry.type === "WORKING");
  if (workingEntries.length > 0) {
    const locationIds = Array.from(
      new Set(workingEntries.map((entry) => entry.locationId).filter((id): id is number => Number.isInteger(id)))
    );

    const locations = await prisma.location.findMany({
      where: { accountId: auth.session.accountId, id: { in: locationIds } },
      select: {
        id: true,
        hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
      },
    });
    const locationMap = new Map(locations.map((location) => [location.id, location]));

    for (const entry of workingEntries) {
      const locationId = entry.locationId as number;
      const location = locationMap.get(locationId);
      if (!location) {
        return jsonError("INVALID_LOCATION", "Локация не найдена.", null, 404);
      }

      const window = getLocationWorkWindowForDate(location, entry.date);
      if (window.isClosed) {
        return jsonError(
          "OUTSIDE_LOCATION_HOURS",
          "Нельзя поставить рабочий день: в локации выходной или закрыто по исключению на эту дату.",
          null,
          400
        );
      }

      const startM = toMinutes(entry.startTime ?? "");
      const endM = toMinutes(entry.endTime ?? "");
      if (
        startM == null ||
        endM == null ||
        startM < window.startMinutes ||
        endM > window.endMinutes
      ) {
        return jsonError(
          "OUTSIDE_LOCATION_HOURS",
          "Рабочее время сотрудника выходит за пределы режима работы локации с учетом исключений и праздников.",
          null,
          400
        );
      }
    }
  }

  const specialistIds = Array.from(new Set(entries.map((e) => e.specialistId)));

  const specialists = await prisma.specialistProfile.findMany({
    where: { accountId: auth.session.accountId, id: { in: specialistIds } },
    select: { id: true },
  });

  const validIds = new Set(specialists.map((s) => s.id));
  const invalid = specialistIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return jsonError(
      "INVALID_SPECIALIST",
      "Specialist not found.",
      { ids: invalid },
      404
    );
  }

  // ✅ НОВАЯ ЛОГИКА: запрет “перетирания” рабочего дня в другой локации
  const accountId = auth.session.accountId;

  if (!forceReplaceLocation) {
    const pairs = entries.map((entry) => {
      const date = parseDate(entry.date);
      if (!date) throw new Error("INVALID_DATE");
      return {
        specialistId: entry.specialistId,
        date,
        requestedLocationId: entry.locationId ?? null,
      };
    });

    const existingEntries = await prisma.scheduleEntry.findMany({
      where: {
        accountId,
        OR: pairs.map((pair) => ({
          specialistId: pair.specialistId,
          date: pair.date,
        })),
      },
      select: { specialistId: true, date: true, locationId: true },
    });

    const existingMap = new Map<string, { locationId: number | null }>();
    existingEntries.forEach((item) => {
      const key = `${item.specialistId}-${item.date.toISOString().slice(0, 10)}`;
      existingMap.set(key, { locationId: item.locationId ?? null });
    });

    const conflicts = pairs
      .map((pair) => {
        const key = `${pair.specialistId}-${pair.date.toISOString().slice(0, 10)}`;
        const existing = existingMap.get(key);
        if (!existing) return null;
        if ((existing.locationId ?? null) === pair.requestedLocationId) return null;
        return {
          specialistId: pair.specialistId,
          date: pair.date.toISOString().slice(0, 10),
          existingLocationId: existing.locationId ?? null,
          existingLocationName: "Другая локация",
          requestedLocationId: pair.requestedLocationId,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (conflicts.length > 0) {
      const locationIds = Array.from(
        new Set(conflicts.map((c) => c.existingLocationId).filter((id) => id !== null))
      ) as number[];
      const locations =
        locationIds.length > 0
          ? await prisma.location.findMany({
              where: { accountId, id: { in: locationIds } },
              select: { id: true, name: true },
            })
          : [];
      const locationMap = new Map(locations.map((l) => [l.id, l.name]));
      conflicts.forEach((conflict) => {
        if (conflict.existingLocationId == null) {
          conflict.existingLocationName = "Без локации";
          return;
        }
        conflict.existingLocationName =
          locationMap.get(conflict.existingLocationId) ?? "Другая локация";
      });

      const first = conflicts[0];
      return applyCrmAccessCookie(
        jsonError(
          "LOCATION_CONFLICT",
          `Нельзя сохранить: у специалиста уже есть график на ${first.date} в локации "${first.existingLocationName}".`,
          {
            conflicts,
            specialistId: first.specialistId,
            date: first.date,
            existingLocationId: first.existingLocationId,
            existingLocationName: first.existingLocationName,
            requestedLocationId: first.requestedLocationId,
          },
          409
        ),
        auth
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const date = parseDate(entry.date);
        if (!date) throw new Error("INVALID_DATE");

        const requestedLocationId = entry.locationId ?? null;

        // Ищем запись по уникальному ключу specialistId+date
        const existing = await tx.scheduleEntry.findFirst({
          where: {
            accountId,
            specialistId: entry.specialistId,
            date,
          },
          select: { id: true, locationId: true },
        });

        // ✅ DELETE: удаляем только если запись в ЭТОЙ локации
        if (entry.type === "DELETE") {
          if (!existing) continue;

          if ((existing.locationId ?? null) !== requestedLocationId) {
            if (!forceReplaceLocation) {
              const existingLoc =
                existing.locationId == null
                  ? null
                  : await tx.location.findFirst({
                      where: { accountId, id: existing.locationId },
                      select: { id: true, name: true },
                    });

              throw {
                kind: "LOCATION_CONFLICT",
                specialistId: entry.specialistId,
                date: entry.date,
                existingLocationId: existing.locationId,
                existingLocationName:
                  existing.locationId == null
                    ? "Без локации"
                    : existingLoc?.name ?? "Другая локация",
                requestedLocationId,
              };
            }

            await tx.scheduleEntry.deleteMany({
              where: {
                accountId,
                specialistId: entry.specialistId,
                date,
              },
            });

            continue;
          }

          await tx.scheduleEntry.deleteMany({
            where: {
              accountId,
              specialistId: entry.specialistId,
              date,
              locationId: requestedLocationId,
            },
          });

          continue;
        }

        // ✅ Любой НЕ-DELETE: если уже есть запись на дату и локация отличается — конфликт
        if (existing && (existing.locationId ?? null) !== requestedLocationId) {
          if (!forceReplaceLocation) {
            const existingLoc =
              existing.locationId == null
                ? null
                : await tx.location.findFirst({
                    where: { accountId, id: existing.locationId },
                    select: { id: true, name: true },
                  });

            throw {
              kind: "LOCATION_CONFLICT",
              specialistId: entry.specialistId,
              date: entry.date,
              existingLocationId: existing.locationId,
              existingLocationName:
                existing.locationId == null
                  ? "Без локации"
                  : existingLoc?.name ?? "Другая локация",
              requestedLocationId,
            };
          }

          // forceReplaceLocation: удаляем запись в другой локации перед upsert
          await tx.scheduleEntry.deleteMany({
            where: {
              accountId,
              specialistId: entry.specialistId,
              date,
            },
          });
        }

        // дальше обычный upsert (но только если нет конфликта)
        const dbType: ScheduleEntryType = entry.type;
        const isWorking = dbType === ScheduleEntryType.WORKING;

        const startTime = isWorking ? entry.startTime ?? null : null;
        const endTime = isWorking ? entry.endTime ?? null : null;
        const breaks = isWorking ? entry.breaks ?? [] : [];
        const customTypeId =
          dbType === ScheduleEntryType.CUSTOM ? entry.customTypeId ?? null : null;

        await tx.scheduleEntry.upsert({
          where: {
            specialistId_date: {
              specialistId: entry.specialistId,
              date,
            },
          },
          create: {
            accountId,
            specialistId: entry.specialistId,
            locationId: requestedLocationId,
            date,
            type: dbType,
            customTypeId,
            startTime,
            endTime,
            breaks: {
              create: breaks.map((b) => ({
                startTime: b.startTime,
                endTime: b.endTime,
              })),
            },
          },
          update: {
            locationId: requestedLocationId,
            type: dbType,
            customTypeId,
            startTime,
            endTime,
            breaks: {
              deleteMany: {},
              create: breaks.map((b) => ({
                startTime: b.startTime,
                endTime: b.endTime,
              })),
            },
          },
        });
      }
    });

    const response = jsonOk({ updated: entries.length });
    return applyCrmAccessCookie(response, auth);
  } catch (err: any) {
    if (err?.kind === "LOCATION_CONFLICT") {
      return applyCrmAccessCookie(
        jsonError(
          "LOCATION_CONFLICT",
          `Нельзя сохранить: у специалиста уже есть график на ${err.date} в локации "${err.existingLocationName}".`,
          {
            specialistId: err.specialistId,
            date: err.date,
            existingLocationId: err.existingLocationId,
            existingLocationName: err.existingLocationName,
            requestedLocationId: err.requestedLocationId,
          },
          409
        ),
        auth
      );
    }
    throw err;
  }
}
