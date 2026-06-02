import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { prisma } from "@/lib/prisma";
import { refreshAccountPaymentIntent } from "@/lib/account-payments/checkout";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiPermission("crm.payments.read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const intentId = Number(id);
  if (!Number.isInteger(intentId) || intentId <= 0) {
    return jsonError("VALIDATION_FAILED", "Invalid payment intent id", null, 400);
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, accountId: auth.session.accountId },
    select: { id: true },
  });
  if (!intent) return jsonError("NOT_FOUND", "Payment intent not found", null, 404);

  try {
    const updated = await refreshAccountPaymentIntent(intentId);
    return applyCrmAccessCookie(
      jsonOk({
        intent: {
          id: updated.id,
          status: updated.status,
          providerStatus: updated.providerStatus,
          paidAt: updated.paidAt,
        },
      }),
      auth,
    );
  } catch (error) {
    return jsonError(
      "ACCOUNT_PAYMENT_REFRESH_FAILED",
      error instanceof Error ? error.message : "Failed to refresh payment status",
      null,
      400,
    );
  }
}

