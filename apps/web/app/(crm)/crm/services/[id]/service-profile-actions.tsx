"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ServiceProfileActionsProps = {
  serviceId: number;
};

export default function ServiceProfileActions({
  serviceId,
}: ServiceProfileActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const archive = async () => {
    const confirmArchive = window.confirm(
      "Переместить услугу в архив?"
    );
    if (!confirmArchive) return;

    setSaving(true);
    try {
      await fetch(`/api/v1/crm/services/${serviceId}`, {
        method: "DELETE",
      });
      router.push("/crm/archive");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={archive}
      disabled={saving}
      className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold text-[color:var(--bp-muted)]"
    >
      {saving ? "..." : "В архив"}
    </button>
  );
}