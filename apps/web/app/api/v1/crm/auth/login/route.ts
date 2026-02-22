import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  getCrmAuthCookies,
  verifyPassword,
} from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    accountSlug?: string;
  } | null;

  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const accountSlug = String(body?.accountSlug ?? "").trim();

  if (!email || !password || !accountSlug) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email, пароль и аккаунт обязательны",
      { fields: ["email", "password", "accountSlug"] },
      400
    );
  }

  const limited = enforceRateLimit({
    request,
    scope: "auth:crm-login",
    limit: 12,
    windowMs: 10 * 60 * 1000,
    identity: `${accountSlug.toLowerCase()}:${email.toLowerCase()}`,
  });
  if (limited) return limited;

  const account = await prisma.account.findUnique({
    where: { slug: accountSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!account) {
    return jsonError(
      "INVALID_CREDENTIALS",
      "Неверный email или пароль",
      {},
      401
    );
  }

  const identity = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email },
    include: {
      user: {
        include: {
          roleAssignments: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
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

  if (identity.user.status !== "ACTIVE") {
    return jsonError("FORBIDDEN", "Пользователь заблокирован", {}, 403);
  }

  const passwordOk = await verifyPassword(
    password,
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

  const assignment = identity.user.roleAssignments.find(
    (item) => item.accountId === account.id
  );

  if (!assignment) {
    return jsonError("FORBIDDEN", "Нет доступа к аккаунту", {}, 403);
  }

  await prisma.userSession.deleteMany({
    where: {
      userId: identity.userId,
      sessionType: "CRM",
      accountId: account.id,
    },
  });

  const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } =
    await createSession({
      userId: identity.userId,
      sessionType: "CRM",
      accountId: account.id,
    });

  const cookieStore = await cookies();
  const { ACCESS_COOKIE, REFRESH_COOKIE } = getCrmAuthCookies();

  cookieStore.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: accessExpiresAt,
  });
  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: refreshExpiresAt,
  });

  const permissions =
    assignment.role.permissions.map(
      (rolePermission) => rolePermission.permission.key
    ) ?? [];

  return jsonOk({
    user: {
      id: identity.userId,
      email: identity.user.email ?? identity.email,
    },
    account,
    role: assignment.role.name,
    permissions,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  });
}
