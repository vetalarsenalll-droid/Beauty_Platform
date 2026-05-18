import { notFound } from "next/navigation";
import { resolveSiteLoaderConfig } from "@/lib/site-builder";

import { loadPublicData } from "../../_shared/public-data";
import { renderPublicPageShell } from "../../_shared/public-page-shell";
import { generatePublicPageMetadata } from "../../_shared/seo-metadata";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const resolvedParams = await params;
  return generatePublicPageMetadata(resolvedParams.publicSlug ?? "", "clientLogin");
}

export default async function PublicClientLoginPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";
  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();

  return renderPublicPageShell({
    data,
    pageKey: "clientLogin",
    publicSlug,
    searchParams,
    accountLinkOverride: `/c/login?account=${data.account.slug}`,
    loaderConfig: resolveSiteLoaderConfig(data.draft),
    layout: {
      rootTag: "div",
      rootClassName: "flex min-h-screen w-full flex-col pt-0 pb-0",
    },
  });
}
