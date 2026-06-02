import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createAccountCheckout } from "@/lib/account-payments/checkout";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.payments.read");
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("VALIDATION_FAILED", "JSON body is required", null, 400);

  const amountRub = Number(body.amountRub);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!Number.isFinite(amountRub) || amountRub <= 0 || !description) {
    return jsonError("VALIDATION_FAILED", "amountRub and description are required", null, 400);
  }

  try {
    const intent = await createAccountCheckout({
      accountId: auth.session.accountId,
      amountRub,
      description,
      scenario: typeof body.scenario === "string" ? body.scenario : "crm_test_payment",
      method: body.method === "sbp" || body.method === "tpay" || body.method === "sberpay" ? body.method : "card",
      customer: {
        email: typeof body.customerEmail === "string" ? body.customerEmail : auth.session.email,
        phone: typeof body.customerPhone === "string" ? body.customerPhone : null,
      },
      receiptItems: Array.isArray(body.receiptItems) ? (body.receiptItems as never) : undefined,
      returnUrl: typeof body.returnUrl === "string" ? body.returnUrl : undefined,
      failUrl: typeof body.failUrl === "string" ? body.failUrl : undefined,
    });

    return applyCrmAccessCookie(
      jsonOk({
        intent: {
          id: intent.id,
          status: intent.status,
          provider: intent.provider,
          providerRef: intent.providerRef,
          providerStatus: intent.providerStatus,
          paymentUrl: intent.paymentUrl,
        },
      }),
      auth,
    );
  } catch (error) {
    return jsonError(
      "ACCOUNT_PAYMENT_CHECKOUT_FAILED",
      error instanceof Error ? error.message : "Failed to create checkout",
      null,
      400,
    );
  }
}

