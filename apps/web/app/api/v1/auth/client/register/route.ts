import crypto from "crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
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
  const rawPhone = String(body?.phone ?? "").trim();
  const phone = normalizeRuPhone(rawPhone);

  if (!email || !password) {
    return jsonError(
      "VALIDATION_FAILED",
      "Email и пароль обязательны",
      { fields: ["email", "password"] },
      400
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("INVALID_EMAIL", "Укажите корректный email.", null, 400);
  }
  if (password.length < 6) {
    return jsonError(
      "WEAK_PASSWORD",
      "Пароль должен содержать минимум 6 символов.",
      null,
      400
    );
  }
  if (rawPhone && !phone) {
    return jsonError(
      "INVALID_PHONE",
      "Укажите корректный номер телефона.",
      null,
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
    return jsonError("ACCOUNT_NOT_FOUND", "Организация не найдена.", null, 400);
  }

  const existingUserByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUserByEmail) {
    return jsonError(
      "EMAIL_ALREADY_REGISTERED",
      "Пользователь с таким email уже зарегистрирован.",
      null,
      409
    );
  }

  if (account && phone) {
    const existingClientByPhone = await prisma.client.findFirst({
      where: { accountId: account.id, phone },
      select: { id: true },
    });
    if (existingClientByPhone) {
      return jsonError(
        "PHONE_ALREADY_REGISTERED",
        "Клиент с таким телефоном уже зарегистрирован.",
        null,
        409
      );
    }
  }

  const saltHex = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, saltHex);

  let user;
  let client = null;
  try {
    user = await prisma.user.create({
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

    client = account
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta?.target.join(",")
          : String(error.meta?.target ?? "");
        if (target.includes("email")) {
          return jsonError(
            "EMAIL_ALREADY_REGISTERED",
            "Пользователь с таким email уже зарегистрирован.",
            null,
            409
          );
        }
        if (target.includes("phone")) {
          return jsonError(
            "PHONE_ALREADY_REGISTERED",
            "Клиент с таким телефоном уже зарегистрирован.",
            null,
            409
          );
        }
      }
    }
    return jsonError(
      "REGISTRATION_FAILED",
      "Не удалось завершить регистрацию. Попробуйте позже.",
      null,
      400
    );
  }

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



