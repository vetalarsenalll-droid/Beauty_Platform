import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parsePublicSlugId } from "@/lib/public-slug";
import { parseVerificationMetaTags } from "@/lib/seo-verification";
import { seoEntityFallbackKey, type SeoPageKey } from "@/lib/seo-pages";

export async function generatePublicPageMetadata(
  publicSlug: string,
  pageKey: SeoPageKey | string
): Promise<Metadata> {
  const parsed = parsePublicSlugId(publicSlug);
  if (!parsed) return {};
  const fallbackKey = seoEntityFallbackKey(pageKey);
  const pageKeys = fallbackKey ? [pageKey, fallbackKey] : [pageKey];

  const [globalSeo, pageSeo] = await Promise.all([
    prisma.seoSetting.findUnique({
      where: { accountId: parsed.id },
      select: {
        title: true,
        description: true,
        ogImageUrl: true,
        verificationMetaTags: true,
      },
    }),
    prisma.seoPageSetting.findMany({
      where: {
        accountId: parsed.id,
        pageKey: { in: pageKeys },
      },
      select: {
        pageKey: true,
        title: true,
        description: true,
        ogImageUrl: true,
        keywords: true,
        canonicalUrl: true,
        noIndex: true,
        noFollow: true,
      },
      orderBy: { pageKey: "asc" },
    }),
  ]);
  const pageSeoByKey = new Map(pageSeo.map((item) => [item.pageKey, item]));
  const seo = pageSeoByKey.get(pageKey) ?? (fallbackKey ? pageSeoByKey.get(fallbackKey) : null);

  const other: Record<string, string> = {};
  for (const tag of parseVerificationMetaTags(globalSeo?.verificationMetaTags)) {
    other[tag.name] = tag.content;
  }

  const title = seo?.title || globalSeo?.title || undefined;
  const description =
    seo?.description || globalSeo?.description || undefined;
  const ogImageUrl = seo?.ogImageUrl || globalSeo?.ogImageUrl || undefined;
  const keywords = seo?.keywords
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    title,
    description,
    keywords: keywords?.length ? keywords : undefined,
    openGraph: ogImageUrl ? { images: [ogImageUrl] } : undefined,
    alternates: seo?.canonicalUrl ? { canonical: seo.canonicalUrl } : undefined,
    robots:
      seo?.noIndex || seo?.noFollow
        ? { index: !seo.noIndex, follow: !seo.noFollow }
        : undefined,
    other,
  };
}
