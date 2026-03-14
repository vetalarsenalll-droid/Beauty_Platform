import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  getClientAuthCookies,
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

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const accountSlug = String(body?.accountSlug ?? "").trim();

  if (!email || !password) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email и пароль обязательны",
      { fields: ["email", "password"] },
      400
    );
  }

  const limited = enforceRateLimit({
    request,
    scope: "auth:client-login",
    limit: 12,
    windowMs: 10 * 60 * 1000,
    identity: `${accountSlug.toLowerCase()}:${email}`,
  });
  if (limited) return limited;

  const account = accountSlug
    ? await prisma.account.findUnique({
        where: { slug: accountSlug },
        select: { id: true, name: true, slug: true },
      })
    : null;

  if (accountSlug && !account) {
    return jsonError(
      "INVALID_CREDENTIALS",
      "Неверный email или пароль",
      {},
      401
    );
  }

  const identity = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email },
    include: { user: true },
  });

  if (!identity || !identity.passwordHash || !identity.passwordSalt || !identity.user) {
    return jsonError("INVALID_CREDENTIALS", "Неверный email или пароль", {}, 401);
  }

  if (identity.user.status !== "ACTIVE") {
    return jsonError("FORBIDDEN", "Пользователь заблокирован", {}, 403);
  }

  if (identity.user.type !== "CLIENT") {
    return jsonError("FORBIDDEN", "Пользователь не является клиентом", {}, 403);
  }

  const passwordOk = await verifyPassword(
    password,
    identity.passwordSalt,
    identity.passwordHash
  );

  if (!passwordOk) {
    return jsonError("INVALID_CREDENTIALS", "Неверный email или пароль", {}, 401);
  }

  await prisma.userSession.deleteMany({
    where: {
      userId: identity.userId,
      sessionType: "CLIENT",
    },
  });

  if (account) {
    const existingClient = await prisma.client.findFirst({
      where: { accountId: account.id, userId: identity.userId },
    });
    if (!existingClient) {
      await prisma.client.create({
        data: {
          accountId: account.id,
          userId: identity.userId,
          email: identity.email ?? identity.user.email ?? email,
          phone: identity.user.phone ?? null,
        },
      });
    }
  }

  const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } =
    await createSession({
      userId: identity.userId,
      sessionType: "CLIENT",
      accountId: null,
    });

  const cookieStore = await cookies();
  const { ACCESS_COOKIE, REFRESH_COOKIE } = getClientAuthCookies();

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

  return jsonOk({
    user: {
      id: identity.userId,
      email: identity.user.email ?? identity.email,
    },
    account,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  });
}
