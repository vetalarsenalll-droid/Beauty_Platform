import { jsonError, jsonOk } from "@/lib/api";
import { syncAccountPaymentRefundState } from "@/lib/account-payments/refund";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiPermission("crm.payments.read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const intentId = Number(id);
  if (!Number.isInteger(intentId) || intentId <= 0) {
    return jsonError("VALIDATION_FAILED", "Некорректный ID платежа", null, 400);
  }

  try {
    const result = await syncAccountPaymentRefundState(auth.session.accountId, intentId);
    if (result.refund) {
      await logAccountAudit({
        accountId: auth.session.accountId,
        userId: auth.session.userId,
        action: "Сверил возврат клиентского платежа с банком",
        targetType: "payment-refund",
        targetId: result.refund.id,
        diffJson: {
          paymentIntentId: intentId,
          amountRub: result.refund.amount.toString(),
          status: result.refund.status,
          providerStatus: result.providerStatus,
        },
      });
    }

    return applyCrmAccessCookie(
      jsonOk({
        refund: result.refund
          ? {
              id: result.refund.id,
              status: result.refund.status,
              amount: result.refund.amount.toString(),
              providerStatus: result.refund.providerStatus,
              completedAt: result.refund.completedAt,
            }
          : null,
        providerStatus: result.providerStatus,
        normalizedStatus: result.normalizedStatus,
      }),
      auth,
    );
  } catch (error) {
    return jsonError(
      "ACCOUNT_PAYMENT_SYNC_REFUND_FAILED",
      error instanceof Error ? error.message : "Не удалось сверить возврат с банком",
      null,
      400,
    );
  }
}
