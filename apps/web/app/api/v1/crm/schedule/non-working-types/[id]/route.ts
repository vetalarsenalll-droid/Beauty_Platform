import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";

function parseId(param: string) {
  const id = Number(param);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireCrmApiPermission("crm.schedule.update");
  if ("response" in auth) return auth.response;

  const id = parseId(params.id);
  if (!id) {
    return jsonError("INVALID_ID", "Invalid non-working type id.", null, 400);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const color = body.color !== undefined ? String(body.color).trim() : undefined;
  const isArchived =
    body.isArchived !== undefined ? Boolean(body.isArchived) : undefined;

  const updated = await prisma.scheduleNonWorkingType.updateMany({
    where: { id, accountId: auth.session.accountId },
    data: {
      ...(name ? { name } : {}),
      ...(color ? { color } : {}),
      ...(isArchived !== undefined ? { isArchived } : {}),
    },
  });

  if (updated.count === 0) {
    return jsonError("NOT_FOUND", "Type not found.", null, 404);
  }

  const response = jsonOk({ id, name, color, isArchived });
  return applyCrmAccessCookie(response, auth);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireCrmApiPermission("crm.schedule.delete");
  if ("response" in auth) return auth.response;

  const id = parseId(params.id);
  if (!id) {
    return jsonError("INVALID_ID", "Invalid non-working type id.", null, 400);
  }

  await prisma.scheduleNonWorkingType.updateMany({
    where: { id, accountId: auth.session.accountId },
    data: { isArchived: true },
  });

  const response = jsonOk({ id, archived: true });
  return applyCrmAccessCookie(response, auth);
}
