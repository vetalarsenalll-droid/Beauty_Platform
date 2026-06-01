"use client";

import { useState } from "react";

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
  const [qr, setQr] = useState<{ qrUrl?: string; qrPayload?: string } | null>(null);

  const startCheckout = async (method: "card" | "sbp") => {
    setError(null);
    setQr(null);
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
      if (method === "sbp" && (payload.data.qrUrl || payload.data.qrPayload)) {
        setQr({ qrUrl: payload.data.qrUrl, qrPayload: payload.data.qrPayload });
        return;
      }
      if (payload.data.paymentUrl) {
        window.location.href = payload.data.paymentUrl;
        return;
      }
      setError("Банк не вернул ссылку на оплату");
    } catch {
      setError("Не удалось создать оплату");
    } finally {
      setLoadingMethod(null);
    }
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
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-xl bg-[color:var(--bp-accent)] px-3 py-2 text-sm font-medium text-white"
        >
          {pendingInvoiceId ? `Оплатить счёт #${pendingInvoiceId}` : "Купить"}
        </button>
      </article>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-[color:var(--bp-muted)]">Оплата AI-пакета</div>
                <h3 className="mt-1 text-xl font-semibold">{name}</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-sm">
                ×
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] p-4">
              <div className="text-2xl font-semibold">{priceLabel} ₽</div>
              <div className="mt-1 text-sm text-[color:var(--bp-muted)]">{tokensLabel} токенов</div>
            </div>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                disabled={loadingMethod != null}
                onClick={() => startCheckout("card")}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loadingMethod === "card" ? "Создаём оплату..." : "Банковской картой"}
              </button>
              <button
                type="button"
                disabled={loadingMethod != null}
                onClick={() => startCheckout("sbp")}
                className="rounded-xl bg-[#211052] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loadingMethod === "sbp" ? "Создаём QR..." : "СБП"}
              </button>
            </div>

            {qr ? (
              <div className="mt-4 rounded-xl border border-[color:var(--bp-stroke)] p-3 text-sm">
                {qr.qrUrl && (qr.qrUrl.startsWith("http") || qr.qrUrl.startsWith("data:")) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr.qrUrl} alt="QR для оплаты СБП" className="mx-auto h-56 w-56 object-contain" />
                ) : null}
                {qr.qrPayload ? <div className="mt-2 break-all text-xs text-[color:var(--bp-muted)]">{qr.qrPayload}</div> : null}
              </div>
            ) : null}

            {error ? <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            <p className="mt-4 text-xs text-[color:var(--bp-muted)]">
              После оплаты банк пришлёт подтверждение, и токены начислятся автоматически.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
