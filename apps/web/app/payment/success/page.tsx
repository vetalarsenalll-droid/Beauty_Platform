import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { refreshAccountPaymentIntent } from "@/lib/account-payments/checkout";
import { buildPublicSlugId } from "@/lib/public-slug";

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

function paymentStatusLabel(status: string | null | undefined) {
  if (status === "SUCCEEDED") return "Оплачено";
  if (status === "PROCESSING" || status === "REQUIRES_ACTION") return "Проверяем оплату";
  if (status === "FAILED") return "Не оплачено";
  if (status === "CANCELLED") return "Отменено";
  if (status === "EXPIRED") return "Истекло";
  return "Создано";
}

function bankStatusLabel(status: string | null | undefined) {
  const value = String(status ?? "").toUpperCase();
  if (value === "CONFIRMED" || value === "AUTHORIZED" || value === "SUCCEEDED") return "Платеж подтвержден банком";
  if (value === "NEW" || value === "FORM_SHOWED") return "Ожидаем оплату";
  if (value === "REJECTED" || value === "FAILED") return "Банк отклонил платеж";
  if (value === "REFUNDED") return "Платеж возвращен";
  if (value === "PARTIAL_REFUNDED") return "Платеж частично возвращен";
  return status ? `Статус банка: ${status}` : null;
}

async function loadIntent(intentId: number) {
  return prisma.paymentIntent.findUnique({
    where: { id: intentId },
    include: {
      account: { select: { id: true, name: true, slug: true } },
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
    } catch {
      syncError = "Не удалось автоматически проверить статус оплаты.";
    }
  }

  const isPaid = intent?.status === "SUCCEEDED";
  const siteHref = intent?.account ? `/${buildPublicSlugId(intent.account.slug, intent.account.id)}` : null;
  const services = intent?.appointment?.services.map((item) => item.service.name).join(", ");
  const specialist = intent?.appointment?.specialist.user.profile
    ? [intent.appointment.specialist.user.profile.firstName, intent.appointment.specialist.user.profile.lastName]
        .filter(Boolean)
        .join(" ")
    : "";
  const bankStatus = bankStatusLabel(intent?.providerStatus);

  return (
    <main className="min-h-screen bg-[color:var(--bp-surface,#f6f7fb)] px-4 py-10 text-[color:var(--bp-ink,#0f172a)]">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center justify-center">
        <div className="w-full rounded-[28px] border border-[color:var(--bp-stroke,#e5e7eb)] bg-[color:var(--bp-paper,#fff)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <span className="text-2xl font-semibold" aria-hidden="true">✓</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--bp-muted,#64748b)]">Оплата</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {isPaid ? "Оплата подтверждена" : "Проверяем оплату"}
              </h1>
              <p className="mt-2 text-sm text-[color:var(--bp-muted,#64748b)]">
                {isPaid
                  ? "Запись создана, платеж успешно подтвержден."
                  : "Если банк уже показал успешную оплату, обновите страницу через несколько секунд."}
              </p>
            </div>
          </div>

          {!intent ? (
            <div className="mt-6 rounded-2xl border border-[color:var(--bp-stroke,#e5e7eb)] px-4 py-4 text-sm text-[color:var(--bp-muted,#64748b)]">
              Платеж не найден.
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-[color:var(--bp-stroke,#e5e7eb)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-[color:var(--bp-muted,#64748b)]">{intent.account.name}</div>
                    <div className="mt-1 text-lg font-semibold">{money(intent.amount, intent.currency)}</div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {paymentStatusLabel(intent.status)}
                  </span>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-[color:var(--bp-muted,#64748b)]">
                  <div>Платеж #{intent.id}</div>
                  {bankStatus ? <div>{bankStatus}</div> : null}
                </div>
              </div>

              {intent.appointment ? (
                <div className="rounded-2xl border border-[color:var(--bp-stroke,#e5e7eb)] px-4 py-4">
                  <div className="text-sm text-[color:var(--bp-muted,#64748b)]">Запись #{intent.appointment.id}</div>
                  <div className="mt-1 font-semibold">{services || "Услуга"}</div>
                  <div className="mt-2 grid gap-1 text-sm text-[color:var(--bp-muted,#64748b)]">
                    <div>{intent.appointment.location.name}{specialist ? ` · ${specialist}` : ""}</div>
                    <div>
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(intent.appointment.startAt)}
                    </div>
                  </div>
                </div>
              ) : null}

              {syncError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {syncError}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {siteHref ? (
              <Link className="rounded-2xl bg-[color:var(--bp-ink,#0f172a)] px-5 py-3 text-sm font-semibold text-white" href={siteHref}>
                На сайт
              </Link>
            ) : null}
            {!isPaid && intent?.paymentUrl ? (
              <Link className="rounded-2xl border border-[color:var(--bp-stroke,#e5e7eb)] px-5 py-3 text-sm font-semibold" href={intent.paymentUrl}>
                Вернуться к оплате
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
