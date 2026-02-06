import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

function hashPassword(password: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  return crypto.scryptSync(password, salt, 32).toString("hex");
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

  const emailRaw = (body as { email?: string }).email;
  const passwordRaw = (body as { password?: string }).password;
  const roleIdRaw = (body as { roleId?: number }).roleId;

  const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";
  const roleId = roleIdRaw !== undefined ? Number(roleIdRaw) : null;

  if (!email) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email обязателен.",
      null,
      400
    );
  }

  if (password && password.length < 6) {
    return jsonError(
      "VALIDATION_FAILED",
      "Пароль должен быть не короче 6 символов.",
      null,
      400
    );
  }

  if (roleId === null) {
    return jsonError(
      "VALIDATION_FAILED",
      "Роль обязательна.",
      null,
      400
    );
  }

  if (roleId && !Number.isInteger(roleId)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректная роль.",
      null,
      400
    );
  }

  const role = roleId
    ? await prisma.role.findFirst({
        where: { id: roleId, accountId: auth.session.accountId },
      })
    : null;

  if (roleId && !role) {
    return jsonError("NOT_FOUND", "Роль не найдена.", null, 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: auth.session.userId },
      data: { email },
    });

    const identity = await tx.userIdentity.findFirst({
      where: {
        userId: auth.session.userId,
        provider: "EMAIL",
      },
    });

    if (password) {
      const saltHex = crypto.randomBytes(16).toString("hex");
      const passwordHash = hashPassword(password, saltHex);

      if (identity) {
        await tx.userIdentity.update({
          where: { id: identity.id },
          data: {
            email,
            passwordHash,
            passwordSalt: saltHex,
            passwordAlgo: "scrypt",
            passwordUpdatedAt: new Date(),
          },
        });
      } else {
        await tx.userIdentity.create({
          data: {
            userId: auth.session.userId,
            provider: "EMAIL",
            email,
            passwordHash,
            passwordSalt: saltHex,
            passwordAlgo: "scrypt",
            passwordUpdatedAt: new Date(),
          },
        });
      }
    } else if (identity && identity.email !== email) {
      await tx.userIdentity.update({
        where: { id: identity.id },
        data: { email },
      });
    }

    await tx.roleAssignment.upsert({
      where: {
        userId_accountId: {
          userId: auth.session.userId,
          accountId: auth.session.accountId,
        },
      },
      create: {
        userId: auth.session.userId,
        accountId: auth.session.accountId,
        roleId,
      },
      update: { roleId },
    });

    return {
      id: user.id,
      email: user.email ?? email,
      roleId: roleId ?? null,
    };
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил пользователя",
    targetType: "user",
    targetId: auth.session.userId,
    diffJson: { email, roleId, passwordUpdated: Boolean(password) },
  });

  const response = jsonOk(updated);
  return applyCrmAccessCookie(response, auth);
}
