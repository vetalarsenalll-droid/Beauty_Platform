"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SiteDraft, SiteEntityPages, SitePageKey } from "@/lib/site-builder";

type ProjectPublishButtonProps = {
  draftJson: SiteDraft;
  pageKey: SitePageKey;
  publishEntity?: { type: keyof SiteEntityPages; id: string } | null;
};

export function ProjectPublishButton({
  draftJson,
  pageKey,
  publishEntity = null,
}: ProjectPublishButtonProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishPage = async () => {
    setPublishing(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftJson,
          publish: true,
          publishPage: pageKey,
          publishEntity,
        }),
      });

      if (response.ok) {
        router.refresh();
        return;
      }

      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message ?? "Не удалось опубликовать страницу.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={publishPage}
        disabled={publishing}
        className="rounded-full bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {publishing ? "Публикуем..." : "Опубликовать"}
      </button>
      {error ? <div className="max-w-md text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
