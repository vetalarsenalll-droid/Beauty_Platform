import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { refundAccountPayment } from "@/lib/account-payments/refund";
import { logAccountAudit } from "@/lib/crm-audit";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiPermission("crm.payments.read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const intentId = Number(id);
  if (!Number.isInteger(intentId) || intentId <= 0) {
    return jsonError("VALIDATION_FAILED", "Invalid payment intent id", null, 400);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("VALIDATION_FAILED", "JSON body is required", null, 400);

  const amountRub = Number(body.amountRub);
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;
  if (!Number.isFinite(amountRub) || amountRub <= 0) {
    return jsonError("VALIDATION_FAILED", "Refund amount must be greater than zero", null, 400);
  }

  try {
    const refund = await refundAccountPayment({
      accountId: auth.session.accountId,
      intentId,
      amountRub,
      reason,
    });
    await logAccountAudit({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      action: "Создал возврат клиентского платежа",
      targetType: "payment-refund",
      targetId: refund.id,
      diffJson: {
        paymentIntentId: intentId,
        amountRub,
        status: refund.status,
        providerRef: refund.providerRef,
        providerStatus: refund.providerStatus,
      },
    });

    return applyCrmAccessCookie(
      jsonOk({
        refund: {
          id: refund.id,
          status: refund.status,
          amount: refund.amount.toString(),
          providerRef: refund.providerRef,
          providerStatus: refund.providerStatus,
          completedAt: refund.completedAt,
        },
      }),
      auth,
    );
  } catch (error) {
    return jsonError(
      "ACCOUNT_PAYMENT_REFUND_FAILED",
      error instanceof Error ? error.message : "Failed to refund payment",
      null,
      400,
    );
  }
}
