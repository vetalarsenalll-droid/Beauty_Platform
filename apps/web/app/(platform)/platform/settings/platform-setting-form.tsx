"use client";

import { useState } from "react";

type SettingFormProps = {
  initialKey?: string;
  initialValue?: unknown;
  label?: string;
};

export default function PlatformSettingForm({
  initialKey = "",
  initialValue = {},
  label = "",
}: SettingFormProps) {
  const [key, setKey] = useState(initialKey);
  const [value, setValue] = useState(
    JSON.stringify(initialValue ?? {}, null, 2)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    let parsed: unknown = null;
    try {
      parsed = value ? JSON.parse(value) : null;
    } catch {
      setError("Некорректный JSON");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/v1/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ key, valueJson: parsed }],
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось сохранить настройку");
        return;
      }

      if (!label) {
        setKey("");
        setValue("{}");
      }
    } catch {
      setError("Не удалось сохранить настройку");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="text-sm font-semibold">{label || "Настройка"}</div>
      <input
        value={key}
        onChange={(event) => setKey(event.target.value)}
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        placeholder="settings.key"
        required
      />
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={6}
        className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm font-mono"
      />
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold"
      >
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </form>
  );
}
