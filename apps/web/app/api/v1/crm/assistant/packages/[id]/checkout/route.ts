import { revalidatePath } from "next/cache";
import { jsonError, jsonOk } from "@/lib/api";
import { requestAiPackageInvoice } from "@/lib/ai-billing";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createPlatformCheckout } from "@/lib/payments/checkout";
import type { PaymentMethodCode } from "@/lib/payments/types";

type Params = { params: Promise<{ id: string }> };

function readMethod(value: unknown): PaymentMethodCode | null {
  if (value === "card" || value === "sbp" || value === "tpay" || value === "bank_transfer") {
    return value;
  }
  return null;
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.assistant.billing.manage");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const packageId = Number(id);
  if (!Number.isInteger(packageId) || packageId <= 0) {
    return jsonError("VALIDATION_FAILED", "Некорректный AI-пакет", null, 400);
  }

  const body = await request.json().catch(() => ({}));
  const method = readMethod(body?.method ?? "card");
  if (!method || method === "bank_transfer") {
    return jsonError("VALIDATION_FAILED", "Некорректный способ оплаты", null, 400);
  }

  try {
    const invoiceId = await requestAiPackageInvoice(auth.session.accountId, packageId);
    if (!invoiceId) {
      return jsonError("NOT_FOUND", "AI-пакет не найден", null, 404);
    }

    const checkout = await createPlatformCheckout({
      invoiceId,
      method,
      customerEmail: auth.session.email,
    });

    revalidatePath("/crm/assistant/site");
    const response = jsonOk({ invoiceId, ...checkout });
    return applyCrmAccessCookie(response, auth);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать оплату";
    return jsonError("PAYMENT_INIT_FAILED", message, null, 500);
  }
}
