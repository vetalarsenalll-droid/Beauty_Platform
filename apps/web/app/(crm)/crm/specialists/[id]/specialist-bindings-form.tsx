"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BindingOption = {
  id: number;
  label: string;
  meta?: string | null;
};

type SpecialistBindingsFormProps = {
  specialistId: number;
  services: BindingOption[];
  locations: BindingOption[];
  selectedServiceIds: number[];
  selectedLocationIds: number[];
};

export default function SpecialistBindingsForm({
  specialistId,
  services,
  locations,
  selectedServiceIds,
  selectedLocationIds,
}: SpecialistBindingsFormProps) {
  const router = useRouter();
  const [serviceIds, setServiceIds] = useState<number[]>(selectedServiceIds);
  const [locationIds, setLocationIds] = useState<number[]>(selectedLocationIds);
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
        `/api/v1/crm/specialists/${specialistId}/bindings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceIds, locationIds }),
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
          <div className="text-sm font-semibold">Услуги</div>
          {services.length === 0 ? (
            <div className="text-sm text-[color:var(--bp-muted)]">
              Нет доступных услуг.
            </div>
          ) : (
            services.map((service) => (
              <label
                key={service.id}
                className="flex items-start gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={serviceIds.includes(service.id)}
                  onChange={() => toggle(serviceIds, service.id, setServiceIds)}
                />
                <span className="flex flex-col">
                  <span>{service.label}</span>
                  {service.meta ? (
                    <span className="text-xs text-[color:var(--bp-muted)]">
                      {service.meta}
                    </span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>
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