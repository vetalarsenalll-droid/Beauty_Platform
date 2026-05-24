import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function authorized(request: Request) {
  const secret = process.env.CRM_DELIVERY_STATUS_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  return bearer === secret || request.headers.get("x-delivery-secret") === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return jsonError("UNAUTHORIZED", "Invalid delivery webhook secret.", null, 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const accountId = typeof body.accountId === "number" ? body.accountId : null;
  const clientId = typeof body.clientId === "number" ? body.clientId : null;
  const target = typeof body.target === "string" ? body.target.trim() : "";
  if (!accountId || (!clientId && !target)) {
    return jsonError("VALIDATION_FAILED", "accountId and clientId or target are required.", null, 400);
  }

  const clients = await prisma.client.findMany({
    where: {
      accountId,
      ...(clientId
        ? { id: clientId }
        : {
            OR: [{ phone: target }, { email: target }],
          }),
    },
    select: { id: true },
    take: 20,
  });
  if (!clients.length) return jsonError("NOT_FOUND", "Client was not found.", null, 404);

  const now = new Date();
  for (const client of clients) {
    const updated = await prisma.clientConsent.updateMany({
      where: { clientId: client.id, type: "marketing", revokedAt: null },
      data: { revokedAt: now },
    });
    if (!updated.count) {
      await prisma.clientConsent.create({
        data: { clientId: client.id, type: "marketing", grantedAt: null, revokedAt: now },
      });
    }
  }

  return jsonOk({ unsubscribed: clients.length, clientIds: clients.map((client) => client.id) });
}
