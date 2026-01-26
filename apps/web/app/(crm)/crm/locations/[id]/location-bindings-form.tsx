"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BindingOption = {
  id: number;
  label: string;
  meta?: string | null;
};

type LocationBindingsFormProps = {
  locationId: number;
  services: BindingOption[];
  specialists: BindingOption[];
  managers: BindingOption[];
  selectedServiceIds: number[];
  selectedSpecialistIds: number[];
  selectedManagerIds: number[];
};

export default function LocationBindingsForm({
  locationId,
  services,
  specialists,
  managers,
  selectedServiceIds,
  selectedSpecialistIds,
  selectedManagerIds,
}: LocationBindingsFormProps) {
  const router = useRouter();
  const [serviceIds, setServiceIds] = useState<number[]>(selectedServiceIds);
  const [specialistIds, setSpecialistIds] = useState<number[]>(
    selectedSpecialistIds
  );
  const [managerIds, setManagerIds] = useState<number[]>(selectedManagerIds);
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
        `/api/v1/crm/locations/${locationId}/bindings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceIds,
            specialistIds,
            managerUserIds: managerIds,
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
                  onChange={() =>
                    toggle(serviceIds, service.id, setServiceIds)
                  }
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
      <div className="flex flex-col gap-3">
        <div className="text-sm font-semibold">Менеджеры</div>
        {managers.length === 0 ? (
          <div className="text-sm text-[color:var(--bp-muted)]">
            Нет доступных менеджеров.
          </div>
        ) : (
          managers.map((manager) => (
            <label
              key={manager.id}
              className="flex items-start gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={managerIds.includes(manager.id)}
                onChange={() => toggle(managerIds, manager.id, setManagerIds)}
              />
              <span className="flex flex-col">
                <span>{manager.label}</span>
                {manager.meta ? (
                  <span className="text-xs text-[color:var(--bp-muted)]">
                    {manager.meta}
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
        {saving ? "Сохраняем..." : "Сохранить привязки"}
      </button>
    </form>
  );
}
