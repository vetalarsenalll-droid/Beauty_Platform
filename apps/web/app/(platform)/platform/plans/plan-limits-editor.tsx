"use client";

import { useMemo, useState } from "react";

type FeatureItem = {
  id: number;
  key: string;
  value: string | null;
};

type PlanLimitsEditorProps = {
  planId: number;
  initialFeatures: FeatureItem[];
};

const featureLabels: Record<string, string> = {
  "limit.locations": "Локации",
  "limit.services": "Услуги",
  "limit.specialists": "Специалисты",
  "limit.staff": "Сотрудники",
  "limit.clients": "Клиенты",
  "module.online_booking": "Онлайн-запись",
  "module.site_builder": "Конструктор сайта",
  "module.ai_assistant": "AI-ассистент",
  "module.crm_agent": "CRM-агент",
};

const limitOptions = [
  "limit.locations",
  "limit.services",
  "limit.specialists",
  "limit.staff",
  "limit.clients",
].map((key) => ({ key, label: featureLabels[key] }));

const moduleOptions = [
  "module.online_booking",
  "module.site_builder",
  "module.ai_assistant",
  "module.crm_agent",
].map((key) => ({ key, label: featureLabels[key] }));

export default function PlanLimitsEditor({
  planId,
  initialFeatures,
}: PlanLimitsEditorProps) {
  const [features, setFeatures] = useState<FeatureItem[]>(initialFeatures);
  const [key, setKey] = useState(limitOptions[0]?.key ?? "");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const featureMap = useMemo(
    () => new Map(features.map((feature) => [feature.key, feature])),
    [features],
  );

  const saveFeature = async (featureKey: string, featureValue: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/platform/plans/${planId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: featureKey, value: featureValue }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось сохранить параметр тарифа.");
        return;
      }

      const payload = await response.json();
      const saved = payload.data as FeatureItem;
      setFeatures((prev) => {
        const next = prev.filter((item) => item.key !== saved.key);
        return [...next, saved].sort((a, b) => a.key.localeCompare(b.key));
      });
    } catch {
      setError("Не удалось сохранить параметр тарифа.");
    } finally {
      setSaving(false);
    }
  };

  const saveLimit = async () => {
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

    await saveFeature(key.trim(), String(parsed));
    setValue("");
  };

  const removeFeature = async (featureKey: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/platform/plans/${planId}/features`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: featureKey }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось удалить параметр.");
        return;
      }
      setFeatures((prev) => prev.filter((item) => item.key !== featureKey));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold">Лимиты</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
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

      <div>
        <h3 className="text-sm font-semibold">Модули тарифа</h3>
        <p className="mt-1 text-xs text-[color:var(--bp-muted)]">
          Эти флаги уже используются в CRM-меню и готовы для проверки доступа в API.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {moduleOptions.map((module) => {
            const enabled = featureMap.get(module.key)?.value === "true";
            return (
              <label
                key={module.key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3 text-sm"
              >
                <span>{module.label}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) =>
                    saveFeature(module.key, event.target.checked ? "true" : "false")
                  }
                  disabled={saving}
                />
              </label>
            );
          })}
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {features.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-sm text-[color:var(--bp-muted)]">
          Параметры тарифа пока не заданы.
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2"
            >
              <div className="font-medium">
                {featureLabels[feature.key] ?? feature.key}
              </div>
              <div className="text-[color:var(--bp-muted)]">
                {feature.value === "true"
                  ? "включено"
                  : feature.value === "false"
                    ? "выключено"
                    : feature.value ?? "—"}
              </div>
              <button
                type="button"
                onClick={() => removeFeature(feature.key)}
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
