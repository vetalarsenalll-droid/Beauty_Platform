/* eslint-disable @typescript-eslint/no-explicit-any */

import { requireCrmPermission } from "@/lib/auth";
import { money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";
import { formatPlanPeriod, reconcileAccountSubscriptionState } from "@/lib/platform-subscriptions";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import AccountPaymentsClient from "./account-payments-client";
import PaymentRefundAction from "./payment-refund-action";
import SubscriptionCheckout from "./subscription-checkout";

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ISSUED: "Ожидает оплаты",
  PAID: "Оплачен",
  VOID: "Аннулирован",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const paymentStatusOptions = ["CREATED", "REQUIRES_ACTION", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"] as const;
const paymentProviderOptions = ["YOOKASSA", "TBANK", "SBER", "ALFA"] as const;
const paymentScenarioOptions = ["appointment_full_payment", "appointment_prepayment", "crm_connection_test", "crm_test_payment"] as const;

const paymentStatusLabels: Record<string, string> = {
  CREATED: "Создан",
  REQUIRES_ACTION: "Ожидает клиента",
  PROCESSING: "В обработке",
  SUCCEEDED: "Оплачен",
  FAILED: "Ошибка",
  CANCELLED: "Отменен",
  EXPIRED: "Истек",
};

const paymentProviderLabels: Record<string, string> = {
  YOOKASSA: "ЮKassa",
  TBANK: "Т-Банк",
  SBER: "Сбер",
  ALFA: "Альфа-Банк",
  yookassa: "ЮKassa",
  tbank: "Т-Банк",
  sber: "Сбер",
  alfa: "Альфа-Банк",
};

const paymentScenarioLabels: Record<string, string> = {
  appointment_full_payment: "Полная оплата записи",
  appointment_prepayment: "Предоплата записи",
  crm_connection_test: "Проверка подключения",
  crm_test_payment: "Тестовый платеж CRM",
};

const providerStatusLabels: Record<string, string> = {
  NEW: "Создан",
  FORM_SHOWED: "Платежная форма открыта",
  AUTHORIZING: "Авторизация",
  AUTHORIZED: "Авторизован",
  CONFIRMING: "Подтверждается",
  CONFIRMED: "Подтвержден",
  REJECTED: "Отклонен",
  DEADLINE_EXPIRED: "Истек срок оплаты",
  CANCELED: "Отменен",
  REVERSED: "Отменен",
  REFUNDED: "Возвращен полностью",
  PARTIAL_REFUNDED: "Возвращен частично",
};

const refundStatusLabels: Record<string, string> = {
  PENDING: "Возврат обрабатывается",
  SUCCEEDED: "Возвращен",
  FAILED: "Ошибка возврата",
};

function pickParam(raw: Record<string, string | string[] | undefined>, key: string) {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

function isOption<T extends readonly string[]>(value: string | undefined, options: T): value is T[number] {
  return Boolean(value && options.includes(value));
}

function clientLabel(client: { firstName: string | null; lastName: string | null; phone: string | null; email: string | null } | null) {
  if (!client) return "Клиент не указан";
  const name = [client.firstName, client.lastName].filter(Boolean).join(" ").trim();
  return name || client.phone || client.email || "Клиент без имени";
}

function formatPaymentDate(value: Date | null | undefined) {
  return value ? value.toLocaleString("ru-RU") : "—";
}

function providerStatusLabel(value: string | null | undefined) {
  if (!value) return "—";
  return providerStatusLabels[String(value).toUpperCase()] ?? value;
}

export default async function CrmPaymentsPage({ searchParams }: PageProps) {
  const session = await requireCrmPermission("crm.payments.read");
  const subscriptionState = await reconcileAccountSubscriptionState(session.accountId);
  const rawParams = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const rawPaymentStatus = pickParam(rawParams, "paymentStatus");
  const rawPaymentProvider = pickParam(rawParams, "paymentProvider");
  const rawPaymentScenario = pickParam(rawParams, "paymentScenario");
  const paymentStatus = isOption(rawPaymentStatus, paymentStatusOptions) ? rawPaymentStatus : "";
  const paymentProvider = isOption(rawPaymentProvider, paymentProviderOptions) ? rawPaymentProvider : "";
  const paymentScenario = isOption(rawPaymentScenario, paymentScenarioOptions) ? rawPaymentScenario : "";
  const paymentSearch = (pickParam(rawParams, "paymentSearch") ?? "").trim();

  const paymentWhere: Prisma.PaymentIntentWhereInput = { accountId: session.accountId };
  if (paymentStatus) paymentWhere.status = paymentStatus;
  if (paymentProvider) paymentWhere.provider = paymentProvider;
  if (paymentScenario) paymentWhere.scenario = paymentScenario;
  if (paymentSearch) {
    const numericSearch = Number(paymentSearch);
    const numericFilters = Number.isInteger(numericSearch) && numericSearch > 0
      ? [{ id: numericSearch }, { appointmentId: numericSearch }]
      : [];
    paymentWhere.OR = [
      ...numericFilters,
      { providerRef: { contains: paymentSearch } },
      { providerStatus: { contains: paymentSearch } },
      { client: { firstName: { contains: paymentSearch } } },
      { client: { lastName: { contains: paymentSearch } } },
      { client: { phone: { contains: paymentSearch } } },
      { client: { email: { contains: paymentSearch } } },
    ];
  }

  const db = prisma as any;
  const [account, plans, subscription, invoices, accountPaymentConnections, clientPayments] = await Promise.all([
    db.account.findUnique({
      where: { id: session.accountId },
      select: { planId: true, suspendedByBillingAt: true, plan: { select: { name: true } } },
    }),
    db.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        priceMonthly: true,
        billingPeriodMonths: true,
        gracePeriodDays: true,
        currency: true,
      },
    }),
    db.platformSubscription.findFirst({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } } },
    }),
    db.platformInvoice.findMany({
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
    db.accountPaymentConnection.findMany({
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
        receiptFfdVersion: true,
        currency: true,
        lastTestedAt: true,
        lastTestStatus: true,
      },
    }),
    db.paymentIntent.findMany({
      where: paymentWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        client: { select: { firstName: true, lastName: true, phone: true, email: true } },
        appointment: {
          select: {
            id: true,
            startAt: true,
            services: {
              orderBy: { orderIndex: "asc" },
              take: 3,
              select: { service: { select: { name: true } } },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { id: true, type: true, amount: true, currency: true, providerStatus: true, paidAt: true, createdAt: true },
        },
        refunds: {
          orderBy: { createdAt: "desc" },
          take: 2,
          select: { id: true, status: true, amount: true, providerStatus: true, completedAt: true, createdAt: true },
        },
      },
    }),
  ]);

  const currentPlanId = subscription?.planId ?? account?.planId ?? null;
  const paymentConnections = accountPaymentConnections.map((connection: any) => ({
    ...connection,
    credentialsMasked:
      connection.credentialsMasked && typeof connection.credentialsMasked === "object" && !Array.isArray(connection.credentialsMasked)
        ? (connection.credentialsMasked as Record<string, unknown>)
        : null,
    lastTestedAt: connection.lastTestedAt?.toISOString() ?? null,
  }));
  const billingMessage =
    subscriptionState.accessStatus === "past_due" && subscription?.graceEndsAt
      ? `Срок тарифа истёк. Продлите подписку до ${subscription.graceEndsAt.toLocaleDateString("ru-RU")}, иначе аккаунт будет заморожен.`
      : account?.suspendedByBillingAt
        ? "Аккаунт заморожен из-за неоплаченной подписки. После оплаты доступ восстановится автоматически."
        : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплаты</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Тариф и платежи</h1>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Текущий тариф: {subscription?.plan.name ?? account?.plan?.name ?? "не выбран"}
          {subscription?.nextBillingAt ? ` · оплачен до ${subscription.nextBillingAt.toLocaleDateString("ru-RU")}` : ""}
        </p>
        {billingMessage ? <p className="mt-2 text-sm text-amber-700">{billingMessage}</p> : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan: any) => (
          <SubscriptionCheckout
            key={plan.id}
            planId={plan.id}
            name={plan.name}
            priceLabel={money(plan.priceMonthly)}
            billingPeriodLabel={formatPlanPeriod(plan.billingPeriodMonths)}
            gracePeriodDays={plan.gracePeriodDays}
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
      />

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Платежи клиентов</h2>
            <p className="mt-1 text-sm text-[color:var(--bp-muted)]">Онлайн-оплаты записей, тестовые платежи и статусы провайдеров.</p>
          </div>
          <Link href="/crm/payments" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
            Сбросить фильтры
          </Link>
        </div>

        <form method="get" className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[color:var(--bp-muted)]">Статус</span>
            <select name="paymentStatus" defaultValue={paymentStatus} className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2">
              <option value="">Все</option>
              {paymentStatusOptions.map((status) => (
                <option key={status} value={status}>{paymentStatusLabels[status]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[color:var(--bp-muted)]">Провайдер</span>
            <select name="paymentProvider" defaultValue={paymentProvider} className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2">
              <option value="">Все</option>
              {paymentProviderOptions.map((provider) => (
                <option key={provider} value={provider}>{paymentProviderLabels[provider]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[color:var(--bp-muted)]">Сценарий</span>
            <select name="paymentScenario" defaultValue={paymentScenario} className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2">
              <option value="">Все</option>
              {paymentScenarioOptions.map((scenario) => (
                <option key={scenario} value={scenario}>{paymentScenarioLabels[scenario]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[color:var(--bp-muted)]">Поиск</span>
            <input
              name="paymentSearch"
              defaultValue={paymentSearch}
              placeholder="ID, запись, клиент, статус банка"
              className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            />
          </label>
          <div className="md:col-span-4">
            <button type="submit" className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-medium text-white">
              Применить
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-[color:var(--bp-muted)]">
              <tr>
                <th className="py-2 pr-3">Платеж</th>
                <th className="py-2 pr-3">Клиент</th>
                <th className="py-2 pr-3">Запись</th>
                <th className="py-2 pr-3">Сумма</th>
                <th className="py-2 pr-3">Провайдер</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 pr-3">Возвраты</th>
                <th className="py-2 pr-3">Дата</th>
              </tr>
            </thead>
            <tbody>
              {clientPayments.map((payment: any) => {
                const serviceNames = payment.appointment?.services.map((item: any) => item.service.name).join(", ");
                const lastTransaction = payment.transactions[0];
                const refundTotal = payment.refunds
                  .filter((refund: any) => refund.status === "PENDING" || refund.status === "SUCCEEDED")
                  .reduce((sum: number, refund: any) => sum + Number(refund.amount), 0);
                return (
                  <tr key={payment.id} className="border-t border-[color:var(--bp-stroke)] align-top">
                    <td className="py-3 pr-3">
                      <div className="font-medium">#{payment.id}</div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{paymentScenarioLabels[payment.scenario] ?? payment.scenario}</div>
                      {payment.providerRef ? <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Ref: {payment.providerRef}</div> : null}
                    </td>
                    <td className="py-3 pr-3">
                      <div>{clientLabel(payment.client)}</div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{payment.client?.phone ?? payment.client?.email ?? "—"}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div>{payment.appointmentId ? `#${payment.appointmentId}` : "—"}</div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{serviceNames || "Услуги не указаны"}</div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{formatPaymentDate(payment.appointment?.startAt)}</div>
                    </td>
                    <td className="py-3 pr-3 font-medium">{money(payment.amount)} {payment.currency}</td>
                    <td className="py-3 pr-3">
                      <div>{payment.provider ? paymentProviderLabels[payment.provider] ?? payment.provider : "—"}</div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{providerStatusLabel(payment.providerStatus ?? lastTransaction?.providerStatus)}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1 text-xs">
                        {paymentStatusLabels[payment.status] ?? payment.status}
                      </span>
                      <div className="mt-2 text-xs text-[color:var(--bp-muted)]">Оплачен: {formatPaymentDate(payment.paidAt ?? lastTransaction?.paidAt)}</div>
                    </td>
                    <td className="py-3 pr-3">
                      {payment.refunds.length ? (
                        <>
                          <div>{money(refundTotal)} {payment.currency}</div>
                          <div className="mt-1 grid gap-1 text-xs text-[color:var(--bp-muted)]">
                            {payment.refunds.map((refund: any, refundIndex: number) => (
                              <div key={refund.id}>
                                Возврат {refundIndex + 1}: {refundStatusLabels[refund.status] ?? refund.status}
                                {" · "}
                                {formatPaymentDate(refund.completedAt ?? refund.createdAt)}
                                {refund.providerStatus ? ` · ${providerStatusLabel(refund.providerStatus)}` : ""}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : "—"}
                      <PaymentRefundAction
                        intentId={payment.id}
                        status={payment.status}
                        providerRef={payment.providerRef}
                        amountRub={Number(payment.amount)}
                        refundedRub={refundTotal}
                        currency={payment.currency}
                      />
                    </td>
                    <td className="py-3 pr-3">{formatPaymentDate(payment.createdAt)}</td>
                  </tr>
                );
              })}
              {!clientPayments.length ? (
                <tr>
                  <td colSpan={8} className="py-5 text-[color:var(--bp-muted)]">Платежей по выбранным фильтрам нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Счета платформы</h2>
        <div className="mt-4 grid gap-3 text-sm">
          {invoices.map((invoice: any) => (
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
