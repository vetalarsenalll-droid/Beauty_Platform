import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id)) return null;
  return id;
}

function parseBirthDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.clients.read");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const clientId = parseId(id);
  if (!clientId) {
    return jsonError("INVALID_ID", "Некорректный идентификатор клиента.", null, 400);
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId: auth.session.accountId },
  });

  if (!client) {
    return jsonError("NOT_FOUND", "Клиент не найден.", null, 404);
  }

  const response = jsonOk({
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    birthDate: client.birthDate ? client.birthDate.toISOString().slice(0, 10) : null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.clients.update");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const clientId = parseId(id);
  if (!clientId) {
    return jsonError("INVALID_ID", "Некорректный идентификатор клиента.", null, 400);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const firstName =
    body.firstName !== undefined ? String(body.firstName).trim() || null : undefined;
  const lastName =
    body.lastName !== undefined ? String(body.lastName).trim() || null : undefined;
  const phone =
    body.phone !== undefined ? normalizeRuPhone(String(body.phone).trim()) : undefined;
  const email =
    body.email !== undefined ? String(body.email).trim() || null : undefined;
  const birthDate =
    body.birthDate !== undefined ? parseBirthDate(body.birthDate) : undefined;
  if (birthDate === undefined && body.birthDate !== undefined) {
    return jsonError("VALIDATION_FAILED", "birthDate must be a valid date.", { field: "birthDate" }, 400);
  }

  const updated = await prisma.client.updateMany({
    where: { id: clientId, accountId: auth.session.accountId },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
    },
  });

  if (updated.count === 0) {
    return jsonError("NOT_FOUND", "Клиент не найден.", null, 404);
  }

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновлен клиент",
    targetType: "client",
    targetId: clientId,
    diffJson: { firstName, lastName, phone, email, birthDate: birthDate ? birthDate.toISOString().slice(0, 10) : birthDate },
  });

  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId: auth.session.accountId },
  });

  if (!client) {
    return jsonError("NOT_FOUND", "Клиент не найден.", null, 404);
  }

  const response = jsonOk({
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    birthDate: client.birthDate ? client.birthDate.toISOString().slice(0, 10) : null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.clients.delete");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const clientId = parseId(id);
  if (!clientId) {
    return jsonError("INVALID_ID", "Некорректный идентификатор клиента.", null, 400);
  }

  const deleted = await prisma.client.deleteMany({
    where: { id: clientId, accountId: auth.session.accountId },
  });

  if (deleted.count === 0) {
    return jsonError("NOT_FOUND", "Клиент не найден.", null, 404);
  }

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удален клиент",
    targetType: "client",
    targetId: clientId,
  });

  const response = jsonOk({ id: clientId });
  return applyCrmAccessCookie(response, auth);
}

