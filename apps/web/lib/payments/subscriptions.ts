/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import { formatPlanPeriod } from "@/lib/platform-subscriptions";

export async function requestSubscriptionInvoice(accountId: number, planId: number) {
  const db = prisma as any;
  const plan = await db.platformPlan.findFirst({
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

  return db.$transaction(async (tx: any) => {
    const subscription = await tx.platformSubscription.findFirst({
      where: { accountId, status: { in: ["ACTIVE", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const existing = await tx.platformInvoice.findFirst({
      where: {
        accountId,
        purpose: "SUBSCRIPTION",
        status: { in: ["DRAFT", "ISSUED"] },
        metadataJson: { path: ["planId"], equals: plan.id },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (existing) return existing.id;

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
