/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";

type PrismaTx = any;

type PublicAccountRecord = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  suspendedByBillingAt: Date | null;
};

function addMonths(from: Date, months: number) {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDays(from: Date, days: number) {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizePlanCodeBase(name: string) {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "PLAN";
}

export function formatPlanPeriod(months: number) {
  if (months === 12) return "1 год";
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 год" : `${years} года`;
  }
  if (months === 1) return "1 месяц";
  if (months >= 2 && months <= 4) return `${months} месяца`;
  return `${months} месяцев`;
}

export function calculateSubscriptionEndsAt(from: Date, billingPeriodMonths: number) {
  return addMonths(from, Math.max(1, billingPeriodMonths));
}

export function calculateGraceEndsAt(endsAt: Date, gracePeriodDays: number) {
  return addDays(endsAt, Math.max(0, gracePeriodDays));
}

export async function generatePlatformPlanCode(name: string, tx: PrismaTx = prisma) {
  const base = normalizePlanCodeBase(name);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const code = `PLAN-${base}${suffix}`;
    const exists = await tx.platformPlan.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return `PLAN-${base}-${Date.now()}`;
}

async function createBillingNotifications(tx: PrismaTx, accountId: number, body: string) {
  const assignments = await tx.roleAssignment.findMany({
    where: { accountId },
    select: { userId: true },
  });
  if (!assignments.length) return;

  await tx.notification.createMany({
    data: assignments.map((assignment: { userId: number }) => ({
      userId: assignment.userId,
      accountId,
      title: "Подписка CRM",
      body,
      data: {
        type: "platform_subscription",
      },
    })),
  });
}

function buildReminderText(planName: string, graceEndsAt: Date | null) {
  const suffix = graceEndsAt
    ? ` Льготный период действует до ${graceEndsAt.toLocaleDateString("ru-RU")}.`
    : "";
  return `Срок тарифа "${planName}" истёк. Продлите подписку, чтобы избежать заморозки аккаунта.${suffix}`;
}

function buildFreezeText(planName: string) {
  return `Подписка "${planName}" не продлена. Аккаунт заморожен: онлайн-запись и сайт отключены до оплаты.`;
}

export async function reconcileAccountSubscriptionState(accountId: number) {
  const db = prisma as any;
  return db.$transaction(async (tx: PrismaTx) => {
    const subscription = await tx.platformSubscription.findFirst({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            billingPeriodMonths: true,
            gracePeriodDays: true,
          },
        },
        account: {
          select: {
            id: true,
            status: true,
            suspendedByBillingAt: true,
            planId: true,
          },
        },
      },
    });

    if (!subscription) {
      return { accessStatus: "none" as const, subscription: null };
    }

    const now = new Date();
    const endsAt = subscription.endsAt ?? subscription.nextBillingAt;
    if (!endsAt) {
      return { accessStatus: subscription.status.toLowerCase() as "active" | "past_due" | "cancelled" | "expired", subscription };
    }

    const graceEndsAt =
      subscription.graceEndsAt ??
      calculateGraceEndsAt(endsAt, subscription.plan.gracePeriodDays);

    if (now <= endsAt) {
      const shouldReactivate =
        subscription.status !== "ACTIVE" ||
        subscription.graceEndsAt !== null ||
        subscription.remindedAt !== null ||
        (subscription.account.status === "SUSPENDED" &&
          subscription.account.suspendedByBillingAt !== null);

      if (shouldReactivate) {
        await tx.platformSubscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            graceEndsAt: null,
            remindedAt: null,
          },
        });
        if (
          subscription.account.status === "SUSPENDED" &&
          subscription.account.suspendedByBillingAt !== null
        ) {
          await tx.account.update({
            where: { id: subscription.accountId },
            data: {
              status: "ACTIVE",
              suspendedByBillingAt: null,
            },
          });
        }
      }

      return { accessStatus: "active" as const, subscription: { ...subscription, endsAt, graceEndsAt: null } };
    }

    if (now <= graceEndsAt) {
      const updateData: Record<string, unknown> = {
        status: "PAST_DUE",
        graceEndsAt,
      };
      let sendReminder = false;
      if (!subscription.remindedAt) {
        updateData.remindedAt = now;
        sendReminder = true;
      }

      if (
        subscription.status !== "PAST_DUE" ||
        subscription.graceEndsAt?.getTime() !== graceEndsAt.getTime() ||
        sendReminder
      ) {
        await tx.platformSubscription.update({
          where: { id: subscription.id },
          data: updateData,
        });
      }

      if (sendReminder) {
        await createBillingNotifications(
          tx,
          subscription.accountId,
          buildReminderText(subscription.plan.name, graceEndsAt),
        );
      }

      return { accessStatus: "past_due" as const, subscription: { ...subscription, status: "PAST_DUE", endsAt, graceEndsAt } };
    }

    const shouldSuspendAccount =
      subscription.account.status !== "SUSPENDED" ||
      subscription.account.suspendedByBillingAt === null;

    await tx.platformSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "EXPIRED",
        graceEndsAt,
      },
    });

    if (shouldSuspendAccount) {
      await tx.account.update({
        where: { id: subscription.accountId },
        data: {
          status: "SUSPENDED",
          suspendedByBillingAt: now,
        },
      });
      await createBillingNotifications(
        tx,
        subscription.accountId,
        buildFreezeText(subscription.plan.name),
      );
    }

    return { accessStatus: "expired" as const, subscription: { ...subscription, status: "EXPIRED", endsAt, graceEndsAt } };
  });
}

export async function activatePaidPlatformSubscription(
  tx: PrismaTx,
  input: {
    accountId: number;
    planId: number;
    paidAt: Date;
    subscriptionId?: number | null;
  },
) {
  const plan = await (tx as any).platformPlan.findUnique({
    where: { id: input.planId },
    select: {
      id: true,
      billingPeriodMonths: true,
      gracePeriodDays: true,
    },
  });
  if (!plan) {
    throw new Error(`Plan ${input.planId} not found`);
  }

  const account = await (tx as any).account.findUnique({
    where: { id: input.accountId },
    select: {
      status: true,
      suspendedByBillingAt: true,
    },
  });
  if (!account) {
    throw new Error(`Account ${input.accountId} not found`);
  }

  const existing =
    input.subscriptionId != null
      ? await tx.platformSubscription.findUnique({
          where: { id: input.subscriptionId },
          select: {
            id: true,
            startedAt: true,
            endsAt: true,
          },
        })
      : await tx.platformSubscription.findFirst({
          where: { accountId: input.accountId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            startedAt: true,
            endsAt: true,
          },
        });

  const baseFrom =
    existing?.endsAt && existing.endsAt > input.paidAt ? existing.endsAt : input.paidAt;
  const endsAt = calculateSubscriptionEndsAt(baseFrom, plan.billingPeriodMonths);

  if (existing) {
    await tx.platformSubscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        status: "ACTIVE",
        startedAt: existing.startedAt,
        endsAt,
        nextBillingAt: endsAt,
        graceEndsAt: null,
        lastPaidAt: input.paidAt,
        remindedAt: null,
      },
    });
  } else {
    await tx.platformSubscription.create({
      data: {
        accountId: input.accountId,
        planId: plan.id,
        status: "ACTIVE",
        startedAt: input.paidAt,
        endsAt,
        nextBillingAt: endsAt,
        graceEndsAt: null,
        lastPaidAt: input.paidAt,
      },
    });
  }

  await tx.account.update({
    where: { id: input.accountId },
    data: {
      planId: plan.id,
      ...(account.suspendedByBillingAt
        ? {
            status: "ACTIVE",
            suspendedByBillingAt: null,
          }
        : {}),
    },
  });
}

export async function getPublicAccountBySlug(slug: string) {
  const db = prisma as any;
  const account = await db.account.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      timeZone: true,
      status: true,
      suspendedByBillingAt: true,
    },
  });
  if (!account) return null;
  return loadPublicActiveAccount(account);
}

export async function getPublicAccountById(id: number) {
  const db = prisma as any;
  const account = await db.account.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      timeZone: true,
      status: true,
      suspendedByBillingAt: true,
    },
  });
  if (!account) return null;
  return loadPublicActiveAccount(account);
}

async function loadPublicActiveAccount(account: PublicAccountRecord) {
  await reconcileAccountSubscriptionState(account.id);
  const db = prisma as any;
  const fresh = await db.account.findUnique({
    where: { id: account.id },
    select: {
      id: true,
      name: true,
      slug: true,
      timeZone: true,
      status: true,
      suspendedByBillingAt: true,
    },
  });
  if (!fresh || fresh.status !== "ACTIVE") return null;
  return fresh;
}
