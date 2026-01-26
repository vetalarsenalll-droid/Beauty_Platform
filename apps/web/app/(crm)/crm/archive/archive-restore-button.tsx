"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ArchiveRestoreButtonProps = {
  entity: "location" | "service" | "specialist" | "promo";
  id: number;
};

export default function ArchiveRestoreButton({
  entity,
  id,
}: ArchiveRestoreButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const restore = async () => {
    const confirmed = window.confirm("Восстановить из архива?");
    if (!confirmed) return;

    setSaving(true);
    try {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      switch (entity) {
        case "location":
          endpoint = `/api/v1/crm/locations/${id}`;
          payload = { status: "ACTIVE" };
          break;
        case "service":
          endpoint = `/api/v1/crm/services/${id}`;
          payload = { isActive: true };
          break;
        case "specialist":
          endpoint = `/api/v1/crm/specialists/${id}`;
          payload = { status: "ACTIVE" };
          break;
        case "promo":
          endpoint = `/api/v1/crm/promos/${id}`;
          payload = { isActive: true };
          break;
        default:
          return;
      }

      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } finally {
      setSaving(false);
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={restore}
      disabled={saving}
      className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold"
    >
      {saving ? "..." : "Восстановить"}
    </button>
  );
}
