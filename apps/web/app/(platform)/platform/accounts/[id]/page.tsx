import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import {
  buildCrmBillingNotice,
  formatPlanPeriod,
  reconcileAccountSubscriptionState,
} from "@/lib/platform-subscriptions";
import AccountProfileForm from "./account-profile-form";
import AccountLimitsEditor from "./account-limits-editor";

const statusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  SUSPENDED: "Приостановлен",
  ARCHIVED: "Архив",
};

const subscriptionLabels: Record<string, string> = {
  ACTIVE: "Активна",
  PAST_DUE: "Просрочена, идёт льготный период",
  CANCELLED: "Отменена",
  EXPIRED: "Истекла",
};

const limitLabels: Record<string, string> = {
  "limit.locations": "Локации",
  "limit.services": "Услуги",
  "limit.specialists": "Специалисты",
  "limit.staff": "Сотрудники",
  "limit.clients": "Клиенты",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleString("ru-RU") : "—";
}

export default async function AccountProfilePage({ params }: PageProps) {
  await requirePlatformPermission("platform.accounts");
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    notFound();
  }

  await reconcileAccountSubscriptionState(accountId);

  const [account, plans] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      include: {
        plan: { include: { features: true } },
        branding: true,
        domains: true,
        platformLimits: true,
        platformSubscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
        _count: {
          select: {
            locations: true,
            services: true,
            specialistProfiles: true,
            users: true,
            clients: true,
          },
        },
      },
    }),
    prisma.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!account) notFound();

  const subscription = account.platformSubscriptions[0] ?? null;
  const billingNotice = buildCrmBillingNotice({
    accessStatus: subscription
      ? subscription.status === "PAST_DUE"
        ? "past_due"
        : subscription.status === "EXPIRED"
          ? "expired"
          : subscription.status === "CANCELLED"
            ? "cancelled"
            : "active"
      : "none",
    subscription: subscription
      ? {
          ...subscription,
          account: {
            id: account.id,
            status: account.status,
            suspendedByBillingAt: account.suspendedByBillingAt,
            planId: account.planId,
          },
        }
      : null,
  });
  const accountForm = {
    id: account.id,
    name: account.name,
    slug: account.slug,
    timeZone: account.timeZone,
    status: account.status,
    planId: account.planId,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Профиль аккаунта
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {account.name}
          </h1>
          <p className="text-[color:var(--bp-muted)]">
            {account.slug} · {account.timeZone}
          </p>
        </div>
        <Link
          href="/platform/accounts"
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
        >
          Назад к списку
        </Link>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Профиль и статус</h2>
        <div className="mt-4">
          <AccountProfileForm account={accountForm} plans={plans} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Показатели аккаунта</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>Локации: {account._count.locations}</div>
            <div>Услуги: {account._count.services}</div>
            <div>Специалисты: {account._count.specialistProfiles}</div>
            <div>Сотрудники: {account._count.users}</div>
            <div>Клиенты: {account._count.clients}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Подписка и доступ</h2>
          <div className="mt-4 grid gap-2 text-sm">
            <div>Тариф: {subscription?.plan.name ?? account.plan?.name ?? "не выбран"}</div>
            {subscription?.plan ? (
              <div className="text-[color:var(--bp-muted)]">
                Период тарифа: {formatPlanPeriod(subscription.plan.billingPeriodMonths)} · grace {subscription.plan.gracePeriodDays} дн.
              </div>
            ) : null}
            <div className="text-[color:var(--bp-muted)]">
              Статус подписки:{" "}
              {subscription
                ? subscriptionLabels[subscription.status] ?? subscription.status
                : "нет подписки"}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Статус аккаунта: {statusLabels[account.status] ?? account.status}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Подписка началась: {formatDate(subscription?.startedAt)}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Действует до: {formatDate(subscription?.endsAt ?? subscription?.nextBillingAt)}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Льготный период до: {formatDate(subscription?.graceEndsAt)}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Последняя оплата: {formatDate(subscription?.lastPaidAt)}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Уведомление отправлено: {formatDate(subscription?.remindedAt)}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Заморожен биллингом: {formatDate(account.suspendedByBillingAt)}
            </div>
            {billingNotice ? (
              <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                <div className="font-medium">{billingNotice.title}</div>
                <div className="mt-1 text-xs">{billingNotice.message}</div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Домен и брендинг</h2>
          <div className="mt-4 text-sm">
            <div>
              Домены:{" "}
              {account.domains.length === 0
                ? "не настроены"
                : account.domains.map((item) => item.domain).join(", ")}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Логотип: {account.branding?.logoUrl ? "есть" : "нет"}
            </div>
            <div className="text-[color:var(--bp-muted)]">
              Обложка: {account.branding?.coverUrl ? "есть" : "нет"}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Лимиты тарифа</h2>
          {account.plan?.features.length ? (
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {account.plan.features.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
                >
                  <div>{limitLabels[feature.key] ?? feature.key}</div>
                  <div className="text-[color:var(--bp-muted)]">
                    {feature.value ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
              Лимиты тарифа не заданы.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Лимиты аккаунта</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Индивидуальные лимиты аккаунта перекрывают лимиты тарифа.
        </p>
        <div className="mt-4">
          <AccountLimitsEditor
            accountId={account.id}
            initialLimits={account.platformLimits}
          />
        </div>
      </section>

      <section className="text-xs text-[color:var(--bp-muted)]">
        Статус аккаунта: {statusLabels[account.status] ?? account.status} ·
        Создан: {account.createdAt.toLocaleString()} · Обновлён:{" "}
        {account.updatedAt.toLocaleString()}
      </section>
    </div>
  );
}
