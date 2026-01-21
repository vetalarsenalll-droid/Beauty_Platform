import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import BillingCreateInvoiceForm from "./billing-create-invoice-form";
import BillingInvoiceActions from "./billing-invoice-actions";

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  ISSUED: "Выставлен",
  PAID: "Оплачен",
  VOID: "Аннулирован",
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: "В ожидании",
  SUCCEEDED: "Успешно",
  FAILED: "Неуспешно",
};

export default async function PlatformBillingPage() {
  await requirePlatformPermission("platform.plans");

  const [accounts, invoices, payments] = await Promise.all([
    prisma.account.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.platformInvoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { account: true },
    }),
    prisma.platformPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { invoice: { include: { account: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Оплаты
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Выставление счетов
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Ручное выставление счетов и отметка оплат.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Выставить счет</h2>
        <div className="mt-4">
          <BillingCreateInvoiceForm accounts={accounts} />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Счета</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Счетов пока нет.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
              >
                <div>
                  <div className="font-semibold">
                    {invoice.account?.name ??
                      `Аккаунт #${invoice.accountId}`}
                  </div>
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {invoice.amount.toString()} {invoice.currency} ·{" "}
                    {invoiceStatusLabels[invoice.status] ?? invoice.status}
                  </div>
                </div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  {invoice.issuedAt?.toLocaleDateString("ru-RU") ?? "—"}
                </div>
                <BillingInvoiceActions
                  invoiceId={invoice.id}
                  status={invoice.status}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Платежи</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Платежей пока нет.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
              >
                <div>
                  <div className="font-semibold">
                    {payment.invoice?.account?.name ??
                      `Счет #${payment.invoiceId ?? payment.id}`}
                  </div>
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {payment.amount.toString()} {payment.currency} ·{" "}
                    {paymentStatusLabels[payment.status] ?? payment.status}
                  </div>
                </div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  {payment.createdAt.toLocaleDateString("ru-RU")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
