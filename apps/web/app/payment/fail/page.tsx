import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { refreshAccountPaymentIntent } from "@/lib/account-payments/checkout";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function money(value: unknown, currency = "RUB") {
  return `${Number(value ?? 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

async function loadIntent(intentId: number) {
  return prisma.paymentIntent.findUnique({
    where: { id: intentId },
    include: {
      account: { select: { name: true, slug: true } },
    },
  });
}

export default async function AccountPaymentFailPage({ searchParams }: PageProps) {
  const params = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const intentId = readId(params.intentId);

  let intent = intentId ? await loadIntent(intentId) : null;
  let syncError: string | null = null;

  if (intent?.providerRef && intent.status !== "SUCCEEDED" && intent.status !== "FAILED") {
    try {
      await refreshAccountPaymentIntent(intent.id);
      intent = await loadIntent(intent.id);
    } catch (error) {
      syncError = error instanceof Error ? error.message : "Не удалось проверить статус оплаты";
    }
  }

  const isPaid = intent?.status === "SUCCEEDED";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-10">
      <section className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплата</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isPaid ? "Оплата подтверждена" : "Оплата не прошла"}
        </h1>

        {intent ? (
          <div className="mt-5 rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3 text-sm">
            <div className="font-medium">{intent.account.name}</div>
            <div className="mt-1 text-[color:var(--bp-muted)]">
              Платеж #{intent.id} · {money(intent.amount, intent.currency)}
              {intent.providerStatus ? ` · статус банка: ${intent.providerStatus}` : ""}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--bp-muted)]">Платеж не найден.</p>
        )}

        {syncError ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Статус не удалось проверить автоматически: {syncError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {intent?.paymentUrl && !isPaid ? (
            <Link className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-medium text-white" href={intent.paymentUrl}>
              Повторить оплату
            </Link>
          ) : null}
          {intent?.account.slug ? (
            <Link className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-medium" href={`/${intent.account.slug}`}>
              На сайт
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
