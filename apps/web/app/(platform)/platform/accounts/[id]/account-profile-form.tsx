"use client";

import { useState } from "react";

type PlanOption = { id: number; name: string };

type AccountProfileFormProps = {
  account: {
    id: number;
    name: string;
    slug: string;
    timeZone: string;
    status: string;
    planId: number | null;
  };
  plans: PlanOption[];
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  SUSPENDED: "Приостановлен",
  ARCHIVED: "Архив",
};

export default function AccountProfileForm({
  account,
  plans,
}: AccountProfileFormProps) {
  const [name, setName] = useState(account.name);
  const [slug, setSlug] = useState(account.slug);
  const [timeZone, setTimeZone] = useState(account.timeZone);
  const [status, setStatus] = useState(account.status);
  const [planId, setPlanId] = useState(
    account.planId !== null ? String(account.planId) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch(`/api/v1/platform/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          timeZone,
          status,
          planId: planId ? Number(planId) : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось сохранить изменения");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Публичная ссылка
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
          <span className="text-xs text-[color:var(--bp-muted)]">
            Итоговый адрес: /{slug || "..."}_{account.id}
          </span>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          Часовой пояс
          <input
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Статус
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            {Object.keys(statusLabels).map((item) => (
              <option key={item} value={item}>
                {statusLabels[item] ?? item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Тариф
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
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
        disabled={saving}
        className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold"
      >
        {saving ? "Сохранение..." : "Сохранить профиль"}
      </button>
    </form>
  );
}
