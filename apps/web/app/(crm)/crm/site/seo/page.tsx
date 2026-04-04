import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SeoClient from "./seo-client";

export default async function CrmSiteSeoPage() {
  const session = await requireCrmPermission("crm.settings.read");

  const seo = await prisma.seoSetting.findUnique({
    where: { accountId: session.accountId },
  });

  const seoSettings = {
    title: seo?.title ?? "",
    description: seo?.description ?? "",
    ogImageUrl: seo?.ogImageUrl ?? "",
    robots: seo?.robots ?? "",
    sitemapEnabled: seo?.sitemapEnabled ?? true,
    schemaJson: seo?.schemaJson ?? null,
  };

  return (
    <div className="flex flex-col gap-6">

      <SeoClient initialSeo={seoSettings} />
    </div>
  );
}
