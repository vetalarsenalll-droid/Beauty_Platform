import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type DbManager = {
  userId: number;
  roleId: number;
  createdAt: Date;
  user: {
    email: string | null;
    phone: string | null;
    status: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
  role: { name: string };
};

function mapManager(item: DbManager) {
  return {
    id: item.userId,
    email: item.user.email,
    phone: item.user.phone,
    status: item.user.status,
    firstName: item.user.profile?.firstName ?? null,
    lastName: item.user.profile?.lastName ?? null,
    role: item.role.name,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.read");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const managerId = Number(id);
  if (!Number.isInteger(managerId)) {
    return jsonError(
      "INVALID_ID",
      "Некорректный идентификатор менеджера.",
      null,
      400
    );
  }

  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      accountId: auth.session.accountId,
      userId: managerId,
      role: { name: "MANAGER" },
    },
    include: { user: { include: { profile: true } }, role: true },
  });

  if (!assignment) {
    return jsonError("NOT_FOUND", "Менеджер не найден.", null, 404);
  }

  const response = jsonOk(mapManager(assignment as DbManager));
  return applyCrmAccessCookie(response, auth);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const managerId = Number(id);
  if (!Number.isInteger(managerId)) {
    return jsonError(
      "INVALID_ID",
      "Некорректный идентификатор менеджера.",
      null,
      400
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const firstName =
    body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName =
    body.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const email = body.email !== undefined ? String(body.email).trim() : undefined;
  const phone =
    body.phone !== undefined ? String(body.phone).trim() : undefined;
  const status =
    body.status !== undefined ? String(body.status).trim() : undefined;

  const hasChanges =
    firstName !== undefined ||
    lastName !== undefined ||
    email !== undefined ||
    phone !== undefined ||
    status !== undefined;

  if (!hasChanges) {
    return jsonError(
      "VALIDATION_FAILED",
      "Нет данных для обновления.",
      null,
      400
    );
  }

  if (firstName !== undefined && !firstName) {
    return jsonError(
      "VALIDATION_FAILED",
      "Имя обязательно.",
      { fields: [{ path: "firstName", issue: "required" }] },
      400
    );
  }

  if (email !== undefined && !email) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email обязателен.",
      { fields: [{ path: "email", issue: "required" }] },
      400
    );
  }

  if (status !== undefined && !["ACTIVE", "INVITED", "DISABLED"].includes(status)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный статус.",
      { fields: [{ path: "status", issue: "invalid" }] },
      400
    );
  }

  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      accountId: auth.session.accountId,
      userId: managerId,
      role: { name: "MANAGER" },
    },
    include: { user: { include: { profile: true } }, role: true },
  });

  if (!assignment) {
    return jsonError("NOT_FOUND", "Менеджер не найден.", null, 404);
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      if (email !== undefined || phone !== undefined || status !== undefined) {
        await tx.user.update({
          where: { id: assignment.userId },
          data: {
            email,
            phone,
            status,
          },
        });
      }

      if (firstName !== undefined || lastName !== undefined) {
        if (assignment.user.profile) {
          await tx.userProfile.update({
            where: { id: assignment.user.profile.id },
            data: {
              firstName: firstName ?? assignment.user.profile.firstName,
              lastName: lastName ?? assignment.user.profile.lastName,
            },
          });
        } else if (firstName) {
          await tx.userProfile.create({
            data: {
              userId: assignment.userId,
              firstName,
              lastName: lastName ?? null,
            },
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id: assignment.userId },
        include: { profile: true },
      });
    });

    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Обновил менеджера",
      targetType: "manager",
      targetId: assignment.userId,
      diffJson: {
        firstName,
        lastName,
        email,
        phone,
        status,
      },
    });

    const response = jsonOk({
      id: assignment.userId,
      email: updatedUser.email,
      phone: updatedUser.phone,
      status: updatedUser.status,
      firstName: updatedUser.profile?.firstName ?? null,
      lastName: updatedUser.profile?.lastName ?? null,
      role: assignment.role.name,
      createdAt: assignment.createdAt.toISOString(),
    });
    return applyCrmAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return jsonError(
        "DUPLICATE",
        "Email уже используется.",
        { field: "email" },
        409
      );
    }
    return jsonError(
      "SERVER_ERROR",
      "Не удалось обновить менеджера.",
      null,
      500
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.delete");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const managerId = Number(id);
  if (!Number.isInteger(managerId)) {
    return jsonError(
      "INVALID_ID",
      "Некорректный идентификатор менеджера.",
      null,
      400
    );
  }

  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      accountId: auth.session.accountId,
      userId: managerId,
      role: { name: "MANAGER" },
    },
  });

  if (!assignment) {
    return jsonError("NOT_FOUND", "Менеджер не найден.", null, 404);
  }

  await prisma.user.update({
    where: { id: managerId },
    data: { status: "DISABLED" },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Переместил менеджера в архив",
    targetType: "manager",
    targetId: managerId,
    diffJson: { status: "DISABLED" },
  });

  const response = jsonOk({ ok: true });
  return applyCrmAccessCookie(response, auth);
}