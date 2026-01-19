"use client";

import { useState } from "react";

type TemplateRowProps = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  contentJson: unknown;
  isActive: boolean;
};

export default function TemplateRow({
  id,
  name,
  type,
  description,
  contentJson,
  isActive,
}: TemplateRowProps) {
  const [currentName, setCurrentName] = useState(name);
  const [currentDescription, setCurrentDescription] = useState(description ?? "");
  const [currentContent, setCurrentContent] = useState(
    JSON.stringify(contentJson ?? {}, null, 2)
  );
  const [active, setActive] = useState(isActive);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    let parsed: unknown = null;
    try {
      parsed = currentContent ? JSON.parse(currentContent) : null;
    } catch {
      setSaving(false);
      return;
    }

    try {
      await fetch(`/api/v1/platform/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentName,
          description: currentDescription,
          contentJson: parsed,
          isActive: active,
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
        {type}
      </div>
      <div className="mt-2 grid gap-2">
        <input
          value={currentName}
          onChange={(event) => setCurrentName(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        />
        <input
          value={currentDescription}
          onChange={(event) => setCurrentDescription(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={currentContent}
          onChange={(event) => setCurrentContent(event.target.value)}
          rows={6}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm font-mono"
        />
        <label className="flex items-center gap-2 text-xs text-[color:var(--bp-muted)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Активен
        </label>
        <button
          type="button"
          onClick={save}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold"
          disabled={saving}
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
