import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";
import { applySuccessfulPlatformPayment } from "@/lib/payments/apply-payment";
import { getTbankPaymentState, isTbankFinalSuccessStatus } from "@/lib/payments/providers/tbank";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function statusLabel(status: string | null | undefined) {
  if (status === "CONFIRMED") return "подтвержден";
  if (status === "AUTHORIZED") return "авторизован";
  if (status === "NEW") return "создан";
  if (status === "REJECTED") return "отклонен";
  if (status === "CANCELED") return "отменен";
  if (status === "REFUNDED") return "возвращен";
  return status ?? "ожидает ответа";
}

async function loadInvoice(invoiceId: number, accountId: number) {
  return prisma.platformInvoice.findFirst({ where: { id: invoiceId, accountId } });
}

async function loadInvoiceAiTokens(invoiceId: number) {
  const rows = await prisma.$queryRaw<Array<{ creditTokens: number }>>`
    SELECT "creditTokens"
    FROM "AiAccessPurchase"
    WHERE "invoiceId" = ${invoiceId}
  `;
  return rows.reduce((sum, item) => sum + item.creditTokens, 0);
}

export default async function CrmBillingSuccessPage({ searchParams }: PageProps) {
  const session = await requireCrmPermission("crm.payments.read");
  const params = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const invoiceId = readId(params.invoiceId);

  let invoice = invoiceId ? await loadInvoice(invoiceId, session.accountId) : null;
  let syncError: string | null = null;

  if (invoice?.paymentProvider === "tbank" && invoice.providerPaymentId && invoice.status !== "PAID") {
    try {
      const state = await getTbankPaymentState(invoice.providerPaymentId);
      await prisma.platformInvoice.update({
        where: { id: invoice.id },
        data: { providerStatus: state.Status ?? invoice.providerStatus },
      });
      await prisma.platformPayment.updateMany({
        where: { provider: "tbank", providerRef: invoice.providerPaymentId },
        data: { providerStatus: state.Status ?? invoice.providerStatus, rawProviderJson: state },
      });

      if (isTbankFinalSuccessStatus(state.Status)) {
        await applySuccessfulPlatformPayment({
          invoiceId: invoice.id,
          provider: "tbank",
          providerPaymentId: invoice.providerPaymentId,
          method: invoice.paymentMethod,
          providerStatus: state.Status,
          rawProviderJson: state,
        });
      }
      invoice = await loadInvoice(invoice.id, session.accountId);
    } catch (error) {
      syncError = error instanceof Error ? error.message : "Не удалось проверить статус платежа";
    }
  }

  const tokens = invoice ? await loadInvoiceAiTokens(invoice.id) : 0;
  const isPaid = invoice?.status === "PAID";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 py-10">
      <section className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплата</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isPaid ? "Оплата подтверждена" : "Проверяем оплату"}
        </h1>

        {!invoice ? (
          <p className="mt-4 text-sm text-[color:var(--bp-muted)]">Счет не найден или относится к другому аккаунту.</p>
        ) : (
          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
              <div className="font-medium">{invoice.description ?? `Счет #${invoice.id}`}</div>
              <div className="mt-1 text-[color:var(--bp-muted)]">
                #{invoice.id} · {money(invoice.amount)} {invoice.currency} · статус банка: {statusLabel(invoice.providerStatus)}
              </div>
              {tokens > 0 ? (
                <div className="mt-2 text-[color:var(--bp-muted)]">
                  {isPaid ? "Начислено" : "После подтверждения будет начислено"}: {tokens.toLocaleString("ru-RU")} токенов
                </div>
              ) : null}
            </div>

            {syncError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                Статус не удалось проверить автоматически: {syncError}
              </div>
            ) : null}

            {!isPaid ? (
              <p className="text-[color:var(--bp-muted)]">
                Если банк уже показал успешную оплату, обнови эту страницу. На localhost webhook от банка может не дойти, поэтому страница сама проверяет статус по API.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-medium text-white" href="/crm/assistant/site">
            К ассистенту
          </Link>
          <Link className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-medium" href="/crm/payments">
            Счета
          </Link>
          {!isPaid && invoiceId ? (
            <Link className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-medium" href={`/crm/billing/success?invoiceId=${invoiceId}`}>
              Проверить еще раз
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
