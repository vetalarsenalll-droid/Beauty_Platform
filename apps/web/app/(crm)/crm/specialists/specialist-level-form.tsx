"use client";

import { useState } from "react";

export default function SpecialistLevelForm() {
  const [name, setName] = useState("");
  const [rank, setRank] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/v1/crm/specialist-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rank: rank.trim() ? Number(rank) : null }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось создать уровень.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось создать уровень.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Ранг
          <input
            value={rank}
            onChange={(event) => setRank(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            placeholder="Например, 10"
          />
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold"
      >
        {saving ? "Создание..." : "Создать уровень"}
      </button>
    </form>
  );
}