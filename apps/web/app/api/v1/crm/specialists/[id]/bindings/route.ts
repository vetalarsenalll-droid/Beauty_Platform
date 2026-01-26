import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

function parseSpecialistId(raw: string) {
  const specialistId = Number(raw);
  if (!Number.isInteger(specialistId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id специалиста.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { specialistId };
}

function parseIdArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));
  return ids;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseSpecialistId(id);
  if ("error" in parsed) return parsed.error;

  const specialist = await prisma.specialistProfile.findUnique({
    where: { id: parsed.specialistId },
  });

  if (!specialist || specialist.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Специалист не найден.", null, 404);
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

  const serviceIds = body.serviceIds ? parseIdArray(body.serviceIds) : null;
  const locationIds = body.locationIds ? parseIdArray(body.locationIds) : null;

  if ((body.serviceIds && !serviceIds) || (body.locationIds && !locationIds)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректные данные привязок.",
      null,
      400
    );
  }

  const auditDiff: Record<string, unknown> = {};

  await prisma.$transaction(async (tx) => {
    if (serviceIds) {
      const validServices = await tx.service.findMany({
        where: {
          accountId: auth.session.accountId,
          id: { in: serviceIds },
        },
        select: { id: true },
      });
      const validIds = new Set(validServices.map((item) => item.id));
      const existing = await tx.specialistService.findMany({
        where: { specialistId: specialist.id },
        select: { serviceId: true },
      });
      const existingIds = new Set(existing.map((item) => item.serviceId));
      const toCreate = [...validIds].filter((idValue) => !existingIds.has(idValue));
      const toDelete = [...existingIds].filter((idValue) => !validIds.has(idValue));

      if (toDelete.length > 0) {
        await tx.specialistService.deleteMany({
          where: { specialistId: specialist.id, serviceId: { in: toDelete } },
        });
      }
      if (toCreate.length > 0) {
        await tx.specialistService.createMany({
          data: toCreate.map((serviceId) => ({
            serviceId,
            specialistId: specialist.id,
          })),
          skipDuplicates: true,
        });
      }
      auditDiff.serviceIds = [...validIds];
    }

    if (locationIds) {
      const validLocations = await tx.location.findMany({
        where: {
          accountId: auth.session.accountId,
          id: { in: locationIds },
        },
        select: { id: true },
      });
      const validIds = new Set(validLocations.map((item) => item.id));
      const existing = await tx.specialistLocation.findMany({
        where: { specialistId: specialist.id },
        select: { locationId: true },
      });
      const existingIds = new Set(existing.map((item) => item.locationId));
      const toCreate = [...validIds].filter((idValue) => !existingIds.has(idValue));
      const toDelete = [...existingIds].filter((idValue) => !validIds.has(idValue));

      if (toDelete.length > 0) {
        await tx.specialistLocation.deleteMany({
          where: { specialistId: specialist.id, locationId: { in: toDelete } },
        });
      }
      if (toCreate.length > 0) {
        await tx.specialistLocation.createMany({
          data: toCreate.map((locationId) => ({
            locationId,
            specialistId: specialist.id,
          })),
          skipDuplicates: true,
        });
      }
      auditDiff.locationIds = [...validIds];
    }
  });

  if (Object.keys(auditDiff).length > 0) {
    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Обновил привязки специалиста",
      targetType: "specialist",
      targetId: specialist.id,
      diffJson: auditDiff,
    });
  }

  const response = jsonOk({ id: specialist.id, ...auditDiff });
  return applyCrmAccessCookie(response, auth);
}