import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SEO_PAGE_KEYS } from "@/lib/seo-pages";
import { mergeVerificationHtmlFiles } from "@/lib/seo-verification";
import SeoClient from "./seo-client";

export default async function CrmSiteSeoPage() {
  const session = await requireCrmPermission("crm.settings.read");

  const seo = await prisma.seoSetting.findUnique({
    where: { accountId: session.accountId },
  });
  const pageSettings = await prisma.seoPageSetting.findMany({
    where: { accountId: session.accountId },
    orderBy: { pageKey: "asc" },
  });
  const pageSettingsByKey = new Map(pageSettings.map((item) => [item.pageKey, item]));

  const seoSettings = {
    title: seo?.title ?? "",
    description: seo?.description ?? "",
    ogImageUrl: seo?.ogImageUrl ?? "",
    robots: seo?.robots ?? "",
    sitemapEnabled: seo?.sitemapEnabled ?? true,
    schemaJson: seo?.schemaJson ?? null,
    verificationMetaTags: seo?.verificationMetaTags ?? "",
    verificationHtmlFilename: seo?.verificationHtmlFilename ?? "",
    verificationHtmlContent: seo?.verificationHtmlContent ?? "",
    verificationHtmlFiles: mergeVerificationHtmlFiles(
      seo?.verificationHtmlFiles,
      seo?.verificationHtmlFilename,
      seo?.verificationHtmlContent
    ),
    pageSettings: SEO_PAGE_KEYS.map((pageKey) => {
      const item = pageSettingsByKey.get(pageKey);
      return {
        pageKey,
        title: item?.title ?? "",
        description: item?.description ?? "",
        ogImageUrl: item?.ogImageUrl ?? "",
        noIndex: item?.noIndex ?? false,
      };
    }),
  };

  return (
    <div className="flex flex-col gap-6">

      <SeoClient initialSeo={seoSettings} />
    </div>
  );
}
