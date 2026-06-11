import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";
import { activatePaidPlatformSubscription } from "@/lib/platform-subscriptions";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный счет", null, 400);
  }

  const invoice = await prisma.platformInvoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return jsonError("NOT_FOUND", "Счет не найден", null, 404);
  }

  if (invoice.status === "PAID") {
    return jsonOk({ status: "PAID" });
  }

  const aiPurchases = await prisma.$queryRaw<
    Array<{ id: number; accountId: number; creditRub: { toString(): string }; creditTokens: number; status: string }>
  >`
    SELECT "id", "accountId", "creditRub", "creditTokens", "status"
    FROM "AiAccessPurchase"
    WHERE "invoiceId" = ${invoice.id}
  `;
  const isAiInvoice = aiPurchases.length > 0;

  const payment = await prisma.platformPayment.create({
    data: {
      invoiceId: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      status: "SUCCEEDED",
      provider: "manual",
      providerRef: "manual",
    },
  });

  const paidAt = new Date();
  await prisma.platformInvoice.update({
    where: { id: invoice.id },
    data: { status: "PAID", paidAt },
  });

  if (isAiInvoice) {
    for (const purchase of aiPurchases.filter((item) => item.status !== "PAID")) {
      await prisma.$executeRaw`
        UPDATE "AiAccessPurchase"
        SET "status" = 'PAID', "paidAt" = NOW()
        WHERE "id" = ${purchase.id}
      `;
      await prisma.aiBalanceLedger.create({
        data: {
          accountId: purchase.accountId,
          type: "purchase",
          amountRub: Number(purchase.creditRub).toFixed(6),
          amountTokens: purchase.creditTokens,
          comment: `AI invoice #${invoice.id}`,
        },
      });
    }
  } else {
    const account = await prisma.account.findUnique({
      where: { id: invoice.accountId },
      select: { planId: true },
    });
    if (account?.planId) {
      await prisma.$transaction(async (tx) => {
        await activatePaidPlatformSubscription(tx, {
          accountId: invoice.accountId,
          planId: account.planId as number,
          paidAt,
          subscriptionId: invoice.subscriptionId,
        });
      });
    }
  }

  await logPlatformAudit({
    adminId: session.adminId,
    action: "Оплата счета вручную",
    targetType: "platform_payment",
    targetId: payment.id,
    diffJson: {
      invoiceId: invoice.id,
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      status: "SUCCEEDED",
    },
  });

  const response = jsonOk({ status: "PAID" });
  revalidatePath("/platform/billing");
  revalidatePath("/platform/ai/accounts");
  revalidatePath("/crm/assistant/site");
  return applyAccessCookie(response, auth);
}
