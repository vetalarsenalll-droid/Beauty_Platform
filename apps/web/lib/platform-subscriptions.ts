import { AccountStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaTx = Prisma.TransactionClient;

type PublicAccountRecord = {
  id: number;
  name: string;
  slug: string;
  timeZone: string;
  status: AccountStatus;
  suspendedByBillingAt: Date | null;
};

type SubscriptionWithPlanAndAccount = Prisma.PlatformSubscriptionGetPayload<{
  include: {
    plan: {
      select: {
        id: true;
        name: true;
        billingPeriodMonths: true;
        gracePeriodDays: true;
      };
    };
    account: {
      select: {
        id: true;
        status: true;
        suspendedByBillingAt: true;
        planId: true;
      };
    };
  };
}>;

export type AccountSubscriptionAccessStatus =
  | "none"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type ReconciledSubscription = SubscriptionWithPlanAndAccount & {
  endsAt: Date | null;
  graceEndsAt: Date | null;
};

export type AccountSubscriptionState = {
  accessStatus: AccountSubscriptionAccessStatus;
  subscription: ReconciledSubscription | null;
};

export type PlatformSubscriptionSettings = {
  trialEnabled: boolean;
  trialDays: number;
  trialPlanId: number | null;
};

export type CrmBillingNotice = {
  kind: Exclude<AccountSubscriptionAccessStatus, "active" | "cancelled">;
  title: string;
  message: string;
  actionHref: string;
  actionLabel: string;
};

export const PLATFORM_SUBSCRIPTION_SETTINGS_KEY = "platform.subscription";

const DEFAULT_SUBSCRIPTION_SETTINGS: PlatformSubscriptionSettings = {
  trialEnabled: true,
  trialDays: 14,
  trialPlanId: null,
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

function normalizePositiveInt(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeNullablePositiveInt(value: unknown) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
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

export async function generatePlatformPlanCode(name: string, tx: PrismaTx | typeof prisma = prisma) {
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

export function normalizePlatformSubscriptionSettings(
  raw: unknown,
): PlatformSubscriptionSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return DEFAULT_SUBSCRIPTION_SETTINGS;
  }

  const settings = raw as Record<string, unknown>;
  return {
    trialEnabled:
      typeof settings.trialEnabled === "boolean"
        ? settings.trialEnabled
        : DEFAULT_SUBSCRIPTION_SETTINGS.trialEnabled,
    trialDays: normalizePositiveInt(
      settings.trialDays,
      DEFAULT_SUBSCRIPTION_SETTINGS.trialDays,
    ),
    trialPlanId: normalizeNullablePositiveInt(settings.trialPlanId),
  };
}

export async function getPlatformSubscriptionSettings(
  tx: PrismaTx | typeof prisma = prisma,
) {
  const row = await tx.platformSetting.findUnique({
    where: { key: PLATFORM_SUBSCRIPTION_SETTINGS_KEY },
    select: { valueJson: true },
  });
  return normalizePlatformSubscriptionSettings(row?.valueJson);
}

async function createBillingNotifications(tx: PrismaTx, accountId: number, body: string) {
  const assignments = await tx.roleAssignment.findMany({
    where: { accountId },
    select: { userId: true },
  });
  if (!assignments.length) return;

  await tx.notification.createMany({
    data: assignments.map((assignment) => ({
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

export async function reconcileAccountSubscriptionState(
  accountId: number,
): Promise<AccountSubscriptionState> {
  return prisma.$transaction(async (tx) => {
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
      return {
        accessStatus: subscription.status.toLowerCase() as AccountSubscriptionAccessStatus,
        subscription: { ...subscription, endsAt: null, graceEndsAt: subscription.graceEndsAt },
      };
    }

    const graceEndsAt =
      subscription.graceEndsAt ??
      calculateGraceEndsAt(endsAt, subscription.plan.gracePeriodDays);

    if (now <= endsAt) {
      const shouldReactivate =
        subscription.status !== SubscriptionStatus.ACTIVE ||
        subscription.graceEndsAt !== null ||
        subscription.remindedAt !== null ||
        (subscription.account.status === AccountStatus.SUSPENDED &&
          subscription.account.suspendedByBillingAt !== null);

      if (shouldReactivate) {
        await tx.platformSubscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            graceEndsAt: null,
            remindedAt: null,
          },
        });
        if (
          subscription.account.status === AccountStatus.SUSPENDED &&
          subscription.account.suspendedByBillingAt !== null
        ) {
          await tx.account.update({
            where: { id: subscription.accountId },
            data: {
              status: AccountStatus.ACTIVE,
              suspendedByBillingAt: null,
            },
          });
        }
      }

      return {
        accessStatus: "active" as const,
        subscription: {
          ...subscription,
          status: SubscriptionStatus.ACTIVE,
          endsAt,
          graceEndsAt: null,
        },
      };
    }

    if (now <= graceEndsAt) {
      const updateData: Prisma.PlatformSubscriptionUpdateInput = {
        status: SubscriptionStatus.PAST_DUE,
        graceEndsAt,
      };
      let sendReminder = false;
      if (!subscription.remindedAt) {
        updateData.remindedAt = now;
        sendReminder = true;
      }

      if (
        subscription.status !== SubscriptionStatus.PAST_DUE ||
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

      return {
        accessStatus: "past_due" as const,
        subscription: {
          ...subscription,
          status: SubscriptionStatus.PAST_DUE,
          endsAt,
          graceEndsAt,
        },
      };
    }

    const shouldSuspendAccount =
      subscription.account.status !== AccountStatus.SUSPENDED ||
      subscription.account.suspendedByBillingAt === null;

    await tx.platformSubscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.EXPIRED,
        graceEndsAt,
      },
    });

    if (shouldSuspendAccount) {
      await tx.account.update({
        where: { id: subscription.accountId },
        data: {
          status: AccountStatus.SUSPENDED,
          suspendedByBillingAt: now,
        },
      });
      await createBillingNotifications(
        tx,
        subscription.accountId,
        buildFreezeText(subscription.plan.name),
      );
    }

    return {
      accessStatus: "expired" as const,
      subscription: {
        ...subscription,
        status: SubscriptionStatus.EXPIRED,
        endsAt,
        graceEndsAt,
      },
    };
  });
}

export function buildCrmBillingNotice(
  state: AccountSubscriptionState,
): CrmBillingNotice | null {
  if (state.accessStatus === "active" || state.accessStatus === "cancelled") {
    return null;
  }

  if (state.accessStatus === "none") {
    return {
      kind: "none",
      title: "Подписка не подключена",
      message:
        "CRM доступна для оплаты и настройки, но публичный сайт и онлайн-запись отключены до подключения тарифа.",
      actionHref: "/crm/payments",
      actionLabel: "Выбрать тариф",
    };
  }

  const planName = state.subscription?.plan.name ?? "тариф";
  const graceEndsAt = state.subscription?.graceEndsAt;
  if (state.accessStatus === "past_due") {
    return {
      kind: "past_due",
      title: "Срок тарифа истёк",
      message: graceEndsAt
        ? `Продлите "${planName}" до ${graceEndsAt.toLocaleDateString("ru-RU")}. До этой даты сайт и онлайн-запись продолжают работать.`
        : `Продлите "${planName}", чтобы не потерять доступ к сайту и онлайн-записи.`,
      actionHref: "/crm/payments",
      actionLabel: "Продлить тариф",
    };
  }

  return {
    kind: "expired",
    title: "Аккаунт заморожен",
    message:
      "Льготный период закончился. CRM доступна для оплаты, но публичный сайт и онлайн-запись отключены до продления тарифа.",
    actionHref: "/crm/payments",
    actionLabel: "Оплатить тариф",
  };
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
  const plan = await tx.platformPlan.findUnique({
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

  const account = await tx.account.findUnique({
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
        status: SubscriptionStatus.ACTIVE,
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
        status: SubscriptionStatus.ACTIVE,
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
            status: AccountStatus.ACTIVE,
            suspendedByBillingAt: null,
          }
        : {}),
    },
  });
}

export async function createTrialSubscriptionForAccount(
  tx: PrismaTx,
  accountId: number,
) {
  const settings = await getPlatformSubscriptionSettings(tx);
  if (!settings.trialEnabled) {
    return null;
  }

  const planPromise = settings.trialPlanId
    ? tx.platformPlan.findFirst({
        where: { id: settings.trialPlanId, isActive: true, isTrial: true },
        select: { id: true, name: true },
      })
    : tx.platformPlan.findFirst({
        where: { isActive: true, isTrial: true },
        orderBy: [{ priceMonthly: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      });

  const [plan, existingSubscription] = await Promise.all([
    planPromise,
    tx.platformSubscription.findFirst({
      where: { accountId },
      select: { id: true },
    }),
  ]);

  if (!plan || existingSubscription) {
    return null;
  }

  const startedAt = new Date();
  const endsAt = addDays(startedAt, settings.trialDays);
  const subscription = await tx.platformSubscription.create({
    data: {
      accountId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      startedAt,
      endsAt,
      nextBillingAt: endsAt,
      graceEndsAt: null,
      lastPaidAt: null,
    },
  });

  await tx.account.update({
    where: { id: accountId },
    data: {
      planId: plan.id,
      status: AccountStatus.ACTIVE,
      suspendedByBillingAt: null,
    },
  });

  await createBillingNotifications(
    tx,
    accountId,
    `Пробный период тарифа "${plan.name}" активирован до ${endsAt.toLocaleDateString("ru-RU")}.`,
  );

  return subscription;
}

export async function getPublicAccountBySlug(slug: string) {
  const account = await prisma.account.findUnique({
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
  const account = await prisma.account.findUnique({
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
  const state = await reconcileAccountSubscriptionState(account.id);
  if (state.accessStatus === "none" || state.accessStatus === "expired") {
    return null;
  }

  const fresh = await prisma.account.findUnique({
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
  if (!fresh || fresh.status !== AccountStatus.ACTIVE) return null;
  return fresh;
}
