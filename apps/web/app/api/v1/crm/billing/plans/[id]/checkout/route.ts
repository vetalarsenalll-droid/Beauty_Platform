import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createPlatformCheckout } from "@/lib/payments/checkout";
import { requestSubscriptionInvoice } from "@/lib/payments/subscriptions";
import type { PaymentMethodCode } from "@/lib/payments/types";

type Params = { params: Promise<{ id: string }> };

function readMethod(value: unknown): PaymentMethodCode | null {
  if (value === "card" || value === "sbp" || value === "tpay") return value;
  return null;
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.payments.read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId) || planId <= 0) {
    return jsonError("VALIDATION_FAILED", "Некорректный тариф", null, 400);
  }

  const body = await request.json().catch(() => ({}));
  const method = readMethod(body?.method ?? "card");
  if (!method) {
    return jsonError("VALIDATION_FAILED", "Некорректный способ оплаты", null, 400);
  }

  try {
    const invoiceId = await requestSubscriptionInvoice(auth.session.accountId, planId);
    if (!invoiceId) return jsonError("NOT_FOUND", "Тариф не найден", null, 404);

    const checkout = await createPlatformCheckout({
      invoiceId,
      method,
      customerEmail: auth.session.email,
    });

    revalidatePath("/crm/billing");
    const response = jsonOk({ invoiceId, ...checkout });
    return applyCrmAccessCookie(response, auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать оплату";
    return jsonError("PAYMENT_INIT_FAILED", message, null, 500);
  }
}
