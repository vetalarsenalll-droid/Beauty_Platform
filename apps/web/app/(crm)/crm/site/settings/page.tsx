import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { getPlatformPublicIp, getPlatformPublicOrigin } from "@/lib/account-domains";
import SiteSettingsClient from "./site-settings-client";

export default async function CrmSiteSettingsPage() {
  const session = await requireCrmPermission("crm.settings.read");
  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true, slug: true },
  });

  const domains = await prisma.accountDomain.findMany({
    where: { accountId: session.accountId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const publicSlug = account ? buildPublicSlugId(account.slug, account.id) : "";
  const platformOrigin = getPlatformPublicOrigin().replace(/\/+$/, "");
  const technicalUrl = publicSlug ? `${platformOrigin}/${publicSlug}` : platformOrigin;

  return (
    <SiteSettingsClient
      accountName={account?.name ?? "Сайт"}
      technicalUrl={technicalUrl}
      domainPlaceholder={account?.slug ? `${account.slug}.ru` : "example.ru"}
      platformPublicIp={getPlatformPublicIp()}
      initialDomains={domains.map((domain) => ({
        id: domain.id,
        domain: domain.domain,
        isPrimary: domain.isPrimary,
        status: domain.status,
        sslStatus: domain.sslStatus,
        verifiedAt: domain.verifiedAt?.toISOString() ?? null,
        lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
        lastError: domain.lastError ?? null,
        createdAt: domain.createdAt.toISOString(),
        updatedAt: domain.updatedAt.toISOString(),
      }))}
    />
  );
}
