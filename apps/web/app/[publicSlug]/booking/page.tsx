import { getClientSession } from "@/lib/auth";
import { PLAN_MODULES } from "@/lib/platform-plan-features";
import { resolveSiteLoaderConfig } from "@/lib/site-builder";

import { loadPublicData } from "../_shared/public-data";
import { PublicModuleUnavailable } from "../_shared/module-unavailable";
import { renderPublicPageShell } from "../_shared/public-page-shell";
import { generatePublicPageMetadata } from "../_shared/seo-metadata";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const resolvedParams = await params;
  return generatePublicPageMetadata(resolvedParams.publicSlug ?? "", "booking");
}

export default async function PublicBookingPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";

  const data = await loadPublicData(publicSlug, PLAN_MODULES.onlineBooking);
  if (!data) {
    return (
      <PublicModuleUnavailable
        title="Онлайн-запись сейчас недоступна"
        message="В тарифном плане этого аккаунта не подключен модуль «Онлайн-запись» или подписка не активна."
      />
    );
  }

  const clientSession = await getClientSession();
  const accountLinkOverride = clientSession
    ? `/c?account=${data.account.slug}`
    : `/c/login?account=${data.account.slug}`;

  const loaderConfig = resolveSiteLoaderConfig(data.draft);

  return renderPublicPageShell({
    data,
    pageKey: "booking",
    publicSlug,
    searchParams,
    accountLinkOverride,
    loaderConfig,
    layout: {
      rootTag: "div",
      rootClassName: "flex min-h-screen w-full flex-col pt-0 pb-0",
    },
  });
}
