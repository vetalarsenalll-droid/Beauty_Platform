"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type Hour = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type DayState = {
  dayOfWeek: number;
  label: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

type LocationHoursFormProps = {
  locationId: number;
  hours: Hour[];
};

export default function LocationHoursForm({
  locationId,
  hours,
}: LocationHoursFormProps) {
  const router = useRouter();
  const initialDays = DAY_LABELS.map((label, dayOfWeek) => {
    const existing = hours.find((hour) => hour.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      label,
      enabled: Boolean(existing),
      startTime: existing?.startTime ?? "09:00",
      endTime: existing?.endTime ?? "18:00",
    };
  });

  const [days, setDays] = useState<DayState[]>(initialDays);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDay = (index: number, update: Partial<DayState>) => {
    setDays((prev) =>
      prev.map((item, current) =>
        current === index ? { ...item, ...update } : item
      )
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      hours: days
        .filter((day) => day.enabled)
        .map((day) => ({
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
        })),
    };

    try {
      const response = await fetch(
        `/api/v1/crm/locations/${locationId}/hours`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось сохранить режим работы.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось сохранить режим работы.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {days.map((day, index) => (
        <div
          key={day.dayOfWeek}
          className="grid items-center gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-3 py-3 md:grid-cols-[80px_140px_1fr_1fr]"
        >
          <div className="text-sm font-semibold">{day.label}</div>
          <label className="flex items-center gap-2 text-xs text-[color:var(--bp-muted)]">
            <input
              type="checkbox"
              checked={day.enabled}
              onChange={(event) =>
                updateDay(index, { enabled: event.target.checked })
              }
            />
            Рабочий день
          </label>
          <input
            type="time"
            value={day.startTime}
            onChange={(event) =>
              updateDay(index, { startTime: event.target.value })
            }
            disabled={!day.enabled}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
          <input
            type="time"
            value={day.endTime}
            onChange={(event) =>
              updateDay(index, { endTime: event.target.value })
            }
            disabled={!day.enabled}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </div>
      ))}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Сохраняем..." : "Сохранить режим работы"}
      </button>
    </form>
  );
}
