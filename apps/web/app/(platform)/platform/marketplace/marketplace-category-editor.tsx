"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_SETTING_KEY,
  CategoryConfig,
  DEFAULT_CATEGORIES,
  MarketplaceCategory,
} from "@/lib/marketplace-categories";

type MarketplaceCategoryEditorProps = {
  initialConfig: CategoryConfig;
};

export default function MarketplaceCategoryEditor({
  initialConfig,
}: MarketplaceCategoryEditorProps) {
  const [items, setItems] = useState<MarketplaceCategory[]>(() => {
    const byKey = new Map(initialConfig.items.map((item) => [item.key, item]));
    return DEFAULT_CATEGORIES.map((item) => ({
      ...item,
      imageUrl: byKey.get(item.key)?.imageUrl ?? null,
    }));
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const filledCount = useMemo(
    () => items.filter((item) => item.imageUrl).length,
    [items]
  );

  const updateItem = (key: string, patch: Partial<MarketplaceCategory>) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  };

  const uploadImage = async (key: string, file: File) => {
    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/platform/marketplace/category-media", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Не удалось загрузить файл");
      }
      updateItem(key, { imageUrl: payload.data?.url ?? "" });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Не удалось загрузить файл");
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              key: CATEGORY_SETTING_KEY,
              valueJson: { items },
            },
          ],
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(payload?.error?.message ?? "Не удалось сохранить категории");
        return;
      }
      setMessage("Категории сохранены");
    } catch {
      setMessage("Не удалось сохранить категории");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Фото категорий</h2>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Загрузите фотографии для карточек категорий на главной странице.
          </p>
          <p className="mt-2 text-xs text-[color:var(--bp-muted)]">
            Заполнено: {filledCount} из {items.length}.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Сохранение..." : "Сохранить категории"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 text-sm text-[color:var(--bp-muted)]">{message}</div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-4"
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-xs font-semibold text-[color:var(--bp-ink)]">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadImage(item.key, file);
                  }}
                />
                {uploading[item.key] ? "Загрузка..." : "Загрузить фото"}
              </label>
              {item.imageUrl ? (
                <button
                  type="button"
                  onClick={() => updateItem(item.key, { imageUrl: "" })}
                  className="text-xs text-[color:var(--bp-muted)] underline"
                >
                  Удалить
                </button>
              ) : null}
            </div>
            {item.imageUrl ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white">
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  className="h-32 w-full object-cover"
                />
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-white px-3 py-6 text-center text-xs text-[color:var(--bp-muted)]">
                Фото не выбрано
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
