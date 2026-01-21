"use client";

import { useState } from "react";

type PlanOption = {
  id: number;
  name: string;
};

type AccountCreateFormProps = {
  plans: PlanOption[];
};

export default function AccountCreateForm({ plans }: AccountCreateFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timeZone, setTimeZone] = useState("Europe/Moscow");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v1/platform/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          timeZone,
          planId: planId ? Number(planId) : null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось создать аккаунт");
        return;
      }

      window.location.reload();
    } catch {
      setError("Не удалось создать аккаунт");
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
          Публичная ссылка
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Часовой пояс
          <select
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="Europe/Kaliningrad">
              Калининград (UTC+2, Europe/Kaliningrad)
            </option>
            <option value="Europe/Moscow">
              Москва (UTC+3, Europe/Moscow)
            </option>
            <option value="Europe/Samara">Самара (UTC+4, Europe/Samara)</option>
            <option value="Asia/Yekaterinburg">
              Екатеринбург (UTC+5, Asia/Yekaterinburg)
            </option>
            <option value="Asia/Omsk">Омск (UTC+6, Asia/Omsk)</option>
            <option value="Asia/Krasnoyarsk">
              Красноярск (UTC+7, Asia/Krasnoyarsk)
            </option>
            <option value="Asia/Irkutsk">Иркутск (UTC+8, Asia/Irkutsk)</option>
            <option value="Asia/Yakutsk">Якутск (UTC+9, Asia/Yakutsk)</option>
            <option value="Asia/Vladivostok">
              Владивосток (UTC+10, Asia/Vladivostok)
            </option>
            <option value="Asia/Magadan">Магадан (UTC+11, Asia/Magadan)</option>
            <option value="Asia/Kamchatka">
              Камчатка (UTC+12, Asia/Kamchatka)
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Тариф
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="">Без тарифа</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {loading ? "Создание..." : "Создать аккаунт"}
      </button>
    </form>
  );
}
