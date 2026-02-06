import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.settings.read");
  if ("response" in auth) return auth.response;

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { accountId: auth.session.accountId },
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
  ]);

  const response = jsonOk({
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissionKeys: role.permissions.map(
        (item) => item.permission.key
      ),
    })),
    permissions: permissions.map((permission) => ({
      id: permission.id,
      key: permission.key,
      description: permission.description ?? null,
    })),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function PATCH(request: Request) {
  const auth = await requireCrmApiPermission("crm.settings.read");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const roleId = Number((body as { roleId?: number }).roleId);
  const permissionKeys = Array.isArray(
    (body as { permissionKeys?: unknown }).permissionKeys
  )
    ? (body as { permissionKeys: unknown[] }).permissionKeys
        .map((item) => String(item))
        .filter(Boolean)
    : null;

  if (!Number.isInteger(roleId) || !permissionKeys) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте роль и список прав.",
      null,
      400
    );
  }

  const role = await prisma.role.findFirst({
    where: { id: roleId, accountId: auth.session.accountId },
  });

  if (!role) {
    return jsonError("NOT_FOUND", "Роль не найдена.", null, 404);
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });
  const permissionIds = permissions.map((item) => item.id);

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    }
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил права ролей",
    targetType: "role",
    targetId: roleId,
    diffJson: { roleId, permissionKeys },
  });

  const response = jsonOk({
    roleId,
    permissionKeys: permissions.map((item) => item.key),
  });
  return applyCrmAccessCookie(response, auth);
}
