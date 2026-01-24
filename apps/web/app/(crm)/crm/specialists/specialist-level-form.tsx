"use client";

import { useState } from "react";

export default function SpecialistLevelForm() {
  const [name, setName] = useState("");
  const [rank, setRank] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = { name };
    if (rank.trim()) {
      payload.rank = Number(rank);
    }

    try {
      const response = await fetch("/api/v1/crm/specialist-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1.6fr_0.6fr]">
      <label className="flex flex-col gap-2 text-sm">
        Название уровня
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Ранг
        <input
          value={rank}
          onChange={(event) => setRank(event.target.value)}
          placeholder="1"
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
        />
      </label>
      {error ? <div className="md:col-span-2 text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="md:col-span-2 inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Сохраняем..." : "Создать уровень"}
      </button>
    </form>
  );
}
