"use client";

import { useState } from "react";

type PlanCreateFormProps = {
  onCreated?: () => void;
};

export default function PlanCreateForm({ onCreated }: PlanCreateFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v1/platform/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          priceMonthly,
          currency,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось создать тариф");
        return;
      }

      setName("");
      setCode("");
      setPriceMonthly("");
      if (onCreated) onCreated();
      else window.location.reload();
    } catch {
      setError("Не удалось создать тариф");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Код
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2"
            required
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Цена в месяц
          <input
            value={priceMonthly}
            onChange={(event) => setPriceMonthly(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Валюта
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2"
          />
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {loading ? "Создание..." : "Создать тариф"}
      </button>
    </form>
  );
}
