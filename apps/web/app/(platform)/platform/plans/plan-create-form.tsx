"use client";

import { useState } from "react";

type PlanCreateFormProps = {
  onCreated?: () => void;
};

const limitFields = [
  { key: "limit.locations", label: "Лимит локаций", placeholder: "Например, 1" },
  { key: "limit.services", label: "Лимит услуг", placeholder: "Например, 30" },
  { key: "limit.specialists", label: "Лимит специалистов", placeholder: "Например, 5" },
  { key: "limit.staff", label: "Лимит сотрудников", placeholder: "Например, 10" },
  { key: "limit.clients", label: "Лимит клиентов", placeholder: "Например, 1000" },
] as const;

const moduleFields = [
  { key: "module.online_booking", label: "Онлайн-запись" },
  { key: "module.site_builder", label: "Конструктор сайта" },
  { key: "module.ai_assistant", label: "AI-ассистент" },
  { key: "module.crm_agent", label: "CRM-агент" },
] as const;

export default function PlanCreateForm({ onCreated }: PlanCreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("");
  const [billingPeriodMonths, setBillingPeriodMonths] = useState("1");
  const [gracePeriodDays, setGracePeriodDays] = useState("5");
  const [currency, setCurrency] = useState("RUB");
  const [isTrial, setIsTrial] = useState(false);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<Record<string, boolean>>({
    "module.online_booking": true,
    "module.site_builder": false,
    "module.ai_assistant": false,
    "module.crm_agent": false,
  });
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
          description: description.trim() ? description.trim() : null,
          priceMonthly,
          billingPeriodMonths: Number(billingPeriodMonths),
          gracePeriodDays: Number(gracePeriodDays),
          currency,
          isTrial,
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
          ...limitFields
            .map((field) => ({ key: field.key, value: limits[field.key] ?? "" }))
            .filter((item) => item.value.trim().length > 0),
          ...moduleFields.map((field) => ({
            key: field.key,
            value: modules[field.key] ? "true" : "false",
          })),
        ];

        for (const item of features) {
          await fetch(`/api/v1/platform/plans/${planId}/features`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: item.key, value: item.value }),
          });
        }
      }

      setName("");
      setDescription("");
      setPriceMonthly("");
      setBillingPeriodMonths("1");
      setGracePeriodDays("5");
      setIsTrial(false);
      setLimits({});
      setModules({
        "module.online_booking": true,
        "module.site_builder": false,
        "module.ai_assistant": false,
        "module.crm_agent": false,
      });
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
          Валюта
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          Цена тарифа
          <input
            value={priceMonthly}
            onChange={(event) => setPriceMonthly(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Срок подписки, мес.
          <input
            type="number"
            min="1"
            value={billingPeriodMonths}
            onChange={(event) => setBillingPeriodMonths(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Льготный период, дней
          <input
            type="number"
            min="0"
            value={gracePeriodDays}
            onChange={(event) => setGracePeriodDays(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
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

      <label className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={isTrial}
          onChange={(event) => setIsTrial(event.target.checked)}
        />
        Пробный тариф. Используется для trial и не продаётся на витрине CRM.
      </label>

      <div>
        <h3 className="text-sm font-semibold">Лимиты</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {limitFields.map((field) => (
            <label key={field.key} className="flex flex-col gap-2 text-sm">
              {field.label}
              <input
                value={limits[field.key] ?? ""}
                onChange={(event) =>
                  setLimits((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
                placeholder={field.placeholder}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Модули тарифа</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {moduleFields.map((field) => (
            <label
              key={field.key}
              className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3 text-sm"
            >
              <input
                type="checkbox"
                checked={Boolean(modules[field.key])}
                onChange={(event) =>
                  setModules((prev) => ({ ...prev, [field.key]: event.target.checked }))
                }
              />
              {field.label}
            </label>
          ))}
        </div>
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
