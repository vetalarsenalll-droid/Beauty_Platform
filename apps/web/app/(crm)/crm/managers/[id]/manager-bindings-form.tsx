"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LocationOption = {
  id: number;
  label: string;
  meta?: string | null;
};

type ManagerBindingsFormProps = {
  managerId: number;
  locations: LocationOption[];
  selectedLocationIds: number[];
};

export default function ManagerBindingsForm({
  managerId,
  locations,
  selectedLocationIds,
}: ManagerBindingsFormProps) {
  const router = useRouter();
  const [locationIds, setLocationIds] = useState<number[]>(selectedLocationIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (value: number) => {
    setLocationIds((current) =>
      current.includes(value)
        ? current.filter((id) => id !== value)
        : [...current, value]
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch(`/api/v1/crm/managers/${managerId}/bindings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationIds }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось сохранить привязки.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось сохранить привязки.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold">Локации</div>
        {locations.length === 0 ? (
          <div className="text-sm text-[color:var(--bp-muted)]">
            Нет доступных локаций.
          </div>
        ) : (
          locations.map((location) => (
            <label
              key={location.id}
              className="flex items-start gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={locationIds.includes(location.id)}
                onChange={() => toggle(location.id)}
              />
              <span className="flex flex-col">
                <span>{location.label}</span>
                {location.meta ? (
                  <span className="text-xs text-[color:var(--bp-muted)]">
                    {location.meta}
                  </span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Сохранение..." : "Сохранить привязки"}
      </button>
    </form>
  );
}