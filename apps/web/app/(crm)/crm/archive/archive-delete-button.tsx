"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ArchiveDeleteButtonProps = {
  entity: "location" | "service" | "specialist" | "promo";
  id: number;
};

export default function ArchiveDeleteButton({
  entity,
  id,
}: ArchiveDeleteButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const remove = async () => {
    const confirmed = window.confirm("Удалить навсегда?");
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch("/api/v1/crm/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        alert(body?.error?.message ?? "Не удалось удалить.");
      }
    } finally {
      setSaving(false);
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={saving}
      className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold text-red-600"
    >
      {saving ? "..." : "Удалить"}
    </button>
  );
}
