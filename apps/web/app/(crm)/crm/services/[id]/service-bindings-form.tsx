"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BindingOption = {
  id: number;
  label: string;
  meta?: string | null;
};

type ServiceBindingsFormProps = {
  serviceId: number;
  locations: BindingOption[];
  specialists: BindingOption[];
  selectedLocationIds: number[];
  selectedSpecialistIds: number[];
};

export default function ServiceBindingsForm({
  serviceId,
  locations,
  specialists,
  selectedLocationIds,
  selectedSpecialistIds,
}: ServiceBindingsFormProps) {
  const router = useRouter();
  const [locationIds, setLocationIds] = useState<number[]>(selectedLocationIds);
  const [specialistIds, setSpecialistIds] = useState<number[]>(
    selectedSpecialistIds
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (
    current: number[],
    value: number,
    setter: (ids: number[]) => void
  ) => {
    setter(
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
      const response = await fetch(
        `/api/v1/crm/services/${serviceId}/bindings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationIds,
            specialistIds,
          }),
        }
      );
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
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
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
                  onChange={() =>
                    toggle(locationIds, location.id, setLocationIds)
                  }
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
        <div className="flex flex-col gap-3">
          <div className="text-sm font-semibold">Специалисты</div>
          {specialists.length === 0 ? (
            <div className="text-sm text-[color:var(--bp-muted)]">
              Нет доступных специалистов.
            </div>
          ) : (
            specialists.map((specialist) => (
              <label
                key={specialist.id}
                className="flex items-start gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={specialistIds.includes(specialist.id)}
                  onChange={() =>
                    toggle(specialistIds, specialist.id, setSpecialistIds)
                  }
                />
                <span className="flex flex-col">
                  <span>{specialist.label}</span>
                  {specialist.meta ? (
                    <span className="text-xs text-[color:var(--bp-muted)]">
                      {specialist.meta}
                    </span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>
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