"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanRowActionsProps = {
  planId: number;
  initialName: string;
  initialCode: string;
  initialPrice: string;
  initialCurrency: string;
  initialActive: boolean;
};

export default function PlanRowActions({
  planId,
  initialName,
  initialCode,
  initialPrice,
  initialCurrency,
  initialActive,
}: PlanRowActionsProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const [price, setPrice] = useState(initialPrice);
  const [currency, setCurrency] = useState(initialCurrency);
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
          code,
          priceMonthly: price,
          currency,
          isActive: active,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload?.error?.message ?? "Не удалось сохранить изменения.";
        alert(message);
        return;
      }
      setName(payload?.data?.name ?? name);
      setCode(payload?.data?.code ?? code);
      setPrice(payload?.data?.priceMonthly ?? price);
      setCurrency(payload?.data?.currency ?? currency);
      setActive(payload?.data?.isActive ?? active);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-[color:var(--bp-muted)]">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
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
