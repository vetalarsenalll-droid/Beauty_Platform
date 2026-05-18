import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSystemHost, normalizeHost } from "@/lib/account-domains";
import { buildPublicSlugId } from "@/lib/public-slug";

type SitemapUrl = {
  loc: string;
  lastmod: string;
};

function sitemapXml(urls: SitemapUrl[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (item) =>
        `  <url>\n    <loc>${item.loc}</loc>\n    <lastmod>${item.lastmod}</lastmod>\n  </url>`
    )
    .join("\n")}\n</urlset>\n`;
}

export async function GET(request: Request) {
  const host = normalizeHost(request.headers.get("host") ?? "localhost:3000");
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : "https";

  if (host && !isSystemHost(host)) {
    const domain = await prisma.accountDomain.findFirst({
      where: {
        domain: host,
        verifiedAt: { not: null },
        account: { status: "ACTIVE" },
      },
      select: {
        account: {
          select: {
            id: true,
            slug: true,
            updatedAt: true,
            seoSettings: { select: { sitemapEnabled: true } },
            seoPageSettings: {
              where: { noIndex: true },
              select: { pageKey: true },
            },
            locations: {
              where: { status: "ACTIVE" },
              select: { id: true, updatedAt: true },
              orderBy: { id: "asc" },
            },
            services: {
              where: { isActive: true },
              select: { id: true, updatedAt: true },
              orderBy: { id: "asc" },
            },
            specialistProfiles: {
              where: { isPublic: true, user: { status: "ACTIVE" } },
              select: { id: true, updatedAt: true },
              orderBy: { id: "asc" },
            },
            promotions: {
              where: { isActive: true },
              select: { id: true, createdAt: true },
              orderBy: { id: "asc" },
            },
            legalDocuments: {
              select: {
                versions: {
                  where: { isActive: true },
                  select: { id: true, publishedAt: true },
                  orderBy: { version: "desc" },
                  take: 1,
                },
              },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
        },
      },
    });

    if (!domain || domain.account.seoSettings?.sitemapEnabled === false) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`,
        { headers: { "Content-Type": "application/xml; charset=utf-8" } }
      );
    }

    const noIndex = new Set(domain.account.seoPageSettings.map((item) => item.pageKey));
    const account = domain.account;
    const urls: SitemapUrl[] = [];
    const addUrl = (pageKey: string, pathname: string, lastmod: Date, fallbackKey?: string) => {
      if (noIndex.has(pageKey) || (fallbackKey && noIndex.has(fallbackKey))) return;
      urls.push({
        loc: `${protocol}://${host}${pathname === "/" ? "" : pathname}`,
        lastmod: lastmod.toISOString(),
      });
    };

    addUrl("home", "/", account.updatedAt);
    addUrl("booking", "/booking", account.updatedAt);
    addUrl("client", "/client", account.updatedAt);
    addUrl("locations", "/locations", account.updatedAt);
    account.locations.forEach((item) =>
      addUrl(`location:${item.id}`, `/locations/${item.id}`, item.updatedAt, "locationDetail")
    );
    addUrl("services", "/services", account.updatedAt);
    account.services.forEach((item) =>
      addUrl(`service:${item.id}`, `/services/${item.id}`, item.updatedAt, "serviceDetail")
    );
    addUrl("specialists", "/specialists", account.updatedAt);
    account.specialistProfiles.forEach((item) =>
      addUrl(`specialist:${item.id}`, `/specialists/${item.id}`, item.updatedAt, "specialistDetail")
    );
    addUrl("promos", "/promos", account.updatedAt);
    account.promotions.forEach((item) =>
      addUrl(`promo:${item.id}`, `/promos/${item.id}`, item.createdAt, "promoDetail")
    );
    account.legalDocuments.forEach((document) => {
      const version = document.versions[0];
      if (version) {
        addUrl(`legal:${version.id}`, `/legal/${version.id}`, version.publishedAt, "legal");
      }
    });

    return new NextResponse(sitemapXml(urls), {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  const pages = await prisma.publicPage.findMany({
    where: {
      status: "PUBLISHED",
      publishedVersionId: { not: null },
    },
    include: {
      account: {
        select: {
          id: true,
          slug: true,
          seoSettings: { select: { sitemapEnabled: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const urls = pages.filter((page) => page.account.seoSettings?.sitemapEnabled !== false).map((page) => {
    const slug = buildPublicSlugId(page.account.slug, page.account.id);
    const loc = `${protocol}://${host}/${slug}`;
    const lastmod = page.updatedAt.toISOString();
    return { loc, lastmod };
  });

  return new NextResponse(sitemapXml(urls), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
