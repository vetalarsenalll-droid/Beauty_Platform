"use client";

import { UnoptimizedImage } from "@/components/unoptimized-image";
import { useCallback, useEffect, useMemo, useState } from "react";

type AiPackageCheckoutProps = {
  packageId: number;
  name: string;
  priceLabel: string;
  tokensLabel: string;
  pricePerMillionLabel: string;
  description: string | null;
  pendingInvoiceId: number | null;
};

type CheckoutResponse = {
  data?: {
    invoiceId: number;
    paymentUrl?: string;
    qrUrl?: string;
    qrPayload?: string;
  };
  error?: { message?: string };
};

type PaymentSheet = {
  invoiceId: number;
  amountLabel: string;
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

export default function AiPackageCheckout({
  packageId,
  name,
  priceLabel,
  tokensLabel,
  pricePerMillionLabel,
  description,
  pendingInvoiceId,
}: AiPackageCheckoutProps) {
  const [open, setOpen] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<"card" | "sbp" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentSheet, setPaymentSheet] = useState<PaymentSheet | null>(null);
  const qrMarkup = useMemo(
    () => (paymentSheet?.qrUrl ? crispQrSvgMarkup(paymentSheet.qrUrl) : null),
    [paymentSheet?.qrUrl]
  );
  const qrImageSrc =
    paymentSheet?.qrUrl && !qrMarkup
      ? paymentSheet.qrUrl.trim().startsWith("<svg")
        ? svgToDataUri(paymentSheet.qrUrl.trim())
        : paymentSheet.qrUrl.trim().startsWith("http") || paymentSheet.qrUrl.trim().startsWith("data:")
          ? paymentSheet.qrUrl
          : null
      : null;

  const startCheckout = useCallback(async (method: "card" | "sbp") => {
    setError(null);
    setLoadingMethod(method);
    try {
      const response = await fetch(`/api/v1/crm/assistant/packages/${packageId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;
      if (!response.ok || !payload?.data) {
        setError(payload?.error?.message ?? "Не удалось создать оплату");
        return;
      }
      if (method === "card") {
        if (payload.data.paymentUrl) {
          setPaymentSheet((current) => ({
            invoiceId: payload.data!.invoiceId,
            amountLabel: priceLabel,
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
        amountLabel: priceLabel,
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
  }, [packageId, priceLabel]);

  useEffect(() => {
    if (!open || paymentSheet || loadingMethod) return;
    void startCheckout("sbp");
  }, [loadingMethod, open, paymentSheet, startCheckout]);

  const closeModal = () => {
    setOpen(false);
    setError(null);
    setLoadingMethod(null);
    setPaymentSheet(null);
  };

  return (
    <>
      <article className="rounded-xl border border-[color:var(--bp-stroke)] p-4">
        <div className="font-medium">{name}</div>
        <div className="mt-2 text-2xl font-semibold">{priceLabel} ₽</div>
        <div className="mt-1 text-sm text-[color:var(--bp-muted)]">{tokensLabel} токенов</div>
        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{pricePerMillionLabel} ₽ за 1 млн токенов</div>
        {description ? <div className="mt-2 text-xs text-[color:var(--bp-muted)]">{description}</div> : null}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          className="mt-4 w-full rounded-xl bg-[color:var(--bp-accent)] px-3 py-2 text-sm font-medium text-white"
        >
          {pendingInvoiceId ? `Оплатить счёт #${pendingInvoiceId}` : "Купить"}
        </button>
      </article>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
          <div
            className="w-full max-w-[420px] border p-5 shadow-[var(--bp-shadow-soft)]"
            style={{
              borderRadius: "var(--booking-panel-radius, var(--bp-radius, 24px))",
              borderColor: "var(--booking-panel-border, var(--bp-stroke))",
              borderWidth: "var(--booking-border-width, 1px)",
              backgroundColor: "var(--bp-paper)",
              color: "var(--bp-ink)",
              fontFamily: "var(--bp-font-body, var(--site-font-body, inherit))",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Оплата</div>
                <h3 className="mt-1 text-xl font-semibold text-[color:var(--bp-ink)]">
                  Выберите способ оплаты
                </h3>
                <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
                  К оплате {paymentSheet?.amountLabel ?? priceLabel} ₽
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="border px-3 py-1 text-sm"
                style={{
                  borderRadius: "var(--booking-button-radius, var(--bp-button-radius, 16px))",
                  borderColor: "var(--booking-secondary-button-border, var(--bp-stroke))",
                  backgroundColor: "var(--booking-secondary-button-bg, transparent)",
                  color: "var(--booking-secondary-button-text, var(--bp-ink))",
                }}
                aria-label="Закрыть оплату"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <div
                className="border p-4 text-center"
                style={{
                  borderRadius: "var(--booking-card-radius, var(--booking-panel-radius, 24px))",
                  borderColor: "var(--booking-card-border, var(--bp-stroke))",
                  backgroundColor: "var(--booking-sub-bg, transparent)",
                  backgroundImage: "var(--booking-card-gradient, none)",
                }}
              >
                <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Оплатить через СБП</div>
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
                  Отсканируйте QR-код в приложении банка. После оплаты токены начислятся автоматически.
                </div>
                {paymentSheet?.qrPayload ? (
                  <a
                    href={paymentSheet.qrPayload}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center px-4 py-3 text-sm font-semibold sm:hidden"
                    style={{
                      borderRadius: "var(--booking-button-radius, var(--bp-button-radius, 16px))",
                      backgroundColor: "var(--bp-accent)",
                      color: "var(--bp-button-text)",
                    }}
                  >
                    Открыть банк
                  </a>
                ) : null}
              </div>

              <button
                type="button"
                disabled={loadingMethod != null}
                onClick={() => startCheckout("card")}
                className="mx-4 mb-4 inline-flex w-[calc(100%-2rem)] items-center justify-center border px-4 py-3 text-sm font-semibold disabled:opacity-60"
                style={{
                  borderRadius: "var(--booking-button-radius, var(--bp-button-radius, 16px))",
                  borderColor: "var(--bp-accent)",
                  backgroundColor: "var(--booking-secondary-button-bg, transparent)",
                  color: "var(--booking-secondary-button-text, var(--bp-ink))",
                }}
              >
                {loadingMethod === "card" ? "Создаём оплату..." : "Оплатить картой"}
              </button>
            </div>

            {error ? <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
