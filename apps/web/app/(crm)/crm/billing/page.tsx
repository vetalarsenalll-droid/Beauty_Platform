import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";
import {
  formatPlanPeriod,
  reconcileAccountSubscriptionState,
} from "@/lib/platform-subscriptions";
import SubscriptionCheckout from "../payments/subscription-checkout";

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ISSUED: "Ожидает оплаты",
  PAID: "Оплачен",
  VOID: "Аннулирован",
};

const limitRows = [
  { key: "limit.locations", label: "Локации" },
  { key: "limit.specialists", label: "Специалисты" },
  { key: "limit.services", label: "Услуги" },
  { key: "limit.clients", label: "Клиенты" },
] as const;

const moduleRows: Array<{ key: string; label: string; hint?: string }> = [
  { key: "module.online_booking", label: "Онлайн-запись" },
  { key: "module.site_builder", label: "Конструктор сайта" },
  { key: "module.ai_assistant", label: "AI-ассистент" },
  { key: "module.crm_agent", label: "CRM-агент", hint: "В разработке, доступ будет включён по тарифу" },
] as const;

type PlanFeature = {
  key: string;
  value: string | null;
};

function featureMap(features: PlanFeature[]) {
  return new Map(features.map((feature) => [feature.key, feature.value]));
}

function featureValue(features: Map<string, string | null>, key: string) {
  const value = features.get(key);
  if (value === "true") return "✓";
  if (value === "false" || value == null || value === "") return "—";
  return value;
}

function formatInvoiceDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("ru-RU") : "—";
}

export default async function CrmBillingPage() {
  const session = await requireCrmPermission("crm.payments.read");
  await reconcileAccountSubscriptionState(session.accountId);

  const [account, subscription, plans, invoices] = await Promise.all([
    prisma.account.findUnique({
      where: { id: session.accountId },
      select: {
        planId: true,
        plan: { select: { name: true } },
      },
    }),
    prisma.platformSubscription.findFirst({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } } },
    }),
    prisma.platformPlan.findMany({
      where: { isActive: true, isTrial: false },
      orderBy: [{ priceMonthly: "asc" }, { billingPeriodMonths: "asc" }],
      include: { features: true },
    }),
    prisma.platformInvoice.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        purpose: true,
        amount: true,
        currency: true,
        description: true,
        paymentProvider: true,
        paymentMethod: true,
        providerStatus: true,
        issuedAt: true,
        paidAt: true,
      },
    }),
  ]);

  const currentPlanId = subscription?.planId ?? account?.planId ?? null;
  const currentPaidTo = subscription?.nextBillingAt ?? subscription?.endsAt ?? null;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[28px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-6 py-8 text-center shadow-[var(--bp-shadow)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--bp-muted)]">
          Тарифы и платежи
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          Ваш тарифный план: {subscription?.plan.name ?? account?.plan?.name ?? "не выбран"}
        </h1>
        <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-[color:var(--input-bg)] px-5 py-5">
          <div className="text-lg">
            Тариф оплачен до:{" "}
            <span className="font-semibold">{formatInvoiceDate(currentPaidTo)}</span>
          </div>
          <Link
            href="#platform-invoices"
            className="mt-2 inline-flex text-sm font-medium text-[color:var(--bp-accent)]"
          >
            История платежей
          </Link>
        </div>
      </section>

      <section>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--bp-muted)]">
            Тарифы
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">План для каждого этапа</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[color:var(--bp-muted)]">
            Бесплатный тариф оставляет онлайн-запись. Платные тарифы открывают сайт, AI-ассистента и готовят доступ к CRM-агенту.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const features = featureMap(plan.features);
            const hasSite = features.get("module.site_builder") === "true";
            const hasAi = features.get("module.ai_assistant") === "true";
            const isPopular = hasSite && hasAi;

            return (
              <SubscriptionCheckout
                key={plan.id}
                planId={plan.id}
                name={plan.name}
                priceLabel={money(plan.priceMonthly)}
                billingPeriodLabel={formatPlanPeriod(plan.billingPeriodMonths)}
                gracePeriodDays={plan.gracePeriodDays}
                description={plan.description}
                isCurrent={plan.id === currentPlanId}
                badge={isPopular ? "Оптимальный выбор" : undefined}
                highlights={[
                  `Локации: ${featureValue(features, "limit.locations")}`,
                  `Специалисты: ${featureValue(features, "limit.specialists")}`,
                  `Услуги: ${featureValue(features, "limit.services")}`,
                  hasSite ? "Конструктор сайта" : "Только онлайн-запись",
                  hasAi ? "AI-ассистент включён" : "AI недоступен",
                ]}
              />
            );
          })}
          {!plans.length ? (
            <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 text-sm text-[color:var(--bp-muted)]">
              Тарифы пока не настроены платформой.
            </article>
          ) : null}
        </div>
      </section>

      {plans.length ? (
        <section className="rounded-[28px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Сравнение тарифов</h2>
            <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
              Сравнение построено только по ключевым CRM-лимитам и модулям.
            </p>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-[color:var(--bp-stroke)] bg-slate-900 px-4 py-4 text-left text-white">
                    Возможность
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      className="border border-[color:var(--bp-stroke)] bg-slate-900 px-4 py-4 text-center text-white"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={plans.length + 1} className="px-4 py-4 font-semibold">
                    Лимиты
                  </td>
                </tr>
                {limitRows.map((row) => (
                  <tr key={row.key}>
                    <td className="border border-[color:var(--bp-stroke)] px-4 py-4">
                      {row.label}
                    </td>
                    {plans.map((plan) => (
                      <td
                        key={`${plan.id}-${row.key}`}
                        className="border border-[color:var(--bp-stroke)] px-4 py-4 text-center font-medium"
                      >
                        {featureValue(featureMap(plan.features), row.key)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td colSpan={plans.length + 1} className="px-4 py-4 font-semibold">
                    Модули
                  </td>
                </tr>
                {moduleRows.map((row) => (
                  <tr key={row.key}>
                    <td className="border border-[color:var(--bp-stroke)] px-4 py-4">
                      {row.label}
                      {row.hint ? (
                        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{row.hint}</div>
                      ) : null}
                    </td>
                    {plans.map((plan) => (
                      <td
                        key={`${plan.id}-${row.key}`}
                        className="border border-[color:var(--bp-stroke)] px-4 py-4 text-center text-lg font-semibold"
                      >
                        {featureValue(featureMap(plan.features), row.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section
        id="platform-invoices"
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]"
      >
        <h2 className="text-lg font-semibold">Счета платформы</h2>
        <div className="mt-4 grid gap-3 text-sm">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{invoice.description ?? `Счёт #${invoice.id}`}</div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                    #{invoice.id} · {invoiceStatusLabels[invoice.status] ?? invoice.status} · {money(invoice.amount)} {invoice.currency}
                  </div>
                </div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  {formatInvoiceDate(invoice.paidAt ?? invoice.issuedAt)}
                </div>
              </div>
              <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                Назначение: {invoice.purpose} · Провайдер: {invoice.paymentProvider ?? "—"} · Метод: {invoice.paymentMethod ?? "—"} · Статус банка: {invoice.providerStatus ?? "—"}
              </div>
            </div>
          ))}
          {!invoices.length ? (
            <div className="text-[color:var(--bp-muted)]">Счетов пока нет.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
