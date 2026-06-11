"use client";

import { useState } from "react";

type SubscriptionCheckoutProps = {
  planId: number;
  name: string;
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
    paymentUrl?: string;
    qrUrl?: string;
    qrPayload?: string;
  };
  error?: { message?: string };
};

export default function SubscriptionCheckout({
  planId,
  name,
  priceLabel,
  billingPeriodLabel,
  gracePeriodDays,
  description,
  isCurrent,
  badge,
  highlights = [],
}: SubscriptionCheckoutProps) {
  const [open, setOpen] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<"card" | "sbp" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ qrUrl?: string; qrPayload?: string } | null>(null);

  const startCheckout = async (method: "card" | "sbp") => {
    setLoadingMethod(method);
    setError(null);
    setQr(null);
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
              <p className="mt-2 text-sm leading-6 text-[color:var(--bp-muted)]">
                {description}
              </p>
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
          <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
            за {billingPeriodLabel}
          </div>
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
          onClick={() => setOpen(true)}
          className="mt-auto w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
        >
          {isCurrent ? "Продлить" : "Оплатить"}
        </button>
      </article>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-[color:var(--bp-muted)]">
                  Оплата подписки
                </div>
                <h3 className="mt-1 text-xl font-semibold">{name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-sm"
              >
                X
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] p-4">
              <div className="text-2xl font-semibold">{priceLabel} ₽</div>
              <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
                {billingPeriodLabel} CRM
              </div>
              {gracePeriodDays > 0 ? (
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                  После окончания будет {gracePeriodDays} дней на продление.
                </div>
              ) : null}
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
                  <img
                    src={qr.qrUrl}
                    alt="QR для оплаты СБП"
                    className="mx-auto h-56 w-56 object-contain"
                  />
                ) : null}
                {qr.qrPayload ? (
                  <div className="mt-2 break-all text-xs text-[color:var(--bp-muted)]">
                    {qr.qrPayload}
                  </div>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            <p className="mt-4 text-xs text-[color:var(--bp-muted)]">
              После подтверждения банка срок подписки продлится автоматически.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
