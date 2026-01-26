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

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
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
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
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

  const cleaned: HourInput[] = [];

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
    cleaned.push({ dayOfWeek, startTime, endTime });
  }

  await prisma.$transaction([
    prisma.locationHour.deleteMany({ where: { locationId: location.id } }),
    cleaned.length > 0
      ? prisma.locationHour.createMany({
          data: cleaned.map((item) => ({
            locationId: location.id,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        })
      : prisma.locationHour.createMany({ data: [] }),
  ]);

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил режим работы локации",
    targetType: "location",
    targetId: location.id,
    diffJson: { hours: cleaned },
  });

  const response = jsonOk({ id: location.id, hours: cleaned });
  return applyCrmAccessCookie(response, auth);
}
