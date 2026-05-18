import { notFound } from "next/navigation";
import { resolveSiteLoaderConfig } from "@/lib/site-builder";

import { loadPublicData } from "../_shared/public-data";
import { renderPublicPageShell } from "../_shared/public-page-shell";
import { generatePublicPageMetadata } from "../_shared/seo-metadata";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const resolvedParams = await params;
  return generatePublicPageMetadata(resolvedParams.publicSlug ?? "", "legal");
}

export default async function PublicLegalIndexPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";

  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();

  return renderPublicPageShell({
    data,
    pageKey: "legal",
    publicSlug,
    searchParams,
    loaderConfig: resolveSiteLoaderConfig(data.draft),
  });
}
