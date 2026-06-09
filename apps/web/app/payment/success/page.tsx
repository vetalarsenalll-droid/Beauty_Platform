import Link from "next/link";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { refreshAccountPaymentIntent } from "@/lib/account-payments/checkout";
import { buildPublicSlugId } from "@/lib/public-slug";
import { normalizeDraft, type SiteBlock, type SiteDraft, type SiteTheme } from "@/lib/site-builder";
import { buildBookingVars, normalizeStyle } from "@/app/[publicSlug]/_shared/public-render";

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

function findBookingBlock(draft: SiteDraft) {
  const pages = (draft.pages ?? { home: draft.blocks }) as Partial<Record<string, SiteBlock[]>>;
  return (
    pages.booking?.find((block: SiteBlock) => block.type === "booking") ??
    pages.home?.find((block: SiteBlock) => block.type === "booking") ??
    draft.blocks.find((block) => block.type === "booking") ??
    null
  );
}

function paymentPageTheme(draft: SiteDraft | null, accountName: string): { mode: SiteTheme["mode"]; style: CSSProperties } {
  const normalizedDraft = normalizeDraft(draft, accountName);
  const globalTheme = normalizedDraft.theme;
  const pageTheme = normalizedDraft.pageThemes?.booking;
  const theme: SiteTheme = pageTheme
    ? {
        ...globalTheme,
        ...pageTheme,
        lightPalette: { ...globalTheme.lightPalette, ...pageTheme.lightPalette },
        darkPalette: { ...globalTheme.darkPalette, ...pageTheme.darkPalette },
      }
    : globalTheme;
  const palette = theme.mode === "dark" ? theme.darkPalette : theme.lightPalette;
  const bookingBlock = findBookingBlock(normalizedDraft) ?? ({
    id: "payment-booking-style",
    type: "booking",
    variant: "v1",
    data: { style: {} },
  } satisfies SiteBlock);
  const style = normalizeStyle(bookingBlock, theme);
  const bookingVars = buildBookingVars(style, theme);
  const isDark = theme.mode === "dark";
  const sectionBg = isDark ? style.sectionBgDarkResolved : style.sectionBgLightResolved;
  const panelBg = isDark ? style.blockBgDarkResolved : style.blockBgLightResolved;
  const textColor = isDark ? style.textColorDarkResolved : style.textColorLightResolved;
  const mutedColor = isDark ? style.mutedColorDarkResolved : style.mutedColorLightResolved;
  const borderColor =
    (isDark ? style.panelBorderColorDark : style.panelBorderColorLight) ||
    (isDark ? style.borderColorDarkResolved : style.borderColorLightResolved) ||
    palette.borderColor ||
    "transparent";
  const buttonColor = isDark ? style.buttonColorDarkResolved : style.buttonColorLightResolved;
  const buttonTextColor = isDark ? style.buttonTextColorDarkResolved : style.buttonTextColorLightResolved;

  return {
    mode: theme.mode,
    style: {
      ...bookingVars,
      "--bp-surface": sectionBg || palette.surfaceColor,
      "--bp-paper": panelBg || palette.panelColor,
      "--bp-panel": panelBg || palette.panelColor,
      "--bp-ink": textColor || palette.textColor,
      "--bp-muted": mutedColor || palette.mutedColor,
      "--bp-stroke": borderColor,
      "--bp-accent": buttonColor || palette.buttonColor,
      "--bp-button-text": buttonTextColor || palette.buttonTextColor,
      "--site-font-body": style.fontBody || palette.fontBody,
      "--site-font-heading": style.fontHeading || palette.fontHeading,
    } as CSSProperties,
  };
}

async function loadPaymentSiteDraft(accountId: number): Promise<SiteDraft | null> {
  const publicPage = await prisma.publicPage.findFirst({
    where: { accountId },
    include: {
      publishedVersion: {
        select: { contentJson: true },
      },
    },
  });

  return (publicPage?.publishedVersion?.contentJson ?? publicPage?.draftJson ?? null) as SiteDraft | null;
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

  const siteDraft = intent?.account ? await loadPaymentSiteDraft(intent.account.id) : null;
  const paymentTheme = paymentPageTheme(siteDraft, intent?.account.name ?? "Онлайн-запись");
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
    <main
      className="min-h-screen bg-[color:var(--bp-surface,#f6f7fb)] px-4 py-10 text-[color:var(--bp-ink,#0f172a)]"
      data-site-theme={paymentTheme.mode}
      style={paymentTheme.style}
    >
      <section className="booking-root mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center justify-center">
        <div
          className="w-full border border-[color:var(--bp-stroke,#e5e7eb)] bg-[color:var(--bp-paper,#fff)] p-6 shadow-[var(--bp-shadow-soft)] sm:p-8"
          style={{
            borderRadius: "var(--booking-panel-radius, var(--bp-radius, 28px))",
            borderColor: "var(--booking-panel-border, var(--bp-stroke,#e5e7eb))",
            borderWidth: "var(--booking-border-width, 1px)",
            fontFamily: "var(--bp-font-body, var(--site-font-body, inherit))",
          }}
        >
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

          {!intent ? (
            <div
              className="mt-6 border border-[color:var(--bp-stroke,#e5e7eb)] px-4 py-4 text-sm text-[color:var(--bp-muted,#64748b)]"
              style={{ borderRadius: "var(--booking-card-radius, var(--booking-panel-radius, 20px))" }}
            >
              Платеж не найден.
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              <div
                className="border border-[color:var(--bp-stroke,#e5e7eb)] px-4 py-4"
                style={{
                  borderRadius: "var(--booking-card-radius, var(--booking-panel-radius, 20px))",
                  backgroundColor: "var(--booking-sub-bg, transparent)",
                  backgroundImage: "var(--booking-card-gradient, none)",
                }}
              >
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
                <div
                  className="border border-[color:var(--bp-stroke,#e5e7eb)] px-4 py-4"
                  style={{
                    borderRadius: "var(--booking-card-radius, var(--booking-panel-radius, 20px))",
                    backgroundColor: "var(--booking-sub-bg, transparent)",
                    backgroundImage: "var(--booking-card-gradient, none)",
                  }}
                >
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
              <Link
                className="px-5 py-3 text-sm font-semibold"
                href={siteHref}
                style={{
                  borderRadius: "var(--booking-button-radius, var(--bp-button-radius, 16px))",
                  backgroundColor: "var(--bp-accent)",
                  color: "var(--bp-button-text)",
                }}
              >
                На сайт
              </Link>
            ) : null}
            {!isPaid && intent?.paymentUrl ? (
              <Link
                className="border px-5 py-3 text-sm font-semibold"
                href={intent.paymentUrl}
                style={{
                  borderRadius: "var(--booking-button-radius, var(--bp-button-radius, 16px))",
                  borderColor: "var(--booking-secondary-button-border, var(--bp-stroke,#e5e7eb))",
                  backgroundColor: "var(--booking-secondary-button-bg, transparent)",
                  color: "var(--booking-secondary-button-text, var(--bp-ink))",
                }}
              >
                Вернуться к оплате
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
