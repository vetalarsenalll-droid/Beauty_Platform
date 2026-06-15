import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPlanPeriod } from "@/lib/platform-subscriptions";

function sameDecimal(left: Prisma.Decimal, right: Prisma.Decimal) {
  return left.equals(right);
}

function metadataMatches(
  metadata: Prisma.JsonValue | null,
  plan: {
    id: number;
    billingPeriodMonths: number;
    gracePeriodDays: number;
  },
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  const value = metadata as Record<string, unknown>;
  return (
    Number(value.planId) === plan.id &&
    Number(value.billingPeriodMonths) === plan.billingPeriodMonths &&
    Number(value.gracePeriodDays) === plan.gracePeriodDays
  );
}

export async function requestSubscriptionInvoice(accountId: number, planId: number) {
  const plan = await prisma.platformPlan.findFirst({
    where: { id: planId, isActive: true, isTrial: false },
    select: {
      id: true,
      name: true,
      priceMonthly: true,
      billingPeriodMonths: true,
      gracePeriodDays: true,
      currency: true,
    },
  });
  if (!plan) return null;

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.platformSubscription.findFirst({
      where: { accountId, status: { in: ["ACTIVE", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const pendingInvoices = await tx.platformInvoice.findMany({
      where: {
        accountId,
        purpose: "SUBSCRIPTION",
        status: { in: ["DRAFT", "ISSUED"] },
        metadataJson: { path: ["planId"], equals: plan.id },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        metadataJson: true,
      },
    });

    const reusable = pendingInvoices.find(
      (invoice) =>
        sameDecimal(invoice.amount, plan.priceMonthly) &&
        invoice.currency === plan.currency &&
        metadataMatches(invoice.metadataJson, plan),
    );
    if (reusable) return reusable.id;

    const staleInvoiceIds = pendingInvoices.map((invoice) => invoice.id);
    if (staleInvoiceIds.length) {
      await tx.platformInvoice.updateMany({
        where: { id: { in: staleInvoiceIds } },
        data: { status: "VOID" },
      });
    }

    const description = `Подписка CRM ${plan.name} на ${formatPlanPeriod(plan.billingPeriodMonths)}`;
    const invoice = await tx.platformInvoice.create({
      data: {
        accountId,
        subscriptionId: subscription?.id ?? null,
        status: "ISSUED",
        purpose: "SUBSCRIPTION",
        amount: plan.priceMonthly,
        currency: plan.currency,
        description,
        metadataJson: {
          planId: plan.id,
          billingPeriodMonths: plan.billingPeriodMonths,
          gracePeriodDays: plan.gracePeriodDays,
        },
        issuedAt: new Date(),
        items: {
          create: {
            name: description,
            quantity: 1,
            unitPrice: plan.priceMonthly,
            amount: plan.priceMonthly,
            vat: "none",
            paymentObject: "service",
            paymentMethod: "full_payment",
            metadataJson: {
              planId: plan.id,
              billingPeriodMonths: plan.billingPeriodMonths,
              gracePeriodDays: plan.gracePeriodDays,
            },
          },
        },
      },
      select: { id: true },
    });

    return invoice.id;
  });
}
