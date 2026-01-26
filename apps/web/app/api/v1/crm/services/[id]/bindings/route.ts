import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

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

function parseIdArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));
  return ids;
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

  const locationIds = body.locationIds ? parseIdArray(body.locationIds) : null;
  const specialistIds = body.specialistIds
    ? parseIdArray(body.specialistIds)
    : null;

  if ((body.locationIds && !locationIds) || (body.specialistIds && !specialistIds)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректные данные привязок.",
      null,
      400
    );
  }

  const auditDiff: Record<string, unknown> = {};

  await prisma.$transaction(async (tx) => {
    if (locationIds) {
      const validLocations = await tx.location.findMany({
        where: {
          accountId: auth.session.accountId,
          id: { in: locationIds },
        },
        select: { id: true },
      });
      const validIds = new Set(validLocations.map((item) => item.id));
      const existing = await tx.serviceLocation.findMany({
        where: { serviceId: service.id },
        select: { locationId: true },
      });
      const existingIds = new Set(existing.map((item) => item.locationId));
      const toCreate = [...validIds].filter((idValue) => !existingIds.has(idValue));
      const toDelete = [...existingIds].filter((idValue) => !validIds.has(idValue));

      if (toDelete.length > 0) {
        await tx.serviceLocation.deleteMany({
          where: { serviceId: service.id, locationId: { in: toDelete } },
        });
      }
      if (toCreate.length > 0) {
        await tx.serviceLocation.createMany({
          data: toCreate.map((locationId) => ({
            locationId,
            serviceId: service.id,
          })),
          skipDuplicates: true,
        });
      }
      auditDiff.locationIds = [...validIds];
    }

    if (specialistIds) {
      const validSpecialists = await tx.specialistProfile.findMany({
        where: {
          accountId: auth.session.accountId,
          id: { in: specialistIds },
        },
        select: { id: true },
      });
      const validIds = new Set(validSpecialists.map((item) => item.id));
      const existing = await tx.specialistService.findMany({
        where: { serviceId: service.id },
        select: { specialistId: true },
      });
      const existingIds = new Set(existing.map((item) => item.specialistId));
      const toCreate = [...validIds].filter((idValue) => !existingIds.has(idValue));
      const toDelete = [...existingIds].filter((idValue) => !validIds.has(idValue));

      if (toDelete.length > 0) {
        await tx.specialistService.deleteMany({
          where: { serviceId: service.id, specialistId: { in: toDelete } },
        });
      }
      if (toCreate.length > 0) {
        await tx.specialistService.createMany({
          data: toCreate.map((specialistId) => ({
            specialistId,
            serviceId: service.id,
          })),
          skipDuplicates: true,
        });
      }
      auditDiff.specialistIds = [...validIds];
    }
  });

  if (Object.keys(auditDiff).length > 0) {
    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Обновил привязки услуги",
      targetType: "service",
      targetId: service.id,
      diffJson: auditDiff,
    });
  }

  const response = jsonOk({ id: service.id, ...auditDiff });
  return applyCrmAccessCookie(response, auth);
}