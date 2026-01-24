"use client";

import { useState } from "react";

type CategoryItem = {
  id: number;
  name: string;
  slug: string;
};

type ServiceCategoryRowProps = {
  category: CategoryItem;
};

export default function ServiceCategoryRow({
  category,
}: ServiceCategoryRowProps) {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/crm/service-categories/${category.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, slug }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось обновить категорию.");
        return;
      }
    } catch {
      setError("Не удалось обновить категорию.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/crm/service-categories/${category.id}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось удалить категорию.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось удалить категорию.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
        />
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
        />
        <div className="flex items-center gap-2">
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
      </div>
      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
