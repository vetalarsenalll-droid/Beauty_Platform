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
    return {
      error: jsonError(
        "ACCOUNT_REQUIRED",
        "Укажите организацию.",
        null,
        400
      ),
    };
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
    return jsonError(
      "UNAUTHORIZED",
      "Требуется вход в кабинет.",
      null,
      401
    );
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
    return jsonError(
      "INVALID_BODY",
      "Некорректные данные профиля.",
      null,
      400
    );
  }

  const firstName = String(body.firstName ?? "").trim() || null;
  const lastName = String(body.lastName ?? "").trim() || null;
  const phoneRaw = String(body.phone ?? "").trim();
  const emailRaw = String(body.email ?? "").trim();
  const phone = phoneRaw ? normalizeRuPhone(phoneRaw) : null;
  const email = emailRaw || null;

  if (phoneRaw && !phone) {
    return jsonError(
      "INVALID_PHONE",
      "Введите корректный телефон.",
      null,
      400
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { profile: true },
  });

  await prisma.userProfile.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      firstName,
      lastName,
    },
    update: {
      firstName,
      lastName,
    },
  });

  if (phone) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { phone },
    });
  }

  if (email && (!user?.email || user.email === email)) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { email },
    });
  }

  const updated = await prisma.client.updateMany({
    where: { userId: session.userId },
    data: {
      firstName,
      lastName,
      phone,
      email,
    },
  });

  if (!updated.count) {
    return jsonError(
      "CLIENT_NOT_FOUND",
      "Клиент не найден.",
      null,
      404
    );
  }

  const client = await prisma.client.findFirst({
    where: { id: resolved.clientId, accountId: resolved.accountId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true },
  });

  return jsonOk({
    client: {
      id: client?.id ?? null,
      firstName: firstName ?? client?.firstName ?? null,
      lastName: lastName ?? client?.lastName ?? null,
      phone: phone ?? client?.phone ?? null,
      email: email ?? client?.email ?? null,
    },
  });
}

export async function GET(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError(
      "UNAUTHORIZED",
      "Требуется вход в кабинет.",
      null,
      401
    );
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const [client, user] = await Promise.all([
    prisma.client.findFirst({
      where: { id: resolved.clientId, accountId: resolved.accountId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      include: { profile: true },
    }),
  ]);

  if (!client) {
    return jsonError(
      "CLIENT_NOT_FOUND",
      "Клиент не найден.",
      null,
      404
    );
  }

  if (
    client &&
    user &&
    ((!user.profile?.firstName && client.firstName) ||
      (!user.profile?.lastName && client.lastName))
  ) {
    await prisma.userProfile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        firstName: client.firstName ?? null,
        lastName: client.lastName ?? null,
      },
      update: {
        firstName: user.profile?.firstName ?? client.firstName ?? null,
        lastName: user.profile?.lastName ?? client.lastName ?? null,
      },
    });
  }

  if (client && user) {
    const nextPhone = user.phone ?? client.phone ?? null;
    const nextEmail = user.email ?? client.email ?? null;
    if (nextPhone && nextPhone !== user.phone) {
      await prisma.user.update({ where: { id: session.userId }, data: { phone: nextPhone } });
    }
    if (nextEmail && (!user.email || user.email === nextEmail)) {
      await prisma.user.update({ where: { id: session.userId }, data: { email: nextEmail } });
    }
  }

  const merged = {
    id: client.id,
    firstName: user?.profile?.firstName ?? client.firstName ?? null,
    lastName: user?.profile?.lastName ?? client.lastName ?? null,
    phone: user?.phone ?? client.phone ?? null,
    email: user?.email ?? client.email ?? null,
  };

  return jsonOk({ client: merged });
}
