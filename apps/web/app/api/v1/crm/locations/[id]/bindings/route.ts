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

function parseIdArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));
  return ids;
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

  const serviceIds = body.serviceIds ? parseIdArray(body.serviceIds) : null;
  const specialistIds = body.specialistIds
    ? parseIdArray(body.specialistIds)
    : null;
  const managerUserIds = body.managerUserIds
    ? parseIdArray(body.managerUserIds)
    : null;

  if (
    (body.serviceIds && !serviceIds) ||
    (body.specialistIds && !specialistIds) ||
    (body.managerUserIds && !managerUserIds)
  ) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный формат привязок.",
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
      const existing = await tx.serviceLocation.findMany({
        where: { locationId: location.id },
        select: { serviceId: true },
      });
      const existingIds = new Set(existing.map((item) => item.serviceId));
      const toCreate = [...validIds].filter((id) => !existingIds.has(id));
      const toDelete = [...existingIds].filter((id) => !validIds.has(id));

      if (toDelete.length > 0) {
        await tx.serviceLocation.deleteMany({
          where: { locationId: location.id, serviceId: { in: toDelete } },
        });
      }
      if (toCreate.length > 0) {
        await tx.serviceLocation.createMany({
          data: toCreate.map((serviceId) => ({
            serviceId,
            locationId: location.id,
          })),
          skipDuplicates: true,
        });
      }
      auditDiff.serviceIds = [...validIds];
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
      const existing = await tx.specialistLocation.findMany({
        where: { locationId: location.id },
        select: { specialistId: true },
      });
      const existingIds = new Set(existing.map((item) => item.specialistId));
      const toCreate = [...validIds].filter((id) => !existingIds.has(id));
      const toDelete = [...existingIds].filter((id) => !validIds.has(id));

      if (toDelete.length > 0) {
        await tx.specialistLocation.deleteMany({
          where: { locationId: location.id, specialistId: { in: toDelete } },
        });
      }
      if (toCreate.length > 0) {
        await tx.specialistLocation.createMany({
          data: toCreate.map((specialistId) => ({
            specialistId,
            locationId: location.id,
          })),
          skipDuplicates: true,
        });
      }
      auditDiff.specialistIds = [...validIds];
    }

    if (managerUserIds) {
      const validManagers = await tx.roleAssignment.findMany({
        where: {
          accountId: auth.session.accountId,
          userId: { in: managerUserIds },
          role: { name: { in: ["OWNER", "MANAGER"] } },
        },
        select: { userId: true },
      });
      const validIds = new Set(validManagers.map((item) => item.userId));
      const existing = await tx.locationManager.findMany({
        where: { locationId: location.id },
        select: { userId: true },
      });
      const existingIds = new Set(existing.map((item) => item.userId));
      const toCreate = [...validIds].filter((id) => !existingIds.has(id));
      const toDelete = [...existingIds].filter((id) => !validIds.has(id));

      if (toDelete.length > 0) {
        await tx.locationManager.deleteMany({
          where: { locationId: location.id, userId: { in: toDelete } },
        });
      }
      if (toCreate.length > 0) {
        await tx.locationManager.createMany({
          data: toCreate.map((userId) => ({
            userId,
            locationId: location.id,
            accountId: auth.session.accountId,
          })),
          skipDuplicates: true,
        });
      }
      auditDiff.managerUserIds = [...validIds];
    }
  });

  if (Object.keys(auditDiff).length > 0) {
    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Обновил привязки локации",
      targetType: "location",
      targetId: location.id,
      diffJson: auditDiff,
    });
  }

  const response = jsonOk({ id: location.id, ...auditDiff });
  return applyCrmAccessCookie(response, auth);
}
