"use client";

import { useState } from "react";

type PublicPageApproveProps = {
  pageId: number | string;
};

export default function PublicPageApprove({ pageId }: PublicPageApproveProps) {
  const [saving, setSaving] = useState(false);

  const approve = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/platform/moderation/public-pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={approve}
      className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
      disabled={saving}
    >
      {saving ? "..." : "Опубликовать"}
    </button>
  );
}
