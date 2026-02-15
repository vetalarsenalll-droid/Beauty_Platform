import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

function parseLocationId(raw: string) {
  const locationId = Number(raw);
  if (!Number.isInteger(locationId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id локации.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { locationId };
}

type HourInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ExceptionInput = {
  date: string;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
};

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.locations.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseLocationId(id);
  if ("error" in parsed) return parsed.error;

  const location = await prisma.location.findUnique({
    where: { id: parsed.locationId },
  });

  if (!location || location.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const hours = Array.isArray(body.hours) ? body.hours : null;
  if (!hours) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте массив hours.",
      { fields: [{ path: "hours", issue: "required" }] },
      400
    );
  }

  const cleanedHours: HourInput[] = [];

  for (const item of hours) {
    if (!item || typeof item !== "object") {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный формат режима работы.",
        null,
        400
      );
    }
    const dayOfWeek = Number(item.dayOfWeek);
    const startTime = String(item.startTime ?? "");
    const endTime = String(item.endTime ?? "");

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      !isTime(startTime) ||
      !isTime(endTime)
    ) {
      return jsonError(
        "VALIDATION_FAILED",
        "Проверьте значения режима работы.",
        null,
        400
      );
    }

    if (startTime >= endTime) {
      return jsonError(
        "VALIDATION_FAILED",
        "Время начала рабочего дня должно быть раньше времени окончания.",
        null,
        400
      );
    }

    cleanedHours.push({ dayOfWeek, startTime, endTime });
  }

  const rawExceptions = body.exceptions;
  if (rawExceptions !== undefined && !Array.isArray(rawExceptions)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Если передаете exceptions, это должен быть массив.",
      { fields: [{ path: "exceptions", issue: "invalid" }] },
      400
    );
  }

  const cleanedExceptions: ExceptionInput[] = [];
  const seenDates = new Set<string>();

  for (const item of rawExceptions ?? []) {
    if (!item || typeof item !== "object") {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный формат исключения.",
        null,
        400
      );
    }

    const date = String(item.date ?? "").trim();
    const isClosed = Boolean(item.isClosed);
    const startTime = item.startTime == null ? null : String(item.startTime);
    const endTime = item.endTime == null ? null : String(item.endTime);

    if (!isDateOnly(date)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Проверьте дату исключения (формат YYYY-MM-DD).",
        null,
        400
      );
    }

    if (seenDates.has(date)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Для одной даты может быть только одно исключение.",
        null,
        400
      );
    }
    seenDates.add(date);

    if (!isClosed) {
      if (!startTime || !endTime || !isTime(startTime) || !isTime(endTime)) {
        return jsonError(
          "VALIDATION_FAILED",
          "Для рабочего праздничного дня укажите корректные startTime и endTime.",
          null,
          400
        );
      }

      if (startTime >= endTime) {
        return jsonError(
          "VALIDATION_FAILED",
          "В исключении время начала должно быть раньше времени окончания.",
          null,
          400
        );
      }
    }

    cleanedExceptions.push({
      date,
      isClosed,
      startTime: isClosed ? null : startTime,
      endTime: isClosed ? null : endTime,
    });
  }

  await prisma.$transaction([
    prisma.locationHour.deleteMany({ where: { locationId: location.id } }),
    cleanedHours.length > 0
      ? prisma.locationHour.createMany({
          data: cleanedHours.map((item) => ({
            locationId: location.id,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        })
      : prisma.locationHour.createMany({ data: [] }),
    prisma.locationException.deleteMany({ where: { locationId: location.id } }),
    cleanedExceptions.length > 0
      ? prisma.locationException.createMany({
          data: cleanedExceptions.map((item) => ({
            locationId: location.id,
            date: new Date(`${item.date}T00:00:00.000Z`),
            isClosed: item.isClosed,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        })
      : prisma.locationException.createMany({ data: [] }),
  ]);

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил режим работы локации",
    targetType: "location",
    targetId: location.id,
    diffJson: { hours: cleanedHours, exceptions: cleanedExceptions },
  });

  const response = jsonOk({
    id: location.id,
    hours: cleanedHours,
    exceptions: cleanedExceptions,
  });
  return applyCrmAccessCookie(response, auth);
}
