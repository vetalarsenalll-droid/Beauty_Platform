"use client";

import { useState } from "react";

type LimitItem = {
  id: number;
  key: string;
  valueInt: number | null;
  valueJson: unknown;
};

type AccountLimitsEditorProps = {
  accountId: number;
  initialLimits: LimitItem[];
};

const limitLabels: Record<string, string> = {
  "limit.locations": "Локации",
  "limit.services": "Услуги",
  "limit.specialists": "Специалисты",
  "limit.staff": "Сотрудники",
  "limit.clients": "Клиенты",
};

const limitOptions = Object.entries(limitLabels).map(([key, label]) => ({
  key,
  label,
}));

export default function AccountLimitsEditor({
  accountId,
  initialLimits,
}: AccountLimitsEditorProps) {
  const [limits, setLimits] = useState<LimitItem[]>(initialLimits);
  const [key, setKey] = useState(limitOptions[0]?.key ?? "");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setKey(limitOptions[0]?.key ?? "");
    setValue("");
  };

  const saveLimit = async () => {
    setError(null);
    if (!key.trim()) {
      setError("Выберите лимит.");
      return;
    }
    if (!value.trim()) {
      setError("Введите значение лимита.");
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setError("Введите числовое значение.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/platform/accounts/${accountId}/limits`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: key.trim(), valueInt: parsed }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось сохранить лимит.");
        return;
      }

      const payload = await response.json();
      const saved = payload.data as LimitItem;
      setLimits((prev) => {
        const next = prev.filter((item) => item.key !== saved.key);
        return [...next, saved].sort((a, b) => a.key.localeCompare(b.key));
      });
      resetForm();
    } catch {
      setError("Не удалось сохранить лимит.");
    } finally {
      setSaving(false);
    }
  };

  const removeLimit = async (limitKey: string) => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/platform/accounts/${accountId}/limits`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: limitKey }),
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось удалить лимит.");
        return;
      }
      setLimits((prev) => prev.filter((item) => item.key !== limitKey));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
        <select
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
        >
          {limitOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Например, 5"
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveLimit}
            disabled={saving}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            {saving ? "..." : "Сохранить"}
          </button>
        </div>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {limits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-sm text-[color:var(--bp-muted)]">
          Лимиты для аккаунта не заданы.
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          {limits.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2"
            >
              <div className="font-medium">
                {limitLabels[item.key] ?? item.key}
              </div>
              <div className="text-[color:var(--bp-muted)]">
                {item.valueInt !== null
                  ? item.valueInt
                  : JSON.stringify(item.valueJson)}
              </div>
              <button
                type="button"
                onClick={() => removeLimit(item.key)}
                className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-0.5 text-xs"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
