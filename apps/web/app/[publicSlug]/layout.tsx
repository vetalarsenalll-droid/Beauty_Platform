import type { ReactNode } from "react";
import { resolveAishaWidgetConfig, resolveSiteLoaderConfig } from "@/lib/site-builder";
import PublicSiteOverlayLoader from "@/components/public-site-overlay-loader";
import PublicAiChatWidget from "@/components/public-ai-chat-widget";
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
  const aishaConfig = data ? resolveAishaWidgetConfig(data.draft) : null;

  return (
    <PublicSiteOverlayLoader loaderConfig={loaderConfig}>
      {children}
      {data?.account?.slug && aishaConfig?.enabled !== false ? (
        <PublicAiChatWidget accountSlug={data.account.slug} widgetConfig={aishaConfig} />
      ) : null}
    </PublicSiteOverlayLoader>
  );
}
