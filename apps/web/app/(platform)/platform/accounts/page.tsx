import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import AccountCreateForm from "./account-create-form";
import AccountRowActions from "./account-row-actions";

const statusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  SUSPENDED: "Приостановлен",
  ARCHIVED: "Архив",
};

export default async function PlatformAccountsPage() {
  await requirePlatformPermission("platform.accounts");

  const [accounts, plans] = await Promise.all([
    prisma.account.findMany({
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Аккаунты
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Управление бизнес-аккаунтами
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Статусы, лимиты, тарифы и подключенные модули.
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Новый аккаунт</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Создайте новый бизнес-аккаунт и привяжите тариф.
        </p>
        <div className="mt-4">
          <AccountCreateForm plans={plans} />
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Список аккаунтов</h2>
        {accounts.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Аккаунтов пока нет. Создайте первый бизнес-аккаунт выше.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/70 px-4 py-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">{account.name}</div>
                    <span className="rounded-full bg-[color:var(--bp-chip)] px-2 py-0.5 text-xs">
                      {statusLabels[account.status] ?? account.status}
                    </span>
                    <span className="text-xs text-[color:var(--bp-muted)]">
                      {account.plan?.name ?? "Без тарифа"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                    {account.slug} · {account.timeZone}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/platform/accounts/${account.id}`}
                    className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
                  >
                    Профиль
                  </Link>
                  <AccountRowActions
                    accountId={account.id}
                    status={account.status}
                    planId={account.planId}
                    plans={plans}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
