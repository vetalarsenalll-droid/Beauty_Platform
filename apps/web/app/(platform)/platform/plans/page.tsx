import { requirePlatformPermission } from "@/lib/auth";

type PlanCard = {
  name: string;
  price: string;
  description: string;
  features: string[];
};

const plans: PlanCard[] = [
  {
    name: "Starter",
    price: "0 ₽",
    description: "Для теста и старта платформы.",
    features: ["1 аккаунт", "Базовый CRM", "Marketplace"],
  },
  {
    name: "Pro",
    price: "3 990 ₽",
    description: "Полный набор для бизнеса.",
    features: ["До 5 аккаунтов", "Расширенная аналитика", "Уведомления"],
  },
  {
    name: "Enterprise",
    price: "Индивидуально",
    description: "Для сетей и франшиз.",
    features: ["Без лимитов", "SLA", "Персональный менеджер"],
  },
];

export default async function PlatformPlansPage() {
  await requirePlatformPermission("platform.plans");

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

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]"
          >
            <div className="text-sm uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
              {plan.name}
            </div>
            <div className="mt-2 text-2xl font-semibold">{plan.price}</div>
            <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
              {plan.description}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="text-[color:var(--bp-ink)]">
                  {feature}
                </li>
              ))}
            </ul>
            <button className="mt-4 w-full rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold">
              Редактировать
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
