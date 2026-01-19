import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email и пароль обязательны",
      { fields: ["email", "password"] },
      400
    );
  }

  const identity = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email: body.email },
    include: {
      user: {
        include: {
          platformAdmin: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (
    !identity ||
    !identity.passwordHash ||
    !identity.passwordSalt ||
    !identity.user
  ) {
    return jsonError(
      "INVALID_CREDENTIALS",
      "Неверный email или пароль",
      {},
      401
    );
  }

  const passwordOk = await verifyPassword(
    body.password,
    identity.passwordSalt,
    identity.passwordHash
  );

  if (!passwordOk) {
    return jsonError(
      "INVALID_CREDENTIALS",
      "Неверный email или пароль",
      {},
      401
    );
  }

  if (!identity.user.platformAdmin) {
    return jsonError(
      "FORBIDDEN",
      "Нет доступа к Platform Admin",
      {},
      403
    );
  }

  await prisma.userSession.deleteMany({
    where: { userId: identity.userId },
  });

  const { token, expiresAt } = await createSession(identity.userId);

  const cookieStore = await cookies();
  cookieStore.set("bp_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  const permissions =
    identity.user.platformAdmin.permissions.map(
      (assignment) => assignment.permission.key
    ) ?? [];

  return jsonOk({
    user: {
      id: identity.userId,
      email: identity.user.email ?? identity.email,
    },
    permissions,
    token,
    expiresAt: expiresAt.toISOString(),
  });
}
