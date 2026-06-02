import { requireCrmPermission } from "@/lib/auth";
import { money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";
import AccountPaymentsClient from "./account-payments-client";
import SubscriptionCheckout from "./subscription-checkout";

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ISSUED: "Ожидает оплаты",
  PAID: "Оплачен",
  VOID: "Аннулирован",
};

export default async function CrmPaymentsPage() {
  const session = await requireCrmPermission("crm.payments.read");

  const [account, plans, subscription, invoices, accountPaymentConnections, accountSettings] = await Promise.all([
    prisma.account.findUnique({
      where: { id: session.accountId },
      select: { planId: true, plan: { select: { name: true } } },
    }),
    prisma.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
      select: { id: true, name: true, description: true, priceMonthly: true, currency: true },
    }),
    prisma.platformSubscription.findFirst({
      where: { accountId: session.accountId, status: { in: ["ACTIVE", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } } },
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
    prisma.accountPaymentConnection.findMany({
      where: { accountId: session.accountId },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      select: {
        id: true,
        provider: true,
        mode: true,
        title: true,
        isEnabled: true,
        isDefault: true,
        credentialsMasked: true,
        receiptEnabled: true,
        receiptVat: true,
        receiptTaxationSystem: true,
        currency: true,
        lastTestedAt: true,
        lastTestStatus: true,
      },
    }),
    prisma.accountSetting.findUnique({
      where: { accountId: session.accountId },
      select: {
        bookingOnlinePaymentMode: true,
        bookingAllowPayLater: true,
        bookingAllowPrepaymentFixed: true,
        bookingAllowPrepaymentPercent: true,
        bookingAllowFullPayment: true,
        bookingPrepaymentAmount: true,
        bookingPrepaymentPercent: true,
        bookingFullPaymentDiscountPercent: true,
      },
    }),
  ]);

  const currentPlanId = subscription?.planId ?? account?.planId ?? null;
  const paymentConnections = accountPaymentConnections.map((connection) => ({
    ...connection,
    credentialsMasked:
      connection.credentialsMasked && typeof connection.credentialsMasked === "object" && !Array.isArray(connection.credentialsMasked)
        ? (connection.credentialsMasked as Record<string, unknown>)
        : null,
    lastTestedAt: connection.lastTestedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплаты</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Тариф и платежи</h1>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Текущий тариф: {subscription?.plan.name ?? account?.plan?.name ?? "не выбран"}
          {subscription?.nextBillingAt ? ` · оплачен до ${subscription.nextBillingAt.toLocaleDateString("ru-RU")}` : ""}
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <SubscriptionCheckout
            key={plan.id}
            planId={plan.id}
            name={plan.name}
            priceLabel={money(plan.priceMonthly)}
            description={plan.description}
            isCurrent={plan.id === currentPlanId}
          />
        ))}
        {!plans.length ? (
          <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 text-sm text-[color:var(--bp-muted)]">
            Тарифы пока не настроены платформой.
          </article>
        ) : null}
      </section>

      <AccountPaymentsClient
        initialConnections={paymentConnections}
        initialBookingPayment={{
          bookingOnlinePaymentMode: accountSettings?.bookingOnlinePaymentMode ?? "DISABLED",
          bookingAllowPayLater: accountSettings?.bookingAllowPayLater ?? true,
          bookingAllowPrepaymentFixed:
            accountSettings?.bookingAllowPrepaymentFixed ??
            accountSettings?.bookingOnlinePaymentMode === "PREPAYMENT_FIXED",
          bookingAllowPrepaymentPercent:
            accountSettings?.bookingAllowPrepaymentPercent ??
            accountSettings?.bookingOnlinePaymentMode === "PREPAYMENT_PERCENT",
          bookingAllowFullPayment:
            accountSettings?.bookingAllowFullPayment ??
            accountSettings?.bookingOnlinePaymentMode === "FULL_PAYMENT",
          bookingPrepaymentAmount: accountSettings?.bookingPrepaymentAmount ? Number(accountSettings.bookingPrepaymentAmount) : null,
          bookingPrepaymentPercent: accountSettings?.bookingPrepaymentPercent ? Number(accountSettings.bookingPrepaymentPercent) : null,
          bookingFullPaymentDiscountPercent: accountSettings?.bookingFullPaymentDiscountPercent
            ? Number(accountSettings.bookingFullPaymentDiscountPercent)
            : null,
        }}
      />

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Счета платформы</h2>
        <div className="mt-4 grid gap-3 text-sm">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{invoice.description ?? `Счёт #${invoice.id}`}</div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                    #{invoice.id} · {invoiceStatusLabels[invoice.status] ?? invoice.status} · {money(invoice.amount)} {invoice.currency}
                  </div>
                </div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  {invoice.paidAt?.toLocaleDateString("ru-RU") ?? invoice.issuedAt?.toLocaleDateString("ru-RU") ?? "—"}
                </div>
              </div>
              <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                Назначение: {invoice.purpose} · Провайдер: {invoice.paymentProvider ?? "—"} · Метод: {invoice.paymentMethod ?? "—"} · Статус банка: {invoice.providerStatus ?? "—"}
              </div>
            </div>
          ))}
          {!invoices.length ? <div className="text-[color:var(--bp-muted)]">Счетов пока нет.</div> : null}
        </div>
      </section>
    </div>
  );
}
