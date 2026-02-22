import type { ReactNode } from "react";
import { resolveSiteLoaderConfig } from "@/lib/site-builder";
import PublicSiteOverlayLoader from "@/components/public-site-overlay-loader";
import { loadPublicData } from "./_shared/public-data";

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ publicSlug?: string }>;
};

export default async function PublicSlugLayout({ children, params }: LayoutProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";
  const data = await loadPublicData(publicSlug);
  const loaderConfig = data ? resolveSiteLoaderConfig(data.draft) : null;

  return <PublicSiteOverlayLoader loaderConfig={loaderConfig}>{children}</PublicSiteOverlayLoader>;
}

