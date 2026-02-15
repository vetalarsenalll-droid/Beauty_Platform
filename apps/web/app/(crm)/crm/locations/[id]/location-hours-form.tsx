"use client";

import { useMemo, useState } from "react";
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

type ExceptionItem = {
  id: number;
  date: string;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
};

type ExceptionState = {
  id?: number;
  date: string;
  isClosed: boolean;
  startTime: string;
  endTime: string;
};

type LocationHoursFormProps = {
  locationId: number;
  hours: Hour[];
  exceptions: ExceptionItem[];
};

export default function LocationHoursForm({
  locationId,
  hours,
  exceptions,
}: LocationHoursFormProps) {
  const router = useRouter();

  const initialDays = useMemo(
    () =>
      DAY_LABELS.map((label, dayOfWeek) => {
        const existing = hours.find((hour) => hour.dayOfWeek === dayOfWeek);
        return {
          dayOfWeek,
          label,
          enabled: Boolean(existing),
          startTime: existing?.startTime ?? "09:00",
          endTime: existing?.endTime ?? "18:00",
        };
      }),
    [hours]
  );

  const initialExceptions = useMemo<ExceptionState[]>(
    () =>
      [...exceptions]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => ({
          id: item.id,
          date: item.date,
          isClosed: item.isClosed,
          startTime: item.startTime ?? "09:00",
          endTime: item.endTime ?? "18:00",
        })),
    [exceptions]
  );

  const [days, setDays] = useState<DayState[]>(initialDays);
  const [exceptionRows, setExceptionRows] = useState<ExceptionState[]>(initialExceptions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDay = (index: number, update: Partial<DayState>) => {
    setDays((prev) =>
      prev.map((item, current) =>
        current === index ? { ...item, ...update } : item
      )
    );
  };

  const updateException = (index: number, update: Partial<ExceptionState>) => {
    setExceptionRows((prev) =>
      prev.map((item, current) =>
        current === index ? { ...item, ...update } : item
      )
    );
  };

  const addException = () => {
    setExceptionRows((prev) => [
      ...prev,
      {
        date: "",
        isClosed: true,
        startTime: "09:00",
        endTime: "18:00",
      },
    ]);
  };

  const removeException = (index: number) => {
    setExceptionRows((prev) => prev.filter((_, current) => current !== index));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const exceptionDates = exceptionRows
      .map((row) => row.date.trim())
      .filter(Boolean);
    const duplicates = exceptionDates.filter(
      (date, index) => exceptionDates.indexOf(date) !== index
    );

    if (duplicates.length > 0) {
      setError("В исключениях не должно быть повторяющихся дат.");
      setSaving(false);
      return;
    }

    const payload = {
      hours: days
        .filter((day) => day.enabled)
        .map((day) => ({
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
        })),
      exceptions: exceptionRows
        .filter((row) => row.date.trim().length > 0)
        .map((row) => ({
          date: row.date,
          isClosed: row.isClosed,
          startTime: row.isClosed ? null : row.startTime,
          endTime: row.isClosed ? null : row.endTime,
        })),
    };

    try {
      const response = await fetch(`/api/v1/crm/locations/${locationId}/hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
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
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="space-y-3">
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
              onChange={(event) => updateDay(index, { startTime: event.target.value })}
              disabled={!day.enabled}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
            <input
              type="time"
              value={day.endTime}
              onChange={(event) => updateDay(index, { endTime: event.target.value })}
              disabled={!day.enabled}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Исключения и праздники</div>
          <button
            type="button"
            onClick={addException}
            className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-3 py-2 text-xs font-semibold"
          >
            Добавить дату
          </button>
        </div>

        {exceptionRows.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/40 px-4 py-3 text-sm text-[color:var(--bp-muted)]">
            Исключений нет.
          </div>
        ) : null}

        {exceptionRows.map((row, index) => (
          <div
            key={`${row.id ?? "new"}-${index}`}
            className="grid items-center gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-3 py-3 md:grid-cols-[1fr_auto_auto_auto]"
          >
            <div className="grid gap-3 sm:grid-cols-[180px_1fr_1fr]">
              <input
                type="date"
                value={row.date}
                onChange={(event) => updateException(index, { date: event.target.value })}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
              <input
                type="time"
                value={row.startTime}
                onChange={(event) =>
                  updateException(index, { startTime: event.target.value })
                }
                disabled={row.isClosed}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
              <input
                type="time"
                value={row.endTime}
                onChange={(event) =>
                  updateException(index, { endTime: event.target.value })
                }
                disabled={row.isClosed}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[color:var(--bp-muted)]">
              <input
                type="checkbox"
                checked={row.isClosed}
                onChange={(event) =>
                  updateException(index, { isClosed: event.target.checked })
                }
              />
              Выходной
            </label>

            <div className="text-xs text-[color:var(--bp-muted)]">
              {row.isClosed ? "Закрыто весь день" : "Особые часы"}
            </div>

            <button
              type="button"
              onClick={() => removeException(index)}
              className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
        >
          {saving ? "Сохраняем..." : "Сохранить режим работы"}
        </button>
      </div>
    </form>
  );
}
