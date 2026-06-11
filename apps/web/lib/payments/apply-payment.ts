import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PaymentMethodCode, PaymentProviderCode } from "./types";
import { activatePaidPlatformSubscription } from "@/lib/platform-subscriptions";

function readInvoicePlanId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("planId" in metadata)) return null;
  const value = Number((metadata as { planId?: unknown }).planId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function applySuccessfulPlatformPayment(input: {
  invoiceId: number;
  provider: PaymentProviderCode;
  providerPaymentId: string;
  method?: PaymentMethodCode | string | null;
  providerStatus?: string | null;
  rawProviderJson?: unknown;
}) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.platformInvoice.findUnique({
      where: { id: input.invoiceId },
      include: { account: { select: { planId: true } } },
    });
    if (!invoice) throw new Error(`Invoice ${input.invoiceId} not found`);

    if (invoice.status === "PAID") {
      return { status: "PAID" as const, invoiceId: invoice.id, alreadyPaid: true };
    }

    const paidAt = new Date();
    const existingPayment = await tx.platformPayment.findFirst({
      where: {
        provider: input.provider,
        providerRef: input.providerPaymentId,
      },
      select: { id: true },
    });

    if (existingPayment) {
      await tx.platformPayment.update({
        where: { id: existingPayment.id },
        data: {
          invoiceId: invoice.id,
          amount: invoice.amount,
          currency: invoice.currency,
          status: "SUCCEEDED",
          method: input.method ?? invoice.paymentMethod ?? null,
          providerStatus: input.providerStatus ?? "CONFIRMED",
          rawProviderJson:
            input.rawProviderJson === undefined
              ? undefined
              : (input.rawProviderJson as Prisma.InputJsonValue),
          paidAt,
        },
      });
    } else {
      await tx.platformPayment.create({
        data: {
          invoiceId: invoice.id,
          amount: invoice.amount,
          currency: invoice.currency,
          status: "SUCCEEDED",
          provider: input.provider,
          providerRef: input.providerPaymentId,
          method: input.method ?? invoice.paymentMethod ?? null,
          providerStatus: input.providerStatus ?? "CONFIRMED",
          rawProviderJson:
            input.rawProviderJson === undefined
              ? undefined
              : (input.rawProviderJson as Prisma.InputJsonValue),
          paidAt,
        },
      });
    }

    await tx.platformInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt,
        paymentProvider: input.provider,
        paymentMethod: input.method ?? invoice.paymentMethod ?? null,
        providerPaymentId: input.providerPaymentId,
        providerStatus: input.providerStatus ?? "CONFIRMED",
      },
    });

    const aiPurchases = await tx.$queryRaw<
      Array<{
        id: number;
        accountId: number;
        creditRub: Prisma.Decimal;
        creditTokens: number;
        status: string;
      }>
    >`
      SELECT "id", "accountId", "creditRub", "creditTokens", "status"
      FROM "AiAccessPurchase"
      WHERE "invoiceId" = ${invoice.id}
    `;

    for (const purchase of aiPurchases.filter((item) => item.status !== "PAID")) {
      await tx.$executeRaw`
        UPDATE "AiAccessPurchase"
        SET "status" = 'PAID', "paidAt" = NOW()
        WHERE "id" = ${purchase.id}
      `;
      await tx.aiBalanceLedger.create({
        data: {
          accountId: purchase.accountId,
          type: "purchase",
          amountRub: Number(purchase.creditRub).toFixed(6),
          amountTokens: purchase.creditTokens,
          comment: `AI invoice #${invoice.id}`,
        },
      });
    }

    if (aiPurchases.length === 0) {
      const paidPlanId = readInvoicePlanId(invoice.metadataJson);
      const planId = (paidPlanId ?? invoice.account.planId) as number | null;
      if (planId) {
        await activatePaidPlatformSubscription(tx, {
          accountId: invoice.accountId,
          planId,
          paidAt,
          subscriptionId: invoice.subscriptionId,
        });
      }
    }

    return { status: "PAID" as const, invoiceId: invoice.id, alreadyPaid: false };
  });
}
