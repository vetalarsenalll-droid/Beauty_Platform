import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default async function CrmBillingFailPage({ searchParams }: PageProps) {
  const session = await requireCrmPermission("crm.payments.read");
  const params = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const invoiceId = readId(params.invoiceId);
  const invoice = invoiceId
    ? await prisma.platformInvoice.findFirst({
        where: { id: invoiceId, accountId: session.accountId },
        select: {
          id: true,
          purpose: true,
          description: true,
          amount: true,
          currency: true,
          paymentUrl: true,
          providerStatus: true,
        },
      })
    : null;

  const primaryHref = invoice?.purpose === "AI_TOKENS" ? "/crm/assistant/site" : "/crm/billing";
  const primaryLabel = invoice?.purpose === "AI_TOKENS" ? "К ассистенту" : "К тарифам и платежам";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 py-10">
      <section className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплата</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Оплата не прошла</h1>

        {invoice ? (
          <div className="mt-5 rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3 text-sm">
            <div className="font-medium">{invoice.description ?? `Счет #${invoice.id}`}</div>
            <div className="mt-1 text-[color:var(--bp-muted)]">
              #{invoice.id} · {money(invoice.amount)} {invoice.currency}
              {invoice.providerStatus ? ` · статус банка: ${invoice.providerStatus}` : ""}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--bp-muted)]">
            Счет не найден или относится к другому аккаунту.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {invoice?.paymentUrl ? (
            <Link className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-medium text-white" href={invoice.paymentUrl}>
              Повторить оплату
            </Link>
          ) : null}
          <Link className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-medium" href={primaryHref}>
            {primaryLabel}
          </Link>
          <Link className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-medium" href="/crm/billing">
            Счета платформы
          </Link>
        </div>
      </section>
    </div>
  );
}
