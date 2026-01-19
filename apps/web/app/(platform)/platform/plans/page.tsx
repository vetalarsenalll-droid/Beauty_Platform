import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import PlanCreateForm from "./plan-create-form";
import PlanRowActions from "./plan-row-actions";

export default async function PlatformPlansPage() {
  await requirePlatformPermission("platform.plans");

  const plans = await prisma.platformPlan.findMany({
    orderBy: { createdAt: "desc" },
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
          Управляйте тарифами, лимитами и доступными модулями.
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Новый тариф</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Заполните параметры и сохраните новый план.
        </p>
        <div className="mt-4">
          <PlanCreateForm />
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 text-sm text-[color:var(--bp-muted)]">
            Тарифов пока нет. Создайте первый тариф выше.
          </div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]"
            >
              <div className="text-sm uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
                {plan.name}
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {plan.priceMonthly.toString()} {plan.currency}
              </div>
              <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
                {plan.description ?? "Описание не задано"}
              </p>
              <PlanRowActions
                planId={plan.id}
                initialName={plan.name}
                initialCode={plan.code}
                initialPrice={plan.priceMonthly.toString()}
                initialCurrency={plan.currency}
                initialActive={plan.isActive}
              />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
