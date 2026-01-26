"use client";

import { useState } from "react";

type CategoryOption = {
  id: number;
  name: string;
};

type ServiceCreateFormProps = {
  categories: CategoryOption[];
};

export default function ServiceCreateForm({ categories }: ServiceCreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseDurationMin, setBaseDurationMin] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/v1/crm/services", {
        method: "POST",
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
        setError(body?.error?.message ?? "Не удалось создать услугу.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось создать услугу.");
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
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Категория
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
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
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          Длительность, мин
          <input
            value={baseDurationMin}
            onChange={(event) => setBaseDurationMin(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например, 60"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Базовая цена
          <input
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например, 2500"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Активна
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Создание..." : "Создать услугу"}
      </button>
    </form>
  );
}
