import { prisma } from "@/lib/prisma";

export async function requestSubscriptionInvoice(accountId: number, planId: number) {
  const plan = await prisma.platformPlan.findFirst({
    where: { id: planId, isActive: true },
    select: { id: true, name: true, priceMonthly: true, currency: true },
  });
  if (!plan) return null;

  return prisma.$transaction(async (tx) => {
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

    const description = `Подписка CRM ${plan.name} на 1 месяц`;
    const invoice = await tx.platformInvoice.create({
      data: {
        accountId,
        subscriptionId: subscription?.id ?? null,
        status: "ISSUED",
        purpose: "SUBSCRIPTION",
        amount: plan.priceMonthly,
        currency: plan.currency,
        description,
        metadataJson: { planId: plan.id, billingPeriod: "month" },
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
            metadataJson: { planId: plan.id, billingPeriod: "month" },
          },
        },
      },
      select: { id: true },
    });

    return invoice.id;
  });
}
