"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanRowActionsProps = {
  planId: number;
  initialName: string;
  initialPrice: string;
  initialBillingPeriodMonths: number;
  initialTrialPeriodDays: number;
  initialGracePeriodDays: number;
  initialCurrency: string;
  initialDescription: string;
  initialTrial: boolean;
  initialActive: boolean;
};

export default function PlanRowActions({
  planId,
  initialName,
  initialPrice,
  initialBillingPeriodMonths,
  initialTrialPeriodDays,
  initialGracePeriodDays,
  initialCurrency,
  initialDescription,
  initialTrial,
  initialActive,
}: PlanRowActionsProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice);
  const [billingPeriodMonths, setBillingPeriodMonths] = useState(String(initialBillingPeriodMonths));
  const [trialPeriodDays, setTrialPeriodDays] = useState(String(initialTrialPeriodDays));
  const [gracePeriodDays, setGracePeriodDays] = useState(String(initialGracePeriodDays));
  const [currency, setCurrency] = useState(initialCurrency);
  const [description, setDescription] = useState(initialDescription);
  const [trial, setTrial] = useState(initialTrial);
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/platform/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          priceMonthly: price,
          billingPeriodMonths: Number(billingPeriodMonths),
          trialPeriodDays: Number(trialPeriodDays),
          gracePeriodDays: Number(gracePeriodDays),
          currency,
          isTrial: trial,
          isActive: active,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        alert(payload?.error?.message ?? "Не удалось обновить тариф.");
        return;
      }
      setName(payload?.data?.name ?? name);
      setDescription(payload?.data?.description ?? description);
      setPrice(payload?.data?.priceMonthly ?? price);
      setBillingPeriodMonths(String(payload?.data?.billingPeriodMonths ?? billingPeriodMonths));
      setTrialPeriodDays(String(payload?.data?.trialPeriodDays ?? trialPeriodDays));
      setGracePeriodDays(String(payload?.data?.gracePeriodDays ?? gracePeriodDays));
      setCurrency(payload?.data?.currency ?? currency);
      setTrial(payload?.data?.isTrial ?? trial);
      setActive(payload?.data?.isActive ?? active);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
          Название тарифа
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
          Валюта
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
          Цена за период
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            placeholder="Например, 4900"
          />
        </label>
        {trial ? (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Срок пробного тарифа, дней
            <input
              type="number"
              min="1"
              value={trialPeriodDays}
              onChange={(event) => setTrialPeriodDays(event.target.value)}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              placeholder="Например, 14"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Срок подписки, месяцев
            <input
              type="number"
              min="1"
              value={billingPeriodMonths}
              onChange={(event) => setBillingPeriodMonths(event.target.value)}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              placeholder="1, 6 или 12"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
          Льготный период после окончания, дней
          <input
            type="number"
            min="0"
            value={gracePeriodDays}
            onChange={(event) => setGracePeriodDays(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            placeholder="Например, 5"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
        Описание
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          placeholder="Что входит в тариф"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-[color:var(--bp-muted)]">
        <input type="checkbox" checked={trial} onChange={(event) => setTrial(event.target.checked)} />
        Пробный тариф
      </label>
      <label className="flex items-center gap-2 text-xs text-[color:var(--bp-muted)]">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        Активен
      </label>
      <button
        type="button"
        onClick={save}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold"
        disabled={saving}
      >
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
