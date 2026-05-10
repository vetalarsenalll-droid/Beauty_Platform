"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SiteDraft, SitePageKey } from "@/lib/site-builder";

type ProjectPublishButtonProps = {
  draftJson: SiteDraft;
  pageKey: SitePageKey;
};

export function ProjectPublishButton({ draftJson, pageKey }: ProjectPublishButtonProps) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  const publishPage = async () => {
    setPublishing(true);
    try {
      const response = await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftJson,
          publish: true,
          publishPage: pageKey,
          publishEntity: null,
        }),
      });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={publishPage}
      disabled={publishing}
      className="rounded-full bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {publishing ? "Публикуем..." : "Опубликовать"}
    </button>
  );
}
