"use client";

import { UnoptimizedImage } from "@/components/unoptimized-image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type SubscriptionCheckoutProps = {
  planId: number;
  name: string;
  priceRub: number;
  priceLabel: string;
  billingPeriodLabel: string;
  gracePeriodDays: number;
  description: string | null;
  isCurrent: boolean;
  badge?: string;
  highlights?: string[];
};

type CheckoutResponse = {
  data?: {
    activated?: boolean;
    invoiceId: number | null;
    paymentUrl?: string;
    qrUrl?: string;
    qrPayload?: string;
  };
  error?: { message?: string };
};

type PaymentSheet = {
  invoiceId: number;
  paymentUrl: string | null;
  cardPaymentUrl: string | null;
  qrUrl: string | null;
  qrPayload: string | null;
};

const svgToDataUri = (svg: string) => {
  if (svg.startsWith("data:")) return svg;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const crispQrSvgMarkup = (svg: string) => {
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<svg")) return null;
  return trimmed
    .replace(/<svg(?![^>]*shape-rendering=)/i, '<svg shape-rendering="crispEdges"')
    .replace(/<path(?![^>]*shape-rendering=)/gi, '<path shape-rendering="crispEdges"')
    .replace(/<rect(?![^>]*shape-rendering=)/gi, '<rect shape-rendering="crispEdges"');
};

export default function SubscriptionCheckout({
  planId,
  name,
  priceRub,
  priceLabel,
  billingPeriodLabel,
  gracePeriodDays,
  description,
  isCurrent,
  badge,
  highlights = [],
}: SubscriptionCheckoutProps) {
  const router = useRouter();
  const isFree = priceRub <= 0;
  const [open, setOpen] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<"card" | "sbp" | "free" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentSheet, setPaymentSheet] = useState<PaymentSheet | null>(null);
  const qrMarkup = useMemo(
    () => (paymentSheet?.qrUrl ? crispQrSvgMarkup(paymentSheet.qrUrl) : null),
    [paymentSheet?.qrUrl],
  );
  const qrImageSrc =
    paymentSheet?.qrUrl && !qrMarkup
      ? paymentSheet.qrUrl.trim().startsWith("<svg")
        ? svgToDataUri(paymentSheet.qrUrl.trim())
        : paymentSheet.qrUrl.trim().startsWith("http") ||
            paymentSheet.qrUrl.trim().startsWith("data:")
          ? paymentSheet.qrUrl
          : null
      : null;

  const startCheckout = useCallback(
    async (method: "card" | "sbp") => {
      setError(null);
      setLoadingMethod(isFree ? "free" : method);
      try {
        const response = await fetch(`/api/v1/crm/billing/plans/${planId}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method }),
        });
        const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;
        if (!response.ok || !payload?.data) {
          setError(payload?.error?.message ?? "Не удалось создать оплату");
          return;
        }

        if (payload.data.activated) {
          setOpen(false);
          setPaymentSheet(null);
          router.refresh();
          return;
        }

        if (!payload.data.invoiceId) {
          setError("Не удалось создать счёт на оплату");
          return;
        }

        if (method === "card") {
          if (payload.data.paymentUrl) {
            setPaymentSheet((current) => ({
              invoiceId: payload.data!.invoiceId!,
              paymentUrl: current?.paymentUrl ?? payload.data!.paymentUrl ?? null,
              cardPaymentUrl: payload.data!.paymentUrl ?? null,
              qrUrl: current?.qrUrl ?? null,
              qrPayload: current?.qrPayload ?? null,
            }));
            window.open(payload.data.paymentUrl, "_blank", "noopener,noreferrer");
            return;
          }
          setError("Банк не вернул ссылку на оплату картой");
          return;
        }

        setPaymentSheet({
          invoiceId: payload.data.invoiceId,
          paymentUrl: payload.data.paymentUrl ?? null,
          cardPaymentUrl: null,
          qrUrl: payload.data.qrUrl ?? null,
          qrPayload: payload.data.qrPayload ?? null,
        });
        if (!payload.data.qrUrl && !payload.data.qrPayload) {
          setError("Банк не вернул QR-код СБП. Можно оплатить картой.");
        }
      } catch {
        setError("Не удалось создать оплату");
      } finally {
        setLoadingMethod(null);
      }
    },
    [isFree, planId, router],
  );

  useEffect(() => {
    if (!open || isFree || paymentSheet || loadingMethod) return;
    void startCheckout("sbp");
  }, [isFree, loadingMethod, open, paymentSheet, startCheckout]);

  const closeModal = () => {
    setOpen(false);
    setError(null);
    setLoadingMethod(null);
    setPaymentSheet(null);
  };

  const handlePrimaryAction = () => {
    if (isFree) {
      void startCheckout("card");
      return;
    }
    setOpen(true);
    setError(null);
  };

  return (
    <>
      <article
        className={`relative flex min-h-[420px] flex-col rounded-[28px] border bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)] ${
          badge
            ? "border-slate-900 ring-2 ring-slate-900/10"
            : "border-[color:var(--bp-stroke)]"
        }`}
      >
        {badge ? (
          <div className="absolute -top-3 left-6 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            {badge}
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">{name}</h3>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-[color:var(--bp-muted)]">{description}</p>
            ) : null}
          </div>
          {isCurrent ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              текущий
            </span>
          ) : null}
        </div>
        <div className="mt-6">
          <div className="text-3xl font-semibold">{priceLabel} ₽</div>
          <div className="mt-1 text-sm text-[color:var(--bp-muted)]">за {billingPeriodLabel}</div>
          {gracePeriodDays > 0 ? (
            <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
              {gracePeriodDays} дней на продление после окончания тарифа
            </div>
          ) : null}
        </div>
        {highlights.length ? (
          <div className="mt-6 grid gap-2 text-sm">
            {highlights.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={loadingMethod !== null}
          className="mt-auto w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loadingMethod === "free"
            ? "Подключаем..."
            : isFree
              ? isCurrent
                ? "Продлить бесплатно"
                : "Подключить бесплатно"
              : isCurrent
                ? "Продлить"
                : "Оплатить"}
        </button>
        {error && !open ? (
          <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
      </article>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-[420px] rounded-[24px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплата подписки</div>
                <h3 className="mt-1 text-xl font-semibold">Выберите способ оплаты</h3>
                <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
                  {name} · к оплате {priceLabel} ₽
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-sm"
                aria-label="Закрыть оплату"
              >
                X
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-[color:var(--bp-stroke)] p-4 text-center">
              <div className="text-sm font-semibold">Оплатить через СБП</div>
              {loadingMethod === "sbp" && !paymentSheet ? (
                <div className="py-20 text-sm text-[color:var(--bp-muted)]">Создаём QR...</div>
              ) : qrMarkup || qrImageSrc ? (
                <div className="mx-auto mt-3 flex max-w-[260px] justify-center rounded-xl bg-white p-3">
                  {qrMarkup ? (
                    <div
                      aria-label="QR-код для оплаты через СБП"
                      role="img"
                      className="aspect-square w-full max-w-[230px] [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: qrMarkup }}
                    />
                  ) : qrImageSrc ? (
                    <UnoptimizedImage
                      src={qrImageSrc}
                      alt="QR-код для оплаты через СБП"
                      className="aspect-square w-full max-w-[230px]"
                    />
                  ) : null}
                </div>
              ) : (
                <div className="py-12 text-sm text-[color:var(--bp-muted)]">QR-код пока недоступен.</div>
              )}
              <div className="mt-3 text-xs text-[color:var(--bp-muted)]">
                Отсканируйте QR-код в приложении банка. После оплаты подписка активируется автоматически.
              </div>
              {paymentSheet?.qrPayload ? (
                <a
                  href={paymentSheet.qrPayload}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-4 py-3 text-sm font-semibold text-white sm:hidden"
                >
                  Открыть банк
                </a>
              ) : null}
            </div>

            <button
              type="button"
              disabled={loadingMethod !== null}
              onClick={() => startCheckout("card")}
              className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {loadingMethod === "card" ? "Создаём оплату..." : "Оплатить картой"}
            </button>
            {error ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
