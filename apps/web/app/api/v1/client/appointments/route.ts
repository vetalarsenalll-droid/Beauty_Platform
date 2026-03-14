import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function resolveAccountClient(
  request: Request,
  session: NonNullable<Awaited<ReturnType<typeof getClientSession>>>
) {
  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account")?.trim() || "";
  const target = accountSlug
    ? session.clients.find((item) => item.accountSlug === accountSlug) ?? null
    : null;

  return {
    accountSlug: target?.accountSlug ?? null,
    accountId: target?.accountId ?? null,
    clientId: target?.clientId ?? null,
  };
}

export async function GET(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинет.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);

  const clientPairs = session.clients.map((client) => ({
    accountId: client.accountId,
    clientId: client.clientId,
  }));

  const appointments = await prisma.appointment.findMany({
    where: resolved.accountId
      ? { accountId: resolved.accountId, clientId: resolved.clientId ?? undefined }
      : { OR: clientPairs },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      priceTotal: true,
      durationTotalMin: true,
      account: { select: { id: true, name: true, slug: true, timeZone: true } },
      location: { select: { id: true, name: true, address: true } },
      specialist: {
        select: {
          id: true,
          user: { select: { profile: { select: { firstName: true, lastName: true } } } },
        },
      },
      services: { select: { service: { select: { name: true } } } },
    },
  });

  return jsonOk({ appointments });
}
