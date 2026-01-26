"use client";

import { useState } from "react";

type LevelItem = {
  id: number;
  name: string;
  rank: number;
  readOnly: boolean;
};

type SpecialistLevelRowProps = {
  level: LevelItem;
};

export default function SpecialistLevelRow({
  level,
}: SpecialistLevelRowProps) {
  const [name, setName] = useState(level.name);
  const [rank, setRank] = useState(String(level.rank));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/crm/specialist-levels/${level.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, rank: Number(rank) }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось обновить уровень.");
        return;
      }
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
      const response = await fetch(
        `/api/v1/crm/specialist-levels/${level.id}`,
        {
          method: "DELETE",
        }
      );
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
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={level.readOnly}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
        />
        <input
          value={rank}
          onChange={(event) => setRank(event.target.value)}
          disabled={level.readOnly}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || level.readOnly}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            {saving ? "..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={saving || level.readOnly}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-red-600"
          >
            Удалить
          </button>
        </div>
      </div>
      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}