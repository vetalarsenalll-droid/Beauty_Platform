import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";

function resolveAccountClient(
  request: Request,
  session: NonNullable<Awaited<ReturnType<typeof getClientSession>>>
) {
  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account")?.trim() || "";
  const target = accountSlug
    ? session.clients.find((item) => item.accountSlug === accountSlug) ?? null
    : null;

  if (!target) {
    return { error: jsonError("ACCOUNT_REQUIRED", "Укажите организацию.", null, 400) };
  }

  return {
    accountSlug: target.accountSlug,
    accountId: target.accountId,
    clientId: target.clientId,
  };
}

export async function PATCH(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинет.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const body = (await request.json().catch(() => null)) as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректные данные профиля.", null, 400);
  }

  const firstName = String(body.firstName ?? "").trim() || null;
  const lastName = String(body.lastName ?? "").trim() || null;
  const phoneRaw = String(body.phone ?? "").trim();
  const emailRaw = String(body.email ?? "").trim();
  const phone = phoneRaw ? normalizeRuPhone(phoneRaw) : null;
  const email = emailRaw || null;

  if (phoneRaw && !phone) {
    return jsonError("INVALID_PHONE", "Введите корректный телефон.", null, 400);
  }

  const updated = await prisma.client.updateMany({
    where: { id: resolved.clientId, accountId: resolved.accountId },
    data: {
      firstName,
      lastName,
      phone,
      email,
    },
  });

  if (!updated.count) {
    return jsonError("CLIENT_NOT_FOUND", "Клиент не найден.", null, 404);
  }

  const client = await prisma.client.findFirst({
    where: { id: resolved.clientId, accountId: resolved.accountId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });

  return jsonOk({ client });
}

export async function GET(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинет.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const client = await prisma.client.findFirst({
    where: { id: resolved.clientId, accountId: resolved.accountId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });

  if (!client) {
    return jsonError("CLIENT_NOT_FOUND", "Клиент не найден.", null, 404);
  }

  return jsonOk({ client });
}
