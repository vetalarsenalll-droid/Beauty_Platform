import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { resolveSiteLoaderConfig } from "@/lib/site-builder";

import { loadPublicData } from "../_shared/public-data";
import { renderPublicPageShell } from "../_shared/public-page-shell";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
};

export default async function PublicBookingPage({ params }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";

  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();

  const clientSession = await getClientSession();
  const accountLinkOverride = clientSession
    ? `/c?account=${data.account.slug}`
    : `/c/login?account=${data.account.slug}`;

  const loaderConfig = resolveSiteLoaderConfig(data.draft);

  return renderPublicPageShell({
    data,
    pageKey: "booking",
    publicSlug,
    accountLinkOverride,
    loaderConfig,
    layout: {
      rootTag: "div",
      rootClassName: "flex min-h-screen w-full flex-col pt-0 pb-12",
    },
  });
}
