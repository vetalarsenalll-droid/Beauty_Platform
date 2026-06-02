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

function statusLabel(status: string | null | undefined) {
  if (status === "SUCCEEDED") return "оплачено";
  if (status === "PROCESSING" || status === "REQUIRES_ACTION") return "проверяется";
  if (status === "FAILED") return "не оплачено";
  if (status === "CANCELLED") return "отменено";
  if (status === "EXPIRED") return "истекло";
  return "создано";
}

async function loadIntent(intentId: number) {
  return prisma.paymentIntent.findUnique({
    where: { id: intentId },
    include: {
      account: { select: { name: true, slug: true } },
      appointment: {
        include: {
          location: { select: { name: true } },
          specialist: {
            include: {
              user: { select: { profile: { select: { firstName: true, lastName: true } } } },
            },
          },
          services: {
            include: { service: { select: { name: true } } },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      transactions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export default async function AccountPaymentSuccessPage({ searchParams }: PageProps) {
  const params = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const intentId = readId(params.intentId);

  let intent: Awaited<ReturnType<typeof loadIntent>> | null = intentId ? await loadIntent(intentId) : null;
  let syncError: string | null = null;

  if (intent?.providerRef && intent.status !== "SUCCEEDED") {
    try {
      await refreshAccountPaymentIntent(intent.id);
      intent = await loadIntent(intent.id);
    } catch (error) {
      syncError = error instanceof Error ? error.message : "Не удалось проверить статус оплаты";
    }
  }

  const isPaid = intent?.status === "SUCCEEDED";
  const services = intent?.appointment?.services.map((item) => item.service.name).join(", ");
  const specialist = intent?.appointment?.specialist.user.profile
    ? [
        intent.appointment.specialist.user.profile.firstName,
        intent.appointment.specialist.user.profile.lastName,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-10">
      <section className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплата</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isPaid ? "Оплата подтверждена" : "Проверяем оплату"}
        </h1>

        {!intent ? (
          <p className="mt-4 text-sm text-[color:var(--bp-muted)]">Платеж не найден.</p>
        ) : (
          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
              <div className="font-medium">{intent.account.name}</div>
              <div className="mt-1 text-[color:var(--bp-muted)]">
                Платеж #{intent.id} · {money(intent.amount, intent.currency)} · {statusLabel(intent.status)}
              </div>
              {intent.providerStatus ? (
                <div className="mt-1 text-[color:var(--bp-muted)]">Статус банка: {intent.providerStatus}</div>
              ) : null}
            </div>

            {intent.appointment ? (
              <div className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
                <div className="font-medium">Запись #{intent.appointment.id}</div>
                <div className="mt-1 text-[color:var(--bp-muted)]">
                  {services || "Услуга"} · {intent.appointment.location.name}
                  {specialist ? ` · ${specialist}` : ""}
                </div>
                <div className="mt-1 text-[color:var(--bp-muted)]">
                  {new Intl.DateTimeFormat("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(intent.appointment.startAt)}
                </div>
              </div>
            ) : null}

            {syncError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                Статус не удалось проверить автоматически: {syncError}
              </div>
            ) : null}

            {!isPaid ? (
              <p className="text-[color:var(--bp-muted)]">
                Если банк уже показал успешную оплату, обновите эту страницу. На локальной разработке webhook от банка
                может не дойти, поэтому эта страница дополнительно проверяет статус через API провайдера.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {intent?.account.slug ? (
            <Link className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-medium text-white" href={`/${intent.account.slug}`}>
              На сайт
            </Link>
          ) : null}
          {!isPaid && intent?.paymentUrl ? (
            <Link className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-medium" href={intent.paymentUrl}>
              Вернуться к оплате
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
