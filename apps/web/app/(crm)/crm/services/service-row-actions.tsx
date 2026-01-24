"use client";

import { useState } from "react";

type CategoryOption = {
  id: number;
  name: string;
};

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: string;
  isActive: boolean;
  categoryId: number | null;
};

type ServiceRowActionsProps = {
  service: ServiceItem;
  categories: CategoryOption[];
};

export default function ServiceRowActions({
  service,
  categories,
}: ServiceRowActionsProps) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [baseDurationMin, setBaseDurationMin] = useState(
    String(service.baseDurationMin)
  );
  const [basePrice, setBasePrice] = useState(service.basePrice);
  const [categoryId, setCategoryId] = useState(
    service.categoryId !== null ? String(service.categoryId) : ""
  );
  const [isActive, setIsActive] = useState(service.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() ? description.trim() : null,
          baseDurationMin,
          basePrice,
          categoryId: categoryId ? Number(categoryId) : null,
          isActive,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось обновить услугу.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось обновить услугу.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/services/${service.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось удалить услугу.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось удалить услугу.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Категория
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Активна
          <select
            value={isActive ? "true" : "false"}
            onChange={(event) => setIsActive(event.target.value === "true")}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Описание
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Длительность, мин
          <input
            value={baseDurationMin}
            onChange={(event) => setBaseDurationMin(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Цена
          <input
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
        >
          {saving ? "..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={saving}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-red-600"
        >
          Удалить
        </button>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
