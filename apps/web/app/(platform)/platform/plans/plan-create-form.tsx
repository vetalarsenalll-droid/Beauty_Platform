"use client";

import { useState } from "react";

type PlanCreateFormProps = {
  onCreated?: () => void;
};

export default function PlanCreateForm({ onCreated }: PlanCreateFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [limitLocations, setLimitLocations] = useState("");
  const [limitServices, setLimitServices] = useState("");
  const [limitSpecialists, setLimitSpecialists] = useState("");
  const [limitStaff, setLimitStaff] = useState("");
  const [limitClients, setLimitClients] = useState("");
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
          description: description.trim() ? description.trim() : null,
          priceMonthly,
          currency,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось создать тариф");
        return;
      }

      const payload = await response.json();
      const planId = payload?.data?.id as number | undefined;
      if (planId) {
        const features = [
          { key: "limit.locations", value: limitLocations },
          { key: "limit.services", value: limitServices },
          { key: "limit.specialists", value: limitSpecialists },
          { key: "limit.staff", value: limitStaff },
          { key: "limit.clients", value: limitClients },
        ].filter((item) => item.value.trim().length > 0);

        for (const item of features) {
          await fetch(`/api/v1/platform/plans/${planId}/features`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: item.key, value: item.value }),
          });
        }
      }

      setName("");
      setCode("");
      setDescription("");
      setPriceMonthly("");
      setLimitLocations("");
      setLimitServices("");
      setLimitSpecialists("");
      setLimitStaff("");
      setLimitClients("");
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
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Код
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
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
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Валюта
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm">
        Описание
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Лимит локаций
          <input
            value={limitLocations}
            onChange={(event) => setLimitLocations(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например, 3"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Лимит услуг
          <input
            value={limitServices}
            onChange={(event) => setLimitServices(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например, 50"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Лимит специалистов
          <input
            value={limitSpecialists}
            onChange={(event) => setLimitSpecialists(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например, 10"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Лимит сотрудников
          <input
            value={limitStaff}
            onChange={(event) => setLimitStaff(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например, 20"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Лимит клиентов
          <input
            value={limitClients}
            onChange={(event) => setLimitClients(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например, 2000"
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
