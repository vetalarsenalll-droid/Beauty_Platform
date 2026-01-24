"use client";

import { useState } from "react";

type SpecialistLevel = {
  id: number;
  name: string;
  rank: number;
  readOnly: boolean;
};

type SpecialistLevelRowProps = {
  level: SpecialistLevel;
};

export default function SpecialistLevelRow({ level }: SpecialistLevelRowProps) {
  const [name, setName] = useState(level.name);
  const [rank, setRank] = useState(String(level.rank));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (level.readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/specialist-levels/${level.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rank }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось обновить уровень.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось обновить уровень.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (level.readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/specialist-levels/${level.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось удалить уровень.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось удалить уровень.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={level.readOnly}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)] disabled:opacity-70"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Ранг
          <input
            value={rank}
            onChange={(event) => setRank(event.target.value)}
            disabled={level.readOnly}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)] disabled:opacity-70"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || level.readOnly}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold disabled:opacity-70"
        >
          {saving ? "..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={saving || level.readOnly}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-red-600 disabled:opacity-70"
        >
          Удалить
        </button>
        {level.readOnly ? (
          <span className="text-xs text-[color:var(--bp-muted)]">
            Базовый уровень
          </span>
        ) : null}
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
