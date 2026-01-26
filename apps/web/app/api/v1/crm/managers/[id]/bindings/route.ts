import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

function parseManagerId(raw: string) {
  const managerId = Number(raw);
  if (!Number.isInteger(managerId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id менеджера.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { managerId };
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
  const parsed = parseManagerId(id);
  if ("error" in parsed) return parsed.error;

  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      accountId: auth.session.accountId,
      userId: parsed.managerId,
      role: { name: "MANAGER" },
    },
  });

  if (!assignment) {
    return jsonError("NOT_FOUND", "Менеджер не найден.", null, 404);
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

  if (body.locationIds && !locationIds) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректные данные привязок.",
      null,
      400
    );
  }

  if (!locationIds) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте список локаций.",
      null,
      400
    );
  }

  const validLocations = await prisma.location.findMany({
    where: {
      accountId: auth.session.accountId,
      id: { in: locationIds },
    },
    select: { id: true },
  });
  const validIds = new Set(validLocations.map((item) => item.id));
  const existing = await prisma.locationManager.findMany({
    where: { accountId: auth.session.accountId, userId: assignment.userId },
    select: { locationId: true },
  });
  const existingIds = new Set(existing.map((item) => item.locationId));
  const toCreate = [...validIds].filter((idValue) => !existingIds.has(idValue));
  const toDelete = [...existingIds].filter((idValue) => !validIds.has(idValue));

  await prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.locationManager.deleteMany({
        where: {
          accountId: auth.session.accountId,
          userId: assignment.userId,
          locationId: { in: toDelete },
        },
      });
    }
    if (toCreate.length > 0) {
      await tx.locationManager.createMany({
        data: toCreate.map((locationId) => ({
          accountId: auth.session.accountId,
          userId: assignment.userId,
          locationId,
        })),
        skipDuplicates: true,
      });
    }
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил привязки менеджера",
    targetType: "manager",
    targetId: assignment.userId,
    diffJson: { locationIds: [...validIds] },
  });

  const response = jsonOk({ id: assignment.userId, locationIds: [...validIds] });
  return applyCrmAccessCookie(response, auth);
}