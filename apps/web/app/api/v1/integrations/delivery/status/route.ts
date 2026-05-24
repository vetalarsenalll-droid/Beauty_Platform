import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function authorized(request: Request) {
  const secret = process.env.CRM_DELIVERY_STATUS_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  return bearer === secret || request.headers.get("x-delivery-secret") === secret;
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").trim().toUpperCase();
  if (["DELIVERED", "DELIVERY_CONFIRMED", "OK"].includes(status)) return "DELIVERED";
  if (["SENT", "ACCEPTED", "QUEUED"].includes(status)) return "SENT";
  if (["FAILED", "BOUNCED", "REJECTED", "UNDELIVERED"].includes(status)) return "FAILED";
  return null;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return jsonError("UNAUTHORIZED", "Invalid delivery webhook secret.", null, 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const providerMessageId = typeof body.providerMessageId === "string" ? body.providerMessageId.trim() : "";
  const outboxItemId = typeof body.outboxItemId === "number" ? body.outboxItemId : null;
  const target = typeof body.target === "string" ? body.target.trim() : "";
  const status = normalizeStatus(body.status);
  if (!status || (!providerMessageId && !outboxItemId)) {
    return jsonError("VALIDATION_FAILED", "status and providerMessageId or outboxItemId are required.", null, 400);
  }

  const delivery = await prisma.deliveryLog.findFirst({
    where: {
      ...(providerMessageId ? { providerMessageId } : {}),
      ...(outboxItemId ? { outboxItemId } : {}),
      ...(target ? { target } : {}),
    },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!delivery) return jsonError("NOT_FOUND", "Delivery log was not found.", null, 404);

  const updated = await prisma.deliveryLog.update({
    where: { id: delivery.id },
    data: {
      status,
      errorCode: status === "FAILED" && typeof body.errorCode === "string" ? body.errorCode : null,
      errorMessage: status === "FAILED" && typeof body.errorMessage === "string" ? body.errorMessage : null,
      sentAt: status === "SENT" || status === "DELIVERED" ? new Date() : undefined,
    },
    select: { id: true, status: true, providerMessageId: true },
  });

  return jsonOk({ delivery: updated });
}
