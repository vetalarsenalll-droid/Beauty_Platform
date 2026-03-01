import type { ReactNode } from "react";
import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
  const storedMode = cookieStore.get?.("site-theme-mode")?.value;
  const modeOverride = storedMode === "dark" || storedMode === "light" ? storedMode : undefined;
  const aishaConfig = data ? resolveAishaWidgetConfig(data.draft, modeOverride) : null;

  return (
    <PublicSiteOverlayLoader loaderConfig={loaderConfig}>
      {children}
      {data?.account?.slug && aishaConfig?.enabled !== false ? (
        <PublicAiChatWidget accountSlug={data.account.slug} widgetConfig={aishaConfig} />
      ) : null}
    </PublicSiteOverlayLoader>
  );
}
