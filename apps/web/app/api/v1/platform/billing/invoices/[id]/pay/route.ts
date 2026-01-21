import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function addMonths(from: Date, months: number) {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

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

  if (invoice.subscriptionId) {
    await prisma.platformSubscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: "ACTIVE",
        nextBillingAt: addMonths(paidAt, 1),
      },
    });
  } else {
    const account = await prisma.account.findUnique({
      where: { id: invoice.accountId },
      select: { planId: true },
    });
    if (account?.planId) {
      await prisma.platformSubscription.create({
        data: {
          accountId: invoice.accountId,
          planId: account.planId,
          status: "ACTIVE",
          startedAt: paidAt,
          nextBillingAt: addMonths(paidAt, 1),
        },
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
  return applyAccessCookie(response, auth);
}
