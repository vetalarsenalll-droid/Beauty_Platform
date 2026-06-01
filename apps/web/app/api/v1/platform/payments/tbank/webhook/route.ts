import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applySuccessfulPlatformPayment } from "@/lib/payments/apply-payment";
import {
  isTbankFinalSuccessStatus,
  parseInvoiceIdFromTbankOrderId,
  paymentMethodFromTbankPayload,
  tbankPaymentProvider,
} from "@/lib/payments/providers/tbank";

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => ({}));
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  }

  const form = await request.formData().catch(() => null);
  if (!form) return {};
  return Object.fromEntries(form.entries());
}

export async function POST(request: Request) {
  const payload = await readPayload(request);
  const verified = await tbankPaymentProvider.verifyWebhook({ payload });
  const invoiceId = parseInvoiceIdFromTbankOrderId(verified.orderId);

  const event = await prisma.platformPaymentWebhookEvent.create({
    data: {
      provider: "tbank",
      providerEventId: verified.providerPaymentId,
      providerPaymentId: verified.providerPaymentId,
      invoiceId,
      status: verified.status ?? "UNKNOWN",
      payloadJson: payload as Prisma.InputJsonValue,
      tokenValid: verified.valid,
    },
  });

  if (!verified.valid) {
    await prisma.platformPaymentWebhookEvent.update({
      where: { id: event.id },
      data: { errorMessage: "Invalid T-Bank token" },
    });
    return new NextResponse("OK", { status: 200 });
  }

  if (!invoiceId || !verified.providerPaymentId) {
    await prisma.platformPaymentWebhookEvent.update({
      where: { id: event.id },
      data: { errorMessage: "Invoice or payment id not found in webhook" },
    });
    return new NextResponse("OK", { status: 200 });
  }

  if (isTbankFinalSuccessStatus(verified.status)) {
    try {
      await applySuccessfulPlatformPayment({
        invoiceId,
        provider: "tbank",
        providerPaymentId: verified.providerPaymentId,
        method: paymentMethodFromTbankPayload(payload),
        providerStatus: verified.status,
        rawProviderJson: payload,
      });
      await prisma.platformPaymentWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
      revalidatePath("/platform/billing");
      revalidatePath("/platform/ai/accounts");
      revalidatePath("/crm/assistant/site");
    } catch (error) {
      await prisma.platformPaymentWebhookEvent.update({
        where: { id: event.id },
        data: { errorMessage: error instanceof Error ? error.message : "Payment apply failed" },
      });
    }
  }

  return new NextResponse("OK", { status: 200 });
}
