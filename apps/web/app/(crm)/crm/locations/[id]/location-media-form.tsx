"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MediaItem = {
  id: number;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

type PendingItem = {
  id: string;
  file: File;
  previewUrl: string | null;
  isHeic: boolean;
  status: "pending" | "uploading" | "error";
  error?: string;
};

type LocationMediaFormProps = {
  locationId: number;
  title: string;
  type: "location" | "work";
  items: MediaItem[];
};

function isHeicFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

export default function LocationMediaForm({
  locationId,
  title,
  type,
  items,
}: LocationMediaFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderedItems, setOrderedItems] = useState<MediaItem[]>(items);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  useEffect(() => {
    return () => {
      pending.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [pending]);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const list = Array.from(files);
    const newItems: PendingItem[] = list.map((file) => {
      const heic = isHeicFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        previewUrl: heic ? null : URL.createObjectURL(file),
        isHeic: heic,
        status: "pending",
      };
    });

    setPending((prev) => [...prev, ...newItems]);
  };

  const uploadPending = async () => {
    if (pending.length === 0) return;
    setError(null);
    setSaving(true);

    const itemsToUpload = pending.filter(
      (item) => item.status === "pending" || item.status === "error"
    );

    for (const item of itemsToUpload) {
      setPending((prev) =>
        prev.map((entry) =>
          entry.id === item.id ? { ...entry, status: "uploading" } : entry
        )
      );
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("type", type);

        const response = await fetch(
          `/api/v1/crm/locations/${locationId}/media`,
          { method: "POST", body: formData }
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message =
            body?.error?.message ?? "Не удалось добавить фото.";
          setPending((prev) =>
            prev.map((entry) =>
              entry.id === item.id
                ? { ...entry, status: "error", error: message }
                : entry
            )
          );
          continue;
        }
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        setPending((prev) => prev.filter((entry) => entry.id !== item.id));
      } catch {
        setPending((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: "error",
                  error: "Не удалось добавить фото.",
                }
              : entry
          )
        );
      }
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
    router.refresh();
    setSaving(false);
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const removePhoto = async (id: number) => {
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/crm/locations/${locationId}/media/${id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось удалить фото.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось удалить фото.");
    } finally {
      setSaving(false);
    }
  };

  const updateMedia = async (id: number, payload: Record<string, unknown>) => {
    const response = await fetch(
      `/api/v1/crm/locations/${locationId}/media/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return response.ok;
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedItems.length) return;

    const updated = [...orderedItems];
    [updated[index], updated[target]] = [updated[target], updated[index]];

    const reordered = updated.map((item, idx) => ({
      ...item,
      sortOrder: idx,
    }));
    setOrderedItems(reordered);

    const a = reordered[index];
    const b = reordered[target];
    const okA = await updateMedia(a.id, { sortOrder: a.sortOrder });
    const okB = await updateMedia(b.id, { sortOrder: b.sortOrder });

    if (!okA || !okB) {
      setError("Не удалось сохранить порядок.");
      router.refresh();
    }
  };

  const setCover = async (id: number) => {
    const ok = await updateMedia(id, { isCover: true });
    if (!ok) {
      setError("Не удалось установить обложку.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={(event) => addFiles(event.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
        >
          Выбрать фото
        </button>
        <span className="text-xs text-[color:var(--bp-muted)]">
          {pending.length === 0
            ? "Фото не выбрано"
            : `Выбрано: ${pending.length}`}
        </span>
        <button
          type="button"
          onClick={uploadPending}
          disabled={saving || pending.length === 0}
          className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
        >
          Загрузить фото
        </button>
      </div>

      {pending.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)]"
            >
              <div className="relative aspect-[4/3] bg-[color:var(--bp-panel)]/60">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[color:var(--bp-muted)]">
                    {item.isHeic ? "HEIC (превью недоступно)" : "Фото"}
                  </div>
                )}
                {item.status !== "uploading" ? (
                  <button
                    type="button"
                    onClick={() => removePending(item.id)}
                    className="absolute right-2 top-2 rounded-full border border-[color:var(--bp-stroke)] bg-white/90 px-2 py-1 text-xs"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="border-t border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-[color:var(--bp-muted)]">
                {item.status === "uploading"
                  ? "Загрузка..."
                  : item.status === "error"
                    ? item.error ?? "Ошибка загрузки"
                    : "Ожидает загрузки"}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {orderedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-sm text-[color:var(--bp-muted)]">
          Пока нет фотографий.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedItems.map((item, index) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)]"
            >
              <div className="relative aspect-[4/3] bg-[color:var(--bp-panel)]/60">
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {item.isCover ? (
                  <span className="absolute left-2 top-2 rounded-full border border-[color:var(--bp-stroke)] bg-white/90 px-2 py-1 text-[10px] font-semibold">
                    Обложка
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[color:var(--bp-stroke)] px-3 py-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={saving || index === 0}
                    className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={saving || index === orderedItems.length - 1}
                    className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1"
                  >
                    ↓
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCover(item.id)}
                    disabled={saving || item.isCover}
                    className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1"
                  >
                    Обложка
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(item.id)}
                    className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1 text-red-600"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
