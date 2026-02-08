import { headers } from "next/headers";
import { getClientSession, getClientSessionByToken } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const headerStore = await headers();
  const authHeader =
    headerStore.get("authorization") ?? headerStore.get("Authorization");

  let session = null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    session = await getClientSessionByToken(token);
  } else {
    session = await getClientSession();
  }

  if (!session) {
    return jsonError("UNAUTHORIZED", "Сессия не найдена", {}, 401);
  }

  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account");
  let clients = session.clients;
  let accountClient = accountSlug
    ? session.clients.find((item) => item.accountSlug === accountSlug) ?? null
    : null;

  if (accountSlug) {
    const account = await prisma.account.findUnique({
      where: { slug: accountSlug },
    });

    if (account) {
      const existing = await prisma.client.findFirst({
        where: {
          accountId: account.id,
          userId: session.userId,
        },
        include: { account: true },
      });

      if (!existing) {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          include: { profile: true },
        });

        await prisma.client.create({
          data: {
            accountId: account.id,
            userId: session.userId,
            firstName: user?.profile?.firstName ?? null,
            lastName: user?.profile?.lastName ?? null,
            phone: user?.phone ?? null,
            email: user?.email ?? null,
          },
        });
      }

      const rows = await prisma.client.findMany({
        where: { userId: session.userId },
        include: { account: true },
      });

      clients = rows.map((client) => ({
        clientId: client.id,
        accountId: client.accountId,
        accountSlug: client.account?.slug ?? "",
        accountName: client.account?.name ?? "",
        firstName: client.firstName ?? null,
        lastName: client.lastName ?? null,
        phone: client.phone ?? null,
        email: client.email ?? null,
      }));

      accountClient =
        clients.find((item) => item.accountSlug === accountSlug) ?? null;
    }
  }

  return jsonOk({
    user: {
      id: session.userId,
      email: session.email,
    },
    client: accountClient
      ? {
          id: accountClient.clientId,
          firstName: accountClient.firstName,
          lastName: accountClient.lastName,
          phone: accountClient.phone,
          email: accountClient.email,
          avatarUrl: session.avatarUrl,
          accountSlug: accountClient.accountSlug,
          accountName: accountClient.accountName,
        }
      : null,
    clients,
  });
}
