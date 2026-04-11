import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";

import { loadPublicData } from "../_shared/public-data";
import { renderPublicPageShell } from "../_shared/public-page-shell";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
};

export default async function PublicPromosPage({ params }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";

  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();

  const clientSession = await getClientSession();
  const accountLinkOverride = clientSession
    ? `/c?account=${data.account.slug}`
    : `/c/login?account=${data.account.slug}`;

  return renderPublicPageShell({
    data,
    pageKey: "promos",
    publicSlug,
    accountLinkOverride,
    layout: {
      rootTag: "main",
      rootClassName: "min-h-screen pb-0",
      useInnerColumn: true,
      innerClassName: "flex w-full flex-col pt-0 pb-0",
    },
  });
}
