import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import PlanRowActions from "../plan-row-actions";
import PlanLimitsEditor from "../plan-limits-editor";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlanProfilePage({ params }: PageProps) {
  await requirePlatformPermission("platform.plans");
  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) {
    notFound();
  }

  const plan = await prisma.platformPlan.findUnique({
    where: { id: planId },
    include: { features: true },
  });

  if (!plan) notFound();

  const planForm = {
    planId: plan.id,
    initialName: plan.name,
    initialCode: plan.code,
    initialPrice: plan.priceMonthly.toString(),
    initialCurrency: plan.currency,
    initialActive: plan.isActive,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Профиль тарифа
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
          <p className="text-[color:var(--bp-muted)]">
            {plan.priceMonthly.toString()} {plan.currency} · {plan.code}
          </p>
        </div>
        <Link
          href="/platform/plans"
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
        >
          Назад к списку
        </Link>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Параметры тарифа</h2>
        <div className="mt-4">
          <PlanRowActions {...planForm} />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Лимиты тарифа</h2>
        <PlanLimitsEditor planId={plan.id} initialFeatures={plan.features} />
      </section>
    </div>
  );
}
