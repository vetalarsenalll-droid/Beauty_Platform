import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { refreshAccountPaymentIntent } from "@/lib/account-payments/checkout";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const params = await context.params;
  const intentId = Number(params.id);
  if (!Number.isInteger(intentId) || intentId <= 0) {
    return jsonError("INVALID_INTENT_ID", "Некорректный платеж.", null, 400);
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, accountId: resolved.account.id },
    select: {
      id: true,
      status: true,
      providerStatus: true,
      providerRef: true,
      connectionId: true,
      paymentUrl: true,
      expiresAt: true,
      appointment: { select: { id: true, status: true } },
    },
  });
  if (!intent) return jsonError("PAYMENT_NOT_FOUND", "Платеж не найден.", null, 404);

  let refreshedStatus = intent.status;
  let refreshedProviderStatus = intent.providerStatus;
  if (intent.providerRef && intent.connectionId && ["CREATED", "REQUIRES_ACTION", "PROCESSING"].includes(intent.status)) {
    const refreshed = await refreshAccountPaymentIntent(intent.id);
    refreshedStatus = refreshed.status;
    refreshedProviderStatus = refreshed.providerStatus;
  }

  const currentIntent =
    refreshedStatus !== intent.status
      ? await prisma.paymentIntent.findFirst({
          where: { id: intentId, accountId: resolved.account.id },
          select: {
            id: true,
            status: true,
            providerStatus: true,
            paymentUrl: true,
            expiresAt: true,
            appointment: { select: { id: true, status: true } },
          },
        })
      : intent;

  return NextResponse.json({
    data: {
      intentId,
      status: currentIntent?.status ?? refreshedStatus,
      providerStatus: currentIntent?.providerStatus ?? refreshedProviderStatus,
      paid: (currentIntent?.status ?? refreshedStatus) === "SUCCEEDED",
      paymentUrl: currentIntent?.paymentUrl ?? null,
      expiresAt: currentIntent?.expiresAt?.toISOString() ?? null,
      appointmentId: currentIntent?.appointment?.id ?? null,
      appointmentStatus: currentIntent?.appointment?.status ?? null,
    },
  });
}
