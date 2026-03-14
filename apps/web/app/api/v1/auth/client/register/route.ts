import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession, getClientAuthCookies } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeRuPhone } from "@/lib/phone";

function hashPassword(password: string, saltHex: string) {
  const salt = Buffer.from(saltHex, "hex");
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    accountSlug?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  } | null;

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const accountSlug = String(body?.accountSlug ?? "").trim();
  const firstName = String(body?.firstName ?? "").trim() || null;
  const lastName = String(body?.lastName ?? "").trim() || null;
  const phone = normalizeRuPhone(String(body?.phone ?? "").trim());

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
    scope: "auth:client-register",
    limit: 8,
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
      "REGISTRATION_FAILED",
      "Не удалось завершить регистрацию",
      {},
      400
    );
  }

  const existingIdentity = await prisma.userIdentity.findFirst({
    where: { provider: "EMAIL", email },
    include: { user: true },
  });

  if (existingIdentity) {
    return jsonError(
      "REGISTRATION_FAILED",
      "Не удалось завершить регистрацию",
      {},
      400
    );
  }

  const saltHex = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, saltHex);

  const user = await prisma.user.create({
    data: {
      email,
      type: "CLIENT",
      identities: {
        create: {
          provider: "EMAIL",
          email,
          passwordHash,
          passwordSalt: saltHex,
          passwordAlgo: "scrypt",
        },
      },
    },
  });

  const client = account
    ? await prisma.client.create({
        data: {
          accountId: account.id,
          userId: user.id,
          firstName,
          lastName,
          phone,
          email,
        },
      })
    : null;

  const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } =
    await createSession({
      userId: user.id,
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
    user: { id: user.id, email: user.email },
    client: client
      ? {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          phone: client.phone,
          email: client.email,
        }
      : null,
    account,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  });
}
