"use client";

import { useState } from "react";

type TemplateFormProps = {
  onCreated?: () => void;
};

export default function TemplateCreateForm({ onCreated }: TemplateFormProps) {
  const [type, setType] = useState("NOTIFICATION");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contentJson, setContentJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    let parsed: unknown = null;
    try {
      parsed = contentJson ? JSON.parse(contentJson) : null;
    } catch {
      setError("Некорректный JSON");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/v1/platform/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          description,
          contentJson: parsed,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Не удалось создать шаблон");
        return;
      }

      setName("");
      setDescription("");
      setContentJson("{}");
      if (onCreated) onCreated();
      else window.location.reload();
    } catch {
      setError("Не удалось создать шаблон");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Тип
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
          >
            <option value="NOTIFICATION">NOTIFICATION</option>
            <option value="SEO_PRESET">SEO_PRESET</option>
            <option value="CONSTRUCTOR_PRESET">CONSTRUCTOR_PRESET</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
            required
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm">
        Описание
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        contentJson
        <textarea
          value={contentJson}
          onChange={(event) => setContentJson(event.target.value)}
          rows={6}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm font-mono"
        />
      </label>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold"
      >
        {saving ? "Сохранение..." : "Создать шаблон"}
      </button>
    </form>
  );
}
