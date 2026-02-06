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
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM · Сайт
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">SEO</h1>
        <p className="text-[color:var(--bp-muted)]">SEO настройки публичного сайта.</p>
      </header>

      <SeoClient initialSeo={seoSettings} />
    </div>
  );
}
