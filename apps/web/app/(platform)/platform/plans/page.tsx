import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import { formatPlanPeriod } from "@/lib/platform-subscriptions";
import PlanCreateForm from "./plan-create-form";

export default async function PlatformPlansPage() {
  await requirePlatformPermission("platform.plans");

  const plans = await prisma.platformPlan.findMany({
    orderBy: [{ isTrial: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Тарифы и подписки
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Планы и условия платформы
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Управляйте ценами, trial-тарифами, лимитами и доступными модулями.
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Новый тариф</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Код тарифа создаётся автоматически. Пробный тариф используется только для trial и не продаётся в CRM.
        </p>
        <div className="mt-4">
          <PlanCreateForm />
        </div>
      </div>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Список тарифов</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {plans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 text-sm text-[color:var(--bp-muted)]">
              Тарифов пока нет. Создайте первый тариф выше.
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">{plan.name}</div>
                    <span className="rounded-full bg-[color:var(--bp-chip)] px-2 py-0.5 text-xs">
                      {plan.isActive ? "Активен" : "Выключен"}
                    </span>
                    {plan.isTrial ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        Trial
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        Продажа
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                    {plan.priceMonthly.toString()} {plan.currency} за{" "}
                    {plan.isTrial
                      ? `${plan.trialPeriodDays} дней trial`
                      : formatPlanPeriod(plan.billingPeriodMonths)}
                    {plan.gracePeriodDays > 0
                      ? ` · льготный период ${plan.gracePeriodDays} дн.`
                      : ""}
                  </div>
                </div>
                <Link
                  href={`/platform/plans/${plan.id}`}
                  className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
                >
                  Профиль
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
