import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";

import { loadPublicData } from "./_shared/public-data";
import { renderPublicPageShell } from "./_shared/public-page-shell";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
};

export default async function PublicAccountPage({ params }: PageProps) {
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
    pageKey: "home",
    publicSlug,
    accountLinkOverride,
    includeCoverBackground: true,
  });
}
