import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

type LevelInput = {
  levelId: number;
  durationMin?: number | null;
  price?: string | null;
};

function parseServiceId(raw: string) {
  const serviceId = Number(raw);
  if (!Number.isInteger(serviceId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id услуги.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { serviceId };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.services.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseServiceId(id);
  if ("error" in parsed) return parsed.error;

  const service = await prisma.service.findUnique({
    where: { id: parsed.serviceId },
  });

  if (!service || service.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Услуга не найдена.", null, 404);
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

  const levels = Array.isArray(body.levels) ? body.levels : null;
  if (!levels) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте список уровней.",
      null,
      400
    );
  }

  const normalized: LevelInput[] = [];

  for (const item of levels) {
    if (!item || typeof item !== "object") {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный уровень.",
        null,
        400
      );
    }

    const levelId = Number(item.levelId);
    if (!Number.isInteger(levelId)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный уровень.",
        { fields: [{ path: "levelId", issue: "invalid" }] },
        400
      );
    }

    let durationMin: number | null = null;
    if (item.durationMin !== undefined && item.durationMin !== null && item.durationMin !== "") {
      const parsedDuration = Number(item.durationMin);
      if (!Number.isInteger(parsedDuration)) {
        return jsonError(
          "VALIDATION_FAILED",
          "Некорректная длительность уровня.",
          { fields: [{ path: "durationMin", issue: "invalid" }] },
          400
        );
      }
      durationMin = parsedDuration;
    }

    let price: Prisma.Decimal | null = null;
    if (item.price !== undefined && item.price !== null && String(item.price).trim() !== "") {
      try {
        price = new Prisma.Decimal(item.price);
      } catch {
        return jsonError(
          "VALIDATION_FAILED",
          "Некорректная цена уровня.",
          { fields: [{ path: "price", issue: "invalid" }] },
          400
        );
      }
    }

    if (durationMin === null && !price) {
      return jsonError(
        "VALIDATION_FAILED",
        "Уровень должен иметь цену или длительность.",
        null,
        400
      );
    }

    normalized.push({
      levelId,
      durationMin,
      price: price ? price.toString() : null,
    });
  }

  const levelIds = normalized.map((item) => item.levelId);
  const validLevels = await prisma.specialistLevel.findMany({
    where: {
      id: { in: levelIds },
      OR: [{ accountId: auth.session.accountId }, { accountId: null }],
    },
    select: { id: true },
  });
  const validIds = new Set(validLevels.map((level) => level.id));
  if (validIds.size !== levelIds.length) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некоторые уровни не найдены.",
      null,
      400
    );
  }

  const existing = await prisma.serviceLevelConfig.findMany({
    where: { serviceId: service.id },
  });
  const existingIds = new Set(existing.map((config) => config.levelId));

  await prisma.$transaction(async (tx) => {
    const toDelete = existing
      .filter((config) => !levelIds.includes(config.levelId))
      .map((config) => config.levelId);
    if (toDelete.length > 0) {
      await tx.serviceLevelConfig.deleteMany({
        where: { serviceId: service.id, levelId: { in: toDelete } },
      });
    }

    for (const item of normalized) {
      await tx.serviceLevelConfig.upsert({
        where: {
          serviceId_levelId: {
            serviceId: service.id,
            levelId: item.levelId,
          },
        },
        update: {
          durationMin: item.durationMin,
          price: item.price ? new Prisma.Decimal(item.price) : null,
        },
        create: {
          serviceId: service.id,
          levelId: item.levelId,
          durationMin: item.durationMin,
          price: item.price ? new Prisma.Decimal(item.price) : null,
        },
      });
    }
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил уровни услуги",
    targetType: "service",
    targetId: service.id,
    diffJson: { levels: normalized },
  });

  const response = jsonOk({ id: service.id });
  return applyCrmAccessCookie(response, auth);
}